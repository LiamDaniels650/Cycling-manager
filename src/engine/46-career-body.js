/* Mode carrière — le corps et la santé : hygiène de vie, poids (choix permanent), maladies, blessures graves
   avec rééducation et risque de rechute, déclin après le pic du profil (freiné par l'hygiène), caractère et rêves
   (ils pèsent aussi, un peu). Chaque choix du joueur a un effet mesurable : voir tests/career_impact.js. */

const CAR_HYG = {
  stricte: {
    lbl: 'Stricte',
    d: 'Sommeil, diététique, pas d’écart : forme et santé, mais le moral paie les sacrifices.',
    forme: 1.5,
    ill: 0.7,
    decl: 0.6,
    moral: -0.35,
    kg: -0.03,
  },
  normale: { lbl: 'Normale', d: 'Sérieux sans excès.', forme: 0, ill: 1, decl: 1, moral: 0, kg: 0 },
  relachee: {
    lbl: 'Relâchée',
    d: 'La vie à côté du vélo : bon moral, mais forme, santé et poids en souffrent.',
    forme: -2,
    ill: 1.4,
    decl: 1.4,
    moral: 0.4,
    kg: 0.05,
  },
};
const CAR_WEIGHT = {
  maintien: { lbl: 'Garder mon poids', dkg: 0 },
  perdre: { lbl: 'Perdre du poids (montée)', dkg: -4 },
  prendre: { lbl: 'Prendre du muscle (plat, sprint, pavés)', dkg: 4 },
};
const CAR_REHAB = {
  prudente: { lbl: 'Rééducation prudente', d: 'Plus longue, sans risque de rechute.', dur: 1.3, relapse: 0 },
  normale: { lbl: 'Rééducation normale', d: 'Le temps prévu, petit risque de rechute.', dur: 1, relapse: 0.12 },
  acceleree: {
    lbl: 'Retour accéléré',
    d: 'Revenir vite, au risque de rechuter et de laisser des traces.',
    dur: 0.6,
    relapse: 0.38,
  },
};

function carBmi(r) {
  return r.kg / (r.cm / 100) ** 2;
}
// Poids : vers la cible (taille adulte : à partir de 19 ans) ; chaque kilo change un peu le profil.
function carWeightStep(r) {
  const C = S.car;
  const H = CAR_HYG[C.hyg || 'normale'];
  if (r.age < 19) return;
  const W = CAR_WEIGHT[C.wgoal || 'maintien'];
  const base = C.kgBase || (C.kgBase = r.kg);
  const target = clamp(base + W.dkg, 18.2 * (r.cm / 100) ** 2, 24.5 * (r.cm / 100) ** 2);
  const kg0 = r.kg;
  r.kg = +(r.kg + clamp(target - r.kg, -0.12, 0.12) + H.kg).toFixed(2);
  carKgEffect(r, r.kg - kg0);
}
// Effet des kilos pris ou perdus : montée contre plat, sprint et pavés (un point tous les 1,6 kg).
function carKgEffect(r, dkg) {
  r.kgAcc = (r.kgAcc || 0) + dkg;
  while (Math.abs(r.kgAcc) >= 1.6) {
    const sgn = Math.sign(r.kgAcc);
    r.kgAcc -= sgn * 1.6;
    r.s.mon = clamp(r.s.mon - sgn, 35, 95);
    const k = pick(['pla', 'spr', 'pav']);
    r.s[k] = clamp(r.s[k] + sgn, 35, 95);
  }
}
// Risque santé de la semaine (maladie, blessure à l'entraînement) : hygiène, poids, fatigue, âge.
function carHealthRisk(r) {
  const H = CAR_HYG[S.car.hyg || 'normale'];
  const thin = r.age >= 19 && carBmi(r) < 19.3 ? 1.6 : 1;
  const soins = carHasStaff('soins') ? 0.75 : 1;
  return { ill: H.ill * thin * soins * (1 + Math.max(0, r.fatigue - 55) / 40), inj: thin * soins };
}
// Semaine santé : maladie, poids, rechute, rééducation à décider, moral de l'hygiène de vie.
function carBodyWeekly() {
  const C = S.car;
  const me = carMe();
  const H = CAR_HYG[C.hyg || 'normale'];
  carWeightStep(me);
  me.moral = clamp(me.moral + H.moral, 0, 100);
  if (me.age >= 19 && carBmi(me) < 19.3) {
    me.moral = clamp(me.moral - 0.3, 0, 100);
    me.fatigue = clamp(me.fatigue + 0.6, 0, 100);
  }
  // maladie (plus fréquente en début de saison, l'hiver)
  if (me.injury <= 0) {
    const risk = carHealthRisk(me);
    if (rnd() < 0.006 * risk.ill * (S.week <= 8 ? 1.8 : 1)) {
      me.injury = rint(1, 2);
      me.forme = Math.max(35, me.forme - 8);
      carFeed(
        '🤒 Malade',
        `Une grippe te cloue au lit : ${me.injury} semaine(s) sans vélo.${C.hyg === 'relachee' ? ' Le manque de sommeil n’a pas aidé.' : ''}`
      );
    }
  }
  // blessure grave : la rééducation se décide
  if (me.injury >= 3 && !C.rehabAsked) {
    C.rehabAsked = true;
    carAsk(
      'rehab:' + S.season + ':' + S.week,
      `Blessure sérieuse : ${me.injury} semaines d'arrêt prévues. Quelle rééducation ?`,
      Object.entries(CAR_REHAB).map(([k, v]) => [k, `${v.lbl} — ${v.d}`]),
      'normale'
    );
  }
  if (me.injury <= 0 && C.rehabAsked) {
    C.rehabAsked = false;
    if (C.relapse && rnd() < C.relapse) {
      me.injury = rint(2, 4);
      const k = pick(STATS);
      me.s[k] = Math.max(35, me.s[k] - 1);
      carFeed(
        '😖 Rechute',
        `La blessure se réveille : ${me.injury} semaines de plus, et ${STAT_LBL[k].toLowerCase()} en a pris un coup.`
      );
      C.rehabAsked = true;
    }
    C.relapse = 0;
  }
}
CAR_FX.rehab = o => {
  const me = carMe();
  const R = CAR_REHAB[o] || CAR_REHAB.normale;
  me.injury = Math.max(1, Math.round(me.injury * R.dur));
  S.car.relapse = R.relapse;
  return `${R.lbl} : retour prévu dans ${me.injury} semaine(s).`;
};
// Déclin après le pic (appelé par endSeason pour le coureur du joueur) : l'hygiène le freine ou l'accélère.
function carDeclineMul() {
  return CAR_HYG[(S.car && S.car.hyg) || 'normale'].decl;
}
// Forme visée de la semaine (entraînement, hygiène, caractère).
function carFormeTarget(me, plan) {
  const H = CAR_HYG[S.car.hyg || 'normale'];
  return (
    (plan === 'repos' ? 56 : 70 + (S.car.vol === 'gros' ? 3 : S.car.vol === 'leger' ? -3 : 0)) +
    H.forme +
    carLifeForme()
  );
}
// Caractère du joueur : il colore ses réactions (moral, confiance du directeur sportif, visibilité).
function carTraitMul(kind) {
  const t = carMe().trait;
  if (kind === 'moralDown') return t === 'fragile' ? 1.6 : t === 'gagneur' ? 0.8 : 1;
  if (kind === 'moralUp') return t === 'fragile' ? 1.3 : 1;
  if (kind === 'formeNoise') return t === 'regulier' ? 0.5 : 1;
  if (kind === 'trustObey') return t === 'modele' ? 1.6 : t === 'leaderne' ? 0.6 : 1;
  if (kind === 'trustSolo') return t === 'tete' || t === 'opportuniste' ? 1.3 : 1;
  if (kind === 'ask') return t === 'leaderne' || t === 'tete' ? 6 : t === 'modele' ? -6 : 0;
  if (kind === 'vis') return t === 'opportuniste' || t === 'gagneur' ? 1.2 : 1;
  return 1;
}
// Rêves d'enfant : la course qui le fait vibrer le motive (forme et moral au départ).
function carDreamMatch(name, key, tier) {
  const D = S.car.dreams;
  return (
    (D.includes('gb') && key === 'gb') ||
    (D.includes('monde') && (tier === 'monde' || key === 'worlds')) ||
    (D.includes('nat') && (tier === 'nat' || key === 'natio')) ||
    (D.includes('monument') && MONUMENTS.includes(key)) ||
    (D.includes('gtstage') && ['gb', 'giro', 'vuelta'].includes(key))
  );
}
function carDreamBoost(name, key, tier) {
  if (!carDreamMatch(name, key, tier)) return false;
  const me = carMe();
  me.forme = clamp(me.forme + 3, 0, 100);
  me.moral = clamp(me.moral + 4, 0, 100);
  carFeed('✨ La course de tes rêves', `${name} : celle dont tu rêvais gamin. Tu prends le départ gonflé à bloc.`);
  return true;
}
