"""Vérifie tous les boutons « auto » (🧑‍💼) de l'interface : chaque écran est parcouru au cours d'une saison,
chaque bouton auto visible est cliqué pour de vrai, et l'on contrôle qu'il agit (message de l'adjoint ou état
modifié) sans erreur JavaScript. Vérifie aussi le DS automatique en course (ordres radio donnés)."""
import asyncio, os, sys
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
URL = 'file://' + os.path.join(HERE, '..', 'dist', 'index.html')

# Écrans de gestion à visiter (code JS qui y mène).
SCREENS = {
    'équipe': "go('team')",
    'académie': "UI.acaTab='aca';go('aca')",
    'courses espoirs': "UI.acaTab='esp';go('aca')",
    'anciens': "UI.acaTab='alum';go('aca')",
    'marché': "UI.mkt='free';go('market')",
    'gestion': "go('mgmt')",
    'presse': "go('press')",
    'planification': "UI.calTab='plan';go('cal')",
}


async def click_autos(pg, label, seen, errs):
    """Clique chaque bouton .auto de l'écran courant (re-rendu après chaque clic)."""
    n = await pg.evaluate("()=>document.querySelectorAll('#main button.auto').length")
    for k in range(n):
        info = await pg.evaluate(
            """(k)=>{ const b=[...document.querySelectorAll('#main button.auto')][k]; if(!b) return null;
            const before=JSON.stringify(S).length; const txt=b.textContent.trim(); UI.flash=null; b.click();
            const fl=(document.querySelector('#main .flash')||{}).textContent||''; return {txt, fl:fl.slice(0,90), changed: JSON.stringify(S).length!==before}; }""",
            k,
        )
        if not info:
            continue
        key = label + ' · ' + info['txt']
        seen[key] = info
    return n


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 390, 'height': 844})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL)
        await pg.evaluate("()=>new Promise(r=>{try{localStorage.clear()}catch(e){}; const q=indexedDB.deleteDatabase('dsc_save'); q.onsuccess=q.onerror=q.onblocked=()=>r(1);})")
        await pg.reload()
        await pg.click('text=Nouvelle partie')
        await pg.evaluate("()=>{ S.tipsOff=true; }")
        seen = {}
        # 1. écrans de gestion à plusieurs moments de la saison
        for stop in range(5):
            await pg.evaluate("()=>{ if(S.week<20){ S.raiseReq={id:S.teams[0].riders[0],ask:400,w:S.week}; } }")
            for label, js in SCREENS.items():
                await pg.evaluate(f"()=>{{ {js}; }}")
                await click_autos(pg, label, seen, errs)
            # avance de quelques courses (simulées) ; offres d'équipementiers en semaine 26
            await pg.evaluate("()=>{ for(let k=0;k<7;k++){ const i=nextRaceIdx(); if(i<0) break; advanceToNextRace(); simulateRaceAuto(i);} render(); }")
        # 2. sélection et briefing d'une course
        await pg.evaluate("()=>{ const i=nextRaceIdx(); if(i>=0){ advanceToNextRace(); prepRace(i);} }")
        await click_autos(pg, 'sélection', seen, errs)
        await pg.evaluate("()=>{ confirmSel(); go('race'); }")
        await click_autos(pg, 'briefing', seen, errs)
        # 2 bis. appel radio d'un coureur : la carte s'affiche et la réponse est prise en compte
        radio = await pg.evaluate("""()=>{ UI.autoDS=false; startStage(); stopTimer(); const sim=UI.sim; if(!sim) return {itt:true};
            for(let k=0;k<20;k++) simTick(sim);
            const x=sim.runners.find(x=>x.player && !x.dnf); let got=null;
            askOpen(sim,{key:'test',txt:'📻 Test radio',opts:[['a','Option A'],['b','Option B']],def:'b',self:'test',auto:()=>'a',act:k=>{got=k;}});
            renderLive(); const btn=document.querySelector('.ask button.pri'); if(!btn) return {card:false};
            btn.click(); return {card:true, got, cleared: !UI.sim.ask, nego: typeof negoHTML(sim)}; }""")
        print('Appel radio :', radio)
        radio_ok = radio.get('itt') or (radio.get('card') and radio.get('got') == 'a' and radio.get('cleared'))
        # 3. DS automatique en course : il doit donner des ordres radio
        ds = await pg.evaluate("""()=>{ UI.autoDS=true; startStage(); stopTimer(); const sim=UI.sim; if(!sim) return {itt:true};
            let k=0; while(!sim.done && k++<5000) simTick(sim); const L=sim.log.map(l=>l.txt);
            return { orders: L.filter(t=>t.includes('🤖')).length, sample: L.filter(t=>t.includes('🤖')).slice(0,3) }; }""")
        await b.close()
        ok = True
        for k, v in sorted(seen.items()):
            acted = bool(v['fl']) or v['changed']
            ok &= acted
            print(('✔' if acted else '✖'), k, '→', v['fl'] or ('état modifié' if v['changed'] else 'AUCUN EFFET'))
        print('DS automatique :', ds)
        if not ds.get('itt') and ds.get('orders', 0) < 1:
            ok = False
            print('✖ le DS automatique n\'a donné aucun ordre')
        if not radio_ok:
            ok = False
            print('✖ la carte d\'appel radio ne fonctionne pas')
        print('Boutons auto testés :', len(seen))
        print('ERREURS JS :', errs or 'aucune')
        sys.exit(0 if ok and not errs else 1)


asyncio.run(main())
