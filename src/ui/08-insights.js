/* Interface — aide à la décision : lectures de l'effectif, du marché et du calendrier, calculées uniquement à
   partir de ce que le directeur sportif voit (valeurs estimées « ~ » pour les coureurs des autres équipes). Aucun
   calcul ici ne touche à la simulation. */

// Profils de l'effectif : nombre de coureurs et meilleur niveau (vu) par archétype.
function rosterProfile() {
  const p = {};
  for (const r of myRiders()) {
    const o = (p[r.arch] = p[r.arch] || { n: 0, best: 0 });
    o.n++;
    o.best = Math.max(o.best, overall(r.s));
  }
  return p;
}
// Badges d'aide au recrutement pour un coureur du marché : besoin de l'effectif, prix, âge.
function marketBadges(r, prof) {
  const B = [];
  const ov = shownOv(r);
  const mine = prof[r.arch];
  if (!mine) B.push(['need', `Aucun ${ARCH[r.arch].lbl.toLowerCase()} dans l'effectif`]);
  else if (ov > mine.best + 2)
    B.push(['need', `Mieux que votre meilleur ${ARCH[r.arch].lbl.toLowerCase()} (${mine.best})`]);
  const dem = contractDemand(r);
  const fair = salaryFor(ov, r.age);
  // (les coureurs libres demandent souvent moins que le salaire habituel : seule une vraie affaire est signalée)
  if (dem <= fair * 0.6) B.push(['good', 'Bon rapport niveau/salaire']);
  else if (dem >= fair * 1.25) B.push(['bad', 'Cher pour son niveau']);
  if (r.age <= 24) B.push(['info', 'Encore en progression']);
  else if (r.age >= 33) B.push(['warn', 'Âge : déclin probable']);
  return B;
}
// Atout de l'équipe pour une course : le coureur le mieux adapté au parcours (même calcul d'adéquation que la
// planification et la sélection des équipes IA, raceFit du planificateur).
function raceAsset(c) {
  const my = myRiders().filter(r => r.injury <= 0);
  if (!my.length) return null;
  const b = my.slice().sort((a, b2) => raceFit(b2, c) - raceFit(a, c))[0];
  return { r: b, v: Math.round(raceFit(b, c)) };
}

// Terrains où un coureur est le plus à l'aise, d'après ses caractéristiques visibles (estimées s'il n'est pas
// dans l'équipe) : les deux ou trois points forts, traduits en types de course.
const TERRAIN_LBL = {
  mon: 'cols et arrivées au sommet',
  col: 'arrivées en côte et classiques vallonnées',
  spr: 'sprints massifs',
  clm: 'contre-la-montre',
  pav: 'classiques pavées',
  pla: 'étapes de plaine et échappées au long cours',
  bar: 'échappées et attaques',
  des: 'descentes techniques',
};
function riderTerrains(r) {
  const k = Object.keys(TERRAIN_LBL).sort((a, b) => shownStat(r, b) - shownStat(r, a));
  const top = shownStat(r, k[0]);
  const L = k.filter((x, i) => i < 3 && shownStat(r, x) >= top - 4).map(x => TERRAIN_LBL[x]);
  if (shownStat(r, 'mon') >= 75 && shownStat(r, 'clm') >= 72 && shownStat(r, 'rec') >= 70)
    L.unshift('classement général des courses par étapes');
  return L;
}
// Projection des flux réguliers (sponsor, équipementiers, salaires, académie, staff) jusqu'à la fin de saison :
// exactement les versements hebdomadaires du jeu, sans les primes, frais de course ni transferts (variables).
function budgetProjection() {
  const wk = Math.max(0, LAST_WEEK - S.week);
  const P0 = S.teams[0];
  const weekly =
    sponsorWeekly() +
    sum(Object.values(S.eqDeal || {}).map(d => d.pay)) / LAST_WEEK -
    sum(P0.riders.map(id => S.riders[id].salary)) / LAST_WEEK -
    sum(S.academy.map(id => S.riders[id].salary)) / LAST_WEEK -
    staffWeekly();
  return { wk, weekly, end: S.budget + weekly * wk };
}

// Icône d'un message selon son sujet (l'émoji du titre s'il y en a un).
function msgIcon(t) {
  const m = t.match(/^\p{Extended_Pictographic}\uFE0F?/u);
  if (m) return m[0];
  return /^Bilan/.test(t)
    ? '🏁'
    : /mécontent|veut partir|surmen/i.test(t)
      ? '😠'
      : /contrat|prolong|signe|recrut|pré-contrat|transfert/i.test(t)
        ? '✍️'
        : /bless|chute|malade/i.test(t)
          ? '🚑'
          : /sponsor|budget|finance|prime/i.test(t)
            ? '💶'
            : /espoir|académie|junior|stagiaire|vivier/i.test(t)
              ? '🎓'
              : /équipementier/i.test(t)
                ? '🚲'
                : '✉️';
}

// Affichage des messages : les messages du même genre la même semaine (« X mécontent », « Y courtisé ») sont
// présentés ensemble. Les messages eux-mêmes ne sont pas modifiés (lecture comprise, gérée par le rendu).
/** @type {[RegExp, string][]} */
const MSG_GROUPS = [
  [/^(.+) mécontent$/, 'Coureurs mécontents'],
  [/^(.+) courtisé$/, 'Espoirs courtisés'],
];
function groupMsgs(L) {
  const out = [];
  for (const m of L) {
    const g = MSG_GROUPS.find(([re]) => re.test(m.title));
    const prev = out[out.length - 1];
    if (g && prev && prev._g === g[1] && prev.w === m.w && prev.season === m.season) {
      prev.body += '<br>' + m.body;
      prev.n = (prev.n || 1) + 1;
      prev.read = prev.read && m.read;
      prev._src.push(m);
      continue;
    }
    out.push(g ? { ...m, _g: g[1], _src: [m] } : m);
  }
  for (const m of out) if (m._src && m._src.length > 1) m.title = m._g;
  return out;
}

// Caractéristique qui compte le plus sur chaque type d'étape.
const TERRAIN_KEY = {
  plat: 'spr',
  vallonne: 'col',
  punch: 'col',
  montagne: 'mon',
  sommet: 'mon',
  paves: 'pav',
  clm: 'clm',
  clmeq: 'clm',
};
// Vivier et académie : badges d'aide au recrutement d'un jeune (d'après ce que voient les recruteurs).
function youthBadges(r) {
  const B = [];
  const p = potEst(r);
  if (p >= 82) B.push(['need', 'Gros potentiel']);
  const k = knowOf(r);
  // (au départ, tout le vivier est mal connu : on ne le signale que pour les jeunes prometteurs, à faire suivre)
  if (k < 40 && p >= 74) B.push(['warn', 'Prometteur mais mal connu : à suivre 👁']);
  else if (k >= 70) B.push(['good', 'Bien observé']);
  if (r.espPts >= 15) B.push(['info', 'En vue chez les espoirs']);
  return B;
}
