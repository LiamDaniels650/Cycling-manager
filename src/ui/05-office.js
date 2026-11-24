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
// Rapport « Signaler » : le commentaire du joueur, le moment (course, km), l'étape en cours ou la dernière finie
// (état au départ et ordres donnés : rejouable à l'identique par tools/replay.js), sinon l'état actuel, et la fin
// du journal de partie. Proposé au téléchargement (repli : copie dans le presse-papiers).
function reportBuild(comment) {
  const sim = UI.sim;
  const live = !!(sim && UI.rec);
  const R = live ? { ...UI.rec, inputs: sim.rec || [], t: sim.t } : UI.lastRec || null;
  const G0 = live && sim.groups.length ? sim.groups[0] : null;
  journalAdd('signal', String(comment || '').slice(0, 400), live ? { km: G0 ? Math.round(G0.pos) : 0 } : null);
  return {
    kind: 'dsc-rapport',
    v: 1,
    at: new Date().toISOString(),
    comment: String(comment || ''),
    season: S.season,
    week: S.week,
    view: UI.view,
    // le moment signalé : en course, l'instant et le km de la tête ; sinon la fin de la dernière étape
    race: R ? { name: R.name, si: R.si, t: R.t, km: G0 ? Math.round(G0.pos * 10) / 10 : null, live } : null,
    stage: R ? { snap: R.snap, autoDS: R.autoDS, inputs: R.inputs } : null,
    // de quoi vérifier que le rejeu reproduit bien la partie : groupes à l'instant signalé, ou résultat de l'étape
    check: live ? { t: sim.t, groups: simCheck(sim) } : R ? { res: R.res } : null,
    state: R ? null : saveText(),
    journal: (S.journal || []).slice(-80),
  };
}
async function reportExport(comment) {
  const t = JSON.stringify(reportBuild(comment));
  save();
  const filename = `signalement-${S.season}-sem${S.week}-${Date.now() % 100000}.json`;
  try {
    const cl = /** @type {any} */ (window).claude;
    const dl = cl && cl.use ? await cl.use('downloads') : null;
    if (!dl) throw new Error('indisponible');
    await dl.save({ filename, data: t });
    UI.flash = '🚩 Signalement enregistré : envoyez ce fichier pour que la situation soit rejouée et corrigée.';
  } catch (e) {
    try {
      await navigator.clipboard.writeText(t);
      UI.flash = '🚩 Signalement copié dans le presse-papiers (le téléchargement est indisponible ici).';
    } catch (e2) {
      UI.flash = '⚠️ Signalement impossible à exporter ici.';
    }
  }
  render();
}
// Le journal de partie seul (texte lisible).
function journalText() {
  return (S.journal || []).map(e => `${e.s} sem. ${e.w} · ${e.txt}`).join('\n');
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
