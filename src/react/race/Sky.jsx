// Retransmission vue du ciel : la route de l'étape en 2D (relief, pavés, vent, routes étroites, kilomètres, flamme
// rouge, sommets, sprint), les coureurs placés dans leur groupe (peloton en masse, échappée en file, éventail en
// diagonale dans une bordure), plusieurs caméras (réalisateur automatique, tête de course, peloton, mes coureurs)
// et quelques sons (cloche, foule, radio), désactivables. Dessin sur un canevas, à son propre rythme d'images :
// la position des groupes est interpolée entre deux pas de la simulation.
import { useEffect, useRef, useState } from 'react';
import { Card } from '../ui.jsx';

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
      ((performance.now() - (UI.loopT || performance.now())) / 1000) * ([0, 0.25, 0.5, 1.5, 5, 20][UI.speed] || 0),
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
  const fKm = Math.min(sim.dist, ipos(G0, frac));
  // zoom : la caméra cadre le groupe suivi (sa longueur réelle, quelques rangs de coureurs) avec de la marge
  const nG = G0.riders.filter(x => !x.fin && !x.dnf).length;
  const hardG = G0.speed > 50 || G0.riders.some(y => y.work >= 0.92);
  let wG = nG <= 3 ? 1 : nG <= 10 ? 2 : clamp(Math.ceil(Math.sqrt(nG) * 0.75), 3, 8);
  if (hardG && wG > 2) wG = Math.max(2, Math.ceil(wG * 0.55));
  const len = Math.ceil(nG / wG) * (wG === 1 ? 2.2 : 1.7);
  const span = clamp(len * 2.2 + 60, 110, 520);
  st.span = st.span ? st.span + (span - st.span) * 0.05 : span;
  const sc = W / st.span; // pixels par mètre
  // (l'image est centrée sur le milieu du groupe, un peu en avant : on voit la route qui arrive)
  const [fx, fy, fh] = at(R, fKm - len / 2000 + (st.span * 0.1) / 1000);
  st.h = st.h == null ? fh : st.h + Math.atan2(Math.sin(fh - st.h), Math.cos(fh - st.h)) * 0.04;
  const P = sim.P;
  const iAt = km => clamp(Math.floor(km / STEP), 0, P.n - 1);
  // fond : la campagne (plus sombre en montagne)
  const gF = P.g[iAt(fKm)] || 0;
  c.fillStyle = gF >= 5 ? '#23301f' : gF >= 2 ? '#26382a' : '#203a2c';
  c.fillRect(0, 0, W, H);
  c.save();
  c.translate(W / 2, H * 0.55);
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
    if (hsh % 7 < 3) {
      const d = 9 + ((hsh >>> 3) % 22);
      c.beginPath();
      c.arc(x + nx * d, y + ny * d, 2 + ((hsh >>> 8) % 3), 0, Math.PI * 2);
      c.fillStyle = (hsh >>> 5) % 3 ? '#14532d' : '#166534';
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
  const evOf = new Map((sim.skyEv || []).filter(e => e.id != null && sim.t - e.t <= 3).map(e => [e.id, e]));
  for (const G of live(sim)) {
    const gKm = ipos(G, frac);
    if (gKm < k0 - 0.3 || gKm > k1 + 0.3) continue;
    const xs = G.riders.filter(x => !x.fin && !x.dnf).sort((a, b) => b.pos - a.pos);
    const n = xs.length;
    // le peloton est plus long que large ; à vive allure (ou quand une équipe roule à bloc) il s'étire en file
    const hard = G.speed > 50 || G.riders.some(y => y.work >= 0.92);
    let wid = n <= 3 ? 1 : n <= 10 ? 2 : clamp(Math.ceil(Math.sqrt(n) * 0.75), 3, 8);
    if (hard && wid > 2) wid = Math.max(2, Math.ceil(wid * 0.55));
    const ech = sim.echelon && sim.echelon.T && G.expo && sim.P.wind && sim.t < sim.echelon.until;
    xs.forEach((x, k) => {
      const row = Math.floor(k / wid),
        col = k % wid;
      const back = row * (wid === 1 ? 2.2 : 1.7) + ((x.id * 37) % 7) * 0.08;
      let lat = (col - (wid - 1) / 2) * 0.95 + (((x.id * 53) % 9) - 4) * 0.05;
      if (ech) lat += row * 0.55 - 3; // éventail en diagonale, contre le vent
      const [x0, y0, h] = at(R, gKm - back / 1000);
      const px = x0 + Math.cos(h + 1.5708) * lat,
        py = y0 + Math.sin(h + 1.5708) * lat;
      if (evOf.has(x.id)) posOf.set(x.id, [px, py]);
      const me = x.player;
      const r0 = me ? 0.6 : 0.45;
      c.beginPath();
      c.arc(px, py, Math.max(r0, (me ? 3.6 : 2.8) / sc), 0, Math.PI * 2);
      c.fillStyle = x.team.color || '#cbd5e1';
      c.fill();
      if (me || x.id === leaderId) {
        c.lineWidth = Math.max(0.25, 1.4 / sc);
        c.strokeStyle = x.id === leaderId ? '#facc15' : '#f472b6';
        c.stroke();
      }
      if (G.attacker === x && G.burst > 0) labels.push([px, py, '⚡', '#fde047', true]);
      else if (evOf.has(x.id) && evOf.get(x.id).kind !== 'reprise')
        labels.push([px, py, (SKY_EV[evOf.get(x.id).kind] || SKY_EV.moment)[0], '#fde68a', true]);
      if (me && st.span < 220) labels.push([px, py, riderName(x.r), '#fbcfe8', false]);
    });
    // étiquette du groupe
    const [lx, ly] = at(R, gKm);
    const head = live(sim)
      .slice()
      .sort((a, b) => b.pos - a.pos)[0];
    const gap = G === head ? '' : ' · ' + fmtGap(gapSec(head, G));
    const name =
      G === sim.pel
        ? `Peloton (${n})`
        : G === head
          ? `${n === 1 ? riderName(xs[0].r) : 'Tête (' + n + ')'}`
          : `Groupe (${n})`;
    labels.push([lx, ly, name + gap, G.riders.some(y => y.player) ? '#f9a8d4' : '#e2e8f0', 'grp']);
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
    return [W / 2 + (dx * cs - dy * sn) * sc, H * 0.55 + (dx * sn + dy * cs) * sc];
  };
  const used = [];
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
  // bandeau : km de la tête de course suivie, pente, vitesse, caméra
  c.fillStyle = 'rgba(15,23,42,0.7)';
  c.fillRect(0, 0, W, 20);
  c.fillStyle = '#f8fafc';
  c.font = 'bold 11px sans-serif';
  const kmL = Math.max(0, sim.dist - fKm);
  c.fillText(
    `${kmL < 10 ? kmL.toFixed(1).replace('.', ',') : Math.round(kmL)} km · ${gF.toFixed(1).replace('.', ',')} % · ${G0.speed ? Math.round(G0.speed) : 0} km/h`,
    8,
    14
  );
  const cl = (CAMS.find(a => a[0] === cam) || CAMS[0])[1];
  c.font = '10px sans-serif';
  const cw = c.measureText(cl).width;
  c.fillStyle = '#94a3b8';
  c.fillText(cl, W - cw - 8, 14);
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

export function Sky({ sim, compact }) {
  const ref = useRef(null);
  const [cam, setCam] = useState(UI.skyCam || 'auto');
  const [snd, setSnd] = useState(!!UI.skySound);
  const st = useRef({});
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      try {
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
  return (
    <Card className="overflow-hidden border-sky-500/30 p-0">
      <canvas
        ref={ref}
        className={'block w-full ' + (compact ? 'h-48' : 'h-60 sm:h-72')}
        role="img"
        aria-label="Retransmission vue du ciel"
      />
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
        {CAMS.map(([k, l]) => (
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
          className="ml-auto min-h-8 rounded-full bg-slate-800 px-2.5 text-xs text-slate-200 ring-1 ring-slate-700"
          title="Cloche du dernier kilomètre, foule, bip de la radio"
        >
          {snd ? '🔊 Son' : '🔇 Son'}
        </button>
      </div>
    </Card>
  );
}
