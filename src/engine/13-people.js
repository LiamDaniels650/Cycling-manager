/* Coureurs : brouillard d'estimation, marché, contrats et négociations */
function knowOf(r) {
  if (r.team === 0) return 100;
  return S.know[r.id] || (r.youth ? 0 : 20);
}
// Erreur d'estimation des caractéristiques d'un coureur adverse (brouillard d'information).
function estErr(r) {
  if (r.team === 0) return 0;
  return (1 - knowOf(r) / 100) * 9 * (1.25 - 0.1 * S.staff.scout);
}
// Valeur affichée d'une caractéristique (exacte pour vos coureurs, estimée sinon).
function shownStat(r, k) {
  if (r.team === 0) return r.s[k];
  return clamp(Math.round(r.s[k] + (r.nz ? r.nz[STATS.indexOf(k)] : 0) * estErr(r)), 30, 99);
}
// Toutes les caractéristiques telles qu'affichées.
function shownStats(r) {
  const o = {};
  for (const k of STATS) o[k] = shownStat(r, k);
  return o;
}
// Note globale telle qu'affichée.
function shownOv(r) {
  return overall(shownStats(r));
}
// Connaissance du potentiel d'un coureur.
function potKnow(r) {
  if (r.team === 0) return Math.max(S.know[r.id] || 0, r.aca ? 35 : 60);
  return knowOf(r);
}
// Potentiel estimé (plafond de progression).
function potEst(r) {
  const err = (1 - potKnow(r) / 100) * 11 * (1.25 - 0.1 * S.staff.scout);
  return Math.round(r.ceil + (r.nzc || 0) * err);
}
// Potentiel en étoiles.
function stars(v) {
  const s = clamp((v - 58) / 6, 0.5, 5);
  const f = Math.floor(s),
    h = s - f >= 0.5;
  return '★'.repeat(f) + (h ? '½' : '') + '<span class="mut">' + '☆'.repeat(5 - f - (h ? 1 : 0)) + '</span>';
}
// Les valeurs affichées sont-elles des estimations ?
function isEst(r) {
  return r.team !== 0 && estErr(r) > 0.8;
}
// Salaire demandé par un coureur (niveau, âge, ambition, popularité).
function contractDemand(r) {
  return (
    Math.round(
      (salaryFor(overall(r.s), r.age) *
        (1 + (r.amb - 50) / 250) *
        (1 + ((r.pop == null ? 30 : r.pop) - 35) / 500) *
        (r.loyal && r.loyal >= S.season ? 0.93 : 1) *
        (r.team !== 0 ? 1 - 0.06 * imageAffinity(r) : 1)) /
        5
    ) * 5
  );
}
// Rang de l'équipe du joueur (dernier classement connu).
function teamRank() {
  const ranks = S.lastRanks || null;
  const sorted = S.teams
    .slice()
    .sort((a, b) => ((ranks ? ranks[b.id] : 0) || b.uci || 0) - ((ranks ? ranks[a.id] : 0) || a.uci || 0));
  return sorted.indexOf(S.teams[0]);
}
// Indemnité de transfert d'un coureur sous contrat.
function transferFee(r) {
  return Math.round(r.salary * Math.max(1, r.contract) * 1.2 + Math.max(0, overall(r.s) - 70) * 40);
}
// Statut sur le marché : libre, transfert, pré-contrat, déjà chez vous.
function marketKind(r) {
  if (r.team === null) return 'free';
  if (r.team === 0) return 'mine';
  return r.contract <= 1 ? 'pre' : 'transfer';
}
// Chance qu'un coureur accepte une offre, et ce qui la compose (sert à la négociation et à l'aide à la décision ;
// l'interface l'appelle avec le salaire demandé ESTIMÉ, le seul que voit le directeur sportif).
function negoChance(r, salary, years, promise, dem) {
  const kind = marketKind(r);
  const pf = 1.08 - teamRank() * 0.02;
  const parts = [];
  let p = clamp(((salary / dem) * pf - 0.85) * 3.3, 0, 0.97);
  parts.push(['Salaire proposé et rang de l’équipe', p]);
  const add = (lbl, v) => {
    if (v) parts.push([lbl, v]);
    p += v;
  };
  if (promise && r.amb > 55) add('Promesse d’un rôle de leader', 0.15);
  add('Notoriété de l’équipe', (repOf() - 50) / 250); // la notoriété de l'équipe attire
  add('Image de l’équipe', 0.12 * imageAffinity(r)); // un coureur se reconnaît dans l'image de l'équipe
  add('Statut ProTeam', wtSignFactor(r)); // une ProTeam attire moins les coureurs cotés
  if (years >= 3 && r.age >= 30) add('Sécurité d’un contrat long', 0.08);
  if (years === 1 && r.age < 26) add('Contrat d’un an pour un jeune', -0.08);
  if (kind !== 'free') add('Bien dans son équipe actuelle', -clamp((r.moral - 50) / 200, -0.1, 0.15));
  return { p: clamp(p, 0, 0.97), parts };
}
// Négociation d'un contrat avec un coureur (probabilité d'accord selon l'offre).
function negotiate(id, salary, years, promise) {
  const r = S.riders[id];
  const P = S.teams[0];
  const kind = marketKind(r);
  if (kind === 'mine') return { ok: false, txt: 'Déjà dans votre équipe.' };
  if (r.negoBlock && r.negoBlock > S.week + S.season * 100)
    return { ok: false, txt: `${riderName(r)} ne veut plus discuter avec vous pour le moment.` };
  if (kind !== 'pre' && P.riders.length >= ROSTER.max)
    return { ok: false, txt: `Effectif complet (${ROSTER.max} max).` };
  if (r.nextTeam !== undefined && r.nextTeam !== null)
    return { ok: false, txt: `${riderName(r)} s'est déjà engagé ailleurs pour la saison prochaine.` };
  const T = teamOf(r);
  let fee = 0;
  if (kind === 'transfer') {
    const rs = T.riders.map(i => S.riders[i]).sort((a, b) => overall(b.s) - overall(a.s));
    if (rs.indexOf(r) < 2) return { ok: false, txt: `${T.name} refuse de céder l'un de ses deux meilleurs coureurs.` };
    if (T.riders.length <= ROSTER.minAI)
      return { ok: false, txt: `${T.name} n'a pas assez de coureurs pour en céder un.` };
    fee = transferFee(r);
  }
  const signBonus = Math.round(salary * 0.1);
  if (S.budget < fee + signBonus)
    return { ok: false, txt: `Budget insuffisant (indemnité ${fmtMoney(fee)} + prime ${fmtMoney(signBonus)}).` };
  const dem = contractDemand(r);
  const pf = 1.08 - teamRank() * 0.02;
  const p = negoChance(r, salary, years, promise, dem).p;
  if (rnd() >= p) {
    r.negoBlock = S.week + S.season * 100 + (p < 0.2 ? 6 : 3);
    const ask = Math.round((dem * (1.05 + rnd() * 0.15)) / pf / 5) * 5;
    return {
      ok: false,
      txt: `${riderName(r)} refuse. ${p < 0.25 ? 'Votre offre est jugée insultante.' : 'Il demanderait plutôt environ ' + fmtMoney(ask) + '/an.'} Il ne veut plus négocier pendant quelques semaines.`,
    };
  }
  S.budget -= fee + signBonus;
  finAdd('transf', -(fee + signBonus));
  mercLog(r, kind === 'pre' ? 'pre' : kind === 'transfer' ? 'transfert' : 'signe', r.team, 0);
  if (promise) r.promise = true;
  if (kind === 'pre') {
    r.nextTeam = 0;
    r.nextSal = salary;
    r.nextYears = years;
    msg(
      'Pré-contrat',
      `${riderName(r)} rejoindra votre équipe la saison prochaine (${years} an(s), ${fmtMoney(salary)}/an).`
    );
    return { ok: true, txt: `Pré-contrat signé ! ${riderName(r)} arrivera en fin de saison.` };
  }
  if (kind === 'transfer') {
    T.riders.splice(T.riders.indexOf(id), 1);
  }
  if (kind === 'free') {
    const fi = S.free.indexOf(id);
    if (fi >= 0) S.free.splice(fi, 1);
  }
  r.team = 0;
  r.contract = years;
  r.salary = salary;
  r.wantsOut = false;
  P.riders.push(id);
  r.training = 'normal';
  seedRelationsFor(id);
  press(
    `${riderName(r)} signe chez ${P.name}`,
    `${riderName(r)} rejoint ${P.name} pour ${years} saison(s).`,
    overall(r.s) >= 76 ? 1.5 : overall(r.s) >= 72 ? 0.5 : 0,
    [id]
  );
  msg(
    'Recrutement',
    `${riderName(r)} rejoint l'équipe pour ${years} an(s), ${fmtMoney(salary)}/an${fee ? ', indemnité de transfert ' + fmtMoney(fee) : ''}.`
  );
  return { ok: true, txt: `${riderName(r)} a signé !` };
}
// Libère un coureur sous contrat (indemnité de départ).
function releaseRider(id) {
  const r = S.riders[id];
  friendLeaves(id);
  const P = S.teams[0];
  if (P.riders.length <= ROSTER.minPlayer) return `Il faut garder au moins ${ROSTER.minPlayer} coureurs.`;
  const cost = Math.round(r.salary * 0.5 * r.contract);
  S.budget -= cost;
  finAdd('transf', -cost);
  P.riders.splice(P.riders.indexOf(id), 1);
  mercLog(r, 'libere', 0, null);
  r.team = null;
  r.contract = 0;
  S.free.push(id);
  msg('Licenciement', `${riderName(r)} est libéré. Indemnités : ${fmtMoney(cost)}.`);
  return null;
}
// Prolonge le contrat d'un coureur.
function extendRider(id, years) {
  const r = S.riders[id];
  const d = contractDemand(r);
  if (r.nextTeam) return `${riderName(r)} a déjà signé ailleurs.`;
  if (r.wantsOut) return `${riderName(r)} veut partir et refuse de prolonger.`;
  if (r.moral < 35 && rnd() < 0.6) return `${riderName(r)} refuse de prolonger (moral trop bas).`;
  r.contract += years;
  r.salary = Math.max(r.salary, d);
  return null;
}
// Discussion individuelle avec un coureur (encourager, recadrer, promettre).
function talkRider(id, kind) {
  const r = S.riders[id];
  if (kind === 'recadrer') {
    r.dis = clamp(r.dis + rint(2, 6), 0, 99);
    r.moral = clamp(r.moral - rint(5, 12), 0, 100);
    if (r.trait === 'fragile') r.moral = clamp(r.moral - 6, 0, 100);
    return `${riderName(r)} encaisse la remontrance. Discipline en hausse, moral en baisse.`;
  }
  if (kind === 'feliciter') {
    const last = r.lastPraise || 0;
    const wk = S.season * 100 + S.week;
    const gain = wk - last < 3 ? rint(0, 2) : rint(4, 9);
    r.lastPraise = wk;
    r.moral = clamp(r.moral + gain, 0, 100);
    return gain < 3
      ? `${riderName(r)} commence à trouver vos compliments un peu répétitifs.`
      : `${riderName(r)} apprécie vos encouragements.`;
  }
  if (kind === 'promettre') {
    r.moral = clamp(r.moral + rint(8, 14), 0, 100);
    r.promise = true;
    return `Vous promettez à ${riderName(r)} un rôle de leader prochainement. Ne l'oubliez pas…`;
  }
}
// Ajoute ou retire un coureur de la liste de suivi.
function toggleWatch(id) {
  const i = S.watch.indexOf(id);
  if (i >= 0) S.watch.splice(i, 1);
  else {
    if (S.watch.length >= 12) return 'Liste de suivi pleine (12).';
    S.watch.push(id);
  }
  return null;
}
