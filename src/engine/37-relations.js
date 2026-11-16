/* Relations entre coéquipiers : complicités et tensions, effet sur l'obéissance et le moral, médiation. */

// Un coureur part : ses amis dans l'équipe perdent du moral.
function friendLeaves(id) {
  for (const [o, v] of relationsOf(id)) {
    if (v >= 40) {
      const q = S.riders[o];
      q.moral = clamp(q.moral - 8, 0, 100);
      msg(`${riderName(q)} attristé`, `${riderName(q)} regrette le départ de son ami ${riderName(S.riders[id])}.`);
    }
  }
}
// Clé d'une relation entre deux coureurs.
function relKey(a, b) {
  return a < b ? a + '-' + b : b + '-' + a;
}
// Relation entre deux coureurs (-100 à +100).
function rel(a, b) {
  return (S.rel && S.rel[relKey(a, b)]) || 0;
}
// Fait évoluer une relation.
function addRel(a, b, v) {
  if (a === b) return;
  S.rel = S.rel || {};
  const k = relKey(a, b);
  const before = S.rel[k] || 0;
  const now = clamp(before + v, -100, 100);
  if (Math.abs(now) < 3) delete S.rel[k];
  else S.rel[k] = Math.round(now);
  if (before > -50 && now <= -50) {
    msg('Tensions', `Le courant ne passe plus du tout entre ${riderName(S.riders[a])} et ${riderName(S.riders[b])}.`);
  }
  if (before < 50 && now >= 50) {
    msg('Complicité', `${riderName(S.riders[a])} et ${riderName(S.riders[b])} sont devenus très proches.`);
  }
}
// Relations initiales d'un nouveau coureur avec ses équipiers.
function seedRelationsFor(id) {
  S.rel = S.rel || {};
  S.relSeen = S.relSeen || {};
  const r = S.riders[id];
  const mates = S.teams[0].riders.concat(S.academy).filter(o => o !== id);
  for (const o of mates) {
    const k = relKey(id, o);
    if (S.relSeen[k]) continue;
    S.relSeen[k] = 1;
    const q = S.riders[o];
    let pF = 0.1 + (r.nat === q.nat ? 0.1 : 0) + (Math.abs(r.age - q.age) < 3 ? 0.04 : 0);
    let pR =
      0.04 +
      (r.amb > 70 && q.amb > 70 ? 0.18 : 0) +
      (r.arch === q.arch && r.amb > 60 && q.amb > 60 ? 0.08 : 0) +
      (r.trait === 'leaderne' || q.trait === 'leaderne' ? 0.06 : 0);
    const u = rnd();
    if (u < pF) S.rel[k] = Math.round(rf(20, 60));
    else if (u < pF + pR) S.rel[k] = -Math.round(rf(20, 60));
  }
}
// Relations notables d'un coureur.
function relationsOf(id) {
  const out = [];
  for (const k in S.rel || {}) {
    const [a, b] = k.split('-').map(Number);
    if (a === id || b === id) {
      const o = a === id ? b : a;
      const r = S.riders[o];
      if (r && !r.retired && r.team === 0) out.push([o, S.rel[k]]);
    }
  }
  return out.sort((a, b) => b[1] - a[1]);
}
// Réunit deux coureurs en froid pour discuter.
function mediate(a, b) {
  const g = rnd() < 0.2 ? -rint(3, 10) : rint(8, 22);
  addRel(a, b, g);
  S.riders[a].moral = clamp(S.riders[a].moral - 2, 0, 100);
  S.riders[b].moral = clamp(S.riders[b].moral - 2, 0, 100);
  return g > 0
    ? `La discussion a apaisé les choses entre ${riderName(S.riders[a])} et ${riderName(S.riders[b])}.`
    : `La discussion a mal tourné entre ${riderName(S.riders[a])} et ${riderName(S.riders[b])}…`;
}
// Après une course : les relations évoluent selon les sacrifices et les désobéissances.
function raceRelations(rc) {
  const my = rc.sel[0] || [];
  if (my.length < 2) return;
  const gcl = gcList(rc);
  const pos = id => gcl.indexOf(id) + 1;
  const leaders = [...new Set(rc.ledBy || [])];
  const helpers = my.filter(id => !leaders.includes(id));
  for (const L of leaders) {
    const good = pos(L) > 0 && pos(L) <= 5;
    for (const h of helpers) {
      const rebel = (rc.rebels || []).includes(h);
      addRel(L, h, rebel ? -8 : good ? 6 : 1);
    }
  }
  const amb = my.filter(id => S.riders[id].amb > 72 && !leaders.includes(id));
  for (const a of amb)
    for (const L of leaders) {
      if (overall(S.riders[a].s) >= overall(S.riders[L].s) - 2) addRel(a, L, -6);
    }
  if (my.includes(gcl[0]))
    for (let i = 0; i < my.length; i++) for (let j = i + 1; j < my.length; j++) addRel(my[i], my[j], 2);
}
