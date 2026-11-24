function staff(k, d) {
  const e = setStaff(k, S.staff[k] + d);
  save();
  if (e) UI.flash = e;
  render();
}
// Téléchargement d'un fichier de sauvegarde (repli : copie du texte si le navigateur l'interdit).
// (dans la page publiée, par le service de téléchargement de Claude, qui demande confirmation au joueur)
async function dlSave() {
  const t = saveText();
  const filename = `directeur-sportif-${S.season}-sem${S.week}.json`;
  try {
    const cl = /** @type {any} */ (window).claude;
    const dl = cl && cl.use ? await cl.use('downloads') : null;
    if (!dl) throw new Error('indisponible');
    await dl.save({ filename, data: t });
    S.lastExport = { season: S.season, week: S.week };
    save();
    UI.flash = '💾 Fichier de sauvegarde proposé au téléchargement.';
  } catch (e) {
    UI.flash = 'Téléchargement impossible ici : utilisez « Copier la sauvegarde ».';
  }
  render();
}
// Dernier fichier de sauvegarde téléchargé (copie hors du navigateur).
function exportStatus() {
  const e = S.lastExport;
  if (!e)
    return '⚠️ Aucun fichier de sauvegarde téléchargé : en cas de nettoyage du navigateur, la partie serait perdue.';
  const ago = (S.season - e.season) * 52 + (S.week - e.week);
  return `Dernier fichier téléchargé : ${e.season}, semaine ${e.week}${ago > 26 ? ' — pensez à en refaire un' : ''}.`;
}
// Import d'un fichier de sauvegarde choisi sur l'appareil.
function importFile(inp) {
  const f = inp.files && inp.files[0];
  if (!f) return;
  f.text().then(t => {
    if (importSave(t)) {
      save();
      UI.view = 'home';
      UI.sim = null;
      UI.flash = 'Partie chargée depuis le fichier.';
      render();
    } else alertBox('Ce fichier n’est pas une sauvegarde valide : la partie en cours est conservée.');
  });
}
// Copies de sécurité de début de saison, affichées dans les options.
function showBackups() {
  idbBackups().then(keys => {
    const el = $('#bkp');
    if (!el) return;
    el.innerHTML = keys.length
      ? `Copies de sécurité (avant chaque fin de saison) : ${keys
          .map(
            k =>
              `<button onclick="confirmBox('Revenir à la copie ${k.replace('saison-', 'de fin de saison ')} ? La partie actuelle sera remplacée.',()=>idbRestore('${k}').then(ok=>{save();UI.flash=ok?'Copie restaurée.':'Copie illisible.';UI.view='home';render();}))">${k.replace('saison-', 'Fin ')}</button>`
          )
          .join(' ')}`
      : '<span class="mut">Une copie de sécurité est faite automatiquement à chaque fin de saison.</span>';
  });
}

function doAnswer(k) {
  const t = answerPress(k);
  save();
  if (t) UI.flash = t;
  render();
}

// Équipementiers : matériel actuel, effets, offres pour la saison prochaine.
function eqTraits(cat, b) {
  const pct = v => Math.round(v * 100);
  if (cat === 'bike')
    return `aéro ${pct(b.aero)} · légèreté ${pct(b.leger)} · confort ${pct(b.confort)} · robustesse ${pct(b.robuste)}`;
  if (cat === 'tt') return `aérodynamisme ${pct(b.aero)}`;
  return EQ_CATS[cat].keys.map(k => `${EQ_TRAIT_LBL[k]} ${pct(b[k])}`).join(' · ');
}
function doEqNego(cat, k, mode) {
  if (!mode) return;
  UI.flash = eqNegotiate(cat, k, mode);
  save();
  render();
}
function doEq(cat, k) {
  UI.flash = chooseEq(cat, k);
  save();
  render();
}
function doJob(tid) {
  confirmBox('Quitter votre équipe pour celle-ci ?', () => {
    UI.flash = acceptJob(tid);
    save();
    UI.view = 'home';
    render();
  });
}
function doDecline() {
  UI.flash = declineJobs();
  save();
  render();
}

// Bouton « Auto » ponctuel : exécute une décision de l'adjoint et affiche ce qu'il a fait.
function doAsst(k) {
  const t = ASST_FN[k]();
  save();
  UI.flash = '🧑‍💼 ' + (t || "Rien à faire pour l'instant.");
  render();
}
