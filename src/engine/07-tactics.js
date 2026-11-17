/* Tactique : obéissance, radio, ordres conditionnels, DS auto, attaques, poursuites, bordures */
function obeyCheck(x, ord, sim) {
  if (sim && sim.carId === x.id) return true; // mode carrière : le joueur est le coureur
  const r = x.r;
  let p = 0.42 + (r.dis / 100) * 0.52 + (r.moral - 55) / 350;
  if (r.trait === 'modele') p += 0.22;
  if (r.trait === 'fragile') p += (r.moral - 55) / 160;
  if (SUBORD.includes(ord)) {
    let selfChance = false;
    const ld = sim ? sim.teamLeader[x.team.id] : null;
    if (sim) {
      if (x.g && x.g.ahead && x.g.riders.length <= 12) selfChance = true;
      if (ld && ld !== x && cap(x, x.gr || 0, 0) > cap(ld, x.gr || 0, 0) * 1.04) selfChance = true;
    }
    p -= (r.amb / 100) * (selfChance ? 0.5 : 0.12);
    if (x.player && ld && ld !== x) p += rel(x.id, ld.id) / 350;
    if (r.trait === 'leaderne' && selfChance) p -= 0.2;
    if (r.trait === 'opportuniste' && selfChance) p -= 0.15;
    if (r.trait === 'tete' && (ord === 'stop' || ord === 'wait' || ord === 'nopull' || ord === 'save')) p -= 0.25;
  } else {
    p += r.amb / 400;
  }
  p = clamp(p, 0.05, 0.985);
  return rnd() < p;
}
// applique un ordre radio à un coureur (obéissance comprise) ; renvoie true si exécuté
function applyRadio(sim, x, k, src) {
  // un ordre du joueur (radio ou consigne conditionnelle) prime : ni le directeur sportif ni le coureur ne le
  // remplacent tant que le joueur ne l'a pas levé (« retour à la consigne »)
  const human = src !== 'auto';
  if (!human && x.manual) return false;
  // mode carrière : on garde la trace des ordres que le joueur se donne (le directeur sportif jugera)
  if (sim.carId === x.id && src !== 'auto' && src !== 'cond')
    (sim.rc.carRadio = sim.rc.carRadio || []).push([k, x.order]);
  // seules les radios de l'équipe du joueur s'affichent dans le fil de la course
  const log = x.player ? globalThis.log : () => {};
  const nm = riderName(x.r);
  const pre =
    src === 'auto'
      ? sim.autoDS || !x.player
        ? '🤖 DS → '
        : '🚴 De lui-même → '
      : src === 'cond'
        ? '⚙️ Consigne → '
        : '📻 → ';
  if (k === 'reset') {
    if (human) x.manual = false;
    x.radio = null;
    x.markId = null;
    x.frontUntil = 0;
    if (x.rebel && obeyCheck(x, x.order, sim)) x.rebel = false;
    log(sim, `${pre}${nm} : retour à la consigne. « ${radioReply(x, x.rebel ? 'no' : 'ok')} »`, x.rebel ? 'bad' : 'me');
    return !x.rebel;
  }
  if (k === 'eat') return eatNow(sim, x, pre);
  if ((k === 'attack' || k === 'bridge') && (x.energy < 18 || x.punch < 22)) {
    log(sim, `${pre}${nm} : ${RADIO[k].lbl} — « ${radioReply(x, 'legs')} »`, 'bad');
    return false;
  }
  if ((k === 'chase' || k === 'bottles') && x.energy < 15) {
    log(sim, `${pre}${nm} : ${RADIO[k].lbl} — « ${radioReply(x, 'legs')} »`, 'bad');
    return false;
  }
  if (k === 'wait' && !sim.teamLeader[x.team.id]) {
    log(sim, `${pre}${nm} : « Attendre qui ? On n'a pas de leader désigné ! »`, 'bad');
    return false;
  }
  if (!obeyCheck(x, k === 'front' ? 'tempo' : k, sim)) {
    x.r.stats.disob++;
    (sim.refusals = sim.refusals || new Set()).add(x.id);
    if (x.player) x.st.disobWhy = disobRecord(sim, x, k);
    log(sim, `${pre}${nm} : ${RADIO[k].lbl} — « ${radioReply(x, 'no')} »`, 'bad');
    return false;
  }
  if (k === 'front') {
    x.frontUntil = sim.t + 20;
    x.energy = Math.max(0, x.energy - 1.5);
  } else if (k === 'bottles') {
    fetchBottles(sim, x);
  } else {
    x.radio = k;
    if (SUBORD.includes(k)) x.rebel = false;
  }
  if (human) x.manual = true;
  log(sim, `${pre}${nm} : ${RADIO[k].lbl} — « ${radioReply(x, 'ok')} »`, 'me');
  return true;
}
// Échappée condamnée (presque reprise, loin de l'arrivée) : se relever plutôt que s'épuiser pour rien.
function dsSitUp(sim, mine, ldr, once) {
  // 8. échappée condamnée (quelques secondes d'avance, loin de l'arrivée, un peloton qui roule fort) : se relever
  const chasing = sim.pel ? sim.pel.riders.filter(y => y.work >= 0.8).length : 0;
  for (const x of mine) {
    const G = x.g;
    if (
      G.ahead &&
      x !== ldr &&
      gapSec(G, sim.pel) < 10 &&
      sim.dist - G.pos > 20 &&
      chasing >= 2 &&
      x.radio !== 'stop' &&
      once('sit' + x.id, 60)
    ) {
      if (x.player) applyRadio(sim, x, 'stop', 'auto');
      else x.radio = 'stop';
    } else if (!G.ahead && x.radio === 'stop' && x.order !== 'save' && once('rs' + x.id, 10)) x.radio = null;
  }
}
// Un équipier redescend aux voitures chercher des bidons pour ses leaders.
function fetchBottles(sim, x) {
  const G = x.g;
  if (!G) return;
  feedCheck(sim, x);
  const mates = G.riders.filter(y => y.team === x.team && y !== x);
  for (const y of mates) y.food = Math.min(100, y.food + 22);
  x.food = Math.min(100, x.food + 22);
  x.energy = Math.max(0, x.energy - 3);
  const NG = newGroupFrom(sim, [x], Math.max(0, G.pos - (G.speed * rf(35, 55)) / 3600));
  NG.noMerge = 0;
  x.radio = null;
}
// Probabilité qu'un coureur respecte une consigne (discipline, moral, ambition, relations).
function obeyCheckPre(x, sim) {
  if (sim && sim.carId === x.id) return true;
  const r = x.r;
  let p = 0.62 + (r.dis / 100) * 0.4 + (r.moral - 55) / 300 - (r.amb / 100) * 0.18;
  const ld = sim && sim.teamLeader[x.team.id];
  if (x.player && ld && ld !== x) p += rel(x.id, ld.id) / 300;
  if (r.trait === 'modele') p += 0.3;
  if (r.trait === 'leaderne') p -= 0.12;
  if (r.trait === 'fragile') p += (r.moral - 55) / 150;
  return rnd() < clamp(p, 0.3, 0.99);
}
// Déclenche les ordres conditionnels du joueur quand leur condition est remplie.
function evalConds(sim, x) {
  const G = x.g;
  if (!G || x.fin || x.dnf) return;
  const kmLeft = sim.dist - G.pos;
  const front = sim.groups[0];
  for (const c of x.conds) {
    if (c.done) continue;
    let ok = false;
    switch (c.c) {
      case 'km':
        ok = kmLeft <= c.p;
        break;
      case 'gapUp':
        ok = front !== G && gapSec(front, G) >= c.p;
        break;
      case 'gapDown':
        ok = G.ahead && gapSec(G, sim.pel) <= c.p;
        break;
      case 'favAtt':
        ok =
          sim.lastAttack &&
          sim.lastAttack.fav &&
          sim.t - sim.lastAttack.t <= 0.5 &&
          sim.lastAttack.team !== x.team.id &&
          sim.lastAttack.gid === G.id;
        break;
      case 'lastClimb':
        ok = !!sim.lastClimb && G.pos >= sim.lastClimb.start;
        break;
      case 'ldrDrop': {
        const l = sim.teamLeader[x.team.id];
        ok = l && l !== x && !l.fin && l.g !== G && l.g.pos < G.pos;
        break;
      }
      case 'energy':
        ok = x.energy <= c.p;
        break;
    }
    if (ok) {
      c.done = true;
      log(sim, `⚙️ Condition remplie pour ${riderName(x.r)} : ${condTxt(c)}`, 'info');
      applyRadio(sim, x, c.a, 'cond');
      if (sim.autoPause && x.player) sim.pauseReq = 'Consigne conditionnelle : ' + riderName(x.r);
    }
  }
}
// Texte lisible d'un ordre conditionnel.
function condTxt(c) {
  const d = COND[c.c];
  return 'si ' + d.lbl.replace('…', c.p) + ' → ' + RADIO[c.a].lbl;
}
// directeur sportif automatique (pour l'équipe du joueur)
// Directeur sportif en course, le même pour les équipes IA et pour le DS automatique du joueur. L'IA ne passe
// pas par les ordres que ses coureurs prennent déjà d'eux-mêmes (attaques du leader, rythme des équipiers).
function autoDS(sim, T) {
  dsBrain(sim, T);
}
function dsBrain(sim, T) {
  const mine = sim.runners.filter(x => x.team === T && !x.fin && !x.dnf);
  if (!mine.length) return;
  // PL : le directeur sportif automatique du joueur (ses consignes radio en plus). Sans lui, l'équipe du joueur
  // court exactement comme une équipe de l'ordinateur : ses coureurs prennent ces décisions d'eux-mêmes.
  const PL = !!T.player && !!sim.autoDS;
  const log = T.player
    ? (s, m, t) => globalThis.log(s, sim.autoDS ? m : m.replace(/^🤖 DS ?: ?/, '🚴 Entre coureurs : '), t)
    : () => {};
  const once = (k, cd) => {
    sim.dsMem = sim.dsMem || {};
    if (sim.t - (sim.dsMem[k] ?? -999) < cd) return false;
    sim.dsMem[k] = sim.t;
    return true;
  };
  const ldr = sim.teamLeader[T.id],
    spr = sim.teamSprinter[T.id];
  // 1. se placer avant pavés / vent
  for (const G of new Set(mine.map(x => x.g))) {
    const soonWind = sim.P.wind >= 2 && [1, 2, 3, 4].some(k => terrainAt(sim, G.pos + k * 0.25)[2]);
    if ((G.nextSurf || soonWind) && G.riders.length >= 15 && once('front', 25)) {
      const key = G.riders.filter(
        x => x.team === T && (x === ldr || x === spr || x.order === 'protect' || x.order === 'leadout')
      );
      if (key.length) {
        for (const x of key) if (!x.manual) x.frontUntil = sim.t + 6;
        log(sim, `🤖 DS : placez-vous devant avant ${G.nextSurf ? 'le secteur pavé' : 'la zone ventée'} !`, 'me');
      }
    }
  }
  // 2. leader distancé : faire chasser / attendre (l'IA le fait déjà dans ses consignes de poursuite)
  if (ldr && !ldr.fin && !ldr.dnf && PL) {
    const G = ldr.g;
    const front = sim.groups.find(H => H.pos > G.pos + 0.03 && H.riders.some(y => sim.favs.has(y.id) && y.team !== T));
    if (front) {
      const gap = gapSec(front, G);
      if (gap > 30 && gap < 300 && once('chase', 12)) {
        const helpers = G.riders
          .filter(
            x =>
              x.team === T &&
              x !== ldr &&
              x.radio !== 'chase' &&
              x.energy > 25 &&
              ['protect', 'control', 'free'].includes(x.order)
          )
          .slice(0, 2);
        if (helpers.length) {
          log(sim, `🤖 DS : ${riderName(ldr.r)} est piégé à ${fmtGap(gap)} des favoris, on roule !`, 'me');
          for (const x of helpers) applyRadio(sim, x, 'chase', 'auto');
        } else if (ldr.radio !== 'chase' && ldr.energy > 30) applyRadio(sim, ldr, 'chase', 'auto');
      }
    } else {
      for (const x of mine)
        if (x.radio === 'chase' && x.g === ldr.g && x !== ldr && once('stopchase' + x.id, 4)) {
          x.radio = null;
        }
      if (ldr.radio === 'chase' && ldr.g === sim.groups[0]) ldr.radio = null;
    }
    // 3. marquer le principal rival
    if (!ldr.markId && ldr.g.riders.length > 1) {
      const riv = ldr.g.riders
        .filter(y => y.team !== T && sim.favs.has(y.id))
        .sort((a, b) => cap(b, 6, 0) - cap(a, 6, 0))[0];
      if (riv && once('mark', 30)) {
        ldr.markId = riv.id;
        log(sim, `🤖 DS : ${riderName(ldr.r)}, surveille ${riderName(riv.r)} !`, 'me');
      }
    }
    // 4. attaque du leader au bon moment
    const kmL = sim.dist - ldr.g.pos;
    const t = sim.spec.type;
    const lc = sim.lastClimb;
    const g = ldr.g.g;
    const inFinal =
      ((t === 'montagne' || t === 'sommet') && lc && ldr.g.pos >= lc.start && g >= 4) ||
      ((t === 'punch' || t === 'vallonne') && kmL < 12 && g >= 3.5) ||
      (t === 'paves' && kmL < 25 && ldr.g.surf);
    if (
      inFinal &&
      ldr.g.riders.length > 1 &&
      ldr.punch > 50 &&
      ldr.energy > 35 &&
      sim.t - ldr.lastAtt > 6 &&
      (sim.dsAtt || 0) < 3
    ) {
      const mine_ = cap(ldr, g, ldr.g.surf);
      const best = Math.max(...ldr.g.riders.filter(y => y !== ldr).map(y => cap(y, g, ldr.g.surf)));
      if (mine_ >= best * 0.985 && once('att', 3)) {
        sim.dsAtt = (sim.dsAtt || 0) + 1;
        log(sim, `🤖 DS : c'est le moment, ${riderName(ldr.r)}, attaque !`, 'me');
        applyRadio(sim, ldr, 'attack', 'auto');
      }
    }
  }
  // 3 bis. (IA) course par étapes : dans le final, le leader surveille son rival direct au général
  if (!PL && ldr && !ldr.fin && !ldr.dnf && !ldr.manual && sim.stageRace && !ldr.markId && ldr.g.riders.length > 1) {
    const kmL = sim.dist - ldr.g.pos;
    if (kmL < 30 && once('mark', 30)) {
      const my = sim.rc.gc[ldr.id];
      const riv = ldr.g.riders
        .filter(y => y.team !== T && sim.favs.has(y.id) && Math.abs(sim.rc.gc[y.id] - my) < 180)
        .sort((a, b) => Math.abs(sim.rc.gc[a.id] - my) - Math.abs(sim.rc.gc[b.id] - my))[0];
      if (riv) ldr.markId = riv.id;
    }
  }
  // 3 ter. jour sans ou leader à la limite dans la dernière montée : limiter la casse à son rythme
  if (ldr && !ldr.fin && !ldr.dnf && ldr.g.g >= 4 && inFinalClimb(sim, ldr.g) && ldr.radio !== 'pace') {
    // vraiment en difficulté : jour sans, ou nettement moins fort que les autres et sans plus de jus
    const weak = ldr.sansJour || (relStrength(ldr, ldr.g) < 0.95 && ldr.punch < 30);
    if (weak && ldr.g.riders.length > 2 && once('ldrpace', 20)) {
      log(sim, `🤖 DS : ${riderName(ldr.r)}, ne t'affole pas, monte à ton rythme et limite la casse.`, 'me');
      ldr.radio = 'pace';
      ldr.markId = null;
    }
  }
  // 3 quater. relais devant : l'équipier placé dans l'échappée se relève pour attendre son leader qui revient
  for (const x of mine) {
    if (x.sat && x.radio === 'wait' && ldr && x.g === ldr.g) x.radio = null; // rentré : il roule pour son leader
    if (!x.sat || x.radio === 'wait' || !ldr || ldr.fin || ldr.g === x.g) continue;
    const kmL = sim.dist - x.g.pos;
    if (
      ldr.g.pos < x.g.pos &&
      ldr.g.pos > sim.pel.pos - 0.01 &&
      gapSec(x.g, ldr.g) < 75 &&
      kmL < 50 &&
      ldr.g !== sim.pel
    ) {
      x.radio = 'wait';
      x.order = 'protect';
      log(sim, `🤖 DS : ${riderName(x.r)}, relève-toi, ${riderName(ldr.r)} arrive : tu roules pour lui !`, 'me');
    }
  }
  // 5. équipiers dans le rouge en montée : à leur rythme
  for (const x of mine) {
    if (!PL) break;
    if (
      x !== ldr &&
      x.g.g >= 3 &&
      x.I > 0.97 &&
      x.punch < 35 &&
      x.radio !== 'pace' &&
      sim.dist - x.g.pos > 2 &&
      once('pace' + x.id, 10)
    )
      applyRadio(sim, x, 'pace', 'auto');
  }
  // 6. ravitaillement : manger avant la fringale, alliance si l'échappée menace
  for (const x of mine)
    if (x.food < 28 && x.pocket > 0 && once('eat' + x.id, 6)) {
      if (PL) applyRadio(sim, x, 'eat', 'auto');
      else eatNow(sim, x, '');
    }
  if (!PL) {
    dsSitUp(sim, mine, ldr, once);
    return;
  }
  allyAuto(sim, T, once);
  const avgFood = sum(mine.map(x => x.food)) / mine.length;
  // (jamais dans les 20 derniers kilomètres : le ravitaillement y est interdit)
  const feedOk = sim.pel && sim.dist - sim.pel.pos > 22;
  if (feedOk && (avgFood < 50 || (sim.wx === 'chaleur' && avgFood < 75)) && once('bottles', 40)) {
    const d = mine.filter(
      x =>
        x !== ldr &&
        x !== spr &&
        x.work === 0 &&
        x.g === sim.pel &&
        x.energy > 40 &&
        ['protect', 'control', 'free'].includes(x.order)
    )[0];
    if (d) applyRadio(sim, d, 'bottles', 'auto');
  }
  // 7. échappée : attaquer avant le sprint si des sprinteurs plus rapides sont là
  for (const x of mine) {
    const G = x.g;
    if (
      G.ahead &&
      G.riders.length >= 3 &&
      sim.P.finishGrad < 3 &&
      sim.dist - G.pos < 12 &&
      sim.dist - G.pos > 2 &&
      x.punch > 40
    ) {
      const better = G.riders.some(y => y !== x && y.r.s.spr > x.r.s.spr + 3);
      if (better && once('brk' + x.id, 30)) {
        log(sim, `🤖 DS : ${riderName(x.r)}, ils sont plus rapides au sprint, il faut partir seul !`, 'me');
        applyRadio(sim, x, 'attack', 'auto');
      }
    }
  }
  dsSitUp(sim, mine, ldr, once);
}
// Attaque (ou jonction) d'un coureur : nouveau groupe en effort maximal pendant quelques pas.
function doAttack(sim, x, opts = {}) {
  const G = x.g;
  if (!G || x.fin) return false;
  const [g, surf] = terrainAt(sim, G.pos);
  if (x.energy < 12 || x.punch < 22) {
    return false;
  }
  const capA = cap(x, g, surf);
  x.st.att++;
  const NG = newGroupFrom(sim, [x], G.pos + 0.004);
  NG.burst = opts.bridge ? 4 : 3;
  NG.burstL = capA * (1.03 + (0.05 * x.punch) / 100);
  NG.noMerge = NG.burst + 1;
  NG.attacker = x;
  x.lastAtt = sim.t;
  sim.lastAttack = { t: sim.t, id: x.id, fav: sim.favs.has(x.id), gid: G.id, team: x.team.id };
  const followers = [];
  if (!opts.noFollow) {
    for (const y of G.riders.slice()) {
      if (y.fin || y.team === x.team) continue;
      const eo = effOrder(y);
      let want = 0;
      if (eo === 'leader') {
        // un leader ne suit que les coups qui comptent : un favori, un rival au général, ou tout ce qui bouge dans
        // le final. Les attaques pour l'échappée en début de course, ses équipiers s'en occupent.
        const rc = sim.rc;
        const rival =
          sim.stageRace &&
          rc.si > 0 &&
          rc.gc[x.id] != null &&
          rc.gc[y.id] != null &&
          rc.gc[x.id] - rc.gc[y.id] < R.rivalGap;
        const counts = sim.favs.has(x.id) || rival || phaseOf(sim, G) === 'final';
        want = counts ? (y.att === 'defensif' ? R.leaderFollowDef : R.leaderFollow) : R.leaderFollowIdle;
      } else if (eo === 'free') want = (y.r.amb / 100) * 0.55 + (sim.favs.has(y.id) ? 0.2 : 0);
      else if (eo === 'break' && G.pos < sim.dist * 0.5) want = 0.5;
      if (sim.favs.has(x.id) && eo === 'leader') want += 0.15;
      if (y.markId === x.id) want = 0.98;
      if (y.energy < 20) want *= 0.3;
      if (rnd() < want) {
        const c = cap(y, g, surf) * (0.96 + rnd() * 0.07);
        // sur un mur pavé, suivre la roue ne protège presque plus : il faut quasiment les jambes de l'attaquant
        if (c >= capA * (surf && g >= 3 ? R.murFollow : 0.95)) followers.push(y);
      }
    }
    shuffle(followers);
    const maxF = G.pos < sim.dist * 0.5 ? rint(0, 4) : 6;
    followers.length = Math.min(followers.length, maxF);
    for (const y of followers) moveTo(y, NG);
  }
  const nm = riderName(x.r);
  const fl = followers.length
    ? ` ${followers.length === 1 ? riderName(followers[0].r) + ' suit' : followers.length + ' coureurs suivent'}.`
    : '';
  if (x.player || sim.favs.has(x.id) || followers.some(y => y.player))
    log(
      sim,
      `⚡ Attaque de ${nm} (${x.team.short})${opts.bridge ? ' pour faire la jonction' : ''} !${fl}`,
      x.player ? 'me' : 'att'
    );
  if (x.player && sim.autoPause) sim.pauseReq = 'Attaque de ' + nm;
  if (!opts.bridge && (x.player || sim.favs.has(x.id)) && sim.dist - G.pos < 60)
    highlight(sim, `⚡ Attaque de ${nm} (${x.team.short}) !${fl}`, x.player);
  return true;
}
// Leader et sprinteur d'une équipe présents dans ce groupe.
function teamKeyIn(sim, T, G) {
  const L = sim.teamLeader[T.id],
    Sp = sim.teamSprinter[T.id];
  const ldr = L && !L.fin && !L.dnf && L.g === G && !L.rebel ? L : null;
  const spr = Sp && !Sp.fin && !Sp.dnf && Sp.g === G ? Sp : null;
  return { ldr, spr };
}
// L'équipe a-t-elle un coureur dans un groupe devant ?
function teamHasAhead(sim, T, G) {
  const c = sim._teamsAhead && sim._teamsAhead.get(G);
  if (c) return c.has(T);
  for (const H of sim.groups) {
    if (H.pos > G.pos + 0.03 && H.riders.some(y => y.team === T && !y.fin)) return true;
  }
  return false;
}
// Niveau de poursuite d'une équipe dans un groupe ([intensité, nombre de rouleurs]), plan de course compris.
function teamChaseLevel(sim, T, G, kmLeft) {
  const out = teamChaseLevel1(sim, T, G, kmLeft);
  // « on ne roule pas pour les autres » : sur un parcours accidenté, quand plusieurs équipes ont intérêt à
  // chasser, chacune laisse parfois les autres faire le travail quelques minutes (pas en cas d'urgence)
  if (
    G === sim.pel &&
    out[0] >= 0.75 &&
    out[0] < 0.9 &&
    sim.spec.type !== 'plat' &&
    sim.spec.type !== 'punch' &&
    kmLeft > 15 &&
    (sim.chasingTeams || 0) >= 2
  ) {
    const win = Math.floor(sim.t / 8);
    const h = (((T.id + 7) * 73856093) ^ (win * 19349663)) >>> 0;
    if (h % 100 < 30) return [out[0] * 0.6, Math.max(1, out[1] - 1)];
  }
  return out;
}
function teamChaseLevel1(sim, T, G, kmLeft) {
  const pm = planMode(sim, T, G);
  const base = isolateLeader(sim, T, G, kmLeft, teamChaseLevel0(sim, T, G, kmLeft));
  // une équipe défend toujours son leader menacé au général, quel que soit son plan (celle du joueur aussi : ses
  // coureurs savent ce qu'ils ont à faire)
  const defend = sim.stageRace && base[0] >= 0.86;
  if (pm === 'attente') return defend ? base : [0, 0];
  if (pm === 'offensif') return base[0] >= 0.9 || defend ? base : [0, 0];
  // durcir : tempo élevé dans les ascensions pour faire la sélection (pas une poursuite sur le plat)
  if (pm === 'durcir' && G.g >= 3 && G.riders.some(x => x.team === T) && (G === sim.groups[0] || G === sim.pel))
    return [Math.max(base[0], 0.9), Math.max(base[1], 3)];
  if (pm === 'controle') {
    const ahead = sim.groups.filter(H => H.pos > G.pos + 0.03);
    if (ahead.length) {
      const gap = gapSec(
        ahead.reduce((a, b) => (a.pos > b.pos ? a : b)),
        G
      );
      // contrôler, c'est garder l'échappée à un écart raisonnable, pas la reprendre
      const t = sim.spec.type;
      let allowed =
        t === 'montagne' || t === 'sommet' ? Math.max(180, (kmLeft - 15) * 5.5) : Math.max(60, (kmLeft - 10) * 3.5);
      // une échappée sans danger pour le général (tous à plus de 10 minutes) a droit à bien plus de marge
      if (sim.stageRace) {
        const front = ahead.reduce((a, b) => (a.pos > b.pos ? a : b));
        const mine = G.riders.filter(x => x.team === T).map(x => sim.rc.gc[x.id]);
        const ref = mine.length ? Math.min(...mine) : 0;
        const danger = Math.min(...front.riders.map(y => sim.rc.gc[y.id] - ref));
        if (danger > 600) allowed *= 1.8;
      }
      if (gap > allowed && !teamHasAhead(sim, T, G))
        return [Math.max(base[0], gap > allowed * 1.5 ? 0.88 : 0.8), Math.max(base[1], 2)];
    }
  }
  return base;
}
// Niveau de poursuite « naturel » selon la situation de course (menaces au général, sprint, victoire d'étape).
function teamChaseLevel0(sim, T, G, kmLeft) {
  const ahead =
    (sim._ahead && sim._ahead.get(G)) ||
    sim.groups.filter(H => H !== G && H.pos > G.pos + 0.03 && H.riders.some(y => !y.fin));
  if (!ahead.length) {
    // devant : contrôle tranquille si leader/sprinteur présent
    const { ldr, spr } = teamKeyIn(sim, T, G);
    if (spr && kmLeft < 20 && G.riders.length > 12) return [0.84, 2];
    if (ldr && sim.stageRace && leaderGcRank(sim.rc, ldr.id) === 1 && G.riders.length > 15) return [0.7, 1];
    // groupe de tête issu d'une cassure : les équipes dont le leader y est appuient si des rivaux sont derrière
    if ((ldr || spr) && G !== sim.pel && G.riders.length > 12) {
      const rivalsBack = sim.groups.some(H => H !== G && H.riders.some(y => y.team !== T && sim.favs.has(y.id)));
      if (rivalsBack) return [0.88, 3];
    }
    // en tête d'une classique à arrivée plate : le leader ne ramène pas les sprinteurs lâchés
    if (ldr && !sim.stageRace && sim.P.finishGrad < 3 && G === sim.groups[0] && kmLeft < sim.dist * 0.5) {
      const sprBack = sim.groups.some(
        H => H !== G && gapSec(G, H) < 120 && H.riders.some(y => y.team !== T && y.r.s.spr > ldr.r.s.spr + 6)
      );
      if (sprBack) return [0.88, 2];
    }
    return [0, 0];
  }
  const front = ahead.reduce((a, b) => (a.pos > b.pos ? a : b));
  const gap = gapSec(front, G);
  const { ldr, spr } = teamKeyIn(sim, T, G);
  // bagarre pour l'échappée : une équipe qui n'a personne devant ne laisse pas partir un groupe trop petit
  // (seules les équipes qui voulaient placer un homme devant — un coureur « échappée » resté dans le peloton — chassent)
  if (
    sim.brkState === 'fight' &&
    G === sim.pel &&
    gap < 90 &&
    !teamHasAhead(sim, T, G) &&
    G.riders.some(x => x.team === T && effOrder(x) === 'break')
  )
    return [0.8, 1];
  if (!ldr && !spr) return [0, 0];
  const favAhead = ahead.some(H => H.riders.some(y => y.team !== T && sim.favs.has(y.id)));
  const aheadMate = teamHasAhead(sim, T, G) && !favAhead && !(gap > Math.max(150, (kmLeft - 25) * 3.5));
  const t = sim.spec.type;
  let level = 0,
    nw = 0;
  if (
    spr &&
    (t === 'plat' || (t === 'punch' && kmLeft < 95) || (t === 'vallonne' && kmLeft < 80 && spr.r.s.col >= 66)) &&
    !aheadMate
  ) {
    const allowed = Math.min(300, Math.max(0, (kmLeft - 7) * 4.2));
    if (gap > allowed * 1.5 + 40) {
      level = 0.97;
      nw = 4;
    } else if (gap > allowed + 20) {
      level = 0.92;
      nw = 3;
    } else if (gap > allowed * 0.6) {
      level = 0.84;
      nw = 2;
    }
  }
  if (ldr) {
    // menace au général ?
    let threat = false;
    if (sim.stageRace) {
      // une échappée n'est une menace que si elle contient un vrai rival, ou si elle prend trop de marge par rapport au maillot
      const myGc = sim.rc.gc[ldr.id];
      const yel = leaderGcRank(sim.rc, ldr.id) === 1;
      const gcC = gcCached(sim.rc);
      if (!sim.rkTop || sim.rkTop.c !== gcC)
        sim.rkTop = { c: gcC, m: new Map(gcC.arr.slice(0, 12).map((id, k) => [id, k])) };
      const rk = sim.rkTop.m;
      const tol = Math.max(60, (kmLeft - 12) * (yel ? 3.2 : 4.5));
      for (const H of ahead) {
        const gh = gapSec(H, G);
        for (const y of H.riders) {
          if (y.fin) continue;
          const d = sim.rc.gc[y.id] - myGc;
          if (d >= gh + 30) continue;
          const rival = sim.favs.has(y.id) || (rk.has(y.id) && rk.get(y.id) < 10);
          if (rival || gh > tol || (yel && d < gh - tol * 0.4)) {
            threat = true;
            break;
          }
        }
        if (threat) break;
      }
    } else {
      threat =
        ahead.some(H => H.riders.some(y => sim.favs.has(y.id))) || gap > Math.min(400, Math.max(60, (kmLeft - 15) * 5));
    }
    const yellow = sim.stageRace && leaderGcRank(sim.rc, ldr.id) === 1;
    if (threat && (!aheadMate || sim.stageRace)) {
      const l2 = gap > 90 ? 0.92 : 0.86;
      if (l2 > level) {
        level = l2;
        nw = G === sim.pel ? 3 : 2;
      }
    } else if (yellow && gap > 360 && !aheadMate) {
      if (0.82 > level) {
        level = 0.82;
        nw = 2;
      }
    } else if (yellow && gap > 200 && !aheadMate) {
      if (0.75 > level) {
        level = 0.75;
        nw = 1;
      }
    }
    // classique d'un jour : les équipes des favoris contrôlent l'échappée matinale pour la reprendre avant le final
    // (25 à 35 km de l'arrivée), comme sur les Flandres, Roubaix ou Liège où elle va très rarement au bout
    if (
      !sim.stageRace &&
      sim.favs.has(ldr.id) &&
      !aheadMate &&
      (t === 'paves' || t === 'vallonne' || t === 'punch') &&
      kmLeft > 8
    ) {
      const allowed = Math.max(20, (kmLeft - R.classicCatchKm) * R.classicGapKm);
      if (gap > allowed) {
        const l4 = gap > allowed * 1.6 ? 0.94 : gap > allowed * 1.2 ? 0.9 : 0.86;
        if (l4 > level) {
          level = l4;
          nw = gap > allowed * 1.6 ? 4 : gap > allowed * 1.2 ? 3 : 2;
        }
      }
    }
    // intérêt pour la victoire d'étape : un leader favori ne laisse pas l'échappée prendre trop d'avance
    if (
      sim.favs.has(ldr.id) &&
      ['sommet', 'punch', 'vallonne'].includes(t) &&
      !aheadMate &&
      (T.style === 'gc' || T.style === 'agressif' || rnd() < (t === 'vallonne' ? 0.8 : t === 'punch' ? 0.75 : 0.4))
    ) {
      const lc = sim.lastClimb;
      const climbLeft = lc ? Math.max(0, lc.end - Math.max(G.pos, lc.start)) : 0;
      const allowed =
        t === 'sommet' || t === 'punch'
          ? Math.max(
              45,
              climbLeft * (t === 'sommet' ? 52 : 24) + Math.max(0, kmLeft - climbLeft) * (t === 'sommet' ? 6 : 1.4)
            )
          : Math.max(45, (kmLeft - 5) * 5.2);
      if (gap > allowed) {
        const l3 = gap > allowed * 1.5 ? 0.9 : 0.85;
        if (l3 > level) {
          level = l3;
          nw = gap > allowed * 1.5 ? 3 : 2;
        }
      }
    }
    // tempo de sélection en montagne
    const [g] = terrainAt(sim, G.pos);
    if (
      g >= 4 &&
      (t === 'montagne' || t === 'sommet') &&
      kmLeft < (t === 'montagne' ? 30 : 45) &&
      G.riders.length > 6 &&
      sim.favs.has(ldr.id)
    ) {
      if (0.86 > level) {
        level = 0.86;
        nw = 2;
      }
    }
  }
  return [level ? Math.min(0.98, level * (level > 0.8 ? styleMul(T, 'chase') : 1)) : 0, nw];
}
// Ordre radio du joueur : provoquer une bordure (vent de côté).
function tryEchelon(sim) {
  const G = sim.groups.find(H => H.riders.some(x => x.player) && H.riders.length >= 25);
  if (!G) return 'Pas de gros peloton avec vos coureurs.';
  if (!G.expo || !sim.P.wind) return 'Pas de vent de côté ici : impossible de faire la bordure.';
  const mine = G.riders.filter(x => x.player && x.energy > 30 && !x.rebel);
  if (mine.length < 3) return 'Il faut au moins 3 coureurs frais dans le peloton.';
  const q = sum(mine.map(x => (x.r.s.pla + (x.r.s.plc || 65)) / 2)) / mine.length;
  for (const x of mine) {
    x.energy -= 4;
    x.punch = Math.max(0, x.punch - 15);
  }
  if (rnd() < clamp(0.15 + (q - 65) / 40 + mine.length * 0.05 + sim.P.wind * 0.08, 0.1, 0.85)) {
    echelon(sim, G, mine[0].team);
    return null;
  }
  log(sim, `🌬️ Tentative de bordure de ${mine[0].team.name}… le peloton résiste.`, 'bad');
  return null;
}
// Coupe un groupe en bordure : les mieux placés passent, les autres sont piégés.
function echelon(sim, G, T) {
  const sc = G.riders.map(x => [
    x,
    x.pos + (x.r.s.plc || 65) * 0.35 + (x.team === T ? 40 : 0) + (x.r.s.pla - 70) * 0.4 + gauss() * 14,
  ]);
  sc.sort((a, b) => b[1] - a[1]);
  const K = rint(16, 32);
  const back = sc.slice(K).map(a => a[0]);
  if (back.length < 5) return;
  const BG = newGroupFrom(sim, back, G.pos - 0.03);
  BG.noMerge = 6;
  sim.echelon = { T, until: sim.t + 20 };
  sim.echelonT = sim.t;
  const mineF = G.riders.filter(x => x.player),
    mineB = back.filter(x => x.player);
  log(
    sim,
    `🌬️ BORDURE ! ${T.name} met le peloton en éventail : ${G.riders.length} devant, ${back.length} piégés derrière.${mineB.length ? ' Piégés : ' + mineB.map(x => riderName(x.r)).join(', ') + '.' : ''}${mineF.length ? ' Devant : ' + mineF.map(x => riderName(x.r)).join(', ') + '.' : ''}`,
    mineB.length ? 'bad' : 'att'
  );
  if (sim.autoPause && (mineB.length || mineF.length)) sim.pauseReq = 'Bordure !';
  highlight(
    sim,
    `🌬️ BORDURE ! ${T.name} coupe le peloton : ${back.length} coureurs piégés.`,
    mineB.length || mineF.length
  );
}
// Intérêt d'une attaque (gain attendu − coût) : chance de tenir jusqu'à l'arrivée (supériorité physique, pente,
// distance restante), valeur de la victoire (temps au général pour un leader), fraîcheur (jus, réserves).
// Renvoie un multiplicateur de l'envie d'attaquer, proche de 1 en moyenne.
function attackUtility(sim, x, rel, kmLeft, g) {
  const steep = clamp((g - 2) / 6, 0, 1);
  const hold = clamp(
    0.5 + (rel - 0.97) * 8 + steep * 0.25 - Math.max(0, kmLeft - 8) * (0.012 - 0.008 * steep),
    0.05,
    0.95
  );
  const fresh = clamp((x.punch - 30) / 50, 0, 1) * clamp((x.energy - 20) / 40, 0, 1);
  let value = 1;
  if (sim.stageRace && effOrder(x) === 'leader') {
    const rk = leaderGcRank(sim.rc, x.id);
    if (rk === 1)
      value = 0.7; // le maillot n'a pas à prendre de risque
    else if (rk > 1 && rk <= 10) value = 1.4; // du temps à reprendre
  }
  const u = hold * value * (0.4 + 0.6 * fresh) - (1 - hold) * 0.25;
  return clamp(0.65 + 1.2 * u, 0.35, 1.7);
}
// « Isoler le maillot » : en montagne, une équipe IA dont le leader vise le podium durcit la course quand le
// maillot n'a plus qu'un équipier (ou aucun) autour de lui, pour le forcer à tout faire seul.
function isolateLeader(sim, T, G, kmLeft, base) {
  if (!sim.stageRace || G !== sim.pel || kmLeft > 60 || kmLeft < 4 || G.g < 3) return base;
  const t = sim.spec.type;
  if (t !== 'montagne' && t !== 'sommet') return base;
  const ld = sim.teamLeader[T.id];
  if (!ld || ld.g !== G) return base;
  const rk = leaderGcRank(sim.rc, ld.id);
  if (rk < 2 || rk > 6) return base;
  const yId = gcCached(sim.rc).arr[0];
  const y = G.riders.find(x => x.id === yId);
  if (!y || y.team === T) return base;
  const yMates = G.riders.filter(x => x.team === y.team && x !== y).length;
  const myMates = G.riders.filter(x => x.team === T && x !== ld).length;
  if (yMates <= 1 && myMates >= 2) return [Math.max(base[0], 0.9), Math.max(base[1], 2)];
  return base;
}
