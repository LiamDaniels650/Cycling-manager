/* Mode carrière — courses des jeunes (cadets 16 ans, juniors 17-18, espoirs 19-22), simulées par le moteur de
   course. Le peloton est formé de la génération suivie (et, pour les grandes courses espoirs, des jeunes pros),
   complété par des coureurs de passage ; l'équipe du joueur est « l'équipe du joueur » du moteur (id 0), le temps
   de la course (les équipes du monde sont mises de côté puis rendues). tier : club, cup (coupe nationale), nat
   (championnat national), intl (internationale), avenir (sélections nationales), monde (Mondiaux). */

const CAR_CAL = [
  // cadets
  { w: 4, key: 'c-print', cat: 'cadet', tier: 'club', name: 'Prix de Printemps cadets', st: [['vallonne', 65]] },
  { w: 8, key: 'c-region', cat: 'cadet', tier: 'cup', name: 'Coupe régionale cadets', st: [['plat', 70]] },
  { w: 12, key: 'c-grimpee', cat: 'cadet', tier: 'club', name: 'Grimpée des cadets', st: [['sommet', 48]] },
  {
    w: 17,
    key: 'c-tour',
    cat: 'cadet',
    tier: 'cup',
    name: 'Tour cadets',
    st: [
      ['plat', 62],
      ['clm', 8],
      ['vallonne', 66],
    ],
  },
  { w: 21, key: 'c-crit', cat: 'cadet', tier: 'club', name: 'Critérium des cadets', st: [['plat', 55]] },
  { w: 25, key: 'c-nat', cat: 'cadet', tier: 'nat', name: 'Championnat national cadets', st: [['vallonne', 76]] },
  { w: 30, key: 'c-cotes', cat: 'cadet', tier: 'club', name: 'Prix des Côtes cadets', st: [['punch', 70]] },
  { w: 35, key: 'c-ronde', cat: 'cadet', tier: 'cup', name: "Ronde d'automne cadets", st: [['vallonne', 72]] },
  // juniors
  { w: 5, key: 'j-saison', cat: 'junior', tier: 'club', name: 'Prix de Saison juniors', st: [['vallonne', 115]] },
  { w: 8, key: 'j-classique', cat: 'junior', tier: 'intl', name: 'Classique des Juniors', st: [['vallonne', 122]] },
  { w: 11, key: 'j-paves', cat: 'junior', tier: 'intl', name: 'Pavés juniors', st: [['paves', 116]] },
  {
    w: 13,
    key: 'j-cup1',
    cat: 'junior',
    tier: 'cup',
    name: 'Coupe nationale juniors (1re manche)',
    st: [['vallonne', 125]],
  },
  {
    w: 16,
    key: 'j-tour',
    cat: 'junior',
    tier: 'intl',
    name: 'Tour des Juniors',
    st: [
      ['plat', 110],
      ['vallonne', 120],
      ['sommet', 100],
    ],
  },
  {
    w: 19,
    key: 'j-cup2',
    cat: 'junior',
    tier: 'cup',
    name: 'Coupe nationale juniors (2e manche)',
    st: [['punch', 120]],
  },
  {
    w: 22,
    key: 'j-paix',
    cat: 'junior',
    tier: 'intl',
    name: 'Course de la Paix juniors',
    st: [
      ['vallonne', 118],
      ['clm', 14],
      ['sommet', 104],
      ['vallonne', 114],
    ],
  },
  { w: 25, key: 'j-nat', cat: 'junior', tier: 'nat', name: 'Championnat national juniors', st: [['vallonne', 130]] },
  { w: 28, key: 'j-gp', cat: 'junior', tier: 'intl', name: 'Grand Prix des Juniors', st: [['punch', 125]] },
  {
    w: 31,
    key: 'j-cup3',
    cat: 'junior',
    tier: 'cup',
    name: 'Coupe nationale juniors (3e manche)',
    st: [['plat', 120]],
  },
  {
    w: 37,
    key: 'j-monde',
    cat: 'junior',
    tier: 'monde',
    name: 'Championnat du monde juniors',
    st: [['vallonne', 132]],
  },
  // espoirs (moins de 23 ans)
  { w: 5, key: 'e-gpe', cat: 'espoir', tier: 'club', name: 'Grand Prix des Espoirs', st: [['vallonne', 150]] },
  { w: 9, key: 'e-paves', cat: 'espoir', tier: 'intl', name: 'Classique des Pavés Espoirs', st: [['paves', 165]] },
  { w: 13, key: 'e-fleche', cat: 'espoir', tier: 'intl', name: 'Flèche des Espoirs', st: [['punch', 168]] },
  { w: 15, key: 'e-doyenne', cat: 'espoir', tier: 'intl', name: 'Doyenne des Espoirs', st: [['vallonne', 175]] },
  {
    w: 18,
    key: 'e-ronde',
    cat: 'espoir',
    tier: 'intl',
    name: 'Ronde des Espoirs',
    st: [
      ['plat', 155],
      ['vallonne', 160],
      ['clm', 20],
      ['sommet', 145],
    ],
  },
  { w: 22, key: 'e-cup', cat: 'espoir', tier: 'cup', name: 'Coupe de France espoirs', st: [['vallonne', 165]] },
  { w: 25, key: 'e-nat', cat: 'espoir', tier: 'nat', name: 'Championnat national espoirs', st: [['vallonne', 170]] },
  {
    w: 27,
    key: 'e-giro',
    cat: 'espoir',
    tier: 'intl',
    name: 'Petite Boucle des Espoirs',
    st: [
      ['plat', 160],
      ['montagne', 150],
      ['clm', 25],
      ['sommet', 135],
      ['vallonne', 155],
    ],
  },
  { w: 30, key: 'e-vallee', cat: 'espoir', tier: 'club', name: 'Grand Prix de la Vallée', st: [['plat', 160]] },
  {
    w: 34,
    key: 'e-avenir',
    cat: 'espoir',
    tier: 'avenir',
    name: "Tour de l'Avenir",
    st: [
      ['plat', 150],
      ['vallonne', 160],
      ['clm', 25],
      ['montagne', 140],
      ['sommet', 125],
      ['sommet', 110],
    ],
  },
  {
    w: 38,
    key: 'e-monde',
    cat: 'espoir',
    tier: 'monde',
    name: 'Championnat du monde espoirs',
    st: [['vallonne', 175]],
  },
].sort((a, b) => a.w - b.w);
const CAR_TIER_W = { club: 1, cup: 1.4, nat: 1.6, intl: 2, avenir: 3, monde: 3 };
const CAR_FIELD = { club: 66, cup: 84, nat: 54, intl: 108, avenir: 120, monde: 132 };

function carCalNow() {
  const me = carMe();
  if (S.car.kind === 'pro' || me.age > 22) return [];
  const cat = carCatOf(me.age);
  return CAR_CAL.filter(d => d.cat === cat);
}
function carRaceThisWeek() {
  return carCalNow().find(d => d.w === S.week) || null;
}
function carRaceKey(d) {
  return S.season + ':' + d.key;
}
// Note d'un coureur sur un parcours (sélection et rôle) : terrain + forme.
function carFit(r, def) {
  return (
    worldsFit(
      r,
      def.st.map(([t]) => ({ type: t }))
    ) +
    (r.forme - 70) * 0.15
  );
}
function carSelScore(r, def) {
  return carFit(r, def) + (r.id === S.car.id ? S.car.selPts : (r.jPts || 0) * 0.25);
}
// Coureur de passage (effacé après la course).
function carFiller(age, nat) {
  const r = carYouth(age, nat);
  r.gen = false;
  r.filler = true;
  return r;
}
// Candidats d'une course selon la catégorie : la génération suivie, et les jeunes pros pour les grands
// rendez-vous espoirs (internationales, Avenir, Mondiaux), comme dans la réalité.
function carEntrants(def) {
  const me = carMe();
  const ages = def.cat === 'cadet' ? [16, 16] : def.cat === 'junior' ? [17, 18] : [19, 22];
  const ids = def.cat === 'espoir' ? S.car.u23 : S.car.pool;
  let L = ids
    .map(id => S.riders[id])
    .filter(r => r && !r.retired && r.age >= ages[0] && r.age <= ages[1] && r.injury <= 0);
  if (def.cat === 'espoir' && (def.tier === 'intl' || def.tier === 'avenir' || def.tier === 'monde'))
    L = L.concat(
      S.teams
        .filter(T => !T.player)
        .flatMap(T => T.riders.map(id => S.riders[id]))
        .filter(r => r && !r.car && r.age <= 22 && r.injury <= 0 && rnd() < (def.tier === 'intl' ? 0.25 : 1))
    );
  return { L: L.filter(r => r.id !== me.id), ages };
}
// Composition du peloton : l'équipe du joueur d'abord (« l'équipe du joueur » du moteur), puis les autres.
function carTeams(def) {
  const me = carMe();
  const { L, ages } = carEntrants(def);
  const temp = [];
  const fill = nat => {
    const f = carFiller(rint(ages[0], ages[1]), nat);
    temp.push(f);
    return f;
  };
  const teams = [];
  if (def.tier === 'avenir' || def.tier === 'monde') {
    const byNat = {};
    for (const r of L.concat([me])) (byNat[r.nat] = byNat[r.nat] || []).push(r);
    for (const n of Object.keys(NAT_NAME)) {
      const rs = (byNat[n] || []).sort((a, b) => carSelScore(b, def) - carSelScore(a, def)).slice(0, 6);
      while (rs.length < 6) rs.push(fill(n));
      teams.push({ nat: n, rs, mine: rs.includes(me) });
    }
    return { teams, temp, selected: teams.some(t => t.mine) };
  }
  const pool = def.tier === 'nat' ? L.filter(r => r.nat === me.nat) : L;
  const mates = S.car.mates
    .map(id => S.riders[id])
    .filter(r => r && pool.includes(r))
    .slice(0, 5);
  while (mates.length < 5) mates.push(fill(me.nat));
  const target = CAR_FIELD[def.tier];
  const others = shuffle(pool.filter(r => !mates.includes(r))).slice(0, Math.max(0, target - 6));
  while (others.length < target - 6) others.push(fill(def.tier === 'nat' ? me.nat : undefined));
  teams.push({ mine: true, rs: [me, ...mates] });
  for (let k = 0; k < others.length; k += 6) teams.push({ rs: others.slice(k, k + 6) });
  return { teams, temp, selected: true };
}
function carAbbr(n) {
  return n
    .split(/[\s-]+/)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
}
// Départ d'une course de jeunes. Retourne null si le joueur n'est pas sélectionné (Avenir, Mondiaux).
let CAR_SWAP = null;
function carStartRace(def) {
  const me = carMe();
  const cal = { key: 'car-' + def.key + '-' + S.season, w: S.week, stagesSpec: def.st };
  const specs = prepareRaceSpecs(cal);
  const { teams, temp, selected } = withSeed({ sd: stageSeed(cal, -3) }, () => carTeams(def));
  if (!selected) {
    for (const r of temp) delete S.riders[r.id];
    return null;
  }
  const proto = S.teams.filter(T => !T.player);
  const tTeams = teams.map((t, k) => {
    const base = proto[k % proto.length];
    const name = t.nat
      ? 'Sélection ' + (NAT_NAME[t.nat] ? 'de ' + NAT_NAME[t.nat] : t.nat)
      : t.mine
        ? S.car.club
        : `${pick(CLUBS)} ${pick(PLACE)}`;
    return {
      ...base,
      id: t.mine ? 0 : 950 + k,
      player: !!t.mine,
      name,
      short: t.nat || carAbbr(name),
      color: t.mine ? '#e91e63' : base.color,
      riders: t.rs.map(r => r.id),
    };
  });
  tTeams.sort((a, b) => (b.player ? 1 : 0) - (a.player ? 1 : 0));
  const rc = {
    calIdx: -1,
    key: cal.key,
    name: def.name,
    cat: def.tier === 'intl' || def.tier === 'avenir' || def.tier === 'monde' ? 1 : 3,
    esp: true,
    car: def.key,
    carId: me.id,
    specs,
    si: 0,
    sel: {},
    orders: {},
    gc: {},
    pts: {},
    kom: {},
    energy: {},
    out: {},
    place: {},
    stageRes: [],
    done: false,
    plan: {},
    conds: {},
  };
  const saveTeam = {};
  CAR_SWAP = { teams: S.teams, saveTeam, temp, def };
  S.teams = tTeams;
  for (const T of tTeams) {
    rc.sel[T.id] = T.riders.slice();
    for (const id of T.riders) {
      saveTeam[id] = S.riders[id].team;
      S.riders[id].team = T.id;
      rc.gc[id] = rc.pts[id] = rc.kom[id] = 0;
      rc.energy[id] = 100;
    }
  }
  S.rc = rc;
  carOrders(rc);
  carDreamBoost(def.name, def.key, def.tier);
  return rc;
}
// Moral du joueur : son caractère amplifie ou amortit les coups (mental fragile, gagneur…).
function carMo(me, v) {
  smo(me, v * carTraitMul(v < 0 ? 'moralDown' : 'moralUp'));
}
// Consignes de l'équipe du joueur pour l'étape (le directeur sportif du club : le meilleur sur ce terrain est
// leader, les autres l'aident), puis le rôle demandé par le joueur s'il l'a obtenu.
function carOrders(rc) {
  Object.assign(rc.orders, autoOrders(0, rc.specs[rc.si], rc));
  carOrderHook(rc);
}
// Le joueur a obtenu sa chance : carte libre (sauf s'il est déjà leader ou sprinteur, ou en chrono).
function carOrderHook(rc) {
  if (carIsPro()) carLeadHook(rc);
  const o = rc.orders[S.car.id];
  if (S.car.wish === 'free' && o && !['leader', 'sprint', 'itt'].includes(o.o)) o.o = 'free';
}
// Fin d'une course de jeunes : le monde retrouve ses équipes, puis bilan.
function carFinishRace() {
  const rc = S.rc;
  const sw = CAR_SWAP;
  if (!rc || !sw) return null;
  S.teams = sw.teams;
  for (const id in sw.saveTeam) if (S.riders[id]) S.riders[id].team = sw.saveTeam[id];
  const out = carAfterRace(rc, sw.def);
  for (const r of sw.temp) delete S.riders[r.id];
  CAR_SWAP = null;
  S.rc = null;
  return out;
}
// Course de jeunes simulée d'un bloc.
function carSimRace(def) {
  if (!carStartRace(def)) return null;
  let k = 0;
  while (!S.rc.done && k++ < 12) {
    carOrders(S.rc);
    runStageAuto(S.rc);
  }
  return carFinishRace();
}
// Résultat du joueur : classement final (général pour une course par étapes).
function carOrderOf(rc) {
  return rc.specs.length > 1 ? gcList(rc) : (rc.stageRes[0].res || []).map(e => e.id);
}
function carAfterRace(rc, def) {
  const me = carMe();
  const order = carOrderOf(rc);
  const rank = order.indexOf(me.id) + 1;
  const lbl = { cadet: 'cadets', junior: 'juniors', espoir: 'espoirs' }[def.cat];
  const what =
    def.tier === 'nat'
      ? `Champion national ${lbl}`
      : def.tier === 'monde'
        ? `Champion du monde ${lbl}`
        : rc.specs.length > 1
          ? `Classement général (${lbl})`
          : `Course ${lbl}`;
  rc.stageRes.forEach((st, i) => {
    if (rc.specs.length > 1 && st.res[0] && st.res[0].id === me.id)
      palmAdd(me.id, rc.name, `Étape ${i + 1} (${lbl})`, 1);
  });
  if (rank >= 1 && rank <= 3) palmAdd(me.id, rc.name, what, rank);
  const w = CAR_TIER_W[def.tier];
  order.slice(0, 15).forEach((id, i) => {
    const r = S.riders[id];
    if (r && r.gen) r.jPts = (r.jPts || 0) + (15 - i) * w;
  });
  // pros croisés aux grands rendez-vous espoirs : ils comptent aussi pour les recruteurs
  for (const id of order.slice(0, 10))
    if (S.riders[id] && !S.riders[id].gen && S.riders[id].team != null)
      S.riders[id].espPts = (S.riders[id].espPts || 0) + 1;
  return carRecord(rc, def.name, def.tier, def.key, rank, order, w);
}
// Bilan commun (jeunes et pros) : journal, résultats, moral, fatigue, visibilité, duels avec la génération.
function carRecord(rc, name, tier, key, rank, order, w) {
  const me = carMe();
  const C = S.car;
  const n = order.length;
  const days = rc.specs.length;
  me.espDays = (me.espDays || 0) + days;
  if (me.team == null) me.stats.days = (me.stats.days || 0) + days;
  // (la fatigue de course vient de la simulation des étapes ; ici seulement les déplacements)
  me.fatigue = clamp(me.fatigue + days, 0, 100);
  if (rank) {
    const pts = rank <= 15 ? (16 - rank) * w : 0;
    C.selPts += pts * 0.35;
    C.vis = clamp(C.vis + (pts * 0.45 + (rank === 1 ? 4 * w : 0)) * carTraitMul('vis'), 0, 100);
    // un équipier qui a fait son travail ne se juge pas à sa place : seul le coureur libre ou leader encaisse un échec
    const helper = rc.orders && rc.orders[me.id] && CAR_HELPER_ORDERS.has(rc.orders[me.id].o);
    carMo(me, rank === 1 ? 12 : rank <= 3 ? 7 : rank <= 10 ? 3 : rank <= n / 2 || helper ? 0 : -3);
    if (me.team == null) {
      if (rank === 1) me.stats.wins = (me.stats.wins || 0) + 1;
      if (rank <= 3) me.stats.podiums = (me.stats.podiums || 0) + 1;
    }
  } else carMo(me, -4);
  if (rank === 1) carRepWin();
  carRepAfterRace(rc, name, tier, key, rank, n, w);
  // la course forme : petite progression les jours de course, jusqu'à la fin du pic (ensuite elle ne fait
  // plus que ralentir le déclin, sans le compenser)
  const pkEnd = (PEAK_AGE[me.arch] || [26, 30])[1];
  for (let d = 0; d < days; d++)
    if (rnd() < (me.age <= pkEnd ? 0.07 : 0.015)) {
      const k = rnd() < 0.6 ? pick(PRIMARY[me.arch] || STATS) : pick(STATS);
      if (me.s[k] < Math.min(95, me.ceil + (me.age <= 23 ? 4 : 0))) me.s[k]++;
    }
  // duels avec la génération : quand les deux finissent dans les 20 premiers
  if (rank && rank <= 20)
    for (const id of order.slice(0, 20)) {
      const r = S.riders[id];
      if (!r || !r.gen || id === me.id) continue;
      const h = (C.h2h[id] = C.h2h[id] || [0, 0]);
      h[order.indexOf(id) > rank - 1 ? 0 : 1]++;
    }
  C.potKnow = Math.min(0.9, C.potKnow + 0.01 * days);
  const top = order
    .slice(0, 3)
    .map((id, i) => `${i + 1}. ${riderName(S.riders[id])}${id === me.id ? ' (toi)' : ''}`)
    .join(', ');
  const rec = { s: S.season, w: S.week, key, name, tier, rank, n, top, stages: days };
  C.res.unshift(rec);
  if (C.res.length > 500) C.res.length = 500;
  C.raced[S.season + ':' + key] = true;
  C.wish = null;
  carFeed(
    rank === 1 ? `🏆 Victoire : ${name}` : rank && rank <= 3 ? `🥉 Podium : ${name}` : `🏁 ${name}`,
    `${rank ? `Tu termines <b>${rank}e</b> sur ${n}.` : 'Abandon.'} Podium : ${top}.`
  );
  return rec;
}
function carNotSelected(def) {
  S.car.raced[carRaceKey(def)] = true;
  carFeed(
    `🌍 ${def.name}`,
    `Le sélectionneur ne t'a pas retenu cette fois. Il faudra des résultats pour forcer la porte.`
  );
}
// Changement de saison chez les jeunes : la génération avance d'une classe ; les 19 ans passent espoirs.
function carJuniorsNewSeason() {
  const C = S.car;
  const me = carMe();
  for (const id of C.pool.slice()) {
    const r = S.riders[id];
    if (r && !r.retired && r.age < 19) continue;
    C.pool.splice(C.pool.indexOf(id), 1);
    if (r && !r.retired) C.u23.push(id);
  }
  for (let i = 0; i < CAR_POOL_N; i++) C.pool.push(carYouth(16, rnd() < 0.3 ? me.nat : undefined).id);
  for (const id of C.pool.concat(C.u23)) if (S.riders[id]) S.riders[id].jPts = 0;
  // un club plus huppé s'intéresse au junior qui se montre
  if (me.age === 17 && C.vis >= 18) {
    const lvl = C.vis >= 45 ? 3 : 2;
    const club = `${lvl === 3 ? 'Team' : 'UC'} ${pick(PLACE)} Juniors`;
    carAsk(
      'club:' + S.season,
      `Le ${club}, l'un des meilleurs clubs juniors du pays, te propose de le rejoindre.`,
      [
        ['stay', 'Rester dans mon club'],
        ['go', `Rejoindre le ${club}`],
      ],
      'stay',
      { club, lvl }
    );
  }
}
CAR_FX.club = (o, a) => {
  const C = S.car;
  const me = carMe();
  if (o === 'stay') {
    smo(me, 3);
    return 'Tu restes avec tes copains du club.';
  }
  C.club = a.data.club;
  C.clubLvl = a.data.lvl;
  C.mates = C.pool
    .map(id => S.riders[id])
    .filter(r => r && r.nat === me.nat && Math.abs(r.age - me.age) <= 1)
    .sort((x, y) => overall(y.s) - overall(x.s))
    .slice(0, 5)
    .map(r => r.id);
  C.vis = clamp(C.vis + 6, 0, 100);
  return `Direction le ${a.data.club} : de meilleurs équipiers, plus de courses vues par les recruteurs.`;
};
