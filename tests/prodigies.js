// Jeunes talents sur plusieurs saisons (monde entièrement simulé) : combien de moins de 23 ans dans le top 20,
// niveau des meilleurs à 19-22 ans, plafond des meilleurs du peloton. Réel : 2 à 5 coureurs de 23 ans et moins
// dans le top 20 mondial, un prodige de 20-21 ans parmi les tout meilleurs de temps en temps, jamais de « dieu ».
// Usage : node tests/prodigies.js [graine=3] [saisons=9]   (environ 15 s par saison)
const fs = require('fs');
require('vm').runInThisContext(fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", ''));
const seed = +process.argv[2] || 3,
  NS = +process.argv[3] || 8;
newGame('T', seed);
const rows = [];
let u23s = [],
  tops = [];
for (let s = 0; s < NS; s++) {
  for (let i = advanceToNextRace(); i >= 0; i = advanceToNextRace()) {
    const cal = S.cal[i];
    if (cal.worlds) {
      runWorlds(i);
      continue;
    }
    simulateRaceAuto(i);
  }
  const pros = Object.values(S.riders).filter(r => r.team !== null && !r.retired && !r.aca);
  const top = pros.slice().sort((a, b) => overall(b.s) - overall(a.s));
  const t20 = top.slice(0, 20);
  const u23 = t20.filter(r => r.age <= 23);
  const bestAge = a => {
    const x = pros.filter(r => r.age === a).sort((p, q) => overall(q.s) - overall(p.s))[0];
    return x ? overall(x.s) : 0;
  };
  // wins leaders young
  const winsY = pros.filter(r => r.age <= 22).sort((a, b) => b.stats.wins - a.stats.wins)[0];
  console.log(
    S.season,
    'top1',
    overall(top[0].s),
    'top20min',
    overall(t20[19].s),
    'u23 in top20:',
    u23.length,
    u23.map(r => r.age + 'a' + overall(r.s)).join(','),
    '| best ov age 19-22:',
    [19, 20, 21, 22].map(bestAge).join('/'),
    '| youth ceil>=86:',
    Object.values(S.riders).filter(r => (r.youth || r.aca) && r.ceil >= 86).length,
    '| best young wins',
    winsY ? winsY.stats.wins + ' (' + winsY.age + 'a)' : '-'
  );
  if (s >= 3) {
    u23s.push(u23.length);
    tops.push(overall(top[0].s));
  }
  endSeason();
}
const m = u23s.reduce((a, b) => a + b, 0) / Math.max(1, u23s.length);
const ok = m >= 1.5 && m <= 6 && Math.max(...tops) <= 90;
console.log(
  `moyenne U23 dans le top 20 (saisons 4+) : ${m.toFixed(1)} (réel 2-5) ; meilleur niveau : ${Math.max(...tops)} (max 90)`,
  ok ? '✔' : '✖'
);
process.exit(ok ? 0 : 1);
