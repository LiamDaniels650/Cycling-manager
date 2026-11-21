// Application : en-tête, navigation (barre du bas sur téléphone, onglets sur grand écran), écran courant,
// fenêtres. Les écrans pas encore convertis en composants React sont affichés par l'ancienne interface
// (mêmes fonctions, mêmes boutons) : rien n'est perdu pendant la conversion.
import { useEffect, useState } from 'react';
import { setBump, beginRender, endRender, takeFlash, refresh } from './bridge.js';
import { Icon } from './icons.jsx';
import { LiveRace } from './race/LiveRace.jsx';
import { RadioPanel } from './race/Controls.jsx';
import { Home } from './screens/Home.jsx';
import { Team } from './screens/Team.jsx';
import { RiderSheet } from './screens/RiderSheet.jsx';
import { Calendar } from './screens/Calendar.jsx';
import { Prep } from './screens/Prep.jsx';
import { Briefing } from './screens/Briefing.jsx';
import { StageResult } from './screens/StageResult.jsx';
import { Market } from './screens/Market.jsx';
import { Academy } from './screens/Academy.jsx';
import { Office } from './screens/Office.jsx';
import { Inbox } from './screens/Inbox.jsx';
import { Stats } from './screens/Stats.jsx';
import { Press } from './screens/Press.jsx';
import { Options, Start, TipCard } from './screens/Options.jsx';
import { TeamCard } from './screens/Bits.jsx';
import { Names } from './screens/Names.jsx';
import { Stories } from './screens/Stories.jsx';
import { CarCreate, CarHeader, CarBottomNav, CarNav, CarRiderSheet, CareerApp } from './career/Career.jsx';

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
};
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

const NAV_ICON = { home: 'home', team: 'users', cal: 'calendar', race: 'flag', market: 'cart' };
function Count({ n }) {
  if (!n) return null;
  return (
    <i className="absolute -right-2 -top-1.5 rounded-full bg-rose-500 px-1.5 text-xs font-bold not-italic leading-4 text-white">
      {n > 9 ? '9+' : n}
    </i>
  );
}
function Header() {
  const T = P();
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => openNav()}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-100 md:hidden"
            title="Menu"
          >
            <Icon name="menu" />
          </button>
          <i className="h-3 w-3 shrink-0 rounded-sm" style={{ background: T.color }} />
          <b className="truncate text-slate-50">{T.name}</b>
        </div>
        <div className="shrink-0 text-xs text-slate-300">
          {S.season} · sem. {S.week} ·{' '}
          <b className={S.budget < 0 ? 'text-rose-400' : 'text-slate-50'}>{fmtMoney(S.budget)}</b>
        </div>
      </div>
      <nav className="mx-auto hidden max-w-3xl flex-wrap gap-1.5 px-3 pb-2 md:flex">
        {navItems().map(([k, ic, l, n]) => (
          <button
            key={k}
            type="button"
            onClick={() => go(k)}
            className={
              'relative min-h-10 rounded-xl px-3 text-sm ' +
              (UI.view === k ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-100')
            }
          >
            {ic} {l}
            <Count n={k === 'home' ? 0 : n} />
          </button>
        ))}
      </nav>
    </header>
  );
}
function BottomNav() {
  const it = navItems();
  const inRace = it.some(x => x[0] === 'race');
  const main = ['home', 'team', 'cal', inRace ? 'race' : 'market'];
  const more = it.filter(x => !main.includes(x[0]));
  const moreN = more.reduce((a, x) => a + (x[0] === 'home' ? 0 : x[3]), 0);
  const btn = (k, icon, label, n, on, onClick) => (
    <button
      key={k}
      type="button"
      onClick={onClick}
      className={
        'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs ' +
        (on ? 'text-sky-300' : 'text-slate-400')
      }
    >
      <span className="relative">
        <Icon name={icon} size={22} />
        <Count n={n} />
      </span>
      {label}
    </button>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-3xl">
        {main.map(k => {
          const x = it.find(y => y[0] === k);
          return btn(k, NAV_ICON[k], x[2], k === 'home' ? 0 : x[3], UI.view === k, () => go(k));
        })}
        {btn(
          'more',
          'menu',
          'Plus',
          moreN,
          more.some(x => x[0] === UI.view),
          () => openNav()
        )}
      </div>
    </nav>
  );
}
function NavSheet() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {navItems().map(([k, ic, l, n]) => (
        <button
          key={k}
          type="button"
          onClick={() => {
            closeModal();
            go(k);
          }}
          className={
            'relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-sm ' +
            (UI.view === k ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-100')
          }
        >
          <span className="relative text-xl">
            {ic}
            <Count n={k === 'home' ? 0 : n} />
          </span>
          {l}
        </button>
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
  return (
    <div
      className={'fixed inset-0 z-40 flex bg-black/60 ' + (sheet ? 'items-end' : 'items-center justify-center p-3')}
      onClick={() => closeModal()}
    >
      <div
        className={
          'max-h-[88vh] w-full overflow-y-auto border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-2xl ' +
          (sheet ? 'rounded-t-3xl pb-[max(env(safe-area-inset-bottom),16px)]' : 'max-w-xl rounded-2xl')
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
          {live ? null : <CarHeader />}
          <main id="main" className={'mx-auto max-w-3xl px-3 pt-3 ' + (live ? 'xl:max-w-6xl' : 'pb-24')}>
            {flash ? (
              <div
                className="mb-3 rounded-xl bg-sky-500/15 px-3 py-2 text-sm text-sky-100 ring-1 ring-sky-400/40"
                dangerouslySetInnerHTML={{ __html: flash }}
              />
            ) : null}
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
    if (live) content = <LiveRace />;
    else {
      const tipKey = UI.view === 'race' ? (UI.lastStage ? null : 'race') : UI.view;
      const Native = NATIVE[UI.view] || Home;
      content = (
        <>
          {tipKey ? <TipCard view={tipKey} /> : null}
          <Native />
        </>
      );
    }
    return (
      <>
        <Header />
        <main id="main" className={'mx-auto max-w-3xl px-3 pt-3 ' + (live ? 'xl:max-w-6xl' : 'pb-24 md:pb-6')}>
          {flash ? (
            <div
              className="mb-3 rounded-xl bg-sky-500/15 px-3 py-2 text-sm text-sky-100 ring-1 ring-sky-400/40"
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
