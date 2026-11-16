/* Interface — démarrage */
window.addEventListener('load', () => {
  $('#modal').addEventListener('click', closeModal);
  // affichage immédiat depuis la copie locale, puis la copie compressée si elle est plus récente
  askPersist();
  load();
  render();
  loadAsync().then(ok => {
    if (ok) render();
  });
});
