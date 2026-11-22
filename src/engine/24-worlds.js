/* Championnats du monde : course d'un jour par sélections nationales (simulée ; le joueur peut demander un rôle pour ses coureurs). */
const NAT_NAME = {
  FRA: 'France',
  BEL: 'Belgique',
  NED: 'Pays-Bas',
  ITA: 'Italie',
  ESP: 'Espagne',
  GER: 'Allemagne',
  DEN: 'Danemark',
  GBR: 'Grande-Bretagne',
  COL: 'Colombie',
  POL: 'Pologne',
  SLO: 'Slovénie',
  SUI: 'Suisse',
  NOR: 'Norvège',
  AUS: 'Australie',
};
const WORLDS_NATIONS = 14,
  WORLDS_PER_NATION = 6;
// Adéquation d'un coureur au parcours du jour (sélectionneur national : talent du terrain + forme).
function worldsFit(r, specs) {
  let s = 0;
  for (const sp of specs) {
    const t = sp.type;
    s +=
      t === 'plat'
        ? r.s.spr * 0.6 + r.s.pla * 0.4
        : t === 'montagne' || t === 'sommet'
          ? r.s.mon
          : t === 'clm'
            ? r.s.clm
            : r.s.col * 0.55 + r.s.pla * 0.2 + r.s.spr * 0.1 + r.s.end * 0.15;
  }
  return s / specs.length + (r.forme - 60) * 0.25 - r.fatigue * 0.1;
}
// Sélections nationales : les meilleures nations du moment, six coureurs chacune.
function worldsSelections(cal, specs) {
  const used = (S.weekUsed && S.weekUsed[cal.w]) || [];
  const by = {};
  for (const id in S.riders) {
    const r = S.riders[id];
    if (r.retired || r.team === null || r.aca || r.injury > 0 || used.includes(r.id) || r.age < 19) continue;
    (by[r.nat] = by[r.nat] || []).push(r);
  }
  const nats = Object.entries(by)
    .map(([nat, rs]) => {
      rs.sort((a, b) => worldsFit(b, specs) - worldsFit(a, specs));
      const top = rs.slice(0, cal.per || WORLDS_PER_NATION);
      return { nat, ids: top.map(r => r.id), str: sum(top.slice(0, 3).map(r => worldsFit(r, specs))) };
    })
    .filter(n => n.ids.length >= Math.min(3, cal.per || 3))
    .sort((a, b) => b.str - a.str)
    .slice(0, WORLDS_NATIONS);
  return nats;
}
// Court les Mondiaux de bout en bout : équipes nationales le temps de la course, puis retour aux équipes de marque.
function runWorlds(i) {
  const cal = S.cal[i];
  const specs = prepareRaceSpecs(cal);
  const nats = worldsSelections(cal, specs);
  const saveTeams = S.teams;
  const saveTeam = {};
  const nTeams = nats.map((n, k) => ({
    id: 900 + k,
    name: 'Équipe ' + (NAT_NAME[n.nat] ? 'de ' + NAT_NAME[n.nat] : n.nat),
    short: n.nat,
    nat: n.nat,
    player: false,
    riders: n.ids,
    style: 'gc',
    eq: { bike: null, tt: null },
  }));
  let rc;
  try {
    S.teams = nTeams;
    for (const T of nTeams)
      for (const id of T.riders) {
        saveTeam[id] = S.riders[id].team;
        S.riders[id].team = T.id;
      }
    rc = {
      calIdx: i,
      key: cal.key,
      name: cal.name,
      cat: cal.cat,
      worlds: true,
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
      plan: {},
      conds: {},
      natRank: {},
      wish: S.worldsWish && S.worldsWish.s === S.season ? { ...S.worldsWish.w } : {},
    };
    for (const n of nats) n.ids.forEach((id, k) => (rc.natRank[id] = k + 1));
    S.weekUsed = S.weekUsed || {};
    const wu = (S.weekUsed[cal.w] = S.weekUsed[cal.w] || []);
    for (const T of nTeams) {
      rc.sel[T.id] = T.riders.slice();
      for (const id of T.riders) {
        rc.gc[id] = rc.pts[id] = rc.kom[id] = 0;
        rc.energy[id] = 100;
        if (!wu.includes(id)) wu.push(id);
      }
    }
    S.rc = rc;
    let k = 0;
    while (!rc.done && k++ < 10) runStageAuto(rc);
  } finally {
    S.teams = saveTeams;
    for (const id in saveTeam) S.riders[id].team = saveTeam[id];
    S.rc = null;
  }
  worldsAfter(rc, nTeams);
  return rc;
}
// Demandes du directeur sportif au sélectionneur pour ses coureurs : le rôle de leader n'est accordé
// qu'aux deux meilleurs de la sélection ; sinon le coureur reçoit une carte libre.
const WORLDS_WISH = {
  auto: 'Au choix du sélectionneur',
  leader: 'Demander le rôle de leader',
  free: 'Carte libre',
  protect: 'Équipier',
};
function applyWorldsWish(rc) {
  rc.wishRes = rc.wishRes || {};
  for (const sid in rc.wish) {
    const id = +sid,
      want = rc.wish[sid];
    if (!rc.natRank[id] || rc.out[id] || want === 'auto') continue;
    let got = want;
    if (want === 'leader' && rc.natRank[id] > 2) got = 'free';
    if (got === 'leader') {
      const T = S.riders[id].team;
      for (const o of rc.sel[T])
        if (o !== id && rc.orders[o] && rc.orders[o].o === 'leader') rc.orders[o] = { ...rc.orders[o], o: 'protect' };
    }
    rc.orders[id] = { ...(rc.orders[id] || {}), o: got, att: (rc.orders[id] && rc.orders[id].att) || 'final' };
    rc.wishRes[id] = got;
  }
}
function setWorldsWish(id, v) {
  if (!S.worldsWish || S.worldsWish.s !== S.season) S.worldsWish = { s: S.season, w: {} };
  S.worldsWish.w[id] = v;
}
// Aperçu des sélections, sans tirage aléatoire : vos coureurs retenus et leur rang dans leur sélection.
function worldsPreview(i) {
  const cal = S.cal[i];
  const nats = worldsSelections(
    cal,
    cal.stagesSpec.map(([type]) => ({ type }))
  );
  const out = [];
  for (const n of nats) n.ids.forEach((id, k) => S.riders[id].team === 0 && out.push({ id, nat: n.nat, rank: k + 1 }));
  return out;
}
// Maillot arc-en-ciel, palmarès, historique et presse.
function worldsAfter(rc, nTeams) {
  if (S.cal[rc.calIdx].olympic) return olympicAfter(rc); // Jeux olympiques (64-metier.js)
  const gcl = gcList(rc);
  const natOf = id => S.riders[id].nat;
  gcl.slice(0, 3).forEach((id, k) => palmAdd(id, rc.name, 'Course en ligne', k + 1));
  const w = S.riders[gcl[0]];
  w.rainbow = S.season;
  w.moral = clamp(w.moral + 10, 0, 100);
  w.pop = clamp((w.pop || 30) + 12, 0, 100);
  const nm = id => riderName(S.riders[id]);
  (S.raceHist[rc.key] = S.raceHist[rc.key] || []).push({
    s: S.season,
    pod: gcl.slice(0, 3).map(id => ({ id, n: nm(id), t: natOf(id) })),
    pts: null,
    kom: null,
    yg: null,
    stages: null,
  });
  const mine = gcl.filter(id => S.riders[id].team === 0);
  const best = mine[0];
  S.hist.push({
    season: S.season,
    key: rc.key,
    name: rc.name,
    winner: gcl[0],
    podium: gcl.slice(0, 3),
    my: best ? gcl.indexOf(best) + 1 : null,
    myId: best || null,
  });
  const sel = nTeams.reduce((a, T) => a + T.riders.filter(id => S.riders[id].team === 0).length, 0);
  for (const id of mine) {
    const p = gcl.indexOf(id) + 1;
    if (p <= 10) S.riders[id].moral = clamp(S.riders[id].moral + (11 - p), 0, 100);
  }
  const mineW = w.team === 0;
  if (mineW) {
    S.budget += 150;
    finAdd('prize', 150);
  }
  const wishTxt = Object.entries(rc.wishRes || {}).map(([id, got]) => {
    const want = rc.wish[id];
    return `${nm(+id)} : ${want === got ? 'demande acceptée' : 'pas leader (carte libre)'} → ${ORDERS[got].lbl.toLowerCase()}`;
  });
  const lines = [
    `🌈 Champion du monde : <b>${riderName(w)}</b> (${NAT_NAME[w.nat] || w.nat}${teamOf(w) ? ', ' + teamOf(w).short : ''}).`,
    `Podium : ${gcl
      .slice(0, 3)
      .map(id => nm(id) + ' (' + natOf(id) + ')')
      .join(', ')}.`,
    sel
      ? `${sel} de vos coureurs étaient sélectionnés${best ? ` ; meilleur : ${nm(best)}, ${gcl.indexOf(best) + 1}e` : ''}.`
      : `Aucun de vos coureurs n'a été retenu par son sélectionneur national.`,
  ];
  if (wishTxt.length) lines.push('Vos demandes au sélectionneur : ' + wishTxt.join(' ; ') + '.');
  if (mineW)
    lines.push(
      `Votre coureur portera le maillot arc-en-ciel toute la saison prochaine : prestige et prime sponsor (+${fmtMoney(150)}).`
    );
  msg(`Bilan : ${rc.name}`, lines.join('<br>'));
  press(
    `🌈 ${riderName(w)} sacré champion du monde`,
    `${riderName(w)} (${NAT_NAME[w.nat] || w.nat}) s'impose sur un circuit exigeant et portera le maillot arc-en-ciel pendant un an.${mineW ? ' Une consécration pour votre équipe.' : ''}`,
    mineW ? 2 : 0,
    [w.id]
  );
}
// Le coureur porte-t-il le maillot arc-en-ciel (titre de la saison précédente) ?
function wearsRainbow(r) {
  if (!r || r.rainbow == null) return false;
  return r.rainbow === S.season || (r.rainbow === S.season - 1 && !worldsDone());
}
function worldsDone() {
  const c = S.cal.find(x => x.worlds && !x.olympic);
  return !c || c.done;
}

/* Légendes : score de palmarès de carrière (coureurs en activité et retraités). */
const MONUMENTS = ['msr', 'flandres', 'pav', 'liege', 'auto'];
let RACE_BY_NAME = null;
function raceByName(n) {
  if (!RACE_BY_NAME) RACE_BY_NAME = Object.fromEntries(RACE_DEFS.map(d => [d.name, d]));
  return RACE_BY_NAME[n] || raceDefByCustomName(n) || undefined;
}
// Barème : GT 25 (podium 8), monument 15, Mondiaux 15, classique cat. 1 : 6, course par étapes cat. 1 : 8,
// étape de GT 3, maillot distinctif 5 (GT) ou 2, autre victoire 2.
function palmScore(r) {
  let s = 0;
  const c = { gt: 0, mon: 0, worlds: 0, wins: 0 };
  for (const p of r.palm || []) {
    const d = raceByName(p.r);
    if (!d) continue;
    const gt = d.cat === 0,
      one = d.stages.length === 1 && !gt;
    if (p.e === 'Classement général' || p.e === 'Course' || p.e === 'Course en ligne') {
      if (p.k === 1) {
        c.wins++;
        if (gt) {
          s += 25;
          c.gt++;
        } else if (d.olympic) {
          s += 12;
          c.worlds++;
        } else if (d.worlds) {
          s += 15;
          c.worlds++;
        } else if (MONUMENTS.includes(d.key)) {
          s += 15;
          c.mon++;
        } else if (d.cat === 1) s += one ? 6 : 8;
        else s += 2;
      } else if (gt) s += p.k === 2 ? 8 : 6;
      else if (d.worlds || MONUMENTS.includes(d.key)) s += p.k === 2 ? 5 : 3;
    } else if (/^Étape/.test(p.e)) {
      c.wins++;
      s += gt ? 3 : 1;
    } else if (p.k === 1) s += gt ? 5 : 2;
  }
  return { s, ...c };
}
function legends(n = 25) {
  return Object.values(S.riders)
    .map(r => ({ r, ...palmScore(r) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, n);
}
