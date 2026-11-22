/* Héritage du directeur sportif, et événements montrés dans la retransmission vue du ciel.

   Héritage : chaque victoire rapporte des points de dynastie au directeur de l'équipe gagnante (vous, ou le
   directeur de l'ordinateur en poste) ; s'y ajoutent le podium UCI des équipes et les saisons en WorldTour. Un
   directeur de l'ordinateur remplacé (carrousel) entre au panthéon avec son score. Vos distinctions se lisent dans
   vos résultats (aucune donnée en plus) ; votre score et son évolution saison par saison sont gardés dans S.legacy.

   Événements du ciel : chutes, crevaisons, ennuis mécaniques, attaques, bordures, reprises, rangés dans sim.skyEv
   (lecture seule pour l'interface ; la simulation n'en dépend pas). */

// --- Événements montrés dans la vue du ciel ---
function skyEvent(sim, kind, x, G) {
  if (!sim || !G) return;
  const L = (sim.skyEv = sim.skyEv || []);
  L.push({ t: sim.t, km: G.pos, kind, id: x ? x.id : null, mine: !!(x && x.player), fav: !!(x && sim.favs.has(x.id)) });
  if (L.length > 40) L.shift();
}

// --- Points de dynastie ---
const LEG_PTS = {
  gt: 100, // classement général d'un grand tour
  gtStage: 10,
  gtJersey: 15,
  cat1Gc: 30, // course par étapes WorldTour
  cat1One: 40, // grande classique
  cat2: 6,
  stage: 3,
  uci: [25, 15, 10], // podium UCI des équipes en fin de saison
  wt: 5, // saison en WorldTour
};
function legacyInit() {
  if (!S.legacy) S.legacy = legacyBackfill();
  return S.legacy;
}
// Partie commencée avant l'héritage : le score se reconstruit à partir de vos résultats passés.
function legacyBackfill() {
  const L = { score: 0, hist: [], log: [] };
  const by = {};
  const add = (s, pts, txt) => {
    by[s] = (by[s] || 0) + pts;
    if (txt && pts >= 30) L.log.unshift({ s, txt, pts });
  };
  for (const p of myPalm()) {
    if (p.k !== 1) continue;
    const c = S.cal.find(c => c.name === p.r);
    if (!c || c.key === 'natio' || c.worlds) continue;
    const r = S.riders[p.rid];
    if (p.e === 'Classement général')
      add(p.s, c.cat === 0 ? LEG_PTS.gt : c.cat === 1 ? LEG_PTS.cat1Gc : LEG_PTS.cat2, `${p.r} : victoire au général (${riderName(r)})`);
    else if (p.e === 'Course') add(p.s, c.cat === 1 ? LEG_PTS.cat1One : LEG_PTS.cat2, `${p.r} : victoire (${riderName(r)})`);
    else if (/^Étape/.test(p.e)) add(p.s, c.cat === 0 ? LEG_PTS.gtStage : LEG_PTS.stage, '');
    else if (c.cat === 0 && (p.e === 'Maillot des points' || p.e === 'Meilleur grimpeur')) add(p.s, LEG_PTS.gtJersey, '');
  }
  for (const h of S.teamHist || []) if (h.rank <= 3) add(h.s, LEG_PTS.uci[h.rank - 1], '');
  for (const h of S.teamHist || []) {
    L.score += by[h.s] || 0;
    L.hist.push({ s: h.s, score: L.score, club: h.club });
  }
  L.score += by[S.season] || 0;
  L.log.sort((a, b) => b.s - a.s);
  L.log.length = Math.min(L.log.length, 40);
  return L;
}
function legCredit(teamId, pts, txt) {
  if (!pts || teamId == null) return;
  if (teamId === 0) {
    const L = legacyInit();
    L.score += pts;
    if (pts >= 30) {
      L.log.unshift({ s: S.season, txt, pts });
      if (L.log.length > 40) L.log.length = 40;
    }
    return;
  }
  const T = teamById(teamId);
  const d = T && !T.player ? dsOf(T) : null;
  if (d) {
    d.score = (d.score || 0) + pts;
    d.since = d.since || S.season;
  }
}
// Fin de course : victoires d'étapes, général, maillots, classiques.
function legacyAfterRace(rc) {
  if (S.car || rc.worlds || rc.key === 'natio') return;
  const multi = rc.specs.length > 1;
  const teamOfId = id => (S.riders[id] ? S.riders[id].team : null);
  const gcl = gcList(rc);
  const w = gcl[0];
  if (w == null) return;
  if (multi) {
    for (const st of rc.stageRes) legCredit(teamOfId(st.res[0].id), rc.cat === 0 ? LEG_PTS.gtStage : LEG_PTS.stage, '');
    const gp = rc.cat === 0 ? LEG_PTS.gt : rc.cat === 1 ? LEG_PTS.cat1Gc : LEG_PTS.cat2;
    legCredit(teamOfId(w), gp, `${rc.name} : victoire au général (${riderName(S.riders[w])})`);
    if (rc.cat === 0) {
      const top = o => classOrder(rc, o)[0];
      for (const id of [top(rc.pts), top(rc.kom)]) if (id != null) legCredit(teamOfId(+id), LEG_PTS.gtJersey, '');
    }
  } else {
    const p = rc.cat === 1 ? LEG_PTS.cat1One : LEG_PTS.cat2;
    legCredit(teamOfId(w), p, `${rc.name} : victoire (${riderName(S.riders[w])})`);
  }
}
// Fin de saison : podium UCI des équipes, saison en WorldTour, point d'étape de la courbe de dynastie.
function legacyEndSeason(rankArr) {
  if (S.car) return;
  rankArr.slice(0, 3).forEach((T, i) => legCredit(T.id, LEG_PTS.uci[i], i === 0 && T.player ? `Saison ${S.season} : première équipe au classement UCI` : ''));
  for (const T of S.teams) if (typeof isWT === 'function' && isWT(T.id)) legCredit(T.id, LEG_PTS.wt, '');
  const L = legacyInit();
  L.hist.push({ s: S.season, score: L.score, club: S.teams[0].name });
  if (L.hist.length > 60) L.hist.shift();
}
// Un directeur de l'ordinateur quitte son poste : il entre au panthéon.
function legacyRetireDs(T, d) {
  if (!d || !(d.score > 0)) return;
  (S.dsHall = S.dsHall || []).push({ n: `${d.fn} ${d.ln}`, team: T.name, score: Math.round(d.score), from: d.since || null, to: S.season });
  S.dsHall.sort((a, b) => b.score - a.score);
  if (S.dsHall.length > 30) S.dsHall.length = 30;
}
// Panthéon : directeurs en poste et retraités, et vous.
function legacyHall() {
  const L = legacyInit();
  const rows = [{ n: 'Vous', team: S.teams[0].name, score: Math.round(L.score), me: true, active: true }];
  for (const T of S.teams)
    if (!T.player) {
      const d = dsOf(T);
      rows.push({ n: `${d.fn} ${d.ln}`, team: T.name, score: Math.round(d.score || 0), me: false, active: true });
    }
  for (const h of S.dsHall || []) rows.push({ n: h.n, team: h.team, score: h.score, me: false, active: false });
  return rows.sort((a, b) => b.score - a.score);
}

// --- Vos distinctions (lues dans vos résultats) ---
function myPalm() {
  const out = [];
  for (const r of Object.values(S.riders)) for (const p of r.palm || []) if (p.my) out.push({ ...p, rid: r.id });
  return out;
}
function legacyBadges() {
  const P = myPalm();
  const cat = name => {
    const c = S.cal.find(c => c.name === name);
    return c ? c.cat : 2;
  };
  const wins = P.filter(p => p.k === 1);
  const gt = wins.filter(p => p.e === 'Classement général' && cat(p.r) === 0);
  const classics = wins.filter(p => p.e === 'Course' && cat(p.r) === 1);
  const gtStages = wins.filter(p => /^Étape/.test(p.e) && cat(p.r) === 0);
  const alumniWins = (S.acaAlumni || []).filter(a => (S.riders[a.id] && S.riders[a.id].palm || []).some(p => p.k === 1 && p.my)).length;
  const hist = S.teamHist || [];
  const top3 = hist.filter(h => h.rank <= 3).length;
  const B = [
    ['🏆', 'Premier grand tour', 'Remporter le classement général d’un grand tour', gt.length >= 1],
    ['👑', 'Faiseur de rois', 'Trois grands tours au palmarès', gt.length >= 3],
    ['🪨', 'Homme des classiques', 'Trois grandes classiques remportées', classics.length >= 3],
    ['🎯', 'Chasseur d’étapes', 'Dix étapes de grands tours', gtStages.length >= 10],
    ['🌱', 'Formateur', 'Trois anciens de votre académie vainqueurs sous vos couleurs', alumniWins >= 3],
    ['🥇', 'Numéro un', 'Terminer une saison première équipe au classement UCI', hist.some(h => h.rank === 1)],
    ['🏛️', 'Dynastie', 'Trois saisons sur le podium UCI des équipes', top3 >= 3],
    ['🔁', 'Bâtisseur', 'Dix saisons à la tête d’équipes', hist.length >= 10],
    ['🚀', 'De rien au sommet', 'Une saison dans le top 3 UCI après une saison hors du top 12', hist.some((h, i) => i > 0 && h.rank <= 3 && hist.slice(0, i).some(p => p.rank > 12))],
  ];
  return B.map(([ic, n, d, ok]) => ({ ic, n, d, ok }));
}
// Vos coureurs devenus légendes : ceux qui ont le plus gagné sous vos couleurs.
function legacyLegends() {
  const by = new Map();
  for (const p of myPalm()) {
    if (p.k !== 1) continue;
    const e = by.get(p.rid) || { id: p.rid, wins: 0, big: [] };
    e.wins++;
    const c = S.cal.find(c => c.name === p.r);
    if (c && c.cat <= 1 && (p.e === 'Classement général' || p.e === 'Course')) e.big.push(`${p.r} ${p.s}`);
    by.set(p.rid, e);
  }
  return [...by.values()].sort((a, b) => b.big.length - a.big.length || b.wins - a.wins).slice(0, 8);
}
