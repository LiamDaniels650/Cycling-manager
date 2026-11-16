/* Planificateur de saison : programme de courses de chaque coureur du joueur (S.plan[cléCourse] = [ids]). */

// Nombre de jours de course d'une course (étapes, jours de repos non compris).
function raceDays(c) {
  return c.stagesSpec.length;
}
// Jours de course d'un coureur : déjà courus + prévus dans le planning.
function plannedDays(id) {
  const r = S.riders[id];
  let d = r ? r.stats.days : 0;
  for (const c of S.cal) if (!c.done && ((S.plan || {})[c.key] || []).includes(id)) d += raceDays(c);
  return d;
}
// Objectif raisonnable de jours de course sur la saison (≈ 60 % du calendrier).
function daysTarget() {
  return Math.round(sum(S.cal.filter(c => !c.worlds).map(raceDays)) * 0.45);
}
// Le coureur est-il déjà prévu sur une autre course la même semaine ?
function planConflict(id, c) {
  return S.cal.some(o => o !== c && !o.done && o.w === c.w && (S.plan[o.key] || []).includes(id));
}
function planToggle(key, id) {
  S.plan = S.plan || {};
  const a = (S.plan[key] = S.plan[key] || []);
  const i = a.indexOf(id);
  if (i >= 0) a.splice(i, 1);
  else a.push(id);
}
// Adéquation d'un coureur au profil d'une course (mêmes poids que la sélection des équipes IA).
function raceFit(r, c) {
  const w = { pla: 0, mon: 0, col: 0, spr: 0, clm: 0, pav: 0 };
  for (const [t] of c.stagesSpec) {
    if (t === 'plat') {
      w.spr += 1;
      w.pla += 1;
    } else if (t === 'vallonne') {
      w.col += 1;
      w.pla += 0.5;
    } else if (t === 'punch') w.col += 1.5;
    else if (t === 'montagne' || t === 'sommet') w.mon += 1.5;
    else if (t === 'paves') {
      w.pav += 1.5;
      w.pla += 0.5;
    } else w.clm += 0.8;
  }
  let s = 0,
    tw = 0;
  for (const k in w) {
    s += r.s[k] * w[k];
    tw += w[k];
  }
  return s / tw;
}
// Programme automatique : chaque course reçoit ses meilleurs coureurs disponibles, sans doublon dans la semaine,
// en respectant ≈ 60 % de jours de course, et le leader de général garde la Grande Boucle pour lui.
function autoPlanSeason() {
  S.plan = {};
  const pros = S.teams[0].riders.map(id => S.riders[id]).filter(r => !r.retired);
  const cap = daysTarget();
  const gcLeader = pros.filter(r => ['complet', 'grimpeur'].includes(r.arch)).sort((a, b) => b.s.mon - a.s.mon)[0];
  const targetGt = S.cal.find(c => !c.done && c.key === 'gb' && (!c.inv || c.inv.includes(0)));
  for (const c of S.cal) {
    if (c.done || (c.inv && !c.inv.includes(0))) continue;
    const n = raceSize(c);
    const ok = r =>
      r.injury <= 0 &&
      !planConflict(r.id, c) &&
      plannedDays(r.id) + raceDays(c) <= cap + (c.cat === 0 ? 8 : 0) &&
      !(c.cat === 0 && targetGt && c !== targetGt && r === gcLeader);
    const cand = pros
      .filter(ok)
      .sort((a, b) => raceFit(b, c) - plannedDays(b.id) * 0.08 - (raceFit(a, c) - plannedDays(a.id) * 0.08));
    let sel = cand.slice(0, n);
    if (c === targetGt && gcLeader && !sel.includes(gcLeader) && gcLeader.injury <= 0)
      sel = [gcLeader, ...sel.slice(0, n - 1)];
    S.plan[c.key] = sel.map(r => r.id);
  }
  return `Programme établi pour ${Object.keys(S.plan).length} courses.`;
}
// Sélection d'une course à partir du planning (complétée par la proposition de l'adjoint si besoin).
function planSelection(c, fallback) {
  const n = raceSize(c);
  const used = (S.weekUsed && S.weekUsed[c.w]) || [];
  const ok = id =>
    S.riders[id] &&
    S.riders[id].team === 0 &&
    (!S.riders[id].aca || isStag(S.riders[id])) &&
    S.riders[id].injury <= 0 &&
    !used.includes(id);
  const sel = (S.plan && S.plan[c.key] ? S.plan[c.key] : []).filter(ok).slice(0, n);
  for (const id of fallback) if (sel.length < n && !sel.includes(id) && ok(id)) sel.push(id);
  return sel;
}
