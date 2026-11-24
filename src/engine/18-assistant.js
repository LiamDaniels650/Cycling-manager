/* Adjoint du directeur sportif : décisions automatiques de gestion, à la demande (boutons « Auto »)
   ou chaque semaine pour les domaines délégués (S.auto). Rien ne s'exécute tant que le joueur ne l'a pas demandé. */
const AUTO_LBL = {
  train: [
    'Entraînement',
    'Plans adaptés à la fatigue, au calendrier et au profil ; pic de forme pour les leaders avant les Grands Tours.',
  ],
  contracts: ['Prolongations', 'Prolonge les coureurs utiles en fin de contrat, si le budget le permet.'],
  recruit: ['Recrutement', "Complète l'effectif avec les meilleurs coureurs libres abordables quand il passe sous 12."],
  academy: ['Académie', 'Recrute les jeunes les plus prometteurs et passe pros ceux qui sont prêts.'],
  press: ['Presse', 'Répond aux journalistes en ménageant la notoriété et le groupe.'],
  equip: ['Équipementiers', 'Choisit le meilleur compromis qualité / argent parmi les offres.'],
  staff: ['Staff', 'Renforce le staff quand le budget est confortable (une fois par saison).'],
};
// Coureurs de l'équipe du joueur (pros) et de son académie (le moteur ne dépend pas de l'interface).
function teamPros() {
  return S.teams[0].riders.map(id => S.riders[id]);
}
// Coureurs de l'académie du joueur.
function teamAca() {
  return S.academy.map(id => S.riders[id]);
}
// Active ou désactive la délégation d'un domaine à l'adjoint.
function setAuto(k, v) {
  S.auto = S.auto || {};
  S.auto[k] = !!v;
}
// Mode essentiel : l'adjoint prend les domaines secondaires (presse, staff, équipementiers) et les réglages
// fins de course (matériel, ravitaillement, plan) ; le joueur garde l'essentiel du métier de directeur sportif.
function setSimple(on) {
  S.simple = !!on;
  if (on) for (const k of ['press', 'equip', 'staff']) setAuto(k, true);
}

// Entraînement : repos si fatigué, pic de forme pour les leaders avant un Grand Tour, sinon travail de spécialité.
function asstTraining() {
  const nxt = S.cal.find(c => !c.done && c.w >= S.week);
  const gt = S.cal.find(
    c => !c.done && c.cat === 0 && c.w - S.week >= 4 && c.w - S.week <= 8 && (!c.inv || c.inv.includes(0))
  );
  const pros = teamPros();
  const gcLeaders = pros
    .filter(r => ['complet', 'grimpeur'].includes(r.arch))
    .sort((a, b) => b.s.mon - a.s.mon)
    .slice(0, 2);
  const SPEC = {
    grimpeur: 'montagne',
    complet: 'montagne',
    sprinteur: 'sprint',
    rouleur: 'clm',
    flahute: 'paves',
    puncheur: 'sprint',
    baroudeur: 'foncier',
  };
  let n = 0;
  for (const r of pros.concat(teamAca())) {
    let t;
    if (r.injury > 0 || r.fatigue >= 45) t = 'repos';
    else if (r.training === 'pic' && r.peakW && r.peakW >= S.week) t = 'pic';
    else if (gt && gcLeaders.includes(r)) t = 'pic';
    else if (nxt && nxt.w - S.week <= 1) t = 'normal';
    else if (r.age <= 23 && r.fatigue < 25) t = 'intensif';
    else t = SPEC[r.arch] || 'normal';
    if (t === 'pic' && r.training !== 'pic') r.peakW = gt.w;
    if (r.training !== t) {
      r.training = t;
      n++;
    }
  }
  return n ? `Entraînement : ${n} plan(s) ajusté(s).` : null;
}
// Masse salariale soutenable : l'adjoint n'engage une dépense annuelle (salaire, augmentation) que si la masse
// salariale reste couverte par les recettes prévues (sponsor, équipementiers, primes de la saison passée),
// complétées au plus par la moitié des réserves au-delà de 300 k€.
function payrollRoom(extra) {
  const pay = sum(teamPros().map(r => r.salary)) + sum(teamAca().map(r => r.salary));
  const staff = sum(Object.values(S.staff).map(l => STAFF_COST[l]));
  const prev = S.fin && S.fin[S.season - 1];
  const prize = prev ? prev.prize : 250;
  // frais de course et de stages : ceux de la saison passée (sinon une estimation)
  const other = prev ? -prev.other : raceDayCost() * 150;
  const income = sponsorWeekly() * LAST_WEEK + sum(Object.values(S.eqDeal).map(d => d.pay)) + prize;
  return pay + staff + other + extra <= income + Math.max(0, S.budget - 300) / 2;
}
// Prolongations des coureurs utiles en fin de contrat.
function asstContracts() {
  // demande d'augmentation : accordée aux cinq meilleurs coureurs, refusée aux autres
  let raise = null;
  if (S.raiseReq && S.riders[S.raiseReq.id]) {
    const r = S.riders[S.raiseReq.id];
    const top5 = teamPros()
      .sort((a, b) => overall(b.s) - overall(a.s))
      .slice(0, 5);
    const ask = S.raiseReq.ask;
    const why = !top5.includes(r)
      ? 'pas dans les cinq meilleurs de l’effectif'
      : S.budget <= ask
        ? 'trésorerie insuffisante'
        : !payrollRoom(ask - r.salary)
          ? 'masse salariale non couverte par les recettes'
          : '';
    raise = answerRaise(!why);
    if (raise) raise = `Augmentation ${why ? `refusée (${why})` : 'accordée (un des cinq meilleurs)'} : ${raise}`;
  }
  if (S.week < 8) return raise;
  const pros = teamPros().filter(r => !r.aca);
  const ovs = pros.map(r => overall(r.s)).sort((a, b) => b - a);
  const bar = ovs[Math.min(ovs.length - 1, 9)] || 0;
  const done = [];
  for (const r of pros) {
    if (r.contract > 1 || r.nextTeam != null || r.age >= 35) continue;
    const ov = overall(r.s);
    const keep = ov >= bar - 1 || (r.age <= 24 && potEst(r) >= ov + 4);
    if (!keep || S.budget < contractDemand(r) * 0.5 || !payrollRoom(Math.max(0, contractDemand(r) - r.salary)))
      continue;
    const e = extendRider(r.id, r.age <= 28 ? 2 : 1);
    if (!e) done.push(`${riderName(r)} (${ov >= bar - 1 ? 'parmi les 10 meilleurs' : 'jeune à potentiel'})`);
  }
  const t = done.length ? `Prolongations : ${done.join(', ')}.` : null;
  return [raise, t].filter(Boolean).join(' ') || null;
}
// Recrutement : complète l'effectif jusqu'à 22 coureurs avec le meilleur rapport niveau / salaire.
function asstRecruit() {
  const P = S.teams[0];
  const done = [];
  let tries = 0;
  while (P.riders.length < ROSTER.player && tries++ < 8) {
    const pool = S.free
      .map(id => S.riders[id])
      .filter(
        r =>
          r &&
          !r.retired &&
          r.age <= 33 &&
          !(r.negoBlock > S.week + S.season * 100) &&
          contractDemand(r) * 1.15 < S.budget &&
          (P.riders.length < ROSTER.minPlayer || payrollRoom(contractDemand(r)))
      )
      .sort((a, b) => shownOv(b) - contractDemand(b) / 60 - (shownOv(a) - contractDemand(a) / 60));
    if (!pool.length) break;
    const r = pool[0];
    const res = negotiate(
      r.id,
      Math.max(minSalary(0), Math.round((contractDemand(r) * 1.05) / 5) * 5),
      r.age <= 27 || neoPro(r) ? 2 : 1,
      false
    );
    if (res.ok)
      done.push(
        `${riderName(r)} (≈${shownOv(r)}, ${fmtMoney(r.salary)}/an : meilleur rapport niveau/salaire du marché libre)`
      );
  }
  return done.length
    ? `Recrutement pour compléter l'effectif (${P.riders.length}/${ROSTER.player}) : ${done.join(', ')}.`
    : null;
}
// Académie : recrute les jeunes les plus prometteurs, passe pros ceux qui sont prêts.
function asstAcademy() {
  const out = [];
  for (const r of teamAca().slice()) {
    if (S.teams[0].riders.length >= ROSTER.max) break;
    if (r.age >= acaAgeOut() - 1 || (r.age >= 20 && overall(r.s) >= 70)) {
      if (!promoteRider(r.id)) out.push(`${riderName(r)} passe pro`);
    }
  }
  while (S.academy.length < acaMax() - 1 && S.budget > 400) {
    const y = S.youth
      .map(id => S.riders[id])
      .filter(r => r && r.age <= 19 && r.preAI == null && !acaRefuses(r))
      .sort((a, b) => potEst(b) - potEst(a))[0];
    if (!y || potEst(y) < 74) break;
    if (joinAcademy(y.id)) break;
    out.push(`${riderName(y)} rejoint l'académie`);
  }
  // encadrement : un mentor pour chaque espoir, tests physiques, stagiaires en fin de saison, charge maîtrisée
  const ments = mentorCands();
  for (const r of teamAca()) {
    if (!mentorOf(r)) {
      const M = ments.find(M => Object.values(S.mentor || {}).filter(v => v === M.id).length < 2);
      if (M && !setMentor(r.id, M.id)) out.push(`${riderName(M)} mentor de ${riderName(r)}`);
    }
    if (!(r.ptest && r.ptest.s === S.season) && S.budget > 300 && !physTest(r.id)) out.push(`tests de ${riderName(r)}`);
    const over = youthLoad(r) >= youthLoadMax(r) * 0.85;
    const want = over ? 'aucun' : r.age <= 18 ? 'selectif' : 'complet';
    if ((r.espProg || 'complet') !== want) r.espProg = want;
  }
  if (S.week >= STAG_WEEK)
    for (const r of teamAca()
      .filter(r => r.age >= 19 && !isStag(r))
      .sort((a, b) => overall(b.s) - overall(a.s))
      .slice(0, 2))
      if (!setStag(r.id, true)) out.push(`${riderName(r)} stagiaire`);
  return out.length ? `Académie : ${out.join(', ')}.` : null;
}
// Presse : réponse qui ménage la notoriété, le sponsor et le moral du groupe.
function asstPress() {
  const Q = S.pressQ;
  if (!Q) return null;
  const score = o => {
    const e = o.e || {};
    const moral = (e.moral || []).reduce((s, a) => s + a[1], 0) / 10;
    return (e.rep || 0) + (e.conf || 0) * 0.6 + (e.team || 0) * 0.5 + moral - (e.wantsOut ? 2 : 0);
  };
  let k = 0;
  Q.opts.forEach((o, i) => {
    if (score(o) > score(Q.opts[k])) k = i;
  });
  answerPress(k);
  return `Presse : « ${Q.opts[k].t} »`;
}
// Équipementiers : qualité du matériel (pondérée) contre argent.
function asstEquip() {
  if (!S.eqOffers) return null;
  const out = [];
  for (const cat of Object.keys(S.eqOffers)) {
    const offs = S.eqOffers[cat];
    const live = eqLiveOffers(cat);
    if (!live.length) continue;
    const val = o => eqQuality(cat, eqBrand(cat, o.id)) * 600 + o.pay;
    let k = live[0][1];
    for (const [o, i] of live) if (val(o) > val(offs[k])) k = i;
    if (S.eqChoice[cat] !== k) {
      chooseEq(cat, k);
      out.push(`${EQ_CATS[cat].lbl} : ${eqBrand(cat, offs[k].id).name}`);
    }
  }
  return out.length ? `Équipementiers : ${out.join(', ')}.` : null;
}
// Staff : un niveau de plus (entraîneurs, puis médecins, puis recruteurs) si le budget est confortable.
function asstStaff() {
  if (S.astStaff === S.season) return null;
  const yearly = sum(Object.values(S.staff).map(l => STAFF_COST[l]));
  for (const k of ['coach', 'doctor', 'scout']) {
    if (S.staff[k] >= 3) continue;
    const extra = STAFF_COST[S.staff[k] + 1] - STAFF_COST[S.staff[k]];
    if (S.budget < yearly * 2 + extra * 2 || !payrollRoom(extra)) return null;
    if (!setStaff(k, S.staff[k] + 1)) {
      S.astStaff = S.season;
      return `Staff : ${STAFF_LBL[k]} niveau ${S.staff[k]} (+${fmtMoney(extra)}/an, couverts par les recettes ; trésorerie ${fmtMoney(S.budget)}).`;
    }
    return null;
  }
  return null;
}
const ASST_FN = {
  train: asstTraining,
  contracts: asstContracts,
  recruit: asstRecruit,
  academy: asstAcademy,
  press: asstPress,
  equip: asstEquip,
  staff: asstStaff,
};
// Chaque semaine : l'adjoint gère les domaines délégués et envoie un rapport si quelque chose d'important a été fait.
function runAssistant() {
  if (!S.auto) return;
  const lines = [];
  for (const k of Object.keys(ASST_FN)) {
    if (!S.auto[k]) continue;
    const t = ASST_FN[k]();
    if (t && k !== 'train') lines.push(t);
  }
  if (lines.length) msg("🧑‍💼 Rapport de l'adjoint", lines.join('<br>'));
}
// Plan de course automatique pour le joueur, selon le profil et les leaders sélectionnés.
function autoPlan(rc) {
  const spec = rc.specs[rc.si];
  const rs = rc.sel[0].map(id => S.riders[id]);
  const t = spec.type;
  const hasSpr = rs.some(r => r.s.spr >= 76);
  const hasGc = rs.some(r => r.s.mon >= 78);
  const style =
    t === 'plat' && hasSpr ? 'sprint' : (t === 'montagne' || t === 'sommet') && hasGc ? 'gc' : 'opportuniste';
  rc.plan = rc.plan || {};
  // même raisonnement que les directeurs sportifs IA : style selon le profil, puis situation au général
  rc.plan[0] = aiPlan({ style, id: 0, riders: S.teams[0].riders }, spec, rc);
  rc.planStage = rc.si;
  return style;
}
