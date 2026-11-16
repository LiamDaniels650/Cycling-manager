// Mode carrière : enchaînement des semaines (courses pros du monde dans le Web Worker, courses du joueur,
// semaine, fin de saison) et départ / arrivée des courses du joueur. Interface : appelle le moteur (41-44).

// Courses pros de la semaine, une par une (dans le Web Worker quand c'est possible).
function runProRaces(list, done) {
  if (!list.length) return done();
  const i = list.shift();
  const c = S.cal[i];
  if (!c || c.done) return runProRaces(list, done);
  if (c.worlds) {
    runWorlds(i);
    return runProRaces(list, done);
  }
  simulateRaceAsync(i, () => runProRaces(list, done), !!(c.inv && c.inv.includes(0)));
}
// Course du joueur à disputer cette semaine : d'abord une course pro (stagiaire ou pro), sinon une course de
// jeunes (pas encore courue, pas sautée, pas blessé). { pro: indice } ou { def }.
export function carPending() {
  if (carMe().injury > 0) return null;
  const i = carProThisWeek();
  if (i >= 0) return { pro: i, name: S.cal[i].name, st: S.cal[i].stagesSpec };
  const d = carRaceThisWeek();
  if (!d) return null;
  const k = carRaceKey(d);
  return S.car.raced[k] || S.car.skip[k] ? null : { def: d, name: d.name, st: d.st };
}
export function carNextWeek() {
  if (UI.carBusy || UI.busy) return;
  if (carPending()) {
    UI.view = 'race';
    render();
    return;
  }
  UI.carBusy = true;
  const todo = S.cal
    .map((c, i) => [c, i])
    .filter(([c]) => !c.done && c.w <= S.week)
    .map(x => x[1]);
  runProRaces(todo, () => {
    const d = carRaceThisWeek();
    if (d && !S.car.raced[carRaceKey(d)]) {
      S.car.raced[carRaceKey(d)] = true;
      if (carMe().injury > 0) carFeed(`🩹 ${d.name}`, 'Blessé, tu regardes la course depuis chez toi.');
    }
    weeklyUpdate();
    carWeekly();
    let txt = `Semaine ${S.week}.`;
    if (S.week >= LAST_WEEK && S.cal.every(c => c.done)) {
      const s0 = S.season;
      carEndSeason();
      idbBackup();
      endSeason();
      carNewSeason();
      S.inbox = S.inbox.slice(0, 40); // (boîte de l'équipe 0 du monde, sans lecteur en mode carrière)
      txt = `🎉 Nouvelle saison ${S.season} (fin de ${s0}) : ${carMe().age} ans.`;
    }
    UI.carBusy = false;
    UI.flash = txt;
    save();
    render();
    window.scrollTo(0, 0);
  });
}
function endFlash(rec) {
  if (!rec) return null;
  return rec.rank === 1
    ? `🏆 Tu gagnes ${rec.name} !`
    : `🏁 ${rec.name} : ${rec.rank ? rec.rank + 'e sur ' + rec.n : 'abandon'}.`;
}
// Départ d'une course : en direct (écran de course) ou simulée d'un bloc.
export function carRace(live) {
  const p = carPending();
  if (!p) return;
  if (!live) {
    const rec = p.pro != null ? carProSim(p.pro) : carSimRace(p.def);
    if (!rec && p.def) carNotSelected(p.def);
    UI.view = 'home';
    UI.flash = rec ? endFlash(rec) : `${p.name} : non retenu.`;
    save();
    render();
    return;
  }
  const pre = JSON.stringify({ S, sd: _sd, rid: _rid });
  const rc = p.pro != null ? carProStart(p.pro) : carStartRace(p.def);
  if (!rc) {
    carNotSelected(p.def);
    UI.flash = `🌍 ${p.name} : le sélectionneur ne t'a pas retenu.`;
    UI.view = 'home';
    save();
    render();
    return;
  }
  UI.carPre = pre; // sauvegarde de secours : une course interrompue reprend au départ
  UI.lastStage = null;
  UI.autoDS = true; // les équipiers suivent leur directeur sportif ; le joueur pilote son coureur
  UI.view = 'race';
  render();
}
export function carSkip() {
  const p = carPending();
  if (!p) return;
  S.car.skip[S.season + ':' + (p.pro != null ? S.cal[p.pro].key : p.def.key)] = true;
  carFeed(
    `⏭️ ${p.name}`,
    p.pro != null
      ? 'Tu demandes au directeur sportif de souffler : un autre prend ta place.'
      : 'Tu fais l’impasse sur cette course pour souffler.'
  );
  UI.view = 'home';
  save();
  render();
}
// Étape suivante : consignes recalculées pour le terrain du jour.
export function carNextStage() {
  UI.lastStage = null;
  if (S.rc.carPro) carProStageOrders(S.rc);
  else carOrders(S.rc);
  render();
  window.scrollTo(0, 0);
}
// Fin de la course : bilan (et, pour une course de jeunes, le monde retrouve ses équipes).
export function carEndRace() {
  const rec = S.rc && S.rc.carPro ? carProAfter(S.rc) : carFinishRace();
  UI.carPre = null;
  UI.lastStage = null;
  UI.sim = null;
  UI.view = 'home';
  UI.flash = endFlash(rec);
  save();
  render();
  window.scrollTo(0, 0);
}
export function carAnswerUI(key, opt) {
  const res = carAnswer(key, opt);
  UI.flash = res ? esc(String(res).replace(/<[^>]+>/g, '')) : 'Décision prise.';
  save();
  render();
}
