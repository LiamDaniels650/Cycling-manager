/* Carrière du directeur sportif : réputation personnelle, offres d'autres équipes, licenciement */

// Initialise la carrière du directeur sportif (nouvelle partie ou ancienne sauvegarde).
function initCareer() {
  if (S.career) return;
  S.career = { rep: 45, clubs: [{ name: S.teams[0].name, from: S.season, to: null }], seasons: 0 };
  S.jobOffers = null;
  S.fired = false;
  S.clubBonus = S.clubBonus || 0;
  S.expRank = expectedRank();
}
// Rang attendu de votre équipe en début de saison (d'après le classement précédent, sinon le niveau des équipes).
function expectedRank() {
  const val = T => (S.lastRanks ? S.lastRanks[T.id] || 0 : 0) || (T.player ? -0.8 : T.tier) * 100 + 500;
  return (
    S.teams
      .slice()
      .sort((a, b) => val(b) - val(a))
      .indexOf(S.teams[0]) + 1
  );
}
// Libellé de la réputation du directeur sportif.
function careerLabel(v) {
  return v >= 80
    ? 'Référence du métier'
    : v >= 65
      ? 'Très courtisé'
      : v >= 50
        ? 'Reconnu'
        : v >= 35
          ? 'En devenir'
          : v >= 20
            ? 'Contesté'
            : 'Sur la sellette';
}
// Fin de saison : la réputation du DS évolue selon le rang obtenu par rapport au rang attendu et les objectifs.
// Puis viennent les offres d'emploi… ou le licenciement.
function careerEndSeason(myRank) {
  initCareer();
  const C = S.career;
  C.seasons++;
  const okN = (S.obj || []).filter(o => objStatus(o).ok).length;
  const failN = (S.obj || []).length - okN;
  const delta = (S.expRank || 8) - myRank;
  C.rep = clamp(C.rep + delta * 2.5 + okN * 2 - failN * 1.5 + (myRank <= 3 ? 3 : 0), 0, 100);
  S.fired = S.conf <= 15;
  const ranked = uciRanking();
  const others = ranked.filter(T => !T.player);
  let offers = [];
  if (S.fired) {
    offers = others
      .slice(-4)
      .filter(() => rnd() < 0.7)
      .slice(0, 2);
    if (!offers.length) offers = [others[others.length - 1]];
  } else {
    for (const T of others) {
      const rk = ranked.indexOf(T) + 1;
      const need = 88 - (rk - 1) * 6;
      if (C.rep >= need && rnd() < 0.45) offers.push(T);
    }
    offers = offers.slice(0, 2);
  }
  S.jobOffers = offers.length
    ? offers.map(T => ({ tid: T.id, name: T.name, rank: ranked.indexOf(T) + 1, budget: clubBudget(T.tier) }))
    : null;
  if (S.fired) {
    msg(
      '❌ Vous êtes licencié',
      `La confiance du sponsor est tombée à ${S.conf}/100 : la direction de ${S.teams[0].name} se sépare de vous. ` +
        `${S.jobOffers.length > 1 ? 'Deux équipes' : 'Une équipe'} vous propose${S.jobOffers.length > 1 ? 'nt' : ''} de rebondir (onglet Gestion). ` +
        `Sans choix de votre part avant la première course, la première offre sera acceptée.`
    );
    press(
      `${S.teams[0].name} se sépare de son directeur sportif`,
      `Après une saison décevante, le sponsor a tranché.`,
      0
    );
  } else if (S.jobOffers) {
    msg(
      "📨 Offres d'emploi",
      `Votre travail est remarqué : ${S.jobOffers.map(o => `<b>${o.name}</b> (${o.rank}e)`).join(' et ')} ` +
        `vous propose${S.jobOffers.length > 1 ? 'nt' : ''} de prendre la direction sportive. Offre valable jusqu'à la première course (onglet Gestion).`
    );
  }
}
// Budget de départ d'un club selon son niveau.
function clubBudget(tier) {
  return Math.round(1500 + (tier + 0.8) * 320);
}
// Masse salariale annuelle d'une équipe.
function salaryMass(T) {
  return sum(T.riders.map(id => S.riders[id].salary));
}
// Prendre la direction d'une autre équipe : on échange l'identité et l'effectif de votre équipe (toujours l'équipe 0)
// avec ceux de l'équipe qui vous recrute. L'académie, le matériel et les finances appartiennent au club.
function acceptJob(tid) {
  const off = (S.jobOffers || []).find(o => o.tid === tid);
  if (!off) return 'Offre expirée.';
  if (S.cal.some(c => c.done)) return "La saison a commencé : l'offre a expiré.";
  const A = S.teams[0],
    B = teamById(tid);
  const oldName = A.name;
  for (const k of ['name', 'short', 'color', 'tier', 'natBias', 'eq']) [A[k], B[k]] = [B[k], A[k]];
  if (S.lastRanks) [S.lastRanks[0], S.lastRanks[tid]] = [S.lastRanks[tid], S.lastRanks[0]];
  if (S.wt) {
    // la licence et les points du cycle appartiennent à l'équipe, pas au directeur sportif
    const m = S.wt.members,
      a = m.includes(0),
      b = m.includes(tid);
    S.wt.members = m.filter(id => id !== 0 && id !== tid).concat(a ? [tid] : [], b ? [0] : []);
    [S.wt.pts[0], S.wt.pts[tid]] = [S.wt.pts[tid], S.wt.pts[0]];
  }
  const oldRiders = A.riders,
    newRiders = B.riders;
  A.riders = newRiders;
  B.riders = oldRiders;
  for (const id of oldRiders) {
    const r = S.riders[id];
    r.team = B.id;
    r.promise = false;
    S.know[id] = Math.max(S.know[id] || 0, 75);
  }
  for (const id of newRiders) {
    const r = S.riders[id];
    r.team = 0;
    r.wantsOut = false;
    r.promise = false;
  }
  for (const id of newRiders) seedRelationsFor(id);
  // nouveau vestiaire : capitaine, promesses et parrainages repartent de zéro
  S.captain = null;
  S.proms = [];
  S.proMentors = {};
  S.lockAsk = null;
  initImage(); // nouvelle équipe, nouvelle image (construite à partir de son effectif)
  S.teamRel = {};
  for (const id of S.academy.slice()) {
    const r = S.riders[id];
    r.aca = false;
    r.team = null;
    S.youth.push(id);
  }
  if (S.academy.length)
    msg('Académie', `Les ${S.academy.length} jeunes de l'académie restent à ${oldName} (ils retournent au vivier).`);
  S.academy = [];
  [A.style, B.style] = [undefined, B.style || 'gc'];
  S.budget = off.budget;
  S.clubBonus = Math.max(-10, (salaryMass(A) - 2200) / LAST_WEEK);
  S.conf = 55;
  S.rep = clamp(72 - off.rank * 4, 15, 85);
  S.staff = {
    coach: clamp(Math.round(1.5 + A.tier / 2), 1, 4),
    doctor: clamp(Math.round(1.5 + A.tier / 2), 1, 4),
    scout: clamp(Math.round(1 + A.tier / 2), 1, 4),
  };
  S.crew = null; // nouveau club, nouveau staff
  S.crewAsk = null;
  crewInit();
  // contrats du nouveau club : toutes les catégories (vélo, chrono, roues, pneus, nutrition), sur son matériel ;
  // avant, seuls vélo et chrono étaient repris et la semaine suivante plantait (génération des offres)
  S.eqDeal = {};
  for (const cat of Object.keys(EQ_CATS))
    if (A.eq && A.eq[cat]) S.eqDeal[cat] = { pay: Math.round(eqBrand(cat, A.eq[cat]).pay * 0.9), years: 1 };
  eqEnsure();
  S.eqOffers = null;
  S.eqChoice = {};
  delete S.fin[S.season];
  S.lastRank = off.rank;
  S.watch = S.watch.filter(id => S.riders[id] && S.riders[id].team !== 0);
  buildCalendar();
  genObjectives();
  aiSeasonPlans();
  S.expRank = expectedRank();
  const C = S.career;
  C.clubs[C.clubs.length - 1].to = S.season - 1;
  C.clubs.push({ name: A.name, from: S.season, to: null });
  S.jobOffers = null;
  S.fired = false;
  press(
    `Nouveau directeur sportif chez ${A.name}`,
    `L'ancien DS de ${oldName} prend les rênes de ${A.name}.`,
    0,
    [],
    true
  );
  msg(
    'Nouveau défi',
    `Vous dirigez désormais <b>${A.name}</b>. Budget : ${fmtMoney(S.budget)}.<br>Objectifs du sponsor :<br>${S.obj.map(o => '• ' + o.txt).join('<br>')}`
  );
  return `Vous voilà directeur sportif de ${A.name} !`;
}
// Refuser les offres d'emploi (impossible après un licenciement).
function declineJobs() {
  if (S.fired) return 'Vous êtes licencié : il faut accepter une offre.';
  S.jobOffers = null;
  return 'Vous restez fidèle à votre équipe.';
}
// Chaque semaine : expiration des offres, choix forcé après un licenciement, avertissement du sponsor.
function careerWeekly() {
  if (S.jobOffers && S.cal.some(c => c.done)) S.jobOffers = null;
  if (S.fired && S.jobOffers && S.week >= 2) {
    const t = acceptJob(S.jobOffers[0].tid);
    msg('Fin du chômage', t);
  }
  if (S.week === 22 && S.conf < 25)
    msg(
      '⚠️ Sur la sellette',
      `La confiance du sponsor n'est plus que de ${S.conf}/100. En dessous de 15 en fin de saison, vous serez licencié.`
    );
}
