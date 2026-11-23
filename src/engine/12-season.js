/* Semaine (forme, fatigue, progression, finances), avance du calendrier et fin de saison */
// Gain d'entraînement d'une semaine (plan pl, facteur g0 = âge × marge de progression × encadrement) : la
// caractéristique travaillée, plus une au hasard (souvent une du profil). Commun au monde pro et au mode carrière.
// Perte de poids par semaine selon le plan d'entraînement (kg) ; 0,15 par défaut, reprise de poids au repos.
const KG_BURN = { foncier: 0.25, altitude: 0.25, intensif: 0.25, montagne: 0.2 };
function trainGain(r, pl, g0) {
  // progression décimale cachée (r.sx) : chaque semaine apporte une fraction de point, le point s'affiche une fois
  // la fraction atteinte. Même progression moyenne qu'un tirage au sort, sans les paliers aléatoires.
  const sx = (r.sx = r.sx || {});
  const inc = (k, a) => {
    if (r.s[k] >= 95) return;
    const v = (sx[k] || 0) + a * g0 * (0.7 + 0.6 * rnd());
    if (v >= 1) {
      r.s[k]++;
      sx[k] = Math.round((v - 1) * 100) / 100;
    } else sx[k] = Math.round(v * 100) / 100;
  };
  if (pl === 'foncier') {
    inc('end', 0.2);
    inc('rec', 0.08);
    inc('pla', 0.1);
  } else if (pl === 'montagne' || pl === 'altitude') {
    inc('mon', 0.2);
    inc('col', 0.07);
    if (pl === 'altitude') inc('end', 0.06);
  } else if (pl === 'sprint') {
    inc('spr', 0.2);
    inc('plc', 0.07);
    inc('col', 0.04);
  } else if (pl === 'clm') {
    inc('clm', 0.2);
    inc('pla', 0.06);
  } else if (pl === 'paves') {
    inc('pav', 0.2);
    inc('plc', 0.06);
    inc('pla', 0.04);
  } else if (pl === 'intensif') {
    inc(pick(STATS), 0.24);
  } else {
    inc(pick(STATS), 0.1);
  }
  // progression générale, surtout dans les points forts du profil
  inc(pick(PRIMARY[r.arch] || ['pla']), 0.33 * 0.55);
  inc(pick(STATS), 0.33 * 0.45);
}
// Semaine : forme, fatigue, progression, marché, espoirs, finances, presse.
function weeklyUpdate() {
  uciRefresh(); // transferts et signatures de la semaine passée
  runAssistant();
  wtWeekly();
  storiesWeekly();
  lockerWeekly();
  dopeWeekly(); // localisation, contrôles, suspensions (65-reglement.js)
  scmWeekly(); // missions de recrutement (70-scouting.js)
  facWeekly(); // chantiers des installations (71-facilities.js)
  boardWeekly(); // direction du club (72-board.js)
  newsWeekly(); // le monde du vélo (74-news.js)
  crewWeekly(); // staff : salaire de l'adjoint, débauchages en attente (67-staff.js)
  discoWeekly();
  const coachMul = 0.8 + 0.15 * S.staff.coach;
  for (const id in S.riders) {
    const r = S.riders[id];
    if (r.team === null || r.retired || r.car) continue; // (mode carrière : le joueur s'entraîne lui-même)
    const mine = r.team === 0;
    if (mine) periApply(r); // plan de saison (62-physio.js)
    let pl = mine ? r.training : aiTraining(r);
    let tgt =
      {
        normal: 70,
        repos: 56,
        foncier: 72,
        montagne: 71,
        sprint: 71,
        clm: 71,
        paves: 71,
        intensif: 84,
        pic: 70,
        altitude: 78,
        chaleur: 70,
      }[pl] || 70;
    if (pl === 'pic' && r.peakW) {
      const d = r.peakW - S.week;
      tgt = d > 6 ? 70 : d > 2 ? 79 : d >= 0 ? 92 : 62;
      if (d < 0) {
        r.training = 'normal';
        r.peakW = null;
        r.postPeak = 3;
      }
    }
    if (r.postPeak > 0) {
      tgt = Math.min(tgt, 60);
      r.postPeak--;
    }
    if (r.altBoost > 0) {
      tgt += 5;
      r.altBoost--;
    }
    if (pl === 'altitude' && mine) {
      S.budget -= 10;
      finAdd('other', -10);
      r.altBoost = Math.max(r.altBoost || 0, 3);
    }
    tgt += campFormBonus(r); // stage en altitude d'équipe
    if (mine) {
      periLog(r, pl);
      tgt += periBonus(r, pl); // affûtage préparé : pic plus haut
    }
    heatAccWeekly(r, pl);
    // charge de la saison : au-delà de ~75 jours de course, la forme plafonne plus bas (fatigue chronique)
    tgt -= Math.max(0, r.stats.days - R.daysCap) * R.daysMalus;
    const noise = mine ? 2.4 - 0.3 * S.staff.coach : 2;
    r.forme = clamp(
      r.forme + (tgt - r.forme) * R.formeRate + gauss() * noise - Math.max(0, r.fatigue - 40) * 0.12,
      30,
      100
    );
    const fd = { repos: 18, intensif: -4, pic: 6, altitude: 7 }[pl];
    // charge récente (jours de course des dernières semaines) : un bloc de courses enchaînées se récupère moins vite
    r.load = (r.load || 0) * 0.55 + (r.wkDays || 0);
    r.wkDays = 0;
    const blockF = 1 - Math.min(0.35, Math.max(0, r.load - 3) * 0.05);
    r.fatigue = clamp(r.fatigue - (fd !== undefined ? fd : 11) * (0.6 + r.s.rec / 200) * blockF, 0, 100);
    if (r.injury > 0) {
      r.injury--;
      r.forme = Math.max(30, r.forme - 4);
    }
    healthWeekly(r, mine); // guérisons, rechutes, maladies et tendinites de la saison
    r.moral = clamp(r.moral + ((mine ? lockerMoralTarget(r) : 62) - r.moral) * 0.06, 0, 100);
    // progression
    const ov = overall(r.s);
    // la progression ralentit à l'approche de l'âge de pic du profil (les grimpeurs mûrissent plus tard que les sprinteurs) ;
    // les « révélations tardives » progressent encore jusqu'à 28 ans
    const pk = PEAK_AGE[r.arch] || [26, 30];
    const a = r.age - (pk[0] - 26);
    let ageF = R.progAge.find(e => a <= e[0])[1];
    if (r.late && r.age >= 23 && r.age <= 28) ageF = Math.max(ageF, 0.9);
    ageF *= devAgeMul(r);
    // marge de progression : un jeune très doué (plafond loin devant) progresse nettement plus vite (prodiges)
    const gapF = clamp((r.ceil - ov) / 8, 0, r.age <= 22 ? R.youngGapMax : 1.2);
    const cm = (mine ? coachMul : 1.05) * (r.aca ? mentorMul(r) : 1);
    // la course fait progresser : la charge récente (jours de course) module la progression (0,9 à 1,2)
    const loadF = 0.9 + Math.min(0.3, (r.load || 0) * 0.04);
    const g0 = ageF * gapF * cm * loadF * mentalProg(r) * (mine ? facTrainMul() : 1);
    trainGain(r, pl, g0);
    prepGain(r, g0); // stage de montagne, entraîneur en chef spécialisé (mon équipe)
    if (mine) proMentorGain(r, pl, g0); // parrainage d'un ancien (60-locker.js)
    // poids de forme : le poids pris à l'intersaison fond à l'entraînement et en course (pas au repos)
    if (r.kgOpt == null) r.kgOpt = r.kg;
    const burn = pl === 'repos' ? -0.1 : (KG_BURN[pl] || 0.15) + Math.min(0.2, (r.load || 0) * 0.03);
    r.kg = +clamp(r.kg - burn, r.kgOpt - 0.5, r.kgOpt + 4).toFixed(2);
    if (r.aca) {
      const k = pick(STATS);
      if (rnd() < 0.1 * g0 && r.s[k] < 95) r.s[k]++;
    }
    // envie de partir
    if (mine && !r.aca) {
      if (r.moral < 28 && r.amb > 55 && !r.wantsOut && rnd() < 0.06) {
        r.wantsOut = true;
        msg(
          `${riderName(r)} veut partir`,
          `${riderName(r)} est malheureux dans l'équipe et demande à partir. Sa discipline va s'en ressentir s'il n'est pas remotivé.`
        );
      }
      if (r.wantsOut) {
        r.dis = Math.max(5, r.dis - 1);
        if (r.moral > 48) {
          r.wantsOut = false;
          msg(`${riderName(r)} rassuré`, `${riderName(r)} a retrouvé le sourire et ne parle plus de partir.`);
        }
      }
    }
  }
  // jeunes : connaissance progressive
  for (const id of S.youth) {
    S.know[id] = Math.max(S.know[id] || 0, Math.min(60 + S.staff.scout * 7, (S.know[id] || 0) + 1.5 * S.staff.scout));
  }
  for (const id of S.watch) {
    const r = S.riders[id];
    if (!r) {
      continue;
    }
    S.know[id] = Math.max(S.know[id] || 0, Math.min(70 + S.staff.scout * 5.5, (S.know[id] || 20) + 5 * S.staff.scout));
  }
  for (const id of S.academy) {
    S.know[id] = Math.max(S.know[id] || 0, Math.min(95, (S.know[id] || 35) + 0.8 + 0.3 * S.staff.coach));
  }
  // pré-contrats des équipes IA sur vos coureurs en fin de contrat
  if (S.week >= MERC_OPEN) {
    // (pas avant le 1er août : règlement UCI)
    for (const id of S.teams[0].riders) {
      const r = S.riders[id];
      if (
        r.contract === 1 &&
        !r.nextTeam &&
        overall(r.s) >= 71 &&
        rnd() < 0.012 * (1 + (r.amb - 50) / 50) * (r.moral < 50 ? 1.6 : 1) * (rumorTeam(r) ? 2.5 : 1)
      ) {
        // une équipe citée par la presse est la mieux placée pour faire signer le coureur
        const T = rumorTeam(r) || pick(S.teams.filter(t => !t.player));
        if (!aiCanAfford(T, salaryFor(overall(r.s), r.age))) continue; // trop cher pour cette équipe
        r.nextTeam = T.id;
        mercLog(r, 'pre', 0, T.id);
        msg(
          `${riderName(r)} s'en va`,
          `${riderName(r)} a signé un pré-contrat avec <b>${T.name}</b> et partira en fin de saison. Il fallait le prolonger plus tôt…`
        );
      }
    }
  }
  // historique de forme et de fraîcheur de mes coureurs (16 dernières semaines), pour les courbes de l'interface
  for (const id of S.teams[0].riders) {
    const r = S.riders[id];
    if (!r) continue;
    (r.fh = r.fh || []).push([Math.round(r.forme), Math.round(100 - r.fatigue)]);
    if (r.fh.length > 16) r.fh.shift();
    // forme de toute la saison (pour le bilan de saison du coureur : moyenne, pic)
    if (!r.fs || r.fs.s !== S.season) r.fs = { s: S.season, v: [] };
    r.fs.v.push(Math.round(r.forme));
  }
  formWeekly();
  // marché IA : les équipes complètent leur effectif
  for (const T of S.teams) {
    if (T.player || T.riders.length >= aiTarget(T) - 2) continue;
    const fr = S.free
      .map(i => S.riders[i])
      .filter(r => r && !r.retired && !r.car)
      .sort((a, b) => overall(b.s) - overall(a.s));
    const r = fr.find(q => aiCanAfford(T, salaryFor(overall(q.s), q.age)));
    if (r) {
      S.free.splice(S.free.indexOf(r.id), 1);
      mercLog(r, 'signe', null, T.id);
      r.team = T.id;
      r.contract = rint(1, 2);
      r.salary = salaryFor(overall(r.s), r.age);
      T.riders.push(r.id);
    }
  }
  // courses espoirs
  if (ESP_WEEKS.includes(S.week)) espWeekly();
  academyWeekly();
  // finances
  const P = S.teams[0];
  const sal = sum(P.riders.map(id => S.riders[id].salary)) / LAST_WEEK,
    aca = sum(S.academy.map(id => S.riders[id].salary)) / LAST_WEEK,
    stf = staffWeekly(),
    sp = sponsorWeekly();
  S.budget += sp - sal - aca - stf;
  finAdd('spons', sp);
  finAdd('sal', -sal);
  finAdd('aca', -aca);
  finAdd('staff', -stf);
  debtWeekly();
  pressWeekly();
  mercWeekly();
  dsBidWeekly();
  aiCampPress();
  if (S.eqEarly && !S.eqEarly.done && S.week > S.eqEarly.exp) S.eqEarly.done = true; // offre anticipée expirée
  // mercato d'été entre équipes de l'ordinateur (semaine 26) : deux transferts au plus
  if (S.week === 26) aiTransfers(2, 0.25);
  dsPressWeekly();
  uciTrack();
  eqWeekly();
  careerWeekly();
  raiseCheck();
  S.week++;
}
// Simule une course entière sans le joueur.
function simulateRaceAuto(calIdx) {
  if (S.cal[calIdx].worlds) return runWorlds(calIdx);
  const rc = startRace(calIdx, []);
  while (!rc.done) {
    runStageAuto(rc);
  }
  S.rc = null;
  return rc;
}
// Indice de la prochaine course non disputée.
function nextRaceIdx() {
  return S.cal.findIndex(c => !c.done);
}
// Avance les semaines jusqu'à la prochaine course (et simule celles sans le joueur).
function advanceToNextRace() {
  const i = nextRaceIdx();
  if (i < 0) {
    while (S.week < LAST_WEEK) weeklyUpdate();
    return -1;
  }
  while (S.week < S.cal[i].w) weeklyUpdate();
  return i;
}
// Fin de saison : bilan sponsor, carrières, vieillissement, contrats, retraites, jeunes.
function endSeason() {
  uciTrack(true);
  S.lvl = worldLevel(); // niveau du peloton cette saison : base des salaires de l'intersaison
  const P = S.teams[0];
  const rankArr = uciRanking();
  const myRank = rankArr.indexOf(P) + 1;
  // pour le bilan « pourquoi » de la saison (licence lue avant l'attribution de fin de cycle)
  const why0 = {
    conf: S.conf,
    rank: S.lastRank || null,
    wt: S.wt ? { rk: wtRanking().findIndex(e => e.T.player) + 1, member: isWT(0), y: wtYear() } : null,
  };
  // objectifs
  let lines = [],
    dConf = 0,
    rew = 0;
  const objR = []; // pour le bilan de la saison (écran « Bilan »)
  for (const o of S.obj) {
    const st = objStatus(o);
    objR.push({ t: o.txt, ok: !!st.ok });
    if (st.ok) {
      dConf += 7;
      rew += o.rew;
      lines.push(`✅ ${o.txt}`);
    } else {
      dConf -= 6;
      lines.push(`❌ ${o.txt}`);
    }
  }
  dConf += Math.round((repOf() - 45) / 8); // une équipe dont on parle en bien rassure le sponsor
  const debt = debtEndSeason(); // exercice dans le rouge : le sponsor sanctionne, la direction vend
  if (debt) {
    dConf += debt.dConf;
    lines.push(debt.line);
  }
  S.conf = clamp(S.conf + dConf, 0, 100);
  S.budget += rew;
  finAdd('spons', rew);
  const bonus = 200 + (S.teams.length - myRank) * 40;
  S.budget += bonus;
  finAdd('spons', bonus);
  msg(
    `Fin de saison ${S.season}`,
    `Classement UCI : <b>${myRank}e</b>/${S.teams.length} (${P.uci || 0} pts) · ${seasonWins(0)} victoire(s).<br>Objectifs du sponsor :<br>${lines.join('<br>')}<br>Primes d'objectifs ${fmtMoney(rew)} + prime de classement ${fmtMoney(bonus)}. Confiance du sponsor : ${S.conf}/100${S.conf < 25 ? ' — <b>il menace de réduire fortement son engagement</b>' : ''}.${seasonHighlights()}`
  );
  goalsEndSeason();
  imageEndSeason();
  pressEndSeason(myRank);
  legacyEndSeason(rankArr);
  tvEndSeason();
  lockerEndSeason();
  worldEndSeason(rankArr); // courses, sponsors, faillites, réformes (66-monde.js)
  crewEndSeason(); // staff : progression, retraites, débauchages
  facEndSeason(); // entretien des installations
  boardEndSeason(myRank); // projet de la direction
  newsEndSeason(rankArr); // rivalité, classement des directeurs
  releaseClausesEndSeason();
  dsCarousel(rankArr);
  careerEndSeason(myRank);
  S.teamHist.push({
    s: S.season,
    rank: myRank,
    club: P.name,
    rep: Math.round(S.rep),
    uci: P.uci || 0,
    wins: seasonWins(0),
    budget: Math.round(S.budget),
    conf: S.conf,
    objs: objR,
    dConf,
    prime: rew + bonus,
  });
  S.seasonRank = S.seasonRank || {};
  S.seasonRank[S.season] = rankArr.map(T => ({
    id: T.id,
    n: T.name,
    c: T.color,
    u: T.uci || 0,
    w: seasonWins(T.id),
    p: !!T.player,
  }));
  S.lastRank = myRank;
  S.lastRanks = {};
  for (const T of S.teams) S.lastRanks[T.id] = T.uci || 0;
  wtEndSeason();
  const ranking = uciRanking();
  // carrières
  for (const id in S.riders) {
    const r = S.riders[id];
    if (r.retired) continue;
    if (r.stats.days > 0 || r.team !== null) {
      const T = teamOf(r);
      (r.career = r.career || []).push({
        s: S.season,
        t: r.aca ? 'ACA' : T ? T.short : '—',
        d: r.stats.days,
        w: r.stats.wins,
        p: r.stats.podiums,
        u: r.stats.pts,
        ov: overall(r.s),
        kf: Math.round(r.stats.kf || 0),
        ...formSeason(r),
      });
    }
  }
  seasonReview();
  seasonFilm(myRank);
  seasonWhy(myRank, why0, lines, rew + bonus);
  // vieillissement
  for (const id in S.riders) {
    const r = S.riders[id];
    if (r.retired) continue;
    r.age++;
    // intersaison : quelques kilos pris (moins chez les coureurs réguliers), à perdre avant les grands objectifs
    if (!r.car && r.kgOpt != null)
      r.kg = +Math.min(r.kgOpt + 4, r.kg + (r.trait === 'regulier' ? 1 : R.winterKg)).toFixed(2);
    // déclin après l'âge de pic du profil : les qualités explosives (sprint) partent les premières
    const pkEnd = (PEAK_AGE[r.arch] || [26, 30])[1];
    if (r.age > pkEnd) {
      for (const k of STATS) {
        const fast = k === 'spr' || k === 'plc' ? 1.4 : 1;
        if (rnd() < 0.1 * (r.age - pkEnd) * fast * (r.car ? carDeclineMul() : 1)) r.s[k] = Math.max(35, r.s[k] - 1);
      }
      r.ceil = Math.min(r.ceil, overall(r.s));
    }
    // un talent précoce sur quatre plafonne entre 21 et 23 ans (tous les prodiges ne tiennent pas leurs promesses)
    if (r.dev === 'precoce' && r.age >= 21 && r.age <= 23 && !r.plateauDone) {
      r.plateauDone = true;
      if (rnd() < 0.25) {
        r.ceil = Math.max(overall(r.s) + 1, r.ceil - rint(2, 5));
        if (r.team === 0)
          msg('Plafond', `${riderName(r)} semble marquer le pas : sa progression ralentit plus tôt que prévu.`);
      }
    }
    // révélation tardive : à 24 ans, le potentiel d'un coureur « tardif » s'ouvre
    if (r.late && r.age === 24 && !r.lateDone) {
      r.lateDone = true;
      r.ceil = Math.max(r.ceil, Math.min(89, r.ceil + rint(3, 6)));
      if (r.team === 0)
        msg(
          'Révélation',
          `${riderName(r)} semble franchir un palier : son potentiel est plus élevé qu'on ne le pensait.`
        );
    }
    if (r.team !== null && !r.aca) r.contract--;
    r.fatigue = 0;
    r.forme = 65;
    r.stats = { days: 0, wins: 0, podiums: 0, pts: 0, disob: 0, kf: 0, att: 0 };
  }
  // départs / retraites
  const retire = r => {
    r.retired = true;
    r.retS = S.season;
    r.team = null;
    r.aca = false;
    const i = S.free.indexOf(r.id);
    if (i >= 0) S.free.splice(i, 1);
  };
  for (const T of S.teams) {
    for (const id of T.riders.slice()) {
      const r = S.riders[id];
      if (r.nextTeam !== undefined && r.nextTeam !== null && r.nextTeam !== T.id) {
        T.riders.splice(T.riders.indexOf(id), 1);
        const NT = teamById(r.nextTeam);
        mercLog(r, 'transfert', T.id, NT.id);
        r.team = NT.id;
        NT.riders.push(id);
        r.contract = r.nextYears || rint(1, 3);
        r.salary = r.nextSal || salaryFor(overall(r.s), r.age);
        r.nextTeam = null;
        if (NT.player) msg('Arrivée', `${riderName(r)} rejoint votre équipe.`);
        continue;
      }
      // (même tirage qu'avant ; les histoires « vieux lion » peuvent avancer ou repousser la retraite)
      const old = r.age >= 37 || (r.age >= 34 && rnd() < 0.25 * (r.age - 33));
      if (!r.car && (r.retireNow || (old && !(r.stayOn === S.season && r.age < 39)))) {
        T.riders.splice(T.riders.indexOf(id), 1);
        mercLog(r, 'retraite', T.id, null);
        retire(r);
        if (T.player) msg('Retraite', `${riderName(r)} prend sa retraite à ${r.age} ans.`);
        continue;
      }
      if (r.contract <= 0 && r.car) continue; // mode carrière : le contrat du joueur se règle avec son agent
      if (r.contract <= 0) {
        if (!T.player) {
          if (rumorMove(r, T)) continue;
          if (!r.exitClause && rnd() < 0.75 && aiCanAfford(T, salaryFor(overall(r.s), r.age) - r.salary)) {
            r.contract = rint(1, 3);
            r.salary = salaryFor(overall(r.s), r.age);
            continue;
          }
          T.riders.splice(T.riders.indexOf(id), 1);
          mercLog(r, 'libere', T.id, null);
          r.team = null;
          r.contract = 0;
          S.free.push(id);
        } else {
          friendLeaves(id);
          mercLog(r, 'libere', 0, null);
          T.riders.splice(T.riders.indexOf(id), 1);
          r.team = null;
          S.free.push(id);
          msg('Fin de contrat', `${riderName(r)} quitte l'équipe (contrat terminé).`);
        }
      }
    }
  }
  for (const id in S.riders) delete S.riders[id].exitClause;
  aiEconomyEndSeason(ranking);
  aiTransfers();
  pruneWorld(false);
  // pré-contrats vers le joueur depuis le marché libre (déjà gérés ci-dessus pour les équipes)
  for (const id of S.free.slice()) {
    const r = S.riders[id];
    if (r && r.nextTeam === 0) {
      S.free.splice(S.free.indexOf(id), 1);
      r.team = 0;
      S.teams[0].riders.push(id);
      r.contract = r.nextYears;
      r.salary = r.nextSal;
      r.nextTeam = null;
    }
  }
  academyEndSeason();
  // académie : limite d'âge
  for (const id of S.academy.slice()) {
    const r = S.riders[id];
    if (r.age >= acaAgeOut()) {
      S.academy.splice(S.academy.indexOf(id), 1);
      r.aca = false;
      r.team = null;
      r.contract = 0;
      r.salary = salaryFor(overall(r.s), r.age);
      S.free.push(id);
      msg('Académie', `${riderName(r)} (${r.age} ans) quitte l'académie sans être passé pro.`);
    } else if (r.age >= acaAgeOut() - 1)
      msg('Académie', `${riderName(r)} a ${r.age} ans : passez-le pro cette saison ou il partira.`);
  }
  // jeunes : pré-contrats signés en cours de saison, puis les équipes IA recrutent, le vivier vieillit
  youthPreContracts();
  const pool = S.youth.map(i => S.riders[i]).filter(Boolean);
  for (const T of S.teams) {
    if (T.player) continue;
    const cand = pool.filter(r => r.youth && r.age >= 19).sort((a, b) => b.ceil + gauss() * 3 - (a.ceil + gauss() * 3));
    if (cand.length && rnd() < 0.75 && aiCanAfford(T, 40)) {
      const r = cand[0];
      r.youth = false;
      mercLog(r, 'neo', null, T.id);
      r.team = T.id;
      r.contract = 2;
      r.salary = Math.max(25, salaryFor(overall(r.s), r.age));
      T.riders.push(r.id);
      r.neo = S.season + 1;
      S.youth.splice(S.youth.indexOf(r.id), 1);
      pool.splice(pool.indexOf(r), 1);
    }
  }
  pool.sort((a, b) => a.ceil - b.ceil);
  while (pool.length > 34) {
    const r = pool.shift();
    S.youth.splice(S.youth.indexOf(r.id), 1);
    retire(r);
  }
  for (const r of pool) {
    if (r.age >= 21 || (r.age >= 20 && rnd() < 0.5) || (S.youth.length > 40 && r.ceil < 70 && rnd() < 0.5)) {
      S.youth.splice(S.youth.indexOf(r.id), 1);
      r.youth = false;
      if (overall(r.s) >= 58) {
        r.salary = salaryFor(overall(r.s), r.age);
        S.free.push(r.id);
      } else retire(r);
    }
  }
  // effectifs IA
  for (const T of S.teams) {
    if (T.player) continue;
    while (T.riders.length > Math.min(ROSTER.max, aiTarget(T) + 2)) {
      const rs = T.riders.map(i => S.riders[i]).sort((a, b) => overall(a.s) - overall(b.s));
      const r = rs.find(x => !x.car); // (mode carrière : le joueur négocie son avenir lui-même)
      T.riders.splice(T.riders.indexOf(r.id), 1);
      mercLog(r, 'libere', T.id, null);
      r.team = null;
      r.contract = 0;
      S.free.push(r.id);
    }
    // complète l'effectif avec des néo-pros (peu coûteux) tant que le budget le permet, et toujours jusqu'au minimum
    while (T.riders.length < ROSTER.minAI || (T.riders.length < aiTarget(T) - 1 && aiCanAfford(T, 45))) {
      const a = pick(COMPO);
      const r = genRider(a, T.tier - 1.8 + gauss() * 2, { age: rint(20, 24), nat: T.natBias });
      r.team = T.id;
      S.riders[r.id] = r;
      T.riders.push(r.id);
    }
  }
  // nettoyage du marché libre : les plus faibles ou âgés arrêtent
  for (const id of S.free.slice()) {
    const r = S.riders[id];
    if (!r || r.retired) {
      S.free.splice(S.free.indexOf(id), 1);
      continue;
    }
    if (r.age >= 35 || overall(r.s) < 58 || rnd() < 0.2) {
      S.free.splice(S.free.indexOf(id), 1);
      retire(r);
    }
  }
  // effectif minimum du joueur : l'association complète avec des coureurs libres bon marché
  const PT = S.teams[0];
  if (PT.riders.length < ROSTER.minPlayer) {
    const fr = S.free
      .map(i => S.riders[i])
      .filter(r => r && !r.retired)
      .sort((a, b) => contractDemand(a) - contractDemand(b));
    const added = [];
    while (PT.riders.length < ROSTER.minPlayer && fr.length) {
      const r = fr.shift();
      S.free.splice(S.free.indexOf(r.id), 1);
      mercLog(r, 'signe', null, 0);
      r.team = 0;
      r.contract = 1;
      r.salary = contractDemand(r);
      PT.riders.push(r.id);
      added.push(riderName(r));
    }
    if (added.length)
      msg(
        'Effectif minimum',
        `Votre effectif étant insuffisant, la fédération impose le recrutement de coureurs libres : ${added.join(', ')}.`
      );
  }
  if (S.free.length > 45) {
    const fr = S.free.map(i => S.riders[i]).sort((a, b) => overall(b.s) - overall(a.s));
    for (const r of fr.slice(45)) {
      S.free.splice(S.free.indexOf(r.id), 1);
      retire(r);
    }
  }
  storiesEndSeason();
  seasonFilmEnd();
  msg(
    `🎬 Le film de la saison ${S.season}`,
    'Grandes victoires, coureur de l’année, révélations, records, mercato et adieux : à revoir dans Statistiques → Film.'
  );
  for (const T of S.teams) T.uci = 0;
  eqEndSeason();
  sponsorEndSeason();
  S.season++;
  S.week = 1;
  S.weekUsed = {};
  S.plan = {};
  assignGoals();
  genFreeAgents(20);
  genYouth(40);
  scoutYouth(); // jeunes de la région prospectée
  S.watch = S.watch.filter(id => S.riders[id] && !S.riders[id].retired);
  buildCalendar();
  genObjectives();
  aiSeasonPlans();
  S.expRank = expectedRank();
  msg(
    `Saison ${S.season}`,
    `Nouveaux objectifs du sponsor :<br>${S.obj.map(o => '• ' + o.txt).join('<br>')}<br>${S.youth.length} jeunes sont disponibles dans le vivier (onglet Académie).`
  );
}
