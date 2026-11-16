const fs = require('fs');
require('vm').runInThisContext(fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", ''));
const seed = +(process.argv[2] || 1),
  NS = +(process.argv[3] || 3);
newGame('T', seed);
const t0 = Date.now();
for (let s = 0; s < NS; s++) {
  // joueur : recrute 2 jeunes, staff +1
  if (s === 0) {
    const y = S.youth.slice().sort((a, b) => potEst(S.riders[b]) - potEst(S.riders[a]));
    joinAcademy(y[0]);
    joinAcademy(y[1]);
    setStaff('coach', 2);
  }
  while (true) {
    const i = advanceToNextRace();
    if (i < 0) break;
    const cal = S.cal[i];
    if (cal.worlds) {
      runWorlds(i);
      continue;
    }
    const rc = startRace(i, aiSelect(S.teams[0], cal, prepareRaceSpecs(cal)), {});
    while (!rc.done) {
      const spec = rc.specs[rc.si];
      Object.assign(rc.orders, autoOrders(0, spec, rc));
      runStageAuto(rc);
    }
    const w = S.riders[cal.winner];
    if (!w) throw new Error('no winner');
    if (process.env.V) console.log(' ', cal.name.padEnd(28), riderName(w), w.arch, overall(w.s));
  }
  for (const id of S.teams[0].riders) {
    const r = S.riders[id];
    if (r.contract <= 1 && !r.nextTeam && overall(r.s) >= 66) extendRider(id, 2);
  }
  while (S.teams[0].riders.length < 12) {
    const fr = S.free
      .map(i => S.riders[i])
      .filter(r => r && !r.retired && r.nextTeam == null)
      .sort((a, b) => overall(b.s) - overall(a.s));
    if (!fr.length) break;
    const r = fr[0];
    const res = negotiate(r.id, Math.round(contractDemand(r) * 1.15), 2, false);
    if (!res.ok) {
      S.free.splice(S.free.indexOf(r.id), 1);
      S.free.push(r.id);
      r.negoBlock = 0;
      if (rnd() < 0.3) break;
    }
  }
  for (const id of S.academy.slice()) {
    const r = S.riders[id];
    if (r.age >= 19 && S.teams[0].riders.length < 16) promoteRider(id);
  }
  const P = S.teams[0];
  const objs = S.obj.map(o => (objStatus(o).ok ? 1 : 0)).join('');
  endSeason();
  const th = S.teamHist.at(-1);
  const ages = Object.values(S.riders)
    .filter(r => !r.retired && r.team !== null && r.team > 0)
    .map(r => r.age);
  const ovs = S.teams.map(T => Math.round(sum(T.riders.map(i => overall(S.riders[i].s))) / T.riders.length));
  console.log(
    `S${th.s} rank ${th.rank} uci ${th.uci} wins ${th.wins} budget ${th.budget} conf ${th.conf} obj ${objs} | roster ${P.riders.length} aca ${S.academy.length} youth ${S.youth.length} free ${S.free.length} | avgAge ${(sum(ages) / ages.length).toFixed(1)} teamOv ${ovs.join(',')} | json ${(JSON.stringify(S).length / 1024).toFixed(0)}KB`
  );
}
console.log('time', ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log(JSON.stringify(S.fin));
for (const sz of [1]) {
  const all = Object.values(S.riders).filter(r => !r.retired && r.team !== null);
  const ovs = all.map(r => overall(r.s)).sort((a, b) => b - a);
  console.log('top ov', ovs.slice(0, 10).join(','), 'p50', ovs[Math.floor(ovs.length / 2)]);
}
{
  const all = Object.values(S.riders).filter(r => !r.retired && r.team !== null && !r.aca);
  const top = all.sort((a, b) => overall(b.s) - overall(a.s)).slice(0, 20);
  console.log('top20 ages', top.map(r => r.age).join(','), 'neo in top20', top.filter(r => r.neo).length);
  const neos = all
    .filter(r => r.neo)
    .sort((a, b) => overall(b.s) - overall(a.s))
    .slice(0, 5)
    .map(r => r.age + 'a ov' + overall(r.s) + ' ceil' + r.ceil);
  console.log('best neos', neos.join(' | '));
}
