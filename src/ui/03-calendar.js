/* Interface — calendrier et sélection */
function stageIcons(spec) {
  return spec
    .map(
      ([t, d, v]) =>
        `<span class="ty ty-${t}" title="${typeLbl(t)} ${d} km">${{ plat: '▬', vallonne: v === 'dur' ? '≋' : v === 'longue' ? '〰' : '∿', punch: '⌒', montagne: '▲', sommet: '⛰', paves: v === 'monts' ? '⛰▦' : '▦', clm: '⏱', clmeq: '⏱⏱' }[t]}</span>`
    )
    .join('');
}
// Calendrier de la saison.
function viewCal() {
  const i = nextRaceIdx();
  let h = `<div class="tabs">${[
    ['cal', 'Calendrier'],
    ['plan', '📅 Planification'],
  ]
    .map(
      ([k, l]) =>
        `<button class="${(UI.calTab || 'cal') === k ? 'on' : ''}" onclick="UI.calTab='${k}';render()">${l}</button>`
    )
    .join('')}</div>`;
  if (UI.calTab === 'plan') return h + viewPlanner();
  // l'action du moment d'abord ; les courses passées sont repliées (bouton pour les afficher)
  const nDone = S.cal.filter(c => c.done).length;
  const showPast = UI.calPast || !nDone;
  h += `<div class="card next-act">${nextActionHTML()}</div>`;
  h += `<div class="card"><div class="row sb"><h2>Calendrier ${S.season}</h2>${nDone ? `<button class="small" onclick="UI.calPast=${!showPast};render()">${showPast ? 'Masquer' : 'Afficher'} les courses passées (${nDone})</button>` : ''}</div>`;
  // téléphone : une ligne par course (profil sous le nom) ; grand écran : tableau
  const nar = narrowScreen();
  if (!nar)
    h += `<div class="tw"><table class="t"><thead><tr><th>Sem.</th><th>Course</th><th>Profil</th><th>Vainqueur</th></tr></thead><tbody>`;
  const rows = S.cal.map((c, k) => ({
    past: c.done,
    w: c.w,
    html: (() => {
      const w = c.winner ? S.riders[c.winner] : null;
      const tag = c.worlds
        ? ' <span class="badge">🌈 sélections nationales</span>'
        : c.inv && !c.inv.includes(0)
          ? ' <span class="badge r">non invité</span>'
          : '';
      const meta = `${['Grand Tour', 'Cat. 1', 'Cat. 2'][c.cat]}${c.stagesSpec.length > 1 ? ' · ' + c.stagesSpec.length + ' ét.' : ''}`;
      const star = c.done
        ? ''
        : ` <button class="star" title="Course importante : l'adjoint s'arrête avant" onclick="toggleStar('${c.key}');save();render()">${isKeyRace(c) ? '★' : '☆'}</button>`;
      // atout de l'équipe pour cette course (meilleur coureur sur le terrain qui compte), courses à venir
      const fit = !c.done && !c.worlds && (!c.inv || c.inv.includes(0)) ? raceAsset(c) : null;
      const planned = S.plan && S.plan[c.key] ? S.plan[c.key].length : 0;
      const fitTxt = fit
        ? `<div class="small mut">Votre atout : <b>${esc(riderName(fit.r))}</b> (${fit.v})${planned ? ` · ${planned} prévus` : ''}</div>`
        : '';
      if (nar)
        return `<div class="cal-it ${k === i ? 'next' : ''} ${c.done ? 'done' : ''}"><span class="cw">${c.w}</span><div class="cm"><b>${esc(c.name)}</b>${star}${tag} <span class="mut small">${meta}</span><div class="cp">${stageIcons(c.stagesSpec)}</div>${fitTxt}${w ? `<div class="small">🏆 ${rlink(w)} <span class="mut">${tshort(w)}</span></div>` : ''}</div></div>`;
      return `<tr class="${k === i ? 'next' : ''} ${c.done ? 'done' : ''}"><td>${c.w}</td><td><b>${esc(c.name)}</b>${star}${c.worlds ? ' <span class="badge">🌈 sélections nationales</span>' : c.inv && !c.inv.includes(0) ? ' <span class="badge r">non invité</span>' : ''} <span class="mut small">${['Grand Tour', 'Cat. 1', 'Cat. 2'][c.cat]}${c.stagesSpec.length > 1 ? ' · ' + c.stagesSpec.length + ' ét.' : ''}</span></td><td class="wr">${stageIcons(c.stagesSpec)}</td><td>${w ? rlink(w) + ' <span class="mut small">' + tshort(w) + '</span>' : ''}</td></tr>`;
    })(),
  }));
  for (const e of ESP_CAL) {
    const w = e.w;
    rows.push({
      w: w + 0.5,
      past: w < S.week,
      html: nar
        ? `<div class="cal-it esp ${w < S.week ? 'done' : ''}"><span class="cw">${w}</span><div class="cm small">🎓 ${esc(e.name)} <span class="mut">(${isJun(e) ? 'juniors' : 'espoirs'})</span></div></div>`
        : `<tr class="esp ${w < S.week ? 'done' : ''}"><td>${w}</td><td class="small">🎓 ${esc(e.name)} <span class="mut">(${isJun(e) ? 'juniors' : 'espoirs'})</span></td><td class="wr">${stageIcons(e.st)}</td><td></td></tr>`,
    });
  }
  rows.sort((a, b) => a.w - b.w);
  h += rows
    .filter(r => showPast || !r.past)
    .map(r => r.html)
    .join('');
  if (!nar) h += `</tbody></table></div>`;
  h += `<p class="small mut">Chaque semaine : entraînement, forme, salaires, staff et sponsor (${fmtMoney(sponsorWeekly())}/sem.).</p></div><div class="card small mut">Légende : ▬ plat · ∿ vallonné · ≋ classique ardennaise · ⌒ arrivée en côte · ▲ montagne · ⛰ arrivée au sommet · ▦ pavés · ⏱ contre-la-montre</div>`;
  return h;
}
// Action principale du moment : reprendre la course, avancer, préparer, Mondiaux, fin de saison.
function nextActionHTML() {
  const i = nextRaceIdx();
  let h = '';
  if (S.rc && !S.rc.done) {
    h += `<p><button class="pri" onclick="go('race')">Reprendre la course en cours : ${esc(S.rc.name)}</button></p>`;
  } else if (i >= 0) {
    const c = S.cal[i];
    if (S.week < c.w)
      h += `<div class="acts"><button class="pri" onclick="advance()">⏩ Avancer jusqu'à la semaine ${c.w} <span>(${c.w - S.week} sem.)</span></button>${nextKeyRace(i) !== i && nextKeyRace(i) >= 0 ? `<button onclick="delegateUntilKey()">⏩ Confier à l'adjoint jusqu'à ${esc(S.cal[nextKeyRace(i)].name)} <span class="mut">(sem. ${S.cal[nextKeyRace(i)].w})</span></button>` : ''}</div>`;
    else if (c.worlds) h += worldsCard(i);
    else if (c.inv && !c.inv.includes(0))
      h += `<p class="warn">Votre équipe n'est pas invitée à ${esc(c.name)} (classement insuffisant).</p><p><button class="pri" onclick="skipRace(${i})">⏩ Simuler la course sans nous</button></p>`;
    else {
      const same = S.cal.filter(x => x.w === c.w && !x.done && x !== c);
      const nk = nextKeyRace(i);
      h += `<div class="acts"><button class="pri" onclick="prepRace(${i})">📋 Diriger la course</button><button onclick="delegateOne(${i})">🧑‍💼 Confier à l'adjoint</button></div>${!isKeyRace(c) && nk >= 0 && nk !== i ? `<div class="acts"><button onclick="delegateUntilKey()">⏩ Confier jusqu'à ${esc(S.cal[nk].name)} <span class="mut">(sem. ${S.cal[nk].w})</span></button></div>` : ''}<p class="small"><a class="lnk" onclick="skipRace(${i})">Déclarer forfait</a></p>${same.length ? `<p class="small warn">Même semaine : ${same.map(x => esc(x.name)).join(', ')} — un coureur ne peut pas courir les deux.</p>` : ''}${c.cat === 0 ? '<p class="small mut">Un forfait sur un Grand Tour déçoit fortement le sponsor.</p>' : ''}`;
    }
  } else {
    const ending = myRiders().filter(r => r.contract <= 1 && r.nextTeam == null);
    h += `<p>Saison terminée.</p>${ending.length ? `<p class="warn">⚠️ ${ending.length} coureur(s) en fin de contrat partiront : ${ending.map(r => rlink(r)).join(', ')}.</p>` : ''}${S.academy.some(id => S.riders[id].age >= 22) ? '<p class="warn">⚠️ Des espoirs de 22 ans quitteront l\'académie s\'ils ne passent pas pros.</p>' : ''}<p><button class="pri" onclick="doEndSeason()">Passer à la saison ${S.season + 1}</button></p>`;
  }
  return h;
}
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
// Mondiaux : vos coureurs retenus par leur sélectionneur et vos demandes de rôle.
function worldsCard(i) {
  const pv = worldsPreview(i);
  const wish = S.worldsWish && S.worldsWish.s === S.season ? S.worldsWish.w : {};
  let h = `<details class="info"><summary>ℹ️ Explications</summary><p class="small mut">Les Mondiaux se courent par sélections nationales : chaque sélectionneur retient ses meilleurs coureurs pour ce parcours. Vous pouvez demander un rôle pour vos coureurs retenus ; le rôle de leader n'est accordé qu'aux deux meilleurs de leur sélection.</p></details>`;
  h += pv.length
    ? `<div class="tw"><table class="t"><tbody>${pv
        .map(
          x =>
            `<tr><td>${rlink(S.riders[x.id])} ${flag(x.nat)}</td><td class="small mut">${x.rank}e de sa sélection</td><td><select onchange="setWorldsWish(${x.id},this.value);save()">${Object.entries(
              WORLDS_WISH
            )
              .map(([k, l]) => `<option value="${k}" ${(wish[x.id] || 'auto') === k ? 'selected' : ''}>${l}</option>`)
              .join('')}</select></td></tr>`
        )
        .join('')}</tbody></table></div>`
    : `<p class="small">Aucun de vos coureurs n'est retenu cette année.</p>`;
  return h + `<p><button class="pri" onclick="runWorldsUI(${i})">🌈 Lancer les Championnats du monde</button></p>`;
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
    UI.view = 'inbox';
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
// Sélection des coureurs pour une course.
function viewPrep() {
  const pr = UI.prep;
  const c = S.cal[pr.i];
  const n = raceSize(c);
  const used = (S.weekUsed && S.weekUsed[c.w]) || [];
  const rs = myRiders()
    .concat(acaRiders().filter(r => isStag(r)))
    .filter(r => !used.includes(r.id));
  const keys = [
    ...new Set(
      c.stagesSpec.map(([t]) =>
        t === 'plat'
          ? 'spr'
          : t === 'paves'
            ? 'pav'
            : t === 'clm'
              ? 'clm'
              : t === 'punch' || t === 'vallonne'
                ? 'col'
                : 'mon'
      )
    ),
  ];
  let h = `<div class="card"><h2>${esc(c.name)}</h2><div>${stageIcons(c.stagesSpec)} <span class="mut small">${c.stagesSpec.map(([t, d]) => typeLbl(t) + ' ' + d + 'km').join(' · ')}</span></div>
 ${rs.filter(r => r.injury <= 0).length < n ? `<p class="warn small">Effectif disponible insuffisant cette semaine : vous pouvez partir à ${Math.max(4, rs.filter(r => r.injury <= 0).length)} minimum.</p>` : ''}
 <p>Sélectionnez <b>${n}</b> coureurs (${pr.sel.length}/${n}).</p>
 ${narrowScreen() ? '' : `<div class="tw"><table class="t"><thead><tr><th></th><th>Coureur</th><th>Type</th>${keys.map(k => `<th>${STAT_LBL[k]}</th>`).join('')}<th>Plac.</th><th>End.</th><th>Forme</th><th>Fat.</th><th>Moral</th><th>Amb.</th></tr></thead><tbody>`}`;
  for (const r of rs.sort((a, b) => overall(b.s) - overall(a.s))) {
    const on = pr.sel.includes(r.id);
    const dis = r.injury > 0;
    const cb = `<input type="checkbox" ${on ? 'checked' : ''} ${dis ? 'disabled' : ''} onchange="togSel(${r.id})">`;
    if (narrowScreen()) {
      // carte : case à cocher, profil, caractéristiques utiles pour cette course et état du jour
      h += `<div class="rcard ${on ? 'sel' : ''} ${dis ? 'inj' : ''}"><div class="row sb"><label>${cb} ${rlink(r)}${r.aca ? ' <span class="badge">ACA</span>' : ''} <span class="small mut">${ARCH[r.arch].lbl}</span></label><span class="small">amb. ${r.amb}</span></div>
  <div class="small">${[...keys, 'plc', 'end'].map(k => `${STAT_LBL[k]} <b class="${statCls(r.s[k])}">${r.s[k]}</b>`).join(' · ')}</div>
  <div class="rgrid small"><span>Forme ${bar(r.forme)}</span><span>Fraîcheur ${bar(100 - r.fatigue)}</span><span>Moral ${bar(r.moral)}</span></div></div>`;
      continue;
    }
    h += `<tr class="${on ? 'sel' : ''} ${dis ? 'inj' : ''}"><td>${cb}</td><td>${rlink(r)}${r.aca ? ' <span class="badge">ACA</span>' : ''}</td><td class="small">${ARCH[r.arch].lbl}</td>${keys.map(k => `<td class="${statCls(r.s[k])}">${r.s[k]}</td>`).join('')}<td class="${statCls(r.s.plc)}">${r.s.plc}</td><td class="${statCls(r.s.end)}">${r.s.end}</td><td>${bar(r.forme)}</td><td>${bar(100 - r.fatigue)}</td><td>${bar(r.moral)}</td><td>${r.amb}</td></tr>`;
  }
  if (!narrowScreen()) h += `</tbody></table></div>`;
  if (reconUseful(c)) {
    const done = S.recon && S.recon[c.key] === S.season;
    h += `<div class="row sb small"><span>🗺️ Reconnaissance du parcours : ${done ? '<b>effectuée</b>' : `${fmtMoney(reconCost(c))}, +3 de fatigue pour les coureurs sélectionnés`}<br><span class="mut">Les coureurs reconnaissent les pièges (pavés, routes étroites, descentes) : moins de chutes et de cassures.</span></span>${done ? '' : `<button onclick="reconPrep()">Reconnaître</button>`}</div>`;
  }
  h += `<div class="row"><button onclick="go('cal')">Retour</button><button class="auto" onclick="autoSel()">🧑‍💼 Sélection auto</button><button class="pri" ${pr.sel.length > n || pr.sel.length < Math.min(n, Math.max(4, rs.filter(r => r.injury <= 0).length)) ? 'disabled' : ''} onclick="confirmSel()">Valider la sélection</button></div>
 <p class="small mut">Un coureur ambitieux non retenu pour une grande course peut perdre du moral.</p></div>`;
  return h;
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
// Voile de progression pendant une simulation (bloque les clics le temps du calcul).
function renderBusy() {
  const el = $('#busy');
  if (!el) return;
  const B = UI.busy;
  el.className = B ? 'on' : '';
  el.innerHTML = B
    ? `<div class="mbox"><b>⏳ ${esc(B.txt)}</b><div class="small mut">Étape ${Math.min(B.k + 1, B.n)} / ${B.n}</div>${bar((B.k / B.n) * 100)}${B.stop ? `<div class="row"><button onclick="UI.chain=null;this.disabled=true;this.textContent='Arrêt après cette course…'">Reprendre la main après cette course</button></div>` : ''}</div>`
    : '';
}

// Planificateur : jours de course par coureur, puis une carte par course à venir avec les coureurs prévus.
function viewPlanner() {
  S.plan = S.plan || {};
  const pros = myRiders()
    .slice()
    .sort((a, b) => overall(b.s) - overall(a.s));
  const cap = daysTarget();
  let h = `<div class="card"><div class="row sb"><h2>Programme de la saison</h2><span><button class="auto" onclick="UI.flash='🧑‍💼 '+autoPlanSeason();save();render()">🧑‍💼 Planifier auto</button> <button onclick="S.plan={};save();render()">Vider</button></span></div>
 <details class="info"><summary>ℹ️ Explications</summary><p class="small mut">Prévoyez qui court quoi : la sélection d'une course reprend ce programme. Objectif conseillé : environ ${cap} jours de course par coureur (60 % du calendrier). Un coureur ne peut pas courir deux courses la même semaine.</p></details>
 <table class="t"><tbody>${pros
   .map(r => {
     const d = plannedDays(r.id);
     return `<tr><td>${rlink(r)} <span class="small mut">${ARCH[r.arch].lbl}</span></td><td class="small">${d} j.</td><td style="width:40%">${bar(d, cap * 1.25, d > cap * 1.15 ? 'r' : d < cap * 0.6 ? 'y' : 'g')}</td></tr>`;
   })
   .join('')}</tbody></table></div>`;
  let shownN = 0;
  for (const c of S.cal) {
    if (c.done || c.worlds) continue;
    // les six prochaines courses dépliées, les suivantes repliées (une ligne chacune)
    shownN++;
    if (shownN === 7) h += `<details class="manage"><summary>Courses suivantes</summary>`;
    const inv = !c.inv || c.inv.includes(0);
    const sel = S.plan[c.key] || [];
    const n = raceSize(c);
    h += `<div class="card plan"><div class="row sb"><span><b>S${c.w} · ${esc(c.name)}</b> ${stageIcons(c.stagesSpec)}</span><span class="small ${sel.length === n ? '' : 'warn'}">${inv ? `${sel.length}/${n}` : 'non invité'}</span></div>`;
    if (inv) {
      // retenus, puis les mieux adaptés au parcours ; les autres coureurs sont repliés
      const chip = r => {
        const on = sel.includes(r.id),
          cf = on && planConflict(r.id, c);
        return `<button class="chip ${on ? 'on' : ''} ${cf ? 'cf' : ''}" title="adéquation ${Math.round(raceFit(r, c))}${cf ? ' · déjà engagé ailleurs cette semaine' : ''}" onclick="planToggle('${c.key}',${r.id});save();render()">${esc(riderName(r))} <span class="small">${Math.round(raceFit(r, c))}</span></button>`;
      };
      const byFit = pros.slice().sort((a, b) => raceFit(b, c) - raceFit(a, c));
      const on = byFit.filter(r => sel.includes(r.id));
      const off = byFit.filter(r => !sel.includes(r.id));
      h += `<div class="chips">${on.map(chip).join('')}</div>${off.length ? `<div class="small mut" style="margin-top:6px">Les mieux adaptés au parcours :</div><div class="chips">${off.slice(0, 6).map(chip).join('')}</div>` : ''}${off.length > 6 ? `<details class="manage"><summary>Les ${off.length - 6} autres</summary><div class="chips">${off.slice(6).map(chip).join('')}</div></details>` : ''}`;
    }
    h += `</div>`;
  }
  if (shownN >= 7) h += `</details>`;
  return h;
}
