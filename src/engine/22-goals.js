/* Objectifs personnels des coureurs du joueur : fixés en début de saison selon le profil et le niveau,
   ils pèsent sur le moral et la fidélité en fin de saison. */
const GOALS = {
  gtTop10: "Finir dans les 10 premiers d'un Grand Tour",
  gtStage: "Gagner une étape d'un Grand Tour",
  classic: "Finir dans les 10 premiers d'une grande classique",
  win: 'Remporter au moins une course ou une étape',
  get gtSelect() {
    const n = raceNameOf('gb'); // nom personnalisé possible
    return 'Être sélectionné pour ' + (n === 'Grande Boucle' ? 'la Grande Boucle' : `« ${n} »`);
  },
  progress: 'Progresser de 2 points de niveau global',
  days: 'Courir au moins 35 jours',
};
const GOAL_SHORT = {
  gtTop10: 'top 10 GT',
  gtStage: 'étape GT',
  classic: 'top 10 classique',
  win: '1 victoire',
  get gtSelect() {
    return raceNameOf('gb');
  },
  progress: '+2 global',
  days: '35 jours',
};
// Objectif de la saison en cours d'un coureur (texte court avec état).
function goalTag(r) {
  if (!r.goal || r.goal.s !== S.season) return '';
  return (r.goal.done ? '✅ ' : '🎯 ') + GOAL_SHORT[r.goal.k];
}
// Grandes classiques (monuments et classiques de catégorie 1 d'un jour).
function isBigClassic(cal) {
  return cal.stagesSpec.length === 1 && cal.cat <= 1;
}
function assignGoals() {
  for (const id of S.teams[0].riders) {
    const r = S.riders[id];
    const ov = overall(r.s);
    let g;
    if (r.age <= 23) g = 'progress';
    else if (['complet', 'grimpeur'].includes(r.arch) && ov >= 78) g = 'gtTop10';
    else if (['sprinteur', 'puncheur'].includes(r.arch) && ov >= 75) g = 'gtStage';
    else if (['flahute', 'puncheur'].includes(r.arch) && ov >= 72) g = 'classic';
    else if (ov >= 73) g = 'win';
    else if (ov >= 69) g = 'gtSelect';
    else g = 'days';
    r.goal = { k: g, s: S.season, base: ov, done: false };
  }
}
// Suivi après chaque course du joueur.
function goalsAfterRace(rc) {
  const cal = S.cal[rc.calIdx];
  const gcl = gcList(rc);
  for (const id of rc.sel[0] || []) {
    const r = S.riders[id];
    if (!r || !r.goal || r.goal.done || r.goal.s !== S.season) continue;
    const k = r.goal.k;
    const pos = gcl.indexOf(id) + 1;
    const stageWin = rc.stageRes.some(st => st.res[0] && st.res[0].id === id);
    let ok = false;
    if (k === 'gtTop10') ok = cal.cat === 0 && pos > 0 && pos <= 10;
    else if (k === 'gtStage') ok = cal.cat === 0 && stageWin;
    else if (k === 'classic') ok = isBigClassic(cal) && pos > 0 && pos <= 10;
    else if (k === 'win') ok = pos === 1 || stageWin;
    else if (k === 'gtSelect') ok = cal.key === 'gb';
    if (ok) {
      r.goal.done = true;
      r.moral = clamp(r.moral + 6, 0, 100);
      msg('🎯 Objectif atteint', `${riderName(r)} a atteint son objectif de la saison : ${GOALS[k].toLowerCase()}.`);
    }
  }
}
// Fin de saison : bilan des objectifs (moral, fidélité, envie de partir).
function goalsEndSeason() {
  const ok = [],
    ko = [];
  for (const id of S.teams[0].riders) {
    const r = S.riders[id];
    if (!r.goal || r.goal.s !== S.season) continue;
    if (r.goal.k === 'progress') r.goal.done = overall(r.s) >= r.goal.base + 2;
    if (r.goal.k === 'days') r.goal.done = r.stats.days >= 35;
    if (r.goal.done) {
      ok.push(riderName(r));
      r.loyal = S.season + 1; // reconnaissant : il demandera un peu moins à la prolongation
      r.moral = clamp(r.moral + 6, 0, 100);
    } else {
      ko.push(riderName(r));
      if (r.amb > 60) r.moral = clamp(r.moral - 8, 0, 100);
      if (r.amb > 75 && r.goal.k === 'gtSelect' && rnd() < 0.35) r.wantsOut = true;
    }
  }
  if (ok.length || ko.length)
    msg('🎯 Objectifs personnels', `Atteints : ${ok.join(', ') || '—'}.<br>Manqués : ${ko.join(', ') || '—'}.`);
}
// Objectifs du sponsor pour la saison, selon le classement précédent.
function genObjectives() {
  const nT = S.teams.length;
  const rk = S.lastRank != null ? S.lastRank : Math.round(nT * 0.62);
  const d = diffOf().obj;
  // victoires visées : un peu sous la médiane des équipes de ce rang (saisons simulées : 27-36 pour les deux
  // premières, 13-21 du 3e au 5e, 6-9 du 6e au 8e, 3 vers le 9e, 1 à 3 du 11e au 13e, 0-1 au-delà)
  const base = rk <= 2 ? 16 : rk <= 3 ? 12 : rk <= 5 ? 9 : rk <= 7 ? 6 : rk <= 8 ? 4 : rk <= 11 ? 3 : rk <= 13 ? 2 : 1;
  const nW = Math.max(1, base + d * 2);
  // classement UCI visé : la place de la saison passée, avec une place de marge hors du haut du classement
  const uciN = clamp(rk + (rk > 6 ? 2 : 1) - d, 1, nT - 1);
  S.obj = [
    { k: 'wins', n: nW, txt: `Remporter au moins ${nW} victoire${nW > 1 ? 's' : ''} (étapes comprises)`, rew: 200 },
    {
      k: 'uci',
      n: uciN,
      txt: `Terminer dans les ${uciN} premières équipes au classement UCI`,
      rew: 250,
    },
    // un sponsor fixe des objectifs à la portée de son équipe : pour une équipe moyenne, une étape d'un Grand Tour
    // (la Grande Boucle seule ne réussit qu'une saison sur quatre environ à ce niveau)
    rk <= 4
      ? { k: 'gbTop10', txt: 'Placer un coureur dans le top 10 de la Grande Boucle', rew: 300 }
      : rk <= 8
        ? { k: 'gbStage', txt: 'Gagner une étape de la Grande Boucle', rew: 300 }
        : { k: 'gtStage', txt: 'Gagner une étape d’un Grand Tour', rew: 300 },
    { k: 'promo', txt: "Faire passer professionnel un coureur de l'académie", rew: 100 },
  ];
  S.objTrack = {};
}
// État d'avancement d'un objectif du sponsor.
function objStatus(o) {
  const T = S.teams[0];
  if (o.k === 'wins') {
    const w = seasonWins(0);
    return { ok: w >= o.n, prog: `${w}/${o.n}` };
  }
  if (o.k === 'uci') {
    const rk = uciRanking().indexOf(T) + 1;
    if (!S.teams.some(t => t.uci)) return { ok: false, prog: 'pas encore de points' };
    return { ok: rk <= o.n, prog: `actuellement ${rk}e` };
  }
  return { ok: !!(S.objTrack && S.objTrack[o.k]), prog: S.objTrack && S.objTrack[o.k] ? 'atteint' : 'pas encore' };
}
