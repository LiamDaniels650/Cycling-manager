/* Moments décisifs simulés au détail, en cours d'étape (pas seulement l'arrivée) : quand un groupe où roule un
   favori (ou un de mes coureurs) bascule au sommet d'un grand col — hors montée finale, jouée par finishGroup — ou
   sort d'un long secteur pavé, ses deux derniers kilomètres sont rejoués au détail avec la simulation des finals
   (climbRun : allures du jour, réserves, roues, attaques, lâchés). Les écarts obtenus au sommet font éclater le
   groupe : les coureurs distancés repartent derrière, à leur écart, et la course continue. Rejeu conservé
   (sim.momentTraces) pour le direct et le bilan d'étape. */

// Groupes passant un sommet ou une sortie de secteur ce pas-ci (appelé par tickCrossings, avant les points).
function decisiveSplit(sim) {
  // les moments retenus pour l'étape : le dernier grand col dans les 45 derniers km (hors montée finale) et les
  // deux derniers secteurs pavés difficiles (4 étoiles et plus) ; au plus quatre moments
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
    (sim.P.sectors || [])
      .filter(sc => sc.end < sim.dist - 3 && sc.end - sc.start >= 1.5 && (sc.stars || 3) >= 4)
      .sort((a, b) => b.end - a.end)
      .slice(0, 2)
      .forEach(sc => (sc.fineOk = true));
  }
  momentAsk(sim);
  if ((sim.momentTraces || []).length >= 4) return;
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
