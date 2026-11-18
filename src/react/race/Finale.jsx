// Le final (15 derniers km) et la photo-finish : portage fidèle de finaleHTML et photoHTML.
import { useEffect, useState } from 'react';
import { Icon } from '../icons.jsx';
import { Html, Effort } from '../ui.jsx';
import { RoadStrip } from './Broadcast.jsx';

// Le final a-t-il commencé (tête à 15 km ou moins, ou arrivée en cours) ?
export function inFinale(sim) {
  if (sim.photo) return true;
  const A = sim.groups.find(G => G.riders.some(x => !x.fin));
  return !!A && sim.dist - A.pos <= FINALE_KM;
}
// Les 15 derniers km à plat : bornes 10/5/3 km, flamme rouge, difficultés et secteurs pavés, groupes en points
// (rose : avec un de mes coureurs). Se lit d'un coup d'œil : qui est où par rapport à la ligne.
function FinalTrack({ sim, frac }) {
  const W = 640,
    H = 96,
    L = 24,
    R = 44,
    y = 50;
  const D = FINALE_KM;
  const X = kmL => L + ((D - clamp(kmL, 0, D)) / D) * (W - L - R);
  const live = sim.groups.filter(G => G.riders.some(x => !x.fin)).slice(0, 8);
  const P = sim.P;
  const zones = [
    ...P.climbs.filter(c => c.end > sim.dist - D).map(c => [c.start, c.end, '#f59e0b']),
    ...(P.sectors || []).filter(c => c.end > sim.dist - D).map(c => [c.start, c.end, '#a16207']),
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" aria-label="Position des groupes avant l'arrivée">
      <line x1={L} x2={W - R} y1={y} y2={y} stroke="#475569" strokeWidth="6" strokeLinecap="round" />
      {zones.map(([a, b, c], i) => (
        <line key={'z' + i} x1={X(sim.dist - a)} x2={X(sim.dist - b)} y1={y} y2={y} stroke={c} strokeWidth="6" />
      ))}
      {[10, 5, 3, 1].map(m => (
        <g key={m}>
          <line x1={X(m)} x2={X(m)} y1={y - 9} y2={y + 9} stroke={m === 1 ? '#ef4444' : '#64748b'} strokeWidth="4" />
          <text x={X(m)} y={H - 2} textAnchor="middle" fontSize="22" fill={m === 1 ? '#fca5a5' : '#94a3b8'}>
            {m === 1 ? '1 km' : m}
          </text>
        </g>
      ))}
      <rect x={W - R + 2} y={y - 14} width="8" height="28" fill="#e2e8f0" />
      <text x={W - R + 6} y={H - 2} textAnchor="middle" fontSize="22" fill="#e2e8f0">
        🏁
      </text>
      {live
        .map((G, i) => {
          const cx = X(sim.dist - ipos(G, frac));
          const mine = G.riders.some(x => x.player && !x.fin);
          // une étiquette seulement si elle ne chevauche pas celle d'un groupe plus en avant
          const lbl =
            (mine || !i) &&
            !live
              .slice(0, i)
              .some(
                (H, j) =>
                  (j === 0 || H.riders.some(x => x.player && !x.fin)) && Math.abs(X(sim.dist - ipos(H, frac)) - cx) < 44
              );
          return { G, cx, mine, lbl, n: G.riders.filter(x => !x.fin).length };
        })
        .reverse()
        .map(({ G, cx, mine, lbl, n }, i) => {
          return (
            <g key={i}>
              <circle
                cx={cx}
                cy={y}
                r={Math.min(16, 7 + Math.sqrt(n))}
                fill={mine ? '#f472b6' : '#e2e8f0'}
                stroke="#0f172a"
                strokeWidth="2"
              />
              {lbl ? (
                <text
                  x={clamp(cx, 20, W - 20)}
                  y={y - 20}
                  textAnchor="middle"
                  fontSize="24"
                  fontWeight="700"
                  fill={mine ? '#f9a8d4' : '#e2e8f0'}
                >
                  {n}
                </text>
              ) : null}
            </g>
          );
        })}
    </svg>
  );
}

export function Finale({ sim, children }) {
  const A = sim.groups.find(G => G.riders.some(x => !x.fin));
  if (sim.photo) return <Photo sim={sim} />;
  if (!A) return null;
  const kmL = sim.dist - A.pos;
  if (kmL > FINALE_KM) return null;
  const live = sim.groups.filter(G => G.riders.some(x => !x.fin));
  const pel = live.includes(sim.pel) ? sim.pel : live[0];
  const ahead = live.filter(G => G.pos > pel.pos + 0.001).slice(0, 3);
  const behind = live
    .filter(G => G.pos < pel.pos - 0.001 && G.riders.some(x => !x.fin && (x.player || sim.favs.has(x.id))))
    .slice(0, 2);
  const gs = [...ahead, pel, ...behind];
  const P = sim.P;
  const lc = P.climbs.filter(c => c.end > A.pos).slice(-1)[0];
  const sec = (P.sectors || []).filter(c => c.end > A.pos);
  let terr;
  if (lc && lc.end >= sim.dist - 0.5)
    terr = `Arrivée au sommet : ${lc.name}, ${lc.len.toFixed(1)} km à ${lc.avg.toFixed(1)} %`;
  else if (lc)
    terr = `Dernière difficulté : ${lc.name} (${lc.len.toFixed(1)} km à ${lc.avg.toFixed(1)} %) ${lc.start > A.pos ? `dans ${(lc.start - A.pos).toFixed(1)} km` : 'en cours'}, sommet à ${(sim.dist - lc.end).toFixed(1)} km de l'arrivée`;
  else if (sec.length)
    terr = `Encore ${sec.length} secteur${sec.length > 1 ? 's' : ''} pavé${sec.length > 1 ? 's' : ''}`;
  else
    terr =
      P.finishGrad >= 3 ? `Arrivée en côte (${P.finishGrad.toFixed(1)} %)` : 'Arrivée plate : place aux sprinteurs';
  const big = kmL <= 1 ? '🚩 ' + Math.max(0, Math.round(kmL * 1000)) + ' m' : kmL.toFixed(1).replace('.', ',') + ' km';
  const best = sim.runners
    .filter(x => (S.car ? x.id === S.car.id : x.player) && !x.fin && !x.dnf && x.g)
    .sort((p, q) => q.g.pos - p.g.pos || q.energy - p.energy)[0];
  const tr = ahead.length ? finaleTrend(sim) : null;
  const facts = sim.log
    .filter(l => l.km >= sim.dist - FINALE_KM && /^(🔥|⚔️|💥|⬇️|⚡|🚀|📍|🚩|🏁|🗡️|🤝|🔁)/.test(l.txt))
    .slice(-3)
    .reverse();
  return (
    <section className="rounded-2xl border border-amber-400/40 bg-gradient-to-b from-amber-500/10 to-slate-900 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="shrink-0 text-3xl font-black tabular-nums text-amber-200">{big}</span>
        <span className="line-clamp-2 min-h-8 text-right text-xs text-slate-300">{terr}</span>
      </div>
      <FinalTrack sim={sim} frac={UI.acc || 0} />
      <RoadStrip sim={sim} frac={UI.acc || 0} />
      {/* mes actions juste sous la route : visibles sans faire défiler, au-dessus des commandes */}
      {children ? <div className="mt-2">{children}</div> : null}
      {/* hauteurs fixes partout : les groupes qui se font et se défont ne font pas bouger l'écran */}
      <div className="mt-2 h-[12rem] space-y-1.5 overflow-y-auto overscroll-contain pr-1">
        {gs.map((G, i) => {
          const n = G.riders.filter(x => !x.fin).length;
          const nMine = G.riders.filter(x => !x.fin && x.player).length;
          const gap = i ? fmtGap(gapSec(gs[0], G)) : 'Tête';
          const wt = workingTeams(G);
          const isPel = G === pel && n > 12;
          const lab = i > ahead.length ? 'Lâchés, roulent' : i ? 'Roulent' : 'Mènent';
          return (
            <div
              key={i}
              className={
                'flex gap-3 rounded-xl px-2.5 py-2 ' +
                (nMine ? 'bg-pink-500/15 ring-1 ring-pink-400/50' : 'bg-slate-800/70')
              }
            >
              <span className="w-16 shrink-0 font-bold tabular-nums text-slate-100">
                {gap}
                {tr && G === pel && i ? (
                  <span
                    className={
                      'block text-xs ' +
                      (tr.slope < -0.5 ? 'text-emerald-300' : tr.slope > 0.5 ? 'text-rose-300' : 'text-slate-400')
                    }
                  >
                    {tr.slope < -0.5 ? '▼ revient' : tr.slope > 0.5 ? '▲ perd' : '= stable'}
                  </span>
                ) : null}
              </span>
              <div className="min-w-0 text-sm text-slate-100">
                {isPel ? (
                  <>
                    <b>Peloton{ahead.length ? '' : ' groupé'}</b> ({n}){nMine ? ` · ${nMine} de mes coureurs` : ''}
                  </>
                ) : (
                  <>
                    <b>{n === 1 ? 'Seul' : n + ' coureurs'}</b> · {notableNames(sim, G, 4).join(', ')}
                    {n > 4 ? <span className="text-slate-400"> +{n - 4}</span> : null}
                  </>
                )}
                {wt.length ? (
                  <div className="text-xs text-slate-400">
                    {lab} :{' '}
                    {wt
                      .slice(0, 3)
                      .map(w => w[0] + (w[1] > 1 ? ` (${w[1]})` : ''))
                      .join(', ')}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 min-h-10 text-sm text-slate-100">
        {best ? (
          <div>
            <b className="text-pink-300">★ {riderName(best.r)}</b>{' '}
            {best.g === gs[0] ? 'en tête de course' : best.g === pel ? 'dans le peloton' : 'dans un groupe'}
            {best.g === gs[0] ? '' : ` à ${fmtGap(gapSec(gs[0], best.g))}`} · réserves {Math.round(best.energy)} %{' '}
            <Effort I={best.I} />
          </div>
        ) : null}
      </div>
      <div className="mt-2 min-h-[2.75rem] rounded-lg bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100">
        {tr ? (
          <div>
            {tr.slope < -0.5 ? (
              <>
                📉 L'écart fond de {Math.abs(tr.slope).toFixed(0)} s/km.{' '}
                <b>
                  {tr.catchAt != null
                    ? `Jonction prévue vers ${tr.catchAt.toFixed(1).replace('.', ',')} km de l'arrivée.`
                    : `La tête devrait garder environ ${tr.keep} s.`}
                </b>
              </>
            ) : tr.slope > 0.5 ? (
              <>
                📈 L'écart grandit de {Math.abs(tr.slope).toFixed(0)} s/km : <b>la tête prend le large.</b>
              </>
            ) : (
              <>➡️ L'écart se stabilise autour de {Math.round(tr.gap)} s.</>
            )}
          </div>
        ) : (
          <span className="text-slate-400">Tendance de l'écart : dès qu'un groupe se détache.</span>
        )}
      </div>
      <div className="mt-2 h-[4.25rem] space-y-0.5 overflow-hidden border-t border-slate-700 pt-2">
        {facts.map((l, i) => (
          <Html key={i} as="div" className="block truncate text-xs text-slate-300" html={l.txt} />
        ))}
      </div>
    </section>
  );
}
const BUZZED = new WeakSet();
const REPLAYED = new WeakSet(); // sprints déjà rejoués (la retransmission ne repart pas à chaque rafraîchissement)
// Écart sur la ligne, en mètres, dit comme à la télévision.
const gapWords = d =>
  d < 0.35
    ? 'un boyau'
    : d < 1
      ? 'une demi-longueur'
      : d < 2.2
        ? 'une longueur'
        : d < 12
          ? `${Math.min(6, Math.max(2, Math.round(d / 1.8)))} longueurs`
          : `${Math.round(d)} m`;
// Commentaire d'un événement du sprint.
function sprintLine(e, R) {
  const r = R.find(y => y.id === e.id);
  if (!r) return '';
  if (e.k === 'launch') return `⚡ ${r.n} (${r.t}) lance à ${e.m} m !`;
  if (e.k === 'box') return `📦 ${r.n} est enfermé, il cherche l'ouverture !`;
  return `🔝 ${r.n} passe en tête à ${e.m} m !`;
}
const SPRINT_FROM = 450; // mètres montrés
const SPRINT_SPEED = 3.5; // la retransmission va 3,5 fois plus vite que le sprint réel (≈ 8 s)
// Les 450 derniers mètres du sprint, rejoués : un couloir par coureur (dans l'ordre d'arrivée), la ligne à droite,
// la distance restante et le commentaire en direct. Les positions viennent du sprint simulé (09-stage-finish.js).
function SprintReplay({ tr, onDone }) {
  const [run, setRun] = useState(0);
  const start = Math.max(
    0,
    tr.frames.findIndex(f => Math.min(...f) <= SPRINT_FROM)
  );
  const end = tr.frames.length - 1;
  const [k, setK] = useState(start);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    setK(start);
    const step = now => {
      const kk = Math.min(end, start + (((now - t0) / 1000) * SPRINT_SPEED) / tr.dt);
      setK(kk);
      if (kk < end) raf = requestAnimationFrame(step);
      else onDone();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [tr, run]);
  const i = Math.floor(k),
    f = k - i;
  const pos = tr.riders.map((_, j) => {
    const a = tr.frames[i][j],
      b = tr.frames[Math.min(end, i + 1)][j];
    return a + (b - a) * f;
  });
  const lead = Math.min(...pos);
  // couloirs dans l'ordre du peloton au début de la retransmission (l'ordre d'arrivée ne se devine pas)
  const order = tr.riders.map((_, j) => j).sort((a, b) => tr.frames[start][a] - tr.frames[start][b]);
  const laneOf = new Map(order.map((j, q) => [j, q]));
  const W = 640,
    L = 8,
    Rr = 150,
    lane = 30,
    H = tr.riders.length * lane + 14;
  const X = d => L + ((SPRINT_FROM - clamp(d, 0, SPRINT_FROM)) / SPRINT_FROM) * (W - L - Rr);
  const tNow = k * tr.dt;
  const said = tr.events.filter(e => e.t <= tNow).slice(-3);
  // sur la ligne : le vainqueur et son avance
  const atLine = k >= end;
  const byGap = tr.riders.slice().sort((a, b) => a.gap - b.gap);
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-black tabular-nums text-amber-200">
          {lead > 0.5 ? `${Math.ceil(lead / 10) * 10} m` : 'Ligne !'}
        </span>
        <span className="flex gap-2">
          <button type="button" className="text-xs text-sky-300 underline" onClick={() => setRun(run + 1)}>
            ↺ Revoir
          </button>
          <button type="button" className="text-xs text-slate-400 underline" onClick={() => (setK(end), onDone())}>
            Passer
          </button>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" aria-label="Retransmission du sprint">
        {[400, 300, 200, 100].map(m => (
          <g key={m}>
            <line x1={X(m)} x2={X(m)} y1={0} y2={H} stroke="#334155" strokeDasharray="4 6" />
            <text x={X(m)} y={H} fontSize="14" fill="#64748b" textAnchor="middle">
              {m}
            </text>
          </g>
        ))}
        <line x1={X(0)} x2={X(0)} y1={0} y2={H - 4} stroke="#f8fafc" strokeWidth="4" strokeDasharray="5 5" />
        {tr.riders.map((r, j) => {
          const y = 16 + laneOf.get(j) * lane;
          const x = X(pos[j]);
          return (
            <g key={r.id}>
              <line x1={L} x2={X(0)} y1={y} y2={y} stroke="#1e293b" strokeWidth="1" />
              <circle
                cx={x}
                cy={y}
                r={r.me ? 11 : 9}
                fill={r.c}
                stroke={r.me ? '#f472b6' : '#0f172a'}
                strokeWidth={r.me ? 4 : 2}
              />
              <text
                x={x > W - Rr - 40 ? x - 15 : x + 15}
                y={y + 6}
                fontSize="18"
                fill={r.me ? '#fbcfe8' : '#cbd5e1'}
                fontWeight={r.me ? 700 : 400}
                textAnchor={x > W - Rr - 40 ? 'end' : 'start'}
              >
                {r.me ? '★ ' : ''}
                {r.n}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 min-h-[3.75rem] space-y-0.5 text-sm text-slate-100">
        {said.map((e, j) => (
          <div key={j} className={j === said.length - 1 && !atLine ? 'font-semibold' : 'text-slate-400'}>
            {sprintLine(e, tr.riders)}
          </div>
        ))}
        {atLine && byGap[1] ? (
          <div className="font-semibold text-amber-100">
            🏆 {byGap[0].n} ({byGap[0].t}) s'impose devant {byGap[1].n} ({gapWords(byGap[1].gap)} d'avance) !
          </div>
        ) : null}
      </div>
    </div>
  );
}
function Photo({ sim }) {
  const ph = sim.photo;
  // une vibration à l'arrivée (plus longue si un de mes coureurs est sur le podium), une seule fois par arrivée
  useEffect(() => {
    if (BUZZED.has(ph) || !navigator.vibrate) return;
    BUZZED.add(ph);
    const pod = ph.ord.slice(0, 3).some(o => (sim.runners.find(y => y.id === o.id) || {}).player);
    try {
      navigator.vibrate(pod ? [120, 60, 120, 60, 240] : 80);
    } catch (e) {}
  }, [sim, ph]);
  const fin = sim.finish;
  const first = fin[0];
  const lbl = d =>
    d < 0.35
      ? 'un boyau'
      : d < 1
        ? 'une demi-longueur'
        : d < 2.2
          ? 'une longueur'
          : `${Math.min(5, Math.max(2, Math.round(d / 1.5)))} longueurs`;
  const kind =
    ph.kind === 'sprint'
      ? (ph.n || ph.ord.length) > 40
        ? 'Sprint massif'
        : `Sprint d'un groupe de ${ph.n || ph.ord.length}`
      : ph.kind === 'seul'
        ? 'Victoire en solitaire'
        : 'Arrivée en côte';
  const mine = fin.filter(x => x.player);
  const second = ph.kind === 'seul' ? fin.find(x => x !== first) : null;
  const tr = ph.kind === 'sprint' && ph.trace && ph.trace.frames.length > 2 ? ph.trace : null;
  const [shown, setShown] = useState(!tr || REPLAYED.has(ph));
  const done = () => {
    REPLAYED.add(ph);
    setShown(true);
  };
  const gapM = id => (tr ? (tr.riders.find(r => r.id === id) || {}).gap : null);
  return (
    <section className="rounded-2xl border border-amber-400/40 bg-slate-900 p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-2 text-2xl font-black text-amber-200">
          <Icon name="flag" size={22} /> Arrivée
        </span>
        <span className="text-xs text-slate-300">{kind}</span>
      </div>
      {tr ? <SprintReplay tr={tr} onDone={done} /> : null}
      <div className={'mt-2 space-y-1.5 ' + (shown ? '' : 'hidden')}>
        {tr ? <div className="text-sm font-semibold text-amber-100">📸 Photo-finish</div> : null}
        {ph.ord.slice(0, 6).map((o, i) => {
          const x = sim.runners.find(y => y.id === o.id);
          const prev = i ? ph.ord[i - 1] : null;
          // écart avec le coureur qui précède (comme dans un vrai classement de sprint)
          const gm = gapM(o.id),
            gp = prev ? gapM(prev.id) : null;
          const gapTxt = !i
            ? '🥇'
            : ph.kind === 'sprint'
              ? gm != null && gp != null
                ? `à ${gapWords(Math.max(0, gm - gp))}`
                : `à ${lbl(prev.s - o.s)}`
              : fmtGap(x.time - first.time);
          return (
            <div
              key={o.id}
              className={
                'flex items-center gap-3 rounded-xl px-2.5 py-2 ' +
                (x.player ? 'bg-pink-500/15 ring-1 ring-pink-400/50' : 'bg-slate-800/70')
              }
              style={{ animation: `fadeIn .4s ${i * 0.15}s both` }}
            >
              <span className="w-6 text-center font-black text-slate-100">{i + 1}</span>
              <div className="text-sm text-slate-100">
                <b>
                  {x.player ? '★ ' : ''}
                  {riderName(x.r)}
                </b>{' '}
                <span className="text-slate-400">{x.team.short}</span> <span className="text-xs">{gapTxt}</span>
              </div>
            </div>
          );
        })}
      </div>
      {ph.kind === 'seul' ? (
        <div className="mt-2 text-sm text-slate-200">
          {second ? (
            <>
              Avance sur le premier poursuivant : <b>{fmtGap(second.time - first.time)}</b>
            </>
          ) : (
            'Les poursuivants sont attendus…'
          )}
        </div>
      ) : null}
      {mine.length && shown ? (
        <div className="mt-1 text-xs text-slate-300">
          Mes coureurs déjà arrivés : {mine.map(x => `${fin.indexOf(x) + 1}e ${riderName(x.r)}`).join(', ')}
        </div>
      ) : null}
    </section>
  );
}
