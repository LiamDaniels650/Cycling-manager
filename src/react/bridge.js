// Pont entre le moteur (et l'ancienne interface, gardée pour les écrans pas encore convertis) et React.
// Le moteur modifie l'état global S et UI ; ici, chaque fonction d'affichage de l'ancienne interface (render,
// renderLive, renderModal) devient une simple demande de rafraîchissement de l'application React.
let bump = () => {};
let rendering = false;
let flash = null,
  flashAt = 0;
export function setBump(f) {
  bump = f;
}
export function refresh() {
  // un écran de l'ancienne interface peut redemander un affichage pendant qu'il est lui-même affiché :
  // on reporte alors la demande après l'affichage en cours
  if (rendering) queueMicrotask(() => bump());
  else bump();
}
export function beginRender() {
  rendering = true;
}
export function endRender() {
  rendering = false;
}
// Message bref de l'interface (UI.flash) : capté une fois, affiché jusqu'au prochain changement d'écran.
export function takeFlash() {
  if (UI.flash) {
    flash = UI.flash;
    flashAt = Date.now();
    UI.flash = null;
  }
  // l'écran se redessine sans cesse pendant une course : le message reste lisible 8 secondes
  return flash && Date.now() - flashAt < 8000 ? flash : null;
}
export function clearFlash() {
  flash = null;
}
export function installBridge() {
  const w = /** @type {any} */ (window);
  const go0 = w.go;
  w.go = v => {
    clearFlash();
    go0(v);
  };
  w.render = () => {
    document.body.classList.toggle('racing', UI.view === 'race' && !!UI.sim);
    refresh();
    if (UI.view === 'opt') setTimeout(() => w.showBackups && w.showBackups(), 0);
  };
  w.renderLive = () => refresh();
  w.renderModal = () => refresh();
  w.renderBusy = () => refresh();
  // boucle de la course en direct : le pas de simulation de l'ancienne interface (loop), puis un rafraîchissement
  // (la retransmission bouge en continu entre deux pas)
  w.startTimer = () => {
    w.stopTimer();
    UI.timer = setInterval(() => {
      w.loop();
      refresh();
    }, w.LOOP_MS || 180);
  };
}
