"""Comparaison des écrans : chaque écran principal, dans une partie toujours identique (même graine, même horloge),
est capturé et comparé à son image de référence (tests/visual/). Un écran qui change sans qu'on l'ait voulu (bloc en
double, bouton qui ajoute une ligne, texte qui déborde) fait échouer le test ; l'image des différences (en rose) est
écrite dans tests/out/visual-diff-*.png.
Usage : python3 tests/ui_visual.py            comparer
        python3 tests/ui_visual.py --update   refaire les références (après un changement voulu de l'interface)
Les références dépendent du navigateur et des polices de la machine : elles sont faites pour la machine de
développement (le test n'est pas lancé dans GitHub Actions)."""
import asyncio, os, sys
from io import BytesIO
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
URL = 'file://' + os.path.join(HERE, '..', 'dist', 'react.html')
REF = os.path.join(HERE, 'visual')
OUT = os.path.join(HERE, 'out')
UPDATE = '--update' in sys.argv
TOL = 0.002  # part des pixels qui peuvent différer (anticrénelage) : 0,2 %

# horloge figée (dates affichées, « il y a 2 min ») : la capture ne dépend pas du jour du test
FREEZE = """(() => { const T = Date.UTC(2026, 0, 15, 10, 0, 0); const D = Date;
  class F extends D { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } }
  globalThis.Date = F; })();"""
SCREENS = [
    ('accueil', "UI.view='home'"),
    ('effectif', "UI.view='team'"),
    ('calendrier', "UI.view='cal'"),
    ('marche', "UI.view='market'"),
    ('gestion', "UI.view='mgmt'"),
    ('messages', "UI.view='inbox'"),
    ('statistiques', "UI.view='stats'"),
    ('staff', "UI.view='staff'"),
    ('options', "UI.view='opt'"),
]


def diff(a, b):
    """Part des pixels qui diffèrent nettement, et l'image des différences."""
    if a.size != b.size:
        return 1.0, None
    x = np.asarray(a.convert('RGB'), dtype=np.int16)
    y = np.asarray(b.convert('RGB'), dtype=np.int16)
    m = np.abs(x - y).max(axis=2) > 40
    img = (np.asarray(a.convert('RGB')) * 0.35).astype(np.uint8)
    img[m] = [244, 114, 182]
    return m.mean(), Image.fromarray(img)


async def main():
    os.makedirs(REF, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    bad, errs, n = [], [], 0
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for vw, vh, tag in [(390, 844, 'tel'), (1280, 900, 'ordi')]:
            pg = await b.new_page(viewport={'width': vw, 'height': vh}, device_scale_factor=1)
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.add_init_script(FREEZE)
            await pg.goto(URL)
            await pg.evaluate(
                "()=>new Promise(r=>{try{localStorage.clear()}catch(e){}; const q=indexedDB.deleteDatabase('dsc_save'); q.onsuccess=q.onerror=q.onblocked=()=>r(1);})"
            )
            await pg.reload()
            # une partie toujours identique : même graine, trois courses déjà disputées, une étape jouée
            await pg.evaluate(
                """()=>{ newGame('Visuel', 4242, 'normal'); S.tipsOff = true;
                for (let k = 0; k < 3; k++) { const i = nextRaceIdx(); advanceToNextRace(); simulateRaceAuto(i); }
                UI.view = 'home'; render(); }"""
            )
            for name, js in SCREENS:
                await pg.evaluate(f'()=>{{ {js}; UI.sim = null; render(); window.scrollTo(0, 0); }}')
                await pg.wait_for_timeout(300)
                png = await pg.screenshot(full_page=True, animations='disabled')
                img = Image.open(BytesIO(png))
                ref = os.path.join(REF, f'{name}-{tag}.png')
                n += 1
                if UPDATE or not os.path.exists(ref):
                    img.save(ref, optimize=True)
                    continue
                r, d = diff(img, Image.open(ref))
                if r > TOL:
                    bad.append(f'{name} ({tag}) : {r * 100:.2f} % des pixels' + (' — taille différente' if d is None else ''))
                    (d or img).save(os.path.join(OUT, f'visual-diff-{name}-{tag}.png'))
            await pg.close()
        await b.close()
    print(f'{n} écrans ' + ('enregistrés comme références' if UPDATE else 'comparés à leur référence'))
    for x in bad:
        print('✖ écran changé : ' + x)
    print('ERREURS JS : ' + ('; '.join(errs[:3]) if errs else 'aucune'))
    if not bad and not errs and not UPDATE:
        print('✔ écrans identiques aux références')
    sys.exit(1 if bad or errs else 0)


asyncio.run(main())
