/* Mode carrière — les courses pros du joueur (stagiaire ou professionnel). La course se court dans le monde
   réel du jeu : le joueur pilote son seul coureur (rc.carId), son équipe et toutes les autres suivent leur
   directeur sportif ; les résultats comptent comme n'importe quelle course (palmarès, points UCI). */

// Programme du joueur : est-il retenu par son équipe pour cette course ? Stagiaire : quelques courses
// d'un jour ou par étapes hors Grands Tours après le 1er août. Pro : le directeur sportif retient les meilleurs
// de l'effectif pour le parcours, sans trop charger le calendrier de chacun.
function carProSelected(T, cal) {
  const me = carMe();
  if (!me || me.team !== T.id || me.injury > 0 || cal.worlds) return false;
  if (cal.inv && !cal.inv.includes(T.id)) return false;
  if (S.car.skip[S.season + ':' + cal.key]) return false;
  if (S.car.stag === T.id) return cal.cat > 0 && cal.w >= CAR_STAG_WEEK && (S.car.stagN || 0) < CAR_STAG_MAX;
  if (!carIsPro()) return false;
  const spec = cal.stagesSpec.map(([type]) => ({ type }));
  const days = sum(S.cal.filter(c => c.done).map(c => c.stagesSpec.length));
  const over = r => r.stats.days > days * 0.5 + 6;
  if (over(me) || me.fatigue > 75) return false; // le directeur sportif ménage un coureur épuisé
  // les meilleurs pour le parcours parmi ceux qui ne sont pas surchargés…
  const fit = r => worldsFit(r, spec) + (r.forme - 70) * 0.2 - r.fatigue * 0.25;
  const rs = T.riders
    .map(id => S.riders[id])
    .filter(r => r && r.injury <= 0 && !over(r))
    .sort((a, b) => fit(b) - fit(a));
  // la confiance du directeur sportif pèse sur la sélection
  // … et la popularité : les sponsors de l'équipe veulent voir la vedette
  const bonus = (S.car.trust >= 70 ? 1 : S.car.trust < 30 ? -2 : 0) + (carRep().pub >= 70 ? 1 : 0);
  if (rs.indexOf(me) < raceSize(cal) + bonus) return true;
  // … et, hors Grands Tours, la rotation donne leur part de courses à ceux qui ont peu couru
  return cal.cat > 0 && me.stats.days < days * 0.4;
}
// Crochet de aiSelect (06-race-setup.js) : la sélection de l'équipe du joueur suit son programme.
function carSelHook(T, cal, sel, rs) {
  const me = carMe();
  if (!me || me.team !== T.id) return;
  const want = carProSelected(T, cal);
  const i = sel.indexOf(me);
  if (want && i < 0) sel[sel.length - 1] = me;
  else if (!want && i >= 0) {
    const sub = rs.find(r => !sel.includes(r) && r !== me);
    if (sub) sel[i] = sub;
    else sel.splice(i, 1);
  }
}
// Course pro du joueur cette semaine (indice dans le calendrier), pas encore courue.
function carProThisWeek() {
  const T = carTeamOfMe();
  if (!T) return -1;
  return S.cal.findIndex(c => !c.done && c.w === S.week && carProSelected(T, c));
}
function carProStart(i) {
  const rc = startRace(i, delegateSelection(i));
  rc.autoDS = true;
  rc.delegated = true;
  rc.carId = S.car.id;
  rc.carPro = true;
  if (S.car.stag != null) S.car.stagN = (S.car.stagN || 0) + 1;
  carProStageOrders(rc);
  carDreamBoost(rc.name, S.cal[i].key, 'pro');
  return rc;
}
// Équipe 0 du monde (confiée à l'adjoint) : consignes, matériel et ravitaillement réglés automatiquement.
function carProStageOrders(rc) {
  if (!rc.sel[0] || !rc.sel[0].length) return;
  const spec = rc.specs[rc.si];
  Object.assign(rc.orders, autoOrders(0, spec, rc));
  carOrderHook(rc);
  if (!isITT(spec) && !isTTT(spec)) {
    const g = autoGear(spec);
    setGear('wheels', g.wheels);
    setGear('tyres', g.tyres);
    setFeed(autoFeed(spec));
    autoPlan(rc);
  }
}
// Course pro simulée d'un bloc (le coureur du joueur court alors comme les autres, selon sa consigne).
function carProSim(i) {
  const rc = carProStart(i);
  rc.carId = null;
  while (!rc.done) {
    carProStageOrders(rc);
    runStageAuto(rc);
  }
  return carProAfter(rc);
}
function carProAfter(rc) {
  const order = carOrderOf(rc);
  const me = carMe();
  const rank = order.indexOf(me.id) + 1;
  const w = rc.cat === 0 ? 6 : rc.cat === 1 ? 4 : 2.5;
  carTeamAfterRace(rc, rank);
  const rec = carRecord(rc, rc.name, 'pro', rc.key, rank, order, w);
  S.rc = null;
  return rec;
}
