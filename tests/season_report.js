const fs = require('fs');
require('vm').runInThisContext(fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", ''));
newGame('Test', +(process.argv[2] || 42));
const only = process.argv[3];
let races = 0;
while (true) {
  const i = advanceToNextRace();
  if (i < 0) break;
  const cal = S.cal[i];
  if (only && cal.key !== only) {
    cal.done = true;
    continue;
  }
  if (cal.worlds) {
    const rw = runWorlds(i);
    console.log('\n=== ' + rw.name + ' === ' + riderName(S.riders[rw.stageRes[0].res[0].id]));
    continue;
  }
  const sel = aiSelect(S.teams[0], cal, prepareRaceSpecs(cal));
  const rc = startRace(i, sel, {});
  console.log('\n=== ' + rc.name + ' ===');
  while (!rc.done) {
    const spec = rc.specs[rc.si];
    Object.assign(rc.orders, autoOrders(0, spec, rc));
    if (isITT(spec) || isTTT(spec)) {
      const out = runStageAuto(rc);
      console.log(
        spec.name,
        '| 1.',
        riderName(S.riders[out[0].id]),
        fmtTime(out[0].time),
        '| 10e',
        fmtGap(out[9].time - out[0].time)
      );
      continue;
    }
    const sim = newStageSim(rc);
    if (process.env.AUTO) sim.autoDS = true;
    let ticks = 0;
    const snaps = [];
    while (!sim.done && ticks < 2000) {
      simTick(sim);
      ticks++;
      if (ticks % 60 === 0)
        snaps.push(
          `${sim.groups[0].pos.toFixed(0)}km:` +
            sim.groups
              .slice(0, 5)
              .map(G => G.riders.length + '(' + fmtGap(gapSec(sim.groups[0], G)) + ')')
              .join(' ') +
            ` E=${Math.round(sum(sim.runners.map(x => x.energy)) / sim.runners.length)}`
        );
    }
    const st = rc.stageRes[rc.stageRes.length - 1];
    const top = st.res
      .slice(0, 5)
      .map(e => {
        const r = S.riders[e.id];
        return riderName(r) + '[' + r.arch.slice(0, 4) + ']' + fmtGap(e.gap);
      })
      .join(', ');
    const groupsAtEnd = new Set(st.res.map(e => Math.round(e.gap / 5))).size;
    console.log(
      spec.name,
      '| t=',
      fmtTime(st.res[0].time),
      'avg',
      (spec.dist / (st.res[0].time / 3600)).toFixed(1),
      'km/h | ticks',
      ticks,
      '| last',
      fmtGap(st.res[st.res.length - 1].gap),
      '| DNF',
      sim.runners.filter(x => x.dnf).length
    );
    console.log('  ', top);
    if (process.env.V) snaps.forEach(s => console.log('    ' + s));
    if (process.env.L) sim.log.forEach(l => console.log('     [' + l.km.toFixed(0) + '] ' + l.txt));
  }
  const g = gcList(rc)
    .slice(0, 5)
    .map(
      id =>
        riderName(S.riders[id]) + '[' + S.riders[id].arch.slice(0, 4) + '] ' + fmtGap(rc.gc[id] - rc.gc[gcList(rc)[0]])
    );
  console.log(' GC:', g.join(', '));
  races++;
}
endSeason();
console.log(
  '\nseason ok, budget',
  S.budget.toFixed(0),
  'riders',
  Object.keys(S.riders).length,
  'json',
  JSON.stringify(S).length
);
