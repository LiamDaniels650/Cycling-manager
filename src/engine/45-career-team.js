/* Mode carrière — la vie dans une équipe pro : le directeur sportif (personnalité, confiance), les coéquipiers
   (leader, équipier fidèle, rival interne, amitiés et tensions), les transferts (offres en cours de saison,
   directeur sportif qui change d'équipe et veut t'emmener), et le changement de profil (spécialisation). */

const CAR_DS_KINDS = {
  paternaliste: {
    lbl: 'Paternaliste',
    d: 'Protège ses jeunes, pardonne les écarts, aime la patience.',
    ask: 55,
    pen: 5,
    top: 2,
    obey: 1,
  },
  exigeant: {
    lbl: 'Exigeant',
    d: 'Ne jure que par les résultats et la discipline. Dur, mais juste.',
    ask: 75,
    pen: 12,
    top: 4,
    obey: 1,
  },
  calculateur: {
    lbl: 'Calculateur',
    d: 'Le collectif avant tout : il récompense ceux qui respectent le plan.',
    ask: 65,
    pen: 9,
    top: 2,
    obey: 2,
  },
  joueur: {
    lbl: 'Joueur',
    d: 'Aime le panache et les attaquants ; donne volontiers des cartes libres.',
    ask: 50,
    pen: 4,
    top: 3,
    obey: 0,
  },
};
const CAR_HELPER_ORDERS = new Set(['protect', 'leadout', 'control', 'save']);
const CAR_SPEC_WEEKS = 70; // environ deux saisons pour changer de profil

// Directeur sportif d'une équipe (vu par le joueur) : créé une fois, garde son caractère.
function carDsOf(tid) {
  const C = S.car;
  C.dsOf = C.dsOf || {};
  if (!C.dsOf[tid]) {
    const h = mercHash('ds' + tid + S.seed0);
    const kinds = Object.keys(CAR_DS_KINDS);
    C.dsOf[tid] = { name: `${pick(NATS.FRA.fn)} ${pick(NATS.FRA.ln)}`, kind: kinds[h % kinds.length] };
  }
  return C.dsOf[tid];
}
function carDs() {
  const T = carTeamOfMe();
  return T ? carDsOf(T.id) : null;
}
function carTrustLbl(v) {
  return v >= 80
    ? 'confiance totale'
    : v >= 62
      ? 'confiance'
      : v >= 45
        ? 'il t’observe'
        : v >= 28
          ? 'méfiance'
          : 'dans le collimateur';
}
// Le directeur sportif t'accorde-t-il ta chance (carte libre) ?
function carDsAccept() {
  const D = carDs();
  const K = D ? CAR_DS_KINDS[D.kind] : CAR_DS_KINDS.paternaliste;
  const me = carMe();
  return S.car.trust + (me.forme - 70) * 0.6 + carTraitMul('ask') >= K.ask || rnd() < 0.1;
}
// Le joueur demande sa chance (carte libre) avant une étape. Pro : selon le directeur sportif, la confiance, la
// forme et le caractère ; jeunes : le club est plus ouvert. Un refus coûte un peu de confiance.
function carAskChance(pro) {
  const me = carMe();
  const ok = pro ? carDsAccept() : S.car.trust + carTraitMul('ask') >= 60 || me.forme >= 74 || rnd() < 0.35;
  if (ok) S.car.wish = 'free';
  else S.car.trust = clamp(S.car.trust - 3, 0, 100);
  return ok;
}
function carSetTrust(v, why) {
  const C = S.car;
  const before = C.trust;
  C.trust = clamp(C.trust + v, 0, 100);
  if (why && Math.abs(v) >= 4) {
    const D = carDs();
    carFeed(
      v > 0 ? '👍 Le directeur sportif' : '👎 Le directeur sportif',
      `${D ? D.name : 'Le directeur sportif'} : ${why} (confiance ${Math.round(before)} → ${Math.round(C.trust)}).`
    );
  }
}
// Leader désigné de l'équipe du joueur sur la course (ou le meilleur de l'équipe).
function carTeamLeader(rc, T) {
  const ids = rc.sel[T.id] || [];
  return (
    ids.find(id => rc.orders[id] && rc.orders[id].o === 'leader') ||
    ids.slice().sort((a, b) => overall(S.riders[b].s) - overall(S.riders[a].s))[0]
  );
}
// Après une course pro : jugement du directeur sportif, relations avec le leader et les équipiers.
function carTeamAfterRace(rc, rank) {
  const me = carMe();
  const T = carTeamOfMe();
  if (!T) return;
  const D = carDsOf(T.id);
  const K = CAR_DS_KINDS[D.kind];
  const mine = rc.orders[me.id] ? rc.orders[me.id].o : null;
  const solo = (rc.carRadio || []).filter(
    ([k, o]) => (k === 'attack' || k === 'bridge') && CAR_HELPER_ORDERS.has(o)
  ).length;
  const ldr = carTeamLeader(rc, T);
  const order = carOrderOf(rc);
  const lr = ldr ? order.indexOf(ldr) + 1 : 0;
  if (solo) {
    if (rank && rank <= 3) carSetTrust(K.top, 'tu as joué ta carte au lieu d’aider, mais le résultat est là');
    else {
      carSetTrust(-K.pen * carTraitMul('trustSolo'), 'tu devais aider le leader, pas attaquer pour toi');
      if (ldr && ldr !== me.id) addRel(me.id, ldr, -8);
    }
  } else if (CAR_HELPER_ORDERS.has(mine)) {
    carSetTrust(
      (K.obey + (lr && lr <= 5 ? 2 : 0)) * carTraitMul('trustObey'),
      lr && lr <= 3 ? `beau travail pour ${riderName(S.riders[ldr])}` : ''
    );
    if (ldr && ldr !== me.id) addRel(me.id, ldr, lr && lr <= 5 ? 5 : 2);
  } else if (mine === 'leader' || mine === 'free' || mine === 'sprint') {
    carSetTrust(
      rank && rank <= 3 ? K.top + 2 : rank && rank <= 10 ? 1 : -1,
      rank === 1 ? 'il savoure ta victoire' : ''
    );
    // les équipiers qui ont roulé pour toi
    if (rank && rank <= 5) for (const id of rc.sel[T.id] || []) if (id !== me.id) addRel(me.id, id, 2);
  }
  if (D.kind === 'joueur' && (rc.carRadio || []).some(([k]) => k === 'attack') && rank && rank <= 10)
    carSetTrust(3, 'il a aimé ton panache');
}
// Coéquipiers vus par le joueur : relation, rôle.
function carMates() {
  const me = carMe();
  const T = carTeamOfMe();
  if (!T) return [];
  return T.riders
    .filter(id => id !== me.id)
    .map(id => S.riders[id])
    .filter(Boolean)
    .map(r => ({ r, rel: rel(me.id, r.id) }))
    .sort((a, b) => overall(b.r.s) - overall(a.r.s));
}
function carInternalRival() {
  const me = carMe();
  const ov = overall(me.s);
  return carMates()
    .filter(m => m.r.arch === me.arch && Math.abs(overall(m.r.s) - ov) <= 3)
    .sort((a, b) => a.rel - b.rel)[0];
}
// Semaine de pro : l'équipier fidèle, offres de transfert en cours de saison.
function carTeamWeekly() {
  const C = S.car;
  if (!carIsPro()) return;
  const me = carMe();
  const T = carTeamOfMe();
  if (!T) return;
  // l'équipier fidèle : le coéquipier le plus proche, si l'amitié est forte
  const best = carMates().sort((a, b) => b.rel - a.rel)[0];
  if (best && best.rel >= 50 && C.loyal !== best.r.id) {
    C.loyal = best.r.id;
    carFeed(
      '🤝 Équipier fidèle',
      `${riderName(best.r)} est devenu ton plus fidèle allié dans l'équipe. Il te suivrait n'importe où.`
    );
  }
  // offres de transfert (une fois par saison, à mi-saison)
  if (S.week === 24 && !C.next && me.contract >= 1) {
    const ov = overall(me.s);
    const med = T.riders.map(id => overall(S.riders[id].s)).sort((a, b) => a - b)[Math.floor(T.riders.length / 2)];
    const A = C.agent ? CAR_AGENTS[C.agent.kind] : null;
    const p = clamp((ov - med) / 8 + C.vis / 150 + (A ? A.offers * 0.1 : -0.1) + (C.trust < 35 ? 0.15 : 0), 0, 0.7);
    if (rnd() < p) {
      // une équipe de même niveau… ou, si tu n'es pas leader chez toi, une plus modeste qui t'en offre le rôle
      const small = !carRoleFor(T) && ov >= 70 && rnd() < 0.5 ? carSmallTeam([T]) : null;
      const U = small || pick(S.teams.filter(U => !U.player && U !== T && U.tier >= T.tier - 0.3));
      if (U) {
        const lead = carRoleFor(U);
        const salary =
          Math.round(
            (Math.max(me.salary * (lead ? 1 : 1.15), salaryFor(ov, me.age)) * (A ? A.pay : 1) * carRepPay()) / 5
          ) * 5;
        const years = rint(2, 3);
        carAsk(
          'transfert:' + S.season,
          `${U.name} veut te recruter dès la saison prochaine : ${years} ans, ${fmtMoney(salary)}/an${lead ? `, ${CAR_LEAD[lead]}` : ''}${C.agent && C.agent.kind === 'gourmand' ? ' (ton agent te pousse à signer)' : ''}.`,
          [
            ['non', `Rester chez ${T.name}`],
            ['oui', `Signer chez ${U.name}`],
          ],
          'non',
          { tid: U.id, years, salary, lead }
        );
      }
    }
  }
  // spécialisation en cours
  if (C.spec) {
    const prim = PRIMARY[C.spec.to] || [];
    const match = prim.some(k => (CAR_TRAIN_FOCUS[C.plan] || []).includes(k));
    C.spec.prog = Math.min(100, C.spec.prog + (match ? 100 / CAR_SPEC_WEEKS : 100 / (CAR_SPEC_WEEKS * 3)));
    if (C.spec.prog >= 100) {
      me.arch = C.spec.to;
      carFeed(
        '🔄 Nouveau profil',
        `Tu es désormais ${ARCH[me.arch].lbl.toLowerCase()} : ton entraînement et ton rôle suivront ce profil.`
      );
      C.spec = null;
    }
  }
}
// Caractéristique principalement travaillée par chaque plan d'entraînement.
const CAR_TRAIN_FOCUS = {
  foncier: ['end', 'rec', 'pla', 'bar'],
  montagne: ['mon', 'col'],
  sprint: ['spr', 'plc', 'col'],
  clm: ['clm', 'pla'],
  paves: ['pav', 'plc', 'pla'],
};
CAR_FX.transfert = (o, a) => {
  const T = carTeamOfMe();
  if (o === 'non') {
    carSetTrust(4, 'il apprécie ta fidélité');
    return `Tu restes chez ${T ? T.name : 'toi'}.`;
  }
  S.car.next = a.data;
  return `Accord conclu : tu rejoindras ${teamById(a.data.tid).name} la saison prochaine.`;
};
// Fin de saison chez les pros : transfert signé, directeur sportif qui s'en va (et veut t'emmener).
function carTeamNewSeason() {
  const C = S.car;
  if (!carIsPro()) return;
  if (C.next) {
    carMoveTo(C.next.tid, C.next.years, C.next.salary, 'transfert');
    carSetLead(C.next.tid, C.next.lead, C.next.years);
    C.next = null;
    return;
  }
  const T = carTeamOfMe();
  if (!T) return;
  if (rnd() < 0.12) {
    const D = carDsOf(T.id);
    const U = pick(S.teams.filter(U => !U.player && U !== T));
    if (!U) return;
    C.dsOf[U.id] = D;
    delete C.dsOf[T.id];
    const trust = C.trust;
    C.trust = 50;
    carFeed('🚐 Départ du directeur sportif', `${D.name} quitte ${T.name} pour ${U.name}.`);
    if (trust >= 70) {
      const me = carMe();
      carAsk(
        'suivreds:' + S.season,
        `${D.name} veut t'emmener chez ${U.name} : 2 ans, ${fmtMoney(Math.round((me.salary * 1.08) / 5) * 5)}/an.`,
        [
          ['non', `Rester chez ${T.name}`],
          ['oui', `Suivre ${D.name}`],
        ],
        'non',
        { tid: U.id, years: 2, salary: Math.round((me.salary * 1.08) / 5) * 5, trust }
      );
    }
  }
}
CAR_FX.suivreds = (o, a) => {
  if (o !== 'oui') return 'Tu restes, et tu feras connaissance avec le nouveau directeur sportif.';
  carMoveTo(a.data.tid, a.data.years, a.data.salary, 'transfert');
  S.car.trust = a.data.trust;
  return '';
};
// Changement d'équipe du joueur (contrat neuf). L'équipier fidèle peut suivre.
function carMoveTo(tid, years, salary, kind) {
  const C = S.car;
  C.lead = null;
  const me = carMe();
  const T = carTeamOfMe();
  const U = teamById(tid);
  if (!U) return;
  if (T) {
    const i = T.riders.indexOf(me.id);
    if (i >= 0) T.riders.splice(i, 1);
  }
  U.riders.push(me.id);
  mercLog(me, kind, T ? T.id : null, U.id);
  me.team = U.id;
  me.contract = years;
  me.salary = salary;
  C.club = U.name;
  if (!C.dsOf || !C.dsOf[U.id]) C.trust = 50;
  carFeed('✈️ Nouvelle équipe', `Te voilà chez <b>${U.name}</b> : ${years} an(s), ${fmtMoney(salary)}/an.`);
  const L = C.loyal != null ? S.riders[C.loyal] : null;
  if (L && T && L.team === T.id && U.riders.length < ROSTER.max && (L.contract <= 1 || rel(me.id, L.id) >= 65)) {
    T.riders.splice(T.riders.indexOf(L.id), 1);
    U.riders.push(L.id);
    L.team = U.id;
    L.contract = Math.max(L.contract, 2);
    mercLog(L, 'transfert', T.id, U.id);
    carFeed('🤝 Il te suit', `${riderName(L)}, ton équipier fidèle, signe aussi chez ${U.name}.`);
  } else C.loyal = null;
}
// Changer de profil : un objectif, environ deux saisons d'entraînement ciblé.
function carSpecStart(to) {
  const me = carMe();
  if (!ARCH[to] || to === me.arch) {
    S.car.spec = null;
    return;
  }
  S.car.spec = { to, prog: 0 };
  carFeed(
    '🎯 Nouveau cap',
    `Tu veux devenir ${ARCH[to].lbl.toLowerCase()}. Il faudra environ deux saisons d'entraînement ciblé (${PRIMARY[to].map(k => STAT_LBL[k].toLowerCase()).join(', ')}).`
  );
}
// ---------- Clause de leader ----------
// Le rôle qu'une équipe peut promettre : 'gt' (leader partout, Grands Tours compris) si tu es son meilleur
// coureur, 'sec' (leader hors Grands Tours) si tu es parmi ses trois meilleurs, sinon aucun.
const CAR_LEAD = { gt: 'leader sur toutes ses courses', sec: 'leader hors Grands Tours' };
function carRoleFor(T) {
  const me = carMe();
  const ov = overall(me.s);
  const above = T.riders.filter(id => id !== me.id && S.riders[id] && overall(S.riders[id].s) >= ov).length;
  return above === 0 ? 'gt' : above <= 2 ? 'sec' : null;
}
// Une équipe plus modeste où tu serais leader (pour les offres et les transferts).
function carSmallTeam(exclude) {
  return shuffle(
    S.teams.filter(T => !T.player && !exclude.includes(T) && T.riders.length < ROSTER.max && carRoleFor(T))
  ).sort((a, b) => a.tier - b.tier)[0];
}
// Négocier une clause : dépend du statut, de l'agent, de la confiance qu'inspire ton niveau dans l'équipe.
function carLeadChance(T) {
  const C = S.car;
  const me = carMe();
  const ov = overall(me.s);
  const above = T.riders.filter(id => id !== me.id && S.riders[id] && overall(S.riders[id].s) >= ov).length;
  const A = C.agent ? CAR_AGENTS[C.agent.kind] : null;
  return clamp(0.55 - above * 0.09 + carStatus() * 0.07 + (A ? (A.pay - 1) * 1.5 : -0.05), 0.03, 0.9);
}
function carSetLead(tid, kind, years) {
  S.car.lead = kind ? { tid, kind, until: S.season + years - 1 } : null;
}
function carLeadActive(rc) {
  const L = S.car.lead;
  const me = carMe();
  if (!L || L.tid !== me.team || L.until < S.season) return false;
  return L.kind === 'gt' || rc.cat > 0;
}
// Appliquée aux consignes de chaque étape : le joueur devient leader (ou sprinteur désigné sur le plat), l'ancien
// leader passe équipier.
function carLeadHook(rc) {
  if (!carLeadActive(rc)) return;
  const spec = rc.specs[rc.si];
  if (isITT(spec) || isTTT(spec)) return;
  const me = carMe();
  const o = rc.orders;
  if (!o[me.id]) return;
  const ids = (rc.sel[me.team] || []).filter(id => id !== me.id && o[id]);
  if (spec.type === 'plat' && me.s.spr >= 74) {
    for (const id of ids) if (o[id].o === 'sprint') o[id] = { o: 'leadout' };
    o[me.id] = { o: 'sprint' };
    return;
  }
  for (const id of ids) if (o[id].o === 'leader') o[id] = { o: 'protect' };
  o[me.id] = { o: 'leader', att: leaderAtt(me, rc, spec.type, rc.specs.length > 1) };
}
