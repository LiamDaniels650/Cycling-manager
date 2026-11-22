/* Matériel : équipementiers (vélos, matériel de chrono), contrats, effets en course */

// Vélos de route : aéro (vitesse sur le plat), légèreté (montées), confort (pavés), robustesse (crevaisons).
// minRep : notoriété minimale pour que la marque vous fasse une offre ; pay : versement de base (k€/saison).
const EQ_BIKES = [
  { id: 'equilibre', name: 'Équilibre', aero: 0.75, leger: 0.75, confort: 0.65, robuste: 0.85, minRep: 62, pay: 24 },
  { id: 'aerion', name: 'Aerion', aero: 0.95, leger: 0.55, confort: 0.35, robuste: 0.8, minRep: 52, pay: 36 },
  { id: 'monteluce', name: 'Monteluce', aero: 0.5, leger: 0.95, confort: 0.4, robuste: 0.75, minRep: 45, pay: 48 },
  { id: 'kassei', name: 'Kassei', aero: 0.55, leger: 0.45, confort: 0.95, robuste: 0.9, minRep: 35, pay: 66 },
  { id: 'nordik', name: 'Nordik', aero: 0.45, leger: 0.4, confort: 0.7, robuste: 0.8, minRep: 15, pay: 90 },
  { id: 'rapido', name: 'Rapido', aero: 0.55, leger: 0.35, confort: 0.35, robuste: 0.55, minRep: 0, pay: 120 },
  { id: 'torrent', name: 'Torrent', aero: 0.3, leger: 0.55, confort: 0.45, robuste: 0.6, minRep: 0, pay: 132 },
];
// Matériel de contre-la-montre (vélo, roues pleines, combinaison).
const EQ_TT = [
  { id: 'aerion-tt', name: 'Aerion Chrono', aero: 1.0, minRep: 50, pay: 12 },
  { id: 'chronos', name: 'Chronos', aero: 0.8, minRep: 30, pay: 30 },
  { id: 'ventura', name: 'Ventura', aero: 0.6, minRep: 10, pay: 48 },
  { id: 'rapido-tt', name: 'Rapido Chrono', aero: 0.35, minRep: 0, pay: 66 },
];
const EQ_CATS = { bike: { lbl: 'Vélos de route', list: EQ_BIKES }, tt: { lbl: 'Matériel de chrono', list: EQ_TT } };
const EQ_OFFER_WEEK = 26;

// Marque d'équipement par identifiant (la moins bonne par défaut).
function eqBrand(cat, id) {
  return EQ_CATS[cat].list.find(b => b.id === id) || EQ_CATS[cat].list[EQ_CATS[cat].list.length - 1];
}
// Note de qualité d'une marque (0-1), utilisée pour l'attribution du matériel aux équipes IA.
function eqQuality(cat, b) {
  if (cat === 'bike') return (b.aero + b.leger + b.confort + b.robuste) / 4;
  if (cat === 'tt') return b.aero;
  const ks = EQ_CATS[cat].keys;
  return sum(ks.map(k => b[k])) / ks.length;
}
// Matériel d'une équipe IA selon son niveau : les meilleures équipes ont le meilleur matériel.
function aiEquip(T) {
  const pickFor = cat => {
    const list = EQ_CATS[cat].list.slice().sort((a, b) => eqQuality(cat, b) - eqQuality(cat, a));
    const k = clamp(Math.round(((4.5 - T.tier) / 9) * (list.length - 1) + gauss() * 1.2), 0, list.length - 1);
    return list[k].id;
  };
  T.eq = {};
  for (const cat of Object.keys(EQ_CATS)) T.eq[cat] = pickFor(cat);
}
// Matériel initial des équipes et contrats du joueur.
function initEquipment() {
  for (const T of S.teams) {
    if (T.player) T.eq = T.eq || { bike: 'nordik', tt: 'ventura' };
    else if (!T.eq) aiEquip(T);
  }
  S.eqDeal = S.eqDeal || { bike: { pay: 90, years: 1 }, tt: { pay: 48, years: 1 } };
  S.eqOffers = S.eqOffers || null;
  S.eqChoice = S.eqChoice || {};
  eqEnsure(); // roues, pneus, nutrition (58-equipment-plus.js)
}
// Prototypes : matériel de développement fourni au joueur (plus aéro et plus léger, un peu plus fragile).
function protoBrand(cat, b) {
  if (cat !== 'bike' && cat !== 'tt') return b;
  if (cat === 'tt') return { ...b, aero: Math.min(1, b.aero + 0.08) };
  return {
    ...b,
    aero: Math.min(1, b.aero + 0.08),
    leger: Math.min(1, b.leger + 0.08),
    robuste: Math.max(0, b.robuste - 0.06),
  };
}
// Marque effectivement utilisée par une équipe (prototypes compris pour le joueur).
function eqUsed(T, cat) {
  const b = eqBrand(cat, T.eq && T.eq[cat]);
  return T.player && S.eqDeal && S.eqDeal[cat] && S.eqDeal[cat].proto ? protoBrand(cat, b) : b;
}
// Multiplicateurs de course d'un coureur selon le matériel de son équipe.
function eqFactors(T) {
  const b = eqUsed(T, 'bike');
  const t = eqUsed(T, 'tt');
  // roues, pneus, nutrition (58-equipment-plus.js) ; adaptation à un nouveau vélo (joueur)
  const w = eqUsed(T, 'roues'),
    p = eqUsed(T, 'pneus'),
    n = eqUsed(T, 'nutri');
  const ad = T.player ? eqAdaptMul() : 1;
  return {
    flat: (1 + 0.012 * (b.aero - 0.5) + 0.006 * (w.aero - 0.5) + 0.004 * (p.rend - 0.5)) * ad,
    climb: (1 + 0.012 * (b.leger - 0.5) + 0.006 * (w.leger - 0.5)) * ad,
    pav: 1 + 0.02 * (b.confort - 0.5),
    punct: (1.5 - b.robuste) * (1.3 - 0.6 * p.robuste),
    pavPunct: (1.4 - 0.8 * b.confort) * (1.3 - 0.6 * p.robuste),
    tt: (1 + 0.025 * (t.aero - 0.5) + 0.006 * (w.aero - 0.5) + 0.004 * (p.rend - 0.5)) * ad,
    sprint: (w.rigide - 0.5) * 1.2,
    wetK: 1.3 - 0.6 * p.grip,
    food: 1.12 - 0.24 * n.assim,
    steep: 1,
  };
}
// Multiplicateur de vitesse d'un groupe : moyenne du matériel de ses coureurs sur ce terrain.
function eqGroupMul(G, g, surf) {
  let s = 0;
  for (const x of G.riders) {
    const e = x.eqf;
    s += !e ? 1 : surf ? e.pav : g >= 7 ? e.climb * (e.steep || 1) : g >= 3 ? e.climb : g > -2 ? e.flat : 1;
  }
  return G.riders.length ? s / G.riders.length : 1;
}
// Offres des équipementiers pour la saison suivante (semaine 26), selon votre notoriété et votre rang.
function genEqOffers() {
  const rep = repOf();
  const rankF = 1.15 - (teamRank() - 1) * 0.03;
  S.eqOffers = {};
  for (const cat of Object.keys(EQ_CATS)) {
    if (S.eqDeal[cat].years > 1) continue;
    const ok = EQ_CATS[cat].list.filter(b => rep >= b.minRep - 6 + gauss() * 4);
    S.eqOffers[cat] = shuffle(ok)
      .slice(0, 3)
      .map(b => ({
        id: b.id,
        pay: Math.round((b.pay * (0.7 + rep / 100) * rankF + gauss() * 10) / 5) * 5,
        years: rint(1, 2),
      }))
      .sort((a, b) => eqQuality(cat, eqBrand(cat, b.id)) - eqQuality(cat, eqBrand(cat, a.id)));
  }
  if (Object.keys(S.eqOffers).length)
    msg('Équipementiers', 'Les équipementiers ont fait leurs offres pour la saison prochaine (onglet Gestion).');
}
// Le joueur retient une offre d'équipementier pour la saison suivante.
function chooseEq(cat, k) {
  if (!S.eqOffers || !S.eqOffers[cat] || !S.eqOffers[cat][k] || S.eqOffers[cat][k].gone) return 'Offre indisponible.';
  S.eqChoice[cat] = k;
  return `Accord de principe avec ${eqBrand(cat, S.eqOffers[cat][k].id).name} pour la saison prochaine.`;
}
// Négociation d'une offre (une seule tentative par offre) :
//  cash  : +15 % d'argent ; la marque peut refuser, voire retirer son offre si la notoriété est trop juste ;
//  proto : 20 % d'argent en moins contre des prototypes (exige la notoriété requise par la marque) ;
//  perf  : 25 % d'argent fixe en moins contre une prime par victoire (étapes comprises).
const EQ_NEGO = {
  cash: 'Demander plus (+15 %)',
  proto: 'Prototypes (−20 %)',
  perf: 'Prime à la victoire (−25 % fixe)',
};
function eqNegotiate(cat, k, mode) {
  const o = S.eqOffers && S.eqOffers[cat] && S.eqOffers[cat][k];
  if (!o || o.gone) return 'Offre indisponible.';
  if (o.neg) return 'Cette offre a déjà été négociée.';
  const b = eqBrand(cat, o.id),
    rep = repOf();
  o.neg = mode;
  if (mode === 'cash') {
    const p = clamp(0.35 + (rep - b.minRep) / 60, 0.1, 0.85);
    if (rnd() < p) {
      o.pay = Math.round((o.pay * 1.15) / 5) * 5;
      return `${b.name} accepte : ${fmtMoney(o.pay)}/saison.`;
    }
    if (rnd() < 0.4) {
      o.gone = true;
      if (S.eqChoice[cat] === k) delete S.eqChoice[cat];
      return `${b.name} n'apprécie pas et retire son offre.`;
    }
    return `${b.name} refuse de revoir son offre.`;
  }
  if (mode === 'proto') {
    if (rep < b.minRep)
      return `${b.name} réserve ses prototypes aux équipes plus en vue (notoriété ${b.minRep} requise).`;
    o.pay = Math.round((o.pay * 0.8) / 5) * 5;
    o.proto = true;
    return `${b.name} vous confiera ses prototypes (plus aéro et plus légers, un peu plus fragiles) : ${fmtMoney(o.pay)}/saison.`;
  }
  o.perf = Math.max(1, Math.round(o.pay * 0.06));
  o.pay = Math.round((o.pay * 0.75) / 5) * 5;
  return `${b.name} accepte : ${fmtMoney(o.pay)}/saison plus ${fmtMoney(o.perf)} par victoire.`;
}
// Offres encore valables d'une catégorie (avec leur indice d'origine).
function eqLiveOffers(cat) {
  return ((S.eqOffers && S.eqOffers[cat]) || []).map((o, k) => [o, k]).filter(([o]) => !o.gone);
}
// Fin de saison : les contrats arrivent à échéance, le choix du joueur s'applique (sinon la meilleure offre financière).
function eqEndSeason() {
  const last = S.teamHist && S.teamHist[S.teamHist.length - 1];
  const wins = last && last.s === S.season ? last.wins : 0;
  for (const cat of Object.keys(EQ_CATS)) {
    const d = S.eqDeal[cat];
    if (d.perf && wins) {
      const bonus = d.perf * wins;
      S.budget += bonus;
      finAdd('equip', bonus);
      msg(
        'Primes équipementier',
        `${eqBrand(cat, S.teams[0].eq[cat]).name} verse ${fmtMoney(bonus)} pour vos ${wins} victoire(s).`
      );
    }
    d.years--;
    if (d.years > 0) continue;
    const offs = ((S.eqOffers && S.eqOffers[cat]) || []).filter(o => !o.gone);
    let o = S.eqOffers && S.eqOffers[cat] && S.eqOffers[cat][S.eqChoice[cat]];
    if (o && o.gone) o = null;
    // contrat anticipé accepté en cours de saison (après une grande victoire)
    if (S.eqEarly && S.eqEarly.taken && S.eqEarly.cat === cat && S.eqEarly.s === S.season) o = S.eqEarly;
    if (!o && offs.length) o = offs.slice().sort((a, b) => b.pay - a.pay)[0];
    if (!o) o = { id: S.teams[0].eq[cat], pay: Math.round(d.pay * 0.8), years: 1 };
    const changed = o.id !== S.teams[0].eq[cat];
    eqChanged(cat, S.teams[0].eq[cat], o.id);
    S.teams[0].eq[cat] = o.id;
    S.eqDeal[cat] = { pay: o.pay, years: o.years, proto: !!o.proto, perf: o.perf || 0 };
    msg(
      'Équipementier',
      `${EQ_CATS[cat].lbl} : ${changed ? 'nouveau partenaire' : 'contrat renouvelé avec'} ${eqBrand(cat, o.id).name} (${fmtMoney(o.pay)}/saison, ${o.years} an(s)).`
    );
  }
  S.eqOffers = null;
  S.eqChoice = {};
  for (const T of S.teams) if (!T.player && rnd() < 0.3) aiEquip(T);
}
// Versement hebdomadaire des équipementiers.
function eqWeekly() {
  const v = sum(Object.values(S.eqDeal).map(d => d.pay)) / LAST_WEEK;
  S.budget += v;
  finAdd('equip', v);
  if (S.week === EQ_OFFER_WEEK) genEqOffers();
}
