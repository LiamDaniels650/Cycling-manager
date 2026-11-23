/* Préparation physique en profondeur.
   - Périodisation : un plan de saison par coureur, construit vers ses courses objectifs (foncier, intensité,
     affûtage, récupération). Chaque semaine, le plan fixe son entraînement. Un affûtage préparé par de vraies
     semaines de foncier puis d'intensité donne un pic plus haut (surcompensation).
   - Tests en laboratoire : seuil, VO2max estimé et profil de puissance (5 s, 1 min, 5 min, 20 min), suivis dans le
     temps.
   - Santé : blessures et maladies typées (fracture, plaies et contusions, tendinite, virus, covid), médecin-chef
     spécialisé, reprise anticipée avec risque de rechute ; petits pépins de la saison (maladies d'hiver, tendinites
     de surcharge) pour tous les coureurs.
   - Déplacements : enchaîner des courses éloignées en peu de temps fatigue ; chambre chaude pour s'acclimater à la
     chaleur (l'altitude existe déjà avec le stage en altitude). */

// --- Périodisation ---
const PERI = {
  foncier: { lbl: 'Foncier', plan: 'foncier', col: '#0ea5e9' },
  intensite: { lbl: 'Intensité', plan: 'intensif', col: '#f97316' },
  affutage: { lbl: 'Affûtage', plan: 'pic', col: '#ef4444' },
  recup: { lbl: 'Récupération', plan: 'repos', col: '#22c55e' },
};
function periOf(r) {
  return r.peri && r.peri.s === S.season ? r.peri : null;
}
// Plan vers une course : foncier (jusqu'à six semaines), intensité (quatre), affûtage (deux), récupération après.
function periBuild(id, key) {
  const r = S.riders[id];
  const c = S.cal.find(c => c.key === key);
  if (!r || r.team !== 0 || !c) return 'Plan impossible.';
  if (c.done || c.w <= S.week) return `${c.name} est déjà passée ou commence cette semaine.`;
  const P = periOf(r) || (r.peri = { s: S.season, blocks: [], targets: [] });
  const W = c.w;
  const len = Math.ceil(c.stagesSpec.length / 7);
  const add = (w0, w1, k) => {
    w0 = Math.max(w0, S.week);
    if (w1 < w0) return;
    // une course plus récente dans le plan écrase les semaines qui se chevauchent
    P.blocks = P.blocks
      .flatMap(b =>
        b.w1 < w0 || b.w0 > w1
          ? [b]
          : [b.w0 < w0 ? { ...b, w1: w0 - 1 } : null, b.w1 > w1 ? { ...b, w0: w1 + 1 } : null].filter(Boolean)
      )
      .concat([{ w0, w1, k, t: key }])
      .sort((a, b) => a.w0 - b.w0);
  };
  add(W - 12, W - 7, 'foncier');
  add(W - 6, W - 3, 'intensite');
  add(W - 2, W - 1, 'affutage');
  add(W + len, W + len, 'recup');
  if (!P.targets.includes(key)) P.targets.push(key);
  return `📅 Plan de ${riderName(r)} construit vers ${c.name} (semaine ${W}).`;
}
function periClear(id) {
  const r = S.riders[id];
  if (r) r.peri = null;
  return `Plan de ${riderName(r)} effacé : entraînement libre.`;
}
// Plan automatique pour tous : vers l'objectif de saison, la course promise, ou la prochaine grande course du profil.
function periAutoAll() {
  let n = 0;
  for (const id of S.teams[0].riders) {
    const r = S.riders[id];
    if (r.aca || periOf(r)) continue;
    const prom = (S.proms || []).find(p => p.id === id && p.s === S.season && !p.done);
    const key = (prom && prom.key) || (r.goal && r.goal.s === S.season && r.goal.race) || null;
    const c = key && S.cal.find(c => c.key === key);
    if (c && !c.done && c.w > S.week + 2) {
      periBuild(id, key);
      n++;
    }
  }
  return n ? `📅 ${n} plan${n > 1 ? 's' : ''} de saison construit${n > 1 ? 's' : ''} vers les objectifs des coureurs.` : 'Aucun coureur sans plan avec un objectif à venir.';
}
function periBlockNow(r, w = S.week) {
  const P = periOf(r);
  return P ? P.blocks.find(b => b.w0 <= w && b.w1 >= w) : null;
}
// Chaque semaine (avant l'entraînement) : le plan fixe l'entraînement et la date du pic.
function periApply(r) {
  const b = periBlockNow(r);
  if (!b || r.injury > 0) return;
  r.training = PERI[b.k].plan;
  if (b.k === 'affutage') {
    const c = S.cal.find(c => c.key === b.t);
    if (c) r.peakW = c.w;
  }
}
// Ce que le coureur a vraiment fait (semaines de foncier et d'intensité), pour la surcompensation.
function periLog(r, pl) {
  if (pl !== 'foncier' && pl !== 'intensif') return;
  const L = (r.trn = r.trn && r.trn.s === S.season ? r.trn : { s: S.season, f: [], i: [] });
  (pl === 'foncier' ? L.f : L.i).push(S.week);
}
// Bonus de forme visée pendant l'affûtage : jusqu'à +3 pour le foncier (semaines W-12 à W-5), +2 pour l'intensité
// (W-7 à W-2).
function periBonus(r, pl) {
  if (pl !== 'pic' || !r.peakW || !r.trn || r.trn.s !== S.season) return 0;
  const W = r.peakW;
  const f = r.trn.f.filter(w => w >= W - 12 && w <= W - 5).length;
  const i = r.trn.i.filter(w => w >= W - 7 && w <= W - 2).length;
  return Math.min(3, f * 0.5) + Math.min(2, i * 0.5);
}

// --- Tests en laboratoire ---
const LAB_COST = 8,
  LAB_EVERY = 6;
function labReady(r) {
  return !r.labW || S.season * 100 + S.week - r.labW >= LAB_EVERY;
}
function labMeasure(r) {
  const kg = r.kg || 68;
  const cp = riderCP(r);
  const W = wPrime(r) * 1000;
  const nz = k => 1 + (((dsHash('lab' + r.id + k + S.season + ':' + S.week) % 41) - 20) / 1000); // ±2 %
  const p20 = Math.round((cp + W / 1200) * nz('20'));
  const p5 = Math.round((cp + W / 300) * nz('5'));
  const p1 = Math.round((cp + W / 60) * nz('1'));
  const p5s = Math.round((13 + (r.s.spr - 60) * 0.25) * kg * nz('s'));
  return {
    s: S.season,
    w: S.week,
    kg: +kg.toFixed(1),
    ftp: Math.round(p20 * 0.95),
    vo2: +((10.8 * p5) / kg + 7).toFixed(1),
    p5s,
    p1,
    p5,
    p20,
  };
}
function labTest(id) {
  const r = S.riders[id];
  if (!r || r.team !== 0) return 'Seuls vos coureurs passent au laboratoire.';
  if (r.injury > 0) return `${riderName(r)} est indisponible.`;
  if (!labReady(r)) return `Dernier test trop récent : un test toutes les ${LAB_EVERY} semaines.`;
  if (S.budget < LAB_COST) return `Budget insuffisant (${fmtMoney(LAB_COST)}).`;
  S.budget -= LAB_COST;
  finAdd('other', -LAB_COST);
  const m = labMeasure(r);
  const prev = (r.lab || [])[0];
  (r.lab = r.lab || []).unshift(m);
  if (r.lab.length > 10) r.lab.length = 10;
  r.labW = S.season * 100 + S.week;
  const d = prev ? ` (${m.ftp - prev.ftp >= 0 ? '+' : ''}${m.ftp - prev.ftp} W depuis le dernier test)` : '';
  return `🔬 ${riderName(r)} : seuil ${m.ftp} W (${fmtDec(m.ftp / m.kg, 2)} W/kg)${d}, VO2max ≈ ${fmtDec(m.vo2, 1)}, 5 s ${m.p5s} W, 1 min ${m.p1} W, 5 min ${m.p5} W, 20 min ${m.p20} W.`;
}

// --- Santé ---
const INJ = {
  fracture: { lbl: 'Fracture (clavicule, poignet…)', ic: '🦴', spec: 'traumato', relapse: 0.1 },
  plaies: { lbl: 'Plaies et contusions', ic: '🩹', spec: 'traumato', relapse: 0.05 },
  tendinite: { lbl: 'Tendinite', ic: '🦵', spec: 'kine', relapse: 0.3 },
  virus: { lbl: 'Virus, gastro', ic: '🤒', spec: 'generaliste', relapse: 0.15 },
  covid: { lbl: 'Covid', ic: '🦠', spec: 'generaliste', relapse: 0.1 },
  suspension: { lbl: 'Suspendu (antidopage)', ic: '⛔', spec: 'aucune', relapse: 0 },
};
const DOC_SPEC = {
  traumato: 'traumatologue (fractures, chutes)',
  generaliste: 'généraliste (maladies, virus)',
  kine: 'kinésithérapeute du sport (tendinites, récupération)',
};
function doctorCandidates() {
  const ks = Object.keys(DOC_SPEC);
  const N = NATS.FRA;
  const out = [];
  for (let i = 0; i < 3; i++) {
    const h = dsHash('doc' + S.season + i);
    out.push({ k: ks[(h + i) % ks.length], fn: N.fn[(h >>> 3) % N.fn.length], ln: N.ln[(h >>> 9) % N.ln.length], fee: 30 + ((h >>> 5) % 4) * 10 });
  }
  return out;
}
function hireDoctor(i) {
  const c = doctorCandidates()[i];
  if (!c) return 'Candidat inconnu.';
  if (S.budget < c.fee) return `Budget insuffisant (${fmtMoney(c.fee)}).`;
  S.budget -= c.fee;
  finAdd('other', -c.fee);
  S.doc = { k: c.k, n: `${c.fn} ${c.ln}`, s: S.season };
  return `🩺 ${c.fn} ${c.ln} devient votre médecin-chef, ${DOC_SPEC[c.k]}.`;
}
// Durée d'indisponibilité selon la spécialité du médecin-chef (mon équipe).
function injDurMul(r, k) {
  return (r.team === 0 && S.doc && INJ[k] && S.doc.k === INJ[k].spec ? 0.75 : 1) * (r.team === 0 ? facInjMul() : 1);
}
// Blessure ou maladie typée (les durées viennent des règles existantes, ajustées par le médecin).
function injSet(r, k, weeks) {
  const w = Math.max(1, Math.round(weeks * injDurMul(r, k)));
  if (r.injury >= w && r.inj && r.inj.k) return;
  r.injury = Math.max(r.injury, w);
  r.inj = { k, w0: r.injury, s: S.season, wk: S.week };
  newsInjury(r, w); // fil d'actualité (74-news.js)
}
// Type d'une blessure de chute selon sa durée.
function crashInjKind(weeks) {
  return weeks >= 4 ? 'fracture' : 'plaies';
}
// Reprise anticipée : 40 % de temps d'arrêt en moins, mais un risque de rechute au retour.
function earlyReturn(id) {
  const r = S.riders[id];
  if (!r || r.team !== 0 || r.injury < 2 || !r.inj || r.inj.k === 'suspension') return 'Pas de reprise anticipée possible.';
  if (r.inj.early) return 'Reprise déjà avancée.';
  r.injury = Math.max(1, Math.ceil(r.injury * 0.6));
  r.inj.early = true;
  const k = INJ[r.inj.k] || INJ.plaies;
  const p = Math.round(relapseP(r) * 100);
  return `⏩ ${riderName(r)} reprendra dans ${r.injury} semaine${r.injury > 1 ? 's' : ''} (${k.lbl.toLowerCase()}) : risque de rechute ≈ ${p} %.`;
}
function relapseP(r) {
  const k = INJ[(r.inj && r.inj.k) || 'plaies'] || INJ.plaies;
  const base = k.relapse + (r.inj && r.inj.early ? 0.18 : 0);
  return base * (S.doc && S.doc.k === 'kine' && r.team === 0 ? 0.5 : 1);
}
// Chaque semaine : guérisons (et rechutes), petits pépins de la saison. Sans tirage aléatoire du jeu (empreintes).
function healthWeekly(r, mine) {
  if (r.inj && r.injury <= 0) {
    if (r.inj.early && !r.inj.tested) {
      r.inj.tested = true;
      if ((dsHash('rech' + r.id + S.season + ':' + S.week) % 1000) / 1000 < relapseP(r)) {
        const w = Math.max(1, Math.round(r.inj.w0 * 0.5));
        r.injury = w;
        r.forme = Math.max(30, r.forme - 5);
        r.inj = { k: r.inj.k, w0: w, s: S.season, wk: S.week, relapse: true };
        if (mine) msg('🚑 Rechute', `${riderName(r)} a repris trop tôt : rechute, encore ${w} semaine${w > 1 ? 's' : ''} d'arrêt.`);
        return;
      }
    }
    (r.injHist = r.injHist || []).unshift({ k: r.inj.k, s: r.inj.s, wk: r.inj.wk, w: r.inj.w0, relapse: !!r.inj.relapse });
    if (r.injHist.length > 8) r.injHist.length = 8;
    if (mine) msg('✅ Retour', `${riderName(r)} est de nouveau disponible (${(INJ[r.inj.k] || INJ.plaies).lbl.toLowerCase()}).`);
    r.inj = null;
    return;
  }
  if (r.injury > 0 || r.aca || r.youth) return;
  const h = dsHash('sante' + r.id + S.season + ':' + S.week) % 10000;
  const winter = S.week <= 10 || S.week >= 38;
  // maladie : ≈ 0,5 % par semaine (0,8 % l'hiver), moins avec un généraliste
  const pIll = (winter ? 80 : 50) * (mine && S.doc && S.doc.k === 'generaliste' ? 0.7 : 1);
  // tendinite de surcharge : seulement en période de grosse charge
  const pTen = (r.load || 0) > 4.5 ? 40 * (mine && S.doc && S.doc.k === 'kine' ? 0.6 : 1) : 0;
  if (h < pIll) {
    const k = h % 5 === 0 ? 'covid' : 'virus';
    injSet(r, k, k === 'covid' ? 2 : 1);
    r.forme = Math.max(30, r.forme - 6);
    if (mine) msg(`${INJ[k].ic} ${riderName(r)} malade`, `${riderName(r)} : ${INJ[k].lbl.toLowerCase()}, ${r.injury} semaine${r.injury > 1 ? 's' : ''} d'arrêt.`);
  } else if (h < pIll + pTen) {
    injSet(r, 'tendinite', 2 + (h % 3));
    if (mine) msg('🦵 Tendinite', `${riderName(r)} souffre d'une tendinite (charge trop lourde) : ${r.injury} semaines d'arrêt.`);
  }
}

// --- Déplacements et acclimatation ---
const RACE_REG = {
  gpo: 'FRA', omloop: 'NORD', cote: 'IBE', soleil: 'FRA', mers: 'ITA', msr: 'ITA', flandres: 'NORD', pav: 'NORD',
  basque: 'IBE', amstel: 'NORD', col: 'NORD', liege: 'NORD', giro: 'ITA', alpes: 'ALP', cantons: 'ALP', gb: 'FRA',
  clasica: 'IBE', fin: 'ITA', vuelta: 'IBE', chr: 'FRA', auto: 'ITA', gpf: 'FRA', levant: 'LEV', briques: 'NORD',
  blancs: 'ITA', catalan: 'IBE', digues: 'NORD', harel: 'NORD', romand: 'ALP', polders: 'NORD', occit: 'FRA',
  basquec: 'IBE', cyclass: 'NORD', lacs: 'ALP', feuilles: 'FRA',
};
const REG_LBL = { FRA: 'France', NORD: 'Nord (Belgique, Pays-Bas)', ITA: 'Italie', IBE: 'Espagne, Portugal', ALP: 'Suisse, Alpes', LEV: 'Levant' };
function regDist(a, b) {
  if (!a || !b || a === b) return 0;
  if (a === 'LEV' || b === 'LEV') return 3;
  const far = ['NORD-ITA', 'NORD-IBE', 'ITA-IBE', 'ALP-IBE'];
  return far.includes(a + '-' + b) || far.includes(b + '-' + a) ? 2 : 1;
}
// Au départ d'une course : les coureurs qui arrivent d'une course lointaine la semaine d'avant sont plus fatigués.
function travelStart(rc) {
  const cal = S.cal[rc.calIdx];
  const reg = RACE_REG[cal.key];
  if (!reg || cal.worlds) return;
  let n = 0,
    tot = 0;
  for (const T of S.teams)
    for (const id of rc.sel[T.id] || []) {
      const r = S.riders[id];
      const last = r.lastReg;
      if (last && last.s === S.season) {
        const dw = cal.w - last.w;
        const d = regDist(last.reg, reg);
        if (d && dw <= 2) {
          const f = d * (dw <= 1 ? 3 : 1.5);
          r.fatigue = Math.min(100, r.fatigue + f);
          if (T.player) {
            n++;
            tot += f;
          }
        }
      }
      r.lastReg = { s: S.season, w: cal.w + Math.max(0, Math.ceil(cal.stagesSpec.length / 7) - 1), reg };
    }
  if (n) rc.travel = { n, f: Math.round(tot / n), reg };
}
// Chambre chaude : trois semaines d'acclimatation, la chaleur use moitié moins.
function heatAccWeekly(r, pl) {
  if (pl === 'chaleur' && r.team === 0) {
    r.heatAcc = 3;
    S.budget -= 5;
    finAdd('other', -5);
  } else if (r.heatAcc > 0) r.heatAcc--;
}
