/* Notes des coureurs après chaque étape (et sur toute la course) : qui a fait mieux ou moins bien qu'attendu.
   - Coureurs qui jouent leur carte (leader, sprinteur, carte libre, échappée) : place obtenue comparée à la place
     attendue, c'est-à-dire leur rang parmi les partants selon le terrain du jour, la forme et la fatigue.
   - Équipiers (protéger le leader, contrôler, poisson-pilote) : le travail fourni (kilomètres de relais, réserves
     vidées pour l'équipe) et le résultat du leader ou du sprinteur qu'ils servaient.
   - « Économiser » : journée tranquille, rien à juger. Abandon sur chute : pas de note.
   Note sur 10 (6 : conforme) et une phrase d'explication. Rien ici ne change la course. */
const FIT_T = {
  plat: s => s.spr * 0.6 + s.pla * 0.4,
  vallonne: s => s.col * 0.55 + s.pla * 0.2 + s.spr * 0.1 + s.end * 0.15,
  punch: s => s.col * 0.7 + s.spr * 0.15 + s.pla * 0.15,
  montagne: s => s.mon * 0.85 + s.end * 0.15,
  sommet: s => s.mon * 0.9 + s.end * 0.1,
  clm: s => s.clm,
  clmeq: s => s.clm * 0.7 + s.pla * 0.3,
  paves: s => s.pav * 0.6 + s.pla * 0.25 + s.end * 0.15,
};
function stageFit(r, type) {
  const f = FIT_T[type] || FIT_T.vallonne;
  return f(r.s) * (0.86 + (0.14 * (r.forme || 70)) / 100) - (r.fatigue || 0) * 0.05;
}
const NOTE_ROLE = {
  leader: 'leader',
  sprint: 'sprinteur',
  free: 'carte libre',
  break: 'échappée',
  protect: 'équipier du leader',
  control: 'contrôle de la course',
  leadout: 'poisson-pilote',
  save: 'économie',
};
function stageReview(rc, spec, res, dnfIds) {
  const mine = rc.sel[0] || [];
  if (!mine.length || rc.esp) return null;
  const starters = res.map(e => e.id).concat(dnfIds || []);
  const ranked = starters.slice().sort((a, b) => stageFit(S.riders[b], spec.type) - stageFit(S.riders[a], spec.type));
  const exp = new Map(ranked.map((id, i) => [id, i + 1]));
  const rank = new Map(res.map((e, i) => [e.id, i + 1]));
  const stats = rc._stats || {};
  const top = (o, n) => {
    const L = mine.filter(id => rc.orders[id] && rc.orders[id].o === o && rank.has(id)).map(id => rank.get(id));
    return L.length ? Math.min(...L) <= n : false;
  };
  const out = {};
  for (const id of mine) {
    if (!exp.has(id)) continue;
    const r = S.riders[id];
    const role = (rc.orders[id] && rc.orders[id].o) || 'free';
    const st = stats[id] || {};
    const rk = rank.get(id);
    const e = exp.get(id);
    let n, why;
    if (!rk) {
      const crash = r.inj && r.inj.s === S.season && r.inj.wk === S.week;
      n = crash ? null : 3;
      why = crash ? 'abandon sur chute' : 'abandon';
    } else if (role === 'save') {
      n = 6;
      why = `journée d'économie (${rk}e)`;
    } else if (['protect', 'control', 'leadout'].includes(role)) {
      const kw = st.kw || 0;
      const work = Math.min(2.5, (kw / Math.max(20, spec.dist)) * 8);
      const spent = st.e != null && st.e < 30 ? 0.8 : st.e != null && st.e > 80 && kw < 10 ? -0.6 : 0;
      const served = role === 'leadout' ? (top('sprint', 3) ? 1.5 : 0) : top('leader', 10) ? 1 : 0;
      n = 5.5 + work + spent + served;
      why = `${Math.round(kw)} km de relais${spent > 0 ? ', réserves vidées pour l’équipe' : spent < 0 ? ', encore frais à l’arrivée' : ''}${served ? (role === 'leadout' ? ', sprinteur sur le podium' : ', leader dans les dix') : ''}`;
    } else {
      n = 6 + 2.6 * Math.log2((e + 3) / (rk + 3)) + (role === 'break' && (st.kf || 0) > 20 ? 0.8 : 0);
      why = `${rk}e pour une ${e}e place attendue${role === 'break' && st.kf ? ` · ${Math.round(st.kf)} km à l'avant` : ''}`;
    }
    out[id] = { n: n == null ? null : +clamp(n, 1, 10).toFixed(1), role, rk: rk || null, exp: e, why };
  }
  return out;
}
// Verdict d'une note.
function noteVerdict(n) {
  return n == null ? '—' : n >= 7.5 ? 'au-dessus des attentes' : n <= 4.5 ? 'en dessous des attentes' : 'conforme aux attentes';
}
// Moyenne des notes de chaque coureur sur toute la course (étapes notées).
function raceReview(rc) {
  const acc = {};
  for (const st of rc.stageRes)
    for (const [id, v] of Object.entries(st.rev || {})) {
      if (v.n == null) continue;
      const a = (acc[id] = acc[id] || { s: 0, k: 0, best: null, worst: null });
      a.s += v.n;
      a.k++;
      if (!a.best || v.n > a.best.n) a.best = { n: v.n, st: st.name };
      if (!a.worst || v.n < a.worst.n) a.worst = { n: v.n, st: st.name };
    }
  return Object.entries(acc)
    .map(([id, a]) => ({ id: +id, avg: +(a.s / a.k).toFixed(1), k: a.k, best: a.best, worst: a.worst }))
    .sort((x, y) => y.avg - x.avg);
}
