/* Les directeurs sportifs adverses : chaque équipe de l'ordinateur a un directeur avec un nom, un âge, un
   caractère (rancunier, pragmatique, loyal), le style de jeu de l'équipe, une mémoire de ce que je lui ai fait
   (pactes trahis ou tenus, alliances refusées ou acceptées, coureurs pris) et deux courses objectifs par saison.
   Identité tirée d'une empreinte de l'équipe (aucun tirage : la génération du monde ne change pas). */

const DS_TEMPER = {
  rancunier: { lbl: 'Rancunier', d: "N'oublie rien : un affront compte double, il vous le fera payer en course." },
  pragmatique: { lbl: 'Pragmatique', d: 'Les affaires avant tout : il pardonne vite si vous lui êtes utile.' },
  loyal: { lbl: 'Loyal', d: 'Fidèle en affaires : un service rendu compte double.' },
};
const DS_STYLE_LBL = {
  gc: 'bâtisseur de grands tours',
  agressif: 'offensif, il fait la course',
  defensif: 'prudent, il verrouille la course',
  sprint: 'homme de sprint',
  opportuniste: 'opportuniste',
};
function dsHash(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
// Le directeur d'une équipe de l'ordinateur (créé à la première demande, stable d'une partie à l'autre).
function dsOf(T) {
  if (!T || T.player) return null;
  if (!T.ds) {
    const N = NATS[T.natBias] || NATS.FRA;
    const h = dsHash(T.name);
    const tempers = Object.keys(DS_TEMPER);
    T.ds = {
      fn: N.fn[h % N.fn.length],
      ln: N.ln[(h >>> 8) % N.ln.length],
      age: 38 + ((h >>> 16) % 25),
      temper: tempers[(h >>> 4) % tempers.length],
      mem: [],
      goals: [],
    };
  }
  return T.ds;
}
const dsName = T => {
  const d = dsOf(T);
  return d ? `${d.fn} ${d.ln}` : '';
};
// Relation avec une équipe qui bouge : le caractère du directeur amplifie ou atténue, et il s'en souvient.
function dsRemember(T, v, txt) {
  const d = dsOf(T);
  if (!d) return v;
  let k = 1;
  if (v < 0) k = d.temper === 'rancunier' ? 1.5 : d.temper === 'pragmatique' ? 0.7 : 1;
  else k = d.temper === 'loyal' ? 1.3 : 1;
  if (txt) {
    d.mem.push({ s: S.season, txt, v: Math.sign(v) });
    if (d.mem.length > 8) d.mem.shift();
  }
  return v * k;
}
// Rancune en course : un directeur rancunier, fâché avec moi, fait rouler ses hommes derrière mon échappée.
function dsGrudgeChase(sim, T, G, out) {
  const d = T.player ? null : dsOf(T);
  if (!d || d.temper !== 'rancunier' || teamRelOf(T.id) > -2 || G !== sim.pel) return out;
  if (!G.riders.some(y => y.team === T && !y.fin)) return out;
  const mine = sim.groups.some(H => H !== G && H.pos > G.pos + 0.03 && H.riders.some(y => y.player && !y.fin));
  if (!mine) return out;
  sim.grudgeLog = sim.grudgeLog || {};
  if (!sim.grudgeLog[T.id]) {
    sim.grudgeLog[T.id] = true;
    log(sim, `🗡️ ${T.name} roule derrière votre échappée : ${dsName(T)} n'a pas oublié.`, 'bad');
    highlight(sim, `🗡️ ${T.name} vous fait payer la rancune de son directeur`, true);
  }
  return [Math.max(out[0], 0.86), Math.max(out[1], 2)];
}
// Objectifs de la saison : deux courses choisies selon le style du directeur (grand tour pour un bâtisseur,
// classiques pour un offensif, plat pour un homme de sprint…), en dehors des Mondiaux.
function dsSeasonGoals() {
  for (const T of S.teams) {
    const d = dsOf(T);
    if (!d) continue;
    const fit = c => {
      const ty = c.stagesSpec.map(s => s[0]);
      const n = ty.length;
      const share = k => ty.filter(t => t === k).length / n;
      if (T.style === 'gc') return c.cat === 0 ? 3 : n > 1 ? 2 + share('montagne') : 0;
      if (T.style === 'sprint') return share('plat') * 2 + (c.cat <= 1 ? 1 : 0);
      if (T.style === 'agressif') return (n === 1 ? 2 : 0) + share('vallonne') + share('paves') * 2;
      if (T.style === 'defensif') return n > 1 && c.cat <= 1 ? 2 : 0.5;
      return (n === 1 ? 1.5 : 0.5) + share('punch');
    };
    const L = S.cal
      .filter(c => !c.worlds && (!c.inv || c.inv.includes(T.id)))
      .map(c => [c, fit(c) + (dsHash(T.name + c.key + S.season) % 100) / 200])
      .sort((a, b) => b[1] - a[1]);
    d.goals = L.slice(0, 2).map(([c]) => c.key);
    d.gs = S.season;
  }
}
// Course objectif d'une équipe : ses coureurs ont préparé le rendez-vous (forme du jour un peu plus haute).
function dsGoalBoost(rc, T) {
  const d = T && !T.player ? dsOf(T) : null;
  if (d && d.gs !== S.season) dsSeasonGoals(); // nouvelle saison (ou ancienne sauvegarde) : objectifs à fixer
  return d && d.goals.includes(rc.key) ? 2 : 0;
}
// Au départ d'une course où je suis engagé : les directeurs qui en ont fait leur objectif l'annoncent.
function dsAnnounce(sim) {
  if (!sim.runners.some(x => x.player)) return;
  const said = new Set();
  for (const x of sim.runners) {
    const T = x.team;
    if (T.player || said.has(T.id) || !dsGoalBoost(sim.rc, T)) continue;
    said.add(T.id);
    const d = dsOf(T);
    const q =
      d.temper === 'rancunier' && teamRelOf(T.id) <= -1
        ? '« Cette course, on la veut. Et on n’a rien oublié. »'
        : T.style === 'gc'
          ? '« Toute la saison est tournée vers ce rendez-vous. »'
          : T.style === 'sprint'
            ? '« Le train est prêt, on vient pour gagner. »'
            : '« C’est notre objectif de l’année, on sera devant. »';
    log(sim, `🎙️ ${dsName(T)}, directeur ${/^[AEIOUYÉÈH]/.test(T.name) ? "d'" : 'de '}${T.name} : ${q}`, 'info');
  }
}

/* ---- Offres de rachat : un directeur adverse veut l'un de mes coureurs ----
   Semaines 8 à 38, trois au plus par saison, tirage sur une empreinte (le hasard de la partie n'est pas consommé).
   Accepter : le coureur part, l'indemnité entre dans le budget, le directeur s'en souvient. Refuser : un coureur
   ambitieux à qui l'on offrait bien plus le prend mal. Contre-offre (+30 %) : selon le caractère du directeur. */
function dsBidWeekly() {
  if (S.bid && S.week > S.bid.exp) {
    const r = S.riders[S.bid.id],
      T = teamById(S.bid.t);
    if (r && T) msg('💰 Offre retirée', `${T.name} retire son offre pour ${riderName(r)}, faute de réponse.`);
    S.bid = null;
  }
  if (S.bid || S.week < 8 || S.week > 38 || S.fired) return;
  S.bidN = S.bidN && S.bidN.s === S.season ? S.bidN : { s: S.season, n: 0 };
  if (S.bidN.n >= 3) return;
  const h = dsHash('bid' + S.season + '/' + S.week);
  if (h % 100 >= 11) return;
  const P = S.teams[0];
  if (P.riders.length <= ROSTER.minPlayer) return;
  const mine = P.riders
    .map(id => S.riders[id])
    .filter(r => r && !r.aca && !r.car && r.nextTeam == null && r.contract >= 1 && r.age <= 33 && r.injury <= 0)
    .sort((a, b) => overall(b.s) - overall(a.s))
    .slice(0, 8);
  if (!mine.length) return;
  const r = mine[(h >>> 8) % mine.length];
  const sal = Math.round((salaryFor(overall(r.s), r.age) * 1.25) / 5) * 5;
  const buyers = S.teams.filter(T => {
    if (T.player || T.riders.length >= ROSTER.max || !aiCanAfford(T, sal)) return false;
    const bar = T.riders.map(id => overall(S.riders[id].s)).sort((a, b) => b - a)[7] || 0;
    return overall(r.s) > bar;
  });
  if (!buyers.length) return;
  const T = buyers[(h >>> 16) % buyers.length];
  const fee = Math.round((transferFee(r) * (1 + ((h >>> 4) % 30) / 100)) / 5) * 5;
  S.bid = { id: r.id, t: T.id, fee, sal, exp: S.week + 2, s: S.season };
  S.bidN.n++;
  msg(
    `💰 Offre de ${T.name}`,
    `${dsName(T)}, directeur de ${T.name}, propose <b>${fmtMoney(fee)}</b> pour ${riderName(r)} (il lui offrirait ${fmtMoney(sal)}/an, contre ${fmtMoney(r.salary)} chez vous). Réponse attendue avant la semaine ${S.bid.exp + 1}.`
  );
}
// Réponse à l'offre : 'oui', 'non' ou 'contre'. Renvoie le message à afficher.
function dsBidAnswer(k) {
  const B = S.bid;
  if (!B) return 'Aucune offre en cours.';
  const r = S.riders[B.id],
    T = teamById(B.t);
  S.bid = null;
  if (!r || !T || r.team !== 0) return "L'offre n'est plus valable.";
  const P = S.teams[0];
  const sell = fee => {
    if (P.riders.length <= ROSTER.minPlayer) return `Il faut garder au moins ${ROSTER.minPlayer} coureurs.`;
    friendLeaves(r.id);
    P.riders.splice(P.riders.indexOf(r.id), 1);
    T.riders.push(r.id);
    mercLog(r, 'transfert', 0, T.id);
    r.team = T.id;
    r.salary = B.sal;
    r.contract = Math.max(2, r.contract);
    r.training = 'normal';
    S.budget += fee;
    finAdd('transf', fee);
    addTeamRel(T.id, 1, `Vous lui avez cédé ${riderName(r)}`);
    press(
      `${riderName(r)} quitte ${P.name} pour ${T.name}`,
      `Transfert conclu pour ${fmtMoney(fee)}. ${dsName(T)} : « Un coureur que nous suivions depuis longtemps. »`,
      0,
      [r.id]
    );
    return `${riderName(r)} rejoint ${T.name} : ${fmtMoney(fee)} entrent dans les caisses.`;
  };
  if (k === 'oui') return sell(B.fee);
  if (k === 'contre') {
    const d = dsOf(T);
    const p = d.temper === 'pragmatique' ? 0.6 : d.temper === 'loyal' ? 0.45 : 0.3;
    const ok = (dsHash(T.name + r.id + S.season + 'c') % 100) / 100 < p + (teamRelOf(T.id) >= 1 ? 0.15 : 0);
    const fee2 = Math.round((B.fee * 1.3) / 5) * 5;
    if (ok && aiCanAfford(T, B.sal)) return '🤝 Contre-offre acceptée. ' + sell(fee2);
    if (d.temper === 'rancunier') addTeamRel(T.id, -0.5, `Votre contre-offre pour ${riderName(r)} l'a vexé`);
    return `${dsName(T)} refuse de monter à ${fmtMoney(fee2)} et retire son offre.`;
  }
  // refus : un coureur ambitieux à qui l'on offrait nettement plus le prend mal
  if (B.sal >= r.salary * 1.25 && r.amb > 60) {
    r.moral = clamp(r.moral - 8, 0, 100);
    return `Offre refusée. ${riderName(r)} est déçu : ${T.name} lui offrait ${fmtMoney(B.sal)}/an (moral −8).`;
  }
  return `Offre refusée : ${riderName(r)} reste chez vous.`;
}

/* ---- Piques dans la presse avant une course objectif ----
   La semaine où commence la course objectif d'un directeur, et si j'y suis invité, il parle de moi dans la presse.
   Je peux répondre (question de journaliste) : du tac au tac (notoriété, moral du groupe, mais il s'en souvient),
   avec respect, ou pas du tout. Une pique par semaine au plus. */
function dsPressWeekly() {
  const P = S.teams[0];
  for (const c of S.cal) {
    if (c.w !== S.week || c.worlds || (c.inv && !c.inv.includes(0))) continue;
    const Ts = S.teams.filter(T => !T.player && dsOf(T).gs === S.season && dsOf(T).goals.includes(c.key));
    if (!Ts.length) continue;
    const T = Ts[dsHash(c.key + S.season) % Ts.length];
    const d = dsOf(T);
    if (dsHash(T.name + c.key + S.season) % 100 >= 55) return;
    const rl = teamRelOf(T.id);
    const q =
      d.temper === 'rancunier' && rl <= -1
        ? `${P.name} ? Ils ont la mémoire courte. On va leur rappeler qui commande.`
        : rl >= 2
          ? `${P.name} est une équipe que je respecte. Mais cette fois, c'est pour nous.`
          : T.style === 'sprint'
            ? `Le sprinteur de ${P.name} ? Il ne verra même pas la roue de notre train.`
            : T.style === 'gc'
              ? `Nous ne voyons pas ${P.name} comme un rival. Notre course, c'est le classement général.`
              : `${P.name} ? Ils viendront faire de la figuration, comme d'habitude.`;
    const lbl = `${dsName(T)} (${T.name}) avant ${c.name} : « ${q} »`;
    press(`${T.name} annonce la couleur`, lbl, 0, []);
    if (!(S.pressQ && S.pressQ.exp > S.week))
      askPress(`${dsName(T)} a déclaré : « ${q} » Que lui répondez-vous ?`, [
        {
          t: 'On se verra sur la route. Nous aussi, nous venons pour gagner.',
          head: 'Le ton monte avant ' + c.name,
          res: `Réponse publiée : le groupe apprécie, ${dsName(T)} beaucoup moins.`,
          e: { rep: 1, team: 3, trel: [T.id, -0.5, 'Vous lui avez répondu sèchement dans la presse'] },
        },
        {
          t: `Respect pour ${T.name}. Que le meilleur gagne.`,
          head: 'Fair-play avant ' + c.name,
          res: `Réponse publiée : ${dsName(T)} apprécie le geste.`,
          e: { rep: 0.5, trel: [T.id, 0.5, 'Vous avez répondu avec respect dans la presse'] },
        },
        {
          t: 'Je ne commente pas les déclarations des autres.',
          head: 'Pas de polémique',
          res: 'Réponse publiée.',
          e: {},
        },
      ]);
    return;
  }
}

/* ---- Carrousel des directeurs en fin de saison ----
   Une équipe de l'ordinateur très en dessous de son rang attendu (selon son niveau) peut limoger son directeur ;
   un directeur de plus de 62 ans prend sa retraite. Le nouveau arrive sans mémoire : la relation avec lui repart à
   mi-chemin de zéro. Trois changements par saison au plus. */
function dsCarousel(rankArr) {
  const ai = S.teams.filter(T => !T.player);
  const exp = ai.slice().sort((a, b) => b.tier - a.tier || (S.lastRanks?.[b.id] || 0) - (S.lastRanks?.[a.id] || 0));
  const out = [];
  for (const T of ai) {
    if (out.length >= 3) break;
    const d = dsOf(T);
    const rk = rankArr.filter(U => !U.player).indexOf(T);
    const miss = rk - exp.indexOf(T);
    const h = dsHash(T.name + 'car' + S.season);
    d.age++;
    const why = d.age >= 63 ? 'retraite' : miss >= 5 && h % 100 < 55 && d.goalsWon !== S.season ? 'limogé' : null;
    if (!why) continue;
    const old = dsName(T);
    const N = NATS[T.natBias] || NATS.FRA;
    const tempers = Object.keys(DS_TEMPER);
    let k = 0;
    while (k < 5 && N.ln[((h >>> 11) + k) % N.ln.length] === d.ln) k++;
    T.ds = {
      fn: N.fn[(h >>> 3) % N.fn.length],
      ln: N.ln[((h >>> 11) + k) % N.ln.length],
      age: 36 + ((h >>> 19) % 14),
      temper: tempers[(h >>> 7) % tempers.length],
      mem: [],
      goals: [],
      since: S.season + 1,
    };
    if (S.teamRel && S.teamRel[T.id]) S.teamRel[T.id] = Math.round(S.teamRel[T.id] * 5) / 10;
    out.push(
      `${T.name} : ${old} ${why === 'retraite' ? 'prend sa retraite' : `est remercié (${rk + 1}e équipe seulement)`}, ${dsName(T)} (${DS_TEMPER[T.ds.temper].lbl.toLowerCase()}) le remplace.`
    );
  }
  if (!out.length) return;
  press('Le carrousel des directeurs sportifs', out.join(' '), 0, []);
  msg('🔄 Carrousel des directeurs', out.join('<br>'));
}
// Objectifs réussis : une victoire de l'équipe dans une de ses courses objectifs protège le directeur.
function dsGoalWon(rc, winnerTeamId) {
  const T = teamById(winnerTeamId);
  const d = T && !T.player ? dsOf(T) : null;
  if (d && d.goals.includes(rc.key)) d.goalsWon = S.season;
}
