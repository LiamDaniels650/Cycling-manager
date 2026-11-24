/* Le vestiaire : la vie du groupe autour de vos coureurs.
   - caractère de chaque coureur (lu dans son trait, son ambition, sa discipline) et sens du collectif (leadership) ;
   - capitaine de route : un coureur d'expérience qui fait mieux appliquer vos consignes en course et tient le groupe ;
   - ambitions ciblées : l'objectif de saison d'un coureur vise une course précise (« leader au Giro ») ;
   - promesses de rôle sur une course nommée, tenues ou rompues : la confiance du groupe en dépend ;
   - mentorat entre un ancien et un jeune de l'effectif pro ;
   - rivalités de leaders (deux coureurs veulent la même course : à vous de trancher) ;
   - plaintes dans la presse des coureurs frustrés ;
   - réunions d'équipe (une toutes les quatre semaines).
   Tout est propre à votre équipe : les équipes de l'ordinateur ne sont pas concernées. */

const LOCK = {
  trust0: 60, // confiance du groupe en début de partie
  capObey: 0.04, // obéissance des équipiers quand le capitaine court (plus selon son leadership)
  meetEvery: 4, // semaines entre deux réunions d'équipe
  mentorGain: 0.12, // progression en plus d'un jeune parrainé par un ancien
  promMax: 3, // promesses de rôle en cours au plus
};

// --- Caractère et leadership ---
function leadOf(r) {
  const tb = { modele: 20, leaderne: 10, tete: -15, fragile: -10, regulier: 4 }[r.trait] || 0;
  return clamp(
    Math.round(30 + (r.age - 22) * 3 + (r.dis - 50) * 0.4 + tb + ((dsHash('lead' + r.id) % 21) - 10)),
    5,
    99
  );
}
const CHARS = {
  capitaine: { lbl: 'Capitaine né', ic: '🧭', d: 'Écouté du groupe ; calme les tensions.' },
  fidele: { lbl: 'Fidèle', ic: '🤝', d: 'Pardonne plus facilement ; attaché au club.' },
  egoiste: { lbl: 'Égoïste', ic: '🎯', d: 'Ne supporte pas de courir pour les autres ; se plaint vite.' },
  tete: { lbl: 'Tête brûlée', ic: '🔥', d: 'Attaque à tout va, supporte mal les consignes de prudence.' },
  timide: { lbl: 'Timide', ic: '🌫️', d: 'Moral fragile, a besoin d’être encouragé.' },
  ambitieux: { lbl: 'Ambitieux', ic: '⭐', d: 'Veut des responsabilités et des courses à lui.' },
  equilibre: { lbl: 'Équilibré', ic: '⚖️', d: 'Ni trop ni trop peu : fait le travail.' },
};
function charOf(r) {
  if (r.trait === 'tete') return 'tete';
  if (leadOf(r) >= 72) return 'capitaine';
  if (r.trait === 'fragile' || r.amb < 32) return 'timide';
  if ((r.amb >= 72 && r.dis < 58) || (['leaderne', 'opportuniste'].includes(r.trait) && r.amb >= 65)) return 'egoiste';
  if (r.dis >= 70 && r.amb < 58) return 'fidele';
  if (r.amb >= 65) return 'ambitieux';
  return 'equilibre';
}

// --- Confiance du groupe ---
function trustOf() {
  return S.trust == null ? LOCK.trust0 : S.trust;
}
function addTrust(v) {
  S.trust = clamp(trustOf() + v, 0, 100);
}

// --- Capitaine de route ---
function captain() {
  const r = S.captain != null ? S.riders[S.captain] : null;
  return r && r.team === 0 && !r.retired ? r : null;
}
function captainCands() {
  return S.teams[0].riders
    .map(id => S.riders[id])
    .filter(r => r.age >= 25 && !r.aca)
    .sort((a, b) => leadOf(b) - leadOf(a));
}
function setCaptain(id) {
  const r = S.riders[id];
  if (!r || r.team !== 0) return 'Coureur introuvable.';
  if (r.age < 25) return `${riderName(r)} est trop jeune pour être capitaine de route.`;
  const old = captain();
  S.captain = id;
  r.moral = clamp(r.moral + 5, 0, 100);
  if (old && old !== r) old.moral = clamp(old.moral - (charOf(old) === 'fidele' ? 2 : 6), 0, 100);
  return `🧭 ${riderName(r)} est votre capitaine de route (leadership ${leadOf(r)}).`;
}
// Début de saison (et si le capitaine est parti) : l'adjoint désigne le coureur le plus écouté.
function captainAuto() {
  if (captain()) return;
  const c = captainCands()[0];
  if (c) S.captain = c.id;
}
// Bonus d'obéissance de mes coureurs quand le capitaine est en course avec eux.
function captainObey(x, sim) {
  if (!x.player || !sim || !S.captain || x.id === S.captain) return 0;
  if (sim._capt === undefined) {
    const c = sim.runners.find(y => y.player && y.id === S.captain && !y.dnf);
    sim._capt = c ? LOCK.capObey + (leadOf(c.r) - 60) / 500 : 0;
  }
  return sim._capt;
}

// --- Ambitions ciblées (complète les objectifs personnels de 22-goals.js) ---
// Course visée par un objectif : un grand tour, ou la grande classique qui convient à son profil.
function goalRaceFor(r, k) {
  const gts = S.cal.filter(c => c.cat === 0 && c.stagesSpec.length > 1);
  const cls = S.cal.filter(c => isBigClassic(c));
  const h = dsHash('amb' + r.id + S.season);
  if ((k === 'gtTop10' || k === 'gtStage') && gts.length) {
    if (k === 'gtTop10' && overall(r.s) >= 80 && gts.some(c => c.key === 'gb')) return 'gb';
    return gts[h % gts.length].key;
  }
  if (k === 'classic' && cls.length) {
    const ty = c => c.stagesSpec[0][0];
    const fit = cls.filter(c => (r.arch === 'flahute' ? ty(c) === 'paves' : ty(c) !== 'paves'));
    const L = fit.length ? fit : cls;
    return L[h % L.length].key;
  }
  return null;
}
function goalRaceTag(r) {
  if (!r.goal || r.goal.s !== S.season || !r.goal.race) return '';
  const c = S.cal.find(c => c.key === r.goal.race);
  return c ? `${r.goal.lead ? 'leader à ' : ''}${c.name}` : '';
}
// Après l'attribution des objectifs : course visée et envie d'y être leader.
function ambitionsAssign() {
  for (const id of S.teams[0].riders) {
    const r = S.riders[id];
    if (!r.goal || r.goal.s !== S.season) continue;
    r.goal.race = goalRaceFor(r, r.goal.k);
    r.goal.lead = !!r.goal.race && (r.goal.k === 'gtTop10' || r.goal.k === 'classic') && r.amb >= 50;
  }
}
// Après une course : l'ambitieux laissé de côté ou privé du rôle qu'il visait le fait savoir.
function ambitionsAfterRace(rc) {
  const sel = rc.sel[0] || [];
  for (const id of S.teams[0].riders) {
    const r = S.riders[id];
    if (!r.goal || r.goal.s !== S.season || r.goal.race !== rc.key || r.injury > 0) continue;
    const led = (rc.ledBy || []).includes(id);
    const ch = charOf(r);
    if (!sel.includes(id)) {
      r.moral = clamp(r.moral - (ch === 'egoiste' ? 12 : ch === 'fidele' ? 3 : 7), 0, 100);
      msg('😤 Ambition déçue', `${riderName(r)} visait ${rc.name} et n'a pas été sélectionné. Il le vit mal.`);
      if (ch === 'egoiste' || ch === 'ambitieux') lockerComplain(r, `pas retenu pour ${rc.name}`);
    } else if (r.goal.lead && !led) {
      r.moral = clamp(r.moral - (ch === 'egoiste' ? 8 : 4), 0, 100);
    } else if (led) r.moral = clamp(r.moral + 4, 0, 100);
  }
}

// --- Promesses de rôle sur une course ---
function promsOn() {
  return (S.proms || []).filter(p => p.s === S.season && !p.done);
}
function promiseRole(id, key, quiet) {
  const r = S.riders[id];
  const c = S.cal.find(c => c.key === key);
  if (!r || r.team !== 0 || !c) return 'Promesse impossible.';
  if (c.done) return `${c.name} est déjà passée.`;
  if (promsOn().some(p => p.id === id && p.key === key)) return `Vous lui avez déjà promis ${c.name}.`;
  if (promsOn().length >= LOCK.promMax) return `Déjà ${LOCK.promMax} promesses en cours : tenez-les d'abord.`;
  const other = promsOn().filter(p => p.key === key && p.id !== id);
  (S.proms = S.proms || []).push({ id, key, s: S.season, done: false });
  if (!quiet) r.moral = clamp(r.moral + rint(6, 10), 0, 100);
  let t = `🤞 Promis : ${riderName(r)} sera leader à ${c.name}.`;
  for (const o of other) {
    addRel(id, o.id, -12);
    t += ` ${riderName(S.riders[o.id])}, à qui vous aviez promis la même course, l'apprend mal.`;
  }
  return t;
}
// Fin de course : promesses tenues ou rompues (une blessure excuse presque tout).
function promisesAfterRace(rc) {
  for (const p of promsOn()) {
    if (p.key !== rc.key) continue;
    const r = S.riders[p.id];
    p.done = true;
    if (!r || r.team !== 0) continue;
    const led = (rc.ledBy || []).includes(p.id);
    if (led) {
      p.ok = true;
      r.moral = clamp(r.moral + 10, 0, 100);
      addTrust(5);
      msg('🤞 Promesse tenue', `${riderName(r)} a été leader à ${rc.name}, comme promis. Le groupe le note.`);
    } else if (r.injury > 0) {
      p.ok = null;
      r.moral = clamp(r.moral - 4, 0, 100);
    } else {
      p.ok = false;
      const ch = charOf(r);
      r.moral = clamp(r.moral - (ch === 'fidele' ? 12 : ch === 'egoiste' ? 26 : 20), 0, 100);
      r.dis = clamp(r.dis - (ch === 'fidele' ? 2 : 5), 0, 99);
      addTrust(-10);
      msg(
        '💔 Promesse rompue',
        `Vous aviez promis à ${riderName(r)} d'être leader à ${rc.name}. Il ne l'a pas été : moral et discipline en chute, et tout le vestiaire se demande ce que vaut votre parole.`
      );
      if (ch !== 'fidele') lockerComplain(r, `la promesse de ${rc.name} n'a pas été tenue`, true);
    }
  }
}

// --- Plaintes dans la presse ---
function lockerComplain(r, why, force) {
  const wk = S.season * 100 + S.week;
  if (!force && r.compW && wk - r.compW < 8) return;
  r.compW = wk;
  press(
    `${riderName(r)} s'impatiente`,
    `« Je ne suis pas venu ici pour ça. » ${riderName(r)} n'a pas caché son agacement (${why}). L'ambiance chez ${S.teams[0].name} est scrutée.`,
    -0.5,
    [r.id]
  );
  addTrust(-2);
}

// --- Mentorat entre pros ---
function proMentorOf(r) {
  const m = S.proMentors && S.proMentors[r.id];
  const M = m != null ? S.riders[m] : null;
  return M && M.team === 0 && r.team === 0 ? M : null;
}
function proMentorCands(young) {
  return S.teams[0].riders
    .map(id => S.riders[id])
    .filter(
      M =>
        M.id !== young.id &&
        M.age >= 29 &&
        Object.values(S.proMentors || {}).filter(v => v === M.id).length < 2 &&
        rel(M.id, young.id) > -30
    )
    .sort((a, b) => leadOf(b) - leadOf(a));
}
function setProMentor(yId, mId) {
  const y = S.riders[yId],
    M = mId == null ? null : S.riders[mId];
  if (!y || y.team !== 0 || y.aca) return 'Coureur introuvable.';
  S.proMentors = S.proMentors || {};
  if (!M) {
    delete S.proMentors[yId];
    return `${riderName(y)} n'a plus de parrain.`;
  }
  if (y.age > 24) return 'Le parrainage concerne les coureurs de 24 ans et moins.';
  if (!proMentorCands(y).includes(M)) return `${riderName(M)} ne peut pas parrainer ${riderName(y)}.`;
  S.proMentors[yId] = mId;
  addRel(yId, mId, 6);
  return `🎓 ${riderName(M)} prend ${riderName(y)} sous son aile : conseils, placement, gestion de l'effort.`;
}
// Progression en plus du jeune parrainé (appelée chaque semaine avec la progression de base).
function proMentorGain(r, pl, g0) {
  const M = proMentorOf(r);
  if (!M) return;
  trainGain(r, pl, g0 * LOCK.mentorGain * (0.8 + leadOf(M) / 250));
  r.moral = clamp(r.moral + 0.3, 0, 100);
  if (S.week % 4 === 0) addRel(r.id, M.id, 1);
}

// --- Rivalités de leaders ---
function lockerRivals() {
  const rs = S.teams[0].riders
    .map(id => S.riders[id])
    .filter(r => r.goal && r.goal.s === S.season && r.goal.lead && r.amb >= 60);
  const out = [];
  for (let i = 0; i < rs.length; i++)
    for (let j = i + 1; j < rs.length; j++) if (rs[i].goal.race === rs[j].goal.race) out.push([rs[i], rs[j]]);
  return out;
}
function lockerAskRivals() {
  if (S.lockAsk) return;
  S.lockDone = S.lockDone || [];
  for (const [a, b] of lockerRivals()) {
    const k = `${S.season}:${a.goal.race}:${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
    const c = S.cal.find(c => c.key === a.goal.race);
    if (S.lockDone.includes(k) || !c || c.done || c.w - S.week > 10) continue;
    S.lockDone.push(k);
    S.lockAsk = { k: 'rivals', a: a.id, b: b.id, key: c.key, exp: S.week + 2, id: k };
    msg(
      '⚔️ Deux leaders pour une course',
      `${riderName(a)} et ${riderName(b)} veulent tous deux être leader à ${c.name}. À vous de trancher (onglet Équipe).`
    );
    return;
  }
}
function lockerAnswer(opt, auto) {
  const q = S.lockAsk;
  if (!q) return 'Plus de décision en attente.';
  S.lockAsk = null;
  const a = S.riders[q.a],
    b = S.riders[q.b],
    c = S.cal.find(c => c.key === q.key);
  if (!a || !b || a.team !== 0 || b.team !== 0 || !c) return 'La question ne se pose plus.';
  if (opt === 'a' || opt === 'b') {
    const W = opt === 'a' ? a : b,
      L = opt === 'a' ? b : a;
    promiseRole(W.id, c.key, true);
    W.moral = clamp(W.moral + 6, 0, 100);
    L.moral = clamp(L.moral - (charOf(L) === 'fidele' ? 3 : 9), 0, 100);
    addRel(W.id, L.id, -8);
    if (charOf(L) === 'egoiste') lockerComplain(L, `${riderName(W)} lui est préféré pour ${c.name}`);
    return `${riderName(W)} sera leader à ${c.name} (promis). ${riderName(L)} encaisse.`;
  }
  if (opt === 'co') {
    promiseRole(a.id, c.key, true);
    promiseRole(b.id, c.key, true);
    addRel(a.id, b.id, -3);
    return `${auto ? "Sans réponse de votre part, l'adjoint annonce" : 'Vous annoncez'} une co-direction à ${c.name} : il faudra les aligner tous les deux comme leaders.`;
  }
  addRel(a.id, b.id, -6);
  return 'La route décidera. La tension reste palpable.';
}

// --- Réunions d'équipe ---
const MEETS = {
  remobiliser: {
    lbl: 'Remobiliser le groupe',
    d: 'Moral en hausse pour tous (plus avec un bon capitaine et un groupe confiant).',
  },
  recadrer: { lbl: 'Recadrer', d: 'Discipline en hausse ; les égoïstes et les têtes brûlées le prennent mal.' },
  ecouter: {
    lbl: 'Écouter chacun',
    d: 'Les frustrés se sentent entendus (gros gain de moral) ; vous apprenez ce qu’ils veulent.',
  },
};
function meetReady() {
  const wk = S.season * 100 + S.week;
  return !S.meetW || wk - S.meetW >= LOCK.meetEvery;
}
function teamMeeting(k) {
  if (!MEETS[k]) return 'Réunion inconnue.';
  if (!meetReady()) return 'Une réunion a déjà eu lieu récemment : attendez quelques semaines.';
  S.meetW = S.season * 100 + S.week;
  const rs = S.teams[0].riders.map(id => S.riders[id]);
  const C = captain();
  const cb = C ? (leadOf(C) - 50) / 25 : 0;
  const tf = trustOf() < 40 ? 0.5 : trustOf() >= 75 ? 1.25 : 1;
  if (k === 'remobiliser') {
    for (const r of rs) r.moral = clamp(r.moral + (3 + cb) * tf, 0, 100);
    return `📣 Réunion : vous remobilisez le groupe${C ? `, appuyé par ${riderName(C)}` : ''}. Moral en hausse.`;
  }
  if (k === 'recadrer') {
    for (const r of rs) {
      r.dis = clamp(r.dis + 2, 0, 99);
      const ch = charOf(r);
      r.moral = clamp(r.moral + (ch === 'egoiste' || ch === 'tete' ? -5 : ch === 'fidele' ? 1 : -1), 0, 100);
    }
    return '📏 Réunion : vous recadrez le groupe. Discipline en hausse, quelques grimaces.';
  }
  const low = rs.filter(r => r.moral < 45);
  for (const r of rs) r.moral = clamp(r.moral + (r.moral < 45 ? 8 * tf : 1), 0, 100);
  const why = low
    .slice(0, 4)
    .map(r => `${riderName(r)} (${lockerWhy(r) || 'besoin de confiance'})`)
    .join(', ');
  return `👂 Réunion : chacun a pu parler.${low.length ? ' Les frustrés : ' + why + '.' : ' Personne ne se plaint vraiment.'}`;
}
// Ce qui pèse sur un coureur (lu dans son état).
function lockerWhy(r) {
  if (r.wantsOut) return 'veut partir';
  const bp = (S.proms || []).find(p => p.id === r.id && p.s === S.season && p.ok === false);
  if (bp) return 'promesse rompue';
  if (r.goal && r.goal.s === S.season && r.goal.lead && r.goal.race)
    return `veut être leader à ${goalRaceTag(r).replace('leader à ', '')}`;
  if (r.stats && r.stats.days < 10 && S.week > 12) return 'court trop peu';
  if (relationsOf(r.id).some(a => a[1] <= -40)) return 'en froid avec un équipier';
  return '';
}

// --- Chaque semaine, fin de saison ---
function lockerWeekly() {
  if (S.car) return;
  captainAuto();
  lockerAskRivals();
  // une décision ignorée deux semaines : l'adjoint tranche (co-direction)
  if (S.lockAsk && S.week > S.lockAsk.exp) msg('⚔️ Deux leaders', lockerAnswer('co', true));
  // frustrés qui parlent à la presse (au plus une fois toutes les huit semaines chacun)
  for (const id of S.teams[0].riders) {
    const r = S.riders[id];
    const ch = charOf(r);
    if (r.moral < 30 && r.amb >= 65 && (ch === 'egoiste' || ch === 'tete' || ch === 'ambitieux'))
      if (dsHash('plainte' + id + S.season + ':' + S.week) % 100 < 12)
        lockerComplain(r, lockerWhy(r) || 'son rôle dans l’équipe');
  }
  // la confiance revient doucement vers la normale
  S.trust = trustOf() + (LOCK.trust0 - trustOf()) * 0.02;
}
// Moral de la semaine : un bon capitaine et un groupe confiant tirent le moral vers le haut.
function lockerMoralTarget(r) {
  if (r.team !== 0 || S.car) return 62;
  const C = captain();
  return 62 + (C ? clamp((leadOf(C) - 55) / 10, 0, 3) : 0) + (trustOf() - LOCK.trust0) / 20 + crewMoral();
}
function lockerEndSeason() {
  if (S.car) return;
  for (const k of Object.keys(S.proMentors || {})) {
    const y = S.riders[k];
    if (!y || y.team !== 0 || y.age >= 24 || !proMentorOf(y)) delete S.proMentors[k];
  }
  S.proms = (S.proms || []).filter(p => p.s >= S.season - 2);
  S.lockDone = (S.lockDone || []).filter(k => +k.split(':')[0] >= S.season);
  if (!captain()) S.captain = null;
}
// État du vestiaire, pour l'interface.
function lockerState() {
  const rs = S.teams[0].riders.map(id => S.riders[id]);
  const mood = rs.length ? sum(rs.map(r => r.moral)) / rs.length : 50;
  const pairs = [];
  for (const k in S.rel || {}) {
    const [a, b] = k.split('-').map(Number);
    const A = S.riders[a],
      B = S.riders[b];
    if (A && B && A.team === 0 && B.team === 0 && Math.abs(S.rel[k]) >= 40) pairs.push([A, B, S.rel[k]]);
  }
  return {
    mood: Math.round(mood),
    trust: Math.round(trustOf()),
    captain: captain(),
    tensions: pairs.filter(p => p[2] < 0).sort((x, y) => x[2] - y[2]),
    friends: pairs.filter(p => p[2] > 0).sort((x, y) => y[2] - x[2]),
    frustrated: rs.filter(r => r.moral < 40 || r.wantsOut).sort((a, b) => a.moral - b.moral),
    proms: (S.proms || []).filter(p => p.s === S.season),
    mentors: Object.entries(S.proMentors || {})
      .map(([y, m]) => [S.riders[y], S.riders[m]])
      .filter(([y, m]) => y && m && y.team === 0 && m.team === 0),
  };
}
