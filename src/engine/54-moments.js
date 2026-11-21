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
    // l'avant-dernier très grand col (hors catégorie, dans les 80 derniers km) : une attaque lointaine s'y joue aussi
    sim.klimbs
      .filter(c => !c.fineOk && c.cat === 'HC' && c.end < sim.dist - 10 && c.end >= sim.dist - 80)
      .sort((a, b) => b.end - a.end)
      .slice(0, 1)
      .forEach(c => (c.fineOk = true));
    (sim.P.sectors || [])
      .filter(sc => sc.end < sim.dist - 3 && sc.end - sc.start >= 1.5 && (sc.stars || 3) >= 4)
      .sort((a, b) => b.end - a.end)
      .slice(0, 2)
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
  const ord = xs.map(x => {
    // en descente : l'adresse (cap en pente négative), plus de part de hasard (trajectoires, prise de risque)
    let s = cap(x, fg, surf) + gauss() * (kind === 'desc' ? 2 : 1.4);
    if (x.r.trait === 'gagneur') s += 0.5;
    if (['protect', 'control', 'leadout'].includes(effOrder(x))) s -= 3;
    if (x === me && ch.k === 'devant') s += 1; // bien placé à l'entrée du secteur : pas piégé derrière une chute
    if (x === me && kind === 'desc' && ch.k === 'desc') s += 1.2; // des forces gardées pour plonger à fond
    return [x, s];
  });
  const keep = me ? { cp: me.climbPlan, fid: me.followId, _cp: me._cp, _cpR: me._cpRival } : null;
  if (me) {
    if (ch.k === 'att' || (kind === 'desc' && ch.k === 'desc')) me.radio = 'attack';
    else if (ch.k === 'roue' && kind !== 'desc') {
      const best = ord.filter(a => a[0] !== me).sort((a, b) => b[1] - a[1])[0];
      if (best) {
        me.climbPlan = 'follow';
        me.followId = best[0].id;
      }
    } else if ((ch.k === 'desc' || ch.k === 'abri') && kind !== 'desc') me._noAtt = true;
    else if (ch.k === 'devant') me.energy = Math.max(0, me.energy - 2);
  }
  // la descente ne puise pas dans la réserve d'effort (W′), seulement dans l'adresse
  const wb = kind === 'desc' ? xs.map(x => x.wbal) : null;
  // (sur les pavés, l'aspiration compte peu : on la règle comme dans une forte pente)
  const T = climbRun(sim, ord, L, G.speed / 3.6, kind === 'pave' ? 6 : kind === 'desc' ? 5 : fg);
  if (wb) xs.forEach((x, i) => (x.wbal = wb[i]));
  if (me) {
    me.climbPlan = keep.cp;
    me.followId = keep.fid;
    me._cp = keep._cp;
    me._cpRival = keep._cpR;
    me._noAtt = false;
    if (me.radio === 'attack') me.radio = null;
  }
  const tr = sim._climbTrace;
  sim._climbTrace = null;
  if (tr && kind === 'desc')
    tr.events = tr.events.map(e => ({ ...e, txt: e.txt.replace(/^⚡ (.*) attaque à/, '⤵️ $1 plonge à') }));
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

/* Bordure au détail. L'équipe T met le peloton en éventail : la largeur de la route ne laisse de l'abri qu'à 16 à
   32 coureurs (selon le vent). Le classement à la cassure vient du placement (position, frotteurs, équipiers de T,
   mes coureurs remontés devant) ; puis la lutte à la cassure : les coureurs juste derrière tentent de sauter dans la
   bordure (rouleurs puissants, encore frais) au prix d'un gros effort ; les équipes dont le leader est piégé le
   ramènent (équipiers qui attendent) ; par grand vent, le groupe piégé se casse lui-même en deuxième bordure.
   Rejeu reconstruit de la cassure (90 s), carte dans le bilan d'étape. */
function echelonSplit(sim, G, T) {
  const sc = G.riders.map(x => [
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
  let front = sc.slice(0, K).map(a => a[0]);
  let back = sc.slice(K).map(a => a[0]);
  if (back.length < 5) return;
  // la lutte à la cassure : les 10 premiers piégés tentent le saut
  const jumped = [],
    failed = [];
  for (const x of back.slice(0, 10)) {
    const pw = ((x.r.s.pla || 70) + (x.r.s.plc || 65)) / 2 + (x.energy - 60) * 0.3 + gauss() * 6;
    if (x.energy > 40 && pw > 74) {
      x.energy = Math.max(0, x.energy - 4);
      jumped.push(x);
    } else if (pw > 66) failed.push(x);
  }
  front = front.concat(jumped);
  back = back.filter(x => !jumped.includes(x));
  // deuxième bordure : le groupe piégé, long et exposé, se casse à son tour
  let third = [];
  if (W >= 3 && back.length >= 30 && rnd() < 0.5) {
    const K2 = rint(16, 26);
    third = back.slice(K2);
    back = back.slice(0, K2);
    if (third.length < 5) {
      back = back.concat(third);
      third = [];
    }
  }
  if (back.length < 5) return;
  const BG = newGroupFrom(sim, back, G.pos - 0.03);
  BG.noMerge = 6;
  if (third.length) {
    const TG = newGroupFrom(sim, third, G.pos - 0.07);
    TG.noMerge = 6;
  }
  sim.echelon = { T, until: sim.t + 20 };
  sim.echelonT = sim.t;
  // les équipes dont le leader (ou le sprinteur) est piégé : ses équipiers piégés avec lui roulent pour le ramener
  const rescue = [];
  for (const U of new Set(back.concat(third).map(x => x.team))) {
    const ld = sim.teamLeader[U.id] || sim.teamSprinter[U.id];
    if (!ld || front.includes(ld) || ld.fin) continue;
    const mates = back.concat(third).filter(y => y.team === U && y !== ld && y.energy > 35);
    if (mates.length >= 2) rescue.push([U, ld, mates.length]);
  }
  const trapped = back.concat(third);
  const mineB = trapped.filter(x => x.player),
    mineF = front.filter(x => x.player);
  log(
    sim,
    `🌬️ BORDURE ! ${T.name} met le peloton en éventail : ${front.length} devant, ${trapped.length} piégés derrière${third.length >= 5 ? ' (deuxième bordure : trois groupes)' : ''}.${mineB.length ? ' Piégés : ' + mineB.map(x => riderName(x.r)).join(', ') + '.' : ''}${mineF.length ? ' Devant : ' + mineF.map(x => riderName(x.r)).join(', ') + '.' : ''}`,
    mineB.length ? 'bad' : 'att'
  );
  for (const x of jumped.filter(x => x.player || sim.favs.has(x.id)))
    log(sim, `🌬️ ${riderName(x.r)} saute dans la bordure à la force des jambes !`, x.player ? 'me' : 'info');
  for (const [U, ld, n] of rescue.slice(0, 2))
    log(sim, `🌬️ ${U.name} : ${n} équipiers roulent pour ramener ${riderName(ld.r)}.`, ld.player ? 'me' : 'info');
  if (sim.autoPause && (mineB.length || mineF.length)) sim.pauseReq = 'Bordure !';
  highlight(
    sim,
    `🌬️ BORDURE ! ${T.name} coupe le peloton : ${trapped.length} coureurs piégés.`,
    mineB.length || mineF.length
  );
  // rejeu reconstruit : la cassure s'ouvre sur 90 s (1 m/s de moins pour les piégés, 1,6 m/s pour la 2e bordure)
  const v = Math.max(10, G.speed / 3.6);
  const pickF = front
    .slice(0, 6)
    .concat(front.filter(x => x.player && front.indexOf(x) >= 6))
    .slice(0, 8);
  const pickB = back
    .slice(0, 4)
    .concat(back.filter(x => x.player && back.indexOf(x) >= 4))
    .slice(0, 6);
  const pickT = third
    .slice(0, 2)
    .concat(third.filter(x => x.player && third.indexOf(x) >= 2))
    .slice(0, 3);
  const ridersR = [...pickF, ...pickB, ...pickT];
  if (ridersR.length < 4) return;
  const L0 = 1350;
  const start = new Map(),
    slow = new Map();
  ridersR.forEach((x, i) => {
    const k = pickF.includes(x) ? i : pickB.includes(x) ? K + (i - pickF.length) : K + 20 + i;
    start.set(x, L0 + k * 1.6);
    slow.set(x, pickF.includes(x) ? 0 : pickB.includes(x) ? 1 : 1.6);
  });
  const frames = [];
  const ev = [];
  for (let t = 0; t <= 90; t++) {
    frames.push(
      ridersR.map(x => {
        // les sauteurs : partis derrière, ils comblent l'écart dans les 25 premières secondes
        const jump = jumped.includes(x) && pickF.includes(x);
        const lag = jump ? Math.max(0, 1 - t / 25) * 1.2 : 0;
        const ramp = Math.min(1, t / 15);
        const d = start.get(x) - v * t + slow.get(x) * ramp * Math.max(0, t - 7.5) + lag * t * 0.4;
        return Math.max(0, +d.toFixed(1));
      })
    );
  }
  ev.push({ t: 2, txt: `🌬️ ${T.name} accélère, vent de côté : l'éventail se forme.` });
  if (jumped.length)
    ev.push({
      t: 12,
      txt: `💪 ${jumped.length} coureur${jumped.length > 1 ? 's sautent' : ' saute'} dans la bordure.`,
    });
  ev.push({ t: 30, txt: `✂️ La cassure : ${trapped.length} coureurs piégés.` });
  if (third.length >= 5) ev.push({ t: 50, txt: `✂️ Deuxième bordure : le groupe piégé se casse à son tour.` });
  if (rescue.length)
    ev.push({ t: 70, txt: `🚴 ${rescue[0][0].name} organise la chasse pour ${riderName(rescue[0][1].r)}.` });
  const last = frames[frames.length - 1];
  const t0 = Math.min(...last);
  const tr = {
    dt: 1,
    from: L0,
    speed: 9,
    riders: ridersR.map((x, j) => ({
      id: x.id,
      n: riderName(x.r),
      t: x.team.short,
      c: x.team.color,
      me: !!x.player,
      gap: +(last[j] - t0).toFixed(1),
    })),
    frames,
    events: ev,
    win: `🌬️ ${front.length} coureurs dans la bonne bordure, ${trapped.length} piégés.`,
    endLbl: 'La cassure est faite !',
  };
  if ((sim.momentTraces || []).length < 6) {
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
    cont.map(x => [x, sprintPeak(x.r.s.spr) * (0.75 + 0.25 * Math.min(1, x.energy / 50)) + gauss() * 2.5])
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
