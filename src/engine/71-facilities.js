/* Installations du club, le levier du long terme. Cinq chantiers, chacun de trois niveaux :
   - centre de performance : progression de vos coureurs (+4 % par niveau) ;
   - service médical : blessures et maladies plus courtes (-8 % par niveau) ;
   - logistique (bus, camion-atelier, cuisine) : récupération entre les étapes ;
   - soufflerie : contre-la-montre (forme du jour +0,5 par niveau dans l'exercice chronométré) ;
   - cellule d'analyse : estimations des coureurs adverses plus justes (-10 % d'erreur par niveau).
   Un chantier coûte cher, dure plusieurs mois (un seul à la fois) et chaque niveau se paie ensuite en entretien à
   chaque fin de saison. La direction peut en financer une partie (72-board.js). Le centre de formation de
   l'académie reste à part (57-academy-plus.js). Rien ici ne tire au hasard. */

const FAC = {
  perf: {
    lbl: 'Centre de performance',
    ic: '🏋️',
    d: 'Progression de vos coureurs : +4 % par niveau.',
    cost: [0, 220, 420, 700],
    wk: [0, 10, 16, 24],
    upk: [0, 25, 50, 85],
  },
  med: {
    lbl: 'Service médical',
    ic: '🩺',
    d: 'Blessures et maladies plus courtes : -8 % par niveau.',
    cost: [0, 150, 300, 500],
    wk: [0, 8, 12, 18],
    upk: [0, 20, 40, 65],
  },
  bus: {
    lbl: 'Logistique et bus',
    ic: '🚌',
    d: 'Récupération entre les étapes : +1 point de réserve par niveau, chaque soir.',
    cost: [0, 180, 340, 560],
    wk: [0, 6, 10, 14],
    upk: [0, 25, 45, 70],
  },
  wind: {
    lbl: 'Soufflerie',
    ic: '🌬️',
    d: 'Contre-la-montre : forme du jour +0,5 par niveau.',
    cost: [0, 200, 380, 620],
    wk: [0, 12, 18, 26],
    upk: [0, 20, 35, 55],
  },
  data: {
    lbl: "Cellule d'analyse",
    ic: '📊',
    d: 'Estimations des coureurs adverses plus justes : -10 % d’erreur par niveau.',
    cost: [0, 120, 240, 400],
    wk: [0, 6, 10, 14],
    upk: [0, 15, 30, 50],
  },
};
const FAC_LVL = ['Aucun', 'Niveau 1', 'Niveau 2', 'Niveau 3'];
function facInit() {
  S.fac = S.fac || { perf: 0, med: 0, bus: 0, wind: 0, data: 0, b: null };
  return S.fac;
}
function facL(k) {
  return (S.fac && S.fac[k]) || 0;
}
// Effets lus par le reste du jeu (mon équipe seulement).
const facTrainMul = () => 1 + 0.04 * facL('perf');
const facInjMul = () => 1 - 0.08 * facL('med');
const facRecup = () => facL('bus');
const facTT = () => 0.5 * facL('wind');
const facDataMul = () => 1 - 0.1 * facL('data');
// Coût d'un chantier (part de la direction déduite si elle a accepté d'en financer une partie).
function facCost(k) {
  const l = facL(k) + 1;
  const F = FAC[k];
  if (!F || l > 3) return null;
  const help = S.board && S.board.fund && S.board.fund.k === k && S.board.fund.s === S.season ? S.board.fund.p : 0;
  return { l, cost: Math.round(F.cost[l] * (1 - help)), full: F.cost[l], wk: F.wk[l], upk: F.upk[l], help };
}
function facBuild(k) {
  facInit();
  if (S.fac.b) return `Un chantier est déjà en cours (${FAC[S.fac.b.k].lbl}).`;
  const c = facCost(k);
  if (!c) return 'Déjà au plus haut niveau.';
  if (S.budget < c.cost) return `Budget insuffisant (${fmtMoney(c.cost)}).`;
  S.budget -= c.cost;
  finAdd('other', -c.cost);
  S.fac.b = { k, l: c.l, wk: c.wk, n: 0 };
  if (c.help && S.board) S.board.fund = null;
  return `🏗️ Chantier lancé : ${FAC[k].lbl} ${FAC_LVL[c.l].toLowerCase()} (${fmtMoney(c.cost)}${c.help ? `, la direction paie ${Math.round(c.help * 100)} %` : ''}), livraison dans ${c.wk} semaines.`;
}
// Avancement du chantier en cours (0 à 1) ; une semaine de jeu = une semaine de travaux.
function facProgress() {
  const b = S.fac && S.fac.b;
  return b ? clamp(b.n / b.wk, 0, 1) : 0;
}
function facWeekly() {
  if (S.car || !S.fac || !S.fac.b) return;
  const b = S.fac.b;
  if (++b.n < b.wk) return;
  S.fac[b.k] = b.l;
  S.fac.b = null;
  msg('🏗️ Chantier terminé', `${FAC[b.k].lbl} : ${FAC_LVL[b.l].toLowerCase()} en service. ${FAC[b.k].d}`);
  newsAdd('club', `${S.teams[0].name} inaugure son ${FAC[b.k].lbl.toLowerCase()} (${FAC_LVL[b.l].toLowerCase()}).`);
}
// Fin de saison : entretien de toutes les installations.
function facEndSeason() {
  if (S.car) return;
  facInit();
  let u = 0;
  for (const k of Object.keys(FAC)) u += FAC[k].upk[facL(k)];
  if (!u) return;
  S.budget -= u;
  finAdd('other', -u);
  msg('🏗️ Entretien des installations', `Entretien de la saison : ${fmtMoney(u)}.`);
}
// Entretien annuel actuel (pour l'affichage).
function facUpkeep() {
  let u = 0;
  for (const k of Object.keys(FAC)) u += FAC[k].upk[facL(k)];
  return u;
}
