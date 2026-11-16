/* Mode carrière — les années espoirs (19-22 ans) : équipe formatrice ou réserve d'une équipe pro, agent,
   stage chez les pros (à partir d'août), passage professionnel et contrats. Les espoirs suivis progressent,
   les meilleurs signent chez les pros chaque hiver, les autres arrêtent à 23 ans : la génération du joueur
   peuple le peloton pro des saisons suivantes. */

const CAR_AGENTS = {
  bon: {
    lbl: 'Sérieux et bien introduit',
    fee: 0.1,
    offers: 1,
    pay: 1.08,
    d: 'Ouvre des portes, négocie bien. 10 % de commission.',
  },
  gourmand: {
    lbl: 'Gourmand',
    fee: 0.15,
    offers: 0,
    pay: 1.2,
    d: 'Fait monter les salaires, mais pousse vers le plus offrant. 15 %.',
  },
  maladroit: {
    lbl: 'Ami de la famille',
    fee: 0.05,
    offers: -1,
    pay: 0.95,
    d: 'Pas cher, plein de bonne volonté, peu de réseau. 5 %.',
  },
};
const CAR_STAG_WEEK = 31; // stages chez les pros à partir du 1er août
const CAR_STAG_MAX = 4; // courses pros au plus pour un stagiaire

function carIsPro() {
  return S.car.kind === 'pro';
}
function carTeamOfMe() {
  const me = carMe();
  return me.team != null ? teamById(me.team) : null;
}
// Semaine des espoirs : proposition de stage chez les pros en août.
function carU23Weekly() {
  const C = S.car;
  const me = carMe();
  if (S.week !== CAR_STAG_WEEK || carIsPro() || me.age < 19 || me.age > 22 || C.stag != null) return;
  if (C.kind === 'devo' && teamById(C.parent)) {
    carStagStart(teamById(C.parent));
    return;
  }
  const ov = overall(me.s);
  const chance = clamp((ov - 64) / 10 + C.vis / 200 + (C.agent ? CAR_AGENTS[C.agent.kind].offers * 0.1 : 0), 0, 0.9);
  if (rnd() > chance) return;
  const T = pick(S.teams.filter(T => !T.player && T.riders.length < ROSTER.max));
  if (!T) return;
  carAsk(
    'stag:' + S.season,
    `${T.name} te propose un stage d'août à octobre : quelques courses chez les pros, sous le regard du staff.`,
    [
      ['oui', 'Accepter le stage'],
      ['non', 'Refuser, rester concentré sur les espoirs'],
    ],
    'oui',
    { tid: T.id }
  );
}
CAR_FX.stag = (o, a) => {
  const T = teamById(a.data.tid);
  if (o !== 'oui' || !T) return 'Tu restes avec ton équipe espoirs.';
  carStagStart(T);
  return '';
};
function carStagStart(T) {
  const me = carMe();
  S.car.stag = T.id;
  S.car.stagN = 0;
  me.team = T.id;
  if (!T.riders.includes(me.id)) T.riders.push(me.id);
  carFeed(
    '🎽 Stagiaire',
    `Te voilà stagiaire chez <b>${T.name}</b> jusqu'à la fin de la saison. Quelques courses pros t'attendent : montre-toi.`
  );
}
function carStagEnd() {
  const me = carMe();
  const T = teamById(S.car.stag);
  if (T && !carIsPro()) {
    const i = T.riders.indexOf(me.id);
    if (i >= 0) T.riders.splice(i, 1);
    me.team = null;
  }
  S.car.stag = null;
}
// Coureur suivi qui passe professionnel (signé par une équipe IA avec de la place).
function carSignGen(r) {
  const T = pick(S.teams.filter(T => !T.player && T.riders.length < ROSTER.max));
  if (!T) return false;
  r.team = T.id;
  r.youth = false;
  r.contract = 2;
  r.salary = Math.max(25, salaryFor(overall(r.s), r.age));
  r.neo = S.season;
  T.riders.push(r.id);
  mercLog(r, 'neo', null, T.id);
  return true;
}
// Hiver des espoirs : signatures chez les pros, départs à 23 ans, offres pour le joueur.
function carU23NewSeason() {
  const C = S.car;
  const me = carMe();
  if (C.stag != null) carStagEnd();
  let signed = 0;
  for (const id of C.u23.slice()) {
    const r = S.riders[id];
    if (!r || r.retired) {
      C.u23.splice(C.u23.indexOf(id), 1);
      continue;
    }
    const ov = overall(r.s);
    const p = r.age >= 20 ? clamp((ov - 66) / 9 + (r.jPts || 0) / 400, 0, 0.92) : 0;
    if (signed < 30 && rnd() < p && carSignGen(r)) {
      signed++;
      C.u23.splice(C.u23.indexOf(id), 1);
      C.alumni.push(id);
      if ((C.h2h[id] || [0, 0]).some(v => v >= 2) || r.nat === me.nat)
        carFeed(
          '🎓 Ta génération',
          `${riderName(r)} (${r.age} ans) passe professionnel chez ${teamById(r.team).name}.`
        );
    } else if (r.age >= 23) {
      C.u23.splice(C.u23.indexOf(id), 1);
      if (ov >= 66) {
        r.youth = false;
        r.salary = salaryFor(ov, r.age);
        S.free.push(id);
        C.alumni.push(id);
      } else {
        r.retired = true;
        r.retS = S.season;
      }
    }
  }
  if (C.alumni.length > 600) C.alumni = C.alumni.slice(-600);
  if (me.age === 19 && !carIsPro()) carTeamOffers(true);
  else if (me.age >= 20 && me.age <= 23 && !carIsPro()) carProOffers();
  else if (carIsPro() && me.contract <= 0) carProOffers();
  if (me.age >= 19 && !C.agent && C.vis >= 20) carAgentOffer();
}
// Équipe espoirs : formatrice (rôle de leader, programme régional) ou réserve d'une équipe pro (encadrement,
// passerelle vers l'équipe pro, mais concurrence pour les rôles).
function carTeamOffers(first) {
  const C = S.car;
  const me = carMe();
  const ov = overall(me.s);
  const opts = [['conti', `${pick(PLACE)} Continental (équipe formatrice)`]];
  const data = { conti: opts[0][1] };
  if (ov >= 63 || C.vis >= 35) {
    const T = pick(S.teams.filter(T => !T.player));
    opts.push(['devo', `${T.name} Devo (réserve de l'équipe pro)`]);
    data.devo = T.id;
    data.devoName = `${T.name} Devo`;
  }
  opts.push(['club', `Rester amateur au ${C.club}`]);
  carAsk(
    'team:' + S.season,
    first ? 'Les années espoirs commencent. Où vas-tu courir ?' : 'Une nouvelle saison espoirs : changer d’équipe ?',
    opts,
    opts.length > 2 ? 'devo' : 'conti',
    data
  );
}
CAR_FX.team = (o, a) => {
  const C = S.car;
  const me = carMe();
  if (o === 'club') {
    C.kind = 'club';
    return 'Tu restes chez les amateurs : leader de ton club, mais loin des regards.';
  }
  C.kind = o;
  C.parent = o === 'devo' ? a.data.devo : null;
  C.club = o === 'devo' ? a.data.devoName : a.data.conti;
  // équipiers : espoirs suivis de ton niveau
  const ov = overall(me.s);
  C.mates = shuffle(
    C.u23.map(id => S.riders[id]).filter(r => r && Math.abs(overall(r.s) - (o === 'devo' ? ov + 1 : ov - 2)) <= 4)
  )
    .slice(0, 5)
    .map(r => r.id);
  C.vis = clamp(C.vis + (o === 'devo' ? 8 : 3), 0, 100);
  return o === 'devo'
    ? 'Encadrement pro, stage assuré en août, mais il faudra gagner ta place.'
    : 'Une équipe formatrice : tu y seras souvent leader.';
};
// L'agent : il se présente quand on commence à parler du coureur.
function carAgentOffer() {
  const ks = shuffle(Object.keys(CAR_AGENTS));
  const names = ks.map(() => `${pick(NATS.FRA.fn)} ${pick(NATS.FRA.ln)}`);
  carAsk(
    'agent:' + S.season,
    'Des agents te démarchent. Avec qui signer ?',
    ks.map((k, i) => [k, `${names[i]} — ${CAR_AGENTS[k].lbl}`]).concat([['aucun', 'Personne pour l’instant']]),
    'aucun',
    { names: Object.fromEntries(ks.map((k, i) => [k, names[i]])) }
  );
}
CAR_FX.agent = (o, a) => {
  if (o === 'aucun') return 'Tu te débrouilleras seul pour le moment.';
  S.car.agent = { kind: o, name: a.data.names[o] };
  return `${a.data.names[o]} devient ton agent. ${CAR_AGENTS[o].d}`;
};
// Offres de contrat pro (néo-pro, ou fin de contrat d'un pro), selon le niveau, les résultats, la visibilité et
// l'agent. Le joueur peut aussi rester espoir une saison de plus (jusqu'à 22 ans).
function carProOffers() {
  const C = S.car;
  const me = carMe();
  const ov = overall(me.s);
  const A = C.agent ? CAR_AGENTS[C.agent.kind] : null;
  const pro = carIsPro();
  let n = pro ? 1 + Math.floor(Math.max(0, ov - 66) / 4) : Math.floor(Math.max(0, ov - 63) / 3 + C.vis / 35);
  n = clamp(n + (A ? A.offers : 0), 0, 4);
  if (!pro && C.kind === 'devo' && ov >= 64) n = Math.max(n, 1);
  const teams = shuffle(S.teams.filter(T => !T.player && T.riders.length < ROSTER.max));
  if (!pro && C.kind === 'devo' && teamById(C.parent)) teams.unshift(teamById(C.parent));
  if (pro && carTeamOfMe()) teams.unshift(carTeamOfMe());
  const picked = [...new Set(teams)].slice(0, n);
  // un pro solide reçoit aussi l'offre d'une équipe plus modeste qui en ferait son leader
  if (pro && ov >= 70 && !picked.some(T => carRoleFor(T))) {
    const U = carSmallTeam(picked);
    if (U) picked.push(U);
  }
  const offers = picked.map(T => {
    const years = pro ? rint(1, 3) : 2;
    const base = Math.max(pro ? 30 : 25, salaryFor(ov, me.age));
    const lead = pro ? carRoleFor(T) : null;
    return {
      tid: T.id,
      name: T.name,
      years,
      lead,
      salary: Math.round((base * (A ? A.pay : 0.92) * carRepPay() * (lead ? 0.92 : 1)) / 5) * 5,
    };
  });
  const last = !pro && me.age >= 23;
  if (!offers.length && (last || pro)) {
    // dernière chance : la plus modeste des équipes prend un pari d'un an
    const T = S.teams.filter(T => !T.player && T.riders.length < ROSTER.max).sort((a, b) => a.tier - b.tier)[0];
    if (T) offers.push({ tid: T.id, name: T.name, years: 1, lead: null, salary: pro ? 30 : 25 });
  }
  if (!offers.length) {
    if (me.age >= 20)
      carFeed('📭 Pas encore d’offre', 'Aucune équipe pro ne se manifeste cet hiver. Il faudra plus de résultats.');
    if (me.age === 20 || me.age === 21) carTeamOffers(false);
    return;
  }
  const opts = offers.map((x, i) => [
    'o' + i,
    `${x.name} : ${x.years} an(s), ${fmtMoney(x.salary)}/an${x.lead ? ` · ${CAR_LEAD[x.lead]}` : ''}`,
  ]);
  // négocier une clause de leader avec la meilleure offre qui n'en propose pas
  const ni = offers.findIndex(x => !x.lead);
  if (pro && ni >= 0)
    opts.push([
      'L' + ni,
      `${offers[ni].name} : demander une clause de leader hors Grands Tours (salaire −10 %, chance ${Math.round(carLeadChance(teamById(offers[ni].tid)) * 100)} %)`,
    ]);
  if (!pro && !last) opts.push(['attendre', 'Rester espoir une saison de plus']);
  carAsk(
    'contrat:' + S.season,
    pro ? 'Ton contrat arrive à son terme. Les offres :' : 'Des équipes professionnelles veulent te faire signer !',
    opts,
    'o0',
    { offers }
  );
}
CAR_FX.contrat = (o, a) => {
  const C = S.car;
  const me = carMe();
  if (o === 'attendre') {
    carTeamOffers(false);
    return 'Une saison de plus chez les espoirs, pour grandir encore.';
  }
  const x = { ...a.data.offers[+o.slice(1)] };
  const T = teamById(x.tid);
  if (!T) return 'L’offre n’est plus valable.';
  let neg = '';
  if (o[0] === 'L') {
    if (rnd() < carLeadChance(T)) {
      x.lead = 'sec';
      x.salary = Math.round((x.salary * 0.9) / 5) * 5;
      neg = ' Clause de leader obtenue.';
    } else neg = ' Pas de clause : l’équipe refuse de te promettre le rôle de leader.';
  }
  const old = carTeamOfMe();
  if (old && old !== T) {
    const i = old.riders.indexOf(me.id);
    if (i >= 0) old.riders.splice(i, 1);
    mercLog(me, 'transfert', old.id, T.id);
  } else if (!old) mercLog(me, 'neo', null, T.id);
  if (!T.riders.includes(me.id)) T.riders.push(me.id);
  const neo = !carIsPro();
  me.team = T.id;
  me.youth = false;
  me.contract = x.years;
  me.salary = x.salary;
  C.kind = 'pro';
  C.club = T.name;
  C.parent = null;
  C.stag = null;
  C.trust = 50;
  carSetLead(T.id, x.lead, x.years);
  if (neo) {
    me.neo = S.season;
    carFeed(
      '🎉 Professionnel !',
      `Tu signes ton premier contrat pro chez <b>${T.name}</b> : ${x.years} an(s), ${fmtMoney(x.salary)}/an. Un rêve d'enfant se réalise.`
    );
  }
  return neo ? neg.trim() : `Contrat signé avec ${T.name} : ${x.years} an(s), ${fmtMoney(x.salary)}/an.${neg}`;
};
