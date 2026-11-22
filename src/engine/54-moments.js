/* Moments décisifs simulés au détail, en cours d'étape (pas seulement l'arrivée) : quand un groupe où roule un
   favori (ou un de mes coureurs) bascule au sommet d'un grand col — hors montée finale, jouée par finishGroup — ou
   sort d'un long secteur pavé, ses deux derniers kilomètres sont rejoués au détail avec la simulation des finals
   (climbRun : allures du jour, réserves, roues, attaques, lâchés). Les écarts obtenus au sommet font éclater le
   groupe : les coureurs distancés repartent derrière, à leur écart, et la course continue. Rejeu conservé
   (sim.momentTraces) pour le direct et le bilan d'étape. */

// Groupes passant un sommet ou une sortie de secteur ce pas-ci (appelé par tickCrossings, avant les points).
function decisiveSplit(sim) {
  // les moments retenus pour l'étape : le dernier grand col dans les 45 derniers km (hors montée finale) et sa
  // descente, l'avant-dernier col hors catégorie (80 derniers km), les deux derniers secteurs pavés difficiles
  // (4 étoiles et plus) ; au plus cinq moments (les bordures en plus)
  if (!sim.momentPlan) {
    sim.momentPlan = true;
    sim.klimbs
      .filter(
        c =>
          c.end < sim.dist - 3 &&
          c.end >= sim.dist - 45 &&
          (c.cat === 'HC' || c.cat === 1 || (c.len >= 4 && c.avg >= 6))
      )
      .sort((a, b) => b.end - a.end)
      .slice(0, 1)
      .forEach(c => {
        c.fineOk = true;
        sim.descMoment = descentAfter(sim, c);
      });
    // étape vallonnée ou de bosses d'une course par étapes : la dernière côte sérieuse (1 km et plus à 5 % et plus)
    // des 30 derniers km, hors arrivée, est rejouée elle aussi (c'est là que les puncheurs font la différence)
    if (sim.stageRace && (sim.spec.type === 'vallonne' || sim.spec.type === 'punch'))
      sim.klimbs
        .filter(c => !c.fineOk && c.len >= 1 && c.avg >= 5 && c.end < sim.dist - 3 && c.end >= sim.dist - 30)
        .sort((a, b) => b.end - a.end)
        .slice(0, 1)
        .forEach(c => (c.fineOk = true));
    // l'avant-dernier très grand col (hors catégorie, dans les 80 derniers km) : une attaque lointaine s'y joue aussi
    sim.klimbs
      .filter(c => !c.fineOk && c.cat === 'HC' && c.end < sim.dist - 10 && c.end >= sim.dist - 80)
      .sort((a, b) => b.end - a.end)
      .slice(0, 1)
      .forEach(c => (c.fineOk = true));
    // classique pavée d'un jour : les trois derniers secteurs de 3 étoiles et plus des 70 derniers km (la course s'y
    // joue secteur après secteur) ; ailleurs, les deux derniers secteurs difficiles (4 étoiles et plus)
    const oneDayPav = sim.rc.specs.length === 1 && sim.spec.type === 'paves';
    (sim.P.sectors || [])
      .filter(
        sc =>
          sc.end < sim.dist - 3 &&
          sc.end - sc.start >= 1.5 &&
          (sc.stars || 3) >= (oneDayPav ? 3 : 4) &&
          (!oneDayPav || sc.end >= sim.dist - 70)
      )
      .sort((a, b) => b.end - a.end)
      .slice(0, oneDayPav ? 3 : 2)
      .forEach(sc => (sc.fineOk = true));
  }
  momentAsk(sim);
  if ((sim.momentTraces || []).filter(m => m.kind !== 'bord').length >= 5) return;
  for (const G of sim.groups.slice().sort((a, b) => b.pos - a.pos)) {
    if (!(G.speed > 0) || G.prev == null) continue;
    const xs = G.riders.filter(x => !x.fin && !x.dnf);
    if (xs.length < 4 || !xs.some(x => sim.favs.has(x.id) || x.player)) continue;
    for (const c of sim.klimbs) {
      if (!c.fineOk || c.fineDone || !(G.prev < c.end && G.pos >= c.end)) continue;
      // seulement si la course se joue entre favoris : leur groupe en tête, ou à moins d'une minute de la tête
      const head = sim.groups.filter(H => H.riders.some(x => !x.fin)).sort((a, b) => b.pos - a.pos)[0];
      if (head && head !== G && gapSec(head, G) > 60) {
        c.fineDone = true;
        continue;
      }
      c.fineDone = true;
      c.momentRan = true;
      // les points du meilleur grimpeur se jouent dans la montée, avant l'accélération finale des favoris : les
      // grimpeurs qui les visent (et les équipiers qui mènent) passent devant les leaders, comme dans le groupe
      // d'avant l'éclatement
      c.preOrd = jerseyOrder(G, 'kom', sim, c).map(x => x.id);
      momentRun(sim, G, Math.min(2000, c.len * 1000), c.avg, 0, 'col', c.name, c.end, 'c' + c.name);
      break;
    }
    // la descente qui suit le col décisif, si elle est longue et raide
    const dm = sim.descMoment;
    if (dm && !dm.done && dm.c.momentRan && G.prev < dm.end && G.pos >= dm.end) {
      dm.done = true;
      const head = sim.groups.filter(H => H.riders.some(x => !x.fin)).sort((a, b) => b.pos - a.pos)[0];
      if (!head || head === G || gapSec(head, G) <= 60)
        momentRun(sim, G, Math.min(3000, dm.len * 1000), dm.avg, 0, 'desc', dm.name, dm.end, 'c' + dm.c.name);
    }
    for (const sc of sim.P.sectors || []) {
      if (!sc.fineOk || sc.fineDone || !(G.prev < sc.end && G.pos >= sc.end)) continue;
      sc.fineDone = true;
      momentRun(
        sim,
        G,
        Math.min(2000, (sc.end - sc.start) * 1000),
        1,
        sc.stars || 3,
        'pave',
        `secteur pavé ${'★'.repeat(sc.stars || 3)}`,
        sc.end,
        'p' + sc.start
      );
      break;
    }
  }
}
// Rejoue les L derniers mètres du groupe G au détail et le fait éclater selon les écarts au sommet.
function momentRun(sim, G, L, grad, surf, kind, name, km, key) {
  const xs = G.riders.filter(x => !x.fin && !x.dnf);
  const fg = kind === 'pave' ? 1 : kind === 'desc' ? grad : Math.max(grad, 3);
  // le choix du directeur (momentAsk) pour mon coureur
  const ch = (sim.momentChoice || {})[key];
  const me = ch ? xs.find(x => x.id === ch.id) : null;
  // les consignes : la mienne, et celles des directeurs adverses pour leurs favoris (aiMomentPlan)
  const plans = new Map();
  if (me) plans.set(me, ch.k);
  for (const x of xs)
    if (x !== me && !x.player && sim.favs.has(x.id) && !['protect', 'control', 'leadout'].includes(effOrder(x))) {
      const k = aiMomentPlan(sim, x, xs, kind, fg, surf);
      if (k) plans.set(x, k);
    }
  const ord = xs.map(x => {
    // en descente : l'adresse (cap en pente négative), plus de part de hasard (trajectoires, prise de risque)
    let s = cap(x, fg, surf) + gauss() * (kind === 'desc' ? 2 : 1.4);
    if (x.r.trait === 'gagneur') s += 0.5;
    if (['protect', 'control', 'leadout'].includes(effOrder(x))) s -= 3;
    const k = plans.get(x);
    if (k === 'devant') s += 1; // bien placé à l'entrée du secteur : pas piégé derrière une chute
    if (x === me && kind === 'desc' && k === 'desc') s += 1.2; // des forces gardées pour plonger à fond
    return [x, s];
  });
  const keep = new Map();
  for (const [x, k] of plans) {
    keep.set(x, { cp: x.climbPlan, fid: x.followId, _cp: x._cp, _cpR: x._cpRival });
    if (k === 'att' || k === 'plonge' || (kind === 'desc' && k === 'desc')) x.radio = 'attack';
    else if (k === 'roue' && kind !== 'desc') {
      const best = ord.filter(a => a[0] !== x).sort((a, b) => b[1] - a[1])[0];
      if (best) {
        x.climbPlan = 'follow';
        x.followId = best[0].id;
      }
    } else if ((k === 'desc' || k === 'abri') && kind !== 'desc') x._noAtt = true;
    else if (k === 'devant') x.energy = Math.max(0, x.energy - 2);
  }
  // la descente ne puise pas dans la réserve d'effort (W′), seulement dans l'adresse
  const wb = kind === 'desc' ? xs.map(x => x.wbal) : null;
  // (sur les pavés, l'aspiration compte peu : on la règle comme dans une forte pente)
  const T = climbRun(sim, ord, L, G.speed / 3.6, kind === 'pave' ? 6 : kind === 'desc' ? 5 : fg);
  if (wb) xs.forEach((x, i) => (x.wbal = wb[i]));
  for (const [x, o] of keep) {
    x.climbPlan = o.cp;
    x.followId = o.fid;
    x._cp = o._cp;
    x._cpRival = o._cpR;
    x._noAtt = false;
    if (x.radio === 'attack') x.radio = null;
  }
  // les consignes adverses, quand je suis dans le groupe
  if (xs.some(x => x.player)) {
    const LBL = {
      att: 'attaque',
      roue: 'prend les roues',
      desc: 'garde des forces',
      devant: 'frotte devant',
      plonge: 'plonge',
    };
    const said = [...plans].filter(([x]) => x !== me).slice(0, 3);
    if (said.length)
      log(
        sim,
        `🧑‍💼 Consignes adverses : ${said.map(([x, k]) => `${riderName(x.r)} ${LBL[k] || k}`).join(', ')}.`,
        'info'
      );
  }
  // chutes dans la descente : adresse, pluie, technicité, prise de risque (ceux qui plongent)
  const fell = [];
  if (kind === 'desc') {
    const wet = sim.wx === 'pluie';
    for (const x of xs) {
      const risk =
        0.005 *
        clamp(1 + (70 - (x.r.s.des || 68)) / 25, 0.6, 2.2) *
        (wet ? 2 : 1) *
        (0.6 + 0.8 * descentTech(sim, km - L / 2000)) *
        (plans.get(x) === 'plonge' || plans.get(x) === 'desc' ? 1.8 : 1);
      if (rnd() < risk) fell.push(x);
    }
  }
  const tr = sim._climbTrace;
  sim._climbTrace = null;
  if (tr && kind === 'desc')
    tr.events = tr.events.map(e => ({ ...e, txt: e.txt.replace(/^⚡ (.*) attaque à/, '⤵️ $1 plonge à') }));
  if (tr && fell.length)
    for (const x of fell)
      tr.events.push({ t: Math.round(T.get(x) * 0.5), txt: `💥 ${riderName(x.r)} chute dans la descente !` });
  if (tr) tr.events.sort((a, b) => a.t - b.t);
  // l'éclatement : un nouveau groupe dès que l'écart dépasse 4 s
  const sorted = xs.slice().sort((a, b) => T.get(a) - T.get(b));
  const t0 = T.get(sorted[0]);
  const clusters = [];
  let cur = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (T.get(sorted[i]) - T.get(sorted[i - 1]) > 4) {
      clusters.push(cur);
      cur = [];
    }
    cur.push(sorted[i]);
  }
  clusters.push(cur);
  for (const cl of clusters.slice(1)) {
    const gap = T.get(cl[0]) - t0;
    const NG = newGroupFrom(sim, cl, Math.max(0, G.pos - (G.speed * gap) / 3600));
    NG.noMerge = 2;
  }
  for (const x of fell) if (!x.dnf && !x.fin) incident(sim, x, 'chute');

  // récit : qui bascule en tête, avec quelle avance, combien de groupes
  const lead = sorted[0];
  const g2 = clusters.length > 1 ? T.get(clusters[1][0]) - t0 : 0;
  const where =
    kind === 'pave' ? `à la sortie du ${name}` : kind === 'desc' ? `au bas de la ${name}` : `au sommet de ${name}`;
  const ico = kind === 'pave' ? '🧱' : kind === 'desc' ? '⤵️' : '⛰️';
  const txt =
    clusters.length > 1
      ? `${ico} ${where}, ${riderName(lead.r)} (${lead.team.short}) passe en tête avec ${clusters[0].length === 2 ? 'un coureur dans sa roue' : clusters[0].length > 2 ? clusters[0].length - 1 + ' coureurs dans sa roue' : 'un petit écart'} : le groupe explose en ${clusters.length} morceaux (${fmtGap(g2)} pour le suivant).`
      : `${ico} ${where}, ${riderName(lead.r)} (${lead.team.short}) passe en tête, le groupe reste groupé.`;
  const mine = xs.some(x => x.player);
  log(sim, txt, mine ? 'me' : 'info');
  if (clusters.length > 1) highlight(sim, txt, mine);
  // bilan de la consigne pour mon coureur
  if (me) {
    const ci = clusters.findIndex(cl => cl.includes(me));
    const gap = Math.round(T.get(me) - t0);
    const res = ci === 0 ? (me === lead ? 'passe en tête' : 'est dans le bon groupe') : `concède ${gap} s`;
    log(sim, `📻 ${riderName(me.r)} ${res} ${where}.`, ci === 0 ? 'me' : 'bad');
    // « garde des forces » : s'il n'y a pas de descente jouée au détail, il relance dès le sommet
    if (ch.k === 'desc' && kind === 'col' && !(sim.descMoment && sim.descMoment.c.name === name))
      me.radio = ci === 0 ? 'attack' : 'bridge';
  }
  if (tr) {
    tr.win = txt;
    tr.endLbl = kind === 'pave' ? 'Sortie du secteur !' : kind === 'desc' ? 'Bas de la descente !' : 'Sommet !';
    (sim.momentTraces = sim.momentTraces || []).push({ name, kind, km: Math.round(km), tr });
    sim.liveMoment = { i: sim.momentTraces.length - 1, until: sim.t + 4 };
  }
}

// La descente qui suit un col : depuis le sommet, tant que la pente est sous -2,5 %. Retenue si elle fait au moins
// 3 km à -5 % de moyenne et finit à plus de 3 km de l'arrivée.
function descentAfter(sim, c) {
  const g = sim.P.g;
  let i = Math.round(c.end / STEP),
    n = 0,
    sum = 0;
  while (i + n < g.length && g[i + n] <= -2.5) sum += g[i + n++];
  const len = n * STEP,
    end = c.end + len;
  if (len < 3 || sum / n > -5 || end > sim.dist - 3) return null;
  return { c, end, len, avg: +(sum / n).toFixed(1), name: `descente de ${c.name}` };
}
// Avant un moment décisif, mon meilleur coureur du groupe appelle la voiture : à 3 km du sommet du col décisif, ou
// juste avant le secteur pavé décisif. Sans réponse, il choisit seul ; le DS automatique répond aussitôt.
function momentAsk(sim) {
  if (sim.ask || sim.carId != null) return;
  const mineG = sim.groups.filter(G => G.riders.some(x => x.player && !x.fin && !x.dnf));
  for (const G of mineG) {
    const xs = G.riders.filter(x => !x.fin && !x.dnf);
    if (xs.length < 4 || !xs.some(x => sim.favs.has(x.id) || x.player)) continue;
    const cand = (g, surf) =>
      xs
        .filter(x => x.player && !['protect', 'control', 'leadout'].includes(effOrder(x)))
        .map(x => [x, cap(x, g, surf)])
        .sort((a, b) => b[1] - a[1])[0];
    const relOf = (x, g, surf) => {
      let b = 0;
      for (const y of xs) if (y !== x) b = Math.max(b, cap(y, g, surf));
      return cap(x, g, surf) / (b || 1);
    };
    const remember = (key, x, k, lbl) => {
      (sim.momentChoice = sim.momentChoice || {})[key] = { k, id: x.id };
      log(sim, `📻 Consigne pour ${riderName(x.r)} : ${lbl}.`, 'me');
    };
    for (const c of sim.klimbs) {
      if (!c.fineOk || c.fineDone || !(G.pos >= c.end - 3.2 && G.pos < c.end - 1.5)) continue;
      const m = cand(c.avg, 0);
      if (!m) continue;
      const x = m[0];
      const rl = relOf(x, c.avg, 0);
      const desc = sim.descMoment && sim.descMoment.c === c;
      const opts = [
        ['att', '⚡ Attaque dans les 2 derniers km'],
        ['roue', '🎯 Accroche-toi à la roue du plus fort'],
        ['desc', desc ? '⤵️ Garde des forces, plonge dans la descente' : '🛡️ Garde des forces, relance au sommet'],
      ];
      const key = 'c' + c.name;
      askOpen(sim, {
        key: 'mom' + key,
        xid: x.id,
        txt: `📻 ${riderName(x.r)} : « On arrive au sommet de ${c.name} dans 3 km, ça va exploser. Je fais quoi ? »`,
        opts,
        def: 'roue',
        self: 'il reste dans les roues du plus fort.',
        auto: () => (rl > 1.01 ? 'att' : rl > 0.97 ? 'roue' : 'desc'),
        act: k => remember(key, x, k, (opts.find(o => o[0] === k) || opts[1])[1]),
      });
      return;
    }
    for (const sc of sim.P.sectors || []) {
      if (!sc.fineOk || sc.fineDone || !(G.pos >= sc.start - 3 && G.pos < sc.start - 0.5)) continue;
      const m = cand(1, sc.stars || 3);
      if (!m) continue;
      const x = m[0];
      const rl = relOf(x, 1, sc.stars || 3);
      const opts = [
        ['devant', '🧱 Frotte pour entrer devant'],
        ['att', '⚡ Attaque dans le secteur'],
        ['abri', '🛡️ Reste à l’abri, garde des forces'],
      ];
      const key = 'p' + sc.start;
      askOpen(sim, {
        key: 'mom' + key,
        xid: x.id,
        txt: `📻 ${riderName(x.r)} : « Secteur pavé ${'★'.repeat(sc.stars || 3)} dans ${Math.max(1, Math.round(sc.start - G.pos))} km. Je fais quoi ? »`,
        opts,
        def: 'devant',
        self: 'il frotte pour entrer devant.',
        auto: () => (rl > 1.02 ? 'att' : rl > 0.95 ? 'devant' : 'abri'),
        act: k => remember(key, x, k, (opts.find(o => o[0] === k) || opts[0])[1]),
      });
      return;
    }
  }
}
// Bordures au détail : quand le peloton entre dans une portion exposée au vent de côté, mes coureurs demandent s'il
// faut frotter pour être dans la première bordure (−3 d'énergie, devant si l'éventail se forme pendant 25 minutes)
// ou rester abrités. Un appel par étape au plus.
function echelonAsk(sim) {
  const pel = sim.pel;
  if (sim.ask || sim.carId != null || !pel || !pel.expo || (sim.P.wind || 0) < 2) return;
  if (pel.riders.length < 30 || pel.pos < 12 || sim.dist - pel.pos < 5) return;
  if ((sim.echAsks || 0) >= 1 || (sim.echelonT && sim.t - sim.echelonT < 70)) return;
  const mine = pel.riders.filter(x => x.player && !x.fin && !x.dnf);
  if (!mine.length) return;
  const key = 'ech' + Math.floor(pel.pos / 15);
  if ((sim.askMem || {})[key]) return;
  const imp = mine.filter(x => ['leader', 'sprint'].includes(effOrder(x)) || sim.favs.has(x.id));
  const ok = askOpen(sim, {
    key,
    txt: `📻 ${riderName((imp[0] || mine[0]).r)} : « Vent de côté (force ${sim.P.wind}), ça va frotter. On remonte devant ? »`,
    opts: [
      ['devant', '🌬️ Tout le monde devant, on ne se fait pas piéger'],
      ['abri', '🛡️ On reste abrités, on garde des forces'],
    ],
    def: 'devant',
    self: 'ils remontent devant.',
    auto: () => (sim.P.wind >= 3 || imp.length ? 'devant' : 'abri'),
    act: k => {
      if (k !== 'devant') return;
      for (const x of mine) {
        x.echFront = sim.t + 25;
        x.energy = Math.max(0, x.energy - 3);
      }
      log(sim, `🌬️ Vos coureurs remontent en tête du peloton, prêts pour la bordure.`, 'me');
    },
  });
  if (ok) sim.echAsks = (sim.echAsks || 0) + 1;
}

/* Bordure au détail, simulée seconde par seconde pendant 90 s. L'équipe T accélère, vent de côté : la largeur de la
   route n'offre l'abri de l'éventail qu'aux K premiers (16 à 32 coureurs selon le vent). L'ordre de départ vient du
   placement (position, frotteurs, équipiers de T, mes coureurs remontés devant). Chaque seconde, un coureur hors de
   l'éventail prend le vent de côté : s'il en a la force (puissance du jour au plat, énergie), il remonte et peut sauter
   dans la bordure ; sinon il recule. Ceux de l'éventail tiennent la roue (les rouleurs de T paient l'effort). Au bout
   de 90 s, la course se casse là où l'écart dépasse 4 m : deux ou trois groupes (deuxième bordure par grand vent).
   Les équipes dont le leader est piégé le ramènent (équipiers qui attendent). Rejeu de la vraie simulation. */
function echelonSplit(sim, G, T) {
  const sc = G.riders
    .filter(x => !x.fin && !x.dnf)
    .map(x => [
      x,
      x.pos +
        (x.r.s.plc || 65) * 0.35 +
        (x.team === T ? 40 : 0) +
        (x.r.s.pla - 70) * 0.4 +
        (x.echFront > sim.t ? 30 : 0) +
        gauss() * 14,
    ]);
  sc.sort((a, b) => b[1] - a[1]);
  const W = sim.P.wind || 2;
  const K = rint(16, 32) - (W >= 3 ? 3 : 0);
  if (sc.length < K + 5) return;
  const v = Math.max(10, G.speed / 3.6);
  // force du jour au plat (relative à la médiane de l'éventail), avec l'énergie qui reste
  const pw = x => cap(x, 0, 0) * (0.85 + 0.15 * Math.min(1, x.energy / 60));
  const ref =
    sc
      .slice(0, K)
      .map(a => pw(a[0]))
      .sort((a, b) => a - b)[Math.floor(K / 2)] || 1;
  const R_ = sc.map(([x], i) => ({ x, d: i * 1.6, k0: i, rel: pw(x) / ref }));
  const hist = [],
    ev = [];
  const jumped = new Set();
  for (let t = 0; t <= 90; t++) {
    R_.sort((a, b) => a.d - b.d);
    // la cassure apparaît dès que deux coureurs se suivent à plus de 4 m : l'éventail de derrière se reforme
    let lead = 0;
    R_.forEach((a, k) => {
      if (k && a.d - R_[k - 1].d > 4) lead = k;
      a.k = k - lead; // rang dans son propre éventail
      a.cut = lead;
    });
    for (const a of R_) {
      const x = a.x;
      const exposed = a.k >= K;
      if (!exposed) {
        // dans l'éventail : on tient la roue ; les rouleurs de T paient l'effort de tête
        if (x.team === T && a.k < 8) x.energy = Math.max(0, x.energy - 0.02);
        if (a.cut > 0 && t > 10) a.d += clamp((1.02 - a.rel) * 6, 0, 0.5); // l'éventail de derrière roule moins vite
        continue;
      }
      // hors de l'éventail, dans le vent de côté
      const need = 1 + 0.022 * W;
      if (a.rel > need && x.energy > 40 && t < 45) {
        a.d -= Math.min(1.2, (a.rel - need) * 25);
        x.energy = Math.max(0, x.energy - 0.06);
      } else a.d += clamp((need - a.rel) * 10 + (t > 8 ? 0.5 : 0), 0.1, 1.6);
    }
    hist.push(new Map(R_.map(a => [a, a.d])));
  }
  R_.sort((a, b) => a.d - b.d);
  const groups = [[R_[0]]];
  for (let k = 1; k < R_.length; k++) {
    if (R_[k].d - R_[k - 1].d > 4 && groups.length < 3) groups.push([]);
    groups[groups.length - 1].push(R_[k]);
  }
  // un groupe de moins de 5 coureurs rejoint celui de devant (personne ne roule seul dans le vent de côté)
  for (let g = groups.length - 1; g > 0; g--)
    if (groups[g].length < 5) {
      groups[g - 1].push(...groups[g]);
      groups.splice(g, 1);
    }
  if (groups.length < 2) return;
  for (const a of groups[0]) if (a.k0 >= K) jumped.add(a.x);
  const front = groups[0].map(a => a.x);
  const back = groups[1].map(a => a.x);
  const third = groups[2] ? groups[2].map(a => a.x) : [];
  const dAt = a => a.d - groups[0][0].d;
  const BG = newGroupFrom(sim, back, G.pos - Math.max(0.02, dAt(groups[1][0]) / 1000));
  BG.noMerge = 6;
  if (third.length) {
    const TG = newGroupFrom(sim, third, G.pos - Math.max(0.05, dAt(groups[2][0]) / 1000));
    TG.noMerge = 6;
  }
  sim.echelon = { T, until: sim.t + 20 };
  sim.echelonT = sim.t;
  // les équipes dont le leader (ou le sprinteur) est piégé : ses équipiers piégés avec lui roulent pour le ramener
  const trapped = back.concat(third);
  const rescue = [];
  for (const U of new Set(trapped.map(x => x.team))) {
    const ld = sim.teamLeader[U.id] || sim.teamSprinter[U.id];
    if (!ld || front.includes(ld) || ld.fin) continue;
    const mates = trapped.filter(y => y.team === U && y !== ld && y.energy > 35);
    if (mates.length >= 2) rescue.push([U, ld, mates.length]);
  }
  const mineB = trapped.filter(x => x.player),
    mineF = front.filter(x => x.player);
  log(
    sim,
    `🌬️ BORDURE ! ${T.name} met le peloton en éventail : ${front.length} devant, ${trapped.length} piégés derrière${third.length ? ' (deuxième bordure : trois groupes)' : ''}.${mineB.length ? ' Piégés : ' + mineB.map(x => riderName(x.r)).join(', ') + '.' : ''}${mineF.length ? ' Devant : ' + mineF.map(x => riderName(x.r)).join(', ') + '.' : ''}`,
    mineB.length ? 'bad' : 'att'
  );
  for (const x of [...jumped].filter(x => x.player || sim.favs.has(x.id)))
    log(sim, `🌬️ ${riderName(x.r)} saute dans la bordure à la force des jambes !`, x.player ? 'me' : 'info');
  for (const [U, ld, n] of rescue.slice(0, 2))
    log(sim, `🌬️ ${U.name} : ${n} équipiers roulent pour ramener ${riderName(ld.r)}.`, ld.player ? 'me' : 'info');
  if (sim.autoPause && (mineB.length || mineF.length)) sim.pauseReq = 'Bordure !';
  highlight(
    sim,
    `🌬️ BORDURE ! ${T.name} coupe le peloton : ${trapped.length} coureurs piégés.`,
    mineB.length || mineF.length
  );
  // rejeu : la vraie simulation, pour les premiers de chaque groupe et mes coureurs
  const pick = []
    .concat(groups[0].slice(0, 6), groups[0].filter(a => a.x.player).slice(0, 2))
    .concat(groups[1].slice(0, 4), groups[1].filter(a => a.x.player).slice(0, 2))
    .concat(groups[2] ? groups[2].slice(0, 2) : []);
  const ridersR = [...new Set(pick)];
  const L0 = 1350;
  ev.push({ t: 2, txt: `🌬️ ${T.name} accélère, vent de côté : l'éventail se forme.` });
  if (jumped.size)
    ev.push({ t: 15, txt: `💪 ${jumped.size} coureur${jumped.size > 1 ? 's sautent' : ' saute'} dans la bordure.` });
  ev.push({ t: 35, txt: `✂️ La cassure : ${trapped.length} coureurs piégés.` });
  if (third.length) ev.push({ t: 55, txt: `✂️ Deuxième bordure : le groupe piégé se casse à son tour.` });
  if (rescue.length)
    ev.push({ t: 75, txt: `🚴 ${rescue[0][0].name} organise la chasse pour ${riderName(rescue[0][1].r)}.` });
  const last = ridersR.map(a => L0 - v * 90 + a.d);
  const t0 = Math.min(...last);
  const tr = {
    dt: 1,
    from: L0,
    speed: 9,
    riders: ridersR.map((a, j) => ({
      id: a.x.id,
      n: riderName(a.x.r),
      t: a.x.team.short,
      c: a.x.team.color,
      me: !!a.x.player,
      gap: +(last[j] - t0).toFixed(1),
    })),
    frames: hist.map((m, t) => ridersR.map(a => Math.max(0, +(L0 - v * t + m.get(a)).toFixed(1)))),
    events: ev,
    win: `🌬️ ${front.length} coureurs dans la bonne bordure, ${trapped.length} piégés.`,
    endLbl: 'La cassure est faite !',
  };
  if (tr.frames.length > 10 && (sim.momentTraces || []).length < 8) {
    (sim.momentTraces = sim.momentTraces || []).push({
      name: `bordure de ${T.name}`,
      kind: 'bord',
      km: Math.round(G.pos),
      tr,
    });
    if (mineB.length || mineF.length) sim.liveMoment = { i: sim.momentTraces.length - 1, until: sim.t + 4 };
  }
}
/* Peloton nerveux : dans les 12 à 3 derniers km d'une arrivée pour sprinteurs, tout le monde veut être devant ; une
   touche de roues au milieu du peloton fait tomber plusieurs coureurs voisins (ceux qui étaient mal placés). Une
   chute collective au plus par étape, environ une étape plate sur six (plus sous la pluie ou par vent). */
function massCrashTick(sim) {
  const G = sim.pel;
  if (sim.massCrash || !G || sim.P.finishGrad >= 3 || G.g >= 3 || G.riders.length < 40) return;
  const kmL = sim.dist - G.pos;
  if (kmL > 12 || kmL < 3) return;
  const p = 0.006 * (sim.wx === 'pluie' ? 1.6 : 1) * ((sim.P.wind || 0) >= 2 ? 1.3 : 1);
  if (rnd() >= p) return;
  sim.massCrash = true;
  const live = G.riders.filter(x => !x.fin && !x.dnf);
  const mid = live.filter(x => x.pos > 25 && x.pos < 70);
  if (mid.length < 4) return;
  const piv = mid[Math.floor(rnd() * mid.length)];
  const n = rint(2, 4);
  const down = live
    .slice()
    .sort((a, b) => Math.abs(a.pos - piv.pos) - Math.abs(b.pos - piv.pos))
    .slice(0, n);
  const txt = `💥 Chute collective à ${Math.round(kmL)} km de l'arrivée, dans un peloton nerveux : ${down.map(x => riderName(x.r)).join(', ')} au sol.`;
  log(sim, txt, down.some(x => x.player) ? 'bad' : 'info');
  highlight(
    sim,
    txt,
    down.some(x => x.player)
  );
  for (const x of down) incident(sim, x, 'chute');
}

/* Sprint intermédiaire disputé : dans un groupe d'au moins 10 coureurs, les prétendants au maillot vert (ceux qui
   le visent, les cinq premiers du classement par points qui savent sprinter) sortent du groupe pour se disputer les
   points : vraie pointe de vitesse (forme et énergie du jour), effort payé (énergie, jus). Les autres suivent. */
function ispOrder(sim, G) {
  const ord = jerseyOrder(G, 'pts', sim);
  if (G.riders.length < 10) return ord;
  const rc = sim.rc;
  const cont = G.riders.filter(x => {
    if (x.fin || x.dnf || ['protect', 'control', 'leadout'].includes(effOrder(x))) return false;
    const k = jerseyRank(rc, rc.pts || {}, x.id);
    return x.aim === 'pts' || (k > 0 && k <= 5 && x.r.s.spr >= 72);
  });
  if (cont.length < 2) return ord;
  const sc = new Map(
    cont.map(x => [
      x,
      sprintPeak(x.r.s.spr) * (0.75 + 0.25 * Math.min(1, x.energy / 50)) +
        gauss() * 2.5 +
        // un poisson-pilote de l'équipe dans le groupe lance le sprint
        (G.riders.some(y => y.team === x.team && y !== x && effOrder(y) === 'leadout' && y.energy > 30) ? 1.5 : 0),
    ])
  );
  cont.sort((a, b) => sc.get(b) - sc.get(a));
  for (const x of cont) {
    x.energy = Math.max(0, x.energy - 2);
    x.punch = Math.max(0, x.punch - 15);
  }
  const head = G === sim.groups.slice().sort((a, b) => b.pos - a.pos)[0];
  if (cont.some(x => x.player) || cont.length >= 2)
    log(
      sim,
      `🟢 Bataille au sprint intermédiaire${head ? '' : ' du peloton'} : ${riderName(cont[0].r)} devance ${cont
        .slice(1, 3)
        .map(x => riderName(x.r))
        .join(' et ')}.`,
      cont.some(x => x.player) ? 'me' : 'info'
    );
  return cont.concat(ord.filter(x => !cont.includes(x)));
}

// Consigne d'un directeur adverse pour son favori au moment décisif : selon sa force du jour dans le groupe, sa
// place au général et le caractère du directeur. null : à l'instinct.
function aiMomentPlan(sim, x, xs, kind, fg, surf) {
  let b = 0;
  for (const y of xs) if (y !== x) b = Math.max(b, cap(y, fg, surf));
  const rl = cap(x, fg, surf) / (b || 1);
  const d = dsOf(x.team);
  if (kind === 'desc') return (x.r.s.des || 68) >= 74 && rl > 0.97 ? 'plonge' : null;
  if (kind === 'pave') return rl > 1.02 ? 'att' : 'devant';
  const gr = sim.stageRace && sim.rc.si > 0 ? leaderGcRank(sim.rc, x.id) : 0;
  if (gr === 1) return rl > 1.03 ? 'att' : 'roue'; // le maillot défend : il marque le plus dangereux
  if (rl > 1.01 && ((d && d.temper === 'rancunier') || x.team.style === 'agressif' || rl > 1.03)) return 'att';
  if (rl < 0.96) return 'desc';
  return null;
}

/* Zones dangereuses du final (arrivées pour sprinteurs) : deux ou trois ronds-points, rétrécissements ou îlots entre
   20 et 4 km de l'arrivée. Au passage du peloton (50 coureurs et plus), les chutes sont deux fois plus probables
   pour les mal placés, et la queue du peloton peut se faire couper (accordéon) : quelques secondes perdues. */
const DANGER_K = ['rond-point', 'rétrécissement', 'îlot directionnel'];
function dangerTick(sim) {
  const G = sim.pel;
  if (!G || sim.P.finishGrad >= 3 || sim.dist < 60) return;
  if (!sim.dangers) {
    // emplacements tirés d'une empreinte de l'étape : le hasard de la course n'est pas consommé
    const h = dsHash(sim.rc.key + '/' + sim.rc.si + '/' + S.season);
    const n = 2 + (h % 2);
    sim.dangers = Array.from({ length: n }, (_, i) => {
      const u = ((h >>> (4 + i * 7)) % 1000) / 1000;
      return { km: +(sim.dist - 4 - u * 16).toFixed(2), k: DANGER_K[(h >>> (i * 3)) % DANGER_K.length] };
    }).sort((a, b) => a.km - b.km);
  }
  for (const z of sim.dangers) {
    if (z.done || !(G.prev < z.km && G.pos >= z.km)) continue;
    z.done = true;
    if (G.riders.length < 50) continue;
    sim.dangerT = sim.t;
    if (rnd() >= 0.45) continue;
    const live = G.riders.filter(x => !x.fin && !x.dnf).sort((a, b) => a.pos - b.pos);
    const tail = live.slice(0, Math.max(4, Math.round(live.length * rf(0.06, 0.14))));
    const gap = rf(2, 6);
    const NG = newGroupFrom(sim, tail, Math.max(0, G.pos - (G.speed * gap) / 3600));
    NG.noMerge = 1;
    const mine = tail.filter(x => x.player);
    if (mine.length || tail.some(x => sim.favs.has(x.id)))
      log(
        sim,
        `⚠️ ${z.k[0].toUpperCase() + z.k.slice(1)} à ${Math.round(sim.dist - z.km)} km : l'accordéon coupe la queue du peloton (${tail.length} coureurs, ${Math.round(gap)} s)${mine.length ? ', dont ' + mine.map(x => riderName(x.r)).join(', ') : ''}.`,
        mine.length ? 'bad' : 'info'
      );
  }
}
