/* Image de l'équipe : une identité qui se construit avec les résultats (et s'estompe d'une saison à l'autre).
   Elle attire les coureurs du même profil (ils signent plus volontiers et demandent un peu moins),
   rassure le sponsor au moment de renégocier et nourrit la presse. Elle ne change rien en course. */
const IMAGE_AXES = {
  grimpeurs: { lbl: 'Grimpeurs & général', short: 'grimpeurs', arch: ['grimpeur', 'complet'] },
  sprint: { lbl: 'Sprint', short: 'sprinteurs', arch: ['sprinteur'] },
  classiques: { lbl: 'Classiques & pavés', short: 'classiques', arch: ['puncheur', 'flahute'] },
  chrono: { lbl: 'Contre-la-montre', short: 'rouleurs', arch: ['rouleur'] },
  offensive: { lbl: 'Panache & échappées', short: 'baroudeurs', arch: ['baroudeur'] },
  formation: { lbl: 'Formation des jeunes', short: 'jeunes', arch: [] },
};
// Image de départ : le profil de l'effectif (sans résultat, l'identité reste discrète).
function initImage() {
  const rs = S.teams[0].riders.map(id => S.riders[id]).filter(Boolean);
  S.image = {};
  for (const k in IMAGE_AXES) {
    const n = rs.filter(r => IMAGE_AXES[k].arch.includes(r.arch)).length;
    S.image[k] = Math.round(10 + (n / Math.max(1, rs.length)) * 40);
  }
  S.image.formation = 15;
}
// Ajoute des points à un axe (rendement décroissant : plus l'image est forte, plus il faut gagner pour la renforcer).
function imgAdd(k, pts) {
  if (!S.image) initImage();
  S.image[k] = clamp(S.image[k] + pts * (1 - S.image[k] / 110), 0, 100);
}
// Axe correspondant au terrain d'une course ou d'une étape.
function imgAxisOf(type) {
  return type === 'montagne' || type === 'sommet'
    ? 'grimpeurs'
    : type === 'plat'
      ? 'sprint'
      : type === 'clm' || type === 'clmeq'
        ? 'chrono'
        : 'classiques';
}
// Fin de course : les résultats de l'équipe du joueur façonnent son image.
function imageAfterRace(rc) {
  const myIds = new Set(rc.sel[0] || []);
  if (!myIds.size) return;
  const f = rc.cat === 0 ? 1 : rc.cat === 1 ? 0.6 : 0.3;
  const multi = rc.specs.length > 1;
  const young = id => S.riders[id] && S.riders[id].age <= 23;
  rc.stageRes.forEach((st, i) => {
    const w = st.res[0] && st.res[0].id;
    const ax = imgAxisOf(rc.specs[i].type);
    if (myIds.has(w)) {
      imgAdd(ax, (multi ? 4 : 7) * f);
      if (young(w)) imgAdd('formation', 3 * f);
    } else {
      const p = st.res.findIndex(e => myIds.has(e.id));
      if (!multi && p > 0 && p < 5) imgAdd(ax, (5 - p) * 0.6 * f);
    }
    if (st.komb && myIds.has(st.komb)) imgAdd('offensive', 2.5 * f);
    if (st.stats) {
      let kf = 0;
      for (const id in st.stats) kf += st.stats[id].kf || 0;
      if (kf >= 30) imgAdd('offensive', Math.min(1.2, kf / 150) * f);
    }
  });
  if (multi) {
    const g = gcList(rc);
    const p = g.findIndex(id => myIds.has(id)) + 1;
    if (p > 0 && p <= 10) imgAdd('grimpeurs', (11 - p) * 0.9 * f);
    const best = o => classOrder(rc, o)[0];
    if (myIds.has(best(rc.pts))) imgAdd('sprint', 6 * f);
    if (myIds.has(best(rc.kom))) imgAdd('grimpeurs', 5 * f);
    const yg = ygList(rc)[0];
    if (myIds.has(yg)) imgAdd('formation', 5 * f);
  }
}
// Un espoir de l'académie passe pro : la réputation de formateur grandit.
function imageOnPromotion() {
  imgAdd('formation', 4);
}
// Fin de saison : l'image s'estompe en partie (un an sans résultats, et l'étiquette se perd).
function imageEndSeason() {
  if (!S.image) initImage();
  for (const k in S.image) S.image[k] = Math.round(10 + (S.image[k] - 10) * 0.7);
  const L = imageLabel();
  if (L.k)
    press(
      `${S.teams[0].name}, une identité qui s'affirme`,
      `Dans le peloton, on parle désormais de ${S.teams[0].name} comme d'une ${L.lbl.toLowerCase()}.`,
      0.5
    );
}
// Étiquette de l'équipe : l'axe dominant s'il se détache nettement.
function imageLabel() {
  if (!S.image) initImage();
  const e = Object.entries(S.image).sort((a, b) => b[1] - a[1]);
  const [k, v] = e[0];
  if (v >= 45 && v >= e[1][1] * 1.2) {
    const lbl =
      k === 'formation'
        ? 'Équipe formatrice'
        : k === 'offensive'
          ? 'Équipe de baroudeurs'
          : k === 'chrono'
            ? 'Équipe de rouleurs'
            : `Équipe de ${IMAGE_AXES[k].short}`;
    return { k, lbl };
  }
  return { k: null, lbl: v >= 35 ? 'Équipe polyvalente' : 'Équipe en quête d’identité' };
}
// Affinité d'un coureur avec l'image de l'équipe (0 à 1).
function imageAffinity(r) {
  if (!S.image) return 0;
  let a = 0;
  for (const k in IMAGE_AXES) if (IMAGE_AXES[k].arch.includes(r.arch)) a = Math.max(a, S.image[k]);
  if (r.age <= 23) a = Math.max(a, S.image.formation);
  return clamp((a - 30) / 50, 0, 1);
}
// Bonus du sponsor à la renégociation : une identité forte se vend bien (jusqu'à +8 %).
function imageSponsorBonus() {
  if (!S.image) return 0;
  const top = Math.max(...Object.values(S.image));
  return clamp((top - 45) / 400, 0, 0.08);
}
