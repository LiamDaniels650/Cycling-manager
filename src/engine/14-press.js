/* Presse, notoriété de l'équipe et popularité des coureurs */
const JOURNALS = [
  "L'Écho du Peloton",
  'Vélo Matin',
  'Cyclisme Hebdo',
  'La Gazette des Cols',
  'Le Braquet',
  'Radio Tour',
];
// Popularité « naturelle » d'un coureur, selon son niveau.
function popBase(r) {
  return clamp((overall(r.s) - 64) * 3.2 + 8, 2, 85);
}
// Popularité initiale.
function initPop(r) {
  if (r.pop === undefined) r.pop = Math.round(clamp(popBase(r) + gauss() * 6, 0, 95));
}
// Fait évoluer la popularité (plus difficile près du maximum).
function addPop(id, v) {
  const r = S.riders[id];
  if (!r) return;
  initPop(r);
  r.pop = clamp(r.pop + v * (1 - r.pop / 120), 0, 100);
}
// Notoriété de l'équipe du joueur (0-100).
function repOf() {
  return S.rep == null ? 40 : S.rep;
}
// Fait évoluer la notoriété.
function addRep(v) {
  S.rep = clamp(repOf() + v, 0, 100);
}
// Libellé de la notoriété.
function repLabel(v) {
  return v >= 80
    ? 'Star du peloton'
    : v >= 65
      ? 'Équipe en vue'
      : v >= 50
        ? 'Respectée'
        : v >= 35
          ? 'Discrète'
          : v >= 20
            ? 'Peu considérée'
            : 'Décriée';
}
// Publie un article. tone : effet sur la notoriété (+ / -). ids : coureurs concernés.
function press(title, body, tone = 0, ids = [], big = false) {
  S.press = S.press || [];
  S.press.unshift({ s: S.season, w: S.week, j: pick(JOURNALS), title, body, tone, ids });
  if (S.press.length > 80) S.press.length = 80;
  if (tone) addRep(tone);
  if (big) msg('📰 ' + title, body);
}
// Interview : une seule question en attente. Sans réponse, elle expire et la presse vous juge distant.
function askPress(q, opts) {
  if (S.pressQ && S.pressQ.exp > S.week) {
    return;
  }
  S.pressQ = { q, opts, exp: S.week + 3, s: S.season };
}
// Réponse du joueur à la question en attente : applique ses effets.
function answerPress(k) {
  const Q = S.pressQ;
  if (!Q) return null;
  const o = Q.opts[k];
  if (!o) return null;
  S.pressQ = null;
  const E = o.e || {};
  if (E.rep) addRep(E.rep);
  if (E.conf) S.conf = clamp(S.conf + E.conf, 0, 100);
  if (E.moral)
    for (const [id, v] of E.moral) {
      const r = S.riders[id];
      if (r) r.moral = clamp(r.moral + v, 0, 100);
    }
  if (E.dis)
    for (const [id, v] of E.dis) {
      const r = S.riders[id];
      if (r) r.dis = clamp(r.dis + v, 0, 99);
    }
  if (E.team)
    for (const id of S.teams[0].riders) {
      const r = S.riders[id];
      r.moral = clamp(r.moral + E.team, 0, 100);
    }
  if (E.pop) for (const [id, v] of E.pop) addPop(id, v);
  if (E.rel) addRel(E.rel[0], E.rel[1], E.rel[2]);
  if (E.trel) addTeamRel(E.trel[0], E.trel[1], E.trel[2]);
  if (E.wantsOut) {
    const r = S.riders[E.wantsOut];
    if (r && r.amb > 60 && rnd() < 0.5) r.wantsOut = true;
  }
  press(o.head || "Le directeur sportif s'exprime", `« ${o.t} »`, 0, []);
  return o.res || 'Votre réponse a été publiée.';
}
// Une question restée sans réponse expire (notoriété -1).
function pressExpire() {
  if (S.pressQ && S.pressQ.exp <= S.week) {
    S.pressQ = null;
    addRep(-1);
    press(
      'Silence radio',
      "Le directeur sportif n'a pas souhaité répondre aux questions des journalistes. Une attitude jugée distante.",
      0
    );
  }
}
// Après chaque course
function pressAfterRace(rc) {
  const my = new Set(rc.sel[0] || []);
  const ran = my.size > 0;
  const gcl = gcList(rc);
  const multi = rc.specs.length > 1;
  const major = rc.cat <= 1;
  const w = S.riders[gcl[0]];
  const nm = id => riderName(S.riders[id]);
  const wPts = rc.cat === 0 ? 14 : rc.cat === 1 ? 8 : 5;
  // popularité : vainqueurs, podiums, étapes, combatifs
  gcl.slice(0, 3).forEach((id, i) => addPop(id, [wPts, wPts * 0.35, wPts * 0.2][i]));
  if (multi)
    for (const st of rc.stageRes) {
      addPop(st.res[0].id, rc.cat === 0 ? 4 : 2);
      if (st.komb) addPop(st.komb, rc.cat === 0 ? 2.5 : 1);
    }
  // les grands événements font la une, même sans vous
  if (major)
    press(
      multi ? `${riderName(w)} remporte ${rc.name}` : `${riderName(w)} s'impose sur ${rc.name}`,
      `${riderName(w)} (${teamOf(w) ? teamOf(w).name : ''}) ${multi ? 'remporte le classement général' : 'lève les bras'}.`,
      0,
      [w.id]
    );
  if (!ran) return;
  const pos = id => gcl.indexOf(id) + 1;
  const best = [...my].filter(id => pos(id) > 0).sort((a, b) => pos(a) - pos(b))[0];
  const myStages = multi ? rc.stageRes.filter(st => my.has(st.res[0].id)).map(st => st.res[0].id) : [];
  const p = best ? pos(best) : 99;
  const T = S.teams[0];
  if (p === 1) {
    const tone = rc.cat === 0 ? 6 : rc.cat === 1 ? 3 : 1.5;
    press(
      `Triomphe de ${nm(best)} !`,
      `${nm(best)} offre à ${T.name} ${multi ? 'le classement général de' : 'la victoire sur'} ${rc.name}. Une performance saluée par toute la presse.`,
      tone,
      [best],
      rc.cat === 0
    );
    if (major)
      askPress(`${nm(best)} vient de gagner ${rc.name}. Jusqu'où peut-il aller ?`, [
        {
          t: `Il peut viser les plus grandes victoires dès cette saison.`,
          e: { rep: 2, conf: 3, moral: [[best, 6]], pop: [[best, 3]] },
          head: 'Le DS voit grand',
          res: "Le sponsor apprécie l'ambition. Votre coureur est galvanisé, mais l'attente monte.",
        },
        {
          t: `Restons humbles, c'est une étape dans sa progression.`,
          e: { rep: 1, moral: [[best, -2]], team: 1 },
          head: 'Humilité de rigueur',
          res: 'Réponse sobre, bien accueillie. Le coureur aurait aimé plus de reconnaissance.',
        },
        {
          t: `C'est la victoire de toute l'équipe.`,
          e: { rep: 1, team: 3 },
          head: '« La victoire de tout un groupe »',
          res: 'Le groupe apprécie : moral collectif en hausse.',
        },
      ]);
  } else if (p <= 3) {
    press(
      `${nm(best)} sur le podium de ${rc.name}`,
      `Belle performance de ${T.name}, ${p}e avec ${nm(best)}.`,
      rc.cat === 0 ? 2.5 : rc.cat === 1 ? 1 : 0.4,
      [best]
    );
  }
  for (const id of myStages.slice(0, 3))
    if (!(p === 1 && id === best))
      press(
        `Victoire d'étape pour ${nm(id)}`,
        `${nm(id)} (${T.short}) s'offre une étape de ${rc.name}.`,
        rc.cat === 0 ? 2 : 0.8,
        [id]
      );
  // déception sur une grande course
  if (major && p > 15 && !myStages.length) {
    const tone = rc.cat === 0 ? -2.5 : -1;
    press(
      `Course décevante pour ${T.name}`,
      `Aucun coureur de ${T.name} dans le coup sur ${rc.name} (meilleur : ${best ? p + 'e' : 'abandon'}). Les critiques commencent à pleuvoir.`,
      tone
    );
    if (rc.cat === 0 || rnd() < 0.4)
      askPress(`${T.name} est passé à côté de ${rc.name}. Comment l'expliquez-vous ?`, [
        {
          t: `J'en prends l'entière responsabilité, les coureurs ont tout donné.`,
          e: { rep: 1.5, team: 3 },
          head: 'Le DS assume',
          res: "Vos coureurs apprécient d'être protégés. La presse salue votre franchise.",
        },
        {
          t: `Certains coureurs doivent se remettre en question.`,
          e: { rep: -0.5, team: -5, dis: S.teams[0].riders.map(id => [id, 3]) },
          head: 'Le DS hausse le ton',
          res: 'Le message est passé : discipline en hausse, mais moral en berne.',
        },
        {
          t: `Nous avons manqué de réussite, voilà tout.`,
          e: { rep: -1.5 },
          head: '« La malchance »',
          res: "L'excuse ne convainc personne.",
        },
      ]);
  }
  // désobéissances : la presse a des oreilles
  const reb = (rc.rebels || []).filter(id => S.riders[id] && S.riders[id].team === 0);
  if (reb.length && rnd() < 0.55) {
    const id = pick(reb);
    press(
      `Tensions chez ${T.name} ?`,
      `Selon nos informations, ${nm(id)} n'aurait pas respecté les consignes de son directeur sportif sur ${rc.name}.`,
      -1,
      [id]
    );
    askPress(`On dit que ${nm(id)} n'a pas respecté vos consignes. Votre réaction ?`, [
      {
        t: `Je le soutiens : il a senti la course, c'est un coureur de caractère.`,
        e: { moral: [[id, 8]], dis: [[id, -4]], rep: 0.5 },
        head: 'Le DS couvre son coureur',
        res: `${nm(id)} vous en est reconnaissant… mais il se sent plus libre que jamais.`,
      },
      {
        t: `Ce n'est pas acceptable, nous en parlerons en interne.`,
        e: { moral: [[id, -10]], dis: [[id, 7]], team: 1 },
        head: 'Recadrage public',
        res: `${nm(id)} est vexé, mais le reste du groupe a compris le message.`,
      },
      {
        t: `Il n'y a aucun problème dans l'équipe.`,
        e: { rep: -0.5 },
        head: '« Aucun problème »',
        res: "Langue de bois : les journalistes n'en croient pas un mot.",
      },
    ]);
  }
  // performances en montée hors normes
  const flag = S._pwFlag;
  S._pwFlag = null;
  if (flag && my.has(flag.id) && rnd() < 0.6) {
    const r = S.riders[flag.id];
    r.pwPress = S.season;
    press(
      `Les ${fmtDec(flag.wkg, 1)} W/kg de ${nm(flag.id)} interrogent`,
      `Sur ${flag.climb}, ${nm(flag.id)} aurait développé environ ${fmtDec(flag.wkg, 1)} W/kg pendant ${Math.round(flag.dur / 60)} minutes. Des chiffres qui font jaser.`,
      -0.5,
      [flag.id]
    );
    askPress(`Les données de puissance de ${nm(flag.id)} suscitent des questions. Que répondez-vous ?`, [
      {
        t: `Nous publions toutes nos données, nous n'avons rien à cacher.`,
        e: { rep: 2.5, conf: 1 },
        head: 'Transparence totale',
        res: 'Votre transparence est saluée par la presse et le sponsor.',
      },
      {
        t: `Il est simplement le plus fort, le reste ne nous intéresse pas.`,
        e: { rep: -2, moral: [[flag.id, 4]] },
        head: 'Le DS balaie les soupçons',
        res: 'Votre coureur apprécie le soutien, mais la presse est sceptique.',
      },
      {
        t: `Ces calculs sont approximatifs et ne veulent rien dire.`,
        e: { rep: -1 },
        head: 'Polémique sur les watts',
        res: "Une réponse technique qui ne convainc qu'à moitié.",
      },
    ]);
  }
}
// Chaque semaine : popularité qui se tasse, produits dérivés, rumeurs.
function pressWeekly() {
  if (S.rep == null) S.rep = 40;
  for (const id in S.riders) {
    const r = S.riders[id];
    if (r.retired) continue;
    initPop(r);
    r.pop = r.pop + (popBase(r) - r.pop) * 0.012;
  }
  // produits dérivés et visibilité : les coureurs populaires rapportent
  const merch =
    sum(
      S.teams[0].riders.map(id => {
        const q = S.riders[id].pop || 0;
        return (q * q) / 15000;
      })
    ) +
    S.rep * 0.02;
  S.budget += merch;
  finAdd('spons', merch);
  // rumeurs de transfert sur vos meilleurs coureurs
  if (S.week >= 14 && rnd() < 0.1) {
    const cands = S.teams[0].riders
      .map(id => S.riders[id])
      .filter(r => !r.aca && overall(r.s) >= 72 && r.contract <= 1 && !r.nextTeam);
    if (cands.length) {
      const r = pick(cands);
      const OT = pick(S.teams.filter(t => !t.player));
      press(
        `${riderName(r)} vers ${OT.name} ?`,
        `Selon nos informations, ${OT.name} s'intéresserait de près à ${riderName(r)}, en fin de contrat.`,
        0,
        [r.id]
      );
      askPress(`On annonce ${riderName(r)} chez ${OT.name} la saison prochaine. Info ou intox ?`, [
        {
          t: `Il est au cœur de notre projet, nous voulons le garder.`,
          e: { moral: [[r.id, 6]] },
          head: '« Il fait partie du projet »',
          res: `${riderName(r)} se sent valorisé (moral en hausse).`,
        },
        {
          t: `Tout est possible dans le vélo.`,
          e: { moral: [[r.id, -6]], wantsOut: r.id },
          head: 'Le DS ouvre la porte',
          res: `${riderName(r)} n'a pas apprécié de se sentir sur le départ.`,
        },
        { t: `Pas de commentaire.`, e: {}, head: 'Pas de commentaire', res: 'Rien de nouveau.' },
      ]);
    }
  }
  // tensions entre deux coureurs de l'équipe
  if (rnd() < 0.05) {
    const my = S.teams[0].riders;
    let worst = null;
    for (const [a, b] of pairs(my)) {
      const v = rel(a, b);
      if (v <= -35 && (!worst || v < worst[2])) worst = [a, b, v];
    }
    if (worst) {
      const [a, b] = worst;
      press(
        `Ambiance tendue entre ${riderName(S.riders[a])} et ${riderName(S.riders[b])}`,
        `Les deux coureurs ne se parleraient plus, selon plusieurs témoins.`,
        -0.8,
        [a, b]
      );
      askPress(`${riderName(S.riders[a])} et ${riderName(S.riders[b])} seraient en froid. Confirmez-vous ?`, [
        {
          t: `Nous allons régler ça en interne, ils sont tous les deux importants.`,
          e: { rel: [a, b, 10] },
          head: 'Le DS veut apaiser',
          res: "Une discussion collective détend un peu l'atmosphère.",
        },
        {
          t: `Ce sont des compétiteurs, c'est normal qu'il y ait de la tension.`,
          e: { rel: [a, b, -5], rep: -0.5 },
          head: 'Rivalité assumée',
          res: "La rivalité s'installe durablement.",
        },
        { t: `C'est faux, tout va très bien.`, e: { rep: -0.5 }, head: 'Démenti', res: "Personne n'est dupe." },
      ]);
    }
  }
  pressExpire();
}
// Toutes les paires d'éléments d'une liste.
function pairs(a) {
  const o = [];
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) o.push([a[i], a[j]]);
  return o;
}
// Bilan de presse de fin de saison ; la notoriété se rapproche du rang obtenu.
function pressEndSeason(myRank) {
  const target = clamp(78 - myRank * 5, 10, 85);
  S.rep = clamp(repOf() + (target - repOf()) * 0.25, 0, 100);
  const T = S.teams[0];
  press(
    `Bilan ${S.season} : ${T.name} ${myRank <= 3 ? 'au sommet' : myRank <= 6 ? 'dans le bon wagon' : 'doit mieux faire'}`,
    `${myRank}e équipe mondiale avec ${seasonWins(0)} victoire(s). Notoriété : ${repLabel(S.rep)}.`,
    0,
    [],
    true
  );
}
