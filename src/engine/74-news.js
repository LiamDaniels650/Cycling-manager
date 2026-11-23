/* Le monde du vélo raconté. Un fil d'actualité du peloton entier (vainqueurs des courses, blessures de coureurs en
   vue, inaugurations, directeurs remerciés, le point sur la saison), mêlé aux mouvements du mercato (26-mercato.js).
   Une rivalité : l'équipe la plus proche de la vôtre au classement devient votre rivale de la saison ; chaque course
   où vos deux équipes se retrouvent dans les dix premiers est un duel. Gagner les duels soude le groupe et plaît aux
   médias. Un classement des directeurs sportifs, le vôtre compris : ce que chacun tire de son équipe par rapport à
   ce qu'on en attendait, ses victoires, sa constance (score cumulé, les saisons anciennes comptent moins).
   Rien ici ne consomme le hasard de la partie. */

function newsAdd(c, txt) {
  if (S.car) return;
  S.news = S.news || [];
  S.news.unshift({ s: S.season, w: S.week, c, txt });
  if (S.news.length > 150) S.news.length = 150;
}
const NEWS_CAT = {
  course: { lbl: 'Course', ic: '🏁' },
  blessure: { lbl: 'Infirmerie', ic: '🩹' },
  mercato: { lbl: 'Mercato', ic: '🔁' },
  club: { lbl: 'Clubs', ic: '🏛️' },
  saison: { lbl: 'Saison', ic: '📈' },
  rival: { lbl: 'Rivalité', ic: '⚔️' },
};
// Le fil complet (actualité + mercato important), du plus récent au plus ancien.
function newsFeed(n = 60, cat = null) {
  const a = (S.news || []).map(e => ({ ...e }));
  for (const m of S.merc || [])
    if (m.imp && m.k !== 'rumeur')
      a.push({ s: m.s, w: m.w, c: 'mercato', txt: `${MERC_KIND[m.k] ? MERC_KIND[m.k].replace(/^\S+\s/, '') : m.k} : ${m.n} (${m.f} → ${m.t})`, my: m.my });
  return a
    .filter(e => !cat || e.c === cat)
    .sort((x, y) => y.s - x.s || y.w - x.w)
    .slice(0, n);
}
// Fin de course : le vainqueur, et le duel avec la rivale.
function newsAfterRace(rc, gcl) {
  if (S.car || rc.worlds) return;
  const w = S.riders[gcl[0]];
  if (w) {
    const T = teamOf(w);
    const gt = rc.cat === 0 && rc.specs.length >= 15;
    newsAdd('course', `${gt ? '🟡 ' : ''}${riderName(w)} (${T ? T.short : '—'}) remporte ${rc.name}${rc.specs.length > 1 ? ' au classement général' : ''}.`);
  }
  rivalDuel(rc, gcl);
}
// Blessure longue d'un coureur en vue d'une autre équipe.
function newsInjury(r, weeks) {
  if (S.car || r.team === 0 || r.team == null || weeks < 3 || !mercNotable(r)) return;
  const T = teamOf(r);
  newsAdd('blessure', `${riderName(r)} (${T ? T.short : '—'}) est arrêté ${weeks} semaines.`);
}
function newsWeekly() {
  if (S.car) return;
  rivalInit();
  // toutes les six semaines : le point sur la saison (meilleur coureur au classement UCI, équipe en tête)
  if (S.week % 6 === 0 && S.week > 0) {
    const top = Object.values(S.riders)
      .filter(r => !r.retired && r.team != null && r.stats && r.stats.pts > 0)
      .sort((a, b) => b.stats.pts - a.stats.pts)[0];
    const T0 = uciRanking()[0];
    if (top && T0)
      newsAdd('saison', `Le point : ${riderName(top)} (${teamOf(top) ? teamOf(top).short : '—'}) mène le classement individuel avec ${top.stats.pts} points ; ${T0.name} est en tête chez les équipes.`);
  }
}

// --- Rivalité ---
function rivalInit() {
  if (S.rival && S.rival.s === S.season && teamById(S.rival.id)) return S.rival;
  const P = S.teams[0];
  const pts = T => (S.lastRanks ? S.lastRanks[T.id] || 0 : 0) || (T.player ? 400 : T.tier * 100 + 300);
  const me = pts(P);
  const nat = clubNat();
  const ai = S.teams.filter(T => !T.player);
  const c = ai
    .map(T => [T, Math.abs(pts(T) - me) * (T.natBias === nat ? 0.7 : 1) * (S.rival && S.rival.id === T.id ? 0.8 : 1)])
    .sort((a, b) => a[1] - b[1])[0];
  if (!c) return null;
  const T = c[0];
  const same = S.rival && S.rival.id === T.id;
  S.rival = { id: T.id, s: S.season, me: 0, them: 0, heat: same ? Math.round((S.rival.heat || 0) * 0.6) : 10, last: null };
  newsAdd('rival', `${same ? 'La rivalité continue' : 'Nouvelle rivalité'} : ${P.name} contre ${T.name}${dsName(T) ? ` de ${dsName(T)}` : ''}.`);
  return S.rival;
}
function rivalTeam() {
  return S.rival ? teamById(S.rival.id) : null;
}
function rivalDuel(rc, gcl) {
  const V = rivalInit();
  if (!V) return;
  const top = gcl.slice(0, 10);
  const a = top.findIndex(id => S.riders[id] && S.riders[id].team === 0);
  const b = top.findIndex(id => S.riders[id] && S.riders[id].team === V.id);
  if (a < 0 || b < 0) return;
  const won = a < b;
  if (won) V.me++;
  else V.them++;
  V.heat = clamp(V.heat + (a === 0 || b === 0 ? 8 : 4), 0, 100);
  V.last = { s: S.season, w: S.week, race: rc.name, won };
  for (const id of S.teams[0].riders) {
    const r = S.riders[id];
    r.moral = clamp(r.moral + (won ? 1 : -1), 0, 100);
  }
  const T = rivalTeam();
  newsAdd('rival', `${rc.name} : ${won ? S.teams[0].name : T.name} prend le duel (${V.me}-${V.them} cette saison).`);
}
function rivalEndSeason() {
  const V = S.rival;
  const T = rivalTeam();
  if (!V || !T || V.s !== S.season || V.me + V.them === 0) return;
  const won = V.me > V.them;
  if (V.me !== V.them) addRep(won ? 2 : -1);
  press(
    won ? `${S.teams[0].name} a eu le dernier mot` : `${T.name} domine la rivalité`,
    `Bilan des duels de la saison entre ${S.teams[0].name} et ${T.name} : ${V.me}-${V.them}.`,
    0,
    []
  );
  newsAdd('rival', `Bilan de la rivalité ${S.teams[0].name}–${T.name} : ${V.me}-${V.them}.`);
  (S.rivalHist = S.rivalHist || []).unshift({ s: S.season, t: T.name, me: V.me, them: V.them });
  if (S.rivalHist.length > 15) S.rivalHist.length = 15;
}

// --- Classement des directeurs sportifs ---
function dsKey(T) {
  return T.player ? '__me' : dsName(T);
}
function dsRankUpdate(rankArr) {
  S.dsSc = S.dsSc || {};
  const exp = S.teams
    .slice()
    .sort((a, b) => ((S.lastRanks && S.lastRanks[b.id]) || b.tier * 100) - ((S.lastRanks && S.lastRanks[a.id]) || a.tier * 100));
  const seen = new Set();
  for (const T of S.teams) {
    const k = dsKey(T);
    if (!k) continue;
    seen.add(k);
    const d = exp.indexOf(T) - rankArr.indexOf(T);
    const v = d * 2 + seasonWins(T.id) * 0.8 + (rankArr.indexOf(T) < 3 ? 5 : 0);
    const o = S.dsSc[k] || { sc: 0, n: 0 };
    S.dsSc[k] = { sc: Math.round((o.sc * 0.6 + v) * 10) / 10, n: o.n + 1, t: T.id, prev: dsRankOf(k) };
  }
  // les directeurs partis sortent du classement
  for (const k of Object.keys(S.dsSc)) if (!seen.has(k)) delete S.dsSc[k];
}
function dsRanking() {
  const e = Object.entries(S.dsSc || {}).map(([k, v]) => ({ k, ...v, me: k === '__me', T: teamById(v.t) }));
  return e.filter(x => x.T).sort((a, b) => b.sc - a.sc);
}
function dsRankOf(k) {
  const i = dsRanking().findIndex(x => x.k === k);
  return i < 0 ? null : i + 1;
}
function newsEndSeason(rankArr) {
  if (S.car) return;
  rivalEndSeason();
  dsRankUpdate(rankArr);
  const rk = dsRankOf('__me');
  if (rk) newsAdd('saison', `Classement des directeurs sportifs : vous êtes ${rk === 1 ? '1er' : rk + 'e'} sur ${dsRanking().length}.`);
}
