/* Rejeux des arrivées : la reconstitution du dernier kilomètre d'une victoire en solitaire (finishTrace, à partir
   des temps de passage), et les rejeux conservés pour le film de la saison (mes podiums, au plus 16, compactés). Lecture seule de l'étape : aucun tirage, la simulation n'en dépend pas. */

// Le dernier kilomètre d'une arrivée en côte ou en solitaire, reconstruit à partir des temps sur la ligne (sans
// tirage au sort : la course n'en est pas modifiée). Chaque coureur suit le vainqueur puis lâche prise assez tôt
// pour perdre son retard ; les poursuivants d'un échappé sont montés à leur écart, en bord gauche s'ils sont loin.
function finishTrace(sim, ph) {
  const fin = sim.finish,
    first = fin[0];
  if (!first) return null;
  const P = sim.P;
  const lc = P.climbs.filter(c => c.end >= sim.dist - 0.5).slice(-1)[0];
  const g = lc ? lc.avg : P.finishGrad || 0;
  const v = clamp(13 - 0.95 * Math.max(0, g), 4.5, 13); // m/s
  const from = 1000;
  const who = x => ({ id: x.id, n: riderName(x.r), t: x.team.short, c: x.team.color, me: !!x.player });
  const rs = [];
  if (ph.kind === 'seul') {
    rs.push({ ...who(first), D: 0 });
    const tNow = sim.t * 60; // le pas vient d'avancer l'horloge
    // poursuivants déjà arrivés dans le même pas (écart connu), puis groupes encore en course (écart estimé)
    const done = fin.filter(x => x !== first);
    if (done.length) {
      const D = done[0].time - first.time;
      const xs = done.filter(x => x.time - done[0].time < 1);
      rs.push({
        ...who(xs[0]),
        n: xs.length === 1 ? riderName(xs[0].r) : `Poursuivants (${xs.length})`,
        c: xs.length === 1 ? xs[0].team.color : '#94a3b8',
        me: xs.some(x => x.player),
        id: 'g9',
        D,
        lbl: fmtGap(D),
        np: xs.length === 1 ? riderName(xs[0].r) : 'les poursuivants',
        chase: true,
      });
    }
    sim.groups
      .filter(G => G.riders.some(x => !x.fin) && G.speed > 0)
      .sort((a, b) => b.pos - a.pos)
      .slice(0, 2 - rs.length + 1)
      .forEach((G, i) => {
        i += rs.length - 1;
        const xs = G.riders.filter(x => !x.fin);
        const D = ((sim.dist - G.pos) / G.speed) * 3600 + Math.max(0, tNow - first.time);
        const lead = xs.slice().sort((a, b) => overall(b.r.s) - overall(a.r.s))[0];
        rs.push({
          id: 'g' + i,
          n: xs.length === 1 ? riderName(lead.r) : `${i ? 'Groupe' : 'Poursuivants'} (${xs.length})`,
          t: xs.length === 1 ? lead.team.short : '',
          c: xs.length === 1 ? lead.team.color : '#94a3b8',
          me: xs.some(x => x.player),
          D,
          lbl: '≈ ' + fmtGap(D), // encore en course : écart estimé à cet instant
          est: true,
          np: xs.length === 1 ? riderName(lead.r) : i ? 'le groupe suivant' : 'les poursuivants',
          chase: true,
        });
      });
  } else {
    for (const o of ph.ord.slice(0, 8)) {
      const x = sim.runners.find(y => y.id === o.id);
      if (x) rs.push({ ...who(x), D: Math.max(0, x.time - first.time) });
    }
  }
  // distance à la ligne à l'instant t (0 = le vainqueur passe la ligne)
  for (const r of rs) {
    if (r.chase || r.D * v * 1.5 > 950) r.m = null;
    else r.m = r.D < 0.05 ? 0 : clamp(r.D * v * 2.5, 120, 950);
  }
  const dist = (r, t) => {
    if (r.m == null) return v * (r.D - t);
    if (!r.m) return Math.max(0, -v * t);
    const tm = -r.m / v,
      v2 = r.m / (r.m / v + r.D);
    return t <= tm ? -v * t : Math.max(0, r.m - v2 * (t - tm));
  };
  const dt = 0.5,
    t0 = -from / v,
    tEnd = Math.min(20, Math.max(2, ...rs.filter(r => !r.chase).map(r => r.D))) + 1;
  const frames = [];
  for (let t = t0; t <= tEnd + 1e-9; t += dt) frames.push(rs.map(r => +dist(r, t).toFixed(1)));
  const at = m => -m / v - t0; // temps de trace où le vainqueur est à m mètres
  const W = rs[0],
    S2 = rs[1];
  const ago = d => fmtGap(d).replace(/^\+/, ''); // « 1'04" d'avance »
  const agoR = r => (r.est ? 'environ ' : '') + ago(r.D);
  const nm = r => r.np || r.n;
  const events = [];
  const top = lc && lc.end >= sim.dist - 0.5 ? ` au sommet de ${lc.name}` : '';
  let win;
  if (ph.kind === 'seul') {
    events.push({
      t: 0,
      txt: S2
        ? `🚴 ${W.n} (${W.t}) seul en tête, ${agoR(S2)} d'avance sur ${nm(S2)} !`
        : `🚴 ${W.n} (${W.t}) seul en tête !`,
    });
    const cap = t => t[0].toUpperCase() + t.slice(1);
    if (S2 && S2.D < 10) {
      const pl = /^les /.test(nm(S2));
      events.push({ t: at(400), txt: `😬 ${cap(nm(S2))} revien${pl ? 'nent' : 't'} fort, il faut tenir !` });
      events.push({ t: at(80), txt: `💪 ${W.n} résiste jusqu'à la ligne !` });
    } else if (S2 && S2.D < 30) {
      events.push({ t: at(300), txt: `👀 ${W.n} se retourne : ${nm(S2)} à ${agoR(S2)} !` });
      events.push({ t: at(60), txt: `🙌 C'est gagné, ${W.n} peut savourer !` });
    } else {
      events.push({ t: at(300), txt: `👀 ${W.n} se retourne… personne en vue !` });
      events.push({ t: at(60), txt: `🙌 ${W.n} peut lever les bras !` });
    }
    win = `🏆 ${W.n} (${W.t}) s'impose en solitaire${top}${S2 ? `, ${agoR(S2)} devant ${nm(S2)}` : ''} !`;
  } else {
    if (S2 && S2.m) {
      events.push({
        t: at(S2.m),
        txt:
          S2.m > 200
            ? `⚡ ${W.n} (${W.t}) attaque à ${Math.round(S2.m / 10) * 10} m, ${S2.n} ne suit pas !`
            : `⚔️ Duel jusqu'à la ligne entre ${W.n} et ${S2.n} !`,
      });
    } else if (S2 && S2.D < 0.05) events.push({ t: at(150), txt: `⚔️ Coude à coude entre ${W.n} et ${S2.n} !` });
    for (const r of rs.slice(2))
      if (r.m && r.m > 200 && r.D >= 2 && r.D - S2.D >= 1)
        events.push({ t: at(r.m), txt: `💥 ${r.n} lâche prise à ${Math.round(r.m / 10) * 10} m.` });
    events.sort((a, b) => a.t - b.t);
    win = S2
      ? S2.D < 0.5
        ? `🏆 ${W.n} (${W.t}) s'impose${top}, dans le même temps que ${S2.n} !`
        : `🏆 ${W.n} (${W.t}) s'impose${top}, ${agoR(S2)} devant ${S2.n} !`
      : `🏆 ${W.n} (${W.t}) s'impose${top} !`;
  }
  // couloirs : ordre mélangé de façon fixe (l'ordre d'arrivée ne se devine pas), échappé en haut
  const lanes = rs
    .map((r, j) => [
      j,
      r.chase ? 1e9 + j : ph.kind === 'seul' ? -1 : ((String(r.id).length * 31 + j * 7919) % 97) + j * 0.01,
    ])
    .sort((a, b) => a[1] - b[1])
    .map(a => a[0]);
  return {
    dt,
    from,
    speed: (tEnd - t0) / 10, // une dizaine de secondes de retransmission
    riders: rs.map(r => ({ id: r.id, n: r.n, t: r.t, c: r.c, me: r.me, lbl: r.lbl, gap: r.D * v })),
    frames,
    events: events.map(e => ({ ...e, t: e.t })),
    lanes,
    win,
  };
}

// Rejeu de l'arrivée d'une étape terminée (celui du sprint ou de la côte simulés, sinon la reconstitution).
function stageReplay(sim) {
  const ph = sim && sim.photo;
  if (!ph) return null;
  const tr = ph.trace || (ph.kind === 'seul' || ph.kind === 'bosse' ? finishTrace(sim, ph) : null);
  return tr && tr.frames && tr.frames.length > 2 ? tr : null;
}
// Fin d'étape : un de mes coureurs sur le podium, son arrivée rejoint le film de la saison (au plus 24 rejeux :
// les victoires restent, les autres podiums laissent la place aux plus récents ; au plus 16).
function replayKeep(sim) {
  if (!S || S.car) return;
  const top = sim.finish
    .slice()
    .sort((a, b) => a.time - b.time)
    .slice(0, 3);
  const k = top.findIndex(x => x.player);
  if (k < 0) return;
  const tr = stageReplay(sim);
  if (!tr || tr.riders.filter(r => !r.lo).length < 2) return; // une arrivée disputée, pas un coureur seul
  const rc = sim.rc;
  // compact : au plus 120 images (le rejeu interpole entre elles), 10 coureurs plus les miens, au mètre près
  const step = Math.max(1, Math.ceil(tr.frames.length / 120));
  const keep = tr.riders.map((r, j) => j).filter(j => j < 10 || tr.riders[j].me);
  const frames = tr.frames.filter((f, i) => i % step === 0 || i === tr.frames.length - 1);
  const tc = {
    ...tr,
    dt: tr.dt * step,
    frames: frames.map(f => keep.map(j => Math.round(f[j]))),
    riders: keep.map(j => {
      const r = tr.riders[j];
      return { ...r, gap: r.gap == null ? null : Math.round(r.gap * 10) / 10 };
    }),
    lanes: tr.lanes ? tr.lanes.filter(j => keep.includes(j)).map(j => keep.indexOf(j)) : undefined,
  };
  S.replays = S.replays || [];
  S.replays.push({
    s: S.season,
    race: rc.name,
    stage: rc.specs.length > 1 ? sim.spec.name || '' : '',
    kind: sim.photo.kind,
    rk: k + 1,
    who: riderName(top[k].r),
    tr: tc,
  });
  while (S.replays.length > 16) {
    const i = S.replays.findIndex(e => e.rk > 1);
    S.replays.splice(i >= 0 ? i : 0, 1);
  }
}
