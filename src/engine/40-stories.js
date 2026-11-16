/* Histoires : arcs narratifs sur plusieurs semaines ou saisons, nés de la personnalité des coureurs
   (ambition, discipline, caractère, relations) et des résultats. Chaque histoire pose une décision au directeur
   sportif ; sans réponse, une option par défaut s'applique à l'échéance. Les effets passent par les leviers déjà
   existants (moral, discipline, ambition, relations, promesse de leadership, envie de partir, contrat).
   Le hasard des histoires a sa propre série (hachage), pour ne pas décaler celle des courses. */

const STORY_KINDS = {
  rival: { ic: '⚔️', lbl: 'Bête noire' },
  coqs: { ic: '🐓', lbl: 'Deux coqs' },
  pepite: { ic: '💎', lbl: 'La pépite' },
  lion: { ic: '🦁', lbl: 'Le vieux lion' },
  frustre: { ic: '😤', lbl: "L'équipier frustré" },
  rebelle: { ic: '🔥', lbl: 'La tête brûlée' },
};
const STORY_WAIT = 3; // semaines pour décider
// Au plus n histoires de chaque sorte par saison (pour qu'elles restent des moments, pas du bruit).
const STORY_CAP = { rival: 2, coqs: 1, pepite: 2, lion: 1, frustre: 2, rebelle: 2 };
function storyCan(k) {
  return storiesOn().filter(t => t.k === k && t.s0 === S.season).length < STORY_CAP[k];
}

// Hasard propre aux histoires : déterministe, sans toucher à la série des courses.
function srnd(...k) {
  let h = 0x9e3779b9 ^ ((S.seed || 1) * 2654435761);
  for (const v of k) {
    h = Math.imul(h ^ (Math.round(v * 1000) | 0), 0x85ebca6b);
    h ^= h >>> 13;
  }
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function storyMine(id) {
  const r = S.riders[id];
  return !!r && !r.retired && r.team === 0;
}
function storiesOn() {
  S.stories = S.stories || [];
  return S.stories;
}
function storyOpen(k, id) {
  return storiesOn().find(t => !t.done && t.k === k && (t.a === id || t.b === id));
}
function storyLog(t, txt) {
  t.log.push({ s: S.season, w: S.week, txt });
}
function storyNew(k, a, b, txt, ask, data = {}) {
  S.storyId = (S.storyId || 0) + 1;
  const t = {
    id: S.storyId,
    k,
    a,
    b: b == null ? null : b,
    s0: S.season,
    w0: S.week,
    log: [],
    ask: null,
    data,
    done: false,
  };
  storyLog(t, txt);
  if (ask) storyAsk(t, ask.txt, ask.opts, ask.def);
  storiesOn().push(t);
  msg(`${STORY_KINDS[k].ic} ${STORY_KINDS[k].lbl}`, txt + (ask ? ' <b>Une décision vous attend (Histoires).</b>' : ''));
  return t;
}
function storyAsk(t, txt, opts, def) {
  t.ask = { txt, opts, def: def || opts[0][0], exp: S.week + STORY_WAIT, s: S.season };
}
function storyEnd(t, txt) {
  if (txt) {
    storyLog(t, txt);
    msg(`${STORY_KINDS[t.k].ic} ${STORY_KINDS[t.k].lbl} : fin`, txt);
  }
  t.done = true;
  t.ask = null;
}
const smo = (r, v) => (r.moral = clamp(r.moral + v, 0, 100));
const snm = id => riderName(S.riders[id]);
// Histoires en attente d'une décision du joueur.
function storyAsks() {
  return storiesOn().filter(t => !t.done && t.ask);
}

// ---------- Décisions ----------
function storyChoose(id, opt, auto) {
  const t = storiesOn().find(x => x.id === id);
  if (!t || !t.ask) return null;
  const o = t.ask.opts.find(o => o[0] === opt);
  if (!o) return null;
  t.ask = null;
  const L = { s: S.season, w: S.week, txt: `${auto ? 'Sans réponse : ' : 'Votre choix : '}« ${o[1]} ».` };
  t.log.push(L);
  const res = STORY_FX[t.k](t, opt) || '';
  if (res) L.txt += ' ' + res;
  return res || (t.log[t.log.length - 1] !== L ? t.log[t.log.length - 1].txt : '');
}
const STORY_FX = {
  rival(t, o) {
    const r = S.riders[t.a];
    t.data.heat = o === 'attiser' ? 2 : 1;
    if (o === 'attiser') {
      smo(r, 5);
      r.amb = clamp(r.amb + 2, 0, 99);
      return `${snm(t.a)} répond dans la presse : il veut battre ${snm(t.b)}. Les duels compteront double pour son moral.`;
    }
    return `${snm(t.a)} garde la tête froide.`;
  },
  coqs(t, o) {
    const A = S.riders[t.a],
      B = S.riders[t.b];
    if (o === 'partage') {
      addRel(t.a, t.b, -6);
      smo(A, -2);
      smo(B, -2);
      t.data.road = true;
      t.data.until = S.week + 12;
      return 'Pas de hiérarchie : la route désignera le plus fort sur les deux prochaines grandes courses.';
    }
    const [W, L] = o === 'a' ? [A, B] : [B, A];
    smo(W, 8);
    W.promise = true;
    smo(L, L.trait === 'fragile' ? -14 : -10);
    addRel(t.a, t.b, -10);
    let out = '';
    if ((L.trait === 'leaderne' || L.amb > 80) && srnd(t.id, 1) < 0.4) {
      L.wantsOut = true;
      out = ` ${riderName(L)} le prend très mal et demande à partir.`;
    }
    storyEnd(t, `${riderName(W)} est désigné leader. ${riderName(L)} devra rouler pour lui.${out}`);
    return '';
  },
  pepite(t, o) {
    const r = S.riders[t.a];
    if (o === 'proteger') {
      r.fatigue = Math.max(0, r.fatigue - 15);
      smo(r, 4);
      r.amb = clamp(r.amb - 3, 0, 99);
      storyEnd(t, `On protège ${riderName(r)} : programme allégé, pas de pression. Il récupère.`);
    } else if (o === 'lancer') {
      r.promise = true;
      smo(r, 10);
      r.amb = clamp(r.amb + 5, 0, 99);
      storyEnd(t, `${riderName(r)} aura sa chance comme leader. Il est gonflé à bloc.`);
    } else {
      const e = extendRider(t.a, 3);
      if (e) storyEnd(t, e);
      else {
        smo(r, 6);
        storyEnd(t, `${riderName(r)} prolonge de trois ans (${fmtMoney(r.salary)}/an) : la pépite reste à la maison.`);
      }
    }
    return '';
  },
  lion(t, o) {
    const r = S.riders[t.a];
    if (o === 'adieux') {
      smo(r, 10);
      r.pop = clamp((r.pop || 0) + 5, 0, 100);
      r.retireNow = true;
      t.data.tour = true;
      for (const id of S.teams[0].riders) if (id !== t.a) smo(S.riders[id], 2);
      return `Tournée d'adieux : ${riderName(r)} raccrochera en fin de saison, fêté partout.`;
    }
    if (o === 'encore') {
      r.contract = Math.max(r.contract, 1) + 1;
      r.stayOn = S.season;
      smo(r, 6);
      return `${riderName(r)} signe pour une saison de plus. « Tant que les jambes suivent… »`;
    }
    return `${riderName(r)} décidera seul, en fin de saison.`;
  },
  frustre(t, o) {
    const r = S.riders[t.a];
    if (o === 'promesse') {
      r.promise = true;
      smo(r, 8);
      storyEnd(
        t,
        `Promesse faite : ${riderName(r)} aura un rôle de leader. À tenir dans les prochaines grandes courses.`
      );
    } else if (o === 'augmentation') {
      r.salary = Math.round((r.salary * 1.15) / 5) * 5;
      smo(r, 6);
      storyEnd(t, `${riderName(r)} est augmenté (${fmtMoney(r.salary)}/an) et reste un équipier précieux.`);
    } else {
      smo(r, -8);
      r.amb = clamp(r.amb - 2, 0, 99);
      let out = '';
      if (r.amb >= 75 && srnd(t.id, 2) < 0.3) {
        r.wantsOut = true;
        out = ' Il demande à partir.';
      }
      storyEnd(t, `${riderName(r)} est déçu : son rôle ne changera pas.${out}`);
    }
    return '';
  },
  rebelle(t, o) {
    const r = S.riders[t.a];
    if (o === 'amende') {
      r.dis = clamp(r.dis + 6, 0, 99);
      smo(r, -10);
      for (const L of S.teams[0].riders) if (L !== t.a && S.riders[L].amb > 70) addRel(t.a, L, -4);
      storyEnd(t, `Amende pour ${riderName(r)} : discipline en hausse, mais il rumine.`);
    } else if (o === 'parler') {
      if (srnd(t.id, 3) < 0.6) {
        r.dis = clamp(r.dis + 4, 0, 99);
        smo(r, 3);
        storyEnd(t, `La discussion porte : ${riderName(r)} promet de respecter les consignes.`);
      } else {
        r.dis = clamp(r.dis - 2, 0, 99);
        smo(r, -5);
        storyEnd(t, `La discussion tourne court : ${riderName(r)} n'a rien voulu entendre.`);
      }
    } else {
      smo(r, 6);
      r.dis = clamp(r.dis - 3, 0, 99);
      for (const id of S.teams[0].riders) if (id !== t.a && S.riders[id].trait === 'modele') smo(S.riders[id], -3);
      storyEnd(t, `On laisse ${riderName(r)} s'exprimer. Les équipiers modèles apprécient moyennement.`);
    }
    return '';
  },
};

// ---------- Déclencheurs ----------
// Après chaque course : duels (bête noire), désobéissances (tête brûlée), sacrifices (équipier frustré),
// premières victoires (pépite), et suite des histoires en cours.
function storiesAfterRace(rc) {
  if (!S.teams || !rc.stageRes || !rc.stageRes.length) return;
  const order = rc.specs.length > 1 ? gcList(rc) : (rc.stageRes[0].res || []).map(e => e.id);
  const top = order.slice(0, 10);
  const my = rc.sel[0] || [];
  S.storyCnt = S.storyCnt && S.storyCnt.s === S.season ? S.storyCnt : { s: S.season, duel: {}, reb: {}, help: {} };
  const C = S.storyCnt;
  // duels : mon coureur dans le top 10, un adversaire juste devant ou devant lui dans le top 10
  for (const id of my) {
    const p = top.indexOf(id);
    if (p < 0) continue;
    for (let j = 0; j < p; j++) {
      const o = top[j];
      const R = S.riders[o];
      if (!R || R.team === 0) continue;
      const k = id + '-' + o;
      C.duel[k] = (C.duel[k] || 0) + 1;
      if (C.duel[k] >= 3 && !storyOpen('rival', id) && rc.cat <= 1 && storyCan('rival')) {
        storyNew(
          'rival',
          id,
          o,
          `${snm(id)} a encore fini derrière ${snm(o)} (${teamOf(R) ? teamOf(R).short : '—'}) sur ${rc.name} : la troisième fois cette saison. La presse parle de « bête noire ».`,
          {
            txt: `Comment ${snm(id)} doit-il réagir ?`,
            opts: [
              ['froid', 'Garder la tête froide'],
              ['attiser', 'Attiser la rivalité dans la presse'],
            ],
          },
          { w: 0, l: 0, heat: 1, streak: 0 }
        );
      }
    }
  }
  // bête noire en cours : chaque course où les deux finissent dans le top 10 est un duel
  for (const t of storiesOn()) {
    if (t.done || t.k !== 'rival' || t.ask) continue;
    if (!storyMine(t.a) || !S.riders[t.b] || S.riders[t.b].retired) {
      storyEnd(t, `La rivalité ${snm(t.a)} – ${snm(t.b)} s'éteint (${t.data.w} victoire(s) à ${t.data.l}).`);
      continue;
    }
    const pa = top.indexOf(t.a),
      pb = top.indexOf(t.b);
    if (pa < 0 || pb < 0) continue;
    const r = S.riders[t.a];
    const h = t.data.heat || 1;
    if (pa < pb) {
      t.data.w++;
      t.data.streak = Math.max(0, t.data.streak) + 1;
      smo(r, 6 * h);
      storyLog(
        t,
        `${rc.name} : ${snm(t.a)} devance ${snm(t.b)} (${pa + 1}e contre ${pb + 1}e). ${t.data.w}-${t.data.l}.`
      );
      if (t.data.streak >= 3) {
        smo(r, 8);
        r.amb = clamp(r.amb + 3, 0, 99);
        storyEnd(
          t,
          `${snm(t.a)} a battu ${snm(t.b)} trois fois de suite : le complexe a disparu (${t.data.w}-${t.data.l}).`
        );
      }
    } else {
      t.data.l++;
      t.data.streak = Math.min(0, t.data.streak) - 1;
      smo(r, -(r.trait === 'fragile' ? 8 : 4) * h);
      storyLog(t, `${rc.name} : encore ${snm(t.b)} devant (${pb + 1}e contre ${pa + 1}e). ${t.data.w}-${t.data.l}.`);
    }
  }
  // désobéissances répétées
  for (const id of new Set(rc.rebels || [])) {
    if (!storyMine(id)) continue;
    C.reb[id] = (C.reb[id] || 0) + 1;
    const rr = S.riders[id];
    if (rr.dis >= 65 && !['tete', 'opportuniste', 'leaderne'].includes(rr.trait)) continue;
    if (
      C.reb[id] >= 4 &&
      storyCan('rebelle') &&
      !storyOpen('rebelle', id) &&
      !(S.storyDone && S.storyDone['rebelle-' + id] === S.season)
    ) {
      (S.storyDone = S.storyDone || {})['rebelle-' + id] = S.season;
      storyNew(
        'rebelle',
        id,
        null,
        `${snm(id)} a encore ignoré les consignes sur ${rc.name} : la quatrième fois cette saison. Le vestiaire grince.`,
        {
          txt: `Que faire avec ${snm(id)} ?`,
          opts: [
            ['parler', 'Discussion franche'],
            ['amende', 'Amende et recadrage'],
            ['laisser', "Le laisser s'exprimer"],
          ],
        }
      );
    }
  }
  // équipiers qui se sacrifient course après course
  const leaders = new Set(rc.ledBy || []);
  for (const id of my) {
    if (leaders.has(id) || !storyMine(id)) continue;
    C.help[id] = (C.help[id] || 0) + 1;
    const r = S.riders[id];
    const best = Math.max(...my.filter(x => leaders.has(x)).map(x => overall(S.riders[x].s)), 0);
    if (
      C.help[id] >= 8 &&
      storyCan('frustre') &&
      r.amb >= 60 &&
      !r.promise &&
      ['modele', 'aucun', 'regulier', 'opportuniste'].includes(r.trait) &&
      overall(r.s) >= best - 4 &&
      !storyOpen('frustre', id) &&
      !(S.storyDone && S.storyDone['frustre-' + id] === S.season)
    ) {
      (S.storyDone = S.storyDone || {})['frustre-' + id] = S.season;
      storyNew(
        'frustre',
        id,
        null,
        `${snm(id)} a roulé pour les autres sur ${C.help[id]} courses cette saison. Il vient vous voir : il aimerait sa chance.`,
        {
          txt: `Que répondre à ${snm(id)} ?`,
          opts: [
            ['promesse', 'Lui promettre un rôle de leader'],
            ['augmentation', 'Le remercier par une augmentation'],
            ['non', 'Son rôle ne change pas'],
          ],
          def: S.budget > 200 ? 'augmentation' : 'non', // sans réponse : un geste s'il y a de quoi
        }
      );
    }
  }
  // pépite : première victoire d'un jeune (22 ans ou moins)
  const win = order[0];
  if (storyMine(win)) {
    const r = S.riders[win];
    const wins = (r.palm || []).filter(p => p.k === 1 && !/espoirs|juniors/i.test(p.e)).length;
    if (
      r.age <= 22 &&
      wins <= 2 &&
      storyCan('pepite') &&
      !storyOpen('pepite', win) &&
      !(S.storyDone && S.storyDone['pepite-' + win])
    ) {
      (S.storyDone = S.storyDone || {})['pepite-' + win] = S.season;
      storyNew(
        'pepite',
        win,
        null,
        `${snm(win)}, ${r.age} ans, gagne ${rc.name} ! Les recruteurs adverses se renseignent déjà.`,
        {
          txt: `Comment gérer l'éclosion de ${snm(win)} ?`,
          opts: [
            ['proteger', 'Le protéger : programme allégé'],
            ['lancer', 'Le lancer : rôle de leader promis'],
            ['prolonger', 'Prolonger son contrat tout de suite (3 ans)'],
          ],
        }
      );
    }
  }
  // deux coqs : suite (la route décide)
  for (const t of storiesOn()) {
    if (t.done || t.k !== 'coqs' || !t.data.road || rc.cat > 1) continue;
    const pa = order.indexOf(t.a),
      pb = order.indexOf(t.b);
    if (pa < 0 || pb < 0) continue;
    const [W, L] = pa < pb ? [t.a, t.b] : [t.b, t.a];
    t.data.score = t.data.score || {};
    t.data.score[W] = (t.data.score[W] || 0) + 1;
    storyLog(t, `${rc.name} : ${snm(W)} devant ${snm(L)}.`);
    if (t.data.score[W] >= 2) {
      smo(S.riders[W], 6);
      smo(S.riders[L], -6);
      S.riders[W].promise = true;
      storyEnd(t, `La route a tranché : ${snm(W)} est le patron. ${snm(L)} s'incline, pour l'instant.`);
    }
  }
}
// Chaque semaine : conflits de leaders, vétérans en fin de carrière, échéances des décisions.
function storiesWeekly() {
  if (!S.teams || !S.teams[0]) return;
  const my = S.teams[0].riders.map(id => S.riders[id]).filter(Boolean);
  // échéances : sans réponse, l'option par défaut
  for (const t of storiesOn())
    if (!t.done && t.ask && (t.ask.s !== S.season || S.week > t.ask.exp)) storyChoose(t.id, t.ask.def, true);
  // deux coqs
  if (S.week >= 3 && S.week <= 34)
    for (let i = 0; i < my.length; i++)
      for (let j = i + 1; j < my.length; j++) {
        const A = my[i],
          B = my[j];
        if (A.amb < 70 || B.amb < 70 || rel(A.id, B.id) > -35) continue;
        if (Math.abs(overall(A.s) - overall(B.s)) > 3) continue;
        const gcA = A.s.mon >= 74,
          gcB = B.s.mon >= 74;
        if (!(A.arch === B.arch || (gcA && gcB))) continue;
        if (!storyCan('coqs') || storyOpen('coqs', A.id) || storyOpen('coqs', B.id)) continue;
        const key = 'coqs-' + Math.min(A.id, B.id) + '-' + Math.max(A.id, B.id);
        if (S.storyDone && S.storyDone[key] === S.season) continue;
        (S.storyDone = S.storyDone || {})[key] = S.season;
        storyNew(
          'coqs',
          A.id,
          B.id,
          `${riderName(A)} et ${riderName(B)} se disputent le rôle de leader. L'ambiance se tend dans le bus.`,
          {
            txt: 'Qui est le leader ?',
            opts: [
              ['a', `${riderName(A)}`],
              ['b', `${riderName(B)}`],
              ['partage', 'La route décidera'],
            ],
            def: 'partage',
          }
        );
      }
  for (const t of storiesOn())
    if (!t.done && t.k === 'coqs' && t.data.road && S.week > t.data.until)
      storyEnd(t, `Pas de verdict de la route : ${snm(t.a)} et ${snm(t.b)} restent co-leaders, et rivaux.`);
  // vieux lion
  if (S.week >= 8 && S.week <= 30)
    for (const r of my) {
      if (
        r.age < 34 ||
        r.age >= 37 ||
        overall(r.s) < 68 ||
        !storyCan('lion') ||
        storyOpen('lion', r.id) ||
        (S.storyDone && S.storyDone['lion-' + r.id])
      )
        continue;
      if (srnd(r.id, S.season, S.week, 7) > 0.08) continue;
      (S.storyDone = S.storyDone || {})['lion-' + r.id] = S.season;
      storyNew('lion', r.id, null, `${riderName(r)}, ${r.age} ans, confie qu'il pense à la retraite. Il hésite.`, {
        txt: `Que proposer à ${riderName(r)} ?`,
        opts: [
          ['laisser', 'Le laisser décider seul'],
          ['adieux', "Organiser une tournée d'adieux"],
          ['encore', 'Lui proposer une saison de plus'],
        ],
      });
    }
}
// Fin de saison : adieux des vieux lions, bilan des rivalités longues.
function storiesEndSeason() {
  for (const t of storiesOn()) {
    if (t.done) continue;
    const r = S.riders[t.a];
    if (t.k === 'lion') {
      const wins = r ? (r.palm || []).filter(p => p.k === 1 && !/espoirs|juniors/i.test(p.e)).length : 0;
      storyEnd(
        t,
        r && r.retired
          ? `${riderName(r)} raccroche après ${wins} victoire(s). Une page se tourne.`
          : `${snm(t.a)} continue l'aventure.`
      );
    } else if (t.k === 'rival' && S.season - t.s0 >= 1) {
      storyEnd(t, `Deux saisons de duels : ${snm(t.a)} – ${snm(t.b)}, ${t.data.w} à ${t.data.l}.`);
    } else if (!r || r.retired || r.team !== 0) storyEnd(t, null);
  }
}
