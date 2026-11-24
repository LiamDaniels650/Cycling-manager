/* Négociations : agents, coureurs courtisés, clauses, contre-propositions.
   - agent du coureur (lu dans son identité) : requin (demande plus, veut une clause libératoire), conciliant (fait
     volontiers une contre-proposition raisonnable), agent de carrière (tient au rôle promis et à votre parole) ; les
     plus jeunes négocient en famille ;
   - coureurs cotés libres ou en fin de contrat courtisés par d'autres équipes : il faut convaincre davantage ;
   - clauses : prime de victoire (payée à chaque succès), rôle garanti sur une course (une promesse, cf. 60-locker.js),
     clause libératoire (une équipe riche peut le racheter en fin de saison pour ce montant) ;
   - refus : l'agent répond souvent par une contre-proposition (trois tours au plus) avant de claquer la porte.
   Ces règles ne s'appliquent qu'aux offres faites par vous (l'adjoint négocie comme avant). */

const AGENTS = {
  famille: { lbl: 'Négocie en famille', d: 'Pas d’agent : simple et peu exigeant.' },
  requin: { lbl: 'Agent requin', d: 'Demande plus, exige souvent une clause libératoire et des primes.' },
  conciliant: { lbl: 'Agent conciliant', d: 'Fait volontiers une contre-proposition raisonnable.' },
  carriere: { lbl: 'Agent de carrière', d: 'Tient au rôle promis et à la parole du club.' },
};
function agentOf(r) {
  if (r.age <= 21) return 'famille';
  const h = dsHash('agent' + r.id) % 10;
  return h < 3 ? 'requin' : h < 7 ? 'conciliant' : 'carriere';
}
function agentDemMul(r) {
  return { requin: 1.08, conciliant: 0.97, famille: 0.95 }[agentOf(r)] || 1;
}
// Équipes de l'ordinateur qui courtisent aussi un coureur coté (libre ou en fin de contrat).
function suitorsOf(r) {
  const kind = marketKind(r);
  if ((kind !== 'free' && kind !== 'pre') || overall(r.s) < 73) return [];
  const n = (dsHash('cour' + r.id + ':' + S.season) % 3) + (overall(r.s) >= 78 ? 1 : 0);
  return S.teams
    .filter(T => !T.player && T.id !== r.team && aiCanAfford(T, contractDemand(r)))
    .sort((a, b) => (dsHash(a.name + r.id) % 97) - (dsHash(b.name + r.id) % 97))
    .slice(0, n);
}
// Victoires attendues sur une saison (pour estimer ce que vaut une prime de victoire).
function expWins(r) {
  const ov = overall(r.s);
  return ov >= 80 ? 5 : ov >= 77 ? 3 : ov >= 74 ? 2 : ov >= 70 ? 1 : 0.4;
}
// Montant d'une clause libératoire (proposé par défaut).
function releaseAmount(r, salary) {
  return Math.round((salary * 2.5 + Math.max(0, overall(r.s) - 70) * 30) / 5) * 5;
}
// Ce que les clauses et le contexte ajoutent à la chance d'accord.
function negoExtras(r, cl, add) {
  const ag = agentOf(r);
  const dem = contractDemand(r);
  if (cl.bonus > 0)
    add('Prime de victoire', Math.min(0.12, ((cl.bonus * expWins(r)) / dem) * 2.5) * (ag === 'requin' ? 1.3 : 1));
  if (cl.role && r.amb > 45) add('Rôle garanti', 0.12 + (ag === 'carriere' ? 0.06 : 0));
  if (cl.release) add('Clause libératoire', ag === 'requin' ? 0.12 : 0.06);
  const su = suitorsOf(r).length;
  if (su) add(`Courtisé par ${su} autre${su > 1 ? 's' : ''} équipe${su > 1 ? 's' : ''}`, -0.05 * su);
  const tr = ((trustOf() - LOCK.trust0) / 400) * (ag === 'carriere' ? 2 : 1);
  if (Math.abs(tr) >= 0.01) add('Votre parole (confiance du vestiaire)', tr);
}
// Contre-proposition de l'agent après un refus (le salaire demandé, la durée qu'il préfère, ses clauses).
function negoCounter(r, salary, years, promise, cl, p) {
  const C = S.negoC && S.negoC.id === r.id && S.negoC.s === S.season ? S.negoC : null;
  const round = C ? C.round + 1 : 1;
  if (p < 0.15 || round > 3) return null;
  const ag = agentOf(r);
  const pf = 1.08 - teamRank() * 0.02;
  const dem = contractDemand(r) * agentDemMul(r);
  const su = suitorsOf(r).length;
  const ask =
    Math.round((dem * (ag === 'requin' ? 1.12 : ag === 'conciliant' ? 1.0 : 1.05) * (1 + 0.03 * su)) / pf / 5) * 5;
  const nextRace = r.goal && r.goal.race && !S.cal.find(c => c.key === r.goal.race).done ? r.goal.race : null;
  const want = {
    bonus: ag === 'requin' ? Math.max(cl.bonus || 0, 10) : cl.bonus || 0,
    role: cl.role || (ag === 'carriere' && r.amb > 55 && marketKind(r) !== 'pre' ? nextRace : null),
    release: ag === 'requin' || !!cl.release,
  };
  S.negoC = {
    id: r.id,
    s: S.season,
    round,
    sal: Math.max(ask, salary),
    years: r.age >= 30 ? Math.max(years, 2) : r.age <= 24 ? Math.max(years, 2) : years,
    promise,
    cl: want,
  };
  return S.negoC;
}
function counterText(r, C) {
  const c = C.cl.role ? S.cal.find(x => x.key === C.cl.role) : null;
  const bits = [`${fmtMoney(C.sal)}/an sur ${C.years} an${C.years > 1 ? 's' : ''}`];
  if (C.cl.bonus) bits.push(`prime de ${fmtMoney(C.cl.bonus)} par victoire`);
  if (c) bits.push(`rôle de leader garanti à ${c.name}`);
  if (C.cl.release) bits.push(`clause libératoire de ${fmtMoney(releaseAmount(r, C.sal))}`);
  return `${AGENTS[agentOf(r)].lbl} : « ${bits.join(', ')}. » (tour ${C.round}/3)`;
}
// Accepter la contre-proposition : le coureur signe.
function acceptCounter() {
  const C = S.negoC;
  if (!C || C.s !== S.season) return { ok: false, txt: 'Plus de contre-proposition en cours.' };
  S.negoC = null;
  return negotiate(C.id, C.sal, C.years, C.promise, C.cl, true);
}
function declineCounter() {
  const C = S.negoC;
  S.negoC = null;
  if (!C) return '';
  const r = S.riders[C.id];
  r.negoBlock = S.week + S.season * 100 + 3;
  return `${riderName(r)} et son agent mettent fin aux discussions pour quelques semaines.`;
}
// Après la signature : clauses du contrat.
function applyClauses(r, salary, cl) {
  if (!cl) return '';
  r.cl = { bonus: cl.bonus || 0, release: cl.release ? releaseAmount(r, salary) : 0 };
  let t = '';
  if (cl.role && r.team === 0) t = ' ' + promiseRole(r.id, cl.role, true);
  return t;
}
// Primes de victoire payées après chaque course.
function clausesAfterRace(rc) {
  const wins = {};
  const multi = rc.specs.length > 1;
  if (multi) for (const st of rc.stageRes) if (st.res[0]) wins[st.res[0].id] = (wins[st.res[0].id] || 0) + 1;
  const w = gcList(rc)[0];
  if (w != null) wins[w] = (wins[w] || 0) + 1;
  let paid = 0;
  const who = [];
  for (const id in wins) {
    const r = S.riders[id];
    if (!r || r.team !== 0 || !r.cl || !r.cl.bonus) continue;
    const v = r.cl.bonus * wins[id];
    paid += v;
    who.push(`${riderName(r)} ${fmtMoney(v)}`);
  }
  if (!paid) return;
  S.budget -= paid;
  finAdd('other', -paid);
  msg('💶 Primes de victoire', `Primes versées selon les contrats : ${who.join(', ')}.`);
}
// Fin de saison : une équipe riche peut lever la clause libératoire d'un de vos coureurs cotés.
function releaseClausesEndSeason() {
  if (S.car) return;
  const P = S.teams[0];
  for (const id of P.riders.slice()) {
    const r = S.riders[id];
    if (!r.cl || !r.cl.release || overall(r.s) < 74 || r.contract < 1 || P.riders.length <= ROSTER.minPlayer) continue;
    if (dsHash('lib' + id + ':' + S.season) % 100 >= 35) continue;
    const T = S.teams
      .filter(U => !U.player && aiCanAfford(U, r.salary * 1.15) && U.riders.length < ROSTER.max)
      .sort((a, b) => b.tier - a.tier || (b.budget || 0) - (a.budget || 0))[0];
    if (!T) continue;
    friendLeaves(id);
    P.riders.splice(P.riders.indexOf(id), 1);
    T.riders.push(id);
    mercLog(r, 'transfert', 0, T.id);
    r.team = T.id;
    r.salary = Math.round((r.salary * 1.15) / 5) * 5;
    r.training = 'normal';
    S.budget += r.cl.release;
    finAdd('transf', r.cl.release);
    const amt = r.cl.release;
    r.cl = null;
    if (S.captain === id) S.captain = null;
    press(
      `${T.name} lève la clause de ${riderName(r)}`,
      `${T.name} paie la clause libératoire (${fmtMoney(amt)}) : ${riderName(r)} quitte ${P.name}.`,
      0,
      [id]
    );
    msg('🔓 Clause libératoire levée', `${T.name} a payé ${fmtMoney(amt)} pour ${riderName(r)}, qui s'en va.`);
  }
}
