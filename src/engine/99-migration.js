/* Migration des anciennes sauvegardes */
function initRiderExtras(r) {
  if (r.s.des === undefined) {
    const A = ARCH[r.arch] || ARCH.rouleur;
    const q = overall(r.s) - 74;
    r.s.des = Math.round(clamp(A.des + q * 0.6 + gauss() * 3, 35, 92));
    r.s.plc = Math.round(clamp(A.plc + q * 0.6 + gauss() * 3, 35, 92));
  }
  if (r.ceil === undefined) {
    const ov = overall(r.s);
    r.ceil = ov + Math.max(0, Math.round(r.pot || 0));
    if (r.age <= 23) r.ceil += rint(1, 5);
    r.ceil = Math.max(ov, Math.min(r.ceil, Math.round(85 + gauss() * 2)));
  }
  if (!r.nz) {
    r.nz = STATS.map(() => +clamp(gauss(), -1.6, 1.6).toFixed(1));
    r.nzc = +clamp(gauss(), -1.6, 1.6).toFixed(1);
  }
  if (!r.career) r.career = [];
  if (!r.palm) r.palm = [];
  initPop(r);
  if (!r.kg) {
    const KG = { grimpeur: 61, complet: 65, puncheur: 66, baroudeur: 68, rouleur: 74, flahute: 77, sprinteur: 73 };
    r.kg = Math.round(clamp((KG[r.arch] || 68) + gauss() * 2.8, 52, 90));
  }
  if (r.stats && r.stats.kf === undefined) {
    r.stats.kf = 0;
    r.stats.att = 0;
  }
}
// Met à niveau une ancienne sauvegarde (S.v) en complétant les nouvelles données.
function migrate() {
  if (S.lvl == null) S.lvl = worldLevel();
  if (!S) return;
  if (!S.v || S.v < 2) {
    S.staff = S.staff || { coach: 1, doctor: 1, scout: 1 };
    S.academy = S.academy || [];
    S.youth = S.youth || [];
    S.know = S.know || {};
    S.watch = S.watch || [];
    S.raceHist = S.raceHist || {};
    S.teamHist = S.teamHist || [];
    S.conf = S.conf == null ? 50 : S.conf;
    S.fin = S.fin || {};
    const stl = [
      'gc',
      'agressif',
      'gc',
      'sprint',
      'defensif',
      'opportuniste',
      'agressif',
      'sprint',
      'defensif',
      'opportuniste',
      'agressif',
    ];
    S.teams.forEach((T, i) => {
      if (!T.player && !T.style) T.style = stl[(i - 1) % stl.length];
    });
    for (const id in S.riders) initRiderExtras(S.riders[id]);
    if (!S.youth.length) genYouth(30);
    if (!S.obj) genObjectives();
    // une course en cours garde son format : les étapes non courues gagnent vent/sprint
    if (S.rc && S.rc.specs)
      for (const sp of S.rc.specs) {
        if (sp.wind === undefined) {
          sp.wind = rint(1, 3);
          sp.isp = 0.55;
        }
      }
    S.v = 2;
  }
  if (S.v < 3) {
    S.rel = S.rel || {};
    S.relSeen = S.relSeen || {};
    for (const id of S.teams[0].riders.concat(S.academy)) seedRelationsFor(id);
    S.v = 3;
  }
  if (S.v < 4) {
    for (const id in S.riders) initRiderExtras(S.riders[id]);
    if (S.rep == null) S.rep = clamp(70 - (S.lastRank || 8) * 4, 15, 80);
    S.press = S.press || [];
    S.pwRec = S.pwRec || [];
    S.v = 4;
  }
  if (S.v < 5) {
    initEquipment();
    initCareer();
    S.v = 5;
  }
  if (S.v < 6) {
    initEconomy();
    S.v = 6;
  }
  if (S.v < 7) {
    S.plan = S.plan || {};
    S.recon = S.recon || {};
    if (!Object.values(S.riders).some(r => r.goal)) assignGoals();
    if (!S.cal.some(c => c.worlds)) {
      const d = RACE_DEFS.find(x => x.worlds);
      S.cal.push({
        key: d.key,
        w: d.w,
        name: d.name,
        cat: d.cat,
        done: S.week > d.w,
        winner: null,
        stagesSpec: d.stages,
        worlds: true,
        inv: [],
      });
      S.cal.sort((a, b) => a.w - b.w);
      if (S.rc) S.rc.calIdx = S.cal.findIndex(c => c.key === S.rc.key);
    }
    S.v = 7;
  }
  if (S.v < 8) {
    S.worldsWish = S.worldsWish || null;
    S.review = S.review || null;
    S.v = 8;
  }
  if (S.v < 9) {
    S.merc = S.merc || [];
    for (const cat in S.eqDeal) {
      S.eqDeal[cat].proto = !!S.eqDeal[cat].proto;
      S.eqDeal[cat].perf = S.eqDeal[cat].perf || 0;
    }
    S.v = 9;
  }
  if (S.v < 10) {
    if (!S.image) initImage();
    S.teamRel = S.teamRel || {};
    S.v = 10;
  }
  if (S.v < 11) {
    // effectifs élargis (25-30 coureurs), budgets des équipes IA, classement UCI sur 20 coureurs
    for (const T of S.teams) {
      if (T.player) continue;
      while (T.riders.length < aiTarget(T) - 2) {
        const r = genRider(pick(COMPO_EXTRA), T.tier - 2 + gauss() * 1.6, { age: rint(20, 25), nat: T.natBias });
        r.team = T.id;
        r.contract = rint(1, 2);
        S.riders[r.id] = r;
        T.riders.push(r.id);
      }
    }
    initAiBudgets();
    if (!S.climate) genClimate();
    genFreeAgents(20);
    if (S.spons && S.spons.base < 40) S.spons.base = Math.round((S.spons.base + 27) * 10) / 10;
    uciRefresh();
    msg(
      'Nouvelle saison du jeu',
      `Les effectifs s'agrandissent comme dans le peloton réel : jusqu'à ${ROSTER.max} coureurs, ${ROSTER.minPlayer} au minimum. Votre sponsor a relevé son engagement pour vous permettre de recruter. Le classement UCI par équipes compte désormais les 20 meilleurs coureurs.`
    );
    S.v = 11;
  }
  if (S.v < 12) {
    S.seed0 = S.seed0 || (_sd ^ 0x5bd1e995) | 0;
    S.v = 12;
  }
  // (sans changement de version) nouvelles catégories d'équipement : roues, pneus, nutrition ; mécaniciens
  if (!S.car) eqEnsure();
}
