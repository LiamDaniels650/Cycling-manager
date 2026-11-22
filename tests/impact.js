// Poids des caractéristiques et des choix du joueur : expériences appariées (même monde, même hasard),
// avec et sans la modification. Chaque caractéristique doit changer le résultat sur le terrain où elle compte,
// chaque choix du joueur doit avoir un effet mesurable, dans le bon sens.
// Usage : node tests/impact.js [essais=40]   (2 à 4 minutes)
const fs = require('fs');
require('vm').runInThisContext(fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", ''));
const N = +(process.argv[2] || 20);
newGame('Impact', 99);
const SNAP = JSON.stringify(S);
const RID = _rid;
function fresh(k) {
  S = JSON.parse(SNAP);
  _rid = RID;
  S.seed0 = 7000 + k;
  _sd = 12345 + k; // même hasard « hors course » (sélection du joueur) dans les deux courses d'un essai
}
// Première course (et étape) du calendrier d'un type donné.
// (« montagne+ » : l'étape de montagne la plus longue du calendrier, là où l'endurance se paie)
function findStage(type) {
  const longest = type.endsWith('+');
  const ty = longest ? type.slice(0, -1) : type;
  let best = null;
  for (let i = 0; i < S.cal.length; i++) {
    const c = S.cal[i];
    if (c.worlds || (c.inv && !c.inv.includes(0))) continue;
    c.stagesSpec.forEach((st, si) => {
      if (st[0] === ty && (!best || (longest && st[1] > best.d))) best = { i, si, d: st[1] };
    });
    if (best && !longest) return best;
  }
  if (!best) throw new Error('pas d’étape ' + type);
  return best;
}
// Lance l'étape et renvoie { rc, sim } ; prep(rc) choisit la cible et applique la modification.
function runStage(type, k, prep) {
  fresh(k);
  const { i, si } = findStage(type);
  const cal = S.cal[i];
  S.week = cal.w;
  const rc = startRace(i, aiSelect(S.teams[0], cal, prepareRaceSpecs(cal)));
  rc.si = si;
  const spec = rc.specs[si];
  Object.assign(rc.orders, autoOrders(0, spec, rc));
  // consignes des équipes IA (pour choisir la cible ; le moteur les recalcule au départ de l'étape)
  rc.preOrders = {};
  for (const T of S.teams) if (!T.player) Object.assign(rc.preOrders, autoOrders(T.id, spec, rc));
  const ctx = prep(rc, spec) || {};
  const sim = runStageAuto(rc);
  // fatigue de chaque coureur après l'étape (l'état du monde est remplacé à l'essai suivant)
  const fat = {};
  for (const T of S.teams) for (const id of rc.sel[T.id]) fat[id] = S.riders[id].fatigue;
  return { rc, sim, ctx, fat };
}
const rankOf = (rc, id) => {
  const r = rc.stageRes[rc.stageRes.length - 1].res;
  const k = r.findIndex(e => e.id === id);
  return k < 0 ? r.length + 1 : k + 1;
};
const runner = (sim, id) => sim && sim.runners && sim.runners.find(x => x.id === id);
let fails = 0;
// Expérience appariée « croisée » : dans chaque essai, deux courses identiques (même monde, même hasard) ;
// dans la première, la moitié des coureurs ciblés reçoit le bonus, dans la seconde l'autre moitié. On compare,
// coureur par coureur, son résultat avec et sans bonus : beaucoup de paires par essai, peu de bruit.
function paired(label, type, key, bump, metric, better, minEffect, ord, mult = 1) {
  let a = 0,
    b = 0,
    wins = 0,
    n = 0;
  for (let k = 0; k < N * mult; k++) {
    let ids = [];
    const out = [0, 1].map(half =>
      runStage(type, k, rc => {
        // cibles choisies une fois pour toutes dans la première course de l'essai
        if (half === 0)
          ids = S.teams
            .filter(T => !T.player)
            .flatMap(T => rc.sel[T.id])
            .filter(id => !ord || ord.includes((rc.preOrders[id] || {}).o))
            .sort((p, q) => S.riders[q].s[key] - S.riders[p].s[key]);
        ids.forEach((id, i) => {
          if (i % 2 === half) S.riders[id].s[key] = Math.min(95, S.riders[id].s[key] + bump);
        });
      })
    );
    const vals = out.map(o => {
      const m = {};
      for (const id of ids) m[id] = metric(o, id);
      return m;
    });
    ids.forEach((id, i) => {
      const vb = vals[i % 2][id],
        va = vals[1 - (i % 2)][id];
      if (va == null || vb == null) return;
      a += va;
      b += vb;
      n++;
      if (better === 'lower' ? vb < va : vb > va) wins++;
    });
  }
  a /= n;
  b /= n;
  const eff = better === 'lower' ? a - b : b - a;
  const ok = eff >= minEffect;
  if (!ok) fails++;
  console.log(
    `${ok ? '✔' : '✖'} ${label.padEnd(46)} ${a.toFixed(1).padStart(6)} → ${b.toFixed(1).padStart(6)}  (${n} paires, mieux ${Math.round((wins / n) * 100)} %)`
  );
}
const R = (o, id) => rankOf(o.rc, id);
const energy = (o, id) => {
  const x = runner(o.sim, id);
  return x ? x.energy : null;
};
console.log(`Caractéristiques (+6 points, ${N} essais appariés ; rang d'étape sauf mention)`);
const LD = ['leader'],
  SP = ['sprint'],
  BR = ['break', 'free'];
paired('Montagne → arrivée au sommet (leaders)', 'sommet', 'mon', 6, R, 'lower', 3, LD);
paired('Collines → arrivée en bosse (leaders)', 'punch', 'col', 6, R, 'lower', 3, LD);
paired('Sprint → étape de plaine (sprinteurs)', 'plat', 'spr', 6, R, 'lower', 1, SP);
paired('Chrono → contre-la-montre', 'clm', 'clm', 6, R, 'lower', 3);
paired('Pavés → étape de pavés (leaders)', 'paves', 'pav', 6, R, 'lower', 2, LD, 2);
paired('Plat → énergie restante après une étape plate', 'plat', 'pla', 6, energy, 'higher', 0.5);
paired('Endurance → plus longue étape de montagne (leaders)', 'montagne+', 'end', 8, R, 'lower', 1, LD, 2);
paired('Descente → étape de montagne (leaders)', 'montagne', 'des', 8, R, 'lower', 1, LD, 2);
// (placement retiré : l'effet sature chez les sprinteurs déjà bien placés, c'est en dessous qu'il se paie)
paired('Placement −8 → recul au sprint (sprinteurs)', 'plat', 'plc', -8, R, 'higher', 0.5, SP, 2);
paired(
  'Récupération → fatigue accumulée après l’étape',
  'montagne',
  'rec',
  8,
  (o, id) => (o.fat ? -o.fat[id] : null),
  'higher',
  0.05
);
paired(
  'Baroud → km passés en tête (étape accidentée)',
  'vallonne',
  'bar',
  10,
  (o, id) => {
    const x = runner(o.sim, id);
    return x ? x.st.kf + x.st.att * 5 : null;
  },
  'higher',
  0.5,
  BR,
  2
);

// --- Choix du joueur ---
console.log(`\nChoix du joueur (${N} essais appariés)`);
function choice(label, type, setup, metric, better, minEffect, mult = 1) {
  let a = 0,
    b = 0,
    n = 0;
  for (let k = 0; k < N * mult; k++) {
    const va = metric(runStage(type, k, (rc, spec) => setup(rc, spec, false)));
    const vb = metric(runStage(type, k, (rc, spec) => setup(rc, spec, true)));
    a += va;
    b += vb;
    n++;
  }
  a /= n;
  b /= n;
  const eff = better === 'lower' ? a - b : b - a;
  const ok = eff >= minEffect;
  if (!ok) fails++;
  console.log(`${ok ? '✔' : '✖'} ${label.padEnd(44)} ${a.toFixed(2).padStart(6)} → ${b.toFixed(2).padStart(6)}`);
}
const countLog = re => o => o.sim.log.filter(l => re.test(l.txt)).length;
choice(
  'Reconnaissance → risque de chute de mes coureurs (pavés)',
  'paves',
  (rc, spec, on) => {
    if (on) (S.recon = S.recon || {})[rc.key] = S.season;
  },
  // exposition aux chutes accumulée par mes coureurs (bien moins bruitée que le nombre de chutes)
  o => sum(o.sim.runners.filter(x => x.player).map(x => x.st.risk)),
  'lower',
  0.005,
  2
);
choice(
  'Ravitaillement renforcé → réserves à l’arrivée',
  'montagne',
  (rc, spec, on) => {
    rc.feedPlan = on ? 'renforce' : 'normal';
    rc.feedStage = rc.si;
    if (!on) for (const id of rc.sel[0]) S.riders[id].fatigue = Math.max(S.riders[id].fatigue, 0);
  },
  o => {
    const xs = o.sim.runners.filter(x => x.player);
    return sum(xs.map(x => x.food)) / xs.length;
  },
  'higher',
  2,
  2
);
choice(
  'Équipiers au service du leader → rang du leader',
  'montagne',
  (rc, spec, on) => {
    const ids = rc.sel[0];
    const ldr = ids.slice().sort((a, b) => S.riders[b].s.mon - S.riders[a].s.mon)[0];
    rc._ldr = ldr;
    for (const id of ids) rc.orders[id] = { o: id === ldr ? 'leader' : on ? 'protect' : 'free', att: 'final' };
  },
  o => rankOf(o.rc, o.rc._ldr),
  'lower',
  0.5,
  3
);
choice(
  'Coureur gardé au chaud (« save ») → énergie à l’arrivée',
  'vallonne',
  (rc, spec, on) => {
    const id = rc.sel[0][3];
    rc._id = id;
    rc.orders[id] = { o: on ? 'save' : 'control' };
  },
  o => {
    const x = runner(o.sim, o.rc._id);
    return x ? x.energy : 0;
  },
  'higher',
  3
);

// --- Choix de gestion sur la durée ---
console.log('\nGestion (26 semaines, espoirs de l’académie)');
function weeks(n, setup, k) {
  fresh(k);
  const ctx = setup();
  for (let w = 0; w < n; w++) weeklyUpdate();
  return ctx;
}
// trois mondes différents, moyenne des écarts
function season(label, setup, metric, minEffect) {
  let a = 0,
    b = 0;
  for (const k of [1, 2, 3]) {
    a += metric(weeks(26, () => setup(false), k)) / 3;
    b += metric(weeks(26, () => setup(true), k)) / 3;
  }
  const ok = b - a >= minEffect;
  if (!ok) fails++;
  console.log(`${ok ? '✔' : '✖'} ${label.padEnd(44)} ${a.toFixed(2).padStart(6)} → ${b.toFixed(2).padStart(6)}`);
}
// jeunes du vivier recrutés à l'académie pour l'occasion (de la marge de progression)
const youngs = () => {
  const ys = S.youth
    .map(id => S.riders[id])
    .sort((a, b) => b.ceil - overall(b.s) - (a.ceil - overall(a.s)))
    .slice(0, 6);
  for (const y of ys) joinAcademy(y.id);
  return ys.filter(y => y.aca);
};
season(
  'Entraînement « montagne » (vs sprint) → montagne',
  on => {
    const ys = youngs();
    for (const r of ys) r.training = on ? 'montagne' : 'sprint';
    return ys.map(r => r.id);
  },
  ids => sum(ids.map(id => S.riders[id].s.mon)) / ids.length,
  0.5
);
season(
  'Entraîneurs niveau 3 (vs 1) → progression des jeunes',
  on => {
    S.staff.coach = on ? 3 : 1;
    const ys = youngs();
    return ys.map(r => [r.id, overall(r.s)]);
  },
  L => sum(L.map(([id, o0]) => overall(S.riders[id].s) - o0)) / L.length,
  0.1
);
console.log(
  fails ? `\n${fails} effet(s) trop faible(s)` : '\nToutes les caractéristiques et tous les choix testés pèsent.'
);
process.exit(fails ? 1 : 0);
