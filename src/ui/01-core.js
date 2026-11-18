/* Interface — noyau : sauvegarde, rendu, navigation, modales, tableaux */
const $ = s => document.querySelector(s);
const UI = {
  view: 'home',
  sim: null,
  timer: null,
  speed: 2,
  modal: null,
  prep: null,
  autoPause: true,
  lastStage: null,
  sortKey: 'ov',
  flash: null,
  mkt: 'free',
  stats: 'season',
  acaTab: 'aca',
  riderTab: 'fiche',
  mktFilter: '',
};
// Deux parties indépendantes : directeur sportif (« dir ») et carrière d'un coureur (« car »).
const SLOT_KEYS = { dir: 'dsc_save_v1', car: 'dsc_car_v1' };
let SAVE_KEY = SLOT_KEYS.dir;
function slotOf() {
  return UI.slot === 'car' ? 'car' : 'dir';
}
function setSlot(m) {
  UI.slot = m === 'car' ? 'car' : 'dir';
  SAVE_KEY = SLOT_KEYS[UI.slot];
  try {
    localStorage.setItem('dsc_mode', UI.slot);
  } catch (e) {}
}
function initSlot() {
  let m = 'dir';
  try {
    m = localStorage.getItem('dsc_mode') || 'dir';
  } catch (e) {}
  setSlot(m);
}
// Change de partie (directeur / carrière) : la partie en cours est enregistrée, l'autre est chargée.
function switchSlot(m, done) {
  if (S) save();
  stopTimer();
  UI.sim = null;
  UI.lastStage = null;
  UI.modal = null;
  UI.carPre = null;
  UI.view = 'home';
  S = null;
  setSlot(m);
  load();
  loadAsync().then(() => {
    if (done) done();
    render();
  });
  render();
}
function backupPrefix() {
  return slotOf() === 'car' ? 'car-saison-' : 'saison-';
}
function idbMainKey() {
  return slotOf() === 'car' ? 'car' : 'main';
}
// Sauvegarde locale (navigateur).
function save() {
  // la date d'enregistrement départage la copie locale et la copie compressée au chargement
  S.savedAt = Date.now();
  // mode carrière pendant une course : on garde la copie d'avant la course (le monde est en configuration de
  // course : équipes du peloton des jeunes) ; une course interrompue reprendra au départ
  const txt = UI.carPre && S.car ? UI.carPre : JSON.stringify({ S, sd: _sd, rid: _rid });
  // 1) copie compressée (gzip) dans IndexedDB : pas de limite pratique de taille
  idbSave(txt);
  // 2) copie directe dans le stockage local tant qu'elle tient (repli si IndexedDB est indisponible)
  try {
    if (txt.length < 2500000) localStorage.setItem(SAVE_KEY, txt);
    else localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e2) {}
    if (!UI.idbOk) {
      // ni IndexedDB ni place locale : élagage d'urgence puis nouvel essai
      try {
        pruneWorld(true);
        localStorage.setItem(SAVE_KEY, JSON.stringify({ S, sd: _sd, rid: _rid }));
        UI.flash = 'Sauvegarde allégée : les coureurs retraités sans palmarès ont été oubliés.';
      } catch (e3) {
        UI.flash = '⚠️ Sauvegarde impossible : le stockage du navigateur est plein. Exportez votre partie (⚙ Options).';
      }
    }
  }
}
// --- Sauvegarde compressée dans IndexedDB (gzip via CompressionStream quand le navigateur le permet) ---
const IDB_NAME = 'dsc_save',
  IDB_STORE = 'saves';
function idbOpen() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open(IDB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) {
      rej(e);
    }
  });
}
async function gzipText(t) {
  if (typeof CompressionStream === 'undefined') return t;
  return await new Response(new Blob([t]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
}
async function gunzipText(v) {
  if (typeof v === 'string') return v;
  return await new Response(v.stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
function idbSave(txt) {
  const seq = (UI.saveSeq = (UI.saveSeq || 0) + 1);
  gzipText(txt)
    .then(v =>
      idbOpen().then(
        db =>
          new Promise((res, rej) => {
            if (seq !== UI.saveSeq) return res(undefined); // une sauvegarde plus récente est en route
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(v, idbMainKey());
            tx.oncomplete = () => {
              UI.idbOk = true;
              UI.idbSize = v.size || v.length;
              res(undefined);
            };
            tx.onerror = () => rej(tx.error);
          })
      )
    )
    .catch(() => {
      UI.idbOk = false;
    });
}
async function idbLoad() {
  const db = await idbOpen();
  const v = await new Promise((res, rej) => {
    const r = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(idbMainKey());
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return v ? await gunzipText(v) : null;
}
// Copies de sécurité de début de saison (les trois dernières), pour revenir en arrière en cas de souci.
function idbBackup() {
  const key = (slotOf() === 'car' ? 'car-saison-' : 'saison-') + S.season;
  const txt = JSON.stringify({ S, sd: _sd, rid: _rid });
  return gzipText(txt)
    .then(v =>
      idbOpen().then(
        db =>
          new Promise(res => {
            const st = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE);
            st.put(v, key);
            const rk = st.getAllKeys();
            rk.onsuccess = () => {
              const olds = rk.result.filter(k => String(k).startsWith(backupPrefix())).sort();
              for (const k of olds.slice(0, Math.max(0, olds.length - 3))) st.delete(k);
              res(undefined);
            };
            rk.onerror = () => res(undefined);
          })
      )
    )
    .catch(() => {});
}
async function idbBackups() {
  try {
    const db = await idbOpen();
    return await new Promise(res => {
      const r = db.transaction(IDB_STORE).objectStore(IDB_STORE).getAllKeys();
      r.onsuccess = () => res(r.result.filter(k => String(k).startsWith(backupPrefix())).sort());
      r.onerror = () => res([]);
    });
  } catch (e) {
    return [];
  }
}
async function idbRestore(key) {
  const db = await idbOpen();
  const v = await new Promise((res, rej) => {
    const r = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  try {
    return v ? importSave(await gunzipText(v)) : false;
  } catch (e) {
    return false;
  }
}
function idbClear() {
  idbOpen()
    .then(db => db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).delete(idbMainKey()))
    .catch(() => {});
}
// Charge la sauvegarde la plus récente (copie compressée ou copie locale).
async function loadAsync() {
  let best = null;
  try {
    const t = localStorage.getItem(SAVE_KEY);
    if (t) best = t;
  } catch (e) {}
  try {
    const t2 = await idbLoad();
    if (t2) {
      UI.idbOk = true;
      const at = s => {
        try {
          return JSON.parse(s).S.savedAt || 0;
        } catch (e) {
          return -1;
        }
      };
      if (!best || at(t2) >= at(best)) best = t2;
    }
  } catch (e) {}
  if (best && importSave(best)) return true;
  // sauvegarde absente ou illisible : dernière copie de sécurité de fin de saison
  try {
    const keys = await idbBackups();
    for (const k of keys.slice().reverse())
      if (await idbRestore(k)) {
        UI.flash = best
          ? `⚠️ La sauvegarde était illisible : reprise à la copie de sécurité « ${k.replace('saison-', 'fin ')} ».`
          : `Partie retrouvée depuis la copie de sécurité « ${k.replace('saison-', 'fin ')} ».`;
        save();
        return true;
      }
  } catch (e) {}
  return false;
}
function load() {
  try {
    const t = localStorage.getItem(SAVE_KEY);
    if (!t) return false;
    return importSave(t);
  } catch (e) {
    return false;
  }
}
// Importe une sauvegarde (texte JSON). En cas d'échec, la partie en cours reste intacte.
function importSave(t) {
  const prev = { S, sd: _sd, rid: _rid };
  try {
    const o = JSON.parse(t);
    if (!o || !o.S || !Array.isArray(o.S.teams) || !o.S.teams.length || !o.S.riders || !o.S.cal) return false;
    S = o.S;
    _sd = o.sd;
    _rid = o.rid;
    migrate();
    if (!S.teams[0] || !Array.isArray(S.teams[0].riders)) throw new Error('équipe du joueur absente');
    return true;
  } catch (e) {
    console.error(e);
    S = prev.S;
    _sd = prev.sd;
    _rid = prev.rid;
    return false;
  }
}
// Le navigateur peut effacer les données d'un site peu visité : on lui demande de garder celles du jeu.
function askPersist() {
  try {
    const st = navigator.storage;
    if (st && st.persist)
      st.persisted().then(p => (p ? (UI.persist = true) : st.persist().then(ok => (UI.persist = ok))));
  } catch (e) {}
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
function bar(v, max = 100, cls = '') {
  const p = clamp((v / max) * 100, 0, 100);
  const c = cls || (p > 66 ? 'g' : p > 33 ? 'y' : 'r');
  return `<span class="bar"><span class="bf ${c}" style="width:${p}%"></span></span>`;
}
function P() {
  return S.teams[0];
}
function myRiders() {
  return P().riders.map(id => S.riders[id]);
}
function acaRiders() {
  return S.academy.map(id => S.riders[id]);
}
function flag(n) {
  return `<span class="nat">${n}</span>`;
}
function svOv(r) {
  return isEst(r) ? '~' + shownOv(r) : overall(r.s);
}
function tshort(r) {
  const T = teamOf(r);
  return r.aca ? 'ACA' : T ? T.short : r.youth ? 'jeune' : 'libre';
}
// Remplacée par le pont React (src/react/bridge.js).
function render() {}
// Change d'onglet (met la course en direct en pause).
function go(v) {
  if (UI.view === 'race' && UI.sim && !UI.sim.done && v !== 'race') {
    stopTimer();
  }
  UI.view = v;
  render();
  window.scrollTo(0, 0);
  if (v === 'race' && UI.sim && !UI.sim.done) startTimer();
}
function renderModal() {}
function closeModal() {
  UI.modal = null;
  renderModal();
}
function alertBox(t) {
  UI.modal = { type: 'msg', text: t };
  renderModal();
}
function confirmBox(t, cb) {
  UI._cb = () => {
    closeModal();
    cb();
  };
  UI.modal = { type: 'confirm', text: t };
  renderModal();
}

// Écran étroit (téléphone) et préférence d'affichage.
function narrowScreen() {
  if (UI.tableMode === 'table') return false;
  if (UI.tableMode === 'cards') return true;
  return typeof window !== 'undefined' && window.innerWidth < 640;
}
