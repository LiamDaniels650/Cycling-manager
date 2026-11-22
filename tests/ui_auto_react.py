"""Interface React : vérifie tous les boutons « Auto » (🧑‍💼) — chaque écran est parcouru au cours d'une saison,
chaque bouton auto visible est cliqué pour de vrai et doit agir (message de l'adjoint ou état modifié) sans erreur
JavaScript. Vérifie aussi la carte d'appel radio et le DS automatique en course (ordres radio donnés)."""
import asyncio, os, sys
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
URL = 'file://' + os.path.join(HERE, '..', 'dist', 'react.html')

SCREENS = {
    'équipe': "go('team')",
    'académie': "UI.acaTab='aca';go('aca')",
    'marché': "UI.mkt='free';go('market')",
    'gestion': "go('mgmt')",
    'presse': "go('press')",
    'planification': "UI.calTab='plan';go('cal')",
}
# boutons « Auto » de l'écran courant (pas la barre de navigation)
AUTOS = "[...document.querySelectorAll('main button, #root button')].filter(b=>b.textContent.includes('🧑‍💼') && !b.closest('nav'))"


async def click_autos(pg, label, seen):
    n = await pg.evaluate(f"()=>{AUTOS}.length")
    for k in range(n):
        info = await pg.evaluate(
            f"""(k)=>{{ const b={AUTOS}[k]; if(!b) return null;
            const before=JSON.stringify(S).length; const txt=b.textContent.trim(); UI.flash=null; b.click();
            return {{txt, fl:String(UI.flash||'').slice(0,90), changed: JSON.stringify(S).length!==before}}; }}""",
            k,
        )
        await pg.wait_for_timeout(30)
        if info:
            seen[label + ' · ' + info['txt']] = info
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
        await pg.click('text=Choisir mon équipe'); await pg.click('text=Créer Mon Équipe')
        await pg.evaluate("()=>{ S.tipsOff=true; if(S.disco) discoAll(); render(); }")
        seen = {}
        for stop in range(5):
            await pg.evaluate("()=>{ if(S.week<20){ S.raiseReq={id:S.teams[0].riders[0],ask:400,w:S.week}; } }")
            for label, js in SCREENS.items():
                await pg.evaluate(f"()=>{{ {js}; }}")
                await pg.wait_for_timeout(50)
                await click_autos(pg, label, seen)
            await pg.evaluate("()=>{ for(let k=0;k<7;k++){ const i=nextRaceIdx(); if(i<0) break; advanceToNextRace(); simulateRaceAuto(i);} render(); }")
        await pg.evaluate("()=>{ const i=nextRaceIdx(); if(i>=0){ advanceToNextRace(); prepRace(i);} }")
        await pg.wait_for_timeout(50)
        await click_autos(pg, 'sélection', seen)
        await pg.evaluate("()=>{ confirmSel(); go('race'); }")
        await pg.wait_for_timeout(50)
        await click_autos(pg, 'briefing', seen)
        # appel radio : la carte s'affiche, le clic sur une option est pris en compte
        st = await pg.evaluate("""()=>{ UI.autoDS=false; startStage(); stopTimer(); const sim=UI.sim; if(!sim) return 'itt';
            for(let k=0;k<20;k++) simTick(sim);
            window.__got=null;
            askOpen(sim,{key:'test',txt:'📻 Test radio',opts:[['a','Option A'],['b','Option B']],def:'b',self:'test',auto:()=>'a',act:k=>{window.__got=k;}});
            render(); return 'ok'; }""")
        radio_ok = True
        if st == 'ok':
            await pg.wait_for_timeout(200)
            await pg.click('text=Option A')
            await pg.wait_for_timeout(100)
            radio = await pg.evaluate("()=>({got: window.__got, cleared: !UI.sim.ask})")
            print('Appel radio :', radio)
            radio_ok = radio['got'] == 'a' and radio['cleared']
        ds = await pg.evaluate("""()=>{ UI.autoDS=true; startStage(); stopTimer(); const sim=UI.sim; if(!sim) return {itt:true};
            let k=0; while(!sim.done && k++<5000) simTick(sim); const L=sim.log.map(l=>l.txt);
            return { orders: L.filter(t=>t.includes('🤖')).length }; }""")
        await b.close()
        ok = True
        for k, v in sorted(seen.items()):
            acted = bool(v['fl']) or v['changed']
            ok &= acted
            print(('✔' if acted else '✖'), k, '→', v['fl'] or ('état modifié' if v['changed'] else 'AUCUN EFFET'))
        print('DS automatique :', ds)
        if not ds.get('itt') and ds.get('orders', 0) < 1:
            ok = False
            print("✖ le DS automatique n'a donné aucun ordre")
        if not radio_ok:
            ok = False
            print("✖ la carte d'appel radio ne fonctionne pas")
        print('Boutons auto testés :', len(seen))
        print('ERREURS JS :', errs or 'aucune')
        sys.exit(0 if ok and not errs and len(seen) >= 5 else 1)


asyncio.run(main())
