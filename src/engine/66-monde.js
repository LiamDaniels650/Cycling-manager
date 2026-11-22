/* Un monde qui évolue d'une saison à l'autre (parties longues).
   En fin de saison, rien de systématique ; le plus souvent un ou deux changements :
   - une petite course disparaît faute d'organisateur et une nouvelle naît la même semaine (dans une région
     cycliste : France, Nord, Italie, Espagne, Alpes) ;
   - une course monte en WorldTour pendant qu'une autre redescend (le nombre de grandes courses reste le même) ;
   - une équipe de l'ordinateur change de sponsor (nouveau nom) ; une équipe en difficulté fait faillite et une
     nouvelle structure reprend sa place (la moitié de l'effectif s'en va, de jeunes coureurs arrivent) ;
   - l'UCI annonce une réforme un an à l'avance : taille maximale des effectifs, nombre de licences WorldTour,
     salaire minimum.
   Les grands tours, les monuments, les championnats et les Jeux ne changent jamais. Tout est tiré d'une empreinte
   de la saison (pas du hasard du jeu), et gardé dans S.world : les définitions de courses sont recalculées à partir
   du calendrier de base à chaque nouvelle saison et à chaque chargement. */

const RACE_DEFS_BASE = RACE_DEFS.map(d => ({ ...d }));
const RACE_REG_BASE = { ...RACE_REG };
const WORLD_KEEP = ['gpo', 'gpf', 'natio', 'mondiaux', 'jo', 'jochr', 'chr'];
function worldInit() {
  S.world = S.world || { gone: [], added: [], cat: {}, hist: [], pending: null, lastReform: null, teamNames: [] };
  return S.world;
}
// Définitions de courses de la partie : calendrier de base, moins les courses disparues, plus les nouvelles,
// catégories revues. Appelée avant chaque calendrier et au chargement.
function worldApply() {
  const W = typeof S !== 'undefined' && S ? S.world : null;
  RACE_DEFS.length = 0;
  for (const d of RACE_DEFS_BASE) {
    if (W && W.gone.includes(d.key)) continue;
    RACE_DEFS.push(W && W.cat[d.key] != null ? { ...d, cat: W.cat[d.key] } : { ...d });
  }
  for (const k of Object.keys(RACE_REG)) if (!(k in RACE_REG_BASE)) delete RACE_REG[k];
  if (W)
    for (const d of W.added) {
      RACE_DEFS.push(W.cat[d.key] != null ? { ...d, cat: W.cat[d.key] } : { ...d });
      if (d.reg) RACE_REG[d.key] = d.reg;
    }
  if (typeof RACE_BY_NAME !== 'undefined') RACE_BY_NAME = null;
  ROSTER.max = (W && W.roster) || 30;
}
function wtN() {
  return (typeof S !== 'undefined' && S && S.world && S.world.wtN) || R.wtN;
}

// --- Nouvelles courses ---
const NEW_RACES = {
  FRA: ['Grand Prix des Volcans', 'Tour des Gorges', 'Classique des Vignobles', 'Boucles de la Loire', 'Ronde des Causses'],
  NORD: ['Grand Prix des Moulins', 'Ronde des Canaux', 'Classique des Dunes', 'Omloop des Briqueteries'],
  ITA: ['Giro delle Colline', 'Coppa dei Laghi', 'Trofeo del Sole', 'Gran Premio delle Valli'],
  IBE: ['Vuelta a la Sierra', 'Clásica del Ebro', 'Volta das Rías', 'Gran Premio de la Meseta'],
  ALP: ['Tour des Trois Cols', 'Grand Prix des Glaciers', 'Rund um den Bergsee'],
};
function newRaceDef(w, h) {
  const regs = Object.keys(NEW_RACES);
  const reg = regs[h % regs.length];
  const used = new Set(RACE_DEFS.map(d => d.name).concat(worldInit().added.map(d => d.name)));
  const names = NEW_RACES[reg].filter(n => !used.has(n));
  const name = names.length ? names[(h >>> 4) % names.length] : `Grand Prix ${S.season + 1}`;
  const stageRace = name.startsWith('Tour') || name.startsWith('Vuelta') || name.startsWith('Volta') || name.startsWith('Giro');
  const T = reg === 'NORD' ? ['paves', 'plat', 'vallonne'] : reg === 'ALP' ? ['montagne', 'vallonne', 'sommet'] : ['vallonne', 'punch', 'plat'];
  const stages = stageRace
    ? [0, 1, 2, 3, 4].map(i => [T[(h >>> (i + 6)) % T.length], 150 + ((h >>> (i + 2)) % 50)])
    : [[T[(h >>> 7) % T.length], 185 + ((h >>> 3) % 40)]];
  return { key: 'n' + S.season + '_' + (h % 997), w, name, cat: 2, stages, reg, born: S.season + 1 };
}

// --- Sponsors des équipes ---
const NEW_SPONSORS = [
  ['Rivage Mutuelle', '#00838f'],
  ['Cobalt Mobilité', '#1e3a8a'],
  ['Solstice Énergie', '#f59e0b'],
  ['Granit Bâtiment', '#57534e'],
  ['Orbita Télécom', '#7c3aed'],
  ['Brasserie du Col', '#92400e'],
  ['Vélia Assurances', '#0f766e'],
  ['Néva Logistique', '#be123c'],
  ['Altura Sports', '#15803d'],
  ['Helios Solaire', '#ca8a04'],
  ['Ferrovia Nord', '#334155'],
  ['Delta Électrique', '#0369a1'],
];
// Équipe dont le nom vient du jeu (et non d'un renommage par le joueur) : son sponsor peut changer.
function gameNamedTeam(T) {
  return (
    TEAM_NAMES.some(t => t[0] === T.name) || RESERVE_TEAMS.some(t => t[0] === T.name) || worldInit().teamNames.includes(T.name)
  );
}
function shortOf(name) {
  const w = name.replace(/[^A-Za-zÀ-ÿ ]/g, '').split(' ').filter(Boolean);
  const base = (w.length >= 2 ? w[0].slice(0, 2) + w[1][0] : w[0].slice(0, 3)).toUpperCase();
  let s = base,
    k = 1;
  while (S.teams.some(T => T.short === s)) s = base.slice(0, 2) + k++;
  return s;
}
function newSponsorFor(T, h, bankrupt) {
  const free = NEW_SPONSORS.filter(([n]) => !S.teams.some(U => U.name === n));
  if (!free.length) return null;
  const [name, col] = free[h % free.length];
  const old = T.name;
  const d = T.ds ? dsOf(T) : null;
  renameTeam(T.id, name, shortOf(name), bankrupt ? col : T.color);
  worldInit().teamNames.push(name);
  if (bankrupt && d) {
    legacyRetireDs({ name: old }, d);
    T.ds = null; // nouvelle structure, nouveau directeur (dérivé du nouveau nom)
  }
  return { old, name };
}
// Faillite : la moitié de l'effectif (les plus gros salaires) s'en va, de jeunes coureurs complètent l'équipe.
function bankruptcy(T, h) {
  const ch = newSponsorFor(T, h, true);
  if (!ch) return null;
  const rs = T.riders.map(id => S.riders[id]).sort((a, b) => b.salary - a.salary);
  for (const r of rs.slice(0, Math.floor(rs.length / 2))) {
    T.riders.splice(T.riders.indexOf(r.id), 1);
    r.team = null;
    r.contract = 0;
    r.nextTeam = null;
    S.free.push(r.id);
  }
  const archs = ['rouleur', 'grimpeur', 'sprinteur', 'puncheur', 'baroudeur', 'flahute'];
  let k = 0;
  while (T.riders.length < ROSTER.minAI) {
    const r = genRider(archs[k++ % archs.length], -3.5 + ((h >>> k) % 3), { age: 21 + ((h >>> (k + 3)) % 4) });
    r.team = T.id;
    r.contract = 2;
    r.salary = Math.max(neoMinSalary(T.id), salaryFor(overall(r.s), r.age));
    S.riders[r.id] = r;
    T.riders.push(r.id);
  }
  T.tier = Math.max(-4.5, (T.tier || 0) - 0.6);
  return ch;
}

// --- Réformes de l'UCI ---
const REFORMS = [
  { k: 'roster', v: 28, txt: 'les effectifs sont limités à 28 coureurs' },
  { k: 'roster', v: 32, txt: 'les effectifs peuvent compter jusqu’à 32 coureurs' },
  { k: 'wtN', v: 12, txt: 'le WorldTour passe à 12 licences' },
  { k: 'wtN', v: 14, txt: 'le WorldTour passe à 14 licences' },
  { k: 'minSal', v: 1.1, txt: 'le salaire minimum augmente de 10 %' },
];
function applyReform(W, f) {
  if (f.k === 'roster') {
    W.roster = f.v;
    ROSTER.max = f.v;
    // équipes de l'ordinateur au-delà de la limite : les moins bons partent
    for (const T of S.teams) {
      if (T.player) continue;
      const rs = T.riders.map(id => S.riders[id]).sort((a, b) => overall(a.s) - overall(b.s));
      while (T.riders.length > f.v) {
        const r = rs.shift();
        T.riders.splice(T.riders.indexOf(r.id), 1);
        r.team = null;
        r.contract = 0;
        S.free.push(r.id);
      }
    }
  } else if (f.k === 'wtN') W.wtN = f.v;
  else if (f.k === 'minSal') W.minSal = +((W.minSal || 1) * f.v).toFixed(3);
}

// --- Fin de saison ---
function worldEndSeason(rankArr) {
  if (S.car) return;
  const W = worldInit();
  const h = k => dsHash('monde' + S.seed0 + ':' + S.season + k);
  const news = [];
  // réforme annoncée l'an dernier : elle entre en vigueur
  if (W.pending && W.pending.from <= S.season + 1) {
    applyReform(W, W.pending);
    news.push(`Réforme de l'UCI en vigueur dès la saison ${S.season + 1} : ${W.pending.txt}.`);
    W.lastReform = S.season;
    W.pending = null;
  } else if (!W.pending && (W.lastReform == null || S.season - W.lastReform >= 3) && h('ref') % 100 < 25) {
    const opts = REFORMS.filter(
      f => f.k !== W.lastKind && !(f.k === 'roster' && f.v === (W.roster || 30)) && !(f.k === 'wtN' && f.v === wtN())
    );
    const f = opts[h('refk') % opts.length];
    W.pending = { ...f, from: S.season + 2 };
    W.lastKind = f.k;
    news.push(`L'UCI annonce une réforme pour la saison ${S.season + 2} : ${f.txt}.`);
  }
  // une petite course disparaît, une autre naît la même semaine
  if (h('r') % 100 < 40) {
    const cands = RACE_DEFS.filter(
      d => d.cat === 2 && !d.worlds && !d.olympic && !WORLD_KEEP.includes(d.key) && !(d.born > S.season - 3)
    );
    if (cands.length > 3) {
      const d = cands[h('rg') % cands.length];
      const nd = newRaceDef(d.w, h('rn'));
      W.gone.push(d.key);
      W.added = W.added.filter(x => x.key !== d.key);
      W.added.push(nd);
      news.push(`${raceNameOf(d.key)} disparaît faute d'organisateur ; une nouvelle course naît la même semaine : ${nd.name} (${REG_LBL[nd.reg]}).`);
    }
  }
  // une course monte en WorldTour, une autre redescend
  if (h('p') % 100 < 20) {
    const up = RACE_DEFS.filter(d => d.cat === 2 && !d.worlds && !d.olympic && !WORLD_KEEP.includes(d.key) && !(d.born > S.season - 2));
    const down = RACE_DEFS.filter(d => d.cat === 1 && !d.worlds && !d.olympic && !MONUMENTS.includes(d.key) && !WORLD_KEEP.includes(d.key));
    if (up.length && down.length) {
      const a = up[h('pu') % up.length],
        b = down[h('pd') % down.length];
      W.cat[a.key] = 1;
      W.cat[b.key] = 2;
      news.push(`${raceNameOf(a.key)} entre dans le WorldTour ; ${raceNameOf(b.key)} redescend en deuxième division.`);
    }
  }
  // sponsors : un changement de nom ; une faillite pour une équipe en difficulté
  const ai = S.teams.filter(T => !T.player && gameNamedTeam(T));
  W.born = W.born || {};
  const young = T => W.born[T.name] != null && S.season - W.born[T.name] < 4; // structure trop récente
  const weak = (rankArr || []).filter(T => !T.player && gameNamedTeam(T) && !isWT(T.id) && !young(T)).slice(-4);
  if (weak.length && h('f') % 100 < 25) {
    const T = weak[h('fw') % weak.length];
    const ch = bankruptcy(T, h('fn'));
    if (ch) W.born[ch.name] = S.season;
    if (ch) news.push(`Faillite de ${ch.old} : son sponsor se retire. Une nouvelle structure, ${ch.name}, reprend sa place avec une partie des coureurs.`);
  } else if (ai.length && h('s') % 100 < 45) {
    const T = ai[h('sw') % ai.length];
    const ch = newSponsorFor(T, h('sn'), false);
    if (ch) news.push(`${ch.old} change de sponsor principal et devient ${ch.name}.`);
  }
  if (!news.length) return;
  for (const t of news) W.hist.unshift({ s: S.season, t });
  if (W.hist.length > 60) W.hist.length = 60;
  msg('🌍 Le monde du cyclisme bouge', news.join('<br>'));
  press('Le peloton change', news.join(' '), 0, []);
}
