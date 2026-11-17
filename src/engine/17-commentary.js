/* Commentateur, moments forts et réponses radio selon le caractère.
   Aucune de ces fonctions n'utilise le hasard de la simulation (rnd) : le commentaire ne change jamais la course. */

// Choix « aléatoire » déterministe, sans toucher au générateur de la course.
function cpick(arr, salt) {
  let h = Math.floor(salt * 7919) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return arr[Math.abs(h ^ (h >>> 15)) % arr.length];
}
// Ligne du commentateur dans le journal de course.
function commentLog(sim, txt) {
  log(sim, '🎙️ ' + txt, 'com');
}
// Moment fort : bandeau à l'écran (et éventuelle pause).
function highlight(sim, txt, mine) {
  const km = sim.groups && sim.groups[0] ? Math.round(Math.min(sim.dist, sim.groups[0].pos)) : null;
  (sim.hls = sim.hls || []).push({ t: sim.t, km, txt, mine: !!mine });
}

// Réponse radio d'un coureur selon son caractère et son état. kind : 'ok' | 'no' | 'legs'.
const REPLIES = {
  ok: {
    modele: ['Bien reçu, chef !', "Pas de souci, je m'en occupe.", 'Comptez sur moi.'],
    tete: ["Enfin ! J'y vais !", 'Avec plaisir, ça me démangeait !', "C'est parti, accrochez-vous !"],
    leaderne: ["Ok… mais c'est la dernière fois.", 'Reçu. On en reparlera ce soir.', 'Si vous le dites…'],
    opportuniste: ["Ok, mais si ça s'ouvre, je tente ma chance.", 'Reçu, je garde un œil sur le coup.'],
    fragile: ["D'accord… je vais essayer.", "Ok, j'espère que les jambes suivront."],
    regulier: ['Reçu.', 'Compris, je fais ça.'],
    gagneur: ['Reçu ! On va la gagner celle-là.', 'Ok, je suis prêt.'],
    aucun: ['Bien reçu !', "Ok, j'y vais.", 'Compris, chef.', 'Reçu 5 sur 5.', 'Ça marche.'],
  },
  no: {
    tete: ['Non ! Je ne vais pas rester planqué toute la journée !', 'Pas question, je pars !'],
    leaderne: ["Non. Aujourd'hui, c'est moi le plus fort.", 'Je ne roule pas pour lui, désolé.'],
    opportuniste: ["Désolé, c'est le moment ou jamais pour moi.", 'Non, je joue ma carte.'],
    fragile: ['Je… je ne peux pas, désolé.', "Je ne le sens pas du tout aujourd'hui."],
    aucun: ["Non, je joue ma carte aujourd'hui.", 'Désolé, je ne le sens pas.', "Pas maintenant, c'est trop tôt."],
  },
  legs: {
    fragile: ['Je suis mort… vraiment désolé.', "Je n'en peux plus, je craque."],
    gagneur: ["Je suis à bloc, mais je m'accroche !", "Plus rien dans les jambes… pour l'instant."],
    aucun: ["Je n'ai plus les jambes…", 'Impossible, je suis à bloc.', 'Je suis cuit, désolé.'],
  },
};
// Réponse radio d'un coureur selon son caractère.
function radioReply(x, kind) {
  const set = REPLIES[kind] || REPLIES.ok;
  const list = set[x.r.trait] || set.aucun;
  return cpick(list, (x.id || 1) * 13 + (x.lastReply = (x.lastReply || 0) + 1));
}

// Points d'annonce du commentateur (km de l'arrivée).
const COM_MARKS = [100, 60, 40, 25, 15, 10, 5, 3];
// Commentaire de la course à chaque pas : écarts, pied du dernier col, flamme rouge.
function commentTick(sim) {
  const front = sim.groups[0];
  if (!front || sim.done) return;
  const pel = sim.pel;
  const kmLeft = sim.dist - front.pos;
  // historique des écarts (graphique de la retransmission), un point par kilomètre
  const H = (sim.gapHist = sim.gapHist || []);
  const kmNow = Math.floor(Math.min(front.pos, sim.dist));
  if (!H.length || H[H.length - 1].km < kmNow) {
    const gap = front !== pel && pel ? gapSec(front, pel) : 0;
    H.push({ km: kmNow, gap: Math.round(gap), n: front.riders.length });
    // un coureur du joueur lâché puis revenu en tête : ce lâché n'explique plus son résultat
    for (const x of sim.runners)
      if (x.player && x.st.drop && x.g === front && sim.t - x.st.drop.t > 1) x.st.drop = null;
    // qui roule derrière l'échappée (un relevé par km, pour expliquer sa reprise ou sa réussite)
    if (front !== pel && pel) {
      const T = (sim.chaseTally = sim.chaseTally || {});
      for (const y of pel.riders) if (y.work > 0) T[y.team.short] = (T[y.team.short] || 0) + 1;
    }
  }
  sim.com = sim.com || { marks: {}, lastT: -99 };
  const C = sim.com;
  const salt = sim.t;
  // situation de course aux points clés
  for (const m of COM_MARKS) {
    if (C.marks[m] || kmLeft > m || sim.dist < m + 8) continue;
    C.marks[m] = true;
    commentLog(sim, situationText(sim, front, pel, kmLeft, salt));
    break;
  }
  // pied de la dernière ascension
  const lc = sim.lastClimb;
  if (lc && lc.len >= 2 && !C.footDone && front.pos >= lc.start) {
    C.footDone = true;
    const txt = `Pied de ${lc.name} : ${lc.len} km à ${String(lc.avg).replace('.', ',')} %. ${cpick(["C'est ici que tout va se jouer !", 'Les favoris vont devoir abattre leurs cartes.', 'Le juge de paix de la journée.'], salt)}`;
    commentLog(sim, txt);
    highlight(sim, '⛰️ ' + txt);
  }
  // flamme rouge
  if (!C.flamme && kmLeft <= 1) {
    C.flamme = true;
    const who =
      front.riders.length <= 3
        ? front.riders.map(x => riderName(x.r)).join(', ')
        : `un groupe de ${front.riders.length}`;
    const txt = `Flamme rouge ! ${front === pel ? 'Le peloton est groupé, place au final !' : who + ' en tête.'}`;
    commentLog(sim, txt);
    highlight(
      sim,
      '🚩 ' + txt,
      front.riders.some(x => x.player)
    );
  }
}
// Phrase de situation : qui est devant, l'écart, qui roule, la tendance et le pronostic.
function situationText(sim, front, pel, kmLeft, salt) {
  const k = Math.round(kmLeft);
  if (front === pel || !pel) {
    return cpick(
      [
        `À ${k} km de l'arrivée, tout le monde est encore ensemble.`,
        `Plus que ${k} km, le peloton roule groupé.`,
        `${k} km à parcourir et pas d'échappée à l'horizon.`,
      ],
      salt
    );
  }
  const gap = gapSec(front, pel);
  const H = sim.gapHist || [];
  const past = H.length > 10 ? H[H.length - 11].gap : null;
  const trend =
    past == null
      ? ''
      : gap < past - 20
        ? cpick([" L'écart fond à vue d'œil.", ' Le peloton se rapproche.'], salt)
        : gap > past + 20
          ? cpick([" Et l'écart grandit encore !", ' Les fuyards accentuent leur avance.'], salt)
          : " L'écart est stable.";
  // règle empirique des suiveurs : environ une minute pour dix kilomètres
  const verdict =
    gap > kmLeft * 9
      ? cpick([' Ils peuvent y croire !', ' Ça sent la bonne échappée.'], salt + 1)
      : gap < kmLeft * 4
        ? cpick([' Ils sont en sursis.', ' Ça paraît compromis pour eux.'], salt + 1)
        : ' Tout reste possible.';
  const chasers = [...new Set(pel.riders.filter(x => x.work > 0).map(x => x.team.short))].slice(0, 3);
  const who =
    front.riders.length <= 3 ? front.riders.map(x => riderName(x.r)).join(', ') : `${front.riders.length} coureurs`;
  return `À ${k} km de l'arrivée, ${who} en tête avec ${fmtGap(gap)} d'avance.${chasers.length ? ' Derrière, ' + chasers.join(', ') + ' roule' + (chasers.length > 1 ? 'nt' : '') + '.' : ' Personne ne roule derrière !'}${trend}${verdict}`;
}
