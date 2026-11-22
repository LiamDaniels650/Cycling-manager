/* Licence WorldTour (cycle de trois saisons), file des voitures et commissaires.

   Licence : comme dans le peloton réel, les licences WorldTour sont attribuées pour trois saisons d'après le
   classement UCI cumulé sur le cycle. Les équipes WorldTour sont invitées d'office aux Grands Tours et aux grandes
   classiques ; les autres (ProTeams) dépendent des invitations, sauf les deux meilleures de la saison passée,
   invitées d'office (règle des « deux meilleures ProTeams »). Une relégation coûte cher auprès du sponsor.

   File des voitures : l'ordre des voitures derrière le peloton suit le classement général (courses par étapes) ou
   le classement UCI des équipes (courses d'un jour). Le dépannage d'un coureur crevé dépend de la place de sa
   voiture, de la présence d'un équipier qui lui donne sa roue, et du groupe où il roule.

   Commissaires : ravitaillement interdit dans les 20 derniers kilomètres, abri derrière les voitures en revenant
   d'un incident ; pénalités en temps et amendes. */

const WT_N = R.wtN;
const WT_CYCLE = R.wtCycle;

// --- Licence WorldTour ---
function wtInit() {
  if (S.wt) return;
  const rk = S.teams
    .slice()
    .sort(
      (a, b) =>
        ((S.lastRanks && S.lastRanks[b.id]) || (b.tier || 0) * 100) -
        ((S.lastRanks && S.lastRanks[a.id]) || (a.tier || 0) * 100)
    );
  S.wt = { start: S.season, members: rk.slice(0, WT_N).map(T => T.id), pts: {} };
}
function isWT(id) {
  return !!(S.wt && S.wt.members.includes(id));
}
// Classement du cycle en cours : points des saisons terminées du cycle + points de la saison en cours.
function wtRanking() {
  const pts = T => ((S.wt && S.wt.pts[T.id]) || 0) + (T.uci || 0);
  return S.teams
    .slice()
    .sort((a, b) => pts(b) - pts(a))
    .map(T => ({ T, pts: pts(T) }));
}
// Année du cycle (1 à 3) pour la saison en cours.
function wtYear() {
  return S.wt ? S.season - S.wt.start + 1 : 1;
}
// Deux meilleures ProTeams de la saison passée : invitées d'office.
function wtTopPro() {
  if (!S.lastRanks) return [];
  return S.teams
    .filter(T => !isWT(T.id))
    .sort((a, b) => (S.lastRanks[b.id] || 0) - (S.lastRanks[a.id] || 0))
    .slice(0, 2)
    .map(T => T.id);
}
// --- Deuxième division : classement ProSeries de la saison (ProTeams, points UCI de la saison) ---
const PRO_PRIZE = [250, 120, 60];
function proSeriesRanking() {
  return S.teams
    .filter(T => !isWT(T.id))
    .sort((a, b) => (b.uci || 0) - (a.uci || 0))
    .map(T => ({ T, pts: T.uci || 0 }));
}
// Fin de saison : titre ProSeries et primes (les trois premières ProTeams), palmarès de la division.
function proSeriesEnd() {
  const rk = proSeriesRanking();
  if (!rk.length || !(rk[0].pts > 0)) return;
  (S.proHist = S.proHist || []).push({
    s: S.season,
    ids: rk.slice(0, 3).map(e => e.T.id),
    names: rk.slice(0, 3).map(e => e.T.name),
  });
  if (S.proHist.length > 30) S.proHist.shift();
  const k = rk.findIndex(e => e.T.player);
  if (k >= 0 && k < PRO_PRIZE.length) {
    S.budget += PRO_PRIZE[k];
    finAdd('prize', PRO_PRIZE[k]);
    if (k === 0) S.conf = clamp(S.conf + 5, 0, 100);
    msg(
      k === 0 ? '🏆 Champion de la ProSeries !' : `🥈 ${k + 1}e de la ProSeries`,
      `Votre équipe termine ${k === 0 ? 'première' : k + 1 + 'e'} de la deuxième division (${rk[k].pts} pts) : prime de ${fmtMoney(PRO_PRIZE[k])}${k === 0 ? ', confiance du sponsor +5' : ''}.`
    );
  }
  press(
    `${rk[0].T.name} remporte la ProSeries ${S.season}`,
    `Meilleure équipe de deuxième division avec ${rk[0].pts} points, devant ${rk
      .slice(1, 3)
      .map(e => e.T.name)
      .join(' et ')}.`,
    0,
    []
  );
}
// Fin de saison : points du cycle ; au bout de trois saisons, nouvelles licences.
function wtEndSeason() {
  wtInit();
  proSeriesEnd();
  for (const T of S.teams) S.wt.pts[T.id] = (S.wt.pts[T.id] || 0) + (T.uci || 0);
  if (wtYear() < WT_CYCLE) return;
  const rk = S.teams.slice().sort((a, b) => (S.wt.pts[b.id] || 0) - (S.wt.pts[a.id] || 0));
  const next = rk.slice(0, WT_N).map(T => T.id);
  const was = isWT(0),
    now = next.includes(0);
  const up = next.filter(id => !S.wt.members.includes(id)).map(id => teamById(id).name);
  const down = S.wt.members.filter(id => !next.includes(id)).map(id => teamById(id).name);
  const myRank = rk.findIndex(T => T.player) + 1;
  S.wt = { start: S.season + 1, members: next, pts: {} };
  // clauses de relégation : les leaders ambitieux des équipes reléguées font jouer leur clause de sortie
  const exits = {};
  for (const id of S.teams.map(T => T.id).filter(id => !next.includes(id) && down.includes(teamById(id).name))) {
    const T = teamById(id);
    const rs = T.riders
      .map(i => S.riders[i])
      .filter(r => !r.aca && r.contract >= 2 && r.age < 33)
      .sort((a, b) => overall(b.s) - overall(a.s))
      .slice(0, 3);
    for (const r of rs)
      if (r.amb >= R.wtExit.amb && overall(r.s) >= R.wtExit.ov && rnd() < R.wtExit.p) {
        r.contract = 1; // libre dès cet hiver
        r.exitClause = true;
        (exits[id] = exits[id] || []).push(riderName(r));
      }
  }
  const sp = S.spons;
  if (was && !now) {
    S.conf = clamp(S.conf + R.wtDown.conf, 0, 100);
    if (sp) sp.base = Math.round(sp.base * R.wtDown.spons * 10) / 10;
    for (const id of S.teams[0].riders) S.riders[id].moral = clamp(S.riders[id].moral + R.wtDown.moral, 0, 100);
    const ex = exits[0] || [];
    msg(
      '❌ Relégation : licence WorldTour perdue',
      `Avec ${myRank}e place au classement des trois saisons, votre équipe perd sa licence WorldTour. Plus d'invitation d'office aux Grands Tours ni aux grandes classiques. ${sp ? `${sp.name} applique sa clause de relégation : budget sponsor −12 %. ` : ''}Le sponsor est très déçu (confiance −15), le vestiaire accuse le coup (moral −8).${ex.length ? ` Clause de sortie activée : ${ex.join(', ')} quitte l'équipe dès cet hiver.` : ''} Les coureurs cotés seront plus difficiles à attirer.`
    );
    press(`${S.teams[0].name} perd sa licence WorldTour`, `L'équipe redescend en ProTeam après un cycle décevant.`, -1);
  } else if (!was && now) {
    S.conf = clamp(S.conf + R.wtUp.conf, 0, 100);
    if (sp) sp.base = Math.round(sp.base * R.wtUp.spons * 10) / 10;
    for (const id of S.teams[0].riders) S.riders[id].moral = clamp(S.riders[id].moral + R.wtUp.moral, 0, 100);
    msg(
      '🏆 Promotion : licence WorldTour obtenue',
      `${myRank}e au classement des trois saisons : votre équipe obtient une licence WorldTour pour trois ans. Invitations d'office aux Grands Tours et aux grandes classiques. ${sp ? `${sp.name} augmente son apport de 8 %. ` : ''}Confiance du sponsor +10, moral de l'effectif +6. Les coureurs cotés vous écouteront davantage.`
    );
    press(
      `${S.teams[0].name} obtient la licence WorldTour`,
      `L'équipe rejoint l'élite pour les trois prochaines saisons.`,
      1
    );
  } else
    msg(
      'Licences WorldTour',
      `${now ? `Licence WorldTour renouvelée (${myRank}e sur trois saisons).` : `Vous restez ProTeam (${myRank}e sur trois saisons ; il fallait être dans les ${WT_N} premiers).`}${up.length ? ` Promues : ${up.join(', ')}.` : ''}${down.length ? ` Reléguées : ${down.join(', ')}.` : ''}${
        Object.keys(exits).filter(id => +id !== 0).length
          ? ` Départs par clause de sortie : ${Object.keys(exits)
              .filter(id => +id !== 0)
              .map(id => exits[id].join(', '))
              .join(' ; ')}.`
          : ''
      }`
    );
}
// Statut de licence vu par un coureur courtisé : une ProTeam attire moins les coureurs cotés.
function wtSignFactor(r) {
  if (!S.wt) return 0;
  const ov = overall(r.s);
  if (isWT(0)) return 0;
  return ov >= 75 ? R.wtSign.star : ov >= 71 ? R.wtSign.good : 0;
}
// Dernière saison du cycle : la course aux points devient l'affaire de tous.
function wtWeekly() {
  if (!S.wt || wtYear() < WT_CYCLE || !(S.week === 20 || S.week === 34)) return;
  const rk = wtRanking();
  const i = rk.findIndex(e => e.T.player);
  if (i < WT_N - 3 || i > WT_N + 2) return;
  const line = rk[WT_N - 1].pts,
    out = rk[WT_N].pts,
    me = rk[i].pts;
  const inside = i < WT_N;
  const gap = inside ? me - out : line - me;
  S.conf = clamp(S.conf + (inside ? 0 : -2), 0, 100);
  msg(
    inside ? '🎯 Licence : rester dans les 13' : '🚨 Licence en danger',
    inside
      ? `Dernière saison du cycle : vous êtes ${i + 1}e, ${gap} pts devant le 14e. Chaque point compte : courses de catégorie 2 et places d'honneur rapportent.`
      : `Dernière saison du cycle : vous êtes ${i + 1}e, à ${gap} pts de la 13e place. Le sponsor s'inquiète (confiance −2). Visez les courses où vos coureurs peuvent marquer.`
  );
}
// Chance pour le joueur, en ProTeam (hors deux meilleures), d'être invité à un Grand Tour et à une grande course :
// elle dépend de la confiance du sponsor et de la notoriété.
function wtInviteOdds() {
  return {
    gt: 0.3 + S.conf / 200 + (repOf() - 40) / 250,
    cat1: 0.62 + S.conf / 400 + (repOf() - 40) / 300,
  };
}
// Invitations d'une course (appelé à la création du calendrier).
function wtInvites(c) {
  const top2 = wtTopPro();
  const pro = S.teams.filter(T => !isWT(T.id) && !top2.includes(T.id));
  const auto = S.teams.filter(T => isWT(T.id) || top2.includes(T.id)).map(T => T.id);
  if (c.cat === 0) {
    const inv = auto.slice();
    for (const T of pro) {
      const p = T.player ? wtInviteOdds().gt : 0.5;
      if (rnd() < p) inv.push(T.id);
    }
    return inv;
  }
  if (c.cat === 1) {
    // grandes classiques et courses par étapes WorldTour : les ProTeams vivent des invitations
    const inv = auto.slice();
    for (const T of pro) {
      const p = T.player ? wtInviteOdds().cat1 : 0.85;
      if (rnd() < p) inv.push(T.id);
    }
    return inv;
  }
  // courses de catégorie 2 (le circuit de la deuxième division) : les ProTeams y courent presque toujours, les
  // équipes WorldTour y envoient une équipe une fois sur deux (le joueur y est toujours invité)
  return S.teams.filter(T => T.player || rnd() < (isWT(T.id) ? 0.55 : 0.92)).map(T => T.id);
}

// --- File des voitures ---
// Ordre des voitures : les équipes engagées, de la mieux classée au général (ou au classement UCI) à la dernière.
function convoyOrder(sim) {
  if (sim.convoy) return sim.convoy;
  const rc = sim.rc;
  const teams = S.teams.filter(T => (rc.sel[T.id] || []).length);
  let key;
  if (rc.specs.length > 1 && rc.si > 0) {
    const g = gcList(rc);
    const best = {};
    g.forEach((id, k) => {
      const t = S.riders[id].team;
      if (best[t] == null) best[t] = k;
    });
    key = T => (best[T.id] != null ? best[T.id] : 999);
  } else {
    const rk = uciRanking();
    key = T => rk.indexOf(T);
  }
  sim.convoy = teams.sort((a, b) => key(a) - key(b)).map(T => T.id);
  return sim.convoy;
}
function carRank(sim, T) {
  return convoyOrder(sim).indexOf(T.id) + 1;
}
// Temps perdu sur une crevaison : changement de roue, plus l'attente de la voiture selon le groupe et la file.
// En moyenne autant qu'avant (18 à 40 s), mais la place de la voiture et la situation de course comptent.
function punctureLoss(sim, x, G) {
  const base = rf(12, 18);
  const pel = sim.pel;
  const ahead = G !== pel && pel && G.pos > pel.pos;
  if (ahead && gapSec(G, pel) > 60) return base + rf(5, 12); // échappée : les voitures sont montées derrière elle
  if (G !== pel || G.riders.length < 20) return base + rf(14, 26); // groupe sans voiture : dépannage neutre
  const k = carRank(sim, x.team);
  const n = convoyOrder(sim).length || 1;
  return base + 3 + (k / n) * 22 + rf(-3, 3);
}

// Pourquoi un dépannage a coûté ce temps (pour la radio) : mêmes cas que punctureLoss, sans hasard.
function punctureWhy(sim, x, G) {
  const pel = sim.pel;
  if (G !== pel && pel && G.pos > pel.pos && gapSec(G, pel) > 60) return 'voiture montée derrière l’échappée';
  if (G !== pel || G.riders.length < 20) return 'pas de voiture d’équipe : dépannage neutre';
  return `voiture ${carRank(sim, x.team)}e dans la file sur ${convoyOrder(sim).length}`;
}

// --- Commissaires ---
// Pénalité en temps (appliquée à l'arrivée) et amende pour l'équipe du joueur.
function penalize(sim, x, sec, fineK, why) {
  x.pen = (x.pen || 0) + sec;
  if (x.player && fineK) {
    S.budget -= fineK;
    finAdd('other', -fineK);
  }
  log(
    sim,
    `👮 Commissaires : ${riderName(x.r)} (${x.team.short}) pénalisé de ${sec} s${fineK && x.player ? ` et ${fmtMoney(fineK)} d'amende` : ''} — ${why}.`,
    x.player ? 'bad' : 'info'
  );
  if (x.player) highlight(sim, `👮 ${riderName(x.r)} pénalisé de ${sec} s (${why})`, true);
}
// Ravitaillement depuis les voitures dans les 20 derniers kilomètres : interdit.
function feedCheck(sim, x) {
  const G = x.g;
  if (G && sim.dist - G.pos < R.feedKm)
    penalize(sim, x, R.feedPen, R.feedFine, `ravitaillement dans les ${R.feedKm} derniers kilomètres`);
}
// Retour après un incident : abri derrière les voitures (« bidon collé ») selon la discipline ; parfois vu.
function carShelter(sim, x, lossS) {
  const p = clamp(0.35 - (x.r.dis - 50) / 200 + (x.r.trait === 'tete' ? 0.1 : 0), 0.05, 0.5);
  if (lossS < 20 || rnd() >= p) return lossS;
  const gain = lossS * rf(0.25, 0.4);
  if (rnd() < R.shelterSeen)
    penalize(sim, x, R.shelterPen, R.shelterFine, 'abri derrière les voitures en revenant sur le peloton');
  return lossS - gain;
}
