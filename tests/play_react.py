"""Partie jouée « comme un joueur » dans l'interface React, uniquement par de vrais clics sur les boutons visibles :
mode directeur (2 saisons) puis mode carrière (3 saisons). Les courses importantes sont courues en direct (moments
clés, une action dans le final, puis arrivée) ; les autres sont confiées à l'adjoint ou simulées, comme le ferait
un joueur pressé. À chaque écran : recherche de textes cassés (undefined, NaN, [object…), boutons sans effet,
écrans sans issue. Captures dans tests/out/play_*.png.
Usage : python3 tests/play_react.py [directeur|carriere|tout] [saisons]"""
import asyncio, os, re, sys, time, json
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
URL = 'file://' + os.path.join(HERE, '..', 'dist', 'react.html')
MODE = sys.argv[1] if len(sys.argv) > 1 else 'tout'
NS = int(sys.argv[2]) if len(sys.argv) > 2 else 0
BAD = re.compile(r'\bundefined\b|\bNaN\b|\[object |\bnull\b(?! ?%)|Infinity')
PRIMARY = 'button.bg-sky-500.text-slate-950.min-h-11:not([disabled])'


class Bot:
    def __init__(self, pg, tag):
        self.pg, self.tag = pg, tag
        self.clicks = 0
        self.notes = []  # (gravité, texte)
        self.seen = set()
        self.stuck = 0
        self.shots = 0

    def note(self, g, t):
        if (g, t) not in self.seen:
            self.seen.add((g, t))
            self.notes.append((g, t))

    async def state(self):
        return await self.pg.evaluate(
            "()=>({view:UI.view||'home', season:S.season, week:S.week, sim:!!(UI.sim&&!UI.sim.done), rc:!!S.rc, car:!!S.car, final:!!(UI.sim&&!UI.sim.done&&(UI.sim.photo||(()=>{const A=UI.sim.groups.find(G=>G.riders.some(x=>!x.fin));return !!A&&UI.sim.dist-A.pos<=15})()))})"
        )

    async def scan(self, where):
        txt = await self.pg.evaluate('()=>document.body.innerText')
        for m in BAD.finditer(txt):
            a = max(0, m.start() - 50)
            self.note('bug', f'texte cassé sur {where} : « …{txt[a:m.end() + 30].strip()}… »'.replace('\n', ' '))
        w = await self.pg.evaluate('()=>document.documentElement.scrollWidth')
        if w > 400:
            self.note('ui', f'débordement horizontal sur {where} ({w}px)')

    async def click(self, loc, what):
        try:
            await loc.scroll_into_view_if_needed(timeout=3000)
            await loc.click(timeout=4000)
        except Exception:
            self.note('ui', f'clic impossible sur « {what} » (quelque chose le recouvre ?)')
            await self.modal()
            return
        self.clicks += 1
        await self.pg.wait_for_timeout(60)

    async def shot(self, name):
        self.shots += 1
        await self.pg.screenshot(path=os.path.join(HERE, 'out', f'play_{self.tag}_{name}.png'))

    async def by_title(self, t):
        loc = self.pg.locator(f'button[title^="{t}"]')
        return loc.first if await loc.count() else None

    async def text_btn(self, rx):
        loc = self.pg.get_by_role('button', name=re.compile(rx))
        n = await loc.count()
        for i in range(n):
            b = loc.nth(i)
            if await b.is_visible() and await b.is_enabled():
                return b
        return None

    # Fenêtre par-dessus l'écran (alerte, fiche, choix) : on la lit, on note, on la ferme comme un joueur.
    async def modal(self):
        m = self.pg.locator('div.fixed.inset-0.z-50, div.fixed.inset-0.z-40')
        if not await m.count():
            return False
        try:
            txt = (await m.first.inner_text(timeout=1500)).strip().replace('\n', ' ')
        except Exception:
            return False
        if 'adjoint dirige' in txt:
            # l'adjoint court à notre place : un joueur attend, il n'interrompt pas
            await self.pg.wait_for_timeout(400)
            return True
        self.modals = getattr(self, 'modals', 0) + 1
        self.note('info', f'fenêtre : « {txt[:90]} »')
        bs = m.first.locator('button:not([disabled])')
        n = await bs.count()
        pick = None
        for i in range(n):
            c = await bs.nth(i).get_attribute('class') or ''
            if 'bg-sky-500' in c and 'text-slate-950' in c:
                pick = bs.nth(i)
                break
        if pick is None and n:
            pick = bs.nth(n - 1)
        try:
            if pick is None:
                await self.pg.keyboard.press('Escape')
            else:
                await pick.click(timeout=3000)
                self.clicks += 1
        except Exception:
            return False
        await self.pg.wait_for_timeout(80)
        return True

    async def primary(self):
        loc = self.pg.locator(PRIMARY)
        n = await loc.count()
        for i in range(n):
            b = loc.nth(i)
            if await b.is_visible():
                return b
        return None

    # Une étape en direct : moments clés jusqu'au final, une action de final, puis l'arrivée.
    async def live_stage(self, play):
        t0 = time.time()
        if play:
            k = await self.by_title('Moments clés')
            if k:
                await self.click(k, 'moments clés')
            for i in range(600):
                st = await self.state()
                if st['final'] or not st['sim']:
                    break
                # une décision ou un événement a arrêté l'avance rapide : on répond, puis on relance
                if await self.modal():
                    continue
                b = await self.primary()
                if b:
                    await self.click(b, 'décision en course')
                    self.note('info', 'décision demandée pendant la course')
                if not await self.pg.evaluate('()=>!!UI.keyMode') or not await self.pg.evaluate('()=>UI.speed>0'):
                    k = await self.by_title('Moments clés')
                    if k:
                        await self.click(k, 'moments clés')
                        self.relaunch = getattr(self, 'relaunch', 0) + 1
                await self.pg.wait_for_timeout(150)
            st = await self.state()
            if st['final'] and st['sim']:
                await self.scan('final')
                if self.shots < 40:
                    await self.shot(f'final_{st["season"]}_{st["week"]}')
                b = await self.pg.evaluate(
                    "()=>{const bs=[...document.querySelectorAll('button')].filter(b=>b.offsetParent&&b.classList.contains('min-h-14')&&!b.disabled&&!/Tous les ordres/.test(b.innerText));return bs.length}"
                )
                if b:
                    await self.pg.evaluate(
                        "()=>{const bs=[...document.querySelectorAll('button')].filter(b=>b.offsetParent&&b.classList.contains('min-h-14')&&!b.disabled&&!/Tous les ordres/.test(b.innerText));bs[0].click()}"
                    )
                    self.clicks += 1
                else:
                    self.note('ui', 'final en direct sans bouton d’action visible')
        e = await self.by_title("Aller à l'arrivée")
        if e:
            await self.click(e, 'arrivée')
        for _ in range(100):
            if not (await self.state())['sim']:
                break
            await self.pg.wait_for_timeout(100)
        return time.time() - t0


async def director(pg, seasons):
    bot = Bot(pg, 'dir')
    await pg.click('text=Nouvelle partie')
    await pg.evaluate('()=>{S.tipsOff=true;save();}')
    s0 = await pg.evaluate('()=>S.season')
    t0 = time.time()
    live = deleg = 0
    for step in range(6000):
        st = await bot.state()
        if step % 5 == 0:
            print('   ', await pg.evaluate("()=>S.rc?S.rc.name+' étape '+(S.rc.si+1)+'/'+S.rc.specs.length+(UI.sim?' km '+Math.round(UI.sim.groups[0]?UI.sim.groups[0].pos:0)+'/'+UI.sim.dist:''):'-'"), round(time.time()-t0), flush=True)
        if step % 40 == 0:
            print(f'  dir étape {step} saison {st["season"]} sem {st["week"]} vue {st["view"]} clics {bot.clicks} {round(time.time()-t0)}s', flush=True)
        if st['season'] >= s0 + seasons:
            break
        await bot.scan(st['view'])
        if await bot.modal():
            continue
        if st['sim']:
            # un joueur pressé ne regarde que les étapes qui comptent : course d'un jour importante, arrivée en
            # montagne, dernière étape ; le reste file jusqu'à l'arrivée
            imp = await pg.evaluate(
                "()=>{const rc=S.rc; if(!rc||rc.cat>1) return false; const sp=rc.specs[rc.si]; return rc.specs.length===1||sp.type==='sommet'||rc.si===rc.specs.length-1}"
            )
            dt = await bot.live_stage(imp)
            if imp:
                print(f'    étape en direct : {round(dt)} s', flush=True)
            live += 1
            continue
        # course ordinaire : la confier à l'adjoint quand le bouton existe
        d = await bot.text_btn(r"Confier (à l'adjoint )?jusqu")
        if d and st['view'] == 'home':
            await bot.click(d, 'déléguer')
            deleg += 1
            continue
        b = await bot.primary()
        if b:
            lbl = (await b.inner_text()).strip()[:40]
            v0 = json.dumps(st)
            await bot.click(b, lbl)
            await pg.wait_for_timeout(40)
            if json.dumps(await bot.state()) == v0 and not await bot.primary() is None:
                bot.stuck += 1
                if bot.stuck > 4:
                    bot.note('bug', f'bouton « {lbl} » sans effet visible ({st["view"]})')
                    await bot.shot(f'stuck_{step}')
                    await pg.evaluate("()=>go('home')")
                    bot.stuck = 0
            else:
                bot.stuck = 0
            continue
        # sélection incomplète, écran sans bouton principal : on cherche l'aide de l'adjoint, sinon retour accueil
        a = await bot.text_btn(r'🧑‍💼|Auto|auto')
        if a and st['view'] in ('prep', 'race'):
            await bot.click(a, 'auto')
            continue
        bot.note('ui', f'écran sans action principale : {st["view"]}')
        await pg.evaluate("()=>go('home')")
    dt = time.time() - t0
    await bot.shot('fin')
    return bot, dict(minutes=round(dt / 60, 1), clics=bot.clicks, etapes_directes=live, delegations=deleg, relances_avance=getattr(bot, 'relaunch', 0), fenetres=getattr(bot, 'modals', 0))


async def career(pg, seasons):
    bot = Bot(pg, 'car')
    await pg.evaluate("()=>switchSlot('car')")
    await pg.wait_for_timeout(500)
    await pg.get_by_placeholder(re.compile('Prénom')).fill('Lucas')
    await pg.get_by_placeholder(re.compile('Nom')).fill('Martin')
    await bot.click(pg.get_by_role('button', name='Doué'), 'talent')
    await bot.shot('creation')
    await bot.click(pg.get_by_role('button', name=re.compile('Commencer ma carrière')), 'go')
    await pg.wait_for_timeout(400)
    s0 = await pg.evaluate('()=>S.season')
    t0 = time.time()
    live = sim = asks = 0
    choice = 0
    for step in range(9000):
        st = await bot.state()
        if step % 40 == 0:
            print(f'  car étape {step} saison {st["season"]} sem {st["week"]} vue {st["view"]} clics {bot.clicks} {round(time.time()-t0)}s', flush=True)
        if st['season'] >= s0 + seasons or await pg.evaluate('()=>!!(S.car&&S.car.end)'):
            break
        await bot.scan('carrière/' + st['view'])
        if await bot.modal():
            continue
        if st['sim']:
            await bot.live_stage(True)
            live += 1
            continue
        if step % 150 == 0:
            for v in ['train', 'races', 'team', 'profile', 'image', 'life', 'opt']:
                await pg.evaluate(f"()=>go('{v}')")
                await bot.scan('carrière/' + v)
                if step == 0 or step % 900 == 0:
                    await bot.shot(f'{v}_{st["season"]}')
            await pg.evaluate("()=>go('home')")
        # décisions : on varie les réponses (un vrai joueur ne prend pas toujours la première)
        q = pg.locator('button.justify-start.text-left')
        if st['view'] in ('home', None) and await q.count():
            n = await q.count()
            choice += 1
            await bot.click(q.nth(choice % n), 'décision')
            asks += 1
            continue
        c = await bot.text_btn(r'Courir en direct')
        if c:
            imp = await pg.evaluate("()=>{const i=carProThisWeek(); if(i>=0) return S.cal[i].cat<=1; const d=carRaceThisWeek(); return !!d&&['nat','intl','monde','avenir'].includes(d.tier)}")
            if imp:
                await bot.click(c, 'direct')
            else:
                await bot.click(await bot.text_btn(r'Simuler la course'), 'simuler')
                sim += 1
            continue
        if await bot.text_btn(r'Demander ma chance') and choice % 3 == 0:
            await bot.click(await bot.text_btn(r'Demander ma chance'), 'chance')
        b = await bot.primary()
        if b:
            lbl = (await b.inner_text()).strip()[:40]
            await bot.click(b, lbl)
            for _ in range(200):
                if not await pg.evaluate('()=>!!UI.carBusy'):
                    break
                await pg.wait_for_timeout(100)
            continue
        bot.note('ui', f'écran sans action principale : carrière/{st["view"]}')
        await pg.evaluate("()=>go('home')")
    dt = time.time() - t0
    await bot.shot('fin')
    info = await pg.evaluate(
        "()=>({age:carMe().age, niveau:overall(carMe().s), equipe:S.car.club, statut:carStatusLbl(), argent:Math.round(S.car.money), courses:S.car.res.length, victoires:S.car.res.filter(x=>x.rank===1).length})"
    )
    return bot, dict(minutes=round(dt / 60, 1), clics=bot.clicks, courses_direct=live, simulees=sim, decisions=asks, **info)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 390, 'height': 844})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.on('crash', lambda *a: print('!!! PAGE CRASH', flush=True))
        pg.on('console', lambda m: m.type == 'error' and print('console:', m.text[:200], flush=True))
        await pg.goto(URL)
        await pg.evaluate(
            "()=>new Promise(r=>{try{localStorage.clear()}catch(e){}; const q=indexedDB.deleteDatabase('dsc_save'); q.onsuccess=q.onerror=q.onblocked=()=>r(1);})"
        )
        await pg.reload()
        out = {}
        if MODE in ('directeur', 'tout'):
            bot, r = await director(pg, NS or 2)
            out['directeur'] = (r, bot.notes)
        if MODE in ('carriere', 'tout'):
            bot, r = await career(pg, NS or 3)
            out['carriere'] = (r, bot.notes)
        for k, (r, notes) in out.items():
            print('==', k, json.dumps(r, ensure_ascii=False))
            for g, t in notes:
                print(f'  [{g}] {t}')
        print('erreurs JS :', errs[:5] or 'aucune')
        await b.close()


asyncio.run(main())
