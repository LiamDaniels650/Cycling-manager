/* Journal de partie et étapes rejouables.
   Toutes les actions du joueur pendant une étape passent par liveAct(sim, a) : un petit objet (n = nature de
   l'action, et ses paramètres), exécuté dans la série de hasard de l'étape et noté avec l'instant de la course
   (sim.t) dans sim.rec. Avec l'état de la partie au départ de l'étape, cela suffit à rejouer l'étape à
   l'identique hors du jeu (tools/replay.js), pour retrouver la cause d'un défaut signalé par le joueur.
   Le journal (S.journal) garde, d'une session à l'autre, un fil court de la partie : départs et bilans d'étape
   de mes coureurs, ordres donnés, signalements. Lecture seule pour la simulation. */

const JOURNAL_MAX = 300;
function journalAdd(kind, txt, data) {
  if (!S) return;
  S.journal = S.journal || [];
  S.journal.push({ s: S.season, w: S.week, k: kind, txt, ...(data ? { d: data } : {}) });
  if (S.journal.length > JOURNAL_MAX) S.journal.splice(0, S.journal.length - JOURNAL_MAX);
}
// Une action du joueur pendant l'étape. Renvoie un texte à afficher (ou rien). Toujours dans la série de l'étape.
function liveAct(sim, a) {
  (sim.rec = sim.rec || []).push({ t: sim.t, ...a });
  return withSeed(sim, () => liveAct0(sim, a));
}
function liveAct0(sim, a) {
  const x = a.id != null ? sim.runners.find(y => y.id === a.id) : null;
  switch (a.n) {
    case 'ask': // réponse à une question de la radio ou à un moment décisif
      askAnswer(sim, a.k, 'me');
      return null;
    case 'nego': // négociation dans l'échappée
      if (a.k === 'break') {
        pactBreak(sim);
        return null;
      }
      return '🤝 ' + negoAsk(sim, a.k, a.y);
    case 'ally': // alliance de poursuite
      if (a.k === 'ask') return '🤝 ' + allyRequest(sim);
      if (a.k === 'break') allyBreak(sim);
      else allyDecide(sim, a.k);
      return null;
    case 'radio': // ordre radio à un coureur
      if (x && !x.fin && !x.dnf) applyRadio(sim, x, a.k, 'user');
      return null;
    case 'mark': // marquer un adversaire
      if (x && !x.fin && !x.dnf) markOrder(sim, x, a.tid);
      return null;
    case 'team': // ordre à toute l'équipe
      teamOrder(sim, a.k);
      return null;
    case 'final': // ordres de final (sprint, côte) : auto, ou plan choisi
      if (!x) return null;
      if (a.k === 'auto') finalAuto(sim, a.id, a.mode);
      else if (a.k === 'climb') climbOrder(sim, a.id, a.plan);
      else sprintOrder(sim, a.id, a.plan);
      return null;
  }
  return null;
}
// Marquer un adversaire (ordre radio).
function markOrder(sim, x, tid) {
  const nm = riderName(x.r);
  const tg = riderName(S.riders[tid]);
  if (obeyCheck(x, 'mark', sim)) {
    x.markId = tid;
    log(sim, `📻 → ${nm} : marque ${tg} — « ${radioReply(x, 'ok')} »`, 'me');
  } else log(sim, `📻 → ${nm} : marque ${tg} — « ${radioReply(x, 'no')} »`, 'bad');
}
// Ordre radio collectif à mes coureurs encore en course.
function teamOrder(sim, k) {
  const mine = sim.runners.filter(x => x.player && !x.fin && !x.dnf);
  if (k === 'echelon') {
    const e = tryEchelon(sim);
    if (e) log(sim, '📻 ' + e, 'bad');
    return;
  }
  let ok = 0,
    no = 0;
  for (const x of mine) {
    const eo = x.order;
    if ((k === 'chase' || k === 'stop') && (eo === 'leader' || eo === 'sprint')) continue;
    if (k === 'reset') {
      x.radio = null;
      x.frontUntil = 0;
      x.markId = null;
      x.manual = false;
      ok++;
      continue;
    }
    if (k === 'chase' && x.energy < 15) {
      no++;
      continue;
    }
    if (obeyCheck(x, k === 'front' ? 'tempo' : k, sim)) {
      if (k === 'front') x.frontUntil = sim.t + 20;
      else x.radio = k;
      x.manual = true;
      ok++;
    } else {
      no++;
      x.r.stats.disob++;
      (sim.refusals = sim.refusals || new Set()).add(x.id);
    }
  }
  const L = {
    chase: 'tout le monde roule',
    stop: 'on arrête de rouler',
    front: 'tout le monde se place devant',
    reset: 'retour aux consignes',
  };
  log(sim, `📻 → Équipe : ${L[k]} — ${ok} ok${no ? `, ${no} refus` : ''}.`, no ? 'bad' : 'me');
}
// Empreintes pour vérifier un rejeu : groupes de la course (position, effectif), résultat d'une étape (10 premiers).
function simCheck(sim) {
  return sim.groups.map(G => [Math.round(G.pos * 1000) / 1000, G.riders.length]);
}
function stageCheck(rc) {
  const st = rc.stageRes[rc.stageRes.length - 1];
  return st && st.res ? st.res.slice(0, 10).map(e => [e.id, Math.round(e.time * 10) / 10]) : null;
}
// Bilan d'une étape pour le journal : mes coureurs (place, écart) et l'évolution de mon meilleur au général.
function journalStage(rc, st, gc0) {
  if (!st || !st.res) return;
  const mine = st.res
    .map((e, k) => ({ e, k }))
    .filter(({ e }) => S.riders[e.id] && S.riders[e.id].team === 0)
    .slice(0, 4)
    .map(({ e, k }) => `${riderName(S.riders[e.id])} ${k + 1}e${e.gap ? ' +' + Math.round(e.gap) + ' s' : ''}`);
  let gc = '';
  if (rc.specs.length > 1) {
    const g = gcList(rc);
    const me = g.find(id => S.riders[id] && S.riders[id].team === 0);
    if (me != null) {
      const lost = gc0 && gc0[me] != null && gc0[g[0]] != null ? rc.gc[me] - rc.gc[g[0]] - (gc0[me] - gc0[g[0]]) : 0;
      gc = ` · général : ${riderName(S.riders[me])} ${g.indexOf(me) + 1}e à ${Math.round(rc.gc[me] - rc.gc[g[0]])} s (${lost >= 0 ? '+' : ''}${Math.round(lost)} s sur l'étape)`;
    }
  }
  journalAdd('etape', `${rc.name}, étape ${rc.si}/${rc.specs.length} : ${mine.join(', ') || '—'}${gc}`);
}
