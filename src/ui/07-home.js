/* Interface — tableau de bord, navigation mobile, fiche d'équipe et rivaux */

// Classement UCI actuel des équipes (de la première à la dernière) ; à égalité, celui de la saison passée.
function uciOrder() {
  const last = S.lastRanks || {};
  return S.teams.slice().sort((a, b) => (b.uci || 0) - (a.uci || 0) || (last[b.id] || 0) - (last[a.id] || 0));
}
// Lien vers la fiche d'une équipe.
function teamLink(T) {
  if (!T) return '—';
  return `<a class="rl" onclick="openTeam(${T.id})"><b style="color:${T.color}">■</b> ${esc(T.name)}</a>`;
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
  if (S.fired) L.push(['🚨', 'Vous êtes licencié : choisissez une offre', 'mgmt']);
  const sa = storyAsks().length;
  if (sa) L.push(['📖', `${sa} histoire${sa > 1 ? 's' : ''} : une décision vous attend`, 'stories']);
  if (S.jobOffers && S.jobOffers.length)
    L.push(['💼', `${S.jobOffers.length} offre(s) d'emploi d'autres équipes`, 'mgmt']);
  if (S.pressQ && S.pressQ.exp > S.week) L.push(['🎙️', 'Une interview attend votre réponse', 'press']);
  if (S.raiseReq) {
    const r = S.riders[S.raiseReq.id];
    if (r) L.push(['💶', `${riderName(r)} demande une augmentation`, 'team']);
  }
  if (S.budget < 0) L.push(['🔴', 'Budget dans le rouge', 'mgmt']);
  const ending = my.filter(r => r.contract <= 1 && r.nextTeam == null);
  if (ending.length && S.week >= 8) L.push(['✍️', `${ending.length} coureur(s) en fin de contrat`, 'team']);
  const rum = my.filter(r => rumorTeam(r) && r.contract <= 1 && r.nextTeam == null);
  if (rum.length)
    L.push(['💬', `Rumeur de départ : ${rum.map(r => riderName(r)).join(', ')}`, 'market', "UI.mkt='merc'"]);
  const inj = my.filter(r => r.injury > 0);
  if (inj.length) L.push(['🩹', `${inj.length} blessé(s)`, 'team']);
  const tired = my.filter(r => r.fatigue >= 70 && r.injury <= 0);
  if (tired.length) L.push(['😮‍💨', `${tired.length} coureur(s) très fatigué(s)`, 'team']);
  if (S.eqOffers && Object.keys(S.eqOffers).some(c => S.eqChoice[c] == null))
    L.push(['🚲', 'Offres des équipementiers à étudier', 'mgmt']);
  const old = S.academy.map(id => S.riders[id]).filter(r => r && r.age >= 22);
  if (old.length) L.push(['🎓', `${old.length} espoir(s) à passer pro avant la fin de saison`, 'aca']);
  if (unread) L.push(['✉️', `${unread} message(s) important(s) non lu(s)`, 'inbox']);
  const ex = S.lastExport;
  if (S.seasonRank && Object.keys(S.seasonRank).length && S.week <= 6 && (!ex || ex.season < S.season))
    L.push(['💾', 'Nouvelle saison : téléchargez un fichier de sauvegarde', 'opt']);
  return L;
}
function todoHTML(L) {
  if (!L.length) return '<p class="small mut">Rien d\'urgent. 👍</p>';
  return `<div class="todo">${L.map(
    ([ic, t, v, pre]) =>
      `<button class="todo-it" onclick="${pre ? pre + ';' : ''}go('${v}')"><span>${ic}</span><span>${esc(t)}</span><span class="mut">›</span></button>`
  ).join('')}</div>`;
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
function rivalsTable(rows) {
  const me = S.teams[0].uci || 0;
  return `<div class="tw"><table class="t"><thead><tr><th>#</th><th>Équipe</th><th>Pts</th><th>Écart</th><th title="points gagnés sur les 4 dernières semaines">4 sem.</th><th>Vict.</th></tr></thead><tbody>${rows
    .map(({ T, rank }) => {
      const d = (T.uci || 0) - me;
      return `<tr class="${T.player ? 'mrow' : ''}"><td>${rank}</td><td>${T.player ? `<b>${esc(T.name)}</b>` : teamLink(T)}</td><td>${T.uci || 0}</td><td class="${T.player ? 'mut' : d > 0 ? 'neg' : d < 0 ? 'pos' : 'mut'}">${T.player ? '—' : (d > 0 ? '+' : '') + d}</td><td>+${uciGain(T)}</td><td>${seasonWins(T.id)}</td></tr>`;
    })
    .join('')}</tbody></table></div>`;
}
// Courbes des points UCI semaine par semaine (SVG).
function rivalsChart(rows, U) {
  if (!U || U.w.length < 2) return '<p class="small mut">La courbe apparaîtra après quelques semaines de course.</p>';
  const W = 360,
    H = 170,
    pl = 34,
    pb = 18;
  const series = rows.map(({ T }) => ({ T, v: U.t[T.id] || [] }));
  const max = Math.max(10, ...series.flatMap(s => s.v));
  const n = U.w.length;
  const x = i => pl + ((W - pl - 6) * i) / (n - 1);
  const y = v => H - pb - ((H - pb - 6) * v) / max;
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const v = Math.round((max * k) / 4);
    g += `<line x1="${pl}" x2="${W - 6}" y1="${y(v)}" y2="${y(v)}" stroke="#2c3038"/><text x="${pl - 4}" y="${y(v) + 3}" text-anchor="end" class="ax">${v}</text>`;
  }
  g += `<text x="${pl}" y="${H - 3}" class="ax">S${U.w[0]}</text><text x="${W - 6}" y="${H - 3}" text-anchor="end" class="ax">S${U.w[n - 1]}</text>`;
  for (const s of series) {
    const pts = s.v.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    g += `<polyline points="${pts}" fill="none" stroke="${s.T.player ? 'var(--me)' : s.T.color}" stroke-width="${s.T.player ? 3 : 1.6}" stroke-linejoin="round"/>`;
  }
  const leg = series
    .map(
      s => `<span class="lg"><i style="background:${s.T.player ? 'var(--me)' : s.T.color}"></i>${esc(s.T.short)}</span>`
    )
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="rchart">${g}</svg><div class="small">${leg}</div>`;
}
function viewRivals() {
  const rows = rivalsWindow(2);
  const U = S.uciTrack && S.uciTrack.w.length >= 2 ? S.uciTrack : S.uciPrev;
  const prevNote = U && U.s !== S.season ? ` <span class="small mut">(saison ${U.s})</span>` : '';
  return `<div class="card"><h2>🆚 Vos rivaux au classement UCI</h2><p class="small mut">Les deux équipes devant vous et les deux derrière. Touchez une équipe pour sa fiche : matériel, stratégie, effectif estimé.</p>${rivalsTable(rows)}<h3>Évolution des points${prevNote}</h3>${rivalsChart(
    rows,
    U
  )}</div>`;
}

// ---------- Fiche d'une équipe ----------
const FOCUS_LBL = { gc: 'Classement général', sprint: 'Sprints', classiques: 'Classiques', mixte: 'Polyvalente' };
function teamCard(T) {
  if (!T) return '<p>Équipe introuvable.</p>';
  const ord = uciOrder();
  const rk = ord.indexOf(T) + 1;
  const last = S.lastRanks
    ? S.teams
        .slice()
        .sort((a, b) => (S.lastRanks[b.id] || 0) - (S.lastRanks[a.id] || 0))
        .indexOf(T) + 1
    : 0;
  const rs = T.riders.map(id => S.riders[id]).filter(Boolean);
  const est = r => (T.player ? overall(r.s) : shownOv(r));
  rs.sort((a, b) => est(b) - est(a));
  const best = k => {
    const b = rs.slice().sort((a, c) => shownStat(c, k) - shownStat(a, k))[0];
    return b ? `${rlink(b)} <span class="small mut">${T.player ? b.s[k] : '~' + shownStat(b, k)}</span>` : '—';
  };
  const gt = T.goals && T.goals.gt ? S.cal.find(c => c.key === T.goals.gt) : null;
  const moves = (S.merc || []).filter(e => e.k !== 'rumeur' && (e.f === T.short || e.t === T.short)).slice(0, 6);
  let h = `<h2><b style="color:${T.color}">■</b> ${esc(T.name)} <span class="small mut">${esc(T.short)}</span></h2>
 <div class="kv"><span>Classement UCI</span><b>${rk}e · ${T.uci || 0} pts</b><span>Victoires</span><b>${seasonWins(T.id)}</b>${last ? `<span>Saison passée</span><b>${last}e</b>` : ''}</div>`;
  if (!T.player)
    h += `<h3>Moyens</h3><div class="kv"><span>Budget salarial (estimé)</span><b>${fmtMoney(Math.round(T.budget / 50) * 50)}</b><span>Masse salariale</span><b>${fmtMoney(Math.round(payrollOf(T) / 50) * 50)}</b><span>Marge</span><b class="${payrollOf(T) > T.budget ? 'neg' : 'pos'}">${payrollOf(T) > T.budget ? 'au-dessus de ses moyens' : fmtMoney(Math.round((T.budget - payrollOf(T)) / 50) * 50)}</b></div>`;
  if (!T.player)
    h += `<h3>Stratégie</h3><div class="kv"><span>Priorité</span><b>${FOCUS_LBL[(T.goals || {}).focus] || '—'}</b><span>Grand Tour visé</span><b>${gt ? esc(gt.name) : '—'}</b><span>Style de course</span><b>${STYLES[T.style] || '—'}</b></div>`;
  h += `<h3>Matériel</h3><div class="kv">${Object.keys(EQ_CATS)
    .map(c => {
      const b = eqUsed(T, c);
      return `<span>${EQ_CATS[c].lbl}</span><b>${esc(b.name)}<div class="small mut">${eqTraits(c, b)}</div></b>`;
    })
    .join('')}</div>`;
  h += `<h3>Leaders${T.player ? '' : ' (estimés)'}</h3><div class="kv"><span>Montagne</span><b>${best('mon')}</b><span>Sprint</span><b>${best('spr')}</b><span>Classiques</span><b>${best('col')}</b><span>Pavés</span><b>${best('pav')}</b><span>Chrono</span><b>${best('clm')}</b></div>`;
  h += `<h3>Effectif (${rs.length})</h3><div class="tw"><table class="t"><tbody>${rs
    .map(
      r =>
        `<tr><td>${rlink(r)}</td><td class="small mut">${ARCH[r.arch].lbl} · ${r.age} ans</td><td>${T.player ? overall(r.s) : svOv(r)}</td><td class="small">${r.contract <= 1 && r.nextTeam == null ? '<span class="warn">fin de contrat</span>' : ''}</td></tr>`
    )
    .join('')}</tbody></table></div>`;
  if (moves.length)
    h += `<h3>Mercato récent</h3><div class="small">${moves.map(e => `${e.s} · ${MERC_KIND[e.k]} ${esc(e.n)} (${esc(e.f)} → ${esc(e.t)})`).join('<br>')}</div>`;
  return h + `<div class="row"><button class="pri" onclick="closeModal()">Fermer</button></div>`;
}

// ---------- Image de l'équipe ----------
function imageCard() {
  const L = imageLabel();
  const rows = Object.keys(IMAGE_AXES)
    .map(k => ({ k, lbl: IMAGE_AXES[k].lbl, v: Math.round(S.image[k]) }))
    .sort((a, b) => b.v - a.v);
  return `<div class="card"><h2>🪪 Image de l'équipe : ${esc(L.lbl)}</h2><details class="info"><summary>ℹ️ Explications</summary><p class="small mut">Elle se construit avec vos résultats (victoires, classements, maillots, échappées, jeunes lancés) et s'estompe en partie chaque hiver. Les coureurs du même profil signent plus volontiers et demandent un peu moins ; une identité forte rapporte jusqu'à 8 % de plus à la renégociation du sponsor.</p></details><table class="t"><tbody>${rows
    .map(
      x =>
        `<tr class="${x.k === L.k ? 'mrow' : ''}"><td>${x.lbl}</td><td style="width:45%">${bar(x.v, 100, 'b')}</td><td>${x.v}</td></tr>`
    )
    .join('')}</tbody></table></div>`;
}

// ---------- Tableau de bord ----------
function viewHome() {
  const P0 = S.teams[0];
  const ord = uciOrder();
  const rk = ord.indexOf(P0) + 1;
  const objOk = S.obj ? S.obj.filter(o => objStatus(o).ok).length : 0;
  const i = nextRaceIdx();
  const c = i >= 0 ? S.cal[i] : null;
  let h = `<div class="card next-act"><div class="row sb"><h2>${c ? `${c.w > S.week ? `Dans ${c.w - S.week} sem.` : 'Cette semaine'} : ${esc(c.name)}` : `Saison ${S.season} terminée`}</h2>${c ? `<span>${stageIcons(c.stagesSpec)}</span>` : ''}</div>${c ? `<div class="small mut">Tendance météo de la semaine : ${WX_REGIME[regimeAt(c.w)]}</div>` : ''}${nextActionHTML()}</div>`;
  h += `<div class="card"><h3>À traiter</h3>${todoHTML(todoList())}</div>`;
  h += `<div class="card"><h3>Situation</h3><div class="kpis">
  <div class="kpi" onclick="UI.stats='rivals';go('stats')"><b>${S.teams.some(t => t.uci) ? rk + 'e' : '—'}</b><span>UCI · ${P0.uci || 0} pts</span></div>
  <div class="kpi" onclick="UI.stats='season';go('stats')"><b>${seasonWins(0)}</b><span>victoires</span></div>
  <div class="kpi" onclick="go('mgmt')"><b class="${S.budget < 0 ? 'neg' : ''}">${fmtMoney(S.budget)}</b><span>budget</span></div>
  <div class="kpi" onclick="go('mgmt')"><b>${objOk}/${(S.obj || []).length}</b><span>objectifs sponsor</span></div>
 </div>
 <div class="rgrid small"><span>Confiance du sponsor ${bar(S.conf)}</span><span>Notoriété ${bar(repOf())} <span class="mut">${repLabel(repOf())}</span></span></div>
 <div class="small" style="margin-top:6px">🪪 Image : <a class="rl" onclick="go('mgmt')">${esc(imageLabel().lbl)}</a></div>${wtBriefHTML()}</div>`;
  h += `<div class="card"><div class="row sb"><h3>🆚 Rivaux</h3><button class="small" onclick="UI.stats='rivals';go('stats')">Détail</button></div>${rivalsTable(rivalsWindow(1))}</div>`;
  const news = S.inbox.slice(0, 4);
  if (news.length)
    h += `<div class="card"><div class="row sb"><h3>Dernières nouvelles</h3><button class="small" onclick="go('inbox')">Messages</button></div>${news
      .map(
        m =>
          `<div class="small news ${m.read ? '' : 'unread'}"><b>${esc(m.title)}</b> <span class="mut">S${m.w}</span></div>`
      )
      .join('')}</div>`;
  return h;
}

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
    ['aca', '🎓', 'Académie', cnt('aca')],
    ['mgmt', '💼', 'Gestion', cnt('mgmt') + (S.fired ? 1 : 0)],
    ['stories', '📖', 'Histoires', storyAsks().length],
    ['press', '📰', 'Presse', S.pressQ ? 1 : 0],
    ['stats', '📊', 'Stats', 0],
    ['inbox', '✉️', 'Messages', unread],
    ['opt', '⚙️', 'Options', 0],
  ];
}
function badge(n) {
  return n ? `<i class="bdg">${n > 9 ? '9+' : n}</i>` : '';
}
// Barre du bas (écrans étroits) : quatre raccourcis et « Plus ».
function bottomNavHTML() {
  const it = navItems();
  const inRace = it.some(x => x[0] === 'race');
  const main = ['home', 'team', 'cal', inRace ? 'race' : 'market'];
  const more = it.filter(x => !main.includes(x[0]));
  const moreN = more.reduce((a, x) => a + (x[0] === 'home' ? 0 : x[3]), 0);
  /** @param {any[]} x */
  const btn = x =>
    `<button class="${UI.view === x[0] ? 'on' : ''}" onclick="go('${x[0]}')"><span class="ic">${x[1]}${badge(x[0] === 'home' ? 0 : x[3])}</span>${x[2]}</button>`;
  return (
    main.map(k => btn(it.find(x => x[0] === k))).join('') +
    `<button class="${more.some(x => x[0] === UI.view) ? 'on' : ''}" onclick="openNav()"><span class="ic">☰${badge(moreN)}</span>Plus</button>`
  );
}
function openNav() {
  UI.modal = { type: 'nav' };
  renderModal();
}
function navSheet() {
  return `<div class="navgrid">${navItems()
    .map(
      ([k, ic, l, n]) =>
        `<button class="${UI.view === k ? 'on' : ''}" onclick="closeModal();go('${k}')"><span class="ic">${ic}${badge(k === 'home' ? 0 : n)}</span>${l}</button>`
    )
    .join('')}</div>`;
}
