/* Simulation d'une étape en ligne (pas de 30 s) : création, boucle simStep, état des groupes, échappée du jour,
   événements de route (vent, pavés, routes étroites) et plans des équipes. Suite : 08b-decide, 08c-physics-tick. */
// Nouvelle simulation d'étape, avec sa propre série de hasard (voir stageSeed).
function newStageSim(rc) {
  const h = { sd: stageSeed(rc, rc.si) };
  const sim = withSeed(h, () => buildStageSim(rc));
  sim.sd = h.sd;
  return sim;
}
function buildStageSim(rc) {
  const spec = rc.specs[rc.si];
  const P = buildProfile(spec);
  const sim = {
    spec,
    P,
    dist: spec.dist,
    t: 0,
    groups: [],
    runners: [],
    log: [],
    done: false,
    gid: 1,
    teamLeader: {},
    teamSprinter: {},
    finish: [],
    klimbs: P.climbs.map(c => ({ ...c, order: [], done: false })),
    pauseReq: null,
    stageRace: rc.specs.length > 1,
    rc,
    carId: rc.carId == null ? null : rc.carId, // mode carrière : le seul coureur piloté par le joueur
  };
  // ordres IA
  rc.plan = rc.plan || {};
  for (const T of S.teams) {
    if (!T.player) {
      const o = autoOrders(T.id, spec, rc);
      Object.assign(rc.orders, o);
      rc.plan[T.id] = aiPlan(T, spec, rc);
    }
  }
  if (rc.worlds) applyWorldsWish(rc);
  if (rc.carId != null) carOrderHook(rc); // mode carrière : rôle demandé par le joueur
  for (const T of S.teams) {
    for (const id of rc.sel[T.id]) {
      if (rc.out[id]) continue;
      const r = S.riders[id];
      const ord = rc.orders[id] || { o: 'protect' };
      // la forme du jour varie davantage quand la fatigue s'accumule (troisième semaine) ; jours sans et maladie
      const fv = (r.trait === 'regulier' ? 2.5 : 6) * (1 + r.fatigue / 150);
      const sansJour = rc.specs.length > 1 && rnd() < 0.012 + r.fatigue / 2200;
      const x = {
        r,
        id,
        team: T,
        energy: rc.energy[id],
        dayForm: clamp(r.forme + gauss() * fv - (sansJour ? rf(7, 13) : 0) - (r.sick > 0 ? 6 : 0), 25, 100),
        sansJour,
        sansF: sansJour ? rf(0.93, 0.97) : 1,
        order: ord.o,
        att: ord.att || 'final',
        sat: !!ord.sat,
        itt: ord.itt || 'fond',
        radio: null,
        rebel: false,
        g: null,
        fin: false,
        dnf: false,
        time: 0,
        lastAtt: -99,
        work: 0,
        gr: 0,
        breakTried: false,
        player: rc.carId != null ? id === rc.carId : !!T.player, // mode carrière : seul le coureur du joueur
        gcStart: rc.gc[id],
        felt: false,
        waitCD: 0,
        pos: rf(25, 70),
        punch: 100,
        food: 100,
        bonk: false,
        pocket: 2,
        hungry: false,
        matches: 0,
        depl: false,
        conds: ((rc.conds && rc.conds[id]) || []).map(c => ({ ...c, done: false })),
        wet: spec.wx === 'pluie',
        markId: null,
        st: { kf: 0, kw: 0, att: 0, Is: 0, n: 0, cv: [], mx: 0, risk: 0, drop: null },
        eqf: applyGear(eqFactors(T), gearFor(T, rc, spec)),
        recon: !!T.player && reconDone(rc),
        wp: wPrime(r),
        wbal: wPrime(r),
        // champs renseignés en cours d'étape, déclarés ici pour que tous les coureurs aient la même forme
        // d'objet (le moteur JavaScript optimise mieux un code qui voit toujours les mêmes objets)
        frontUntil: undefined,
        aim: null,
        desLost: false,
        pen: 0,
        hc: undefined,
        alt: undefined,
        pw: undefined,
        I: undefined,
        ownPace: undefined,
        dropT: undefined,
        dropLog: undefined,
        waitLog: undefined,
        lastReply: undefined,
        cs: undefined,
        _surf: undefined,
        _early: undefined,
        _boxed: undefined,
        _lost: undefined,
      };
      sim.runners.push(x);
      if (x.order === 'leader') {
        sim.teamLeader[T.id] = x;
        if (T.player) {
          (rc.ledBy = rc.ledBy || []).push(id);
        }
      }
      if (x.order === 'sprint') sim.teamSprinter[T.id] = x;
    }
  }
  // obéissance initiale aux consignes d'avant-course (le coureur peut décider de courir pour lui)
  for (const x of sim.runners) {
    if (SUBORD.includes(x.order) && !obeyCheckPre(x, sim)) {
      x.rebel = true;
      x.r.stats.disob++;
      if (x.player)
        log(sim, `📻 ${riderName(x.r)} n'a visiblement pas l'intention de respecter sa consigne aujourd'hui…`, 'bad');
    }
  }
  const G = groupObj(
    sim.gid++,
    0,
    undefined,
    sim.runners.slice(),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined
  );
  for (const x of G.riders) x.g = G;
  sim.groups = [G];
  // favoris
  const key =
    spec.type === 'plat'
      ? 'spr'
      : spec.type === 'paves'
        ? 'pav'
        : spec.type === 'punch' || spec.type === 'vallonne'
          ? 'col'
          : 'mon';
  sim.favs = new Set(
    sim.runners
      .slice()
      .sort((a, b) => b.r.s[key] * b.dayForm - a.r.s[key] * a.dayForm)
      .slice(0, 10)
      .map(x => x.id)
  );
  jerseyAims(sim);
  if (rc.autoDS) sim.autoDS = true; // course confiée à l'adjoint
  sim.feedAt = spec.dist > 110 ? Math.round(spec.dist * 0.52) : 0;
  feedSetup(sim, rc, spec);
  if (sim.stageRace) sim.isp = { at: Math.round(spec.dist * (spec.isp || 0.55)), order: [], done: false };
  sim.wx = spec.wx || 'sec';
  if (sim.wx !== 'sec') log(sim, WX[sim.wx] + '.', 'info');
  if (P.wind && P.expoKm > 5)
    log(
      sim,
      `🌬️ Vent ${['', 'modéré', 'fort', 'violent'][P.wind]} annoncé : ${P.expoKm.toFixed(0)} km exposés, risque de bordures.`,
      'info'
    );
  sim.lastClimb = P.climbs.length ? P.climbs[P.climbs.length - 1] : null;
  sim.prevClimb = P.climbs.length > 1 ? P.climbs[P.climbs.length - 2] : null;
  sim.finClimb = finalClimbStart(sim);
  // échappée du jour : bagarre en début d'étape jusqu'à ce qu'un groupe de la taille « du jour » prenne le large
  sim.brkTarget = breakTarget(spec.type, rc.cat === 0);
  sim.brkState = 'fight';
  sim.finWind = P.wind >= 2 ? pick(['face', 'dos', 'travers']) : 'neutre';
  genWindAxis(sim, spec.dist, P.wind, sim.finWind);
  sim.windShift = P.wind ? { km: spec.dist * rf(0.35, 0.75), to: clamp(P.wind + pick([-1, 1]), 0, 3) } : null;
  log(
    sim,
    `Départ de ${spec.name}. ${P.climbs.length} difficulté(s) répertoriée(s)${P.sectors.length ? ', ' + P.sectors.length + ' secteurs pavés' : ''}.`,
    'info'
  );
  return sim;
}
// Ajoute une ligne au journal de course.
function log(sim, txt, cls) {
  sim.log.push({ t: sim.t, km: sim.groups.length ? sim.groups[0].pos : 0, txt, cls: cls || '' });
  if (sim.log.length > 400) sim.log.shift();
}
// Terrain à une position : [pente, pavés, exposition au vent].
function terrainAt(sim, pos) {
  const i = clamp(Math.floor(pos / STEP), 0, sim.P.n - 1);
  return [sim.P.g[i], sim.P.surf[i], sim.P.expo[i]];
}
// Consigne effective d'un coureur (radio ponctuelle, rébellion ou consigne d'avant course).
const RADIO_ACTS = new Set(['attack', 'bridge', 'reset']);
const ESCORT_ORD = new Set(['protect', 'leadout', 'control']);
function effOrder(x) {
  if (x.radio && !RADIO_ACTS.has(x.radio)) return x.radio;
  if (x.rebel) return 'free';
  return x.order;
}
// Écart en secondes entre deux groupes (distance / vitesse du groupe de derrière).
function gapSec(a, b) {
  return (Math.max(0, a.pos - b.pos) / Math.max(15, b.speed)) * 3600;
}
// Crée un groupe à partir de coureurs à une position donnée.
// Un groupe de coureurs ; tous les champs sont déclarés d'emblée pour que les groupes partagent la même forme d'objet.
function groupObj(id, pos, prev, riders, g, surf, prevSurf, expo, ahead) {
  return {
    id,
    pos,
    prev,
    riders,
    L: 50,
    speed: 40,
    burst: 0,
    burstL: 0,
    noMerge: 0,
    g,
    surf,
    prevSurf,
    expo,
    ahead,
    alt: undefined,
    attacker: undefined,
    dropped: undefined,
    nextSurf: undefined,
    nextClimb: undefined,
    narrow: undefined,
    prevNarrow: undefined,
  };
}
function newGroupFrom(sim, riders, pos) {
  const [tg, ts, tx] = terrainAt(sim, pos);
  const G = groupObj(sim.gid++, pos, pos, [], tg, ts, ts, tx, false);
  for (const x of riders) {
    moveTo(x, G);
  }
  sim.groups.push(G);
  return G;
}
// Fait passer un coureur dans un autre groupe.
function moveTo(x, G) {
  if (x.g) {
    const a = x.g.riders;
    const i = a.indexOf(x);
    if (i >= 0) a.splice(i, 1);
  }
  x.g = G;
  G.riders.push(x);
}
// Un pas de simulation = 30 secondes de course.
const DT_MIN = 0.5,
  DT_H = DT_MIN / 60;
// Un pas de 30 secondes : préparation, route, équipes, coureurs, physique, incidents, jonctions, passages.
function simTick(sim) {
  if (sim.done) return;
  if (sim.sd != null) withSeed(sim, () => simStep(sim));
  else simStep(sim);
}
function simStep(sim) {
  const live = tickPrepare(sim);
  tickRoadEvents(sim);
  const ctx = tickTeamPlans(sim, live);
  for (const x of shuffle(live.slice())) decideRider(sim, x, ctx);
  radioTick(sim);
  tickPhysics(sim);
  tickIncidents(sim, live);
  tickMerges(sim);
  tickCrossings(sim);
  finaleTick(sim);
  commentTick(sim);
  sim.t += DT_MIN;
  if (sim.runners.every(x => x.fin || x.dnf)) endStageSim(sim);
}
// Taille de l'échappée du jour selon le terrain : 2 à 5 coureurs sur le plat, 15 à 30 sur une étape de montagne
// d'un Grand Tour, où beaucoup d'équipes veulent placer un homme devant.
function breakTarget(t, gt) {
  if (t === 'plat') return rint(2, 5);
  if (t === 'montagne' || t === 'sommet') return gt ? rint(14, 30) : rint(7, 16);
  if (t === 'paves') return rint(5, 12);
  return rint(2, 7);
}
// Fin de la bagarre : l'échappée a la taille du jour et un petit écart, ou la course est trop avancée.
function breakUpdate(sim, pel) {
  if (sim.brkState !== 'fight') return;
  const F = sim.groups[0];
  // durée de la bagarre : longue en montagne (tout le monde veut y être), courte ailleurs
  const t = sim.spec.type;
  if (pel.pos > sim.dist * (t === 'montagne' ? 0.35 : t === 'sommet' ? 0.16 : 0.15)) sim.brkState = 'gone';
  else if (F !== pel && F.riders.length >= sim.brkTarget && gapSec(F, pel) >= 25) {
    sim.brkState = 'gone';
    sim.brkIds = new Set(F.riders.map(x => x.id));
    if (F.riders.length >= 3)
      log(
        sim,
        `🚀 L'échappée du jour est partie : ${F.riders.length} coureurs, le peloton relâche son effort.`,
        'info'
      );
  }
}
// Nettoyage des groupes, peloton de référence, terrain sous chaque groupe.
function tickPrepare(sim) {
  const live = sim.runners.filter(x => !x.fin && !x.dnf);
  sim.groups = sim.groups.filter(G => G.riders.some(x => !x.fin && !x.dnf));
  for (const G of sim.groups) G.riders = G.riders.filter(x => !x.fin && !x.dnf);
  sim.groups.sort((a, b) => b.pos - a.pos);
  // le peloton = le groupe principal qui contient le plus de favoris (pas forcément le plus gros : le gruppetto peut l'être)
  // un groupe composé surtout de l'échappée du jour n'est jamais « le peloton », même s'il contient des favoris
  const brkGroup = G => sim.brkIds && G.riders.filter(x => sim.brkIds.has(x.id)).length > G.riders.length / 2;
  const pelScore = G =>
    brkGroup(G) && sim.groups.length > 1
      ? -1
      : G.riders.length + (G.riders.length >= 10 ? 8 * G.riders.filter(x => sim.favs.has(x.id)).length : 0);
  // (score calculé une fois par groupe ; même choix qu'une comparaison deux à deux)
  const sc = new Map(sim.groups.map(G => [G, pelScore(G)]));
  const pel = sim.groups.reduce((a, b) => (sc.get(b) > sc.get(a) ? b : a));
  // équipes qui roulaient au tick précédent dans le peloton (pour l'attentisme des poursuivants)
  sim.chasingTeams = new Set(pel.riders.filter(x => x.work >= 0.75).map(x => x.team)).size;
  sim.pel = pel;
  breakUpdate(sim, pel);
  // règle des 3 km : sur une arrivée plate, les coureurs du peloton à 3 km de la ligne sont protégés au général
  if (sim.stageRace && !sim.pel3 && sim.P.finishGrad < 3 && sim.spec.type !== 'paves' && pel.pos >= sim.dist - 3)
    sim.pel3 = new Set(pel.riders.map(x => x.id));
  // trains de sprint à 3 km : nombre de poissons-pilotes encore frais par équipe
  if (!sim.trains3 && sim.P.finishGrad < 3 && pel.pos >= sim.dist - 3) {
    sim.trains3 = {};
    for (const x of pel.riders)
      if (effOrder(x) === 'leadout' && x.energy > 8) sim.trains3[x.team.id] = (sim.trains3[x.team.id] || 0) + 1;
  }
  for (const G of sim.groups) {
    G.ahead = G.pos > pel.pos + 0.03;
    const [g, surf, ex] = terrainAt(sim, G.pos);
    G.prevSurf = G.surf;
    G.g = g;
    G.surf = surf;
    G.expo = ex;
    G.short = !!sim.P.short[clamp(Math.floor(G.pos / STEP), 0, sim.P.n - 1)];
    G.nextSurf = false;
    // une difficulté commence dans les 3 km : on se bat pour être bien placé au pied
    G.nextClimb = sim.P.climbs.some(c => c.start > G.pos && c.start - G.pos < 3 && (c.len >= 2 || c.cat !== '4'));
    for (let k = 1; k <= 12; k++) {
      if (terrainAt(sim, G.pos + k * 0.25)[1]) {
        G.nextSurf = true;
        break;
      }
    }
    G.alt = sim.P.alt[clamp(Math.floor(G.pos / STEP), 0, sim.P.n - 1)];
    G.prevNarrow = G.narrow;
    G.narrow = !!(sim.P.narrow && sim.P.narrow[clamp(Math.floor(G.pos / STEP), 0, sim.P.n - 1)]);
    for (const x of G.riders) {
      x.gr = g;
      x.short = G.short;
      x.alt = G.alt;
    }
  }
  return live;
}
// Événements liés à la route : pavés, bordures, ravitaillement, sprint intermédiaire, commentaires.
function tickRoadEvents(sim) {
  const pel = sim.pel;
  // entrée dans un secteur pavé : les coureurs mal placés sont piégés
  for (const G of sim.groups.slice()) {
    if (G.surf && !G.prevSurf && G.riders.length >= 12) {
      const trapped = G.riders.filter(
        x => rnd() < clamp((45 - x.pos) / 45, 0, 1) * (1.15 - (x.r.s.pav || 60) / 100) * 0.9 * (x.recon ? 0.55 : 1)
      );
      if (trapped.length >= 2 && trapped.length < G.riders.length - 3) {
        const TG = newGroupFrom(sim, trapped, G.pos - rf(0.04, 0.12));
        TG.noMerge = 3;
        const mine = trapped.filter(x => x.player);
        if (mine.length || trapped.some(x => sim.favs.has(x.id)))
          log(
            sim,
            `🧱 Entrée de secteur pavé : ${trapped.length} coureurs mal placés sont piégés${mine.length ? ' dont ' + mine.map(x => riderName(x.r)).join(', ') : ''}.`,
            mine.length ? 'bad' : ''
          );
      }
    }
  }
  // descente technique : les moins bons descendeurs perdent le contact (quelques secondes, à combler ensuite)
  for (const G of sim.groups.slice()) {
    if (G.g > -4 || G.riders.length < 4 || sim.dist - G.pos < 1) continue;
    const tech = descentTech(sim, G.pos);
    if (tech < 0.5) continue;
    const best = Math.max(...G.riders.map(x => x.r.s.des || 68));
    const wet = sim.wx === 'pluie' ? 1.8 : 1;
    const lost = G.riders.filter(
      x =>
        !x.desLost &&
        best - (x.r.s.des || 68) > 8 &&
        rnd() < 0.05 * (tech - 0.3) * ((best - (x.r.s.des || 68) - 8) / 8) * wet * (x.recon ? 0.7 : 1)
    );
    if (lost.length && lost.length < G.riders.length) {
      for (const x of lost) x.desLost = true;
      const LG = newGroupFrom(sim, lost, G.pos - rf(0.05, 0.15) * (1 + tech));
      LG.noMerge = 3;
      if (lost.some(x => x.player || sim.favs.has(x.id)))
        log(
          sim,
          `⬇️ Descente technique : ${lost.map(x => riderName(x.r)).join(', ')} ${lost.length > 1 ? 'perdent' : 'perd'} le contact.`,
          lost.some(x => x.player) ? 'bad' : ''
        );
    }
  }
  // route étroite : les mal placés d'un gros groupe sont piégés derrière (quelques secondes, parfois plus)
  for (const G of sim.groups.slice()) {
    if (G.narrow && !G.prevNarrow && G.riders.length >= 30 && sim.dist - G.pos > 2) {
      const trapped = G.riders.filter(
        x => rnd() < clamp((35 - x.pos) / 35, 0, 1) * (1.1 - (x.r.s.plc || 65) / 100) * 0.6 * (x.recon ? 0.55 : 1)
      );
      if (trapped.length >= 3 && trapped.length < G.riders.length - 5) {
        const TG = newGroupFrom(sim, trapped, G.pos - rf(0.02, 0.06));
        TG.noMerge = 2;
        const mine = trapped.filter(x => x.player);
        if (mine.length || trapped.some(x => sim.favs.has(x.id)))
          log(
            sim,
            `🛣️ Route étroite : ${trapped.length} coureurs mal placés perdent le contact${mine.length ? ' dont ' + mine.map(x => riderName(x.r)).join(', ') : ''}.`,
            mine.length ? 'bad' : ''
          );
      }
    }
  }
  // le vent tourne en cours d'étape
  const ws = sim.windShift;
  if (ws && !ws.done && sim.groups[0] && sim.groups[0].pos >= ws.km) {
    ws.done = true;
    const from = sim.P.wind;
    sim.P.wind = ws.to;
    if (ws.to !== from) {
      const t =
        ws.to > from
          ? `Le vent forcit ${ws.to >= 2 ? ': attention aux bordures !' : '.'}`
          : 'Le vent faiblit, la course se calme.';
      commentLog(sim, t);
      if (ws.to >= 2 && ws.to > from) highlight(sim, '🌬️ ' + t);
    }
  }
  // bordures
  for (const G of sim.groups.slice()) {
    if (!G.expo || !sim.P.wind || G !== pel || G.riders.length < 30 || G.pos < 15 || sim.dist - G.pos < 3) continue;
    if (sim.echelonT && sim.t - sim.echelonT < 70) continue;
    const teams = [...new Set(G.riders.map(x => x.team))];
    for (const T of teams) {
      const mates = G.riders.filter(
        x => x.team === T && ['control', 'protect', 'leadout', 'free'].includes(effOrder(x)) && x.energy > 40
      );
      if (mates.length < 3) continue;
      const want =
        (sim.teamSprinter[T.id] || sim.teamLeader[T.id] ? 1 : 0.4) *
        styleMul(T, 'att') *
        (T.style === 'sprint' || T.style === 'gc' ? 1.2 : 1);
      if (sim.P.wind >= 2 && rnd() < 0.0011 * Math.pow(sim.P.wind, 1.6) * want) {
        echelon(sim, G, T);
        break;
      }
    }
  }
  // zone de ravitaillement
  if (sim.feedAt) {
    for (const G of sim.groups) {
      if (G.prev < sim.feedAt && G.pos >= sim.feedAt) {
        for (const x of G.riders) {
          const miss = (x.work > 0.88 || G.burst > 0) && rnd() < 0.4;
          if (miss) {
            if (x.player) log(sim, `🥤 ${riderName(x.r)} rate sa musette au ravitaillement !`, 'bad');
          } else x.food = Math.min(100, x.food + 42);
        }
      }
    }
  }
  if (sim.feedPts.length) for (const G of sim.groups) feedExtra(sim, G);
  // sprint intermédiaire
  if (sim.isp && !sim.isp.done) {
    for (const G of sim.groups) {
      if (G.prev < sim.isp.at && G.pos >= sim.isp.at) {
        const ord = jerseyOrder(G, 'pts', sim);
        for (const x of ord) if (sim.isp.order.length < 15) sim.isp.order.push(x.id);
      }
    }
    if (sim.isp.order.length >= 15 || sim.groups.every(G => G.pos >= sim.isp.at)) {
      sim.isp.done = true;
      sim.isp.order.forEach((id, i) => {
        sim.rc.pts[id] = (sim.rc.pts[id] || 0) + ISP_PTS[i];
      });
      const w = sim.runners.find(x => x.id === sim.isp.order[0]);
      if (w)
        log(
          sim,
          `🟢 Sprint intermédiaire (km ${sim.isp.at.toFixed(0)}) : ${riderName(w.r)} passe en tête.`,
          w.player ? 'me' : ''
        );
    }
  }

  /* ---- 0. commentaire ---- */
  if (sim.groups.length > 1) {
    const fr = sim.groups[0];
    const mk = Math.floor(fr.pos / 25);
    if (mk > (sim.lastCom || 0) && fr !== sim.pel && sim.dist - fr.pos > 3) {
      sim.lastCom = mk;
      log(
        sim,
        `📊 À ${Math.round(sim.dist - fr.pos)} km de l'arrivée : ${fr.riders.length === 1 ? riderName(fr.riders[0].r) + ' seul' : fr.riders.length + ' coureurs'} en tête, peloton à ${fmtGap(gapSec(fr, sim.pel))}.`,
        'info'
      );
    }
  }
}
// Décisions d'équipe : niveaux de poursuite, ressenti, consignes conditionnelles, DS auto, alliances.
// Clé numérique (groupe, équipe) pour les tables de poursuite : évite de fabriquer une chaîne à chaque lecture.
function ckey(G, T) {
  return G.id * 4096 + T.id;
}
function tickTeamPlans(sim, live) {
  const chase = new Map();
  // groupes devant chaque groupe et équipes qui y ont un coureur : calculés une fois pour toutes les équipes
  // (les niveaux de poursuite ne modifient pas les groupes)
  sim._ahead = new Map();
  sim._teamsAhead = new Map();
  const present = new Map(); // équipes présentes (coureurs en course) de chaque groupe
  for (const H of sim.groups) {
    const ts = new Set();
    for (const y of H.riders) if (!y.fin) ts.add(y.team);
    present.set(H, ts);
  }
  for (const G of sim.groups) {
    const ah = sim.groups.filter(H => H !== G && H.pos > G.pos + 0.03 && present.get(H).size);
    sim._ahead.set(G, ah);
    const ts = new Set();
    for (const H of sim.groups) if (H.pos > G.pos + 0.03) for (const T of present.get(H)) ts.add(T);
    sim._teamsAhead.set(G, ts);
  }
  for (const G of sim.groups) {
    const kmLeft = sim.dist - G.pos;
    const teams = new Set(G.riders.map(x => x.team));
    for (const T of teams) {
      chase.set(ckey(G, T), teamChaseLevel(sim, T, G, kmLeft));
    }
  }
  sim._ahead = sim._teamsAhead = null;
  allyTick(sim, chase);
  // ressenti des coureurs du joueur
  for (const x of live) {
    if (!x.felt && x.g.pos > Math.min(25, sim.dist * 0.15) && x.player) {
      x.felt = true;
      const d = x.dayForm - x.r.forme + gauss() * 3;
      const t = x.sansJour
        ? "n'a pas de jambes du tout aujourd'hui, c'est un jour sans 😩"
        : x.r.sick > 0
          ? 'est malade et se traîne 🤒'
          : d > 4
            ? 'se sent très bien 💪'
            : d > 1.5
              ? 'a de bonnes sensations'
              : d < -4
                ? 'a les jambes lourdes 😣'
                : d < -1.5
                  ? 'ne se sent pas au mieux'
                  : 'se sent normal';
      log(sim, `📻 ${riderName(x.r)} ${t}.`, 'me');
    }
  }
  // mode carrière : le joueur ne pilote que son coureur ; ses équipiers suivent le directeur sportif du club
  // « contrôlé par le joueur » : seulement un coureur à qui le joueur a donné un ordre qu'il n'a pas levé ; sinon
  // chacun court selon sa consigne et son jugement, comme dans les autres équipes
  for (const x of live) x.hc = !!x.manual && (sim.carId != null ? x.id === sim.carId : x.player);
  for (const x of live) {
    if (x.player && x.conds && x.conds.length) evalConds(sim, x);
  }
  if (Math.round(sim.t * 2) % 4 === 0)
    for (const T of S.teams) if (sim.runners.some(x => x.team === T && !x.fin && !x.dnf)) dsBrain(sim, T);
  const workersCount = new Map();
  for (const G of sim.groups) {
    const ch = [...new Set(G.riders.map(x => x.team))]
      .map(T => [T, chase.get(ckey(G, T))])
      .filter(a => a[1] && a[1][0] >= 0.84);
    if (ch.length >= 2) {
      ch.sort((a, b) => b[1][0] - a[1][0]);
      let tot = 0;
      for (const [T, c] of ch) {
        if (tot >= 7) {
          chase.set(ckey(G, T), [0, 0]);
        } else {
          tot += c[1];
        }
      }
      const key = ch
        .slice(0, 3)
        .map(a => a[0].id)
        .sort()
        .join('-');
      if (
        G === sim.pel &&
        sim.lastAlliance !== key &&
        sim.t - (sim.allianceT || -99) > 60 &&
        (sim.nAll = sim.nAll || 0) < 2
      ) {
        sim.nAll++;
        sim.lastAlliance = key;
        sim.allianceT = sim.t;
        log(
          sim,
          `🤝 Alliance de poursuite : ${ch
            .slice(0, 3)
            .map(a => a[0].short)
            .join(', ')} roulent ensemble.`,
          ''
        );
      }
    }
  }
  return { chase, workersCount, pel: sim.pel };
}
