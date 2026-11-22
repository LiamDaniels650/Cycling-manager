/* Préparation des courses : sélection, consignes et plans des équipes IA */
function raceSize(cal) {
  return cal.key === 'gb' ? 8 : 7;
}
// Démarre une course : sélections, classements, consignes initiales.
function startRace(calIdx, playerSel) {
  // sélections des équipes IA : série de hasard propre à la course
  return withSeed({ sd: stageSeed(S.cal[calIdx], -2) }, () => setupRace(calIdx, playerSel));
}
function setupRace(calIdx, playerSel) {
  const cal = S.cal[calIdx];
  const specs = prepareRaceSpecs(cal);
  const rc = {
    calIdx,
    key: cal.key,
    name: cal.name,
    cat: cal.cat,
    specs,
    si: 0,
    sel: {},
    orders: {},
    gc: {},
    pts: {},
    kom: {},
    energy: {},
    out: {},
    stageRes: [],
    done: false,
  };
  for (const T of S.teams) {
    const ids = T.player ? playerSel.slice() : cal.inv && !cal.inv.includes(T.id) ? [] : aiSelect(T, cal, specs);
    rc.sel[T.id] = ids;
    for (const id of ids) {
      rc.gc[id] = 0;
      rc.pts[id] = 0;
      rc.kom[id] = 0;
      rc.energy[id] = 100;
    }
  }
  rc.orders = {};
  rc.plan = {};
  rc.conds = {};
  S.weekUsed = S.weekUsed || {};
  const wu = (S.weekUsed[cal.w] = S.weekUsed[cal.w] || []);
  for (const T of S.teams) for (const id of rc.sel[T.id]) if (!wu.includes(id)) wu.push(id);
  S.rc = rc;
  return rc;
}
// Coureurs d'une équipe disponibles cette semaine (ni blessés, ni déjà engagés ailleurs).
function availableRiders(T, w) {
  const used = (S.weekUsed && w != null && S.weekUsed[w]) || [];
  return T.riders.map(id => S.riders[id]).filter(r => r.injury <= 0 && !used.includes(r.id));
}
// Sélection d'une équipe pour une course, adaptée au profil des étapes.
function aiSelect(T, cal, specs) {
  const n = raceSize(cal);
  // un coureur court au plus la moitié du calendrier environ (sauf un leader IA sur son Grand Tour cible) ;
  // la sélection proposée au joueur suit la même rotation (il reste libre de choisir autrement)
  const daysSoFar = sum(S.cal.filter(c => c.done).map(c => c.stagesSpec.length));
  // la course comptée d'avance : sans cela, un coureur juste sous la limite partait sur un Grand Tour et finissait
  // la saison à près de 100 jours (les plus chargés du peloton réel en font 85 à 89)
  const len = cal.stagesSpec.length;
  const overRaced = r =>
    r.stats.days + len > (daysSoFar + len) * 0.5 + R.daysSlackAI &&
    !(cal.cat === 0 && T.goals && T.goals.gt === cal.key);
  let rs = availableRiders(T, cal.w).filter(r => T.player || !aiRestForGt(T, cal, r));
  if (rs.filter(r => !overRaced(r)).length >= n) rs = rs.filter(r => !overRaced(r));
  const w = { pla: 0, mon: 0, col: 0, spr: 0, clm: 0, pav: 0 };
  for (const sp of specs) {
    const t = sp.type;
    if (sp.segs && sp.segs.some(s => s[2] && s[1] > 4)) w.col += 1;
    if (t === 'plat') {
      w.spr += 1;
      w.pla += 1;
    } else if (t === 'vallonne') {
      w.col += 1;
      w.pla += 0.5;
    } else if (t === 'punch') {
      w.col += 1.5;
    } else if (t === 'montagne' || t === 'sommet') {
      w.mon += 1.5;
    } else if (t === 'paves') {
      w.pav += 1.5;
      w.pla += 0.5;
    } else if (t === 'clm' || t === 'clmeq') {
      w.clm += 0.8;
      w.pla += t === 'clmeq' ? 0.5 : 0;
    }
  }
  const score = r => {
    let s = 0,
      tw = 0;
    for (const k in w) {
      s += r.s[k] * w[k];
      tw += w[k];
    }
    return (s / tw) * (0.85 + (0.15 * r.forme) / 100) - r.fatigue * 0.25 + rnd() * 2;
  };
  rs.sort((a, b) => score(b) - score(a));
  // garder un sprinteur si étapes plates
  const sel = rs.slice(0, n);
  if (w.spr > 0) {
    const bestS = rs.slice().sort((a, b) => b.s.spr - a.s.spr)[0];
    if (bestS && !sel.includes(bestS) && bestS.s.spr >= 72) {
      sel[sel.length - 1] = bestS;
    }
  }
  if (S.car) carSelHook(T, cal, sel, rs); // mode carrière : la sélection du joueur suit son programme
  return sel.map(r => r.id);
}
// Situation au général d'un coureur, vue par son directeur sportif : rang, retard, avance s'il porte le maillot,
// étapes clés restantes (montagne, arrivées au sommet, chronos) et s'il est encore dans la course au général.
function gcSituation(rc, id) {
  const g = gcList(rc);
  const rank = leaderGcRank(rc, id) || g.length;
  const gap = g.length ? rc.gc[id] - rc.gc[g[0]] : 0;
  const lead = rank === 1 && g.length > 1 ? rc.gc[g[1]] - rc.gc[id] : 0;
  const remKey = rc.specs.slice(rc.si).filter(s => ['montagne', 'sommet', 'clm'].includes(s.type)).length;
  const gt = rc.specs.length > 15;
  // encore jouable : le retard se reprend en montagne et en chrono (environ 1 min par étape clé en Grand Tour)
  const alive =
    rc.si === 0 || gap <= 30 || (rank <= (gt ? 12 : 8) && gap <= (gt ? 120 + 75 * remKey : 45 + 30 * remKey));
  return { rank, gap, lead, remKey, alive, gt };
}
// Façon de courir du leader selon l'étape et le général (ce que lui demanderait son directeur sportif).
function leaderAtt(r, rc, t, stageRace) {
  const pers = r.amb > 75 || r.trait === 'tete' ? 'loin' : r.amb < 35 ? 'defensif' : 'final';
  if (!stageRace) return pers;
  const s = gcSituation(rc, r.id);
  const key = t === 'montagne' || t === 'sommet';
  // étape de transition : rester devant, à l'abri, sans se découvrir (sauf arrivée en bosse qui lui convient)
  if (!key) return t === 'punch' && r.s.col >= 78 ? 'final' : 'defensif';
  if (rc.si > 0 && s.rank === 1) return s.lead > 60 ? 'defensif' : 'final';
  // en retard avec peu d'étapes clés : il faut attaquer de loin
  if (rc.si > 0 && s.gap > 60 && s.remKey <= 2) return 'loin';
  // en Grand Tour, attaquer de loin reste l'affaire des têtes brûlées
  return r.trait === 'tete' ? 'loin' : 'final';
}
// consignes automatiques (IA & suggestion joueur)
function autoOrders(teamId, spec, rc) {
  const ids = rc.sel[teamId].filter(id => !rc.out[id]);
  const rs = ids.map(id => S.riders[id]);
  const o = {};
  if (!rs.length) return o;
  const t = spec.type,
    stageRace = rc.specs.length > 1;
  if (isTTT(spec)) {
    for (const r of rs) o[r.id] = { o: 'ttt' };
    return o;
  }
  if (isITT(spec)) {
    let gcLeader = null;
    if (stageRace) {
      gcLeader = rs.slice().sort((a, b) => rc.gc[a.id] - rc.gc[b.id])[0];
    }
    for (const r of rs) o[r.id] = { o: 'itt', itt: !stageRace || r === gcLeader || r.s.clm >= 74 ? 'fond' : 'gerer' };
    return o;
  }
  const sc = (r, k) => r.s[k] * (0.85 + (0.15 * r.forme) / 100);
  let leader = null,
    sprinter = null,
    hunting = false;
  if (stageRace) {
    const minGc = Math.min(...rs.map(r => rc.gc[r.id]));
    const remMount = rc.specs.slice(rc.si).filter(s => s.type === 'montagne' || s.type === 'sommet').length;
    const pot = r =>
      sc(r, 'mon') * (remMount ? 0.65 : 0.3) +
      sc(r, 'clm') * 0.25 +
      sc(r, 'col') * (remMount ? 0.1 : 0.45) -
      ((rc.gc[r.id] - minGc) / 60) * (remMount > 3 ? 0.6 : 1.5);
    leader = rs.slice().sort((a, b) => pot(b) - pot(a))[0];
    // leader hors du coup au général : l'équipe passe en chasse aux étapes
    if (rc.si > 0 && !gcSituation(rc, leader.id).alive) {
      leader = null;
      hunting = true;
    }
  }
  const key = t === 'plat' ? 'spr' : t === 'paves' ? 'pav' : t === 'punch' || t === 'vallonne' ? 'col' : 'mon';
  const bestKey = rs.slice().sort((a, b) => sc(b, key) - sc(a, key))[0];
  // classique d'un jour : le leader est le meilleur sur le final du parcours (pas sur une seule caractéristique),
  // et un équipier presque aussi fort garde sa carte (co-leader, « carte libre ») au lieu de travailler
  const classic = !stageRace && (t === 'paves' || t === 'vallonne' || t === 'punch');
  let bestCourse = bestKey,
    coLeads = [],
    cs = null;
  if (classic) {
    const csc = courseScorer(buildProfile(spec));
    cs = new Map(rs.map(r => [r, csc({ r, dayForm: r.forme })]));
    const byC = rs.slice().sort((a, b) => cs.get(b) - cs.get(a));
    bestCourse = byC[0];
    coLeads = byC.slice(1, 1 + R.classicCoLeaders).filter(r => cs.get(r) >= cs.get(byC[0]) - R.classicCoGap);
  }
  if (t === 'plat' || (t === 'vallonne' && rnd() < 0.65)) {
    const bs = rs.slice().sort((a, b) => sc(b, 'spr') - sc(a, 'spr'))[0];
    if (bs.s.spr >= 70) sprinter = bs;
  }
  // classique accidentée : on ne joue le sprint que si le sprinteur peut suivre sur ce parcours (pas à Liège)
  if (classic && sprinter && cs.get(sprinter) < cs.get(bestCourse) - R.classicCoGap) sprinter = null;
  // arrivée en bosse d'une course par étapes : le meilleur puncheur (s'il n'est pas le leader) a sa carte à jouer
  if (stageRace && t === 'punch' && !sprinter) {
    const bp = rs.filter(r => r !== leader).sort((a, b) => sc(b, 'col') - sc(a, 'col'))[0];
    if (bp && bp.s.col >= 76 && (!leader || bp.s.col >= leader.s.col + 2)) sprinter = bp;
  }
  // chasse aux étapes en montagne : le meilleur grimpeur part dans l'échappée plutôt que de suivre les favoris
  // (un jour sur trois environ, et seulement pour un vrai grimpeur largement distancé au général)
  const hunter =
    hunting &&
    (t === 'montagne' || t === 'sommet') &&
    bestKey.s.mon >= 78 &&
    leaderGcRank(rc, bestKey.id) > 20 &&
    rnd() < 0.35
      ? bestKey
      : null;
  if (!leader && !hunter) leader = t === 'plat' && sprinter ? null : bestCourse;
  if (leader === sprinter) leader = null;
  coLeads = coLeads.filter(r => r !== leader && r !== sprinter);
  let rest = rs.filter(r => r !== leader && r !== sprinter && r !== hunter && !coLeads.includes(r));
  // les coureurs envoyés dans l'échappée dépendent du terrain : grimpeurs en montagne, puncheurs sur les étapes accidentées
  const brkScore = r =>
    t === 'montagne' || t === 'sommet'
      ? r.s.bar * 0.45 + r.s.mon * 0.55
      : t === 'vallonne' || t === 'punch'
        ? r.s.bar * 0.55 + r.s.col * 0.45
        : r.s.bar;
  rest.sort((a, b) => brkScore(b) - brkScore(a));
  let nBreak =
    t === 'montagne' || t === 'sommet' || t === 'vallonne'
      ? (rnd() < 0.75 ? 1 : 0) + (rnd() < 0.3 ? 1 : 0)
      : rnd() < 0.45
        ? 1
        : 0;
  const T_ = teamById(teamId);
  if (T_ && rnd() < (styleMul(T_, 'break') - 1) * 0.8) nBreak++;
  if (T_ && T_.style === 'defensif' && nBreak > 0 && rnd() < 0.5) nBreak--;
  if (sprinter && t === 'plat') nBreak = 0;
  if (leader && rc.si > 0 && leaderGcRank(rc, leader.id) <= 3) nBreak = Math.min(nBreak, 1);
  // équipe qui a renoncé au général (grand tour, leader trop loin) : elle place des hommes dans les échappées
  if (rc.stageHunt && rc.stageHunt[teamId] && t !== 'plat' && t !== 'clm' && t !== 'clmeq')
    nBreak = Math.max(nBreak, 2);
  // le prétendant au maillot vert (trois premiers du classement par points, rapide) part chercher les points du
  // sprint intermédiaire dans l'échappée sur une étape accidentée, où il ne disputera pas l'arrivée
  if (stageRace && rc.si > 0 && (t === 'vallonne' || t === 'punch')) {
    const pr = rest.find(r => {
      const k = jerseyRank(rc, rc.pts || {}, r.id);
      return k && k <= 3 && r.s.spr >= 70 && (!leader || r.id !== leader.id);
    });
    if (pr && rest.indexOf(pr) >= nBreak && fixedRnd(pr.id + rc.si * 31) < 0.5) {
      rest.splice(rest.indexOf(pr), 1);
      rest.unshift(pr);
      nBreak = Math.max(nBreak, 1);
    }
  }
  // le chasseur de maillot de la montagne de l'équipe prend l'échappée dès qu'il y a des cols à grimper
  if (stageRace && (t === 'montagne' || t === 'sommet' || (t === 'vallonne' && rc.specs.length > 15))) {
    const hid = komHunter(rc, teamId, rest, leader);
    const ko = rest.find(r => r.id === hid);
    if (ko && rest.indexOf(ko) >= nBreak) {
      rest.splice(rest.indexOf(ko), 1);
      rest.unshift(ko);
      nBreak = Math.max(nBreak, 1);
    }
  }
  // un coureur du top 10 au général ne part pas dans l'échappée : le peloton ne le laisserait pas filer
  if (stageRace && rc.si > 0) {
    const gcTop = r => {
      const k = leaderGcRank(rc, r.id);
      return k > 0 && k <= 10;
    };
    rest = rest.filter(r => !gcTop(r)).concat(rest.filter(gcTop));
  }
  const breakers = rest.slice(0, nBreak);
  let others = rest.slice(nBreak);
  const saves = [];
  if (stageRace) {
    // montagne : les sprinteurs (et les rouleurs lourds) survivent dans le gruppetto
    if (t === 'montagne' || t === 'sommet') for (const r of others) if (r.s.spr >= 74 && r.s.mon < 70) saves.push(r);
    // transition : les grimpeurs équipiers du leader se préservent pour la montagne
    const gcLeader = leader && rc.si > 0 ? gcSituation(rc, leader.id) : null;
    if ((t === 'plat' || t === 'vallonne') && leader && (rc.si === 0 || gcLeader.alive) && sim0Key(rc))
      others
        .filter(r => r.s.mon >= 74 && !saves.includes(r))
        .sort((a, b) => b.s.mon - a.s.mon)
        .slice(0, 2)
        .forEach(r => saves.push(r));
    others = others.filter(r => !saves.includes(r));
  }
  // relais devant : en Grand Tour, une équipe dont le leader joue le podium place un équipier grimpeur dans
  // l'échappée d'une étape de montagne, pour l'aider plus loin si le leader attaque
  let sat = null;
  if (stageRace && rc.specs.length > 15 && t === 'montagne' && leader && rc.si > 0) {
    const gs = gcSituation(rc, leader.id);
    if (gs.alive && gs.rank <= 5 && !breakers.length) {
      sat = others.filter(r => r.s.mon >= 72).sort((a, b) => b.s.mon - a.s.mon)[0] || null;
      if (sat) others = others.filter(r => r !== sat);
    }
  }
  others.sort((a, b) => b.s.pla - a.s.pla);
  let nControl = sprinter ? 2 : leader && stageRace && rc.si > 0 && leaderGcRank(rc, leader.id) === 1 ? 2 : 1;
  let nLead = sprinter ? 1 : 0;
  for (const r of others) {
    if (sprinter && nLead > 0 && r.s.spr >= 60 && r.s.pla >= 68) {
      o[r.id] = { o: 'leadout' };
      nLead--;
      continue;
    }
    if (nControl > 0) {
      o[r.id] = { o: 'control' };
      nControl--;
      continue;
    }
    o[r.id] = { o: leader ? 'protect' : sprinter ? 'protect' : 'free' };
  }
  for (const r of breakers) o[r.id] = { o: 'break' };
  if (hunter) o[hunter.id] = { o: 'break' };
  for (const r of saves) o[r.id] = { o: 'save' };
  if (sat) o[sat.id] = { o: 'break', sat: true };
  if (leader) {
    // un maillot jaune avec une avance confortable court en patron : il contrôle au lieu d'attaquer
    let comfy = false;
    if (stageRace && rc.si > 0 && leaderGcRank(rc, leader.id) === 1) {
      const g = gcList(rc);
      comfy = g.length > 1 && rc.gc[g[1]] - rc.gc[leader.id] > 150;
    }
    o[leader.id] = { o: 'leader', att: comfy ? 'defensif' : leaderAtt(leader, rc, t, stageRace) };
  }
  if (sprinter) o[sprinter.id] = { o: 'sprint' };
  for (const r of coLeads) o[r.id] = { o: 'free' };
  return o;
}
// Chasseur de maillot de la montagne d'une équipe, pour toute la course par étapes : un coureur déjà bien placé
// au classement de la montagne, ou, pour une équipe sans ambition au général, son meilleur grimpeur (une équipe
// sur deux environ fait ce choix, à partir de la troisième étape). Il vise le maillot jour après jour.
function komHunter(rc, teamId, rest, leader) {
  rc.komHunt = rc.komHunt || {};
  const cur = rc.komHunt[teamId];
  if (cur != null && !rc.out[cur] && rest.some(r => r.id === cur)) return cur;
  const ranked = rest.find(r => {
    const k = jerseyRank(rc, rc.kom, r.id);
    return k && k <= 3 && r.s.mon >= 68;
  });
  if (ranked) return (rc.komHunt[teamId] = ranked.id);
  if (rc.si < 1 || cur === -1) return null;
  const gcDead = !leader || !gcSituation(rc, leader.id).alive;
  const climber = rest.filter(r => r.s.mon >= R.hunterMon).sort((a, b) => b.s.mon - a.s.mon)[0];
  // décision prise une fois pour toutes (hasard figé par équipe et par course)
  const yes = gcDead && climber && (teamId * 7919 + rc.key.length * 31) % 100 < R.hunterShare;
  rc.komHunt[teamId] = yes ? climber.id : -1;
  return yes ? climber.id : null;
}
// Les consignes automatiques expliquées comme le ferait le directeur sportif dans le bus.
function ordersExplain(rc, o) {
  const nm = id => riderName(S.riders[id]);
  const by = k => Object.keys(o).filter(id => o[id].o === k);
  const L = [];
  const ld = by('leader')[0];
  if (ld) {
    const why = { defensif: 'à l’abri, sans se découvrir', final: 'attaque dans le final', loin: 'attaque de loin' }[
      o[ld].att
    ];
    const s = rc.specs.length > 1 && rc.si > 0 ? gcSituation(rc, +ld) : null;
    L.push(`${nm(ld)} leader (${why}${s ? `, ${s.rank === 1 ? 'maillot' : s.rank + 'e du général'}` : ''})`);
  } else if (rc.specs.length > 1 && rc.si > 0) L.push('plus de leader au général : chasse aux étapes');
  const sp = by('sprint');
  if (sp.length) L.push(`${nm(sp[0])} au sprint${by('leadout').length ? ' avec son poisson-pilote' : ''}`);
  const br = by('break');
  const sat = br.filter(id => o[id].sat);
  if (br.length - sat.length)
    L.push(
      `${br
        .filter(id => !o[id].sat)
        .map(nm)
        .join(', ')} dans l'échappée`
    );
  if (sat.length) L.push(`${nm(sat[0])} devant en relais pour le leader`);
  const sv = by('save');
  if (sv.length) L.push(`${sv.map(nm).join(', ')} se préserve${sv.length > 1 ? 'nt' : ''}`);
  return L.join(' ; ');
}
// Une étape clé (montagne, arrivée au sommet) arrive-t-elle dans les deux prochains jours ?
function sim0Key(rc) {
  return rc.specs.slice(rc.si + 1, rc.si + 3).some(s => s.type === 'montagne' || s.type === 'sommet');
}
// Rang au général d'un coureur (1 = maillot jaune).
function leaderGcRank(rc, id) {
  return gcCached(rc).rank.get(+id) || 0;
}
// Phase de course d'un groupe : début (<40 %), milieu, final (>80 %).
function phaseOf(sim, G) {
  const f = G.pos / sim.dist;
  return f < 0.4 ? 'debut' : f < 0.8 ? 'milieu' : 'final';
}
// Mode tactique d'une équipe pour la phase en cours (plan de course).
function planMode(sim, T, G) {
  const p = sim.rc.plan && sim.rc.plan[T.id];
  if (!p) return 'neutre';
  return p[phaseOf(sim, G)] || 'neutre';
}
// Plan de course d'une équipe IA selon son style.
function aiPlan(T, spec, rc) {
  const t = spec.type,
    mount = t === 'montagne' || t === 'sommet',
    flat = t === 'plat';
  // selon la situation au général : le maillot contrôle, le retardataire durcit la course
  if (rc && rc.specs.length > 1 && rc.si > 0 && T.riders) {
    const mine = (rc.sel[T.id] || []).filter(id => !rc.out[id]);
    const best = mine.sort((a, b) => rc.gc[a] - rc.gc[b])[0];
    if (best != null && mount) {
      const s = gcSituation(rc, best);
      if (s.rank === 1) return { debut: 'controle', milieu: 'controle', final: s.lead > 30 ? 'controle' : 'durcir' };
      // les dernières étapes de montagne : un prétendant en retard fait durcir la course
      if (s.alive && s.rank <= 5 && s.gap > 60 && s.remKey <= 2)
        return { debut: 'neutre', milieu: s.remKey <= 1 ? 'durcir' : 'neutre', final: 'durcir' };
    }
  }
  switch (T.style) {
    case 'agressif':
      return { debut: 'offensif', milieu: 'neutre', final: 'offensif' };
    case 'gc':
      return { debut: 'neutre', milieu: 'neutre', final: mount ? 'durcir' : 'neutre' };
    case 'sprint':
      return { debut: 'neutre', milieu: flat ? 'controle' : 'neutre', final: flat ? 'controle' : 'neutre' };
    case 'defensif':
      return { debut: 'attente', milieu: 'neutre', final: 'neutre' };
    case 'opportuniste':
      return { debut: 'offensif', milieu: 'attente', final: 'offensif' };
  }
  return { debut: 'neutre', milieu: 'neutre', final: 'neutre' };
}
// Multiplicateur de comportement selon le style d'équipe (attaque, poursuite, échappée).
function styleMul(T, k) {
  const s = T.style;
  if (k === 'att') return s === 'agressif' ? 1.5 : s === 'defensif' ? 0.6 : s === 'opportuniste' ? 1.2 : 1;
  if (k === 'chase')
    return (
      (s === 'defensif' ? 1.15 : s === 'sprint' ? 1.1 : s === 'agressif' ? 0.9 : 1) *
      (COAL && COAL.has(T.id) ? 1.25 : 1) // coalition : ils durcissent la course pour user le leader
    );
  if (k === 'break')
    return s === 'agressif' ? 1.6 : s === 'opportuniste' ? 1.4 : s === 'defensif' ? 0.6 : s === 'gc' ? 0.8 : 1;
  return 1;
}
