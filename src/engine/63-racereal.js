/* Course plus vraie.
   - Délais : le temps limite dépend du type d'étape et de la vitesse du vainqueur (plus il va vite, plus la marge
     est grande, comme au Tour). Un groupe d'attardés qui risque l'élimination accélère (le gruppetto calcule). Si
     trop de coureurs sont hors délais, le jury les repêche mais leur retire des points au classement par points.
   - Radio-course : le directeur sportif ne voit pas les écarts exacts. L'ardoisier et la radio donnent des pointages
     réguliers (tous les 5 km, puis plus souvent dans le final), avec une petite erreur, plus grande en montagne. Les
     groupes qui viennent de se former n'ont pas encore d'écart officiel (« ≈ »). Désactivable (écarts exacts).
   - Abandons tactiques : dans les grands tours, des sprinteurs sans plus d'étape pour eux et des leaders distancés
     qui visent un autre grand tour rentrent chez eux. Vous pouvez faire de même entre deux étapes.
   La file des voitures (ordre, dépannage neutre, voiture derrière l'échappée) est dans 35-officials.js. */

// --- Délais ---
function cutPct(type, v) {
  const base = { plat: 9, paves: 10, vallonne: 10, punch: 10, montagne: 11, sommet: 11, clm: 30, clmeq: 40 }[type];
  const ref = type === 'montagne' || type === 'sommet' ? 30 : 38;
  if (type === 'clm' || type === 'clmeq') return base;
  return (base == null ? 10 : base) + clamp((v - ref) * 0.7, 0, 8);
}
// Groupe d'attardés qui finirait hors délais à son allure actuelle : il accélère.
function cutRush(sim, G) {
  if (!sim.stageRace || sim.t < 40 || G.ahead || sim.spec.type === 'clm' || sim.spec.type === 'clmeq') return false;
  let H = null;
  for (const K of sim.groups) if (K.riders.length && (!H || K.pos > H.pos)) H = K;
  if (!H || H === G || H.pos - G.pos < 1 || G.riders.some(x => sim.favs.has(x.id))) return false;
  const vH = H.pos / (sim.t / 60);
  if (!(vH > 15)) return false;
  const tW = sim.t + ((sim.dist - H.pos) / vH) * 60;
  const lim = tW * (1 + cutPct(sim.spec.type, (sim.dist / tW) * 60) / 100);
  const vG = clamp(G.speed || vH, 18, vH);
  const tG = sim.t + ((sim.dist - G.pos) / (vG * 0.97)) * 60;
  return tG > lim * 0.97;
}
// Fin d'étape : éliminations ou repêchage (avec pénalité de points). Renvoie la liste des éliminés.
function cutApply(rc, spec, res) {
  if (!(rc.specs.length > 1 && res.length > 10 && rc.si < rc.specs.length - 1)) {
    rc.cutInfo = null;
    return [];
  }
  const v = spec.dist / (res[0].time / 3600);
  const pct = cutPct(spec.type, v);
  const lim = res[0].time * (1 + pct / 100);
  const late = res.filter(e => e.time > lim);
  const graced = late.length > res.length * 0.2;
  const out = [];
  if (graced) {
    // repêchage collectif : les coureurs restent en course mais perdent 20 points au classement par points
    for (const e of late) rc.pts[e.id] = Math.max(0, (rc.pts[e.id] || 0) - 20);
  } else
    for (const e of late) {
      rc.out[e.id] = true;
      out.push(e.id);
    }
  rc.cutInfo = { n: late.length, lim: lim - res[0].time, pct: +pct.toFixed(1), graced, mine: late.filter(e => S.riders[e.id].team === 0).map(e => e.id) };
  if (rc.cutInfo.mine.length)
    msg(
      graced ? '⏱️ Repêchés' : '⏱️ Hors délais',
      `${rc.cutInfo.mine.map(id => riderName(S.riders[id])).join(', ')} ${graced ? 'arrivent hors délais mais sont repêchés avec tout le gruppetto (−20 points au classement par points)' : 'arrivent hors délais et sont éliminés'} (délai : ${fmtGap(Math.round(lim - res[0].time))}, ${fmtDec(pct, 1)} %).`
    );
  return out;
}

// --- Radio-course : écarts annoncés au directeur sportif ---
function realGaps() {
  return !S.exactGaps;
}
function grpKey(G) {
  let m = Infinity;
  for (const x of G.riders) if (!x.fin && !x.dnf && x.id < m) m = x.id;
  return m;
}
// Pointage : à chaque pas, si la tête a assez avancé depuis le dernier (5 km, 2,5 km dans les 30 derniers, 1 km
// dans les 10 derniers). Lecture seule : la simulation n'en dépend pas.
function boardTick(sim) {
  let H = null;
  const L = [];
  for (const G of sim.groups)
    if (G.riders.some(x => !x.fin && !x.dnf)) {
      L.push(G);
      if (!H || G.pos > H.pos) H = G;
    }
  if (!H) return;
  const kmL = sim.dist - H.pos;
  const step = kmL < 10 ? 1 : kmL < 30 ? 2.5 : 5;
  const B = sim.board;
  if (B && H.pos - B.km < step && sim.t - B.t < 12) return;
  // (l'erreur de mesure porte sur l'écart entre deux groupes qui se suivent : l'ordre de la route est toujours
  // respecté ; tirée groupe par groupe, elle pouvait annoncer un contre derrière le peloton qu'il précède)
  const gaps = {};
  L.sort((a, b) => b.pos - a.pos);
  let prevT = 0,
    prevV = 0;
  for (const G of L) {
    const k = grpKey(G);
    if (G === H) {
      gaps[k] = 0;
      continue;
    }
    const tg = gapSec(H, G);
    const d = Math.max(0, tg - prevT);
    const h = dsHash('ard' + sim.rc.key + sim.rc.si + ':' + k + ':' + Math.round(H.pos * 4));
    const err = ((h % 2001) / 1000 - 1) * (0.05 * d + 3) * (H.g >= 4 ? 1.4 : 1);
    const v = Math.max(prevV + (d >= 3 ? 5 : 0), Math.round((prevV + Math.max(0, d + err)) / 5) * 5, 5);
    gaps[k] = v;
    prevT = tg;
    prevV = v;
  }
  sim.board = { t: sim.t, km: H.pos, gaps };
}
// Écart annoncé entre deux groupes (A devant B) : { v (s), ok (pointage officiel), km (du pointage) }.
// Écart affiché entre A (devant) et B : jamais plus petit que celui d'un groupe qui roule entre les deux (un groupe
// a pu en doubler un autre depuis le dernier pointage).
function boardGap(sim, A, B) {
  const g = boardGapRaw(sim, A, B);
  if (A === B || !realGaps()) return g;
  for (const C of sim.groups) {
    if (C === A || C === B || !(C.pos < A.pos && C.pos > B.pos) || !C.riders.some(x => !x.fin && !x.dnf)) continue;
    const c = boardGapRaw(sim, A, C);
    if (c.v > g.v) {
      g.v = c.v;
      g.ok = g.ok && c.ok;
    }
  }
  return g;
}
function boardGapRaw(sim, A, B) {
  if (A === B) return { v: 0, ok: true };
  if (!realGaps() || !sim.board) return { v: gapSec(A, B), ok: true };
  const a = sim.board.gaps[grpKey(A)],
    b = sim.board.gaps[grpKey(B)];
  if (a != null && b != null && b >= a) return { v: b - a, ok: true, km: sim.board.km };
  // groupe tout juste formé : pas encore de pointage, estimation grossière de la moto
  return { v: Math.max(5, Math.round(gapSec(A, B) / 20) * 20), ok: false };
}
function boardGapTxt(sim, A, B) {
  const g = boardGap(sim, A, B);
  return (g.ok ? '' : '≈ ') + fmtGap(g.v);
}
// Kilomètres depuis le dernier pointage (pour l'interface).
function boardAge(sim) {
  if (!realGaps() || !sim.board) return null;
  let H = null;
  for (const G of sim.groups) if (G.riders.some(x => !x.fin && !x.dnf) && (!H || G.pos > H.pos)) H = G;
  return H ? Math.max(0, H.pos - sim.board.km) : null;
}

// --- Abandons tactiques ---
// Étapes plates (pour sprinteurs) restantes, hors dernière étape.
function flatLeft(rc) {
  return rc.specs.slice(rc.si + 1, rc.specs.length - 1).filter(s => s.type === 'plat').length;
}
// Un autre grand tour à venir dans la saison.
function laterGt(rc) {
  const c = S.cal[rc.calIdx];
  return S.cal.some(x => x.cat === 0 && x.stagesSpec.length > 1 && x.w > c.w + 2 && !x.done);
}
// Entre deux étapes (grands tours) : les équipes de l'ordinateur font rentrer qui n'a plus rien à y faire.
function aiTacticalAbandons(rc) {
  if (rc.cat !== 0 || rc.specs.length < 15 || rc.si < 7 || rc.si >= rc.specs.length - 2) return;
  const gcl = gcList(rc);
  const ptsTop = classOrder(rc, rc.pts).slice(0, 3);
  const later = laterGt(rc);
  const lastFlat = rc.specs[rc.si].type === 'plat' && flatLeft(rc) === 0;
  const restNext = !!rc.specs[rc.si].rest; // (« R » : jour de repos après cette étape)
  if (!lastFlat && !restNext) return;
  for (const T of S.teams) {
    if (T.player) continue;
    for (const id of rc.sel[T.id] || []) {
      if (rc.out[id]) continue;
      const r = S.riders[id];
      const h = dsHash('tac' + rc.key + S.season + ':' + rc.si + ':' + id) % 1000;
      let why = null;
      // un sprinteur juste après la dernière étape plate (hors dernière étape) ; un leader distancé un jour de repos
      if (r.arch === 'sprinteur' && !ptsTop.includes(id) && lastFlat && h < 120) why = 'plus d’étape pour lui';
      else if (later && restNext && r.age <= 32 && overall(r.s) >= 76) {
        const k = gcl.indexOf(id);
        const gap = k > 0 ? rc.gc[id] - rc.gc[gcl[0]] : 0;
        if (k >= 15 && gap > 1200 && ['complet', 'grimpeur'].includes(r.arch) && h < 150) why = 'vise le prochain grand tour';
      }
      if (why) tacticalOut(rc, id, why);
    }
  }
}
function tacticalOut(rc, id, why) {
  const r = S.riders[id];
  rc.out[id] = true;
  gcDirty(rc);
  r.fatigue = Math.max(0, r.fatigue - 8);
  (rc.tacOut = rc.tacOut || []).push({ id, si: rc.si, why });
  const T = teamOf(r);
  if (overall(r.s) >= 76 || (T && T.player))
    press(`${riderName(r)} quitte ${rc.name}`, `${riderName(r)} (${T ? T.name : ''}) ne prendra pas le départ de l'étape ${rc.si + 2} : ${why}.`, 0, [id]);
}
// Votre abandon tactique (entre deux étapes) : le coureur rentre préparer la suite ; l'organisateur n'aime pas ça.
function myTacticalAbandon(id) {
  const rc = S.rc;
  if (!rc || rc.done || rc.specs.length < 2) return 'Seulement entre deux étapes d’une course par étapes.';
  if (!(rc.sel[0] || []).includes(id) || rc.out[id]) return 'Ce coureur n’est plus en course.';
  if (rc.si >= rc.specs.length - 1) return 'C’est la dernière étape.';
  const left = (rc.sel[0] || []).filter(x => !rc.out[x]).length;
  if (left <= 2) return 'Il faut garder au moins deux coureurs en course.';
  const r = S.riders[id];
  const why = r.arch === 'sprinteur' && flatLeft(rc) === 0 ? 'plus d’étape pour lui' : 'il rentre préparer ses prochains objectifs';
  tacticalOut(rc, id, why);
  if (rc.cat === 0) addRep(-0.5);
  return `🏠 ${riderName(r)} quitte ${rc.name} (${why}). Fatigue épargnée pour la suite ; l'organisateur fait la grimace.`;
}
// Vos coureurs à qui un abandon tactique serait raisonnable (suggestion entre deux étapes).
function tacticalSuggest(rc) {
  if (!rc || rc.cat !== 0 || rc.specs.length < 15 || rc.si < 7 || rc.si >= rc.specs.length - 2) return [];
  return (rc.sel[0] || [])
    .filter(id => !rc.out[id])
    .map(id => S.riders[id])
    .filter(r => r.arch === 'sprinteur' && flatLeft(rc) === 0 && !classOrder(rc, rc.pts).slice(0, 3).includes(r.id));
}
