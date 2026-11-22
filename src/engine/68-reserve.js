/* Équipe de développement (réserve) : la passerelle entre l'académie et les pros, comme les équipes « devo » des
   formations WorldTour.
   - Création : 150 k€, puis 60 k€ d'entretien par saison.
   - Quatre places de plus à l'académie, et les espoirs peuvent y rester jusqu'à 23 ans (au lieu de 22).
   - Toute la saison (pas seulement à partir d'août comme les stagiaires), deux espoirs de 19 ans et plus peuvent
     courir avec les pros sur les courses de deuxième catégorie.
   - Encadrement : 10 % de progression en plus pour les espoirs.
   Le calendrier espoirs (dont le Tour de l'Avenir) reste celui de l'académie (31-academy.js). */
const DEV = { cost: 150, upk: 60, places: 4, perRace: 2, gain: 0.1 };
function devOn() {
  return !!S.dev;
}
function devName() {
  return S.teams[0].name + ' Development';
}
function devCreate() {
  if (S.dev) return 'Votre équipe de développement existe déjà.';
  if (S.budget < DEV.cost) return `Budget insuffisant (${fmtMoney(DEV.cost)}).`;
  S.budget -= DEV.cost;
  finAdd('aca', -DEV.cost);
  S.dev = { s: S.season };
  addAcaRep(3);
  return `🌱 ${devName()} est créée : ${DEV.places} places de plus à l'académie, espoirs gardés jusqu'à 23 ans, deux espoirs avec les pros sur les courses de deuxième catégorie toute la saison.`;
}
function devClose() {
  S.dev = null;
  return "L'équipe de développement est dissoute.";
}
// Âge auquel un espoir quitte l'académie s'il n'est pas passé pro.
function acaAgeOut() {
  return S.dev ? 24 : 23;
}
// Un espoir de l'équipe de développement peut courir cette course avec les pros.
function devEligible(r, c) {
  return !!(S.dev && r && r.aca && r.age >= 19 && c && c.cat === 2 && !c.worlds);
}
// Sélection : au plus deux espoirs de la réserve (hors stagiaires).
function devSelCount(sel) {
  return sel.filter(id => S.riders[id] && S.riders[id].aca && !isStag(S.riders[id])).length;
}
function devEndSeason() {
  if (!S.dev) return;
  S.budget -= DEV.upk;
  finAdd('aca', -DEV.upk);
}
