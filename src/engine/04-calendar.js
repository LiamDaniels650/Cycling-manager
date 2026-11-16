/* Calendrier et profils d'étapes */
const GB_ST = [
  ['plat', 184],
  ['vallonne', 178],
  ['plat', 195],
  ['clmeq', 27],
  ['plat', 176],
  ['paves', 162],
  ['vallonne', 189],
  ['montagne', 178],
  ['sommet', 165, 'R'],
  ['plat', 201],
  ['punch', 175],
  ['montagne', 182],
  ['sommet', 158],
  ['vallonne', 186],
  ['plat', 179, 'R'],
  ['montagne', 172],
  ['sommet', 149],
  ['plat', 188],
  ['clm', 36],
  ['sommet', 141],
  ['plat', 112],
];
const GI_ST = [
  ['clm', 16],
  ['plat', 190],
  ['vallonne', 182],
  ['punch', 168],
  ['plat', 204],
  ['sommet', 158],
  ['vallonne', 176],
  ['plat', 186],
  ['montagne', 167, 'R'],
  ['clm', 34],
  ['plat', 199],
  ['vallonne', 187],
  ['sommet', 172],
  ['montagne', 165],
  ['plat', 210, 'R'],
  ['sommet', 184],
  ['montagne', 156],
  ['plat', 178],
  ['sommet', 163],
  ['montagne', 189],
  ['plat', 141],
];
const VU_ST = [
  ['clmeq', 16],
  ['vallonne', 176],
  ['punch', 181],
  ['plat', 172],
  ['sommet', 157],
  ['vallonne', 190],
  ['montagne', 168],
  ['sommet', 163, 'R'],
  ['plat', 185],
  ['punch', 176],
  ['clm', 30],
  ['sommet', 168],
  ['montagne', 174],
  ['sommet', 155, 'R'],
  ['vallonne', 188],
  ['plat', 182],
  ['sommet', 152],
  ['montagne', 176],
  ['punch', 170],
  ['sommet', 165],
  ['plat', 101],
];
const RACE_DEFS = [
  { key: 'gpo', w: 3, name: "Grand Prix d'Ouverture", cat: 2, stages: [['plat', 176]] },
  { key: 'omloop', w: 5, name: 'Semi-classique flamande', cat: 2, stages: [['paves', 202, 'monts']] },
  {
    key: 'cote',
    w: 6,
    name: 'Tour de la Côte',
    cat: 2,
    stages: [
      ['plat', 168],
      ['vallonne', 182],
      ['sommet', 151],
      ['clm', 18],
      ['vallonne', 160],
    ],
  },
  {
    key: 'soleil',
    w: 9,
    name: 'Course au Soleil',
    cat: 1,
    stages: [
      ['plat', 172],
      ['plat', 188],
      ['clm', 21],
      ['vallonne', 192],
      ['punch', 178],
      ['montagne', 186],
      ['sommet', 162],
      ['vallonne', 150],
    ],
  },
  {
    key: 'mers',
    w: 9,
    name: 'Course des Deux Mers',
    cat: 1,
    stages: [
      ['clmeq', 19],
      ['plat', 190],
      ['vallonne', 202],
      ['sommet', 168],
      ['punch', 182],
      ['plat', 174],
      ['clm', 10],
    ],
  },
  { key: 'msr', w: 11, name: 'Classicissima', cat: 1, stages: [['vallonne', 288, 'longue']] },
  { key: 'flandres', w: 13, name: 'Ronde des Monts flamands', cat: 1, stages: [['paves', 258, 'monts']] },
  { key: 'pav', w: 14, name: 'Ronde des Pavés', cat: 1, stages: [['paves', 256]] },
  {
    key: 'basque',
    w: 14,
    name: 'Tour des Collines basques',
    cat: 2,
    stages: [
      ['punch', 162],
      ['vallonne', 176],
      ['punch', 168],
      ['vallonne', 182],
      ['montagne', 158],
      ['clm', 18],
    ],
  },
  { key: 'amstel', w: 15, name: "Course de l'Or", cat: 1, stages: [['punch', 252]] },
  { key: 'col', w: 16, name: 'Flèche des Collines', cat: 1, stages: [['punch', 201]] },
  { key: 'liege', w: 17, name: 'Doyenne des Ardennes', cat: 1, stages: [['vallonne', 256, 'dur']] },
  { key: 'giro', w: 19, name: 'Tour des Deux Côtes', cat: 0, stages: GI_ST },
  {
    key: 'alpes',
    w: 23,
    name: 'Critérium des Alpes',
    cat: 1,
    stages: [
      ['plat', 181],
      ['clm', 24],
      ['vallonne', 178],
      ['montagne', 165],
      ['sommet', 148],
      ['montagne', 158],
      ['sommet', 152],
    ],
  },
  {
    key: 'cantons',
    w: 24,
    name: 'Tour des Cantons',
    cat: 2,
    stages: [
      ['clm', 10],
      ['vallonne', 176],
      ['plat', 182],
      ['montagne', 171],
      ['sommet', 160],
      ['vallonne', 168],
      ['clm', 26],
      ['montagne', 149],
    ],
  },
  { key: 'natio', w: 25, name: 'Championnat national', cat: 2, stages: [['vallonne', 224]] },
  { key: 'gb', w: 26, name: 'Grande Boucle', cat: 0, stages: GB_ST },
  { key: 'clasica', w: 31, name: 'Clásica de la Bahía', cat: 1, stages: [['vallonne', 228, 'dur']] },
  {
    key: 'fin',
    w: 31,
    name: 'Tour de la Toscane',
    cat: 2,
    stages: [
      ['vallonne', 190],
      ['punch', 176],
      ['plat', 170],
    ],
  },
  { key: 'vuelta', w: 33, name: 'Ronde Ibérique', cat: 0, stages: VU_ST },
  { key: 'chr', w: 37, name: 'Chrono des Nations', cat: 2, stages: [['clm', 44]] },
  { key: 'auto', w: 39, name: 'Classique des Feuilles mortes', cat: 1, stages: [['montagne', 243]] },
  { key: 'gpf', w: 40, name: 'Grand Prix de Clôture', cat: 2, stages: [['plat', 198]] },
  // courses ajoutées : calendrier plus fourni, plusieurs courses certaines semaines
  {
    key: 'levant',
    w: 4,
    name: 'Tour du Levant',
    cat: 2,
    stages: [
      ['clm', 12],
      ['plat', 182],
      ['vallonne', 176],
      ['sommet', 164],
      ['plat', 170],
    ],
  },
  { key: 'briques', w: 6, name: 'Grand Prix des Briques', cat: 2, stages: [['paves', 198]] },
  { key: 'blancs', w: 7, name: 'Classique des Chemins blancs', cat: 1, stages: [['paves', 184, 'monts']] },
  {
    key: 'catalan',
    w: 12,
    name: 'Tour des Pyrénées catalanes',
    cat: 1,
    stages: [
      ['plat', 178],
      ['vallonne', 186],
      ['sommet', 172],
      ['montagne', 168],
      ['punch', 174],
      ['vallonne', 180],
      ['plat', 152],
    ],
  },
  { key: 'digues', w: 12, name: 'Course des Digues', cat: 1, stages: [['plat', 248]] },
  { key: 'harel', w: 11, name: 'Prix de Harelbeke', cat: 1, stages: [['paves', 204, 'monts']] },
  {
    key: 'romand',
    w: 18,
    name: 'Tour des Lacs alpins',
    cat: 1,
    stages: [
      ['clm', 15],
      ['vallonne', 172],
      ['punch', 165],
      ['sommet', 160],
      ['montagne', 175],
      ['clm', 18],
    ],
  },
  {
    key: 'polders',
    w: 22,
    name: 'Tour des Polders',
    cat: 2,
    stages: [
      ['plat', 188],
      ['paves', 176],
      ['clm', 14],
      ['vallonne', 190],
      ['plat', 182],
    ],
  },
  {
    key: 'occit',
    w: 27,
    name: "Route d'Occitanie",
    cat: 2,
    stages: [
      ['plat', 175],
      ['sommet', 158],
      ['vallonne', 172],
      ['plat', 168],
    ],
  },
  { key: 'basquec', w: 29, name: 'Classique de la Côte basque', cat: 1, stages: [['vallonne', 230, 'dur']] },
  { key: 'cyclass', w: 32, name: 'Cyclassique du Nord', cat: 1, stages: [['plat', 205]] },
  { key: 'lacs', w: 35, name: 'Grand Prix des Lacs', cat: 1, stages: [['punch', 201]] },
  { key: 'feuilles', w: 38, name: 'Course des Feuilles', cat: 2, stages: [['plat', 213]] },
  { key: 'mondiaux', w: 36, name: 'Championnats du monde', cat: 1, worlds: true, stages: [['vallonne', 262, 'dur']] },
];
const LAST_WEEK = 42;
// Calendrier de la saison et invitations aux Grands Tours.
function buildCalendar() {
  genClimate();
  S.cal = RACE_DEFS.map(d => ({
    key: d.key,
    w: d.w,
    name: raceNameOf(d.key), // nom personnalisé s'il y en a un (39-names.js)
    cat: d.cat,
    done: false,
    winner: null,
    stagesSpec: d.stages,
    ...(d.worlds ? { worlds: true } : {}),
  })).sort((a, b) => a.w - b.w);
  // invitations : licences WorldTour (cycle de trois saisons) et invitations des ProTeams (35-officials)
  wtInit();
  for (const c of S.cal) c.inv = c.worlds ? [] : wtInvites(c);
}
const PLACE = [
  'Saint-Jean',
  'Montclar',
  'Le Bourg',
  'Val-Fleuri',
  'Roche-Haute',
  'Bellegarde',
  'Pierrefeu',
  'Champsaur',
  'Malpasse',
  'Aiguebelle',
  'Mont-Ruvel',
  'Hautecombe',
  'Lachaux',
  'Verdaigne',
  'Puy-Sec',
  'Colombière',
  'Grand Serre',
  'Croix-Morand',
  'Vars-le-Haut',
  'Ferrière',
];
// Liste des difficultés (côtes, secteurs pavés) d'une étape selon son type.
function genStageSegs(type, dist, variant) {
  const F = [];
  const climb = (at, len, avg, desc) => F.push({ at, kind: 'climb', len, avg, desc });
  if (type === 'plat') {
    if (rnd() < 0.6) climb(dist * rf(0.3, 0.6), rf(1.5, 3), rf(3.5, 5.5), 2);
  } else if (type === 'vallonne' && variant === 'longue') {
    climb(dist * rf(0.3, 0.45), rf(4, 7), rf(4, 5.5), 4);
    climb(dist - rf(24, 28), rf(4, 6), rf(3.8, 4.8), 4);
    climb(dist - rf(9, 11), rf(3.2, 4.2), rf(3.8, 4.8), 3);
  } else if ((type === 'vallonne' && variant !== 'longue') || type === 'punch') {
    const dur = variant === 'dur';
    const n = dur ? rint(9, 11) : rint(4, 7);
    const last = type === 'punch' ? null : dist - (dur ? rf(6, 14) : rf(8, 22));
    for (let i = 0; i < n; i++) {
      const at = dist * rf(dur ? 0.35 : 0.25, 0.85);
      const len = rf(1.2, dur ? 3.5 : 4.2);
      climb(at, len, dur ? rf(6, 9.5) : rf(4.5, 8), len * 0.8);
    }
    if (type === 'punch') {
      const len = rf(1.1, 2.2);
      climb(dist - len, len, rf(7, 10), 0);
    } else {
      const len = rf(1.5, 3.5);
      climb(last - len, len, rf(5.5, 8.5), len * 0.8);
    }
  } else if (type === 'montagne') {
    const n = rint(3, 4);
    const lastTop = dist - rf(10, 28);
    for (let i = 0; i < n - 1; i++) {
      const len = rf(7, 15);
      climb(dist * (0.15 + i * 0.22) + rf(0, 10), len, rf(5.5, 8), len * 0.9);
    }
    const len = rf(9, 16);
    climb(lastTop - len, len, rf(6.5, 8.5), len * 0.95);
  } else if (type === 'sommet') {
    const n = rint(2, 3);
    for (let i = 0; i < n; i++) {
      const len = rf(7, 14);
      climb(dist * (0.2 + i * 0.22) + rf(0, 8), len, rf(5.5, 8), len * 0.9);
    }
    const len = rf(9, 17);
    climb(dist - len, len, rf(6.8, 8.8), 0);
  } else if (type === 'paves') {
    const monts = variant === 'monts';
    const n = monts ? rint(7, 10) : rint(11, 15);
    for (let i = 0; i < n; i++)
      F.push({ at: dist * (0.42 + (0.53 * i) / n) + rf(-2, 2), kind: 'paves', len: rf(1, 3.2) });
    if (monts) {
      const m = rint(8, 12);
      for (let i = 0; i < m; i++) {
        const len = rf(0.6, 1.8);
        F.push({ at: dist * (0.45 + (0.5 * i) / m) + rf(-3, 3), kind: 'mur', len, avg: rf(5.5, 10.5) });
      }
    }
    climb(dist * rf(0.25, 0.4), rf(1, 2), rf(4, 6), 1.5);
  } else if (type === 'clm') {
    if (rnd() < 0.4) climb(dist * rf(0.3, 0.6), rf(1.5, 3), rf(4, 6.5), 2);
  }
  F.sort((a, b) => a.at - b.at);
  const segs = [];
  let cur = 0;
  const windy = (type === 'plat' || type === 'paves' || type === 'vallonne') && rnd() < 0.3;
  const flatTo = to => {
    while (cur < to - 0.01) {
      const l = Math.min(to - cur, rf(2, 6));
      segs.push([+l.toFixed(2), +(gauss() * 0.7).toFixed(1), 0, windy && rnd() < 0.35 ? 1 : 0]);
      cur += l;
    }
  };
  for (const f of F) {
    if (f.at > cur) flatTo(Math.min(f.at, dist));
    if (cur >= dist - 0.3) break;
    if (f.kind === 'climb') {
      let rem = Math.min(f.len, dist - cur);
      while (rem > 0.01) {
        const l = Math.min(rem, rf(0.5, 1.5));
        segs.push([+l.toFixed(2), +clamp(f.avg + gauss() * 1.4, 1.5, f.avg + 4).toFixed(1), 0]);
        cur += l;
        rem -= l;
      }
      let dr = Math.min(f.desc || 0, dist - cur);
      while (dr > 0.01) {
        const l = Math.min(dr, rf(1, 2.5));
        segs.push([+l.toFixed(2), -+clamp(f.avg * 0.85 + gauss(), 2, 10).toFixed(1), 0]);
        cur += l;
        dr -= l;
      }
    } else if (f.kind === 'mur') {
      let rem = Math.min(f.len, dist - cur);
      const sf = rnd() < 0.6 ? 1 : 0;
      while (rem > 0.01) {
        const l = Math.min(rem, rf(0.25, 0.6));
        segs.push([+l.toFixed(2), +clamp(f.avg + gauss() * 2, 3, f.avg + 5).toFixed(1), sf]);
        cur += l;
        rem -= l;
      }
      let dr = Math.min(f.len * 0.8, dist - cur);
      if (dr > 0.05) {
        segs.push([+dr.toFixed(2), -+rf(3, 6).toFixed(1), 0]);
        cur += dr;
      }
    } else {
      const l = Math.min(f.len, dist - cur);
      segs.push([+l.toFixed(2), +(gauss() * 0.6).toFixed(1), 1]);
      cur += l;
    }
  }
  flatTo(dist);
  return segs;
}
// Profil détaillé d'une étape : pente, revêtement, exposition au vent, côtes, pente finale.
function buildProfile(spec) {
  // spec: {type,dist,segs,name}
  const n = Math.ceil(spec.dist / STEP) + 1,
    g = new Float32Array(n),
    surf = new Uint8Array(n),
    alt = new Float32Array(n),
    expo = new Uint8Array(n),
    narrow = new Uint8Array(n);
  for (const [at, len] of spec.narrow || [])
    for (let q = Math.floor(at / STEP); q < Math.min(n, Math.ceil((at + len) / STEP)); q++) narrow[q] = 1;
  let pos = 0,
    i = 0;
  for (const [len, gr, sf, ex] of spec.segs) {
    const end = pos + len;
    while (i < n && i * STEP < end) {
      g[i] = gr;
      surf[i] = sf;
      expo[i] = ex ? 1 : 0;
      i++;
    }
    pos = end;
  }
  while (i < n) {
    g[i] = g[i - 1] || 0;
    i++;
  }
  let a = spec.startAlt || 120;
  for (let k = 0; k < n; k++) {
    alt[k] = a;
    a += (g[k] / 100) * STEP * 1000;
    if (a < 0) a = 0;
  }
  // détection des montées
  const climbs = [];
  let k = 0;
  while (k < n) {
    if (g[k] >= 3) {
      let j = k;
      while (j < n && (g[j] >= 2 || (j + 2 < n && g[j + 1] >= 3))) j++;
      const len = (j - k) * STEP;
      const dh = alt[Math.min(j, n - 1)] - alt[k];
      const avg = len > 0 ? dh / (len * 10) : 0;
      if (len >= 0.9 && avg >= 3.5) {
        const sc = len * avg * avg;
        const cat = sc >= 640 ? 'HC' : sc >= 320 ? '1' : sc >= 150 ? '2' : sc >= 60 ? '3' : '4';
        climbs.push({
          start: k * STEP,
          end: Math.min(j * STEP, spec.dist),
          len: +len.toFixed(1),
          avg: +avg.toFixed(1),
          cat,
          name: (len > 5 ? 'Col de ' : 'Côte de ') + PLACE[(climbs.length * 7 + Math.floor(spec.dist)) % PLACE.length],
          // technicité de la descente qui suit (0,2 = large et roulante, 1 = étroite et sinueuse)
          tech: 0.2 + (((climbs.length * 37 + Math.floor(spec.dist * 13)) % 100) / 100) * 0.8,
        });
      }
      k = j;
    } else k++;
  }
  const sectors = [];
  k = 0;
  while (k < n) {
    if (surf[k]) {
      let j = k;
      while (j < n && surf[j]) j++;
      sectors.push({ start: k * STEP, end: j * STEP });
      k = j;
    } else k++;
  }
  const last = Math.max(0, n - 1 - Math.round(0.8 / STEP));
  let fg = 0;
  for (let q = last; q < n; q++) fg += g[q];
  fg /= n - last;
  let expoKm = 0;
  for (let q = 0; q < n; q++) if (expo[q]) expoKm += STEP;
  const short = new Uint8Array(n);
  for (const c of climbs) {
    if (c.len < 3.2) {
      for (let q = Math.floor(c.start / STEP); q <= Math.min(n - 1, Math.ceil(c.end / STEP)); q++) short[q] = 1;
    }
  }
  const finishShort =
    climbs.length && climbs[climbs.length - 1].end > spec.dist - 0.5 && climbs[climbs.length - 1].len < 3.2;
  return {
    g,
    surf,
    alt,
    climbs,
    sectors,
    finishGrad: fg,
    finishShort,
    n,
    expo,
    expoKm,
    short,
    narrow,
    wind: spec.wind || 0,
  };
}
// Prépare les étapes d'une course (distances, variantes, météo, vent).
// Parcours et météo d'une course : tirés de la série propre à la course (identiques à chaque appel de la saison).
function prepareRaceSpecs(cal) {
  return withSeed({ sd: stageSeed(cal, -1) }, () => buildRaceSpecs(cal));
}
function buildRaceSpecs(cal) {
  return cal.stagesSpec.map(([type, dist, variant], i) => ({
    type,
    dist,
    rest: variant === 'R',
    segs: genStageSegs(type, dist, variant === 'R' ? null : variant),
    name: (cal.stagesSpec.length > 1 ? 'Étape ' + (i + 1) + ' — ' : '') + typeLbl(type) + ' — ' + dist + ' km',
    startAlt: type === 'montagne' || type === 'sommet' ? rint(300, 900) : rint(20, 250),
    wind: windFor(cal.w),
    isp: rf(0.35, 0.7),
    wx: genWeather(cal.w, type),
    narrow: genNarrow(type, dist),
  }));
}
// Routes étroites (bosses, villages, routes de campagne) : il faut être placé pour ne pas être piégé.
function genNarrow(type, dist) {
  const n =
    {
      vallonne: rint(1, 3),
      punch: rint(1, 3),
      paves: rint(1, 2),
      plat: rnd() < 0.35 ? 1 : 0,
      montagne: rint(0, 2),
      sommet: rint(0, 1),
    }[type] || 0;
  const out = [];
  for (let i = 0; i < n; i++) out.push([+(dist * rf(0.3, 0.95)).toFixed(1), +rf(0.8, 2.5).toFixed(1)]);
  return out;
}
// Météo du jour (pluie, chaleur, froid…).
// Climat de la saison : un régime météo par semaine (anticyclone, normal, perturbé) qui persiste souvent
// plusieurs semaines, avec des tendances de saison (giboulées de printemps, canicules d'été, automne humide).
const WX_REGIME = { anti: '☀️ anticyclonique', normal: '⛅ variable', pert: '🌧️ perturbé' };
function genClimate() {
  const r = [null];
  let cur = 'normal';
  for (let w = 1; w <= LAST_WEEK; w++) {
    if (w === 1 || rnd() > 0.62) {
      const wt =
        w <= 14 ? [0.15, 0.4, 0.45] : w <= 30 ? [0.45, 0.4, 0.15] : w <= 35 ? [0.3, 0.45, 0.25] : [0.15, 0.45, 0.4];
      const x = rnd();
      cur = x < wt[0] ? 'anti' : x < wt[0] + wt[1] ? 'normal' : 'pert';
    }
    r.push(cur);
  }
  S.climate = { s: S.season, r };
}
function regimeAt(w) {
  return (S.climate && S.climate.s === S.season && S.climate.r[w]) || 'normal';
}
// Vent du jour selon le régime (perturbé : souvent fort).
function windFor(w) {
  const g = regimeAt(w);
  return g === 'pert' ? rint(2, 3) : g === 'anti' ? rint(1, 2) : rint(1, 3);
}
// Temps du jour selon la semaine (saison) et le régime en cours.
function genWeather(w, type) {
  const g = regimeAt(w);
  const r = rnd();
  if (type === 'clm') return r < { anti: 0.03, normal: 0.12, pert: 0.3 }[g] ? 'pluie' : 'sec';
  const summer = w >= 15 && w <= 30;
  const cold = w <= 10 || w >= 37;
  if (summer) {
    const p = { anti: [0.5, 0.03], normal: [0.18, 0.12], pert: [0.02, 0.45] }[g];
    return r < p[0] ? 'chaleur' : r < p[0] + p[1] ? 'pluie' : 'sec';
  }
  const p = { anti: [0.05, cold ? 0.25 : 0.03], normal: [0.2, cold ? 0.15 : 0.05], pert: [0.55, cold ? 0.2 : 0.08] }[g];
  return r < p[0] ? 'pluie' : r < p[0] + p[1] ? 'froid' : 'sec';
}
// Libellé d'un type d'étape.
function typeLbl(t) {
  return (
    {
      clmeq: 'CLM par équipes',
      plat: 'Plat',
      vallonne: 'Vallonné',
      punch: 'Arrivée en côte',
      montagne: 'Montagne',
      sommet: 'Arrivée au sommet',
      paves: 'Pavés',
      clm: 'Contre-la-montre',
    }[t] || t
  );
}
// Contre-la-montre individuel ?
function isITT(spec) {
  return spec.type === 'clm';
}
// Contre-la-montre par équipes ?
function isTTT(spec) {
  return spec.type === 'clmeq';
}
