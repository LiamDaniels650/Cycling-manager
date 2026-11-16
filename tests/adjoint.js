// Banc de l'adjoint : partie entièrement déléguée (adjoint sur tous les domaines, courses dirigées par lui),
// comparée aux trois équipes IA de standing le plus proche. Usage : node tests/adjoint.js [saisons=8] [graine=11]
// (D=difficile pour une autre difficulté, Q=1 pour le seul bilan ; ≈ 1 min 15 par saison)
const fs = require('fs');
require('vm').runInThisContext(fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", ''));
const N = +process.argv[2] || 10,
  seed = +process.argv[3] || 11,
  quiet = process.env.Q;
newGame('B', seed, process.env.D || undefined);
for (const k of Object.keys(AUTO_LBL)) setAuto(k, true);
const ov = id => overall(S.riders[id].s);
const top = T =>
  T.riders
    .map(ov)
    .sort((a, b) => b - a)
    .slice(0, 8)
    .reduce((a, b) => a + b, 0) / 8;
const rows = [];
for (let s = 0; s < N; s++) {
  for (let i = advanceToNextRace(); i >= 0; i = advanceToNextRace()) {
    const c = S.cal[i];
    if (c.worlds) {
      runWorlds(i);
      continue;
    }
    if (!c.inv || c.inv.includes(0)) runDelegatedRace(i);
    else simulateRaceAuto(i);
  }
  // offres d'emploi, licenciement : on reste
  const rk = uciRanking();
  const me = rk.indexOf(S.teams[0]) + 1;
  const near = S.teams
    .filter(T => !T.player)
    .sort((a, b) => Math.abs(a.tier + 0.8) - Math.abs(b.tier + 0.8))
    .slice(0, 3);
  const r = {
    s: S.season,
    rang: me,
    uci: S.teams[0].uci || 0,
    budget: Math.round(S.budget),
    eff: S.teams[0].riders.length,
    top8: top(S.teams[0]).toFixed(1),
    top8IA: (near.reduce((a, T) => a + top(T), 0) / 3).toFixed(1),
    rangIA: (near.reduce((a, T) => a + rk.indexOf(T) + 1, 0) / 3).toFixed(1),
    masse: sum(S.teams[0].riders.map(id => S.riders[id].salary)),
    conf: S.conf,
    spons: S.spons.base,
    wt: isWT(0) ? 'WT' : 'Pro',
    vict: seasonWins(0),
  };
  rows.push(r);
  if (!quiet) console.log(JSON.stringify(r));
  endSeason();
  if (S.fired) {
    if (!quiet) console.log('LICENCIÉ');
    r.fired = 1;
    S.fired = false;
  }
}
const m = k => (rows.reduce((a, r) => a + +r[k], 0) / rows.length).toFixed(1);
console.log(
  'BILAN graine',
  seed,
  'rang moy',
  m('rang'),
  'rang IA voisines',
  m('rangIA'),
  'top8',
  m('top8'),
  'top8 IA',
  m('top8IA'),
  'budget fin',
  rows[rows.length - 1].budget,
  'licenciements',
  rows.filter(r => r.fired).length
);
