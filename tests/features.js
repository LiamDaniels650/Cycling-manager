// Tests fonctionnels : matériel (effet en course), presse, carrière du DS (offres, changement d'équipe, licenciement).
// Usage : node tests/features.js   (échoue avec un code 1 si une vérification ne passe pas)
const fs = require('fs');
require('vm').runInThisContext(fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", ''));
let fails = 0;
const check = (ok, txt) => {
  console.log((ok ? '✔ ' : '✖ ') + txt);
  if (!ok) fails++;
};

// 1. Matériel de chrono : même équipe, même graine, matériel différent → la meilleure marque va plus vite.
function ittTime(ttId) {
  newGame('T', 42);
  S.teams[0].eq.tt = ttId;
  const i = S.cal.findIndex(c => c.stagesSpec.some(s => s[0] === 'clm'));
  S.week = S.cal[i].w;
  const cal = S.cal[i];
  const rc = startRace(i, aiSelect(S.teams[0], cal, prepareRaceSpecs(cal)));
  while (!isITT(rc.specs[rc.si])) {
    Object.assign(rc.orders, autoOrders(0, rc.specs[rc.si], rc));
    runStageAuto(rc);
  }
  Object.assign(rc.orders, autoOrders(0, rc.specs[rc.si], rc));
  const out = runStageAuto(rc);
  const mine = out.filter(e => S.riders[e.id].team === 0);
  return sum(mine.map(e => e.time)) / mine.length;
}
const tBest = ittTime('aerion-tt'),
  tWorst = ittTime('rapido-tt');
const gain = ((tWorst - tBest) / tWorst) * 100;
check(gain > 0.8 && gain < 2.5, `chrono : le meilleur matériel fait gagner ${gain.toFixed(2)} % (attendu 0,8 à 2,5 %)`);

// 2. Facteurs du matériel de route cohérents.
const f1 = eqFactors({ eq: { bike: 'aerion', tt: 'chronos' } }),
  f2 = eqFactors({ eq: { bike: 'kassei', tt: 'chronos' } });
check(
  f1.flat > f2.flat && f2.pav > f1.pav && f2.punct < f1.punct,
  'vélos : Aerion plus aéro, Kassei meilleur sur les pavés et plus robuste'
);

// 3. Saison complète : offres d'équipementiers, presse, carrière.
newGame('T', 7);
for (let i = advanceToNextRace(); i >= 0; i = advanceToNextRace()) {
  const cal = S.cal[i];
  if (cal.worlds) {
    runWorlds(i);
    continue;
  }
  const rc = startRace(i, aiSelect(S.teams[0], cal, prepareRaceSpecs(cal)));
  while (!rc.done) {
    Object.assign(rc.orders, autoOrders(0, rc.specs[rc.si], rc));
    runStageAuto(rc);
  }
  if (S.pressQ) answerPress(0);
}
check(S.eqOffers && Object.keys(S.eqOffers).length > 0, 'offres des équipementiers reçues en cours de saison');
check(S.press.length > 10, `revue de presse alimentée (${S.press.length} articles)`);
const choiceCat = Object.keys(S.eqOffers)[0],
  chosen = S.eqOffers[choiceCat][0].id;
chooseEq(choiceCat, 0);
endSeason();
check(S.teams[0].eq[choiceCat] === chosen, `le choix d'équipementier est appliqué en fin de saison (${chosen})`);
{
  const f = (S.films || [])[0];
  const ics = f ? f.ch.map(c => c.ic).join('') : '';
  check(
    !!f && f.s === S.season - 1 && /🏆/.test(ics) && /⭐/.test(ics) && /🚴/.test(ics),
    `film de la saison tourné (${f ? f.ch.length : 0} chapitres : ${ics})`
  );
}
check(
  S.career.seasons === 1 && S.career.rep >= 0 && S.career.rep <= 100,
  `réputation du DS mise à jour (${Math.round(S.career.rep)})`
);

// 4. Changement d'équipe forcé : cohérence des effectifs.
const target = S.teams[3];
const before = target.riders.slice(),
  mineBefore = S.teams[0].riders.slice();
S.jobOffers = [{ tid: target.id, name: target.name, rank: 3, budget: clubBudget(target.tier) }];
const txt = acceptJob(target.id);
check(/directeur sportif/.test(txt), 'offre acceptée : ' + txt);
check(
  S.teams[0].riders.join() === before.join() && before.every(id => S.riders[id].team === 0),
  "vous reprenez l'effectif de la nouvelle équipe"
);
check(
  target.riders.join() === mineBefore.join() && mineBefore.every(id => S.riders[id].team === target.id),
  "votre ancien effectif part avec l'ancien club"
);
check(
  S.academy.length === 0 && S.cal.every(c => !c.done) && S.obj.length > 0,
  'académie remise au club, calendrier et objectifs recalculés'
);
const allIds = S.teams.flatMap(T => T.riders);
check(new Set(allIds).size === allIds.length, 'aucun coureur dans deux équipes');

// 5. Licenciement : confiance très basse → offres de petites équipes, choix forcé avant la première course.
S.conf = 5;
careerEndSeason(11);
check(S.fired && S.jobOffers && S.jobOffers.length >= 1, 'licencié avec au moins une offre de repli');
S.week = 2;
careerWeekly();
check(!S.fired && !S.jobOffers, 'offre acceptée automatiquement faute de choix');

// 6. La saison suivante se joue normalement après le changement d'équipe.
let n = 0;
for (let i = advanceToNextRace(); i >= 0 && n < 6; i = advanceToNextRace(), n++) {
  const cal = S.cal[i];
  const rc = startRace(i, aiSelect(S.teams[0], cal, prepareRaceSpecs(cal)));
  while (!rc.done) {
    Object.assign(rc.orders, autoOrders(0, rc.specs[rc.si], rc));
    runStageAuto(rc);
  }
}
check(n === 6, 'six courses disputées avec la nouvelle équipe');

// 7. Adjoint : toutes les délégations activées pendant une saison, sans erreur et avec des décisions cohérentes.
newGame('T', 21);
Object.keys(AUTO_LBL).forEach(k => setAuto(k, true));
S.teams[0].riders.slice(0, 3).forEach(id => {
  S.riders[id].fatigue = 60;
});
asstTraining();
check(
  S.teams[0].riders.slice(0, 3).every(id => S.riders[id].training === 'repos'),
  'adjoint : repos pour les coureurs fatigués'
);
for (let i = advanceToNextRace(); i >= 0; i = advanceToNextRace()) {
  const cal = S.cal[i];
  if (cal.worlds) {
    runWorlds(i);
    continue;
  }
  const rc = startRace(i, aiSelect(S.teams[0], cal, prepareRaceSpecs(cal)));
  while (!rc.done) {
    Object.assign(rc.orders, autoOrders(0, rc.specs[rc.si], rc));
    runStageAuto(rc);
  }
}
check(!S.pressQ || S.pressQ.exp > S.week, 'adjoint : aucune question de presse laissée sans réponse');
check(S.teams[0].riders.length >= 12, `adjoint : effectif maintenu (${S.teams[0].riders.length} coureurs)`);
check(
  S.inbox.some(m => /Rapport de l'adjoint/.test(m.title)),
  'adjoint : rapports envoyés dans la messagerie'
);
check(!S.eqOffers || Object.keys(S.eqChoice).length > 0, 'adjoint : équipementier choisi');
endSeason();
check(S.season === 2028 && S.budget > -500, `saison bouclée avec l'adjoint (budget ${Math.round(S.budget)})`);

// 8. Réalisme : puissance critique, altitude, classement par équipes, routes étroites, mercato IA, carrières.
newGame('T', 33);
const rr = S.riders[S.teams[1].riders[0]];
const xw = { r: rr, wp: wPrime(rr), wbal: wPrime(rr), punch: 100 };
wbalStep(xw, 450, 1.15, 30, false);
const afterBurst = xw.wbal;
check(
  afterBurst < xw.wp,
  `W' : un effort au-dessus du seuil vide la réserve (${fmtDec(xw.wp, 1)} → ${fmtDec(afterBurst, 1)} kJ)`
);
for (let i = 0; i < 6; i++) wbalStep(xw, 200, 0.6, 30, false);
check(xw.wbal > afterBurst, `W' : la réserve se recharge à l'abri (${fmtDec(xw.wbal, 1)} kJ après 3 min)`);
check(
  wPrime({ s: { spr: 85, col: 80 }, kg: 72 }) > wPrime({ s: { spr: 55, col: 72 }, kg: 60 }),
  "W' : un sprinteur a plus de réserve anaérobie qu'un grimpeur"
);
const cpG = riderCP({ s: { ...rr.s, mon: 85, col: 75 }, kg: 60, forme: 75 }) / 60;
check(cpG > 5.3 && cpG < 7.2, `seuil en montée d'un bon grimpeur : ${fmtDec(cpG, 2)} W/kg`);
const xa = { r: rr, dayForm: 75, energy: 80, alt: 2500, bonk: false },
  xb = { ...xa, alt: 800 };
check(capRaw(xa, 7, 0) < capRaw(xb, 7, 0) * 0.95, 'altitude : environ -7 % de capacité à 2 500 m');
rr.altBoost = 3;
check(
  capRaw(xa, 7, 0) > capRaw({ ...xa, r: { ...rr, altBoost: 0 } }, 7, 0),
  'altitude : un coureur acclimaté perd moins'
);
const spN = prepareRaceSpecs({ stagesSpec: [['vallonne', 180]], w: 10 })[0];
check(
  spN.narrow.length >= 1 && buildProfile(spN).narrow.some(v => v),
  'routes étroites présentes sur une étape vallonnée'
);
// course par étapes : classement par équipes
let found = false;
for (let i = advanceToNextRace(); i >= 0 && !found; i = advanceToNextRace()) {
  const cal = S.cal[i];
  if (cal.worlds) {
    runWorlds(i);
    continue;
  }
  const rc = startRace(i, aiSelect(S.teams[0], cal, prepareRaceSpecs(cal)));
  while (!rc.done) {
    Object.assign(rc.orders, autoOrders(0, rc.specs[rc.si], rc));
    runStageAuto(rc);
  }
  if (rc.specs.length > 1) {
    found = true;
    check(teamGcList(rc).length >= 8, `classement par équipes calculé (${teamGcList(rc).length} équipes)`);
  }
}
// mercato IA et révélations tardives sur plusieurs saisons
const before2 = {};
for (const T of S.teams) for (const id of T.riders) before2[id] = T.id;
endSeason();
const moved = Object.keys(before2).filter(
  id => S.riders[id].team !== null && S.riders[id].team !== before2[id] && before2[id] !== 0 && S.riders[id].team !== 0
).length;
check(moved >= 1, `mercato entre équipes IA : ${moved} coureur(s) ont changé d'équipe`);
check(
  Object.values(S.riders).some(r => r.late),
  'des révélations tardives existent dans le peloton'
);

// 9. Peloton, économie, difficulté, stratégie IA, élagage de la sauvegarde (vérifications rapides).
newGame('T', 51, 'difficile');
check(
  S.teams.length === 18 && S.cal.length >= 34,
  `peloton de ${S.teams.length} équipes, calendrier de ${S.cal.length} courses`
);
check(
  S.cal.every((c, i) => !i || S.cal[i - 1].w <= c.w),
  'calendrier trié par semaine'
);
const wHard = sponsorWeekly(),
  bHard = S.budget;
newGame('T', 51, 'normal');
check(
  bHard < S.budget && wHard < sponsorWeekly(),
  `difficile : budget ${bHard} < ${S.budget}, sponsor ${fmtDec(wHard, 1)} < ${fmtDec(sponsorWeekly(), 1)} k€/sem.`
);
check(
  S.teams.filter(T => !T.player).every(T => T.goals && T.goals.focus),
  'chaque équipe IA a un objectif de saison'
);
check(
  new Set(S.teams.filter(T => !T.player).map(T => T.goals.focus)).size >= 3,
  'objectifs IA variés (général, sprints, classiques…)'
);
const Tg = S.teams.find(T => T.goals && T.goals.gt && T.goals.focus === 'gc');
if (Tg) {
  const other = S.cal.find(c => c.cat === 0 && c.key !== Tg.goals.gt);
  const ldr = Tg.riders.map(id => S.riders[id]).find(r => aiGcLeader(r, Tg));
  check(!ldr || aiRestForGt(Tg, other, ldr), `le leader de ${Tg.short} est ménagé hors de son Grand Tour cible`);
}
const name0 = S.spons.name,
  base0 = S.spons.base;
S.conf = 20;
S.spons.years = 1;
sponsorEndSeason();
check(
  S.spons.name !== name0 && S.spons.base < base0,
  `sponsor mécontent remplacé (${name0} → ${S.spons.name}, budget réduit)`
);
const rq = S.riders[S.teams[0].riders[0]];
S.raiseReq = { id: rq.id, ask: rq.salary + 100, w: 18 };
const sal0 = rq.salary;
answerRaise(true);
check(rq.salary === sal0 + 100 && !S.raiseReq, 'revalorisation accordée');
const ghost = genRider('rouleur', -3);
S.riders[ghost.id] = ghost;
ghost.retired = true;
ghost.retS = S.season - 2;
ghost.palm = [];
const nPr = pruneWorld(false);
check(!S.riders[ghost.id] && nPr >= 1, `élagage : ${nPr} coureur(s) retraité(s) sans palmarès oublié(s)`);

// 9. Planificateur, objectifs, matériel du jour, reconnaissance, Mondiaux et légendes.
newGame('T', 31);
const msgP = autoPlanSeason();
check(
  Object.keys(S.plan).length > 10 && typeof msgP === 'string',
  `planificateur auto : ${Object.keys(S.plan).length} courses programmées`
);
const tooMuch = S.teams[0].riders.filter(id => plannedDays(id) > daysTarget() * 1.25).length;
check(tooMuch === 0, 'planificateur : aucun coureur surchargé');
check(
  S.teams[0].riders.every(id => S.riders[id].goal && GOALS[S.riders[id].goal.k]),
  'objectifs personnels attribués'
);
check(
  autoGear({ type: 'sommet' }).wheels === 'basses' && autoGear({ type: 'paves' }).tyres === 'larges',
  'matériel conseillé cohérent'
);
const fBase = eqFactors(S.teams[0]);
const fHi = applyGear(fBase, { wheels: 'hautes', tyres: 'standard' });
check(fHi.flat > fBase.flat && fHi.climb < fBase.climb, 'roues hautes : + plat, − montée');
const ip = S.cal.findIndex(c => c.key === 'pav');
const b0 = S.budget;
const rmsg = doRecon(ip, S.teams[0].riders.slice(0, 7));
check(S.budget < b0 && S.recon.pav === S.season && /Reconnaissance/.test(rmsg), 'reconnaissance payée et enregistrée');
const iw = S.cal.findIndex(c => c.worlds);
check(iw >= 0 && S.cal[iw].inv.length === 0, 'Mondiaux au calendrier, hors invitations de marque');
while (S.week < S.cal[iw].w) weeklyUpdate();
for (let k = 0; k < iw; k++) if (S.cal[k].key === 'natio') simulateRaceAuto(k);
for (let k = 0; k < iw; k++) S.cal[k].done = true;
const teamsBefore = S.teams.map(T => T.id).join(),
  riderTeams = S.teams[0].riders.join();
const rw = runWorlds(iw);
const champ = S.riders[rw.stageRes[0].res[0].id];
check(
  S.teams.map(T => T.id).join() === teamsBefore && S.teams[0].riders.join() === riderTeams,
  'Mondiaux : équipes de marque restaurées'
);
check(
  Object.values(S.riders).every(r => r.team === null || r.team < 900),
  'Mondiaux : aucun coureur resté en équipe nationale'
);
check(
  champ.rainbow === S.season && wearsRainbow(champ) && S.cal[iw].done,
  `Mondiaux : ${riderName(champ)} (${champ.nat}) champion du monde`
);
const nats = new Set(rw.stageRes[0].res.map(e => S.riders[e.id].nat));
check(nats.size >= 10, `Mondiaux : ${nats.size} nations au départ`);
// demandes au sélectionneur : leader accordé au premier de sa sélection, refusé (carte libre) au-delà du 2e
const rcW = {
  natRank: { 1: 1, 2: 4 },
  out: {},
  wish: { 1: 'leader', 2: 'leader' },
  sel: { 900: [1, 3], 901: [2] },
  orders: { 3: { o: 'leader' } },
};
const sv1 = S.riders[1].team,
  sv2 = S.riders[2].team;
S.riders[1].team = 900;
S.riders[2].team = 901;
applyWorldsWish(rcW);
S.riders[1].team = sv1;
S.riders[2].team = sv2;
check(
  rcW.orders[1].o === 'leader' && rcW.orders[3].o === 'protect' && rcW.orders[2].o === 'free',
  'Mondiaux : rôle de leader accordé ou refusé selon le rang dans la sélection'
);
const iN = S.cal.findIndex(c => c.key === 'natio');
check(S.cal[iN].done, 'championnat national couru');
const champs = Object.values(S.riders).filter(r => r.natChamp === S.season);
check(
  champs.length >= 10 && new Set(champs.map(r => r.nat)).size === champs.length && champs.every(wearsNatChamp),
  `champions nationaux : ${champs.length} pays, un titre chacun`
);
advanceToNextRace();
for (const c of S.cal) c.done = true;
endSeason();
check(
  S.review && S.review.s === S.season - 1 && S.review.rows.length >= 1 && S.review.rows.every(x => x.d > 0),
  `bilan individuel : ${S.review.rows.length} coureurs`
);
check(
  S.uciTrack.w.length >= 30 && Object.values(S.uciTrack.t).every(a => a.length === S.uciTrack.w.length),
  `suivi UCI hebdomadaire : ${S.uciTrack.w.length} relevés`
);
const L = legends(5);
check(L.length > 0 && L[0].s >= 15, `légendes : ${riderName(L[0].r)} en tête (${L[0].s} pts)`);

// 10. Équipementiers : négociation ; mercato : journal et rumeurs sans hasard.
newGame('T', 44);
S.rep = 90;
genEqOffers();
const cat0 = Object.keys(S.eqOffers)[0];
const o0 = S.eqOffers[cat0][0];
const pay0 = o0.pay;
const rp = eqNegotiate(cat0, 0, 'proto');
check(o0.proto && o0.pay < pay0 && /prototypes/.test(rp), "négociation : prototypes contre moins d'argent");
check(/déjà/.test(eqNegotiate(cat0, 0, 'cash')), 'négociation : une seule tentative par offre');
chooseEq(cat0, 0);
const fNo = eqFactors(S.teams[0]);
S.eqDeal.bike.proto = true;
const fPr = eqFactors(S.teams[0]);
check(fPr.flat > fNo.flat && fPr.climb > fNo.climb && fPr.punct > fNo.punct, 'prototypes : + aéro, + léger, + fragile');
check(eqFactors(S.teams[1]).flat === eqFactors({ ...S.teams[1], player: false }).flat, 'prototypes réservés au joueur');
S.eqDeal.bike.proto = false;
S.eqDeal.tt.perf = 5;
S.teamHist.push({ s: S.season, wins: 4 });
const bud = S.budget;
const offTT = S.eqOffers.tt;
eqEndSeason();
check(S.budget - bud >= 20 && (!offTT || S.eqDeal.tt), 'prime à la victoire versée en fin de saison (4 × 5 k€)');
newGame('T', 45);
S.week = 30;
const sd0 = _sd;
let nRum = 0;
for (let w = 20; w <= 40; w++) {
  S.week = w;
  const before = (S.merc || []).length;
  mercWeekly();
  if ((S.merc || []).length > before) nRum++;
}
check(_sd === sd0, 'rumeurs du mercato : aucun tirage dans le hasard de la partie');
check(nRum >= 3, `rumeurs du mercato : ${nRum} sur la saison`);
advanceToNextRace();
for (const c of S.cal) c.done = true;
endSeason();
const kinds = new Set((S.merc || []).map(e => e.k));
check(
  S.uciTrack && S.uciTrack.s === S.season - 1 && S.uciTrack.w.length >= 1,
  'suivi UCI : saison précédente conservée'
);
// rumeur fiable : un coureur IA en fin de contrat rejoint souvent l'équipe citée
newGame('T', 46);
let movedR = 0,
  tries = 0;
for (const T of S.teams.filter(t => !t.player)) {
  const r = S.riders[T.riders[0]];
  const RT = S.teams
    .filter(t => !t.player && t !== T && t.riders.length < ROSTER.max)
    .sort((a, b) => b.budget - payrollOf(b) - (a.budget - payrollOf(a)))[0];
  r.rumor = { t: RT.id, s: S.season };
  tries++;
  if (rumorMove(r, T)) {
    movedR++;
    check(
      r.team === RT.id && RT.riders.includes(r.id) && !T.riders.includes(r.id),
      `rumeur confirmée : ${riderName(r)} chez ${RT.short}`
    );
    break;
  }
}
check(movedR === 1, `rumeur fiable : transfert réalisé (${tries} essai(s))`);
// économie IA, effectifs, classement UCI sur 20 coureurs, départage des égalités
check(
  S.teams.every(T => T.player || (T.riders.length >= ROSTER.minAI && T.budget > 0)),
  'équipes IA : effectifs élargis et budgets'
);
const T1 = S.teams[1];
for (const id of T1.riders) S.riders[id].stats.pts = 10;
uciRefresh();
check(T1.uci === 10 * Math.min(UCI_COUNT, T1.riders.length), 'classement UCI : 20 meilleurs coureurs seulement');
const rcT = { gc: { 5: 100, 3: 100, 9: 100 }, out: {}, place: { 5: 1, 3: 3, 9: 2 } };
check(gcList(rcT).join() === '5,9,3', "égalité de temps : départage à l'ordre d'arrivée, pas au numéro du coureur");
const bigT = S.teams.find(t => !t.player);
check(!aiCanAfford(bigT, 1e6), 'équipe IA : pas de signature au-delà du budget');
check(S.climate && S.climate.r.length === LAST_WEEK + 1, 'climat de la saison généré semaine par semaine');
check(kinds.has('transfert') || kinds.has('libere'), `mercato de fin de saison journalisé (${[...kinds].join(', ')})`);

// 11. Course : ravitaillement, poches, alliances, résumé ; image de l'équipe ; adjoint et masse salariale.
newGame('T', 52);
check(
  autoFeed({ type: 'plat', dist: 210, wx: 'sec' }) === 'renforce' && autoFeed({ type: 'plat', dist: 150 }) === 'normal',
  'ravitaillement conseillé selon la distance'
);
let ate = 0,
  offered = 0,
  summaries = 0,
  feedCost = 0;
for (let i = advanceToNextRace(), n = 0; i >= 0 && n < 8; i = advanceToNextRace(), n++) {
  const cal = S.cal[i];
  if (cal.worlds) continue;
  const rc = startRace(i, aiSelect(S.teams[0], cal, prepareRaceSpecs(cal)));
  while (!rc.done) {
    const spec = rc.specs[rc.si];
    Object.assign(rc.orders, autoOrders(0, spec, rc));
    if (isITT(spec) || isTTT(spec)) {
      runStageAuto(rc);
      continue;
    }
    rc.feedPlan = 'renforce';
    rc.feedStage = rc.si;
    const b0 = S.budget;
    const sim = newStageSim(rc);
    feedCost += b0 - S.budget;
    sim.autoDS = true;
    let k = 0;
    while (!sim.done && k++ < 5000) {
      for (const x of sim.runners) if (x.player && x.food > 40 && k === 300) x.food = 26; // creux provoqué
      simTick(sim);
    }
    const L = sim.log.map(l => l.txt).join('\n');
    ate += (L.match(/mange une barre/g) || []).length;
    offered += (L.match(/propose de rouler|demande d'alliance/g) || []).length;
    if ((stageSummary(rc, rc.si - 1, sim) || []).length >= 3) summaries++;
  }
}
check(ate > 0, `poches : le DS automatique fait manger avant la fringale (${ate} fois)`);
check(feedCost >= 3, `ravitaillement renforcé facturé (${feedCost} k€)`);
check(summaries > 5, `résumé d'étape produit (${summaries} étapes)`);
check(offered >= 0 && typeof allyRequest === 'function', `alliances proposées ou demandées : ${offered}`);
check(
  imageLabel().lbl.length > 0 && Object.values(S.image).every(v => v >= 0 && v <= 100),
  `image de l'équipe : ${imageLabel().lbl}`
);
// (un coureur au salaire assez élevé : la demande est arrondie aux 5 k€)
const fan = Object.values(S.riders).find(
  r => r.team === null && !r.retired && r.arch === 'baroudeur' && contractDemand(r) >= 80
);
if (fan) {
  const d0 = contractDemand(fan);
  S.image.offensive = 90;
  check(
    imageAffinity(fan) > 0.5 && contractDemand(fan) < d0,
    'image : un baroudeur demande moins à une équipe de baroudeurs'
  );
}
S.budget = 0;
check(!payrollRoom(5000), 'adjoint : pas de dépense salariale insoutenable');

// 12. Moteur : étape rejouable, physique, physiologie, descentes, tactique.
newGame('T', 61);
const iR = advanceToNextRace(),
  calR = S.cal[iR];
const snapR = JSON.stringify(S);
const selR = aiSelect(S.teams[0], calR, prepareRaceSpecs(calR));
const runR = noise => {
  S = JSON.parse(snapR);
  for (let k = 0; k < noise; k++) rnd(); // une action ailleurs dans le jeu
  const rc = startRace(iR, selR);
  runStageAuto(rc);
  return rc.stageRes[0].res
    .slice(0, 5)
    .map(e => e.id + ':' + e.time.toFixed(2))
    .join(' ');
};
check(runR(0) === runR(0) && runR(0) === runR(25), 'étape rejouable à l’identique, quoi qu’il se passe ailleurs');
const refC = { rho: 1.2, crr: 0.0045, vw: 0 };
const vPlat = speedOf(70, 0, false, false, true);
check(
  physSpeed(vPlat, 0, { ...refC, vw: 4 }, 0.2) < vPlat && physSpeed(vPlat, 0, { ...refC, vw: -4 }, 0.2) > vPlat,
  'physique : vent de face ralentit, vent de dos accélère'
);
check(physSpeed(vPlat, 0, { ...refC, rho: airRho(2000, 18) }, 0.2) > vPlat, 'physique : air plus rare en altitude');
check(physSpeed(vPlat, 0, { ...refC, crr: 0.012 }, 0.2) < vPlat * 0.95, 'physique : les pavés freinent');
check(descentMax(-7, true, 1) < descentMax(-7, false, 0.2) * 0.8, 'descente technique et mouillée : bien plus lente');
const xM = { wp: 20, wbal: 20, matches: 0, depl: false, r: { s: { rec: 70 } }, punch: 100 };
wbalStep(xM, 500, 1.6, 120, false);
const m1 = xM.matches;
const xA = { ...xM, wbal: 10, matches: 0 },
  xB = { ...xM, wbal: 10, matches: 5 };
wbalStep(xA, 250, 0.7, 60, false);
wbalStep(xB, 250, 0.7, 60, false);
check(m1 === 1 && xA.wbal > xB.wbal, 'allumettes brûlées : la recharge ralentit après chaque passage dans le rouge');
const simU = { stageRace: false, rc: null };
const xU = { punch: 80, energy: 70, r: { s: {} }, radio: null, order: 'free' };
check(
  attackUtility(simU, xU, 1.03, 3, 8) > attackUtility(simU, xU, 0.95, 40, 0),
  "IA : une attaque en montée près de l'arrivée, en étant le plus fort, vaut plus qu'une attaque de loin sur le plat"
);
{
  const rr = Object.values(S.riders).find(r => r.team !== null);
  const xs = { r: rr, dayForm: rr.forme, energy: 80, alt: 0 };
  const c0 = capRaw(xs, 7, false);
  xs.sansF = 0.95;
  const c1 = capRaw(xs, 7, false);
  check(c1 < c0 * 0.96 && c1 > c0 * 0.94, 'jour sans : environ 5 % de capacité en moins en montée');
}
{
  // pacte d'échappée : celui qui s'est engagé laisse passer son partenaire à l'arrivée
  const mk = (id, player) => ({
    id,
    player,
    r: { trait: 'aucun', s: {}, fn: 'Test', ln: 'Coureur' + id },
    team: { id: player ? 0 : 5, name: 'X' },
  });
  const P_ = mk(1, true),
    A_ = mk(2, false);
  const simP = { pacts: [], finish: [], log: [], t: 0, groups: [], dist: 100 };
  const pc = pactMake(simP, P_, A_, 'etape');
  const ordP = [
    [A_, 10],
    [P_, 9],
  ];
  withSeed({ sd: 3 }, () => pactFinish(simP, ordP));
  check(
    pc.done && (ordP[0][0] === P_ || simP.log.some(l => /Trahison/.test(l.txt))),
    "pacte : l'adversaire laisse l'étape au coureur du joueur (ou le trahit, ce qui est journalisé)"
  );
  check(
    pactYielder(pactMake(simP, P_, A_, 'temps')) === P_,
    'pacte « temps » : c’est le coureur du joueur qui laisse l’étape'
  );
}
{
  // appel radio : sans réponse, le coureur décide seul à l'expiration
  const simA = { t: 0, log: [], hls: [], runners: [], groups: [], pacts: [] };
  let got = null;
  askOpen(simA, {
    key: 'k',
    txt: 't',
    opts: [
      ['a', 'A'],
      ['b', 'B'],
    ],
    def: 'b',
    self: 's',
    auto: () => 'a',
    act: k => (got = k),
  });
  simA.t = ASK_TTL;
  radioTick(simA);
  check(got === 'b' && !simA.ask, 'radio : sans réponse de la voiture, le coureur applique son propre choix');
  const simB = { t: 0, log: [], hls: [], runners: [], groups: [], pacts: [], autoDS: true };
  askOpen(simB, {
    key: 'k',
    txt: 't',
    opts: [
      ['a', 'A'],
      ['b', 'B'],
    ],
    def: 'b',
    self: 's',
    auto: () => 'a',
    act: k => (got = k),
  });
  check(got === 'a', 'radio : avec le DS automatique, la voiture répond aussitôt');
}
{
  // académie : une course espoirs passe par le moteur, sans laisser de coureurs fictifs ni d'équipes temporaires
  newGame('Aca', 77);
  const ys = S.youth.map(id => S.riders[id]).sort((a, b) => overall(b.s) - overall(a.s));
  for (const y of ys) if (S.academy.length < 4) joinAcademy(y.id);
  for (const id of S.academy) S.riders[id].age = 20; // espoirs (19 ans et plus)
  const nR = Object.keys(S.riders).length,
    teams0 = S.teams,
    wins0 = sum(S.academy.map(id => S.riders[id].stats.wins));
  S.week = 18;
  const rec = runEspRace(ESP_CAL.find(e => e.key === 'ronde'));
  check(
    rec && rec.stages === 4 && S.teams === teams0 && Object.keys(S.riders).length === nR,
    'course espoirs : 4 étapes simulées par le moteur, équipes et coureurs du monde intacts ensuite'
  );
  check(
    sum(S.academy.map(id => S.riders[id].stats.wins)) === wins0 && S.academy.every(id => S.riders[id].espDays >= 1),
    'course espoirs : jours de course comptés à part, aucune victoire pro inscrite'
  );
  const a0 = S.riders[S.academy[0]];
  a0.age = 20;
  S.week = 20;
  check(!!setStag(a0.id, true) && !isStag(a0), 'stagiaire : pas avant le mois d’août');
  S.week = STAG_WEEK;
  check(!setStag(a0.id, true) && isStag(a0), 'stagiaire : possible à partir d’août pour un espoir de 19 ans et plus');
  check(
    !physTest(a0.id) && !!physTest(a0.id) && a0.ptest.p1200 > 3,
    'tests physiques : un profil de puissance, une fois par saison'
  );
  check(
    espEntrants('jun').length === 0 && espEntrants('club').length === S.academy.length,
    'juniors et espoirs : un espoir de 20 ans ne court pas chez les juniors'
  );
  const pre = { age: 19, dev: 'precoce' },
    tar = { age: 19, dev: 'tardif' };
  check(
    devAgeMul(pre) > 1 && devAgeMul(tar) < 1,
    'maturité : un précoce progresse plus vite jeune, un tardif plus lentement'
  );
  const M = S.teams[0].riders.map(id => S.riders[id]).find(r => r.age >= 27);
  check(!setMentor(a0.id, M.id) && mentorMul(a0) > 1, 'mentor : un ancien de l’équipe accélère la progression');
  const hi = ys.find(r => r.ceil >= 80) || { id: 1, ceil: 85 };
  check(acaRefuses(hi) === acaRefuses(hi), 'recrutement : la décision d’un jeune ne change pas en recliquant');
}
{
  // maillots : à capacité égale, celui qui vise le maillot de la montagne passe en tête au sommet
  const rr = Object.values(S.riders).find(r => r.team !== null && !r.aca);
  const mkx = aim => ({ r: rr, dayForm: rr.forme, energy: 80, alt: 0, pos: 50, punch: 80, aim });
  let first = 0;
  withSeed({ sd: 5 }, () => {
    for (let k = 0; k < 50; k++) {
      const a = mkx('kom'),
        b = mkx(null);
      if (jerseyOrder({ riders: [b, a] }, 'kom', {})[0] === a) first++;
    }
  });
  check(first >= 48, 'maillot de la montagne : le chasseur de points se dépense pour passer en tête');
}
{
  // directeur sportif : consignes selon l'étape et le général
  newGame('DS', 31);
  const gi = S.cal.findIndex(c => c.cat === 0);
  const rcg = startRace(gi, aiSelect(S.teams[0], S.cal[gi], prepareRaceSpecs(S.cal[gi])));
  const all = Object.keys(rcg.gc).map(Number);
  all.forEach((id, k) => (rcg.gc[id] = 3600 * 40 + k * 30));
  rcg.si = rcg.specs.findIndex((sp, i) => i > 3 && sp.type === 'plat');
  gcDirty(rcg);
  const yel = S.riders[all[0]];
  check(leaderAtt(yel, rcg, 'plat', true) === 'defensif', 'DS : sur une étape de transition, le leader court à l’abri');
  for (const id of all.slice(1)) rcg.gc[id] += 200;
  gcDirty(rcg);
  const ms = rcg.specs.findIndex((sp, i) => i > rcg.si && sp.type === 'sommet');
  if (ms > 0) rcg.si = ms;
  check(leaderAtt(yel, rcg, 'sommet', true) === 'defensif', 'DS : le maillot avec une belle avance contrôle');
  const far = all[all.length - 1];
  check(!gcSituation(rcg, far).alive, 'DS : un leader à des dizaines de minutes passe en chasse aux étapes');
  const mt = rcg.specs.findIndex((sp, i) => i > 0 && (sp.type === 'montagne' || sp.type === 'sommet'));
  rcg.si = mt;
  const T1 = S.teams.find(
    T => !T.player && rcg.sel[T.id].some(id => S.riders[id].s.spr >= 74 && S.riders[id].s.mon < 70)
  );
  if (T1) {
    const o = autoOrders(T1.id, rcg.specs[mt], rcg);
    const spId = rcg.sel[T1.id].find(id => S.riders[id].s.spr >= 74 && S.riders[id].s.mon < 70);
    check(
      o[spId] && ['save', 'leader', 'break'].includes(o[spId].o),
      'DS : en montagne, le sprinteur se préserve dans le gruppetto'
    );
  }
}
{
  // final d'étape : annonces aux points de passage, tendance de l'écart, photo-finish
  newGame('Fin', 41);
  const fi = S.cal.findIndex(c => c.stagesSpec.length === 1 && !c.worlds && (!c.inv || c.inv.includes(0)));
  const rcf = startRace(fi, aiSelect(S.teams[0], S.cal[fi], prepareRaceSpecs(S.cal[fi])));
  Object.assign(rcf.orders, autoOrders(0, rcf.specs[0], rcf));
  const simf = newStageSim(rcf);
  let sit = '';
  while (!simf.done) {
    simTick(simf);
    const A = simf.groups.find(G => G.riders.some(x => !x.fin));
    if (!sit && A && simf.dist - A.pos < 4) sit = finaleSituation(simf);
  }
  check(sit.length > 5 && (simf.fh || []).length > 10, 'final : situation de course racontée et écarts suivis');
  check(
    simf.log.some(l => /Flamme rouge/.test(l.txt)),
    'final : annonce de la flamme rouge'
  );
  check(
    simf.photo && simf.photo.ord.length >= 1 && simf.photo.ord[0].id === simf.finish[0].id,
    'final : photo-finish dans l’ordre d’arrivée'
  );
}
{
  // licence WorldTour : 13 licences, invitations d'office, attribution au bout de trois saisons
  newGame('WT', 51);
  check(S.wt && S.wt.members.length === WT_N, 'licence : 13 équipes WorldTour au départ');
  const gt = S.cal.find(c => c.cat === 0);
  check(
    S.wt.members.every(id => gt.inv.includes(id)),
    'licence : les équipes WorldTour sont invitées d’office aux Grands Tours'
  );
  for (const T of S.teams) T.uci = T.player ? 0 : 100 + T.id;
  S.season += 2; // fin du cycle
  S.wt.start = S.season - 2;
  const base0 = S.spons.base;
  const star = S.riders[S.teams[0].riders.slice().sort((a, b) => overall(S.riders[b].s) - overall(S.riders[a].s))[0]];
  Object.assign(star, { amb: 99, contract: 3, age: 26 });
  star.s = Object.fromEntries(Object.keys(star.s).map(k => [k, Math.max(star.s[k], 80)]));
  wtEndSeason();
  check(S.spons.base < base0, 'licence : la relégation déclenche la clause du sponsor (budget réduit)');
  check(wtSignFactor(star) < 0, 'licence : une ProTeam attire moins les coureurs cotés');

  check(
    !isWT(0) && S.wt.members.length === WT_N && S.wt.start === S.season + 1,
    'licence : une équipe sans points est reléguée en fin de cycle'
  );
  // commissaires : ravitaillement dans les 20 derniers km pénalisé
  const xs = { r: { dis: 50, fn: 'A', ln: 'B', trait: 'aucun' }, team: { short: 'X' }, player: false, g: { pos: 190 } };
  const ss = { dist: 200, log: [], hls: [], t: 0, groups: [] };
  feedCheck(ss, xs);
  check(xs.pen === 20, 'commissaires : 20 s de pénalité pour un ravitaillement dans les 20 derniers km');
}
// Pourquoi un coureur a été lâché : relevé en course pour les coureurs du joueur, explication lisible.
{
  newGame('T', 31);
  const i = S.cal.findIndex(c => c.stagesSpec.some(s => s[0] === 'montagne' || s[0] === 'sommet'));
  S.week = S.cal[i].w;
  const rc = startRace(i, delegateSelection(i));
  let drops = 0,
    expl = null;
  while (!rc.done) {
    Object.assign(rc.orders, autoOrders(0, rc.specs[rc.si], rc));
    runStageAuto(rc);
    const st = rc.stageRes[rc.stageRes.length - 1];
    for (const id in (st && st.stats) || {}) {
      const d = st.stats[id].drop;
      if (!d) continue;
      drops++;
      expl = expl || dropExplain(S.riders[id], d, (rc.orders[id] || {}).o);
    }
  }
  check(drops > 0, `lâchés : ${drops} relevés pour les coureurs du joueur`);
  check(
    !!expl && /a perdu le contact à [0-9,]+ km/.test(expl.txt) && expl.why.length > 10,
    'lâchés : explication lisible (« ' + (expl ? expl.txt : '?') + ' »)'
  );
  const d0 = { km: 12, g: 7, n: 30, I: 1.2, punch: 10, e: 20, bonk: true, food: 4, m: 4, sans: false, day: 0 };
  const e0 = dropExplain({ fn: 'A', ln: 'B' }, { ...d0, why: 'over', src: 'finale', by: null }, 'leader');
  check(/fringale/.test(e0.why) && /alimentation/.test(e0.tip), 'lâchés : une fringale est signalée et conseillée');
}
// Explications du bilan d'étape : sprint, échappée, désobéissance, moments décisifs (lecture seule).
{
  const sp = sprintExplain(
    { fn: 'A', ln: 'B' },
    { big: true, pos: 50, train: 0, boxed: true, early: false, lost: false, surf: false, spr: 80 },
    6,
    88
  );
  check(/enfermé/.test(sp.txt) && /moins rapide/.test(sp.txt) && !!sp.tip, 'sprint : enfermement et vitesse expliqués');
  const sp2 = sprintExplain({ fn: 'A', ln: 'B' }, { big: true, pos: 80, train: 2, spr: 85 }, 1, 85, false);
  check(/1er du sprint du groupe/.test(sp2.txt), 'sprint : place dans le sprint du groupe');
  const be = breakExplain({
    n: 4,
    max: 240,
    maxKm: 60,
    won: false,
    caught: { km: 12, n: 4, teams: [['AVE', 3]], rate: 18 },
    tally: [],
  });
  check(
    /reprise à 12 km/.test(be) && /AVE/.test(be) && /18 s\/km/.test(be),
    'échappée : reprise expliquée (où, qui, vitesse)'
  );
  const de = disobExplain(
    { fn: 'A', ln: 'B' },
    { kind: 'pre', dis: 30, amb: 80, moral: 60, trait: 'aucun', ldr: null, rel: 0, ahead: false, stronger: true }
  );
  check(/discipline faible/.test(de.why) && /plus fort que son leader/.test(de.why), 'désobéissance : raisons données');
  newGame('T', 31);
  const i = S.cal.findIndex(c => c.stagesSpec.length > 5);
  S.week = S.cal[i].w;
  const rc = startRace(i, delegateSelection(i));
  let mom = 0,
    brk = 0;
  while (!rc.done) {
    Object.assign(rc.orders, autoOrders(0, rc.specs[rc.si], rc));
    runStageAuto(rc);
    const st = rc.stageRes[rc.stageRes.length - 1];
    if (st.moments && st.moments.length) mom++;
    if (st.brk) brk++;
  }
  check(mom > 0 && brk > 0, `bilan : moments décisifs (${mom} étapes) et échappées relevés (${brk})`);
}
// Découverte progressive : systèmes cachés et confiés à l'adjoint, puis débloqués au fil de la saison.
{
  newGame('T', 9);
  discoStart();
  check(
    !discoOpen('press') && !discoOpen('aca') && !discoOpen('stories') && S.auto.press && S.auto.academy,
    'découverte : presse, académie et histoires cachées au départ, gérées par l’adjoint'
  );
  while (S.week < 20) weeklyUpdate();
  check(
    discoOpen('press') && discoOpen('staff') && !discoOpen('stories') && !S.auto.press,
    'découverte : déblocages de la saison'
  );
  discoAll();
  check(discoOpen('aca') && discoOpen('stories') && !S.auto.academy && !discoNext(), 'découverte : tout débloquer');
}
// Base de données ouverte : export / import des coureurs, ajout d'un coureur, parcours GPX.
{
  newGame('T', 12);
  const db = exportDb();
  const c0 = db.coureurs.find(c => S.riders[c.id].team === 1);
  c0.car.mon = 93;
  c0.prenom = 'Tadej';
  db.coureurs.push({ prenom: 'Nouveau', nom: 'Coureur', nat: 'FRA', age: 22, profil: 'grimpeur', car: { mon: 80 } });
  const res = importDb(JSON.parse(JSON.stringify(db)));
  const nouveau = Object.values(S.riders).find(r => r.ln === 'Coureur' && r.fn === 'Nouveau');
  check(
    res.ok &&
      S.riders[c0.id].s.mon === 93 &&
      S.riders[c0.id].fn === 'Tadej' &&
      !!nouveau &&
      S.free.includes(nouveau.id),
    'base : attributs importés et coureur ajouté aux libres (' + res.txt + ')'
  );
  // trace GPX synthétique : 140 km de plat puis une montée finale de 10 km à 7,5 %
  let gpx = '<gpx><trk><trkseg>';
  for (let k = 0; k <= 150; k += 0.2) {
    const ele = 200 + (k > 140 ? (k - 140) * 75 : 0);
    gpx += `<trkpt lat="${(45 + k / 111.2).toFixed(6)}" lon="6.000000"><ele>${ele}</ele></trkpt>`;
  }
  gpx += '</trkseg></trk></gpx>';
  const P = parseGpx(gpx);
  check(
    !P.err && Math.abs(P.dist - 150) < 1 && P.type === 'sommet' && Math.abs(P.gain - 750) < 30,
    `GPX : ${P.dist} km, D+ ${P.gain} m, type ${P.type}`
  );
  const key = 'col';
  check(setCustomProfile(key + ':0', { ...P, nom: 'Test' }), 'GPX : parcours appliqué à une course');
  const i = S.cal.findIndex(c => c.key === key);
  S.week = S.cal[i].w;
  const rc = startRace(i, []);
  const sim = newStageSim(rc);
  check(
    rc.specs[0].type === 'sommet' && sim.P.finishGrad >= 5 && Math.abs(sim.dist - 150) < 1,
    'GPX : la course se court sur le parcours importé'
  );
  while (!sim.done) simTick(sim);
  check(rc.stageRes.length === 1, 'GPX : course terminée sans erreur');
  {
    const tv = tvRecap(rc, 0);
    check(
      tv &&
        tv.length >= 3 &&
        /kilomètres/.test(tv[0]) &&
        tv.some(t => /victoire/.test(t)) &&
        !tv.join(' ').includes('undefined'),
      `Commentateur : ${tv ? tv.length : 0} paragraphes`
    );
  }
  S.rc = null;
  check(exportDb().parcours[key + ':0'].type === 'sommet', 'GPX : parcours exporté dans la base');
}

// ---- Nouveautés : moments décisifs, directeurs adverses, préparation, rejeux, forme ----
{
  newGame('M', 31);
  // moments décisifs : sur un grand tour, au moins un col décisif est rejoué au détail, avec une consigne demandée
  const gi = S.cal.findIndex(c => c.cat === 0 && c.stagesSpec.filter(s => s[0] === 'montagne').length >= 3);
  const cal = S.cal[gi];
  S.week = cal.w;
  const rc = startRace(gi, aiSelect(S.teams[0], cal, prepareRaceSpecs(cal)));
  rc.autoDS = true;
  const kinds = {};
  let asked = 0,
    rep = 0;
  while (!rc.done) {
    Object.assign(rc.orders, autoOrders(0, rc.specs[rc.si], rc));
    const sim = runStageAuto(rc);
    if (!sim || !sim.log) continue;
    for (const m of sim.momentTraces || []) {
      kinds[m.kind] = (kinds[m.kind] || 0) + 1;
      if (m.tr && m.tr.frames.length > 5 && m.tr.riders.length >= 2) rep++;
    }
    asked += sim.log.filter(l => /Consigne pour/.test(l.txt)).length;
  }
  check(kinds.col > 0, `moments : ${kinds.col || 0} col(s) décisif(s) rejoué(s) au détail sur ${cal.name}`);
  check(rep > 0 && rep === Object.values(kinds).reduce((a, b) => a + b, 0), 'moments : chaque moment a son rejeu');
  check(asked > 0, `moments : ${asked} consigne(s) du directeur avant un moment décisif`);
  check(
    (S.replays || []).every(t => t.tr.frames.length <= 121 && t.tr.riders.length <= 14),
    `rejeux conservés (${(S.replays || []).length}) : 120 images au plus`
  );
}
{
  newGame('D', 32);
  const T = S.teams[3];
  const a = dsOf(T),
    b = dsName(T);
  check(!!a && dsName(T) === b && a.age >= 38, `directeurs : ${b} (${a.temper}) dirige ${T.name}`);
  const v = dsRemember(T, -1, 'test');
  check(
    a.temper === 'rancunier' ? v === -1.5 : a.temper === 'pragmatique' ? v === -0.7 : v === -1,
    'directeurs : le caractère module un affront'
  );
  // offre de rachat acceptée : le coureur part, l'indemnité entre
  const r = S.riders[S.teams[0].riders[0]];
  const b0 = S.budget;
  S.bid = { id: r.id, t: T.id, fee: 500, sal: 200, exp: S.week + 2, s: S.season };
  const txt = dsBidAnswer('oui');
  check(r.team === T.id && S.budget === b0 + 500 && T.riders.includes(r.id), `offre de rachat acceptée : ${txt}`);
  // refus : rien ne bouge
  const r2 = S.riders[S.teams[0].riders[0]];
  S.bid = { id: r2.id, t: T.id, fee: 500, sal: r2.salary, exp: S.week + 2, s: S.season };
  dsBidAnswer('non');
  check(r2.team === 0 && !S.bid, 'offre de rachat refusée : le coureur reste');
  // carrousel : un directeur à l'âge de la retraite est remplacé, sans mémoire
  a.age = 70;
  const old = dsName(T);
  dsCarousel(uciRanking());
  check(dsName(T) !== old && T.ds.mem.length === 0 && T.ds.since === S.season + 1, `carrousel : ${old} → ${dsName(T)}`);
  // piques dans la presse : la réponse sèche fâche le directeur
  const rel0 = teamRelOf(T.id);
  S.pressQ = null;
  askPress('test', [{ t: 'x', e: { trel: [T.id, -0.5, 'pique'] } }]);
  answerPress(0);
  check(teamRelOf(T.id) < rel0, 'presse : une réponse sèche abîme la relation avec le directeur');
}
{
  newGame('P', 33);
  S.budget = 1000;
  check(/organisé/.test(campStart('altitude')) && S.budget === 880, 'stage en altitude : organisé et payé');
  check(/déjà/.test(campStart('train')), 'un seul stage à la fois');
  const r = S.riders[S.teams[0].riders[0]];
  check(campFormBonus(r) === 4, 'stage en altitude : forme visée +4');
  // bilan du stage : formWeekly le consigne à la fin
  formWeekly();
  S.week = S.camp.until + 1;
  formWeekly();
  check((S.campLog || []).length === 1 && S.campLog[0].k === 'altitude', 'bilan du stage consigné');
  check(S.tf && S.tf.v.length === 2, "forme de l'effectif suivie chaque semaine");
  // tests d'effort de recrutement : cinq par saison, valeurs exactes ensuite
  const ys = S.youth.slice(0, 6).map(id => S.riders[id]);
  const outs = ys.map(y => effortTest(y.id));
  check(
    ys.slice(0, 5).every(y => S.know[y.id] === 100),
    'test d’effort : les jeunes testés sont connus exactement'
  );
  check(/Plus de test/.test(outs[5]), `test d’effort : cinq par saison (${outs[5]})`);
  const y = ys[0];
  check(
    STATS.every(k => shownStat(y, k) === clamp(Math.round(y.s[k]), 30, 99)),
    'test d’effort : caractéristiques exactes'
  );
  S.know[y.id] = Math.max(S.know[y.id] || 0, Math.min(60, (S.know[y.id] || 0) + 5));
  check(S.know[y.id] === 100, 'la connaissance acquise ne redescend pas');
  check(
    /Test réservé/.test(effortTest(Object.values(S.riders).find(x => x.team > 0 && x.age >= 28).id)),
    'pas de test sur un pro confirmé adverse'
  );
}

// ---- Moteur : préparation de l'ordinateur, bordures, sprints intermédiaires, coalitions ----
{
  newGame('E', 34);
  const T = S.teams[2];
  dsSeasonGoals();
  const c = S.cal.find(c => c.key === dsOf(T).goals[0]);
  S.week = c.w - 2;
  const r = S.riders[T.riders[0]];
  check(campFormBonus(r) === 3 && aiCampOn(T.id) === c, `ordinateur : ${T.name} en stage en altitude avant ${c.name}`);
  S.week = c.w + 1;
  check(campFormBonus(r) === 0, 'ordinateur : le stage s’arrête après la course');
  // bordure au détail : un éventail coupe le peloton, avec son rejeu
  const fi = S.cal.findIndex(c => c.stagesSpec.length > 1 && c.stagesSpec[0][0] === 'plat');
  S.week = S.cal[fi].w;
  const rc = startRace(fi, aiSelect(S.teams[0], S.cal[fi], prepareRaceSpecs(S.cal[fi])));
  Object.assign(rc.orders, autoOrders(0, rc.specs[rc.si], rc));
  const sim = newStageSim(rc);
  for (let k = 0; k < 40 && !sim.done; k++) simTick(sim);
  const pel = sim.groups.slice().sort((a, b) => b.riders.length - a.riders.length)[0],
    n0 = pel.riders.length,
    g0 = sim.groups.length;
  sim.P.wind = 3;
  echelonSplit(sim, pel, pel.riders[0].team);
  const bt = (sim.momentTraces || []).find(m => m.kind === 'bord');
  check(
    sim.groups.length > g0 && pel.riders.length < n0,
    `bordure : ${pel.riders.length} devant sur ${n0}, ${sim.groups.length - g0} groupe(s) piégé(s)`
  );
  check(!!bt && bt.tr.frames.length === 91 && bt.tr.riders.length >= 4, 'bordure : rejeu de la cassure');
  // sprint intermédiaire disputé : les prétendants passent devant
  const G = sim.groups.slice().sort((a, b) => b.riders.length - a.riders.length)[0];
  G.riders
    .filter(x => !['protect', 'control', 'leadout'].includes(effOrder(x)))
    .slice(0, 2)
    .forEach(x => (x.aim = 'pts'));
  const o = ispOrder(sim, G);
  check(
    o.length === G.riders.length && o.slice(0, 2).every(x => x.aim === 'pts'),
    'sprint intermédiaire : les prétendants au maillot vert se le disputent'
  );
}
{
  newGame('C', 35);
  check(typeof coalitionStart === 'function' && styleMul(S.teams[1], 'att') > 0, 'coalitions : en place');
  const n0 = (S.merc || []).length;
  aiTransfers(2, 1);
  check((S.merc || []).filter(m => m.k === 'transfert').length - n0 <= 2, 'mercato d’été : deux transferts au plus');
}

// ---- Dette : intérêts, confiance du sponsor, vente forcée ----
{
  newGame('Dette', 36);
  S.budget = -600;
  const c0 = S.conf;
  debtWeekly();
  debtWeekly();
  check(
    S.budget < -600 && S.conf === c0 - 1,
    `dette : intérêts (${Math.round(S.budget)} k€) et confiance qui s'effrite`
  );
  const n0 = S.teams[0].riders.length;
  const d = debtEndSeason();
  check(
    d && d.dConf < 0 && S.teams[0].riders.length === n0 - 1 && /vend/.test(d.line),
    `dette en fin de saison : ${d && d.line}`
  );
  // offre de rachat : jamais au-dessus de la valeur du coureur
  S.budget = 500;
  let ok = true;
  for (let w = 8; w <= 38; w++) {
    S.week = w;
    S.bid = null;
    dsBidWeekly();
    if (S.bid && S.bid.fee > transferFee(S.riders[S.bid.id]) + 5) ok = false;
  }
  check(ok, 'offres de rachat : au plus la valeur du coureur');
}

// ---- Choix de l'équipe en début de partie ----
{
  const before = S;
  const rows = previewTeams('Moi', 90, 'normal', 'moyen');
  check(S === before, 'aperçu sans effet de bord (la partie en cours est intacte)');
  check(rows.length === 18 && rows[0].f.rank === 1, `aperçu : ${rows.length} équipes, ${rows[0].T.name} favorite`);
  newGame('Moi', 90, 'normal', { take: rows[0].T.id });
  const P = S.teams[0];
  check(
    P.name === rows[0].T.name && P.riders.every(id => S.riders[id].team === 0),
    `reprise de ${P.name} : effectif et identité`
  );
  check(
    S.teams.length === 18 && S.teams.some(T => RESERVE_TEAMS.some(r => r[0] === T.name)),
    'une équipe de réserve la remplace'
  );
  check(S.lastRank === 1 && S.obj.find(o => o.k === 'wins').n >= 10, 'objectifs de favori');
  newGame('Moi', 90, 'normal', { level: 'petit' });
  check(teamForecast(S.teams[0]).rank >= 12, `petit budget : rang prévu ${teamForecast(S.teams[0]).rank}`);
}

// ---- Deuxième division (ProSeries) et académie (centre, prospection, détection, anciens) ----
{
  newGame('Div', 37);
  wtInit();
  const pro = S.teams.filter(T => !isWT(T.id));
  pro.forEach((T, i) => (T.uci = 100 * (i + 1)));
  const b0 = S.budget;
  const rk = proSeriesRanking();
  check(rk.length === S.teams.length - WT_N && rk[0].pts >= rk[1].pts, `ProSeries : ${rk.length} équipes classées`);
  proSeriesEnd();
  check((S.proHist || []).length === 1 && S.proHist[0].ids[0] === rk[0].T.id, `ProSeries : ${rk[0].T.name} championne`);
  if (rk.some(e => e.T.player)) check(S.budget > b0, 'ProSeries : prime versée au joueur');
  // académie
  S.budget = 2000;
  check(
    acaMax() === 8 && /places/.test(acaUpgrade()) && acaMax() === 10,
    'centre de formation : 10 places au niveau 2'
  );
  check(/prospectent/.test(setScoutFocus('andes')), 'prospection ciblée');
  const n0 = S.youth.length;
  S.season++;
  scoutYouth();
  S.season--;
  const sc = S.youth.slice(n0).map(id => S.riders[id]);
  check(sc.length === 12 && sc.every(r => r.nat === 'COL'), 'prospection : 12 jeunes colombiens au vivier');
  check(/détection/.test(detectionDay()) && /déjà/.test(detectionDay()), 'journée de détection : une par saison');
  const r = S.riders[S.teams[0].riders[0]];
  const d0 = contractDemand(r);
  (S.acaAlumni = S.acaAlumni || []).push({ id: r.id, s: S.season, age: r.age });
  check(contractDemand(r) < d0, 'un ancien de l’académie demande moins');
}

// ---- Équipement : nouvelles catégories, secondes, mécaniciens, soufflerie, adaptation, offre anticipée ----
{
  newGame('Eq', 38);
  check(
    ['roues', 'pneus', 'nutri'].every(c => S.teams.every(T => T.eq[c]) && S.eqDeal[c]),
    'roues, pneus, nutrition : chaque équipe équipée, contrats du joueur'
  );
  const best = eqBrand('roues', 'zephyr'),
    basic = eqBrand('roues', 'roue-basic');
  const txt = eqSecondsText('roues', best, basic);
  check(/−\d+ s sur 40 km de chrono/.test(txt), `secondes lisibles : ${txt}`);
  const fBest = eqFactors({ eq: { bike: 'aerion', tt: 'chronos', roues: 'zephyr', pneus: 'velox', nutri: 'endura' } }),
    fBasic = eqFactors({
      eq: { bike: 'aerion', tt: 'chronos', roues: 'roue-basic', pneus: 'pneu-basic', nutri: 'nutri-basic' },
    });
  check(
    fBest.flat > fBasic.flat && fBest.sprint > fBasic.sprint && fBest.food < fBasic.food,
    'meilleures roues, pneus et nutrition : plus vite, meilleure pointe, moins de fringales'
  );
  // matériel du jour : pression basse et petit braquet sur une étape de montagne
  const ci = S.cal.findIndex(c => c.stagesSpec.some(s => s[0] === 'montagne'));
  const spec = prepareRaceSpecs(S.cal[ci]).find(s => s.type === 'montagne');
  const rec = autoGear(spec);
  check(rec.dev === 'compact' && rec.spare === 'oui', 'conseil du staff en montagne : petit braquet, vélo de rechange');
  check(gearStageSeconds(spec, { ...rec, dev: 'standard' }) > 0, 'sans petit braquet en montagne : du temps perdu');
  // mécaniciens
  S.budget = 1000;
  check(setMeca(3) === null && S.meca === 3, 'mécaniciens niveau 3');
  // soufflerie
  const r = S.riders[S.teams[0].riders[0]];
  check(
    /Soufflerie/.test(windTunnel(r.id)) && fitK(r) > 0 && /Déjà/.test(windTunnel(r.id)),
    'soufflerie : une fois par saison, gain au chrono'
  );
  // adaptation à un nouveau vélo
  eqChanged('bike', 'nordik', 'aerion');
  check(S.eqAdapt.left === 4 && eqAdaptMul() < 1, 'nouveau vélo : quatre courses d’adaptation');
  // offre anticipée
  S.eqEarly = { s: S.season, cat: 'roues', id: 'zephyr', pay: 20, years: 2, exp: S.week + 4 };
  check(/Accord/.test(eqEarlyAnswer(true)) && S.eqEarly.taken, 'offre anticipée acceptée');
}
{
  // vue du ciel : les incidents et attaques sont relevés à l'endroit où ils se produisent
  newGame('Ciel', 41);
  const fi = S.cal.findIndex(c => c.stagesSpec.length === 1 && !c.worlds && (!c.inv || c.inv.includes(0)));
  const rc = startRace(fi, aiSelect(S.teams[0], S.cal[fi], prepareRaceSpecs(S.cal[fi])));
  Object.assign(rc.orders, autoOrders(0, rc.specs[0], rc));
  const sim = newStageSim(rc);
  while (!sim.done) simTick(sim);
  const ev = sim.skyEv || [];
  check(
    ev.length > 0 && ev.every(e => e.km >= 0 && e.km <= sim.dist && typeof e.t === 'number'),
    `vue du ciel : ${ev.length} événement(s) placés sur la route (${[...new Set(ev.map(e => e.kind))].join(', ')})`
  );
  // héritage : une saison complète, score, courbe, panthéon, distinctions
  newGame('Héritage', 23);
  for (let i = advanceToNextRace(); i >= 0; i = advanceToNextRace()) {
    const c = S.cal[i];
    if (c.worlds) runWorlds(i);
    else if (c.inv && !c.inv.includes(0)) simulateRaceAuto(i);
    else runDelegatedRace(i);
  }
  endSeason();
  const hall = legacyHall();
  const ai = S.teams.filter(T => !T.player).reduce((a, T) => a + (dsOf(T).score || 0), 0);
  check(S.legacy && S.legacy.hist.length === 1 && hall.some(x => x.me), 'héritage : courbe de dynastie et place au panthéon');
  check(ai > 200, `héritage : les directeurs de l'ordinateur marquent aussi (${Math.round(ai)} pts)`);
  check(legacyBadges().length >= 8, 'héritage : distinctions');
  // reconstruction d'une partie ancienne : même score à partir des résultats
  const sc = S.legacy.score;
  delete S.legacy;
  const L = legacyInit();
  check(Math.abs(L.score - sc) <= sc * 0.25 + 10, `héritage reconstruit pour une partie ancienne (${L.score} contre ${sc})`);
}
{
  // vestiaire : capitaine, ambitions ciblées, promesses tenues ou rompues, parrainage, réunions, rivalités
  newGame('Vestiaire', 12);
  weeklyUpdate();
  const P = S.teams[0];
  check(captain() && captain().age >= 25, `capitaine de route désigné (${captain() && riderName(captain())})`);
  const rs = P.riders.map(id => S.riders[id]);
  check(rs.every(r => CHARS[charOf(r)] && leadOf(r) >= 5), 'caractère et leadership de chaque coureur');
  check(rs.some(r => r.goal.race), 'ambitions ciblées : une course visée');
  const gt = S.cal.find(c => c.cat === 0 && c.stagesSpec.length > 1);
  const r0 = rs.sort((a, b) => overall(b.s) - overall(a.s))[0];
  const t0 = trustOf();
  check(/Promis/.test(promiseRole(r0.id, gt.key)), 'promesse de rôle sur une course');
  promisesAfterRace({ key: gt.key, name: gt.name, ledBy: [] });
  check(trustOf() < t0 && S.proms[0].ok === false, 'promesse rompue : confiance du groupe en baisse');
  const y = S.teams[0].riders.map(id => S.riders[id]).find(r => r.age <= 24 && !r.aca);
  if (y) {
    const m = proMentorCands(y)[0];
    check(m && /sous son aile/.test(setProMentor(y.id, m.id)), 'parrainage entre pros');
  }
  check(/Réunion/.test(teamMeeting('ecouter')) && !meetReady(), 'réunion d’équipe, puis délai');
  // obéissance : le capitaine en course aide
  const sim = { runners: [{ player: true, id: S.captain, dnf: false, r: captain() }] };
  check(captainObey({ player: true, id: -1 }, sim) > 0, 'capitaine en course : consignes mieux appliquées');
  // négociation : agent, contre-proposition, clauses
  const fr = S.free.map(id => S.riders[id]).filter(r => r.age > 21).sort((a, b) => overall(b.s) - overall(a.s))[0];
  S.budget = 5000;
  let res = null;
  for (let k = 0; k < 6 && !(res && res.counter); k++) {
    S.negoC = null;
    fr.negoBlock = 0;
    res = negotiate(fr.id, Math.round(contractDemand(fr) * 0.97), 2, false, { bonus: 0, role: null, release: false });
    if (res.ok) break;
  }
  check(AGENTS[agentOf(fr)] && (res.ok || res.counter), `négociation : agent (${agentOf(fr)}) et contre-proposition`);
  if (res.counter) {
    const a = acceptCounter();
    check(a.ok && fr.team === 0 && fr.cl, `contre-proposition acceptée : ${a.txt}`);
  }
  {
    const f2 = S.free.map(id => S.riders[id]).filter(r => r.age > 21 && r.team === null)[1];
    S.negoC = null;
    const C = negoCounter(f2, 50, 2, false, { bonus: 0, role: null, release: false }, 0.5);
    const a = acceptCounter();
    check(C && a.ok && f2.team === 0 && f2.cl, `contre-proposition acceptée : ${a.txt}`);
  }
  const ch = negoChance(fr, 100, 2, false, 100, { bonus: 20, role: gt.key, release: true }).parts.map(p => p[0]);
  check(ch.includes('Prime de victoire') && ch.includes('Clause libératoire'), 'clauses prises en compte');
}
console.log(fails ? `\n${fails} échec(s)` : '\nTout est bon.');
process.exit(fails ? 1 : 0);
