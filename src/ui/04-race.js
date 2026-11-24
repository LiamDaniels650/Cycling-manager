// Bouton auto : matériel et ravitaillement conseillés pour l'étape.
function gearAuto() {
  const rc = S.rc,
    spec = rc.specs[rc.si];
  const g = autoGear(spec);
  setGear('wheels', g.wheels);
  setGear('tyres', g.tyres);
  setFeed(autoFeed(spec));
  UI.flash = '🧑‍💼 Matériel et ravitaillement réglés selon les conseils du staff.';
  save();
  render();
}
function setPlan(k, v) {
  const rc = S.rc;
  rc.plan = rc.plan || {};
  rc.plan[0] = rc.plan[0] || { debut: 'neutre', milieu: 'neutre', final: 'neutre' };
  rc.plan[0][k] = v;
  rc.planStage = rc.si; // choix du joueur : l'adjoint n'y touche plus
  save();
}
function addCond() {
  const f = UI.condForm;
  const rc = S.rc;
  rc.conds = rc.conds || {};
  (rc.conds[f.id] = rc.conds[f.id] || []).push({ c: f.c, p: COND[f.c].p ? f.p : null, a: f.a });
  save();
  render();
}
function delCond(id, k) {
  S.rc.conds[id].splice(k, 1);
  save();
  render();
}
function setOrd(id, k, v) {
  const o = S.rc.orders[id] || (S.rc.orders[id] = { o: 'protect' });
  o[k] = v;
  save();
  if (k === 'o') render();
}
// Bouton « tout en auto » du briefing.
function briefAuto() {
  const rc = S.rc,
    spec = rc.specs[rc.si];
  const o = autoOrders(0, spec, rc);
  Object.assign(rc.orders, o);
  const g = autoGear(spec);
  setGear('wheels', g.wheels);
  setGear('tyres', g.tyres);
  setFeed(autoFeed(spec));
  const itt = isITT(spec) || isTTT(spec);
  const pl = itt ? '' : ' Plan : ' + autoPlan(rc);
  UI.flash = `🧑‍💼 Étape réglée.${itt ? '' : ' ' + ordersExplain(rc, o) + '.'}${pl}`;
  save();
  render();
}
function autoMine() {
  const o = autoOrders(0, S.rc.specs[S.rc.si], S.rc);
  Object.assign(S.rc.orders, o);
  UI.flash = `🧑‍💼 Consignes : ${ordersExplain(S.rc, o) || 'chacun pour soi'}.`;
  save();
  render();
}
function startStage() {
  const rc = S.rc;
  const spec = rc.specs[rc.si];
  if (isITT(spec) || isTTT(spec)) {
    const before = rc.si;
    const snap = JSON.stringify({ S, sd: _sd, rid: _rid });
    const gc0 = { ...rc.gc };
    runStageAuto(rc); // contre-la-montre : même série de hasard que hors interface
    UI.lastRec = {
      snap,
      autoDS: !!UI.autoDS,
      gc0,
      name: rc.name,
      si: before,
      inputs: [],
      t: null,
      res: stageCheck(rc),
    };
    journalStage(rc, rc.stageRes[rc.stageRes.length - 1], gc0);
    UI.lastStage = { idx: before, itt: true, ttt: isTTT(spec) };
    save();
    render();
    return;
  }
  // mode essentiel : l'adjoint règle ce que le joueur n'a pas touché (matériel, ravitaillement, plan)
  if (S.simple) {
    if (rc.gearStage !== rc.si) {
      const g = autoGear(spec);
      setGear('wheels', g.wheels);
      setGear('tyres', g.tyres);
    }
    if (rc.feedStage !== rc.si) setFeed(autoFeed(spec));
    if (!rc.plan || !rc.plan[0] || rc.planStage !== rc.si) {
      autoPlan(rc);
      rc.planStage = rc.si;
    }
  }
  // état au départ de l'étape (en mémoire seulement) : avec les actions notées pendant l'étape, de quoi la rejouer
  // à l'identique hors du jeu (rapport « Signaler », tools/replay.js)
  UI.rec = {
    snap: JSON.stringify({ S, sd: _sd, rid: _rid }),
    autoDS: !!UI.autoDS,
    gc0: { ...rc.gc },
    name: rc.name,
    si: rc.si,
  };
  UI.sim = newStageSim(rc);
  UI.hlSeen = 0;
  UI.momSeen = 0;
  UI.momOpen = null;
  UI.banner = null;
  UI.acc = 0;
  UI.sim.autoPause = UI.autoPause;
  UI.sim.autoDS = !!UI.autoDS;
  UI.Pf = UI.sim.P;
  UI.flashRace = null;
  startTimer();
  render();
}
