"""Partie test « comme un joueur » dans le navigateur : nouvelle partie en mode essentiel, courses ordinaires
confiées à l'adjoint jusqu'à la prochaine course importante, courses importantes dirigées avec les boutons auto
(chaque étape jouée jusqu'au bout), fin de saison. Mesure le temps réel, le nombre d'actions, les messages,
la taille de la sauvegarde et les erreurs JavaScript.
Usage : python3 tests/playthrough.py [saisons=1]"""
import asyncio, os, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))
URL = 'file://' + os.path.join(ROOT, '..', 'dist', 'index.html')
NS = int(sys.argv[1]) if len(sys.argv) > 1 else 1


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 390, 'height': 844})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL)
        await pg.evaluate("""()=>new Promise(r=>{try{localStorage.clear()}catch(e){}; const q=indexedDB.deleteDatabase('dsc_save'); q.onsuccess=q.onerror=q.onblocked=()=>r(1);})""")
        await pg.reload()
        await pg.click('text=Nouvelle partie')
        await pg.evaluate("()=>{S.tipsOff=true;save();}")
        actions = 0
        t0 = time.time()
        stats = []
        for season in range(NS):
            ts = time.time()
            key_races = deleg_chains = 0
            while True:
                st = await pg.evaluate("""()=>{ const i=nextRaceIdx(); if(i<0) return {end:true};
                    const c=S.cal[i]; return {i, key:isKeyRace(c), worlds:!!c.worlds, inv:!c.inv||c.inv.includes(0), w:c.w, week:S.week}; }""")
                if st.get('end'):
                    break
                if st['worlds'] or not st['inv']:
                    # Mondiaux et courses où l'on n'est pas invité : simulées
                    await pg.evaluate("""i=>new Promise(r=>{ advanceToNextRace(); if(S.cal[i].worlds){ runWorlds(i); save(); r(1);} else simulateRaceAsync(i,()=>{save();r(1);}); })""", st['i'])
                    actions += 1
                    continue
                if not st['key']:
                    # « Confier jusqu'à … » : une action pour toute la série de courses ordinaires
                    await pg.evaluate("""()=>new Promise(r=>{ delegateUntilKey(); const t=setInterval(()=>{ if(!UI.chain && !UI.busy){clearInterval(t); r(1);} },50); })""")
                    actions += 1
                    deleg_chains += 1
                    continue
                # course importante : on la dirige avec les boutons auto, chaque étape en direct jusqu'au bout
                key_races += 1
                await pg.evaluate("i=>{advanceToNextRace(); prepRace(i); confirmSel();}", st['i'])
                actions += 2
                while True:
                    done = await pg.evaluate("""()=>{ const rc=S.rc; if(!rc||rc.done) return true;
                        briefAuto(); startStage(); if(UI.sim){ stopTimer(); toEnd(); } if(UI.lastStage && !S.rc.done) nextStage(); return !S.rc || S.rc.done; }""")
                    actions += 3
                    if done:
                        break
                await pg.evaluate("()=>{ if(S.rc && S.rc.done) closeRace(); save(); }")
                actions += 1
            info = await pg.evaluate("""()=>({ season:S.season, wins:seasonWins(0), msgs:S.inbox.filter(m=>m.season===S.season).length,
                imp:S.inbox.filter(m=>m.season===S.season && m.imp).length, size:JSON.stringify(S).length })""")
            await pg.evaluate("()=>{ advanceToNextRace(); idbBackup(); endSeason(); save(); }")
            actions += 1
            info.update(dict(t=round(time.time() - ts), key_races=key_races, chains=deleg_chains))
            stats.append(info)
            print(f"Saison {info['season']} : {info['t']} s · {key_races} courses importantes dirigées · {deleg_chains} délégations · "
                  f"{info['wins']} victoires · messages {info['msgs']} (importants {info['imp']}) · partie {info['size']//1024} Ko", flush=True)
        print(f'Actions du joueur : {actions} · temps total {round(time.time() - t0)} s')
        print('ERREURS JS :', errs[:5] if errs else 'aucune')
        await b.close()
        sys.exit(1 if errs else 0)


asyncio.run(main())
