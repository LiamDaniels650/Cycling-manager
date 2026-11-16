/* Interface — course en direct : boucle de temps et vitesses, retransmission (profil, groupes, écarts), carte
   du final et photo-finish, groupes et coureurs, radio et appels, négociations, alliances. */

// Vitesses de la course en direct : pas de simulation (30 s de course) par seconde réelle.
// 0,25 pas/s = 7,5 fois le temps réel (une étape de 4 h 30 dure environ 36 minutes).
const SPEEDS = [0, 0.25, 0.5, 1.5, 5, 20];
const SPEED_LBL = ['⏸', '🐢', '▶', '▶▶', '▶▶▶', '⏩'];
const LOOP_MS = 180;
// Avance rapide jusqu'au prochain moment clé (final de l'étape, attaque, incident ou appel radio de l'équipe).
function keyMoments() {
  UI.keyMode = !UI.keyMode;
  const b = UI.baseSpeed;
  if (UI.keyMode) setSpeed(5);
  else setSpeed(2);
  if (UI.keyMode) UI.baseSpeed = b; // l'avance rapide ponctuelle ne change pas la vitesse choisie
}
// Rythme automatique : la course file quand il ne se passe rien (début et milieu d'étape, aucun moment fort récent,
// aucun appel de l'équipe) et revient à la vitesse choisie dès que ça bouge. Le final reste géré par le ralenti
// des derniers kilomètres. N'affecte que l'affichage : la course simulée est la même à toute vitesse.
function paceLevel(sim) {
  const A = sim.groups.find(G => G.riders.some(x => !x.fin));
  if (!A) return 'live';
  const kmL = sim.dist - A.pos;
  if (kmL <= 15 || sim.ask) return 'live';
  const hls = sim.hls || [];
  const last = hls[hls.length - 1];
  if (last && sim.t - last.t < (last.mine ? 8 : 4)) return 'live';
  if (sim.runners.some(x => x.player && !x.fin && !x.dnf && (x.hungry || x.bonk || sim.t - (x.dropT ?? -99) < 3)))
    return 'live';
  const pel = sim.pel || A;
  if (sim.brkState === 'fight' && kmL > 50 && !pel.surf && pel.g < 5) return 'fight';
  if (kmL <= 25 || sim.brkState === 'fight' || pel.surf || pel.g >= 5 || (pel.expo && sim.P.wind >= 2)) return 'mod';
  return kmL > 50 ? 'calm' : 'mod';
}
function autoPace(sim) {
  if (UI.autoPace === false || UI.keyMode || !UI.speed) return;
  const A = sim.groups.find(G => G.riders.some(x => !x.fin));
  if (A && sim.dist - A.pos <= 8) {
    UI.paceState = 'live';
    return; // le final a son propre ralenti
  }
  const base = UI.baseSpeed || 2;
  const lvl = paceLevel(sim);
  UI.paceState = lvl;
  const target =
    lvl === 'calm' ? Math.max(base, 5) : lvl === 'fight' ? Math.max(base, 4) : lvl === 'mod' ? Math.max(base, 3) : base;
  if (target !== UI.speed) {
    if (target < UI.speed) UI.acc = 0; // retour au direct : on ne saute pas le moment
    UI.speed = target;
  }
}
function startTimer() {
  stopTimer();
  UI.timer = setInterval(loop, LOOP_MS);
}
function stopTimer() {
  if (UI.timer) clearInterval(UI.timer);
  UI.timer = null;
}
function loop() {
  const sim = UI.sim;
  if (!sim) return stopTimer();
  if (UI.view !== 'race') return;
  autoPace(sim);
  UI.acc = (UI.acc || 0) + ((SPEEDS[UI.speed] || 0) * LOOP_MS) / 1000;
  const n = Math.floor(UI.acc);
  UI.acc -= n;
  for (let i = 0; i < n && !sim.done; i++) {
    simTick(sim);
    // les derniers kilomètres au ralenti, pour les vivre (une fois par seuil : le joueur peut réaccélérer)
    const A = sim.groups.find(G => G.riders.some(x => !x.fin));
    if (A && !UI.noSlow) {
      const kmL = sim.dist - A.pos;
      UI.slowMark = UI.slowMark || {};
      const key = S.rc.calIdx + '-' + S.rc.si;
      if (kmL <= 1.6 && UI.speed > 1 && !UI.slowMark['b' + key]) {
        UI.slowMark['b' + key] = true;
        UI.speed = 1;
        UI.acc = 0;
        break;
      }
      if (kmL <= 8 && UI.speed > 2 && !UI.slowMark['a' + key]) {
        UI.slowMark['a' + key] = true;
        UI.speed = 2;
        UI.acc = 0;
        UI.flashRace = '🎬 Derniers kilomètres : la course passe au ralenti (vous pouvez réaccélérer).';
        break;
      }
    }
    // « moments clés » : on file à toute vitesse jusqu'au final ou jusqu'à un événement qui concerne l'équipe
    if (UI.keyMode) {
      // distance de la tête de course (comme l'écran du final), pas du peloton
      const A = sim.groups.find(G => G.riders.some(x => !x.fin));
      const kmL = A ? sim.dist - A.pos : 0;
      const ev = sim.ask || ((sim.hls || []).length > (UI.hlSeen || 0) && sim.hls[sim.hls.length - 1].mine);
      if (kmL <= (UI.keyKm || 30) || ev) {
        UI.keyMode = false;
        UI.speed = 2;
        UI.flashRace = ev
          ? '🎬 Un moment important pour votre équipe.'
          : `🎬 Le final approche : la tête de course est à ${Math.round(kmL)} km.`;
        UI.acc = 0;
        break;
      }
    }
    // rythme auto : un moment fort ou un appel interrompt l'accélération tout de suite
    if (UI.autoPace !== false && !UI.keyMode && UI.speed > (UI.baseSpeed || 2) && paceLevel(sim) === 'live') {
      UI.speed = UI.baseSpeed || 2;
      UI.acc = 0;
      UI.paceState = 'live';
      i = n;
    }
    // moments forts : bandeau, et pause si demandée
    const hls = sim.hls || [];
    if (hls.length > (UI.hlSeen || 0)) {
      const hl = hls[hls.length - 1];
      UI.hlSeen = hls.length;
      UI.banner = { txt: hl.txt, mine: hl.mine, until: Date.now() + 4500 };
      if (UI.pauseHl && UI.speed) sim.pauseReq = sim.pauseReq || hl.txt;
    }
    if (sim.pauseReq) {
      UI.speed = 0;
      UI.flashRace = '⏸ ' + sim.pauseReq;
      sim.pauseReq = null;
      break;
    }
  }
  if (sim.done) {
    stopTimer();
    finishStageUI();
    return;
  }
  if (n > 0 || UI.dirty) {
    UI.dirty = false;
    renderLive();
  } else if (UI.speed || (UI.banner && Date.now() < UI.banner.until + 400)) {
    // entre deux pas : seule la retransmission est redessinée (mouvement fluide)
    const el = $('#tv');
    if (el) el.innerHTML = tvHTML(UI.acc);
  }
}
function setSpeed(k) {
  UI.speed = k;
  if (k > 0) UI.baseSpeed = k;
  UI.acc = 0.99; // premier pas immédiat
  if (!UI.timer) startTimer();
  renderLive();
}
function toEnd() {
  const sim = UI.sim;
  let guard = 0;
  sim.autoPause = false;
  while (!sim.done && guard++ < 5000) simTick(sim);
  sim.pauseReq = null;
  stopTimer();
  finishStageUI();
}
function finishStageUI() {
  const rc = S.rc;
  UI.lastStage = { idx: rc.si - 1, sim: UI.sim };
  UI.sim = null;
  save();
  render();
  window.scrollTo(0, 0);
}
function viewLive() {
  return `<div id="live">${liveHTML()}</div>`;
}
function renderLive() {
  const el = $('#live');
  if (el) el.innerHTML = liveHTML();
  if (UI.modal && UI.modal.type === 'radio') renderModal();
}
function effortIcon(I) {
  if (I == null) return '';
  return I < 0.6
    ? '<span title="facile">🟢</span>'
    : I < 0.8
      ? '<span title="régulier">🟡</span>'
      : I < 0.95
        ? '<span title="dur">🟠</span>'
        : '<span title="à bloc">🔴</span>';
}
function grpLabel(sim, G, i) {
  if (i === 0 && !sim.finish.length) return G === sim.pel ? 'Peloton (tête)' : 'Tête de course';
  if (i === 0 && G !== sim.pel) return 'Groupe 1';
  if (G === sim.pel) return 'Peloton';
  return 'Groupe ' + (i + 1);
}
function posLbl(p) {
  return p > 75 ? 'devant' : p > 45 ? 'milieu' : 'arrière';
}
// Le final (15 derniers km) : compte à rebours, tête de course et poursuivants avec leurs écarts, qui roule,
// tendance de l'écart et projection, terrain qui reste, derniers faits ; puis la photo-finish.
function finaleHTML(sim) {
  const A = sim.groups.find(G => G.riders.some(x => !x.fin));
  if (sim.photo) return photoHTML(sim);
  if (!A) return '';
  const kmL = sim.dist - A.pos;
  if (kmL > FINALE_KM) return '';
  // les groupes qui font la course : ceux devant le peloton, le peloton, et derrière seulement ceux où roulent
  // mes coureurs ou des favoris (les autres lâchés ne changent rien au final)
  const live = sim.groups.filter(G => G.riders.some(x => !x.fin));
  const pel = live.includes(sim.pel) ? sim.pel : live[0];
  const ahead = live.filter(G => G.pos > pel.pos + 0.001).slice(0, 3);
  const behind = live
    .filter(G => G.pos < pel.pos - 0.001 && G.riders.some(x => !x.fin && (x.player || sim.favs.has(x.id))))
    .slice(0, 2);
  const gs = [...ahead, pel, ...behind];
  const P = sim.P;
  // ce qui reste à franchir
  const lc = P.climbs.filter(c => c.end > A.pos).slice(-1)[0];
  const sec = (P.sectors || []).filter(c => c.end > A.pos);
  let terr = '';
  if (lc && lc.end >= sim.dist - 0.5)
    terr = `Arrivée au sommet : ${esc(lc.name)}, ${lc.len.toFixed(1)} km à ${lc.avg.toFixed(1)} %`;
  else if (lc)
    terr = `Dernière difficulté : ${esc(lc.name)} (${lc.len.toFixed(1)} km à ${lc.avg.toFixed(1)} %) ${lc.start > A.pos ? `dans ${(lc.start - A.pos).toFixed(1)} km` : 'en cours'}, sommet à ${(sim.dist - lc.end).toFixed(1)} km de l'arrivée`;
  else if (sec.length)
    terr = `Encore ${sec.length} secteur${sec.length > 1 ? 's' : ''} pavé${sec.length > 1 ? 's' : ''}`;
  else
    terr =
      P.finishGrad >= 3 ? `Arrivée en côte (${P.finishGrad.toFixed(1)} %)` : 'Arrivée plate : place aux sprinteurs';
  const big = kmL <= 1 ? '🚩 ' + Math.max(0, Math.round(kmL * 1000)) + ' m' : kmL.toFixed(1).replace('.', ',') + ' km';
  let h = `<div class="card finale"><div class="row sb"><span class="fin-km">${big}</span><span class="small mut">${terr}</span></div>`;
  gs.forEach((G, i) => {
    const n = G.riders.filter(x => !x.fin).length;
    const nMine = G.riders.filter(x => !x.fin && x.player).length;
    const gap = i ? fmtGap(gapSec(gs[0], G)) : 'Tête';
    const wt = workingTeams(G);
    const isPel = G === pel && n > 12;
    const who = isPel
      ? `<b>Peloton${ahead.length ? '' : ' groupé'}</b> (${n})${nMine ? ` · ${nMine} de mes coureurs` : ''}`
      : `<b>${n === 1 ? 'Seul' : n + ' coureurs'}</b> · ${notableNames(sim, G, 4).map(esc).join(', ')}${n > 4 ? ` <span class="mut">+${n - 4}</span>` : ''}`;
    const lab = i > ahead.length ? 'Lâchés, roulent' : i ? 'Roulent' : 'Mènent';
    const wtx = wt
      .slice(0, 3)
      .map(w => esc(w[0]) + (w[1] > 1 ? ` (${w[1]})` : ''))
      .join(', ');
    h += `<div class="fin-g ${nMine ? 'mine' : ''}"><span class="fin-gap">${gap}</span><div>${who}${wt.length ? `<div class="small mut">${lab} : ${wtx}</div>` : ''}</div></div>`;
  });
  // mon coureur le mieux placé, en une ligne : où il est, à combien de la tête, avec quelles réserves
  const best = sim.runners
    .filter(x => x.player && !x.fin && !x.dnf && x.g)
    .sort((p, q) => q.g.pos - p.g.pos || q.energy - p.energy)[0];
  if (best) {
    const where = best.g === gs[0] ? 'en tête de course' : best.g === pel ? 'dans le peloton' : 'dans un groupe';
    const gp = best.g === gs[0] ? '' : ` à ${fmtGap(gapSec(gs[0], best.g))}`;
    h += `<div class="small"><b>★ ${esc(riderName(best.r))}</b> ${where}${gp} · réserves ${Math.round(best.energy)} % ${effortIcon(best.I)}</div>`;
  }
  // la tendance compare la tête au peloton (pas aux lâchés)
  const tr = ahead.length ? finaleTrend(sim) : null;
  if (tr) {
    const sl = Math.abs(tr.slope).toFixed(0);
    h += `<div class="fin-tr">${
      tr.slope < -0.5
        ? `📉 L'écart fond de ${sl} s/km. ${tr.catchAt != null ? `<b>Jonction prévue vers ${tr.catchAt.toFixed(1).replace('.', ',')} km de l'arrivée.</b>` : `<b>La tête devrait garder environ ${tr.keep} s.</b>`}`
        : tr.slope > 0.5
          ? `📈 L'écart grandit de ${sl} s/km : <b>la tête prend le large.</b>`
          : `➡️ L'écart se stabilise autour de ${Math.round(tr.gap)} s.`
    }</div>`;
  }
  const facts = sim.log
    .filter(l => l.km >= sim.dist - FINALE_KM && /^(🔥|⚔️|💥|⬇️|⚡|🚀|📍|🚩|🏁|🗡️|🤝|🔁)/.test(l.txt))
    .slice(-3)
    .reverse();
  if (facts.length) h += `<div class="fin-facts">${facts.map(l => `<div class="small">${l.txt}</div>`).join('')}</div>`;
  return h + '</div>';
}
// Photo-finish : l'ordre d'arrivée du premier groupe, avec les écarts comme on les lit sur la ligne.
function photoHTML(sim) {
  const ph = sim.photo;
  const fin = sim.finish;
  const first = fin[0];
  const lbl = d =>
    d < 0.35
      ? 'un boyau'
      : d < 1
        ? 'une demi-longueur'
        : d < 2.2
          ? 'une longueur'
          : `${Math.min(5, Math.max(2, Math.round(d / 1.5)))} longueurs`;
  let h = `<div class="card finale photo"><div class="row sb"><span class="fin-km">🏁 Arrivée</span><span class="small mut">${ph.kind === 'sprint' ? ((ph.n || ph.ord.length) > 40 ? 'Sprint massif' : `Sprint d'un groupe de ${ph.n || ph.ord.length}`) : ph.kind === 'seul' ? 'Victoire en solitaire' : 'Arrivée en côte'}</span></div>`;
  const rows = ph.ord.slice(0, 6).map((o, i) => {
    const x = sim.runners.find(y => y.id === o.id);
    const prev = i ? ph.ord[i - 1] : null;
    const gapTxt = !i ? '🥇' : ph.kind === 'sprint' ? `à ${lbl(prev.s - o.s)}` : fmtGap(x.time - first.time);
    return `<div class="fin-g ${x.player ? 'mine' : ''}" style="animation-delay:${i * 0.35}s"><span class="fin-gap">${i + 1}</span><div><b>${x.player ? '★ ' : ''}${esc(riderName(x.r))}</b> <span class="mut">${esc(x.team.short)}</span> <span class="small">${gapTxt}</span></div></div>`;
  });
  h += rows.join('');
  if (ph.kind === 'seul') {
    const second = fin.find(x => x !== first);
    if (second)
      h += `<div class="fin-tr">Avance sur le premier poursuivant : <b>${fmtGap(second.time - first.time)}</b></div>`;
    else h += `<div class="fin-tr">Les poursuivants sont attendus…</div>`;
  }
  const mine = fin.filter(x => x.player);
  if (mine.length)
    h += `<div class="small">Mes coureurs déjà arrivés : ${mine.map(x => `${fin.indexOf(x) + 1}e ${esc(riderName(x.r))}`).join(', ')}</div>`;
  return h + '</div>';
}
// Course en direct : groupes, écarts, mes coureurs, journal.
// Course en direct : retransmission (profil animé, écarts, graphique), groupes, mes coureurs, radio-course.
function liveHTML() {
  const sim = UI.sim;
  const spec = sim.spec;
  const rc = S.rc;
  sim.groups = sim.groups.filter(G => G.riders.length);
  const front = sim.groups[0];
  let h = `<div class="card tvc"><div class="row sb"><b>${esc(rc.name)} — ${esc(spec.name)}</b></div>
 ${sim.wx && sim.wx !== 'sec' ? `<div class="small">${WX[sim.wx]}</div>` : ''}
 <div id="tv">${tvHTML(UI.acc || 0)}</div>
 ${UI.flashRace ? `<div class="flash">${UI.flashRace}</div>` : ''}${askHTML(sim)}</div>`;
  h += finaleHTML(sim);
  // en bref : la course en une phrase (tête, peloton, qui roule)
  const brief = sim.groups.length && !sim.finish.length ? finaleSituation(sim) : '';
  h += `<div class="card"><h3>Course</h3>${brief ? `<div class="brief">📡 ${esc(brief)}</div>` : ''}`;
  // groupes qui font la course : devant le peloton, le peloton, puis seulement les groupes de lâchés où sont mes
  // coureurs ou des favoris ; les autres sont résumés
  const pelG = sim.groups.includes(sim.pel) ? sim.pel : null;
  const shown = pelG
    ? [
        ...sim.groups.filter(G => G.pos > pelG.pos + 0.001).slice(0, 5),
        pelG,
        ...sim.groups
          .filter(G => G.pos < pelG.pos - 0.001 && G.riders.some(x => x.player || sim.favs.has(x.id)))
          .slice(0, 3),
      ]
    : sim.groups.slice(0, 7);
  shown.forEach(G => {
    const i = sim.groups.indexOf(G);
    const gap = i ? gapSec(front, G) : 0;
    const mine = G.riders.filter(x => x.player);
    const fav = G.riders.filter(x => !x.player && (sim.favs.has(x.id) || jersey(x.id)));
    const names =
      G.riders.length <= 8 ? G.riders.filter(x => !x.player).map(x => riderTag(x)) : fav.map(x => '★ ' + riderTag(x));
    const workT = [...new Set(G.riders.filter(x => x.work > 0).map(x => x.team))];
    h += `<div class="grp ${mine.length ? 'gmine' : ''}"><div class="row sb"><b>${grpLabel(sim, G, i)} · ${G.riders.length}</b><span>${i ? fmtGap(gap) : ''} <span class="mut small">${G.speed.toFixed(1)} km/h${groupWkg(G)}</span></span></div>
  <div class="small">${mine.map(x => `<b class="me">${riderName(x.r)}</b>${jersey(x.id)}`).join(', ')}${mine.length && names.length ? ' · ' : ''}${names.join(', ')}</div>
  ${
    workT.length
      ? `<div class="small mut">Mènent : ${workT
          .slice(0, 6)
          .map(T => tcol(T) + T.short)
          .join(' ')}${workT.length > 6 ? '…' : ''}</div>`
      : ''
  }</div>`;
  });
  if (sim.groups.length > shown.length) {
    const rest = sim.groups.filter(G => !shown.includes(G));
    const n = sum(rest.map(G => G.riders.length));
    const mine = rest.flatMap(G => G.riders.filter(x => x.player));
    h += `<div class="small mut">+ ${n} coureur${n > 1 ? 's' : ''} dans ${rest.length} autre${rest.length > 1 ? 's' : ''} groupe${rest.length > 1 ? 's' : ''}${mine.length ? ' dont ' + mine.map(x => riderName(x.r)).join(', ') : ''}</div>`;
  }
  if (sim.finish.length)
    h += `<div class="small">Arrivés : ${sim.finish
      .slice(0, 3)
      .map((x, i) => `${i + 1}. ${riderName(x.r)}`)
      .join(' · ')}${sim.finish.length > 3 ? ' …' : ''}</div>`;
  h += `</div>`;
  h += `<div class="card"><div class="row sb"><h3>Mes coureurs</h3><span class="small mut" title="Ordre des voitures derrière le peloton : selon le général (ou le classement UCI). Plus la voiture est loin, plus un dépannage coûte cher.">🚗 voiture ${carRank(sim, S.teams[0])}e dans la file</span></div>${negoHTML(sim)}`;
  // mes coureurs, du mieux placé au moins bien placé ; une ligne compacte chacun
  const order = x => (x.dnf ? 3e6 : x.fin ? 2e6 + sim.finish.indexOf(x) : x.g ? -x.g.pos * 100 - x.pos / 100 : 1e6);
  for (const x of sim.runners.filter(x => x.player).sort((a, b) => order(a) - order(b))) {
    const gi = x.g ? sim.groups.indexOf(x.g) : -1;
    const st = x.dnf
      ? '<span class="badge r">abandon</span>'
      : x.fin
        ? `<span class="badge">arrivé ${sim.finish.indexOf(x) + 1}e</span>`
        : gi >= 0
          ? `${grpLabel(sim, x.g, gi)}${gi ? ' <b>' + fmtGap(gapSec(front, x.g)) + '</b>' : ''}${x.g.riders.length >= 8 ? ` · ${posLbl(x.pos)}` : ''}`
          : '';
    const eo = effOrder(x);
    const ol = (RADIO[x.radio] || ORDERS[eo] || { lbl: eo }).lbl;
    const flags = [
      x.rebel ? '<span class="badge r">rebelle</span>' : '',
      x.bonk ? '<span class="badge r">fringale</span>' : '',
      x.aim ? `<span class="badge">🎯 ${x.aim === 'kom' ? 'montagne' : 'points'}</span>` : '',
      x.markId ? '<span class="badge">marquage</span>' : '',
      x.conds && x.conds.some(c => !c.done) ? '<span class="badge">ordre conditionnel</span>' : '',
    ].join('');
    const meter = meterHTML;
    const out = x.fin || x.dnf;
    h += `<div class="rc2 ${out ? 'done' : ''}">
  <div class="rc2-h"><div>${rlink(x.r)}${jersey(x.id)} <span class="chip2">${esc(ol)}</span>${flags}</div>${out ? '' : `<button class="ibtn" title="Radio" onclick="openRadio(${x.id})">📻</button>`}</div>
  <div class="rc2-s small">${effortIcon(out ? null : x.I)} ${st}</div>
  ${out ? '' : `<div class="rc2-m">${meter('Fond', x.energy, 'mf')}${meter('Jus', x.punch, 'mj')}${meter('Alim.', x.food, 'ma')}</div><div class="small mut">${liveWatts(x)}${x.pocket ? ` · 🍫 ${x.pocket} barre${x.pocket > 1 ? 's' : ''}` : ''}</div>`}
</div>`;
  }
  h += allyHTML(sim);
  h += `<div class="row wrap small">Équipe : <button onclick="teamRadio('chase')">Rouler</button><button onclick="teamRadio('stop')">Arrêter</button><button onclick="teamRadio('front')">Se placer devant</button>${sim.P.wind ? `<button onclick="teamRadio('echelon')">🌬️ Bordure !</button>` : ''}<button onclick="teamRadio('reset')">Consignes</button></div>
 <details class="info"><summary>ℹ️ Explications</summary><p class="small mut">Fond = réserves de la journée ; Jus = explosivité (attaques, relances), se recharge à l'abri. 🍌 = alimentation (sous 30 %, risque de fringale) : musette à mi-course, soigneurs en plus avec le ravitaillement renforcé, 🍫 = barres en poche (radio « Mange maintenant »), ou bidons apportés par un équipier.</p></details></div>`;
  const feedRow = l =>
    `<div class="fl ${l.cls}"><span class="fk">km ${l.km.toFixed(0)}</span><span>${l.txt}</span></div>`;
  const lg = sim.log.slice().reverse();
  h += `<div class="card"><h3>Radio-course</h3><div class="feed">${lg.slice(0, 12).map(feedRow).join('')}</div>${
    lg.length > 12
      ? `<details class="manage"><summary>Plus ancien (${Math.min(28, lg.length - 12)})</summary><div class="feed">${lg.slice(12, 40).map(feedRow).join('')}</div></details>`
      : ''
  }</div>`;
  h += dockHTML();
  return h;
}
// Appel radio d'un coureur qui attend une décision de la voiture.
function askHTML(sim) {
  const a = sim.ask;
  if (!a) return '';
  const left = Math.max(0, Math.round((a.exp - sim.t) * 60));
  return `<div class="ally on ask"><b>${esc(a.txt)}</b><div class="row wrap">${a.opts
    .map(([k, l], i) => `<button class="${i ? '' : 'pri'}" onclick="askUI('${k}')">${esc(l)}</button>`)
    .join(
      ''
    )}</div><div class="small mut">Sans réponse dans ${Math.floor(left / 60)} min ${String(left % 60).padStart(2, '0')} s : ${esc(a.self)}</div></div>`;
}
function askUI(k) {
  inSim(() => {
    askAnswer(UI.sim, k, 'me');
    UI.dirty = true;
    renderLive();
  });
}
// Négociations dans l'échappée : pactes en cours, demande de relais, propositions de pacte.
function negoHTML(sim) {
  let h = '';
  const pc = (sim.pacts || []).find(pc => !pc.done && !pc.ai);
  if (pc)
    h += `<div class="ally">🤝 Pacte : ${esc(pactTxt(pc))}.${pactYielder(pc) === pc.p ? ` <button onclick="negoUI('break')">Rompre le pacte</button>` : ''}</div>`;
  const st = negoState(sim);
  if (!st) return h;
  const wait = sim.t - (sim.negoT ?? -99) < 10;
  h += `<div class="ally"><b>🗣️ Dans l'échappée</b> (${esc(riderName(st.x.r))} avec ${st.others.length} adversaire${st.others.length > 1 ? 's' : ''})<div class="row wrap"><button ${wait ? 'disabled' : ''} onclick="negoUI('coop')">Demander à tous de rouler</button>${st.cands
    .map(
      c =>
        `<button ${wait || pc ? 'disabled' : ''} onclick="negoUI('pact',${c.y.id})">Pacte avec ${esc(riderName(c.y.r))} : ${c.type === 'etape' ? 'je roule, tu me laisses l’étape' : 'tu roules, je te laisse l’étape'}</button>`
    )
    .join(
      ''
    )}</div><div class="small mut">Un refus vexe ; un pacte rompu se paie dans les relations entre équipes.</div></div>`;
  return h;
}
function negoUI(k, id) {
  inSim(() => {
    const sim = UI.sim;
    if (k === 'break') pactBreak(sim);
    else UI.flashRace = '🤝 ' + negoAsk(sim, k, id);
    UI.dirty = true;
    renderLive();
  });
}
// Alliances de poursuite : proposition reçue, alliance en cours, ou bouton pour en demander une.
function allyHTML(sim) {
  if (sim.allyOffer)
    return `<div class="ally on"><b>🤝 ${esc(sim.allyOffer.T.name)}</b> vous propose de rouler ensemble derrière l'échappée.<div class="row"><button class="pri" onclick="allyUI(true)">Accepter</button><button onclick="allyUI(false)">Refuser</button></div><div class="small mut">Accepter améliore vos relations avec eux ; refuser les froisse.</div></div>`;
  if (sim.ally)
    return `<div class="ally">🤝 Alliance avec <b>${esc(sim.ally.T.name)}</b> : vos équipiers prennent leurs relais. <button onclick="allyUI('break')">Rompre</button></div>`;
  if (breakAheadNoMine(sim) && sim.pel && sim.pel.riders.some(x => x.player))
    return `<div class="row small"><button onclick="allyUI('ask')">🤝 Proposer une alliance de poursuite</button></div>`;
  return '';
}
function allyUI(k) {
  inSim(() => allyUI0(k));
}
function allyUI0(k) {
  const sim = UI.sim;
  if (k === 'ask') UI.flashRace = '🤝 ' + allyRequest(sim);
  else if (k === 'break') allyBreak(sim);
  else allyDecide(sim, k);
  UI.dirty = true;
  renderLive();
}
// Barre de commandes fixée en bas de l'écran (vitesse, fin, DS auto, pauses).
function dockHTML() {
  const sim = UI.sim;
  const mult = k => '×' + fmtDec(SPEEDS[k] * 30, SPEEDS[k] * 30 < 10 ? 1 : 0);
  return `<div class="dock"><div class="row ctl">${SPEED_LBL.map((l, k) => `<button class="${UI.speed === k ? 'on' : ''}" title="${k ? mult(k) : 'pause'}" onclick="UI.keyMode=false;setSpeed(${k})">${l}</button>`).join('')}<button class="${UI.keyMode ? 'on' : ''}" title="Moments clés : avance rapide jusqu'au final ou jusqu'à un événement pour votre équipe" onclick="keyMoments()">🎬</button><button onclick="toEnd()">⏭</button></div>
 <div class="row small sb"><span class="mut">${UI.speed ? mult(UI.speed) + ' temps réel' : 'en pause'}</span><span><label><input type="checkbox" ${sim.autoPause ? 'checked' : ''} onchange="UI.sim.autoPause=this.checked"> pause mes coureurs</label> <label><input type="checkbox" ${UI.pauseHl ? 'checked' : ''} onchange="UI.pauseHl=this.checked"> pause moments forts</label> <button class="${sim.autoDS ? 'on' : ''}" onclick="UI.sim.autoDS=!UI.sim.autoDS;UI.autoDS=UI.sim.autoDS;log(UI.sim,UI.sim.autoDS?'🤖 DS automatique activé.':'🤖 DS automatique désactivé : vous reprenez la main.','info');renderLive()">🤖 ${sim.autoDS ? 'ON' : 'OFF'}</button></span></div></div>`;
}
function openRadio(id) {
  UI.markPick = null;
  UI.modal = { type: 'radio', id };
  renderModal();
}
function setMark(id, tid) {
  const sim = UI.sim;
  const x = sim.runners.find(y => y.id === id);
  const nm = riderName(x.r);
  const tg = riderName(S.riders[tid]);
  if (obeyCheck(x, 'mark', sim)) {
    x.markId = tid;
    log(sim, `📻 → ${nm} : marque ${tg} — « ${radioReply(x, 'ok')} »`, 'me');
  } else {
    log(sim, `📻 → ${nm} : marque ${tg} — « ${radioReply(x, 'no')} »`, 'bad');
  }
  UI.markPick = null;
  closeModal();
  UI.dirty = true;
  renderLive();
}
// Ordres radio collectifs.
// Les ordres donnés pendant la course puisent dans la série de hasard de l'étape (étape rejouable).
function inSim(fn) {
  return UI.sim && UI.sim.sd != null ? withSeed(UI.sim, fn) : fn();
}
function teamRadio(k) {
  inSim(() => teamRadio0(k));
}
function teamRadio0(k) {
  const sim = UI.sim;
  const mine = sim.runners.filter(x => x.player && !x.fin && !x.dnf);
  if (k === 'echelon') {
    const e = tryEchelon(sim);
    if (e) log(sim, '📻 ' + e, 'bad');
    UI.dirty = true;
    renderLive();
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
  UI.dirty = true;
  renderLive();
}
// Ordres radio pour un coureur.
function radioCard(id) {
  const sim = UI.sim;
  if (!sim) return '';
  const x = sim.runners.find(y => y.id === id);
  if (!x) return '';
  const r = x.r;
  return `<div class="row sb"><h3>📻 ${esc(riderName(r))}</h3><button onclick="closeModal()">✕</button></div>
 <div class="small">Consigne de départ : <b>${ORDERS[x.order] ? ORDERS[x.order].lbl : x.order}</b>${x.rebel ? ' (ignorée)' : ''} · Radio : <b>${x.radio ? RADIO[x.radio].lbl : '—'}</b></div>
 <div class="small">Fond ${Math.round(x.energy)}% ${bar(x.energy)} · Jus ${Math.round(x.punch)}% ${bar(x.punch, 100, 'b')} · Effort ${effortIcon(x.I)} · Discipline ${r.dis} · Ambition ${r.amb} · ${TRAITS[r.trait].lbl}</div>
 <div class="radio">${Object.entries(RADIO)
   .map(([k, v]) => `<button onclick="sendRadio(${id},'${k}')">${v.lbl}</button>`)
   .join('')}</div>
 ${
   UI.markPick === id
     ? `<div class="small"><b>Qui marquer ?</b></div><div class="radio">${sim.runners
         .filter(y => !y.player && !y.fin && !y.dnf && sim.favs.has(y.id))
         .map(
           y =>
             `<button onclick="setMark(${id},${y.id})">${esc(riderName(y.r))} <span class="mut">${y.team.short}</span></button>`
         )
         .join('')}</div>`
     : ''
 }
 ${x.markId ? `<div class="small">Marque : <b>${esc(riderName(S.riders[x.markId]))}</b></div>` : ''}
 <p class="small mut">Le coureur peut refuser selon sa discipline, son moral, son ambition et la situation. Sans « jus », une attaque est impossible.</p>`;
}
function sendRadio(id, k) {
  inSim(() => sendRadio0(id, k));
}
function sendRadio0(id, k) {
  const sim = UI.sim;
  const x = sim.runners.find(y => y.id === id);
  if (!x || x.fin || x.dnf) return closeModal();
  if (k === 'mark') {
    UI.markPick = id;
    renderModal();
    return;
  }
  applyRadio(sim, x, k, 'user');
  closeModal();
  UI.dirty = true;
  renderLive();
}
// Puissance en direct d'un coureur : instantanée (dernières 30 s), W/kg, moyenne depuis le départ.
function liveWatts(x) {
  if (!x.st || !x.st.pn) return '';
  const avg = Math.round(x.st.pw / x.st.pn);
  if (x.fin || x.dnf) return `<div class="small">⚡ moy. ${avg} W</div>`;
  const kg = x.r.kg || 68;
  return `<div class="small">⚡ <b>${Math.round(x.pw || 0)} W</b> · ${fmtDec((x.pw || 0) / kg, 1)} W/kg <span class="mut">(moy. ${avg})</span></div>`;
}
// W/kg de celui qui mène le groupe (le relayeur le plus sollicité).
function groupWkg(G) {
  let m = 0;
  for (const x of G.riders) if (x.pw) m = Math.max(m, x.pw / (x.r.kg || 68));
  return m ? ` · ⚡ ${fmtDec(m, 1)} W/kg en tête` : '';
}
// Position interpolée d'un groupe entre deux pas de simulation (frac = avancement vers le pas suivant).
function ipos(G, frac) {
  const a = G.prev == null ? G.pos : G.prev;
  return a + (G.pos - a) * clamp(frac, 0, 1);
}
// Pastille aux couleurs d'une équipe.
function tcol(T) {
  return `<i class="tc" style="background:${T.color}"></i>`;
}
// Maillots distinctifs portés au départ de l'étape (courses par étapes).
function jersey(id) {
  const rc = S.rc;
  if (!rc || rc.specs.length < 2 || !rc.stageRes.length) return '';
  if (!UI.jer || UI.jer.key !== rc.calIdx + '_' + rc.stageRes.length) {
    const best = o => classOrder(rc, o, 0)[0];
    const j = {};
    const add = (k, e) => {
      if (k && !j[k]) j[k] = e;
    };
    add(gcList(rc)[0], '🟡');
    add(best(rc.pts), '🟢');
    add(best(rc.kom), '🔴');
    add(ygList(rc)[0], '⚪');
    UI.jer = { key: rc.calIdx + '_' + rc.stageRes.length, j };
  }
  const e = UI.jer.j[id];
  return e ? ` <span title="maillot distinctif">${e}</span>` : '';
}
function riderTag(x) {
  return `${tcol(x.team)}${riderName(x.r)}${jersey(x.id)}`;
}
// Bloc « retransmission » : chrono, profil animé, écarts sur la route, graphique de l'écart, maillot virtuel, bandeau.
function tvHTML(frac) {
  const sim = UI.sim,
    spec = sim.spec;
  const G0 = sim.groups[0];
  const km = G0 ? Math.min(ipos(G0, frac), spec.dist) : spec.dist;
  const [g, surf, ex] = terrainAt(sim, km);
  const t = Math.max(0, sim.t * 60 - 30 + frac * 30);
  let h = `<div class="row sb small"><span>⏱ <b>${fmtTime(t)}</b> · km <b>${km.toFixed(1)}</b> / ${spec.dist} · reste <b>${(spec.dist - km).toFixed(1)}</b></span><span>${g.toFixed(1)} %${surf ? ' · <b>PAVÉS</b>' : ''}${ex && sim.P.wind ? ' · 🌬️' : ''} · ${G0 ? G0.speed.toFixed(1) : 0} km/h</span></div>`;
  h += profileSVG(spec, UI.Pf, sim, frac);
  h += roadStrip(sim, frac) + gapChart(sim) + virtualLeader(sim);
  const B = UI.banner;
  if (B && Date.now() < B.until) h += `<div class="banner ${B.mine ? 'bmine' : ''}">${B.txt}</div>`;
  return h;
}
// Les groupes sur la route, à l'échelle, de la tête au dernier groupe affiché.
function roadStrip(sim, frac) {
  const gs = sim.groups.slice(0, 6);
  if (gs.length < 2) return '';
  const W = 640,
    H = 64,
    pad = 40;
  const top = ipos(gs[0], frac),
    last = ipos(gs[gs.length - 1], frac);
  const span = Math.max(0.3, top - last);
  const X = p => W - pad - ((top - p) / span) * (W - 2 * pad);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="strip"><line x1="${pad}" x2="${W - pad}" y1="32" y2="32" class="road"/>`;
  // étiquettes en alternance haut / bas, sans chevauchement (on saute celles trop proches, sauf mes groupes)
  const lastX = [1e9, 1e9];
  gs.forEach((G, i) => {
    const x = X(ipos(G, frac)),
      mine = G.riders.some(y => y.player);
    s += `<circle cx="${x.toFixed(1)}" cy="32" r="${Math.min(13, 5 + Math.sqrt(G.riders.length))}" class="${mine ? 'gm' : 'gg'}"/>`;
    let row = lastX[0] - x >= 130 ? 0 : lastX[1] - x >= 130 ? 1 : -1;
    if (row < 0 && !mine && i) return;
    if (row < 0) row = 1;
    lastX[row] = x;
    const gap = i ? fmtGap(gapSec(gs[0], G)) : 'Tête';
    s += `<text x="${clamp(x, 60, W - 60).toFixed(1)}" y="${row ? 62 : 15}" class="stx${mine ? ' stm' : ''}">${G.riders.length} · ${gap}</text>`;
  });
  return s + `</svg>`;
}
// Évolution de l'écart entre la tête de course et le peloton, kilomètre par kilomètre.
function gapChart(sim) {
  const Hh = sim.gapHist || [];
  if (Hh.length < 3 || !Hh.some(p => p.gap > 5)) return '';
  const W = 640,
    H = 90,
    pad = 22;
  const mx = Math.max(60, ...Hh.map(p => p.gap));
  const X = k => pad + (k / sim.dist) * (W - 2 * pad),
    Y = v => H - 12 - (v / mx) * (H - 30);
  const pts = Hh.map(p => `${X(p.km).toFixed(1)},${Y(p.gap).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" class="gch"><line x1="${pad}" x2="${W - pad}" y1="${H - 12}" y2="${H - 12}" class="gl"/><polyline points="${pts}" class="gp"/><text x="${pad}" y="15" class="ck">Écart tête / peloton : ${fmtGap(Hh[Hh.length - 1].gap)} (max ${fmtGap(mx)})</text></svg>`;
}
// Maillot jaune virtuel : le mieux placé au général si l'on figeait les écarts maintenant.
function virtualLeader(sim) {
  const rc = sim.rc;
  if (rc.specs.length < 2 || !rc.stageRes.length || sim.finish.length) return '';
  const G0 = sim.groups[0];
  let best = null,
    bv = 1e12;
  for (const x of sim.runners) {
    if (x.fin || x.dnf || !x.g) continue;
    const v = rc.gc[x.id] + gapSec(G0, x.g);
    if (v < bv) {
      bv = v;
      best = x;
    }
  }
  const ldr = gcList(rc)[0];
  if (!best) return '';
  return best.id === ldr
    ? `<div class="small mut">🟡 ${riderName(best.r)} conserve virtuellement son maillot.</div>`
    : `<div class="small"><b>🟡 Maillot jaune virtuel : ${riderName(best.r)}</b> (${best.team.short})</div>`;
}
