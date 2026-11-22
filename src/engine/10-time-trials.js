/* Contre-la-montre individuels et par équipes */
// Conditions du jour sur un contre-la-montre (air, vent dans l'axe, revêtement) pour chaque tronçon du profil.
function ttConds(spec, P) {
  const w = { windAx: null };
  genWindAxis(w, spec.dist, spec.wind || 0, 'neutre');
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
        dayForm: clamp(r.forme + gauss() * (r.trait === 'regulier' ? 2.5 : 6), 25, 100),
      };
      const tgt = o.itt === 'fond' ? 0.975 : 0.9;
      let t = 0;
      const acc = (accs[id] = powerAcc());
      for (let i = 0; i < P.n - 1; i++) {
        const g = P.g[i],
          surf = P.surf[i];
        const c =
          terrStat2(r.s, g, surf) *
          (0.86 + (0.14 * x.dayForm) / 100) *
          (0.7 + 0.3 * Math.min(1, x.energy / 55)) *
          (1 - r.fatigue / 650);
        const v = physSpeed(speedOf(c * tgt * 1.03, g, surf, true, true) * eqTT * (1 + fitK(r)), g, CO[i], 0.22);
        const dt = STEP / v;
        t += dt * 3600;
        acc.add(riderWatts(r.kg || 68, v, g, 1, 0.2, CO[i]), dt * 3600);
        let dr = o.itt === 'fond' ? 34 : 16;
        dr *= 1.38 - r.s.end / 140;
        x.energy = Math.max(0, x.energy - dr * dt);
      }
      if (o.itt === 'fond' && rnd() < 0.06) {
        t += rf(5, 20);
      }
      t += gauss() * 4;
      out.push({ id, time: t, energy: x.energy, itt: o.itt });
    }
  }
  out.sort((a, b) => a.time - b.time);
  rc._power = stagePowerList(out, accs);
  applyStageResult(rc, spec, out, []);
  return out;
}
// Simule une étape entière sans affichage (contre-la-montre compris).
function runStageAuto(rc) {
  const spec = rc.specs[rc.si];
  if (isITT(spec) || isTTT(spec))
    return withSeed({ sd: stageSeed(rc, rc.si) }, () => (isITT(spec) ? runITT(rc) : runTTT(rc)));
  const sim = newStageSim(rc);
  let k = 0;
  while (!sim.done && k < 5000) {
    simTick(sim);
    k++;
  }
  return sim;
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
        dayForm: clamp(r.forme + gauss() * (r.trait === 'regulier' ? 2.5 : 6), 25, 100),
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
      const share = d + (1 - d) / n;
      // le rythme est celui que les coureurs du cœur de l'équipe (3e à 6e) peuvent tenir en relayant
      const core = sorted.slice(Math.min(2, n - 1), Math.min(6, n));
      let L = (((sum(core) / core.length) * 0.97) / share) * coh;
      if (mode === 'leader' && ldr.with) {
        L = Math.min(L, (capOf(ldr, i) * 0.99) / share);
      }
      const v = physSpeed(speedOf(L, P.g[i], P.surf[i], true, true) * eqTT, P.g[i], CO[i], 0.22);
      const dt = STEP / v;
      t += dt * 3600;
      grp.forEach((x, j) => {
        x.acc.add(riderWatts(x.r.kg || 68, v, P.g[i], 1 - 0.45 * (1 - 1 / n), 0.22, CO[i]), dt * 3600);
        const I = (L * share) / caps[j];
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
    rc.tttLog.push({ team: T.id, time: tt, lost, mode, ldr: ldr.id, ldrLost: !ldr.with });
  }
  out.sort((a, b) => a.time - b.time);
  rc.tttLog.sort((a, b) => a.time - b.time);
  rc._power = stagePowerList(out, accs);
  applyStageResult(rc, spec, out, []);
  return out;
}
