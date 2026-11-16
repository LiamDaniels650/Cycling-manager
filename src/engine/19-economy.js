/* Économie du joueur : difficulté, comptes de la saison, staff, sponsor principal (contrat et part variable),
   demandes de revalorisation salariale */
const DIFF = {
  facile: { lbl: 'Facile', spons: 1.15, cost: 0.85, budget: 1900, obj: -1 },
  normal: { lbl: 'Normal', spons: 1, cost: 1, budget: 1500, obj: 0 },
  difficile: { lbl: 'Difficile', spons: 0.85, cost: 1.15, budget: 1200, obj: 1 },
};
const SPONSOR_NAMES = [
  'Banque Régionale',
  'Énergies Nouvelles',
  'Assurances Mutuelles',
  'Supermarchés Horizon',
  'Télécom Avenir',
  'Cafés du Monde',
  'Immobilier Atlantique',
  'Pneus Grand Prix',
];
// Paramètres de la difficulté choisie.
function diffOf() {
  return DIFF[S.diff] || DIFF.normal;
}
// Difficulté et sponsor principal (nouvelle partie ou ancienne sauvegarde).
function initEconomy(diff) {
  if (diff) S.diff = diff;
  S.diff = S.diff || 'normal';
  if (!S.spons) S.spons = { name: pick(SPONSOR_NAMES), base: R.sponsorBase, years: 3 };
  S.raiseReq = S.raiseReq || null;
}
// Coût d'une journée de course (déplacements, hôtels, assistance), selon la difficulté.
function raceDayCost() {
  return R.raceDay * diffOf().cost;
}
// Fin de saison : le contrat du sponsor arrive à échéance tous les 2 ou 3 ans et se renégocie selon sa confiance.
function sponsorEndSeason() {
  initEconomy();
  const sp = S.spons;
  sp.years--;
  if (sp.years > 0) return;
  // une identité forte se vend bien : bonus jusqu'à +8 % à la signature
  const ib = imageSponsorBonus();
  const ibTxt =
    ib >= 0.01 ? ` L'image de l'équipe (${imageLabel().lbl.toLowerCase()}) a pesé : +${Math.round(ib * 100)} %.` : '';
  if (S.conf >= 60) {
    sp.base = Math.round(sp.base * (1.1 + ib) * 10) / 10;
    sp.years = 3;
    msg('Sponsor', `${sp.name} est ravi et prolonge son engagement pour 3 saisons, en l'augmentant de 10 %.${ibTxt}`);
  } else if (S.conf >= 35) {
    sp.base = Math.round(sp.base * (1 + ib) * 10) / 10;
    sp.years = 2;
    msg('Sponsor', `${sp.name} prolonge de 2 saisons, aux mêmes conditions. Il attend mieux.${ibTxt}`);
  } else {
    const old = sp.name;
    S.spons = {
      name: pick(SPONSOR_NAMES.filter(n => n !== old)),
      base: Math.round(sp.base * (0.8 + ib) * 10) / 10,
      years: 2,
    };
    S.conf = 45;
    msg(
      '⚠️ Changement de sponsor',
      `${old} se retire. ${S.spons.name} le remplace, mais avec un budget réduit de 20 %.`
    );
    press(
      `${old} quitte ${S.teams[0].name}`,
      `Le sponsor principal se retire après des résultats jugés insuffisants.`,
      -1
    );
  }
}
// Un coureur qui a fortement progressé (ou qui est devenu populaire) réclame une revalorisation de son contrat.
function raiseCheck() {
  if (S.raiseReq || !(S.week === 18 || S.week === 34)) return;
  const cands = S.teams[0].riders
    .map(id => S.riders[id])
    .filter(r => !r.aca && r.contract >= 2 && r.amb > 50 && contractDemand(r) > r.salary * 1.35);
  if (!cands.length) return;
  const r = cands.sort((a, b) => contractDemand(b) / b.salary - contractDemand(a) / a.salary)[0];
  if (rnd() > 0.6) return;
  S.raiseReq = { id: r.id, ask: Math.round((contractDemand(r) * 0.9) / 5) * 5, w: S.week };
  msg(
    `${riderName(r)} demande une augmentation`,
    `${riderName(r)} estime mériter ${fmtMoney(S.raiseReq.ask)}/an (actuellement ${fmtMoney(r.salary)}). Répondez-lui dans l'onglet Équipe.`
  );
}
// Réponse du joueur (ou de l'adjoint) à une demande d'augmentation.
function answerRaise(ok) {
  const q = S.raiseReq;
  if (!q) return null;
  const r = S.riders[q.id];
  S.raiseReq = null;
  if (!r || r.team !== 0) return null;
  if (ok) {
    r.salary = q.ask;
    r.moral = clamp(r.moral + 8, 0, 100);
    return `${riderName(r)} est satisfait : nouveau salaire ${fmtMoney(q.ask)}/an.`;
  }
  r.moral = clamp(r.moral - 12, 0, 100);
  if (r.amb > 70 && rnd() < 0.4) r.wantsOut = true;
  return `${riderName(r)} est déçu${r.wantsOut ? ' et demande à partir' : ''}.`;
}
function finAdd(k, v) {
  S.fin = S.fin || {};
  const f = (S.fin[S.season] = S.fin[S.season] || {
    sal: 0,
    staff: 0,
    spons: 0,
    prize: 0,
    transf: 0,
    aca: 0,
    other: 0,
  });
  f[k] = (f[k] || 0) + v;
}
// coût annuel du staff par niveau (k€) : un vrai choix économique (entraîneurs, médecins, recruteurs)
const STAFF_COST = [0, 100, 225, 400, 625, 900];
const STAFF_LBL = { coach: 'Entraîneurs', doctor: 'Médecins & kinés', scout: 'Recruteurs' };
const STAFF_DESC = {
  coach: 'Progression des coureurs et des jeunes, gestion de la forme.',
  doctor: "Récupération entre les étapes, blessures moins longues, moins d'abandons après chute.",
  scout: 'Précision des estimations (caractéristiques et potentiel) des coureurs adverses et des jeunes.',
};
// Coût hebdomadaire du staff.
function staffWeekly() {
  return sum(Object.values(S.staff).map(l => STAFF_COST[l])) / LAST_WEEK;
}
// Change le niveau d'un membre du staff (prime d'embauche à la hausse).
function setStaff(k, l) {
  l = clamp(l, 1, 5);
  const cur = S.staff[k];
  if (l === cur) return null;
  if (l > cur) {
    const fee = (STAFF_COST[l] - STAFF_COST[cur]) * 0.5;
    if (S.budget < fee) return 'Budget insuffisant.';
    S.budget -= fee;
    finAdd('staff', -fee);
  }
  S.staff[k] = l;
  return null;
}
// Versement hebdomadaire du sponsor (confiance et points UCI).
function sponsorWeekly() {
  const base = S.spons ? S.spons.base : 52;
  return (base + S.conf * R.sponsorConf + (S.teams[0].uci || 0) * R.sponsorUci) * diffOf().spons + (S.clubBonus || 0);
}
