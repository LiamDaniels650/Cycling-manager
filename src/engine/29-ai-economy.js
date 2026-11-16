/* Économie des équipes IA : chaque équipe a un budget de masse salariale qui suit son standing.
   Le standing (tier) évolue lentement avec le classement UCI : une équipe qui gagne attire des sponsors,
   recrute mieux et grandit ; une équipe qui décline doit se séparer de ses coureurs les plus chers.
   Les signatures, prolongations et transferts des IA sont limités par ce budget. */

// Budget annuel de masse salariale (k€) selon le standing.
function aiBudgetFor(tier) {
  return Math.round(2500 + 760 * (tier + 4.2));
}
function payrollOf(T) {
  return sum(T.riders.map(id => (S.riders[id] ? S.riders[id].salary : 0)));
}
// L'équipe peut-elle ajouter (ou augmenter) un salaire de ce montant ?
function aiCanAfford(T, extra) {
  if (T.player) return true;
  if (T.budget == null) T.budget = aiBudgetFor(T.tier);
  return payrollOf(T) + extra <= T.budget;
}
function initAiBudgets() {
  for (const T of S.teams) if (!T.player && T.budget == null) T.budget = aiBudgetFor(T.tier);
}
// Fin de saison : le standing glisse vers celui que mérite le classement, le budget suit.
// Les équipes au-dessus de leurs moyens se séparent de leurs coureurs les moins rentables.
function aiEconomyEndSeason(ranking) {
  const tiers = TIERS.slice().sort((a, b) => b - a);
  const ai = ranking.filter(T => !T.player);
  ai.forEach((T, k) => {
    const deserved = tiers[Math.min(k, tiers.length - 1)];
    T.tier = Math.round((T.tier * 0.8 + deserved * 0.2) * 100) / 100;
    T.budget = aiBudgetFor(T.tier);
  });
  for (const T of ai) {
    let guard = 0;
    while (payrollOf(T) > T.budget * 1.05 && T.riders.length > ROSTER.minAI && guard++ < 10) {
      // le coureur le moins rentable : salaire élevé pour son niveau
      const r = T.riders
        .map(id => S.riders[id])
        .filter(q => !q.nextTeam)
        .sort((a, b) => b.salary / Math.max(1, overall(b.s) - 55) - a.salary / Math.max(1, overall(a.s) - 55))[0];
      if (!r) break;
      T.riders.splice(T.riders.indexOf(r.id), 1);
      mercLog(r, 'libere', T.id, null);
      r.team = null;
      r.contract = 0;
      S.free.push(r.id);
    }
  }
}
