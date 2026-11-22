/* Académie, leviers de long terme :
   - centre de formation (niveaux 1 à 4) : plus de places, progression plus rapide des espoirs, académie plus
     attirante ; amélioration payante, entretien chaque fin de saison ;
   - recrutement ciblé : une région de prospection pour la saison (Flandres, Andes, Alpes, sprinteurs, rouleurs) :
     une part des jeunes qui arrivent au vivier en fin de saison en vient, avec un peu plus de potentiel ;
   - journée de détection : une fois par saison, les six plus gros potentiels du vivier sont mieux connus ;
   - fidélité des anciens : un coureur formé chez vous demande 10 % de moins pour (re)signer. */

const ACA_FAC = [
  null,
  { lbl: 'Structure modeste', places: 8, gain: 0, upk: 0 },
  { lbl: 'Centre régional', places: 10, gain: 0.1, upk: 40, cost: 150 },
  { lbl: 'Centre national', places: 12, gain: 0.2, upk: 70, cost: 300 },
  { lbl: "Centre d'excellence", places: 14, gain: 0.3, upk: 110, cost: 500 },
];
function acaLvl() {
  return clamp(S.acaLvl || 1, 1, 4);
}
function acaMax() {
  return ACA_FAC[acaLvl()].places + (S.dev ? DEV.places : 0); // (équipe de développement : 68-reserve.js)
}
function acaUpgrade() {
  const l = acaLvl();
  if (l >= 4) return 'Le centre de formation est déjà au plus haut niveau.';
  const F = ACA_FAC[l + 1];
  if (S.budget < F.cost) return `Budget insuffisant (${fmtMoney(F.cost)}).`;
  S.budget -= F.cost;
  finAdd('aca', -F.cost);
  S.acaLvl = l + 1;
  addAcaRep(3);
  return `🏗️ ${F.lbl} : ${F.places} places, progression des espoirs +${Math.round(F.gain * 100)} %, entretien ${fmtMoney(F.upk)} par saison.`;
}
// Progression supplémentaire d'un espoir de l'académie (appelée avec la progression de la semaine).
function acaFacGain(r, g0) {
  const F = ACA_FAC[acaLvl()];
  const g = F.gain + (S.dev ? DEV.gain : 0);
  if (r.aca && g > 0) trainGain(r, r.training || 'normal', g0 * g);
}
// Entretien du centre (fin de saison).
function acaFacEndSeason() {
  devEndSeason();
  const F = ACA_FAC[acaLvl()];
  S.budget -= F.upk;
  finAdd('aca', -F.upk);
}

// --- Recrutement ciblé ---
const SCOUT_REG = {
  flandres: { lbl: 'Flandres et Pays-Bas', nats: ['BEL', 'NED'], archs: ['flahute', 'rouleur', 'sprinteur'] },
  andes: { lbl: 'Andes', nats: ['COL'], archs: ['grimpeur', 'complet', 'grimpeur'] },
  alpes: { lbl: 'Alpes', nats: ['SUI', 'ITA', 'FRA', 'SLO'], archs: ['grimpeur', 'complet', 'puncheur'] },
  vitesse: { lbl: 'Écoles de sprint', nats: ['AUS', 'GBR', 'ITA', 'GER'], archs: ['sprinteur', 'puncheur'] },
  chrono: { lbl: 'Pistes et chrono du Nord', nats: ['DEN', 'NOR', 'GBR', 'GER'], archs: ['rouleur', 'complet'] },
};
const SCOUT_COST = 40;
function setScoutFocus(k) {
  if (!SCOUT_REG[k]) {
    S.scoutFocus = null;
    return 'Prospection générale.';
  }
  if (S.scoutFocus && S.scoutFocus.s === S.season) {
    S.scoutFocus = { k, s: S.season };
    return `Prospection réorientée vers ${SCOUT_REG[k].lbl}.`;
  }
  if (S.budget < SCOUT_COST) return `Budget insuffisant (${fmtMoney(SCOUT_COST)}).`;
  S.budget -= SCOUT_COST;
  finAdd('aca', -SCOUT_COST);
  S.scoutFocus = { k, s: S.season };
  return `🔭 Vos recruteurs prospectent ${SCOUT_REG[k].lbl} cette saison : une partie des jeunes qui arriveront au vivier en fin de saison en viendront.`;
}
// Nouveaux jeunes de fin de saison : 12 viennent de la région prospectée (profil et nationalité), un peu plus doués.
function scoutYouth() {
  const f = S.scoutFocus;
  // (appelée après le passage à la saison suivante : la prospection de la saison qui vient de finir)
  if (!f || f.s !== S.season - 1 || !SCOUT_REG[f.k]) return;
  const R0 = SCOUT_REG[f.k];
  for (let i = 0; i < 12; i++) {
    const arch = R0.archs[i % R0.archs.length];
    const nat = R0.nats[i % R0.nats.length];
    // (la nationalité n'est qu'un penchant dans genRider : on retire jusqu'à tomber sur la région prospectée)
    let r = genRider(arch, -9 + gauss() * 2.5, { age: rint(17, 19), nat });
    for (let k = 0; k < 8 && r.nat !== nat; k++) r = genRider(arch, -9 + gauss() * 2.5, { age: rint(17, 19), nat });
    r.ceil = Math.round(clamp(72 + gauss() * 6.5 + (rnd() < 0.08 ? 9 : 0), 60, 93));
    r.youth = true;
    r.team = null;
    r.contract = 0;
    r.salary = 12;
    r.scouted = f.k;
    rollDev(r);
    S.riders[r.id] = r;
    S.youth.push(r.id);
    S.know[r.id] = 25; // vos recruteurs les ont déjà vus
  }
  msg('🔭 Prospection', `12 jeunes repérés par vos recruteurs (${R0.lbl}) rejoignent le vivier.`);
}

// --- Journée de détection ---
const DETECT_COST = 25;
function detectionDay() {
  if (S.detectS === S.season) return 'Journée de détection déjà organisée cette saison.';
  if (S.budget < DETECT_COST) return `Budget insuffisant (${fmtMoney(DETECT_COST)}).`;
  const ys = S.youth
    .map(id => S.riders[id])
    .filter(r => r && r.preAI == null)
    .sort((a, b) => b.ceil - a.ceil)
    .slice(0, 6);
  if (!ys.length) return 'Le vivier est vide.';
  S.budget -= DETECT_COST;
  finAdd('aca', -DETECT_COST);
  S.detectS = S.season;
  for (const r of ys) {
    S.know[r.id] = Math.max(S.know[r.id] || 0, 70);
    if (!S.watch.includes(r.id)) S.watch.push(r.id);
  }
  return `🎯 Journée de détection : ${ys.map(r => riderName(r)).join(', ')} sortent du lot (ajoutés à vos jeunes suivis).`;
}

// --- Fidélité des anciens ---
function isAlumnus(r) {
  return !!(S.acaAlumni && r && S.acaAlumni.some(a => a.id === r.id));
}
