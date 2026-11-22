// Application : en-tête, navigation (barre du bas sur téléphone, onglets sur grand écran), écran courant,
// fenêtres. Les écrans pas encore convertis en composants React sont affichés par l'ancienne interface
// (mêmes fonctions, mêmes boutons) : rien n'est perdu pendant la conversion.
import { useEffect, useState } from 'react';
import { Compare } from './screens/Compare.jsx';
import { setBump, beginRender, endRender, takeFlash, refresh } from './bridge.js';
import { Icon } from './icons.jsx';
import { LiveRace } from './race/LiveRace.jsx';
import { RadioPanel } from './race/Controls.jsx';
import { Home } from './screens/Home.jsx';
import { Team, PrepCard, Locker, DopeCard } from './screens/Team.jsx';
import { RiderSheet } from './screens/RiderSheet.jsx';
import { Calendar } from './screens/Calendar.jsx';
import { Prep } from './screens/Prep.jsx';
import { Briefing } from './screens/Briefing.jsx';
import { StageResult } from './screens/StageResult.jsx';
import { Market } from './screens/Market.jsx';
import { Academy } from './screens/Academy.jsx';
import { Office, ClubFinances, ClubStaff, ClubEquip, ClubCareer, Prep as CampsCoach } from './screens/Office.jsx';
import { Inbox } from './screens/Inbox.jsx';
import { Stats } from './screens/Stats.jsx';
import { Press } from './screens/Press.jsx';
import { Options, Start, TipCard } from './screens/Options.jsx';
import { TeamCard } from './screens/Bits.jsx';
import { Names } from './screens/Names.jsx';
import { Stories } from './screens/Stories.jsx';
import { CarCreate, CarHeader, CarBottomNav, CarNav, CarRiderSheet, CareerApp, CarRail, carTitle } from './career/Career.jsx';

// écran de course hors direct : briefing avant l'étape ou résultats après (portage de viewRace)
function RaceOff() {
  if (!S.rc) return <div className="rounded-2xl bg-slate-900 p-4 text-slate-300">Aucune course en cours.</div>;
  return UI.lastStage ? <StageResult /> : <Briefing />;
}
// écrans déjà convertis en composants React
const NATIVE = {
  home: Home,
  team: Team,
  cal: Calendar,
  prep: Prep,
  race: RaceOff,
  market: Market,
  aca: Academy,
  mgmt: Office,
  inbox: Inbox,
  stats: Stats,
  press: Press,
  opt: Options,
  names: Names,
  stories: Stories,
  prepa: () => (
    <div className="space-y-3">
      <PrepCard />
      <DopeCard />
      <CampsCoach />
    </div>
  ),
  locker: Locker,
  fin: ClubFinances,
  staff: ClubStaff,
  equip: ClubEquip,
  career: ClubCareer,
};
// Les cinq espaces du jeu (et le menu secondaire) : chacun regroupe des écrans, présentés en sous-onglets.
const SPACES = [
  {
    k: 'today',
    lbl: 'Aujourd’hui',
    icon: 'home',
    tabs: () => [
      ['home', 'À faire'],
      ['inbox', 'Messages'],
      discoOpen('press') && ['press', 'Presse'],
      discoOpen('stories') && ['stories', 'Histoires'],
    ],
  },
  {
    k: 'races',
    lbl: 'Courses',
    icon: 'route',
    tabs: () => [['cal', 'Calendrier'], S.rc && !S.rc.done && ['race', 'Course en cours']],
  },
  {
    k: 'squad',
    lbl: 'Effectif',
    icon: 'users',
    tabs: () => [
      ['team', 'Coureurs'],
      ['prepa', 'Préparation'],
      ['locker', 'Vestiaire'],
      discoOpen('aca') && ['aca', 'Académie'],
    ],
  },
  { k: 'market', lbl: 'Marché', icon: 'cart', tabs: () => [['market', 'Marché']] },
  {
    k: 'club',
    lbl: 'Club',
    icon: 'briefcase',
    tabs: () => [
      ['mgmt', 'Sponsor'],
      ['fin', 'Finances'],
      ['staff', 'Staff'],
      discoOpen('equip') && ['equip', 'Matériel'],
      ['career', 'Carrière'],
    ],
  },
];
const EXTRA = [
  { k: 'archives', lbl: 'Archives', icon: 'book', tabs: () => [['stats', 'Archives']] },
  {
    k: 'options',
    lbl: 'Options',
    icon: 'sliders',
    tabs: () => [
      ['opt', 'Options'],
      ['names', 'Noms'],
    ],
  },
];
const tabsOf = sp => sp.tabs().filter(Boolean);
function spaceOf(view) {
  if (view === 'prep') return SPACES[1];
  return [...SPACES, ...EXTRA].find(sp => tabsOf(sp).some(t => t[0] === view)) || SPACES[0];
}
// Décisions et nouvelles en attente par écran (compteurs de l'ancienne navigation), cumulées par espace.
function counts() {
  const m = {};
  for (const [k, , , n] of navItems()) m[k] = n;
  m.home = 0;
  return m;
}
function spaceCount(sp, m) {
  return tabsOf(sp).reduce((a, [k]) => a + (m[k] || 0), 0);
}
// Voile de progression pendant une simulation (portage de renderBusy).
function Busy() {
  const B = UI.busy;
  if (!B) return null;
  const p = Math.max(0, Math.min(100, (B.k / B.n) * 100));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-4 text-slate-100">
        <b>⏳ {B.txt}</b>
        <div className="text-xs text-slate-400">
          Étape {Math.min(B.k + 1, B.n)} / {B.n}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-sky-400" style={{ width: p + '%' }} />
        </div>
        {B.stop ? (
          <button
            type="button"
            disabled={!UI.chain}
            className="mt-3 min-h-11 w-full rounded-xl bg-slate-800 px-3 text-sm disabled:opacity-60"
            onClick={() => ((UI.chain = null), refresh())}
          >
            {UI.chain ? 'Reprendre la main après cette course' : 'Arrêt après cette course…'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Count({ n }) {
  if (!n) return null;
  return (
    <i className="ml-auto rounded-full bg-rose-500 px-1.5 font-display text-xs font-semibold not-italic leading-[18px] text-white">
      {n > 9 ? '9+' : n}
    </i>
  );
}
// Rail de navigation (grand écran) : l'équipe, les cinq espaces, le menu secondaire, la saison et le budget.
function Rail() {
  const T = P();
  const m = counts();
  const cur = spaceOf(UI.view);
  const item = sp => {
    const on = cur === sp;
    return (
      <button
        key={sp.k}
        type="button"
        onClick={() => go(tabsOf(sp)[0][0])}
        className={
          'flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-[15px] font-medium ' +
          (on ? 'bg-slate-800 text-slate-50 shadow-[inset_3px_0_0_#f2c94c]' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100')
        }
      >
        <Icon name={sp.icon} size={19} />
        {sp.lbl}
        <Count n={spaceCount(sp, m)} />
      </button>
    );
  };
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col gap-1 border-r border-slate-800 bg-slate-950 px-2.5 py-4 md:flex">
      <div className="mb-3 flex items-center gap-2 px-3">
        <i className="h-3 w-3 shrink-0" style={{ background: T.color }} />
        <b className="truncate font-display text-lg leading-tight text-slate-50">{T.name}</b>
      </div>
      {SPACES.map(item)}
      <div className="mx-3 my-2 h-px bg-slate-800" />
      {EXTRA.map(item)}
      <div className="mt-auto px-3 text-xs text-slate-400">
        Saison {S.season}
        <b className="block font-display text-lg text-slate-50">Semaine {S.week}</b>
        <span className={'font-display text-base ' + (S.budget < 0 ? 'text-rose-400' : 'text-slate-200')}>
          {fmtMoney(S.budget)}
        </span>
      </div>
    </aside>
  );
}
// Bandeau de contexte (téléphone) : équipe, saison, budget, menu secondaire.
function Header() {
  const T = P();
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <i className="h-3 w-3 shrink-0" style={{ background: T.color }} />
          <b className="truncate font-display text-base text-slate-50">{T.name}</b>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-display text-sm text-slate-300">
          <span>
            {S.season} · s{S.week}
          </span>
          <b className={S.budget < 0 ? 'text-rose-400' : 'text-slate-50'}>{fmtMoney(S.budget)}</b>
          <button
            type="button"
            onClick={() => openNav()}
            className="ml-1 flex h-10 w-10 items-center justify-center rounded-md bg-slate-800 text-slate-100"
            title="Menu"
          >
            <Icon name="menu" />
          </button>
        </div>
      </div>
    </header>
  );
}
// Barre du bas (téléphone) : les cinq espaces.
function BottomNav() {
  const m = counts();
  const cur = spaceOf(UI.view);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-3xl grid-cols-5">
        {SPACES.map(sp => {
          const n = spaceCount(sp, m);
          return (
            <button
              key={sp.k}
              type="button"
              onClick={() => go(tabsOf(sp)[0][0])}
              className={
                'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ' +
                (cur === sp ? 'text-sky-400' : 'text-slate-400')
              }
            >
              <span className="relative">
                <Icon name={sp.icon} size={22} />
                {n ? (
                  <i className="absolute -right-2.5 -top-1.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold not-italic leading-4 text-white">
                    {n > 9 ? '9+' : n}
                  </i>
                ) : null}
              </span>
              {sp.lbl}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
// En-tête d'espace : son nom et ses sous-onglets.
function SpaceHead({ tip }) {
  const sp = spaceOf(UI.view);
  const tabs = tabsOf(sp);
  const m = counts();
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-3xl font-bold leading-none text-slate-50">{sp.lbl}</h1>
        {tip ? <TipCard view={tip} /> : null}
      </div>
      {tabs.length > 1 ? (
        <div className="mt-3 flex gap-5 overflow-x-auto border-b border-slate-800">
          {tabs.map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => go(k)}
              className={
                'relative flex min-h-10 shrink-0 items-center gap-1.5 text-sm font-medium ' +
                (UI.view === k ? 'text-slate-50 shadow-[inset_0_-3px_0_#f2c94c]' : 'text-slate-400 hover:text-slate-100')
              }
            >
              {l}
              {m[k] ? (
                <i className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold not-italic leading-4 text-white">
                  {m[k]}
                </i>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
// Menu (téléphone) : tous les espaces et leurs écrans, puis les archives et les options.
function NavSheet() {
  const m = counts();
  return (
    <div className="space-y-4">
      {[...SPACES, ...EXTRA].map(sp => (
        <div key={sp.k}>
          <div className="mb-1 flex items-center gap-2 font-display text-base font-semibold text-slate-100">
            <Icon name={sp.icon} size={18} className="text-slate-400" />
            {sp.lbl}
          </div>
          <div className="flex flex-wrap gap-2">
            {tabsOf(sp).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  closeModal();
                  go(k);
                }}
                className={
                  'flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm ' +
                  (UI.view === k ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-800 text-slate-100')
                }
              >
                {l}
                {m[k] ? (
                  <i className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold not-italic leading-4 text-white">
                    {m[k]}
                  </i>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
// Fenêtres : fiche coureur ou équipe (ancienne interface), menu, radio, message, confirmation.
function Modal() {
  const m = UI.modal;
  if (!m) return null;
  let body;
  if (m.type === 'rider') body = S && S.car ? <CarRiderSheet r={S.riders[m.id]} /> : <RiderSheet r={S.riders[m.id]} />;
  else if (m.type === 'team') body = <TeamCard T={teamById(m.id)} />;
  else if (m.type === 'cmp') body = <Compare a={m.a} b={m.b} />;
  else if (m.type === 'nav') body = S && S.car ? <CarNav /> : <NavSheet />;
  else if (m.type === 'radio') body = <RadioPanel id={m.id} />;
  else if (m.type === 'msg')
    body = (
      <>
        <p className="text-slate-100" dangerouslySetInnerHTML={{ __html: m.text }} />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="min-h-11 rounded-xl bg-sky-500 px-4 font-semibold text-slate-950"
            onClick={() => closeModal()}
          >
            OK
          </button>
        </div>
      </>
    );
  else if (m.type === 'confirm')
    body = (
      <>
        <p className="text-slate-100" dangerouslySetInnerHTML={{ __html: m.text }} />
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            className="min-h-11 rounded-xl bg-slate-800 px-4 text-slate-100"
            onClick={() => closeModal()}
          >
            Annuler
          </button>
          <button
            type="button"
            className="min-h-11 rounded-xl bg-sky-500 px-4 font-semibold text-slate-950"
            onClick={() => UI._cb && UI._cb()}
          >
            Confirmer
          </button>
        </div>
      </>
    );
  const sheet = m.type === 'radio' || m.type === 'nav';
  // fiche d'un coureur ou d'une équipe : panneau latéral sur grand écran (la liste reste visible à gauche)
  const side = m.type === 'rider' || m.type === 'team';
  return (
    <div
      className={
        'fixed inset-0 z-40 flex bg-black/60 ' +
        (sheet ? 'items-end' : side ? 'items-center justify-center p-3 md:items-stretch md:justify-end md:bg-black/40 md:p-0' : 'items-center justify-center p-3')
      }
      onClick={() => closeModal()}
    >
      <div
        className={
          'max-h-[88vh] w-full overflow-y-auto border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-2xl ' +
          (sheet
            ? 'rounded-t-3xl pb-[max(env(safe-area-inset-bottom),16px)]'
            : side
              ? 'max-w-xl rounded-2xl md:h-full md:max-h-none md:w-[600px] md:max-w-none md:rounded-none md:border-y-0 md:border-r-0 md:p-6'
              : 'max-w-xl rounded-lg')
        }
        onClick={e => e.stopPropagation()}
      >
        {body}
      </div>
    </div>
  );
}
export function App() {
  const [, setV] = useState(0);
  useEffect(() => {
    setBump(() => setV(v => v + 1));
    return () => {
      setBump(() => {});
      stopTimer(); // pas de boucle de course orpheline si l'application est démontée
    };
  }, []);
  beginRender();
  try {
    if (!S)
      return (
        <main id="main" className="mx-auto max-w-3xl px-3 py-4">
          {slotOf() === 'car' ? <CarCreate /> : <Start />}
          <Modal />
        </main>
      );
    if (S.car) {
      // mode carrière : sa propre navigation, mêmes fenêtres et même écran de course
      const { live, inRace, V } = CareerApp();
      const flash = takeFlash();
      return (
        <>
          {live ? null : <CarRail />}
          {live ? null : <CarHeader />}
          <main
            id="main"
            className={'px-3 pt-4 md:px-6 ' + (live ? 'mx-auto xl:max-w-[1500px]' : 'pb-24 md:ml-56 md:pb-8 lg:max-w-[1180px]')}
          >
            {flash ? (
              <div
                className="mb-3 rounded-xl bg-slate-800/70 px-3 py-2 text-sm text-slate-100 ring-1 ring-slate-700"
                dangerouslySetInnerHTML={{ __html: flash }}
              />
            ) : null}
            {live || !carTitle() ? null : (
              <h1 className="mb-4 font-display text-3xl font-bold leading-none text-slate-50">{carTitle()}</h1>
            )}
            <V />
          </main>
          {inRace ? null : <CarBottomNav />}
          <Modal />
          <Busy />
        </>
      );
    }
    const live = UI.view === 'race' && !!UI.sim;
    const flash = takeFlash();
    let content;
    const tipKey = live ? null : UI.view === 'race' ? (UI.lastStage ? null : 'race') : UI.view;
    if (live) content = <LiveRace />;
    else {
      const Native = NATIVE[UI.view] || Home;
      content = <Native />;
    }
    const bare = live || UI.view === 'prep';
    return (
      <>
        <Rail />
        <Header />
        <main
          id="main"
          className={
            'px-3 pt-4 md:ml-56 md:px-6 md:pt-6 ' + (live ? 'mx-auto xl:max-w-[1500px]' : 'pb-24 md:pb-8 lg:max-w-[1180px]')
          }
        >
          {bare ? null : <SpaceHead tip={tipKey} />}
          {flash ? (
            <div
              className="mb-3 rounded-md bg-slate-900 px-3 py-2.5 text-sm text-slate-100 shadow-[inset_3px_0_0_#f2c94c]"
              dangerouslySetInnerHTML={{ __html: flash }}
            />
          ) : null}
          {content}
        </main>
        {live || UI.view === 'prep' ? null : <BottomNav />}
        <Modal />
        <Busy />
      </>
    );
  } finally {
    endRender();
  }
}
