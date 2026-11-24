/* Personnalité cachée. Chaque coureur a deux attributs mentaux, de 1 à 20, qu'on ne voit pas d'emblée :
   - Grands rendez-vous : certains se subliment sur un grand tour, un monument, aux Mondiaux ou aux Jeux, d'autres
     craquent sous la pression (forme du jour de -1,5 à +1,5 point dans ces courses) ;
   - Professionnalisme : sérieux à l'entraînement, hygiène de vie (progression de -14 % à +14 %).
   Les traits connus pèsent : un « gagneur » supporte mieux la pression, un « mental fragile » moins bien, un
   « équipier modèle » est plus sérieux. Les valeurs viennent d'une empreinte du coureur (rien n'est tiré au sort, rien
   n'est stocké). On les découvre : pour vos coureurs, après quelques courses ensemble ; pour les autres, quand vos
   recruteurs les connaissent bien (rapports de mission, liste de suivi). */

function mentalOf(r) {
  const h = dsHash('mental:' + r.id + ':' + r.fn + r.ln);
  let pres = 1 + (h % 20),
    prof = 1 + ((h >>> 9) % 20);
  if (r.trait === 'gagneur') pres = Math.min(20, pres + 5);
  if (r.trait === 'fragile') pres = Math.max(1, pres - 5);
  if (r.trait === 'modele') prof = Math.min(20, prof + 4);
  if (r.trait === 'tete') prof = Math.max(1, prof - 2);
  return { pres, prof };
}
// Connaît-on son caractère ? 0 : non ; 1 : une idée (rapport de recruteur) ; 2 : précisément.
function mentalKnown(r) {
  if (r.team === 0)
    return (r.mtD || 0) >= 6 || (r.career || []).some(c => c.t === S.teams[0].short) ? 2 : (r.mtD || 0) >= 2 ? 1 : 0;
  const k = knowOf(r);
  return k >= 80 ? 2 : k >= 55 ? 1 : 0;
}
const MENTAL_LBL = {
  pres: [
    'Craque sous la pression',
    'Tendu dans les grands rendez-vous',
    'Ni plus ni moins',
    'Aime les grands rendez-vous',
    'Se sublime dans les grands rendez-vous',
  ],
  prof: ['Manque de sérieux', 'Inégal à l’entraînement', 'Sérieux', 'Très professionnel', 'Professionnel exemplaire'],
};
function mentalBand(v) {
  return v <= 4 ? 0 : v <= 8 ? 1 : v <= 13 ? 2 : v <= 17 ? 3 : 4;
}
// Ce que l'on sait de lui, en clair (null si rien).
function mentalTxt(r) {
  const k = mentalKnown(r);
  if (!k) return null;
  const m = mentalOf(r);
  if (k === 2) return { pres: MENTAL_LBL.pres[mentalBand(m.pres)], prof: MENTAL_LBL.prof[mentalBand(m.prof)], v: m };
  // une idée seulement : les deux grandes familles
  return {
    pres: m.pres >= 12 ? 'Semble aimer la pression' : 'Semble moins à l’aise sous la pression',
    prof: m.prof >= 12 ? 'Paraît sérieux' : 'Sérieux à vérifier',
  };
}
// Indice pour un rapport de recruteur : le trait le plus marquant, s'il est remarquable.
function mentalHint(r) {
  if (mentalKnown(r) < 1) return null;
  const m = mentalOf(r);
  if (m.pres >= 16) return 'se transcende dans les grandes courses';
  if (m.pres <= 4) return 'peut craquer dans les grandes courses';
  if (m.prof >= 16) return 'très professionnel';
  if (m.prof <= 4) return 'manque de sérieux à l’entraînement';
  return null;
}
// Grand rendez-vous : grand tour, monument, Mondiaux, Jeux.
function bigRace(rc) {
  const c = rc && S.cal[rc.calIdx];
  return (
    !!rc &&
    (rc.worlds ||
      (c && (c.worlds || c.olympic)) ||
      MONUMENTS.includes(rc.key) ||
      (rc.cat === 0 && rc.specs.length >= 15))
  );
}
// Effet sur la forme du jour (centré sur zéro sur l'ensemble du peloton).
function mentalBig(rc, r) {
  if (!bigRace(rc)) return 0;
  return (mentalOf(r).pres - 10.2) * 0.15;
}
// Effet sur la progression (facteur).
function mentalProg(r) {
  return 1 + (mentalOf(r).prof - 10.9) * 0.015;
}
// Course terminée avec l'équipe : on apprend à connaître ses coureurs.
function mentalAfterRace(rc) {
  for (const id of rc.sel[0] || []) {
    const r = S.riders[id];
    if (!r) continue;
    const k0 = mentalKnown(r);
    r.mtD = (r.mtD || 0) + rc.specs.length;
    if (k0 < 2 && mentalKnown(r) === 2) {
      const t = mentalTxt(r);
      const m = mentalOf(r);
      if (m.pres >= 16 || m.pres <= 4 || m.prof >= 16 || m.prof <= 4)
        msg('🧠 Vous le connaissez mieux', `${riderName(r)} : ${t.pres.toLowerCase()} ; ${t.prof.toLowerCase()}.`);
    }
  }
}
