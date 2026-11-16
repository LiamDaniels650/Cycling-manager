// Mode carrière : chaque choix du joueur a-t-il un effet ? Pour chaque choix, deux carrières identiques (même
// graine) qui ne diffèrent que par ce choix, sur plusieurs graines ; on compare une mesure liée au choix.
// Monde allégé : seules les courses du joueur sont simulées (les autres courses pros sont sautées).
// Usage : node tests/career_impact.js [graines=3] [filtre]
const fs = require('fs');
require('vm').runInThisContext(fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", ''));
const NSEED = +(process.argv[2] || 3);
const FILTER = process.argv[3] || '';

// Une carrière : o = création, set(C) = réglages, pro = départ à 21 ans déjà pro, ans = saisons jouées,
// ans = saisons, dec(a) = réponse aux décisions, wk(me) = actions chaque semaine.
function career(seed, o) {
  carNewGame({
    fn: 'T',
    ln: 'T',
    nat: 'FRA',
    arch: 'complet',
    gab: 'moyen',
    dreams: ['pro'],
    studies: 'sport',
    seed,
    ...(o.create || {}),
  });
  const me = carMe();
  const C = S.car;
  if (o.pro) {
    me.age = 21;
    for (const k of STATS) me.s[k] += 13;
    me.ceil = Math.max(me.ceil, overall(me.s) + 4);
    me.cm = me.cmF;
    me.kg = me.kgF;
    const T = S.teams.filter(T => !T.player)[3];
    carAsk('contrat:x', 'x', [['o0', 'x']], 'o0', { offers: [{ tid: T.id, name: T.name, years: 3, salary: 80 }] });
    carAnswer('contrat:x', 'o0');
  }
  if (o.set) o.set(C, me);
  const m = {
    leadRole: 0,
    ill: 0,
    inj: 0,
    injW: 0,
    relapse: 0,
    freeRole: 0,
    proRaces: 0,
    ranks: [],
    forme: 0,
    moral: 0,
    n: 0,
    dream: 0,
  };
  const ans = a => (o.dec && o.dec(a)) || a.def;
  for (let s = 0; s < (o.ans || 1); s++) {
    while (S.week < LAST_WEEK || !S.cal.every(c => c.done)) {
      if (o.wk) o.wk(C, me);
      const seen = new Set(C.feed);
      for (let i = 0; i < S.cal.length; i++) {
        const c = S.cal[i];
        if (c.done || c.w > S.week) continue;
        if (carProThisWeek() === i) {
          const rc = carProStart(i);
          rc.carId = null;
          while (!rc.done) {
            carProStageOrders(rc);
            if (rc.orders[me.id] && rc.orders[me.id].o === 'free') m.freeRole++;
            if (rc.orders[me.id] && ['leader', 'sprint'].includes(rc.orders[me.id].o)) m.leadRole++;
            runStageAuto(rc);
          }
          if (o.radio) rc.carRadio = [['attack', 'free']];
          const rec = carProAfter(rc);
          m.proRaces++;
          if (rec.rank) m.ranks.push(rec.rank / rec.n);
        } else c.done = true; // monde allégé
      }
      const d = carRaceThisWeek();
      if (d && !C.raced[carRaceKey(d)] && me.injury <= 0 && !C.skip[carRaceKey(d)]) {
        const rec = carSimRace(d);
        if (rec && rec.rank) m.ranks.push(rec.rank / rec.n);
        if (!rec) carNotSelected(d);
      }
      weeklyUpdate();
      carWeekly();
      for (const f of C.feed.filter(f => !seen.has(f))) {
        if (/Malade/.test(f.title)) m.ill++;
        if (/Blessure/.test(f.title)) m.inj++;
        if (/Rechute/.test(f.title)) m.relapse++;
        if (/rêves/.test(f.title)) m.dream++;
      }
      if (me.injury > 0) m.injW++;
      for (const a of C.asks.slice()) carAnswer(a.key, ans(a));
      m.forme += me.forme;
      if (m.n < 6) m.f6 = (m.f6 || 0) + me.forme / 6;
      m.moral += me.moral;
      m.n++;
    }
    carEndSeason();
    endSeason();
    carNewSeason();
    for (const a of C.asks.slice()) carAnswer(a.key, ans(a));
  }
  m.forme /= m.n;
  m.moral /= m.n;
  m.rank = m.ranks.length ? m.ranks.reduce((a, b) => a + b, 0) / m.ranks.length : 1;
  return Object.assign(m, { me: carMe(), C: S.car });
}
// Pour le test de la naissance : elle tombe pendant la prochaine course pro où le coureur est sélectionné.
function birthDuringRace() {
  const L = carLife();
  if (L.due || L.kids.length || S.week < 5) return;
  const T = carTeamOfMe();
  const c = S.cal.find(c => !c.done && c.w >= S.week + 2 && carProSelected(T, c));
  if (c) L.due = { s: S.season, w: c.w };
}
// Demande sa chance avant chaque course pro de la semaine.
function ask(C) {
  if (!C.wish && carProThisWeek() >= 0 && carMe().forme >= 70 && C.trust >= 45) carAskChance(true);
}
// Une belle course (2e) à la semaine 10 : de quoi provoquer le micro tendu de l'après-course.
function podium() {
  if (S.week === 10) carRepAfterRace({}, 'Course test', 'pro', 'test', 2, 100, 3);
}
// Meilleur salaire proposé si le joueur négociait maintenant (offres de fin de saison).
function bestOffer(x) {
  x.C.asks = [];
  carProOffers();
  const a = x.C.asks.find(a => a.data && a.data.offers);
  return a ? Math.max(...a.data.offers.map(o => o.salary)) + a.data.offers.length : 0;
}
const avg = (seeds, f) => seeds.reduce((a, x) => a + f(x), 0) / seeds.length;
// [nom, A, B, mesure, sens attendu de B par rapport à A (+1 plus grand, -1 plus petit, 0 différent)]
const CASES = [
  [
    'Profil à la création',
    { create: { arch: 'grimpeur' } },
    { create: { arch: 'sprinteur' } },
    x => x.me.s.spr - x.me.s.mon,
    1,
  ],
  ['Gabarit (taille adulte)', { create: { gab: 'petit' } }, { create: { gab: 'grand' } }, x => x.me.cmF, 1],
  ['Nation (pelotons et sélections)', { create: { nat: 'FRA' } }, { create: { nat: 'BEL' } }, x => x.rank, 0],
  [
    'Caractère : mental fragile',
    { pro: true, create: { trait: 'aucun' } },
    { pro: true, create: { trait: 'fragile' } },
    x => Math.abs(x.moral - 62),
    0,
  ],
  [
    'Caractère : équipier modèle',
    { pro: true, create: { trait: 'aucun' } },
    { pro: true, create: { trait: 'modele' } },
    x => x.C.trust,
    1,
  ],
  ['Caractère : régulier', { create: { trait: 'aucun' } }, { create: { trait: 'regulier' } }, x => x.forme, 0],
  ['Rêves : champion national', { create: { dreams: ['pro'] } }, { create: { dreams: ['nat'] } }, x => x.dream, 1],
  [
    'Études : lycée → arrêt',
    { create: { studies: 'lycee' } },
    { create: { studies: 'arret' } },
    x => sum(STATS.map(k => x.me.s[k])),
    1,
  ],
  [
    'Entraînement : montagne',
    { set: C => (C.plan = 'sprint') },
    { set: C => (C.plan = 'montagne') },
    x => x.me.s.mon,
    1,
  ],
  [
    'Volume : gros',
    { set: C => (C.vol = 'leger') },
    { set: C => (C.vol = 'gros') },
    x => overall(x.me.s) * 10 + x.injW,
    1,
  ],
  [
    'Impasse sur des courses',
    {},
    {
      wk: C => {
        const d = carRaceThisWeek();
        if (d && d.tier === 'club') C.skip[carRaceKey(d)] = true;
      },
    },
    x => x.C.res.length,
    -1,
  ],
  ['Hygiène stricte', { set: C => (C.hyg = 'relachee') }, { set: C => (C.hyg = 'stricte') }, x => x.forme, 1],
  ['Hygiène : moral', { set: C => (C.hyg = 'stricte') }, { set: C => (C.hyg = 'relachee') }, x => x.moral, 1],
  [
    'Poids : perdre',
    { pro: true, set: C => (C.wgoal = 'maintien') },
    { pro: true, set: C => (C.wgoal = 'perdre') },
    x => x.me.s.mon - x.me.kg,
    1,
  ],
  [
    'Changer de profil',
    { pro: true, ans: 2 },
    { pro: true, ans: 2, set: () => carSpecStart('grimpeur') },
    x => (x.me.arch === 'grimpeur' ? 1 : 0) + (x.C.spec ? x.C.spec.prog / 100 : 0),
    1,
  ],
  [
    'Équipe espoirs : réserve pro (progression)',
    { set: (C, me) => (me.age = 19), dec: a => (a.key.startsWith('team') ? 'conti' : null) },
    { set: (C, me) => ((me.age = 19), (C.kind = 'devo')) },
    x => overall(x.me.s) + x.C.vis / 10,
    1,
  ],
  [
    'Rééducation accélérée',
    { pro: true, set: (C, me) => (me.injury = 6), dec: a => (a.key.startsWith('rehab') ? 'prudente' : null) },
    { pro: true, set: (C, me) => (me.injury = 6), dec: a => (a.key.startsWith('rehab') ? 'acceleree' : null) },
    x => x.relapse * 10 - x.injW,
    0,
  ],
  [
    'Agent sérieux (offres, salaire)',
    { pro: true, set: C => (C.agent = { kind: 'maladroit', name: 'x' }) },
    { pro: true, set: C => (C.agent = { kind: 'bon', name: 'x' }) },
    bestOffer,
    1,
  ],
  [
    'Demander à souffler (pro)',
    { pro: true },
    {
      pro: true,
      wk: C => {
        for (const c of S.cal) if (c.w === S.week + 1 && c.cat === 2) C.skip[S.season + ':' + c.key] = true;
      },
    },
    x => x.proRaces,
    -1,
  ],
  [
    'Confiance du DS (sélection, carte libre)',
    { pro: true, wk: ask, set: C => (C.trust = 20) },
    { pro: true, wk: ask, set: C => (C.trust = 85) },
    x => x.proRaces + x.freeRole,
    1,
  ],
  ['Demander sa chance (pro)', { pro: true }, { pro: true, wk: ask }, x => x.freeRole, 1],
  [
    'Type de directeur sportif',
    { pro: true, wk: ask, set: C => ((carDs().kind = 'exigeant'), (C.trust = 62)) },
    { pro: true, wk: ask, set: C => ((carDs().kind = 'joueur'), (C.trust = 62)) },
    x => x.freeRole,
    1,
  ],
  [
    'Caractère : leader né (demandes)',
    { pro: true, wk: ask, create: { trait: 'modele' } },
    { pro: true, wk: ask, create: { trait: 'leaderne' } },
    x => x.freeRole,
    1,
  ],
  [
    'Réseaux : très présent',
    { pro: true },
    { pro: true, set: () => (carRep().social = 'star') },
    x => carRep().pub + carRep().fans / 1e5,
    1,
  ],
  [
    'Déclaration : ambitions',
    { pro: true, wk: podium, dec: a => (a.key.startsWith('decl') ? 'bois' : null) },
    { pro: true, wk: podium, dec: a => (a.key.startsWith('decl') ? 'ambition' : null) },
    x => carRep().pub + carRep().press,
    0,
  ],
  [
    'Déclaration : pique au rival',
    { pro: true, wk: podium, dec: a => (a.key.startsWith('decl') ? 'humble' : null) },
    { pro: true, wk: podium, dec: a => (a.key.startsWith('decl') ? 'pique' : null) },
    x => x.C.trust,
    -1,
  ],
  [
    'Sponsor personnel signé',
    { pro: true, set: () => (carRep().pub = 60) },
    { pro: true, set: () => (carRep().pub = 60), dec: a => (a.key.startsWith('spons') ? 'oui' : null) },
    x => x.C.money,
    1,
  ],
  [
    'Attaquer en course (panache)',
    { pro: true },
    { pro: true, radio: true },
    x => carRep().pub + carRep().style.att,
    1,
  ],
  [
    'Popularité (salaire proposé)',
    { pro: true, set: () => (carRep().pub = 10) },
    { pro: true, set: () => (carRep().pub = 85) },
    bestOffer,
    1,
  ],
  [
    'Habiter Gérone (entraînement)',
    { pro: true, ans: 2, set: () => (carLife().home = 'region') },
    { pro: true, ans: 2, set: () => (carLife().home = 'gerone') },
    x => carLifeTrain() * 100 + x.forme, // effet faible devant le bruit d'une saison : on vérifie le multiplicateur
    1,
  ],
  [
    'Habiter Andorre (forme)',
    { pro: true, set: () => (carLife().home = 'region') },
    { pro: true, set: () => (carLife().home = 'andorre') },
    x => x.forme,
    1,
  ],
  [
    'Habiter Monaco (argent)',
    { pro: true, set: () => (carLife().home = 'region') },
    { pro: true, set: () => (carLife().home = 'monaco') },
    x => x.C.money,
    0,
  ],
  ['Grand train de vie', { pro: true }, { pro: true, set: () => (carLife().style = 'luxe') }, x => x.C.money, -1],
  [
    'Grand train de vie (moral)',
    { pro: true, set: C => ((carLife().home = 'region'), (C.money = 500)) },
    { pro: true, set: C => ((carLife().home = 'region'), (carLife().style = 'luxe'), (C.money = 500)) },
    x => x.moral,
    1,
  ],
  [
    'Placer en bourse',
    { pro: true, ans: 2, set: C => ((C.money = 300), (carLife().inv = 'livret')) },
    { pro: true, ans: 2, set: C => ((C.money = 300), (carLife().inv = 'bourse')) },
    x => x.C.money,
    0,
  ],
  [
    'En couple',
    { pro: true },
    { pro: true, set: () => (carLife().partner = { name: 'X', since: S.season }) },
    x => x.moral,
    1,
  ],
  [
    'Priorité famille (tension)',
    { pro: true, set: () => (carLife().partner = { name: 'X', since: S.season }) },
    { pro: true, set: () => ((carLife().partner = { name: 'X', since: S.season }), (carLife().prio = 'famille')) },
    x => carLife().tension,
    -1,
  ],
  [
    'Priorité famille (progression)',
    { pro: true, ans: 2, set: () => (carLife().partner = { name: 'X', since: S.season }) },
    {
      pro: true,
      ans: 2,
      set: () => ((carLife().partner = { name: 'X', since: S.season }), (carLife().prio = 'famille')),
    },
    x => sum(STATS.map(k => x.me.s[k])),
    -1,
  ],
  [
    'Rentrer pour la naissance',
    {
      pro: true,
      set: () => ((carLife().partner = { name: 'X', since: S.season }), 0),
      wk: birthDuringRace,
      dec: a => (a.key.startsWith('naiss') ? 'rester' : null),
    },
    {
      pro: true,
      set: () => ((carLife().partner = { name: 'X', since: S.season }), 0),
      wk: birthDuringRace,
      dec: a => (a.key.startsWith('naiss') ? 'rentrer' : null),
    },
    x => -carLife().tension,
    1,
  ],
  [
    "Record de l'heure en altitude",
    { pro: true, set: (C, me) => ((me.s.clm = 90), (me.age = 25)), wk: () => carHourTry('mer') },
    { pro: true, set: (C, me) => ((me.s.clm = 90), (me.age = 25)), wk: () => carHourTry('alt') },
    x => x.C.hour.best,
    0,
  ],
  [
    'Prendre sa retraite (33 ans)',
    { pro: true, ans: 2, set: (C, me) => (me.age = 32) },
    { pro: true, ans: 2, set: (C, me) => (me.age = 32), dec: a => (a.key.startsWith('retraite') ? 'retraite' : null) },
    x => (x.C.end ? 1 : 0),
    1,
  ],
  [
    'Clause de leader au contrat',
    { pro: true },
    { pro: true, set: (C, me) => carSetLead(me.team, 'sec', 2) },
    x => x.leadRole,
    1,
  ],
  [
    "Offre d'une équipe modeste (rôle de leader)",
    { pro: true },
    {
      pro: true,
      set: (C, me) => {
        for (const k of STATS) me.s[k] += 6;
      },
    },
    x => {
      x.C.asks = [];
      carProOffers();
      const a = x.C.asks.find(a => a.data && a.data.offers);
      return a ? a.data.offers.filter(o => o.lead).length : 0;
    },
    1,
  ],
  [
    'Talent : phénomène',
    { create: { talent: 'modeste' } },
    { create: { talent: 'phenomene' } },
    x => overall(x.me.s) + x.me.ceil,
    1,
  ],
  [
    'Entraîneur personnel',
    { pro: true, set: C => (C.money = 300) },
    { pro: true, set: C => ((C.money = 300), carToggleStaff('coach')) },
    x => sum(STATS.map(k => x.me.s[k])),
    1,
  ],
  [
    'Ostéo et nutritionniste',
    { pro: true, ans: 2, set: C => (C.money = 300) },
    { pro: true, ans: 2, set: C => ((C.money = 300), carToggleStaff('soins')) },
    x => x.ill + x.injW / 4,
    -1,
  ],
  [
    'Soufflerie',
    { pro: true, set: C => (C.money = 300) },
    { pro: true, set: C => ((C.money = 300), carBuy('aero')) },
    x => x.me.s.clm,
    1,
  ],
  [
    'Stage privé en altitude',
    { pro: true, set: C => (C.money = 300) },
    { pro: true, set: C => ((C.money = 300), carBuy('camp')) },
    x => x.f6,
    1,
  ],
  [
    'Aider son club formateur',
    { pro: true, set: C => (C.money = 300) },
    { pro: true, set: C => ((C.money = 300), carBuy('club')) },
    x => carRep().pub,
    1,
  ],
].filter(c => c[0].toLowerCase().includes(FILTER.toLowerCase()));
let bad = 0;
for (const [name, A, B, f, dir] of CASES) {
  const seeds = Array.from({ length: NSEED }, (_, i) => 101 + i * 17);
  const a = seeds.map(sd => f(career(sd, A)));
  const b = seeds.map(sd => f(career(sd, B)));
  const ma = avg(a, x => x),
    mb = avg(b, x => x);
  const diff = mb - ma;
  const ok = dir === 0 ? a.some((v, i) => Math.abs(v - b[i]) > 1e-9) : Math.sign(diff) === dir;
  if (!ok) bad++;
  console.log(`${ok ? '✔' : '✖'} ${name.padEnd(42)} ${ma.toFixed(2)} → ${mb.toFixed(2)}`);
}
console.log(bad ? `${bad} choix sans effet visible` : 'Tous les choix testés ont un effet.');
process.exit(bad ? 1 : 0);
