/* Délégation des courses à l'adjoint : il sélectionne, donne les consignes, règle matériel, ravitaillement et
   plan, puis dirige la course avec le même raisonnement que les directeurs sportifs IA. Le joueur garde la main
   sur les courses importantes (Grands Tours, monuments, Mondiaux, courses marquées d'une étoile). */

// Course importante : on s'arrête avant pour la diriger soi-même.
// (par défaut : Grands Tours, monuments, Mondiaux ; l'étoile du calendrier ajoute ou retire une course)
function isKeyByDefault(c) {
  return !!(c.cat === 0 || c.worlds || (c.cat === 1 && c.stagesSpec.length === 1));
}
function isKeyRace(c) {
  const st = S.star && S.star[c.key];
  return st != null ? st : isKeyByDefault(c);
}
function toggleStar(key) {
  S.star = S.star || {};
  const c = S.cal.find(x => x.key === key);
  S.star[key] = !isKeyRace(c);
  if (c && S.star[key] === isKeyByDefault(c)) delete S.star[key];
}
// Sélection de l'adjoint : celle de la planification si elle existe, sinon la meilleure pour le parcours.
function delegateSelection(i) {
  const c = S.cal[i];
  return planSelection(
    c,
    aiSelect(
      S.teams[0],
      c,
      c.stagesSpec.map(([type, dist]) => ({ type, dist, segs: [] }))
    )
  );
}
// Toute la course dirigée par l'adjoint (même résultat que si le joueur l'avait réglée avec les boutons auto).
function runDelegatedRace(i, sel) {
  const rc = startRace(i, sel || delegateSelection(i));
  rc.autoDS = true;
  rc.delegated = true;
  while (!rc.done) {
    const spec = rc.specs[rc.si];
    Object.assign(rc.orders, autoOrders(0, spec, rc));
    if (!isITT(spec) && !isTTT(spec)) {
      const g = autoGear(spec);
      setGear('wheels', g.wheels);
      setGear('tyres', g.tyres);
      setFeed(autoFeed(spec));
      autoPlan(rc);
    }
    runStageAuto(rc);
  }
  S.rc = null;
  return rc;
}
