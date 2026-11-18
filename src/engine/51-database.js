/* Base de données ouverte : export / import d'un fichier JSON lisible (équipes, coureurs avec leurs
   caractéristiques, noms des courses, parcours personnalisés) et import de parcours réels au format GPX.
   C'est le format à partager entre joueurs pour refaire un peloton (« bases » de la communauté). */

const DB_TYPE = 'directeur-sportif-base';
// Export complet : tout ce que contient le fichier de noms, plus les attributs des coureurs et les parcours.
function exportDb() {
  const N = exportNames();
  const byId = new Map(N.coureurs.map(c => [c.id, c]));
  return {
    type: DB_TYPE,
    v: 1,
    saison: S.season,
    courses: N.courses,
    equipes: N.equipes,
    coureurs: Object.values(S.riders)
      .filter(r => !r.retired && !r.youth)
      .map(r => ({
        ...(byId.get(r.id) || { id: r.id, prenom: r.fn, nom: r.ln }),
        nat: r.nat,
        age: r.age,
        profil: r.arch,
        poids: r.kgOpt != null ? r.kgOpt : r.kg,
        car: { ...r.s },
        discipline: r.dis,
        ambition: r.amb,
        caractere: r.trait,
        plafond: r.ceil,
      })),
    parcours: S.customProf || {},
  };
}
const dbInt = (v, a, b, def) => (Number.isFinite(+v) ? Math.round(clamp(+v, a, b)) : def);
// Applique les attributs d'un coureur du fichier (valeurs bornées, champs inconnus ignorés).
function dbApplyRider(r, c) {
  if (c.nat && NATS[c.nat]) r.nat = c.nat;
  if (c.age != null) r.age = dbInt(c.age, 16, 42, r.age);
  if (c.profil && ARCH[c.profil]) r.arch = c.profil;
  if (c.poids != null) r.kg = r.kgOpt = dbInt(c.poids, 48, 95, r.kg);
  if (c.car && typeof c.car === 'object')
    for (const k of STATS) if (c.car[k] != null) r.s[k] = dbInt(c.car[k], 30, 95, r.s[k]);
  if (c.discipline != null) r.dis = dbInt(c.discipline, 1, 99, r.dis);
  if (c.ambition != null) r.amb = dbInt(c.ambition, 1, 99, r.amb);
  if (c.caractere && TRAITS[c.caractere]) r.trait = c.caractere;
  r.ceil = Math.max(overall(r.s), c.plafond != null ? dbInt(c.plafond, 40, 92, r.ceil) : r.ceil || 0);
}
// Import : un fichier de noms ou une base complète. Les coureurs sont reconnus par leur numéro ; un coureur sans
// numéro connu est créé et rejoint les coureurs libres (pour ajouter des coureurs réels au peloton).
function importDb(o) {
  if (!o || (o.type !== DB_TYPE && o.type !== 'directeur-sportif-noms'))
    return { ok: false, txt: 'Ce fichier n’est ni une base ni un fichier de noms du jeu.' };
  const res = importNames({ ...o, type: 'directeur-sportif-noms' });
  if (o.type !== DB_TYPE) return res;
  let nu = 0,
    nn = 0;
  for (const c of o.coureurs || []) {
    let r = c.id != null ? S.riders[c.id] : null;
    const created = !r;
    if (!r) {
      if (!c.nom || !c.profil || !ARCH[c.profil]) continue;
      r = genRider(c.profil, 0, { nat: NATS[c.nat] ? c.nat : undefined, age: dbInt(c.age, 17, 40, 25) });
      r.fn = cleanName(c.prenom || '', 20) || r.fn;
      r.ln = cleanName(c.nom, 24) || r.ln;
      r.team = null;
      r.contract = 0;
      S.riders[r.id] = r;
      S.free.push(r.id);
      nn++;
    }
    const snap = r2 => JSON.stringify([r2.s, r2.age, r2.arch, r2.kg, r2.dis, r2.amb, r2.trait, r2.nat, r2.ceil]);
    const before = snap(r);
    dbApplyRider(r, c);
    if (snap(r) !== before && !created) nu++;
    if (r.team === null) r.salary = salaryFor(overall(r.s), r.age);
  }
  let np = 0;
  for (const k in o.parcours || {}) {
    const p = o.parcours[k];
    if (p && Array.isArray(p.segs) && p.segs.length && setCustomProfile(k, p)) np++;
  }
  return {
    ok: true,
    txt: `${res.txt} Base : ${nu} coureur(s) modifié(s), ${nn} ajouté(s) aux coureurs libres${np ? `, ${np} parcours` : ''}.`,
  };
}

// ---------- Parcours réels (GPX) ----------
// Lit une trace GPX : points (latitude, longitude, altitude) → distance et pentes par tronçons d'environ 500 m.
function parseGpx(txt) {
  const pts = [];
  const re = /<(?:trkpt|rtept)\b[^>]*?lat="([-0-9.]+)"[^>]*?lon="([-0-9.]+)"[^>]*?>([\s\S]*?)<\/(?:trkpt|rtept)>/g;
  const re2 = /<(?:trkpt|rtept)\b[^>]*?lon="([-0-9.]+)"[^>]*?lat="([-0-9.]+)"[^>]*?>([\s\S]*?)<\/(?:trkpt|rtept)>/g;
  let m;
  while ((m = re.exec(txt))) {
    const e = /<ele>([-0-9.]+)<\/ele>/.exec(m[3]);
    pts.push([+m[1], +m[2], e ? +e[1] : null]);
  }
  if (!pts.length)
    while ((m = re2.exec(txt))) {
      const e = /<ele>([-0-9.]+)<\/ele>/.exec(m[3]);
      pts.push([+m[2], +m[1], e ? +e[1] : null]);
    }
  if (pts.length < 2) return { err: 'Aucun point de trace trouvé dans ce fichier GPX.' };
  if (pts.some(p => p[2] == null))
    return { err: 'Cette trace n’a pas d’altitudes (balise <ele>) : impossible d’en tirer un profil.' };
  // distance cumulée (formule de haversine), en km
  const rad = Math.PI / 180;
  const D = [0];
  for (let i = 1; i < pts.length; i++) {
    const [la1, lo1] = pts[i - 1],
      [la2, lo2] = pts[i];
    const a =
      Math.sin(((la2 - la1) * rad) / 2) ** 2 +
      Math.cos(la1 * rad) * Math.cos(la2 * rad) * Math.sin(((lo2 - lo1) * rad) / 2) ** 2;
    D.push(D[i - 1] + 12742 * Math.asin(Math.min(1, Math.sqrt(a))));
  }
  const dist = D[D.length - 1];
  if (dist < 5 || dist > 320) return { err: `Distance de ${fmtDec(dist)} km : il faut entre 5 et 320 km.` };
  // altitude lissée tous les 500 m, puis pente de chaque tronçon (bornée à ±20 %)
  const eleAt = x => {
    let j = 1;
    while (j < D.length - 1 && D[j] < x) j++;
    const f = D[j] > D[j - 1] ? (x - D[j - 1]) / (D[j] - D[j - 1]) : 0;
    return pts[j - 1][2] + (pts[j][2] - pts[j - 1][2]) * clamp(f, 0, 1);
  };
  const L = 0.5;
  const segs = [];
  let gain = 0;
  for (let x = 0; x < dist - 1e-6; x += L) {
    const l = Math.min(L, dist - x);
    const dz = eleAt(x + l) - eleAt(x);
    if (dz > 0) gain += dz;
    segs.push([+l.toFixed(2), +clamp((dz / (l * 1000)) * 100, -20, 20).toFixed(1), 0, 0]);
  }
  const startAlt = Math.round(pts[0][2]);
  return { dist: +dist.toFixed(1), segs, gain: Math.round(gain), startAlt, type: profileType(segs, dist, gain) };
}
// Type d'étape déduit d'un profil : dénivelé au km, pente de l'arrivée et grandes montées.
function profileType(segs, dist, gain) {
  let fin = 0,
    nf = 0,
    acc = 0;
  for (let i = segs.length - 1; i >= 0 && acc < 3; i--) {
    fin += segs[i][1] * segs[i][0];
    nf += segs[i][0];
    acc += segs[i][0];
  }
  const finG = nf ? fin / nf : 0;
  // plus longue montée continue (pente ≥ 4 %)
  let best = 0,
    cur = 0;
  for (const s of segs) {
    cur = s[1] >= 4 ? cur + s[0] : 0;
    best = Math.max(best, cur);
  }
  const perKm = gain / dist;
  if (finG >= 5 && best >= 6) return 'sommet';
  if (finG >= 4) return 'punch';
  if (best >= 7 && perKm >= 18) return 'montagne';
  if (perKm >= 9) return 'vallonne';
  return 'plat';
}
// Parcours personnalisés : clé « course:étape » → { type, dist, segs, startAlt, nom }.
function setCustomProfile(k, p) {
  const [key, si] = String(k).split(':');
  const d = RACE_DEFS.find(x => x.key === key);
  const i = +si || 0;
  if (!d || !d.stages[i] || d.stages[i][2] === 'R' || ['clm', 'clmeq'].includes(String(d.stages[i][0]))) return false;
  const dist = clamp(+p.dist || sum(p.segs.map(s => +s[0] || 0)), 5, 320);
  S.customProf = S.customProf || {};
  S.customProf[`${key}:${i}`] = {
    type: TYPE_OK.includes(p.type) ? p.type : profileType(p.segs, dist, 0),
    dist: Math.round(dist),
    segs: p.segs.map(s => [
      clamp(+s[0] || 0.5, 0.05, 5),
      clamp(+s[1] || 0, -20, 20),
      clamp(+s[2] || 0, 0, 5),
      s[3] ? 1 : 0,
    ]),
    startAlt: clamp(+p.startAlt || 100, 0, 2500),
    nom: cleanName(p.nom || '', 40),
  };
  // la course à venir de cette saison prend le parcours tout de suite
  const c = S.cal.find(x => x.key === key && !x.done);
  if (c) c.stagesSpec = customStages(key, d.stages);
  return true;
}
const TYPE_OK = ['plat', 'vallonne', 'punch', 'montagne', 'sommet', 'paves'];
function clearCustomProfile(k) {
  if (!S.customProf || !S.customProf[k]) return;
  delete S.customProf[k];
  const key = k.split(':')[0];
  const d = RACE_DEFS.find(x => x.key === key);
  const c = S.cal.find(x => x.key === key && !x.done);
  if (c && d) c.stagesSpec = customStages(key, d.stages);
}
// Étapes d'une course avec ses parcours personnalisés (type et distance du parcours importé).
function customStages(key, stages) {
  const P = S && S.customProf;
  if (!P) return stages;
  return stages.map((st, i) => {
    const p = P[`${key}:${i}`];
    return p ? [p.type, p.dist, st[2] === 'monts' || st[2] === 'dur' ? null : st[2]] : st;
  });
}
// Profil personnalisé d'une étape (null s'il n'y en a pas).
function customProfileOf(key, i) {
  return (S && S.customProf && S.customProf[`${key}:${i}`]) || null;
}
