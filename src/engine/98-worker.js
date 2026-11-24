/* Web Worker : aller-retour de l'état.
   Le Worker ne reçoit que trois choses : l'état de la partie (S), la série aléatoire (_sd) et le compteur
   d'identifiants (_rid). Tout ce qui se déduit de l'état (définitions de courses de la partie, taille des
   effectifs…) doit être recalculé par stateRestored(), appelée à chaque reprise d'état : chargement d'une
   sauvegarde, réception dans le Worker, retour du Worker sur la page. Une nouvelle donnée dérivée de S s'ajoute
   ici, et nulle part ailleurs. tests/worker_roundtrip.js vérifie qu'un calcul fait dans un contexte vierge, avec
   seulement ce qui voyage, donne exactement le même état qu'un calcul fait sur place. */

// Recalcule ce qui se déduit de l'état repris.
function stateRestored() {
  worldApply(); // courses de la partie (disparues, créées, catégories), taille des effectifs (66-monde.js)
}
// Instantané des données dérivées de l'état (celles que stateRestored recalcule) : le test d'aller-retour vérifie
// qu'elles sont identiques dans le Worker et sur la page. Toute nouvelle donnée dérivée s'ajoute aux deux.
function derivedState() {
  return JSON.stringify({ defs: RACE_DEFS, reg: RACE_REG, roster: ROSTER.max });
}
// Traite une demande du Worker : { op, state, sd, rid, i, delegate } → message de fin ({ done, state, sd, rid }).
// post(message) transmet l'avancement d'une course (étape après étape).
function workerRun(d, post) {
  S = d.state;
  _sd = d.sd;
  if (d.rid != null) _rid = d.rid;
  stateRestored();
  const fin = extra => Object.assign({ done: true, state: S, sd: _sd, rid: _rid }, extra);
  if (d.op === 'worlds') {
    const rc = runWorlds(d.i);
    return fin({ win: rc.stageRes[0].res[0].id });
  }
  if (d.op === 'advance') {
    advanceToNextRace();
    return fin();
  }
  if (d.delegate) {
    // course confiée à l'adjoint : même déroulé, avec la progression étape par étape
    STAGE_DONE = r => post({ k: r.si, n: r.specs.length });
    try {
      runDelegatedRace(d.i);
    } finally {
      STAGE_DONE = null;
    }
  } else {
    const rc = startRace(d.i, []);
    while (!rc.done) {
      runStageAuto(rc);
      post({ k: rc.si, n: rc.specs.length });
    }
  }
  S.rc = null;
  return fin();
}
