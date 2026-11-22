/* Physique d'un pas de course : rythme et vitesse de chaque groupe, effort et énergie de chaque coureur, lâchés,
   incidents (chutes, crevaisons, ennuis mécaniques) et regroupements. Appelée par simStep (08-stage-sim.js). */

// Physique : rythme de chaque groupe, vitesse, effort, énergie, lâchés.
function tickPhysics(sim) {
  const dtH = DT_H;
  for (const G of sim.groups.slice()) {
    // copie : un groupe de lâchés créé pendant le tick ne doit pas avancer deux fois
    const g = G.g,
      surf = G.surf,
      n = G.riders.length;
    if (!n) continue;
    // capacité de chaque coureur sur ce terrain : calculée une seule fois par pas
    const capM = new Map();
    for (const x of G.riders) capM.set(x, cap(x, g, surf));
    let capsD = null;
    const capsDesc = () => capsD || (capsD = [...capM.values()].sort((a, b) => b - a));
    const ws = G.riders.filter(x => x.work > 0);
    let L;
    // origine du rythme (lecture seule, pour expliquer les lâchés au joueur) : attaque, tempo d'équipe, sélection…
    let paceSrc = G.burst > 0 ? 'att' : ws.length ? 'tempo' : 'calme';
    const att0 = G.burst > 0 ? G.attacker : null;
    let L0 = 0;
    if (G.burst > 0) {
      L = G.burstL;
      G.burst--;
    } else if (ws.length) {
      const c = ws.map(x => capM.get(x) * x.work);
      const mx = Math.max(...c),
        mean = sum(c) / c.length;
      const cw = clamp((g - 2) / 3, 0, 1);
      L = mean * (1 - cw) + mx * cw + (1 - cw) * (n >= 15 ? 2.4 : 1.4) * Math.sqrt(Math.min(8, ws.length - 1));
    } else {
      const caps = [...capM.values()].sort((a, b) => a - b);
      // personne ne roule : le peloton (un vrai, 20 coureurs ou plus) temporise ; dans une classique, un groupe de tête où personne ne relaie se
      // relève (ses coureurs attendent leur leader ou refusent de tirer) ; un groupe de lâchés monte à son rythme
      // (dans les 30 derniers km d'une classique pavée, les favoris de tête ne se relèvent pas : ils s'attaquent sans
      // cesse et l'allure reste celle d'une course, sinon les poursuivants revenaient tous sur le bitume)
      const pavFinal = sim.spec.type === 'paves' && !sim.stageRace && sim.dist - G.pos < 30;
      L =
        caps[Math.floor(caps.length * 0.5)] *
        (G === sim.pel && n >= 20
          ? 0.64
          : G.ahead && n >= 2 && !sim.stageRace
            ? pavFinal
              ? R.pavFinalPace
              : R.noWorkAhead
            : 0.8);
    }
    // sur les pavés, les spécialistes en tête imposent un rythme qui fait le tri
    if (surf && n >= 6 && G.burst <= 0 && sim.dist - G.pos < sim.dist * 0.55) {
      const caps = capsDesc();
      // secteur pavé dans la seconde moitié de course : les spécialistes roulent à bloc, plus encore dans les monts
      L0 = L;
      L = Math.max(L, caps[Math.floor(n * 0.12)] * (g >= 3 ? 0.95 : 0.91));
      // final d'une classique pavée (derniers 35 %) : les meilleurs spécialistes font exploser la course
      if (!sim.stageRace && n >= R.cobbleBlowN && sim.dist - G.pos < sim.dist * 0.35)
        L = Math.max(L, caps[Math.floor(n * 0.03)] * 1.0);
      if (L > L0) paceSrc = 'pav';
    }
    // final d'une classique pavée, petit groupe (2 à 11 coureurs) : il n'est pas épargné, le plus fort sur les pavés
    // impose son allure et ceux qui sont moins à l'aise (les sprinteurs le plus souvent) perdent le contact
    if (surf && n >= 2 && n < R.cobbleBlowN && G.burst <= 0 && !sim.stageRace && sim.dist - G.pos < sim.dist * 0.35) {
      L0 = L;
      L = Math.max(L, capsDesc()[0] * R.cobbleSmall);
      if (L > L0) paceSrc = 'pav';
    }
    // mur pavé dans le final d'une classique : le plus fort du groupe de tête monte à bloc et fait la différence
    // (Vieux Quaremont, Paterberg : les favoris s'y retrouvent seuls ou à deux)
    if (surf && g >= 3 && n >= 2 && G.burst <= 0 && !sim.stageRace && sim.dist - G.pos < sim.dist * 0.35) {
      L0 = L;
      L = Math.max(L, capsDesc()[0] * R.murPace);
      if (L > L0) paceSrc = 'pav';
    }
    // dernière côte d'une classique accidentée (Roche-aux-Faucons, Cauberg) : le plus fort du groupe des favoris
    // fait la sélection lui-même
    const lc = sim.lastClimb;
    if (
      !sim.stageRace &&
      !surf &&
      g >= 4 &&
      n >= 2 &&
      G.burst <= 0 &&
      lc &&
      G.pos >= lc.start &&
      G.pos <= lc.end &&
      sim.dist - G.pos < 25 &&
      G.riders.some(x => sim.favs.has(x.id))
    ) {
      L0 = L;
      L = Math.max(L, capsDesc()[0] * R.lastClimbPace);
      if (L > L0) paceSrc = 'finale';
    }
    if (g >= 4 && n >= 6 && G.burst <= 0) {
      const caps = capsDesc();
      L0 = L;
      L = Math.max(L, caps[Math.floor(n * 0.2)] * 0.7);
      // classique d'un jour : dans les côtes du final, les équipes des favoris montent à bloc et font le tri
      // (les sprinteurs n'arrivent pas avec les meilleurs à Liège ou à l'Amstel)
      if (!sim.stageRace && sim.dist - G.pos < R.classicHardKm && G.riders.some(x => sim.favs.has(x.id)))
        L = Math.max(
          L,
          sim.dist - G.pos < 30 ? caps[Math.floor(n * 0.1)] * 0.95 : caps[Math.floor(n * 0.15)] * R.classicClimbPace
        );
      if (L > L0) paceSrc = 'montee';
    }
    // échappée dans la dernière montée : chacun joue sa carte, les meilleurs grimpeurs durcissent dès le pied
    // (l'échappée se disperse, au lieu d'arriver groupée au pied des 4 derniers km)
    if (g >= 3 && n >= 3 && G.burst <= 0 && sim.pel && G !== sim.pel && G.pos > sim.pel.pos && inFinalClimb(sim, G)) {
      const caps = capsDesc();
      L0 = L;
      L = Math.max(L, caps[Math.floor(n * 0.25)] * 0.9);
      if (L > L0) paceSrc = 'finale';
    }
    // arrivée en côte : dans les derniers km de la montée finale, les plus forts du groupe font la course
    // (idem dans les 4 derniers km du dernier col d'une étape de montagne : les favoris s'y expliquent)
    const lastColFinal =
      sim.finClimb === null && sim.lastClimb && inFinalClimb(sim, G) && G.pos >= sim.lastClimb.end - 4;
    if (
      g >= 3 &&
      n >= 2 &&
      G.burst <= 0 &&
      ((sim.finClimb !== null && G.pos >= Math.max(sim.finClimb, sim.dist - 3)) || lastColFinal)
    ) {
      const caps = capsDesc();
      L0 = L;
      L = Math.max(L, caps[Math.min(n - 1, Math.floor(n * 0.1))] * 0.95);
      if (L > L0) paceSrc = 'finale';
    }
    // dans la dernière montée, un petit groupe sans relayeur monte au rythme de son plus fort élément
    if (n <= 4 && g >= 3 && G.burst <= 0 && !ws.length && inFinalClimb(sim, G)) {
      L0 = L;
      L = Math.max(L, capsDesc()[0] * 0.96);
      if (L > L0) paceSrc = 'finale';
    }
    // groupe de chasseurs de maillot relevés : ils montent tranquillement (gruppetto)
    if (G.riders.every(y => y.sitUp)) {
      const caps = [...capM.values()].sort((a, b) => a - b);
      L = Math.min(L, caps[Math.floor(caps.length * 0.5)] * R.sitUpPace);
    }
    if (G.noMerge > 0) G.noMerge--;
    G.L = L;
    // vitesse de référence (calibrée), puis conditions du jour par la physique (air, vent, revêtement, pluie)
    const vRef =
      speedOf(L, g, surf, false, true) *
      eqGroupMul(G, g, surf) *
      (n >= 10 && g < 2.5 && ws.length ? 1 + 0.08 * Math.min(1, (n - 10) / 40) : 1);
    G.cond = roadCond(sim, G);
    G.speed = physSpeed(vRef, g, G.cond, n >= 2 ? 0.2 : PHY.cda, g < -2 ? descentTech(sim, G.pos) : 0.5);
    if (sim.neutral && sim.neutral.G === G) G.speed *= 0.8; // le peloton attend un favori tombé
    // retour dans la file des voitures : un petit groupe juste derrière le peloton, hors montée, profite de l'abri de la caravane
    const pel = sim.pel;
    if (pel && G !== pel && G.pos < pel.pos && g < 3 && !surf && sim.dist - G.pos > 8 && sim.spec.type !== 'montagne') {
      const gp = ((pel.pos - G.pos) / Math.max(20, pel.speed || 40)) * 3600;
      if (gp < 90) G.speed *= 1 + 0.07 * (1 - gp / 90) + 0.02;
    }
    G.prev = G.pos;
    G.pos += G.speed * dtH;
    if (Math.floor(G.pos / 5) > Math.floor(G.prev / 5))
      for (const x of G.riders) {
        x.st.cv.push(Math.round(x.energy));
      }
    // effort individuel
    const ex = G.expo && sim.P.wind ? sim.P.wind : 0;
    const d = Math.min(1, draftF(g, surf, n) + ex * 0.035);
    const nw = Math.max(1, ws.length);
    const big = n >= 12 && g < 3;
    // placement dans le groupe
    if (n >= 8) {
      const kmL = sim.dist - G.pos;
      for (const x of G.riders) {
        const eo = effOrder(x);
        let T = 50;
        if (x.frontUntil > sim.t) {
          x.pos = clamp(x.pos + 6 + gauss() * 2, 0, 100);
          continue;
        }
        if (x.work > 0) T = 95;
        else if (eo === 'leader' || eo === 'sprint') T = kmL < 40 || ex || G.nextSurf || G.nextClimb ? 85 : 62;
        else if (eo === 'protect' || eo === 'leadout' || eo === 'control') {
          const ld = sim.teamLeader[x.team.id] || sim.teamSprinter[x.team.id];
          T = ld && ld.g === G ? (G.nextSurf || G.nextClimb ? 84 : 78) : 55;
        } else if (eo === 'save') T = 22;
        else T = 45 + x.r.amb / 5;
        const up = (3 + (x.r.s.plc || 65) / 22) * (n > 60 ? 0.6 : 1);
        const before = x.pos;
        x.pos = clamp(x.pos + clamp(T - x.pos, -8, up) + gauss() * 3, 0, 100);
        // remonter un gros peloton coûte : frotter, relancer, prendre le vent (lutte de placement avant les zones clés)
        if (n >= 40 && x.pos > before + 2) x.energy = Math.max(0, x.energy - (x.pos - before) * 0.012);
      }
      // il n'y a pas de place pour tout le monde devant : la position réelle est un rang dans le groupe,
      // que les bons frotteurs (placement) défendent mieux
      if (n >= 20) {
        const sc = G.riders.map(x => [x, x.pos + ((x.r.s.plc || 65) - 65) * 0.6 + gauss() * 4]);
        sc.sort((a, b) => a[1] - b[1]);
        sc.forEach(([x], i) => {
          x.pos = x.pos * 0.5 + ((i + 0.5) / n) * 100 * 0.5;
        });
      }
    }
    const drop = [];
    // équipiers bien placés de chaque équipe (ils abritent leurs coéquipiers dans un grand groupe)
    const isEsc = y => y.pos > 70 && ESCORT_ORD.has(effOrder(y));
    const escN = new Map();
    if (big) for (const y of G.riders) if (isEsc(y)) escN.set(y.team, (escN.get(y.team) || 0) + 1);
    // équipiers autour du leader ou du sprinteur (abri du vent, relances, bidons) : quelques % d'économie,
    // surtout sur le plat (le sillage compte moins en montée)
    const mates = new Map();
    if (n >= 3)
      for (const y of G.riders)
        if (ESCORT_ORD.has(effOrder(y)) && y.energy > 8) mates.set(y.team, (mates.get(y.team) || 0) + 1);
    const shelterK = g < 3 ? 0.012 : g < 6 ? 0.006 : 0.003;
    for (const x of G.riders) {
      let need;
      if (G.attacker === x && G.burst >= 0 && G.burstL === L) need = L;
      else if (x.work > 0) need = L * (d + (1 - d) / nw);
      else {
        need = L * d * (effOrder(x) === 'save' ? 0.97 : 1);
        const eox = effOrder(x);
        if ((eox === 'leader' || eox === 'sprint') && mates.has(x.team))
          need *= 1 - Math.min(4, mates.get(x.team)) * shelterK;
        if (big) {
          let pm = 0.07 * Math.pow(x.pos / 100, 2) * (1 + ex * 0.5);
          const esc = (escN.get(x.team) || 0) - (isEsc(x) ? 1 : 0) > 0;
          if (esc) pm *= 0.45;
          need *= 1 + pm;
        }
      }
      const c = capM.get(x);
      const I = need / c;
      // puissance réelle développée (affichage et bilan de l'étape)
      x.pw = riderWatts(
        x.r.kg || 68,
        G.speed,
        g,
        airShare(n, x.work, nw, G.attacker === x && G.burst >= 0, x.pos),
        0.32,
        G.cond
      );
      powerAdd(x.st, x.pw, DT_MIN * 60);
      let dr;
      if (I < 0.5) dr = x.energy < 65 ? -5 * (0.5 + x.r.s.rec / 150) : 1.6;
      else if (I < 0.75) dr = 1.6 + (I - 0.5) * 8;
      else if (I < 0.9) dr = 3.5 + (I - 0.75) * 85;
      else if (I < 1.0) dr = 16.25 + (I - 0.9) * 250;
      else dr = 41.25 + (I - 1) * 900;
      const coldHigh = sim.wx === 'froid' && x.alt > 1500; // froid en haute montagne : on brûle plus, on mange plus
      if (dr > 0)
        dr *=
          (1.45 - x.r.s.end / 120) *
          // pavés : vibrations, relances, maniement du vélo usent bien plus ceux qui ne savent pas y rouler
          // (72 de pavés : usure normale ; 86 : -35 % ; 60 : +30 %)
          (surf ? clamp(1 + (72 - (x.r.s.pav || 60)) / 40, 0.55, 1.5) : 1) *
          // chaleur : les gabarits lourds évacuent mal la chaleur (≈ +1 % d'usure par kilo au-dessus de 66 kg)
          (sim.wx === 'chaleur' ? 1.15 * clamp(1 + ((x.r.kg || 68) - 66) * 0.01, 0.95, 1.15) : 1) *
          (x.food < 25 ? 1.35 : 1) *
          (coldHigh ? 1.12 : 1);
      x.food = Math.max(
        0,
        x.food -
          (5 + 9 * Math.min(1.2, I)) * dtH * (sim.wx === 'chaleur' ? 1.4 : coldHigh ? 1.3 : 1) * (x.eqf.food || 1)
      );
      if (x.food < 6 && !x.bonk) {
        x.bonk = true;
        x.energy = Math.max(0, x.energy - 12);
        if (x.player || sim.favs.has(x.id))
          log(sim, `🍌 Fringale pour ${riderName(x.r)} (${x.team.short}) !`, x.player ? 'bad' : '');
      } else if (x.bonk && x.food > 25) x.bonk = false;
      hungerCheck(sim, x);
      x.energy = clamp(x.energy - dr * dtH, 0, 100);
      wbalStep(x, Math.max(30, x.pw), I, DT_MIN * 60, sim.wx === 'froid');
      x.I = I;
      const km = G.speed * dtH;
      x.st.Is += I;
      x.st.n++;
      if (x.work > 0) x.st.kw += km;
      if (G.ahead) x.st.kf += km;
      const eoX = effOrder(x);
      // gestion de l'effort (lâcher prise à temps pour monter à son rythme) : même règle pour tous les coureurs,
      // qu'ils soient dirigés par le joueur ou par l'IA
      const smart =
        eoX === 'pace' ||
        (eoX === 'leader'
          ? x.att === 'defensif' || x.punch < 30
          : eoX === 'protect' || eoX === 'control' || eoX === 'leadout' || eoX === 'save');
      if (
        (komSitUp(sim, x, G) && g >= 3 && n > 1 && G.riders.some(y => !y.sitUp)) ||
        I > 1.0 + 0.085 * Math.min(1, x.punch / 40) ||
        (x.energy <= 1 && I > 0.92) ||
        (smart &&
          g >= 3 &&
          I > (eoX === 'pace' ? 0.96 : 1.0) &&
          G.burst <= 0 &&
          (x.punch < 35 || eoX === 'pace') &&
          sim.dist - G.pos > 1.5)
      ) {
        drop.push(x);
        x.ownPace = sim.t;
      }
    }
    G.attacker = G.burst > 0 ? G.attacker : null;
    if (drop.length && drop.length < n) {
      if (inFinalClimb(sim, G)) {
        // dernière montée : chacun craque à son tour et monte ensuite à son propre rythme
        for (const x of drop) {
          const NG = newGroupFrom(sim, [x], G.pos - 0.003 - Math.min(0.025, Math.max(0, x.I - 1) * 0.06));
          NG.speed = G.speed * 0.95;
          NG.noMerge = 2;
          NG.dropped = true;
        }
      } else {
        const NG = newGroupFrom(sim, drop, G.pos - 0.02);
        NG.speed = G.speed * 0.9;
        NG.noMerge = 4;
        NG.dropped = true;
      }
      for (const x of drop) {
        x.dropT = sim.t;
        if (x.player) x.st.drop = dropRecord(sim, G, x, paceSrc, ws, att0);
        if (sim.t - (x.dropLog || -99) < 15) continue;
        x.dropLog = sim.t;
        if (x.player || (sim.favs.has(x.id) && G.pos > sim.dist * 0.4))
          log(
            sim,
            `⬇️ ${riderName(x.r)} (${x.team.short}) est lâché${x.energy < 5 ? ', il a explosé' : ''}.`,
            x.player ? 'bad' : ''
          );
      }
    }
  }
}
// Crevaisons et chutes.
function tickIncidents(sim, live) {
  const dtH = DT_H;
  for (const x of live) {
    if (x.fin || x.dnf) continue;
    const G = x.g;
    const km = G.speed * dtH;
    const kmLeft = sim.dist - G.pos;
    const pP =
      0.00022 *
      km *
      (G.surf ? 7 * (0.55 + 0.15 * Math.min(5, G.surf)) * x.eqf.pavPunct * (x.recon ? 0.85 : 1) : 1) *
      x.eqf.punct;
    const wet = sim.wx === 'pluie';
    const pC =
      0.0001 *
      km *
      (wet ? (G.surf || G.g < -3 ? 1.8 : 1.2) : 1) *
      (G.surf ? 3 * (0.64 + 0.12 * Math.min(5, G.surf)) : 1) *
      (G.g < -3
        ? 2.5 *
          clamp(1 + (70 - (x.r.s.des || 68)) / 25, 0.6, 2.2) *
          (G.burst > 0 ? 1.5 : 1) *
          // descente technique : bien plus de risques, surtout sous la pluie
          (0.55 + 0.9 * descentTech(sim, G.pos)) *
          (wet ? 0.7 + 0.6 * descentTech(sim, G.pos) : 1)
        : 1) *
      (kmLeft < 5 && G.riders.length > 20 ? 3 : 1) *
      (sim.dangerT === sim.t && G === sim.pel && x.pos < 40 ? 2 : 1) * // rond-point, rétrécissement
      (G.riders.length >= 20 ? clamp(1.6 - x.pos / 100, 0.6, 1.6) : 1) *
      (wet && x.eqf.tyres === 'larges' ? 0.8 : 1) * // pneus larges sous la pluie
      (wet ? x.eqf.wetK || 1 : 1) * // adhérence des pneus, pression
      (sim.P.wind >= 2 && x.eqf.wheels === 'hautes' ? 1.25 : 1) * // roues hautes par grand vent
      (x.recon && (G.g < -3 || G.surf) ? 0.75 : 1); // descente ou secteurs pavés reconnus : on sait où frotter
    x.st.risk += pC; // exposition aux chutes (mesure du risque pris)
    if (rnd() < pP) {
      incident(sim, x, 'crevaison');
    } else if (rnd() < mecaRisk(sim, x, km)) {
      incident(sim, x, 'meca');
    } else if (rnd() < pC) {
      incident(sim, x, 'chute');
    }
  }
  massCrashTick(sim);
}
// Crevaison ou chute d'un coureur : perte de temps, blessure éventuelle, coureurs piégés derrière.
function incident(sim, x, type) {
  const G = x.g;
  const why = type === 'chute' ? '' : punctureWhy(sim, x, G);
  let lossS = type === 'chute' ? rf(25, 80) : type === 'meca' ? mecaLoss(sim, x, G) : punctureLoss(sim, x, G);
  let sheltered = false;
  let giver = null;
  if (type === 'crevaison' && x === sim.teamLeader[x.team.id] && G.riders.length > 3) {
    giver = G.riders.find(y => y.team === x.team && y !== x && ['protect', 'control'].includes(effOrder(y)));
    if (giver) {
      lossS = rf(8, 14);
    }
  }
  if (giver) {
    const GG = newGroupFrom(sim, [giver], Math.max(0, G.pos - (G.speed * rf(45, 75)) / 3600));
    GG.noMerge = 0;
  } else {
    const l0 = lossS;
    lossS = carShelter(sim, x, lossS);
    sheltered = lossS < l0;
  }
  const NG = newGroupFrom(sim, [x], Math.max(0, G.pos - (G.speed * lossS) / 3600));
  NG.noMerge = 0;
  let txt = `${type === 'chute' ? '💥 Chute' : type === 'meca' ? '⚙️ Ennui mécanique' : '🔧 Crevaison'} pour ${riderName(x.r)} (${x.team.short})`;
  if (type === 'chute' && (x.player || sim.favs.has(x.id)))
    highlight(sim, `💥 Chute de ${riderName(x.r)} (${x.team.short}) !`, x.player);
  if (type === 'chute') {
    // fair-play : le leader du général (ou l'un des trois premiers) tombe loin de l'arrivée, le peloton l'attend
    const rc = sim.rc;
    const top3 = sim.stageRace && rc.gc ? gcList(rc).slice(0, 3) : [];
    const lead = top3.includes(x.id);
    if (sim.stageRace && !sim.neutral && G === sim.pel && lead && sim.dist - G.pos > 25 && G.riders.length >= 20) {
      sim.neutral = { G, until: sim.t + 5, who: x };
      log(
        sim,
        `🤝 Chute de ${riderName(x.r)} : le peloton se relève et l'attend, course neutralisée.`,
        x.player ? 'me' : 'info'
      );
      highlight(sim, `🤝 Le peloton attend ${riderName(x.r)} après sa chute`, x.player);
    }
    x.energy = Math.max(0, x.energy - rf(6, 25));
    x.punch = Math.max(0, x.punch - 30);
    if (G.riders.length >= 25 && rnd() < 0.35) {
      // seuls les coureurs juste derrière la chute sont piégés (au plus 25), pour quelques secondes
      const behind = G.riders
        .filter(y => y !== x && y.pos < x.pos - 3 && y.pos > x.pos - 30 && rnd() < 0.6)
        .sort((a, b) => b.pos - a.pos)
        .slice(0, 25);
      if (behind.length >= 3) {
        const BG = newGroupFrom(sim, behind, Math.max(0, G.pos - (G.speed * rf(5, 20)) / 3600));
        BG.noMerge = 2;
        if (behind.some(y => y.player || sim.favs.has(y.id)))
          log(
            sim,
            `⚠️ La chute coupe le peloton : ${behind.length} coureurs piégés derrière${
              behind.filter(y => y.player).length
                ? ' dont ' +
                  behind
                    .filter(y => y.player)
                    .map(y => riderName(y.r))
                    .join(', ')
                : ''
            }.`,
            'bad'
          );
      }
    }
    if (rnd() < 0.1 * (x.player && S.staff ? 1.2 - 0.1 * S.staff.doctor : 1)) {
      x.dnf = true;
      x.r.injury = Math.max(1, Math.round(rint(1, 5) * (x.player && S.staff ? 1.25 - 0.1 * S.staff.doctor : 1)));
      txt += ' — abandon, blessé';
      sim.rc.out[x.id] = true;
      gcDirty(sim.rc);
    }
  }
  // équipiers qui attendent un leader
  const ldr = sim.teamLeader[x.team.id];
  if (giver) txt += `, ${riderName(giver.r)} lui donne sa roue`;
  else if (type !== 'chute')
    txt += ` : ≈${Math.round(lossS)} s perdues (${why}${sheltered ? ', il revient à l’abri des voitures' : ''})`;
  if (!x.dnf && (x === ldr || x === sim.teamSprinter[x.team.id])) {
    const helpers = G.riders
      .filter(y => y.team === x.team && ['protect', 'control', 'leadout'].includes(effOrder(y)))
      .slice(0, 2);
    for (const y of helpers) moveTo(y, NG);
    if (helpers.length) txt += `, ${helpers.length} équipier(s) l'attendent`;
  }
  if (x.player || sim.favs.has(x.id)) {
    log(sim, txt + '.', x.player ? 'bad' : '');
    if (x.player && sim.autoPause) sim.pauseReq = txt;
  }
}
// Jonctions entre groupes.
function tickMerges(sim) {
  sim.groups = sim.groups.filter(G => G.riders.length);
  sim.groups.sort((a, b) => b.pos - a.pos);
  for (let i = 0; i < sim.groups.length - 1; i++) {
    const A = sim.groups[i],
      B = sim.groups[i + 1];
    if (B.pos >= A.pos - 0.012 && A.noMerge <= 0 && B.noMerge <= 0 && (B.speed >= A.speed - 0.3 || B.pos >= A.pos)) {
      const wasBreak = A.ahead && B === sim.pel && A.riders.length < B.riders.length;
      if (
        wasBreak &&
        A.riders.length &&
        (A.riders.some(x => x.player || sim.favs.has(x.id)) || A.riders.length >= 3 || A.pos > sim.dist * 0.5)
      )
        log(sim, `🔁 Le groupe de ${A.riders.length} coureur(s) est repris par le peloton.`, '');
      // reprise de l'échappée du jour (pas des attaques de la bagarre du départ) : relevée pour le bilan d'étape
      if (
        wasBreak &&
        !sim.brkCaught &&
        sim.brkIds &&
        A.riders.filter(y => sim.brkIds.has(y.id)).length > A.riders.length / 2
      )
        sim.brkCaught = catchRecord(sim, A, B);
      if (wasBreak && A.riders.length && sim.dist - B.pos < 25)
        highlight(
          sim,
          `🔁 Le peloton reprend ${A.riders.length === 1 ? riderName(A.riders[0].r) : 'les ' + A.riders.length + ' échappés'} à ${Math.round(sim.dist - B.pos)} km de l'arrivée !`,
          A.riders.some(x => x.player)
        );
      if (wasBreak && sim.dist - B.pos < 45 && sim.dist - B.pos > 3) sim.counterUntil = sim.t + 2.5;
      for (const x of A.riders.slice()) moveTo(x, B);
      B.pos = Math.max(A.pos, B.pos);
      A.riders = [];
      sim.groups.splice(i, 1);
      i--;
    }
  }
}
