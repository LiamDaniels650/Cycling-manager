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
function statCls(v) {
  return v >= 80 ? 's5' : v >= 74 ? 's4' : v >= 68 ? 's3' : v >= 60 ? 's2' : 's1';
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
// Lien cliquable vers la fiche d'un coureur.
function rlink(r, extra = '') {
  if (!r) return '?';
  return `<a class="rl ${r.team === 0 ? 'mine' : ''}" onclick="openRider(${r.id})">${esc(riderName(r))}</a>${wearsRainbow(r) ? ' <span title="Champion du monde">🌈</span>' : wearsNatChamp(r) ? ` <span title="Champion ${natAdj(r.nat)}">🏅</span>` : ''}${extra}`;
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
// Affiche l'écran courant (en-tête, onglets, contenu).
function render() {
  if (!S) {
    $('#hdr').innerHTML = '<div class="tt">🚴 Directeur Sportif</div>';
    $('#nav').innerHTML = '';
    $('#bnav').innerHTML = '';
    $('#main').innerHTML = startScreen();
    return;
  }
  $('#hdr').innerHTML =
    `<div class="tt"><button class="menu" onclick="openNav()" title="Menu">☰</button> <b style="color:${P().color}">■</b> ${esc(P().name)}</div>
  <div class="hi">${S.season} · sem. ${S.week} · <b class="${S.budget < 0 ? 'neg' : ''}">${fmtMoney(S.budget)}</b></div>`;
  // navigation : onglets en haut sur grand écran, barre en bas sur téléphone
  $('#nav').innerHTML = navItems()
    .map(
      ([k, ic, l, n]) =>
        `<button class="${UI.view === k ? 'on' : ''}" onclick="go('${k}')">${ic} ${l}${badge(k === 'home' ? 0 : n)}</button>`
    )
    .join('');
  $('#bnav').innerHTML = bottomNavHTML();
  let h = '';
  switch (UI.view) {
    case 'home':
      h = viewHome();
      break;
    case 'team':
      h = viewTeam();
      break;
    case 'aca':
      h = viewAcademy();
      break;
    case 'cal':
      h = viewCal();
      break;
    case 'prep':
      h = viewPrep();
      break;
    case 'race':
      h = viewRace();
      break;
    case 'market':
      h = viewMarket();
      break;
    case 'mgmt':
      h = viewMgmt();
      break;
    case 'stats':
      h = viewStats();
      break;
    case 'press':
      h = viewPress();
      break;
    case 'inbox':
      h = viewInbox();
      break;
    case 'opt':
      h = viewOpt();
      break;
  }
  const tipKey = UI.view === 'race' ? (UI.sim ? 'live' : UI.lastStage ? null : 'race') : UI.view;
  if (tipKey) h = tipCard(tipKey) + h;
  $('#main').innerHTML = (UI.flash ? `<div class="flash">${UI.flash}</div>` : '') + h;
  document.body.classList.toggle('racing', UI.view === 'race' && !!UI.sim);
  UI.flash = null;
  if (UI.view === 'opt') showBackups();
  renderModal();
}
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
function startScreen() {
  return `<div class="card center"><h1>🚴 Directeur Sportif</h1><p class="mut">Jeu de gestion d'équipe cycliste. Vous ne pilotez pas les coureurs : vous les choisissez, vous les formez et vous leur donnez des consignes… qu'ils suivront ou non.</p>
 <p><input id="tname" placeholder="Nom de votre équipe" value="Mon Équipe" maxlength="30"></p>
 <p class="small">Difficulté : <select id="tdiff">${Object.entries(DIFF)
   .map(([k, d]) => `<option value="${k}" ${k === 'normal' ? 'selected' : ''}>${d.lbl}</option>`)
   .join('')}</select></p>
 <p class="small mut">Facile : sponsor plus généreux, frais réduits, objectifs abordables. Difficile : budget serré, sponsor exigeant, objectifs ambitieux.</p>
 <p class="small"><label><input type="checkbox" id="tsimple" checked> Mode essentiel (conseillé pour débuter)</label></p>
 <p class="small mut">L'adjoint règle matériel, ravitaillement, plan de course, presse, staff et équipementiers ; vous gardez la sélection, les consignes, la radio, l'effectif et l'académie. Modifiable à tout moment dans ⚙ Options.</p>
 <p><button class="pri" onclick="newGameUI()">Nouvelle partie</button></p>
 <details><summary>Importer une sauvegarde</summary><textarea id="imp" rows="4" placeholder="Collez ici le texte de sauvegarde"></textarea><button onclick="doImport()">Importer</button></details></div>`;
}
function newGameUI() {
  const n = ($('#tname').value || 'Mon Équipe').trim();
  newGame(n, Date.now(), ($('#tdiff') || {}).value || 'normal');
  if (($('#tsimple') || {}).checked) setSimple(true);
  save();
  UI.view = 'home';
  render();
}
function doImport() {
  const t = $('#imp').value.trim();
  if (importSave(t)) {
    save();
    UI.view = 'home';
    UI.sim = null;
    render();
  } else alertBox('Sauvegarde invalide.');
}
// Tableau de coureurs triable (effectif, marché, académie).
function riderTable(rs, opts = {}) {
  const sk = UI.sortKey;
  const key = r =>
    sk === 'ov'
      ? shownOv(r)
      : sk === 'pot'
        ? potEst(r)
        : sk === 'age'
          ? -r.age
          : sk === 'forme'
            ? r.forme
            : sk === 'moral'
              ? r.moral
              : sk === 'fatigue'
                ? -r.fatigue
                : shownStat(r, sk);
  rs = rs.slice().sort((a, b) => key(b) - key(a));
  const sortOpts = [
    ['ov', 'Global'],
    ['pot', 'Potentiel'],
    ...(opts.state
      ? [
          ['forme', 'Forme'],
          ['fatigue', 'Fraîcheur'],
          ['moral', 'Moral'],
        ]
      : []),
    ['age', 'Âge'],
    ...STATS.map(k => [k, STAT_LBL[k]]),
  ];
  // une liste déroulante plutôt qu'une rangée de 16 boutons
  let h = `<div class="row small"><label>Trier par <select onchange="UI.sortKey=this.value;render()">${sortOpts
    .map(([k, l]) => `<option value="${k}" ${sk === k ? 'selected' : ''}>${l}</option>`)
    .join('')}</select></label></div>`;
  // sur téléphone : une carte par coureur (le tableau complet reste disponible)
  if (narrowScreen()) return h + riderCards(rs, opts);
  h += `<div class="small"><button onclick="UI.tableMode='cards';render()">Vue cartes</button></div>
 <div class="tw"><table class="t"><thead><tr>${opts.pre ? '<th></th>' : ''}<th>Coureur</th><th>Type</th><th>Gl.</th><th>Pot.</th>${STATS.map(k => `<th title="${STAT_LBL[k]}">${STAT_LBL[k].slice(0, 3)}</th>`).join('')}${opts.state ? '<th>Forme</th><th>Fat.</th><th>Moral</th>' : ''}${opts.cols ? opts.cols.map(c => `<th>${c[0]}</th>`).join('') : ''}</tr></thead><tbody>`;
  for (const r of rs) {
    h += `<tr class="${r.injury > 0 ? 'inj' : ''} ${opts.rowCls ? opts.rowCls(r) : ''}">${opts.pre ? `<td>${opts.pre(r)}</td>` : ''}<td>${rlink(r)} <span class="mut">${r.age}a</span>${r.injury > 0 ? ` <span class="badge r">blessé ${r.injury}s</span>` : ''}${r.wantsOut ? ' <span class="badge r">veut partir</span>' : ''}${r.nextTeam != null && r.team === 0 ? ' <span class="badge r">part</span>' : ''}${S.watch.includes(r.id) ? ' 👁' : ''}</td><td class="small">${ARCH[r.arch].lbl}</td><td><b>${svOv(r)}</b></td><td class="small">${stars(potEst(r))}</td>
  ${STATS.map(k => {
    const v = shownStat(r, k);
    return `<td class="${statCls(v)}">${isEst(r) ? '~' : ''}${v}</td>`;
  }).join('')}
  ${opts.state ? `<td>${bar(r.forme)}</td><td>${bar(100 - r.fatigue)}</td><td>${bar(r.moral)}</td>` : ''}${opts.cols ? opts.cols.map(c => `<td>${c[1](r)}</td>`).join('') : ''}</tr>`;
  }
  return h + `</tbody></table></div>`;
}
function trainSel(r) {
  let h = `<select onchange="setTraining(${r.id},this.value)">${Object.entries(TRAINING)
    .map(([k, l]) => `<option value="${k}" ${r.training === k ? 'selected' : ''}>${l}</option>`)
    .join('')}</select>`;
  if (r.training === 'pic') {
    h += ` <select onchange="setPeak(${r.id},this.value)"><option value="">objectif ?</option>${S.cal
      .filter(c => !c.done && c.w > S.week)
      .map(c => `<option value="${c.w}" ${r.peakW === c.w ? 'selected' : ''}>${esc(c.name)} (s${c.w})</option>`)
      .join('')}</select>`;
  }
  return h;
}
// Affiche la fenêtre modale courante (fiche, radio, confirmation).
function renderModal() {
  const m = UI.modal;
  const el = $('#modal');
  if (!m) {
    el.className = '';
    el.innerHTML = '';
    return;
  }
  let h = '';
  if (m.type === 'rider') h = riderCard(S.riders[m.id]);
  else if (m.type === 'team') h = teamCard(teamById(m.id));
  else if (m.type === 'nav') h = navSheet();
  else if (m.type === 'radio') h = radioCard(m.id);
  else if (m.type === 'msg')
    h = `<p>${m.text}</p><div class="row"><button class="pri" onclick="closeModal()">OK</button></div>`;
  else if (m.type === 'confirm')
    h = `<p>${m.text}</p><div class="row"><button onclick="closeModal()">Annuler</button><button class="pri" onclick="UI._cb&&UI._cb();">Confirmer</button></div>`;
  el.className = m.type === 'radio' || m.type === 'nav' ? 'on sheet' : 'on';
  el.innerHTML = `<div class="mbox" onclick="event.stopPropagation()">${h}</div>`;
}
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
// Liste de coureurs en cartes : les caractéristiques utiles au profil, l'état et les colonnes spécifiques.
// Jauge fine avec libellé et valeur (rouge sous 25).
function meterHTML(lbl, v, cls) {
  return `<div class="mtr"><span>${lbl}</span><div class="mtr-b"><i class="${cls} ${v < 25 ? 'low' : ''}" style="width:${clamp(v, 0, 100).toFixed(0)}%"></i></div><b>${Math.round(v)}</b></div>`;
}
function riderCards(rs, opts) {
  let h = `<div class="small"><button onclick="UI.tableMode='table';render()">Vue tableau complet</button></div>`;
  for (const r of rs) {
    const keys = [...new Set([...(PRIMARY[r.arch] || []), 'end', 'rec'])].slice(0, 5);
    h += `<div class="rcard ${r.injury > 0 ? 'inj' : ''} ${opts.rowCls ? opts.rowCls(r) : ''}"><div class="row sb"><span>${opts.pre ? opts.pre(r) + ' ' : ''}${rlink(r)} <span class="mut small">${r.age}a · ${ARCH[r.arch].lbl}</span>${r.injury > 0 ? ` <span class="badge r">blessé ${r.injury}s</span>` : ''}${r.wantsOut ? ' <span class="badge r">veut partir</span>' : ''}${r.nextTeam != null && r.team === 0 ? ' <span class="badge r">part</span>' : ''}${S.watch.includes(r.id) ? ' 👁' : ''}</span><span><b>${svOv(r)}</b> <span class="small">${stars(potEst(r))}</span></span></div>
  <div class="small">${keys
    .map(k => {
      const v = shownStat(r, k);
      return `${STAT_LBL[k]} <b class="${statCls(v)}">${isEst(r) ? '~' : ''}${v}</b>`;
    })
    .join(' · ')}</div>
  ${opts.state ? `<div class="rc2-m">${meterHTML('Forme', r.forme, 'mf')}${meterHTML('Fraîch.', 100 - r.fatigue, 'mj')}${meterHTML('Moral', r.moral, 'ma')}</div>` : ''}
  ${opts.cols ? `<div class="kvs small">${opts.cols.map(c => `<span>${c[0] ? `<span class="mut">${c[0]}</span> ` : ''}${c[1](r)}</span>`).join('')}</div>` : ''}</div>`;
  }
  return h;
}
