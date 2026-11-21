// Ordres de final : bancs d'essai rapides (graine fixe) sur le sprint simulé (sprintRun) et la fin de montée simulée
// (climbRun). Vérifie que chaque ordre garde son sens et qu'aucun réglage futur ne le rend perdant sans qu'on le voie :
//   sprint : lancer long paie pour un endurant par vent de dos, attendre paie par vent de face, un train de deux
//            poissons-pilotes aide son sprinteur, le conseil de l'adjoint (sprintAdvice) ne fait pas pire que l'instinct ;
//   côte   : « attendre la fin » ne fait pas pire que l'instinct pour un puncheur, « suivre » ne fait pas pire pour un
//            prétendant proche du plus fort.
// Usage : node tests/finals.js   (≈ 30 s)
const fs = require('fs');
require('vm').runInThisContext(fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", ''));
newGame('F', 1);
let fails = 0;
const check = (ok, txt) => {
  console.log(`${ok ? '✔' : '✖'} ${txt}`);
  if (!ok) fails++;
};
const team = (id, short) => ({ id, short, color: '#888' });
const rider = (id, s, extra = {}) => ({
  id,
  r: { s: { plc: 70, pla: 72, ...s }, fn: 'A', ln: 'R' + id },
  team: extra.team || team(100 + id, 'T' + id),
  order: extra.order || 'free',
  energy: 60,
  punch: 100,
  wbal: 15,
  pos: extra.pos ?? 60,
  player: false,
  ...extra,
});

// ---- sprint ----
function sprintTrial(me, fw, extraEnts = [], sim = { teamSprinter: {} }) {
  const ents = [];
  for (let i = 0; i < 15; i++) {
    const o = rider(i + 1, { spr: 70 + Math.round(rnd() * 22), end: 62 + Math.round(rnd() * 16) });
    ents.push({ x: o, q: sprintPeak(o.r.s.spr) + gauss() * R.sprintNoise, posS: 40 + rnd() * 60, role: false });
  }
  ents.push(
    { x: me.x, q: sprintPeak(me.x.r.s.spr) + gauss() * R.sprintNoise, posS: me.pos, role: false },
    ...extraEnts
  );
  const T = sprintRun(sim, ents, fw, true);
  const t = T.get(me.x);
  return 1 + ents.filter(e => !e.role && e.x !== me.x && T.get(e.x) < t).length;
}
function sprintAvg(mk, fw, N = 700, seed = 11) {
  return withSeed({ sd: seed }, () => {
    let s = 0;
    for (let k = 0; k < N; k++) s += mk(fw);
    return s / N;
  });
}
const solo = (end, plan) => fw => sprintTrial({ x: rider(0, { spr: 85, end }, { launchPlan: plan }), pos: 85 }, fw);
{
  const inst = sprintAvg(solo(80, null), 'dos'),
    long = sprintAvg(solo(80, 'long'), 'dos');
  check(long < inst, `sprint, endurant par vent de dos : lancer long ${long.toFixed(2)} < instinct ${inst.toFixed(2)}`);
  const lf = sprintAvg(solo(70, 'long'), 'face'),
    cf = sprintAvg(solo(70, 'court'), 'face');
  check(cf < lf, `sprint, vent de face : attendre ${cf.toFixed(2)} < lancer long ${lf.toFixed(2)}`);
  // le conseil de l'adjoint ne fait pas pire que l'instinct (bien placé : pas de roue)
  for (const [end, fw] of [
    [62, 'neutre'],
    [70, 'face'],
    [80, 'dos'],
  ]) {
    const x0 = rider(0, { spr: 85, end });
    const adv = sprintAdvice(x0, fw);
    const a = sprintAvg(solo(end, adv), fw),
      i = sprintAvg(solo(end, null), fw);
    check(
      a <= i + 0.05,
      `sprint, conseil de l'adjoint (endurance ${end}, vent ${fw}) : ${adv || 'instinct'} ${a.toFixed(2)} ≤ ${i.toFixed(2)}`
    );
  }
  // un train de deux poissons-pilotes aide son sprinteur
  const withTrain = fw => {
    const T0 = team(1, 'MOI');
    const me = rider(0, { spr: 85, end: 70 }, { team: T0, order: 'sprint' });
    const los = [1, 2].map(k => rider(50 + k, { spr: 60, end: 75, pla: 78 }, { team: T0, order: 'leadout' }));
    const sim = { teamSprinter: { [T0.id]: me } };
    return sprintTrial(
      { x: me, pos: 75 },
      fw,
      los.map(x => ({ x, q: 60, posS: 75, role: true })),
      sim
    );
  };
  const noTrain = solo(70, null);
  const wt = sprintAvg(withTrain, 'neutre'),
    nt = sprintAvg(fw => sprintTrial({ x: rider(0, { spr: 85, end: 70 }), pos: 75 }, fw), 'neutre');
  check(wt < nt, `sprint : avec un train de 2 ${wt.toFixed(2)} < sans train ${nt.toFixed(2)}`);
}

// ---- côte ----
const climbSim = { P: { climbs: [], finishGrad: 7 }, dist: 100, runners: [] };
function climbTrial(me, meSc, plan) {
  const ord = [];
  const others = [];
  for (let i = 0; i < 7; i++) {
    const o = rider(i + 1, { col: 70 + Math.round(rnd() * 14), mon: 70 + Math.round(rnd() * 14) });
    o.wbal = 6 + rnd() * 10;
    others.push(o);
    ord.push([o, 80 + gauss() * 3]);
  }
  me.climbPlan = plan;
  me.wbal = 14;
  if (plan === 'follow') {
    const best = ord.slice().sort((a, b) => b[1] - a[1])[0][0];
    me.followId = best.id;
  }
  ord.push([me, meSc + gauss() * 1.4]);
  climbSim.runners = ord.map(a => a[0]);
  const T = climbRun(climbSim, ord, 1000, 6, 7);
  const t = T.get(me);
  return 1 + ord.filter(a => a[0] !== me && T.get(a[0]) < t).length;
}
function climbAvg(mk, N = 600, seed = 23) {
  return withSeed({ sd: seed }, () => {
    let s = 0;
    for (let k = 0; k < N; k++) s += mk();
    return s / N;
  });
}
{
  const punch = plan => () => climbTrial(rider(0, { col: 84, mon: 74 }), 81, plan);
  const li = climbAvg(punch(null)),
    ll = climbAvg(punch('last'));
  check(ll <= li + 0.05, `côte, puncheur : attendre la fin ${ll.toFixed(2)} ≤ instinct ${li.toFixed(2)}`);
  const cont = plan => () => climbTrial(rider(0, { col: 74, mon: 82 }), 82, plan);
  const fi = climbAvg(cont(null)),
    ff = climbAvg(cont('follow'));
  check(ff <= fi + 0.1, `côte, prétendant proche du plus fort : suivre ${ff.toFixed(2)} ≤ instinct ${fi.toFixed(2)}`);
}
console.log(fails ? `\n${fails} échec(s)` : '\nOrdres de final : tout est bon.');
process.exit(fails ? 1 : 0);
