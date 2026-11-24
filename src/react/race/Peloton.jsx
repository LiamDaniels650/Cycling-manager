// La course groupe par groupe : tête, peloton, lâchés où sont mes coureurs ou des favoris (portage de liveHTML).
import { Card, TeamDot, Jersey } from '../ui.jsx';
import { Icon } from '../icons.jsx';

function Tag({ x, star }) {
  return (
    <span className="whitespace-nowrap">
      {star ? '★ ' : ''}
      <TeamDot T={x.team} />
      {riderName(x.r)}
      <Jersey id={x.id} />
    </span>
  );
}
export function Peloton({ sim }) {
  sim.groups = sim.groups.filter(G => G.riders.length);
  const front = sim.groups[0];
  const pelG = sim.groups.includes(sim.pel) ? sim.pel : null;
  const shown = pelG
    ? [
        ...sim.groups.filter(G => G.pos > pelG.pos + 0.001).slice(0, 5),
        pelG,
        ...sim.groups
          .filter(G => G.pos < pelG.pos - 0.001 && G.riders.some(x => x.player || sim.favs.has(x.id)))
          .slice(0, 3),
      ]
    : sim.groups.slice(0, 7);
  const rest = sim.groups.filter(G => !shown.includes(G));
  const nRest = sum(rest.map(G => G.riders.length));
  const mineRest = rest.flatMap(G => G.riders.filter(x => x.player));
  return (
    <Card
      title="Course"
      right={
        boardAge(sim) != null ? (
          <span
            className="text-xs text-slate-400"
            title="Écarts donnés par la radio-course et l'ardoisier, avec un peu d'imprécision"
          >
            📻 pointage il y a {fmtDec(boardAge(sim), 1)} km
          </span>
        ) : null
      }
    >
      {/* hauteur fixe, défilement interne : l'écran ne bouge pas quand des groupes se forment ou se rejoignent */}
      <div className="h-[22rem] overflow-y-auto overscroll-contain pr-1">
        <div className="space-y-2">
          {shown.map(G => {
            const i = sim.groups.indexOf(G);
            const gap = i ? boardGapTxt(sim, front, G) : '';
            const mine = G.riders.filter(x => x.player);
            const fav = G.riders.filter(x => !x.player && (sim.favs.has(x.id) || jersey(x.id)));
            const others =
              G.riders.length <= 8 ? G.riders.filter(x => !x.player).map(x => [x, false]) : fav.map(x => [x, true]);
            const workT = [...new Set(G.riders.filter(x => x.work > 0).map(x => x.team))];
            const wkg = groupWkg(G).replace(' · ⚡ ', '');
            return (
              <div
                key={i}
                className={
                  'rounded-xl border-l-4 px-3 py-2 ' +
                  (mine.length ? 'border-pink-400 bg-pink-500/10' : 'border-slate-600 bg-slate-800/60')
                }
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <b className="text-slate-50">
                    {grpLabel(sim, G, i)} · {G.riders.length}
                  </b>
                  <span className="text-sm text-slate-200">
                    {i ? <b className="mr-1 tabular-nums">{gap}</b> : null}
                    {G.cutRush ? <span className="mr-1 text-xs text-amber-300">⏱️ calcule les délais</span> : null}
                    <span className="text-xs text-slate-400">
                      {G.speed.toFixed(1)} km/h
                      {wkg ? (
                        <>
                          {' '}
                          · <Icon name="zap" size={12} className="text-yellow-300" /> {wkg}
                        </>
                      ) : null}
                    </span>
                  </span>
                </div>
                <div className="mt-0.5 text-[13px] leading-relaxed text-slate-200">
                  {mine.map((x, k) => (
                    <span key={x.id}>
                      {k ? ', ' : ''}
                      <b className="text-pink-300">{riderName(x.r)}</b>
                      <Jersey id={x.id} />
                    </span>
                  ))}
                  {mine.length && others.length ? ' · ' : ''}
                  {others.map(([x, st], k) => (
                    <span key={x.id}>
                      {k ? ', ' : ''}
                      <Tag x={x} star={st} />
                    </span>
                  ))}
                </div>
                {workT.length ? (
                  <div className="mt-0.5 text-xs text-slate-400">
                    Mènent :{' '}
                    {workT.slice(0, 6).map(T => (
                      <span key={T.id} className="mr-1.5">
                        <TeamDot T={T} />
                        {T.short}
                      </span>
                    ))}
                    {workT.length > 6 ? '…' : ''}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {rest.length ? (
          <div className="mt-2 text-xs text-slate-400">
            + {nRest} coureur{nRest > 1 ? 's' : ''} dans {rest.length} autre{rest.length > 1 ? 's' : ''} groupe
            {rest.length > 1 ? 's' : ''}
            {mineRest.length ? ' dont ' + mineRest.map(x => riderName(x.r)).join(', ') : ''}
          </div>
        ) : null}
        {sim.finish.length ? (
          <div className="mt-2 text-sm text-slate-200">
            Arrivés :{' '}
            {sim.finish
              .slice(0, 3)
              .map((x, i) => `${i + 1}. ${riderName(x.r)}`)
              .join(' · ')}
            {sim.finish.length > 3 ? ' …' : ''}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
