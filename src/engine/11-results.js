/* Résultats, classements, palmarès et primes */
function applyStageResult(rc, spec, res, dnfIds) {
  if (rc.esp) return espStageResult(rc, spec, res, dnfIds);
  gcDirty(rc);
  const t0 = res.length ? res[0].time : 0;
  const ptsTab = STAGE_PTS[spec.type] || [20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  res.forEach((e, i) => {
    e.gap = e.time - t0;
    e.rank = i + 1;
    rc.gc[e.id] += e.gcTime !== undefined ? e.gcTime : e.time;
    // départage des égalités de temps : somme des places d'étape (règle UCI), donc l'ordre d'arrivée sur un jour
    rc.place = rc.place || {};
    rc.place[e.id] = (rc.place[e.id] || 0) + i + 1;
    if (e.gcTime !== undefined && e.time - e.gcTime > 2) e.prot = true;
    if (i < ptsTab.length) rc.pts[e.id] += ptsTab[i];
    rc.energy[e.id] = e.energy;
    const r = S.riders[e.id];
    r.stats.days++;
    r.wkDays = (r.wkDays || 0) + 1;
  });
  // classement par équipes : addition des trois meilleurs temps de chaque équipe sur l'étape
  if (rc.specs.length > 1) {
    rc.teamGc = rc.teamGc || {};
    const byT = {};
    for (const e of res) {
      const T = S.riders[e.id].team;
      (byT[T] = byT[T] || []).push(e.time);
    }
    for (const T in byT) {
      const b = byT[T].sort((a, c) => a - c).slice(0, 3);
      rc.teamGc[T] = b.length === 3 ? (rc.teamGc[T] || 0) + sum(b) : (rc.teamGc[T] || 0) + 1e6;
    }
  }
  // bonifications
  [10, 6, 4].forEach((b, i) => {
    if (res[i] && spec.type !== 'clm' && spec.type !== 'clmeq') rc.gc[res[i].id] -= b;
  });
  for (const id of dnfIds) rc.out[id] = true;
  // maladies et abandons d'usure sur les courses par étapes (≈ 15 % d'abandons sur un Grand Tour, avec les chutes)
  if (rc.specs.length > 1 && rc.si < rc.specs.length - 1) {
    for (const e of res) {
      const r = S.riders[e.id];
      if (rc.out[e.id]) continue;
      const p =
        (0.0022 + (r.fatigue / 100) * 0.006 + (rc.specs.length > 15 && rc.si > 8 ? 0.0015 : 0)) *
        (r.team === 0 ? 1.15 - 0.05 * S.staff.doctor : 1) *
        (r.sick > 0 ? 2.5 : 1);
      if (rnd() < p) {
        rc.out[e.id] = true;
        const ill = rnd() < 0.6;
        if (ill) injSet(r, 'virus', 1);
        // un virus peut traverser l'équipe
        if (ill)
          for (const id of rc.sel[r.team] || []) {
            const q = S.riders[id];
            if (id !== e.id && !rc.out[id] && rnd() < 0.12 * (r.team === 0 ? 1.2 - 0.1 * S.staff.doctor : 1)) {
              q.sick = rint(2, 4);
              if (q.team === 0)
                msg(
                  `${riderName(q)} tombe malade`,
                  `Le virus circule dans l'équipe : ${riderName(q)} est à son tour malade.`
                );
            }
          }
        r.forme = Math.max(30, r.forme - 8);
        if (r.team === 0)
          msg(
            `${riderName(r)} abandonne`,
            `${riderName(r)} quitte ${rc.name} après l'étape ${rc.si + 1} (${ill ? 'malade' : 'à bout de forces'}).`
          );
        (rc.illOut = rc.illOut || []).push(e.id);
      }
    }
  }
  const cutIds = cutApply(rc, spec, res); // délais, repêchage (63-racereal.js)
  rc.stageRes.push({
    name: spec.name,
    type: spec.type,
    res: res.map(e => ({ id: e.id, gap: e.gap, time: e.time })),
    cut: cutIds,
    cutInfo: rc.cutInfo ? { pct: rc.cutInfo.pct, lim: Math.round(rc.cutInfo.lim), n: rc.cutInfo.n, graced: rc.cutInfo.graced } : null,
    stats: rc._stats || null,
    brk: rc._brk || null,
    moments: rc._moments || null,
    wxs: rc._wxs || null,
    komb: rc._komb || null,
    climbs: rc._climbs || null,
    power: rc._power || null,
  });
  rc.stageRes[rc.stageRes.length - 1].rev = stageReview(rc, spec, res, dnfIds); // notes de mes coureurs (69-notes.js)
  rc._climbs = null;
  rc._wxs = null;
  rc._power = null;
  rc._stats = null;
  rc._komb = null;
  // récupération entre étapes
  for (const id in rc.energy) {
    if (rc.out[id]) continue;
    const r = S.riders[id];
    const e = rc.energy[id];
    if (r.sick > 0) r.sick--;
    // la fatigue qui s'accumule d'une étape à l'autre dépend de la récupération du coureur
    r.fatigue = clamp(r.fatigue + ((100 - e) * 0.035 + 0.6) * (1.57 - r.s.rec / 120) - (spec.rest ? 6 : 0), 0, 100);
    rc.energy[id] = clamp(
      e +
        45 +
        r.s.rec * 0.45 -
        r.fatigue * 0.25 +
        (r.team === 0 ? (S.staff.doctor - 1) * 1.5 : 2) +
        (r.team != null ? nutriRecup(r.team) : 0) + // nutrition (récupération)
        (spec.rest ? 15 : 0),
      30,
      100
    );
  }
  gcDirty(rc);
  // victoire
  const w = S.riders[res[0].id];
  w.stats.wins++;
  // pour le résumé du commentateur (52-commentary.js) : figé au soir de l'étape
  const sr = rc.stageRes[rc.stageRes.length - 1];
  sr.wn = w.stats.wins;
  if (rc.specs.length > 1) {
    const g = gcList(rc);
    sr.lead = g[0];
    sr.lgap = g[1] != null ? rc.gc[g[1]] - rc.gc[g[0]] : null;
  }
  w.moral = clamp(w.moral + 12, 0, 100);
  if (rc.specs.length > 1) palmAdd(res[0].id, rc.name, 'Étape ' + (rc.si + 1) + ' (' + typeLbl(spec.type) + ')', 1);
  for (let i = 0; i < 3 && i < res.length; i++) S.riders[res[i].id].stats.podiums++;
  tvStageEnd(rc, res); // temps d'antenne de l'arrivée et des podiums
  aiTacticalAbandons(rc); // grands tours : qui n'a plus rien à y faire rentre chez lui
  rc.si++;
  if (rc.si >= rc.specs.length) finishRace(rc);
}
// Classement général (identifiants triés par temps).
// Le général ne change qu'entre les étapes (ou sur abandon) : il est mis en cache et invalidé par gcDirty().
const GC_CACHE = new WeakMap();
function gcDirty(rc) {
  rc.gcVer = (rc.gcVer || 0) + 1;
}
function gcCached(rc) {
  let c = GC_CACHE.get(rc);
  if (!c || c.ver !== (rc.gcVer || 0)) {
    const pl = rc.place || {};
    const arr = Object.keys(rc.gc)
      .filter(id => !rc.out[id])
      .map(Number)
      .sort((a, b) => {
        const d = rc.gc[a] - rc.gc[b];
        return Math.abs(d) >= 0.5 ? d : (pl[a] || 0) - (pl[b] || 0) || d;
      });
    c = { ver: rc.gcVer || 0, arr, rank: new Map(arr.map((id, i) => [id, i + 1])) };
    GC_CACHE.set(rc, c);
  }
  return c;
}
function gcList(rc) {
  return gcCached(rc).arr.slice();
}
// Ordre d'un classement à points (maillots) ; à égalité, le mieux classé au général passe devant
// (jamais l'ordre des numéros de coureurs).
function classOrder(rc, o, min = -Infinity) {
  const rk = gcCached(rc).rank;
  return Object.keys(o)
    .map(Number)
    .filter(id => !rc.out[id] && o[id] > min)
    .sort((a, b) => o[b] - o[a] || (rk.get(a) || 1e9) - (rk.get(b) || 1e9));
}
// Ajoute une ligne au palmarès d'un coureur.
function palmAdd(id, race, what, rank) {
  const r = S.riders[id];
  if (!r) return;
  const T = teamOf(r);
  (r.palm = r.palm || []).push({ s: S.season, r: race, e: what, k: rank, t: T ? T.short : '—', my: r.team === 0 });
}
// Classement du meilleur jeune (25 ans et moins).
// Classement par équipes (identifiants d'équipes triés par temps cumulé).
function teamGcList(rc) {
  return Object.keys(rc.teamGc || {})
    .map(Number)
    .sort((a, b) => rc.teamGc[a] - rc.teamGc[b]);
}
function ygList(rc) {
  return gcList(rc).filter(id => S.riders[id].age <= 25);
}
// Fin de course : primes, points UCI, palmarès, historique, moral, presse.
function finishRace(rc) {
  if (!S.car) legacyInit(); // (avant le palmarès de cette course : une partie ancienne reconstruit son héritage)
  rc.done = true;
  const cal = S.cal[rc.calIdx];
  cal.done = true;
  const gcl = gcList(rc);
  if (rc.worlds) {
    cal.winner = gcl[0];
    return; // la suite (maillot, palmarès, presse) est gérée par runWorlds une fois les équipes restaurées
  }
  const pz = PRIZE[rc.cat],
    up = UCI[rc.cat];
  cal.winner = gcl[0];
  const income = {};
  const addT = (id, k, u) => {
    const r = S.riders[id];
    const T = r.team;
    income[T] = (income[T] || 0) + k;
    r.stats.pts += u;
  };
  const multi = rc.specs.length > 1;
  if (multi) {
    rc.stageRes.forEach((st, i) => {
      addT(st.res[0].id, pz.stage, up.stage);
    });
  }
  gcl.slice(0, 10).forEach((id, i) => addT(id, (multi ? pz.gc : pz.one || pz.gc)[i] || 0, up.gc[i]));
  uciRefresh();
  const net = (income[0] || 0) - rc.specs.length * raceDayCost();
  S.budget += net;
  finAdd('prize', income[0] || 0);
  finAdd('other', -rc.specs.length * raceDayCost());
  // palmarès
  gcl.slice(0, 3).forEach((id, i) => palmAdd(id, rc.name, multi ? 'Classement général' : 'Course', i + 1));
  if (rc.key === 'natio') nationalTitles(rc, gcl);
  const top = o => classOrder(rc, o)[0];
  let ptsW = null,
    komW = null,
    ygW = null;
  if (multi) {
    ptsW = +top(rc.pts);
    komW = +top(rc.kom);
    ygW = ygList(rc)[0];
    if (ptsW) palmAdd(ptsW, rc.name, 'Maillot des points', 1);
    if (komW && rc.kom[komW] > 0) palmAdd(komW, rc.name, 'Meilleur grimpeur', 1);
    if (ygW) palmAdd(ygW, rc.name, 'Meilleur jeune', 1);
  }
  const nm = id => {
    const r = S.riders[id];
    return r ? riderName(r) : '?';
  };
  (S.raceHist[rc.key] = S.raceHist[rc.key] || []).push({
    s: S.season,
    pod: gcl.slice(0, 3).map(id => ({ id, n: nm(id), t: teamOf(S.riders[id]) ? teamOf(S.riders[id]).short : '' })),
    pts: ptsW ? nm(ptsW) : null,
    kom: komW ? nm(komW) : null,
    yg: ygW ? nm(ygW) : null,
    stages: multi ? rc.stageRes.map(st => ({ n: nm(st.res[0].id), id: st.res[0].id, ty: st.type })) : null,
  });
  legacyAfterRace(rc);
  tvRaceEnd(rc); // primes de visibilité du sponsor
  homeAfterRace(rc);
  // connaissance des adversaires
  const capK = 70 + S.staff.scout * 5;
  for (const T of S.teams)
    for (const id of rc.sel[T.id]) S.know[id] = Math.max(S.know[id] || 0, Math.min(capK, (S.know[id] || 20) + 5));
  // moral & bilan
  const myIds = rc.sel[0] || [];
  let lines = [];
  const pos = id => gcl.indexOf(id) + 1;
  for (const id of myIds) {
    const r = S.riders[id];
    const p = pos(id);
    if (p > 0 && p <= 10) r.moral = clamp(r.moral + (11 - p), 0, 100);
  }
  const best = myIds.filter(id => pos(id) > 0).sort((a, b) => pos(a) - pos(b))[0];
  const w = S.riders[gcl[0]];
  lines.push(`Vainqueur : <b>${riderName(w)}</b> (${teamOf(w).short}).`);
  if (best) lines.push(`Votre meilleur coureur : ${riderName(S.riders[best])}, ${pos(best)}e.`);
  const myStages = multi ? rc.stageRes.filter(st => myIds.includes(st.res[0].id)).length : 0;
  if (myStages) lines.push(`Victoire(s) d'étape : ${myStages}.`);
  if (income[0]) lines.push(`Primes encaissées : ${fmtMoney(income[0])}.`);
  if (multi) lines.push(`Points : ${nm(ptsW)} — Grimpeur : ${komW ? nm(komW) : '—'} — Jeune : ${ygW ? nm(ygW) : '—'}.`);
  if (multi && rc.teamGc) {
    const tl = teamGcList(rc),
      myT = tl.indexOf(0) + 1,
      TW = teamById(tl[0]);
    lines.push(`Classement par équipes : ${TW ? TW.name : '—'}${myT ? ` · votre équipe ${myT}e` : ''}.`);
    if (tl[0] === 0) S.teams[0].teamWins = (S.teams[0].teamWins || 0) + 1;
  }
  // récit : course confiée à l'adjoint (tout), ou grande course courue sans le joueur (moments clés)
  if (rc.delegated || (!myIds.length && rc.cat <= 1)) {
    const story = raceStory(rc, !!rc.delegated);
    if (story.length) lines.push('<br><b>Le récit</b> :<br>' + story.join('<br>'));
    // course d'un jour confiée à l'adjoint : le résumé du commentateur
    const tv = !multi && rc.delegated ? tvRecap(rc, 0) : null;
    if (tv)
      lines.push(
        '<br><b>🎙️ Le résumé du commentateur</b> :<br>' +
          tv.map(t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>')
      );
  }
  // notes de mes coureurs (69-notes.js) : moyenne sur la course, du meilleur au moins bon
  {
    const R = raceReview(rc);
    if (R.length)
      lines.push(
        '<br><b>Notes de vos coureurs</b> (6 : conforme aux attentes) :<br>' +
          R.map(x => `${riderName(S.riders[x.id])} ${String(x.avg).replace('.', ',')}`).join(' · ')
      );
  }
  msg(`Bilan : ${rc.name}`, lines.join('<br>'));
  S.hist.push({
    season: S.season,
    key: rc.key,
    name: rc.name,
    winner: gcl[0],
    podium: gcl.slice(0, 3),
    my: best ? pos(best) : null,
    myId: best || null,
  });
  // objectifs : suivi
  S.objTrack = S.objTrack || {};
  if (rc.cat === 0 && multi && myStages) S.objTrack.gtStage = true;
  if (rc.key === 'gb') {
    if (myStages) S.objTrack.gbStage = true;
    if (best && pos(best) <= 10) S.objTrack.gbTop10 = true;
  }
  if (rc.cat <= 1 && multi && best && pos(best) <= 5) S.objTrack.stageRaceTop5 = true;
  // promesses
  for (const id of S.teams[0].riders) {
    const r = S.riders[id];
    if (!r.promise) continue;
    const led = rc.ledBy && rc.ledBy.includes(id);
    if (led) {
      r.promise = false;
      r.moral = clamp(r.moral + 8, 0, 100);
      msg('Promesse tenue', `${riderName(r)} a eu son rôle de leader. Il est ravi.`);
    } else if (rc.cat <= 1) {
      r.promiseWait = (r.promiseWait || 0) + 1;
      if (r.promiseWait >= 2) {
        r.promise = false;
        r.promiseWait = 0;
        r.moral = clamp(r.moral - 18, 0, 100);
        r.dis = clamp(r.dis - 5, 0, 99);
        msg(
          'Promesse non tenue',
          `${riderName(r)} attendait toujours son rôle de leader. Il se sent trahi (moral et discipline en baisse).`
        );
      }
    }
  }
  // non-sélectionnés ambitieux : seulement s'ils étaient disponibles (pas engagés ailleurs la même semaine),
  // pas déjà très chargés en jours de course ; un message au plus toutes les six semaines
  const wUsed = (S.weekUsed && S.weekUsed[S.cal[rc.calIdx].w]) || [];
  const daysAvg = sum(S.teams[0].riders.map(id => S.riders[id].stats.days)) / Math.max(1, S.teams[0].riders.length);
  for (const id of S.teams[0].riders) {
    if (!myIds.includes(id)) {
      const r = S.riders[id];
      if (r.amb > 70 && rc.cat <= 1 && r.injury <= 0 && !wUsed.includes(id) && r.stats.days <= daysAvg) {
        r.moral = clamp(r.moral - (rc.cat === 0 ? 8 : 4), 0, 100);
        if (S.week - (r.unhappyW ?? -99) >= 6) {
          r.unhappyW = S.week;
          msg(
            `${riderName(r)} mécontent`,
            `${riderName(r)} n'a pas apprécié de ne pas être sélectionné pour ${rc.name}.`
          );
        }
      }
    }
  }
  raceRelations(rc);
  storiesAfterRace(rc);
  pressAfterRace(rc);
  {
    const w = S.riders[gcList(rc)[0]];
    if (w && w.team != null) dsGoalWon(rc, w.team);
    eqAdaptAfterRace(rc);
    eqEarlyAfterWin(rc, w);
  }
  goalsAfterRace(rc);
  ambitionsAfterRace(rc);
  promisesAfterRace(rc);
  clausesAfterRace(rc);
  imageAfterRace(rc);
  // pic de forme atteint : retour à l'entretien
  for (const id of myIds) {
    const r = S.riders[id];
    if (r.training === 'pic' && r.peakW && r.peakW <= S.week) {
      r.training = 'normal';
      r.peakW = null;
      r.postPeak = 3;
    }
  }
}
// Victoires de la saison pour une équipe.
function seasonWins(teamId) {
  let n = 0;
  for (const id in S.riders) {
    const r = S.riders[id];
    if (r.team === teamId) n += r.stats.wins;
  }
  return n;
}
// Classement UCI par équipes (règle réelle) : somme des points de la saison de ses 20 meilleurs coureurs actuels.
const UCI_COUNT = 20;
function uciRefresh() {
  const pts = {};
  for (const id in S.riders) {
    const r = S.riders[id];
    if (r.team === null || r.retired || r.aca || !r.stats || !r.stats.pts) continue;
    (pts[r.team] = pts[r.team] || []).push(r.stats.pts);
  }
  for (const T of S.teams) T.uci = sum((pts[T.id] || []).sort((a, b) => b - a).slice(0, UCI_COUNT));
}
// Équipes triées par points UCI de la saison (la première en tête ; ordre d'origine à égalité).
function uciRanking() {
  return S.teams.slice().sort((a, b) => (b.uci || 0) - (a.uci || 0));
}
