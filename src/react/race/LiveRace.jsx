// Écran de course en direct : retransmission, final, groupes, mes coureurs et actions, radio-course, commandes.
// Dans les 15 derniers km, l'écran bascule en mode « final » : le décompte, la carte des groupes jusqu'à la ligne
// et mes ordres passent en haut ; la retransmission complète, le détail des groupes et la radio sont repliés.
import { useEffect } from 'react';
import { Card, noLead } from '../ui.jsx';
import { RaceHeader, Clock, StageProfile, GapChart, VirtualLeader } from './Broadcast.jsx';
import { Finale, inFinale } from './Finale.jsx';
import { FinalActions } from './FinalActions.jsx';
import { Peloton } from './Peloton.jsx';
import { MyTeam, Nego } from './Team.jsx';
import { RadioFeed, Dock } from './Controls.jsx';
import { Situation, MomentPanel } from './Situation.jsx';
import { Sky } from './Sky.jsx';
import { RaceBar, RaceSteps } from './RaceBar.jsx';

function Fold({ title, children }) {
  return (
    <details className="rounded-lg bg-slate-900">
      <summary className="flex min-h-12 cursor-pointer items-center px-4 font-display text-base font-semibold text-slate-200">
        {noLead(title)}
      </summary>
      <div className="space-y-3 p-2 pt-0">{children}</div>
    </details>
  );
}
export function LiveRace() {
  // à l'entrée dans le final, l'écran change de disposition : on remonte en haut une seule fois
  const fin = UI.sim ? inFinale(UI.sim) : false;
  const photo = !!(UI.sim && UI.sim.photo);
  useEffect(() => {
    if (fin) window.scrollTo(0, 0);
  }, [fin, photo]);
  const sim = UI.sim;
  const rc = S.rc;
  const frac = UI.acc || 0;
  if (inFinale(sim))
    return (
      <div className="space-y-3 pb-36">
        <div className="flex items-baseline justify-between gap-2 px-1 text-sm text-slate-300">
          <b className="truncate text-slate-100">
            {rc.name} · {sim.spec.name}
          </b>
          <span className="shrink-0 tabular-nums">{fmtTime(Math.max(0, sim.t * 60 - 30 + frac * 30))}</span>
        </div>
        {/* sur grand écran : le final à gauche, le détail à droite */}
        <div className="space-y-3 xl:grid xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:items-start xl:gap-3 xl:space-y-0">
          <div className="space-y-3">
            <MomentPanel sim={sim} />
            {sim.photo ? null : <Sky sim={sim} compact />}
            <Finale sim={sim}>{sim.photo ? null : <FinalActions sim={sim} />}</Finale>
            {sim.photo ? null : (
              <div className="space-y-2 empty:hidden">
                <Nego sim={sim} />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <Fold title="📺 Retransmission complète (profil, écarts)">
              <Card>
                <RaceHeader sim={sim} rc={rc} />
                <Clock sim={sim} frac={frac} />
                <StageProfile spec={sim.spec} Pf={UI.Pf} sim={sim} frac={frac} />
                <GapChart sim={sim} />
                <VirtualLeader sim={sim} />
              </Card>
            </Fold>
            <Fold title="👥 Tous mes coureurs et ordres d'équipe">
              <MyTeam sim={sim} />
            </Fold>
            <Fold title="🚴 Détail des groupes">
              <Peloton sim={sim} />
            </Fold>
            <Fold title="📻 Radio-course">
              <RadioFeed sim={sim} />
            </Fold>
          </div>
        </div>
        <Dock sim={sim} />
      </div>
    );
  // téléphone et tablette : la retransmission reste en haut, le reste passe en onglets (un seul ouvert à la fois),
  // au lieu d'une colonne d'une dizaine de blocs à faire défiler
  if (typeof window !== 'undefined' && window.innerWidth < 1280) return <LiveMobile sim={sim} rc={rc} frac={frac} />;
  return (
    <div className="space-y-3 pb-36 xl:grid xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:items-start xl:gap-3 xl:space-y-0">
      {/* sur grand écran : la retransmission et les groupes à gauche, mes coureurs et la radio à droite */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h1 className="font-display text-2xl font-bold leading-tight text-slate-50">{rc.name}</h1>
          <span className="text-sm text-slate-400">{sim.spec.name}</span>
        </div>
        <RaceSteps step="live" />
        <RaceBar sim={sim} />
        <MomentPanel sim={sim} />
        <Sky sim={sim} />
        <Situation sim={sim} />
        <Peloton sim={sim} />
        <Card>
          <RaceHeader sim={sim} rc={rc} />
          <Clock sim={sim} frac={frac} />
          <StageProfile spec={sim.spec} Pf={UI.Pf} sim={sim} frac={frac} />
          <GapChart sim={sim} />
          <div className="min-h-5">
            <VirtualLeader sim={sim} />
          </div>
        </Card>
      </div>
      <div className="space-y-3">
        <MyTeam sim={sim} />
        <RadioFeed sim={sim} />
      </div>
      <Dock sim={sim} />
    </div>
  );
}
const LIVE_TABS = [
  ['course', 'Course'],
  ['equipe', 'Mon équipe'],
  ['groupes', 'Groupes'],
  ['radio', 'Radio'],
  ['ecarts', 'Écarts'],
];
// Disposition téléphone : bandeau, moment décisif et vue du ciel en haut ; onglets collés en haut pendant le
// défilement ; un seul panneau ouvert. Pastille : un de mes coureurs a faim ou une fringale, un message radio nouveau.
function LiveMobile({ sim, rc, frac }) {
  const tab = LIVE_TABS.some(t => t[0] === UI.liveTab) ? UI.liveTab : 'course';
  const alertTeam = sim.runners.some(x => x.player && !x.fin && !x.dnf && (x.hungry || x.bonk));
  const nLog = sim.log.length;
  if (tab === 'radio') UI.liveLogSeen = nLog;
  const newRadio = tab !== 'radio' && nLog > (UI.liveLogSeen || 0) && sim.log.slice(UI.liveLogSeen || 0).some(l => l.cls === 'me' || l.cls === 'bad');
  const go = k => ((UI.liveTab = k), renderLive());
  return (
    <div className="space-y-2 pb-36">
      <div className="flex items-baseline justify-between gap-x-3">
        <h1 className="truncate font-display text-xl font-bold leading-tight text-slate-50">{rc.name}</h1>
        <span className="shrink-0 text-xs text-slate-400">{sim.spec.name}</span>
      </div>
      <RaceBar sim={sim} flat />
      <MomentPanel sim={sim} />
      <Sky sim={sim} lite />
      <div className="sticky top-[57px] z-10 -mx-1 bg-slate-950/95 px-1 py-1 backdrop-blur md:top-0" role="tablist">
        <div className="grid grid-cols-5 gap-1">
          {LIVE_TABS.map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => go(k)}
              className={
                'relative min-h-10 rounded-md px-1 text-[12px] font-semibold leading-tight ' +
                (tab === k ? 'bg-slate-800 text-slate-50 shadow-[inset_0_-3px_0_#f2c94c]' : 'bg-slate-900 text-slate-400')
              }
            >
              {l}
              {(k === 'equipe' && alertTeam) || (k === 'radio' && newRadio) ? (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
              ) : null}
            </button>
          ))}
        </div>
      </div>
      {tab === 'course' ? <Situation sim={sim} /> : null}
      {tab === 'equipe' ? <MyTeam sim={sim} compact /> : null}
      {tab === 'groupes' ? <Peloton sim={sim} /> : null}
      {tab === 'radio' ? <RadioFeed sim={sim} /> : null}
      {tab === 'ecarts' ? (
        <Card>
          <RaceHeader sim={sim} rc={rc} />
          <Clock sim={sim} frac={frac} />
          <StageProfile spec={sim.spec} Pf={UI.Pf} sim={sim} frac={frac} />
          <GapChart sim={sim} />
          <div className="min-h-5">
            <VirtualLeader sim={sim} />
          </div>
        </Card>
      ) : null}
      <Dock sim={sim} />
    </div>
  );
}
