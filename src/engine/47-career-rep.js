'use strict';
/* Mode carrière, passe 5 : la réputation. Popularité auprès du public, relations avec la presse, abonnés sur
   les réseaux, style de course (déduit de ce que le joueur fait vraiment en course), déclarations d'après-course,
   surnom, statut, sponsors personnels et place parmi les légendes du peloton.
   La popularité pèse sur les salaires proposés, les sponsors et (chez les pros) la sélection ; la presse amplifie
   ou ternit chaque coup d'éclat ; les réseaux font grimper la popularité au prix de polémiques. */

const CAR_SOCIAL = {
  discret: {
    lbl: 'Discret',
    d: 'Presque rien sur les réseaux : moral tranquille, peu de nouveaux fans.',
    pub: 0,
    fans: 0.3,
    risk: 0,
    moral: 0.15,
  },
  actif: {
    lbl: 'Actif',
    d: 'Photos d’entraînement, coulisses : la popularité monte doucement.',
    pub: 0.12,
    fans: 1,
    risk: 0.004,
    moral: 0,
  },
  star: {
    lbl: 'Très présent',
    d: 'Vidéos, avis tranchés : popularité en flèche, polémiques possibles, moral usé.',
    pub: 0.3,
    fans: 2.2,
    risk: 0.014,
    moral: -0.25,
  },
};
// Déclarations d'après-course : popularité, presse, confiance du DS, moral, relation (rival) ; claim = promesse.
const CAR_DECL = {
  humble: { lbl: 'Rester humble, remercier l’équipe', pub: 1, press: 3, trust: 1.5, moral: 0 },
  ambition: { lbl: 'Afficher ses ambitions', pub: 4, press: 1, trust: 0, moral: 3, claim: true },
  pique: { lbl: 'Lancer une pique à un rival', pub: 5, press: 4, trust: -5, moral: 2, rel: -10 },
  bois: { lbl: 'Langue de bois', pub: 0, press: -3, trust: 0, moral: 0 },
};
const CAR_STYLES = {
  att: {
    lbl: 'Attaquant',
    d: 'Tu animes la course : le public adore, même sans victoire.',
    nick: ['le Panache', 'le Baroudeur', 'l’Insoumis', 'le Kamikaze'],
  },
  win: {
    lbl: 'Gagneur',
    d: 'Tu gagnes : la presse et les sponsors te suivent.',
    nick: ['le Patron', 'la Machine', 'le Boss', 'le Prédateur'],
  },
  wheel: {
    lbl: 'Finisseur',
    d: 'Discret jusqu’au final, placé ensuite : efficace, peu spectaculaire.',
    nick: ['le Renard', 'le Chat', 'le Sniper', 'le Fantôme'],
  },
  help: {
    lbl: 'Équipier de l’ombre',
    d: 'Tu travailles pour les autres : respecté au sein du peloton.',
    nick: ['l’Ange gardien', 'le Fidèle', 'le Soldat', 'le Métronome'],
  },
};
const CAR_STATUS = ['Anonyme', 'Espoir à suivre', 'Coureur reconnu', 'Leader reconnu', 'Star', 'Légende vivante'];
const CAR_BRANDS = [
  ['Lunettes', 'image'],
  ['Montres', 'image'],
  ['Nutrition sportive', 'perf'],
  ['Automobiles', 'image'],
  ['Banque régionale', 'local'],
  ['Vêtements urbains', 'fans'],
  ['Matériel de home-trainer', 'fans'],
  ['Boissons énergétiques', 'perf'],
];

function carRep() {
  const C = S.car;
  return (C.rep = C.rep || {
    pub: Math.min(30, C.vis * 0.5),
    press: 50,
    fans: 120,
    social: 'discret',
    style: { att: 0, win: 0, wheel: 0, help: 0 },
    nick: null,
    claim: false,
    spons: [],
    leg: 0,
  });
}
function carAddPub(v) {
  const P = carRep();
  const pm = v > 0 ? 0.7 + P.press / 167 : 1; // bonne presse : +30 %, mauvaise : -30 %
  P.pub = clamp(P.pub + v * pm, 0, 100);
}
function carAddPress(v) {
  const P = carRep();
  P.press = clamp(P.press + v, 0, 100);
}
// Style dominant (au moins quelques courses marquantes), sinon rien.
function carStyle() {
  const st = carRep().style;
  const k = Object.keys(st).sort((a, b) => st[b] - st[a])[0];
  return st[k] >= 3 ? k : null;
}
function carStatus() {
  const me = carMe();
  const P = carRep();
  const ps = (me.palm || []).length ? palmScore(me).s : 0;
  if (ps >= 60 || P.pub >= 92) return 5;
  if (ps >= 30 || P.pub >= 75) return 4;
  if (ps >= 12 || P.pub >= 55) return 3;
  if (ps >= 4 || P.pub >= 32) return 2;
  if (P.pub >= 12 || carIsPro()) return 1;
  return 0;
}
function carStatusLbl() {
  const k = carStatus();
  return k === 1 && carMe().age > 23 ? 'Coureur du peloton' : CAR_STATUS[k];
}
// Multiplicateur des salaires proposés : la notoriété se paie.
function carRepPay() {
  return 1 + carStatus() * 0.04 + carRep().pub / 1000;
}
function carLegendRank() {
  const me = carMe();
  if (!(me.palm || []).length) return 0;
  return legends(200).findIndex(x => x.r.id === me.id) + 1;
}
function carSponsorIncome() {
  return sum(carRep().spons.map(s => s.k));
}

// Après chaque course : style, popularité, presse, promesses tenues ou non, déclaration à faire.
function carRepAfterRace(rc, name, tier, key, rank, n, w) {
  const P = carRep();
  const me = carMe();
  const att = (rc.carRadio || []).filter(([k]) => k === 'attack' || k === 'bridge').length;
  const mine = rc.orders && rc.orders[me.id] ? rc.orders[me.id].o : null;
  const st = P.style;
  for (const k in st) st[k] *= 0.97;
  if (att) st.att += Math.min(2, att) * 0.6;
  if (rank === 1) st.win += 1;
  else if (rank && rank <= 10 && !att) st.wheel += 0.6;
  if (CAR_HELPER_ORDERS.has(mine) && !att) st.help += 0.6;
  const big = tier !== 'club';
  let g = rank === 1 ? 5 : rank && rank <= 3 ? 2.5 : rank && rank <= 10 ? 0.8 : 0;
  if (att) g += Math.min(2, att) * 0.6; // le panache se voit même sans résultat
  if (carDreamMatch(name, key, tier)) g *= 1.3;
  carAddPub(g * w * 0.35 * carTraitMul('vis'));
  if (rank === 1 && big) carAddPress(1.5);
  // promesse d'avant-course
  if (P.claim) {
    P.claim = false;
    if (!rank || rank > 10) {
      carAddPub(-3);
      carAddPress(-2);
      carFeed('🗞️ Les promesses', 'Tu avais annoncé du grand, la presse te le rappelle sans pitié.');
    } else if (rank <= 3) {
      carAddPub(2);
      carFeed('🗞️ Promesse tenue', 'Tu l’avais annoncé, tu l’as fait : les journalistes adorent.');
    }
  }
  // mauvaise presse : les critiques pèsent sur le moral après une course ratée
  if (P.press < 30 && (!rank || rank > n / 2)) carMo(me, -2);
  // déclaration après une belle course ou une grosse déception (pas dans les courses régionales)
  const flop = !CAR_HELPER_ORDERS.has(mine) && me.forme >= 70 && (!rank || rank > Math.max(20, n * 0.5)) && w >= 2;
  if (big && ((rank && rank <= 3) || flop))
    carAsk(
      'decl:' + S.season + ':' + key,
      `Micro tendu après ${name} (${rank ? rank + 'e' : 'abandon'}). Que dis-tu ?`,
      Object.entries(CAR_DECL).map(([k, D]) => [k, D.lbl]),
      'bois',
      { name, rank }
    );
}
CAR_FX.decl = (o, a) => {
  const D = CAR_DECL[o] || CAR_DECL.bois;
  const me = carMe();
  carAddPub(D.pub);
  carAddPress(D.press);
  if (D.trust && carIsPro()) carSetTrust(D.trust, '');
  else if (D.trust) S.car.trust = clamp(S.car.trust + D.trust, 0, 100);
  if (D.moral) carMo(me, D.moral);
  if (D.claim) carRep().claim = true;
  if (D.rel) {
    const R = carIsPro() && carInternalRival() ? carInternalRival().r : carRivals(1)[0];
    if (R) {
      addRel(me.id, R.id, D.rel);
      return `${riderName(R)} n'a pas apprécié. Les journalistes, eux, ont leur titre.`;
    }
  }
  return o === 'bois' ? 'Les journalistes repartent sans rien : ils s’en souviendront.' : '';
};

// Semaine : réseaux, retour au calme, sponsors, surnom.
function carRepWeekly() {
  const C = S.car;
  const P = carRep();
  const me = carMe();
  const So = CAR_SOCIAL[P.social] || CAR_SOCIAL.discret;
  const stat = carStatus();
  // la popularité retombe lentement vers le niveau que justifie le statut ; la presse revient vers la neutralité
  P.pub = clamp(P.pub + (stat * 9 + (carIsPro() ? 8 : 0) - P.pub) * 0.012 + So.pub, 0, 100);
  P.press += (50 - P.press) * 0.02;
  P.fans = Math.round(P.fans + (20 + P.pub ** 1.6 * 2.2) * So.fans * (1 + rnd() * 0.3));
  if (So.moral) carMo(me, So.moral);
  if (rnd() < So.risk) carPolemic();
  // sponsors : argent chaque semaine, une obligation (séance photo, salon) toutes les six semaines
  for (const sp of P.spons) {
    C.money += sp.k / LAST_WEEK;
    if (S.week % 6 === sp.id % 6) me.fatigue = clamp(me.fatigue + 4, 0, 100);
  }
  if ((S.week === 3 || S.week === 22) && me.age >= 17) carSponsorOffer();
  // surnom : quand un style s'impose et que le public te connaît
  const sty = carStyle();
  if (!P.nick && sty && P.style[sty] >= 6 && P.pub >= 30) {
    P.nick = pick(CAR_STYLES[sty].nick);
    carAddPub(4);
    carFeed('🏷️ Un surnom', `La presse t'appelle désormais « ${P.nick} ». ${CAR_STYLES[sty].d}`);
  }
}
function carPolemic() {
  const P = carRep();
  carAddPress(-6);
  P.pub = clamp(P.pub + (rnd() < 0.5 ? 3 : -4), 0, 100);
  if (carIsPro()) carSetTrust(-3, '');
  const gone = P.spons.filter(s => s.clause === 'image' && rnd() < 0.5);
  P.spons = P.spons.filter(s => !gone.includes(s));
  carFeed(
    '📱 Polémique',
    `Une de tes publications fait scandale. La presse s'en donne à cœur joie.${gone.length ? ` ${gone.map(s => s.brand).join(', ')} met fin à votre contrat.` : ''}`
  );
}
function carSponsorOffer() {
  const P = carRep();
  if (P.spons.length >= 3 || rnd() > P.pub / 80) return;
  const [brand, clause] = pick(CAR_BRANDS.filter(b => !P.spons.some(s => s.brand === b[0])));
  const k = Math.round(
    2 + P.pub * 0.22 + carStatus() * 3 + Math.min(12, P.fans / 25000) + (clause === 'fans' ? P.fans / 40000 : 0)
  );
  const years = rint(1, 2);
  const txt = {
    image: 'image irréprochable exigée (une polémique peut tout casser)',
    perf: 'prime à chaque victoire',
    local: 'apparitions dans ta région',
    fans: 'publications régulières exigées',
  }[clause];
  carAsk(
    'spons:' + S.season + ':' + S.week,
    `Un sponsor personnel (${brand}) te propose ${fmtMoney(k)}/an pendant ${years} an(s) : ${txt}. Une obligation (photos, salon) toutes les six semaines.`,
    [
      ['oui', 'Signer'],
      ['non', 'Refuser'],
    ],
    'non',
    { brand, clause, k, years }
  );
}
CAR_FX.spons = (o, a) => {
  if (o !== 'oui') return '';
  const P = carRep();
  const d = a.data;
  P.spons.push({
    id: S.week + P.spons.length,
    brand: d.brand,
    clause: d.clause,
    k: d.k,
    until: S.season + d.years - 1,
  });
  if (d.clause === 'fans' && P.social === 'discret') P.social = 'actif';
  if (d.clause === 'local') carAddPub(2);
  return d.clause === 'fans' ? 'Tu dois publier : te voilà actif sur les réseaux.' : '';
};
// Prime de victoire des sponsors « performance ».
function carRepWin() {
  for (const sp of carRep().spons) if (sp.clause === 'perf') S.car.money += Math.max(2, sp.k * 0.15);
}
// Fin de saison : contrats de sponsors échus, place parmi les légendes.
function carRepEndSeason() {
  const P = carRep();
  const end = P.spons.filter(s => s.until <= S.season);
  P.spons = P.spons.filter(s => s.until > S.season);
  if (end.length) carFeed('🤝 Sponsors', `Fin de contrat : ${end.map(s => s.brand).join(', ')}.`);
  const L = carLegendRank();
  for (const th of [100, 50, 25, 10, 3])
    if (L && L <= th && (!P.leg || P.leg > th)) {
      carFeed('🏛️ Légendes du peloton', `Ton palmarès te place ${L}e parmi les plus grands coureurs de ce monde.`);
      carAddPub(3);
      break;
    }
  if (L) P.leg = P.leg ? Math.min(P.leg, L) : L;
}
