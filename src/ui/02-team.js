function setTraining(id, v) {
  S.riders[id].training = v;
  if (v !== 'pic') S.riders[id].peakW = null;
  save();
  render();
}
function setPeak(id, w) {
  S.riders[id].peakW = w ? +w : null;
  save();
}
function openRider(id) {
  UI.modal = { type: 'rider', id };
  UI.riderTab = 'fiche';
  UI.nego = null;
  renderModal();
}
function doMediate(a, b) {
  const t = mediate(a, b);
  save();
  UI.flash = t;
  closeModal();
  render();
}
// Salaire demandé tel que l'estime le directeur sportif (erreur propre au coureur, la même à chaque affichage).
function demEst(r) {
  return Math.round((contractDemand(r) * agentDemMul(r) * (0.9 + (0.2 * ((r.nzc || 0) + 1.6)) / 3.2)) / 5) * 5;
}
function doNego(id) {
  const n = UI.nego;
  const res = negotiate(id, n.sal, n.years, n.promise, n.cl || { bonus: 0, role: null, release: false });
  save();
  UI.flash = (res.ok ? '✅ ' : res.counter ? '🗣️ ' : '❌ ') + res.txt;
  // contre-proposition : la fiche reste ouverte pour y répondre
  if (res.counter) return renderModal();
  closeModal();
  render();
}
function talk(id, k) {
  const t = talkRider(id, k);
  save();
  UI.flash = t;
  closeModal();
  render();
}
function extend(id, y) {
  const e = extendRider(id, y);
  save();
  UI.flash = e || `Contrat prolongé de ${y} an(s).`;
  closeModal();
  render();
}
function release(id) {
  confirmBox('Libérer ce coureur ?', () => {
    const e = releaseRider(id);
    save();
    UI.flash = e || 'Coureur libéré.';
    render();
  });
}
function promote(id) {
  const e = promoteRider(id);
  save();
  UI.flash = e || 'Nouveau néo-pro !';
  closeModal();
  render();
}
function acaJoin(id) {
  const e = joinAcademy(id);
  save();
  UI.flash = e || "Bienvenue à l'académie !";
  closeModal();
  render();
}
function acaRelease(id) {
  confirmBox("Libérer ce jeune de l'académie ?", () => {
    releaseAcademy(id);
    save();
    render();
  });
}
function watch(id) {
  const e = toggleWatch(id);
  save();
  if (e) UI.flash = e;
  renderModal();
}
function acaSet(k, id, v) {
  let e = null;
  const r = S.riders[id];
  if (k === 'prog') r.espProg = v;
  else if (k === 'mentor') e = setMentor(id, v ? +v : null);
  else if (k === 'test') e = physTest(id) || `Tests de ${riderName(r)} : profil de puissance établi.`;
  else if (k === 'stag') e = setStag(id, !!v);
  if (e) UI.flash = e;
  save();
  render();
}

function doRaise(ok) {
  UI.flash = answerRaise(ok);
  save();
  render();
}
// Réponse à la contre-proposition d'un agent.
function doCounter(yes) {
  const res = yes ? acceptCounter() : { ok: false, txt: declineCounter() };
  save();
  UI.flash = (res.ok ? '✅ ' : '❌ ') + res.txt;
  closeModal();
  render();
}
// Vestiaire : capitaine, promesse, parrainage, réunion, rivalité de leaders.
function doLocker(fn, ...a) {
  UI.flash = fn(...a);
  save();
  render();
  if (UI.modal) renderModal();
}
