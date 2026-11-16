'use strict';
/* Mode carrière, passe 7 : la fin de carrière et l'après. Record de l'heure, retraite (choisie à partir de 33 ans,
   imposée à 39), bilan, rêves accomplis, biographie, reconversion et ouverture du mode directeur où l'ancien
   coureur entre dans l'histoire du nouveau monde. */

const CAR_HOUR0 = { km: 55.42, name: 'Matteo Ferrandi' }; // record du monde de départ (coureur fictif)
const CAR_HOUR_PLACES = {
  mer: { lbl: 'Vélodrome au niveau de la mer', d: 'Conditions sûres.', km: 0, fail: 0 },
  alt: {
    lbl: 'Vélodrome en altitude',
    d: 'Air plus léger (+0,6 km environ), mais respiration difficile : une chance sur quatre de craquer.',
    km: 0.6,
    fail: 0.25,
  },
};
const CAR_RETIRE_AGE = 39;
const carKm = v => v.toFixed(3).replace('.', ',') + ' km';
const carOrd = n => (n === 1 ? '1er' : n + 'e');
const CAR_AFTER = {
  ds: {
    lbl: 'Directeur sportif',
    d: 'Tu passes de l’autre côté de l’oreillette : une équipe te confie sa direction sportive.',
  },
  fondateur: {
    lbl: 'Fondateur d’équipe',
    d: 'Tu montes ta propre équipe, à ton nom, avec une partie de tes économies.',
  },
  consultant: { lbl: 'Consultant télé', d: 'Tu commentes les courses : ta voix devient celle du cyclisme.' },
};

function carHourRec() {
  return (S.car.hourRec = S.car.hourRec || { ...CAR_HOUR0, s: S.season - 3 });
}
// Distance moyenne attendue (sans l'aléa du jour) : chrono, forme, âge, lieu.
function carHourKm(place) {
  const me = carMe();
  return 37 + me.s.clm * 0.2 + (me.forme - 70) * 0.05 - Math.max(0, me.age - 34) * 0.15 + CAR_HOUR_PLACES[place].km;
}
function carHourCan() {
  const me = carMe();
  const C = S.car;
  return carIsPro() && !C.end && me.age >= 22 && me.injury <= 0 && S.week >= 30 && (C.hour || {}).last !== S.season;
}
function carHourTry(place) {
  if (!carHourCan()) return null;
  const C = S.car;
  const me = carMe();
  const P = CAR_HOUR_PLACES[place] || CAR_HOUR_PLACES.mer;
  const H = (C.hour = C.hour || { best: 0, rec: false, list: [] });
  const crack = rnd() < P.fail;
  const km = +(carHourKm(place) + gauss() * 0.35 - (crack ? 1.5 : 0)).toFixed(3);
  const W = carHourRec();
  const rec = km > W.km;
  H.last = S.season;
  H.list.push({ s: S.season, km, place, rec });
  H.best = Math.max(H.best, km);
  me.fatigue = clamp(me.fatigue + 30, 0, 100);
  if (rec) {
    H.rec = true;
    Object.assign(W, { km, name: riderName(me), s: S.season, me: true });
    carAddPub(15);
    carAddPress(5);
    carMo(me, 15);
    carFeed('⏱️ Record de l’heure !', `${carKm(km)} : tu deviens le recordman de l’heure.`);
  } else {
    carAddPub(km > W.km - 1 ? 3 : 1);
    carMo(me, crack ? -6 : -2);
    carFeed(
      '⏱️ Record de l’heure',
      `${carKm(km)}${crack ? ' : l’altitude t’a coupé les jambes' : ''}. Le record (${carKm(W.km)}, ${W.name}) tient bon.`
    );
  }
  return { km, rec, crack };
}

// Début de saison : la question de la retraite, imposée à 39 ans.
function carRetireCheck() {
  const C = S.car;
  const me = carMe();
  if (C.end || C.kind !== 'pro') return;
  if (me.age >= CAR_RETIRE_AGE) {
    carRetire('Ton corps a dit stop : il est temps de raccrocher.');
    return;
  }
  if (me.age >= 33)
    carAsk(
      'retraite:' + S.season,
      `${me.age} ans. Tu continues une saison de plus ?`,
      [
        ['continuer', 'Encore une saison'],
        ['retraite', 'Raccrocher le vélo'],
      ],
      'continuer'
    );
}
CAR_FX.retraite = o => {
  if (o === 'retraite') carRetire('Tu as choisi ta sortie.');
  return '';
};
function carRetire(why) {
  const C = S.car;
  const me = carMe();
  const T = carTeamOfMe();
  if (T) {
    T.riders.splice(T.riders.indexOf(me.id), 1);
    mercLog(me, 'retraite', T.id, null);
  }
  me.retired = true;
  me.retS = S.season;
  me.team = null;
  C.asks = [];
  C.end = { s: S.season, age: me.age, after: null };
  carFeed('🏁 Fin de carrière', `${why} ${C.seasons.length} saisons, de ${C.born + 16} à ${S.season}.`);
}

// Rêves d'enfant : accomplis ou non (palmarès pro, courses de jeunes, record de l'heure).
function carPalmWins(f) {
  return (carMe().palm || []).filter(p => {
    const d = raceByName(p.r);
    return d && p.k === 1 && f(d, p);
  });
}
const CAR_GC = ['Classement général', 'Course', 'Course en ligne'];
function carDreamDone(k) {
  const C = S.car;
  const youth = t => C.res.some(x => x.rank === 1 && x.tier === t);
  if (k === 'pro') return C.kind === 'pro' || C.seasons.some(x => x.pro);
  if (k === 'nat') return youth('nat') || carPalmWins(d => d.key === 'natio').length > 0;
  if (k === 'monde') return youth('monde') || carPalmWins((d, p) => d.worlds && CAR_GC.includes(p.e)).length > 0;
  if (k === 'gtstage') return carPalmWins((d, p) => d.cat === 0 && /^Étape/.test(p.e)).length > 0;
  if (k === 'monument') return carPalmWins((d, p) => MONUMENTS.includes(d.key) && CAR_GC.includes(p.e)).length > 0;
  if (k === 'gb') return carPalmWins((d, p) => d.key === 'gb' && CAR_GC.includes(p.e)).length > 0;
  if (k === 'heure') return !!(C.hour && C.hour.rec);
  return false;
}
// Chiffres du bilan.
function carTotals() {
  const C = S.car;
  const me = carMe();
  const pro = (me.palm || []).filter(p => p.k === 1 && (CAR_GC.includes(p.e) || /^Étape/.test(p.e)));
  return {
    seasons: C.seasons.length,
    races: C.res.length,
    wins: C.res.filter(x => x.rank === 1).length + pro.filter(p => /^Étape/.test(p.e)).length,
    podiums: C.res.filter(x => x.rank && x.rank <= 3).length,
    best: C.res
      .filter(x => x.rank === 1)
      .sort((a, b) => (b.tier === 'pro' ? 1 : 0) - (a.tier === 'pro' ? 1 : 0))
      .slice(0, 6),
    legend: carLegendRank(),
    score: (me.palm || []).length ? palmScore(me).s : 0,
    money: C.money,
    teams: [...new Set(C.seasons.map(x => x.team))],
  };
}
// Biographie : quelques paragraphes écrits à partir de la carrière.
function carBio() {
  const C = S.car;
  const me = carMe();
  const P = carRep();
  const L = carLife();
  const t = carTotals();
  const name = `${me.fn} ${me.ln}`;
  const out = [];
  const first = C.seasons[0] || {};
  out.push(
    `${name} commence le vélo chez les cadets, au club ${first.team || C.club}, avec ${C.dreams.length > 1 ? 'des rêves' : 'un rêve'} en tête : ${C.dreams
      .map(carDreamTxt)
      .join(', ')}.`
  );
  const youthW = C.res.filter(x => x.rank === 1 && x.tier !== 'pro');
  if (youthW.length)
    out.push(
      `Chez les jeunes, ${youthW.length} victoire${youthW.length > 1 ? 's' : ''}, dont ${youthW
        .slice(-2)
        .map(x => x.name)
        .join(' et ')}.`
    );
  const proS = C.seasons.find(x => x.pro) || (C.kind === 'pro' ? { s: S.season, age: me.age, team: C.club } : null);
  if (proS) out.push(`Il passe professionnel en ${proS.s}, à ${proS.age} ans, chez ${proS.team}.`);
  else out.push('Le monde professionnel ne lui ouvrira jamais ses portes.');
  const pw = carPalmWins((d, p) => CAR_GC.includes(p.e) || /^Étape/.test(p.e));
  if (pw.length)
    out.push(
      `Chez les pros : ${pw.length} victoire${pw.length > 1 ? 's' : ''}, parmi lesquelles ${pw
        .slice(-3)
        .map(p => (/^Étape/.test(p.e) ? `une étape de ${p.r}` : `${p.r} ${p.s}`))
        .join(', ')}.`
    );
  const sty = carStyle();
  if (sty || P.nick)
    out.push(
      `Le public retient ${sty ? `un ${CAR_STYLES[sty].lbl.toLowerCase()}` : 'un coureur à part'}${P.nick ? `, que la presse surnomme « ${P.nick} »` : ''}.`
    );
  if (C.hour && C.hour.rec) out.push(`Il détient le record de l'heure avec ${carKm(C.hour.best)}.`);
  else if (C.hour && C.hour.best)
    out.push(`Il s'attaque au record de l'heure (${carKm(C.hour.best)}), sans le battre.`);
  if (L.partner || L.kids.length)
    out.push(
      `Côté famille : ${L.partner ? `${L.partner.name} à ses côtés` : 'une séparation'}${L.kids.length ? `, ${L.kids.length} enfant${L.kids.length > 1 ? 's' : ''}` : ''}.`
    );
  const done = C.dreams.filter(carDreamDone);
  out.push(
    done.length === C.dreams.length
      ? 'Tous ses rêves d’enfant sont devenus réalité.'
      : done.length
        ? `Rêves accomplis : ${done.map(carDreamTxt).join(', ')}. Les autres resteront des regrets.`
        : 'Ses rêves d’enfant resteront des rêves.'
  );
  if (t.legend) out.push(`Son palmarès le classe ${carOrd(t.legend)} parmi les légendes du peloton.`);
  if (C.end && C.end.after) out.push(`Après sa carrière, il devient ${CAR_AFTER[C.end.after].lbl.toLowerCase()}.`);
  return out;
}

// L'ancien coureur, tel qu'il passera dans le monde du mode directeur.
function carLegacy(after) {
  const C = S.car;
  const me = carMe();
  if (C.end) C.end.after = after;
  return {
    after,
    fn: me.fn,
    ln: me.ln,
    nat: me.nat,
    arch: me.arch,
    age: me.age,
    cm: me.cm,
    kg: me.kg,
    s: { ...me.s },
    palm: (me.palm || []).slice(),
    nick: carRep().nick,
    money: Math.max(0, C.money),
    bio: carBio(),
  };
}
// Nouvelle partie de directeur à partir de l'héritage : équipe, budget, l'ancien coureur dans l'histoire.
function newGameFromLegacy(G, seed) {
  const team = G.after === 'fondateur' ? `Team ${G.ln}` : 'Horizon Cyclisme';
  newGame(team, seed || Date.now(), 'normal');
  const r = genRider(G.arch, 0, { age: Math.max(39, G.age), nat: G.nat });
  Object.assign(r, {
    fn: G.fn,
    ln: G.ln,
    s: { ...G.s },
    cm: G.cm,
    kg: G.kg,
    palm: G.palm.slice(),
    team: null,
    retired: true,
    retS: S.season - 1,
    legacy: true,
  });
  r.ceil = overall(r.s);
  S.riders[r.id] = r;
  S.legacy = { id: r.id, after: G.after };
  if (G.after === 'fondateur') {
    S.budget += Math.round(Math.min(2000, G.money * 0.6));
    S.rep = Math.max(20, S.rep - 10);
  } else S.rep += 5;
  msg(
    G.after === 'fondateur' ? 'Ton équipe' : 'Ta nouvelle vie',
    `${G.fn} ${G.ln}${G.nick ? ` (« ${G.nick} »)` : ''} passe de l'autre côté de l'oreillette. ${
      G.after === 'fondateur'
        ? `Tes économies financent une partie du budget (${fmtMoney(S.budget)}). La réputation, elle, reste à construire.`
        : 'Ton nom ouvre des portes : la réputation de l’équipe en profite.'
    } Ton palmarès de coureur figure parmi les légendes.`
  );
  return r;
}
