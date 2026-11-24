/* Physique : capacité, vitesse, aspiration */
// short : montée courte (< 3,2 km) = effort explosif, où les puncheurs rivalisent avec les grimpeurs
function terrStat(s, g, surf, short) {
  let v;
  if (short && g >= 3.5) v = s.col * 0.82 + s.mon * 0.18;
  else if (g >= 6) v = s.mon;
  else if (g >= 3.5) {
    const w = (g - 3.5) / 2.5;
    v = s.col * (1 - w) + s.mon * w;
  } else if (g >= 1.5) {
    const w = (g - 1.5) / 2;
    v = s.pla * (1 - w) + s.col * w;
  } else if (g > -2.5) v = s.pla;
  else v = (s.des || 68) * 0.65 + s.pla * 0.35;
  // pavés : plus le secteur est dur (1 à 5 étoiles), plus la caractéristique Pavés compte
  if (surf) {
    const w = 0.44 + 0.07 * Math.min(5, surf);
    v = v * (1 - w) + s.pav * w;
  }
  return v;
}
// Capacité instantanée d'un coureur sur ce terrain (fringale = -12 %).
function cap(x, g, surf) {
  if (x.bonk) return capRaw(x, g, surf) * 0.88;
  return capRaw(x, g, surf);
}
// Niveau du jour × réserves × fatigue accumulée ; descente mouillée = surtout l'adresse.
function capRaw(x, g, surf) {
  const r = x.r;
  // jour sans : au-delà de la forme du jour, les jambes ne répondent pas (3 à 7 % de capacité en moins)
  const f = (0.86 + (0.14 * x.dayForm) / 100) * (x.sansF || 1);
  // réserves de la journée : sous 60 %, les jambes faiblissent (l'endurance retarde ce moment)
  const e = 0.66 + 0.34 * Math.min(1, x.energy / 60);
  const fat = 1 - r.fatigue / 650;
  // tenue dans la durée : au-delà de ~25 kJ/kg de travail dans la journée, la puissance s'érode, moins vite
  // chez les coureurs endurants (2 % environ en fin d'étape de montagne pour un bon, 4 % pour un faible)
  const kjkg = x.st && x.st.kj ? x.st.kj / (r.kg || 68) : 0;
  const dur = kjkg > 25 ? 1 - (kjkg - 25) * 0.0013 * clamp(1.9 - r.s.end / 50, 0.2, 1) : 1;
  if (x.wet && g <= -2.5) return ((r.s.des || 68) * 0.85 + r.s.pla * 0.15) * f * e * fat;
  const mor = r.trait === 'fragile' ? 0.97 + (0.06 * r.moral) / 100 : 1;
  // altitude : environ -7 % par 1 000 m au-dessus de 1 500 m, moitié moins pour un coureur acclimaté (stage en altitude)
  const altF = x.alt > 1500 ? 1 - ((x.alt - 1500) / 1000) * 0.07 * (r.altBoost > 0 ? 0.5 : 1) : 1;
  // poids de forme : chaque kilo au-dessus du poids de course coûte en montée (≈ 1,3 % par kilo dans les fortes pentes)
  const kgX = r.kgOpt != null && g >= 3 ? r.kg - r.kgOpt : 0;
  const kgF = kgX > 0 ? 1 - kgX * R.kgClimb * clamp((g - 2) / 4, 0, 1) : 1;
  return terrStat(r.s, g, surf, x.short && g === x.gr) * f * e * fat * mor * altF * dur * kgF;
}
// Vitesse (km/h) d'un groupe roulant au niveau L sur une pente g.
// Calibrage 2024-2025 : plat ~44 km/h, montagne ~35-38, chrono ~52, CLM par équipes ~55 (voir tests/calibrate.js).
const SPEED_K = { plat: 1.08, colline: 1.05, montee: 1.05, aero: 1.03 };
// En montée, la vitesse est un peu moins sensible au niveau (écarts plus réalistes).
// noSurf : le ralentissement des pavés est laissé à la physique (roulement), qui l'applique ensuite.
function speedOf(L, g, surf, aero, noSurf) {
  const w = clamp((g - 2) / 3, 0, 1);
  let v = 24 + L * 0.28 + w * (2.8 - L * 0.038);
  if (g > 0.3) v = v / (1 + 0.16 * g);
  else if (g < -0.5) v = v * (1 + Math.min(0.55, -g * 0.075));
  if (surf && !noSurf) v *= 0.93;
  v *= g > 3 ? SPEED_K.montee : g > 1 ? SPEED_K.colline : SPEED_K.plat;
  if (aero) v *= SPEED_K.aero;
  return clamp(v, 8, 90);
}
// ---------- Physique de la vitesse ----------
// La vitesse calibrée (speedOf) vaut pour des conditions de référence : niveau de la mer, 18 °C, route sèche,
// pas de vent. Les équations de la puissance (gravité + roulement + air) recalculent la vitesse réelle dans les
// conditions du jour : air moins dense en altitude ou par la chaleur, vent de face ou de dos, pavés, pluie.
const PHY = { m: 78, crr: 0.0045, cda: 0.24, rho: 1.2, eta: 0.975 };
// Densité de l'air (kg/m³) selon l'altitude (m) et la température (°C).
function airRho(alt, tempC) {
  return 1.225 * Math.exp(-(alt || 0) / 8400) * (288.15 / (273.15 + tempC));
}
// Puissance (W) pour rouler à v (km/h) sur une pente g (%), vent de face vw (m/s, négatif = vent de dos).
function powerAt(v, g, crr, cda, rho, vw) {
  const ms = v / 3.6,
    th = Math.atan(g / 100),
    va = ms + vw;
  return (PHY.m * 9.81 * (Math.sin(th) + crr * Math.cos(th)) * ms + 0.5 * rho * cda * va * Math.abs(va) * ms) / PHY.eta;
}
// Vitesse (km/h) obtenue avec une puissance P dans ces conditions (méthode de Newton).
function speedFor(P, g, crr, cda, rho, vw) {
  const th = Math.atan(g / 100),
    a = 0.5 * rho * cda,
    b = PHY.m * 9.81 * (Math.sin(th) + crr * Math.cos(th));
  let v = 10; // m/s
  for (let k = 0; k < 30; k++) {
    const va = v + vw;
    const f = a * va * Math.abs(va) * v + b * v - P * PHY.eta;
    const df = a * (2 * Math.abs(va) * v + va * Math.abs(va)) + b;
    const nv = v - f / Math.max(1e-3, df);
    if (Math.abs(nv - v) < 1e-4) {
      v = nv;
      break;
    }
    v = Math.max(0.3, nv);
  }
  return v * 3.6;
}
// Conditions du jour pour un groupe : air, roulement, vent dans l'axe de la route.
function roadCond(sim, G) {
  const temp = sim.wx === 'chaleur' ? 32 : sim.wx === 'froid' ? 6 : 18;
  return {
    rho: airRho(G.alt, temp),
    crr: (G.surf ? 0.012 * (0.76 + 0.08 * Math.min(5, G.surf)) : PHY.crr) * (sim.wx === 'pluie' ? 1.12 : 1),
    vw: headwindAt(sim, G.pos),
  };
}
// Vitesse dans les conditions du jour, à partir de la vitesse de référence vRef.
// En descente (puissance de référence nulle ou négative), on compare les vitesses de roue libre.
// Les virages limitent la vitesse en descente, davantage sous la pluie.
function physSpeed(vRef, g, c, cda = PHY.cda, tech = 0.5) {
  const pRef = powerAt(vRef, g, PHY.crr, cda, PHY.rho, 0);
  let v;
  if (pRef > 5) v = speedFor(pRef, g, c.crr, cda, c.rho, c.vw);
  else
    v = (vRef * speedFor(0.01, g, c.crr, cda, c.rho, c.vw)) / Math.max(1, speedFor(0.01, g, PHY.crr, cda, PHY.rho, 0));
  if (g < -2) v = Math.min(v, descentMax(g, c.crr > 0.0055, tech));
  return v;
}
// Vitesse maximale en descente (virages) : environ 75 km/h à -6 % sur une descente roulante et sèche ;
// une descente technique et la pluie la font nettement baisser.
function descentMax(g, wet, tech = 0.5) {
  return clamp(46 + -g * 4.8, 50, 88) * (1.06 - 0.12 * tech) * (wet ? 0.9 - 0.1 * tech : 1);
}
// Technicité de la descente au km (celle qui suit le dernier col franchi ; 0,5 par défaut).
function descentTech(sim, km) {
  const cs = sim.P.climbs;
  for (let i = cs.length - 1; i >= 0; i--)
    if (km >= cs[i].end) return km - cs[i].end < cs[i].len * 1.4 + 3 ? cs[i].tech || 0.5 : 0.5;
  return 0.5;
}
// Vent dans l'axe de la route au km x (m/s ; positif = vent de face) : la route change de direction par tronçons.
function headwindAt(sim, km) {
  const w = sim.windAx;
  if (!w || !w.length) return 0;
  return w[clamp(Math.floor(km / 10), 0, w.length - 1)];
}
// Orientation de la route par tronçons de 10 km et vent du jour (force 0-3 → 0 à 6 m/s).
function genWindAxis(sim, dist, force, finWind) {
  // (vent annoncé à 10 m de haut ; à hauteur de cycliste, haies et bâtiments compris, il en reste environ les trois
  // quarts : sans cela, un peloton roulait à 73 km/h vent dans le dos et à 26 km/h vent de face sur le plat)
  const ms = [0, 2, 3.8, 6][force || 0] * R.windRider;
  const n = Math.ceil(dist / 10) + 1;
  const a = [];
  let ang = rnd() * Math.PI * 2;
  for (let k = 0; k < n; k++) {
    ang += gauss() * 0.9;
    a.push(+(ms * Math.cos(ang)).toFixed(2));
  }
  // final : l'annonce du vent à l'arrivée (face, dos, travers) fixe le dernier tronçon
  if (finWind === 'face') a[n - 1] = a[n - 2] = ms * 0.9;
  else if (finWind === 'dos') a[n - 1] = a[n - 2] = -ms * 0.9;
  else if (finWind === 'travers') a[n - 1] = a[n - 2] = 0;
  sim.windAx = a;
}
// Part de l'effort fournie par un coureur abrité dans un groupe de n coureurs (1 = aucun abri).
function draftF(g, surf, n) {
  if (n < 2) return 1;
  let d;
  if (g <= -2) d = 0.68;
  else if (g <= 1.5) d = 0.7 + Math.max(0, 8 - n) * 0.022;
  else if (g <= 4) d = 0.8 + (g - 1.5) * 0.04;
  else d = Math.min(0.97, 0.9 + (g - 4) * 0.015);
  if (surf) d = Math.max(d, 0.92);
  d -= 0.03 * Math.min(1, n / 40);
  return d;
}
// Version contre-la-montre de terrStat : la caractéristique chrono remplace le plat.
function terrStat2(s, g, surf) {
  // CLM : la stat clm remplace le plat
  const ss = Object.assign({}, s);
  ss.pla = s.clm * 0.8 + s.pla * 0.2;
  ss.col = s.clm * 0.4 + s.col * 0.6;
  return terrStat(ss, g, surf);
}

// Puissance développée dans une montée (modèle physique simplifié : gravité + roulement + air).
// kg : poids du coureur, len en km, avg en %, dur en secondes. Renvoie {w, wkg, vam, kmh}.
function climbPower(kg, len, avg, dur) {
  const v = (len * 1000) / dur,
    m = kg + 8,
    gr = avg / 100;
  const pGrav = m * 9.81 * gr * v,
    pRoll = m * 9.81 * 0.0045 * v,
    pAir = 0.5 * 1.1 * 0.34 * v * v * v;
  const w = (pGrav + pRoll + pAir) / 0.975;
  return {
    w: Math.round(w),
    wkg: +(w / kg).toFixed(2),
    vam: Math.round((len * avg * 10) / (dur / 3600)),
    kmh: +(v * 3.6).toFixed(1),
  };
}
// Puissance instantanée (W) d'un coureur roulant à v km/h sur une pente g (%), en recevant la part air (0-1)
// du vent relatif (1 = seul en tête, ~0,35 = bien abrité dans le peloton). cda : 0,32 sur route, 0,23 en chrono.
function riderWatts(kg, v, g, air, cda = 0.32, c = null) {
  const ms = v / 3.6,
    m = kg + 8;
  const rho = c ? c.rho : 1.2,
    crr = c ? c.crr : 0.0045,
    va = ms + (c ? c.vw : 0);
  const p = (m * 9.81 * (g / 100 + crr) * ms + 0.5 * rho * cda * air * va * Math.abs(va) * ms) / 0.975;
  return Math.max(0, p);
}
// Part du vent reçue dans un groupe de n coureurs : relayeur, attaquant ou coureur abrité (pos = placement 0-100).
function airShare(n, work, nw, attacker, pos) {
  if (n < 2 || attacker) return 1;
  if (work > 0) return 1 - 0.5 * (1 - 1 / Math.max(1, nw));
  return n >= 6 ? 0.25 + 0.25 * (pos / 100) : 0.5;
}
// Bilan de puissance d'un coureur (somme, somme des puissances^4, nombre de pas, pic glissant 5 min, énergie).
function powerAdd(st, w, dtS) {
  st.pw = (st.pw || 0) + w;
  st.p4 = (st.p4 || 0) + w * w * w * w;
  st.pn = (st.pn || 0) + 1;
  st.kj = (st.kj || 0) + (w * dtS) / 1000;
  // fenêtre glissante des 10 derniers pas (5 min) en tampon circulaire, sommée du plus ancien au plus récent
  const q = (st.pq = st.pq || []);
  const k = st.pqn || 0;
  q[k % 10] = w;
  st.pqn = k + 1;
  if (k >= 9) {
    let s = 0;
    for (let j = 1; j <= 10; j++) s += q[(k + j) % 10];
    st.p5 = Math.max(st.p5 || 0, s / 10);
  }
}
// Bilan de puissance d'un coureur sur l'étape : moyenne, puissance normalisée, pic 5 min, énergie.
function powerSummary(id, st, kg) {
  if (!st || !st.pn) return null;
  const avg = st.pw / st.pn,
    np = Math.pow(st.p4 / st.pn, 0.25);
  return {
    id,
    avg: Math.round(avg),
    np: Math.round(np),
    p5: Math.round(st.p5 || np),
    kj: Math.round(st.kj),
    kg,
    wkg: +(avg / kg).toFixed(2),
    npkg: +(np / kg).toFixed(2),
  };
}
// Accumulateur de puissance pondéré par la durée (contre-la-montre : segments de durées inégales).
function powerAcc() {
  return {
    s: 0,
    s4: 0,
    t: 0,
    add(w, dtS) {
      this.s += w * dtS;
      this.s4 += w * w * w * w * dtS;
      this.t += dtS;
    },
  };
}
// Bilan de puissance à partir d'un accumulateur pondéré par la durée.
function powerFromAcc(id, a, kg) {
  if (!a.t) return null;
  const avg = a.s / a.t,
    np = Math.pow(a.s4 / a.t, 0.25);
  return {
    id,
    avg: Math.round(avg),
    np: Math.round(np),
    p5: Math.round(np),
    kj: Math.round(a.s / 1000),
    kg,
    wkg: +(avg / kg).toFixed(2),
    npkg: +(np / kg).toFixed(2),
  };
}
// Liste de puissance d'une étape : mes coureurs et les dix premiers, dans l'ordre d'arrivée.
function stagePowerList(out, accs) {
  const top = new Set(out.slice(0, 10).map(e => e.id));
  return out
    .map((e, i) => [e, i])
    .filter(([e]) => top.has(e.id) || S.riders[e.id].team === 0)
    .map(([e, i]) => ({ ...powerFromAcc(e.id, accs[e.id], S.riders[e.id].kg || 68), rk: i + 1, kf: 0 }))
    .filter(e => e.id);
}

/* ---- Modèle « puissance critique » (CP / W') ----
   CP : puissance tenable environ une heure ; W' : réserve anaérobie (kJ) qui se vide au-dessus de CP
   et se recharge en dessous (modèle de récupération de Skiba). La jauge « jus » affichée = W'bal / W'. */
// Réserve anaérobie d'un coureur (kJ) : les explosifs (sprinteurs, puncheurs) en ont le plus.
function wPrime(r) {
  return clamp(9 + (0.55 * r.s.spr + 0.45 * r.s.col - 62) * 0.32 + (r.kg - 66) * 0.12, 7, 24);
}
// Mise à jour de W'bal pour un pas : P = puissance développée, I = intensité (P / CP).
function wbalStep(x, P, I, dtS, cold) {
  const W = x.wp;
  if (I > 1) {
    x.wbal = Math.max(0, x.wbal - (P * (1 - 1 / I) * dtS) / 1000);
    // « allumettes brûlées » : chaque passage dans le rouge use le système nerveux, la recharge ralentit
    if (x.wbal < 0.25 * W && !x.depl) {
      x.depl = true;
      x.matches = (x.matches || 0) + 1;
    }
  } else {
    if (x.wbal > 0.6 * W) x.depl = false;
    const below = P * (1 / Math.max(0.3, I) - 1); // CP - P
    const tau =
      (546 * Math.exp(-0.01 * below) + 316) *
      (1.25 - x.r.s.rec / 200) *
      (cold ? 1.25 : 1) *
      (1 + 0.1 * Math.min(6, x.matches || 0));
    x.wbal = W - (W - x.wbal) * Math.exp(-dtS / tau);
  }
  x.punch = (100 * x.wbal) / W;
}
// Seuil (CP) estimé d'un coureur en montée (pente 7 %), en watts : sert à l'affichage de la fiche.
function riderCP(r) {
  const L = terrStat(r.s, 7, 0, false) * (0.86 + (0.14 * (r.forme || 70)) / 100);
  return Math.round(riderWatts(r.kg || 68, speedOf(L, 7, 0), 7, 1));
}
