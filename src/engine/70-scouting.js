/* Réseau de recrutement (marché des professionnels). Vos recruteurs partent en mission : une zone (un groupe de
   pays ou le monde entier), un profil de coureur, une tranche d'âge et un salaire maximal. Une mission dure de trois
   à cinq semaines (moins avec un bon chef recruteur) et coûte des frais de déplacement. À la fin, un rapport écrit :
   les cinq coureurs qui correspondent le mieux, chacun avec une recommandation (« à signer », « à suivre »,
   « pas pour nous »), ses points forts et faibles, sa situation de contrat et ce que le recruteur a deviné de son
   caractère. Les coureurs du rapport sont mieux connus (estimations plus justes) et peuvent rejoindre la liste de
   suivi. Le nombre de missions simultanées dépend du niveau du chef recruteur.
   Aucun tirage au sort de la partie : tout vient d'empreintes (dsHash), la simulation n'est pas modifiée. */

const SCM_ZONES = {
  monde: { lbl: 'Monde entier', nats: null },
  ouest: { lbl: 'France, Belgique, Pays-Bas', nats: ['FRA', 'BEL', 'NED'] },
  sud: { lbl: 'Italie, Espagne, Slovénie', nats: ['ITA', 'ESP', 'SLO'] },
  nord: { lbl: 'Europe du Nord', nats: ['DEN', 'NOR', 'GBR', 'GER', 'POL'] },
  alpes: { lbl: 'Pays alpins', nats: ['SUI', 'ITA', 'FRA', 'SLO'] },
  loin: { lbl: 'Colombie et Australie', nats: ['COL', 'AUS'] },
};
const SCM_AGES = {
  tous: { lbl: 'Tous âges', a: 0, b: 99 },
  jeune: { lbl: '23 ans et moins', a: 0, b: 23 },
  mur: { lbl: '24 à 30 ans', a: 24, b: 30 },
  exp: { lbl: '31 ans et plus', a: 31, b: 99 },
};
const SCM_COST = 15; // frais de déplacement d'une mission (k€)
// Missions simultanées : 1 (recruteur niveau 1-2), 2 (3-4), 3 (5).
function scmMax() {
  return 1 + Math.floor(((S.staff && S.staff.scout) || 1) / 2.5);
}
function scmWeeks() {
  return clamp(6 - Math.ceil(((S.staff && S.staff.scout) || 1) / 2), 3, 5);
}
function scmInit() {
  S.scm = S.scm || { m: [], rep: [], n: 0 };
  return S.scm;
}
function scmLabel(m) {
  return [
    m.arch ? ARCH[m.arch].lbl : 'Tous profils',
    SCM_AGES[m.age].lbl.toLowerCase(),
    SCM_ZONES[m.zone].lbl,
    m.sal ? `≤ ${fmtMoney(m.sal)}/an` : 'sans limite de salaire',
  ].join(' · ');
}
// Lance une mission (zone, profil, âge, salaire maximal ; 0 = sans limite).
function scmStart(zone, arch, age, sal) {
  const C = scmInit();
  if (!SCM_ZONES[zone] || !SCM_AGES[age] || (arch && !ARCH[arch])) return 'Mission inconnue.';
  if (C.m.length >= scmMax())
    return `Vos recruteurs sont tous en mission (${scmMax()} au plus avec votre chef recruteur actuel).`;
  if (S.budget < SCM_COST) return `Budget insuffisant (${fmtMoney(SCM_COST)}).`;
  S.budget -= SCM_COST;
  finAdd('staff', -SCM_COST);
  const m = { id: ++C.n, zone, arch: arch || null, age, sal: +sal || 0, left: scmWeeks() };
  C.m.push(m);
  return `🔭 Mission lancée : ${scmLabel(m)}. Rapport dans ${scmWeeks()} semaines.`;
}
function scmCancel(id) {
  const C = scmInit();
  C.m = C.m.filter(m => m.id !== id);
  return 'Mission annulée (les frais sont perdus).';
}
// Coureurs qui correspondent à une mission (pros sous contrat ailleurs ou libres).
function scmPool(m) {
  const Z = SCM_ZONES[m.zone],
    A = SCM_AGES[m.age];
  return Object.values(S.riders).filter(
    r =>
      !r.retired &&
      !r.car &&
      !r.aca &&
      !r.youth &&
      r.team !== 0 &&
      r.nextTeam == null &&
      (r.team !== null || S.free.includes(r.id)) &&
      (!Z.nats || Z.nats.includes(r.nat)) &&
      (!m.arch || r.arch === m.arch) &&
      r.age >= A.a &&
      r.age <= A.b
  );
}
// Valeur d'un coureur pour l'équipe : son niveau et sa marge de progression, rapportés à son coût.
function scmValue(r) {
  const ov = overall(r.s);
  const up = Math.max(0, r.ceil - ov) * (r.age <= 23 ? 0.5 : r.age <= 26 ? 0.3 : 0.05);
  const dem = contractDemand(r);
  return ov + up - Math.max(0, dem - 60) / 40;
}
// Points forts et faibles (selon les valeurs affichées, donc l'estimation du recruteur).
function scmTraits(r) {
  const st = shownStats(r);
  const lbl = {
    pla: 'plat',
    mon: 'montagne',
    col: 'collines',
    spr: 'sprint',
    clm: 'chrono',
    pav: 'pavés',
    des: 'descente',
    plc: 'placement',
    end: 'endurance',
    rec: 'récupération',
    bar: 'baroud',
  };
  const ks = Object.keys(lbl).sort((a, b) => st[b] - st[a]);
  return { fort: ks.slice(0, 2).map(k => lbl[k]), faible: lbl[ks[ks.length - 1]] };
}
// Rapport de fin de mission.
function scmReport(m) {
  const C = scmInit();
  const sk = (S.staff && S.staff.scout) || 1;
  const pool = scmPool(m)
    .map(r => {
      // le recruteur juge avec son œil : une erreur qui dépend de son niveau (empreinte, pas de hasard)
      const err = (((dsHash('scm' + m.id + ':' + r.id) % 200) - 100) / 100) * (6 - sk) * 0.9;
      return [r, scmValue(r) + err];
    })
    .filter(([r]) => !m.sal || contractDemand(r) <= m.sal * 1.05)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const capK = 72 + sk * 4;
  const items = pool.map(([r, v], i) => {
    S.know[r.id] = Math.max(S.know[r.id] || 0, Math.min(capK, (S.know[r.id] || 20) + 40));
    const tr = scmTraits(r);
    const kind = marketKind(r);
    const dem = contractDemand(r);
    const myBar = P_bar();
    const ov = shownOv(r);
    const pot = potEst(r);
    let rec =
      ov >= myBar + 3 || (r.age <= 23 && pot >= myBar + 8 && ov >= myBar - 6)
        ? 'signer'
        : ov >= myBar - 2 || (r.age <= 24 && pot >= myBar + 3)
          ? 'suivre'
          : 'non';
    const cher = dem + (kind === 'transfer' ? transferFee(r) / 2 : 0) > Math.max(80, S.budget / 4);
    if (rec === 'signer' && cher) rec = 'suivre';
    return {
      id: r.id,
      rec,
      fort: tr.fort,
      faible: tr.faible,
      kind,
      dem: Math.round(dem / 5) * 5,
      fee: kind === 'transfer' ? transferFee(r) : 0,
      mental: mentalHint(r),
      cher,
      ov,
      pot,
      rank: i + 1,
    };
  });
  const rep = { id: m.id, s: S.season, w: S.week, lbl: scmLabel(m), items, read: false, n: scmPool(m).length };
  C.rep.unshift(rep);
  if (C.rep.length > 12) C.rep.length = 12;
  const best = items.filter(x => x.rec === 'signer').length;
  msg(
    '🔭 Rapport de recrutement',
    `${scmLabel(m)} : ${items.length ? `${items.length} coureurs retenus${best ? `, dont ${best} à signer` : ''}` : 'personne ne correspond'} (Marché › Recrutement).`
  );
  return rep;
}
// Note du 6e coureur de mon effectif : la barre à franchir pour renforcer l'équipe.
function P_bar() {
  const ovs = S.teams[0].riders.map(id => overall(S.riders[id].s)).sort((a, b) => b - a);
  return ovs[5] || ovs[ovs.length - 1] || 70;
}
function scmWeekly() {
  if (S.car || !S.scm) return;
  const C = S.scm;
  for (const m of C.m) m.left--;
  const done = C.m.filter(m => m.left <= 0);
  C.m = C.m.filter(m => m.left > 0);
  for (const m of done) scmReport(m);
}
function scmUnread() {
  return S.scm ? S.scm.rep.filter(r => !r.read).length : 0;
}
// Ajoute tous les coureurs « à signer » ou « à suivre » d'un rapport à la liste de suivi.
function scmWatchAll(repId) {
  const R0 = scmInit().rep.find(r => r.id === repId);
  if (!R0) return 'Rapport introuvable.';
  let n = 0;
  for (const x of R0.items)
    if (x.rec !== 'non' && !S.watch.includes(x.id) && S.watch.length < WATCH_MAX) {
      S.watch.push(x.id);
      n++;
    }
  return n
    ? `${n} coureur${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} à la liste de suivi.`
    : 'Rien à ajouter (déjà suivis, ou liste pleine).';
}
const WATCH_MAX = 20;
const SCM_REC = {
  signer: { lbl: 'À signer', c: 'emerald' },
  suivre: { lbl: 'À suivre', c: 'amber' },
  non: { lbl: 'Pas pour nous', c: 'slate' },
};
