/* Interface — tableau de bord, navigation mobile, fiche d'équipe et rivaux */

// Classement UCI actuel des équipes (de la première à la dernière) ; à égalité, celui de la saison passée.
function uciOrder() {
  const last = S.lastRanks || {};
  return S.teams.slice().sort((a, b) => (b.uci || 0) - (a.uci || 0) || (last[b.id] || 0) - (last[a.id] || 0));
}
function openTeam(id) {
  UI.modal = { type: 'team', id };
  renderModal();
}

// ---------- Choses à traiter ----------
// Chaque alerte : icône, texte, écran où agir.
function todoList() {
  const L = [];
  const my = myRiders();
  const unread = S.inbox.filter(m => !m.read && (m.imp != null ? m.imp : msgImportant(m.title, m.body))).length;
  if (S.fired) L.push(['🚨', 'Vous êtes licencié : choisissez une offre', 'career']);
  if (S.lockAsk && S.riders[S.lockAsk.a] && S.riders[S.lockAsk.b])
    L.push(['⚔️', `${riderName(S.riders[S.lockAsk.a])} et ${riderName(S.riders[S.lockAsk.b])} veulent être leader sur la même course`, 'locker']);
  const sa = storyAsks().length;
  if (sa) L.push(['📖', `${sa} histoire${sa > 1 ? 's' : ''} : une décision vous attend`, 'stories']);
  if (S.jobOffers && S.jobOffers.length)
    L.push(['💼', `${S.jobOffers.length} offre(s) d'emploi d'autres équipes`, 'career']);
  if (S.pressQ && S.pressQ.exp > S.week) L.push(['🎙️', 'Une interview attend votre réponse', 'press']);
  if (S.bid && S.riders[S.bid.id] && teamById(S.bid.t))
    L.push(['💰', `${teamById(S.bid.t).name} veut ${riderName(S.riders[S.bid.id])}`, 'team']);
  if (S.raiseReq) {
    const r = S.riders[S.raiseReq.id];
    if (r) L.push(['💶', `${riderName(r)} demande une augmentation`, 'team']);
  }
  if (S.budget < 0) L.push(['🔴', 'Budget dans le rouge', 'fin']);
  const ending = my.filter(r => r.contract <= 1 && r.nextTeam == null);
  if (ending.length && S.week >= 8) L.push(['✍️', `${ending.length} coureur(s) en fin de contrat`, 'team']);
  const rum = my.filter(r => rumorTeam(r) && r.contract <= 1 && r.nextTeam == null);
  if (rum.length)
    L.push(['💬', `Rumeur de départ : ${rum.map(r => riderName(r)).join(', ')}`, 'market', "UI.mkt='merc'"]);
  const inj = my.filter(r => r.injury > 0);
  if (inj.length) L.push(['🩹', `${inj.length} blessé(s) ou malade(s)`, 'prepa']);
  const tired = my.filter(r => r.fatigue >= 70 && r.injury <= 0);
  if (tired.length) L.push(['😮‍💨', `${tired.length} coureur(s) très fatigué(s)`, 'team']);
  if (S.eqOffers && Object.keys(S.eqOffers).some(c => S.eqChoice[c] == null))
    L.push(['🚲', 'Offres des équipementiers à étudier', 'equip']);
  const old = S.academy.map(id => S.riders[id]).filter(r => r && r.age >= 22);
  if (old.length) L.push(['🎓', `${old.length} espoir(s) à passer pro avant la fin de saison`, 'aca']);
  if (unread) L.push(['✉️', `${unread} message(s) important(s) non lu(s)`, 'inbox']);
  const ex = S.lastExport;
  if (S.seasonRank && Object.keys(S.seasonRank).length && S.week <= 6 && (!ex || ex.season < S.season))
    L.push(['💾', 'Nouvelle saison : téléchargez un fichier de sauvegarde', 'opt']);
  return L;
}

// ---------- Rivaux ----------
// Les équipes qui vous entourent au classement UCI (deux devant, deux derrière).
function rivalsWindow(n = 2) {
  const ord = uciOrder();
  const i = ord.indexOf(S.teams[0]);
  let a = Math.max(0, i - n),
    b = Math.min(ord.length, a + 2 * n + 1);
  a = Math.max(0, b - 2 * n - 1);
  return ord.slice(a, b).map(T => ({ T, rank: ord.indexOf(T) + 1 }));
}
// Gain de points UCI sur les k dernières semaines relevées.
function uciGain(T, k = 4) {
  const U = S.uciTrack;
  if (!U || U.s !== S.season) return 0;
  const a = U.t[T.id];
  if (!a || a.length < 2) return 0;
  return (T.uci || 0) - a[Math.max(0, a.length - 1 - k)];
}

// ---------- Fiche d'une équipe ----------
const FOCUS_LBL = { gc: 'Classement général', sprint: 'Sprints', classiques: 'Classiques', mixte: 'Polyvalente' };

// ---------- Navigation ----------
// Sections du jeu, avec leurs pastilles (nombre de choses à traiter).
function navItems() {
  const inRace = !!(S.rc && !S.rc.done);
  const unread = S.inbox.filter(m => !m.read && (m.imp != null ? m.imp : msgImportant(m.title, m.body))).length;
  const todo = todoList();
  const cnt = v => todo.filter(t => t[2] === v).length;
  return [
    ['home', '🏠', 'Accueil', todo.length],
    ['team', '👥', 'Équipe', cnt('team')],
    ['cal', '📅', 'Calendrier', 0],
    ...(inRace ? [['race', '🏁', 'Course', 0]] : []),
    ['market', '🛒', 'Marché', cnt('market')],
    ...(discoOpen('aca') ? [['aca', '🎓', 'Académie', cnt('aca')]] : []),
    ['mgmt', '💼', 'Gestion', cnt('mgmt')],
    ...(discoOpen('stories') ? [['stories', '📖', 'Histoires', storyAsks().length]] : []),
    ...(discoOpen('press') ? [['press', '📰', 'Presse', S.pressQ ? 1 : 0]] : []),
    ['stats', '📊', 'Stats', 0],
    ['inbox', '✉️', 'Messages', unread],
    ['opt', '⚙️', 'Options', 0],
    // (nouveaux écrans de la navigation en espaces : leurs compteurs)
    ['prepa', '', 'Préparation', cnt('prepa')],
    ['locker', '', 'Vestiaire', cnt('locker')],
    ['fin', '', 'Finances', cnt('fin')],
    ['equip', '', 'Matériel', cnt('equip')],
    ['career', '', 'Carrière', cnt('career') + (S.fired ? 1 : 0)],
  ];
}
function badge(n) {
  return n ? `<i class="bdg">${n > 9 ? '9+' : n}</i>` : '';
}
function openNav() {
  UI.modal = { type: 'nav' };
  renderModal();
}
