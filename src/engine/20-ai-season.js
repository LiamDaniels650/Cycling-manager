/* Stratégie de saison des équipes IA : objectifs selon l'effectif, style qui évolue, leaders ménagés. */

// Objectifs d'une équipe IA pour la saison : son Grand Tour cible et sa priorité (général, sprints, classiques).
function aiSeasonPlan(T, focus) {
  const rs = T.riders.map(id => S.riders[id]);
  if (!rs.length) return;
  // les meilleures équipes visent la Grande Boucle ; les autres un Grand Tour où elles peuvent briller
  const gts = S.cal.filter(c => c.cat === 0 && (!c.inv || c.inv.includes(T.id)));
  let gt = null;
  if (gts.length)
    gt = (T.tier >= 1.5 && gts.find(c => c.key === 'gb')) || gts[Math.abs(T.id * 7 + S.season) % gts.length];
  T.goals = { focus, gt: gt ? gt.key : null };
  // le style suit l'effectif ; une équipe qui a déçu devient plus offensive
  const prevRank = S.lastRanks
    ? S.teams
        .slice()
        .sort((a, b) => (S.lastRanks[b.id] || 0) - (S.lastRanks[a.id] || 0))
        .indexOf(T) + 1
    : 0;
  const expect =
    S.teams
      .slice()
      .sort((a, b) => b.tier - a.tier)
      .indexOf(T) + 1;
  T.style =
    prevRank && prevRank > expect + 4
      ? 'agressif'
      : {
          gc: 'gc',
          sprint: 'sprint',
          classiques: T.id % 2 ? 'agressif' : 'opportuniste',
          mixte: T.id % 2 ? 'opportuniste' : 'agressif',
        }[focus];
}
// Chaque équipe IA choisit la priorité où elle est la plus compétitive par rapport aux autres équipes.
function aiSeasonPlans() {
  const ai = S.teams.filter(T => !T.player && T.riders.length);
  const bestOf = (T, f) => Math.max(...T.riders.map(id => f(S.riders[id].s)));
  const dims = { gc: s => s.mon * 0.7 + s.clm * 0.3, sprint: s => s.spr, classiques: s => Math.max(s.pav, s.col) };
  const rank = {};
  for (const k in dims) {
    const sorted = ai.slice().sort((a, b) => bestOf(b, dims[k]) - bestOf(a, dims[k]));
    sorted.forEach((T, i) => ((rank[T.id] = rank[T.id] || {})[k] = i));
  }
  for (const T of ai) {
    const r = rank[T.id];
    let focus = Object.keys(dims).sort((a, b) => r[a] - r[b])[0];
    if (r[focus] > ai.length * 0.6) focus = 'mixte';
    aiSeasonPlan(T, focus);
  }
}
// Le leader de général d'une équipe IA ne court que le Grand Tour qu'elle vise.
function aiRestForGt(T, cal, r) {
  return cal.cat === 0 && T.goals && T.goals.gt && T.goals.gt !== cal.key && aiGcLeader(r, T);
}
// Programme d'entraînement d'un coureur IA.
function aiTraining(r) {
  const nxt = S.cal.find(c => !c.done && c.w >= S.week);
  // les leaders programment leur pic de forme (avec stage en altitude) sur le Grand Tour de leur équipe
  const T = teamOf(r);
  if (T && !T.player && aiGcLeader(r, T)) {
    const gt = S.cal.find(
      c =>
        !c.done &&
        c.cat === 0 &&
        c.w - S.week >= 1 &&
        c.w - S.week <= 7 &&
        (!c.inv || c.inv.includes(T.id)) &&
        (!T.goals || !T.goals.gt || c.key === T.goals.gt)
    );
    if (gt) {
      r.peakW = gt.w;
      if (gt.w - S.week >= 4) r.altBoost = Math.max(r.altBoost || 0, 3);
      return 'pic';
    }
  }
  if (nxt && nxt.w - S.week <= 1) return 'normal';
  if (r.fatigue > 30) return 'repos';
  return rnd() < 0.3 ? 'intensif' : 'normal';
}
// Les deux meilleurs coureurs de général d'une équipe IA.
function aiGcLeader(r, T) {
  if (!['complet', 'grimpeur'].includes(r.arch)) return false;
  const best = T.riders
    .map(id => S.riders[id])
    .filter(q => ['complet', 'grimpeur'].includes(q.arch))
    .sort((a, b) => b.s.mon - a.s.mon)
    .slice(0, 2);
  return best.includes(r);
}
