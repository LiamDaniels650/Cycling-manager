// Audit de cohérence sur plusieurs saisons (adjoint aux commandes de toute la gestion du joueur) :
// intégrité des données (équipes, contrats, valeurs numériques) et indicateurs du monde simulé.
// Usage : node tests/audit.js [saisons=6] [graine=300]
const fs = require('fs');
require('vm').runInThisContext(fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", ''));
const NS = +(process.argv[2] || 6),
  SEED = +(process.argv[3] || 300);
let problems = 0;
const bad = m => {
  problems++;
  console.log('  ✖ ' + m);
};
const pct = (a, q) => {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

// Intégrité : chaque coureur actif dans une seule équipe, effectifs, contrats, aucune valeur NaN.
function integrity() {
  const where = {};
  for (const T of S.teams)
    for (const id of T.riders) {
      if (where[id] != null) bad(`coureur ${id} dans deux équipes`);
      where[id] = T.id;
      const r = S.riders[id];
      if (!r) bad(`coureur ${id} inexistant (équipe ${T.short})`);
      else {
        if (r.team !== T.id) bad(`${riderName(r)} : r.team=${r.team} mais dans ${T.short}`);
        if (r.retired) bad(`${riderName(r)} retraité mais dans ${T.short}`);
        if (r.salary <= 0) bad(`${riderName(r)} salaire ${r.salary}`);
      }
    }
  for (const T of S.teams) {
    if (!T.player && (T.riders.length < ROSTER.minAI || T.riders.length > ROSTER.max))
      bad(`${T.short} : ${T.riders.length} coureurs`);
    if (T.player && (T.riders.length < ROSTER.minPlayer || T.riders.length > ROSTER.max))
      bad(`joueur : ${T.riders.length} coureurs`);
  }
  for (const id of S.free) {
    const r = S.riders[id];
    if (r && r.team !== null) bad(`${riderName(r)} libre mais team=${r.team}`);
  }
  const txt = JSON.stringify(S);
  if (/NaN|Infinity/.test(txt.replace(/"[^"]*"/g, m => (/NaN|Infinity/.test(m) && m.length > 12 ? '""' : m))))
    bad('valeur NaN/Infinity dans la sauvegarde');
  for (const r of Object.values(S.riders))
    for (const k of STATS) if (!(r.s[k] >= 20 && r.s[k] <= 99)) bad(`${riderName(r)} ${k}=${r.s[k]}`);
}

newGame('Audit', SEED);
Object.keys(AUTO_LBL).forEach(k => setAuto(k, true));
const rows = [];
for (let s = 0; s < NS; s++) {
  for (let i = advanceToNextRace(); i >= 0; i = advanceToNextRace()) {
    const cal = S.cal[i];
    if (cal.worlds) {
      runWorlds(i);
      continue;
    }
    if (cal.inv && !cal.inv.includes(0)) {
      simulateRaceAuto(i);
      continue;
    }
    const sel = planSelection(cal, aiSelect(S.teams[0], cal, prepareRaceSpecs(cal)));
    const rc = startRace(i, sel);
    while (!rc.done) {
      Object.assign(rc.orders, autoOrders(0, rc.specs[rc.si], rc));
      runStageAuto(rc);
    }
    if (S.pressQ) asstPress();
  }
  // indicateurs de fin de saison (avant les départs et la progression)
  const active = Object.values(S.riders).filter(r => r.team !== null && !r.retired && !r.aca);
  const days = active.map(r => r.stats.days).sort((a, b) => b - a);
  const wins = active.map(r => r.stats.wins).sort((a, b) => b - a);
  const ov = active.map(r => overall(r.s));
  const ages = active.map(r => r.age);
  const uci = uciRanking().map(T => T.uci || 0);
  const P0 = S.teams[0];
  const pay = P0.riders.reduce((a, id) => a + S.riders[id].salary, 0);
  const rumors = (S.merc || []).filter(e => e.k === 'rumeur' && e.s === S.season);
  const season = S.season;
  const rang = uciRanking().indexOf(P0) + 1;
  endSeason();
  const confirmed = rumors.filter(e => {
    const r = S.riders[e.id];
    return r && teamShort(r.team) === e.t;
  }).length;
  rows.push({
    season,
    rang,
    budget: Math.round(S.budget),
    masse: pay,
    sponsor: S.spons.base,
    rep: Math.round(repOf()),
    image: imageLabel().lbl,
    'vict.max': wins[0],
    'vainq.≠': wins.filter(w => w > 0).length,
    'âge moy': mean(ages).toFixed(1),
    'âge max': Math.max(...ages),
    'ov p50': pct(ov, 0.5),
    'ov p95': pct(ov, 0.95),
    'ov max': Math.max(...ov),
    'uci 1er/18e': `${uci[0]}/${uci[uci.length - 1]}`,
    libres: S.free.length,
    'IA tiers': (() => {
      const t = S.teams.filter(T => !T.player).map(T => T.tier);
      return `${Math.min(...t).toFixed(1)}…${Math.max(...t).toFixed(1)}`;
    })(),
    'IA>budget': S.teams.filter(T => !T.player && payrollOf(T) > T.budget * 1.05).length,
    'eff. IA': (() => {
      const n = S.teams.filter(T => !T.player).map(T => T.riders.length);
      return `${Math.min(...n)}–${Math.max(...n)}`;
    })(),
    'jours max/p90': `${days[0]}/${days[Math.floor(days.length * 0.1)]}`,
    rumeurs: `${confirmed}/${rumors.length}`,
  });
  integrity();
}
console.table(rows);
console.log('Finances du joueur (k€) :');
console.table(
  Object.fromEntries(
    Object.entries(S.fin || {}).map(([s, f]) => [
      s,
      Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Math.round(v)])),
    ])
  )
);
// Garde-fous du monde simulé
const last = rows[rows.length - 1];
if (last['ov max'] > 94) bad(`niveau maximal irréaliste (${last['ov max']})`);
if (+last['âge moy'] < 25 || +last['âge moy'] > 30.5) bad(`âge moyen du peloton ${last['âge moy']}`);
if (last['âge max'] > 40) bad(`coureur de ${last['âge max']} ans encore actif`);
for (const r of rows) {
  const [dmax, d90] = r['jours max/p90'].split('/').map(Number);
  if (dmax > 105 || d90 > 90) bad(`saison ${r.season} : jours de course irréalistes (max ${dmax}, p90 ${d90})`);
  if (r['IA>budget'] > 3) bad(`saison ${r.season} : ${r['IA>budget']} équipes IA au-dessus de leurs moyens`);
}
for (const r of rows) if (r['vict.max'] > 28) bad(`saison ${r.season} : un coureur gagne ${r['vict.max']} courses`);
console.log(problems ? `\n${problems} problème(s) détecté(s)` : '\nAucune incohérence détectée.');
process.exit(problems ? 1 : 0);
