// Retransmission vue du ciel : la route de l'étape en 2D (relief, pavés, vent, routes étroites, kilomètres, flamme
// rouge, sommets, sprint), les coureurs placés dans leur groupe (peloton en masse, échappée en file, éventail en
// diagonale dans une bordure), plusieurs caméras (réalisateur automatique, tête de course, peloton, mes coureurs)
// et quelques sons (cloche, foule, radio), désactivables. Dessin sur un canevas, à son propre rythme d'images :
// la position des groupes est interpolée entre deux pas de la simulation.
import { useEffect, useRef, useState } from 'react';

const CAMS = [
  ['auto', '🎬 Réalisateur'],
  ['tete', 'Tête de course'],
  ['pel', 'Peloton'],
  ['moi', 'Mes coureurs'],
];
// Tracé de la route (mètres) : un cap qui dérive, des lacets dans les montées, des virages plus serrés sur les
// routes étroites. Déterministe (empreinte de l'étape), calculé une fois par étape.
function roadOf(sim) {
  if (sim._road) return sim._road;
  const P = sim.P,
    n = P.n;
  const xs = new Float32Array(n + 1),
    ys = new Float32Array(n + 1),
    hd = new Float32Array(n + 1);
  let h = dsHash(sim.rc.key + '/' + sim.rc.si + 'road');
  const rnd01 = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 10000) / 10000;
  let a = rnd01() * Math.PI * 2,
    x = 0,
    y = 0,
    turn = 0;
  for (let i = 0; i <= n; i++) {
    const g = P.g[Math.min(i, n - 1)] || 0;
    const narrow = P.narrow && P.narrow[Math.min(i, n - 1)];
    if (g >= 5 && rnd01() < 0.25)
      turn = (rnd01() < 0.5 ? -1 : 1) * (0.9 + rnd01() * 0.9); // lacets
    else if (rnd01() < (narrow ? 0.35 : 0.12)) turn = (rnd01() - 0.5) * (narrow ? 0.8 : 0.4);
    a += turn * 0.5;
    turn *= 0.5;
    xs[i] = x;
    ys[i] = y;
    hd[i] = a;
    x += Math.cos(a) * STEP * 1000;
    y += Math.sin(a) * STEP * 1000;
  }
  sim._road = { xs, ys, hd, n };
  return sim._road;
}
// Point de la route au kilomètre km (interpolé) : x, y, cap.
function at(R, km) {
  const f = clamp(km / STEP, 0, R.n - 0.001),
    i = Math.floor(f),
    t = f - i;
  return [R.xs[i] + (R.xs[i + 1] - R.xs[i]) * t, R.ys[i] + (R.ys[i + 1] - R.ys[i]) * t, R.hd[i]];
}
// Moments forts montrés sur la route : icône, couleur du cercle (alpha remplacé), libellé sans coureur.
const SKY_EV = {
  chute: ['💥', 'rgba(239,68,68,A)', 'chute'],
  crevaison: ['🔧', 'rgba(251,191,36,A)', 'crevaison'],
  meca: ['⚙️', 'rgba(251,191,36,A)', 'ennui mécanique'],
  attaque: ['⚡', 'rgba(253,224,71,A)', 'attaque'],
  bordure: ['🌬️', 'rgba(125,211,252,A)', 'bordure !'],
  reprise: ['🔁', 'rgba(148,163,184,A)', 'échappée reprise'],
  moment: ['🎬', 'rgba(244,114,182,A)', 'moment décisif'],
};
const fracNow = () =>
  clamp(
    (UI.acc || 0) +
      ((performance.now() - (UI.loopT || performance.now())) / 1000) * (SPEEDS[UI.speed] || 0),
    0,
    1
  );
const live = sim => sim.groups.filter(G => G.riders.some(x => !x.fin && !x.dnf));
// Groupe suivi par la caméra.
function focusGroup(sim, cam, st) {
  const L = live(sim);
  if (!L.length) return null;
  const head = L.slice().sort((a, b) => b.pos - a.pos)[0];
  const pel = sim.pel && L.includes(sim.pel) ? sim.pel : head;
  const mine = () => {
    const xs = sim.runners.filter(x => x.player && !x.fin && !x.dnf);
    const k = xs.find(x => ['leader', 'sprint'].includes(effOrder(x))) || xs[0];
    return k ? k.g : pel;
  };
  if (cam === 'tete') return head;
  if (cam === 'pel') return pel;
  if (cam === 'moi') return mine();
  // groupe choisi sur la mini-carte
  if (cam === 'grp') return L.find(G => grpKey(G) === st.pick) || head;
  // réalisateur : le final sur la tête ; sinon la tête et le peloton en alternance (toutes les 12 s), et l'action
  // (dernier moment fort) pendant quelques secondes
  const now = performance.now();
  const hls = sim.hls || [];
  const last = hls[hls.length - 1];
  if (last && last !== st.hl) {
    st.hl = last;
    st.hlUntil = now + 6000;
    st.hlG = last.mine ? mine() : head;
  }
  // un incident ou une attaque qui vous concerne (ou un favori, ou dans le final) : la caméra y va
  const ev = (sim.skyEv || []).filter(e => e.mine || e.fav || sim.dist - e.km < 40).slice(-1)[0];
  if (ev && ev !== st.ev && sim.t - ev.t < 3) {
    st.ev = ev;
    const x = ev.id != null && sim.runners.find(y => y.id === ev.id);
    const g = x && !x.fin && !x.dnf ? x.g : L.slice().sort((a, b) => Math.abs(a.pos - ev.km) - Math.abs(b.pos - ev.km))[0];
    if (g) {
      st.hlUntil = now + 6000;
      st.hlG = g;
    }
  }
  if (st.hlUntil > now && st.hlG && L.includes(st.hlG)) return st.hlG;
  if (sim.dist - head.pos < 15 || head === pel) return head;
  return Math.floor(now / 12000) % 2 ? pel : head;
}
// Sons (Web Audio) : cloche, foule (bruit filtré), bip radio.
const AUD = { ctx: null, crowd: null, gain: null };
function audio() {
  if (AUD.ctx) return AUD.ctx;
  try {
    AUD.ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    AUD.ctx = null;
  }
  return AUD.ctx;
}
function bell() {
  const c = audio();
  if (!c) return;
  for (const [f, d] of [
    [880, 0],
    [1320, 0.02],
  ]) {
    const o = c.createOscillator(),
      g = c.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, c.currentTime + d);
    g.gain.exponentialRampToValueAtTime(0.25, c.currentTime + d + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + d + 1.6);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + d);
    o.stop(c.currentTime + d + 1.7);
  }
}
function crowd(level) {
  const c = audio();
  if (!c) return;
  if (!AUD.crowd) {
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource();
    s.buffer = b;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 0.6;
    AUD.gain = c.createGain();
    AUD.gain.gain.value = 0;
    s.connect(f).connect(AUD.gain).connect(c.destination);
    s.start();
    AUD.crowd = s;
  }
  AUD.gain.gain.setTargetAtTime(level * 0.12, c.currentTime, 0.4);
}
function beep() {
  const c = audio();
  if (!c) return;
  const o = c.createOscillator(),
    g = c.createGain();
  o.type = 'square';
  o.frequency.value = 1200;
  g.gain.value = 0.04;
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.12);
}

function draw(cv, sim, cam, st) {
  if (!cv || !sim || !sim.P) return;
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth,
    H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
  }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const R = roadOf(sim);
  const frac = fracNow();
  const G0 = focusGroup(sim, cam, st);
  if (!G0) return;
  st.G0 = G0;
  const fKm = Math.min(sim.dist, ipos(G0, frac));
  // zoom : la caméra cadre le groupe suivi (sa longueur réelle, quelques rangs de coureurs) avec de la marge
  const nG = G0.riders.filter(x => !x.fin && !x.dnf).length;
  const hardG = G0.speed > 50 || G0.riders.some(y => y.work >= 0.92);
  let wG = nG <= 3 ? 1 : nG <= 10 ? 2 : clamp(Math.ceil(Math.sqrt(nG) * 0.75), 3, 8);
  if (hardG && wG > 2) wG = Math.max(2, Math.ceil(wG * 0.55));
  const len = Math.ceil(nG / wG) * (wG === 1 ? 2.2 : 1.7);
  // cadrage serré sur le groupe ; plan élargi quand un autre groupe est tout proche (jonction, échappée qui va être
  // reprise) : les deux groupes sont alors à l'image
  // zoom du joueur (boutons − / +) : par défaut plus serré sur téléphone, où l'image est étroite
  const zf = clamp(UI.skyZoom || (W < 600 ? 1.6 : 1.15), 0.5, 3.5);
  st.zf = zf;
  let span = clamp((len * 1.3 + 20) / zf, 16, 380);
  let mid = fKm - len / 2000;
  const near = live(sim)
    .filter(G => G !== G0)
    .map(G => [G, ipos(G, frac)])
    .filter(([, k]) => Math.abs(k - fKm) * 1000 < 320)
    .sort((a, b) => Math.abs(a[1] - fKm) - Math.abs(b[1] - fKm))[0];
  // (seulement si le joueur n'a pas choisi le gros plan)
  if (near && zf <= 1.2) {
    // plan élargi : de la queue du groupe le plus en arrière à la tête du plus en avant (un gros peloton est long)
    const nN = near[0].riders.filter(x => !x.fin && !x.dnf).length;
    const nLen = (Math.ceil(nN / clamp(Math.ceil(Math.sqrt(nN) * 0.75), 1, 8)) * 1.7) / 1000;
    const front = Math.max(fKm, near[1]);
    const rear = Math.min(fKm - len / 1000, near[1] - nLen);
    span = clamp(Math.max(span, (front - rear) * 1000 * 1.25 + 40), 40, 520);
    mid = (front + rear) / 2;
  }
  st.near = near ? near[0] : null;
  // (mouvement de caméra fluide ; saut direct si le groupe filmé change ou après une avance rapide)
  // la caméra est accrochée au groupe filmé (position exacte à chaque image) : seuls le zoom et le cadrage autour
  // de lui (plan élargi vers un groupe voisin) sont lissés. Avant, elle courait derrière le groupe avec un retard
  // qui grandissait avec la vitesse de lecture ; sur téléphone, le groupe sortait de l'image.
  const off = mid - fKm;
  if (st.off == null || st.lastG !== G0) {
    st.off = off;
    st.span = span;
  } else {
    st.span = st.span ? st.span + (span - st.span) * 0.06 : span;
    st.off = st.off + (off - st.off) * 0.08;
  }
  st.lastG = G0;
  st.mid = fKm + st.off;
  // (sur grand écran, le classement des écarts occupe la droite de l'image : on cadre dans la partie libre)
  const padR = !st.compact && W >= 600 ? 200 : 0;
  const CX = (W - padR) / 2;
  const sc = (W - padR) / st.span; // pixels par mètre
  // (l'image est centrée sur le milieu du groupe, un peu en avant : on voit la route qui arrive)
  const [fx, fy, fh] = at(R, st.mid + (st.near ? 0 : (st.span * 0.06) / 1000));
  st.h = st.h == null ? fh : st.h + Math.atan2(Math.sin(fh - st.h), Math.cos(fh - st.h)) * 0.04;
  const P = sim.P;
  const iAt = km => clamp(Math.floor(km / STEP), 0, P.n - 1);
  // fond : la campagne (plus sombre en montagne)
  const gF = P.g[iAt(fKm)] || 0;
  c.fillStyle = gF >= 6 ? '#2a2f24' : gF >= 3 ? '#27352a' : gF <= -3 ? '#1d3530' : '#21392d';
  c.fillRect(0, 0, W, H);
  c.save();
  c.translate(CX, H * 0.55);
  c.scale(sc, sc);
  c.rotate(-st.h);
  c.translate(-fx, -fy);
  const k0 = Math.max(0, fKm - st.span / 1000),
    k1 = Math.min(sim.dist, fKm + st.span / 1000);
  // décor : arbres et champs le long de la route, maisons sur les routes étroites (villages), spectateurs dans le
  // dernier kilomètre des cols et dans le final (tout est tiré d'une empreinte : il ne bouge pas d'une image à l'autre)
  for (let m = Math.floor((k0 * 1000) / 22) * 22; m < k1 * 1000; m += 22) {
    const hsh = dsHash('d' + sim.rc.key + sim.rc.si + m);
    const [x, y, h] = at(R, m / 1000);
    const side = hsh & 1 ? 1 : -1;
    const i = iAt(m / 1000);
    const nx = Math.cos(h + 1.5708) * side,
      ny = Math.sin(h + 1.5708) * side;
    // champs en bandes le long de la route (texture discrète), quelques arbres
    if (hsh % 4 === 0) {
      c.save();
      c.translate(x + nx * 22, y + ny * 22);
      c.rotate(h);
      c.fillStyle = (hsh >>> 4) % 3 === 0 ? 'rgba(163,190,120,0.07)' : 'rgba(30,60,40,0.25)';
      c.fillRect(-11, -9, 22, 18);
      c.restore();
    }
    if (hsh % 9 < 2) {
      const d = 9 + ((hsh >>> 3) % 18);
      c.beginPath();
      c.arc(x + nx * d, y + ny * d, 1.2 + ((hsh >>> 8) % 2) * 0.6, 0, Math.PI * 2);
      c.fillStyle = (hsh >>> 5) % 3 ? '#1f4d2f' : '#245a36';
      c.fill();
    } else if (P.narrow && P.narrow[i] && hsh % 7 === 3) {
      c.fillStyle = (hsh >>> 6) % 2 ? '#78350f' : '#57534e';
      c.save();
      c.translate(x + nx * 12, y + ny * 12);
      c.rotate(h);
      c.fillRect(-4, -3, 8, 6);
      c.restore();
    }
    const nearTop = (sim.klimbs || []).some(cl => m / 1000 > cl.end - 1 && m / 1000 <= cl.end);
    if (nearTop || sim.dist - m / 1000 < 1) {
      for (let q = 0; q < 3; q++) {
        const hq = dsHash('s' + m + q);
        const sd = hq & 1 ? 1 : -1;
        c.fillStyle = ['#f87171', '#fbbf24', '#60a5fa', '#f8fafc', '#a3e635'][hq % 5];
        c.beginPath();
        c.arc(
          x + Math.cos(h + 1.5708) * sd * (6 + (hq % 3)) + Math.cos(h) * q * 6,
          y + Math.sin(h + 1.5708) * sd * (6 + (hq % 3)) + Math.sin(h) * q * 6,
          0.45,
          0,
          Math.PI * 2
        );
        c.fill();
      }
    }
  }
  // route : asphalte, pavés, portions exposées (vent), routes étroites, pente (bas-côtés colorés)
  const seg = (a, b, col, wid, dash) => {
    c.beginPath();
    // (points tous les 20 m, puis exactement le bout du tronçon : sinon les arrondis laissaient un trou)
    const nSteps = Math.max(1, Math.ceil((b - a) / 0.02));
    for (let q = 0; q <= nSteps; q++) {
      const [x, y] = at(R, a + ((b - a) * q) / nSteps);
      q ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.strokeStyle = col;
    c.lineWidth = wid;
    c.setLineDash(dash || []);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke();
    c.setLineDash([]);
  };
  // (par couches : tous les bas-côtés, puis tout l'asphalte, puis le marquage ; sinon les virages se recouvrent)
  const kStart = Math.floor(k0 / STEP) * STEP;
  for (let km = kStart; km < k1; km += STEP) {
    const i = iAt(km);
    const g = P.g[i] || 0;
    const edge = g >= 7 ? '#b91c1c' : g >= 4 ? '#c2410c' : g >= 2 ? '#a16207' : g <= -4 ? '#0e7490' : '#3f6212';
    seg(km, km + STEP, edge, P.narrow && P.narrow[i] ? 7 : 11);
  }
  for (let km = kStart; km < k1; km += STEP) {
    const i = iAt(km);
    seg(km, km + STEP, P.surf && P.surf[i] ? '#78716c' : '#3b3f46', P.narrow && P.narrow[i] ? 4.5 : 8);
  }
  for (let km = kStart; km < k1; km += STEP) {
    const i = iAt(km);
    if (P.surf && P.surf[i]) seg(km, km + STEP, '#a8a29e', 6, [1.2, 1.4]);
    else seg(km, km + STEP, '#cbd5e1', 0.25, [4, 6]);
    if (P.expo && P.expo[i] && P.wind) {
      // vent de côté : trois petits traits sur le bas-côté
      const [x, y, h] = at(R, km + STEP / 2);
      c.strokeStyle = 'rgba(103,232,249,0.6)';
      c.lineWidth = 0.6;
      for (let q = -1; q <= 1; q++) {
        const ox = x + Math.cos(h + 1.5708) * 11 + Math.cos(h) * q * 6,
          oy = y + Math.sin(h + 1.5708) * 11 + Math.sin(h) * q * 6;
        c.beginPath();
        c.moveTo(ox, oy);
        c.lineTo(ox + Math.cos(h + 1.5708) * 4, oy + Math.sin(h + 1.5708) * 4);
        c.stroke();
      }
    }
  }
  // repères : kilomètres, flamme rouge, arrivée, sommets, sprint intermédiaire
  const labels = [];
  const across = (km, col, w, lbl) => {
    if (km < k0 || km > k1) return;
    const [x, y, h] = at(R, km);
    c.save();
    c.translate(x, y);
    c.rotate(h);
    c.fillStyle = col;
    c.fillRect(-w / 2, -7, w, 14);
    c.restore();
    if (lbl) labels.push([x, y, lbl, '#f8fafc', 'mk']);
  };
  for (let k = Math.ceil(sim.dist - k1); k <= sim.dist - k0; k++) {
    const km = sim.dist - k;
    if (k === 1) across(km, '#dc2626', 2.5, '🚩 1 km');
    else if (k > 0 && k <= 10) across(km, 'rgba(248,250,252,0.5)', 0.8, `${k} km`);
    else if (k > 0 && k % 5 === 0) across(km, 'rgba(248,250,252,0.35)', 0.6, `${k} km`);
  }
  if (sim.dist <= k1) {
    const [x, y, h] = at(R, sim.dist);
    c.save();
    c.translate(x, y);
    c.rotate(h);
    for (let q = 0; q < 6; q++)
      for (let r = 0; r < 2; r++) {
        c.fillStyle = (q + r) % 2 ? '#0f172a' : '#f8fafc';
        c.fillRect(-1.5 + r * 1.5, -7 + q * 2.33, 1.5, 2.33);
      }
    c.restore();
  }
  for (const cl of sim.klimbs || []) across(cl.end, '#f8fafc', 1.2, `⛰️ ${cl.name}`);
  if (sim.isp) across(sim.isp.at, '#16a34a', 1.2, '🟢 sprint');
  // coureurs : rangs du groupe (placement), largeur selon la taille, éventail en bordure, file dans l'échappée
  const leaderId = sim.stageRace && sim.rc.gc ? gcCached(sim.rc).arr[0] : null;
  // (le coureur touché par un incident récent garde son icône au-dessus de lui)
  const posOf = new Map();
  const groups = []; // (capsules et étiquettes des groupes, dessinées à l'écran après la scène)
  const rpx = clamp(sc * 0.42, 3.2, 6.5); // rayon d'un coureur à l'écran (px)
  // gros plan (au moins 7 px par mètre) : de vrais petits cyclistes, leurs noms, les réserves de mes coureurs
  const det = sc >= 7;
  const allPts = []; // (coureurs à l'image, pour les toucher et pour les jauges)
  const H0 = live(sim).slice().sort((a, b) => b.pos - a.pos)[0];
  const pelG = sim.pel && live(sim).includes(sim.pel) ? sim.pel : H0;
  const evOf = new Map((sim.skyEv || []).filter(e => e.id != null && sim.t - e.t <= 3).map(e => [e.id, e]));
  // positions affichées des coureurs : elles suivent exactement leur groupe, mais glissent en douceur vers leur
  // place dans le groupe (≈ 0,5 s) ; une jonction se voit (les coureurs rejoignent l'autre groupe au lieu d'y être
  // téléportés) et les échanges de place dans le peloton ne sautent plus
  const nowT = performance.now();
  const aEase = st.rpT ? 1 - Math.exp(-Math.min(200, nowT - st.rpT) / 450) : 1;
  st.rpT = nowT;
  if (!st.rp || st.rpSim !== sim) {
    st.rp = new Map();
    st.rpSim = sim;
  }
  for (const G of live(sim)) {
    const gKm = ipos(G, frac);
    if (gKm < k0 - 0.3 || gKm > k1 + 0.3) continue;
    // (ordre stable : seuls les vrais changements de placement font bouger un coureur dans le groupe)
    const xs = G.riders
      .filter(x => !x.fin && !x.dnf)
      .sort((a, b) => Math.round(b.pos / 15) - Math.round(a.pos / 15) || a.id - b.id);
    const n = xs.length;
    // le peloton est plus long que large ; à vive allure (ou quand une équipe roule à bloc) il s'étire en file
    const hard = G.speed > 50 || G.riders.some(y => y.work >= 0.92);
    let wid = n <= 3 ? 1 : n <= 10 ? 2 : clamp(Math.ceil(Math.sqrt(n) * 0.75), 3, 8);
    if (hard && wid > 2) wid = Math.max(2, Math.ceil(wid * 0.55));
    const ech = sim.echelon && sim.echelon.T && G.expo && sim.P.wind && sim.t < sim.echelon.until;
    let front = null,
      rear = null;
    const pts = [];
    xs.forEach((x, k) => {
      const row = Math.floor(k / wid),
        col = k % wid;
      const back = row * (wid === 1 ? 2.2 : 1.7) + ((x.id * 37) % 7) * 0.08;
      let lat = (col - (wid - 1) / 2) * 0.95 + (((x.id * 53) % 9) - 4) * 0.05;
      if (ech) lat += row * 0.55 - 3; // éventail en diagonale, contre le vent
      const tOff = -back / 1000;
      let rp = st.rp.get(x.id);
      if (!rp || Math.abs(rp.abs - (gKm + tOff)) > 0.6) rp = { off: tOff, lat, G };
      else {
        if (rp.G !== G) rp.off = rp.abs - gKm; // il change de groupe : il part d'où il était
        rp.off += (tOff - rp.off) * aEase;
        rp.lat += (lat - rp.lat) * aEase;
      }
      rp.G = G;
      rp.abs = gKm + rp.off;
      rp.seen = nowT;
      st.rp.set(x.id, rp);
      const [x0, y0, h] = at(R, rp.abs);
      const px = x0 + Math.cos(h + 1.5708) * rp.lat,
        py = y0 + Math.sin(h + 1.5708) * rp.lat;
      if (evOf.has(x.id)) posOf.set(x.id, [px, py]);
      if (!front || rp.abs > front[2]) front = [x0, y0, rp.abs];
      if (!rear || rp.abs < rear[2]) rear = [x0, y0, rp.abs];
      pts.push([x, px, py, h]);
    });
    // capsule du groupe (sous les coureurs) : couleur selon son rôle dans la course
    const kind = G === H0 && G !== pelG ? 'tete' : G === pelG ? 'pel' : G.pos > pelG.pos ? 'chasse' : 'retard';
    if (front) {
      const KC = { tete: '242,201,76', pel: '232,236,241', chasse: '125,211,252', retard: '149,161,179' };
      const wdt = (wid - 1) * 0.95 + (2 * rpx + 10) / sc;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(rear[0], rear[1]);
      c.lineTo(front[0] + 0.001, front[1]);
      c.strokeStyle = `rgba(${KC[kind]},${(G === G0 ? 0.55 : 0.3) * (det ? 0.45 : 1)})`;
      c.lineWidth = wdt + 2.4 / sc;
      c.stroke();
      c.strokeStyle = 'rgba(14,20,28,0.55)';
      c.lineWidth = wdt;
      c.stroke();
    }
    for (const [x, px, py, hh] of pts) {
      const me = x.player;
      allPts.push([x, px, py]);
      if (det) drawRider(c, x, px, py, hh, sc, x.id === leaderId, nowT / 1000);
      else {
        const rr = (rpx * (me ? 1.3 : 1)) / sc;
        c.beginPath();
        c.arc(px, py, rr, 0, Math.PI * 2);
        c.fillStyle = x.team.color || '#cbd5e1';
        c.fill();
        // contour : leader du général (jaune), vos coureurs (rose), coureur qui roule (blanc), sinon un liseré sombre
        c.lineWidth = (me || x.id === leaderId ? 2 : 1.2) / sc;
        c.strokeStyle = x.id === leaderId ? '#facc15' : me ? '#f472b6' : x.work > 0 ? 'rgba(248,250,252,0.95)' : 'rgba(10,14,20,0.8)';
        c.stroke();
      }
      // en gros plan, les coureurs des petits groupes sont nommés
      if (det && !me && !sim.favs.has(x.id) && n <= 12) labels.push([px, py, riderName(x.r), '#cbd5e1', false]);
      if (sim.favs.has(x.id) && !me && st.span < 170) labels.push([px, py, '★ ' + riderName(x.r), '#e2e8f0', false]);
      if (G.attacker === x && G.burst > 0) labels.push([px, py, '⚡', '#fde047', true]);
      else if (evOf.has(x.id) && evOf.get(x.id).kind !== 'reprise')
        labels.push([px, py, (SKY_EV[evOf.get(x.id).kind] || SKY_EV.moment)[0], '#fde68a', true]);
      if (me && st.span < 420) labels.push([px, py, riderName(x.r), '#fbcfe8', false]);
    }
    if (front) {
      groups.push({ front, rear, wid, n, kind, mine: xs.some(y => y.player), G, focus: G === G0 });
    }
  }
  // moments forts à l'endroit où ils se produisent (chute, crevaison, ennui mécanique, attaque, bordure, reprise) :
  // un cercle qui pulse sur la route pendant trois minutes de course, et le nom du coureur concerné
  const pulse = (performance.now() % 1200) / 1200;
  for (const e of sim.skyEv || []) {
    const age = sim.t - e.t;
    // (le cercle suit le coureur concerné s'il est à l'image ; sinon il reste à l'endroit de l'incident)
    const onRider = e.id != null && posOf.get(e.id);
    if (age > 3 || (!onRider && (e.km < k0 || e.km > k1))) continue;
    const S0 = SKY_EV[e.kind] || SKY_EV.moment;
    const [x, y] = onRider || at(R, e.km);
    const fade = 1 - age / 3;
    c.beginPath();
    c.arc(x, y, (6 + pulse * 10) * Math.max(1, 3 / sc), 0, Math.PI * 2);
    c.lineWidth = Math.max(0.4, 2 / sc);
    c.strokeStyle = S0[1].replace('A)', (fade * (1 - pulse)).toFixed(2) + ')');
    c.stroke();
    const who = e.id != null && ['chute', 'crevaison', 'meca', 'attaque'].includes(e.kind) && sim.runners.find(z => z.id === e.id);
    labels.unshift([x, y, S0[0] + (who ? ' ' + riderName(who.r) : ' ' + S0[2]), e.mine ? '#f9a8d4' : '#fde68a', 'ev']);
  }
  // étiquettes, toujours horizontales à l'écran
  c.restore();
  const toScr = (x, y) => {
    const dx = x - fx,
      dy = y - fy;
    const cs = Math.cos(-st.h),
      sn = Math.sin(-st.h);
    return [CX + (dx * cs - dy * sn) * sc, H * 0.55 + (dx * sn + dy * cs) * sc];
  };
  // coureurs à toucher (fiche) ; en gros plan, jauge de réserves et effort du moment au-dessus de mes coureurs
  st.hits = [];
  for (const [x, px, py] of allPts) {
    const [sx, sy] = toScr(px, py);
    if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
    st.hits.push([sx, sy, x.id]);
    if (det && x.player) {
      const e = clamp(x.energy / 100, 0, 1);
      const bx = sx - 8,
        by = sy - 0.9 * sc - 6;
      c.fillStyle = 'rgba(10,14,20,0.85)';
      c.fillRect(bx - 1, by - 1, 18, 5);
      c.fillStyle = e > 0.5 ? '#4ade80' : e > 0.25 ? '#facc15' : '#f43f5e';
      c.fillRect(bx, by, 16 * e, 3);
      const I = x.I || 0;
      c.fillStyle = I < 0.6 ? '#34d399' : I < 0.8 ? '#fde047' : I < 0.95 ? '#fb923c' : '#f43f5e';
      c.beginPath();
      c.arc(bx + 21, by + 1.5, 2.5, 0, Math.PI * 2);
      c.fill();
    }
  }
  const used = [];
  // étiquettes des groupes : rôle, effectif, écart annoncé ; liseré de couleur (jaune : tête ; blanc : peloton ;
  // bleu : contre ; gris : retardataires) et bord rose s'il y a l'un de vos coureurs
  const KCOL = { tete: '#f2c94c', pel: '#e8ecf1', chasse: '#7dd3fc', retard: '#95a1b3' };
  for (const g of groups.sort((a, b) => b.focus - a.focus)) {
    const [sx, sy] = toScr(g.front[0], g.front[1]);
    if (sx < -60 || sx > W + 60) continue;
    const xs0 = g.G.riders.filter(x => !x.fin && !x.dnf);
    const nm =
      g.kind === 'tete'
        ? g.n === 1
          ? riderName(xs0[0].r)
          : `Échappée · ${g.n}`
        : g.kind === 'pel'
          ? `Peloton · ${g.n}`
          : g.n === 1
            ? riderName(xs0[0].r)
            : `${g.kind === 'chasse' ? 'Contre' : 'Groupe'} · ${g.n}`;
    const gap = g.G === H0 ? '' : boardGapTxt(sim, H0, g.G);
    c.font = '600 12px "Barlow Semi Condensed", sans-serif';
    const w1 = c.measureText(nm).width;
    c.font = '12px "Barlow Semi Condensed", sans-serif';
    const w2 = gap ? c.measureText(gap).width + 8 : 0;
    const w = w1 + w2 + 16;
    let yy = sy - 18 - rpx * 1.4;
    if (yy < 30) yy = sy + 26 + rpx;
    const x0 = Math.max(4, Math.min(W - padR - w - 4, sx - w / 2));
    if (used.some(u => Math.abs(u[0] - (x0 + w / 2)) < (u[2] + w) / 2 && Math.abs(u[1] - yy) < 18)) continue;
    used.push([x0 + w / 2, yy, w]);
    c.fillStyle = 'rgba(15,19,26,0.88)';
    c.beginPath();
    c.roundRect ? c.roundRect(x0, yy - 13, w, 19, 4) : c.rect(x0, yy - 13, w, 19);
    c.fill();
    if (g.mine) {
      c.strokeStyle = '#f472b6';
      c.lineWidth = 1.2;
      c.stroke();
    }
    c.fillStyle = KCOL[g.kind];
    c.fillRect(x0, yy - 13, 4, 19);
    c.fillStyle = '#f5f7fa';
    c.font = '600 12px "Barlow Semi Condensed", sans-serif';
    c.fillText(nm, x0 + 10, yy + 1);
    if (gap) {
      c.fillStyle = g.kind === 'tete' ? '#f2c94c' : '#b9c2cf';
      c.font = '12px "Barlow Semi Condensed", sans-serif';
      c.fillText(gap, x0 + 10 + w1 + 6, yy + 1);
    }
  }
  for (const [x, y, t, col, kind] of labels) {
    const [sx, sy] = toScr(x, y);
    if (sx < -40 || sx > W + 40) continue;
    const yy = kind === 'grp' ? sy - 18 : kind === true ? sy - 8 : kind === 'mk' ? sy - 12 : kind === 'ev' ? sy + 26 : sy + 14;
    const wNear = kind === 'grp' || kind === 'ev' ? 90 : 60;
    if (used.some(u => Math.abs(u[0] - sx) < wNear && Math.abs(u[1] - yy) < 13)) continue;
    used.push([sx, yy]);
    c.font = kind === 'grp' ? 'bold 11px sans-serif' : kind === 'mk' ? 'bold 10px sans-serif' : '10px sans-serif';
    const w = c.measureText(t).width;
    if (kind === 'grp' || kind === 'ev') {
      c.fillStyle = kind === 'ev' ? 'rgba(127,29,29,0.8)' : 'rgba(15,23,42,0.75)';
      c.fillRect(sx - w / 2 - 4, yy - 11, w + 8, 15);
    }
    c.fillStyle = col;
    c.fillText(t, sx - w / 2, yy);
  }
  // bandeau du haut : km restants, pente (couleur selon la difficulté), vent (sens par rapport à la route, qui va
  // vers la droite de l'image), vitesse du groupe, caméra
  const kmL = Math.max(0, sim.dist - fKm);
  c.fillStyle = 'rgba(15,19,26,0.82)';
  c.fillRect(0, 0, W, 28);
  c.textBaseline = 'middle';
  let hx = 10;
  c.fillStyle = '#f5f7fa';
  c.font = '700 18px "Barlow Semi Condensed", sans-serif';
  const kmT = kmL < 10 ? kmL.toFixed(1).replace('.', ',') : String(Math.round(kmL));
  c.fillText(kmT, hx, 14);
  hx += c.measureText(kmT).width + 3;
  c.font = '11px "Barlow", sans-serif';
  c.fillStyle = '#95a1b3';
  c.fillText('km', hx, 15);
  hx += 26;
  const gcol = gF >= 6 ? '#f26b6f' : gF >= 3 ? '#ff9d52' : gF <= -3 ? '#7dd3fc' : '#d4dae2';
  c.fillStyle = gcol;
  c.font = '600 15px "Barlow Semi Condensed", sans-serif';
  const gT = (gF >= 0.5 ? '↗ ' : gF <= -0.5 ? '↘ ' : '→ ') + Math.abs(gF).toFixed(1).replace('.', ',') + ' %';
  c.fillText(gT, hx, 14);
  hx += c.measureText(gT).width + 22;
  // vent
  const hw = typeof headwindAt === 'function' ? headwindAt(sim, fKm) : 0;
  const cross = P.expo && P.expo[iAt(fKm)] && (P.wind || 0) >= 2;
  const wk = cross ? 'côté' : Math.abs(hw) < 1 ? 'faible' : hw > 0 ? 'face' : 'dos';
  if (W > 360) {
    c.save();
    c.translate(hx + 8, 14);
    c.rotate(wk === 'face' ? Math.PI : wk === 'côté' ? Math.PI / 2 : 0);
    c.strokeStyle = wk === 'côté' ? '#7dd3fc' : '#b9c2cf';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-7, 0);
    c.lineTo(6, 0);
    c.moveTo(2, -4);
    c.lineTo(6, 0);
    c.lineTo(2, 4);
    c.stroke();
    c.restore();
    c.fillStyle = wk === 'côté' ? '#7dd3fc' : '#d4dae2';
    c.font = '12px "Barlow", sans-serif';
    c.fillText(`vent ${wk === 'faible' ? 'faible' : 'de ' + wk}${wk !== 'faible' && wk !== 'côté' ? ' ' + Math.round(Math.abs(hw) * 3.6) + ' km/h' : ''}`, hx + 20, 15);
  }
  const cl = (CAMS.find(a => a[0] === cam) || [cam, 'Groupe choisi'])[1].replace(/^\S+ /, '');
  c.font = '600 14px "Barlow Semi Condensed", sans-serif';
  const spT = `${G0.speed ? Math.round(G0.speed) : 0} km/h`;
  const spW = c.measureText(spT).width;
  c.fillStyle = '#f5f7fa';
  c.fillText(spT, W - spW - 10, 14);
  if (W > 520) {
    c.font = '11px "Barlow", sans-serif';
    const cw = c.measureText(cl).width;
    c.fillStyle = '#95a1b3';
    c.fillText(cl, W - spW - cw - 22, 15);
  }
  c.textBaseline = 'alphabetic';
  // bandeau d'événement (bas de l'image) : la dernière action marquante, pendant une minute et demie de course
  const evL = (sim.skyEv || []).filter(e => sim.t - e.t <= 1.5 && (e.mine || e.fav || e.kind !== 'attaque')).slice(-1)[0];
  if (evL) {
    const S1 = SKY_EV[evL.kind] || SKY_EV.moment;
    const who = evL.id != null ? sim.runners.find(z => z.id === evL.id) : null;
    const txt = `${S1[0]}  ${S1[2].charAt(0).toUpperCase() + S1[2].slice(1)}${who ? ' : ' + riderName(who.r) + ' (' + who.team.short + ')' : ''}`;
    c.font = '600 14px "Barlow Semi Condensed", sans-serif';
    const tw = c.measureText(txt).width + 24;
    c.fillStyle = evL.mine ? 'rgba(157,23,77,0.92)' : 'rgba(15,19,26,0.9)';
    c.beginPath();
    c.roundRect ? c.roundRect(10, H - 40, tw, 28, 5) : c.rect(10, H - 40, tw, 28);
    c.fill();
    c.fillStyle = S1[1].replace('A)', '1)');
    c.fillRect(10, H - 40, 4, 28);
    c.fillStyle = '#f5f7fa';
    c.fillText(txt, 22, H - 21);
  }
  // sons : cloche au dernier kilomètre et à l'arrivée de la tête, foule dans le final et en haut des cols
  if (UI.skySound) {
    const L = live(sim);
    const head = L.slice().sort((a, b) => b.pos - a.pos)[0];
    const hk = head ? sim.dist - head.pos : 99;
    if (hk <= 1 && !st.bell1) {
      st.bell1 = true;
      bell();
    }
    if (sim.finish.length && !st.bell2) {
      st.bell2 = true;
      bell();
    }
    const nearTop = (sim.klimbs || []).some(cl2 => fKm > cl2.end - 1.5 && fKm < cl2.end + 0.1);
    crowd(kmL < 3 ? 1 : nearTop ? 0.7 : gF >= 6 ? 0.35 : 0.05);
    if (sim.ask && sim.ask !== st.ask) {
      st.ask = sim.ask;
      beep();
    }
  } else if (AUD.gain) AUD.gain.gain.value = 0;
}

// Ce que montre la caméra, en clair : le groupe, son écart, qui roule, vos coureurs, les favoris, le terrain, le dernier
// incident.
function SkyCaption({ sim, G }) {
  const L = live(sim).sort((a, b) => b.pos - a.pos);
  if (!G || !L.includes(G)) return null;
  const H = L[0];
  const pel = sim.pel && L.includes(sim.pel) ? sim.pel : H;
  const xs = G.riders.filter(x => !x.fin && !x.dnf);
  const n = xs.length;
  const name =
    G === H && G !== pel
      ? n === 1
        ? `${riderName(xs[0].r)} seul en tête`
        : `Échappée de ${n}`
      : G === pel
        ? `Peloton (${n})`
        : n === 1
          ? riderName(xs[0].r)
          : `Groupe de ${n}`;
  const gap = G === H ? (pel !== H ? ` · ${boardGapTxt(sim, H, pel)} d'avance sur le peloton` : '') : ` · à ${boardGapTxt(sim, H, G)}`;
  const work = [...new Set(xs.filter(x => x.work > 0).map(x => (x.team.player ? 'votre équipe' : x.team.short)))];
  const mine = xs.filter(x => x.player);
  const favs = xs.filter(x => !x.player && sim.favs.has(x.id)).slice(0, 3);
  const km = Math.max(0, sim.dist - G.pos);
  const g = G.g || 0;
  const cl = (sim.klimbs || []).find(c => c.end > G.pos && c.start <= G.pos + 0.05);
  const terrain = cl
    ? `${cl.name} : ${g.toFixed(1).replace('.', ',')} %, sommet dans ${fmtDec(cl.end - G.pos, 1)} km`
    : G.surf
      ? 'secteur pavé'
      : G.expo && (sim.P.wind || 0) >= 2
        ? 'vent de côté : une bordure peut se former'
        : g <= -3
          ? `descente (${g.toFixed(1).replace('.', ',')} %)`
          : '';
  const ev = (sim.skyEv || []).filter(e => sim.t - e.t < 3).slice(-1)[0];
  const evR = ev && ev.id != null ? sim.runners.find(z => z.id === ev.id) : null;
  return (
    <div className="border-t border-slate-800 px-3 py-2 text-sm" aria-live="polite">
      <div className="font-display text-base font-semibold text-slate-50">
        {name}
        <span className="font-normal text-slate-300">{gap}</span>
        <span className="float-right font-normal text-slate-400">{km < 10 ? fmtDec(km, 1) : Math.round(km)} km</span>
      </div>
      <div className="text-xs text-slate-300">
        {work.length ? `Roulent : ${work.join(', ')}` : 'Personne ne roule'}
        {terrain ? ` · ${terrain}` : ''}
      </div>
      {mine.length || favs.length ? (
        <div className="text-xs">
          {mine.length ? <span className="text-pink-300">Vos coureurs : {mine.map(x => riderName(x.r)).join(', ')}</span> : null}
          {mine.length && favs.length ? <span className="text-slate-500"> · </span> : null}
          {favs.length ? <span className="text-slate-300">Favoris : {favs.map(x => riderName(x.r)).join(', ')}</span> : null}
        </div>
      ) : null}
      {ev ? (
        <div className="text-xs text-amber-300">
          {(SKY_EV[ev.kind] || SKY_EV.moment)[0]} {evR ? riderName(evR.r) + ' : ' : ''}
          {(SKY_EV[ev.kind] || SKY_EV.moment)[2]}
        </div>
      ) : null}
    </div>
  );
}
// Rôle d'un groupe dans la course (tête, peloton, contre, retardataires) et son libellé.
function grpRole(sim, G, H, pel) {
  return G === H && G !== pel ? 'tete' : G === pel ? 'pel' : G.pos > pel.pos ? 'chasse' : 'retard';
}
const ROLE_COL = { tete: '#f2c94c', pel: '#e8ecf1', chasse: '#7dd3fc', retard: '#6b7686' };
function grpName(G, role, n) {
  const xs = G.riders.filter(x => !x.fin && !x.dnf);
  if (n === 1) return riderName(xs[0].r);
  return role === 'tete' ? 'Échappée' : role === 'pel' ? 'Peloton' : role === 'chasse' ? 'Contre' : 'Groupe';
}
// Échelle des écarts, comme à la télévision : tous les groupes de la tête au dernier, effectif, écart annoncé, vos
// coureurs. Un clic filme le groupe.
function GapLadder({ sim, G0, onPick, chips }) {
  const L = live(sim).sort((a, b) => b.pos - a.pos);
  if (!L.length) return null;
  const H = L[0];
  const pel = sim.pel && L.includes(sim.pel) ? sim.pel : H;
  const rows = L.slice(0, chips ? 8 : 6).map(G => {
    const n = G.riders.filter(x => !x.fin && !x.dnf).length;
    const role = grpRole(sim, G, H, pel);
    const mine = G.riders.filter(x => x.player && !x.fin && !x.dnf).length;
    return { G, n, role, mine, gap: G === H ? 'Tête' : boardGapTxt(sim, H, G), name: grpName(G, role, n) };
  });
  const more = L.length - rows.length;
  if (chips)
    return (
      <div className="flex gap-1.5 overflow-x-auto border-t border-slate-800 px-3 py-2" aria-label="Écarts entre les groupes">
        {rows.map(r => (
          <button
            key={grpKey(r.G)}
            type="button"
            onClick={() => onPick(r.G)}
            className={
              'flex shrink-0 items-center gap-1.5 rounded-md bg-slate-800 px-2 py-1 text-xs ' +
              (r.G === G0 ? 'ring-2 ring-sky-400' : '') +
              (r.mine ? ' shadow-[inset_0_-2px_0_#e0457b]' : '')
            }
          >
            <i className="h-3 w-1 rounded-sm" style={{ background: ROLE_COL[r.role] }} />
            <b className="font-display">{r.name}</b>
            {r.n > 1 ? <span className="text-slate-400">{r.n}</span> : null}
            <span className={r.G === H ? 'text-sky-400' : 'text-slate-300'}>{r.gap}</span>
          </button>
        ))}
      </div>
    );
  return (
    <div
      className="pointer-events-auto absolute right-2 top-9 hidden w-48 overflow-hidden rounded-md bg-slate-950/80 text-xs shadow-lg ring-1 ring-slate-700 sm:block"
      aria-label="Écarts entre les groupes"
    >
      {rows.map(r => (
        <button
          key={grpKey(r.G)}
          type="button"
          onClick={() => onPick(r.G)}
          className={
            'flex w-full items-center gap-2 border-b border-slate-800/80 px-2 py-1.5 text-left last:border-0 hover:bg-slate-800 ' +
            (r.G === G0 ? 'bg-slate-800' : '')
          }
        >
          <i className="h-4 w-1 shrink-0 rounded-sm" style={{ background: ROLE_COL[r.role] }} />
          <span className="min-w-0 flex-1 truncate">
            <b className="font-display text-[13px] text-slate-50">{r.name}</b>
            {r.n > 1 ? <span className="text-slate-400"> {r.n}</span> : null}
            {r.mine ? <span className="ml-1 text-pink-300">● {r.mine}</span> : null}
          </span>
          <span className={'font-display text-[13px] ' + (r.G === H ? 'text-sky-400' : 'text-slate-200')}>{r.gap}</span>
        </button>
      ))}
      {more > 0 ? <div className="px-2 py-1 text-[11px] text-slate-500">et {more} autre{more > 1 ? 's' : ''} groupe{more > 1 ? 's' : ''}</div> : null}
    </div>
  );
}
// Profil de l'étape (altitude réelle) : cols et sprint, kilomètres restants, et tous les groupes placés dessus (rose :
// vos coureurs ; anneau jaune : le groupe filmé). Un clic sur un groupe le filme.
function StageProfileLive({ sim, G0, onPick }) {
  const P = sim.P;
  if (!P || !P.alt) return null;
  const D = sim.dist || 1;
  const n = P.n;
  const step = Math.max(1, Math.floor(n / 240));
  let lo = Infinity,
    hi = -Infinity;
  for (let i = 0; i < n; i++) {
    lo = Math.min(lo, P.alt[i]);
    hi = Math.max(hi, P.alt[i]);
  }
  if (hi - lo < 150) hi = lo + 150;
  const X = km => (Math.max(0, Math.min(D, km)) / D) * 1000;
  const Y = a => 52 - ((a - lo) / (hi - lo)) * 44;
  const altAt = km => P.alt[clamp(Math.floor(km / STEP), 0, n - 1)];
  let d = '';
  for (let i = 0; i < n; i += step) d += (i ? 'L' : 'M') + X(i * STEP).toFixed(1) + ' ' + Y(P.alt[i]).toFixed(1);
  d += 'L' + X(D) + ' ' + Y(P.alt[n - 1]).toFixed(1);
  const L = live(sim).sort((a, b) => b.pos - a.pos);
  const H = L[0];
  const pel = sim.pel && L.includes(sim.pel) ? sim.pel : H;
  // repères de kilomètres restants, sans chevauchement (ni entre eux, ni avec « arrivée »)
  const ticks = [];
  for (const k of [50, 20, 10, 5]) {
    const x = X(D - k) / 10;
    if (k < D - 5 && x < 90 && ticks.every(t => Math.abs(X(D - t) / 10 - x) > 9)) ticks.push(k);
  }
  return (
    <div className="border-t border-slate-800 px-3 pb-2 pt-1">
      <div className="relative">
        <svg viewBox="0 0 1000 62" preserveAspectRatio="none" className="block h-16 w-full" aria-label="Profil de l'étape">
          <path d={d + `L${X(D)} 58 L0 58 Z`} fill="#262d3a" />
          <path d={d} fill="none" stroke="#6b7686" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          {(sim.klimbs || []).map((c, i) => {
            let p = '';
            const a = Math.floor(c.start / STEP),
              b = Math.min(n - 1, Math.ceil(c.end / STEP));
            for (let k = a; k <= b; k++) p += (k === a ? 'M' : 'L') + X(k * STEP).toFixed(1) + ' ' + Y(P.alt[k]).toFixed(1);
            return <path key={i} d={p} fill="none" stroke="#e5484d" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />;
          })}
          {ticks.map(k => (
            <line key={k} x1={X(D - k)} x2={X(D - k)} y1="0" y2="58" stroke="#2f3847" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          ))}
          {sim.isp ? <line x1={X(sim.isp.at)} x2={X(sim.isp.at)} y1={Y(altAt(sim.isp.at)) - 6} y2="58" stroke="#3dbe7a" strokeWidth="2" vectorEffect="non-scaling-stroke" /> : null}
        </svg>
        {/* (repères et groupes en HTML : nets à toutes les tailles, et cliquables) */}
        {(sim.klimbs || [])
          .filter(c => c.cat != null && c.cat !== 4)
          .map((c, i) => (
            <span
              key={i}
              title={c.name}
              className="absolute -translate-x-1/2 rounded-sm bg-rose-500/90 px-1 font-display text-[10px] font-semibold leading-4 text-white"
              style={{ left: X(c.end) / 10 + '%', top: Math.max(0, (Y(altAt(c.end)) / 62) * 64 - 18) + 'px' }}
            >
              {c.cat === 'HC' ? 'HC' : c.cat}
            </span>
          ))}
        {L.map(G => {
          const k = G.riders.filter(x => !x.fin && !x.dnf).length;
          const me = G.riders.some(x => x.player && !x.fin && !x.dnf);
          const role = grpRole(sim, G, H, pel);
          const sz = k >= 40 ? 13 : k >= 10 ? 11 : 8;
          return (
            <button
              key={grpKey(G)}
              type="button"
              title={`${grpName(G, role, k)}${k > 1 ? ' (' + k + ')' : ''} · km ${Math.round(G.pos)}${me ? ' · vos coureurs' : ''}`}
              aria-label={`Filmer : ${grpName(G, role, k)}, kilomètre ${Math.round(G.pos)}`}
              onClick={() => onPick(G)}
              className={'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-950 ' + (G === G0 ? 'ring-2 ring-sky-400' : '')}
              style={{
                left: X(G.pos) / 10 + '%',
                top: (Y(altAt(G.pos)) / 62) * 64 + 'px',
                width: sz,
                height: sz,
                background: me ? '#e0457b' : ROLE_COL[role],
              }}
            />
          );
        })}
      </div>
      <div className="relative mt-0.5 h-4 text-[10px] text-slate-500">
        {ticks.map(k => (
          <span key={k} className="absolute -translate-x-1/2" style={{ left: X(D - k) / 10 + '%' }}>
            {k} km
          </span>
        ))}
        <span className="absolute right-0">arrivée</span>
      </div>
      <div className="flex flex-wrap gap-x-3 text-[11px] text-slate-400">
        <span>
          <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#e0457b] align-middle" />
          vos coureurs
        </span>
        <span>
          <i className="mr-1 inline-block h-2 w-2 rounded-full ring-2 ring-[#facc15] align-middle" />
          maillot de leader
        </span>
        <span>
          <i className="mr-1 inline-block h-2 w-2 rounded-full ring-1 ring-white align-middle" />
          coureur qui roule
        </span>
        <span>
          <i className="mr-1 inline-block h-1 w-3 bg-[#e5484d] align-middle" />
          col (catégorie)
        </span>
        <span>
          <i className="mr-1 inline-block h-2 w-1 bg-[#3dbe7a] align-middle" />
          sprint
        </span>
        <span>un clic sur un groupe le filme</span>
      </div>
    </div>
  );
}
// Un cycliste vu du dessus (mètres, orienté selon la route) : ombre, roues et cadre, jambes qui pédalent au rythme
// de la vitesse, maillot aux couleurs de l'équipe (jaune pour le leader du général), bras, casque. Liseré : jaune
// (leader), rose (mes coureurs), blanc (il roule en tête).
function drawRider(c, x, px, py, h, sc, yel, t) {
  const me = x.player;
  const col = yel ? '#facc15' : x.team.color || '#cbd5e1';
  c.save();
  c.translate(px, py);
  c.rotate(h);
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.beginPath();
  c.ellipse(0.15, 0.22, 0.95, 0.3, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#0b0f14';
  for (const wx of [-0.6, 0.6]) {
    c.beginPath();
    c.ellipse(wx, 0, 0.34, 0.06, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = '#475569';
  c.lineWidth = 0.07;
  c.beginPath();
  c.moveTo(-0.6, 0);
  c.lineTo(0.6, 0);
  c.stroke();
  // jambes : un pédalage qui suit la vitesse du groupe
  const ph = t * ((x.g && x.g.speed) || 38) * 0.16 + x.id;
  const lo = Math.sin(ph) * 0.17;
  c.fillStyle = '#1e293b';
  c.beginPath();
  c.ellipse(0.06 + lo, 0.16, 0.14, 0.06, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(0.06 - lo, -0.16, 0.14, 0.06, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = col;
  c.beginPath();
  c.ellipse(-0.08, 0, 0.42, 0.26, 0, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = (me || yel ? 2.2 : 1) / sc;
  c.strokeStyle = me ? '#f472b6' : yel ? '#fef08a' : x.work > 0 ? '#f8fafc' : 'rgba(10,14,20,0.85)';
  c.stroke();
  c.strokeStyle = col;
  c.lineWidth = 0.09;
  c.beginPath();
  c.moveTo(0.12, 0.17);
  c.lineTo(0.48, 0.2);
  c.moveTo(0.12, -0.17);
  c.lineTo(0.48, -0.2);
  c.stroke();
  c.fillStyle = yel ? '#fde68a' : '#e5e7eb';
  c.beginPath();
  c.ellipse(0.33, 0, 0.14, 0.12, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
const ZOOMS = [0.5, 0.75, 1, 1.15, 1.6, 2.3, 3.5];
export function Sky({ sim, compact }) {
  const ref = useRef(null);
  const [cam, setCam] = useState(UI.skyCam || 'auto');
  const [snd, setSnd] = useState(!!UI.skySound);
  const st = useRef({});
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      try {
        st.current.compact = compact;
        draw(ref.current, UI.sim, cam, st.current);
      } catch (e) {
        // (le dessin ne doit jamais casser l'écran de course)
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cam]);
  useEffect(
    () => () => {
      if (AUD.gain) AUD.gain.gain.value = 0;
    },
    []
  );
  if (!sim) return null;
  const pick = G => ((st.current.pick = grpKey(G)), (UI.skyCam = 'grp'), setCam('grp'));
  return (
    <section className="overflow-hidden rounded-lg bg-slate-900">
      <div className="relative">
        <canvas
          ref={ref}
          className={'block w-full cursor-pointer ' + (compact ? 'h-56' : 'h-80 xl:h-[26rem]')}
          role="img"
          aria-label="Retransmission vue du ciel : touchez un coureur pour ouvrir sa fiche"
          onClick={e => {
            // le coureur le plus proche du doigt (à moins de 20 px) : sa fiche
            const b = e.currentTarget.getBoundingClientRect();
            const mx = e.clientX - b.left,
              my = e.clientY - b.top;
            let best = null,
              bd = 20 * 20;
            for (const [sx, sy, id] of st.current.hits || []) {
              const d = (sx - mx) ** 2 + (sy - my) ** 2;
              if (d < bd) {
                bd = d;
                best = id;
              }
            }
            if (best != null) openRider(best);
          }}
        />
        {compact ? null : <GapLadder sim={sim} G0={st.current.G0} onPick={pick} />}
      </div>
      {/* pendant le final, l'encart du final donne déjà les groupes et la route jusqu'à la ligne */}
      {compact ? null : (
        <>
          <div className="sm:hidden">
            <GapLadder sim={sim} G0={st.current.G0} onPick={pick} chips />
          </div>
          <SkyCaption sim={sim} G={st.current.G0} />
          <StageProfileLive sim={sim} G0={st.current.G0} onPick={pick} />
        </>
      )}
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
        {CAMS.concat(cam === 'grp' ? [['grp', 'Groupe choisi']] : []).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => ((UI.skyCam = k), setCam(k))}
            className={
              'min-h-8 rounded-full px-2.5 text-xs font-semibold ring-1 ' +
              (cam === k ? 'bg-sky-500 text-slate-950 ring-sky-400' : 'bg-slate-800 text-slate-300 ring-slate-700')
            }
          >
            {l}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1">
          {[
            ['−', -1, 'Plan plus large'],
            ['+', 1, 'Plus près des coureurs'],
          ].map(([l, d, t]) => (
            <button
              key={l}
              type="button"
              title={t}
              aria-label={t}
              onClick={() => {
                const z = st.current.zf || 1;
                let i = ZOOMS.findIndex(v => v >= z - 0.01);
                if (i < 0) i = ZOOMS.length - 1;
                UI.skyZoom = ZOOMS[clamp(i + d, 0, ZOOMS.length - 1)];
              }}
              className="flex h-8 w-9 items-center justify-center rounded-full bg-slate-800 text-base font-bold text-slate-100 ring-1 ring-slate-700"
            >
              {l}
            </button>
          ))}
        </span>
        <button
          type="button"
          onClick={() => {
            UI.skySound = !snd;
            setSnd(!snd);
            if (!snd) {
              const c = audio();
              if (c && c.state === 'suspended') c.resume();
            }
          }}
          className="min-h-8 rounded-full bg-slate-800 px-2.5 text-xs text-slate-200 ring-1 ring-slate-700"
          title="Cloche du dernier kilomètre, foule, bip de la radio"
        >
          {snd ? '🔊 Son' : '🔇 Son'}
        </button>
      </div>
    </section>
  );
}
