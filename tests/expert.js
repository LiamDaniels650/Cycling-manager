// Banc de difficulté : la même partie jouée par un joueur passif (consignes automatiques, aucune gestion), par
// l'adjoint (tous les domaines délégués) ou par un « joueur expert » automatisé (entraîneur en chef, tests d'effort
// et académie, staff, stages avant les grands rendez-vous, ventes au bon prix, recrutement au rapport qualité/prix).
// Sert à vérifier que l'habileté paie sans rendre le jeu trivial (ni filon d'argent).
// Usage : node tests/expert.js <passif|adjoint|expert> [graine=41] [saisons=8]
const fs = require('fs');
require('vm').runInThisContext(fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", ''));
const mode = process.argv[2] || 'expert',
  seed = +(process.argv[3] || 41),
  NS = +(process.argv[4] || 8);
newGame('T', seed);
const P = () => S.teams[0];
const out = [];
for (let s = 0; s < NS; s++) {
  if (mode !== 'passif' && s === 0) for (const k of Object.keys(AUTO_LBL)) setAuto(k, true);
  if (mode === 'expert') {
    // entraîneur en chef : le moins cher des spécialistes montagne/jeunes, sinon le premier
    const cs = coachCandidates();
    const ci = Math.max(
      0,
      cs.findIndex(c => c.k === 'montagne')
    );
    if (!S.coach || S.coach.s < S.season - 1) hireCoach(ci);
    // jeunes : tests d'effort sur les plus prometteurs, puis les deux meilleurs (vraie valeur) à l'académie
    const ys = S.youth
      .map(id => S.riders[id])
      .filter(Boolean)
      .sort((a, b) => potEst(b) - potEst(a))
      .slice(0, 5);
    for (const y of ys) effortTest(y.id);
    for (const y of ys.sort((a, b) => b.ceil - a.ceil).slice(0, 2)) joinAcademy(y.id);
    for (const k of ['coach', 'doctor', 'scout']) if (S.staff[k] < 4 && S.budget > 900) setStaff(k, S.staff[k] + 1);
  }
  while (true) {
    const i = advanceToNextRace();
    if (mode === 'expert') {
      // offres de rachat : on vend un coureur hors des trois meilleurs si l'offre est bonne
      if (S.bid) {
        const r = S.riders[S.bid.id];
        const top = P()
          .riders.map(id => S.riders[id])
          .sort((a, b) => overall(b.s) - overall(a.s))
          .slice(0, 3);
        dsBidAnswer(!top.includes(r) && S.bid.fee >= transferFee(r) ? 'contre' : 'non');
      }
      // stage en altitude dans les 3 semaines avant un grand tour ou une course majeure
      if (i >= 0) {
        const nx = S.cal.filter(
          c => !c.done && c.w - S.week >= 1 && c.w - S.week <= 3 && c.cat <= 1 && (!c.inv || c.inv.includes(0))
        );
        if (nx.length && !(S.camp && S.week <= S.camp.until) && S.budget > 300)
          campStart(nx.some(c => c.cat === 0) ? 'altitude' : 'cohesion');
      }
    }
    if (i < 0) break;
    const cal = S.cal[i];
    if (cal.worlds) {
      runWorlds(i);
      continue;
    }
    const rc = startRace(i, aiSelect(P(), cal, prepareRaceSpecs(cal)), {});
    if (mode === 'expert') rc.autoDS = true;
    while (!rc.done) {
      Object.assign(rc.orders, autoOrders(0, rc.specs[rc.si], rc));
      runStageAuto(rc);
    }
  }
  // intersaison : prolongations et recrutement
  for (const id of P().riders) {
    const r = S.riders[id];
    if (r.contract <= 1 && !r.nextTeam && overall(r.s) >= 66) extendRider(id, 2);
  }
  const target = mode === 'expert' ? 16 : 12;
  let guard = 0;
  while (P().riders.length < target && guard++ < 30) {
    const fr = S.free
      .map(i => S.riders[i])
      .filter(r => r && !r.retired && r.nextTeam == null && !(r.negoBlock > S.week + S.season * 100))
      .sort((a, b) =>
        mode === 'expert'
          ? overall(b.s) / Math.max(20, contractDemand(b)) - overall(a.s) / Math.max(20, contractDemand(a))
          : overall(b.s) - overall(a.s)
      );
    const r = mode === 'expert' ? fr.find(r => overall(r.s) >= 68) || fr[0] : fr[0];
    if (!r) break;
    negotiate(r.id, Math.round(contractDemand(r) * 1.15), 2, false);
  }
  for (const id of S.academy.slice()) {
    const r = S.riders[id];
    if (r.age >= 19 && P().riders.length < 16) promoteRider(id);
  }
  const objs = S.obj.map(o => (objStatus(o).ok ? 1 : 0)).join('');
  endSeason();
  const th = S.teamHist.at(-1);
  out.push(th.rank);
  console.log(
    `${mode} seed ${seed} S${th.s} rank ${th.rank} uci ${th.uci} wins ${th.wins} budget ${th.budget} conf ${th.conf} obj ${objs} roster ${P().riders.length}`
  );
}
console.log(`${mode} seed ${seed} RANKS ${out.join(',')}`);
