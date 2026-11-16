// Test d'invariance : le résultat d'une saison ne doit dépendre ni des numéros internes des coureurs ni de
// l'ordre des équipes dans la liste. Pour plusieurs graines, on joue la même saison :
//   A) normale ; B) coureurs du joueur renumérotés en dernier ; C) équipes IA dans l'ordre inverse.
// Les écarts B−A (rang UCI du joueur) et C−A (lien entre position dans la liste et gain de points) doivent
// rester du niveau du bruit.  Usage : node tests/bias.js [graines=6] [départ=400]
const fs = require('fs');
const { execFileSync } = require('child_process');
const NS = +(process.argv[2] || 6),
  S0 = +(process.argv[3] || 400);

if (process.env.BIAS_CHILD) {
  require('vm').runInThisContext(
    fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", '')
  );
  const seed = +process.env.SEED,
    mode = process.env.BIAS_CHILD;
  newGame('B', seed);
  if (mode === 'B') {
    const P = S.teams[0];
    P.riders = P.riders.map(id => {
      const r = S.riders[id];
      delete S.riders[id];
      r.id = _rid++;
      S.riders[r.id] = r;
      return r.id;
    });
    S.plan = {};
  }
  if (mode === 'C') S.teams = [S.teams[0], ...S.teams.slice(1).reverse()];
  for (let i = advanceToNextRace(); i >= 0; i = advanceToNextRace()) {
    const cal = S.cal[i];
    if (cal.worlds) {
      runWorlds(i);
      continue;
    }
    const rc = startRace(i, aiSelect(S.teams[0], cal, prepareRaceSpecs(cal)));
    while (!rc.done) {
      Object.assign(rc.orders, autoOrders(0, rc.specs[rc.si], rc));
      runStageAuto(rc);
    }
  }
  const R = uciRanking();
  const out = { rank: R.indexOf(S.teams[0]) + 1, pts: {} };
  for (const T of S.teams) out.pts[T.id] = T.uci;
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

const jobs = [];
for (let k = 0; k < NS; k++) for (const m of ['A', 'B', 'C']) jobs.push([S0 + k, m]);
const res = {};
const { spawn } = require('child_process');
let running = 0,
  idx = 0;
const JOBS = +(process.env.JOBS || 6);
function next() {
  if (idx >= jobs.length) {
    if (!running) report();
    return;
  }
  const [seed, m] = jobs[idx++];
  running++;
  const p = spawn(process.execPath, [__filename], { env: { ...process.env, BIAS_CHILD: m, SEED: seed } });
  let o = '';
  p.stdout.on('data', d => (o += d));
  p.on('close', () => {
    res[seed + m] = JSON.parse(o);
    running--;
    next();
  });
}
for (let k = 0; k < JOBS; k++) next();

function report() {
  let dB = 0,
    nB = 0;
  const pos = [],
    chg = [];
  for (let k = 0; k < NS; k++) {
    const s = S0 + k,
      a = res[s + 'A'],
      b = res[s + 'B'],
      c = res[s + 'C'];
    dB += b.rank - a.rank;
    nB++;
    // position d'origine des équipes IA (1 = juste après le joueur) et variation de points quand l'ordre est inversé
    const ids = Object.keys(a.pts)
      .map(Number)
      .filter(id => id !== 0)
      .sort((x, y) => x - y);
    ids.forEach((id, i) => {
      pos.push(i);
      chg.push((c.pts[id] - a.pts[id]) / Math.max(200, a.pts[id]));
    });
    console.log(`graine ${s} : rang joueur A=${a.rank} B=${b.rank}`);
  }
  const mean = v => v.reduce((x, y) => x + y, 0) / v.length;
  const mp = mean(pos),
    mc = mean(chg);
  let cov = 0,
    vp = 0,
    vc = 0;
  for (let i = 0; i < pos.length; i++) {
    cov += (pos[i] - mp) * (chg[i] - mc);
    vp += (pos[i] - mp) ** 2;
    vc += (chg[i] - mc) ** 2;
  }
  const rho = cov / Math.sqrt(vp * vc || 1);
  const dRank = dB / nB;
  console.log(`numéros des coureurs : écart moyen de rang ${dRank.toFixed(2)} (tolérance ±2,5)`);
  console.log(`ordre des équipes : corrélation position/variation ${rho.toFixed(2)} (tolérance ±0,35)`);
  const ok = Math.abs(dRank) <= 2.5 && Math.abs(rho) <= 0.35;
  console.log(ok ? '✔ aucun biais d’ordre détecté' : '✖ biais d’ordre détecté');
  process.exit(ok ? 0 : 1);
}
