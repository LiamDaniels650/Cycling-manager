/* Mercato : journal des mouvements de coureurs (transferts, signatures, départs, retraites) et rumeurs de presse.
   Le choix de la rumeur n'utilise pas le hasard de la partie ; une rumeur a ensuite de vraies chances de se
   confirmer en fin de saison (voir rumorMove et le pré-contrat des coureurs du joueur). */
const MERC_KIND = {
  transfert: '🔁 Transfert',
  pre: '✍️ Pré-contrat',
  signe: '🖊️ Signature',
  libere: '🚪 Libéré',
  retraite: '👋 Retraite',
  neo: '🌱 Néo-pro',
  rumeur: '💬 Rumeur',
};
function teamShort(id) {
  if (id === null || id === undefined) return 'libre';
  const T = teamById(id);
  return T ? T.short : '?';
}
// Coureur « en vue » : populaire, victoire au palmarès ou bonne saison au classement UCI (informations publiques).
function mercNotable(r) {
  const last = r.career && r.career.length ? r.career[r.career.length - 1].u : 0;
  return (r.pop || 0) >= 55 || (r.palm || []).some(p => p.k === 1) || (r.stats && r.stats.pts >= 250) || last >= 300;
}
function mercLog(r, k, from, to) {
  if (!r) return;
  S.merc = S.merc || [];
  S.merc.unshift({
    s: S.season,
    w: S.week,
    id: r.id,
    n: riderName(r),
    k,
    f: teamShort(from),
    t: k === 'retraite' ? '—' : teamShort(to),
    my: from === 0 || to === 0,
    imp: from === 0 || to === 0 || mercNotable(r),
  });
  if (S.merc.length > 250) S.merc.length = 250;
}
// Hachage déterministe (saison, semaine, sel) : la rumeur de la semaine ne consomme pas le hasard de la partie.
function mercHash(salt) {
  let h = (S.season * 1009 + S.week * 97 + salt * 7919) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return Math.abs(h ^ (h >>> 15));
}
// Rumeurs de la presse (semaines 20 à 40, environ une semaine sur deux) : un coureur en vue en fin de contrat
// intéresserait une équipe plus huppée. Elles concernent aussi vos coureurs : prolongez-les à temps.
function mercWeekly() {
  if (S.week < 20 || S.week > 40 || mercHash(1) % 2) return;
  const cands = Object.values(S.riders)
    .filter(r => !r.retired && r.team !== null && !r.aca && !r.car && r.contract === 1 && !r.nextTeam && mercNotable(r))
    .sort((a, b) => a.id - b.id);
  if (!cands.length) return;
  const r = cands[mercHash(2) % cands.length];
  const own = teamById(r.team);
  const suitors = S.teams.filter(t => !t.player && t !== own && (t.tier || 0) >= ((own && own.tier) || 0));
  if (!suitors.length) return;
  const T = suitors[mercHash(3) % suitors.length];
  mercLog(r, 'rumeur', r.team, T.id);
  r.rumor = { t: T.id, s: S.season };
  if (r.team === 0)
    msg(
      '💬 Rumeur de transfert',
      `La presse affirme que <b>${T.name}</b> s'intéresse à ${riderName(r)}, en fin de contrat. Une prolongation éviterait un départ.`
    );
}
// Équipe intéressée par un coureur selon la rumeur de la saison (ou null).
function rumorTeam(r) {
  if (!r.rumor || r.rumor.s !== S.season) return null;
  return S.teams.find(t => t.id === r.rumor.t && !t.player) || null;
}
// Fin de contrat d'un coureur IA visé par une rumeur : 60 % de chances qu'il rejoigne l'équipe citée.
function rumorMove(r, T) {
  const RT = rumorTeam(r);
  if (
    !RT ||
    RT === T ||
    RT.riders.length >= ROSTER.max ||
    !aiCanAfford(RT, Math.round(salaryFor(overall(r.s), r.age) * 1.1)) ||
    rnd() >= 0.6
  )
    return false;
  T.riders.splice(T.riders.indexOf(r.id), 1);
  mercLog(r, 'transfert', T.id, RT.id);
  r.team = RT.id;
  RT.riders.push(r.id);
  r.contract = rint(1, 3);
  r.salary = Math.round((salaryFor(overall(r.s), r.age) * 1.1) / 5) * 5;
  press(
    `La rumeur se confirme : ${riderName(r)} chez ${RT.name}`,
    `Annoncé depuis des semaines, ${riderName(r)} quitte ${T.name} pour ${RT.name}.`,
    0,
    [r.id]
  );
  return true;
}
// Suivi hebdomadaire des points UCI de chaque équipe (saison en cours), pour la page des rivaux.
// final = true : dernier relevé de la saison (remplace celui de la même semaine).
function uciTrack(final) {
  if (!S.uciTrack || S.uciTrack.s !== S.season) {
    if (S.uciTrack && S.uciTrack.w.length) S.uciPrev = S.uciTrack;
    S.uciTrack = { s: S.season, w: [], t: {} };
  }
  const U = S.uciTrack;
  if (U.w[U.w.length - 1] === S.week) {
    if (!final) return;
    U.w.pop();
    for (const id in U.t) U.t[id].pop();
  }
  U.w.push(S.week);
  for (const T of S.teams) {
    const a = (U.t[T.id] = U.t[T.id] || []);
    while (a.length < U.w.length - 1) a.push(0); // équipe arrivée en cours de saison
    a.push(T.uci || 0);
  }
}
// Mercato entre équipes IA : les équipes fortes recrutent les meilleurs éléments des équipes plus faibles.
function aiTransfers(maxMoves = 5, p = 0.4) {
  const ai = S.teams.filter(T => !T.player).sort((a, b) => b.tier - a.tier);
  let moves = 0;
  for (const T of ai) {
    if (moves >= maxMoves) break;
    if (rnd() > p) continue;
    const bar = T.riders.map(id => overall(S.riders[id].s)).sort((a, b) => b - a)[5] || 0;
    const cands = [];
    for (const U of ai) {
      if (U === T || U.tier >= T.tier || U.riders.length <= ROSTER.minAI) continue;
      const rs = U.riders.map(id => S.riders[id]).sort((a, b) => overall(b.s) - overall(a.s));
      for (const r of rs.slice(1, 4))
        if (
          overall(r.s) > bar + 1 &&
          r.age <= 31 &&
          !r.car &&
          !r.nextTeam &&
          aiCanAfford(T, Math.round(salaryFor(overall(r.s), r.age) * 1.1))
        )
          cands.push([r, U]);
    }
    if (!cands.length) continue;
    const [r, U] = cands.sort((a, b) => overall(b[0].s) + aiWant(T, b[0]) - (overall(a[0].s) + aiWant(T, a[0])))[0];
    U.riders.splice(U.riders.indexOf(r.id), 1);
    T.riders.push(r.id);
    mercLog(r, 'transfert', U.id, T.id);
    r.team = T.id;
    r.contract = rint(2, 3);
    r.salary = Math.round((salaryFor(overall(r.s), r.age) * 1.1) / 5) * 5;
    moves++;
    press(
      `Transfert : ${riderName(r)} rejoint ${T.name}`,
      `${riderName(r)} quitte ${U.name} pour ${T.name} (${r.contract} ans).`,
      0,
      [r.id]
    );
    // effectif trop large : le moins bon part sur le marché
    if (T.riders.length > Math.min(ROSTER.max, aiTarget(T) + 2)) {
      const worst = T.riders.map(id => S.riders[id]).sort((a, b) => overall(a.s) - overall(b.s))[0];
      T.riders.splice(T.riders.indexOf(worst.id), 1);
      mercLog(worst, 'libere', T.id, null);
      worst.team = null;
      S.free.push(worst.id);
    }
  }
}
