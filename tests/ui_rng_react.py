"""Interface React : l'affichage ne touche jamais au hasard de la partie. Parcourt tous les écrans (et leurs onglets,
role="tab") en début de partie, après quelques semaines, pendant une course (préparation, briefing, direct, bilan
d'étape) et en mode carrière ; échoue si un rendu a fait avancer la série aléatoire (garde de App.jsx :
window.__rngLeaks) ou si une simple navigation l'a fait avancer."""
import asyncio, os, sys
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
URL = 'file://' + os.path.join(HERE, '..', 'dist', 'react.html')
VIEWS = ['home', 'inbox', 'world', 'press', 'stories', 'cal', 'team', 'prepa', 'locker', 'aca', 'market', 'mgmt',
         'board', 'facil', 'adjoint', 'fin', 'staff', 'equip', 'stats', 'names', 'opt']
# onglets d'un écran : on les ouvre un à un (pas les boutons d'action)
TABS = "[...document.querySelectorAll('[role=tab]')].filter(b=>!b.closest('nav'))"


async def visit(pg, label, views, bad):
    for v in views:
        sd = await pg.evaluate(f"()=>{{ const s=_sd; try{{ go('{v}'); }}catch(e){{}} return s; }}")
        await pg.wait_for_timeout(60)
        n = await pg.evaluate(f"()=>{TABS}.length")
        for k in range(n):
            await pg.evaluate(f"(k)=>{{ const b={TABS}[k]; if(b) b.click(); }}", k)
            await pg.wait_for_timeout(30)
        after = await pg.evaluate("()=>_sd")
        if after != sd:
            bad.append(f'{label} · {v} : la navigation a fait avancer le hasard')


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1280, 'height': 900})
        errs, bad = [], []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL)
        await pg.evaluate("()=>new Promise(r=>{try{localStorage.clear()}catch(e){}; const q=indexedDB.deleteDatabase('dsc_save'); q.onsuccess=q.onerror=q.onblocked=()=>r(1);})")
        await pg.reload()
        await pg.click('text=Choisir mon équipe')
        await pg.click('text=Créer Mon Équipe')
        await pg.evaluate("()=>{ S.tipsOff=true; if(S.disco) discoAll(); render(); }")
        await visit(pg, 'début de partie', VIEWS, bad)
        # quelques semaines plus tard (messages, presse, histoires, résultats)
        await pg.evaluate("()=>{ for(let k=0;k<6;k++){ const i=nextRaceIdx(); if(i<0) break; advanceToNextRace(); simulateRaceAuto(i);} render(); }")
        await visit(pg, 'en saison', VIEWS, bad)
        # course : préparation, briefing, direct, bilan d'étape
        await pg.evaluate("()=>{ const i=nextRaceIdx(); if(i>=0){ advanceToNextRace(); prepRace(i);} }")
        await visit(pg, 'préparation', ['prep'], bad)
        await pg.evaluate("()=>{ confirmSel(); go('race'); }")
        await visit(pg, 'briefing', ['race'], bad)
        await pg.evaluate("()=>{ UI.autoDS=true; startStage(); stopTimer(); const sim=UI.sim; if(sim) for(let k=0;k<60;k++) simTick(sim); render(); }")
        await visit(pg, 'course en direct', ['race'], bad)
        await pg.evaluate("()=>{ const sim=UI.sim; if(sim){ while(!sim.done) simTick(sim); finishStageUI(); } render(); }")
        await visit(pg, "bilan d'étape", ['race', 'home', 'stats'], bad)
        # mode carrière
        await pg.evaluate("()=>{ carNewGame({fn:'Test',ln:'Hasard',nat:'FRA',arch:'complet',gab:'moyen',dreams:['pro'],studies:'sport',seed:5}); S.tipsOff=true; UI.view='career'; render(); }")
        await pg.wait_for_timeout(100)
        await visit(pg, 'carrière', ['career', 'home', 'stats', 'opt'], bad)
        leaks = await pg.evaluate("()=>globalThis.__rngLeaks || []")
        await b.close()
        for x in bad:
            print('✖', x)
        if leaks:
            print('✖ rendus qui ont consommé du hasard (série rétablie par la garde) :', sorted(set(leaks)))
        print('ERREURS JS :', errs or 'aucune')
        ok = not bad and not leaks and not errs
        print('✔ affichage sans effet sur le hasard' if ok else '✖ affichage et hasard')
        sys.exit(0 if ok else 1)


asyncio.run(main())
