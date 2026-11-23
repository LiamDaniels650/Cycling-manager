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
        {/* téléphone : la radio repliée, son dernier message en titre ; grand écran : ouverte */}
        {typeof window !== 'undefined' && window.innerWidth < 1280 ? (
          <details className="rounded-lg bg-slate-900">
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 text-sm text-slate-200">
              <b className="shrink-0 font-display text-base">Radio</b>
              <span
                className="min-w-0 flex-1 truncate text-slate-400"
                dangerouslySetInnerHTML={{ __html: (sim.log[sim.log.length - 1] || { txt: '' }).txt }}
              />
            </summary>
            <div className="p-2 pt-0">
              <RadioFeed sim={sim} />
            </div>
          </details>
        ) : (
          <RadioFeed sim={sim} />
        )}
      </div>
      <Dock sim={sim} />
    </div>
  );
}
