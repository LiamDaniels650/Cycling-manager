"""Vérifie la simulation en arrière-plan (Web Worker) : même vainqueur qu'un calcul direct, sans erreur."""
import asyncio
from playwright.async_api import async_playwright
import os
URL="file://" + os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dist", "index.html")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':390,'height':844})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.evaluate("()=>new Promise(r=>{try{localStorage.clear()}catch(e){}; const q=indexedDB.deleteDatabase('dsc_save'); q.onsuccess=q.onerror=q.onblocked=()=>r(1);})"); await pg.reload()
        await pg.click('text=Choisir mon équipe'); await pg.click('text=Créer Mon Équipe')
        r = await pg.evaluate("""()=>new Promise(res=>{
          const i = nextRaceIdx(); advanceToNextRace();
          const snap = JSON.stringify(S), sd = _sd;
          // calcul direct sur une copie, pour comparaison
          S = JSON.parse(snap); _sd = sd; simulateRaceAuto(i); const direct = S.cal[i].winner;
          S = JSON.parse(snap); _sd = sd;
          const t0 = performance.now();
          simulateRaceAsync(i, () => res({ worker: !UI.noWorker && !!SIM_WORKER, winner: S.cal[i].winner, direct, ms: Math.round(performance.now()-t0), done: S.cal[i].done }));
        })""")
        print(r); await b.close(); print('errs', errs)
asyncio.run(main())
