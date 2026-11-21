/* Académie (v3) : calendrier espoirs simulé par le moteur de course, stagiaires, tests physiques, mentors,
   surmenage, concurrence des équipes pros pour les jeunes, réputation et anciens de l'académie. */

// Calendrier espoirs (moins de 23 ans). tier : club (petite course), big (course par étapes nationale),
// nat (championnats nationaux), tour (le « Tour de l'Avenir » du jeu, sélections nationales), monde.
const ESP_CAL = [
  { w: 5, key: 'gpe', name: 'Grand Prix des Espoirs', tier: 'club', st: [['vallonne', 150]] },
  { w: 9, key: 'pave', name: 'Classique des Pavés Espoirs', tier: 'club', st: [['paves', 160]] },
  { w: 13, key: 'fle', name: 'Flèche des Espoirs', tier: 'club', st: [['punch', 165]] },
  {
    w: 18,
    key: 'ronde',
    name: 'Ronde des Espoirs',
    tier: 'big',
    st: [
      ['plat', 155],
      ['vallonne', 160],
      ['clm', 20],
      ['sommet', 145],
    ],
  },
  { w: 25, key: 'nat', name: 'Championnats nationaux espoirs', tier: 'nat', st: [['vallonne', 170]] },
  { w: 30, key: 'gpv', name: 'Grand Prix de la Vallée', tier: 'club', st: [['plat', 160]] },
  {
    w: 34,
    key: 'tour',
    name: "Tour de l'Avenir",
    tier: 'tour',
    st: [
      ['plat', 150],
      ['vallonne', 160],
      ['clm', 25],
      ['montagne', 140],
      ['sommet', 125],
      ['sommet', 110],
    ],
  },
  { w: 38, key: 'monde', name: 'Championnat du monde espoirs', tier: 'monde', st: [['vallonne', 175]] },
  // juniors (17-18 ans) : courses plus courtes, entre juniors
  { w: 7, key: 'jcl', name: 'Classique des Juniors', tier: 'jun', st: [['vallonne', 120]] },
  {
    w: 15,
    key: 'jtour',
    name: 'Tour des Juniors',
    tier: 'jun',
    st: [
      ['plat', 110],
      ['vallonne', 120],
      ['sommet', 100],
    ],
  },
  { w: 27, key: 'jgp', name: 'Grand Prix des Juniors', tier: 'jun', st: [['punch', 125]] },
  { w: 37, key: 'jmonde', name: 'Championnat du monde juniors', tier: 'junmonde', st: [['vallonne', 130]] },
].sort((a, b) => a.w - b.w);
const isJun = def => def.tier === 'jun' || def.tier === 'junmonde';
const ESP_WEEKS = ESP_CAL.map(e => e.w);
const ESP_PROG = { complet: 'Toutes les courses', selectif: 'Grands rendez-vous', aucun: 'Pas de course espoirs' };
const STAG_WEEK = 31; // stagiaires chez les pros à partir du 1er août
const STAG_MAX = 3;
const TEST_COST = 4;
const CLUBS = ['VC', 'UC', 'AC', 'CC', 'Team', 'Vélo Club', 'Espoirs'];

function acaRep() {
  if (S.acaRep == null) S.acaRep = 25;
  return S.acaRep;
}
function addAcaRep(v) {
  S.acaRep = clamp(acaRep() + v, 0, 100);
}
function acaRepLabel(v) {
  return v >= 75
    ? 'Référence mondiale'
    : v >= 55
      ? 'Très réputée'
      : v >= 38
        ? 'Reconnue'
        : v >= 20
          ? 'Modeste'
          : 'Inconnue';
}
// Hasard figé (une décision ne change pas en recliquant) : dépend de la saison, de la semaine et d'un sel.
function fixedRnd(salt) {
  return (mercHash(salt) % 10000) / 10000;
}

// --- Développement ---
// Profil de maturité tiré à la création d'un jeune : précoce (pic tôt), normal, tardif (révélation vers 24 ans).
// Environ 2,5 % des jeunes sont des prodiges (plafond 86-90, déjà au niveau des bons pros à 20-21 ans, sans
// dépasser les meilleurs du peloton) et 6 % des pépites précoces (plafond 82-86) ; le plafond d'un jeune ne
// dépasse jamais 90 : il n'y a pas de dieux, même parmi les prodiges.
function rollDev(r) {
  const u = rnd();
  if (u < 0.025) {
    r.dev = 'precoce';
    r.prodigy = true;
    r.ceil = rint(86, 89);
    for (const k of STATS) r.s[k] = Math.min(88, r.s[k] + 4);
  } else if (u < 0.085) {
    r.dev = 'precoce';
    r.ceil = Math.max(r.ceil, rint(82, 86));
    for (const k of STATS) r.s[k] = Math.min(88, r.s[k] + 2);
  } else {
    const v = rnd();
    r.dev = v < 0.1 ? 'precoce' : v < 0.3 ? 'tardif' : 'normal';
  }
  if (r.dev === 'tardif') r.late = true;
  r.ceil = Math.min(90, r.ceil);
}
const DEV_LBL = { precoce: 'précoce', normal: 'normale', tardif: 'tardive' };
// Facteur d'âge de la progression selon la maturité.
function devAgeMul(r) {
  if (r.prodigy) return r.age <= 20 ? 1.9 : r.age <= 22 ? 1.4 : r.age <= 24 ? 0.8 : 1;
  if (r.dev === 'precoce') return r.age <= 21 ? 1.55 : r.age <= 24 ? 0.8 : 1;
  if (r.dev === 'tardif') return r.age <= 21 ? 0.75 : 1;
  return 1;
}
// Mentor : un ancien de l'équipe (27 ans et plus) encadre un espoir.
function mentorOf(r) {
  const m = S.mentor && S.mentor[r.id];
  if (m == null) return null;
  const M = S.riders[m];
  return M && M.team === 0 && !M.aca && !M.retired ? M : null;
}
function mentorMul(r) {
  const M = mentorOf(r);
  if (!M) return 1;
  return 1 + 0.1 + (M.trait === 'modele' ? 0.08 : 0) + (M.dis - 50) / 600;
}
function setMentor(acaId, proId) {
  S.mentor = S.mentor || {};
  if (!proId) {
    delete S.mentor[acaId];
    return null;
  }
  const M = S.riders[proId];
  if (!M || M.team !== 0 || M.aca || M.age < 27) return 'Le mentor doit être un coureur de l’équipe de 27 ans ou plus.';
  if (Object.values(S.mentor).filter(v => v === +proId).length >= 2)
    return `${riderName(M)} encadre déjà deux espoirs.`;
  S.mentor[acaId] = +proId;
  return null;
}
function mentorCands() {
  return S.teams[0].riders
    .map(id => S.riders[id])
    .filter(r => r && r.age >= 27)
    .sort((a, b) => b.dis + (b.trait === 'modele' ? 20 : 0) - (a.dis + (a.trait === 'modele' ? 20 : 0)));
}
// Charge de la saison (jours de course espoirs + pros) et seuil de surmenage selon l'âge.
function youthLoad(r) {
  return (r.espDays || 0) + (r.stats ? r.stats.days : 0);
}
function youthLoadMax(r) {
  return r.age <= 18 ? 28 : r.age <= 19 ? 36 : r.age <= 20 ? 45 : r.age <= 21 ? 55 : 65;
}
// Effets hebdomadaires : mentors, surmenage, approches des équipes pros.
function academyWeekly() {
  for (const id of S.academy) {
    const r = S.riders[id];
    if (!r) continue;
    const M = mentorOf(r);
    if (M) {
      r.moral = clamp(r.moral + 0.5, 0, 100);
      addRel(r.id, M.id, 0.3);
      if (S.week % 4 === 0 && M.dis > r.dis) r.dis++;
      M.moral = clamp(M.moral + 0.15, 0, 100);
    } else if (S.mentor && S.mentor[id] != null) delete S.mentor[id];
    // surmenage : trop de jours de course pour son âge
    const over = youthLoad(r) - youthLoadMax(r);
    if (over > 0) {
      r.moral = clamp(r.moral - 1, 0, 100);
      r.fatigue = clamp(r.fatigue + 2, 0, 100);
      if ((r.burnS || 0) < 3 && rnd() < 0.02 * Math.min(4, over / 3)) {
        r.ceil = Math.max(overall(r.s), r.ceil - 1);
        r.burnS = (r.burnS || 0) + 1;
        msg('Académie', `${riderName(r)} est surmené (${youthLoad(r)} jours de course) : son potentiel en souffre.`);
      }
    }
  }
}

// --- Tests physiques ---
// Profil de puissance (W/kg) et VO2max estimés à partir des qualités, avec une marge d'erreur qui
// diminue avec la connaissance du coureur ; le test lui-même affine fortement cette connaissance.
function physProfile(r) {
  const s = r.s;
  const err = (1 - Math.min(95, S.know[r.id] || 35) / 100) * 0.6;
  const n = k => 1 + ((((r.id * 7919 + k * 104729) % 1000) / 1000 - 0.5) * err) / 4;
  return {
    p5: +((9 + 0.15 * s.spr) * n(1)).toFixed(1),
    p60: +((5.4 + 0.058 * (s.col + s.spr) * 0.5) * n(2)).toFixed(1),
    p300: +((3.2 + 0.042 * (s.col + s.mon) * 0.5) * n(3)).toFixed(2),
    p1200: +((2.6 + (0.04 * (s.mon + s.clm + s.end)) / 3) * n(4)).toFixed(2),
    vo2: Math.round((58 + 0.28 * (s.mon + s.end) * 0.5) * n(5)),
  };
}
function physTest(id) {
  const r = S.riders[id];
  if (!r || !r.aca) return 'Réservé aux espoirs de l’académie.';
  if (r.ptest && r.ptest.s === S.season) return 'Déjà testé cette saison.';
  if (S.budget < TEST_COST + 5) return 'Budget insuffisant.';
  S.budget -= TEST_COST;
  finAdd('aca', -TEST_COST);
  S.know[id] = Math.max(S.know[id] || 0, Math.min(95, (S.know[id] || 35) + 20 + 3 * S.staff.coach));
  r.ptest = { s: S.season, ...physProfile(r), dev: r.dev || 'normal' };
  return null;
}

// --- Stagiaires ---
function isStag(r) {
  return !!(r && r.aca && r.stag === S.season);
}
function setStag(id, on) {
  const r = S.riders[id];
  if (!r || !r.aca) return 'Réservé aux espoirs de l’académie.';
  if (!on) {
    r.stag = null;
    return null;
  }
  if (S.week < STAG_WEEK) return `Les stages chez les pros commencent en août (semaine ${STAG_WEEK}).`;
  if (r.age < 19) return 'Il faut avoir 19 ans pour être stagiaire.';
  if (S.academy.filter(i => isStag(S.riders[i])).length >= STAG_MAX) return `${STAG_MAX} stagiaires au plus.`;
  r.stag = S.season;
  msg('Stagiaire', `${riderName(r)} rejoint l'équipe pro comme stagiaire jusqu'à la fin de la saison.`);
  return null;
}

// --- Réputation et recrutement ---
// Un jeune très prometteur peut préférer une académie plus réputée (décision figée pour la semaine).
function acaRefuses(r) {
  const p = clamp((r.ceil - 76) * 0.07 - (acaRep() - 25) / 90, 0, 0.75);
  return fixedRnd(r.id) < p;
}

// --- Courses espoirs ---
// Engagés de l'académie : juniors (18 ans et moins) ou espoirs (19 ans et plus) selon la course.
function espEntrants(tier) {
  const big = tier !== 'club' && tier !== 'jun';
  const jun = tier === 'jun' || tier === 'junmonde';
  return S.academy
    .map(id => S.riders[id])
    .filter(
      r =>
        r &&
        r.injury <= 0 &&
        (jun ? r.age <= 18 : r.age >= 19) &&
        (r.espProg || 'complet') !== 'aucun' &&
        (big || r.espProg !== 'selectif')
    );
}
// Coureurs de remplissage (clubs espoirs) : jeunes de 19 à 22 ans créés pour la course, effacés ensuite.
function espFiller(nat, jun) {
  const age = jun ? rint(17, 18) : rint(19, 22);
  const r = genYouthRider(age);
  r.youth = false;
  r.filler = true;
  if (nat) r.nat = nat;
  const lift = (age - 19) * 1.1 - 0.5 + gauss() * 1.5;
  if (nat) {
    // nom et nationalité cohérents pour les sélections nationales
    const N_ = NATS[nat];
    if (N_) [r.fn, r.ln] = uniqueName(N_);
  }
  for (const k of STATS) r.s[k] = clamp(Math.round(r.s[k] + lift), 35, 90);
  S.riders[r.id] = r;
  return r;
}
// Composition des équipes : académie (le joueur) + vivier + U23 des équipes pros (grands rendez-vous)
// + clubs ; en sélections nationales pour les championnats, l'Avenir et le Mondial.
function espTeams(def, mine, natFilter) {
  const temp = [];
  const used = (S.weekUsed && S.weekUsed[S.week]) || [];
  const jun = isJun(def);
  let pool = S.youth
    .map(id => S.riders[id])
    .filter(r => r && r.injury <= 0 && (jun ? r.age <= 18 : r.age >= 19 || def.tier === 'club'));
  if (def.tier === 'tour' || def.tier === 'monde' || def.tier === 'nat')
    pool = pool.concat(
      S.teams
        .filter(T => !T.player)
        .flatMap(T => T.riders.map(id => S.riders[id]))
        .filter(r => r && r.age <= 22 && r.injury <= 0 && !used.includes(r.id))
    );
  if (natFilter) pool = pool.filter(r => r.nat === natFilter);
  const target = def.tier === 'nat' ? 60 : def.tier === 'tour' ? 120 : def.tier === 'monde' ? 150 : jun ? 90 : 110;
  const teams = [];
  const natMode = def.tier === 'nat' || def.tier === 'tour' || def.tier === 'monde' || def.tier === 'junmonde';
  if (natMode) {
    // sélections nationales : 6 coureurs par pays (les meilleurs), académie comprise
    const all = pool.concat(mine);
    const byNat = {};
    for (const r of all) (byNat[r.nat] = byNat[r.nat] || []).push(r);
    for (const n in byNat) {
      let rs = byNat[n].sort((a, b) => overall(b.s) - overall(a.s)).slice(0, def.tier === 'nat' ? 60 : 6);
      while (rs.length < (def.tier === 'nat' ? 30 : 6)) {
        const f = espFiller(n, jun);
        temp.push(f);
        rs.push(f);
      }
      // l'espoir de l'académie non retenu par sa sélection reste à la maison
      for (let k = 0; k < rs.length; k += 6) teams.push({ nat: n, rs: rs.slice(k, k + 6) });
    }
  } else {
    if (mine.length) teams.push({ mine: true, rs: mine.slice(0, 6) });
    const others = shuffle(pool.slice()).slice(0, target - Math.min(6, mine.length));
    while (others.length < target - Math.min(6, mine.length)) {
      const f = espFiller(null, jun);
      temp.push(f);
      others.push(f);
    }
    for (let k = 0; k < others.length; k += 6) teams.push({ rs: others.slice(k, k + 6) });
  }
  return { teams, temp };
}
// Une course espoirs complète, simulée étape par étape par le moteur de course.
function runEspRace(def, natFilter) {
  const mine = espEntrants(def.tier).filter(r => !natFilter || r.nat === natFilter);
  if (!mine.length) return null;
  const cal = { key: `esp-${def.key}${natFilter ? '-' + natFilter : ''}`, w: S.week, stagesSpec: def.st };
  const specs = prepareRaceSpecs(cal);
  const { teams, temp } = withSeed({ sd: stageSeed(cal, -3) }, () => espTeams(def, mine, natFilter));
  const proto = S.teams.filter(T => !T.player);
  const saveTeams = S.teams,
    saveTeam = {};
  const T0 = S.teams[0];
  const tTeams = teams
    .filter(t => t.rs.length)
    .map((t, k) => {
      const base = proto[k % proto.length];
      const isMine = !!t.mine;
      const club = `${pick(CLUBS)} ${pick(PLACE)}`;
      return {
        ...base,
        id: isMine ? 0 : 950 + k,
        player: isMine,
        name: isMine
          ? T0.name + ' Académie'
          : t.nat
            ? 'Sélection ' + (NAT_NAME[t.nat] ? 'de ' + NAT_NAME[t.nat] : t.nat)
            : club,
        short: isMine ? T0.short : t.nat || club,
        riders: t.rs.map(r => r.id),
        style: isMine ? T0.style : base.style,
        eq: isMine ? T0.eq : base.eq,
      };
    });
  // l'académie en tête de liste (le moteur attend l'équipe du joueur en premier, s'il y en a une)
  tTeams.sort((a, b) => (b.player ? 1 : 0) - (a.player ? 1 : 0));
  const rc = {
    calIdx: -1,
    key: cal.key,
    name: def.name + (natFilter ? ` (${NAT_NAME[natFilter] || natFilter})` : ''),
    cat: def.tier === 'tour' ? 1 : 3,
    esp: true,
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
  try {
    S.teams = tTeams;
    for (const T of tTeams)
      for (const id of T.riders) {
        saveTeam[id] = S.riders[id].team;
        S.riders[id].team = T.id;
        rc.gc[id] = rc.pts[id] = rc.kom[id] = 0;
        rc.energy[id] = 100;
      }
    for (const T of tTeams) rc.sel[T.id] = T.riders.slice();
    let k = 0;
    while (!rc.done && k++ < 12) {
      const spec = rc.specs[rc.si];
      rc.feedPlan = 'normal';
      rc.feedStage = rc.si;
      if (S.teams[0].player) Object.assign(rc.orders, autoOrders(0, spec, rc));
      runStageAuto(rc);
    }
  } finally {
    S.teams = saveTeams;
    for (const id in saveTeam) S.riders[id].team = saveTeam[id];
  }
  const out = espAfter(def, rc, mine, tTeams);
  for (const r of temp) delete S.riders[r.id];
  return out;
}
// Résultat d'une étape espoirs : temps, général, récupération (sans victoires pros, primes ni points UCI).
function espStageResult(rc, spec, res, dnfIds) {
  gcDirty(rc);
  const t0 = res.length ? res[0].time : 0;
  res.forEach((e, i) => {
    e.gap = e.time - t0;
    rc.gc[e.id] += e.time;
    rc.place[e.id] = (rc.place[e.id] || 0) + i + 1;
    rc.energy[e.id] = e.energy;
    const r = S.riders[e.id];
    if (r.aca) {
      r.espDays = (r.espDays || 0) + 1;
      r.fatigue = clamp(r.fatigue + 4, 0, 100);
      // la course forme : un peu de progression par jour de course
      if (rnd() < 0.05) {
        const k = rnd() < 0.6 ? pick(PRIMARY[r.arch] || STATS) : pick(STATS);
        if (r.s[k] < Math.min(95, r.ceil + 6)) r.s[k]++;
      }
    }
  });
  if (spec.type !== 'clm')
    [10, 6, 4].forEach((b, i) => {
      if (res[i]) rc.gc[res[i].id] -= b;
    });
  for (const id of dnfIds) rc.out[id] = true;
  rc.stageRes.push({ name: spec.name, type: spec.type, res: res.map(e => ({ id: e.id, gap: e.gap })) });
  for (const id in rc.energy) {
    if (rc.out[id]) continue;
    const r = S.riders[id];
    rc.energy[id] = clamp(rc.energy[id] + 45 + r.s.rec * 0.45 - r.fatigue * 0.25, 30, 100);
  }
  gcDirty(rc);
  rc.si++;
  if (rc.si >= rc.specs.length) rc.done = true;
}
// Après la course : palmarès, moral, connaissance, réputation, repérage par les équipes pros, compte rendu.
function espAfter(def, rc, mine, tTeams) {
  const gcl = gcList(rc);
  const multi = rc.specs.length > 1;
  const nm = id => riderName(S.riders[id]);
  const lines = [];
  const mineIds = new Set(mine.map(r => r.id));
  const notable = [];
  // victoires d'étape
  if (multi)
    rc.stageRes.forEach((st, i) => {
      const w = st.res[0] && st.res[0].id;
      if (w != null && mineIds.has(w)) {
        palmAdd(w, rc.name, `Étape ${i + 1} (${isJun(def) ? 'juniors' : 'espoirs'})`, 1);
        addAcaRep(1);
        notable.push(`🏆 ${nm(w)} gagne l'étape ${i + 1}`);
      }
    });
  const what =
    def.tier === 'nat'
      ? 'Champion national espoirs'
      : def.tier === 'monde'
        ? 'Champion du monde espoirs'
        : multi
          ? 'Classement général (espoirs)'
          : 'Course espoirs';
  gcl.forEach((id, i) => {
    const r = S.riders[id];
    if (!r) return;
    if (mineIds.has(id)) {
      r.moral = clamp(r.moral + (i === 0 ? 10 : i < 5 ? 5 : i < 20 ? 1 : -2), 0, 100);
      S.know[id] = Math.min(95, (S.know[id] || 35) + (multi ? 6 : 3));
      r.espBest = Math.min(r.espBest || 999, i + 1);
      if (i === 0) {
        palmAdd(id, rc.name, what, 1);
        r.stats.espW = (r.stats.espW || 0) + 1;
        if (def.tier === 'nat') r.u23Title = S.season;
        addAcaRep({ club: 2, big: 4, nat: 4, tour: 7, monde: 8, jun: 1, junmonde: 4 }[def.tier]);
      } else if (i < 3) {
        palmAdd(id, rc.name, what, i + 1);
        addAcaRep(def.tier === 'club' || def.tier === 'jun' ? 0.5 : 1.5);
      }
      if (
        i < 3 &&
        (def.tier === 'big' ||
          def.tier === 'nat' ||
          def.tier === 'tour' ||
          def.tier === 'monde' ||
          def.tier === 'junmonde')
      )
        espApproach(r, i);
      lines.push(`${i + 1}. ${nm(id)}${multi ? ` (${fmtGap(rc.gc[id] - rc.gc[gcl[0]])})` : ''}`);
    } else if (r.youth && i < 15) {
      // les recruteurs voient courir les jeunes du vivier
      S.know[id] = Math.min(60 + S.staff.scout * 7, (S.know[id] || 0) + 3 + (i < 5 ? 3 : 0));
      r.espPts = (r.espPts || 0) + (15 - i);
    }
  });
  const raced = new Set(tTeams.flatMap(T => T.riders));
  const tOf = {};
  for (const T of tTeams) for (const id of T.riders) tOf[id] = T.player ? 'vous' : T.short;
  for (const r of mine)
    if (!raced.has(r.id)) lines.push(`${nm(r.id)} non retenu par sa sélection`);
    else if (rc.out[r.id] && !gcl.includes(r.id)) lines.push(`${nm(r.id)} abandon`);
  const top = gcl
    .slice(0, 3)
    .map((id, i) => `${i + 1}. ${nm(id)} (${mineIds.has(id) ? 'vous' : tOf[id] || '—'})`)
    .join(', ');
  // repérage du vivier par les équipes pros
  espScouting();
  const rec = {
    s: S.season,
    w: S.week,
    name: rc.name,
    tier: def.tier,
    top,
    mine: lines,
    notable,
    stages: rc.specs.length,
  };
  S.espHist = S.espHist || [];
  S.espHist.unshift(rec);
  if (S.espHist.length > 24) S.espHist.length = 24;
  msg(
    `Espoirs : ${rc.name}`,
    `Podium : ${top}.<br>Vos espoirs : ${lines.join(', ') || '—'}.${notable.length ? '<br>' + notable.join('<br>') : ''}`
  );
  return rec;
}
// Une équipe pro approche un espoir de l'académie après un résultat en vue.
function espApproach(r, rank) {
  if (r.approach) return;
  if (rnd() > (rank === 0 ? 0.45 : 0.25)) return;
  const T = pick(S.teams.filter(T => !T.player && T.riders.length < ROSTER.max));
  if (!T) return;
  r.approach = T.id;
  msg(
    `${riderName(r)} courtisé`,
    `<b>${T.name}</b> a approché ${riderName(r)} après son résultat. Passez-le pro avant la fin de saison, sinon il pourrait signer chez eux.`
  );
}
// Les équipes pros signent des pré-contrats avec les meilleurs jeunes du vivier en cours de saison.
function espScouting() {
  for (const id of S.youth) {
    const r = S.riders[id];
    if (!r || r.preAI != null || r.age < 18 || (r.espPts || 0) < 18) continue;
    if (rnd() > 0.12 + Math.min(0.25, (r.espPts - 18) / 100)) continue;
    const T = pick(S.teams.filter(T => !T.player && aiCanAfford(T, 40)));
    if (!T) continue;
    r.preAI = T.id;
    if (S.watch.includes(id) || (S.know[id] || 0) >= 40)
      msg(
        'Vivier',
        `${riderName(r)} (${r.age} ans), que vous suiviez, a signé un pré-contrat avec <b>${T.name}</b> : il y passera pro la saison prochaine.`
      );
  }
}
// Semaine de course espoirs (championnats nationaux : une course par nation représentée à l'académie).
function espWeekly() {
  const def = ESP_CAL.find(e => e.w === S.week);
  if (!def || !S.academy.length) return;
  if (def.tier === 'nat') {
    const nats = [...new Set(espEntrants('nat').map(r => r.nat))];
    for (const n of nats) runEspRace(def, n);
  } else runEspRace(def);
}
// Fin de saison de l'académie : stagiaires, approches, réputation, remise à zéro des compteurs.
function academyEndSeason() {
  for (const id of S.academy.slice()) {
    const r = S.riders[id];
    if (!r) continue;
    r.stag = null;
    if (r.approach != null) {
      const T = teamById(r.approach);
      const p = clamp(0.35 + r.amb / 220 - (mentorOf(r) ? 0.15 : 0) - r.moral / 450, 0.05, 0.85);
      if (T && T.riders.length < ROSTER.max && rnd() < p) {
        S.academy.splice(S.academy.indexOf(id), 1);
        r.aca = false;
        r.team = T.id;
        r.contract = 2;
        r.salary = Math.max(25, salaryFor(overall(r.s), r.age));
        r.neo = S.season + 1;
        T.riders.push(id);
        if (S.mentor) delete S.mentor[id];
        mercLog(r, 'neo', 0, T.id);
        addAcaRep(1); // un départ chez les pros fait aussi la réputation de l'académie
        msg('Académie', `${riderName(r)} quitte votre académie et passe professionnel chez <b>${T.name}</b>.`);
        continue;
      }
      r.approach = null;
    }
    r.espDays = 0;
    r.burnS = 0;
  }
  for (const id of S.youth) {
    const r = S.riders[id];
    if (r) r.espPts = 0;
  }
  // réputation : succès des anciens chez les pros, puis retour lent vers la moyenne
  const alumWins = sum((S.acaAlumni || []).map(a => (S.riders[a.id] ? S.riders[a.id].stats.wins || 0 : 0)));
  addAcaRep(Math.min(10, alumWins));
  S.acaRep = acaRep() * 0.85 + 25 * 0.15;
}
// Jeunes du vivier sous pré-contrat : ils rejoignent leur équipe pro en fin de saison.
function youthPreContracts() {
  for (const id of S.youth.slice()) {
    const r = S.riders[id];
    if (!r || r.preAI == null) continue;
    const T = teamById(r.preAI);
    r.preAI = null;
    if (!T || T.riders.length >= ROSTER.max) continue;
    S.youth.splice(S.youth.indexOf(id), 1);
    r.youth = false;
    r.team = T.id;
    r.contract = 2;
    r.salary = Math.max(25, salaryFor(overall(r.s), r.age));
    r.neo = S.season + 1;
    T.riders.push(id);
    mercLog(r, 'neo', null, T.id);
  }
}
// Anciens de l'académie : promotions, carrière chez les pros.
function alumniList() {
  return (S.acaAlumni || [])
    .map(a => ({ ...a, r: S.riders[a.id] }))
    .filter(a => a.r)
    .map(a => ({
      ...a,
      wins: (a.r.palm || []).filter(p => p.k === 1 && !/espoirs/i.test(p.e) && p.s > a.s - 1).length,
    }));
}
const ACA_MAX = 8;
// Génère un jeune du vivier.
function genYouthRider(age) {
  const arch = pick(Object.keys(ARCH));
  const r = genRider(arch, -9 + gauss() * 2.5, { age: age || rint(17, 19) });
  r.ceil = Math.round(clamp(70 + gauss() * 6.5 + (rnd() < 0.06 ? 9 : 0), 60, 92));
  r.youth = true;
  r.team = null;
  r.contract = 0;
  r.salary = 12;
  rollDev(r);
  return r;
}
// Ajoute n jeunes au vivier.
function genYouth(n) {
  for (let i = 0; i < n; i++) {
    const r = genYouthRider();
    S.riders[r.id] = r;
    S.youth.push(r.id);
    S.know[r.id] = 0;
  }
}
// Recrute un jeune du vivier dans l'académie.
function joinAcademy(id) {
  const r = S.riders[id];
  if (S.academy.length >= ACA_MAX) return `Académie complète (${ACA_MAX} places).`;
  if (S.budget < 15) return 'Budget insuffisant.';
  if (r.preAI != null) return `${riderName(r)} a déjà signé un pré-contrat avec ${teamShort(r.preAI)}.`;
  if (acaRefuses(r))
    return `${riderName(r)} préfère une académie plus réputée (la vôtre : ${acaRepLabel(acaRep()).toLowerCase()}).`;
  S.youth.splice(S.youth.indexOf(id), 1);
  r.youth = false;
  r.aca = true;
  r.team = 0;
  seedRelationsFor(id);
  r.contract = 0;
  r.salary = 12;
  r.training = 'normal';
  S.academy.push(id);
  S.budget -= 10;
  finAdd('aca', -10);
  S.know[id] = Math.max(S.know[id] || 0, 35);
  msg('Académie', `${riderName(r)} (${r.age} ans) rejoint votre académie.`);
  return null;
}
// Fait passer professionnel un coureur de l'académie.
function promoteRider(id) {
  const r = S.riders[id];
  const P = S.teams[0];
  if (P.riders.length >= ROSTER.max) return `Effectif pro complet (${ROSTER.max} max).`;
  if (r.age < 18) return 'Trop jeune pour passer professionnel (18 ans minimum).';
  S.academy.splice(S.academy.indexOf(id), 1);
  r.aca = false;
  r.stag = null;
  r.approach = null;
  if (S.mentor) delete S.mentor[id];
  (S.acaAlumni = S.acaAlumni || []).push({ id, s: S.season, age: r.age });
  r.neo = S.season;
  r.contract = 2;
  r.salary = Math.max(25, Math.round(salaryFor(overall(r.s), r.age) * 0.8));
  P.riders.push(id);
  S.objTrack = S.objTrack || {};
  S.objTrack.promo = true;
  imageOnPromotion();
  msg('Néo-pro', `${riderName(r)} passe professionnel dans votre équipe (2 ans, ${fmtMoney(r.salary)}/an).`);
  return null;
}
// Libère un jeune de l'académie.
function releaseAcademy(id) {
  const r = S.riders[id];
  S.academy.splice(S.academy.indexOf(id), 1);
  r.aca = false;
  r.stag = null;
  r.approach = null;
  if (S.mentor) delete S.mentor[id];
  r.team = null;
  S.youth.push(id);
  r.youth = true;
  return null;
}
