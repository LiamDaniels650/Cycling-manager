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
  UI.momSeen = 0;
  UI.momOpen = null;
  UI.banner = null;
  UI.acc = 0;
  UI.sim.autoPause = UI.autoPause;
  UI.sim.autoDS = !!UI.autoDS;
  UI.Pf = UI.sim.P;
  UI.flashRace = null;
  startTimer();
  render();
}
