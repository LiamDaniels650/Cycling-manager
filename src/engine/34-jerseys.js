/* Maillots de la montagne et des points : qui court pour quel maillot, et ordre de passage aux sommets et aux
   sprints intermédiaires. */

// --- Objectifs des échappés : maillots de la montagne et des points ---
// Rang d'un coureur dans un classement à points (1 = maillot), 0 s'il n'a aucun point.
function jerseyRank(rc, o, id) {
  if (!(o[id] > 0)) return 0;
  return classOrder(rc, o, 0.5).indexOf(+id) + 1;
}
// À la création d'une étape : qui court pour quel maillot (rx.aim = 'kom' ou 'pts').
function jerseyAims(sim) {
  const rc = sim.rc,
    t = sim.spec.type;
  const climbs = sim.klimbs.filter(c => c.cat === 'HC' || c.cat === 1 || c.cat === 2).length;
  for (const x of sim.runners) {
    x.aim = null;
    const kr = sim.stageRace ? jerseyRank(rc, rc.kom, x.id) : 0,
      pr = sim.stageRace ? jerseyRank(rc, rc.pts, x.id) : 0;
    const hunter = rc.komHunt && rc.komHunt[x.team.id] === x.id;
    if (x.order !== 'leader' && ((kr && kr <= 8) || hunter || (x.order === 'break' && x.r.s.mon >= 70)) && climbs >= 1)
      x.aim = 'kom';
    else if ((pr && pr <= 4 && x.r.s.spr >= 68) || (x.order === 'break' && x.r.s.spr >= 72 && t !== 'montagne'))
      x.aim = 'pts';
  }
}
// Le chasseur du maillot de la montagne repris par le peloton (ou distancé par l'échappée) se relève sur une étape
// de montagne : il garde ses forces pour l'échappée suivante et perd du temps au général, comme en vrai. Un chasseur
// bien placé au général (5 premiers) continue de jouer le classement.
function komSitUp(sim, x, G) {
  if (x.sitUp || x.player || !sim.stageRace || G !== sim.pel || x.order !== 'break') return x.sitUp;
  const t = sim.spec.type;
  if ((t !== 'montagne' && t !== 'sommet') || G.pos < sim.dist * 0.3 || sim.dist - G.pos < 5) return false;
  const rc = sim.rc;
  if (!rc.komHunt || rc.komHunt[x.team.id] !== x.id) return false;
  const gr = rc.si > 0 ? leaderGcRank(rc, x.id) : 0;
  if (gr && gr <= 5) return false;
  const gone = x.st.kf > 3 || sim.groups.some(H => H !== G && H.pos > G.pos && gapSec(H, G) > 150);
  if (gone) {
    x.sitUp = true;
    const kr = jerseyRank(rc, rc.kom, x.id);
    if (kr && kr <= 3)
      log(
        sim,
        `⛰️ ${riderName(x.r)} (${x.team.short}), ${kr === 1 ? 'maillot à pois' : kr + 'e de la montagne'}, se relève : il garde ses forces pour la prochaine échappée.`,
        ''
      );
  }
  return x.sitUp;
}
// Points de la montagne et sprint intermédiaire : ordre de passage dans un groupe (ceux qui visent le maillot
// se dépensent pour passer en tête).
function jerseyOrder(G, kind, sim, c) {
  // au sommet d'un col qui n'est pas l'arrivée, les leaders ne sprintent pas pour les points : passent en tête
  // ceux qui roulent devant (équipiers qui mènent) et les chasseurs de points
  const summitFinish = !c || c.end >= sim.dist - 0.5;
  const base =
    kind === 'kom'
      ? x =>
          cap(x, 6, 0) +
          (!summitFinish && effOrder(x) === 'leader' && x.aim !== 'kom' ? -12 : 0) +
          (x.work > 0.5 ? 3 : 0)
      : x => x.r.s.spr + x.pos * 0.1;
  const sc = new Map(G.riders.map(x => [x, base(x) + (x.aim === kind ? 9 : 0) + gauss() * (kind === 'kom' ? 1.5 : 3)]));
  const ord = G.riders.slice().sort((a, b) => sc.get(b) - sc.get(a));
  for (const x of ord.slice(0, 2)) if (x.aim === kind) x.punch = Math.max(0, x.punch - 12);
  return ord;
}
// Points d'un sommet selon la course et la catégorie (arrivée au sommet doublée sur le Tour).
function komPts(rc, c, summitFinish) {
  let sc = (KOM_GT[rc.key] || KOM_PTS)[c.cat] || KOM_PTS[c.cat];
  // réglage de jeu (grands tours) : les cols de passage valent 40 % de plus, pour que les chasseurs du maillot
  // échappés puissent rivaliser avec les favoris, qui ramassent les points des arrivées au sommet
  if (rc.cat === 0 && !summitFinish) sc = sc.map(v => Math.round(v * 1.4));
  return rc.key === 'gb' && summitFinish && (c.cat === 'HC' || c.cat === 1 || c.cat === 2) ? sc.map(v => v * 2) : sc;
}
