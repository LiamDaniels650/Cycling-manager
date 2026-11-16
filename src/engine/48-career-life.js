'use strict';
/* Mode carrière, passe 6 : la vie hors vélo. Lieu de vie (entraînement, forme, impôts, coût, moral), train de vie,
   placements de l'épargne, couple et enfants, priorité famille ou vélo et tensions qu'elle crée, naissance qui
   tombe pendant une course. Montants en k€ par an, comme les salaires. */

const CAR_PARTNER_FN = [
  'Léa',
  'Camille',
  'Julie',
  'Sarah',
  'Emma',
  'Manon',
  'Chloé',
  'Marie',
  'Inès',
  'Laura',
  'Giulia',
  'Elena',
  'Sofia',
  'Lotte',
  'Anna',
  'Clara',
  'Lucía',
  'Eva',
];
const CAR_HOMES = {
  famille: {
    lbl: 'Chez tes parents',
    d: 'Gratuit et rassurant.',
    cost: 0,
    train: 1,
    forme: 0,
    tax: 1,
    moral: 0.15,
    pub: 0,
    min: 0,
  },
  region: {
    lbl: 'Dans ta région',
    d: 'Ton appartement, tes routes, tes proches à côté.',
    cost: 10,
    train: 1,
    forme: 0,
    tax: 1,
    moral: 0.1,
    pub: 0,
    min: 18,
  },
  gerone: {
    lbl: 'Gérone (Espagne)',
    d: 'La colonie des pros : routes idéales, groupes d’entraînement relevés.',
    cost: 16,
    train: 1.12,
    forme: 0.5,
    tax: 1,
    moral: 0,
    pub: 0,
    min: 19,
  },
  andorre: {
    lbl: 'Andorre',
    d: 'Altitude et impôts légers ; loin de tout.',
    cost: 24,
    train: 1.06,
    forme: 1.5,
    tax: 1.12,
    moral: -0.05,
    pub: 0,
    min: 20,
  },
  monaco: {
    lbl: 'Monaco',
    d: 'Presque pas d’impôts, du glamour, des loyers vertigineux.',
    cost: 70,
    train: 1.02,
    forme: 0.5,
    tax: 1.25,
    moral: 0,
    pub: 0.04,
    min: 22,
  },
};
const CAR_LIFESTYLE = {
  modeste: { lbl: 'Modeste', d: 'Tu mets de côté.', cost: 12, moral: 0, pub: 0 },
  confort: { lbl: 'Confortable', d: 'Une vie agréable, sans folie.', cost: 40, moral: 0.1, pub: 0 },
  luxe: { lbl: 'Grand train', d: 'Voitures, voyages : agréable et vu, mais coûteux.', cost: 90, moral: 0.2, pub: 0.03 },
};
const CAR_INVEST = {
  compte: { lbl: 'Compte courant', d: 'Rien ne bouge.', mu: 0, sd: 0 },
  livret: { lbl: 'Épargne sûre', d: 'Environ 2,5 % par an, sans risque.', mu: 0.025, sd: 0 },
  immo: { lbl: 'Immobilier', d: 'Environ 4 % par an, peu de surprises.', mu: 0.04, sd: 0.03 },
  bourse: { lbl: 'Bourse', d: 'Environ 6 % par an en moyenne, mais certaines années font mal.', mu: 0.06, sd: 0.16 },
};
// Priorité quand on a une famille : entraînement (multiplicateur), tension (accumulée, résorbée), moral.
const CAR_PRIO = {
  velo: {
    lbl: 'Le vélo d’abord',
    d: 'Tout pour la carrière : la famille en souffre.',
    train: 1,
    add: 1.4,
    ease: 0.6,
    moral: 0,
  },
  equilibre: {
    lbl: 'Équilibre',
    d: 'Un peu moins d’entraînement, un foyer apaisé.',
    train: 0.97,
    add: 0.8,
    ease: 1,
    moral: 0.1,
  },
  famille: {
    lbl: 'La famille d’abord',
    d: 'Moins d’entraînement, beaucoup de bonheur.',
    train: 0.92,
    add: 0.3,
    ease: 1.6,
    moral: 0.25,
  },
};

function carLife() {
  const C = S.car;
  return (C.life = C.life || {
    home: 'famille',
    style: 'modeste',
    inv: 'compte',
    prio: 'velo',
    partner: null,
    kids: [],
    due: null,
    tension: 0,
    days: carMe().espDays || 0,
    pension: 0,
    biz: null,
  });
}
const carHasFamily = () => !!(carLife().partner || carLife().kids.length);
function carLifeTrain() {
  const L = carLife();
  return CAR_HOMES[L.home].train * (carHasFamily() ? CAR_PRIO[L.prio].train : 1) * (carHasStaff('coach') ? 1.06 : 1);
}
function carLifeForme() {
  return CAR_HOMES[carLife().home].forme + carCampForme();
}
function carLifeTax() {
  return CAR_HOMES[carLife().home].tax;
}
// Dépenses de l'année : logement, train de vie, enfants, pension.
function carLifeCost() {
  const L = carLife();
  if (L.home === 'famille' && S.car.kind !== 'pro') return carStaffCost(); // les parents paient le reste
  return (
    carStaffCost() +
    CAR_HOMES[L.home].cost +
    CAR_LIFESTYLE[L.style].cost * (L.home === 'famille' ? 0.3 : 1) +
    L.kids.length * 8 +
    L.pension
  );
}
function carLifeIncome() {
  const me = carMe();
  const C = S.car;
  const sal = C.kind === 'pro' ? me.salary * (1 - (C.agent ? CAR_AGENTS[C.agent.kind].fee : 0)) * carLifeTax() : 0;
  return sal + carSponsorIncome();
}
function carMove(k) {
  const L = carLife();
  const H = CAR_HOMES[k];
  if (!H || k === L.home || carMe().age < H.min) return false;
  S.car.money -= H.cost * 0.25; // déménagement, caution
  L.home = k;
  carFeed('📦 Déménagement', `Tu t'installes : ${H.lbl}. ${H.d}`);
  return true;
}

function carLifeWeekly() {
  const C = S.car;
  const L = carLife();
  const me = carMe();
  const H = CAR_HOMES[L.home];
  const St = CAR_LIFESTYLE[L.style];
  C.money -= carLifeCost() / LAST_WEEK;
  carMo(
    me,
    H.moral + St.moral + (carHasFamily() ? CAR_PRIO[L.prio].moral : 0) + L.kids.length * 0.06 + (L.partner ? 0.1 : 0)
  );
  if (H.pub + St.pub) carAddPub(H.pub + St.pub);
  if (C.money < 0) {
    carMo(me, -0.4);
    if (S.week % 8 === 0)
      carFeed('💸 Fins de mois difficiles', 'Tu dépenses plus que tu ne gagnes : les dettes te pèsent.');
  }
  // nuits courtes la première année d'un enfant
  if (L.kids.some(k => k.s === S.season || k.s === S.season - 1) && L.prio !== 'famille')
    me.fatigue = clamp(me.fatigue + 1, 0, 100);
  // tensions : les jours de course loin de la maison s'accumulent quand on a une famille
  const days = Math.max(0, (me.espDays || 0) - L.days);
  L.days = me.espDays || 0;
  if (carHasFamily()) {
    const P = CAR_PRIO[L.prio];
    L.tension = clamp(L.tension + days * 0.4 * P.add * (1 + L.kids.length * 0.3) - 0.8 * P.ease, 0, 100);
    if (L.tension >= 70 && L.partner && !(L.crisis > S.season * 100 + S.week - 8)) {
      L.crisis = S.season * 100 + S.week;
      carAsk(
        'crise:' + S.season + ':' + S.week,
        `${L.partner.name} n'en peut plus de tes absences. Que fais-tu ?`,
        [
          ['lever', 'Lever le pied : la famille d’abord'],
          ['continuer', 'Continuer comme avant'],
        ],
        'continuer'
      );
    }
  }
  // premier vrai contrat : quitter la maison familiale ?
  if (C.kind === 'pro' && L.home === 'famille' && !L.movedAsk && me.salary > 0) {
    L.movedAsk = true;
    carAsk(
      'logement:' + S.season,
      'Te voilà professionnel. Tu restes chez tes parents ou tu t’installes ?',
      Object.entries(CAR_HOMES)
        .filter(([, H]) => me.age >= H.min)
        .map(([k, H]) => [k, `${H.lbl}${H.cost ? ` (${fmtMoney(H.cost)}/an)` : ''}`]),
      'region'
    );
  }
  // rencontre
  if (!L.partner && me.age >= 19 && rnd() < 0.004) {
    const name = pick(CAR_PARTNER_FN);
    carAsk(
      'couple:' + S.season + ':' + S.week,
      `Tu rencontres ${name}. Une histoire commence ?`,
      [
        ['oui', 'Oui, on verra bien'],
        ['non', 'Pas le moment : la carrière d’abord'],
      ],
      'oui',
      { name }
    );
  }
  // naissance (et la course qui tombe la même semaine)
  if (L.due && L.due.s === S.season) {
    if (S.week === L.due.w - 1) {
      const T = carTeamOfMe();
      const c = T && S.cal.find(c => c.w === L.due.w && !c.done && carIsPro() && carProSelected(T, c));
      if (c)
        carAsk(
          'naiss:' + S.season,
          `La naissance est prévue pendant ${c.name}. Tu rentres ?`,
          [
            ['rentrer', 'Rentrer pour la naissance'],
            ['rester', 'Rester en course'],
          ],
          'rentrer',
          { key: c.key }
        );
    }
    if (S.week >= L.due.w) {
      L.kids.push({ s: S.season, name: pick(NATS.FRA.fn) });
      L.due = null;
      carMo(me, 10);
      carFeed('👶 Naissance', `Bienvenue à ${L.kids[L.kids.length - 1].name} !`);
    }
  }
  // l'ami qui monte une affaire
  if (!L.biz && me.age >= 25 && C.money >= 150 && rnd() < 0.003)
    carAsk(
      'biz:' + S.season,
      'Un ami d’enfance monte une marque de vélos et te propose d’investir 50 k€.',
      [
        ['oui', 'Investir 50 k€'],
        ['non', 'Décliner poliment'],
      ],
      'non'
    );
}
CAR_FX.logement = o => (carMove(o) ? '' : 'Tu restes à la maison pour l’instant.');
CAR_FX.couple = (o, a) => {
  if (o !== 'oui') return '';
  const L = carLife();
  L.partner = { name: a.data.name, since: S.season };
  if (!L.kids.length) L.prio = 'equilibre'; // un couple démarre rarement en « le vélo d'abord » (modifiable)
  carMo(carMe(), 6);
  return 'Le cœur léger, les jambes aussi.';
};
CAR_FX.enfant = o => {
  if (o !== 'oui') return '';
  carLife().due = { s: S.season, w: rint(12, 34) };
  return 'Un enfant est attendu cette saison.';
};
CAR_FX.naiss = (o, a) => {
  const L = carLife();
  if (o === 'rentrer') {
    S.car.skip[S.season + ':' + a.data.key] = true;
    carSetTrust(-4, 'tu manques une course pour la naissance, il comprend… à moitié');
    L.tension = Math.max(0, L.tension - 20);
    return 'Tu seras là.';
  }
  L.tension = clamp(L.tension + 25, 0, 100);
  carMo(carMe(), -8);
  return 'Tu suivras la naissance au téléphone.';
};
CAR_FX.crise = o => {
  const L = carLife();
  if (o === 'lever') {
    L.prio = 'famille';
    L.tension = Math.max(0, L.tension - 30);
    return 'Le foyer respire.';
  }
  if (rnd() < 0.45) {
    const n = L.partner.name;
    L.partner = null;
    L.tension = 0;
    L.pension += L.kids.length * 12;
    carMo(carMe(), -20);
    return `${n} te quitte.${L.kids.length ? ' Pension pour les enfants.' : ''}`;
  }
  L.tension -= 10;
  return 'La crise passe, pour cette fois.';
};
CAR_FX.biz = o => {
  if (o !== 'oui') return '';
  S.car.money -= 50;
  carLife().biz = { s: S.season + 2 };
  return 'Réponse dans deux saisons.';
};
// Fin de saison : rendement de l'épargne, affaire de l'ami.
function carLifeEndSeason() {
  const C = S.car;
  const L = carLife();
  const I = CAR_INVEST[L.inv];
  if (C.money > 0 && (I.mu || I.sd)) {
    const r = I.mu + gauss() * I.sd;
    const g = C.money * r;
    C.money += g;
    carFeed(
      '📈 Placements',
      `${I.lbl} : ${r >= 0 ? '+' : ''}${(r * 100).toFixed(1)} % sur l'année (${g >= 0 ? '+' : ''}${fmtMoney(g)}).`
    );
  }
  if (L.biz && L.biz.s <= S.season) {
    const ok = rnd() < 0.45;
    if (ok) C.money += 130;
    carFeed('🚲 La marque de ton ami', ok ? 'Succès ! Tu récupères 130 k€.' : 'Faillite : les 50 k€ sont perdus.');
    L.biz = { done: true, s: Infinity };
  }
}
// Début de saison : envie d'enfant.
function carLifeNewSeason() {
  const L = carLife();
  if (L.partner && S.season - L.partner.since >= 1 && L.kids.length < 3 && !L.due && carMe().age <= 36)
    carAsk(
      'enfant:' + S.season,
      `${L.partner.name} et toi parlez d'un enfant.`,
      [
        ['oui', 'Oui, cette saison'],
        ['non', 'Pas maintenant'],
      ],
      'non'
    );
}

// ---------- Investir dans sa carrière : ce que l'argent achète ----------
// Abonnements (par an) et achats ponctuels, chacun avec un effet mesurable.
const CAR_STAFF = {
  coach: { lbl: 'Entraîneur personnel', d: 'Plans sur mesure : entraînement +6 %.', cost: 25 },
  soins: { lbl: 'Ostéo et nutritionniste', d: 'Maladies et blessures −25 %, récupération meilleure.', cost: 14 },
};
const CAR_BUY = {
  aero: { lbl: 'Séances en soufflerie', d: 'Position affinée : chrono +2 (deux fois au plus).', cost: 40, max: 2 },
  camp: {
    lbl: 'Stage privé en altitude',
    d: 'Cinq semaines : forme visée +4, pour préparer un objectif (une fois par saison).',
    cost: 15,
  },
  club: {
    lbl: 'Aider ton club formateur',
    d: 'Popularité et moral en hausse, ton nom sur le maillot des minimes.',
    cost: 20,
  },
};
function carStaffCost() {
  const L = carLife();
  return sum(Object.keys(CAR_STAFF).map(k => (L.staff && L.staff[k] ? CAR_STAFF[k].cost : 0)));
}
const carHasStaff = k => !!(carLife().staff && carLife().staff[k]);
function carToggleStaff(k) {
  const L = carLife();
  L.staff = L.staff || {};
  L.staff[k] = !L.staff[k];
}
// Achat possible ? (renvoie la raison sinon)
function carBuyWhy(k) {
  const B = CAR_BUY[k];
  const L = carLife();
  if (S.car.money < B.cost) return 'pas assez d’argent';
  if (k === 'aero' && (L.aero || 0) >= B.max) return 'déjà fait';
  if (k === 'camp' && L.camp && L.camp.s === S.season) return 'déjà fait cette saison';
  if (k === 'club' && L.clubS === S.season) return 'déjà fait cette saison';
  return '';
}
function carBuy(k) {
  if (carBuyWhy(k)) return false;
  const L = carLife();
  const me = carMe();
  S.car.money -= CAR_BUY[k].cost;
  if (k === 'aero') {
    L.aero = (L.aero || 0) + 1;
    me.s.clm = Math.min(95, me.s.clm + 2);
  } else if (k === 'camp') L.camp = { s: S.season, until: S.week + 5 };
  else {
    L.clubS = S.season;
    carAddPub(4);
    carMo(me, 3);
  }
  carFeed('💶 Investissement', `${CAR_BUY[k].lbl} : ${CAR_BUY[k].d}`);
  return true;
}
function carCampForme() {
  const c = carLife().camp;
  return c && c.s === S.season && S.week <= c.until ? 4 : 0;
}
