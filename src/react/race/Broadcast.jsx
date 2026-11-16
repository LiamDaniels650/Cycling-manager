// Retransmission : en-tête de course, chrono, profil animé de l'étape, groupes sur la route, écart, maillot virtuel.
// Portage fidèle de tvHTML, profileSVG, roadStrip, gapChart et virtualLeader (ancienne interface).
import { Icon } from '../icons.jsx';

export function RaceHeader({ sim, rc }) {
  return (
    <div className="mb-1 flex items-start justify-between gap-2">
      <div>
        <div className="text-[15px] font-bold leading-tight text-slate-50">{rc.name}</div>
        <div className="text-sm text-slate-300">{sim.spec.name}</div>
      </div>
      {sim.wx && sim.wx !== 'sec' && (
        <div className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200">{WX[sim.wx]}</div>
      )}
    </div>
  );
}
export function Clock({ sim, frac }) {
  const spec = sim.spec;
  const G0 = sim.groups[0];
  const km = G0 ? Math.min(ipos(G0, frac), spec.dist) : spec.dist;
  const [g, surf, ex] = terrainAt(sim, km);
  const t = Math.max(0, sim.t * 60 - 30 + frac * 30);
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-slate-200 sm:grid-cols-4">
      <span className="flex items-center gap-1">
        <Icon name="timer" size={15} className="text-sky-300" />
        <b className="tabular-nums">{fmtTime(t)}</b>
      </span>
      <span className="tabular-nums">
        km <b>{km.toFixed(1)}</b> / {spec.dist} · reste <b>{(spec.dist - km).toFixed(1)}</b>
      </span>
      <span className="flex items-center gap-1">
        <Icon name="mountain" size={15} className="text-amber-300" />
        {g.toFixed(1)} %{surf ? <b className="text-amber-300"> PAVÉS</b> : null}
        {ex && sim.P.wind ? <Icon name="wind" size={15} className="text-cyan-300" /> : null}
      </span>
      <span className="flex items-center gap-1">
        <Icon name="gauge" size={15} className="text-slate-400" />
        {G0 ? G0.speed.toFixed(1) : 0} km/h
      </span>
    </div>
  );
}
// Profil altimétrique : relief, zones exposées au vent, routes étroites, pavés, cols, sprint, kilomètres, groupes.
export function StageProfile({ spec, Pf, sim, frac = 1 }) {
  const W = 640,
    H = 130,
    pad = 14;
  const n = Pf.n;
  let mn = 1e9,
    mx = -1e9;
  for (let i = 0; i < n; i++) {
    mn = Math.min(mn, Pf.alt[i]);
    mx = Math.max(mx, Pf.alt[i]);
  }
  const rng = Math.max(400, mx - mn);
  const X = km => pad + (km / spec.dist) * (W - 2 * pad),
    Y = a => H - 18 - ((a - mn) / rng) * (H - 40);
  const step = Math.max(1, Math.floor(n / 320));
  let pts = `${X(0)},${H - 18} `;
  for (let i = 0; i < n; i += step) pts += `${X(i * STEP).toFixed(1)},${Y(Pf.alt[i]).toFixed(1)} `;
  pts += `${X(spec.dist)},${Y(Pf.alt[n - 1])} ${X(spec.dist)},${H - 18}`;
  const runs = arr => {
    const out = [];
    let k = 0;
    while (k < n) {
      if (arr[k]) {
        let j = k;
        while (j < n && arr[j]) j++;
        out.push([k, j]);
        k = j;
      } else k++;
    }
    return out;
  };
  const ticks = [];
  for (let k = 0; k <= spec.dist; k += spec.dist > 100 ? 50 : 10) ticks.push(k);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full">
      <defs>
        <linearGradient id="pfg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#38bdf8" stopOpacity=".55" />
          <stop offset="1" stopColor="#0f172a" stopOpacity=".2" />
        </linearGradient>
      </defs>
      <polygon points={pts} fill="url(#pfg)" stroke="#7dd3fc" strokeWidth="1.2" />
      {Pf.wind
        ? runs(Pf.expo).map(([a, b]) => (
            <line
              key={'w' + a}
              x1={X(a * STEP)}
              x2={X(b * STEP)}
              y1={H - 11}
              y2={H - 11}
              stroke="#67e8f9"
              strokeWidth="3"
            />
          ))
        : null}
      {Pf.narrow
        ? runs(Pf.narrow).map(([a, b]) => (
            <line
              key={'n' + a}
              x1={X(a * STEP)}
              x2={X(b * STEP)}
              y1={H - 7}
              y2={H - 7}
              stroke="#f472b6"
              strokeWidth="3"
            />
          ))
        : null}
      {Pf.sectors.map((sc, i) => (
        <line key={'p' + i} x1={X(sc.start)} x2={X(sc.end)} y1={H - 15} y2={H - 15} stroke="#fbbf24" strokeWidth="3" />
      ))}
      {Pf.climbs.map((c, i) => (
        <text
          key={'c' + i}
          x={X(c.end)}
          y={Y(Pf.alt[Math.min(n - 1, Math.round(c.end / STEP))]) - 5}
          fill="#fca5a5"
          fontSize="15"
          fontWeight="700"
          textAnchor="middle"
        >
          {c.cat}
        </text>
      ))}
      {spec.isp && spec.type !== 'clm' && S.rc && S.rc.specs.length > 1 ? (
        <text x={X(Math.round(spec.dist * spec.isp))} y={H - 20} fill="#86efac" fontSize="15" fontWeight="700">
          S
        </text>
      ) : null}
      {ticks.map(k => (
        <text key={'k' + k} x={X(k)} y={H - 1} fill="#94a3b8" fontSize="14" textAnchor="middle">
          {k}
        </text>
      ))}
      <line x1={X(spec.dist)} x2={X(spec.dist)} y1="10" y2={H - 18} stroke="#e2e8f0" strokeDasharray="3 3" />
      {sim
        ? sim.groups.slice(0, 8).map((G, i) => {
            const gp = ipos(G, frac);
            const x = X(Math.min(gp, spec.dist)),
              y = Y(Pf.alt[clamp(Math.floor(gp / STEP), 0, n - 1)]);
            const mine = G.riders.some(r => r.player);
            return (
              <g key={'g' + i}>
                <circle
                  cx={x}
                  cy={y}
                  r={G.riders.length > 20 ? 9 : 6}
                  fill={mine ? '#f472b6' : '#f8fafc'}
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />
                {i < 4 ? (
                  <text x={x + 6} y={y - 8} fill="#e2e8f0" fontSize="15" fontWeight="700">
                    {G.riders.length}
                  </text>
                ) : null}
              </g>
            );
          })
        : null}
    </svg>
  );
}
// Les groupes sur la route, à l'échelle, de la tête au dernier groupe affiché.
export function RoadStrip({ sim, frac }) {
  const gs = sim.groups.slice(0, 6);
  if (gs.length < 2)
    return (
      <svg viewBox="0 0 640 84" className="mt-1 w-full">
        <line x1="40" x2="600" y1="42" y2="42" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
        <circle cx="600" cy="42" r="13" fill={gs[0] && gs[0].riders.some(y => y.player) ? '#f472b6' : '#cbd5e1'} />
        <text x="320" y="20" fill="#94a3b8" fontSize="23" textAnchor="middle">
          Tout le monde ensemble
        </text>
      </svg>
    );
  const W = 640,
    H = 84,
    pad = 40;
  const top = ipos(gs[0], frac),
    last = ipos(gs[gs.length - 1], frac);
  const span = Math.max(0.3, top - last);
  const X = p => W - pad - ((top - p) / span) * (W - 2 * pad);
  const lastX = [1e9, 1e9];
  const lastT = [-1, -1]; // index de la dernière étiquette de chaque rangée
  const items = [];
  gs.forEach((G, i) => {
    const x = X(ipos(G, frac)),
      mine = G.riders.some(y => y.player);
    items.push(
      <circle
        key={'c' + i}
        cx={x.toFixed(1)}
        cy="42"
        r={Math.min(13, 5 + Math.sqrt(G.riders.length))}
        fill={mine ? '#f472b6' : '#cbd5e1'}
      />
    );
    const tx = clamp(x, 75, W - 75);
    let row = lastX[0] - tx >= 165 ? 0 : lastX[1] - tx >= 165 ? 1 : -1;
    if (row < 0 && !mine && i) return;
    if (row < 0) {
      // mon groupe passe avant : il prend la place de l'étiquette voisine au lieu de la chevaucher
      row = 1;
      if (lastT[1] >= 0) items[lastT[1]] = null;
    }
    lastX[row] = tx;
    lastT[row] = items.length;
    const gap = i ? fmtGap(gapSec(gs[0], G)) : 'Tête';
    items.push(
      <text
        key={'t' + i}
        x={tx.toFixed(1)}
        y={row ? 80 : 20}
        fill={mine ? '#f9a8d4' : '#cbd5e1'}
        fontSize="23"
        fontWeight={mine ? 700 : 500}
        textAnchor="middle"
      >
        {G.riders.length} · {gap}
      </text>
    );
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full">
      <line x1={pad} x2={W - pad} y1="42" y2="42" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
      {items}
    </svg>
  );
}
// Évolution de l'écart entre la tête de course et le peloton, kilomètre par kilomètre.
export function GapChart({ sim }) {
  const Hh = sim.gapHist || [];
  const W = 640,
    H = 90,
    pad = 22;
  // place réservée tant qu'il n'y a pas d'écart : l'écran ne saute pas quand le graphique apparaît
  if (Hh.length < 3 || !Hh.some(p => p.gap > 5))
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full">
        <line x1={pad} x2={W - pad} y1={H - 12} y2={H - 12} stroke="#334155" />
        <text x={pad} y="17" fill="#64748b" fontSize="17">
          Écart tête / peloton : course groupée
        </text>
      </svg>
    );
  const mx = Math.max(60, ...Hh.map(p => p.gap));
  const X = k => pad + (k / sim.dist) * (W - 2 * pad),
    Y = v => H - 12 - (v / mx) * (H - 30);
  const pts = Hh.map(p => `${X(p.km).toFixed(1)},${Y(p.gap).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full">
      <line x1={pad} x2={W - pad} y1={H - 12} y2={H - 12} stroke="#334155" />
      <polyline points={pts} fill="none" stroke="#facc15" strokeWidth="2" />
      <text x={pad} y="17" fill="#cbd5e1" fontSize="17">
        Écart tête / peloton : {fmtGap(Hh[Hh.length - 1].gap)} (max {fmtGap(mx)})
      </text>
    </svg>
  );
}
// Maillot jaune virtuel : le mieux placé au général si l'on figeait les écarts maintenant.
export function VirtualLeader({ sim }) {
  const rc = sim.rc;
  if (rc.specs.length < 2 || !rc.stageRes.length || sim.finish.length) return null;
  const G0 = sim.groups[0];
  let best = null,
    bv = 1e12;
  for (const x of sim.runners) {
    if (x.fin || x.dnf || !x.g) continue;
    const v = rc.gc[x.id] + gapSec(G0, x.g);
    if (v < bv) {
      bv = v;
      best = x;
    }
  }
  const ldr = gcList(rc)[0];
  if (!best) return null;
  return best.id === ldr ? (
    <div className="text-xs text-slate-400">🟡 {riderName(best.r)} conserve virtuellement son maillot.</div>
  ) : (
    <div className="text-sm font-semibold text-yellow-200">
      🟡 Maillot jaune virtuel : {riderName(best.r)} ({best.team.short})
    </div>
  );
}
export function Banner() {
  const B = UI.banner;
  if (!B || Date.now() >= B.until) return null;
  return (
    <div
      className={
        'mt-2 rounded-xl px-3 py-2 text-sm font-semibold ' +
        (B.mine
          ? 'bg-pink-500/20 text-pink-100 ring-1 ring-pink-400/60'
          : 'bg-amber-400/15 text-amber-100 ring-1 ring-amber-300/50')
      }
    >
      <span dangerouslySetInnerHTML={{ __html: B.txt }} />
    </div>
  );
}
