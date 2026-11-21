/* Moments décisifs simulés au détail, en cours d'étape (pas seulement l'arrivée) : quand un groupe où roule un
   favori (ou un de mes coureurs) bascule au sommet d'un grand col — hors montée finale, jouée par finishGroup — ou
   sort d'un long secteur pavé, ses deux derniers kilomètres sont rejoués au détail avec la simulation des finals
   (climbRun : allures du jour, réserves, roues, attaques, lâchés). Les écarts obtenus au sommet font éclater le
   groupe : les coureurs distancés repartent derrière, à leur écart, et la course continue. Rejeu conservé
   (sim.momentTraces) pour le direct et le bilan d'étape. */

// Groupes passant un sommet ou une sortie de secteur ce pas-ci (appelé par tickCrossings, avant les points).
function decisiveSplit(sim) {
  for (const G of sim.groups.slice().sort((a, b) => b.pos - a.pos)) {
    if (!(G.speed > 0) || G.prev == null) continue;
    const xs = G.riders.filter(x => !x.fin && !x.dnf);
    if (xs.length < 4 || !xs.some(x => sim.favs.has(x.id) || x.player)) continue;
    for (const c of sim.klimbs) {
      if (c.fineDone || !(G.prev < c.end && G.pos >= c.end) || c.end >= sim.dist - 3) continue;
      if (!(c.cat === 'HC' || c.cat === 1 || (c.len >= 4 && c.avg >= 6))) continue;
      c.fineDone = true;
      momentRun(sim, G, Math.min(2000, c.len * 1000), c.avg, 0, 'col', c.name, c.end);
      break;
    }
    for (const sc of sim.P.sectors || []) {
      if (sc.fineDone || sc.end - sc.start < 1.5 || !(G.prev < sc.end && G.pos >= sc.end)) continue;
      if (sc.end >= sim.dist - 3) continue;
      sc.fineDone = true;
      momentRun(
        sim,
        G,
        Math.min(2000, (sc.end - sc.start) * 1000),
        1,
        sc.stars || 3,
        'pave',
        `secteur pavé ${'★'.repeat(sc.stars || 3)}`,
        sc.end
      );
      break;
    }
  }
}
// Rejoue les L derniers mètres du groupe G au détail et le fait éclater selon les écarts au sommet.
function momentRun(sim, G, L, grad, surf, kind, name, km) {
  const xs = G.riders.filter(x => !x.fin && !x.dnf);
  const fg = kind === 'pave' ? 1 : Math.max(grad, 3);
  const ord = xs.map(x => {
    let s = cap(x, fg, surf) + gauss() * 1.4;
    if (x.r.trait === 'gagneur') s += 0.5;
    if (['protect', 'control', 'leadout'].includes(effOrder(x))) s -= 3;
    return [x, s];
  });
  // (sur les pavés, l'aspiration compte peu : on la règle comme dans une forte pente)
  const T = climbRun(sim, ord, L, G.speed / 3.6, kind === 'pave' ? 6 : fg);
  const tr = sim._climbTrace;
  sim._climbTrace = null;
  // l'éclatement : un nouveau groupe dès que l'écart dépasse 3 s
  const sorted = xs.slice().sort((a, b) => T.get(a) - T.get(b));
  const t0 = T.get(sorted[0]);
  const clusters = [];
  let cur = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (T.get(sorted[i]) - T.get(sorted[i - 1]) > 3) {
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
  const where = kind === 'pave' ? `à la sortie du ${name}` : `au sommet de ${name}`;
  const txt =
    clusters.length > 1
      ? `${kind === 'pave' ? '🧱' : '⛰️'} ${where}, ${riderName(lead.r)} (${lead.team.short}) passe en tête avec ${clusters[0].length > 1 ? clusters[0].length - 1 + ' coureur(s) dans sa roue' : 'un petit écart'} : le groupe explose en ${clusters.length} morceaux (${fmtGap(g2)} pour le suivant).`
      : `${kind === 'pave' ? '🧱' : '⛰️'} ${where}, ${riderName(lead.r)} (${lead.team.short}) passe en tête, le groupe reste groupé.`;
  const mine = xs.some(x => x.player);
  log(sim, txt, mine ? 'me' : 'info');
  if (clusters.length > 1) highlight(sim, txt, mine);
  if (tr) {
    tr.win = txt;
    tr.endLbl = kind === 'pave' ? 'Sortie du secteur !' : 'Sommet !';
    (sim.momentTraces = sim.momentTraces || []).push({ name, kind, km: Math.round(km), tr });
    sim.liveMoment = { i: sim.momentTraces.length - 1, until: sim.t + 4 };
  }
}
