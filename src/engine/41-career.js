/* Mode carrière — noyau : état du joueur (S.car), journal, décisions, progression, croissance, semaine, saisons.
   Une partie à part : le monde pro tourne tout seul autour du joueur (l'équipe 0 du monde est confiée à l'adjoint)
   et le joueur vit la carrière d'un seul coureur, S.car.id. Fichiers : 41 noyau, 42 courses des jeunes
   (cadets, juniors, espoirs), 43 espoirs (équipes, agent, stagiaire, contrats), 44 courses pros du joueur.
   Fonctions préfixées « car » (careerWeekly existe déjà : c'est la carrière du directeur sportif). */

const CAR_DREAMS = {
  pro: { lbl: 'Passer professionnel', ic: '🎓' },
  nat: { lbl: 'Devenir champion national', ic: '🏅' },
  gtstage: { lbl: "Gagner une étape d'un Grand Tour", ic: '🏁' },
  monument: { lbl: 'Gagner un monument', ic: '🗿' },
  gb: { lbl: 'Gagner la Grande Boucle', ic: '🟡' },
  monde: { lbl: 'Devenir champion du monde', ic: '🌈' },
  heure: { lbl: "Battre le record de l'heure", ic: '⏱' },
};
// Libellé d'un rêve en milieu de phrase (« gagner la Grande Boucle »).
const carDreamTxt = d => CAR_DREAMS[d].lbl[0].toLowerCase() + CAR_DREAMS[d].lbl.slice(1);
// Talent (la difficulté) : niveau de départ parmi les cadets et potentiel caché moyen. Le potentiel reste caché
// et incertain : un « phénomène » peut plafonner, un « modeste » peut éclore.
const CAR_TALENT = {
  modeste: {
    lbl: 'Modeste',
    d: 'Un passionné parmi d’autres : passer pro sera déjà un exploit.',
    lvl: -12.6,
    ceil: 70,
  },
  prometteur: {
    lbl: 'Prometteur',
    d: 'Parmi les bons cadets de ta région. Équipier ou leader : à toi de voir.',
    lvl: -11.2,
    ceil: 74,
  },
  doue: {
    lbl: 'Doué',
    d: 'On parle de toi dans les clubs voisins. Un vrai potentiel de leader.',
    lvl: -9.9,
    ceil: 79,
  },
  phenomene: {
    lbl: 'Phénomène',
    d: 'Le prodige que tout le monde attend. Les Grands Tours ne sont pas un rêve.',
    lvl: -8.6,
    ceil: 84,
  },
};
const CAR_GABARIT = {
  petit: { lbl: 'Petit et léger', cm: [163, 171], bmi: 19.4 },
  moyen: { lbl: 'Moyen', cm: [172, 179], bmi: 20.4 },
  grand: { lbl: 'Grand et puissant', cm: [180, 190], bmi: 21.5 },
};
const CAR_TRAIN = {
  normal: 'Équilibré',
  foncier: 'Endurance (foncier)',
  montagne: 'Montagne',
  sprint: 'Sprint et explosivité',
  clm: 'Contre-la-montre',
  paves: 'Pavés et classiques',
  repos: 'Repos',
};
const CAR_VOLUME = {
  leger: { lbl: 'Léger', prog: 0.75, fat: -3, inj: 0.4 },
  normal: { lbl: 'Normal', prog: 1, fat: 0, inj: 1 },
  gros: { lbl: 'Gros volume', prog: 1.22, fat: 5, inj: 2.6 },
};
const CAR_STUDIES = {
  lycee: { lbl: 'Lycée classique', train: 0.8, d: 'Moins de temps pour rouler, mais un diplôme assuré.' },
  sport: { lbl: 'Sport-études', train: 0.93, d: "Horaires aménagés : un bon compromis, s'il y a une place." },
  arret: { lbl: 'Arrêter les études', train: 1, d: 'Tout pour le vélo. Sans diplôme, la reconversion sera plus dure.' },
  sup: { lbl: 'Études supérieures en parallèle', train: 0.85, d: 'Un pied dans la vie d’après, un peu moins de vélo.' },
  velo: { lbl: '100 % vélo', train: 1, d: 'Tout miser sur le vélo.' },
};
const CAR_POOL_N = 46; // coureurs suivis par classe d'âge (la « génération »)
// Décisions du mode carrière : effets par type de décision (clé « type:… »), complétés par les fichiers 42-44.
const CAR_FX = {};

// ---------- État ----------
function carMe() {
  return S && S.car ? S.riders[S.car.id] : null;
}
function carCatOf(age) {
  return age <= 16 ? 'cadet' : age <= 18 ? 'junior' : 'espoir';
}
function carFeed(title, body) {
  S.car.feed.unshift({ s: S.season, w: S.week, title, body });
  if (S.car.feed.length > 150) S.car.feed.length = 150;
}
// Une décision à prendre (défaut à l'échéance de trois semaines). data : informations pour l'effet.
function carAsk(key, txt, opts, def, data) {
  if (S.car.asks.some(a => a.key === key)) return;
  S.car.asks.push({ key, txt, opts, def: def || opts[0][0], exp: S.week + 3, s: S.season, data: data || null });
}
function carAnswer(key, opt, auto) {
  const i = S.car.asks.findIndex(a => a.key === key);
  if (i < 0) return null;
  const a = S.car.asks[i];
  S.car.asks.splice(i, 1);
  const lbl = (a.opts.find(o => o[0] === opt) || a.opts[0])[1];
  const fx = CAR_FX[key.split(':')[0]];
  const res = fx ? fx(opt, a) : '';
  carFeed(auto ? '⏳ Décision par défaut' : '✅ Décision', `${a.txt} → « ${lbl} ». ${res || ''}`);
  return res;
}
// Coureur d'une classe d'âge suivie (génération), potentiel tiré comme pour les jeunes du monde pro.
function carYouth(age, nat) {
  const arch = pick(Object.keys(ARCH));
  const r = genRider(arch, -12.5 + (Math.min(age, 22) - 16) * 1.6 + gauss() * 2.2, { age, nat });
  r.ceil = Math.round(clamp(70 + gauss() * 6.5 + (rnd() < 0.06 ? 9 : 0), 60, 92));
  rollDev(r);
  r.team = null;
  r.contract = 0;
  r.salary = 0;
  r.gen = true;
  r.jPts = 0;
  S.riders[r.id] = r;
  return r;
}

// ---------- Création ----------
function carNewGame(o) {
  newGame('Horizon Cyclisme', o.seed || Date.now(), 'normal');
  for (const k of Object.keys(AUTO_LBL)) setAuto(k, true);
  setSimple(true);
  S.inbox = [];
  const G = CAR_GABARIT[o.gab] || CAR_GABARIT.moyen;
  const Ta = CAR_TALENT[o.talent] || CAR_TALENT.prometteur;
  const r = genRider(o.arch, Ta.lvl + gauss() * 1.2, { age: 16, nat: o.nat });
  r.fn = cleanName(o.fn, 24) || r.fn;
  r.ln = cleanName(o.ln, 30) || r.ln;
  // potentiel caché : un jeune prometteur (déjà parmi les bons cadets de sa région), sans garantie de rien
  // incertain, mais un « doué » ne tombe pas sur un potentiel de modeste : pas plus de 7 points sous la moyenne
  r.ceil = Math.round(clamp(Ta.ceil + gauss() * 4.5 + (rnd() < 0.07 ? 6 : 0), Math.max(64, Ta.ceil - 7), 91));
  rollDev(r);
  r.ceil = Math.min(91, r.ceil);
  Object.assign(r, { team: null, contract: 0, salary: 0, car: true, moral: 70, forme: 62 });
  if (o.trait && TRAITS[o.trait]) r.trait = o.trait;
  // taille et poids adultes cachés : on les devine seulement (croissance jusqu'à 19 ans)
  r.cmF = clamp(Math.round(rf(G.cm[0], G.cm[1]) + gauss() * 2.5), 158, 197);
  r.cm = Math.round(r.cmF - rf(2, 7));
  r.kgF = +((G.bmi + gauss() * 0.6) * (r.cmF / 100) ** 2).toFixed(1);
  r.kg = Math.round(r.kgF - rf(5, 9));
  S.riders[r.id] = r;
  // la génération : trois classes d'âge (16, 17, 18 ans), une part de compatriotes
  const pool = [];
  for (const age of [16, 17, 18])
    for (let i = 0; i < CAR_POOL_N; i++) pool.push(carYouth(age, rnd() < 0.3 ? o.nat : undefined).id);
  const club = `${pick(CLUBS)} ${pick(PLACE)}`;
  S.car = {
    v: 2,
    id: r.id,
    born: S.season - 16,
    club,
    talent: o.talent || 'prometteur',
    kind: 'club', // club (cadets, juniors), conti (équipe formatrice), devo (réserve d'une équipe pro), pro
    parent: null, // équipe pro de la réserve
    clubLvl: 1,
    mates: pool.filter(id => S.riders[id].nat === o.nat && S.riders[id].age <= 17).slice(0, 5),
    pool, // cadets et juniors suivis
    u23: [], // espoirs suivis (19-22 ans)
    alumni: [],
    agent: null,
    stag: null,
    plan: 'normal',
    vol: 'normal',
    studies: o.studies || 'lycee',
    dreams: (o.dreams || ['pro']).slice(0, 3),
    gab: o.gab,
    skip: {},
    raced: {},
    res: [],
    seasons: [],
    feed: [],
    asks: [],
    vis: 0,
    selPts: 0,
    h2h: {},
    potKnow: 0.15,
    ov0: overall(r.s),
    s0: { ...r.s },
    trust: 55,
    diploma: false,
    money: 0,
  };
  carFeed(
    '🚴 Premier jour',
    `${r.fn} ${r.ln}, ${r.age} ans, licencié au ${club}. Première saison chez les cadets. Rêve : ${S.car.dreams.map(carDreamTxt).join(', ')}.`
  );
  return r;
}

// ---------- Potentiel ----------
// Potentiel estimé : la marge d'incertitude fond avec les années et les courses.
function carPotEst() {
  const r = carMe();
  const k = S.car.potKnow;
  const noise = ((mercHash('pot' + r.id + S.season) % 1000) / 1000 - 0.5) * 2;
  const est = r.ceil + noise * (1 - k) * 9;
  const spread = Math.round((1 - k) * 7 + 1);
  return { lo: Math.round(est - spread), hi: Math.round(est + spread), k };
}
function carPotLabel(v) {
  return v >= 86
    ? 'futur grand champion'
    : v >= 81
      ? 'futur leader'
      : v >= 76
        ? 'bon professionnel'
        : v >= 71
          ? 'pro modeste'
          : 'amateur de bon niveau';
}

// ---------- Progression et croissance ----------
// Même modèle que le monde pro (trainGain), à l'échelle des jeunes : un junior progresse, mais n'a pas encore le
// moteur d'un professionnel (repères : ~58 à 16 ans, ~65 à 18 ans, ~70 à 21 ans pour un bon espoir).
function carProgress(r, plan, mul) {
  const pk = PEAK_AGE[r.arch] || [26, 30];
  const ageF = R.progAge.find(e => r.age - (pk[0] - 26) <= e[0])[1] * devAgeMul(r);
  // un entraîneur personnel aide à aller chercher les derniers points du potentiel
  const gapF = clamp((r.ceil + (r.car && carHasStaff('coach') ? 2 : 0) - overall(r.s)) / 8, 0, 1.2);
  const youthF = r.age <= 16 ? 0.42 : r.age <= 17 ? 0.46 : r.age <= 18 ? 0.5 : r.age <= 20 ? 0.8 : 1;
  trainGain(r, plan, ageF * gapF * mul * youthF);
}
// Taille et poids rejoignent leur valeur adulte jusqu'à 19 ans ; chaque kilo pris pèse un peu en montée et
// aide sur le plat, au sprint et sur les pavés.
function carGrow(r) {
  if (r.age >= 19 || r.cmF == null) return;
  const f = 1 / Math.max(8, (19 - r.age) * 42 - (S.week - 1));
  const kg0 = r.kg;
  r.cm = Math.min(r.cmF, +(r.cm + (r.cmF - r.cm) * f * 1.4).toFixed(2));
  r.kg = +(r.kg + (r.kgF - r.kg) * f * 1.3).toFixed(2);
  r.kgAcc = (r.kgAcc || 0) + (r.kg - kg0);
  while (Math.abs(r.kgAcc) >= 1.6) {
    const sgn = Math.sign(r.kgAcc);
    r.kgAcc -= sgn * 1.6;
    r.s.mon = clamp(r.s.mon - sgn, 35, 95);
    const k = pick(['pla', 'spr', 'pav']);
    r.s[k] = clamp(r.s[k] + sgn, 35, 95);
  }
}
const CAR_GEN_PLANS = ['normal', 'normal', 'foncier', 'montagne', 'sprint'];
// Semaine d'un coureur suivi (génération) : forme et progression.
function carGenWeek(r) {
  r.forme = clamp(r.forme + (70 - r.forme) * 0.2 + gauss() * 2, 40, 95);
  carProgress(r, pick(CAR_GEN_PLANS), 0.95);
}

// ---------- Semaine ----------
function carWeekly() {
  const me = carMe();
  if (!me || me.retired) return;
  const C = S.car;
  const V = CAR_VOLUME[C.vol] || CAR_VOLUME.normal;
  const plan = C.plan;
  if (me.injury > 0) {
    me.injury--;
    me.forme = Math.max(30, me.forme - 4);
    if (!me.injury) carFeed('🩹 Rétabli', 'Tu peux reprendre l’entraînement normalement.');
  }
  const tgt = carFormeTarget(me, plan);
  me.forme = clamp(
    me.forme +
      (tgt - me.forme) * R.formeRate +
      gauss() * 2.2 * carTraitMul('formeNoise') -
      Math.max(0, me.fatigue - 40) * 0.12,
    30,
    100
  );
  me.fatigue = clamp(
    me.fatigue - (plan === 'repos' ? 18 : 11 - V.fat) * (0.6 + me.s.rec / 200) * (carHasStaff('soins') ? 1.1 : 1),
    0,
    100
  );
  // le moral revient doucement vers son niveau habituel, comme pour tous les coureurs du peloton
  me.moral = clamp(me.moral + (62 - me.moral) * 0.05, 0, 100);
  if (!me.injury) {
    const pInj =
      0.004 * V.inj * (1 + Math.max(0, me.fatigue - 50) / 25) * (me.age <= 17 ? 1.2 : 1) * carHealthRisk(me).inj;
    if (rnd() < pInj) {
      me.injury = rint(2, 6);
      smo(me, -8);
      carFeed(
        '🤕 Blessure',
        `Tendinite au genou : ${me.injury} semaines sans compétition.${C.vol === 'gros' ? ' Le gros volume a laissé des traces.' : ''}`
      );
    } else {
      const st = CAR_STUDIES[C.studies] || CAR_STUDIES.velo;
      carProgress(me, plan, st.train * V.prog * (C.kind === 'devo' ? 1.08 : 1) * carLifeTrain());
    }
  }
  carGrow(me);
  carBodyWeekly();
  carRepWeekly();
  carLifeWeekly();
  if (youthLoad(me) > youthLoadMax(me)) {
    me.fatigue = clamp(me.fatigue + 2, 0, 100);
    smo(me, -1);
  }
  for (const id of C.pool.concat(C.u23)) {
    const r = S.riders[id];
    if (r && !r.retired) carGenWeek(r);
  }
  // le bac (fin de l'année scolaire de terminale) pour ceux qui étudient
  if (S.week === 24 && me.age === 18 && (C.studies === 'lycee' || C.studies === 'sport')) {
    C.diploma = rnd() < 0.86 - (C.vol === 'gros' ? 0.12 : 0) - (me.moral < 45 ? 0.1 : 0);
    carFeed(
      C.diploma ? '🎓 Bac obtenu' : '📚 Bac raté',
      C.diploma
        ? 'Le diplôme en poche : un filet de sécurité pour l’après-vélo.'
        : 'Le vélo a pris trop de place cette année.'
    );
    smo(me, C.diploma ? 4 : -8);
  }
  // salaire (net de la commission de l'agent)
  if (C.kind === 'pro' && me.salary)
    C.money += (me.salary / LAST_WEEK) * (1 - (C.agent ? CAR_AGENTS[C.agent.kind].fee : 0)) * carLifeTax();
  carU23Weekly();
  carTeamWeekly();
  for (const a of C.asks.slice()) if (a.s !== S.season || S.week > a.exp) carAnswer(a.key, a.def, true);
}

// ---------- Saisons ----------
// Avant le changement de saison du monde : bilan.
function carEndSeason() {
  const me = carMe();
  if (!me) return;
  const ov = overall(me.s);
  const mine = S.car.res.filter(x => x.s === S.season);
  const best = mine.filter(x => x.rank).sort((a, b) => a.rank - b.rank)[0];
  const row = {
    s: S.season,
    age: me.age,
    ov,
    dov: ov - S.car.ov0,
    races: mine.length,
    wins: mine.filter(x => x.rank === 1).length,
    pod: mine.filter(x => x.rank && x.rank <= 3).length,
    best: best ? `${best.rank}e ${best.name}` : '—',
    team: S.car.club,
    pro: S.car.kind === 'pro',
    cm: Math.round(me.cm),
    kg: Math.round(me.kg),
  };
  S.car.seasons.push(row);
  carFeed(
    `📒 Bilan de la saison ${S.season}`,
    `Niveau ${ov} (${row.dov >= 0 ? '+' : ''}${row.dov}), ${row.races} course(s), ${row.wins} victoire(s). ${row.cm} cm, ${row.kg} kg.`
  );
  carRepEndSeason();
  carLifeEndSeason();
}
// Après le changement de saison du monde (les âges ont augmenté).
function carNewSeason() {
  const me = carMe();
  const C = S.car;
  carJuniorsNewSeason();
  carTeamNewSeason();
  carU23NewSeason();
  carLifeNewSeason();
  carRetireCheck();
  C.ov0 = overall(me.s);
  C.s0 = { ...me.s };
  C.selPts = 0;
  C.potKnow = Math.min(0.9, C.potKnow + 0.08);
  me.espDays = 0;
  if (me.team == null) me.stats = { days: 0, wins: 0, podiums: 0, pts: 0, disob: 0, kf: 0, att: 0 };
  if (me.age === 19) {
    carAsk(
      'studies:' + S.season,
      'Le bac derrière toi, il faut choisir : continuer les études en parallèle, ou tout miser sur le vélo ?',
      [
        ['sup', CAR_STUDIES.sup.lbl],
        ['velo', CAR_STUDIES.velo.lbl],
      ],
      'velo'
    );
  }
}
CAR_FX.studies = o => {
  S.car.studies = o;
  return CAR_STUDIES[o].d;
};
// Rivaux de ta génération : coureurs de ton âge, classés par résultats de la saison.
function carRivals(n = 8) {
  const me = carMe();
  const C = S.car;
  return C.pool
    .concat(C.u23, C.alumni)
    .map(id => S.riders[id])
    .filter(r => r && r.gen && !r.retired && r.age === me.age)
    .sort((a, b) => (b.jPts || 0) - (a.jPts || 0) || overall(b.s) - overall(a.s))
    .slice(0, n);
}
