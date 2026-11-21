/* Préparation : stages d'équipe (un à la fois, payants, effets sur plusieurs semaines), test d'effort (révèle le vrai
   potentiel d'un de mes coureurs) et entraîneur en chef spécialisé (progression renforcée dans son domaine).
   Ne concerne que mon équipe : la simulation des autres équipes n'en dépend pas. */

const CAMPS = {
  altitude: {
    lbl: "🏔️ Stage en altitude d'équipe",
    cost: 120,
    weeks: 3,
    d: "Forme visée +4 pour tout l'effectif pendant 3 semaines (globules rouges), puis effet qui s'estompe.",
  },
  train: {
    lbl: '🚂 Stage du train de sprint',
    cost: 60,
    weeks: 8,
    d: 'Poissons-pilotes et sprinteurs répètent les lancements : le train mène 15 % plus vite pendant 8 semaines.',
  },
  montagne: {
    lbl: '⛰️ Stage de montagne',
    cost: 80,
    weeks: 4,
    d: 'Progression en montagne renforcée pour les grimpeurs et leaders pendant 4 semaines.',
  },
  cohesion: {
    lbl: '🤝 Stage de cohésion',
    cost: 40,
    weeks: 6,
    d: 'Moral +10 tout de suite ; les consignes sont mieux respectées (+5 points) pendant 6 semaines.',
  },
};
function campOn(k) {
  return !!(S.camp && S.camp.k === k && S.week <= S.camp.until);
}
// Organiser un stage (un à la fois). Renvoie le message à afficher.
function campStart(k) {
  const C = CAMPS[k];
  if (!C) return 'Stage inconnu.';
  if (S.camp && S.week <= S.camp.until) return `Un stage est déjà en cours (${CAMPS[S.camp.k].lbl}).`;
  if (S.budget < C.cost) return `Budget insuffisant (${fmtMoney(C.cost)}).`;
  S.budget -= C.cost;
  finAdd('other', -C.cost);
  S.camp = { k, until: S.week + C.weeks - 1, s: S.season };
  if (k === 'cohesion') for (const id of S.teams[0].riders) S.riders[id].moral = clamp(S.riders[id].moral + 10, 0, 100);
  return `${C.lbl} organisé (${fmtMoney(C.cost)}) : effet jusqu'à la semaine ${S.camp.until}.`;
}
// Semaine d'entraînement d'un de mes coureurs : bonus de forme visée (altitude).
function campFormBonus(r) {
  return r.team === 0 && campOn('altitude') ? 4 : 0;
}
// Progression supplémentaire de la semaine (stage de montagne, entraîneur en chef spécialisé).
function prepGain(r, g0) {
  if (r.team !== 0) return;
  if (campOn('montagne') && (r.arch === 'grimpeur' || r.arch === 'complet')) trainGain(r, 'montagne', g0 * 0.6);
  const c = S.coach;
  if (!c) return;
  if (c.k === 'jeunes') {
    if (r.age <= 23) trainGain(r, r.training || 'normal', g0 * 0.25);
  } else trainGain(r, c.k, g0 * 0.25);
}
// Test d'effort : la vraie valeur de son potentiel est connue (8 k€).
function effortTest(id) {
  const r = S.riders[id];
  if (!r || r.team !== 0) return 'Seulement pour vos coureurs.';
  if ((S.know[id] || 0) >= 100) return 'Déjà testé : son potentiel est connu.';
  if (S.budget < 8) return 'Budget insuffisant (8 k€).';
  S.budget -= 8;
  finAdd('other', -8);
  S.know[id] = 100;
  return `🧪 Test d'effort de ${riderName(r)} : potentiel ${stars(potEst(r))}, seuil ≈ ${Math.round(riderCP(r))} W, réserve ≈ ${fmtDec(wPrime(r), 1)} kJ.`;
}
// Entraîneurs en chef candidats de la saison (trois profils, fixes pour la saison).
const COACH_SPEC = {
  montagne: 'de la montagne',
  sprint: 'du sprint',
  clm: 'du contre-la-montre',
  paves: 'des pavés',
  jeunes: 'des jeunes (23 ans et moins)',
};
function coachCandidates() {
  const ks = Object.keys(COACH_SPEC);
  const N = NATS.FRA;
  const out = [];
  for (let i = 0; i < 3; i++) {
    const h = dsHash('coach' + S.season + i);
    out.push({
      k: ks[(h + i * 2) % ks.length],
      fn: N.fn[h % N.fn.length],
      ln: N.ln[(h >>> 8) % N.ln.length],
      fee: 40 + ((h >>> 4) % 5) * 10,
    });
  }
  return out;
}
function hireCoach(i) {
  const c = coachCandidates()[i];
  if (!c) return 'Candidat inconnu.';
  if (S.budget < c.fee) return `Budget insuffisant (${fmtMoney(c.fee)}).`;
  S.budget -= c.fee;
  finAdd('other', -c.fee);
  S.coach = { k: c.k, n: `${c.fn} ${c.ln}`, s: S.season };
  return `${c.fn} ${c.ln} devient votre entraîneur en chef, spécialiste ${COACH_SPEC[c.k]}.`;
}
