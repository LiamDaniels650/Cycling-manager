/* Décision de chaque coureur à chaque pas de course : consignes, relais, attaques, placement, échappées,
   gestion de l'effort. Appelée par simStep (08-stage-sim.js) pour chaque coureur, dans un ordre aléatoire. */

// Décision individuelle d'un coureur pour ce pas (rôle, travail, attaques).
function decideRider(sim, x, ctx) {
  const { chase, workersCount, pel } = ctx;
  const dtMin = DT_MIN;
  const G = x.g;
  if (!G) return;
  const kmLeft = sim.dist - G.pos,
    g = G.g,
    surf = G.surf;
  x.work = 0;
  // ordres radio ponctuels
  if (x.radio === 'attack') {
    x.radio = null;
    if (!doAttack(sim, x)) log(sim, `📻 ${riderName(x.r)} : « ${radioReply(x, 'legs')} »`, 'bad');
    return;
  }
  if (x.radio === 'bridge') {
    x.radio = null;
    if (!doAttack(sim, x, { bridge: true, noFollow: true }))
      log(sim, `📻 ${riderName(x.r)} : « ${radioReply(x, 'legs')} »`, 'bad');
    return;
  }
  const eo = effOrder(x);
  const ldr = sim.teamLeader[x.team.id];
  // --- attendre le leader ---
  if (
    (eo === 'wait' || (eo === 'protect' && x.waitCD <= 0)) &&
    ldr &&
    ldr !== x &&
    !ldr.fin &&
    !ldr.dnf &&
    ldr.g !== G &&
    ldr.g.pos < G.pos
  ) {
    const gp = gapSec(G, ldr.g);
    const helpers = ldr.g.riders.filter(y => y.team === x.team && y !== ldr).length;
    const rl = x.player ? rel(x.id, ldr.id) : 0;
    if (
      (eo === 'wait' && gp < 240) ||
      (eo === 'protect' &&
        rl > -40 &&
        gp < (rl > 40 ? 220 : 150) &&
        (helpers < 2 || rl > 40) &&
        !(G.ahead && x.g.riders.length <= 12 && kmLeft < 30))
    ) {
      moveTo(x, ldr.g);
      x.waitCD = 30;
      if (x.player && sim.t - (x.waitLog || -99) > 20 && (x.waitLog = sim.t))
        log(sim, `📻 ${riderName(x.r)} se relève et attend ${riderName(ldr.r)}.`, 'me');
      if (eo === 'wait') x.radio = null;
      return;
    }
  }
  if (x.waitCD > 0) x.waitCD--;
  if (eo === 'stop' || eo === 'nopull' || eo === 'save') {
    x.work = 0;
    return;
  }
  if (eo === 'pace') {
    x.work = G.riders.length <= 3 ? 0.9 : 0;
    return;
  }
  if (eo === 'chase') {
    x.work = 0.92;
    return;
  }
  if (eo === 'tempo') {
    x.work = 0.8;
    return;
  }

  // --- plan offensif : les équipiers attaquent ---
  if (
    planMode(sim, x.team, G) === 'offensif' &&
    G === pel &&
    G.riders.length >= 20 &&
    x.punch > 55 &&
    x.energy > 45 &&
    sim.t - x.lastAtt > 15 &&
    kmLeft > 2 &&
    x.r.s.bar >= 65 &&
    !teamHasAhead(sim, x.team, G) &&
    ((!x.hc && (eo === 'protect' || eo === 'control' || eo === 'free' || eo === 'break')) ||
      (x.hc && (eo === 'free' || eo === 'break')))
  ) {
    const front = sim.groups[0];
    const estab =
      front !== pel && front.riders.length >= (sim.spec.type === 'plat' ? 5 : 9) && phaseOf(sim, G) !== 'final';
    const ldrHere = ldr && ldr.g === G && kmLeft < 30;
    if (!estab && !ldrHere && rnd() < 0.012 * dtMin * (x.r.s.bar / 72)) {
      doAttack(sim, x);
      return;
    }
  }
  // --- échappée en début de course ---
  if (eo === 'break' && !x.breakTried && G === pel && G.pos < sim.dist * 0.55 && G.pos > 1) {
    const front = sim.groups[0];
    // le chasseur du maillot de la montagne veut absolument être de l'échappée : il compte sur ses jambes de grimpeur
    // et part en contre tant que l'échappée n'a pas plus de deux minutes (au pied d'une montée, il fait la jonction)
    const hunt = sim.stageRace && sim.rc.komHunt && sim.rc.komHunt[x.team.id] === x.id;
    const est =
      front !== pel &&
      (sim.brkState === 'gone' || front.riders.length >= sim.brkTarget) &&
      !(hunt && gapSec(front, pel) < R.hunterBridge && (g >= 3 || G.nextClimb));
    const far =
      front !== pel && gapSec(front, pel) > (front.riders.length >= 5 ? 150 : sim.spec.type === 'plat' ? 200 : 360);
    if (!est && !far) {
      if (rnd() < (hunt ? R.hunterTry * (Math.max(x.r.s.bar, x.r.s.mon) / 72) : R.breakTry * (x.r.s.bar / 72))) {
        // tant que la bagarre dure, les candidats insistent (surtout en montagne, où l'échappée est convoitée)
        const mt = sim.spec.type === 'montagne' || sim.spec.type === 'sommet';
        x.breakTried = rnd() < (sim.spec.type === 'plat' ? 0.35 : mt ? 0.1 : 0.22);
        doAttack(sim, x, { bridge: front !== pel });
        return;
      }
    } else x.breakTried = true;
  }
  if (
    g >= 3 &&
    x.ownPace &&
    sim.t - x.ownPace < 20 &&
    G.riders.length <= 6 &&
    (eo === 'leader' || eo === 'pace' || eo === 'protect')
  ) {
    x.work = 0.9;
    return;
  }
  // --- jonction / retour sur le groupe de devant ---
  const gi = sim.groups.indexOf(G);
  const H = gi > 0 ? sim.groups[gi - 1] : null;
  if (H && G !== pel && (G.riders.length <= 12 || G.pos < pel.pos) && eo !== 'save') {
    const gh = gapSec(H, G);
    const behindPel = G.pos < pel.pos;
    if (
      (behindPel &&
        gh < (kmLeft > 30 ? 300 : 120) &&
        x.energy > 22 &&
        (g < 3 || (x.energy > 45 && sim.t - (x.dropT || -99) > 8))) ||
      (!behindPel && gh < 35 && kmLeft > 3) ||
      // bagarre pour l'échappée : les contres font la jonction avec le groupe de tête au lieu de rouler isolés
      (!behindPel && sim.brkState === 'fight' && gh < 50 && x.energy > 35 && eo !== 'leader' && eo !== 'sprint')
    ) {
      if (!(G.ahead && (eo === 'protect' || eo === 'control') && ldr && ldr.g !== G && ldr.g !== H)) {
        x.work = g >= 3 ? 0.82 : 0.9;
        return;
      }
    }
  }
  // bagarre pour l'échappée : un attaquant isolé (ou un duo) qui ne voit venir personne finit par se relever
  if (
    sim.brkState === 'fight' &&
    G !== pel &&
    G.pos > pel.pos &&
    G.riders.length < Math.max(2, sim.brkTarget / 3) &&
    sim.t - (x.lastAtt || 0) > 15 &&
    gapSec(G, pel) < 90
  ) {
    x.work = 0.5;
    return;
  }
  // --- groupe de tête (échappée / attaque) ---
  // (une grosse échappée de montagne est aussi un groupe de tête : ses coureurs relaient puis s'attaquent dans le final)
  if ((G.ahead || (G === sim.groups[0] && G !== pel)) && (G.riders.length <= 14 || G.pos > pel.pos + 0.5)) {
    const chased = gapSec(G, pel) < Math.max(60, kmLeft * 12);
    let w = kmLeft > 35 && !chased ? 0.8 : 0.88;
    if (G.riders.length === 1) w += 0.04;
    if (eo === 'save') w = 0;
    // équipier dont le leader est derrière : ne relaie pas
    if ((eo === 'protect' || eo === 'control' || eo === 'leadout') && ldr && ldr.g !== G && !ldr.fin)
      w = kmLeft < 25 ? 0.3 : 0;
    const spB = sim.teamSprinter[x.team.id];
    if (spB && spB !== x && spB.g !== G && !spB.fin && sim.P.finishGrad < 3 && kmLeft < 60) w = 0;
    if (G.riders.length >= 3 && sim.P.finishGrad < 3 && kmLeft < 15) {
      const bs = G.riders.reduce((a, b) => (b.r.s.spr > a.r.s.spr ? b : a));
      if (bs === x && x.r.s.bar < 75) w = Math.min(w, 0.35);
    }
    if (kmLeft < 1.2) w = 0;
    if (eo === 'leader' && G.riders.length > 2 && sim.stageRace === false && kmLeft > 10) w = 0.75;
    x.work = w;
    // pactes et accords de relais (négociations dans l'échappée)
    const yields = (x.pact || x.coopUntil || x.sulkUntil) && pactWork(sim, x, G, kmLeft);
    // attaques dans l'échappée en fin de course
    if (!yields && G.riders.length > 1 && kmLeft < 22 && kmLeft > 0.8 && sim.t - x.lastAtt > 8 && x.energy > 20) {
      const sprintFin = sim.P.finishGrad < 3;
      const bestSpr = Math.max(...G.riders.filter(y => y !== x).map(y => y.r.s.spr));
      let p = 0;
      if (sprintFin && x.r.s.spr < bestSpr - 3) p = 0.035 * (x.r.s.bar / 70);
      if (g >= 3.5) p = Math.max(p, 0.05 * (x.r.s.mon / 72));
      if (eo === 'leader') p *= x.att === 'defensif' ? 0.4 : 1.3;
      if (x.r.trait === 'tete') p *= 1.6;
      p *= styleMul(x.team, 'att');
      if (p > 0 && rnd() < p * dtMin) {
        doAttack(sim, x);
        return;
      }
    }
    return;
  }
  // --- peloton / groupes de poursuite ---
  let [lvl, nw] = chase.get(ckey(G, x.team)) || [0, 0];
  if (sim.echelon && sim.echelon.T === x.team && sim.t < sim.echelon.until && G === sim.groups[0]) {
    lvl = Math.max(lvl, 0.93);
    nw = Math.max(nw, 4);
  }
  const isWorkerType =
    eo === 'control' ||
    eo === 'protect' ||
    (eo === 'leadout' && kmLeft > 14) ||
    (eo === 'free' && !x.hc && x.r.amb < 45);
  if (lvl > 0 && isWorkerType) {
    const k = ckey(G, x.team);
    const wc = workersCount.get(k) || 0;
    const pref = eo === 'control' ? 0 : eo === 'protect' ? (kmLeft < 30 ? 0 : 1) : 2;
    if (wc < nw && (pref === 0 || rnd() < 0.85)) {
      workersCount.set(k, wc + 1);
      x.work = lvl;
    }
  }
  // poisson-pilote
  if (eo === 'leadout') {
    const Sp = sim.teamSprinter[x.team.id];
    if (Sp && Sp.g === G && kmLeft < 12 && kmLeft > 0.4 && !G.ahead && G === sim.groups[0]) {
      x.work = kmLeft < 3.5 ? 0.98 : 0.86;
    }
  }
  // leader / libre : attaques dans le final
  if ((eo === 'leader' || eo === 'free') && G.riders.length > 1 && sim.t - x.lastAtt > 7 && x.energy > 28) {
    let window = 0;
    const t = sim.spec.type;
    if (t === 'montagne' || t === 'sommet' || t === 'vallonne' || t === 'punch') {
      const lc = sim.lastClimb,
        pc = sim.prevClimb;
      const start = x.att === 'loin' && pc ? pc.start : lc ? lc.start : sim.dist - 10;
      if (G.pos >= start - 0.5 && g >= 3.5) window = 1;
      if (t === 'punch' && kmLeft < 1.6) window = 1.5;
      if (t === 'vallonne' && kmLeft < 12 && kmLeft > 2) window = Math.max(window, 0.4);
    } else if (t === 'paves') {
      if (surf && kmLeft < 70) window = g >= 3 && !sim.stageRace ? R.murAttack : 0.6; // mur pavé : le moment de partir
      if (kmLeft < 15) window = Math.max(window, 0.5);
    } else if (t === 'plat') {
      if (kmLeft < 8 && kmLeft > 1.5) window = 0.15;
    }
    if (window > 0) {
      const capX = cap(x, g, surf);
      let best = 0; // meilleure capacité parmi les autres coureurs du groupe
      for (const y of G.riders)
        if (y !== x) {
          const cy = cap(y, g, surf);
          if (cy > best) best = cy;
        }
      const rel = capX / (best || 1);
      let p = 0;
      const util = attackUtility(sim, x, rel, kmLeft, g);
      if (eo === 'leader') {
        p = x.att === 'defensif' ? 0.015 : rel >= 0.985 ? 0.11 : rel >= 0.96 ? 0.05 : 0.012;
      } else {
        p =
          (x.r.amb / 100) *
          (rel >= 0.99 ? 0.06 : 0.02) *
          (x.r.trait === 'tete' ? 2 : 1) *
          (x.r.trait === 'opportuniste' ? 1.5 : 1);
        if (x.hc && x.order !== 'free' && !x.rebel) p = 0;
      }
      if (sim.stageRace && eo === 'leader' && leaderGcRank(sim.rc, x.id) === 1) p *= 0.5;
      p *= util;
      p *= styleMul(x.team, 'att');
      p *= window;
      if (rnd() < p * dtMin) {
        doAttack(sim, x);
        return;
      }
    }
  }
  // contre-attaque juste après une reprise
  if (
    sim.counterUntil > sim.t &&
    G === sim.groups[0] &&
    G.riders.length > 8 &&
    (eo === 'free' ||
      eo === 'break' ||
      // un leader au général ne contre pas dans la première partie d'une étape : le peloton ne le laisserait pas
      // filer et il se griller ; il le fait dans le final (ou s'il n'a plus rien à perdre au général)
      (eo === 'leader' &&
        x.att !== 'defensif' &&
        (phaseOf(sim, G) === 'final' ||
          (sim.stageRace ? leaderGcRank(sim.rc, x.id) > 10 : phaseOf(sim, G) !== 'debut')))) &&
    x.r.s.bar >= 68 &&
    x.punch > 45 &&
    x.energy > 30 &&
    sim.t - x.lastAtt > 5 &&
    !(x.hc && x.order !== 'free' && !x.rebel)
  ) {
    if (rnd() < 0.12 * (x.r.s.bar / 75) * styleMul(x.team, 'att') * dtMin) {
      if (doAttack(sim, x)) {
        if (x.player || sim.favs.has(x.id) || rnd() < 0.5)
          log(
            sim,
            `↪️ Contre-attaque de ${riderName(x.r)} (${x.team.short}) juste après la jonction !`,
            x.player ? 'me' : 'att'
          );
        return;
      }
    }
  }
  // attaque en descente (bons descendeurs, dans le final)
  if (
    (eo === 'leader' || eo === 'free') &&
    g <= -3.5 &&
    kmLeft < 35 &&
    (x.r.s.des || 60) >= 74 &&
    G.riders.length > 1 &&
    x.punch > 35 &&
    sim.t - x.lastAtt > 6 &&
    !(x.hc && eo === 'free' && x.order !== 'free' && !x.rebel)
  ) {
    const lc = sim.lastClimb;
    if (lc && G.pos > lc.end) {
      if (rnd() < 0.05 * ((x.r.s.des - 70) / 10) * dtMin * styleMul(x.team, 'att')) {
        if (doAttack(sim, x)) {
          log(sim, `⬇️⚡ ${riderName(x.r)} (${x.team.short}) attaque dans la descente !`, x.player ? 'me' : 'att');
          return;
        }
      }
    }
  }

  // rythme de course des leaders dans le final
  if ((eo === 'leader' || (eo === 'free' && x.r.amb > 50)) && g >= 3.5) {
    const t = sim.spec.type;
    const lc = sim.lastClimb;
    const inFinal =
      t === 'montagne' || t === 'sommet'
        ? (lc && G.pos >= lc.start - 0.5) || (x.att === 'loin' && sim.prevClimb && G.pos >= sim.prevClimb.start - 0.5)
        : kmLeft < 25;
    if (inFinal) x.work = Math.max(x.work, eo === 'leader' ? (x.att === 'defensif' ? 0.84 : 0.9) : 0.87);
  }
  // course par étapes, dernière montée : les favoris (groupe de référence, sans équipier devant) roulent eux-mêmes
  // derrière une échappée encore à portée pour lui disputer la victoire d'étape et les bonifications
  if (
    eo === 'leader' &&
    sim.stageRace &&
    G === sim.pel &&
    G.riders.length <= 15 &&
    sim.groups[0] !== G &&
    g >= 3 &&
    inFinalClimb(sim, G) &&
    sim.favs.has(x.id) &&
    x.energy > 20 &&
    gapSec(sim.groups[0], G) < R.mtnLeaderGap &&
    !teamHasAhead(sim, x.team, G)
  )
    x.work = Math.max(x.work, 0.9);
  // classique d'un jour : dans le final, un favori sans équipier devant prend ses responsabilités et roule lui-même
  // derrière l'échappée (les leaders des classiques ne courent pas dans les roues jusqu'à la ligne)
  if (
    eo === 'leader' &&
    !sim.stageRace &&
    kmLeft < R.classicLeaderKm &&
    kmLeft > 3 &&
    G !== sim.groups[0] &&
    G.riders.length <= 40 &&
    sim.favs.has(x.id) &&
    x.energy > 25 &&
    gapSec(sim.groups[0], G) < 420 &&
    !teamHasAhead(sim, x.team, G) &&
    // derrière l'échappée matinale seulement : derrière un favori parti seul, les leaders se regardent (plus bas)
    !sim.groups[0].riders.some(y => sim.favs.has(y.id))
  )
    x.work = Math.max(x.work, R.classicLeaderWork);
  // un leader distancé roule pour revenir
  if (eo === 'leader' && G !== sim.groups[0] && G.riders.length < 40) {
    const front =
      G.pos < sim.pel.pos - 0.01
        ? sim.pel
        : sim.groups.find(
            H =>
              H.pos > G.pos + 0.03 &&
              H.riders.some(
                // sur une course par étapes, un grimpeur déjà loin au général peut filer : ce n'est pas au leader de rouler
                y =>
                  sim.favs.has(y.id) &&
                  y.team !== x.team &&
                  (!sim.stageRace || sim.rc.gc[y.id] - sim.rc.gc[x.id] < gapSec(H, G) + 30)
              )
          );
    if (front && gapSec(front, G) < 240) {
      // final d'une classique : derrière un favori parti seul, les leaders se regardent (personne ne veut emmener
      // les autres) ; fenêtres de 2 minutes, hasard figé par coureur pour ne pas toucher à la série de la course
      const marking =
        !sim.stageRace &&
        sim.dist - G.pos < 30 &&
        front.riders.length <= 2 &&
        G.riders.filter(y => effOrder(y) === 'leader').length >= 3 &&
        (((x.id * 2654435761) ^ (Math.floor(sim.t / 2) * 40503)) >>> 0) % 100 < R.classicMarking;
      x.work = Math.max(x.work, marking ? 0 : 0.86);
    }
  }
}
// Le groupe est-il dans la dernière montée décisive (arrivée au sommet, ou dernier col à moins de 40 km) ?
function inFinalClimb(sim, G) {
  if (sim.finClimb !== null) return G.pos >= sim.finClimb;
  const lc = sim.lastClimb;
  return !!(lc && lc.len >= 3 && lc.end > sim.dist - 40 && G.pos >= lc.start && G.pos <= lc.end);
}
// Début de la montée finale si l'arrivée est en côte (null sinon).
function finalClimbStart(sim) {
  const cl = sim.P.climbs;
  const fc = cl[cl.length - 1];
  return fc && sim.P.finishGrad >= 3 && fc.end > sim.dist - 0.6 ? fc.start : null;
}
