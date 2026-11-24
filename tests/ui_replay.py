"""Signalement et rejeu : dans le navigateur, une étape jouée avec des ordres radio est signalée en pleine course, puis
une autre à l'arrivée ; tools/replay.js rejoue chaque rapport et doit retrouver exactement la même course (groupes
à l'instant signalé, résultat de l'étape)."""
import asyncio, json, os, subprocess, sys, tempfile
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
URL = 'file://' + os.path.join(HERE, '..', 'dist', 'react.html')


def replay(rep):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
        json.dump(rep, f)
    out = subprocess.run(['node', os.path.join(HERE, '..', 'tools', 'replay.js'), f.name], capture_output=True, text=True)
    os.unlink(f.name)
    return out.stdout + out.stderr


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL)
        await pg.evaluate("()=>new Promise(r=>{try{localStorage.clear()}catch(e){}; const q=indexedDB.deleteDatabase('dsc_save'); q.onsuccess=q.onerror=q.onblocked=()=>r(1);})")
        await pg.reload()
        await pg.click('text=Choisir mon équipe')
        await pg.click('text=Créer Mon Équipe')
        # une course en ligne (pas un chrono), en direct, avec des ordres donnés à des instants différents
        rep1 = await pg.evaluate("""()=>{ S.tipsOff=true;
            for(let k=0;k<12;k++){ const i=nextRaceIdx(); if(i<0) break; advanceToNextRace();
              const sp=S.cal[i].stagesSpec[0]; if(sp[0]==='clm'||sp[0]==='clmeq'||(S.cal[i].inv&&!S.cal[i].inv.includes(0))){ simulateRaceAuto(i); continue; }
              prepRace(i); confirmSel(); break; }
            UI.autoDS=false; startStage(); stopTimer(); const sim=UI.sim;
            const mine=sim.runners.filter(x=>x.player);
            for(let k=0;k<40;k++) simTick(sim);
            sendRadio(mine[1].id,'chase');
            for(let k=0;k<30;k++) simTick(sim);
            teamRadio('front');
            for(let k=0;k<25;k++) simTick(sim);
            sendRadio(mine[2].id,'attack');
            for(let k=0;k<10;k++) simTick(sim);
            return reportBuild('test : signalement en pleine course'); }""")
        # la même étape continue jusqu'à l'arrivée, puis un signalement depuis le bilan
        rep2 = await pg.evaluate("""()=>{ const sim=UI.sim; for(let k=0;k<20;k++) simTick(sim); sendRadio(sim.runners.find(x=>x.player&&!x.fin).id,'stop');
            while(!sim.done) simTick(sim); finishStageUI(); return reportBuild('test : signalement après l’arrivée'); }""")
        await b.close()
    ok = True
    for name, rep, want in (('en course', rep1, 'course identique'), ("à l'arrivée", rep2, 'résultat identique')):
        out = replay(rep)
        good = want in out and '✖' not in out
        ok &= good
        print(('✔' if good else '✖'), f'rejeu du signalement {name} ({len(rep["stage"]["inputs"])} ordres)')
        if not good:
            print(out[-3000:])
    # témoin : sans les ordres du joueur, la course n'est plus la même (la vérification sait dire « différent »)
    bare = dict(rep1, stage=dict(rep1['stage'], inputs=[]))
    out = replay(bare)
    neg = 'la course diffère' in out
    ok &= neg
    print(('✔' if neg else '✖'), 'témoin : sans les ordres, le rejeu est bien déclaré différent')
    print('ERREURS JS :', errs or 'aucune')
    sys.exit(0 if ok and not errs else 1)


asyncio.run(main())
