/* Matériel du jour (roues, pneus) choisi étape par étape, et reconnaissances de parcours. */
const GEAR = {
  wheels: {
    hautes: {
      lbl: 'Roues hautes (aéro)',
      flat: 0.006,
      climb: -0.004,
      tt: 0.005,
      d: '+ sur le plat et en chrono, − en montée, instables par grand vent',
    },
    mixtes: { lbl: 'Roues mixtes', flat: 0, climb: 0, tt: 0, d: 'polyvalentes' },
    basses: { lbl: 'Roues basses (légères)', flat: -0.003, climb: 0.004, tt: -0.004, d: '+ en montée, − sur le plat' },
  },
  // pression des pneus : basse pour les pavés et la pluie, haute sur route sèche et lisse
  press: {
    normale: { lbl: 'Pression normale', d: 'compromis' },
    basse: { lbl: 'Pression basse', d: '+ pavés et pluie, moins de crevaisons, − rendement sur le plat' },
    haute: { lbl: 'Pression haute', d: '+ rendement sur route sèche, − pavés, glissant sous la pluie' },
  },
  // développement : petit braquet pour les murs (pentes à 7 % et plus)
  dev: {
    standard: { lbl: 'Développement standard', d: 'polyvalent' },
    compact: { lbl: 'Petit braquet (murs)', d: '+ dans les pentes raides, un peu − sur le plat' },
  },
  // vélo de rechange en haut des cols (une place dans la voiture, 2 k€) : dépannage deux fois plus court en montée
  spare: {
    non: { lbl: 'Pas de vélo de rechange en haut des cols', d: '' },
    oui: {
      lbl: 'Vélo de rechange en haut des cols (2 k€)',
      d: 'ennui mécanique en montée : moitié moins de temps perdu',
    },
  },
  tyres: {
    standard: { lbl: 'Pneus standards', flat: 0, pav: 0, punct: 1, d: 'rendement maximal sur route sèche' },
    larges: {
      lbl: 'Pneus larges',
      flat: -0.003,
      pav: 0.012,
      punct: 0.6,
      d: 'adhérence et confort : pavés, pluie, moins de crevaisons',
    },
  },
};
// Choix « de bon sens » pour une étape (celui des équipes IA et la suggestion faite au joueur).
function autoGear(spec) {
  const t = spec.type;
  const wheels =
    t === 'montagne' || t === 'sommet'
      ? 'basses'
      : t === 'plat' || t === 'clm' || t === 'clmeq'
        ? spec.wind >= 3 && t === 'plat'
          ? 'mixtes'
          : 'hautes'
        : 'mixtes';
  const tyres = t === 'paves' || spec.wx === 'pluie' ? 'larges' : 'standard';
  const press = t === 'paves' || spec.wx === 'pluie' ? 'basse' : t === 'clm' || t === 'clmeq' ? 'haute' : 'normale';
  const dev = t === 'montagne' || t === 'sommet' ? 'compact' : 'standard';
  const spare = t === 'montagne' || t === 'sommet' ? 'oui' : 'non';
  return { wheels, tyres, press, dev, spare };
}
function gearFor(T, rc, spec) {
  if (T.player && rc.gear && rc.gearStage === rc.si) return rc.gear;
  return autoGear(spec);
}
// Applique le matériel du jour aux facteurs de l'équipementier.
function applyGear(f, gear) {
  const w = GEAR.wheels[gear.wheels] || GEAR.wheels.mixtes,
    t = GEAR.tyres[gear.tyres] || GEAR.tyres.standard;
  const pr = gear.press || 'normale',
    dv = gear.dev || 'standard';
  const pFlat = pr === 'basse' ? -0.002 : pr === 'haute' ? 0.002 : 0,
    pPav = pr === 'basse' ? 0.006 : pr === 'haute' ? -0.006 : 0,
    pPunct = pr === 'basse' ? 0.85 : pr === 'haute' ? 1.1 : 1,
    pWet = pr === 'basse' ? 0.85 : pr === 'haute' ? 1.2 : 1;
  return {
    ...f,
    flat: f.flat * (1 + w.flat + t.flat + pFlat + (dv === 'compact' ? -0.001 : 0)),
    climb: f.climb * (1 + w.climb),
    pav: f.pav * (1 + t.pav + pPav),
    punct: f.punct * t.punct * pPunct,
    pavPunct: f.pavPunct * t.punct * pPunct,
    tt: f.tt * (1 + w.tt + (pr === 'haute' ? 0.001 : 0)),
    wetK: (f.wetK || 1) * pWet,
    steep: (f.steep || 1) * (dv === 'compact' ? 1.004 : 1),
    spare: gear.spare === 'oui',
    wheels: gear.wheels,
    tyres: gear.tyres,
  };
}
function setGear(k, v) {
  const rc = S.rc,
    spec = rc.specs[rc.si];
  const g = rc.gear && rc.gearStage === rc.si ? { ...rc.gear } : autoGear(spec);
  g[k] = v;
  rc.gear = g;
  rc.gearStage = rc.si;
}
// Reconnaissance : le coût dépend du nombre d'étapes ; les coureurs connaissent les pièges du parcours.
function reconCost(c) {
  return Math.min(30, 8 + 2 * c.stagesSpec.length);
}
function reconUseful(c) {
  return c.stagesSpec.some(([t]) => ['paves', 'vallonne', 'punch', 'montagne', 'sommet'].includes(t));
}
function doRecon(i, ids) {
  const c = S.cal[i];
  S.recon = S.recon || {};
  if (S.recon[c.key] === S.season) return 'Parcours déjà reconnu.';
  const cost = reconCost(c);
  if (S.budget < cost) return 'Budget insuffisant.';
  S.budget -= cost;
  finAdd('other', -cost);
  S.recon[c.key] = S.season;
  for (const id of ids) S.riders[id].fatigue = clamp(S.riders[id].fatigue + 3, 0, 100);
  return `Reconnaissance de ${c.name} effectuée (${fmtMoney(cost)}) : vos coureurs connaissent les pièges du parcours.`;
}
function reconDone(rc) {
  return !!(S.recon && S.recon[rc.key] === S.season);
}
