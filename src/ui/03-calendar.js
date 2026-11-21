// Prochaine course importante (où le joueur reprend la main), à partir de l'indice i.
function nextKeyRace(i) {
  for (let k = i; k < S.cal.length; k++) if (!S.cal[k].done && isKeyRace(S.cal[k])) return k;
  return -1;
}
// Une course confiée à l'adjoint.
function delegateOne(i, after) {
  const c = S.cal[i];
  simulateRaceAsync(
    i,
    () => {
      save();
      const mine = c.done && c.winner != null && S.riders[c.winner].team === 0;
      UI.flash = `🧑‍💼 ${c.name} dirigée par l'adjoint : victoire de ${c.winner != null ? riderName(S.riders[c.winner]) : '—'}${mine ? ' 🎉' : ''}.`;
      if (after) after();
      else render();
    },
    true
  );
}
// Enchaîne les courses (et les semaines) en les confiant à l'adjoint jusqu'à la prochaine course importante.
function delegateUntilKey() {
  UI.chain = { n: 0, wins: 0 };
  const step = () => {
    const ch = UI.chain;
    const i = nextRaceIdx();
    const stop = msgTxt => {
      UI.chain = null;
      UI.flash = `🧑‍💼 L'adjoint a dirigé ${ch ? ch.n : 0} course(s)${ch && ch.wins ? `, ${ch.wins} victoire(s)` : ''}. ${msgTxt}`;
      save();
      render();
    };
    if (!ch) return stop('Vous reprenez la main.');
    if (i < 0) return stop('La saison est terminée.');
    const c = S.cal[i];
    if (S.week < c.w) advanceToNextRace();
    if (isKeyRace(c) || c.worlds) {
      UI.chain = null;
      UI.flash = `🧑‍💼 L'adjoint a dirigé ${ch.n} course(s)${ch.wins ? `, ${ch.wins} victoire(s)` : ''}. À vous : ${c.name}.`;
      save();
      UI.view = 'cal';
      return render();
    }
    if (c.inv && !c.inv.includes(0)) return simulateRaceAsync(i, () => setTimeout(step, 0));
    const w0 = seasonWins(0);
    delegateOne(i, () => {
      ch.n++;
      ch.wins += seasonWins(0) - w0;
      setTimeout(step, 0);
    });
  };
  step();
}
function skipRace(i) {
  const c = S.cal[i];
  confirmBox(`Simuler ${esc(c.name)} sans votre équipe ?`, () => {
    if (c.cat === 0 && (!c.inv || c.inv.includes(0))) S.conf = Math.max(0, S.conf - 8);
    simulateRaceAsync(i, () => {
      save();
      UI.flash = `${c.name} : victoire de ${riderName(S.riders[c.winner])}.`;
      render();
    });
  });
}
function runWorldsUI(i) {
  UI.busy = { txt: 'Simulation : ' + S.cal[i].name, k: 0, n: 1 };
  renderBusy();
  setTimeout(() => {
    const rc = runWorlds(i);
    UI.busy = null;
    renderBusy();
    save();
    const w = S.riders[rc.stageRes[0].res[0].id];
    UI.flash = `🌈 ${riderName(w)} (${NAT_NAME[w.nat] || w.nat}) est champion du monde. Bilan dans la messagerie.`;
    render();
  }, 0);
}
function advance() {
  advanceToNextRace();
  save();
  UI.flash = `Semaine ${S.week}. Les coureurs se sont entraînés.`;
  render();
}
function doEndSeason() {
  confirmBox(`Clôturer la saison ${S.season} ?`, () => {
    advanceToNextRace();
    idbBackup(); // copie de sécurité avant de tourner la page
    endSeason();
    save();
    // le bilan de la saison : chiffres, objectifs, mes arrivées, bilan individuel, film
    UI.stats = 'review';
    UI.view = 'stats';
    render();
  });
}
// Sélection proposée par l'adjoint, adaptée au profil des étapes.
function autoSelFor(c) {
  return aiSelect(
    P(),
    c,
    c.stagesSpec.map(([type, dist]) => ({ type, dist, segs: [] }))
  ).slice();
}
function autoSel() {
  UI.prep.sel = autoSelFor(S.cal[UI.prep.i]);
  UI.flash = `🧑‍💼 Sélection proposée : ${UI.prep.sel.map(id => riderName(S.riders[id])).join(', ')}.`;
  render();
}
function prepRace(i) {
  const c = S.cal[i];
  UI.prep = { i, sel: planSelection(c, autoSelFor(c)) };
  UI.view = 'prep';
  render();
}
function reconPrep() {
  if (!UI.prep.sel.length) {
    UI.flash = "Sélectionnez d'abord les coureurs qui iront reconnaître le parcours.";
    render();
    return;
  }
  UI.flash = doRecon(UI.prep.i, UI.prep.sel);
  save();
  render();
}
function togSel(id) {
  const s = UI.prep.sel;
  const i = s.indexOf(id);
  if (i >= 0) s.splice(i, 1);
  else s.push(id);
  render();
}
function confirmSel() {
  const pr = UI.prep;
  startRace(pr.i, pr.sel);
  Object.assign(S.rc.orders, autoOrders(0, S.rc.specs[0], S.rc));
  save();
  UI.prep = null;
  UI.sim = null;
  UI.lastStage = null;
  UI.view = 'race';
  render();
}

// Simulation d'une course sans le joueur, étape par étape : l'écran reste vivant et affiche la progression.
// Simulation d'une course sans le joueur dans un processus séparé du navigateur (Web Worker) : l'écran reste
// fluide et le calcul ne bloque rien. Le moteur y est chargé depuis le script de la page ; le résultat est
// identique à un calcul direct (même série de hasard). En cas d'indisponibilité, calcul par étapes ici même.
let SIM_WORKER = null;
function simWorker() {
  if (SIM_WORKER !== null) return SIM_WORKER || null;
  try {
    const src = (document.getElementById('engine') || {}).textContent || '';
    if (!src || typeof Worker === 'undefined' || typeof Blob === 'undefined') throw new Error('indisponible');
    const glue = `
onmessage = e => {
  const d = e.data;
  try {
    S = d.state; _sd = d.sd;
    if (d.delegate) {
      // course confiée à l'adjoint : même déroulé, avec la progression étape par étape
      const rs = runStageAuto;
      runStageAuto = r => { const o = rs(r); postMessage({ k: r.si, n: r.specs.length }); return o; };
      runDelegatedRace(d.i);
      runStageAuto = rs;
    } else {
      const rc = startRace(d.i, []);
      while (!rc.done) { runStageAuto(rc); postMessage({ k: rc.si, n: rc.specs.length }); }
    }
    S.rc = null;
    postMessage({ done: true, state: S, sd: _sd });
  } catch (err) { postMessage({ error: String(err && err.message || err) }); }
};`;
    SIM_WORKER = new Worker(URL.createObjectURL(new Blob([src, glue], { type: 'text/javascript' })));
  } catch (e) {
    SIM_WORKER = false;
  }
  return SIM_WORKER || null;
}
function simulateRaceAsync(i, done, delegate) {
  const w = UI.noWorker ? null : simWorker();
  if (!w) return simulateRaceSteps(i, done, delegate);
  const name = S.cal[i].name;
  UI.busy = {
    txt: `${delegate ? '🧑‍💼 L’adjoint dirige' : 'Simulation'} : ${name}`,
    k: 0,
    n: S.cal[i].stagesSpec.length,
    stop: !!UI.chain,
  };
  renderBusy();
  w.onmessage = e => {
    const d = e.data;
    if (d.error) {
      // repli : calcul ici même (l'état n'a pas été modifié)
      UI.noWorker = true;
      UI.busy = null;
      return simulateRaceSteps(i, done, delegate);
    }
    if (!d.done) {
      UI.busy.k = d.k;
      renderBusy();
      return;
    }
    S = d.state;
    _sd = d.sd;
    UI.busy = null;
    renderBusy();
    done(null);
  };
  w.onerror = () => {
    UI.noWorker = true;
    UI.busy = null;
    simulateRaceSteps(i, done, delegate);
  };
  w.postMessage({ state: S, sd: _sd, i, delegate: !!delegate });
}
// Calcul par étapes sur la page (repli sans Worker) : une étape par tour de boucle, l'écran se met à jour entre deux.
function simulateRaceSteps(i, done, delegate) {
  if (delegate) {
    // repli sans Worker : la course confiée est calculée d'un bloc
    const rc = runDelegatedRace(i);
    return setTimeout(() => done(rc), 0);
  }
  const rc = startRace(i, []);
  UI.busy = { txt: `Simulation : ${S.cal[i].name}`, k: 0, n: rc.specs.length };
  renderBusy();
  const step = () => {
    if (rc.done) {
      S.rc = null;
      UI.busy = null;
      renderBusy();
      done(rc);
      return;
    }
    runStageAuto(rc);
    UI.busy.k++;
    renderBusy();
    setTimeout(step, 0);
  };
  setTimeout(step, 0);
}
function renderBusy() {}
