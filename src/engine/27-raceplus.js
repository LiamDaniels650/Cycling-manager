/* Course en direct, approfondissements : plan d'alimentation de l'équipe, réserves de poche, alliances de
   poursuite avec les équipes adverses et résumé d'étape. Tout ceci ne concerne que l'équipe du joueur :
   les équipes IA courent exactement comme avant. */

// ---------- Alimentation ----------
const FEED_PLANS = {
  normal: { lbl: 'Normal', d: 'une musette à la zone de ravitaillement' },
  renforce: {
    lbl: 'Renforcé (3 k€)',
    d: 'deux soigneurs de plus sur le bord de la route (vers 30 % et 78 % du parcours) : de quoi éviter les fringales sur les longues étapes et par forte chaleur',
  },
};
const FEED_COST = 3;
// Plan conseillé : renforcé par forte chaleur, sur les très longues étapes et sur les longues étapes de montagne.
function autoFeed(spec) {
  const mount = spec.type === 'montagne' || spec.type === 'sommet';
  return spec.wx === 'chaleur' || spec.dist >= 200 || (mount && spec.dist >= 160) ? 'renforce' : 'normal';
}
function feedPlanFor(rc, spec) {
  return rc.feedPlan && rc.feedStage === rc.si ? rc.feedPlan : autoFeed(spec);
}
function setFeed(v) {
  const rc = S.rc;
  rc.feedPlan = v;
  rc.feedStage = rc.si;
}
// Points de ravitaillement supplémentaires du joueur (km), loin du départ et de l'arrivée.
function feedPoints(dist) {
  return [Math.round(dist * 0.3), Math.round(dist * 0.78)].filter(k => k > 40 && dist - k > 25);
}
// Mise en place à la création de l'étape (appelée par newStageSim).
function feedSetup(sim, rc, spec) {
  const mine = (rc.sel[0] || []).some(id => !rc.out[id]);
  sim.feedPlan = mine ? feedPlanFor(rc, spec) : 'normal';
  sim.feedPts = sim.feedPlan === 'renforce' ? feedPoints(spec.dist) : [];
  if (sim.feedPlan === 'renforce') {
    S.budget -= FEED_COST;
    finAdd('other', -FEED_COST);
  }
}
// Passage aux soigneurs supplémentaires (coureurs du joueur seulement, sauf ceux qui roulent à bloc).
function feedExtra(sim, G) {
  for (const k of sim.feedPts) {
    if (!(G.prev < k && G.pos >= k)) continue;
    for (const x of G.riders) if (x.player && !(x.work > 0.88 || G.burst > 0)) x.food = Math.min(100, x.food + 25);
  }
}
// Le coureur mange ce qu'il a dans ses poches : il recule un peu dans le groupe (deux réserves par étape).
function eatNow(sim, x, pre) {
  const nm = riderName(x.r);
  const log = x.player ? globalThis.log : () => {};
  if (x.pocket <= 0) {
    log(sim, `${pre}${nm} : « Je n'ai plus rien dans les poches ! Il faut des bidons de la voiture. »`, 'bad');
    return false;
  }
  x.pocket--;
  x.food = Math.min(100, x.food + 18);
  x.pos = Math.max(0, x.pos - 12);
  x.hungry = x.food < 30;
  log(sim, `${pre}${nm} mange une barre (${x.pocket} réserve${x.pocket > 1 ? 's' : ''} en poche).`, 'me');
  return true;
}
// Alerte faim (une fois par coureur et par étape, réarmée quand il a remangé).
function hungerCheck(sim, x) {
  if (!x.player) return;
  if (x.food < 30 && !x.hungry) {
    x.hungry = true;
    log(sim, `🍌 ${riderName(x.r)} commence à avoir faim (réserves ${Math.round(x.food)} %).`, 'bad');
    highlight(sim, `🍌 ${riderName(x.r)} a faim : faites-le manger ou envoyez chercher des bidons`, true);
    if (sim.autoPause) sim.pauseReq = sim.pauseReq || `${riderName(x.r)} a faim`;
  } else if (x.food >= 40) x.hungry = false;
}

// ---------- Alliances de poursuite ----------
// Relations avec les équipes adverses (-3 à +3), entretenues par les alliances acceptées ou refusées.
function teamRelOf(id) {
  return (S.teamRel && S.teamRel[id]) || 0;
}
function addTeamRel(id, v) {
  S.teamRel = S.teamRel || {};
  S.teamRel[id] = clamp(teamRelOf(id) + v, -3, 3);
}
// L'équipe a-t-elle intérêt à reprendre l'échappée (sprinteur sur une étape pour lui, leader au général) ?
function allyInterest(sim, T) {
  const t = sim.spec.type;
  const sp = sim.teamSprinter[T.id],
    ld = sim.teamLeader[T.id];
  const inPel = x => x && !x.fin && !x.dnf && x.g === sim.pel;
  return (inPel(sp) && (t === 'plat' || t === 'punch' || t === 'vallonne')) || (inPel(ld) && sim.stageRace);
}
// Une échappée sans coureur du joueur précède-t-elle le peloton ?
function breakAheadNoMine(sim) {
  const pel = sim.pel;
  if (!pel) return false;
  const ahead = sim.groups.filter(H => H !== pel && H.pos > pel.pos + 0.03);
  return ahead.length > 0 && !ahead.some(H => H.riders.some(y => y.player));
}
// À chaque pas (tickTeamPlans) : propositions des équipes IA, alliance en cours imposée aux deux équipes.
function allyTick(sim, chase) {
  const pel = sim.pel;
  const P0 = S.teams[0];
  if (!pel || !pel.riders.some(x => x.player)) {
    sim.ally = null;
    sim.allyOffer = null;
    return;
  }
  const kmLeft = sim.dist - pel.pos;
  // proposition restée sans réponse : les coureurs jugent eux-mêmes (comme le ferait un directeur sportif)
  if (sim.allyOffer && sim.t > sim.allyOffer.exp) {
    const yes = allyInterest(sim, P0) || teamRelOf(sim.allyOffer.T.id) >= 2;
    log(
      sim,
      yes
        ? `🤝 Sans réponse de la voiture, tes coureurs acceptent de rouler avec ${sim.allyOffer.T.name}.`
        : `🤝 ${sim.allyOffer.T.name} n'a pas eu de réponse : chacun pour soi.`,
      ''
    );
    allyDecide(sim, yes, true);
  }
  // alliance en cours : les deux équipes roulent ensemble jusqu'à la reprise ou l'échéance
  if (sim.ally) {
    if (sim.t > sim.ally.until || !breakAheadNoMine(sim) || kmLeft < 3) {
      log(sim, `🤝 Fin de l'alliance avec ${sim.ally.T.name}.`, 'me');
      sim.ally = null;
    } else
      for (const T of [P0, sim.ally.T]) {
        const k = ckey(pel, T);
        const c = chase.get(k) || [0, 0];
        chase.set(k, [Math.max(c[0], 0.9), Math.max(c[1], 2)]);
      }
    return;
  }
  // proposition d'une équipe IA qui roule déjà et voudrait de l'aide (au plus une par étape)
  if (sim.allyOffer || sim.allyT != null || kmLeft < 15 || !breakAheadNoMine(sim)) return;
  const mineLvl = (chase.get(ckey(pel, P0)) || [0])[0];
  if (mineLvl >= 0.84) return;
  sim.allyAsked = sim.allyAsked || new Set();
  for (const T of S.teams) {
    if (T.player || sim.allyAsked.has(T.id)) continue;
    const c = chase.get(ckey(pel, T));
    if (!c || c[0] < 0.84 || !allyInterest(sim, T)) continue;
    sim.allyAsked.add(T.id);
    sim.allyT = sim.t;
    sim.allyOffer = { T, exp: sim.t + 10 };
    log(sim, `🤝 ${T.name} vous propose de rouler ensemble derrière l'échappée.`, 'me');
    highlight(sim, `🤝 ${T.name} propose une alliance de poursuite`, true);
    if (sim.autoDS) allyDecide(sim, allyInterest(sim, P0) || teamRelOf(T.id) >= 2);
    else if (sim.autoPause) sim.pauseReq = sim.pauseReq || `${T.name} propose une alliance`;
    return;
  }
}
// Réponse du joueur à une proposition (silent : délai écoulé).
function allyDecide(sim, yes, silent) {
  const o = sim.allyOffer;
  if (!o) return;
  sim.allyOffer = null;
  if (yes) {
    sim.ally = { T: o.T, until: sim.t + 40 };
    addTeamRel(o.T.id, 1);
    log(sim, `🤝 Alliance conclue avec ${o.T.name} : vos équipiers prennent leurs relais.`, 'me');
  } else {
    addTeamRel(o.T.id, -1);
    if (!silent) log(sim, `🤝 Vous déclinez la proposition de ${o.T.name}. Ils s'en souviendront.`, 'bad');
  }
}
// Le joueur propose une alliance : l'équipe la plus susceptible d'accepter est sollicitée (une fois par 15 min).
function allyRequest(sim) {
  const pel = sim.pel;
  if (sim.ally) return `Alliance déjà en cours avec ${sim.ally.T.name}.`;
  if (!pel || !pel.riders.some(x => x.player)) return 'Vos coureurs ne sont pas dans le peloton.';
  if (!breakAheadNoMine(sim)) return 'Aucune échappée à reprendre.';
  if (sim.t - (sim.allyAskT || -99) < 15) return 'Laissez passer quelques minutes avant de redemander.';
  sim.allyAskT = sim.t;
  const cands = S.teams
    .filter(T => !T.player && pel.riders.some(x => x.team === T))
    .map(T => ({ T, p: clamp(0.25 + 0.12 * teamRelOf(T.id) + (allyInterest(sim, T) ? 0.35 : 0), 0.05, 0.9) }))
    .sort((a, b) => b.p - a.p);
  if (!cands.length) return 'Aucune équipe adverse dans le peloton.';
  const { T, p } = cands[0];
  if (rnd() < p) {
    sim.ally = { T, until: sim.t + 40 };
    log(sim, `🤝 ${T.name} accepte de rouler avec vous derrière l'échappée.`, 'me');
    return `${T.name} accepte l'alliance.`;
  }
  addTeamRel(T.id, -0.5);
  log(sim, `🤝 ${T.name} refuse : « Ce n'est pas notre course aujourd'hui. »`, 'bad');
  return `${T.name} refuse.`;
}
// Le joueur rompt l'alliance en cours (ses partenaires ne l'oublieront pas).
function allyBreak(sim) {
  if (!sim.ally) return;
  log(sim, `🤝 Vous rompez l'alliance avec ${sim.ally.T.name}.`, 'bad');
  addTeamRel(sim.ally.T.id, -1.5);
  sim.ally = null;
}
// DS automatique : demande d'alliance quand l'échappée menace le sprint ou le leader.
function allyAuto(sim, T, once) {
  if (sim.ally || sim.allyOffer || !allyInterest(sim, T) || !breakAheadNoMine(sim)) return;
  const pel = sim.pel,
    front = sim.groups[0];
  if (!front || front === pel) return;
  const gap = gapSec(front, pel),
    kmLeft = sim.dist - pel.pos;
  if (gap > Math.max(60, (kmLeft - 10) * 3.5) && kmLeft > 15 && once('ally', 30)) {
    const t = allyRequest(sim);
    log(sim, `🤖 DS : demande d'alliance de poursuite — ${t}`, 'me');
  }
}

// ---------- Pourquoi un coureur a été lâché ----------
// Relevé au moment où un coureur du joueur perd le contact (lecture seule de l'état de course, sans hasard) :
// l'origine du rythme (attaque, tempo d'une équipe, sélection par les plus forts) et l'état du coureur.
function dropRecord(sim, G, x, src, ws, att) {
  const thr = 1.0 + 0.085 * Math.min(1, x.punch / 40);
  const why = x.sitUp ? 'situp' : x.I > thr ? 'over' : x.energy <= 1 ? 'empty' : 'pace';
  let by = null;
  if (src === 'att' && att && att !== x) by = riderName(att.r);
  else if (src === 'tempo') {
    const cnt = new Map();
    for (const y of ws) if (y.team !== x.team) cnt.set(y.team, (cnt.get(y.team) || 0) + 1);
    by =
      [...cnt]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([T]) => T.short)
        .join(', ') || null;
  }
  return {
    t: sim.t,
    km: +(sim.dist - G.pos).toFixed(1),
    g: +(G.g || 0).toFixed(1),
    n: G.riders.length,
    I: +(x.I || 0).toFixed(2),
    punch: Math.round(x.punch),
    e: Math.round(x.energy),
    bonk: !!x.bonk,
    food: Math.round(x.food),
    m: x.matches || 0,
    sans: !!x.sansJour,
    day: Math.round(x.dayForm - x.r.forme),
    why,
    src,
    by,
  };
}
// Explication lisible d'un lâché : { txt, why, tip } (null si rien à expliquer). ord : consigne du coureur.
function dropExplain(r, d, ord) {
  if (!d) return null;
  const src = {
    att: d.by ? `sur l'attaque de ${d.by}` : 'sur une attaque',
    tempo: d.by ? `sur le tempo imposé par ${d.by}` : 'sur le tempo de sa propre équipe',
    pav: 'quand les spécialistes des pavés ont durci',
    montee: 'quand les grimpeurs ont imposé leur rythme',
    finale: 'quand les meilleurs se sont expliqués',
    calme: '',
  }[d.src];
  const where = `à ${fmtDec(d.km)} km de l'arrivée${d.g >= 3 ? ` (pente ${fmtDec(d.g)} %)` : ''}`;
  const txt = `${riderName(r)} a perdu le contact ${where}${src ? ', ' + src : ''}.`;
  const cause = {
    situp: "Il s'est relevé volontairement.",
    pace: "Il a choisi de monter à son rythme plutôt que de s'accrocher.",
    empty: `Il n'avait plus de fond (réserves à ${d.e} %).`,
    over: `Le rythme dépassait ses moyens du jour (${Math.round(d.I * 100)} % de sa capacité).`,
  }[d.why];
  const f = [];
  if (d.sans) f.push('jour sans');
  else if (d.day <= -4) f.push('mauvaises jambes ce jour-là');
  if (d.bonk) f.push('fringale');
  else if (d.food < 25) f.push('mal alimenté');
  if (d.punch < 25 && d.why === 'over') f.push(`réserve d'attaque presque vide (${d.punch} %)`);
  if (d.m >= 3) f.push(`${d.m} efforts dans le rouge auparavant`);
  if (d.e < 35 && d.why !== 'empty') f.push(`fond entamé (${d.e} %)`);
  let tip = null;
  if (d.why === 'situp') tip = null;
  else if (ord === 'sprint' && d.g >= 4 && d.km > 3)
    tip = "Normal pour un sprinteur dans une telle montée : l'important est de finir dans les délais.";
  else if (d.src === 'tempo' && !d.by)
    tip = 'Ses propres équipiers roulaient trop fort pour lui : radio « Arrête de rouler » ou consigne moins dure.';
  else if (d.bonk || d.food < 25) tip = "Renforcez le plan d'alimentation, ou faites-le manger avant la difficulté.";
  else if (d.m >= 3)
    tip = 'Trop d’efforts avant le moment décisif : consigne « Économiser » ou « Monte à ton rythme » plus tôt.';
  else if (d.e < 35 || d.why === 'empty')
    tip = "Il s'est trop dépensé avant : moins de relais, ou des équipiers autour de lui pour l'abriter.";
  else if (d.sans || d.day <= -4) tip = "Peu de choses à faire : la forme du jour n'y était pas.";
  else if (d.why === 'over') tip = "Il était simplement moins fort que les meilleurs aujourd'hui.";
  return { txt, why: cause + (f.length ? ' Facteurs : ' + f.join(', ') + '.' : ''), tip };
}
// ---------- Explications du sprint, de l'échappée et des désobéissances ----------
// Tout est relevé en lecture seule (aucun tirage au hasard) : les résultats de course ne changent pas.

// Pourquoi un coureur n'a pas respecté sa consigne : son caractère, son moral, sa relation avec le leader.
function disobRecord(sim, x, kind) {
  const r = x.r;
  const ld = sim.teamLeader[x.team.id];
  const stronger = !!(ld && ld !== x && cap(x, x.g ? x.g.g : 0, 0) > cap(ld, x.g ? x.g.g : 0, 0) * 1.04);
  return {
    kind,
    dis: r.dis,
    amb: r.amb,
    moral: Math.round(r.moral),
    trait: r.trait,
    ldr: ld && ld !== x ? ld.id : null,
    rel: ld && ld !== x ? rel(x.id, ld.id) : 0,
    ahead: !!(x.g && x.g.ahead && x.g.riders.length <= 12),
    stronger,
  };
}
function disobExplain(r, d) {
  if (!d) return null;
  const f = [];
  if (d.dis < 60) f.push(`discipline ${d.dis < 40 ? 'faible' : 'moyenne'} (${d.dis})`);
  if (d.amb >= 60) f.push(`${d.amb >= 75 ? 'très ' : ''}ambitieux (${d.amb})`);
  if (d.moral < 50) f.push(`moral en berne (${d.moral})`);
  if (d.trait === 'leaderne') f.push('se voit en leader');
  else if (d.trait === 'tete') f.push('tête brûlée');
  else if (d.trait === 'opportuniste') f.push('opportuniste');
  if (d.ldr != null && d.rel <= -20) f.push(`relation tendue avec ${riderName(S.riders[d.ldr])} (${d.rel})`);
  if (d.stronger) f.push('se sentait plus fort que son leader');
  if (d.ahead) f.push('était devant, avec sa chance à jouer');
  const what =
    d.kind === 'pre' ? 'a décidé de courir pour lui' : `a refusé l'ordre « ${(RADIO[d.kind] || {}).lbl || d.kind} »`;
  const tip =
    d.ldr != null && d.rel <= -20
      ? 'Une discussion ou une médiation avec le leader apaiserait les choses.'
      : d.amb >= 65 && (d.stronger || d.ahead)
        ? 'Un coureur de ce calibre voudra une carte à jouer : envisagez la consigne « Carte libre » ou co-leader.'
        : d.dis < 50
          ? 'Le recadrer peut aider ; un coureur peu discipliné reste un pari pour les rôles d’équipier.'
          : null;
  return {
    txt: `${riderName(r)} ${what}.`,
    why: f.length
      ? 'Raisons : ' + f.join(', ') + '.'
      : `Coureur plutôt discipliné (${d.dis}) : un écart ponctuel, sans raison profonde.`,
    tip,
  };
}

// Reprise de l'échappée : où, par qui, et à quelle vitesse l'écart a fondu.
function catchRecord(sim, A, B) {
  const H = sim.gapHist || [];
  const recent = H.slice(-11).filter(p => p.gap > 0);
  const rate =
    recent.length >= 2 ? (recent[0].gap - recent[recent.length - 1].gap) / Math.max(1, recent.length - 1) : 0;
  const cnt = {};
  for (const y of B.riders) if (y.work > 0) cnt[y.team.short] = (cnt[y.team.short] || 0) + 1;
  return {
    km: Math.round(sim.dist - B.pos),
    n: A.riders.length,
    mine: A.riders.some(y => y.player),
    teams: Object.entries(cnt)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3),
    rate: Math.round(rate),
  };
}
function breakRecord(sim) {
  const H = sim.gapHist || [];
  if (!sim.brkIds || !sim.brkIds.size) return null;
  const mx = H.reduce((a, p) => (p.gap > a.gap ? p : a), { gap: 0, km: 0 });
  const won = !!(sim.finish.length && sim.brkIds.has(sim.finish.slice().sort((a, b) => a.time - b.time)[0].id));
  const tally = Object.entries(sim.chaseTally || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return {
    n: sim.brkIds.size,
    mine: sim.runners.some(x => x.player && sim.brkIds.has(x.id)),
    max: mx.gap,
    maxKm: mx.km,
    won,
    caught: sim.brkCaught || null,
    tally,
  };
}
function breakExplain(b) {
  if (!b || b.n < 1 || b.n > 35 || b.max < 30) return null;
  const who = b.mine ? ' (avec un de vos coureurs)' : '';
  if (b.won) {
    const ch = b.tally.length
      ? `derrière, seules ${b.tally.map(([t]) => t).join(', ')} ont roulé ; `
      : 'personne n’a vraiment roulé derrière ; ';
    return `🚀 L'échappée de ${b.n}${who} est allée au bout : ${ch}l'avance a atteint ${fmtGap(b.max)} (km ${b.maxKm}).`;
  }
  if (!b.caught) return null;
  const c = b.caught;
  const t = c.teams.length
    ? `${c.teams.map(([s, k]) => `${s} (${k} coureur${k > 1 ? 's' : ''})`).join(', ')} roulai${c.teams.length > 1 ? 'en' : ''}t`
    : 'le peloton a accéléré';
  return `🔁 L'échappée${who} a été reprise à ${c.km} km de l'arrivée : ${t}${c.rate > 0 ? `, l'écart fondait d'environ ${c.rate} s/km` : ''} (avance maximale ${fmtGap(b.max)}).`;
}

// Sprint : placement, train, enfermement, départ trop tôt, vent.
// rank : place dans le sprint du groupe ; forWin : ce sprint était pour la victoire
function sprintExplain(r, d, rank, winnerSpr, forWin = true) {
  if (!d || !d.big) return null;
  const f = [];
  if (d.lost) f.push('son train a craqué avant le dernier kilomètre');
  else if (d.train > 0)
    f.push(`emmené par ${d.train} poisson${d.train > 1 ? 's' : ''}-pilote${d.train > 1 ? 's' : ''}`);
  else if (d.train === 0) f.push('sans poisson-pilote dans le final');
  if (d.surf) f.push('il a surfé dans les roues du meilleur train');
  if (d.boxed) f.push(`il est resté enfermé (placement ${d.pos})`);
  else if (d.pos < 60) f.push(`mal placé à l'approche de la ligne (placement ${d.pos})`);
  if (d.early)
    f.push(`il a lancé trop tôt${d.launch ? ` (à ${d.launch} m)` : ''}${d.wind === 'face' ? ', vent de face' : ''}`);
  else if (d.launch && rank <= 10) f.push(`lancé à ${d.launch} m`);
  if (rank > 1 && winnerSpr - d.spr >= 4) f.push(`moins rapide que le vainqueur (sprint ${d.spr} contre ${winnerSpr})`);
  const tip = d.lost
    ? 'Gardez des poissons-pilotes frais : moins de relais dans la poursuite pour eux.'
    : d.boxed || d.pos < 60
      ? 'Un train de 2 poissons-pilotes ou la radio « Place-toi devant » dans les derniers km aide à être placé.'
      : d.early
        ? 'Rien à faire sur le moment : un sprinteur plus endurant résiste mieux à un lancement long.'
        : null;
  const lbl = forWin
    ? rank === 1
      ? 'vainqueur'
      : `${rank}e`
    : `${rank === 1 ? '1er' : rank + 'e'} du sprint du groupe`;
  return { txt: `Sprint de ${riderName(r)} : ${lbl}${f.length ? ' — ' + f.join(', ') : ''}.`, tip };
}

// Ordre de sprint à la radio dans le final : lancer de loin, attendre dans les roues, ou prendre la roue du plus
// rapide du groupe. Même effet que la consigne du briefing, décidé au dernier moment.
function sprintOrder(sim, id, plan, quiet) {
  const x = sim.runners.find(y => y.id === id);
  if (!x || x.fin || x.dnf || !x.g) return;
  const nm = riderName(x.r);
  const log = quiet ? () => {} : globalThis.log; // ordres des équipes de l'ordinateur : pas dans ma radio
  if (plan === 'wheel') {
    const rivals = x.g.riders.filter(y => y !== x && y.team !== x.team && !y.fin).sort((a, b) => b.r.s.spr - a.r.s.spr);
    if (!rivals.length) return;
    x.wheelId = rivals[0].id;
    x.launchPlan = 'court';
    log(
      sim,
      `📻 ${nm} : « Je me cale dans la roue de ${riderName(rivals[0].r)} et je sors au dernier moment ! »`,
      'me'
    );
  } else {
    x.launchPlan = plan;
    x.wheelId = null;
    log(
      sim,
      plan === 'long'
        ? `📻 ${nm} : « Je lance de loin, accrochez-vous ! »`
        : `📻 ${nm} : « J'attends, je ne bouge pas avant les 170 derniers mètres. »`,
      'me'
    );
  }
}
// Ordre de final en côte : « attends la fin » (tout garder pour les 300 derniers mètres) ou « suis » le meilleur
// grimpeur adverse du groupe (marquage : il suit ses attaques). Pris en compte sur la ligne (finishGroup) ;
// l'attaque, elle, reste l'ordre radio habituel.
function climbOrder(sim, id, plan, quiet) {
  const x = sim.runners.find(y => y.id === id);
  if (!x || x.fin || x.dnf || !x.g) return;
  const nm = riderName(x.r);
  const log = quiet ? () => {} : globalThis.log; // ordres des équipes de l'ordinateur : pas dans ma radio
  if (plan === 'follow') {
    const rv = bestClimberRival(sim, x);
    if (!rv) return;
    x.climbPlan = 'follow';
    x.followId = rv.id;
    x.markId = rv.id; // le marquage du moteur : il saute dans sa roue s'il attaque
    x.manual = true;
    log(
      sim,
      `📻 ${nm} : « Je ne lâche pas la roue de ${riderName(rv.r)}, je le passe sur la ligne si je peux ! »`,
      'me'
    );
  } else {
    x.climbPlan = 'last';
    x.followId = null;
    x.manual = true; // l'adjoint ne le fait pas attaquer de lui-même
    log(sim, `📻 ${nm} : « Je ne bouge pas, je garde tout pour les 300 derniers mètres. »`, 'me');
  }
}
// Bouton « Auto » du final : l'adjoint choisit l'ordre qui convient au coureur et le dit à la radio.
// Sprint (réglé sur des sprints simulés) : mal placé, on remonte dans la roue du plus rapide ; sinon le conseil
// de sprintAdvice (attendre par vent de face ou pour un explosif, lancer long pour un endurant ou par vent de dos).
// Côte (réglé sur des arrivées rejouées) : attendre la fin s'il est assez explosif, attaquer seulement s'il domine
// nettement le groupe, prendre la roue du meilleur grimpeur s'il est proche, monter à son rythme s'il est un peu
// plus fort, et ne rien forcer s'il est bien plus fort.
function finalAuto(sim, id, mode, src = 'user') {
  const x = sim.runners.find(y => y.id === id);
  if (!x || x.fin || x.dnf || !x.g) return;
  const nm = riderName(x.r);
  // src : 'user' (bouton Auto), 'auto' (adjoint de mon équipe, DS auto), 'ai' (équipe de l'ordinateur, muet)
  const ai = src === 'ai';
  const say = ai ? () => {} : why => log(sim, `🤖 DS → ${nm} : ${why}`, 'me');
  const radio = k => (ai ? (x.radio = k) : applyRadio(sim, x, k, src));
  if (mode === 'sprint') {
    const rv = fastestRival(x);
    const end = x.r.s.end || 70,
      fw = sim.finWind;
    const plan = sprintAdvice(x, fw);
    if (rv && x.pos < 65) {
      say(`mal placé dans le groupe : on remonte dans la roue de ${riderName(rv.r)}, le plus rapide.`);
      sprintOrder(sim, id, 'wheel', ai);
    } else if (plan === 'court') {
      say(
        fw === 'face'
          ? 'vent de face : on attend, on sort aux 170 mètres.'
          : 'finisseur explosif : on attend les 170 derniers mètres.'
      );
      sprintOrder(sim, id, 'court', ai);
    } else if (plan === 'long') {
      say(
        fw === 'dos'
          ? 'vent de dos : on lance de loin, ils ne reviendront pas.'
          : `endurant (${end}) : on lance de loin.`
      );
      sprintOrder(sim, id, 'long', ai);
    } else {
      x.launchPlan = null;
      x.wheelId = null;
      say('bien placé, rien de spécial : il lance à son instinct, vers 200 mètres.');
    }
    return;
  }
  const fg = Math.max(sim.P.finishGrad, 4);
  const rv = bestClimberRival(sim, x);
  const cx = cap(x, fg, 0),
    cr = rv ? cap(rv, fg, 0) : 0;
  const kick = climbKick(x),
    dc = cr - cx; // avance du meilleur grimpeur adverse sur mon coureur
  if (kick > 0.3) {
    say('assez explosif pour le final : on attend les 300 derniers mètres.');
    climbOrder(sim, id, 'last', ai);
  } else if (rv && dc < -6 && x.punch >= 60) {
    say('nettement le plus fort du groupe : on attaque maintenant !');
    radio('attack');
  } else if (rv && dc <= 3) {
    say(`${riderName(rv.r)} est à portée : on prend sa roue.`);
    climbOrder(sim, id, 'follow', ai);
  } else if (rv && dc <= 7) {
    say(`${riderName(rv.r)} est un peu plus fort : on monte à notre rythme, sans se mettre dans le rouge.`);
    radio('pace');
  } else {
    if (src === 'user') x.manual = true;
    say(
      rv
        ? `${riderName(rv.r)} est bien plus fort : on reste dans les roues, on ne force rien.`
        : 'on reste dans les roues.'
    );
  }
}
// Meilleur grimpeur adverse du groupe d'un coureur, pour la pente de l'arrivée.
function bestClimberRival(sim, x) {
  if (!x || !x.g) return null;
  const fg = Math.max(sim.P.finishGrad, 4);
  return (
    x.g.riders.filter(y => y !== x && y.team !== x.team && !y.fin).sort((a, b) => cap(b, fg, 0) - cap(a, fg, 0))[0] ||
    null
  );
}
// Ordres de final des équipes de l'ordinateur (et de mon équipe quand l'adjoint la dirige) : à 3 km, le même
// raisonnement que le bouton Auto, pour le sprinteur de chaque équipe dans un groupe de tête qui sprintera, ou pour
// les coureurs qui jouent la gagne d'une arrivée en côte. Un directeur sur quatre laisse faire l'instinct.
// Un ordre donné par le joueur n'est jamais remplacé.
function aiFinalOrders(sim) {
  const live = sim.groups.filter(G => G.riders.some(x => !x.fin));
  const G = live[0];
  if (!G || sim.photo) return;
  const kmL = sim.dist - G.pos;
  if (kmL > 3) return;
  const P = sim.P;
  const up = P.finishGrad >= 3 || P.climbs.some(c => c.end >= sim.dist - 0.5);
  const xs = G.riders.filter(x => !x.fin && !x.dnf);
  if (xs.length < 2) return;
  const mine = x => x.player && (!sim.autoDS || x.manual || x.launchPlan || x.climbPlan || x.wheelId);
  const fg = Math.max(P.finishGrad, 4);
  for (const x of xs) {
    if (x._aiFin || mine(x)) continue;
    let mode = null;
    if (!up && xs.length > 3 && sim.teamSprinter[x.team.id] === x) mode = 'sprint';
    else if (up) {
      const better = xs.filter(y => y !== x && cap(y, fg, 0) > cap(x, fg, 0)).length;
      if (['leader', 'free'].includes(effOrder(x)) || better < 6) mode = 'climb';
    }
    if (!mode) continue;
    x._aiFin = true;
    if (rnd() < 0.25) continue; // à l'instinct
    finalAuto(sim, x.id, mode, x.player ? 'auto' : 'ai');
  }
}
// Conseil de lancement selon le profil et le vent de l'arrivée (banc d'essai du sprint simulé) : 'court' par vent
// de face ou pour un finisseur peu endurant, 'long' pour un endurant ou par vent de dos, sinon null (son instinct).
function sprintAdvice(x, fw) {
  const end = x.r.s.end || 70;
  if (fw === 'face') return 'court';
  if (end >= 75 || (fw === 'dos' && end >= 68)) return 'long';
  if (end <= 64) return 'court';
  return null;
}
// Rival le plus rapide du groupe d'un coureur (bouton « dans la roue de… » du final).
function fastestRival(x) {
  if (!x || !x.g) return null;
  return (
    x.g.riders.filter(y => y !== x && y.team !== x.team && !y.fin).sort((a, b) => b.r.s.spr - a.r.s.spr)[0] || null
  );
}
// Sprinteurs adverses de la course (consigne « dans la roue de… ») : les 8 plus rapides des autres équipes.
function rivalSprinters(rc, id) {
  const me = S.riders[id];
  const out = [];
  for (const T of S.teams)
    if (!me || T.id !== me.team)
      for (const y of rc.sel[T.id] || []) if (!rc.out[y] && S.riders[y].s.spr >= 75) out.push(S.riders[y]);
  return out.sort((a, b) => b.s.spr - a.s.spr).slice(0, 8);
}
// Les moments décisifs : les temps forts du dernier tiers de la course (ceux du joueur d'abord).
function decisiveMoments(sim, n = 3) {
  const all = (sim.hls || []).filter(h => !/a faim/.test(h.txt) && h.km != null && h.km >= sim.dist * 0.6);
  // les faits de course (attaques, reprises, lâchés) d'abord ; les points de situation (3 km, flamme rouge) en appoint
  const situ = h => /^(📍|🚩)/.test(h.txt);
  const facts = all.filter(h => !situ(h));
  const hl = facts.length >= n ? facts : facts.concat(all.filter(situ).slice(-(n - facts.length)));
  const mine = hl.filter(h => h.mine);
  const pick = mine.concat(hl.filter(h => !h.mine)).slice(-Math.max(n, mine.length));
  return pick.sort((a, b) => a.t - b.t).slice(-n);
}
// ---------- Récit d'une course jouée sans le joueur (adjoint ou simulation) ----------
// Pour chaque étape : vainqueur, sort de l'échappée, moments décisifs, et pourquoi les coureurs clés du joueur
// ont perdu (lâché, sprint). Lecture des relevés d'étape uniquement.
function raceStory(rc, full) {
  const L = [];
  const multi = rc.specs.length > 1;
  const nm = id => {
    const r = S.riders[id];
    const T = r ? teamOf(r) : null;
    return r ? `${riderName(r)}${T ? ` (${T.short})` : ''}` : '?';
  };
  const mine = new Set(rc.sel[0] || []);
  const key = id => ['leader', 'sprint', 'free'].includes((rc.orders[id] || {}).o);
  rc.stageRes.forEach((st, k) => {
    if (!st || !st.res || !st.res.length) return;
    const head = multi ? `<b>Ét. ${k + 1}</b> (${typeLbl(st.type).toLowerCase()}) : ` : '';
    const parts = [`${head}🏆 ${nm(st.res[0].id)}`];
    const b = breakExplain(st.brk);
    if (b && (full || !multi)) parts.push(b);
    if (st.moments && st.moments.length && (full || !multi))
      parts.push('🎬 ' + st.moments.map(h => `km ${h.km} : ${h.txt}`).join(' · '));
    L.push(parts.join('<br>'));
    if (!full || !st.stats) return;
    const res = st.res;
    for (const e of res) {
      if (!mine.has(e.id) || !key(e.id) || !st.stats[e.id]) continue;
      const d = st.stats[e.id];
      const r = S.riders[e.id];
      if (d.sp && (rc.orders[e.id] || {}).o === 'sprint') {
        const grp = res.filter(y => Math.abs(y.time - e.time) < 1);
        const lead = grp[0] === res[0];
        const x = sprintExplain(
          r,
          d.sp,
          lead ? res.indexOf(e) + 1 : grp.indexOf(e) + 1,
          S.riders[grp[0].id].s.spr,
          lead
        );
        if (x) L.push('&nbsp;&nbsp;🏁 ' + x.txt);
      } else if (e.gap > 0 && d.drop) {
        const x = dropExplain(r, d.drop, (rc.orders[e.id] || {}).o);
        if (x) L.push('&nbsp;&nbsp;🩺 ' + x.txt + ' ' + x.why);
      }
    }
  });
  return L;
}
// ---------- Résumé d'étape ----------
// Texte brut du résumé (copiable) et lignes pour l'affichage.
function stageSummary(rc, idx, sim) {
  const st = rc.stageRes[idx];
  const spec = rc.specs[idx];
  if (!st || !spec) return null;
  const nm = id => {
    const r = S.riders[id];
    return r ? `${riderName(r)} (${tshortOf(r)})` : '?';
  };
  const res = st.res;
  const L = [];
  const multi = rc.specs.length > 1;
  L.push(spec.name ? `${rc.name} — ${spec.name}` : `${rc.name} : ${typeLbl(spec.type)}, ${spec.dist} km`);
  if (spec.wx && spec.wx !== 'sec') L.push(WX[spec.wx]);
  L.push(
    `🏆 ${nm(res[0].id)} en ${fmtTime(res[0].time)}` +
      (res[1] ? ` devant ${nm(res[1].id)} (${fmtGap(res[1].gap)})` : '') +
      (res[2] ? ` et ${nm(res[2].id)} (${fmtGap(res[2].gap)})` : '') +
      '.'
  );
  if (sim && sim.gapHist && sim.gapHist.length) {
    const mx = sim.gapHist.reduce((a, p) => (p.gap > a.gap ? p : a), sim.gapHist[0]);
    if (mx.gap >= 30) L.push(`⏱ Écart maximal de l'échappée : ${fmtGap(mx.gap)} (km ${mx.km}).`);
  }
  if (sim && sim.hls && sim.hls.length) {
    const hl = sim.hls.filter(h => h.mine || !/a faim/.test(h.txt));
    const pickHl = hl.length > 8 ? hl.filter((h, i) => h.mine || i % Math.ceil(hl.length / 6) === 0).slice(0, 9) : hl;
    L.push('Moments clés :');
    for (const h of pickHl) L.push(`  • ${h.km != null ? `km ${h.km} — ` : ''}${h.txt}`);
  }
  if (st.komb) L.push(`🔥 Combativité : ${nm(st.komb)}.`);
  if (multi) {
    const g = gcList(rc);
    if (g.length)
      L.push(
        `🟡 Leader du général : ${nm(g[0])}${g[1] ? `, ${fmtGap(rc.gc[g[1]] - rc.gc[g[0]])} devant ${nm(g[1])}` : ''}.`
      );
  }
  const mine = res.map((e, i) => [e, i + 1]).filter(([e]) => S.riders[e.id] && S.riders[e.id].team === 0);
  if (mine.length)
    L.push(
      `${S.teams[0].name} : ` +
        mine
          .slice(0, 3)
          .map(([e, p]) => `${riderName(S.riders[e.id])} ${p}e`)
          .join(', ') +
        '.'
    );
  return L;
}
// Équipe courte d'un coureur (moteur, sans dépendre de l'interface).
function tshortOf(r) {
  const T = teamOf(r);
  return T ? T.short : '—';
}
