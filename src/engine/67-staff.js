/* Le staff en personnages. Chaque poste est tenu par quelqu'un : entraîneurs, médecins et kinés, recruteurs, chef
   mécanicien, directeur adjoint. Sa compétence (1 à 5,9) fixe le niveau du poste utilisé par le reste du jeu
   (S.staff, S.meca, S.adj). Chacun a un âge, un caractère et une carrière :
   - il progresse avec l'expérience (vite quand il est jeune, plus du tout après 60 ans, sauf s'il est rigoureux) ;
   - les meilleurs (niveau 4 et plus) peuvent être débauchés en fin de saison : vous les retenez avec une prime, ou
     vous les laissez partir (un intérimaire de niveau 1 prend le poste) ;
   - il prend sa retraite vers 64 ans ;
   - le directeur adjoint dirige les courses que vous lui confiez : un bon adjoint fait mieux appliquer ses consignes ;
   - un membre passionné tire le moral de l'effectif vers le haut.
   L'entraîneur en chef spécialisé et le médecin-chef spécialisé (56-prep.js, 62-physio.js) restent des embauches à
   part. Rien ici ne tire au hasard du jeu. */

const CREW_ROLES = {
  coach: { lbl: 'Entraîneur principal', grp: 'Entraîneurs', d: 'Progression des coureurs et des jeunes, gestion de la forme.' },
  doctor: { lbl: 'Responsable médical', grp: 'Médecins et kinés', d: 'Récupération entre les étapes, blessures moins longues.' },
  scout: { lbl: 'Chef recruteur', grp: 'Recruteurs', d: 'Précision des estimations des coureurs adverses et des jeunes.' },
  meca: { lbl: 'Chef mécanicien', grp: 'Mécaniciens', d: 'Moins d’ennuis mécaniques, dépannages plus rapides.' },
  adjoint: { lbl: 'Directeur adjoint', grp: 'Direction sportive', d: 'Dirige les courses que vous lui confiez : ses coureurs appliquent mieux ses consignes.' },
};
const CREW_TRAITS = {
  pedagogue: { lbl: 'Pédagogue', d: 'Apprend vite et transmet bien : progresse plus chaque saison.' },
  ambitieux: { lbl: 'Ambitieux', d: 'Progresse vite, mais écoute volontiers les autres équipes.' },
  fidele: { lbl: 'Fidèle', d: 'Attaché au club : se laisse rarement débaucher.' },
  rigoureux: { lbl: 'Rigoureux', d: 'Garde son niveau avec l’âge.' },
  passionne: { lbl: 'Passionné', d: 'Son enthousiasme tire le moral de l’effectif vers le haut.' },
};
const ADJ_COST = [0, 40, 80, 140, 210, 300];
function crewLvl(p) {
  return p ? clamp(Math.floor(p.sk), 1, 5) : 1;
}
function crewCost(role, l) {
  return role === 'meca' ? MECA_COST[l] : role === 'adjoint' ? ADJ_COST[l] : STAFF_COST[l];
}
// Une personne (nom, âge, caractère) tirée d'une empreinte.
function crewPerson(role, sk, salt) {
  const h = dsHash('crew' + role + salt);
  const nats = Object.keys(NATS);
  const N = NATS[nats[h % nats.length]];
  const tr = Object.keys(CREW_TRAITS);
  return {
    id: h % 100000,
    role,
    fn: N.fn[(h >>> 5) % N.fn.length],
    ln: N.ln[(h >>> 11) % N.ln.length],
    age: 30 + ((h >>> 17) % 28),
    sk: +clamp(sk, 1, 5.9).toFixed(2),
    trait: tr[(h >>> 23) % tr.length],
    since: S.season,
  };
}
function crewInit() {
  if (S.crew) return S.crew;
  S.crew = {};
  const lv = { coach: S.staff.coach, doctor: S.staff.doctor, scout: S.staff.scout, meca: S.meca || 1, adjoint: S.adj || 2 };
  for (const k of Object.keys(CREW_ROLES)) S.crew[k] = crewPerson(k, lv[k] + 0.3, S.seed0 + ':init');
  crewSync();
  return S.crew;
}
// Niveaux des postes, lus par le reste du jeu.
function crewSync() {
  const C = S.crew;
  S.staff.coach = crewLvl(C.coach);
  S.staff.doctor = crewLvl(C.doctor);
  S.staff.scout = crewLvl(C.scout);
  S.meca = crewLvl(C.meca);
  S.adj = crewLvl(C.adjoint);
}
function crewName(p) {
  return p ? `${p.fn} ${p.ln}` : '—';
}
// Candidats pour un poste : trois profils, renouvelés toutes les quatre semaines.
function crewCandidates(role) {
  crewInit();
  const cur = crewLvl(S.crew[role]);
  const blk = S.season + ':' + Math.floor(S.week / 4);
  return [cur + 1, cur, Math.min(5, cur + 2)].map((l, i) => {
    const h = dsHash('cand' + role + blk + i);
    return crewPerson(role, Math.min(5, l) + (h % 70) / 100, blk + ':' + i);
  });
}
// Embauche (prime : la moitié de la hausse de salaire annuel).
function crewHire(role, p) {
  crewInit();
  const old = S.crew[role];
  const l0 = crewLvl(old),
    l1 = crewLvl(p);
  const fee = l1 > l0 ? (crewCost(role, l1) - crewCost(role, l0)) * 0.5 : 0;
  if (S.budget < fee) return `Budget insuffisant (prime d'embauche ${fmtMoney(fee)}).`;
  S.budget -= fee;
  finAdd('staff', -fee);
  S.crew[role] = { ...p, since: S.season };
  crewSync();
  return `${crewName(p)} devient ${CREW_ROLES[role].lbl.toLowerCase()} (niveau ${l1}${fee ? `, prime ${fmtMoney(fee)}` : ''}). ${old ? crewName(old) + ' quitte le club.' : ''}`;
}
function crewHireCand(role, i) {
  const c = crewCandidates(role)[i];
  return c ? crewHire(role, c) : 'Candidat inconnu.';
}
// Ancienne façon de régler un poste (adjoint automatique) : embauche d'une personne du niveau voulu.
function crewSetLevel(role, l) {
  crewInit();
  if (crewLvl(S.crew[role]) === l) return null;
  const r = crewHire(role, crewPerson(role, l + 0.3, S.season + ':' + S.week + ':lvl'));
  return /insuffisant/.test(r) ? r : null;
}
// Coût hebdomadaire de l'adjoint (les autres postes sont dans staffWeekly).
function crewWeekly() {
  if (S.car) return;
  crewInit();
  const c = ADJ_COST[crewLvl(S.crew.adjoint)] / LAST_WEEK;
  S.budget -= c;
  finAdd('staff', -c);
  // une proposition de débauchage sans réponse : l'adjoint tranche (il retient si le budget le permet)
  const A = S.crewAsk;
  if (A && S.week > A.exp && S.season === A.s) msg('💼 Staff', crewAnswer(S.budget >= A.prime ? 'garder' : 'laisser', true));
}
// Bonus d'obéissance dans une course confiée au directeur adjoint.
function adjObey(x, sim) {
  if (!x.player || !sim || !sim.rc || !sim.rc.delegated) return 0;
  return 0.01 * ((S.adj || 2) - 3);
}
// Moral : un membre passionné du staff.
function crewMoral() {
  if (!S.crew) return 0;
  return Object.values(S.crew).some(p => p && p.trait === 'passionne') ? 1 : 0;
}
// Fin de saison : progression, retraites, propositions de débauchage.
function crewEndSeason() {
  if (S.car) return;
  crewInit();
  const out = [];
  for (const role of Object.keys(CREW_ROLES)) {
    const p = S.crew[role];
    const h = dsHash('prog' + p.id + S.season);
    p.age++;
    const base = p.age < 35 ? 0.25 : p.age < 50 ? 0.12 : p.age < 60 ? 0 : p.trait === 'rigoureux' ? 0 : -0.15;
    const l0 = crewLvl(p);
    p.sk = +clamp(p.sk + base + (['pedagogue', 'ambitieux'].includes(p.trait) ? 0.15 : 0) + ((h % 21) - 10) / 100, 1, 5.9).toFixed(2);
    if (crewLvl(p) > l0) out.push(`${crewName(p)} (${CREW_ROLES[role].lbl.toLowerCase()}) passe au niveau ${crewLvl(p)}.`);
    if (p.age >= 64) {
      const n = crewPerson(role, Math.max(1, crewLvl(p) - 1) + 0.3, S.season + ':ret');
      out.push(`${crewName(p)} prend sa retraite ; ${crewName(n)} lui succède (niveau ${crewLvl(n)}).`);
      S.crew[role] = n;
    }
  }
  crewSync();
  // débauchage : une équipe de l'ordinateur veut l'un de vos meilleurs membres
  if (!S.crewAsk) {
    const cands = Object.keys(CREW_ROLES).filter(k => crewLvl(S.crew[k]) >= 4);
    for (const role of cands) {
      const p = S.crew[role];
      const pr = p.trait === 'ambitieux' ? 30 : p.trait === 'fidele' ? 5 : 15;
      if (dsHash('poach' + p.id + S.season) % 100 < pr) {
        const ai = S.teams.filter(T => !T.player);
        const T = ai[dsHash('poachT' + p.id + S.season) % ai.length];
        S.crewAsk = { role, t: T.id, s: S.season + 1, exp: 4, prime: Math.round((crewCost(role, crewLvl(p)) * 0.25) / 5) * 5 };
        out.push(`${T.name} veut débaucher ${crewName(p)}, votre ${CREW_ROLES[role].lbl.toLowerCase()} : décision à prendre (Club › Staff).`);
        break;
      }
    }
  }
  if (out.length) msg('💼 Le staff', out.join('<br>'));
}
function crewAnswer(k, auto) {
  const A = S.crewAsk;
  if (!A) return 'Plus de décision en attente.';
  S.crewAsk = null;
  const p = S.crew[A.role];
  const T = teamById(A.t);
  if (k === 'garder') {
    if (S.budget < A.prime) return 'Budget insuffisant pour la prime.';
    S.budget -= A.prime;
    finAdd('staff', -A.prime);
    if (p.trait === 'ambitieux') p.trait = 'fidele';
    return `${auto ? "L'adjoint retient" : 'Vous retenez'} ${crewName(p)} avec une prime de ${fmtMoney(A.prime)}.`;
  }
  const n = crewPerson(A.role, 1.3, S.season + ':int');
  S.crew[A.role] = n;
  crewSync();
  return `${crewName(p)} part chez ${T ? T.name : 'un concurrent'}. ${crewName(n)} assure l'intérim (niveau 1) : pensez à recruter.`;
}
