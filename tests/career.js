// Mode carrière : une carrière jouée sans interface, de 16 ans à n ans (décisions par défaut, courses simulées),
// avec des vérifications (progression plausible, passage espoir, stage, contrat pro, monde cohérent).
// Usage : node tests/career.js [saisons=8] [graine=42]      (≈ 30 s par saison)
const fs = require('fs');
require('vm').runInThisContext(fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", ''));
const NS = +(process.argv[2] || 8),
  seed = +(process.argv[3] || 42);
let fails = 0;
const check = (ok, txt) => {
  if (!ok) fails++;
  console.log((ok ? '✔ ' : '✖ ') + txt);
};
carNewGame({
  fn: 'Test',
  ln: 'Carrière',
  nat: 'FRA',
  arch: 'complet',
  gab: 'moyen',
  dreams: ['pro', 'gb'],
  studies: 'sport',
  seed,
});
const me = carMe();
check(
  me && me.age === 16 && S.car.pool.length === 3 * CAR_POOL_N,
  'création : 16 ans, génération de trois classes d’âge'
);
function week() {
  for (const i of S.cal.map((c, i) => i).filter(i => !S.cal[i].done && S.cal[i].w <= S.week)) {
    const c = S.cal[i];
    if (carProThisWeek() === i) carProSim(i);
    else if (c.worlds) runWorlds(i);
    else if (c.inv && c.inv.includes(0)) runDelegatedRace(i);
    else simulateRaceAuto(i);
  }
  const d = carRaceThisWeek();
  if (d && !S.car.raced[carRaceKey(d)] && carMe().injury <= 0 && !carSimRace(d)) carNotSelected(d);
  weeklyUpdate();
  carWeekly();
}
const t0 = Date.now();
const rows = [];
for (let s = 0; s < NS; s++) {
  while (S.week < LAST_WEEK || !S.cal.every(c => c.done)) week();
  carEndSeason();
  endSeason();
  carNewSeason();
  // décisions : on prend l'option par défaut tout de suite (comme un joueur pressé)
  for (const a of S.car.asks.slice()) carAnswer(a.key, a.def);
  const x = S.car.seasons[S.car.seasons.length - 1];
  rows.push(x);
  console.log(
    `${x.s} · ${x.age} ans · niveau ${x.ov} (${x.dov >= 0 ? '+' : ''}${x.dov}) · ${x.races} courses, ${x.wins} v., ${x.pod} pod. · ${x.team} · ${S.car.kind}${S.car.agent ? ' · agent ' + S.car.agent.kind : ''}`
  );
}
const m = carMe();
check(
  rows.every(x => x.races >= 3 || x.age >= 23),
  'chaque saison compte des courses'
);
check(
  rows.every(x => x.dov <= 9),
  'progression plausible (jamais plus de 9 points en une saison)'
);
check(
  S.car.u23.length > 60 && S.car.pool.length === 3 * CAR_POOL_N,
  `génération entretenue (${S.car.pool.length} jeunes, ${S.car.u23.length} espoirs)`
);
const gen = S.car.alumni.map(id => S.riders[id]).filter(r => r && r.team != null && !r.retired);
if (NS >= 6) check(gen.length >= 10, `des coureurs de la génération sont passés pros (${gen.length})`);
if (m.age >= 23)
  check(
    S.car.kind === 'pro' && m.team != null && teamById(m.team).riders.includes(m.id),
    `le joueur est professionnel à ${m.age} ans (${S.car.club})`
  );
check(
  S.teams.every(T => T.riders.every(id => S.riders[id] && S.riders[id].team === T.id)),
  'monde cohérent (équipes et coureurs)'
);
check(!Object.values(S.riders).some(r => r.filler), 'aucun coureur de passage oublié');
console.log(
  `${Math.round((Date.now() - t0) / 1000)} s · ${Object.keys(S.riders).length} coureurs · ${fails ? fails + ' échec(s)' : 'tout est bon'}`
);
process.exit(fails ? 1 : 0);
