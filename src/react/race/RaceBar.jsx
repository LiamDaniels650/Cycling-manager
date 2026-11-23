// Fil d'une course (sélection, briefing, direct, bilan) et bandeau fixe du direct : kilomètres restants, situation
// en tête avec l'écart annoncé par la radio-course, vitesse et pente.
export function RaceSteps({ step }) {
  const L = [
    ['sel', 'Sélection'],
    ['brief', 'Briefing'],
    ['live', 'Direct'],
    ['bilan', 'Bilan'],
  ];
  const k = L.findIndex(x => x[0] === step);
  return (
    <ol className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500" aria-label="Étapes de la course">
      {L.map(([id, l], i) => (
        <li key={id} className="flex items-center gap-2">
          {i ? <span aria-hidden="true">›</span> : null}
          <span className={i === k ? 'font-semibold text-sky-400' : i < k ? 'text-slate-300' : ''} aria-current={i === k ? 'step' : undefined}>
            {l}
          </span>
        </li>
      ))}
    </ol>
  );
}
export function RaceBar({ sim, flat }) {
  const L = sim.groups.filter(G => G.riders.some(x => !x.fin && !x.dnf)).sort((a, b) => b.pos - a.pos);
  if (!L.length) return null;
  const H = L[0];
  const pel = sim.pel && L.includes(sim.pel) ? sim.pel : H;
  const kmL = Math.max(0, sim.dist - H.pos);
  const n = H.riders.filter(x => !x.fin && !x.dnf).length;
  const g = boardGap(sim, H, pel);
  const works = [...new Set(pel.riders.filter(x => x.work > 0).map(x => x.team.short))];
  const status =
    H === pel
      ? `Peloton groupé (${n})`
      : `${n === 1 ? riderName(H.riders[0].r) + ' seul' : 'Échappée de ' + n}`;
  const grad = H.g || 0;
  return (
    <div className={(flat ? 'relative' : 'sticky top-[57px]') + ' z-10 -mx-3 mb-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-800 bg-slate-900/95 px-3 py-2 backdrop-blur md:top-0 md:mx-0 md:rounded-lg md:border-0'}>
      <div>
        <div className="font-display text-3xl font-bold leading-none text-slate-50">
          {kmL < 10 ? kmL.toFixed(1).replace('.', ',') : Math.round(kmL)}
        </div>
        <div className="text-[11px] text-slate-400">km de l'arrivée</div>
      </div>
      <div className="min-w-0">
        <div className="truncate font-display text-base font-semibold text-slate-50">
          {status}
          {H !== pel ? (
            <span className="text-sky-400">
              {' '}
              · {g.ok ? '' : '≈ '}
              {fmtGap(g.v)}
            </span>
          ) : null}
        </div>
        <div className="truncate text-[11px] text-slate-400">
          {boardAge(sim) != null ? `pointage il y a ${fmtDec(boardAge(sim), 1)} km · ` : ''}
          {H === pel ? sim.spec.name : works.length ? `roulent : ${works.slice(0, 3).join(', ')}` : 'personne ne roule'}
        </div>
      </div>
      <div className="text-right font-display">
        <div className="text-base font-semibold text-slate-50">{Math.round(H.speed || 0)} km/h</div>
        <div className={'text-[11px] ' + (grad >= 4 ? 'text-rose-300' : 'text-slate-400')}>
          {(grad >= 0 ? '+' : '') + grad.toFixed(1).replace('.', ',')} %
        </div>
      </div>
    </div>
  );
}
