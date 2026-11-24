// Web Worker : un calcul fait dans un contexte JavaScript vierge, qui ne reçoit que ce que reçoit le Worker
// (l'état S, la série aléatoire, le compteur d'identifiants, par copie structurée), doit donner exactement le même
// état qu'un calcul fait sur place. Échoue si une donnée nécessaire ne voyage pas avec l'état (variable globale du
// moteur, donnée dérivée de S non recalculée par stateRestored : 98-worker.js).
// Usage : node tests/worker_roundtrip.js
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", '');
// deux mondes séparés : « la page » et « le Worker »
const mk = () => {
  const ctx = vm.createContext({ console, structuredClone, Math, Date, JSON });
  vm.runInContext(code, ctx);
  return ctx;
};
const page = mk();
const run = (ctx, src) => vm.runInContext(src, ctx);
let fails = 0;
const check = (ok, txt) => {
  console.log((ok ? '✔ ' : '✖ ') + txt);
  if (!ok) fails++;
};
// le monde a évolué : une course a disparu, une autre a changé de catégorie, les effectifs sont limités autrement
run(
  page,
  `newGame('Aller-retour', 31);
   const W = worldInit();
   const gone = RACE_DEFS.find(d => !WORLD_KEEP.includes(d.key) && d.cat >= 2);
   if (gone) W.gone.push(gone.key);
   const up = RACE_DEFS.find(d => d.cat === 2 && (!gone || d.key !== gone.key));
   if (up) W.cat[up.key] = 1;
   W.roster = 26;
   worldApply();
   for (let k = 0; k < 3; k++) { const i = advanceToNextRace(); if (i < 0) break; simulateRaceAuto ? simulateRaceAuto(i) : null; }`
);
// les opérations du Worker : avancer jusqu'à la prochaine course, courir une course, une course confiée à l'adjoint
const ops = [{ op: 'advance' }, { race: true }, { op: 'advance' }, { race: true, delegate: true }];
for (const o of ops) {
  // la demande, telle que la page l'envoie (copie structurée, comme postMessage)
  const i = run(page, 'nextRaceIdx()');
  if (i < 0) break;
  const req = run(
    page,
    `structuredClone({ state: S, sd: _sd, rid: _rid, i: ${i}, op: ${JSON.stringify(o.op || null)}, delegate: ${!!o.delegate} })`
  );
  // le Worker : un contexte vierge (son propre chargement du moteur), seulement la demande
  const worker = mk();
  worker.__req = structuredClone(req); // (postMessage copie toujours)
  const res = run(worker, 'structuredClone(workerRun(__req, () => {}))');
  // la page fait le même calcul sur place
  const label =
    o.op === 'advance' ? 'avancer à la prochaine course' : o.delegate ? 'course confiée à l’adjoint' : 'course simulée';
  // la page fait le même calcul sur place, sur son état vivant, sans aucun transfert (la référence)
  run(
    page,
    o.op === 'advance'
      ? 'advanceToNextRace()'
      : o.delegate
        ? `runDelegatedRace(${i}); S.rc = null;`
        : `{ const rc = startRace(${i}, []); while (!rc.done) runStageAuto(rc); S.rc = null; }`
  );
  const same =
    run(page, 'JSON.stringify(S)') === JSON.stringify(res.state) &&
    run(page, '_sd') === res.sd &&
    run(page, '_rid') === res.rid;
  check(
    run(worker, 'derivedState()') === run(page, 'derivedState()'),
    `${o.op || 'course'} : données dérivées de l'état (courses de la partie, effectifs) identiques dans le Worker`
  );
  if (!same && process.env.DIFF) {
    const a = JSON.parse(run(page, 'JSON.stringify(S)')),
      b = res.state;
    const diff = (x, y, path, out) => {
      if (out.length > 12) return;
      if (JSON.stringify(x) === JSON.stringify(y)) return;
      if (x && y && typeof x === 'object' && typeof y === 'object') {
        for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) diff(x[k], y[k], path + '.' + k, out);
      } else out.push(`${path}: page=${JSON.stringify(x)} worker=${JSON.stringify(y)}`.slice(0, 200));
    };
    const out = [];
    diff(a, b, 'S', out);
    console.log(out.join('\n'), '\n_sd', run(page, '_sd'), res.sd, '_rid', run(page, '_rid'), res.rid);
  }
  check(same, `${label} (${run(page, 'S.cal[' + i + '].name')}) : même état dans le Worker et sur la page`);
  // (la page garde son propre état : la suite se compare toujours à un calcul fait sur place)
}
console.log(fails ? `\n${fails} échec(s)` : '\nTout est bon.');
process.exit(fails ? 1 : 0);
