/* Monde : génération des coureurs, des équipes et nouvelle partie */
let _rid = 1;
// Note globale d'un coureur (moyenne pondérée de ses caractéristiques).
function overall(s) {
  const top = ['pla', 'mon', 'col', 'spr', 'clm', 'pav'].map(k => s[k]).sort((a, b) => b - a);
  return Math.round(((top[0] * 0.45 + top[1] * 0.25 + top[2] * 0.1) / 0.8) * 0.8 + s.end * 0.1 + s.rec * 0.1);
}
// Salaire de marché (k€/an) selon le niveau et l'âge.
// Niveau de référence du peloton (moyenne des 200 meilleurs coureurs à la fin d'une première saison). Les salaires
// suivent la place d'un coureur dans le peloton plus qu'une note absolue : quand le niveau général monte au fil des
// saisons (les jeunes formés valent mieux que ceux d'un monde neuf), une même note se paie un peu moins cher, et la
// masse salariale reste stable sur une longue carrière (coefficient réglé sur des parties de 25 saisons).
const LVL_REF = R.lvlRef;
function worldLevel() {
  const ov = [];
  for (const id in S.riders) {
    const r = S.riders[id];
    if (!r.retired && r.team !== null && !r.aca) ov.push(overall(r.s));
  }
  ov.sort((a, b) => b - a);
  const top = ov.slice(0, 200);
  return top.length ? top.reduce((a, b) => a + b, 0) / top.length : LVL_REF;
}
function salaryFor(ov, age) {
  ov -= typeof S !== 'undefined' && S && S.lvl ? R.lvlK * Math.max(0, S.lvl - LVL_REF) : 0;
  const base = R.salary.base + R.salary.k * Math.pow(Math.max(0, ov - 60), R.salary.exp);
  return Math.round((base * (age < 24 ? R.salary.youngMul : 1)) / 5) * 5;
}
// Génère un coureur d'un archétype donné ; q décale son niveau.
function genRider(arch, q, opts = {}) {
  const A = ARCH[arch],
    nat = pickNat(opts.nat),
    N = NATS[nat];
  const age = opts.age || clamp(Math.round(27 + gauss() * 4), 19, 37);
  let ageMod = age <= 21 ? -4 : age <= 23 ? -2 : age <= 25 ? -0.5 : age <= 31 ? 0 : age <= 33 ? -1 : -2.5;
  const s = {};
  for (const k of STATS) {
    let v = A[k] + q + ageMod + gauss() * 3.2;
    if (PRIMARY[arch].includes(k)) v += gauss() * 2.5;
    s[k] = Math.round(clamp(v, 35, 92));
  }
  const [fn, ln] = uniqueName(N);
  const r = {
    id: _rid++,
    fn,
    ln,
    nat,
    age,
    arch,
    s,
    pot: age <= 24 ? Math.round(rint(3, 11) + (q > 0 ? 2 : 0)) : age <= 27 ? rint(0, 4) : 0,
    dis: Math.round(clamp(58 + gauss() * 17, 12, 98)),
    amb: Math.round(
      clamp(50 + gauss() * 18 + (q > 2 ? 10 : 0) + (arch === 'complet' || arch === 'sprinteur' ? 8 : 0), 5, 99)
    ),
    trait: pickTrait(),
    forme: Math.round(clamp(68 + gauss() * 6, 50, 85)),
    fatigue: 0,
    moral: Math.round(clamp(62 + gauss() * 10, 30, 90)),
    team: null,
    contract: rint(1, 3),
    training: 'normal',
    injury: 0,
    stats: { days: 0, wins: 0, podiums: 0, pts: 0, disob: 0 },
    hist: [],
  };
  if (r.trait === 'leaderne' && overall(s) < 70) r.trait = 'opportuniste';
  if (age <= 23 && rnd() < 0.07) r.late = true; // révélation tardive
  if (r.trait === 'modele') r.dis = Math.max(r.dis, 75);
  if (r.trait === 'tete') r.amb = Math.max(r.amb, 60);
  r.salary = salaryFor(overall(s), age);
  initRiderExtras(r);
  return r;
}
const TEAM_NAMES = [
  ['Crédit Rural', 'CRU', '#2e7d32'],
  ['Avenir Énergie', 'AVE', '#f9a825'],
  ['Montagnard Assurances', 'MON', '#1565c0'],
  ["Pédale d'Or", 'PDO', '#c62828'],
  ['Baltic Steel', 'BAL', '#455a64'],
  ['Iberia Sol', 'IBS', '#ef6c00'],
  ['Lagune Vini', 'LAG', '#6a1b9a'],
  ['Nordwind Cycling', 'NWD', '#00838f'],
  ['Alpenbank', 'ALP', '#283593'],
  ['Tempo Télécom', 'TMP', '#ad1457'],
  ['Flandria Bouw', 'FLB', '#5d4037'],
  ['Helvetia Sport', 'HEL', '#b71c1c'],
  ['Andes Café', 'AND', '#4e342e'],
  ['Viking Energi', 'VIK', '#0277bd'],
  ['Bretagne Littoral', 'BRL', '#1b5e20'],
  ['Pacific Wave', 'PAC', '#00695c'],
  ['Toscana Ferro', 'TOS', '#9e9d24'],
];
// Niveaux des 17 équipes IA (du WorldTour de pointe aux équipes invitées) ; votre équipe démarre à -0,8.
const TIERS = [4.5, 3.8, 3.2, 2.6, 2.0, 1.4, 0.9, 0.4, 0, -0.4, -0.9, -1.4, -1.9, -2.4, -3, -3.5, -4.2];
// Effectifs : comme dans le peloton réel, une équipe aligne 25 à 30 coureurs pour courir plusieurs programmes ;
// chacun dispute ainsi 50 à 80 jours de course par saison. min : seuil sous lequel l'équipe doit recruter.
const ROSTER = { max: 30, minAI: 20, minPlayer: 16, player: 22 };
// Taille visée d'un effectif IA selon le standing de l'équipe.
function aiTarget(T) {
  return T.tier >= 2 ? 28 : T.tier >= 0 ? 26 : 24;
}
// Seconde moitié d'effectif : équipiers et jeunes, un cran en dessous du noyau.
const COMPO_EXTRA = [
  'rouleur',
  'grimpeur',
  'sprinteur',
  'puncheur',
  'baroudeur',
  'rouleur',
  'grimpeur',
  'flahute',
  'rouleur',
  'baroudeur',
  'grimpeur',
  'complet',
  'rouleur',
  'puncheur',
  'sprinteur',
  'grimpeur',
];
const COMPO = [
  'complet',
  'complet',
  'grimpeur',
  'grimpeur',
  'sprinteur',
  'puncheur',
  'rouleur',
  'rouleur',
  'baroudeur',
  'flahute',
  'rouleur',
  'grimpeur',
];
// Nouvelle partie : équipes, coureurs, calendrier, vivier de jeunes.
function newGame(teamName, seed, diff) {
  _sd = (seed || Date.now()) | 0;
  const seed0 = _sd;
  _rid = 1;
  S = {
    v: 12,
    seed0,
    rep: 40,
    press: [],
    pwRec: [],
    season: 2027,
    week: 1,
    teams: [],
    riders: {},
    inbox: [],
    cal: [],
    free: [],
    hist: [],
    rc: null,
    nextMsg: 1,
    budget: 1500,
    staff: { coach: 1, doctor: 1, scout: 1 },
    academy: [],
    youth: [],
    know: {},
    watch: [],
    raceHist: {},
    teamHist: [],
    conf: 50,
    fin: {},
    lastRank: 9,
  };
  const natBias = [
    'FRA',
    'FRA',
    'ESP',
    'ITA',
    'NED',
    'ESP',
    'ITA',
    'DEN',
    'SUI',
    'FRA',
    'BEL',
    'SUI',
    'COL',
    'NOR',
    'FRA',
    'AUS',
    'ITA',
  ];
  const pT = {
    id: 0,
    name: teamName || 'Mon Équipe',
    short: 'MOI',
    color: '#e91e63',
    tier: -0.8,
    riders: [],
    player: true,
  };
  S.teams.push(pT);
  const stl = [
    'gc',
    'agressif',
    'gc',
    'sprint',
    'defensif',
    'opportuniste',
    'agressif',
    'sprint',
    'defensif',
    'opportuniste',
    'agressif',
    'gc',
    'gc',
    'agressif',
    'opportuniste',
    'sprint',
    'defensif',
  ];
  TEAM_NAMES.forEach((t, i) =>
    S.teams.push({
      id: i + 1,
      name: t[0],
      short: t[1],
      color: t[2],
      tier: TIERS[i],
      riders: [],
      natBias: natBias[i],
      style: stl[i],
    })
  );
  for (const T of S.teams) {
    const core = T.player
      ? [
          'complet',
          'grimpeur',
          'grimpeur',
          'sprinteur',
          'puncheur',
          'rouleur',
          'rouleur',
          'baroudeur',
          'flahute',
          'rouleur',
          'baroudeur',
          'grimpeur',
        ]
      : COMPO;
    const comp = core.concat(COMPO_EXTRA.slice(0, (T.player ? ROSTER.player : aiTarget(T)) - core.length));
    // vedettes de l'équipe : 2 ou 3 profils différents (pas toujours un leader de classement général)
    /** @type {[string, number][]} */
    const SW = [
      ['complet', 24],
      ['grimpeur', 16],
      ['sprinteur', 20],
      ['puncheur', 15],
      ['flahute', 12],
      ['rouleur', 8],
      ['baroudeur', 5],
    ];
    const stars = [];
    while (stars.length < 3) {
      let r = rnd() * 100,
        a = 'complet';
      for (const [k, wt] of SW) {
        if ((r -= wt) < 0) {
          a = k;
          break;
        }
      }
      if (!stars.includes(a)) stars.push(a);
    }
    const bonus = [2.6, 1.8, 1.0];
    const used = {};
    comp.forEach((a, i) => {
      const si = stars.indexOf(a);
      const star = si >= 0 && !used[a];
      if (star) used[a] = 1;
      const q = T.tier + (star ? bonus[si] : 0) + gauss() * 1.6 - (i > 8 ? 1.5 : 0) - (i >= 12 ? 1.5 : 0);
      // la seconde moitié de l'effectif est plus jeune (néo-pros, équipiers en devenir)
      // les vedettes sont le plus souvent des coureurs confirmés (un jeune prodige de temps en temps)
      const age = star
        ? rnd() < 0.12
          ? rint(21, 23)
          : clamp(Math.round(28 + gauss() * 3), 23, 34)
        : i >= 16
          ? rint(20, 25)
          : undefined;
      const r = genRider(a, q, { nat: T.player ? 'FRA' : T.natBias, ...(age ? { age } : {}) });
      r.team = T.id;
      matureRider(r);
      S.riders[r.id] = r;
      T.riders.push(r.id);
    });
  }
  // niveau du peloton et salaires du monde de départ : les contrats en cours ont été signés une ou deux saisons plus
  // tôt, quand le coureur valait un peu moins (la moitié de sa maturation), comme dans un peloton en régime de croisière
  S.lvl = worldLevel();
  for (const T of S.teams)
    for (const id of T.riders) {
      const r = S.riders[id];
      r.salary = salaryFor(overall(r.s) - R.initAge.find(e => r.age <= e[0])[1] / 2, r.age);
    }
  initAiBudgets();
  genFreeAgents(30);
  genYouth(40);
  initEquipment();
  for (const id of pT.riders) seedRelationsFor(id);
  buildCalendar();
  aiSeasonPlans();
  S.plan = {};
  assignGoals();
  initEconomy(diff);
  S.budget = diffOf().budget;
  // prime de lancement : l'effectif hérité coûte plus ou moins cher selon le tirage ; le sponsor finance la part de
  // la masse salariale qui dépasse la référence, pour que la première saison ne se joue pas sur la loterie du départ
  const pay0 = sum(pT.riders.map(id => S.riders[id].salary));
  const launch = Math.round(Math.max(0, pay0 - R.startPayRef) * diffOf().spons);
  S.budget += launch;
  S.launch = launch;
  genObjectives();
  initCareer();
  initImage();
  msg(
    'Bienvenue',
    `Vous prenez la direction sportive de <b>${pT.name}</b>. Budget : ${fmtMoney(S.budget)}${
      S.launch
        ? `, dont une prime de lancement de ${fmtMoney(S.launch)} versée par le sponsor pour reprendre un effectif coûteux (${fmtMoney(sum(pT.riders.map(id => S.riders[id].salary)))} de salaires par an)`
        : ''
    }. Consultez votre effectif, réglez les plans d'entraînement, jetez un œil au vivier de jeunes (onglet Académie) puis préparez la première course au calendrier.<br><br>Objectifs du sponsor :<br>${S.obj.map(o => '• ' + o.txt).join('<br>')}`
  );
  return S;
}
// Monde de départ : un coureur d'équipe reçoit le niveau qu'aurait un coureur du même âge formé par le jeu.
function matureRider(r) {
  const d = R.initAge.find(e => r.age <= e[0])[1];
  for (const k of STATS) r.s[k] = Math.round(clamp(r.s[k] + d, 35, 95));
  r.ceil = Math.max(overall(r.s), Math.round(r.ceil + d));
}
// Complète le marché des coureurs libres.
function genFreeAgents(n) {
  S.free = S.free.filter(id => S.riders[id] && !S.riders[id].retired);
  for (let i = 0; i < n; i++) {
    const a = pick(Object.keys(ARCH));
    const r = genRider(a, -2.5 + gauss() * 2.5);
    r.team = null;
    r.contract = 0;
    r.salary = Math.round(r.salary * 1.1);
    S.riders[r.id] = r;
    S.free.push(r.id);
  }
}
// Prénom et nom, en évitant qu'un autre coureur en activité porte déjà le même nom court (« J. Martin »).
function uniqueName(N) {
  const taken = new Set();
  if (typeof S !== 'undefined' && S && S.riders)
    for (const id in S.riders) {
      const r = S.riders[id];
      if (!r.retired) taken.add(r.fn.charAt(0) + '. ' + r.ln);
    }
  let fn = pick(N.fn),
    ln = pick(N.ln);
  for (let k = 0; k < 12 && taken.has(fn.charAt(0) + '. ' + ln); k++) {
    fn = pick(N.fn);
    ln = pick(N.ln);
  }
  return [fn, ln];
}
// Nom court d'un coureur (initiale du prénom + nom).
function riderName(r) {
  return r.fn.charAt(0) + '. ' + r.ln;
}
// Équipe d'un coureur.
function teamOf(r) {
  return teamById(r.team);
}
// Équipe par identifiant (undefined si elle n'existe pas).
function teamById(id) {
  return S.teams.find(t => t.id === id);
}
// Élagage de la sauvegarde : on oublie les coureurs retraités sans palmarès notable (et leurs traces),
// ainsi que les libres qui ne trouvent plus d'équipe. hard = élagage d'urgence quand le stockage est plein.
function pruneWorld(hard) {
  const keep = new Set((S.pwRec || []).map(q => q.id));
  for (const T of S.teams) for (const id of T.riders) keep.add(id);
  for (const id of S.academy.concat(S.youth, S.watch)) keep.add(id);
  let n = 0;
  for (const id in S.riders) {
    const r = S.riders[id];
    if (keep.has(+id)) continue;
    // libre depuis longtemps et trop faible : il raccroche
    if (!r.retired && r.team === null && !r.youth && S.free.includes(+id) && r.age >= 30 && overall(r.s) < 68) {
      r.retired = true;
      r.retS = S.season;
      S.free.splice(S.free.indexOf(+id), 1);
    }
    const notable = (r.palm || []).some(p => p.k === 1);
    if (r.retired && !notable && (hard || (r.retS || 0) <= S.season - 1)) {
      delete S.riders[id];
      delete S.know[id];
      n++;
    }
    // retraité notable gardé pour les palmarès : il n'a plus besoin de son état de course ni de sa progression
    else if (r.retired && !r.slim) {
      for (const k of ['sx', 'load', 'wkDays', 'training', 'fh', 'peakW', 'postPeak', 'altBoost', 'goal'])
        delete r[k];
      if (r.pb) {
        const best = Object.entries(r.pb).sort((a, b) => (b[1] ? b[1].wkg : 0) - (a[1] ? a[1].wkg : 0))[0];
        r.pb = best ? { [best[0]]: best[1] } : {};
      }
      r.slim = 1;
    }
  }
  if (n && S.rel)
    for (const k in S.rel) {
      const [a, b] = k.split('-');
      if (!S.riders[a] || !S.riders[b]) delete S.rel[k];
    }
  // archives : au-delà de cinq saisons, l'historique d'une course ne garde que le podium et les maillots
  for (const k in S.raceHist || {}) for (const e of S.raceHist[k]) if (e.s < S.season - 5 && e.stages) delete e.stages;
  if (hard) {
    if (S.press) S.press.length = Math.min(S.press.length, 30);
    if (S.inbox) S.inbox.length = Math.min(S.inbox.length, 40);
  }
  return n;
}
