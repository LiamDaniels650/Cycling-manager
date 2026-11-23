/* La direction du club. Un président (nom, caractère) fixe un projet sur trois saisons — miser sur la jeunesse,
   briller sur les grands tours, régner sur les classiques, gagner souvent, monter au classement, tenir les comptes,
   former une équipe de chez nous — jugé à chaque fin de saison. Sa confiance (0 à 100), distincte de celle du
   sponsor, monte quand le projet avance et baisse sinon ; elle pèse un peu sur la confiance du sponsor (donc sur un
   éventuel limogeage), et décide de l'accueil fait à vos demandes : rallonge pour le mercato, financement d'une
   installation (71-facilities.js), changement de projet. Une demande toutes les six semaines au plus.
   Pas de hasard de la partie : les réponses dépendent de la confiance et d'une empreinte. */

const BOARD_CHAR = {
  patient: { lbl: 'Patient', d: 'Juge sur la durée : un projet raté une saison le fâche peu.' },
  exigeant: { lbl: 'Exigeant', d: 'Veut des résultats tout de suite : chaque saison compte double.' },
  genereux: { lbl: 'Généreux', d: 'Accepte plus volontiers de mettre la main à la poche.' },
};
const VISIONS = {
  jeunes: { lbl: 'Miser sur la jeunesse', d: 'Au moins 35 % des jours de course disputés par des coureurs de 24 ans ou moins.' },
  gt: { lbl: 'Briller sur les grands tours', d: "Une victoire d'étape ou un podium final sur un grand tour dans la saison." },
  classiques: { lbl: 'Régner sur les classiques', d: "Un podium sur un monument ou une victoire sur une grande classique d'un jour." },
  victoires: { lbl: 'Gagner souvent', d: 'Un nombre de victoires fixé selon le rang de l’équipe.' },
  rang: { lbl: 'Monter au classement', d: 'Finir au classement UCI au moins au rang fixé.' },
  comptes: { lbl: 'Tenir les comptes', d: 'Finir la saison avec un budget au moins égal à celui du départ.' },
  terroir: { lbl: 'Une équipe de chez nous', d: 'Au moins 40 % de l’effectif de la nationalité du club.' },
};
const BOARD_ASK_GAP = 6;
function boardInit() {
  const club = S.teams[0].name;
  if (S.board && S.board.club === club) return S.board;
  const h = dsHash('board' + club + S.seed0);
  const N = NATS[clubNat()] || NATS.FRA;
  const ch = Object.keys(BOARD_CHAR);
  S.board = {
    club,
    fn: N.fn[h % N.fn.length],
    ln: N.ln[(h >>> 6) % N.ln.length],
    ch: ch[(h >>> 12) % ch.length],
    t: 55,
    v: null,
    cyc: null, // { s0, res: [true/false…] }
    tgt: {},
    b0: S.budget,
    ask: -99,
    fund: null,
    hist: [],
    prop: null,
  };
  boardPropose();
  return S.board;
}
// Nationalité du club : la plus représentée dans l'effectif.
function clubNat() {
  const c = {};
  for (const id of S.teams[0].riders) {
    const r = S.riders[id];
    if (r) c[r.nat] = (c[r.nat] || 0) + 1;
  }
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || 'FRA';
}
// Trois projets proposés au début d'un cycle (selon le profil de l'équipe).
function boardPropose() {
  const B = S.board;
  const ks = Object.keys(VISIONS);
  const h = dsHash('vis' + B.club + S.season);
  const a = ks[h % ks.length];
  let b = ks[(h >>> 5) % ks.length];
  if (b === a) b = ks[(ks.indexOf(a) + 3) % ks.length];
  let c = ks[(h >>> 10) % ks.length];
  if (c === a || c === b) c = ks.find(k => k !== a && k !== b);
  B.prop = [a, b, c];
}
function boardChoose(k) {
  const B = boardInit();
  if (!VISIONS[k]) return 'Projet inconnu.';
  if (B.v && B.cyc) return 'Un projet est déjà en cours.';
  B.v = k;
  B.cyc = { s0: S.season, res: [] };
  B.prop = null;
  boardTargets();
  return `🤝 Projet validé avec ${boardName()} : « ${VISIONS[k].lbl} », sur trois saisons.`;
}
function boardName() {
  const B = boardInit();
  return `${B.fn} ${B.ln}`;
}
// Cibles chiffrées de la saison (fixées en début de saison).
function boardTargets() {
  const B = S.board;
  const er = S.expRank || 10;
  B.tgt = {
    s: S.season,
    wins: clamp(Math.round(14 - er * 0.7), 2, 14),
    rank: clamp(er - 1, 1, S.teams.length),
    nat: B.nat || (B.nat = clubNat()),
  };
  B.b0 = S.budget;
}
// Résultats de la saison en cours pour mon équipe (dans l'historique des courses).
function boardBigResults() {
  let gt = 0,
    cl = 0;
  for (const c of S.cal) {
    const h = (S.raceHist[c.key] || []).find(e => e.s === S.season);
    if (!h) continue;
    const mine = id => S.riders[id] && S.riders[id].team === 0;
    const isGT = c.cat === 0 && c.stagesSpec.length >= 15;
    if (isGT && ((h.stages || []).some(s => mine(s.id)) || h.pod.some(p => mine(p.id)))) gt++;
    if (MONUMENTS.includes(c.key) && h.pod.some(p => mine(p.id))) cl++;
    else if (c.cat === 1 && c.stagesSpec.length === 1 && h.pod[0] && mine(h.pod[0].id)) cl++;
  }
  return { gt, cl };
}
// Où en est le projet cette saison : { ok, txt, pct }.
function boardStatus() {
  const B = boardInit();
  if (!B.v) return null;
  if (!B.tgt || B.tgt.s !== S.season) boardTargets();
  const T = S.teams[0];
  const rs = T.riders.map(id => S.riders[id]).filter(Boolean);
  switch (B.v) {
    case 'jeunes': {
      const all = rs.reduce((a, r) => a + r.stats.days, 0);
      const y = rs.filter(r => r.age <= 24).reduce((a, r) => a + r.stats.days, 0);
      const p = all ? y / all : 0;
      return { ok: p >= 0.35, pct: clamp(p / 0.35, 0, 1), txt: `${Math.round(p * 100)} % des jours de course (objectif 35 %)` };
    }
    case 'gt': {
      const n = boardBigResults().gt;
      return { ok: n >= 1, pct: n ? 1 : 0, txt: n ? `${n} grand${n > 1 ? 's' : ''} tour${n > 1 ? 's' : ''} réussi${n > 1 ? 's' : ''}` : 'pas encore de résultat' };
    }
    case 'classiques': {
      const n = boardBigResults().cl;
      return { ok: n >= 1, pct: n ? 1 : 0, txt: n ? `${n} grand résultat${n > 1 ? 's' : ''}` : 'pas encore de résultat' };
    }
    case 'victoires': {
      const w = seasonWins(0);
      return { ok: w >= B.tgt.wins, pct: clamp(w / B.tgt.wins, 0, 1), txt: `${w}/${B.tgt.wins} victoires` };
    }
    case 'rang': {
      const rk = uciRanking().indexOf(T) + 1;
      return { ok: rk <= B.tgt.rank, pct: clamp(1 - (rk - B.tgt.rank) / 10, 0, 1), txt: `actuellement ${rk}e (objectif ${B.tgt.rank}e)` };
    }
    case 'comptes': {
      const d = S.budget - B.b0;
      return { ok: d >= 0, pct: d >= 0 ? 1 : clamp(1 + d / 500, 0, 1), txt: `${d >= 0 ? '+' : ''}${fmtMoney(d)} depuis le début de saison` };
    }
    case 'terroir': {
      const n = rs.filter(r => r.nat === B.tgt.nat).length;
      const p = rs.length ? n / rs.length : 0;
      return { ok: p >= 0.4, pct: clamp(p / 0.4, 0, 1), txt: `${n} coureurs ${B.tgt.nat} sur ${rs.length} (objectif 40 %)` };
    }
  }
  return null;
}
function addBoardT(v) {
  S.board.t = clamp(S.board.t + v, 0, 100);
}
function boardWeekly() {
  if (S.car) return;
  const B = boardInit();
  if (!B.v && B.prop && S.week === 3 && !B.nag) {
    B.nag = S.season;
    msg('🏛️ La direction', `${boardName()} attend votre projet pour les trois prochaines saisons (Gestion › Direction). Sans choix, il retiendra « ${VISIONS[B.prop[0]].lbl} ».`);
  }
  if (!B.v && B.prop && S.week >= 8) boardChoose(B.prop[0]);
  if (B.v && (!B.tgt || B.tgt.s !== S.season)) boardTargets();
}
// Bilan de fin de saison.
function boardEndSeason(myRank) {
  if (S.car) return;
  const B = boardInit();
  const st = boardStatus();
  if (!st) return;
  const k = B.ch === 'exigeant' ? 1.5 : B.ch === 'patient' ? 0.6 : 1;
  const dt = st.ok ? 10 : -Math.round(10 * k);
  addBoardT(dt);
  // la confiance du président déteint sur celle du sponsor
  const dConf = B.t >= 70 ? 3 : B.t <= 25 ? -5 : 0;
  if (dConf) S.conf = clamp(S.conf + dConf, 0, 100);
  B.cyc.res.push(st.ok);
  B.hist.unshift({ s: S.season, v: B.v, ok: st.ok, txt: st.txt });
  if (B.hist.length > 12) B.hist.length = 12;
  const lines = [`Projet « ${VISIONS[B.v].lbl} » : ${st.ok ? '✅ réussi' : '❌ manqué'} cette saison (${st.txt}).`];
  if (B.cyc.res.length >= 3) {
    const n = B.cyc.res.filter(Boolean).length;
    if (n >= 2) {
      const prime = n === 3 ? 300 : 150;
      S.budget += prime;
      finAdd('spons', prime);
      addBoardT(8);
      lines.push(`Fin du cycle : ${n}/3 saisons réussies. Le président vous félicite et vous accorde ${fmtMoney(prime)} pour la suite.`);
    } else {
      addBoardT(-10);
      S.conf = clamp(S.conf - 5, 0, 100);
      lines.push(`Fin du cycle : ${n}/3 saisons réussies seulement. Le président est déçu.`);
    }
    B.v = null;
    B.cyc = null;
    boardPropose();
    lines.push('Un nouveau projet est à choisir (Gestion › Direction).');
  }
  if (dConf) lines.push(dConf > 0 ? 'Son soutien rassure le sponsor.' : 'Sa défiance inquiète le sponsor.');
  lines.push(`Confiance du président : ${B.t}/100.`);
  msg('🏛️ La direction', lines.join('<br>'));
}
// Demandes au président.
const BOARD_ASKS = {
  mercato: { lbl: 'Une rallonge pour le mercato', d: 'Un apport exceptionnel au budget, pour recruter.', min: 55, cost: 8 },
  fac: { lbl: 'Financer une installation', d: 'La direction paie la moitié du prochain chantier choisi (cette saison).', min: 50, cost: 6 },
  vision: { lbl: 'Changer de projet', d: 'Abandonner le projet en cours et en choisir un autre. Il n’aime pas ça.', min: 0, cost: 15 },
};
function boardCanAsk() {
  const B = boardInit();
  return S.season * 100 + S.week - B.ask >= BOARD_ASK_GAP;
}
// Chance d'acceptation (0 à 1).
function boardChance(k) {
  const B = boardInit();
  const A = BOARD_ASKS[k];
  if (!A) return 0;
  if (k === 'vision') return B.v ? 1 : 0;
  return clamp((B.t - A.min) / 30 + 0.35 + (B.ch === 'genereux' ? 0.15 : 0), 0, 0.95);
}
function boardAmount() {
  const B = boardInit();
  return Math.round((120 + B.t * 2.5 + (S.teams.length - (S.expRank || 10)) * 8) / 10) * 10;
}
function boardAsk(k, fk) {
  const B = boardInit();
  const A = BOARD_ASKS[k];
  if (!A) return 'Demande inconnue.';
  if (!boardCanAsk()) return `Le président vous a reçu il y a peu : revenez dans quelques semaines.`;
  B.ask = S.season * 100 + S.week;
  if (k === 'vision') {
    if (!B.v) return "Aucun projet en cours : choisissez-en un.";
    addBoardT(-A.cost);
    B.v = null;
    B.cyc = null;
    boardPropose();
    return `${boardName()} accepte, à contrecœur, de revoir le projet (confiance -${A.cost}). Choisissez-en un nouveau.`;
  }
  const yes = dsHash('ask' + k + S.season + S.week + B.club) % 1000 < boardChance(k) * 1000;
  if (!yes) {
    addBoardT(-2);
    return `${boardName()} refuse : « Pas maintenant. Montrez-moi d'abord que le projet avance. »`;
  }
  addBoardT(-A.cost);
  if (k === 'mercato') {
    const m = boardAmount();
    S.budget += m;
    finAdd('spons', m);
    return `${boardName()} accepte : ${fmtMoney(m)} de rallonge pour le mercato.`;
  }
  if (k === 'fac') {
    if (!FAC[fk]) return 'Installation inconnue.';
    B.fund = { k: fk, s: S.season, p: 0.5 };
    return `${boardName()} accepte de payer la moitié du chantier « ${FAC[fk].lbl} » s'il est lancé cette saison.`;
  }
  return '';
}
