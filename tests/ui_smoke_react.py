"""Test de fumée de l'interface dans Chrome sans écran : nouvelle partie, saison complète
(DS auto, ordres conditionnels, plans, forfaits), radio, CLM par équipes, import d'une
ancienne sauvegarde, rechargement, presse (interviews), watts, équipementiers, offres d'emploi, adjoint (délégation complète), retransmission animée, aide, cartes, classement UCI et revalorisations. Échoue si une erreur JavaScript apparaît."""
import asyncio, os, sys, time
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__)); URL='file://'+os.path.join(HERE,'..','dist','react.html')
SEASON = """
() => { const out=[]; let k=0; for(const a of Object.keys(AUTO_LBL)){ doAsst(a); setAuto(a,true); } go('team'); tipDone('team'); go('aca'); go('market'); UI.tableMode='table'; go('market'); UI.tableMode=null; go('opt'); UI.stats='uci'; go('stats');
  UI.calTab='plan'; go('cal'); autoPlanSeason(); render(); UI.calTab='cal';
  for(let guard=0; guard<60; guard++){
    const i=nextRaceIdx(); if(i<0) break;
    if(S.week<S.cal[i].w) advance();
    if(S.pressQ){ go('press'); doAnswer(k%S.pressQ.opts.length); }
    const c=S.cal[i];
    if(c.worlds){ go('cal'); const pv=worldsPreview(i); if(pv[0]) setWorldsWish(pv[0].id,'leader'); render(); runWorlds(i); render(); out.push(c.name); continue; }
    if((c.inv && !c.inv.includes(0)) || c.key==='omloop'){ simulateRaceAuto(i); render(); continue; }
    prepRace(i); if(reconUseful(c) && k%3===0) reconPrep(); confirmSel(); go('race'); setGear('wheels', k%2?'hautes':'basses'); setGear('tyres','larges'); render();
    if(!isITT(S.rc.specs[0]) && !isTTT(S.rc.specs[0])){ setPlan('debut','offensif'); setPlan('final','durcir');
      const ids=S.rc.sel[0]; UI.condForm={id:ids[0],c:'km',p:15,a:'attack'}; addCond(); UI.condForm={id:ids[1],c:'favAtt',p:null,a:'chase'}; addCond(); }
    UI.autoDS=(k++%2===0);
    if(k%3===1){ briefAuto(); setFeed('renforce'); }
    while(!S.rc.done){ startStage(); if(UI.sim){ UI.sim.autoPause=false; for(let t=0;t<200&&!UI.sim.done;t++){ simTick(UI.sim); if(UI.sim.allyOffer) allyUI(t%2===0); } renderLive(); if(!UI.sim.done && !UI.sim.ally) allyUI('ask'); if(UI.sim.ally) allyUI('break'); toEnd(); } if(!S.rc.done) nextStage(); }
    out.push(S.rc.name); closeRace();
  }
  for(const id of S.teams[0].riders){ if(S.riders[id].contract<=1) extendRider(id,2); }
  go('mgmt'); if(S.eqOffers){ const ms=['perf','cash']; Object.keys(S.eqOffers).forEach((c,j)=>doEqNego(c,0,ms[j%2])); for(const c of Object.keys(S.eqOffers)) doEq(c,0); }
  S.raiseReq={id:S.teams[0].riders[0],ask:500,w:S.week}; go('team'); doRaise(true);
  advanceToNextRace(); endSeason(); save();
  S.jobOffers=[{tid:S.teams[2].id,name:S.teams[2].name,rank:2,budget:clubBudget(S.teams[2].tier)}]; go('mgmt');
  for(const v of ['home','cal','aca','market','mgmt','stats','press','inbox','opt','team']) go(v);
  openTeam(S.teams[3].id); closeModal(); openNav(); closeModal(); UI.stats='rivals'; go('stats'); UI.calPast=true; go('cal'); UI.calPast=false; go('home');
  UI.mkt='merc'; go('market'); UI.mercAll=true; render(); UI.mercMine=true; render(); UI.mercAll=false; UI.mercMine=false; UI.mkt='free';
  UI.stats='legends'; go('stats'); UI.stats='review'; go('stats'); UI.stats='watts'; go('stats'); const top=(S.pwRec[0]||{}).id||S.teams[0].riders[0]; openRider(top); UI.riderTab='car'; renderModal(); closeModal();
  return out.length+' courses, saison '+S.season;
}"""
RADIO = """
() => { advance(); prepRace(nextRaceIdx()); confirmSel(); startStage(); stopTimer(); UI.sim.autoPause=false;
  for(let i=0;i<60;i++) simTick(UI.sim);
  const xs=UI.sim.runners.filter(x=>x.player); const f=UI.sim.runners.find(y=>!y.player&&UI.sim.favs.has(y.id));
  openRadio(xs[0].id); sendRadio(xs[0].id,'mark'); setMark(xs[0].id,f.id);
  for(const k of ['front','pace','bottles','chase','reset']) sendRadio(xs[1].id,k);
  for(const k of ['chase','front','echelon','stop','reset']) teamRadio(k);
  UI.sim.autoDS=true; UI.pauseHl=true; for(let i=0;i<300&&!UI.sim.done;i++){ simTick(UI.sim); if(i%25===0){ UI.speed=2; loop(); } } renderLive(); tvHTML(0.5); toEnd(); return 'radio ok'; }"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':400,'height':860})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.evaluate("()=>new Promise(r=>{try{localStorage.clear()}catch(e){}; const q=indexedDB.deleteDatabase('dsc_save'); q.onsuccess=q.onerror=q.onblocked=()=>r(1);})"); await pg.reload()
        await pg.click('text=Choisir mon équipe'); await pg.click('text=Créer Mon Équipe')
        print(await pg.evaluate(RADIO))
        await pg.evaluate("()=>{ closeRace(); }")
        t=time.time(); print(await pg.evaluate(SEASON), f'({time.time()-t:.0f}s)')
        await pg.reload(); await pg.wait_for_timeout(300)
        for v,f in [("()=>{UI.stats='watts';go('stats')}",'shot_watts.png'),("()=>go('press')",'shot_press.png'),("()=>go('mgmt')",'shot_mgmt.png'),("()=>{UI.stats='legends';go('stats')}",'shot_legends.png'),("()=>{UI.stats='review';go('stats')}",'shot_review.png'),("()=>{UI.mkt='merc';go('market')}",'shot_mercato.png'),("()=>go('home')",'shot_home.png'),("()=>{UI.stats='rivals';go('stats')}",'shot_rivals.png'),("()=>{UI.calTab='plan';go('cal')}",'shot_plan.png')]:
            await pg.evaluate(v); await pg.screenshot(path=os.path.join(HERE,'out',f),full_page=True)
        await pg.evaluate("()=>{ advanceToNextRace(); const i=nextRaceIdx(); prepRace(i); }"); await pg.screenshot(path=os.path.join(HERE,'out','shot_prep.png'),full_page=True)
        await pg.evaluate("()=>{ confirmSel(); go('race'); }"); await pg.screenshot(path=os.path.join(HERE,'out','shot_brief.png'),full_page=True)
        v1=open(os.path.join(HERE,'fixtures','save_v1.json')).read()
        print('import v1 ->', await pg.evaluate("(t)=>{ const ok=importSave(t); save(); go('race'); return ok&&S.v; }", v1))
        await pg.evaluate("()=>{ while(S.rc && !S.rc.done){ startStage(); if(UI.sim) toEnd(); if(!S.rc.done) nextStage(); } closeRace(); go('team'); }")
        await pg.screenshot(path=os.path.join(HERE,'out','last_screen.png'),full_page=True)
        await b.close()
        print('ERREURS JS :', errs or 'aucune'); sys.exit(1 if errs else 0)
asyncio.run(main())
