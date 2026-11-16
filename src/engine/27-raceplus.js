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
