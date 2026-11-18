// Équilibre économique : parties entièrement déléguées à l'adjoint (gestion raisonnable), plusieurs graines.
// Vérifie que la première saison ne se joue pas sur la loterie de l'effectif de départ : budget positif en fin de
// saison 1 et pas de licenciement sur les premières saisons, quelle que soit la graine.
// Usage : node tests/economy.js [graines=4] [saisons=3] [départ=11]   (≈ 75 s par saison, graines en parallèle)
const fs = require('fs');
const NG = +(process.argv[2] || 4),
  NS = +(process.argv[3] || 3),
  S0 = +(process.argv[4] || 11);
if (process.env.ECO_CHILD) {
  require('vm').runInThisContext(
    fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", '')
  );
  newGame('E', +process.env.SEED, process.env.D || undefined);
  for (const k of Object.keys(AUTO_LBL)) setAuto(k, true);
  const pay0 = sum(S.teams[0].riders.map(id => S.riders[id].salary));
  const rows = [];
  for (let s = 0; s < NS; s++) {
    for (let i = advanceToNextRace(); i >= 0; i = advanceToNextRace()) {
      const c = S.cal[i];
      if (c.worlds) {
        runWorlds(i);
        continue;
      }
      if (!c.inv || c.inv.includes(0)) runDelegatedRace(i);
      else simulateRaceAuto(i);
    }
    const f = S.fin[S.season] || {};
    const row = { s: S.season, budget: Math.round(S.budget), conf: S.conf, sal: Math.round(f.sal || 0) };
    endSeason();
    row.fired = !!S.fired;
    S.fired = false;
    rows.push(row);
  }
  process.stdout.write(JSON.stringify({ pay0, launch: S.launch || 0, rows }));
  process.exit(0);
}
const { spawn } = require('child_process');
const res = {};
let idx = 0,
  running = 0;
const JOBS = +(process.env.JOBS || 4);
const next = () => {
  if (idx >= NG) {
    if (!running) report();
    return;
  }
  const seed = S0 + idx++;
  running++;
  const p = spawn(process.execPath, [__filename, NG, NS], { env: { ...process.env, ECO_CHILD: 1, SEED: seed } });
  let o = '';
  p.stdout.on('data', d => (o += d));
  p.on('close', () => {
    res[seed] = JSON.parse(o);
    running--;
    next();
  });
};
for (let k = 0; k < JOBS; k++) next();
function report() {
  let ok = true;
  for (const seed of Object.keys(res).sort()) {
    const r = res[seed];
    const b1 = r.rows[0].budget,
      fired = r.rows.filter(x => x.fired).length;
    const good = b1 >= 0 && !fired;
    ok &&= good;
    console.log(
      `${good ? '✔' : '✖'} graine ${seed} : masse de départ ${r.pay0} k€, prime ${r.launch} k€ ; budget ${r.rows
        .map(x => `${x.s} ${x.budget}`)
        .join(' · ')} ; confiance ${r.rows.map(x => x.conf).join('/')}${fired ? ' ; LICENCIÉ' : ''}`
    );
  }
  console.log(ok ? '✔ économie équilibrée au démarrage' : '✖ démarrage économique à revoir');
  process.exit(ok ? 0 : 1);
}
