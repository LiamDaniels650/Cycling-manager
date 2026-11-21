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
  // dans l'ordre de la route : le groupe de tête passe la ligne (ou entre dans le dernier kilomètre) le premier
  for (const G of sim.groups.slice().sort((a, b) => b.pos - a.pos)) {
    if (G.pos >= sim.dist && G.riders.length) {
      const over = ((G.pos - sim.dist) / G.speed) * 3600;
      const tcross = sim.t * 60 + 30 - over;
      finishGroup(sim, G, tcross);
    } else if (
      sim.P.finishGrad >= 3 &&
      sim.dist - G.pos <= climbFineKm(sim) &&
      G.speed > 0 &&
      G.riders.filter(x => !x.fin).length >= 2
    ) {
      // arrivée en côte : le dernier kilomètre d'un groupe se court au détail (climbRun), dès qu'il y entre ;
      // les groupes à moins de 250 m derrière, et ceux encore devant lui dans ce dernier kilomètre, courent avec lui
      // (chacun part de sa place : on peut revenir ou être repris)
      for (const x of G.riders) {
        x._d0 = (sim.dist - G.pos) * 1000;
        x._v0 = G.speed / 3.6;
      }
      for (const H of sim.groups)
        if (
          H !== G &&
          H.speed > 0 &&
          ((H.pos < G.pos && G.pos - H.pos <= 0.25) || (H.pos > G.pos && H.pos < sim.dist)) // devant : déjà dans le dernier km
        )
          for (const x of H.riders.slice())
            if (!x.fin) {
              x._d0 = (sim.dist - H.pos) * 1000;
              x._v0 = H.speed / 3.6;
              moveTo(x, G);
            }
      finishGroup(sim, G, sim.t * 60 + 30, (sim.dist - G.pos) * 1000);
    }
  }
}
// Sprint simulé sur le dernier kilomètre, au quart de seconde. Chaque coureur part de sa place dans le groupe
// (placement, train, surf), file à la vitesse du peloton puis lance son sprint à sa distance (longue pour un
// coureur endurant ou par vent de dos, courte par vent de face ou sur ordre) : accélération, vitesse de pointe
// tenue une dizaine de secondes, puis déclin. L'aspiration avantage celui qui lance dans une roue ; un coureur
// mal placé peut rester enfermé. Renvoie le temps de passage (s) de chacun sur la ligne.
function sprintRun(sim, ents, fw, big) {
  const v0 = 15.5 * (fw === 'face' ? 0.95 : fw === 'dos' ? 1.05 : 1);
  const draftV = fw === 'face' ? R.sprintDraft * 1.6 : fw === 'dos' ? R.sprintDraft * 0.5 : R.sprintDraft;
  const R_ = ents.map(e => {
    const x = e.x,
      s = x.r.s;
    const plan = x.launchPlan || null;
    let L =
      plan === 'long'
        ? 280
        : plan === 'court'
          ? 170
          : 205 + ((s.end || 70) - 70) * 1.2 + (fw === 'dos' ? 50 : fw === 'face' ? -40 : 0) + gauss() * 30;
    L = clamp(L, 110, 380);
    return {
      e,
      x,
      d: 1000 + (100 - clamp(e.posS, 0, 100)) * R.sprintSpread + rf(0, 2),
      v: v0,
      // la pointe au-dessus du rythme du groupe : rognée par vent de face (la traînée croît vite), accrue par vent de dos
      vmax: e.role
        ? v0 * 0.98
        : v0 + (1.1 + (e.q - 75) * R.sprintVk) * (fw === 'face' ? 0.75 : fw === 'dos' ? 1.15 : 1),
      acc: 1.1 + (s.spr - 70) / 50,
      sus: 6 + ((s.end || 70) - 55) * 0.2 + (s.spr - 70) / 25,
      L,
      on: false,
      tOn: 0,
      fol: 0, // secondes passées à suivre un lanceur avant de lancer soi-même
      blk: 0,
      t: null,
    };
  });
  const events = []; // événements de la retransmission (train, coupure, lancements, enfermements, prises de tête)
  // le train : les poissons-pilotes (jusqu'à 3) en file devant leur sprinteur, le moins bon en tête, le meilleur
  // en dernier ; chacun mène à haute vitesse (aptitude à rouler, réserves), puis s'écarte, le dernier juste avant
  // le lancement de son sprinteur
  const trains = [];
  for (const a of R_)
    if (!a.e.role && sim.teamSprinter && sim.teamSprinter[a.x.team.id] === a.x) trains.push({ sp: a, lo: [] });
  for (const a of R_) {
    if (!a.e.role || effOrder(a.x) !== 'leadout' || a.x.energy <= 8) continue;
    const T = trains.find(T => T.sp.x.team === a.x.team);
    if (T && T.lo.length < 3) T.lo.push(a);
  }
  for (const T of trains) {
    const n = T.lo.length;
    if (!n) continue;
    T.lo.sort((p, q) => p.x.r.s.pla - q.x.r.s.pla);
    T.lo.forEach((a, k) => {
      a.d = T.sp.d - (n - k) * 1.6;
      a.train = T;
      a.peel = T.sp.L + 40 + (n - 1 - k) * 200;
      a.pull = clamp(0.6 + (0.8 * (a.x.r.s.pla - 60)) / 30, 0.3, 1.4) * Math.min(1, a.x.energy / 40);
    });
  }
  // le surf : un sprinteur sans train se cale physiquement dans la roue du sprinteur du meilleur train
  const best = trains
    .filter(T => T.lo.length)
    .sort((p, q) => sum(q.lo.map(a => a.x.r.s.pla)) - sum(p.lo.map(a => a.x.r.s.pla)))[0];
  if (best) {
    let wheel = best.sp;
    for (const a of R_)
      if (a.x._surf && a !== best.sp && !a.e.role) {
        a.d = wheel.d + 1.5;
        wheel = a;
      }
  }
  // la bataille du placement : un adversaire bon frotteur s'intercale entre le dernier poisson-pilote et son
  // sprinteur (plus souvent derrière un train court) ; il prend la roue, le sprinteur se retrouve derrière lui
  for (const T of trains) {
    if (!T.lo.length || !big) continue;
    const cand = R_.filter(
      a => !a.e.role && !a.cutter && a !== T.sp && a.x.team !== T.sp.x.team && !a.x._surf && (a.x.r.s.plc || 65) >= 72
    ).sort((p, q) => (q.x.r.s.plc || 65) - (p.x.r.s.plc || 65))[0];
    if (cand && rnd() < 0.22 * (1 - T.lo.length / 4)) {
      cand.d = T.sp.d;
      cand.cutter = true;
      T.sp.d += 1.6;
      T.sp.x._cut = cand.x;
      events.push({
        t: 0,
        id: T.sp.x.id,
        txt: `✂️ ${riderName(cand.x.r)} (${cand.x.team.short}) coupe le train ${T.sp.x.team.short} et prend la roue !`,
      });
    }
  }
  // la roue choisie (ordre « dans la roue de… ») : placé juste derrière ce coureur, si le placement le permet
  for (const a of R_) {
    if (a.x.wheelId == null) continue;
    const b = R_.find(y => y.x.id === a.x.wheelId);
    if (b && rnd() < (a.x.r.s.plc || 65) / 100) a.d = b.d + 1.5;
  }
  const dt = 0.25;
  let t = 0;
  // enregistrement pour la retransmission du sprint (positions toutes les 0,5 s, événements) : lecture seule
  const rec = R_.filter(a => !a.e.role || a.train);
  const frames = [];
  let leader = null;
  for (let k = 0; k < 600 && R_.some(a => a.t == null); k++) {
    if (k % 2 === 0) {
      frames.push(rec.map(a => Math.max(0, +(a.t == null ? a.d : 0).toFixed(1))));
      const lead = rec.filter(a => a.t == null && !a.e.role).sort((a, b) => a.d - b.d)[0];
      // (on ne suit plus la tête une fois la ligne franchie : le suivant n'est pas « en tête »)
      if (lead && lead !== leader && lead.d < 400 && !rec.some(a => a.t != null && !a.e.role)) {
        if (leader) events.push({ t, id: lead.x.id, k: 'lead', m: Math.round(lead.d) });
        leader = lead;
      }
    }
    // ordre de course (du plus proche de la ligne au plus loin) pour l'aspiration et l'enfermement
    const live = R_.filter(a => a.t == null).sort((a, b) => a.d - b.d);
    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      if (!a.on && !a.e.role && a.d <= a.L) {
        a.on = true;
        a.tOn = t;
        events.push({ t, id: a.x.id, k: 'launch', m: Math.round(a.d) });
        // mal placé au moment de lancer : enfermé quelques secondes (les bons frotteurs s'en sortent)
        if (big && a.e.posS < 72 && rnd() < 0.3 * (1 - (a.x.r.s.plc || 65) / 125)) {
          a.blk = rf(1, 3);
          a.x._boxed = true;
          events.push({ t, id: a.x.id, k: 'box', m: Math.round(a.d) });
        }
      }
      let target = v0;
      const ahead = i > 0 ? live[i - 1] : null;
      // poisson-pilote : il mène jusqu'à son point d'écart, puis s'écarte et se laisse glisser
      if (a.train) {
        if (a.d > a.peel) target = v0 + a.pull;
        else {
          target = v0 - 1.5;
          if (!a.peeled) {
            a.peeled = true;
            const last = a.train.lo[a.train.lo.length - 1] === a;
            if (last && !a.train.sp.on && a.train.sp.t == null && a.train.sp.d - a.d < 8)
              events.push({
                t,
                id: a.train.sp.x.id,
                txt: `🚂 Le train ${a.x.team.short} dépose ${riderName(a.train.sp.x.r)} à ${Math.round(a.d / 10) * 10} m !`,
              });
          }
        }
      }
      // pas encore lancé, collé à un coureur plus rapide : il suit dans sa roue (aspiration). Derrière un sprinteur
      // lancé, ça entame un peu sa propre pointe ; derrière un train, c'est le rythme du peloton
      if (
        !a.on &&
        !(a.train && a.d > a.peel) &&
        ahead &&
        ahead.v > target &&
        a.d - ahead.d < 5 &&
        a.d - ahead.d > 0.3
      ) {
        if (ahead.on) {
          target = Math.min(ahead.v, a.vmax * 0.97);
          if (!a.e.role) a.fol += dt;
        } else if (ahead.train && !ahead.peeled) target = Math.min(ahead.v, v0 + 1.4);
      }
      if (a.on) {
        const el = t - a.tOn;
        const sus = a.sus - a.fol * 0.25;
        // pointe tenue ~10 s, puis le coureur se vide : il tombe sous la vitesse du groupe (parti trop tôt, il se fait
        // remonter par ceux qui ont attendu)
        target = el <= sus ? a.vmax : Math.max(v0 - R.sprintSpent, a.vmax - (el - sus) * R.sprintFade);
        if (a.blk > 0) {
          target = Math.min(target, v0);
          a.blk -= dt;
        }
        // aspiration : un coureur juste devant (moins de 6 m) protège du vent
        if (ahead && a.d - ahead.d < 6 && a.d - ahead.d > 0.3) target += draftV;
        // vent de face : celui qui lance sans abri s'use contre le vent (attendre paie)
        else if (fw === 'face') target -= 0.35;
      }
      a.v = a.v < target ? Math.min(target, a.v + a.acc * dt) : Math.max(target, a.v - 0.6 * dt);
      const nd = a.d - a.v * dt;
      if (nd <= 0) a.t = t + a.d / a.v;
      a.d = nd;
    }
    t += dt;
  }
  // parti trop tôt : il a lancé de loin et s'est fait passer dans les 50 derniers mètres
  const res = new Map();
  for (const a of R_) res.set(a.x, a.t == null ? t + 10 : a.t);
  const sorted = R_.filter(a => !a.e.role).sort((a, b) => res.get(a.x) - res.get(b.x));
  sorted.forEach((a, i) => {
    if (a.on && a.L >= 260 && i > 0 && sorted.slice(0, i).some(b => b.L < a.L - 60)) a.x._early = true;
    if (a.x._sp) a.x._sp.launch = Math.round(a.L);
  });
  // retransmission : les 10 premiers et mes coureurs (sprinteurs), avec l'écart en mètres sur la ligne
  // (un groupe d'équipiers qui ne disputent pas le sprint n'a rien à montrer)
  if (!sorted.length) {
    sim._sprintTrace = null;
    return res;
  }
  const tw = res.get(sorted[0].x);
  const keep = sorted.filter((a, i) => i < 10 || a.x.player).slice(0, 14);
  // les poissons-pilotes des sprinteurs montrés (dans le couloir de leur sprinteur)
  const los = [];
  for (const T of trains) if (keep.includes(T.sp)) for (const a of T.lo) if (rec.includes(a)) los.push([a, T.sp]);
  const idx = keep.map(a => rec.indexOf(a)).concat(los.map(([a]) => rec.indexOf(a)));
  const ids = new Set(keep.map(a => a.x.id));
  sim._sprintTrace = {
    dt: 0.5,
    riders: keep
      .map(a => ({
        id: a.x.id,
        n: riderName(a.x.r),
        t: a.x.team.short,
        c: a.x.team.color,
        me: !!a.x.player,
        gap: +((res.get(a.x) - tw) * a.v).toFixed(1),
      }))
      .concat(
        los.map(([a, sp]) => ({
          id: a.x.id,
          n: riderName(a.x.r),
          t: a.x.team.short,
          c: a.x.team.color,
          me: false,
          lo: true,
          of: sp.x.id,
          gap: null,
        }))
      ),
    frames: frames.map(f => idx.map(j => f[j])),
    events: events.filter(e => ids.has(e.id) && (e.m == null || e.m <= 450)),
  };
  return res;
}
// Arrivée d'un groupe : sprint (placement, poisson-pilote, déclassement) ou arrivée en côte.
// Aléa du sprint (placement, timing, jambes du jour) : le meilleur sprinteur ne gagne pas tous les sprints.
const SPRINT_NOISE = R.sprintNoise;
// Au sommet de la hiérarchie, les écarts de vitesse pure se resserrent (plafond physiologique) :
// au-delà de 84, un point de sprint ne vaut plus que 0,6 point au moment de lancer le sprint.
function sprintPeak(v) {
  return v > 84 ? 84 + (v - 84) * 0.6 : v;
}
function finishGroup(sim, G, tcross, Lfine) {
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
    // préparation : placement à l'approche (trains, surf, train perdu), qualités de sprint du jour
    const ents = xs.map(x => {
      x._surf = x._boxed = x._early = false;
      let q =
        sprintPeak(x.r.s.spr) * (0.72 + 0.28 * Math.min(1, x.energy / 45)) +
        gauss() * SPRINT_NOISE +
        (x.dayForm - 70) * 0.08 +
        (x.punch - 50) * 0.025;
      let posS = x.pos;
      const tr = trains[x.team.id];
      if (big) {
        if (tr.sp === x && tr.str > 0) posS = Math.max(posS, 60 + tr.str / 6);
        if (tr.sp === x && tr.lost) {
          posS -= 10;
          x._lost = true;
        } else if (x.r.s.spr >= 68 && bestTrain && bestTrain.sp !== x && rnd() < (x.r.s.plc || 65) / 115) {
          posS = Math.max(posS, 74);
          x._surf = true;
        }
        posS += ((x.r.s.plc || 65) - 65) * 0.9;
      }
      if (x.r.trait === 'gagneur') q += 1.5;
      // les équipiers (protéger, contrôler, poisson-pilote) ne disputent pas le sprint
      const role = ['protect', 'control', 'leadout'].includes(effOrder(x));
      x._sp = { pos: Math.round(posS), train: big && tr.sp === x ? tr.n : -1, big, wind: fw };
      return { x, q, posS, role };
    });
    const T = sprintRun(sim, ents, fw, big);
    ord = ents.map(e => [e.x, -T.get(e.x)]);
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
      sim.photo = {
        kind: 'sprint',
        n: ord.length,
        ord: ord.slice(0, 10).map(([x, s]) => ({ id: x.id, s })),
        trace: sim._sprintTrace || null,
      };
    sim._sprintTrace = null;
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
    let tr = null;
    if (Lfine != null && ord.length > 1) {
      // dernier kilomètre en côte simulé : allures, roues, attaques, réserves (les ordres du DS y agissent)
      const T = climbRun(sim, ord, Lfine, G.speed / 3.6, Math.max(kmLeftGrad, 4));
      ord.forEach(a => {
        a[0].time = tcross + T.get(a[0]);
        a[0]._fine = true;
      });
      ord.sort((a, b) => a[0].time - b[0].time);
      pactFinish(sim, ord);
      for (
        let i = 1;
        i < ord.length;
        i++ // un pacte respecté : le coureur qui s'efface passe un souffle derrière
      )
        if (ord[i][0].time < ord[i - 1][0].time) ord[i][0].time = ord[i - 1][0].time + 0.2;
      tr = sim._climbTrace;
      sim._climbTrace = null;
      climbSummitCredit(sim, ord);
    } else {
      ord.sort((a, b) => b[1] - a[1]);
      pactFinish(sim, ord);
      const best = ord[0][1];
      ord.forEach(([x, s]) => {
        x.time = tcross + Math.min(25, Math.max(0, (best - s) * 0.7));
      });
      if (climbPlans(sim, ord)) ord.sort((a, b) => a[0].time - b[0].time);
    }
    climbPlanLog(sim, ord);
    // la photo d'arrivée : le premier groupe arrivé, et personne encore en course devant lui
    // (ou un groupe arrivé plus tard au détail, mais plus vite : la photo change de vainqueur)
    const ahead = sim.groups.some(H => H !== G && H.pos > G.pos && H.riders.some(x => !x.fin && !x.dnf));
    const best = sim.finish.length ? Math.min(...sim.finish.map(y => y.time)) : Infinity;
    if (!ahead && ord[0][0].time < best)
      sim.photo = {
        kind: ord.length === 1 ? 'seul' : 'bosse',
        ord: ord.slice(0, 10).map(([x, s]) => ({ id: x.id, s })),
        ...(tr ? { trace: tr } : {}),
      };
  }
  for (const [x] of ord) {
    x.fin = true;
    sim.finish.push(x);
  }
  G.riders = [];
}
// Distance (km) simulée au détail à la fin d'une arrivée en côte : les 3 derniers km d'une vraie montée finale
// (au moins 3 km à 5 %), le dernier kilomètre sinon (bosse, arrivée en faux plat montant).
function climbFineKm(sim) {
  const lc = sim.P.climbs.filter(c => c.end >= sim.dist - 0.5).slice(-1)[0];
  return lc && lc.len >= 3 && lc.avg >= 5 ? Math.min(R.climbFinKm, lc.len) : 1;
}
// Dernier kilomètre d'une arrivée en côte, simulé à la demi-seconde pour un groupe. Chacun a son allure
// soutenable (capacité du jour, comme avant : même hiérarchie) et sa réserve (W' restant, relatif) : tenir la roue
// d'un plus rapide (l'aspiration aide un peu sous 7 %) ou attaquer la vide ; à sec, il lâche. Le plus fort grimpeur
// attaque de loin pour décrocher les puncheurs, les puncheurs attendent les 300 derniers mètres, tous donnent ce qui
// reste aux 200 m. Ordres du DS : « attendre la fin » (garde la réserve pour 300 m), « suivre » (colle à la roue du
// rival choisi). Renvoie le temps (s) de chacun jusqu'à la ligne ; enregistre la retransmission (sim._climbTrace).
function climbRun(sim, ord, L, vg, fg) {
  const sMed = ord.map(a => a[1]).sort((a, b) => b - a)[Math.min(ord.length - 1, 2)];
  const draft = Math.max(0, 7 - fg) * 0.004;
  const kF = R.climbFinCost,
    surge = R.climbFinSurge;
  const sorted = ord.map(a => a[1]).sort((a, b) => b - a);
  const R_ = ord.map(([x, sc]) => {
    const role = ['protect', 'control', 'leadout'].includes(effOrder(x));
    const vi = (x._v0 || vg) * (1 + (sc - sMed) * R.climbFinK);
    const res0 = clamp((x.wbal || 0) / 15, 0, 1.5);
    const punchy = x.r.s.col - x.r.s.mon >= 3;
    const strongest = sc >= sorted[Math.min(1, sorted.length - 1)] - 0.3;
    // le moment de l'effort final : à l'instinct, il varie (certains partent trop tôt) ; sur ordre « attendre la
    // fin », 300 m, le bon moment pour un puncheur
    let D = 200 + rf(0, 200);
    if (x.climbPlan === 'last') D = 300;
    else if (x.climbPlan === 'follow') D = 200;
    else if (punchy) D = 220 + rf(0, 280);
    else if (strongest && !role) D = L <= 1200 ? Math.min(L - 40, 600 + rf(0, 450)) : L * rf(0.25, 0.7);
    // une attaque ordonnée juste avant (radio) part tout de suite
    if (x.radio === 'attack' && !role) {
      D = L;
      x.radio = null;
    }
    return {
      x,
      sc,
      role,
      vi,
      R: res0,
      R0: res0,
      D,
      mode: 'ride',
      d: (x._d0 != null ? x._d0 : L) + (100 - clamp(x.pos || 60, 0, 100)) * 0.06 + rf(0, 1.5),
      v: x._v0 || vg,
      t: null,
      fol: null,
      dropped: false,
    };
  });
  const dt = 0.5;
  let t = 0;
  const frames = [],
    events = [];
  let leader = null;
  const name = a => riderName(a.x.r);
  for (let k = 0; k < 2400 && R_.some(a => a.t == null); k++) {
    const live = R_.filter(a => a.t == null).sort((a, b) => a.d - b.d);
    if (k % 2 === 0) {
      frames.push(R_.map(a => Math.max(0, +(a.t == null ? a.d : 0).toFixed(1))));
      const lead = live[0];
      if (lead && lead !== leader && lead.d < 450 && !R_.some(a => a.t != null)) {
        if (leader) events.push({ t, txt: `🔝 ${name(lead)} passe en tête à ${Math.round(lead.d / 10) * 10} m !` });
        leader = lead;
      }
    }
    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      let want = a.role ? a.vi * 0.97 : a.vi;
      if (a.mode === 'ride' && !a.role && a.d <= a.D && a.R > 0.12) {
        a.mode = 'att';
        if (a.D > 230)
          events.push({
            t,
            id: a.x.id,
            txt: `⚡ ${name(a)} attaque à ${a.d >= 1000 ? (a.d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(a.d / 10) * 10 + ' m'} !`,
          });
      }
      if (a.mode === 'att') {
        want = a.vi * (1 + surge);
        a.R -= surge * kF * dt;
        if (a.R <= 0) {
          a.R = 0;
          a.mode = 'spent';
        }
      } else if (a.mode === 'spent') want = a.vi * 0.99;
      // la roue à tenir : le rival choisi (jusqu'à 30 m devant) ou le coureur juste devant (moins de 4 m)
      let tgt = null;
      if (a.x.climbPlan === 'follow' && a.x.followId != null) {
        const rv = live.find(y => y.x.id === a.x.followId);
        if (rv && rv.d < a.d && a.d - rv.d < 30) tgt = rv;
      }
      if (!tgt && i > 0 && a.d - live[i - 1].d < 4) tgt = live[i - 1];
      if (tgt && !a.role && a.mode !== 'spent' && tgt.v > want) {
        const need = tgt.v + (a.d - tgt.d > 2.5 ? 0.25 : 0);
        const q = need / a.vi - 1 - draft;
        const cost = Math.max(0, q) * kF * dt;
        if (q <= 0) want = need;
        else if (a.R >= cost) {
          want = need;
          a.R -= cost;
          a.fol = tgt;
        } else if (!a.dropped && a.fol) {
          a.dropped = true;
          if (a.d < L * 0.9)
            events.push({
              t,
              id: a.x.id,
              txt: `💥 ${name(a)} lâche prise à ${a.d >= 1000 ? (a.d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(a.d / 10) * 10 + ' m'}.`,
            });
        }
      }
      a.v = want;
      const nd = a.d - a.v * dt;
      if (nd <= 0) a.t = t + a.d / a.v;
      a.d = nd;
    }
    t += dt;
  }
  const res = new Map();
  for (const a of R_) {
    res.set(a.x, a.t == null ? t + 10 : a.t);
    a.x._d0 = a.x._v0 = null;
    a.x.wbal = Math.max(0, (a.x.wbal || 0) * (a.R / Math.max(0.01, a.R0)));
    if (a.x.climbPlan) a.x._cp = a.x.climbPlan === 'last' ? (climbKick(a.x) >= 0 ? 'last+' : 'last-') : 'follow';
    if (a.x.climbPlan === 'follow') a.x._cpRival = sim.runners.find(y => y.id === a.x.followId) || null;
  }
  // retransmission : les 10 premiers et mes coureurs
  const fin = R_.slice().sort((a, b) => res.get(a.x) - res.get(b.x));
  const keep = fin.filter((a, i) => i < 10 || a.x.player).slice(0, 14);
  const idx = keep.map(a => R_.indexOf(a));
  const ids = new Set(keep.map(a => a.x.id));
  const t0 = res.get(fin[0].x);
  const w = fin[0],
    s2 = fin[1];
  const g2 = s2 ? res.get(s2.x) - t0 : 0;
  const lc = sim.P.climbs.filter(c => c.end >= sim.dist - 0.5).slice(-1)[0];
  const top = lc ? ` au sommet de ${lc.name}` : '';
  const wn = `${name(w)} (${w.x.team.short})`;
  sim._climbTrace = {
    dt: 1,
    from: Math.round(L / 50) * 50,
    speed: Math.max(4, (frames.length * 1) / 10),
    riders: keep.map(a => ({
      id: a.x.id,
      n: name(a),
      t: a.x.team.short,
      c: a.x.team.color,
      me: !!a.x.player,
      gap: +((res.get(a.x) - t0) * a.vi).toFixed(1),
    })),
    frames: frames.map(f => idx.map(j => f[j])),
    events: events.filter(e => e.id == null || ids.has(e.id)).map(e => ({ t: e.t, txt: e.txt })),
    win: !s2
      ? `🏆 ${wn} s'impose${top} !`
      : g2 < 0.5
        ? `🏆 ${wn} s'impose${top} ! ${name(s2)} échoue d'un souffle.`
        : `🏆 ${wn} s'impose${top}, ${fmtGap(g2).replace(/^\+/, '')} devant ${name(s2)} !`,
  };
  return res;
}
// Arrivée simulée au détail : les points du grimpeur et le chrono de la montée finale (le groupe ne franchit
// pas le sommet dans la boucle de course ordinaire).
function climbSummitCredit(sim, ord) {
  sim.klimbs.forEach((c, ci) => {
    if (c.done || c.end < sim.dist - 0.5) return;
    const pts = komPts(sim.rc, c, true);
    for (const [x] of ord) if (c.order.length < pts.length && !c.order.includes(x.id)) c.order.push(x.id);
    if (c.len >= 1.5) {
      c.perf = c.perf || [];
      for (const [x] of ord)
        if (x.cs && x.cs[ci] !== undefined && !c.perf.some(e => e.id === x.id))
          c.perf.push({ id: x.id, dur: x.time - x.cs[ci] });
    }
  });
}
// Ordres de final en côte du directeur sportif (climbOrder), appliqués au temps sur la ligne : en montée, les
// coureurs arrivent souvent un par un. Attendre la fin fait gagner jusqu'à 2 s à un puncheur explosif (collines >
// montagne) qui a gardé du jus, et coûte jusqu'à 2,5 s à un pur grimpeur, que les puncheurs sautent ; suivre un
// rival (marqué pendant la montée) colle au temps de celui-ci s'il est à portée (10 s), coûte 2 à 6 s si on
// s'est mis dans le rouge à vouloir tenir la roue d'un plus fort, et on le bat dans le
// même groupe si on a plus de punch. Personne ne repasse un coureur arrivé à un pas précédent, ni le vainqueur
// annoncé. Aucun tirage.
// Gain (s) d'un « attends la fin » pour ce coureur : explosivité (collines - montagne) et jus restant.
function climbKick(x) {
  return clamp((x.r.s.col - x.r.s.mon) * 0.12 + (x.punch - 60) * 0.03, -2.5, 2);
}
function climbPlans(sim, ord) {
  // plancher : les coureurs arrivés aux pas précédents, et le vainqueur déjà annoncé (photo-finish)
  const t0 = sim.t * 60;
  const prev = sim.finish.filter(y => y.time <= t0 + 1e-6).map(y => y.time);
  const floor = Math.max(-Infinity, ...prev, sim.finish.length ? sim.finish[0].time + 0.1 : -Infinity);
  let any = false;
  for (const [x] of ord) {
    if (x.climbPlan === 'last') {
      const d = climbKick(x);
      x.time = Math.max(floor, x.time - d);
      x._cp = d >= 0 ? 'last+' : 'last-';
      any = true;
    } else if (x.climbPlan === 'follow') {
      const rv = sim.runners.find(y => y.id === x.followId);
      x._cpRival = rv || null;
      if (!rv || rv.dnf) continue;
      x._cp = 'follow';
      const same = ord.some(a => a[0] === rv);
      if (!rv.fin && !same) continue; // le rival est derrière
      const tgt = same ? rv.time + 0.3 - (x.punch - rv.punch) * 0.03 : rv.time + 0.5;
      if (x.time > tgt) {
        if (x.time - tgt > 10) {
          x._cp = 'gone'; // trop fort pour lui : à vouloir tenir sa roue, il s'est mis dans le rouge
          x.time = Math.max(floor, x.time + Math.min(6, (x.time - tgt - 10) * 0.3 + 2));
        } else x.time = Math.max(floor, tgt, x.time - 4);
      } else if (same && tgt < x.time) x.time = tgt;
      any = true;
    }
  }
  return any;
}
function climbPlanLog(sim, ord) {
  for (const [x] of ord) {
    if (!x.player || !x._cp || x._cpLogged) continue;
    x._cpLogged = true;
    const nm = riderName(x.r),
      rv = x._cpRival;
    if (x._cp === 'last+')
      log(sim, `📻 ${nm} : « J'avais gardé du jus, j'ai tout donné dans les 300 derniers mètres ! »`, 'me');
    else if (x._cp === 'last-')
      log(sim, `📻 ${nm} : « J'ai attendu, mais les puncheurs ont été plus explosifs que moi… »`, 'bad');
    else if (x._cp === 'gone')
      log(sim, `📻 ${nm} : « ${riderName(rv.r)} était trop fort : à vouloir tenir sa roue, j'ai explosé. »`, 'bad');
    else if (rv) {
      const beat =
        !rv.fin ||
        rv.time > x.time ||
        (ord.some(a => a[0] === rv) && ord.findIndex(a => a[0] === x) < ord.findIndex(a => a[0] === rv));
      log(
        sim,
        beat
          ? `📻 ${nm} : « Collé à ${riderName(rv.r)}, je l'ai devancé sur la ligne ! »`
          : `📻 ${nm} : « Je suis resté dans la roue de ${riderName(rv.r)} jusqu'au bout. »`,
        beat ? 'me' : 'info'
      );
    }
  }
}
// Fin d'étape : classement, statistiques, watts, règle des 3 km, désobéissances.
function endStageSim(sim) {
  sim.done = true;
  // filet de sécurité : une photo d'arrivée, même si aucun groupe n'a pu la revendiquer en course
  if (!sim.photo && sim.finish.length) {
    const f = sim.finish.slice().sort((a, b) => a.time - b.time);
    sim.photo = {
      kind: f[1] && f[1].time - f[0].time < 1 ? 'bosse' : 'seul',
      ord: f.slice(0, 10).map(x => ({ id: x.id, s: 0 })),
    };
  }
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
        drop: x.st.drop,
        sp: x._sp
          ? {
              ...x._sp,
              boxed: !!x._boxed,
              early: !!x._early,
              lost: !!x._lost,
              surf: !!x._surf,
              cut: x._cut ? riderName(x._cut.r) : null,
              spr: x.r.s.spr,
            }
          : null,
        why: x.st.disobWhy || null,
      };
  }
  rc._brk = breakRecord(sim);
  rc._moments = decisiveMoments(sim).map(h => ({ km: h.km, txt: h.txt, mine: h.mine }));
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
