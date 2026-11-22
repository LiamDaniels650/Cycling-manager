/* Préparation : stages d'équipe (un à la fois, payants, effets sur plusieurs semaines), test d'effort (révèle le vrai
   potentiel d'un de mes coureurs ou d'un jeune à recruter) et entraîneur en chef spécialisé (progression renforcée dans son domaine).
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
  if (r.team === 0) return campOn('altitude') ? 4 : 0;
  return aiCampOn(r.team) ? 3 : 0;
}
/* Les équipes de l'ordinateur se préparent aussi : trois semaines avant chacune de leurs courses objectifs (choisies
   par leur directeur), l'effectif part en stage en altitude (forme visée +3), ce qui fait culminer leur forme au bon
   moment. La presse l'annonce pour les grands rendez-vous. Aucun tirage. */
let AI_CAMP = null;
function aiCampOn(tid) {
  const key = S.season * 100 + S.week;
  if (!AI_CAMP || AI_CAMP.key !== key) {
    AI_CAMP = { key, on: {} };
    for (const T of S.teams) {
      const d = T.player ? null : dsOf(T);
      if (!d) continue;
      if (d.gs !== S.season) dsSeasonGoals();
      for (const k of d.goals) {
        const c = S.cal.find(c => c.key === k);
        const dw = c ? c.w - S.week : -1;
        if (dw >= 1 && dw <= 3) AI_CAMP.on[T.id] = c;
      }
    }
  }
  return AI_CAMP.on[tid] || null;
}
// Annonce de la presse (au début du stage, pour une course majeure).
function aiCampPress() {
  for (const T of S.teams) {
    const c = aiCampOn(T.id);
    if (!c || c.w - S.week !== 3 || c.cat > 1) continue;
    press(
      `${T.name} en stage en altitude`,
      `Trois semaines avant ${c.name}, ${T.name} s'isole en altitude : ${dsName(T)} veut une équipe au sommet de sa forme.`,
      0,
      []
    );
  }
}
// Progression supplémentaire de la semaine (stage de montagne, entraîneur en chef spécialisé).
function prepGain(r, g0) {
  if (r.team !== 0) return;
  acaFacGain(r, g0); // centre de formation
  if (campOn('montagne') && (r.arch === 'grimpeur' || r.arch === 'complet')) trainGain(r, 'montagne', g0 * 0.6);
  const c = S.coach;
  if (!c) return;
  if (c.k === 'jeunes') {
    if (r.age <= 23) trainGain(r, r.training || 'normal', g0 * 0.25);
  } else trainGain(r, c.k, g0 * 0.25);
}
// Test d'effort : la vraie valeur de son potentiel est connue. Mes coureurs (académie comprise) : 8 k€. Recrutement
// (jeunes du vivier, coureurs de 23 ans et moins d'autres équipes ou libres) : 12 k€, cinq tests par saison — ses
// caractéristiques et son potentiel deviennent exacts.
const EFFORT_MAX = 5;
function effortCost(r) {
  return r.team === 0 ? 8 : 12;
}
// Peut-on tester ce coureur ? (null si oui, sinon la raison)
function effortBlock(r) {
  if (!r || r.retired) return 'Coureur inconnu.';
  if ((S.know[r.id] || 0) >= 100) return 'Déjà testé : son potentiel est connu.';
  if (r.team !== 0) {
    if (!(r.youth || r.age <= 23)) return 'Test réservé à vos coureurs et aux jeunes à recruter (23 ans et moins).';
    if (effortLeft() <= 0) return `Plus de test de recrutement cette saison (${EFFORT_MAX} au maximum).`;
  }
  return null;
}
function effortLeft() {
  const n = S.etN && S.etN.s === S.season ? S.etN.n : 0;
  return EFFORT_MAX - n;
}
function effortTest(id) {
  const r = S.riders[id];
  const why = effortBlock(r);
  if (why) return why;
  const cost = effortCost(r);
  if (S.budget < cost) return `Budget insuffisant (${cost} k€).`;
  S.budget -= cost;
  finAdd('other', -cost);
  S.know[id] = 100;
  if (r.team !== 0) S.etN = { s: S.season, n: EFFORT_MAX - effortLeft() + 1 };
  return `🧪 Test d'effort de ${riderName(r)} : potentiel ${stars(potEst(r))}, seuil ≈ ${Math.round(riderCP(r))} W, réserve ≈ ${fmtDec(wPrime(r), 1)} kJ${r.team !== 0 ? ` (encore ${effortLeft()} test${effortLeft() > 1 ? 's' : ''} de recrutement cette saison)` : ''}.`;
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

/* ---- Statistiques de forme ----
   Forme moyenne de l'effectif chaque semaine (S.tf, saison en cours), bilan de chaque stage (forme et fraîcheur de
   l'effectif avant et à la fin, victoires pendant le stage : S.campLog) et, pour chaque coureur, forme moyenne et pic
   de la saison gardés dans sa carrière. */
function teamFormNow() {
  const rs = S.teams[0].riders.map(id => S.riders[id]).filter(r => r && r.injury <= 0);
  if (!rs.length) return [0, 0];
  return [Math.round(sum(rs.map(r => r.forme)) / rs.length), Math.round(sum(rs.map(r => 100 - r.fatigue)) / rs.length)];
}
function formWeekly() {
  if (!S.tf || S.tf.s !== S.season) S.tf = { s: S.season, v: [] };
  const [f, fr] = teamFormNow();
  S.tf.v.push([f, fr, campOn(S.camp && S.camp.k) ? 1 : 0]);
  // un stage commence : point de départ ; un stage se termine : bilan
  const c = S.camp;
  if (c && c.s === S.season && c.f0 == null) {
    c.f0 = f;
    c.fr0 = fr;
    c.w0 = S.week;
    c.v0 = seasonWins(0);
  }
  if (c && c.f0 != null && !c.logged && (S.week > c.until || c.s !== S.season)) {
    c.logged = true;
    (S.campLog = S.campLog || []).unshift({
      k: c.k,
      s: c.s,
      w0: c.w0,
      w1: c.until,
      df: f - c.f0,
      dfr: fr - c.fr0,
      v: c.s === S.season ? seasonWins(0) - c.v0 : 0,
    });
    if (S.campLog.length > 12) S.campLog.length = 12;
  }
}
// Résumé de la saison d'un coureur (forme moyenne et pic, semaine du pic) pour sa carrière.
function formSeason(r) {
  if (!r.fs || r.fs.s !== S.season || !r.fs.v.length) return {};
  const v = r.fs.v;
  const pk = Math.max(...v);
  return { fm: Math.round(sum(v) / v.length), fp: pk, fw: v.indexOf(pk) + 1 };
}
