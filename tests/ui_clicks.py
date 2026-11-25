"""Navigation par de vrais clics, sans jamais appeler le jeu de l'extérieur : chaque clic doit changer ce que l'écran
affiche. Les autres tests pilotent souvent le jeu par des appels directs (render() compris) : ils n'avaient pas vu
qu'une compaction du code supprimait les appels internes à render() (boutons sans effet visible pour le joueur).
Usage : python3 tests/ui_clicks.py   (code 1 si un clic ne change pas l'écran)"""
import asyncio, os, sys
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
URL = 'file://' + os.path.join(HERE, '..', 'dist', 'react.html')


async def main():
    bad, errs = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for vw, vh, tag in [(390, 844, 'téléphone'), (1280, 900, 'ordinateur')]:
            pg = await b.new_page(viewport={'width': vw, 'height': vh})
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(URL)
            await pg.evaluate(
                "()=>new Promise(r=>{try{localStorage.clear()}catch(e){}; const q=indexedDB.deleteDatabase('dsc_save'); q.onsuccess=q.onerror=q.onblocked=()=>r(1);})"
            )
            await pg.reload()
            body = lambda: pg.inner_text('body')

            async def click(loc, what):
                before = await body()
                try:
                    await loc.first.click(timeout=5000)
                except Exception as e:
                    bad.append(f'{tag} : impossible de cliquer sur « {what} »')
                    return False
                await pg.wait_for_timeout(250)
                if await body() == before:
                    bad.append(f'{tag} : le clic sur « {what} » ne change pas l’écran')
                    return False
                return True

            await click(pg.get_by_text('Choisir mon équipe'), 'Choisir mon équipe')
            await click(pg.get_by_text('Créer Mon Équipe'), 'Créer Mon Équipe')
            # menu principal : chaque espace, puis retour à l'accueil
            for name in ['Effectif', 'Courses', 'Marché', 'Gestion', 'Aujourd’hui']:
                await click(pg.locator('button:visible', has_text=name), name)
            # préparation de la première course, depuis le bouton principal de l'accueil
            await click(pg.locator('button.bg-sky-500:visible, button.bg-amber-400:visible'), 'bouton principal de l’accueil')
            await pg.close()
        await b.close()
    for x in bad:
        print('✖ ' + x)
    print('ERREURS JS : ' + ('; '.join(errs[:3]) if errs else 'aucune'))
    if not bad and not errs:
        print('✔ chaque clic change l’écran (téléphone et ordinateur)')
    sys.exit(1 if bad or errs else 0)


asyncio.run(main())
