/* Interface — course : écran de course, profil, briefing (consignes, plan, matériel), départ d'étape */
function viewRace() {
  const rc = S.rc;
  if (!rc) return `<div class="card">Aucune course en cours.</div>`;
  if (UI.sim) return viewLive();
  if (UI.lastStage) return viewStageResult();
  return viewBriefing();
}
// Profil de l'étape en SVG (position des groupes en direct).
function profileSVG(spec, Pf, sim, frac = 1) {
  const W = 640,
    H = 130,
    pad = 14;
  const n = Pf.n;
  let mn = 1e9,
    mx = -1e9;
  for (let i = 0; i < n; i++) {
    mn = Math.min(mn, Pf.alt[i]);
    mx = Math.max(mx, Pf.alt[i]);
  }
  const rng = Math.max(400, mx - mn);
  const X = km => pad + (km / spec.dist) * (W - 2 * pad),
    Y = a => H - 18 - ((a - mn) / rng) * (H - 40);
  const step = Math.max(1, Math.floor(n / 320));
  let pts = `${X(0)},${H - 18} `;
  for (let i = 0; i < n; i += step) {
    pts += `${X(i * STEP).toFixed(1)},${Y(Pf.alt[i]).toFixed(1)} `;
  }
  pts += `${X(spec.dist)},${Y(Pf.alt[n - 1])} ${X(spec.dist)},${H - 18}`;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="prof"><polygon points="${pts}" class="pf"/>`;
  if (Pf.wind) {
    let k = 0;
    while (k < n) {
      if (Pf.expo[k]) {
        let j = k;
        while (j < n && Pf.expo[j]) j++;
        s += `<line x1="${X(k * STEP)}" x2="${X(j * STEP)}" y1="${H - 11}" y2="${H - 11}" class="wd"/>`;
        k = j;
      } else k++;
    }
  }
  if (Pf.narrow) {
    let k = 0;
    while (k < n) {
      if (Pf.narrow[k]) {
        let j = k;
        while (j < n && Pf.narrow[j]) j++;
        s += `<line x1="${X(k * STEP)}" x2="${X(j * STEP)}" y1="${H - 7}" y2="${H - 7}" class="nr"/>`;
        k = j;
      } else k++;
    }
  }
  for (const sc of Pf.sectors)
    s += `<line x1="${X(sc.start)}" x2="${X(sc.end)}" y1="${H - 15}" y2="${H - 15}" class="pv"/>`;
  for (const c of Pf.climbs) {
    const x = X(c.end),
      y = Y(Pf.alt[Math.min(n - 1, Math.round(c.end / STEP))]);
    s += `<text x="${x}" y="${y - 5}" class="ct">${c.cat}</text>`;
  }
  if (spec.isp && spec.type !== 'clm' && S.rc && S.rc.specs.length > 1)
    s += `<text x="${X(Math.round(spec.dist * spec.isp))}" y="${H - 20}" class="isp">S</text>`;
  for (let k = 0; k <= spec.dist; k += spec.dist > 100 ? 50 : 10)
    s += `<text x="${X(k)}" y="${H - 1}" class="kt">${k}</text>`;
  s += `<line x1="${X(spec.dist)}" x2="${X(spec.dist)}" y1="10" y2="${H - 18}" class="fl"/>`;
  if (sim) {
    sim.groups.slice(0, 8).forEach((G, i) => {
      const gp = ipos(G, frac);
      const x = X(Math.min(gp, spec.dist)),
        y = Y(Pf.alt[clamp(Math.floor(gp / STEP), 0, n - 1)]);
      const mine = G.riders.some(x => x.player);
      s += `<circle cx="${x}" cy="${y}" r="${G.riders.length > 20 ? 7 : 4.5}" class="${mine ? 'gm' : 'gg'}"/>`;
      if (i < 4) s += `<text x="${x + 6}" y="${y - 8}" class="gt">${G.riders.length}</text>`;
    });
  }
  return s + '</svg>';
}
function climbsTable(Pf) {
  const parts = Pf.climbs.map(
    c =>
      `<span class="chip">${esc(c.name)} · cat. ${c.cat} · ${c.len} km à ${c.avg}% · sommet km ${c.end.toFixed(0)}</span>`
  );
  const nN = Pf.narrow ? Pf.narrow.reduce((a, v, i) => a + (v && !Pf.narrow[i - 1] ? 1 : 0), 0) : 0;
  if (nN) parts.push(`<span class="chip">🛣️ ${nN} passage(s) en route étroite : soyez placés</span>`);
  if (Pf.sectors.length)
    parts.push(
      `<span class="chip">${Pf.sectors.length} secteurs pavés (${Pf.sectors.reduce((a, b) => a + b.end - b.start, 0).toFixed(1)} km)</span>`
    );
  if (Pf.wind && Pf.expoKm > 3)
    parts.push(
      `<span class="chip wdc">🌬️ vent ${['', 'modéré', 'fort', 'violent'][Pf.wind]} · ${Pf.expoKm.toFixed(0)} km exposés (bordures possibles)</span>`
    );
  if (Pf.spec && Pf.spec.wx && Pf.spec.wx !== 'sec') parts.push(`<span class="chip">${WX[Pf.spec.wx]}</span>`);
  return parts.length
    ? `<p class="small">${parts.join(' ')}</p>`
    : '<p class="small mut">Aucune difficulté répertoriée.</p>';
}
// Briefing d'avant étape : consignes, plan de course, ordres conditionnels.
// Carte météo et matériel du jour : roues et pneus choisis pour l'étape, avec la recommandation du mécano.
function gearCard(rc, spec) {
  const cur = gearFor({ player: true }, rc, spec);
  const rec = autoGear(spec);
  const sel = (k, set) =>
    `<select onchange="setGear('${k}',this.value);render()">${Object.entries(set)
      .map(
        ([v, g]) =>
          `<option value="${v}" ${cur[k] === v ? 'selected' : ''}>${g.lbl}${rec[k] === v ? ' ★' : ''}</option>`
      )
      .join('')}</select>`;
  const wind = spec.wind >= 3 ? '💨 vent fort' : spec.wind >= 2 ? '🌬️ vent modéré' : 'vent faible';
  const itt = isITT(spec) || isTTT(spec);
  const fp = feedPlanFor(rc, spec),
    frec = autoFeed(spec);
  const feed = itt
    ? ''
    : `<div class="row" style="margin-top:6px">🍌 Ravitaillement : <select onchange="setFeed(this.value);save();render()">${Object.entries(
        FEED_PLANS
      )
        .map(
          ([v, f]) => `<option value="${v}" ${fp === v ? 'selected' : ''}>${f.lbl}${frec === v ? ' ★' : ''}</option>`
        )
        .join(
          ''
        )}</select></div><div class="small mut">${FEED_PLANS[fp].d}. Chaque coureur a aussi deux barres en poche (radio « Mange maintenant »).</div>`;
  return `<div class="card"><div class="row sb"><h3>🌦️ Météo, matériel et ravitaillement</h3><button class="auto" onclick="gearAuto()">🧑‍💼 Conseils auto</button></div>
 <div class="small">${WX[spec.wx || 'sec']} · ${wind} · régime ${WX_REGIME[regimeAt(S.cal[rc.calIdx].w)]}${reconDone(rc) ? ' · <span class="badge">🗺️ parcours reconnu</span>' : ''}</div>
 <div class="row" style="margin-top:6px">${sel('wheels', GEAR.wheels)} ${sel('tyres', GEAR.tyres)}</div>
 <div class="small mut">${GEAR.wheels[cur.wheels].d} · ${GEAR.tyres[cur.tyres].d}</div>
 <div class="small mut">★ conseil du staff : ${GEAR.wheels[rec.wheels].lbl.toLowerCase()}, ${GEAR.tyres[rec.tyres].lbl.toLowerCase()}${itt ? '' : `, ravitaillement ${FEED_PLANS[frec].lbl.toLowerCase()}`}.</div>${feed}</div>`;
}
// Bouton auto : matériel et ravitaillement conseillés pour l'étape.
function gearAuto() {
  const rc = S.rc,
    spec = rc.specs[rc.si];
  const g = autoGear(spec);
  setGear('wheels', g.wheels);
  setGear('tyres', g.tyres);
  setFeed(autoFeed(spec));
  UI.flash = '🧑‍💼 Matériel et ravitaillement réglés selon les conseils du staff.';
  save();
  render();
}
function viewBriefing() {
  const rc = S.rc;
  const spec = rc.specs[rc.si];
  const Pf = buildProfile(spec);
  Pf.spec = spec;
  const ids = rc.sel[0].filter(id => !rc.out[id]);
  const ttt = isTTT(spec);
  const itt = isITT(spec) || ttt;
  let h = `<div class="card"><h2>${esc(rc.name)}</h2><div class="mut">${esc(spec.name)}</div>${profileSVG(spec, Pf)}${climbsTable(Pf)}</div>`;
  h += stageKeysHTML(rc, spec, Pf);
  h += `<div class="card row sb"><span class="small">Pressé ? L'adjoint règle tout pour cette étape : consignes, plan de course, matériel et ravitaillement.</span><button class="auto" onclick="briefAuto()">🧑‍💼 Tout régler en auto</button></div>`;
  h += S.simple
    ? `<details class="manage card"><summary>⚙️ Météo, matériel et ravitaillement — réglés par l'adjoint</summary>${gearCard(rc, spec)}</details>`
    : gearCard(rc, spec);
  h += `<div class="card"><div class="row sb"><h3>Consignes d'avant-course</h3><button class="auto" onclick="autoMine()">🧑‍💼 Consignes auto</button></div><div class="tw"><table class="t"><thead><tr><th>Coureur</th><th>Énergie</th><th>Forme</th><th>Consigne</th>${itt ? '' : "<th>Plan d'attaque</th>"}<th>Obéis.</th></tr></thead><tbody>`;
  for (const id of ids) {
    const r = S.riders[id];
    const o = rc.orders[id] || { o: 'protect' };
    const ob = Math.round(
      clamp(
        0.62 +
          (r.dis / 100) * 0.4 +
          (r.moral - 55) / 300 -
          (r.amb / 100) * 0.18 +
          (r.trait === 'modele' ? 0.3 : 0) -
          (r.trait === 'leaderne' ? 0.12 : 0),
        0.3,
        0.99
      ) * 100
    );
    h += `<tr><td>${rlink(r)} <span class="small mut">${ARCH[r.arch].lbl}</span></td><td>${bar(rc.energy[id])}</td><td>${bar(r.forme)}</td>`;
    if (ttt) h += `<td class="small mut">${rc.tttLeader === id ? '⭐ leader du chrono' : 'rouleur'}</td>`;
    else if (itt)
      h += `<td><select onchange="setOrd(${id},'itt',this.value)"><option value="fond" ${o.itt === 'fond' ? 'selected' : ''}>À bloc</option><option value="gerer" ${o.itt !== 'fond' ? 'selected' : ''}>Gérer (économiser)</option></select></td>`;
    else {
      h += `<td><select onchange="setOrd(${id},'o',this.value)">${Object.entries(ORDERS)
        .map(([k, v]) => `<option value="${k}" ${o.o === k ? 'selected' : ''}>${v.lbl}</option>`)
        .join('')}</select></td>`;
      h += `<td>${
        o.o === 'leader' || o.o === 'free'
          ? `<select onchange="setOrd(${id},'att',this.value)">${Object.entries(ATT)
              .map(([k, v]) => `<option value="${k}" ${(o.att || 'final') === k ? 'selected' : ''}>${v}</option>`)
              .join('')}</select>`
          : '<span class="mut">—</span>'
      }</td>`;
    }
    h += `<td class="${ob > 85 ? 's4' : ob > 70 ? 's3' : 's1'}" title="Probabilité estimée de respecter une consigne d'équipier">${ob}%</td></tr>`;
  }
  h += `</tbody></table></div>`;
  if (ttt) {
    if (!rc.tttLeader || !ids.includes(rc.tttLeader))
      rc.tttLeader = ids
        .slice()
        .sort(
          (a, b) => (rc.specs.length > 1 ? rc.gc[a] - rc.gc[b] : 0) || overall(S.riders[b].s) - overall(S.riders[a].s)
        )[0];
    h += `<h3>Contre-la-montre par équipes</h3><p class="small mut">Le temps de l'équipe est celui du 4e coureur. Les coureurs trop faibles pour le rythme sont lâchés et finissent seuls.</p>
  <div class="row">Allure <select onchange="S.rc.tttMode=this.value;save()"><option value="bloc" ${rc.tttMode !== 'leader' ? 'selected' : ''}>À bloc (le plus vite possible)</option><option value="leader" ${rc.tttMode === 'leader' ? 'selected' : ''}>Adaptée au leader (ne jamais le lâcher)</option></select></div>
  <div class="row">Leader <select onchange="S.rc.tttLeader=+this.value;save();render()">${ids.map(id => `<option value="${id}" ${rc.tttLeader === id ? 'selected' : ''}>${esc(riderName(S.riders[id]))}</option>`).join('')}</select></div>`;
  }
  if (!itt) {
    const lead = ids.filter(id => (rc.orders[id] || {}).o === 'leader').length,
      spr = ids.filter(id => (rc.orders[id] || {}).o === 'sprint').length;
    if (lead > 1 || spr > 1)
      h += `<p class="warn">Attention : ${lead > 1 ? lead + ' leaders' : ''} ${spr > 1 ? spr + ' sprinteurs' : ''} désignés — un seul sera réellement protégé.</p>`;
    h += `<details><summary class="small">Rappel des consignes</summary><p class="small mut">${Object.values(ORDERS)
      .map(v => `<b>${v.lbl}</b> : ${v.d}`)
      .join(
        '<br>'
      )}<br><b>Placement</b> : leaders et sprinteurs escortés par leurs équipiers restent mieux placés à moindre coût — crucial avant les secteurs pavés, dans le vent et au sprint.</p></details>`;
  }
  if (!itt) {
    const pl = (rc.plan && rc.plan[0]) || { debut: 'neutre', milieu: 'neutre', final: 'neutre' };
    if (S.simple)
      h += `<details class="manage"><summary>⚙️ Plan de course et ordres conditionnels — plan réglé par l'adjoint</summary>`;
    h += `<div class="row sb"><h3>Plan de course de l'équipe</h3><button class="auto" onclick="UI.flash='🧑‍💼 Plan : '+autoPlan(S.rc);save();render()">🧑‍💼 Plan auto</button></div><div class="tw"><table class="t wrap"><tbody>${[
      ['debut', 'Début (0-40 %)'],
      ['milieu', 'Milieu (40-80 %)'],
      ['final', 'Final (80-100 %)'],
    ]
      .map(
        ([k, l]) =>
          `<tr><td>${l}</td><td><select onchange="setPlan('${k}',this.value)">${Object.entries(PLAN_MODES)
            .map(([m, t]) => `<option value="${m}" ${pl[k] === m ? 'selected' : ''}>${t}</option>`)
            .join('')}</select></td></tr>`
      )
      .join('')}</tbody></table></div>`;
    h += `<h3>Ordres conditionnels</h3><p class="small mut">Déclenchés automatiquement pendant l'étape (une fois chacun), sous réserve d'obéissance.</p>`;
    for (const id of ids) {
      const cs = (rc.conds && rc.conds[id]) || [];
      if (cs.length)
        h += `<div class="small">${rlink(S.riders[id])} : ${cs.map((c, k) => `<span class="chip">${esc(condTxt(c))} <a onclick="delCond(${id},${k})">✕</a></span>`).join(' ')}</div>`;
    }
    const f = UI.condForm || { id: ids[0], c: 'km', p: 10, a: 'attack' };
    if (!ids.includes(f.id)) f.id = ids[0];
    UI.condForm = f;
    h += `<div class="nego small"><div class="row">Coureur <select onchange="UI.condForm.id=+this.value">${ids.map(id => `<option value="${id}" ${f.id === id ? 'selected' : ''}>${esc(riderName(S.riders[id]))}</option>`).join('')}</select></div>
   <div class="row">Si <select onchange="UI.condForm.c=this.value;render()">${Object.entries(COND)
     .map(([k, v]) => `<option value="${k}" ${f.c === k ? 'selected' : ''}>${v.lbl}</option>`)
     .join(
       ''
     )}</select>${COND[f.c].p ? ` <input type="number" style="width:70px" value="${f.p}" onchange="UI.condForm.p=+this.value"> ${COND[f.c].u}` : ''}</div>
   <div class="row">alors <select onchange="UI.condForm.a=this.value">${COND_ACT.map(a => `<option value="${a}" ${f.a === a ? 'selected' : ''}>${RADIO[a].lbl}</option>`).join('')}</select> <button onclick="addCond()">+ Ajouter</button></div></div>`;
    if (S.simple) h += '</details>';
  }
  h += `<div class="row"><label class="small"><input type="checkbox" ${UI.autoPause ? 'checked' : ''} onchange="UI.autoPause=this.checked"> Pause auto sur les événements de mon équipe</label></div>
  <div class="row"><label class="small"><input type="checkbox" ${UI.autoDS ? 'checked' : ''} onchange="UI.autoDS=this.checked"> 🤖 DS automatique (les ordres radio sont donnés selon la course)</label></div>
  <div class="row"><button class="pri big" onclick="startStage()">${itt ? '⏱ Lancer le chrono' : '🏁 Départ !'}</button></div></div>`;
  if (rc.si > 0) h += standingsCard(rc, true);
  return h;
}
function setPlan(k, v) {
  const rc = S.rc;
  rc.plan = rc.plan || {};
  rc.plan[0] = rc.plan[0] || { debut: 'neutre', milieu: 'neutre', final: 'neutre' };
  rc.plan[0][k] = v;
  rc.planStage = rc.si; // choix du joueur : l'adjoint n'y touche plus
  save();
}
function addCond() {
  const f = UI.condForm;
  const rc = S.rc;
  rc.conds = rc.conds || {};
  (rc.conds[f.id] = rc.conds[f.id] || []).push({ c: f.c, p: COND[f.c].p ? f.p : null, a: f.a });
  save();
  render();
}
function delCond(id, k) {
  S.rc.conds[id].splice(k, 1);
  save();
  render();
}
function setOrd(id, k, v) {
  const o = S.rc.orders[id] || (S.rc.orders[id] = { o: 'protect' });
  o[k] = v;
  save();
  if (k === 'o') render();
}
// Bouton « tout en auto » du briefing.
function briefAuto() {
  const rc = S.rc,
    spec = rc.specs[rc.si];
  const o = autoOrders(0, spec, rc);
  Object.assign(rc.orders, o);
  const g = autoGear(spec);
  setGear('wheels', g.wheels);
  setGear('tyres', g.tyres);
  setFeed(autoFeed(spec));
  const itt = isITT(spec) || isTTT(spec);
  const pl = itt ? '' : ' Plan : ' + autoPlan(rc);
  UI.flash = `🧑‍💼 Étape réglée.${itt ? '' : ' ' + ordersExplain(rc, o) + '.'}${pl}`;
  save();
  render();
}
function autoMine() {
  const o = autoOrders(0, S.rc.specs[S.rc.si], S.rc);
  Object.assign(S.rc.orders, o);
  UI.flash = `🧑‍💼 Consignes : ${ordersExplain(S.rc, o) || 'chacun pour soi'}.`;
  save();
  render();
}
function startStage() {
  const rc = S.rc;
  const spec = rc.specs[rc.si];
  if (isITT(spec) || isTTT(spec)) {
    const before = rc.si;
    runStageAuto(rc); // contre-la-montre : même série de hasard que hors interface
    UI.lastStage = { idx: before, itt: true, ttt: isTTT(spec) };
    save();
    render();
    return;
  }
  // mode essentiel : l'adjoint règle ce que le joueur n'a pas touché (matériel, ravitaillement, plan)
  if (S.simple) {
    if (rc.gearStage !== rc.si) {
      const g = autoGear(spec);
      setGear('wheels', g.wheels);
      setGear('tyres', g.tyres);
    }
    if (rc.feedStage !== rc.si) setFeed(autoFeed(spec));
    if (!rc.plan || !rc.plan[0] || rc.planStage !== rc.si) {
      autoPlan(rc);
      rc.planStage = rc.si;
    }
  }
  UI.sim = newStageSim(rc);
  UI.hlSeen = 0;
  UI.banner = null;
  UI.acc = 0;
  UI.sim.autoPause = UI.autoPause;
  UI.sim.autoDS = !!UI.autoDS;
  UI.Pf = UI.sim.P;
  UI.flashRace = null;
  startTimer();
  render();
}
