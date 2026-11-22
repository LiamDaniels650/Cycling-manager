/* Équipement, deuxième étage :
   - trois nouveaux partenaires : roues (aéro, légèreté, rigidité au sprint), pneus (rendement, robustesse,
     adhérence sous la pluie), nutrition (assimilation pendant la course, récupération entre les étapes) ;
   - effets lisibles : ce qu'une marque ou le matériel du jour change, en secondes, sur des parcours concrets ;
   - mécaniciens (staff) et ennuis mécaniques en course ; vélo de rechange en haut des cols ;
   - soufflerie et étude posturale, coureur par coureur (chrono) ;
   - avis des coureurs (marque préférée des vedettes) et temps d'adaptation à un nouveau vélo ;
   - marché vivant : après une grande victoire, une meilleure marque peut proposer un contrat anticipé.
   Effets volontairement petits (de l'ordre du pour cent) : les équipes de l'ordinateur sont équipées elles aussi,
   selon leur niveau. */

const EQ_WHEELS = [
  { id: 'zephyr', name: 'Zephyr Carbon', aero: 0.95, leger: 0.55, rigide: 0.75, minRep: 55, pay: 12 },
  { id: 'altura', name: 'Altura', aero: 0.55, leger: 0.95, rigide: 0.6, minRep: 50, pay: 15 },
  { id: 'ferro', name: 'Ferro Sprint', aero: 0.7, leger: 0.5, rigide: 0.95, minRep: 40, pay: 20 },
  { id: 'polyvel', name: 'Polyvel', aero: 0.65, leger: 0.65, rigide: 0.65, minRep: 25, pay: 28 },
  { id: 'roue-basic', name: 'Basica Roues', aero: 0.4, leger: 0.4, rigide: 0.45, minRep: 0, pay: 40 },
];
const EQ_TYRES = [
  { id: 'velox', name: 'Velox Course', rend: 0.95, robuste: 0.5, grip: 0.65, minRep: 50, pay: 10 },
  { id: 'gravia', name: 'Gravia Pavé', rend: 0.6, robuste: 0.95, grip: 0.8, minRep: 35, pay: 16 },
  { id: 'aqua', name: 'Aquagrip', rend: 0.7, robuste: 0.7, grip: 0.95, minRep: 40, pay: 14 },
  { id: 'pneu-basic', name: 'Basica Pneus', rend: 0.45, robuste: 0.5, grip: 0.5, minRep: 0, pay: 30 },
];
const EQ_NUTRI = [
  { id: 'endura', name: 'Endura Lab', assim: 0.95, recup: 0.7, minRep: 50, pay: 8 },
  { id: 'recova', name: 'Recova', assim: 0.65, recup: 0.95, minRep: 45, pay: 10 },
  { id: 'natura', name: 'Natura Sport', assim: 0.75, recup: 0.75, minRep: 25, pay: 16 },
  { id: 'nutri-basic', name: 'Basica Nutrition', assim: 0.45, recup: 0.45, minRep: 0, pay: 24 },
];
EQ_CATS.roues = { lbl: 'Roues', list: EQ_WHEELS, keys: ['aero', 'leger', 'rigide'] };
EQ_CATS.pneus = { lbl: 'Pneus', list: EQ_TYRES, keys: ['rend', 'robuste', 'grip'] };
EQ_CATS.nutri = { lbl: 'Nutrition', list: EQ_NUTRI, keys: ['assim', 'recup'] };
const EQ_TRAIT_LBL = {
  aero: 'aéro',
  leger: 'légèreté',
  confort: 'confort',
  robuste: 'robustesse',
  rigide: 'rigidité (sprint)',
  rend: 'rendement',
  grip: 'adhérence (pluie)',
  assim: 'assimilation',
  recup: 'récupération',
};
// Toutes les catégories présentes sur la sauvegarde (nouvelle partie ou ancienne) : matériel et contrats.
function eqEnsure() {
  if (!S || !S.teams) return;
  S.eqDeal = S.eqDeal || {};
  for (const cat of Object.keys(EQ_CATS)) {
    for (const T of S.teams) {
      T.eq = T.eq || {};
      if (!T.eq[cat]) {
        const list = EQ_CATS[cat].list.slice().sort((a, b) => eqQuality(cat, b) - eqQuality(cat, a));
        // l'ordinateur : selon son niveau ; le joueur : la marque d'entrée de gamme
        const k = T.player
          ? list.length - 1
          : clamp(Math.round(((4.5 - T.tier) / 9) * (list.length - 1)), 0, list.length - 1);
        T.eq[cat] = list[k].id;
      }
    }
    if (!S.eqDeal[cat]) S.eqDeal[cat] = { pay: eqBrand(cat, S.teams[0].eq[cat]).pay, years: 1 };
  }
  S.meca = S.meca || 1;
}

// --- Effets lisibles : en secondes, sur des parcours de référence ---
// Différence de temps (s) entre deux marques d'une catégorie, sur les terrains où elle compte.
/** @returns {[string, number][]} */
function eqSeconds(cat, b, ref) {
  // temps gagné (s) = durée × fraction de vitesse gagnée
  /** @type {[string, number][]} */
  const L = [];
  const d = (k, w) => (b[k] - ref[k]) * w;
  const pct = v => v;
  if (cat === 'bike') {
    L.push(['40 km de plat en peloton (55 min)', 3300 * pct(d('aero', 0.012)) * 0.35]);
    L.push(['un col de 10 km (30 min)', 1800 * pct(d('leger', 0.012))]);
    L.push(['20 km de pavés (27 min)', 1620 * pct(d('confort', 0.02))]);
  } else if (cat === 'tt') L.push(['40 km de chrono (48 min)', 2880 * pct(d('aero', 0.025))]);
  else if (cat === 'roues') {
    L.push(['40 km de chrono (48 min)', 2880 * pct(d('aero', 0.006))]);
    L.push(['un col de 10 km (30 min)', 1800 * pct(d('leger', 0.006))]);
  } else if (cat === 'pneus') L.push(['40 km de chrono (48 min)', 2880 * pct(d('rend', 0.004))]);
  /** @type {[string, number][]} */
  const out = [];
  for (const [where, sec] of L) if (Math.abs(Math.round(sec)) >= 1) out.push([where, Math.round(sec)]);
  return out;
}
// Texte court : « −9 s sur 40 km de chrono · +4 s dans un col de 10 km » (négatif = plus rapide).
function eqSecondsText(cat, b, ref) {
  const L = eqSeconds(cat, b, ref);
  const extra = [];
  if (cat === 'bike' && b.robuste !== ref.robuste)
    extra.push(
      `crevaisons ${b.robuste > ref.robuste ? '−' : '+'}${Math.round(Math.abs(b.robuste - ref.robuste) * 100)} %`
    );
  if (cat === 'roues' && b.rigide !== ref.rigide) {
    const v = Math.round((b.rigide - ref.rigide) * 12) / 10;
    extra.push(
      `sprint ${v > 0 ? 'plus' : 'moins'} nerveux (${v > 0 ? '+' : ''}${String(v).replace('.', ',')} pt de pointe)`
    );
  }
  if (cat === 'pneus') {
    if (b.robuste !== ref.robuste)
      extra.push(
        `crevaisons ${b.robuste > ref.robuste ? '−' : '+'}${Math.round(Math.abs(b.robuste - ref.robuste) * 60)} %`
      );
    if (b.grip !== ref.grip)
      extra.push(
        `chutes sous la pluie ${b.grip > ref.grip ? '−' : '+'}${Math.round(Math.abs(b.grip - ref.grip) * 60)} %`
      );
  }
  if (cat === 'nutri') {
    if (b.assim !== ref.assim)
      extra.push(
        `fringales ${b.assim > ref.assim ? 'plus rares' : 'plus fréquentes'} (réserves ${b.assim > ref.assim ? '+' : '−'}${Math.round(Math.abs(b.assim - ref.assim) * 24)} %)`
      );
    if (b.recup !== ref.recup)
      extra.push(
        `récupération entre étapes ${b.recup > ref.recup ? '+' : '−'}${String(Math.round(Math.abs(b.recup - ref.recup) * 40) / 10).replace('.', ',')} pt d'énergie`
      );
  }
  // (eqSeconds donne le temps gagné : positif = plus rapide, affiché « −9 s »)
  const t = L.map(([w, sec]) => `${sec > 0 ? '−' : '+'}${Math.abs(sec)} s sur ${w}`);
  return t.concat(extra).join(' · ');
}
// Matériel du jour : écart de temps (s) estimé sur l'étape par rapport au conseil du staff.
function gearStageSeconds(spec, gear) {
  const rec = autoGear(spec);
  const P = buildProfile(spec);
  let tFlat = 0,
    tClimb = 0,
    tSteep = 0,
    tPav = 0;
  for (let i = 0; i < P.g.length; i++) {
    const g = P.g[i],
      surf = (P.sectors || []).some(sc => i * STEP >= sc.start && i * STEP < sc.end);
    const v = surf ? 40 : g >= 7 ? 16 : g >= 3 ? 22 : g > -2 ? 45 : 60;
    const t = (STEP / v) * 3600;
    if (surf) tPav += t;
    else if (g >= 7) tSteep += t;
    else if (g >= 3) tClimb += t;
    else if (g > -2) tFlat += t;
  }
  const f = gg => applyGear({ flat: 1, climb: 1, pav: 1, punct: 1, pavPunct: 1, tt: 1, wetK: 1, steep: 1 }, gg);
  const a = f(gear),
    b = f(rec);
  const itt = isITT(spec) || isTTT(spec);
  // en peloton, l'aéro compte environ pour un tiers (abri) ; en chrono, entièrement
  const kFlat = itt ? 1 : 0.35;
  const s =
    -(tFlat * (itt ? a.tt / b.tt - 1 : (a.flat / b.flat - 1) * kFlat)) -
    tClimb * (a.climb / b.climb - 1) -
    tSteep * ((a.climb * a.steep) / (b.climb * b.steep) - 1) -
    tPav * (a.pav / b.pav - 1);
  return Math.round(s);
}

// --- Mécaniciens et ennuis mécaniques ---
const MECA_COST = [0, 0, 60, 140, 240, 360];
const MECA_DESC = 'Ennuis mécaniques moins fréquents (déraillement, roue voilée) et dépannages plus rapides.';
// (le poste est tenu par une personne : 67-staff.js)
function setMeca(l) {
  return crewSetLevel('meca', clamp(l, 1, 5));
}
// Probabilité d'ennui mécanique sur ce pas (par coureur) : robustesse du vélo, pavés, pluie, mécaniciens.
function mecaRisk(sim, x, km) {
  const G = x.g;
  const rob = eqUsed(x.team, 'bike').robuste;
  const mec = x.team.player ? 1.3 - 0.15 * (S.meca || 1) : 0.85;
  return 0.00005 * km * (1.6 - rob) * (G.surf ? 3 : 1) * (sim.wx === 'pluie' ? 1.3 : 1) * mec;
}
// Temps perdu sur un ennui mécanique : comme un dépannage, un peu plus long ; vélo de rechange en haut des cols.
function mecaLoss(sim, x, G) {
  let s = punctureLoss(sim, x, G) * 1.25 * (x.team.player ? 1.1 - 0.06 * (S.meca || 1) : 0.95);
  if (G.g >= 3 && x.eqf && x.eqf.spare) s *= 0.5;
  return s;
}

// --- Soufflerie et étude posturale ---
const FIT_COST = 25;
function windTunnel(id) {
  const r = S.riders[id];
  if (!r || r.team !== 0) return 'Seulement pour vos coureurs.';
  if (r.fit && r.fit.s === S.season) return 'Déjà passé en soufflerie cette saison.';
  if (S.budget < FIT_COST) return `Budget insuffisant (${fmtMoney(FIT_COST)}).`;
  S.budget -= FIT_COST;
  finAdd('other', -FIT_COST);
  // gain plus fort pour un rouleur grand et lourd (beaucoup de surface frontale à gagner)
  const k = clamp(0.006 + ((r.kg || 68) - 66) * 0.0002 + (r.arch === 'rouleur' ? 0.002 : 0), 0.004, 0.012);
  r.fit = { s: S.season, k: Math.round(k * 1000) / 1000 };
  return `🌬️ Soufflerie et étude posturale de ${riderName(r)} : position affinée, chrono ≈ ${Math.round(k * 2880)} s plus rapide sur 40 km (cette saison et la suivante).`;
}
function fitK(r) {
  return r.fit && S.season - r.fit.s <= 1 ? r.fit.k : 0;
}

// --- Avis des coureurs et adaptation ---
// Marque de vélo préférée d'une vedette (empreinte : stable d'une partie à l'autre).
function favBike(r) {
  return EQ_BIKES[dsHash('fav' + r.id) % EQ_BIKES.length].id;
}
function teamStars() {
  return S.teams[0].riders
    .map(id => S.riders[id])
    .filter(Boolean)
    .sort((a, b) => overall(b.s) - overall(a.s))
    .slice(0, 3);
}
// Changement de vélo ou de roues : réactions des vedettes, quatre courses d'adaptation.
function eqChanged(cat, oldId, newId) {
  if (oldId === newId || (cat !== 'bike' && cat !== 'roues')) return;
  S.eqAdapt = { left: 4, cat };
  if (cat !== 'bike') return;
  const L = [];
  for (const r of teamStars()) {
    const fav = favBike(r);
    if (fav === newId) {
      r.moral = clamp(r.moral + 5, 0, 100);
      L.push(`${riderName(r)} est ravi : c'est sa marque préférée (moral +5)`);
    } else if (fav === oldId) {
      r.moral = clamp(r.moral - 6, 0, 100);
      L.push(`${riderName(r)} regrette son ancien vélo (moral −6)`);
    }
  }
  msg(
    '🚲 Nouveau matériel',
    `Quatre courses d'adaptation au nouveau vélo (réglages, sensations : un peu moins efficace).${L.length ? '<br>' + L.join('<br>') : ''}`
  );
}
function eqAdaptMul() {
  return S.eqAdapt && S.eqAdapt.left > 0 ? 0.997 : 1;
}
function eqAdaptAfterRace(rc) {
  if (S.eqAdapt && S.eqAdapt.left > 0 && (rc.sel[0] || []).length) S.eqAdapt.left--;
}

// --- Marché vivant : contrat anticipé après une grande victoire ---
function eqEarlyAfterWin(rc, w) {
  if (!w || w.team !== 0 || rc.cat > 1 || S.week >= EQ_OFFER_WEEK || (S.eqEarly && S.eqEarly.s === S.season)) return;
  if (dsHash('eqe' + rc.key + S.season) % 100 >= 40) return;
  const rep = repOf();
  for (const cat of ['bike', 'roues', 'pneus']) {
    const d = S.eqDeal[cat];
    if (!d || d.years > 1) continue;
    const cur = eqBrand(cat, S.teams[0].eq[cat]);
    const better = EQ_CATS[cat].list
      .filter(b => eqQuality(cat, b) > eqQuality(cat, cur) + 0.05 && b.minRep <= rep + 12)
      .sort((a, b) => eqQuality(cat, b) - eqQuality(cat, a))[0];
    if (!better) continue;
    S.eqEarly = { s: S.season, cat, id: better.id, pay: Math.round(better.pay * 1.2), years: 2, exp: S.week + 4 };
    msg(
      '📨 Offre anticipée d’un équipementier',
      `Après la victoire de ${riderName(S.riders[w.id || w])}, <b>${better.name}</b> (${EQ_CATS[cat].lbl.toLowerCase()}) propose de vous équiper dès la saison prochaine : ${fmtMoney(S.eqEarly.pay)}/saison pendant 2 ans. Réponse avant la semaine ${S.eqEarly.exp}.`
    );
    return;
  }
}
function eqEarlyAnswer(ok) {
  const o = S.eqEarly;
  if (!o || o.done) return 'Aucune offre.';
  o.done = true;
  if (!ok) return `Offre de ${eqBrand(o.cat, o.id).name} déclinée.`;
  o.taken = true;
  return `Accord avec ${eqBrand(o.cat, o.id).name} : vous serez équipé dès la saison ${S.season + 1}.`;
}

// Facteurs de matériel d'un coureur : ceux de son équipe et du jour, plus sa position affinée en soufflerie.
function riderEqf(T, r, rc, spec) {
  const f = applyGear(eqFactors(T), gearFor(T, rc, spec));
  const k = fitK(r);
  if (k) f.tt *= 1 + k;
  return f;
}

// Récupération entre deux étapes apportée par la nutrition de l'équipe (points d'énergie).
function nutriRecup(teamId) {
  const T = teamById(teamId);
  return T ? (eqBrand('nutri', T.eq && T.eq.nutri).recup - 0.5) * 4 : 0;
}
