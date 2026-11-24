/* Contre-la-montre individuels et par équipes */
// Conditions du jour sur un contre-la-montre (air, vent dans l'axe, revêtement) pour chaque tronçon du profil.
function ttConds(spec, P) {
  const w = { windAx: null };
  genWindAxis(w, spec.dist, spec.wind || 0, 'neutre');
  // un parcours de chrono fait souvent une boucle ou un aller-retour : le vent s'y compense en partie (sinon un
  // chrono court, tout entier vent dans le dos, se gagnait à 60 km/h)
  const n = Math.ceil(spec.dist / 10) + 1;
  const mean = w.windAx.slice(0, n).reduce((a, b) => a + b, 0) / n;
  w.windAx = w.windAx.map(v => v - R.ttWindLoop * mean);
  const temp = spec.wx === 'chaleur' ? 32 : spec.wx === 'froid' ? 6 : 18;
  const out = [];
  for (let i = 0; i < P.n; i++)
    out.push({
      rho: airRho(P.alt ? P.alt[i] : 0, temp),
      crr: (P.surf[i] ? 0.012 : PHY.crr) * (spec.wx === 'pluie' ? 1.12 : 1),
      vw: headwindAt(w, i * STEP),
    });
  return out;
}
// Vitesse en chrono : seul contre l'air, la vitesse suit la racine cubique de la puissance sur le plat (14 % de
// puissance en moins, environ 5 % de vitesse en moins), et à peu près la puissance dans une vraie montée. Autour
// d'un niveau de référence, pour garder la vitesse moyenne calibrée (avant : écarts presque proportionnels à la
// capacité, un équipier qui s'économisait concédait 8 % au lieu d'environ 5 %).
function ttSpeed(L, g, surf) {
  const ex = g > 0 ? clamp(1 / 3 + g * 0.11, 1 / 3, 1) : 1 / 3;
  // (la puissance suit la capacité plus une constante : entre le meilleur rouleur et le moins bon du peloton,
  // environ 25 % de puissance d'écart, pas 40 % ou plus)
  return speedOf(R.ttRefL, g, surf, true, true) * Math.pow((Math.max(1, L) + R.ttOff) / (R.ttRefL + R.ttOff), ex);
}
function runITT(rc) {
  const spec = rc.specs[rc.si];
  const P = buildProfile(spec);
  const CO = ttConds(spec, P);
  for (const T of S.teams) {
    if (!T.player) {
      Object.assign(rc.orders, autoOrders(T.id, spec, rc));
    }
  }
  const out = [];
  const accs = {};
  for (const T of S.teams) {
    const eqTT = applyGear(eqFactors(T), gearFor(T, rc, spec)).tt;
    for (const id of rc.sel[T.id]) {
      if (rc.out[id]) continue;
      const r = S.riders[id];
      const o = rc.orders[id] || { itt: 'gerer' };
      const x = {
        r,
        energy: rc.energy[id],
        dayForm: clamp(
          r.forme +
            gauss() * (r.trait === 'regulier' ? 2.5 : 6) +
            homeBoost(rc, r) +
            mentalBig(rc, r) +
            mfForm(r) +
            (r.team === 0 ? facTT() : 0),
          25,
          100
        ),
      };
      // allure choisie, limite du jour, réserve (76-ttpacing.js)
      const mode = TT_PACE[o.itt] ? o.itt : 'gerer';
      const lim = ttLimit(r, spec.dist);
      let res = 100,
        boom = null;
      const sp = [];
      let t = 0;
      const acc = (accs[id] = powerAcc());
      for (let i = 0; i < P.n - 1; i++) {
        const g = P.g[i],
          surf = P.surf[i];
        let tgt = ttIntensity(mode, i / (P.n - 1), g);
        if (res <= 0) tgt = Math.min(tgt, lim - 0.04); // à sec : il explose
        const c =
          terrStat2(r.s, g, surf) *
          (0.86 + (0.14 * x.dayForm) / 100) *
          (0.7 + 0.3 * Math.min(1, x.energy / 55)) *
          (1 - r.fatigue / 650);
        const v = physSpeed(ttSpeed(c * tgt * 1.03, g, surf) * eqTT * (1 + fitK(r)), g, CO[i], 0.22);
        const dt = STEP / v;
        t += dt * 3600;
        acc.add(riderWatts(r.kg || 68, v, g, 1, 0.2, CO[i]), dt * 3600);
        if (tgt > lim && res > 0) {
          res -= (tgt - lim) * TT_DRAIN * dt;
          if (res <= 0) boom = Math.round(i * STEP * 10) / 10;
        }
        let dr = 16 + Math.max(0, tgt - 0.9) * 240;
        dr *= 1.38 - r.s.end / 140;
        x.energy = Math.max(0, x.energy - dr * dt);
        if (sp.length < 2 && (i + 1) * STEP >= (spec.dist * (sp.length + 1)) / 3) sp.push(Math.round(t));
      }
      t += gauss() * 4;
      out.push({ id, time: t, energy: x.energy, itt: mode, sp, boom });
    }
  }
  out.sort((a, b) => a.time - b.time);
  rc._power = stagePowerList(out, accs);
  applyStageResult(rc, spec, out, []);
  // temps intermédiaires et défaillances (bilan du chrono) : les 15 premiers et mes coureurs
  const st = rc.stageRes[rc.stageRes.length - 1];
  if (st) {
    st.tt = {};
    // rang et retard à chaque point intermédiaire (sur tous les partants)
    const rk = [0, 1].map(k => {
      const o = out.filter(e => e.sp[k] != null).sort((a, b) => a.sp[k] - b.sp[k]);
      return { best: o.length ? o[0].sp[k] : 0, pos: new Map(o.map((e, j) => [e.id, j + 1])) };
    });
    out.forEach((e, k) => {
      if (k < 15 || (S.riders[e.id] && S.riders[e.id].team === 0))
        st.tt[e.id] = {
          pace: e.itt,
          boom: e.boom,
          sp: e.sp.map((v, j) => ({ rk: rk[j].pos.get(e.id), gap: Math.round(v - rk[j].best) })),
        };
    });
  }
  return out;
}
// Simule une étape entière sans affichage (contre-la-montre compris). STAGE_DONE(rc), s'il est posé, est appelé
// après chaque étape (avancement d'une course confiée à l'adjoint dans le Web Worker : 98-worker.js).
let STAGE_DONE = null;
function runStageAuto(rc) {
  const spec = rc.specs[rc.si];
  let out;
  if (isITT(spec) || isTTT(spec))
    out = withSeed({ sd: stageSeed(rc, rc.si) }, () => (isITT(spec) ? runITT(rc) : runTTT(rc)));
  else {
    out = newStageSim(rc);
    let k = 0;
    while (!out.done && k < 5000) {
      simTick(out);
      k++;
    }
  }
  if (STAGE_DONE) STAGE_DONE(rc);
  return out;
}
// Contre-la-montre par équipes : le rythme est celui du cœur de l'équipe ; les lâchés finissent seuls.
function runTTT(rc) {
  const spec = rc.specs[rc.si];
  const P = buildProfile(spec);
  const CO = ttConds(spec, P);
  const out = [];
  const accs = {};
  rc.tttLog = [];
  for (const T of S.teams) {
    const ids = rc.sel[T.id].filter(id => !rc.out[id]);
    if (!ids.length) continue;
    const eqTT = applyGear(eqFactors(T), gearFor(T, rc, spec)).tt;
    const xs = ids.map(id => {
      const r = S.riders[id];
      return {
        id,
        r,
        energy: rc.energy[id],
        dayForm: clamp(
          r.forme +
            gauss() * (r.trait === 'regulier' ? 2.5 : 6) +
            homeBoost(rc, r) +
            mentalBig(rc, r) +
            mfForm(r) +
            (r.team === 0 ? facTT() : 0),
          25,
          100
        ),
        with: true,
        t: 0,
        di: -1,
        acc: (accs[id] = powerAcc()),
      };
    });
    const capOf = (x, i) =>
      terrStat2(x.r.s, P.g[i], P.surf[i]) *
      (0.86 + (0.14 * x.dayForm) / 100) *
      (0.7 + 0.3 * Math.min(1, x.energy / 55)) *
      (1 - x.r.fatigue / 650);
    const multi = rc.specs.length > 1;
    const gcl = multi
      ? xs.slice().sort((a, b) => rc.gc[a.id] - rc.gc[b.id])
      : xs.slice().sort((a, b) => overall(b.r.s) - overall(a.r.s));
    let ldr = T.player ? xs.find(x => x.id === rc.tttLeader) || gcl[0] : gcl[0];
    const mode = T.player ? rc.tttMode || 'bloc' : multi && leaderGcRank(rc, ldr.id) <= 10 ? 'leader' : 'bloc';
    let t = 0;
    const coh =
      1 +
      gauss() * 0.008 +
      (sum(xs.map(x => x.r.dis)) / xs.length - 60) / 3000 +
      (sum(xs.map(x => x.r.s.plc || 65)) / xs.length - 68) / 2500;
    for (let i = 0; i < P.n - 1; i++) {
      const grp = xs.filter(x => x.with);
      const n = grp.length;
      if (!n) break;
      const caps = grp.map(x => capOf(x, i));
      const sorted = caps.slice().sort((a, b) => b - a);
      const d = draftF(P.g[i], P.surf[i], n);
      // les relais : un coureur à la peine (bien en dessous du cœur de l'équipe, ou entamé) saute ses relais et
      // s'abrite en queue pour tenir ; les autres relaient plus souvent (moins de rouleurs pour mener)
      const core = sorted.slice(Math.min(2, n - 1), Math.min(6, n));
      const coreMin = core[core.length - 1];
      const skip = grp.map((x, j) => n > 3 && (caps[j] < coreMin * 0.985 || x.energy < 40));
      const nPull = Math.max(1, skip.filter(k => !k).length);
      const share = d + (1 - d) / nPull;
      // le rythme est celui que les coureurs du cœur de l'équipe (3e à 6e) peuvent tenir en relayant
      let L = (((sum(core) / core.length) * 0.97) / share) * coh;
      if (mode === 'leader' && ldr.with) {
        L = Math.min(L, (capOf(ldr, i) * 0.99) / share);
      }
      for (let j = 0; j < n; j++) if (skip[j]) grp[j].skips = (grp[j].skips || 0) + 1;
      const v = physSpeed(speedOf(L, P.g[i], P.surf[i], true, true) * eqTT * R.tttK, P.g[i], CO[i], 0.22);
      const dt = STEP / v;
      t += dt * 3600;
      grp.forEach((x, j) => {
        x.acc.add(riderWatts(x.r.kg || 68, v, P.g[i], 1 - 0.45 * (1 - 1 / n), 0.22, CO[i]), dt * 3600);
        const I = (L * (skip[j] ? d : share)) / caps[j];
        let dr = I < 0.75 ? 6 : I < 0.9 ? 6 + (I - 0.75) * 120 : 24 + (I - 0.9) * 300;
        dr *= 1.38 - x.r.s.end / 140;
        x.energy = Math.max(0, x.energy - dr * dt);
        if ((I > 1.05 || x.energy < 2) && n > 1) {
          x.with = false;
          x.di = i;
          x.t = t;
        }
      });
    }
    for (const x of xs) {
      if (x.with) {
        x.t = t;
        continue;
      }
      let tt = x.t;
      for (let i = x.di + 1; i < P.n - 1; i++) {
        const c = capOf(x, i) * 0.9;
        const v = physSpeed(speedOf(c, P.g[i], P.surf[i], true, true) * eqTT, P.g[i], CO[i], 0.22);
        tt += (STEP / v) * 3600;
        x.acc.add(riderWatts(x.r.kg || 68, v, P.g[i], 1, 0.22, CO[i]), (STEP / v) * 3600);
      }
      x.t = tt;
    }
    const times = xs.map(x => x.t).sort((a, b) => a - b);
    const tt = times[Math.min(3, times.length - 1)] + gauss() * 6;
    const lost = xs.filter(x => !x.with).length;
    for (const x of xs) {
      out.push({ id: x.id, time: Math.max(tt, x.with ? tt : x.t), energy: x.energy });
    }
    // coureurs qui ont sauté des relais une bonne partie du parcours (plus d'un tiers)
    const sat = xs.filter(x => (x.skips || 0) > (P.n - 1) / 3).length;
    rc.tttLog.push({ team: T.id, time: tt, lost, mode, ldr: ldr.id, ldrLost: !ldr.with, sat });
  }
  out.sort((a, b) => a.time - b.time);
  rc.tttLog.sort((a, b) => a.time - b.time);
  rc._power = stagePowerList(out, accs);
  applyStageResult(rc, spec, out, []);
  return out;
}
