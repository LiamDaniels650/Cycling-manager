// Tests de propriétés (fast-check) : au lieu de quelques cas choisis à la main, des cas tirés au hasard (graine de
// la partie, course, ordres du joueur et instants où il les donne), et des règles qui doivent toujours tenir. En cas
// d'échec, fast-check réduit le cas au plus simple et affiche la graine pour le rejouer.
// Usage : node tests/properties.js [nombre de cas par propriété, 30 par défaut]   (code 1 si une règle est violée)
const fs = require('fs');
const fc = require('fast-check');
require('vm').runInThisContext(fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", ''));
const RUNS = +(process.argv[2] || 30);
let fails = 0;
const prop = (name, p) => {
  const t0 = Date.now();
  const out = fc.check(p, { numRuns: RUNS });
  if (!out.failed) {
    console.log(`✔ ${name} (${RUNS} cas, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    return;
  }
  fails++;
  const err = out.errorInstance || out.error;
  console.log(`✖ ${name}`);
  console.log(`  cas réduit : ${JSON.stringify(out.counterexample)}`);
  console.log(`  règle violée : ${err && err.message ? err.message : err}`);
  console.log(`  pour le rejouer : graine fast-check ${out.seed}, chemin ${out.counterexamplePath}`);
};
const snap = () => JSON.stringify({ S, sd: _sd, rid: _rid });
const restore = s => {
  const o = JSON.parse(s);
  S = o.S;
  _sd = o.sd;
  _rid = o.rid;
  stateRestored();
};

// Une partie neuve et une course en ligne de son calendrier (la k-ième), prête à partir : ordres de l'adjoint donnés.
// Renvoie l'instantané de l'état au départ de l'étape (comme le rapport de signalement).
function roadStage(seed, k) {
  newGame('Prop', seed);
  S.tipsOff = true;
  const road = S.cal
    .map((c, i) => i)
    .filter(i => !S.cal[i].worlds && !['clm', 'clmeq'].includes(S.cal[i].stagesSpec[0][0]));
  const i = road[k % road.length];
  const cal = S.cal[i];
  S.week = cal.w;
  const rc = startRace(i, aiSelect(S.teams[0], cal, prepareRaceSpecs(cal)));
  Object.assign(rc.orders, autoOrders(0, rc.specs[rc.si], rc));
  return snap();
}
// Des ordres du joueur, chacun à un instant de la course (en pas de simulation) et pour un de ses coureurs.
const RADIO = [
  'attack',
  'bridge',
  'chase',
  'tempo',
  'front',
  'stop',
  'nopull',
  'pace',
  'wait',
  'eat',
  'bottles',
  'reset',
];
const TEAM = ['chase', 'stop', 'front', 'reset', 'echelon'];
const actionArb = fc.oneof(
  fc.record({ at: fc.nat(500), n: fc.constant('radio'), who: fc.nat(7), k: fc.constantFrom(...RADIO) }),
  fc.record({ at: fc.nat(500), n: fc.constant('team'), k: fc.constantFrom(...TEAM) })
);
// Joue l'étape en donnant les ordres ; vérifie les règles à chaque pas ; renvoie l'empreinte de la course.
function play(sim, actions, check) {
  const mine = sim.runners.filter(x => x.player);
  const todo = actions.slice().sort((a, b) => a.at - b.at);
  let step = 0;
  while (!sim.done) {
    if (step > 30000) throw new Error('étape sans fin (plus de 30 000 pas)');
    for (const a of todo.filter(a => a.at === step)) {
      if (a.n === 'team') liveAct(sim, { n: 'team', k: a.k });
      else if (mine.length) liveAct(sim, { n: 'radio', id: mine[a.who % mine.length].id, k: a.k });
    }
    simTick(sim);
    step++;
    if (check) check(sim);
  }
  return JSON.stringify(stageCheck(sim.rc));
}
// Règles de cohérence d'une course, vérifiées à chaque pas.
function invariants(sim) {
  const live = sim.runners.filter(x => !x.fin && !x.dnf);
  const inGroups = new Map();
  for (const G of sim.groups) {
    if (!(G.pos >= 0 && G.pos <= sim.dist + 1)) throw new Error(`groupe hors de la route (km ${G.pos})`);
    for (const x of G.riders) if (!x.fin && !x.dnf) inGroups.set(x, (inGroups.get(x) || 0) + 1);
  }
  for (const x of live) {
    if (inGroups.get(x) !== 1) throw new Error(`${riderName(x.r)} est dans ${inGroups.get(x) || 0} groupes`);
    if (!(x.energy >= -0.5 && x.energy <= 100.5)) throw new Error(`énergie hors bornes : ${x.energy}`);
    if (!(x.food >= -0.5 && x.food <= 100.5)) throw new Error(`réserves hors bornes : ${x.food}`);
  }
  // écarts : positifs, et croissants de la tête vers l'arrière (avant l'arrivée du premier)
  if (sim.runners.some(x => x.fin)) return;
  const L = sim.groups.filter(G => G.riders.some(x => !x.fin && !x.dnf)).sort((a, b) => b.pos - a.pos);
  for (let i = 1; i < L.length; i++) {
    const g = gapSec(L[0], L[i]),
      p = gapSec(L[0], L[i - 1]);
    if (!(g >= 0)) throw new Error(`écart négatif ou invalide : ${g}`);
    if (g + 1 < p)
      throw new Error(`écart non croissant : groupe ${i} à ${g.toFixed(0)} s, devant lui ${p.toFixed(0)} s`);
  }
}

prop(
  'étape avec des ordres au hasard : jamais de plantage, course cohérente à chaque instant, classement ordonné',
  fc.property(fc.integer({ min: 1, max: 1e6 }), fc.nat(40), fc.array(actionArb, { maxLength: 12 }), (seed, k, acts) => {
    restore(roadStage(seed, k));
    const sim = newStageSim(S.rc);
    play(sim, acts, invariants);
    const st = S.rc.stageRes[S.rc.stageRes.length - 1];
    const starters = sim.runners.length;
    if (st.res.length + sim.runners.filter(x => x.dnf).length !== starters)
      throw new Error(`${st.res.length} classés + abandons ≠ ${starters} partants`);
    for (let i = 1; i < st.res.length; i++)
      if (st.res[i].time + 1e-6 < st.res[i - 1].time) throw new Error(`classement non ordonné à la place ${i + 1}`);
    return true;
  })
);

prop(
  'rejeu exact : même départ et mêmes ordres aux mêmes instants donnent la même course (bouton Signaler)',
  fc.property(fc.integer({ min: 1, max: 1e6 }), fc.nat(40), fc.array(actionArb, { maxLength: 8 }), (seed, k, acts) => {
    const s0 = roadStage(seed, k);
    restore(s0);
    const a = play(newStageSim(S.rc), acts);
    restore(s0);
    const b = play(newStageSim(S.rc), acts);
    if (a !== b) throw new Error('deux rejeux identiques donnent deux courses différentes');
    return true;
  })
);

prop(
  'sauvegarde : une partie sauvegardée puis rechargée continue exactement comme sans interruption',
  fc.property(fc.integer({ min: 1, max: 1e6 }), fc.nat(3), (seed, n) => {
    newGame('Prop', seed);
    S.tipsOff = true;
    for (let j = 0; j < n; j++) {
      const i = nextRaceIdx();
      advanceToNextRace();
      simulateRaceAuto(i);
    }
    const s0 = snap();
    const next = () => {
      const i = nextRaceIdx();
      advanceToNextRace();
      simulateRaceAuto(i);
      return snap();
    };
    const direct = next();
    // rechargement comme au lancement du jeu : état relu, migré, données dérivées recalculées
    restore(s0);
    migrate();
    stateRestored();
    if (snap() !== s0) throw new Error('recharger la sauvegarde modifie la partie');
    if (next() !== direct) throw new Error('la partie rechargée ne continue pas comme la partie d’origine');
    return true;
  })
);

console.log(fails ? `\n${fails} propriété(s) violée(s)` : '\nToutes les propriétés tiennent.');
process.exit(fails ? 1 : 0);
