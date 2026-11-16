/* Noms personnalisés : courses, équipes, coureurs. Un renommage s'applique partout, historique compris
   (palmarès, records, mercato), pour que les classements et les légendes restent cohérents. Les noms de courses
   sont gardés à part (S.names) car le calendrier est reconstruit à chaque saison. Rien ici ne tire au hasard. */

// Nom actuel d'une course (personnalisé ou d'origine), d'après sa clé.
function raceNameOf(key) {
  const o = S && S.names && S.names.races && S.names.races[key];
  if (o) return o;
  const d = RACE_DEFS.find(d => d.key === key);
  return d ? d.name : key;
}
// Définition d'une course d'après son nom actuel (personnalisé) — complète raceByName (noms d'origine).
function raceDefByCustomName(n) {
  const R = S && S.names && S.names.races;
  if (!R) return null;
  const k = Object.keys(R).find(k => R[k] === n);
  return k ? RACE_DEFS.find(d => d.key === k) || null : null;
}
function cleanName(v, max) {
  return String(v == null ? '' : v)
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
// Renomme une course (clé du calendrier). Retourne un message d'erreur, ou null.
function renameRace(key, name) {
  const d = RACE_DEFS.find(d => d.key === key);
  if (!d) return 'Course inconnue.';
  const nw = cleanName(name, 40);
  if (!nw) return 'Nom vide.';
  const old = raceNameOf(key);
  if (nw === old) return null;
  if (RACE_DEFS.some(e => e.key !== key && raceNameOf(e.key) === nw)) return 'Une autre course porte déjà ce nom.';
  S.names = S.names || {};
  S.names.races = S.names.races || {};
  if (nw === d.name) delete S.names.races[key];
  else S.names.races[key] = nw;
  for (const c of S.cal || []) if (c.key === key) c.name = nw;
  if (S.rc && S.rc.key === key) S.rc.name = nw;
  for (const r of Object.values(S.riders)) {
    for (const p of r.palm || []) if (p.r === old) p.r = nw;
    if (r.pb) for (const b of Object.values(r.pb)) if (b && b.race === old) b.race = nw;
  }
  for (const q of S.pwRec || []) if (q.race === old) q.race = nw;
  return null;
}
// Renomme une équipe (nom, abréviation, couleur). Retourne un message d'erreur, ou null.
// oldShort : abréviation à remplacer dans l'historique (par défaut l'actuelle).
function renameTeam(id, name, short, color, oldShort) {
  const T = teamById(id);
  if (!T) return 'Équipe inconnue.';
  const nm = cleanName(name, 30);
  const sh = cleanName(short, 4).toUpperCase();
  if (!nm || !sh) return 'Nom et abréviation obligatoires.';
  if (S.teams.some(U => U !== T && (U.short === sh || U.name === nm)))
    return 'Une autre équipe porte déjà ce nom ou cette abréviation.';
  const col = /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : T.color;
  const oldS = oldShort || T.short;
  T.name = nm;
  T.short = sh;
  T.color = col;
  if (sh !== oldS) {
    for (const e of S.merc || []) {
      if (e.f === oldS) e.f = sh;
      if (e.t === oldS) e.t = sh;
    }
    for (const r of Object.values(S.riders)) for (const p of r.palm || []) if (p.t === oldS) p.t = sh;
  }
  return null;
}
// Renomme un coureur (prénom, nom).
function renameRider(id, fn, ln) {
  const r = S.riders[id];
  if (!r) return 'Coureur inconnu.';
  const f = cleanName(fn, 24),
    l = cleanName(ln, 30);
  if (!f || !l) return 'Prénom et nom obligatoires.';
  r.fn = f;
  r.ln = l;
  return null;
}
// Fichier de noms : toutes les courses, équipes et coureurs en activité, lisible et modifiable à la main.
function exportNames() {
  return {
    type: 'directeur-sportif-noms',
    v: 1,
    courses: RACE_DEFS.map(d => ({ cle: d.key, nom: raceNameOf(d.key) })),
    equipes: S.teams.map(T => ({ id: T.id, nom: T.name, abr: T.short, couleur: T.color })),
    coureurs: Object.values(S.riders)
      .filter(r => !r.retired)
      .map(r => ({ id: r.id, prenom: r.fn, nom: r.ln, equipe: r.aca ? 'ACA' : teamOf(r) ? teamOf(r).short : 'libre' })),
  };
}
// Applique un fichier de noms (même format). Retourne le bilan.
function importNames(o) {
  if (!o || o.type !== 'directeur-sportif-noms') return { ok: false, txt: 'Ce fichier n’est pas un fichier de noms.' };
  let nc = 0,
    ne = 0,
    nr = 0,
    err = 0;
  for (const c of o.courses || []) {
    if (raceNameOf(c.cle) === cleanName(c.nom, 40)) continue;
    if (renameRace(c.cle, c.nom)) err++;
    else nc++;
  }
  // équipes en deux temps : noms provisoires d'abord, pour permettre d'échanger deux noms ou abréviations
  const eqs = (o.equipes || []).filter(e => teamById(e.id));
  const changed = eqs.filter(e => {
    const T = teamById(e.id);
    return T.name !== cleanName(e.nom, 30) || T.short !== cleanName(e.abr, 4).toUpperCase() || T.color !== e.couleur;
  });
  const orig = new Map(changed.map(e => [e.id, { name: teamById(e.id).name, short: teamById(e.id).short }]));
  for (const e of changed) {
    const T = teamById(e.id);
    T.name = '~' + T.id + '~';
    T.short = '~' + T.id;
  }
  for (const e of changed) {
    const T = teamById(e.id),
      O = orig.get(e.id);
    if (renameTeam(e.id, e.nom || O.name, e.abr || O.short, e.couleur, O.short)) {
      T.name = O.name;
      T.short = O.short;
      err++;
    } else ne++;
  }
  for (const c of o.coureurs || []) {
    const r = S.riders[c.id];
    if (!r || (r.fn === c.prenom && r.ln === c.nom)) continue;
    if (renameRider(c.id, c.prenom, c.nom)) err++;
    else nr++;
  }
  return {
    ok: true,
    txt: `Noms appliqués : ${nc} course(s), ${ne} équipe(s), ${nr} coureur(s)${err ? ` · ${err} ligne(s) ignorée(s) (vide ou en double)` : ''}.`,
  };
}
