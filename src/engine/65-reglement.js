/* Règlement : calendrier des transferts et antidopage (côté règlement seulement : aucune triche possible).
   - Transferts : un coureur en fin de contrat ne peut signer pour la saison suivante qu'à partir du 1er août
     (semaine 31), pour vous comme pour les équipes de l'ordinateur. Un néo-professionnel (premier contrat pro)
     signe pour deux ans au moins. Salaire minimum : 30 k€ en WorldTour, 25 k€ en ProTeam (15 % de moins pour un
     néo-pro), revu par les réformes de l'UCI (66-monde.js).
   - Antidopage : chaque coureur doit déclarer sa localisation ; un contrôle manqué arrive de temps en temps (plus
     souvent chez les coureurs peu disciplinés), trois en douze mois valent six mois de suspension. Rarement, une
     contamination (complément ou viande contaminés) donne un contrôle positif à l'état de traces : suspension
     provisoire, puis relaxe ou trois mois de suspension. Une cellule antidopage (responsable de la localisation,
     défense) réduit nettement ces risques. Rien ici ne tire au hasard du jeu (empreintes). */

// --- Transferts ---
const MERC_OPEN = 31;
function mercOpen() {
  return S.week >= MERC_OPEN;
}
function minSalary(teamId) {
  const k = (S.world && S.world.minSal) || 1;
  return Math.round(((typeof isWT === 'function' && isWT(teamId) ? 30 : 25) * k) / 5) * 5;
}
function neoPro(r) {
  return !!(r && (r.youth || r.aca || (r.age <= 23 && !(r.stats && r.stats.days))));
}
function neoMinSalary(teamId) {
  return Math.round((minSalary(teamId) * 0.85) / 5) * 5;
}
// Règle du contrat proposé par votre équipe : message si elle n'est pas respectée.
function contractRule(r, salary, years, kind) {
  if (kind === 'pre' && !mercOpen())
    return `Règlement UCI : les contrats pour la saison prochaine se signent à partir du 1er août (semaine ${MERC_OPEN}).`;
  if (neoPro(r) && years < 2) return 'Règlement UCI : un néo-professionnel signe pour deux ans au moins.';
  const m = neoPro(r) ? neoMinSalary(0) : minSalary(0);
  if (salary < m) return `Règlement UCI : salaire minimum de ${fmtMoney(m)} par an.`;
  return null;
}

// --- Antidopage ---
const WH_COST = 30; // cellule antidopage, par saison
const DOPE = { miss: 8, contam: 2 }; // pour 10 000 : contrôle manqué par semaine ; contamination par semaine
function whMul(r) {
  const d = r.dis == null ? 60 : r.dis;
  const k = d >= 75 ? 0.6 : d < 45 ? 1.8 : 1;
  return k * (r.team === 0 && S.whOff ? 0.3 : 1);
}
function whMisses(r) {
  const now = S.season * 52 + S.week;
  return (r.wh || []).filter(e => now - (e.s * 52 + e.w) < 52);
}
function dopeSuspend(r, weeks, why) {
  r.injury = Math.max(r.injury, weeks);
  r.inj = { k: 'suspension', w0: weeks, s: S.season, wk: S.week, why };
  (r.dopeHist = r.dopeHist || []).unshift({ s: S.season, w: S.week, weeks, why });
  const T = teamOf(r);
  press(
    `${riderName(r)} suspendu ${weeks >= 20 ? 'six mois' : weeks >= 12 ? 'trois mois' : 'à titre provisoire'}`,
    `${riderName(r)}${T ? ` (${T.name})` : ''} est suspendu : ${why}.`,
    T && T.player ? -1.5 : 0,
    [r.id]
  );
  if (r.team === 0) {
    S.conf = clamp(S.conf - 3, 0, 100);
    msg('⛔ Suspension', `${riderName(r)} est suspendu ${weeks} semaines (${why}). Le sponsor n'apprécie pas.`);
  }
}
// Chaque semaine : contrôles inopinés (sans conséquence), contrôles manqués, contaminations et leur issue.
function dopeWeekly() {
  if (S.car) return;
  if (S.whOff) {
    S.budget -= WH_COST / 52;
    finAdd('staff', -WH_COST / 52);
  }
  S.dopeTests = S.dopeTests && S.dopeTests.s === S.season ? S.dopeTests : { s: S.season, n: 0 };
  for (const T of S.teams)
    for (const id of T.riders) {
      const r = S.riders[id];
      if (!r || r.aca || r.retired) continue;
      // suspension provisoire qui arrive à son terme : relaxe ou sanction
      if (r.inj && r.inj.k === 'suspension' && r.inj.prov && r.injury <= 1) {
        const h = dsHash('verdict' + r.id + S.season + ':' + S.week) % 100;
        r.inj.prov = false;
        if (h < (r.team === 0 && S.whOff ? 15 : 30)) {
          r.injury = 9;
          r.inj.w0 = 13;
          r.inj.why = 'contamination reconnue, faute légère';
          if (r.team === 0) msg('⛔ Verdict', `${riderName(r)} : contamination reconnue, faute légère. Trois mois de suspension au total.`);
        } else if (r.team === 0) msg('✅ Relaxé', `${riderName(r)} est relaxé : la contamination est prouvée. Il peut reprendre.`);
        continue;
      }
      if (r.injury > 0) continue;
      const h = dsHash('dope' + r.id + S.season + ':' + S.week) % 10000;
      if (T.player && h % 13 === 0) S.dopeTests.n++; // contrôle inopiné (négatif)
      if (h < DOPE.miss * whMul(r)) {
        (r.wh = r.wh || []).push({ s: S.season, w: S.week });
        const n = whMisses(r).length;
        if (T.player)
          msg(
            n >= 2 ? '⚠️ Contrôle manqué' : 'Contrôle manqué',
            `${riderName(r)} n'était pas à l'adresse déclarée : ${n} manquement${n > 1 ? 's' : ''} en douze mois${n === 2 ? '. Au troisième, il sera suspendu.' : '.'}${S.whOff ? '' : ' Une cellule antidopage (Effectif › Préparation) réduit ce risque.'}`
          );
        if (n >= 3) {
          r.wh = [];
          dopeSuspend(r, 26, 'trois manquements à la localisation en douze mois');
        }
      } else if (h >= 10000 - DOPE.contam * (T.player && S.whOff ? 0.5 : 1)) {
        dopeSuspend(r, 4, 'contrôle positif à l’état de traces, contamination probable ; suspension provisoire');
        r.inj.prov = true;
      }
    }
}
function setWhOfficer(on) {
  S.whOff = !!on;
  return on
    ? `Cellule antidopage créée (${fmtMoney(WH_COST)} par saison) : localisation suivie au jour le jour, défense en cas de contamination.`
    : 'Cellule antidopage supprimée.';
}
// État du suivi antidopage de votre effectif (pour l'interface).
function dopeState() {
  const rs = S.teams[0].riders.map(id => S.riders[id]).filter(Boolean);
  return {
    tests: S.dopeTests && S.dopeTests.s === S.season ? S.dopeTests.n : 0,
    watch: rs.filter(r => whMisses(r).length).map(r => ({ r, n: whMisses(r).length })).sort((a, b) => b.n - a.n),
    susp: rs.filter(r => r.injury > 0 && r.inj && r.inj.k === 'suspension'),
  };
}
