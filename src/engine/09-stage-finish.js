/* Fin d'étape : sommets des côtes (points, chronométrage des montées), arrivées, classement de l'étape, watts */
// Passages au sommet des cols et arrivées.
function tickCrossings(sim) {
  // chronométrage individuel des montées (pour les watts)
  const tEnd = sim.t * 60 + 30;
  sim.klimbs.forEach((c, ci) => {
    if (c.len < 1.5) return;
    for (const G of sim.groups) {
      if (!G.riders.length || !(G.speed > 0)) continue;
      if (G.prev < c.start && G.pos >= c.start) {
        const tc = tEnd - ((G.pos - c.start) / G.speed) * 3600;
        for (const x of G.riders) {
          (x.cs = x.cs || {})[ci] = tc;
        }
      }
      if (G.prev < c.end && G.pos >= c.end) {
        const tc = tEnd - ((G.pos - c.end) / G.speed) * 3600;
        c.perf = c.perf || [];
        for (const x of G.riders) {
          if (x.cs && x.cs[ci] !== undefined && !c.perf.some(e => e.id === x.id))
            c.perf.push({ id: x.id, dur: tc - x.cs[ci] });
        }
      }
    }
  });
  for (const c of sim.klimbs) {
    if (c.done) continue;
    const pts = komPts(sim.rc, c, c.end >= sim.dist - 0.5);
    for (const G of sim.groups.slice().sort((a, b) => b.pos - a.pos)) {
      if (G.prev < c.end && G.pos >= c.end) {
        const ord = jerseyOrder(G, 'kom', sim, c);
        for (const x of ord) {
          if (c.order.length < pts.length) c.order.push(x.id);
        }
      }
    }
    if (c.order.length >= pts.length || sim.groups.every(G => G.pos >= c.end)) {
      c.done = true;
      c.order.forEach((id, i) => {
        sim.rc.kom[id] = (sim.rc.kom[id] || 0) + pts[i];
      });
      const w = sim.runners.find(x => x.id === c.order[0]);
      let pw = '';
      if (w && c.perf && c.len >= 4) {
        const e = c.perf.find(e => e.id === w.id);
        if (e) {
          const P_ = climbPower(w.r.kg || 68, c.len, c.avg, e.dur);
          pw = ` — ${fmtTime(e.dur)}, ${P_.wkg.toFixed(1).replace('.', ',')} W/kg`;
        }
      }
      if (w) log(sim, `⛰️ ${c.name} (cat. ${c.cat}) : ${riderName(w.r)} passe en tête${pw}.`, w.player ? 'me' : '');
    }
  }
  for (const G of sim.groups) {
    if (G.pos >= sim.dist && G.riders.length) {
      const over = ((G.pos - sim.dist) / G.speed) * 3600;
      const tcross = sim.t * 60 + 30 - over;
      finishGroup(sim, G, tcross);
    }
  }
}
// Arrivée d'un groupe : sprint (placement, poisson-pilote, déclassement) ou arrivée en côte.
// Aléa du sprint (placement, timing, jambes du jour) : le meilleur sprinteur ne gagne pas tous les sprints.
const SPRINT_NOISE = R.sprintNoise;
// Au sommet de la hiérarchie, les écarts de vitesse pure se resserrent (plafond physiologique) :
// au-delà de 84, un point de sprint ne vaut plus que 0,6 point au moment de lancer le sprint.
function sprintPeak(v) {
  return v > 84 ? 84 + (v - 84) * 0.6 : v;
}
function finishGroup(sim, G, tcross) {
  const kmLeftGrad = sim.P.finishGrad;
  const xs = G.riders.filter(x => !x.fin);
  let ord;
  if (kmLeftGrad < 3 && xs.length > 1) {
    const big = xs.length > 8;
    const trains = {};
    for (const T of new Set(xs.map(x => x.team))) {
      const sp = sim.teamSprinter[T.id];
      const los = xs.filter(y => y.team === T && y !== sp && effOrder(y) === 'leadout' && y.energy > 8);
      const helpers = xs
        .filter(y => y.team === T && y !== sp && ['protect', 'control'].includes(effOrder(y)) && y.energy > 25)
        .slice(0, 1);
      trains[T.id] = {
        sp: sp && xs.includes(sp) ? sp : null,
        n: los.length,
        str:
          sum(los.map(y => y.r.s.pla * Math.min(1, y.energy / 40))) +
          sum(helpers.map(y => y.r.s.pla * 0.5 * Math.min(1, y.energy / 40))),
      };
    }
    // train perdu : des poissons-pilotes étaient là à 3 km, il n'en reste plus
    for (const T of new Set(xs.map(x => x.team))) {
      const tr = trains[T.id],
        had = (sim.trains3 && sim.trains3[T.id]) || 0;
      tr.lost = !!(tr.sp && had >= 2 && tr.n === 0);
    }
    const fw = sim.finWind || 'neutre';
    const bestTrain = Object.values(trains)
      .filter(t => t.sp && t.str > 0)
      .sort((a, b) => b.str - a.str)[0];
    ord = xs.map(x => {
      x._surf = x._boxed = x._early = false;
      let s =
        sprintPeak(x.r.s.spr) * (0.72 + 0.28 * Math.min(1, x.energy / 45)) +
        gauss() * SPRINT_NOISE +
        (x.dayForm - 70) * 0.08 +
        (x.punch - 50) * 0.025;
      if (big) {
        const tr = trains[x.team.id];
        let posS = x.pos;
        if (tr.sp === x && tr.str > 0) posS = Math.max(posS, 60 + tr.str / 6);
        if (tr.sp === x && tr.lost) {
          posS -= 10;
          x._lost = true;
        } else if (x.r.s.spr >= 68 && bestTrain && bestTrain.sp !== x && rnd() < (x.r.s.plc || 65) / 115) {
          posS = Math.max(posS, 74);
          x._surf = true;
        }
        // être bien placé au dernier kilomètre compte presque autant que la pointe de vitesse
        s += (posS - 50) * 0.08 + ((x.r.s.plc || 65) - 65) * 0.18;
        if (x.r.s.spr >= 68 && posS < 72 && rnd() < 0.3 * (1 - (x.r.s.plc || 65) / 125)) {
          s -= rf(3, 7);
          x._boxed = true;
        }
        if (x.r.s.spr >= 68 && rnd() < 0.12 * (1 - (x.r.s.plc || 65) / 130) * (fw === 'face' ? 1.4 : 1)) {
          s -= (x.r.s.end < 70 ? 3 : 1.5) * (fw === 'face' ? 1.8 : fw === 'dos' ? 0.5 : 1);
          x._early = true;
        }
        // vent de face : les sprinteurs qui patientent dans les roues sont avantagés ; vent de dos : les sprints longs et puissants
        if (fw === 'face' && x._surf) s += 1.5;
        if (fw === 'dos') s += (x.r.s.end - 70) * 0.05 + (x.r.kg - 70) * 0.06;
        if (tr.sp === x) s += Math.min(2, tr.n) * 1.6;
      } else if (sim.teamSprinter[x.team.id] === x) {
        const lo = xs.filter(y => y.team === x.team && y !== x && effOrder(y) === 'leadout' && y.energy > 8).length;
        s += Math.min(2, lo) * 2;
      }
      if (x.r.trait === 'gagneur') s += 1.5;
      if (['protect', 'control', 'leadout'].includes(effOrder(x))) s -= 6;
      return [x, s];
    });
    ord.sort((a, b) => b[1] - a[1]);
    pactFinish(sim, ord);
    if (big && ord.length > 3 && rnd() < 0.03) {
      const k = rint(0, 2);
      const [[dx]] = ord.splice(k, 1);
      ord.push([dx, 0]);
      log(
        sim,
        `🚩 ${riderName(dx.r)} (${dx.team.short}) est déclassé pour sprint irrégulier !`,
        dx.player ? 'bad' : 'att'
      );
    }
    if (big && G === sim.groups.find(H => H.riders.length)) {
      const w = ord[0][0];
      let txt = '🏁 Sprint : ';
      if (bestTrain) txt += `le train ${bestTrain.sp.team.short} emmène ${riderName(bestTrain.sp.r)} ; `;
      txt += w._surf ? `${riderName(w.r)} surfe dans les roues et s'impose` : `${riderName(w.r)} s'impose`;
      if (fw !== 'neutre')
        txt += fw === 'face' ? ' (vent de face)' : fw === 'dos' ? ' (vent de dos)' : ' (vent de côté)';
      const lost = ord
        .slice(0, 20)
        .map(a => a[0])
        .filter(x => x._lost)
        .slice(0, 1);
      if (lost.length) txt += ` ; ${riderName(lost[0].r)} a perdu son train`;
      const boxed = ord
        .slice(0, 12)
        .map(a => a[0])
        .filter(x => x._boxed && x.r.s.spr >= 72 && x !== w)
        .slice(0, 2);
      if (boxed.length)
        txt += ` ; ${boxed.map(x => riderName(x.r)).join(' et ')} enfermé${boxed.length > 1 ? 's' : ''}`;
      const early = ord
        .slice(0, 12)
        .map(a => a[0])
        .filter(x => x._early && x.r.s.spr >= 72 && x !== w)
        .slice(0, 1);
      if (early.length) txt += ` ; ${riderName(early[0].r)} lancé trop tôt`;
      log(sim, txt + '.', ord.slice(0, 3).some(a => a[0].player) ? 'me' : 'info');
      for (const [x] of ord.slice(0, 15))
        if (x.player && (x._boxed || x._early) && x.r.s.spr >= 65)
          log(
            sim,
            `📻 ${riderName(x.r)} : « ${x._boxed ? "J'étais enfermé, pas d'ouverture !" : 'Je suis parti trop tôt…'} »`,
            'bad'
          );
    }
    ord.forEach(([x]) => {
      x.time = tcross;
    });
    if (!sim.finish.length)
      sim.photo = { kind: 'sprint', n: ord.length, ord: ord.slice(0, 10).map(([x, s]) => ({ id: x.id, s })) };
  } else {
    ord = xs.map(x => {
      const fg = Math.max(kmLeftGrad, 4);
      x.short = !!sim.P.finishShort;
      x.gr = fg;
      let s =
        cap(x, fg, 0) + gauss() * 1.4 + (sim.P.finishShort ? (x.wbal - 9) * 0.3 + (x.r.s.col - x.r.s.mon) * 0.08 : 0);
      if (x.r.trait === 'gagneur') s += 1;
      if (['protect', 'control', 'leadout'].includes(effOrder(x))) s -= 4;
      return [x, s];
    });
    ord.sort((a, b) => b[1] - a[1]);
    pactFinish(sim, ord);
    const best = ord[0][1];
    ord.forEach(([x, s]) => {
      x.time = tcross + Math.min(25, Math.max(0, (best - s) * 0.7));
    });
    if (!sim.finish.length)
      sim.photo = {
        kind: ord.length === 1 ? 'seul' : 'bosse',
        ord: ord.slice(0, 10).map(([x, s]) => ({ id: x.id, s })),
      };
  }
  for (const [x] of ord) {
    x.fin = true;
    sim.finish.push(x);
  }
  G.riders = [];
}
// Fin d'étape : classement, statistiques, watts, règle des 3 km, désobéissances.
function endStageSim(sim) {
  sim.done = true;
  const rc = sim.rc;
  for (const x of sim.runners) {
    x.r.stats.kf = (x.r.stats.kf || 0) + x.st.kf;
    x.r.stats.att = (x.r.stats.att || 0) + x.st.att;
  }
  rc._stats = {};
  for (const x of sim.runners) {
    if (x.player)
      rc._stats[x.id] = {
        kf: +x.st.kf.toFixed(1),
        kw: +x.st.kw.toFixed(1),
        att: x.st.att,
        I: x.st.n ? +(x.st.Is / x.st.n).toFixed(2) : 0,
        cv: x.st.cv,
        e: Math.round(x.energy),
      };
  }
  const kb = sim.runners.filter(x => !x.dnf).sort((a, b) => b.st.kf + b.st.att * 8 - (a.st.kf + a.st.att * 8))[0];
  if (kb && kb.st.kf > 5) rc._komb = kb.id;
  for (const x of sim.finish) if (x.pen) x.time += x.pen; // pénalités des commissaires
  const res = sim.finish.slice().sort((a, b) => a.time - b.time || sim.finish.indexOf(a) - sim.finish.indexOf(b));
  // watts : performances dans les montées notables
  const climbs = [];
  for (const c of sim.klimbs) {
    // courses espoirs : pas de records de puissance (le peloton compte des coureurs fictifs de clubs)
    if (rc.esp || !c.perf || !c.perf.length || c.len < 3 || c.avg < 4) continue;
    const all = c.perf
      .filter(e => e.dur > 60)
      .map(e => {
        const r = S.riders[e.id];
        return { id: e.id, dur: Math.round(e.dur), ...climbPower(r.kg || 68, c.len, c.avg, e.dur) };
      })
      .sort((a, b) => a.dur - b.dur);
    if (!all.length) continue;
    const mine = new Set(sim.runners.filter(x => x.player).map(x => x.id));
    climbs.push({
      name: c.name,
      cat: c.cat,
      len: c.len,
      avg: c.avg,
      top: all.filter((e, i) => i < 10 || mine.has(e.id)).map(e => ({ ...e, rk: all.indexOf(e) + 1 })),
    });
    for (const e of all) recordPower(e, c, sim);
  }
  rc._climbs = climbs;
  // puissance sur l'étape : mes coureurs et les dix premiers
  const pIds = new Set([...res.slice(0, 10).map(x => x.id), ...sim.runners.filter(x => x.player).map(x => x.id)]);
  rc._power = sim.runners
    .filter(x => pIds.has(x.id))
    .map(x => ({ ...powerSummary(x.id, x.st, x.r.kg || 68), rk: res.indexOf(x) + 1, kf: +x.st.kf.toFixed(1) }))
    .filter(e => e.id)
    .sort((a, b) => (a.rk || 999) - (b.rk || 999));
  let bunch = null;
  if (sim.pel3) {
    const cnt = new Map();
    for (const x of res)
      if (sim.pel3.has(x.id)) {
        const k = Math.round(x.time);
        cnt.set(k, (cnt.get(k) || 0) + 1);
      }
    let best = 0;
    for (const [k, c] of cnt)
      if (c > best) {
        best = c;
        bunch = k;
      }
  }
  applyStageResult(
    rc,
    sim.spec,
    res.map(x => ({
      id: x.id,
      time: x.time,
      energy: x.energy,
      gcTime: bunch !== null && sim.pel3.has(x.id) && x.time > bunch ? bunch : undefined,
    })),
    sim.runners.filter(x => x.dnf).map(x => x.id)
  );
  // désobéissances
  sim.disob = sim.runners.filter(x => x.player && x.rebel).map(x => x.id);
  rc.rebels = [...new Set([...(rc.rebels || []), ...sim.disob, ...(sim.refusals ? [...sim.refusals] : [])])];
}
// Records de puissance : meilleur effort personnel par durée et palmarès mondial des ascensions (20 min et plus).
const PW_BUCKETS = [
  ['c', '5-15 min', 300, 900],
  ['m', '15-30 min', 900, 1800],
  ['l', '30 min et +', 1800, 1e9],
];
// Met à jour les records de puissance d'un coureur et le palmarès des ascensions.
function recordPower(e, c, sim) {
  const r = S.riders[e.id];
  if (!r) return;
  const b = PW_BUCKETS.find(B => e.dur >= B[2] && e.dur < B[3]);
  if (!b) return;
  const rec = {
    wkg: e.wkg,
    w: e.w,
    dur: e.dur,
    vam: e.vam,
    climb: c.name,
    len: c.len,
    avg: c.avg,
    race: sim.rc.name,
    season: S.season,
  };
  r.pb = r.pb || {};
  if (!r.pb[b[0]] || e.wkg > r.pb[b[0]].wkg)
    r.pb[b[0]] = { wkg: rec.wkg, w: rec.w, dur: rec.dur, climb: rec.climb, race: rec.race, season: rec.season };
  // les données de puissance trahissent le vrai niveau d'un coureur : la cellule de performance l'observe
  if (r.team !== 0 && sim.runners.some(x => x.player) && e.dur >= 900)
    S.know[r.id] = Math.min(90, (S.know[r.id] || 20) + 1.5);
  if (r.team === 0 && e.dur >= 1200 && e.wkg >= 6.6 && r.pwPress !== S.season && (!S._pwFlag || e.wkg > S._pwFlag.wkg))
    S._pwFlag = { id: e.id, wkg: e.wkg, dur: e.dur, climb: c.name };
  if (e.dur >= 1200) {
    S.pwRec = S.pwRec || [];
    const L = S.pwRec;
    if (L.length < 20 || e.wkg > L[L.length - 1].wkg) {
      const ex = L.findIndex(
        q => q.id === e.id && q.race === rec.race && q.season === rec.season && q.climb === rec.climb
      );
      if (ex < 0 && L.filter(q => q.race === rec.race && q.season === rec.season && q.climb === rec.climb).length < 2) {
        L.push({ id: e.id, ...rec });
        L.sort((a, b) => b.wkg - a.wkg);
        L.length = Math.min(L.length, 20);
      }
    }
  }
}
