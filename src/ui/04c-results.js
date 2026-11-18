/* Interface — après l'étape : arrivée, analyse de mes coureurs, résumé, classements, watts des montées,
   étape suivante et fin de course. */

function nextStage() {
  UI.lastStage = null;
  const rc = S.rc;
  Object.assign(rc.orders, autoOrdersKeep(rc));
  save();
  render();
  window.scrollTo(0, 0);
}
function autoOrdersKeep(rc) {
  const spec = rc.specs[rc.si];
  const a = autoOrders(0, spec, rc);
  const out = {};
  for (const id in a) {
    const prev = rc.orders[id];
    if (isITT(spec)) out[id] = a[id];
    else if (prev && prev.o && prev.o !== 'itt') out[id] = prev;
    else out[id] = a[id];
  }
  return out;
}
function closeRace() {
  UI.lastStage = null;
  S.rc = null;
  save();
  UI.view = 'inbox';
  render();
}
