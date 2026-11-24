// Détecteur d'anomalies de course : simule des saisons complètes (toutes les équipes en IA) et signale, étape par
// étape, les événements invraisemblables pour du cyclisme professionnel, avec le récit de l'étape (le journal de la
// course autour du moment en cause). Complément du banc de calibrage : le calibrage vérifie les moyennes, le
// détecteur cherche les cas isolés qui choqueraient un connaisseur.
// Usage : node tests/anomalies.js [nbSaisons=8] [graineDépart=500]   (JOBS=n processus, EX=3 exemples par règle)
// Sortie : taux par règle (pour 100 étapes concernées) puis exemples ; code de sortie 1 si une règle dépasse son seuil.
const fs = require('fs');
require('vm').runInThisContext(fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", ''));

if (process.env.SPLITWRAP) require(process.env.SPLITWRAP); // (débogage : origine des cassures)
const NS = +(process.argv[2] || 8),
  SEED0 = +(process.argv[3] || 500);
const EX = +(process.env.EX || 3);

// Règles : description, seuil toléré (pour 100 étapes concernées). Un seuil de 0 signifie « ne devrait jamais
// arriver » ; les autres admettent une rareté réelle (chutes, bordures, jours sans).
const RULES = {
  gc_perte_plat: [
    'un leader du top 10 du général perd plus de 20 s sur une étape plate d’une course par étapes (chutes et bordures comprises)',
    12,
  ],
  gc3_perte_plat: ['un top 3 du général perd plus de 2 min sur une étape plate (hors chute)', 0.5],
  leader_perte_plat: ['le maillot de leader perd plus de 10 s sur une étape plate (hors chute)', 1],
  parade: ['le podium du général change lors de la dernière étape (parade)', 0],
  leader_abandon: ['le leader du général abandonne', 0.6],
  echap_reprise_tot: ['échappée (plus de 1 min d’avance) reprise à plus de 90 km de l’arrivée sur le plat', 5],
  explosion_plat: ['peloton éclaté sur le plat sans bordure ni chute (groupe des favoris < 40 % à 20 km)', 2],
  fringales_equipe: ['au moins 3 coureurs d’une même équipe en fringale sur une étape', 1],
  fringales_coureur: ['un même coureur en fringale 3 fois dans une étape', 0.3],
  sprinteur_montagne: ['un sprinteur gagne une étape de montagne ou une arrivée au sommet', 0.5],
  vitesse: ['vitesse moyenne du vainqueur hors de 30-52 km/h (ligne)', 0],
  ecart_vainqueur: ['le vainqueur d’une étape en ligne a plus de 8 min d’avance sur le 2e', 0],
  desobeissances: ['au moins 3 de mes coureurs désobéissent ou refusent un ordre dans une étape', 2],
  peloton_entier: ['étape de montagne finie avec plus de 60 % des coureurs dans le groupe du vainqueur', 2],
};
const N = {}, // étapes concernées par règle
  HIT = {}, // anomalies par règle
  EXS = {}; // exemples par règle
for (const k in RULES) ((N[k] = 0), (HIT[k] = 0), (EXS[k] = []));

const strip = s => String(s).replace(/<[^>]+>/g, '');
const fmtT = s => {
  s = Math.round(Math.abs(s));
  return (s >= 60 ? Math.floor(s / 60) + "'" + String(s % 60).padStart(2, '0') : s + 's') + '';
};
const nm = id => (S.riders[id] ? riderName(S.riders[id]) : '#' + id);
// Récit : les lignes du journal proches d'un kilomètre (ou les dernières), plus celles qui citent un coureur.
function story(sim, km, who) {
  const log = (sim && sim.log) || [];
  const names = (who || []).map(nm);
  const rows = log.filter(l => (km == null ? true : Math.abs(l.km - km) < 25) || names.some(n => l.txt.includes(n)));
  return rows.slice(-10).map(l => `      km ${Math.round(l.km)} · ${strip(l.txt)}`);
}
function flag(k, ctx, msg, sim, km, who) {
  HIT[k]++;
  if (EXS[k].length < EX) EXS[k].push([`  ▸ ${ctx} — ${msg}`, ...story(sim, km, who)].join('\n'));
}
const favGroup = sim => {
  const score = G => G.riders.filter(x => sim.favs.has(x.id)).length * 1000 + G.riders.length;
  return sim.groups.reduce((a, b) => (score(b) > score(a) ? b : a));
};
const crashed = (sim, id) =>
  (sim.log || []).some(l => /chute|crevaison|incident|ennui/i.test(l.txt) && l.txt.includes(nm(id)));
// Pourquoi un coureur a perdu le groupe des favoris : ce que dit le journal autour du km où il l'a quitté.
function causeOf(sim, id, km) {
  if (km == null) return 'jamais dans le groupe';
  const near = (sim.log || []).filter(l => l.km >= km - 4 && l.km <= km + 3).map(l => l.txt);
  const n = nm(id);
  if (near.some(t => /chute|crevaison|incident|ennui mécanique/i.test(t) && t.includes(n))) return 'chute/incident';
  if (near.some(t => /chute coupe|chute collective/i.test(t))) return 'cassure après chute';
  if (near.some(t => /BORDURE|éventail/.test(t))) return 'bordure';
  if (near.some(t => /zone ventée|vent de côté/i.test(t))) return 'zone ventée (sans bordure)';
  if (near.some(t => /Attaque|attaque/.test(t))) return 'attaque';
  if (near.some(t => /Flamme rouge|Sprint :/.test(t))) return 'sprint final';
  return 'sans raison';
}
const CAUSES = {};
const echelons = sim => (sim.log || []).some(l => /bordure|éventail|vent/i.test(l.txt));

// Une étape en ligne, suivie tick par tick : écart maximal de l'échappée, reprise, taille du groupe des favoris à 20 km.
// TRACE=graine:course:étape (ex. 500:Tour du Levant:5) : déroulé de l'étape, tous les 10 km, pour les dix
// premiers du général (groupe, écart au groupe de tête, énergie) et les groupes de la course.
const TRACE = process.env.TRACE ? process.env.TRACE.split(':') : null;
let curSeed = 0;
function traceRow(sim, gcTop) {
  const P = favGroup(sim);
  const gs = sim.groups
    .map(
      (G, i) =>
        `${i}:${G.riders.length}${G === P ? '*' : ''}@${Math.round(gapSec(sim.groups[0], G))}s` +
        (process.env.TRV ? `[L${(G.L || 0).toFixed(2)} v${(G.speed || 0).toFixed(1)}]` : '')
    )
    .join(' ');
  const who = gcTop
    .map(id => sim.runners.find(x => x.id === id))
    .filter(Boolean)
    .map(x => {
      const gi = sim.groups.findIndex(G => G.riders.includes(x));
      return `${nm(x.id).split(' ').pop()}[${gi}|e${Math.round(x.energy)}|f${Math.round(x.food)}|I${(x.I || 0).toFixed(2)}|p${Math.round(x.punch || 0)}${x.order ? '|' + x.order : ''}]`;
    })
    .join(' ');
  console.error(`km ${Math.round(sim.groups[0].pos)} · ${gs}\n      ${who}`);
}
function runRoadStage(rc, spec, cal) {
  const sim = newStageSim(rc);
  const tr = TRACE && +TRACE[0] === curSeed && cal && cal.name === TRACE[1] && rc.si + 1 === +TRACE[2];
  const gcTop =
    rc.si > 0
      ? gcList(rc)
          .filter(id => !rc.out[id])
          .slice(0, 10)
      : [];
  const hist = []; // [km, groupe de chacun des dix premiers] à chaque pas, avant les premières arrivées
  let nextKm = 0;
  global.__watch = tr ? new Set(gcTop) : null;
  let brkMax = 0,
    seen = false,
    caughtKm = null,
    at20 = null;
  while (!sim.done) {
    simTick(sim);
    if (!sim.groups.length) continue;
    if (tr && sim.groups[0].pos >= nextKm) {
      traceRow(sim, gcTop);
      nextKm += spec.dist - sim.groups[0].pos < 25 ? 2 : 10;
    }
    const P = favGroup(sim);
    if (!sim.finish.length) {
      const row = new Map();
      for (const G of sim.groups) for (const x of G.riders) if (gcTop.includes(x.id)) row.set(x.id, G);
      hist.push([sim.groups[0].pos, row]);
    }
    if (at20 == null && P.pos >= spec.dist - 20) {
      const alive = sim.runners.filter(x => !x.dnf).length;
      at20 = P.riders.length / Math.max(1, alive);
    }
    if (sim.brkIds && caughtKm == null) {
      let g = 0;
      for (const H of sim.groups)
        if (H !== P && H.pos > P.pos && H.riders.some(x => sim.brkIds.has(x.id) && !x.fin))
          g = Math.max(g, gapSec(H, P));
      brkMax = Math.max(brkMax, g);
      if (g > 10) seen = true;
      else if (seen && !sim.finish.length && brkMax >= 60) caughtKm = Math.round(spec.dist - P.pos);
    }
  }
  if (tr) for (const l of sim.log) console.error(`  km ${Math.round(l.km)} · ${strip(l.txt)}`);
  // dernier km où un coureur roulait dans le même groupe qu'un autre (la référence)
  const lastWith = (id, ref) => {
    for (let k = hist.length - 1; k >= 0; k--)
      if (hist[k][1].get(id) && hist[k][1].get(id) === hist[k][1].get(ref)) return hist[k][0];
    return null;
  };
  return { sim, caughtKm, brkMax, at20, lastWith };
}

function checkStage(seed, rc, cal, spec, out, gcBefore, ldrBefore, gc0) {
  const st = rc.stageRes[rc.stageRes.length - 1];
  const sim = out.sim;
  const ctx = `graine ${seed} · ${cal.name} · ét. ${rc.si} (${spec.type}, ${spec.dist} km)`;
  const flat = spec.type === 'plat' && sim && sim.P.finishGrad < 3;
  // temps perdu au général sur l'étape (règle des 3 s et bonifications comprises)
  const gapOf = id => (rc.out[id] || rc.gc[id] == null || gc0[id] == null ? null : rc.gc[id] - gc0[id]);
  // Pertes de temps au général sur le plat (par rapport à la médiane des dix premiers : le peloton)
  if (rc.specs.length > 1 && flat && gcBefore.length) {
    const top = gcBefore.slice(0, 10).filter(id => gapOf(id) != null);
    const ds = top.map(gapOf).sort((a, b) => a - b);
    const ref = ds[Math.floor(ds.length / 2)];
    N.gc_perte_plat++;
    N.gc3_perte_plat++;
    N.leader_perte_plat++;
    // seuls les vrais leaders de classement comptent (en début de course, le top 10 compte des sprinteurs et des
    // équipiers qui n'ont aucune raison de frotter devant)
    const isLdr = id => {
      const x = sim.runners.find(y => y.id === id);
      return x && x.order === 'leader';
    };
    const lost = top.filter(id => isLdr(id) && gapOf(id) - ref > 20);
    for (const id of lost) {
      const refId = top.find(j => gapOf(j) === ref);
      const at = out.lastWith(id, refId);
      const c = causeOf(sim, id, at);
      const km = at == null ? '?' : Math.round(spec.dist - at);
      CAUSES[c] = CAUSES[c] || { n: 0, km: [] };
      CAUSES[c].n++;
      CAUSES[c].km.push(km);
      if ((CAUSES[c].ex = CAUSES[c].ex || []).length < 4) CAUSES[c].ex.push(`${ctx} ${nm(id)} à ${km} km`);
      if (process.env.DBG0) {
        const rk = st.res.findIndex(e => e.id === id);
        const med = top.find(j => gapOf(j) === ref);
        const rm = st.res.findIndex(e => e.id === med);
        console.error(
          `${ctx} ${nm(id)} rang ${rk + 1} écart ${st.res[rk] && st.res[rk].gap} | réf ${nm(med)} rang ${rm + 1} écart ${st.res[rm] && st.res[rm].gap} | ΔGC ${gapOf(id)} vs ${ref} | ${st.res
            .slice(Math.max(0, rk - 3), rk + 2)
            .map(e => Math.round(e.gap || 0))
            .join(',')}`
        );
      }
    }
    if (lost.length)
      flag(
        'gc_perte_plat',
        ctx,
        lost.map(id => `${nm(id)} (${gcBefore.indexOf(id) + 1}e) +${fmtT(gapOf(id) - ref)}`).join(', '),
        sim,
        null,
        lost
      );
    for (const id of gcBefore.slice(0, 3))
      if (gapOf(id) != null && gapOf(id) - ref > 120 && !crashed(sim, id))
        flag('gc3_perte_plat', ctx, `${nm(id)} (${gcBefore.indexOf(id) + 1}e) +${fmtT(gapOf(id) - ref)}`, sim, null, [
          id,
        ]);
    if (ldrBefore != null && gapOf(ldrBefore) != null && gapOf(ldrBefore) - ref > 10 && !crashed(sim, ldrBefore))
      flag('leader_perte_plat', ctx, `${nm(ldrBefore)} +${fmtT(gapOf(ldrBefore) - ref)}`, sim, null, [ldrBefore]);
  }
  // Parade : le podium ne bouge pas
  if (sim && sim.parade) {
    N.parade++;
    const after = gcList(rc).slice(0, 3);
    if (after.join() !== gcBefore.slice(0, 3).join())
      flag(
        'parade',
        ctx,
        `avant ${gcBefore.slice(0, 3).map(nm).join(' / ')} → après ${after.map(nm).join(' / ')}`,
        sim,
        null,
        after
      );
  }
  // Abandon du leader
  if (rc.specs.length > 1 && ldrBefore != null) {
    N.leader_abandon++;
    if (rc.out[ldrBefore])
      flag('leader_abandon', ctx, `${nm(ldrBefore)} abandonne avec le maillot`, sim, null, [ldrBefore]);
  }
  if (!sim) return;
  // Échappée reprise beaucoup trop tôt sur le plat
  if (flat) {
    N.echap_reprise_tot++;
    if (out.caughtKm != null && out.caughtKm > 90)
      flag(
        'echap_reprise_tot',
        ctx,
        `reprise à ${out.caughtKm} km (avance max ${fmtT(out.brkMax)})`,
        sim,
        spec.dist - out.caughtKm
      );
    N.explosion_plat++;
    if (out.at20 != null && out.at20 < 0.4 && !echelons(sim))
      flag(
        'explosion_plat',
        ctx,
        `groupe des favoris : ${Math.round(out.at20 * 100)} % des coureurs à 20 km`,
        sim,
        spec.dist - 20
      );
  }
  // Fringales par équipe
  N.fringales_equipe++;
  const bt = {};
  for (const x of sim.runners) if (x.bonks) bt[x.team.id] = (bt[x.team.id] || 0) + 1; // (coureurs touchés)
  N.fringales_coureur++;
  const rb = sim.runners.filter(x => x.bonks >= 3);
  if (rb.length) flag('fringales_coureur', ctx, rb.map(x => `${nm(x.id)} (${x.order}) : ${x.bonks} fringales`).join(', '), sim, null, rb.map(x => x.id));
  const worst = Object.entries(bt).sort((a, b) => b[1] - a[1])[0];
  if (worst && worst[1] >= 3)
    flag(
      'fringales_equipe',
      ctx,
      `${S.teams[worst[0]].name} : ${worst[1]} coureurs en fringale (${sim.runners.filter(x => x.bonks && x.team.id == worst[0]).map(x => `${nm(x.id)} ${x.order} ${Math.round(x.st.kw)} km en tête, ${Math.round(x.st.kf)} km devant`).join(' ; ')})`,
      sim,
      null,
      sim.runners.filter(x => x.bonks && x.team.id == worst[0]).map(x => x.id)
    );
  // Sprinteur vainqueur en montagne
  const w = st.res[0] && S.riders[st.res[0].id];
  if (spec.type === 'montagne' || spec.type === 'sommet') {
    N.sprinteur_montagne++;
    if (w && w.arch === 'sprinteur')
      flag('sprinteur_montagne', ctx, `${riderName(w)} gagne (mon ${w.s.mon})`, sim, spec.dist - 15, [w.id]);
    N.peloton_entier++;
    const alive = st.res.length;
    const same = st.res.filter(e => (e.gap || 0) - (st.res[0].gap || 0) < 5).length;
    if (same / Math.max(1, alive) > 0.6)
      flag('peloton_entier', ctx, `${same}/${alive} coureurs dans le temps du vainqueur`, sim, spec.dist - 10);
  }
  // Vitesse et écart du vainqueur
  N.vitesse++;
  const v = spec.dist / (st.res[0].time / 3600);
  if (v < 30 || v > 52) flag('vitesse', ctx, `${v.toFixed(1)} km/h`, sim);
  N.ecart_vainqueur++;
  if (st.res[1] && (st.res[1].gap || 0) - (st.res[0].gap || 0) > 480)
    flag('ecart_vainqueur', ctx, `${nm(st.res[0].id)} avec ${fmtT(st.res[1].gap - (st.res[0].gap || 0))}`, sim, null, [
      st.res[0].id,
    ]);
  // Désobéissances
  N.desobeissances++;
  const dt = {};
  for (const x of sim.runners) {
    if (!x.player) continue; // (mon équipe : celle où une désobéissance se voit et se gère)
    const k = x.team.id;
    if (x.rebel) (dt[k] = dt[k] || [0, 0])[0]++;
    if (sim.refusals && sim.refusals.has(x.id)) (dt[k] = dt[k] || [0, 0])[1]++;
  }
  for (const k in dt) dt[k] = dt[k][0] + dt[k][1];
  const wd = Object.entries(dt).sort((a, b) => b[1] - a[1])[0];
  if (wd && wd[1] >= 3) flag('desobeissances', ctx, `${S.teams[wd[0]].name} : ${wd[1]} coureurs`, sim);
}

function runSeed(seed) {
  curSeed = seed;
  newGame('T', seed);
  for (let i = advanceToNextRace(); i >= 0; i = advanceToNextRace()) {
    const cal = S.cal[i];
    if (cal.worlds) {
      runWorlds(i);
      continue;
    }
    const rc = startRace(i, aiSelect(S.teams[0], cal, prepareRaceSpecs(cal)));
    while (!rc.done) {
      const spec = rc.specs[rc.si];
      Object.assign(rc.orders, autoOrders(0, spec, rc));
      const gcBefore = rc.si > 0 ? gcList(rc).filter(id => !rc.out[id]) : [];
      const ldr = gcBefore[0];
      const gc0 = { ...rc.gc };
      const tt = isITT(spec) || isTTT(spec);
      const out = tt ? (runStageAuto(rc), {}) : runRoadStage(rc, spec, cal);
      checkStage(seed, rc, cal, spec, out, gcBefore, ldr, gc0);
    }
  }
  endSeason();
}

const { spawn } = require('child_process');
if (process.env.ANO_CHILD) {
  for (const sd of process.env.ANO_SEEDS.split(',').map(Number)) runSeed(sd);
  process.stdout.write(JSON.stringify({ N, HIT, EXS, CAUSES }), () => process.exit(0));
} else main();

async function main() {
  const seeds = Array.from({ length: NS }, (_, i) => SEED0 + i);
  const jobs = Math.max(1, Math.min(seeds.length, +(process.env.JOBS || require('os').cpus().length)));
  const parts = Array.from({ length: jobs }, (_, j) => seeds.filter((_, i) => i % jobs === j));
  const outs = await Promise.all(
    parts.map(
      list =>
        new Promise((res, rej) => {
          const ch = spawn(process.execPath, [__filename], {
            env: { ...process.env, ANO_CHILD: '1', ANO_SEEDS: list.join(',') },
          });
          let o = '';
          ch.stdout.on('data', d => (o += d));
          ch.stderr.pipe(process.stderr);
          ch.on('close', c => (c ? rej(new Error('processus ' + c)) : res(JSON.parse(o))));
        })
    )
  );
  for (const o of outs)
    for (const c in o.CAUSES) {
      CAUSES[c] = CAUSES[c] || { n: 0, km: [] };
      CAUSES[c].n += o.CAUSES[c].n;
      CAUSES[c].km.push(...o.CAUSES[c].km);
      CAUSES[c].ex = [...(CAUSES[c].ex || []), ...(o.CAUSES[c].ex || [])].slice(0, 4);
    }
  for (const o of outs)
    for (const k in RULES) {
      N[k] += o.N[k];
      HIT[k] += o.HIT[k];
      for (const e of o.EXS[k]) if (EXS[k].length < EX) EXS[k].push(e);
    }
  console.log(`Anomalies de course — ${NS} saisons (graines ${SEED0}-${SEED0 + NS - 1})\n`);
  let bad = 0;
  for (const k in RULES) {
    const rate = N[k] ? (100 * HIT[k]) / N[k] : 0;
    const over = rate > RULES[k][1];
    if (over) bad++;
    console.log(
      `${over ? '✗' : '✓'} ${k.padEnd(20)} ${String(HIT[k]).padStart(4)} / ${String(N[k]).padEnd(5)} ${rate.toFixed(2).padStart(6)} %  (seuil ${RULES[k][1]} %)  ${RULES[k][0]}`
    );
  }
  if (Object.keys(CAUSES).length) {
    console.log('\nPertes au général sur le plat, par cause (km de l’arrivée où le contact est perdu) :');
    for (const [c, v] of Object.entries(CAUSES).sort((a, b) => b[1].n - a[1].n))
      console.log(
        `  ${c.padEnd(28)} ${String(v.n).padStart(4)}   km : ${v.km
          .sort((a, b) => a - b)
          .slice(0, 25)
          .join(' ')}\n${(v.ex || []).map(e => '      ' + e).join('\n')}`
      );
  }
  for (const k in RULES)
    if (EXS[k].length) {
      console.log(`\n── ${k} : ${RULES[k][0]}`);
      console.log(EXS[k].join('\n'));
    }
  console.log(`\n${bad ? bad + ' règle(s) au-dessus du seuil' : 'Aucune règle au-dessus du seuil'}`);
  process.exitCode = bad ? 1 : 0;
}
