/* Interface — course en direct : boucle de temps et vitesses, retransmission (profil, groupes, écarts), carte
   du final et photo-finish, groupes et coureurs, radio et appels, négociations, alliances. */

// Vitesses de la course en direct : pas de simulation (30 s de course) par seconde réelle.
// lent 0,1 pas/s = 3 fois le temps réel ; normal 0,25 = 7,5 fois (la vue du ciel suit un groupe sur quelques
// centaines de mètres : plus vite, les coureurs y défilaient en une seconde) ; ▶▶ 30 fois ; ×4 120 fois ; max 600.
// Le rythme automatique accélère seul les passages où il ne se passe rien.
const SPEEDS = [0, 0.1, 0.25, 1, 4, 20];
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
  // (une course animée reste à la vitesse choisie : seuls les temps morts et la bagarre du début accélèrent)
  const target = lvl === 'calm' ? Math.max(base, 4) : lvl === 'fight' ? Math.max(base, 3) : base;
  if (target !== UI.speed) {
    if (target < UI.speed) UI.acc = 0; // retour au direct : on ne saute pas le moment
    UI.speed = target;
  }
}
function startTimer() {}
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
  UI.loopT = performance.now(); // (la retransmission vue du ciel interpole entre deux passages de la boucle)
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
    // moment décisif rejoué au détail : la course s'arrête et son rejeu s'ouvre, jusqu'à ce que le joueur reprenne
    // (les bordures qui ne concernent pas mes coureurs s'ouvrent sans arrêter la course)
    const mts = sim.momentTraces || [];
    if (mts.length > (UI.momSeen || 0)) {
      UI.momSeen = mts.length;
      const m = mts[mts.length - 1];
      const mine = m.tr && m.tr.riders.some(r => r.me);
      if (UI.pauseMoments !== false && (m.kind !== 'bord' || mine)) {
        UI.momOpen = mts.length - 1;
        UI.momPaused = UI.speed || UI.baseSpeed || 2;
        UI.speed = 0;
        UI.keyMode = false;
        UI.acc = 0;
        break;
      } else if (UI.momOpen == null) UI.momOpen = mts.length - 1;
    }
    // moments forts : bandeau, et pause si demandée
    const hls = sim.hls || [];
    if (hls.length > (UI.hlSeen || 0)) {
      const hl = hls[hls.length - 1];
      UI.hlSeen = hls.length;
      UI.banner = { txt: hl.txt, mine: hl.mine, until: Date.now() + 7500 };
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
function renderLive() {}
function grpLabel(sim, G, i) {
  if (i === 0 && !sim.finish.length) return G === sim.pel ? 'Peloton (tête)' : 'Tête de course';
  if (i === 0 && G !== sim.pel) return 'Groupe 1';
  if (G === sim.pel) return 'Peloton';
  return 'Groupe ' + (i + 1);
}
function posLbl(p) {
  return p > 75 ? 'devant' : p > 45 ? 'milieu' : 'arrière';
}
function askUI(k) {
  inSim(() => {
    askAnswer(UI.sim, k, 'me');
    UI.dirty = true;
    renderLive();
  });
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
