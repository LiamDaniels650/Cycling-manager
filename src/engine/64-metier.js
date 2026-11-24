/* Le métier autour des courses.
   - Visibilité TV : pendant la retransmission (la seconde moitié de l'étape environ), le temps d'antenne se partage
     entre l'échappée, les groupes en chasse et les équipes qui mènent le peloton ; l'arrivée et les podiums en
     donnent aussi. Pondéré par l'audience (grands tours, classiques), il est payé par votre sponsor après chaque
     course et compte pour sa confiance : une petite équipe vit aussi de ses échappées.
   - Jeux olympiques : tous les quatre ans (années bissextiles), un contre-la-montre puis une course en ligne par
     sélections nationales (deux et quatre coureurs par pays), avec médailles.
   - À domicile : un coureur qui court dans son pays (Belge et Néerlandais dans le Nord, Italiens en Italie…) est un
     peu plus motivé, et gagne davantage en popularité s'il brille devant son public. */

// --- Visibilité TV ---
const TV_AUD = [3, 1.5, 0.6]; // audience selon la catégorie (grand tour, WorldTour, autres)
const TV_RATE = 0.04; // k€ par minute d'antenne pondérée (versés par le sponsor)
function tvOn(sim) {
  return !sim.rc.worlds && !sim.rc.esp && !S.car;
}
// À chaque pas : partage du temps d'antenne (minutes) entre les équipes à l'image.
function tvTick(sim) {
  if (!tvOn(sim)) return;
  const L = sim.groups.filter(G => G.riders.some(x => !x.fin && !x.dnf)).sort((a, b) => b.pos - a.pos);
  if (!L.length) return;
  const H = L[0];
  if (sim.dist - H.pos > Math.max(80, sim.dist * 0.55)) return; // pas encore à l'antenne
  const T = (sim.rc.tvCur = sim.rc.tvCur || {});
  const dt = DT_MIN;
  const give = (G, share, onlyWork) => {
    const xs = G.riders.filter(x => !x.fin && !x.dnf && (!onlyWork || x.work > 0));
    if (!xs.length) return false;
    for (const x of xs) T[x.team.id] = (T[x.team.id] || 0) + (dt * share) / xs.length;
    return true;
  };
  const pel = sim.pel && L.includes(sim.pel) ? sim.pel : L[0];
  const ahead = L.filter(G => G.pos > pel.pos);
  if (ahead.length) {
    give(ahead[0], 0.5);
    for (const G of ahead.slice(1)) give(G, 0.2 / (ahead.length - 1));
    if (!give(pel, 0.3, true)) give(pel, 0.3);
  } else if (!give(pel, 0.6, true)) give(pel, 0.6);
  else give(pel, 0.4);
}
// Fin d'étape : arrivée et podiums, puis cumul de la course.
function tvStageEnd(rc, res) {
  if (rc.worlds || rc.esp || S.car || !res.length) return;
  const T = (rc.tvCur = rc.tvCur || {});
  const add = (id, m) => {
    const r = S.riders[id];
    if (r && r.team != null) T[r.team] = (T[r.team] || 0) + m;
  };
  add(res[0].id, 3);
  if (res[1]) add(res[1].id, 1);
  if (res[2]) add(res[2].id, 1);
  if (rc.specs.length > 1) {
    const g = gcList(rc)[0];
    if (g != null) add(g, 2);
  }
  rc.tv = rc.tv || {};
  for (const k in T) rc.tv[k] = (rc.tv[k] || 0) + T[k];
  rc.tvLast = T;
  const sr = rc.stageRes[rc.stageRes.length - 1];
  if (sr) sr.tv = Math.round(T[0] || 0); // (votre temps d'antenne de l'étape, pour le bilan)
  rc.tvCur = {};
}
// Fin de course : saison de chaque équipe (minutes pondérées par l'audience), paiement du sponsor.
function tvRaceEnd(rc) {
  if (rc.worlds || rc.esp || S.car || !rc.tv) return;
  const aud = TV_AUD[rc.cat] || 0.6;
  if (!S.tvs || S.tvs.s !== S.season) S.tvs = { s: S.season, by: {}, races: [], paid: 0 };
  for (const k in rc.tv) S.tvs.by[k] = (S.tvs.by[k] || 0) + rc.tv[k] * aud;
  const mine = rc.tv[0] || 0;
  const pay = Math.round(mine * aud * TV_RATE);
  S.tvs.races.unshift({ key: rc.key, name: rc.name, min: Math.round(mine), w: Math.round(mine * aud), pay });
  if (S.tvs.races.length > 40) S.tvs.races.length = 40;
  if (pay > 0) {
    S.budget += pay;
    S.tvs.paid += pay;
    finAdd('spons', pay);
  }
}
// Rang de votre équipe en visibilité sur la saison.
function tvRank() {
  if (!S.tvs || S.tvs.s !== S.season) return null;
  const arr = S.teams.map(T => [T.id, S.tvs.by[T.id] || 0]).sort((a, b) => b[1] - a[1]);
  return {
    rank: arr.findIndex(a => a[0] === 0) + 1,
    n: arr.length,
    min: Math.round(S.tvs.by[0] || 0),
    top: arr.slice(0, 5),
  };
}
// Fin de saison : le sponsor juge aussi la visibilité (confiance).
function tvEndSeason() {
  const k = tvRank();
  if (!k) return;
  const d = k.rank <= 3 ? 3 : k.rank <= 6 ? 1 : k.rank > k.n - 4 ? -2 : 0;
  if (d) S.conf = clamp(S.conf + d, 0, 100);
  msg(
    '📺 Visibilité de la saison',
    `${k.min} minutes d'antenne pondérées, ${k.rank}e équipe sur ${k.n}. Votre sponsor a versé ${fmtMoney(S.tvs.paid)} de primes de visibilité.${d ? ` Confiance du sponsor ${d > 0 ? '+' : ''}${d}.` : ''}`
  );
  (S.tvHist = S.tvHist || []).push({ s: S.season, rank: k.rank, min: k.min, paid: S.tvs.paid });
}

// --- Jeux olympiques ---
function isOlympicYear(season) {
  return season % 4 === 0;
}
const MEDAL = ['🥇 Médaille d’or', '🥈 Médaille d’argent', '🥉 Médaille de bronze'];
function olympicAfter(rc) {
  const cal = S.cal[rc.calIdx];
  const gcl = gcList(rc);
  const itt = cal.stagesSpec[0][0] === 'clm';
  const what = itt ? 'Contre-la-montre olympique' : 'Course en ligne olympique';
  gcl.slice(0, 3).forEach((id, k) => {
    const r = S.riders[id];
    palmAdd(id, rc.name, what, k + 1);
    (r.olymp = r.olymp || []).push({ s: S.season, k: k + 1, itt });
    r.pop = clamp((r.pop || 30) + (k ? 6 : 15), 0, 100);
    r.moral = clamp(r.moral + (k ? 6 : 12), 0, 100);
  });
  const nm = id => riderName(S.riders[id]);
  const natOf = id => S.riders[id].nat;
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
  const myMed = gcl.slice(0, 3).filter(id => S.riders[id].team === 0);
  for (const id of myMed) {
    const k = gcl.indexOf(id);
    const prime = [120, 60, 30][k];
    S.budget += prime;
    finAdd('prize', prime);
    if (k === 0) legCredit(0, 40, `${rc.name} : champion olympique (${nm(id)})`);
  }
  const w = S.riders[gcl[0]];
  msg(
    `Bilan : ${rc.name}`,
    [
      `🥇 ${riderName(w)} (${NAT_NAME[w.nat] || w.nat}), 🥈 ${gcl[1] != null ? nm(gcl[1]) : '—'}, 🥉 ${gcl[2] != null ? nm(gcl[2]) : '—'}.`,
      mine.length
        ? `Vos coureurs : ${mine.map(id => `${nm(id)} ${gcl.indexOf(id) + 1}e`).join(', ')}.${myMed.length ? ' Prime du sponsor pour la médaille.' : ''}`
        : "Aucun de vos coureurs n'était sélectionné.",
    ].join('<br>')
  );
  press(
    `🥇 ${riderName(w)} champion olympique`,
    `${riderName(w)} offre l'or à ${NAT_NAME[w.nat] || w.nat} (${itt ? 'contre-la-montre' : 'course en ligne'}).${w.team === 0 ? ' Une fierté pour votre équipe.' : ''}`,
    w.team === 0 ? 2 : 0,
    [w.id]
  );
}

// --- À domicile ---
const HOME_REG = { FRA: ['FRA'], NORD: ['BEL', 'NED'], ITA: ['ITA'], IBE: ['ESP'], ALP: ['SUI'] };
const HOME_RACE = {
  cyclass: ['GER'],
  polders: ['NED'],
  flandres: ['BEL'],
  pav: ['FRA', 'BEL'],
  romand: ['SUI'],
  cantons: ['SUI'],
};
function homeNats(key) {
  if (HOME_RACE[key]) return HOME_RACE[key];
  const reg = RACE_REG[key];
  return (reg && HOME_REG[reg]) || [];
}
function isHome(rc, r) {
  return !!r && !rc.worlds && rc.key !== 'natio' && homeNats(rc.key).includes(r.nat);
}
// Motivation du jour (forme du jour).
function homeBoost(rc, r) {
  // course d'un jour : +2 ; course par étapes d'une semaine : +1 ; grand tour : rien (la motivation ne tient pas
  // trois semaines au même niveau, seule la popularité devant le public compte)
  if (!isHome(rc, r) || rc.cat === 0) return 0;
  return rc.specs.length > 1 ? R.homeForm / 2 : R.homeForm;
}
// Fin de course : un coureur qui brille à domicile gagne plus en popularité.
function homeAfterRace(rc) {
  if (rc.worlds || S.car) return;
  const gcl = gcList(rc);
  gcl.slice(0, 10).forEach((id, k) => {
    const r = S.riders[id];
    if (!isHome(rc, r)) return;
    r.pop = clamp((r.pop || 30) + (k === 0 ? 5 : 2), 0, 100);
    if (k === 0 && r.team === 0)
      msg('🏠 Triomphe à domicile', `${riderName(r)} gagne ${rc.name} devant son public : popularité en hausse.`);
  });
}
