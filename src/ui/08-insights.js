/* Interface — aide à la décision : lectures de l'effectif, du marché et du calendrier, calculées uniquement à
   partir de ce que le directeur sportif voit (valeurs estimées « ~ » pour les coureurs des autres équipes). Aucun
   calcul ici ne touche à la simulation. */

// Profils de l'effectif : nombre de coureurs et meilleur niveau (vu) par archétype.
function rosterProfile() {
  const p = {};
  for (const r of myRiders()) {
    const o = (p[r.arch] = p[r.arch] || { n: 0, best: 0 });
    o.n++;
    o.best = Math.max(o.best, overall(r.s));
  }
  return p;
}
// Badges d'aide au recrutement pour un coureur du marché : besoin de l'effectif, prix, âge.
function marketBadges(r, prof) {
  const B = [];
  const ov = shownOv(r);
  const mine = prof[r.arch];
  if (!mine) B.push(['need', `Aucun ${ARCH[r.arch].lbl.toLowerCase()} dans l'effectif`]);
  else if (ov > mine.best + 2)
    B.push(['need', `Mieux que votre meilleur ${ARCH[r.arch].lbl.toLowerCase()} (${mine.best})`]);
  const dem = contractDemand(r);
  const fair = salaryFor(ov, r.age);
  // (les coureurs libres demandent souvent moins que le salaire habituel : seule une vraie affaire est signalée)
  if (dem <= fair * 0.6) B.push(['good', 'Bon rapport niveau/salaire']);
  else if (dem >= fair * 1.25) B.push(['bad', 'Cher pour son niveau']);
  if (r.age <= 24) B.push(['info', 'Encore en progression']);
  else if (r.age >= 33) B.push(['warn', 'Âge : déclin probable']);
  return B;
}
function badgesHTML(B) {
  return B.map(([k, t]) => `<span class="ib ib-${k}">${esc(t)}</span>`).join('');
}
// Bandeau d'effectif : profils présents, budget et masse salariale.
function rosterSummaryHTML() {
  const prof = rosterProfile();
  const cells = Object.keys(ARCH)
    .map(k => {
      const o = prof[k];
      return `<div class="pf ${o ? '' : 'pf-0'}"><b>${o ? o.n : 0}</b><span>${ARCH[k].lbl}</span><i>${o ? 'meilleur ' + o.best : 'aucun'}</i></div>`;
    })
    .join('');
  return `<div class="pfs">${cells}</div>`;
}
// Atout de l'équipe pour une course : le coureur le mieux adapté au parcours (même calcul d'adéquation que la
// planification et la sélection des équipes IA, raceFit du planificateur).
function raceAsset(c) {
  const my = myRiders().filter(r => r.injury <= 0);
  if (!my.length) return null;
  const b = my.slice().sort((a, b2) => raceFit(b2, c) - raceFit(a, c))[0];
  return { r: b, v: Math.round(raceFit(b, c)) };
}
// Objectif UCI du sponsor : écart de points avec la place visée.
function uciObjectiveHTML() {
  const o = (S.obj || []).find(o => o.k === 'uci');
  if (!o) return '';
  const rk = uciRanking();
  const me = S.teams[0];
  const pos = rk.indexOf(me) + 1;
  const target = rk[o.n - 1];
  const gap = target && target !== me ? (target.uci || 0) - (me.uci || 0) : 0;
  return `<div class="brief">🎯 Objectif du sponsor : top ${o.n}. Vous êtes <b>${pos}e</b>${pos <= o.n ? ' — objectif atteint pour l’instant.' : ` — il manque <b>${gap} pts</b> pour rejoindre ${esc(target.name)} (${o.n}e).`}</div>`;
}

// Terrains où un coureur est le plus à l'aise, d'après ses caractéristiques visibles (estimées s'il n'est pas
// dans l'équipe) : les deux ou trois points forts, traduits en types de course.
const TERRAIN_LBL = {
  mon: 'cols et arrivées au sommet',
  col: 'arrivées en côte et classiques vallonnées',
  spr: 'sprints massifs',
  clm: 'contre-la-montre',
  pav: 'classiques pavées',
  pla: 'étapes de plaine et échappées au long cours',
  bar: 'échappées et attaques',
  des: 'descentes techniques',
};
function riderTerrains(r) {
  const k = Object.keys(TERRAIN_LBL).sort((a, b) => shownStat(r, b) - shownStat(r, a));
  const top = shownStat(r, k[0]);
  const L = k.filter((x, i) => i < 3 && shownStat(r, x) >= top - 4).map(x => TERRAIN_LBL[x]);
  if (shownStat(r, 'mon') >= 75 && shownStat(r, 'clm') >= 72 && shownStat(r, 'rec') >= 70)
    L.unshift('classement général des courses par étapes');
  return L;
}
// Projection des flux réguliers (sponsor, équipementiers, salaires, académie, staff) jusqu'à la fin de saison :
// exactement les versements hebdomadaires du jeu, sans les primes, frais de course ni transferts (variables).
function budgetProjection() {
  const wk = Math.max(0, LAST_WEEK - S.week);
  const P0 = S.teams[0];
  const weekly =
    sponsorWeekly() +
    sum(Object.values(S.eqDeal || {}).map(d => d.pay)) / LAST_WEEK -
    sum(P0.riders.map(id => S.riders[id].salary)) / LAST_WEEK -
    sum(S.academy.map(id => S.riders[id].salary)) / LAST_WEEK -
    staffWeekly();
  return { wk, weekly, end: S.budget + weekly * wk };
}

// Icône d'un message selon son sujet (l'émoji du titre s'il y en a un).
function msgIcon(t) {
  const m = t.match(/^\p{Extended_Pictographic}\uFE0F?/u);
  if (m) return m[0];
  return /^Bilan/.test(t)
    ? '🏁'
    : /mécontent|veut partir|surmen/i.test(t)
      ? '😠'
      : /contrat|prolong|signe|recrut|pré-contrat|transfert/i.test(t)
        ? '✍️'
        : /bless|chute|malade/i.test(t)
          ? '🚑'
          : /sponsor|budget|finance|prime/i.test(t)
            ? '💶'
            : /espoir|académie|junior|stagiaire|vivier/i.test(t)
              ? '🎓'
              : /équipementier/i.test(t)
                ? '🚲'
                : '✉️';
}

// Affichage des messages : les messages du même genre la même semaine (« X mécontent », « Y courtisé ») sont
// présentés ensemble. Les messages eux-mêmes ne sont pas modifiés (lecture comprise, gérée par le rendu).
/** @type {[RegExp, string][]} */
const MSG_GROUPS = [
  [/^(.+) mécontent$/, 'Coureurs mécontents'],
  [/^(.+) courtisé$/, 'Espoirs courtisés'],
];
function groupMsgs(L) {
  const out = [];
  for (const m of L) {
    const g = MSG_GROUPS.find(([re]) => re.test(m.title));
    const prev = out[out.length - 1];
    if (g && prev && prev._g === g[1] && prev.w === m.w && prev.season === m.season) {
      prev.body += '<br>' + m.body;
      prev.n = (prev.n || 1) + 1;
      prev.read = prev.read && m.read;
      prev._src.push(m);
      continue;
    }
    out.push(g ? { ...m, _g: g[1], _src: [m] } : m);
  }
  for (const m of out) if (m._src && m._src.length > 1) m.title = m._g;
  return out;
}

// Caractéristique qui compte le plus sur chaque type d'étape.
const TERRAIN_KEY = {
  plat: 'spr',
  vallonne: 'col',
  punch: 'col',
  montagne: 'mon',
  sommet: 'mon',
  paves: 'pav',
  clm: 'clm',
  clmeq: 'clm',
};
// Briefing : ce qui va décider l'étape (terrain du final, pavés, vent, météo) et les adversaires à surveiller,
// d'après le profil de l'étape et les valeurs que voit le directeur sportif (estimations pour les autres équipes).
function stageKeysHTML(rc, spec, Pf) {
  const L = [];
  const dist = spec.dist;
  const last = Pf.climbs[Pf.climbs.length - 1];
  const summit = last && last.end >= dist - 0.5;
  if (spec.type === 'clm' || spec.type === 'clmeq')
    L.push(`⏱ Contre-la-montre de ${dist} km : tout se joue sur le chrono et la gestion de l'effort`);
  else if (summit)
    L.push(`⛰ Arrivée au sommet : <b>${esc(last.name)}</b>, ${last.len} km à ${last.avg} % (cat. ${last.cat})`);
  else if (last && dist - last.end < 40)
    L.push(
      `⛰ Dernière difficulté : <b>${esc(last.name)}</b> (${last.len} km à ${last.avg} %), sommet à ${Math.round(dist - last.end)} km de l'arrivée`
    );
  else if (Pf.finishGrad >= 3) L.push(`↗️ Arrivée en côte (${Pf.finishGrad.toFixed(1)} %) : terrain de puncheurs`);
  else L.push('🏁 Arrivée plate : sprint massif probable si l’échappée est reprise');
  const big = Pf.climbs.filter(c => c.cat === 'HC' || c.cat === '1').length;
  if (big > 1)
    L.push(`📈 ${big} grands cols (HC ou 1re cat.) : journée d'usure, l'endurance et la récupération comptent`);
  if (Pf.sectors && Pf.sectors.length) {
    const inFinal = Pf.sectors.filter(s => s.start > dist * 0.55).length;
    L.push(
      `▦ ${Pf.sectors.length} secteurs pavés${inFinal ? `, dont ${inFinal} dans le final` : ''} : placement et crevaisons`
    );
  }
  if (spec.wind && spec.wind >= 6 && Pf.expoKm > 10)
    L.push(
      `🌬️ Vent ${Math.round(spec.wind)} m/s sur ${Math.round(Pf.expoKm)} km exposés : risque de bordures, il faut être devant`
    );
  if (spec.wx && spec.wx !== 'sec') L.push(`${WX[spec.wx]}`);
  // adversaires à surveiller
  const key = TERRAIN_KEY[spec.type] || 'pla';
  const rivals = S.teams
    .filter(T => !T.player)
    .flatMap(T => (rc.sel[T.id] || []).filter(id => !rc.out[id]))
    .map(id => S.riders[id]);
  let watch;
  if (rc.specs.length > 1 && rc.si > 0 && (key === 'mon' || key === 'clm')) {
    const g = gcList(rc)
      .filter(id => S.riders[id].team !== 0)
      .slice(0, 5);
    watch = g.map(
      id => `${esc(riderName(S.riders[id]))} (${tshort(S.riders[id])}, ${leaderGcRank(rc, id)}e au général)`
    );
  } else
    watch = rivals
      .sort((a, b) => shownStat(b, key) - shownStat(a, key))
      .slice(0, 5)
      .map(
        r =>
          `${esc(riderName(r))} (${tshort(r)}, ${STAT_LBL[key].toLowerCase()} ${isEst(r) ? '~' : ''}${shownStat(r, key)})`
      );
  return `<div class="card"><h3>Ce qui va décider l'étape</h3>${L.map(t => `<div class="dbl">${t}</div>`).join('')}<div class="small" style="margin-top:8px"><b>À surveiller :</b> ${watch.join(', ')}</div></div>`;
}
// Vivier et académie : badges d'aide au recrutement d'un jeune (d'après ce que voient les recruteurs).
function youthBadges(r) {
  const B = [];
  const p = potEst(r);
  if (p >= 82) B.push(['need', 'Gros potentiel']);
  const k = knowOf(r);
  // (au départ, tout le vivier est mal connu : on ne le signale que pour les jeunes prometteurs, à faire suivre)
  if (k < 40 && p >= 74) B.push(['warn', 'Prometteur mais mal connu : à suivre 👁']);
  else if (k >= 70) B.push(['good', 'Bien observé']);
  if (r.espPts >= 15) B.push(['info', 'En vue chez les espoirs']);
  return B;
}

// Licence WorldTour : statut, année du cycle, place au classement cumulé, écart avec la ligne de licence.
function wtBriefHTML() {
  if (!S.wt) return '';
  const rk = wtRanking();
  const k = rk.findIndex(e => e.T.player);
  const me = rk[k];
  const line = rk[WT_N - 1],
    out = rk[WT_N];
  const y = wtYear();
  const status = isWT(0) ? '🪪 Licence WorldTour' : '🪪 ProTeam';
  let t;
  if (k < WT_N)
    t = `${k + 1}e du classement sur trois saisons — ${out ? `${me.pts - out.pts} pts d'avance sur le ${WT_N + 1}e` : ''}`;
  else
    t = `${k + 1}e du classement sur trois saisons — il manque <b>${line.pts - me.pts} pts</b> pour la ${WT_N}e place`;
  const end =
    y >= WT_CYCLE
      ? 'attribution des licences à la fin de cette saison'
      : `attribution dans ${WT_CYCLE - y + 1} saisons`;
  let inv = '';
  if (!isWT(0)) {
    const o = wtInviteOdds();
    const pc = v => Math.round(clamp(v, 0, 1) * 100);
    inv = wtTopPro().includes(0)
      ? '<br>Parmi les deux meilleures ProTeams : invitée d’office partout la saison prochaine.'
      : `<br>Invitations (tirées au début de chaque saison) : Grand Tour ≈${pc(o.gt)} %, grande course ≈${pc(o.cat1)} % — elles montent avec la confiance du sponsor et la notoriété.`;
  }
  return `<div class="brief" style="margin-top:8px"><b>${status}</b> · cycle ${y}/${WT_CYCLE} (${end})<br>${t}.${inv}</div>`;
}
// Classement du cycle WorldTour (stats).
function wtTableHTML() {
  const rk = wtRanking();
  return `<div class="card"><h2>Licences WorldTour</h2>${wtBriefHTML()}<details class="info"><summary>ℹ️ Explications</summary><p class="small mut">Les ${WT_N} premières équipes au classement UCI cumulé sur trois saisons obtiennent une licence WorldTour pour le cycle suivant : invitations d'office aux Grands Tours et aux grandes classiques. Les autres sont ProTeams et dépendent des invitations, sauf les deux meilleures de la saison passée. Une relégation coûte cher : clause du sponsor (−12 % d'apport, confiance −15), moral de l'effectif en baisse, leaders ambitieux qui font jouer leur clause de sortie, et coureurs cotés plus difficiles à recruter. Une promotion rapporte +8 % d'apport.</p></details><table class="t"><tbody>${rk
    .map(
      (e, i) =>
        `${i === WT_N ? `<tr><td colspan="4" class="small mut" style="border-top:2px dashed var(--acc)">— ligne de licence —</td></tr>` : ''}<tr class="${e.T.player ? 'mrow' : ''}"><td>${i + 1}</td><td><b style="color:${e.T.color}">■</b> ${esc(e.T.name)}</td><td class="small">${isWT(e.T.id) ? 'WT' : 'Pro'}</td><td>${e.pts} pts</td></tr>`
    )
    .join('')}</tbody></table></div>`;
}
// Bilan « pourquoi » des saisons terminées (la plus récente ouverte, les autres repliées).
function seasonWhyHTML() {
  const W = S.seasonWhy || {};
  const ks = Object.keys(W)
    .map(Number)
    .sort((a, b) => b - a);
  if (!ks.length) return '';
  return `<div class="card"><h2>🔎 Pourquoi la saison ${ks[0]}</h2>${W[ks[0]].map(t => `<div class="dbl">${t}</div>`).join('')}${ks
    .slice(1, 5)
    .map(
      k =>
        `<details class="info"><summary>Saison ${k}</summary>${W[k].map(t => `<div class="dbl small">${t}</div>`).join('')}</details>`
    )
    .join('')}</div>`;
}
