// Banc de calibrage : simule des saisons complètes (toutes les équipes en IA) et compare
// les mesures à des fourchettes tirées du cyclisme professionnel réel.
// Usage : node tests/calibrate.js [nbGraines=3] [graineDépart=100]   (référence : 30 saisons, graine 200 ;
//         l'erreur type d'un taux d'échappée y est ~0,017, contre ~0,03 sur 10 saisons)
//         DBG=<type> affiche le détail des arrivées de ce type (plat, punch, sommet, ardennes…)
const fs = require('fs');
require('vm').runInThisContext(fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", ''));

const NS = +(process.argv[2] || 3),
  SEED0 = +(process.argv[3] || 100);
const DBG = process.env.DBG || null;

// Fourchettes réelles (médianes visées). Vitesses en km/h, écarts en secondes sauf mention.
// Sources détaillées : docs/SOURCES.md. Les mesures sans source directe sont ramenées à l'échelle du jeu
// (18 équipes, calendrier resserré) et signalées comme telles dans ce document.
const REAL = {
  v_plat: [42, 45.5],
  v_vallonne: [40, 44],
  v_punch: [39.5, 43],
  v_sommet: [35, 39],
  v_montagne: [35.5, 39.5],
  v_paves: [42, 46],
  v_clm: [48, 54],
  v_clmeq: [51, 57],
  echap_plat: [0.03, 0.15], // Tour : 2 % (Frontier Economics) ; plus haut sur les courses moins contrôlées
  echap_vallonne: [0.35, 0.55], // Tour, moyenne montagne : 43 % (Frontier Economics)
  echap_punch: [0.2, 0.45],
  echap_sommet: [0.28, 0.45],
  echap_montagne: [0.35, 0.6], // Tour, haute montagne : 47 % (Frontier Economics)
  '10e_sommet_et': [30, 120],
  '10e_montagne_et': [40, 180],
  '10e_plat_et': [0, 2],
  gc2_GT: [0.5, 8],
  gc3_GT: [2, 12],
  gc10_GT: [10, 30],
  gc2_1sem: [0.1, 1.5],
  gc3_1sem: [0.3, 2.5],
  gc10_1sem: [2, 7],
  GT_finishers_pct: [75, 90], // Tour 2019-2024 : 77 à 88 % (135 à 155 arrivants sur 176-184)
  GT_vitesse: [39, 42.5], // Tour 2016-2025 : 39,6 à 42,8 km/h ; Giro et Vuelta plus lents
  watts_vainqueur_col: [5.8, 6.9], // estimations : 6,0-6,4 W/kg pour gagner, jusqu'à ≈7 (Pogačar)
  taille_echap_plat: [2, 7],
  taille_echap_montagne_GT: [8, 35], // échappées de 16+ coureurs : 77 % de réussite (Frontier Economics)
  GT_abandons_etape: [0.8, 2.1], // Tour 2019-2024 : 21 à 43 abandons en 21 étapes (cohérent avec les arrivants)
  jours_course_p90: [60, 90],
  jours_course_max: [78, 95], // ProCyclingStats : 85 à 89 jours pour les plus chargés (2024, 2026)
  saison_victoires_n1: [10, 28],
  hors_delais: [0, 1],
  kom_vainqueur_top10_gc: [0.2, 0.55], // Grands Tours 2019-2025 : 5 sur 21 (Tour 4/7, Giro 1/7, Vuelta 0/7)
  // part des classiques gagnées en solitaire (au moins 5 s d'avance sur le 2e), 2016-2025 : docs/SOURCES.md
  solo_flandres_1j: [0.5, 0.85], // Flandres 7/10, Strade Bianche 9/10, E3 ≈ 7/10, Omloop ≈ 5/10
  solo_ardennes_1j: [0.3, 0.65], // Liège 6/10, Amstel ≈ 3/10
  solo_paves_1j: [0.15, 0.5], // Roubaix 4/9, Gand-Wevelgem ≈ 2/10 (sprints)
  // classiques gagnées par l'un des 10 favoris d'avant-course (2016-2025) : docs/SOURCES.md
  favori_flandres_1j: [0.6, 0.95], // Flandres 9/10
  favori_paves_1j: [0.6, 0.95], // Roubaix 8/9
  favori_ardennes_1j: [0.5, 0.9], // Liège 8/10, Amstel ≈ 6/9
  sprint_meilleur: [0.3, 0.6], // sprints massifs gagnés par le meilleur sprinteur présent (estimée)
  // vie d'un grand tour et des échappées (docs/SOURCES.md)
  GT_porteurs_maillot: [2, 8], // Tour 2019-2024 : 3 à 5 porteurs du maillot jaune ; Giro et Vuelta jusqu'à 7
  GT_equipes_etapes: [7, 15], // Tour 2019-2024 : 10 à 14 équipes gagnent une étape (22 équipes ; ici 18)
  ecart_max_echap_plat_min: [1.5, 7], // étapes de plaine : l'échappée plafonne le plus souvent à 3-5 min
  reprise_echap_plat_km: [2, 20], // reprise de l'échappée sur le plat : le plus souvent entre 5 et 15 km
};

const M = {},
  ARCHS = {};
const add = (k, v) => {
  if (v == null || isNaN(v)) return;
  (M[k] = M[k] || []).push(v);
};
const addArch = (k, a) => {
  const o = (ARCHS[k] = ARCHS[k] || {});
  o[a] = (o[a] || 0) + 1;
};
const sorted = a => a.slice().sort((x, y) => x - y);
const quant = (a, p) => {
  const b = sorted(a);
  return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * p))] : NaN;
};
const typeOf = (spec, cal) =>
  spec.type === 'vallonne' && cal.stagesSpec[0][2] === 'dur'
    ? 'ardennes'
    : spec.type === 'paves' && cal.stagesSpec[0][2] === 'monts'
      ? 'flandres'
      : spec.type;

// Groupe de référence : celui qui contient le plus de favoris (le gruppetto peut être plus gros).
function favGroup(sim) {
  const score = G => G.riders.filter(x => sim.favs.has(x.id)).length * 1000 + G.riders.length;
  return sim.groups.reduce((a, b) => (score(b) > score(a) ? b : a));
}
function idsAhead(sim, ref) {
  return new Set(sim.groups.filter(G => G.pos > ref.pos + 0.05).flatMap(G => G.riders.map(x => x.id)));
}
function debugFinish(sim, spec, res, brk) {
  const top = res.slice(0, 5).map(e => {
    const r = S.riders[e.id];
    return `${r.arch.slice(0, 5)}(${r.s.col}/${r.s.spr}/${r.s.mon})+${Math.round(e.gap)}`;
  });
  console.error(
    `${spec.type} ${spec.dist}km pente finale ${sim.P.finishGrad.toFixed(1)} ${brk ? 'ÉCHAPPÉE' : '         '} ${top.join(' ')}`
  );
}

function runRoadStage(rc, spec, cal) {
  const sim = newStageSim(rc);
  let half = null,
    brk = 0,
    caughtKm = null,
    brkSeen = false,
    lastIds = null;
  while (!sim.done) {
    simTick(sim);
    if (!half && sim.groups.length && sim.groups[0].pos >= spec.dist * 0.5) half = idsAhead(sim, favGroup(sim));
    // taille de l'échappée du jour : coureurs devant le peloton (à plus d'une minute), en milieu de course,
    // même si l'échappée s'est scindée en plusieurs groupes dans les premiers cols
    const P = favGroup(sim);
    if (P && P.pos > spec.dist * 0.3 && spec.dist - P.pos > 30) {
      let n = 0;
      for (const H of sim.groups) if (H !== P && H.pos > P.pos && gapSec(H, P) > 60) n += H.riders.length;
      brk = Math.max(brk, n);
    }
    // reprise de l'échappée du jour : plus aucun groupe d'échappés devant le peloton (à plus de 10 s)
    if (sim.brkIds !== lastIds) {
      lastIds = sim.brkIds; // nouvelle échappée (après une reprise très tôt) : on la suit depuis son départ
      brkSeen = false;
    }
    if (sim.brkIds && P && caughtKm == null) {
      const ahead = sim.groups.some(
        H => H !== P && H.pos > P.pos && gapSec(H, P) > 10 && H.riders.some(x => sim.brkIds.has(x.id) && !x.fin)
      );
      if (ahead) brkSeen = true;
      else if (brkSeen && !sim.finish.length) caughtKm = Math.round(spec.dist - P.pos);
    }
  }
  return { sim, half, brk, caughtKm };
}

function measureStage(rc, spec, cal, out) {
  const st = rc.stageRes[rc.stageRes.length - 1],
    res = st.res;
  const ty = typeOf(spec, cal),
    one = rc.specs.length === 1 ? '1j' : 'et';
  add('v_' + ty, spec.dist / (res[0].time / 3600));
  addArch(`arch_${isTTT(spec) ? 'clmeq' : ty}_${one}`, S.riders[res[0].id].arch);
  if (st.cut) add('hors_delais', st.cut.length);
  if (st.climbs) for (const c of st.climbs) if (c.len >= 8 && c.top[0]) add('watts_vainqueur_col', c.top[0].wkg);
  if (spec.type === 'clm') {
    add('clm_2e_s_km', res[1].gap / spec.dist);
    add('clm_10e_s_km', res[9].gap / spec.dist);
  } else if (spec.type === 'clmeq') {
    const tl = rc.tttLog;
    add('ttt_2e_s', tl[1].time - tl[0].time);
    add('ttt_6e_s', tl[Math.min(5, tl.length - 1)].time - tl[0].time);
  } else {
    const brk = !!(out.half && out.half.has(res[0].id));
    add('echap_' + ty, brk ? 1 : 0);
    add('marge_' + ty, res[1].gap);
    add('10e_' + ty + '_' + one, res[9] ? res[9].gap : NaN);
    if ((ty === 'montagne' || ty === 'sommet') && res[9]) add(`10e_${ty}_${brk ? 'echap' : 'favoris'}`, res[9].gap);
    add('dernier_' + ty + '_min', res[res.length - 1].gap / 60);
    add('abandons_etape', out.sim.runners.filter(x => x.dnf).length);
    if (ty === 'plat') add('groupe_sprint', res.filter(e => e.gap < 1).length);
    if (ty === 'plat' && out.sim) {
      const b = breakRecord(out.sim);
      if (b && b.n <= 10 && b.max >= 30) {
        add('ecart_max_echap_plat_min', b.max / 60);
        if (out.caughtKm != null) add('reprise_echap_plat_km', out.caughtKm);
      }
    }
    if (one === '1j' && (ty === 'flandres' || ty === 'ardennes' || ty === 'paves')) {
      add('solo_' + ty + '_1j', res[1].gap >= 5 ? 1 : 0);
      // vainqueur parmi les 10 favoris d'avant-course (meilleurs sur le terrain du jour, forme comprise)
      add('favori_' + ty + '_1j', out.sim.favs.has(res[0].id) ? 1 : 0);
    }
    // sprint massif (20 coureurs ou plus dans le même temps) : le meilleur sprinteur présent gagne-t-il ?
    const bunch = res.filter(e => e.gap < 1);
    if (ty === 'plat' && bunch.length >= 20) {
      const bestSpr = Math.max(...bunch.map(e => S.riders[e.id].s.spr));
      add('sprint_meilleur', S.riders[res[0].id].s.spr >= bestSpr ? 1 : 0);
    }
    if (out.brk && ty === 'plat') add('taille_echap_plat', out.brk);
    if (out.brk && ty === 'montagne' && cal.cat === 0) add('taille_echap_montagne_GT', out.brk);
    if (DBG === ty) debugFinish(out.sim, spec, res, brk);
  }
}

function measureStageRace(rc, cal, startN, totD, totT) {
  const g = gcList(rc),
    t0 = rc.gc[g[0]],
    k = cal.cat === 0 ? 'GT' : '1sem';
  add('gc2_' + k, (rc.gc[g[1]] - t0) / 60);
  add('gc3_' + k, (rc.gc[g[2]] - t0) / 60);
  add('gc10_' + k, (rc.gc[g[9]] - t0) / 60);
  if (cal.cat !== 0) return;
  const best = o =>
    Object.keys(o)
      .filter(id => !rc.out[id])
      .sort((a, b) => o[b] - o[a])[0];
  addArch('maillot_points', S.riders[best(rc.pts)].arch);
  addArch('maillot_grimpeur', S.riders[best(rc.kom)].arch);
  add('kom_vainqueur_top10_gc', g.indexOf(+best(rc.kom)) >= 0 && g.indexOf(+best(rc.kom)) < 10 ? 1 : 0);
  add('GT_finishers_pct', (g.length / startN) * 100);
  add('GT_abandons_etape', (startN - g.length) / rc.specs.length);
  add('GT_vitesse', totD / (totT / 3600));
}

function runSeed(seed) {
  newGame('T', seed);
  for (let i = advanceToNextRace(); i >= 0; i = advanceToNextRace()) {
    const cal = S.cal[i];
    if (cal.worlds) {
      runWorlds(i);
      continue;
    }
    const rc = startRace(i, aiSelect(S.teams[0], cal, prepareRaceSpecs(cal)));
    const startN = Object.keys(rc.gc).length;
    let totT = 0,
      totD = 0;
    const leaders = new Set(),
      winTeams = new Set();
    while (!rc.done) {
      const spec = rc.specs[rc.si];
      Object.assign(rc.orders, autoOrders(0, spec, rc));
      const out = isITT(spec) || isTTT(spec) ? (runStageAuto(rc), {}) : runRoadStage(rc, spec, cal);
      measureStage(rc, spec, cal, out);
      const st = rc.stageRes[rc.stageRes.length - 1];
      if (rc.specs.length > 1) {
        leaders.add(gcList(rc)[0]);
        winTeams.add(S.riders[st.res[0].id].team);
      }
      totT += st.res[0].time;
      totD += spec.dist;
    }
    if (rc.specs.length > 1) measureStageRace(rc, cal, startN, totD, totT);
    if (cal.cat === 0) {
      add('GT_porteurs_maillot', leaders.size);
      add('GT_equipes_etapes', winTeams.size);
    }
  }
  const wins = Object.values(S.riders)
    .filter(r => r.team !== null)
    .map(r => r.stats.wins)
    .sort((a, b) => b - a);
  add('saison_victoires_n1', wins[0]);
  add('saison_victoires_n5', wins[4]);
  add('saison_vainqueurs_distincts', wins.filter(w => w > 0).length);
  const days = Object.values(S.riders)
    .filter(r => r.team !== null && !r.retired)
    .map(r => r.stats.days)
    .sort((a, b) => b - a);
  add('jours_course_max', days[0]);
  add('jours_course_p90', days[Math.floor(days.length * 0.1)]);
  endSeason();
}

// Exécution : les saisons sont réparties entre plusieurs processus (JOBS, par défaut un par cœur), puis fusionnées.
const { execFileSync, spawn } = require('child_process');
if (process.env.CAL_CHILD) {
  for (const sd of process.env.CAL_SEEDS.split(',').map(Number)) runSeed(sd);
  // sortir seulement une fois tout écrit (sinon un gros résultat est tronqué dans le tube)
  process.stdout.write(JSON.stringify({ M, ARCHS }), () => process.exit(0));
}
// Saisons d'une liste de graines, réparties entre JOBS processus, fusionnées dans M et ARCHS.
async function runList(seeds) {
  const jobs = Math.max(1, Math.min(seeds.length, +(process.env.JOBS || require('os').cpus().length)));
  const parts = Array.from({ length: jobs }, (_, j) => seeds.filter((_, i) => i % jobs === j));
  const outs = await Promise.all(
    parts.map(
      list =>
        new Promise((res, rej) => {
          const ch = spawn(process.execPath, [__filename], {
            env: { ...process.env, CAL_CHILD: '1', CAL_SEEDS: list.join(',') },
          });
          let o = '';
          ch.stdout.on('data', d => (o += d));
          ch.stderr.pipe(process.stderr);
          ch.on('close', c => (c ? rej(new Error('processus ' + c)) : res(JSON.parse(o))));
        })
    )
  );
  for (const { M: m, ARCHS: a } of outs) {
    for (const k in m) (M[k] = M[k] || []).push(...m[k]);
    for (const k in a)
      for (const x in a[k]) {
        const o = (ARCHS[k] = ARCHS[k] || {});
        o[x] = (o[x] || 0) + a[k][x];
      }
  }
}
// Valeur comparée au réel : la moyenne pour un taux (échappées, victoires en solitaire…), sinon la médiane.
function measureOf(k) {
  const rate =
    k.startsWith('echap_') ||
    k.startsWith('solo_') ||
    k.startsWith('favori_') ||
    k === 'kom_vainqueur_top10_gc' ||
    k === 'sprint_meilleur';
  const a = M[k];
  return rate ? sum(a) / a.length : quant(a, 0.5);
}
// Arrêt anticipé : chaque mesure est dans le réel, et assez loin du bord pour que le bruit des saisons manquantes
// ne puisse pas l'en faire sortir (au moins 3 erreurs types ; une mesure figée sur un bord, comme 0 seconde d'écart
// au sprint, a une erreur nulle et passe). Erreur type : écart type / √n (×1,25 pour une médiane).
function decisive(out) {
  let ok = true;
  for (const k of Object.keys(REAL)) {
    const v = M[k];
    if (!v || v.length < 10) return false;
    const m = measureOf(k),
      [a, b] = REAL[k];
    const mu = sum(v) / v.length;
    const sd = Math.sqrt(sum(v.map(x => (x - mu) ** 2)) / (v.length - 1));
    const se = (sd / Math.sqrt(v.length)) * (k.startsWith('echap_') || k.startsWith('solo_') || k.startsWith('favori_') || k === 'kom_vainqueur_top10_gc' || k === 'sprint_meilleur' ? 1 : 1.25);
    const d = Math.min(m - a, b - m);
    if (d < 0 || d < 3 * se) {
      ok = false;
      if (out) out.push(`${k} (${m.toFixed(2)}, ${(d / Math.max(se, 1e-9)).toFixed(1)} erreurs types du bord)`);
    }
  }
  return ok;
}
async function runAll() {
  const seeds = Array.from({ length: NS }, (_, i) => SEED0 + i);
  // CAL_STAGE=n : on calcule d'abord n saisons ; si toutes les mesures sont nettement dans le réel, on s'arrête là
  const ST = +(process.env.CAL_STAGE || 0);
  if (ST > 0 && ST < NS) {
    await runList(seeds.slice(0, ST));
    const near = [];
    if (decisive(near)) {
      console.log(`(arrêt anticipé après ${ST} saisons : toutes les mesures sont nettement dans le réel)`);
      return report();
    }
    console.log(`(on poursuit jusqu'à ${NS} saisons : ${near.join(', ')})`);
    await runList(seeds.slice(ST));
  } else await runList(seeds);
  report();
}
function report() {
  const f = v => v.toFixed(2).padStart(8);
  for (const k of Object.keys(M).sort()) {
    const a = M[k],
      m = measureOf(k),
      R = REAL[k];
    const ref = R ? `   réel ${R[0]}–${R[1]} ${m >= R[0] && m <= R[1] ? '✔' : '✖'}` : '';
    console.log(
      k.padEnd(24),
      ('n=' + a.length).padEnd(6),
      'moy',
      f(sum(a) / a.length),
      ' méd',
      f(m),
      ' p10',
      f(quant(a, 0.1)),
      ' p90',
      f(quant(a, 0.9)) + ref
    );
  }
  console.log('\n--- Profils des vainqueurs ---');
  for (const k of Object.keys(ARCHS).sort()) {
    const o = ARCHS[k],
      n = sum(Object.values(o));
    console.log(
      k.padEnd(26),
      'n=' + n,
      Object.entries(o)
        .sort((a, b) => b[1] - a[1])
        .map(([a, c]) => a + ' ' + Math.round((c / n) * 100) + '%')
        .join(', ')
    );
  }
}
if (!process.env.CAL_CHILD) runAll();
