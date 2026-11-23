/* Fraîcheur mentale sur la saison. À côté de la fatigue physique, chaque coureur a une fraîcheur mentale (r.mf,
   0 à 100) : enchaîner les jours de course l'use, plus encore les grands rendez-vous et le rôle de leader (la
   pression) ; une victoire libère, un abandon pèse ; chaque semaine apporte un peu de récupération, une semaine de
   repos ou une coupure beaucoup plus. Effet : un coureur usé perd un peu de forme du jour (jusqu’à -3 points) et
   devient plus irrégulier (il manque de lucidité) ; un coureur frais en gagne un peu (+1). Les équipes de
   l'ordinateur ménagent leurs coureurs usés. Le directeur sportif peut offrir une coupure de deux semaines.
   Centré sur le peloton : à fraîcheur moyenne, aucun effet. */

const MF_START = 90;
function mfOf(r) {
  return r.mf == null ? MF_START : r.mf;
}
function addMf(r, v) {
  r.mf = clamp(mfOf(r) + v, 0, 100);
}
// Effet sur la forme du jour (décalage moyen + irrégularité quand il est usé).
function mfForm(r) {
  const m = mfOf(r);
  return (m - 75) * 0.04 + (m < 50 ? gauss() * ((50 - m) / 25) : 0);
}
function mfLabel(m) {
  return m >= 80 ? 'Frais' : m >= 60 ? 'Correct' : m >= 40 ? 'Entamé' : m >= 20 ? 'Usé' : 'À bout';
}
// Fin de course : l'usure des jours de course, la pression, et les résultats.
function mfAfterRace(rc, gcl) {
  const big = typeof bigRace === 'function' && bigRace(rc);
  const days = rc.specs.length;
  for (const T of S.teams)
    for (const id of rc.sel[T.id] || []) {
      const r = S.riders[id];
      if (!r) continue;
      const o = rc.orders[id];
      const lead = o && (o.o === 'leader' || o.o === 'sprint');
      addMf(r, -days * 0.85 * (big ? 1.4 : 1) * (lead ? 1.25 : 1));
      if (rc.out[id]) addMf(r, -3);
    }
  if (gcl[0] != null) addMf(S.riders[gcl[0]], 6);
  for (const id of gcl.slice(1, 3)) addMf(S.riders[id], 2);
  // les victoires d'étape libèrent aussi
  if (days > 1) for (const st of rc.stageRes) if (st.res[0] && S.riders[st.res[0].id]) addMf(S.riders[st.res[0].id], 2);
}
// Semaine : récupération (plus en semaine de repos ou en coupure).
function mfWeekly(r, pl) {
  if (r.retired || r.team == null) return;
  const rest = pl === 'repos' || (r.brk && r.brk > S.week);
  addMf(r, 0.6 + (rest ? 3 : 0) + (r.wkDays ? 0 : 0.5));
}
function mfEndSeason(r) {
  addMf(r, 40);
}
// Coupure de deux semaines (mon équipe) : le coureur n'est pas sélectionnable, sa fraîcheur remonte fortement.
function mfBreak(id) {
  const r = S.riders[id];
  if (!r || r.team !== 0) return 'Coureur inconnu.';
  if (r.brk && r.brk > S.week) return `${riderName(r)} est déjà en coupure.`;
  r.brk = S.week + 2;
  addMf(r, 12);
  return `🌴 ${riderName(r)} part deux semaines en coupure : il ne court pas, et revient l'esprit frais.`;
}
function mfInBreak(r) {
  return !!(r.brk && r.brk > S.week);
}
// Mes coureurs les plus usés (pour l'accueil).
function mfTired() {
  return S.teams[0].riders
    .map(id => S.riders[id])
    .filter(r => r && mfOf(r) < 35 && !mfInBreak(r));
}
