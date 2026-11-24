// Rejoue une étape signalée par le joueur (bouton « Signaler », fichier signalement-….json) : même état au départ,
// mêmes ordres donnés aux mêmes instants, donc la même course, vérifiée avec les empreintes du rapport. Affiche le
// déroulé (groupes, mes coureurs, les dix premiers du général) et le journal de la course autour du moment signalé.
// Usage : node tools/replay.js signalement.json [--pas 5] [--tout] [--apres 3]
//   --pas km   intervalle du déroulé (5 km par défaut ; 1 km dans les 15 derniers)
//   --tout     tout le journal de la course (sinon les lignes à ±15 km du moment signalé)
//   --apres n  continue n km après le moment signalé (jusqu'à l'arrivée par défaut)
const fs = require('fs');
const vm = require('vm');
const file = process.argv[2];
if (!file) {
  console.log('Usage : node tools/replay.js signalement.json [--pas 5] [--tout] [--apres 3]');
  process.exit(2);
}
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i < 0 ? d : process.argv[i + 1];
};
const STEPKM = +arg('--pas', 5);
const ALL = process.argv.includes('--tout');
const AFTER = process.argv.includes('--apres') ? +arg('--apres', 3) : null;
const rep = JSON.parse(fs.readFileSync(file, 'utf8'));
if (rep.kind !== 'dsc-rapport') throw new Error("ce fichier n'est pas un signalement du jeu");
const ctx = vm.createContext({ console, structuredClone, Math, Date, JSON });
vm.runInContext(fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", ''), ctx);
const run = s => vm.runInContext(s, ctx);

console.log(`Signalement du ${rep.at} — saison ${rep.season}, semaine ${rep.week} (écran : ${rep.view})`);
console.log(`« ${rep.comment || '(sans commentaire)'} »`);
if (rep.journal && rep.journal.length) {
  console.log('\nJournal de partie (fin) :');
  for (const e of rep.journal.slice(-15)) console.log(`  ${e.s} sem. ${e.w} · ${e.txt}`);
}
if (!rep.stage) {
  console.log("\nPas d'étape à rejouer : l'état de la partie au moment du signalement est chargé.");
  ctx.__st = JSON.parse(rep.state);
  run('S = __st.S; _sd = __st.sd; _rid = __st.rid; migrate();');
  console.log(
    run('`Équipe : ${S.teams[0].name}, budget ${Math.round(S.budget)} k€, ${S.teams[0].riders.length} coureurs`')
  );
  process.exit(0);
}
ctx.__snap = JSON.parse(rep.stage.snap);
ctx.__inputs = rep.stage.inputs || [];
ctx.__autoDS = !!rep.stage.autoDS;
// (pas de migrate : l'instantané vient de la même version du jeu, la partie n'a rien migré à ce moment-là)
run('S = __snap.S; _sd = __snap.sd; _rid = __snap.rid; stateRestored();');
const R = rep.race;
console.log(
  `\n${R.name}, étape ${R.si + 1} — ${run('S.rc.specs[S.rc.si].type')}, ${run('S.rc.specs[S.rc.si].dist')} km`
);
console.log(
  `Ordres donnés pendant l'étape : ${ctx.__inputs.length}${R.live ? `, signalé à l'instant ${R.t} (km ${R.km})` : ''}`
);

if (run('isITT(S.rc.specs[S.rc.si]) || isTTT(S.rc.specs[S.rc.si])')) {
  run('runStageAuto(S.rc)');
} else {
  run(`globalThis.__sim = newStageSim(S.rc); __sim.autoDS = __autoDS; globalThis.__k = 0;
       globalThis.__mine = () => __sim.runners.filter(x => x.player);
       globalThis.__gcTop = S.rc.si > 0 ? gcList(S.rc).slice(0, 10) : [];`);
  const dist = run('__sim.dist');
  const stopKm = R.live && AFTER != null ? R.km + AFTER : Infinity;
  let next = 0,
    checked = false;
  const row = () =>
    run(`(() => {
      const gs = __sim.groups.map((G, i) => i + ':' + G.riders.length + '@' + Math.round(gapSec(__sim.groups[0], G)) + 's').join(' ');
      const where = x => { const i = __sim.groups.findIndex(G => G.riders.includes(x)); return i < 0 ? 'arrivé' : 'g' + i; };
      const me = __mine().map(x => riderName(x.r).split(' ').pop() + '[' + where(x) + ' e' + Math.round(x.energy) + ' f' + Math.round(x.food) + (x.order ? ' ' + x.order : '') + ']').join(' ');
      const gc = __gcTop.map(id => __sim.runners.find(x => x.id === id)).filter(Boolean).map(x => riderName(x.r).split(' ').pop() + '[' + where(x) + ']').join(' ');
      return 'km ' + Math.round(__sim.groups[0] ? __sim.groups[0].pos : 0) + ' · ' + gs + '\\n     mes coureurs : ' + me + (gc ? '\\n     général : ' + gc : '');
    })()`);
  console.log('\nDéroulé :');
  while (!run('__sim.done')) {
    // les ordres du joueur, au même instant que dans sa partie
    run(
      'for (const a of __inputs) if (a.t === __sim.t && !a._done) { a._done = true; const { t, _done, ...b } = a; liveAct(__sim, b); }'
    );
    if (R.live && !checked && run('__sim.t') === R.t && rep.check && rep.check.groups) {
      checked = true;
      const same = JSON.stringify(run('simCheck(__sim)')) === JSON.stringify(rep.check.groups);
      console.log(
        `  >>> MOMENT SIGNALÉ (instant ${R.t}) — ${same ? '✔ course identique à celle du joueur' : '✖ la course diffère de celle du joueur'}`
      );
      console.log('  ' + row());
    }
    const km = run('__sim.groups[0] ? __sim.groups[0].pos : 0');
    if (km >= next) {
      console.log('  ' + row());
      next += dist - km < 15 ? 1 : STEPKM;
    }
    if (km > stopKm) break;
    run('simTick(__sim)');
  }
  const near = R.live && !ALL ? `l => Math.abs(l.km - ${R.km}) <= 15` : 'l => true';
  console.log(`\nJournal de la course${R.live && !ALL ? ` (±15 km autour du km ${R.km})` : ''} :`);
  for (const l of run(
    `__sim.log.filter(${near}).map(l => 'km ' + Math.round(l.km) + ' · ' + l.txt.replace(/<[^>]+>/g, ''))`
  ))
    console.log('  ' + l);
}
if (run('S.rc && S.rc.stageRes.length > S.rc.si - 1 && S.rc.si > ' + R.si)) {
  console.log("\nRésultat de l'étape (10 premiers) :");
  console.log(
    run(
      `S.rc.stageRes[S.rc.stageRes.length - 1].res.slice(0, 10).map((e, k) => (k + 1) + '. ' + riderName(S.riders[e.id]) + (e.gap ? ' +' + Math.round(e.gap) + ' s' : '')).join('\\n')`
    )
  );
  if (rep.check && rep.check.res) {
    const same = JSON.stringify(run('stageCheck(S.rc)')) === JSON.stringify(rep.check.res);
    console.log(same ? '✔ résultat identique à celui du joueur' : '✖ le résultat diffère de celui du joueur');
  }
}
