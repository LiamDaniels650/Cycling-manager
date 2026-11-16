/* Le final d'une étape, lisible comme à la radio-course : points de passage (10 km, 5 km, 3 km, flamme rouge)
   avec la situation de course, historique des écarts pour la tendance, et données de la photo-finish. Rien ici
   ne tire au hasard : la course est la même, on la raconte mieux. */

const FINALE_KM = 15; // le final commence à 15 km de l'arrivée
const FINALE_MARKS = [10, 5, 3, 1];

// Coureurs qui comptent dans un groupe : les miens, les favoris, les maillots (au plus n noms).
function notableNames(sim, G, n) {
  const rc = sim.rc;
  const gl = rc.specs.length > 1 && rc.stageRes.length ? gcList(rc).slice(0, 3) : [];
  const score = x =>
    (x.player ? 100 : 0) + (sim.favs.has(x.id) ? 50 : 0) + (gl.includes(x.id) ? 30 : 0) + cap(x, 0, 0) / 10;
  const L = G.riders.filter(x => !x.fin).sort((a, b) => score(b) - score(a));
  return L.slice(0, n).map(x => `${x.player ? '★ ' : ''}${riderName(x.r)} (${x.team.short})`);
}
// Description courte d'un groupe : « J. Martin (VIK) seul », « un groupe de 8 avec A, B », « le peloton ».
function groupDesc(sim, G) {
  const n = G.riders.filter(x => !x.fin).length;
  const names = notableNames(sim, G, n <= 3 ? 3 : 3);
  if (n === 1) return `${names[0]} seul`;
  if (n <= 3) return names.join(' et ');
  if (G === sim.pel && n > 25) return `le peloton (${n})`;
  return `un groupe de ${n} avec ${names.join(', ')}`;
}
// Équipes qui roulent dans un groupe (poursuite ou train).
function workingTeams(G) {
  const m = new Map();
  for (const x of G.riders) if (!x.fin && x.work >= 0.75) m.set(x.team.short, (m.get(x.team.short) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
// Situation de course en une phrase (tête, premier groupe de poursuivants, qui roule derrière).
function finaleSituation(sim) {
  const gs = sim.groups.filter(G => G.riders.some(x => !x.fin));
  if (!gs.length) return '';
  const A = gs[0];
  const B = sim.pel && sim.pel !== A && gs.includes(sim.pel) ? sim.pel : null;
  let t = groupDesc(sim, A);
  if (B) {
    const wt = workingTeams(B);
    t += ` ; à ${fmtGap(gapSec(A, B)).replace('+', '')}, ${groupDesc(sim, B)}${
      wt.length
        ? ` (${wt
            .map(w => w[0])
            .slice(0, 3)
            .join(', ')} roulent)`
        : ''
    }`;
  } else {
    const tr = workingTeams(A).filter(w => w[1] >= 2);
    if (tr.length && sim.P.finishGrad < 3)
      t += ` ; trains en tête : ${tr
        .map(w => w[0])
        .slice(0, 3)
        .join(', ')}`;
  }
  return t;
}
// À chaque pas : historique des écarts dans le final et annonces aux points de passage.
function finaleTick(sim) {
  const A = sim.groups.find(G => G.riders.some(x => !x.fin));
  if (!A || sim.finish.length) return;
  const kmL = sim.dist - A.pos,
    prevL = sim.dist - (A.prev ?? A.pos);
  if (kmL <= 25) {
    // écart entre la tête et le peloton (les lâchés ne comptent pas)
    const B = sim.pel && sim.pel !== A ? sim.pel : null;
    (sim.fh = sim.fh || []).push({ km: kmL, gap: B ? gapSec(A, B) : 0, n: A.riders.length });
    if (sim.fh.length > 40) sim.fh.shift();
  }
  for (const m of FINALE_MARKS) {
    if (prevL > m && kmL <= m) {
      const lbl = m === 1 ? '🚩 Flamme rouge' : `📍 ${m} km`;
      const txt = `${lbl} : ${finaleSituation(sim)}.`;
      log(sim, txt, 'info');
      highlight(
        sim,
        txt,
        A.riders.some(x => x.player)
      );
    }
  }
}
// Tendance de l'écart entre la tête et les premiers poursuivants (secondes par km, positif = l'écart grandit)
// et projection, comme le calcule un directeur sportif avec la radio-course.
function finaleTrend(sim) {
  const h = sim.fh || [];
  if (h.length < 3) return null;
  const last = h[h.length - 1];
  const ref =
    h
      .slice()
      .reverse()
      .find(p => p.km - last.km >= 1.5) || h[0];
  const dk = ref.km - last.km;
  if (dk < 0.8 || !last.gap) return null;
  const slope = (last.gap - ref.gap) / dk; // s par km parcouru
  let proj = null;
  if (slope < -0.5) {
    const kmCatch = last.gap / -slope;
    proj =
      kmCatch < last.km
        ? { catchAt: Math.max(0, last.km - kmCatch), keep: undefined }
        : { catchAt: undefined, keep: Math.round(last.gap + slope * last.km) };
  } else proj = { catchAt: undefined, keep: Math.round(last.gap + slope * last.km) };
  return { slope, gap: last.gap, km: last.km, ...proj };
}
