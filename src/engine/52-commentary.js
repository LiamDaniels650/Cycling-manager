/* Le résumé du commentateur : à la fin de chaque étape, le récit de la journée comme à la télévision (le cadre,
   l'échappée, les moments décisifs, le final, le vainqueur, le général, mon équipe). Lecture seule des relevés
   d'étape (rc.stageRes) : aucun tirage au sort, la simulation n'en dépend pas. Les tournures varient d'une étape
   à l'autre grâce à une empreinte du nom de la course et du numéro d'étape. */

const TV_ARCH = {
  sprinteur: 'le sprinteur',
  grimpeur: 'le grimpeur',
  puncheur: 'le puncheur',
  rouleur: 'le rouleur',
  flahute: 'le spécialiste des classiques',
  baroudeur: 'le baroudeur',
  complet: 'le leader',
};
// Choix d'une tournure, fixe pour une étape donnée (empreinte du texte « sel »).
function tvPick(arr, salt) {
  let h = 2166136261;
  for (const c of String(salt)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return arr[(h >>> 0) % arr.length];
}
const tvPlain = t => String(t || '').replace(/<[^>]+>/g, '');
// Écart dit à l'oral : « 12 secondes », « 1 minute 05 ».
function tvGap(sec) {
  if (sec < 0.5) return "moins d'une seconde";
  sec = Math.round(sec);
  if (sec < 60) return `${sec} seconde${sec > 1 ? 's' : ''}`;
  const m = Math.floor(sec / 60),
    s = sec % 60;
  return s ? `${m} minute${m > 1 ? 's' : ''} ${String(s).padStart(2, '0')}` : `${m} minute${m > 1 ? 's' : ''}`;
}
const tvCap = t => t.charAt(0).toUpperCase() + t.slice(1);
const tvOrd = n => (n === 1 ? '1re' : n + 'e');
// « dans la côte de Malpasse », « dans le col du Galibier ».
function tvIn(name) {
  const low = name.charAt(0).toLowerCase() + name.slice(1);
  if (/^(Côte|Montée|Rampe|Bosse|Cima)\b/.test(name)) return 'dans la ' + low;
  if (/^(Col|Mont|Mur|Puy|Plateau|Pas)\b/.test(name)) return 'dans le ' + low;
  if (/^(Alto|Passo|Colle|Port)\b/.test(name)) return "dans l'ascension du " + name;
  return 'dans ' + name;
}
// « du Tour du Levant », « de la Semi-classique flamande », « d'Ouverture », « de Paris-Nice ».
function tvOf(name) {
  if (/^Le /.test(name)) return 'du ' + name.slice(3);
  if (/^La /.test(name)) return 'de la ' + name.slice(3);
  if (/^(Tour|Grand Prix|Critérium|Circuit|Championnat|Trophée|Mémorial)\b/.test(name)) return 'du ' + name;
  if (/^(Classique|Semi-classique|Flèche|Course|Ronde|Route|Coupe|Boucle)\b/.test(name)) return 'de la ' + name;
  if (/^[AEIOUYÉÈÂÎH]/.test(name)) return "d'" + name;
  return 'de ' + name;
}

// Paragraphes du résumé de l'étape idx (texte brut), ou null si l'étape n'a pas de résultat.
function tvRecap(rc, idx) {
  const st = rc.stageRes[idx];
  const spec = rc.specs[idx];
  if (!st || !spec || !st.res || !st.res.length) return null;
  const res = st.res;
  const salt = `${rc.name}|${idx}|${S.year || ''}`;
  const pick = (arr, k) => tvPick(arr, salt + k);
  const R = id => S.riders[id];
  const who = id => {
    const r = R(id);
    if (!r) return '?';
    const T = teamOf(r);
    return `${riderName(r)}${T ? (T.player ? ' (notre équipe)' : ` (${T.short})`) : ''}`;
  };
  const myShort = S.teams[0] ? S.teams[0].short : null;
  const nm = id => (R(id) ? riderName(R(id)) : '?');
  const mineIds = new Set(rc.sel[0] || []);
  const multi = rc.specs.length > 1;
  const P = [];
  const w = R(res[0].id);
  const g2 = res[1] ? res[1].gap : 0;
  const n1 = res.filter(e => e.gap < 1).length; // coureurs dans le temps du vainqueur
  const type = spec.type;
  const up = type === 'sommet' || type === 'punch';
  const tt = type === 'clm' || type === 'clmeq';

  // 1. le cadre
  const of = tvOf(rc.name);
  const where = multi ? `la ${tvOrd(idx + 1)} étape ${of}` : rc.name;
  const whereOf = multi ? `de la ${tvOrd(idx + 1)} étape ${of}` : of;
  const wx =
    spec.wx === 'pluie'
      ? pick([' sous la pluie', ', sur des routes détrempées', ' sous un ciel bas et la pluie'], 'wx')
      : spec.wx === 'chaleur'
        ? pick([' sous une chaleur écrasante', ', par une chaleur étouffante'], 'wx')
        : spec.wx === 'froid'
          ? pick([' dans le froid', ', par un froid piquant'], 'wx')
          : '';
  const kind = {
    plat: 'une étape pour les sprinteurs sur le papier',
    vallonne: 'un parcours vallonné, piégeux',
    punch: 'une arrivée en bosse pour puncheurs',
    montagne: 'une grande journée de montagne',
    sommet: 'une arrivée au sommet',
    paves: 'une journée de pavés',
    clm: 'un contre-la-montre',
    clmeq: 'un contre-la-montre par équipes',
  }[type];
  P.push(
    pick(
      [
        `${tvCap(where)} : ${spec.dist} kilomètres${wx}, ${kind || typeLbl(type).toLowerCase()}.`,
        `Bienvenue pour ce résumé ${whereOf} : ${kind || typeLbl(type).toLowerCase()}, ${spec.dist} kilomètres${wx}.`,
        `${spec.dist} kilomètres au programme ${whereOf}${wx} : ${kind || typeLbl(type).toLowerCase()}.`,
      ],
      'open'
    )
  );

  // 2. l'échappée (courses en ligne)
  const b = st.brk;
  if (!tt && b && b.n >= 1 && b.n <= 35 && b.max >= 30) {
    const grp = b.n === 1 ? 'un homme seul' : `${b.n} coureurs`;
    const mine = b.mine ? pick([', avec un de nos coureurs à l’avant', ', et nous y avions un homme'], 'bm') : '';
    let t = pick(
      [
        `L'échappée du jour, c'est ${grp}${mine} : jusqu'à ${tvGap(b.max)} d'avance au kilomètre ${b.maxKm}.`,
        `Très vite, ${grp} prennent le large${mine} ; l'écart culmine à ${tvGap(b.max)} au kilomètre ${b.maxKm}.`,
        `${tvCap(grp)} à l'attaque${mine}, et un peloton qui laisse filer jusqu'à ${tvGap(b.max)}.`,
      ],
      'brk'
    );
    if (b.won)
      t +=
        ' ' +
        pick(
          [
            'Et cette fois, le peloton ne reviendra jamais !',
            "Personne ne s'organise derrière : l'échappée ira au bout !",
          ],
          'bw'
        );
    else if (b.caught) {
      const c = b.caught;
      const tn = sh => {
        const T = S.teams.find(y => y.short === sh);
        return T ? (T.player ? 'notre équipe' : T.name) : sh;
      };
      const tl = (c.teams || []).map(([sh]) => tn(sh));
      const list = tl.length > 1 ? tl.slice(0, -1).join(', ') + ' et ' + tl[tl.length - 1] : tl[0];
      t +=
        ' ' +
        (tl.length
          ? pick(
              [
                `Mais ${list} ${tl.length > 1 ? 'prennent' : 'prend'} les choses en main, et la jonction se fait à ${c.km} km de la ligne.`,
                `Derrière, ${list} ${tl.length > 1 ? 'roulent' : 'roule'} : fin de l'aventure à ${c.km} km de l'arrivée.`,
              ],
              'bc'
            )
          : `Le peloton accélère et reprend tout le monde à ${c.km} km de l'arrivée.`);
    }
    P.push(t);
  }

  // 3. les moments décisifs (au plus deux, hors points de situation)
  // (les reprises d'échappée sont déjà racontées ; une seule ligne par kilomètre)
  const told = !!(b && b.n >= 1 && b.max >= 30);
  const mo = (st.moments || [])
    .filter(
      h =>
        !/^(📍|🚩|⛰️)/.test(h.txt) &&
        !(told && /reprend/.test(h.txt)) &&
        !/alliance|«|[Pp]ied de|tout va se jouer/.test(h.txt)
    )
    .filter((h, i, a) => a.findIndex(y => y.km === h.km) === i)
    .slice(-2);
  if (!tt && mo.length) {
    const lines = mo.map(h => {
      let t = tvPlain(h.txt)
        .replace(/^\S+\s/, '')
        .trim()
        .replace(/\s*[.!]+$/, '');
      if (myShort) t = t.split(`(${myShort})`).join('(notre équipe)');
      if (/^[A-ZÉ][a-zé]/.test(t)) t = t.charAt(0).toLowerCase() + t.slice(1); // « le peloton… » (pas « BORDURE »)
      return `au kilomètre ${h.km}, ${t}`;
    });
    P.push(
      tvCap(
        pick(
          ['Les moments qui ont fait la course : ', 'Ce qu’il faut retenir : ', 'Les tournants de la journée : '],
          'mo'
        ) +
          lines.join(' ; puis ') +
          '.'
      )
    );
  }

  // 4. la montée la plus marquante (puissance du plus rapide)
  const cl = (st.climbs || []).slice(-1)[0];
  if (!tt && cl && cl.top && cl.top.length) {
    const c0 = cl.top[0];
    P.push(
      pick(
        [
          `${tvCap(tvIn(cl.name))}, ${who(c0.id)} est le plus rapide : ${fmtTime(c0.dur)}, ${c0.wkg.toFixed(1).replace('.', ',')} watts par kilo. Impressionnant.`,
          `Le chrono de la journée ${tvIn(cl.name)} ? ${fmtTime(c0.dur)} pour ${who(c0.id)}, à ${c0.wkg.toFixed(1).replace('.', ',')} W/kg.`,
        ],
        'cl'
      )
    );
  }

  // 5. le final et le vainqueur
  const T = teamOf(w);
  const arch = TV_ARCH[w.arch] || 'le coureur';
  const wins = st.wn || (w.stats ? w.stats.wins : 0);
  const tally =
    wins > 1
      ? ` C'est sa ${tvOrd(wins).replace('1re', 'première')} victoire de la saison.`
      : ` C'est sa première victoire de la saison !`;
  const by = res[1] ? who(res[1].id) : null;
  let fin;
  if (type === 'clmeq') {
    fin = `Victoire de ${T ? T.name : 'l’équipe'} dans ce chrono collectif, emmenée par ${nm(res[0].id)}.`;
  } else if (type === 'clm') {
    fin = pick(
      [
        `Contre le chrono, ${who(res[0].id)} réalise le meilleur temps en ${fmtTime(res[0].time)}${by ? `, ${tvGap(g2)} devant ${by}` : ''}.`,
        `Personne ne fait mieux que ${who(res[0].id)} aujourd'hui : ${fmtTime(res[0].time)}${by ? `, et ${by} relégué à ${tvGap(g2)}` : ''}.`,
      ],
      'tt'
    );
  } else if (n1 === 1 && g2 >= 2) {
    fin = pick(
      [
        `Et c'est ${arch} ${who(res[0].id)} qui s'impose en solitaire ! ${tvCap(tvGap(g2))} d'avance sur ${by} : une démonstration.`,
        `${who(res[0].id)} franchit la ligne seul, les bras levés, avec ${tvGap(g2)} d'avance sur ${by}. Quel numéro !`,
        `Seul au monde : ${who(res[0].id)} l'emporte avec ${tvGap(g2)} sur ${by}.`,
      ],
      'solo'
    );
  } else if (n1 === 2 && !up) {
    fin = pick(
      [
        `Duel à deux pour la victoire : ${who(res[0].id)} prend le meilleur sur ${by}.`,
        `Ils ne sont que deux à se disputer la gagne, et c'est ${who(res[0].id)} qui règle ${by}.`,
      ],
      'duo'
    );
  } else if (n1 >= 20) {
    fin = pick(
      [
        `Tout se joue au sprint massif, et c'est ${who(res[0].id)} qui a la pointe de vitesse la plus tranchante, devant ${by}.`,
        `Sprint royal sur la ligne : ${who(res[0].id)} lève les bras, ${by} doit se contenter de la deuxième place.`,
        `Le peloton groupé pour l'emballage final, et ${arch} ${who(res[0].id)} ne laisse aucune chance à ${by} !`,
      ],
      'sp'
    );
  } else if (up) {
    fin = pick(
      [
        `Dans la montée finale, ${who(res[0].id)} est le plus fort d'un petit groupe de ${n1}, devant ${by}.`,
        `Sur les pentes de l'arrivée, ${who(res[0].id)} fait la différence et devance ${by}${g2 >= 1 ? ` de ${tvGap(g2)}` : ' sur la ligne'}.`,
      ],
      'up'
    );
  } else {
    fin = pick(
      [
        `Un groupe de ${n1} se dispute la victoire, et c'est ${who(res[0].id)} qui l'emporte devant ${by}.`,
        `Au sprint d'un petit groupe de ${n1}, ${who(res[0].id)} est le plus rapide, ${by} deuxième.`,
      ],
      'grp'
    );
  }
  P.push(fin + (type === 'clmeq' ? '' : tally));

  // 6. le général
  if (multi && st.lead != null) {
    const prev = idx > 0 && rc.stageRes[idx - 1] ? rc.stageRes[idx - 1].lead : null;
    const L = st.lead;
    const gap =
      st.lgap != null
        ? st.lgap >= 1
          ? ` avec ${tvGap(st.lgap)} d'avance`
          : ', dans le même temps que son dauphin'
        : '';
    if (idx === 0) P.push(`${who(L)} endosse le premier maillot de leader${gap}.`);
    else if (prev == null || prev !== L)
      P.push(
        pick(
          [
            `Au général, ${who(L)} s'empare du maillot de leader${gap}.`,
            `Changement de leader : c'est désormais ${who(L)} qui portera le maillot${gap}.`,
          ],
          'gc'
        )
      );
    else
      P.push(
        pick(
          [
            `${who(L)} conserve son maillot de leader${gap}.`,
            `Rien ne change en tête du général : ${who(L)} reste leader${gap}.`,
          ],
          'gc'
        )
      );
  }

  // 7. mon équipe
  const my = res.map((e, i) => [e, i]).filter(([e]) => mineIds.has(e.id));
  if (my.length) {
    const [e, i] = my[0];
    let t;
    if (i === 0)
      t = pick(
        [
          'Quelle journée pour notre équipe : la victoire est à nous !',
          'Et c’est notre coureur qui gagne : quelle joie dans la voiture !',
        ],
        'me'
      );
    else if (i < 3) t = `Pour notre équipe, ${nm(e.id)} monte sur le podium : ${tvOrd(i + 1)}.`;
    else if (i < 10)
      t = `De notre côté, ${nm(e.id)} accroche une place dans les dix : ${tvOrd(i + 1)}${e.gap >= 1 ? `, à ${tvGap(e.gap)}` : ''}.`;
    else
      t = `Pour notre équipe, le meilleur est ${nm(e.id)}, ${tvOrd(i + 1)}${e.gap >= 1 ? ` à ${tvGap(e.gap)}` : ''}. ${pick(['Il faudra faire mieux.', 'Une journée sans.', 'On se rattrapera.'], 'meh')}`;
    P.push(t);
  }
  return P;
}
