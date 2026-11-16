// Point d'entrée : branche l'ancienne interface sur React, charge la sauvegarde, affiche l'application.
import { createRoot } from 'react-dom/client';
import { installBridge, refresh } from './bridge.js';
import { App } from './App.jsx';

installBridge();
const root = createRoot(document.getElementById('root'));
askPersist();
initSlot();
load();
root.render(<App />);
loadAsync().then(ok => {
  if (ok) refresh();
});
