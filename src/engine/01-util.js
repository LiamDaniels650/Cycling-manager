/* Utilitaires : hasard reproductible, formats */
var S = null; // état de la partie (sérialisable)
var _sd = 987654321; // graine RNG
function rnd() {
  _sd = (_sd + 0x6d2b79f5) | 0;
  let t = Math.imul(_sd ^ (_sd >>> 15), 1 | _sd);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
// Hasard propre à une étape : chaque étape tire ses nombres d'une série dérivée de la partie, de la saison, de la
// course et du numéro d'étape. Une étape se rejoue donc à l'identique avec les mêmes choix, et ce qui se passe
// ailleurs (menus, autres courses) ne change rien à son déroulement.
function stageSeed(rc, si) {
  let h = (((S && S.seed0) || 1) ^ 0x9e3779b9) | 0;
  const str = `${S ? S.season : 0}|${rc.key}|${si}`;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h ^ (h >>> 13)) | 0;
}
// Exécute fn avec la série de hasard de holder (holder.sd), puis rétablit la série générale.
function withSeed(holder, fn) {
  const g = _sd;
  _sd = holder.sd;
  try {
    return fn();
  } finally {
    holder.sd = _sd;
    _sd = g;
  }
}
function rint(a, b) {
  return a + Math.floor(rnd() * (b - a + 1));
}
function rf(a, b) {
  return a + rnd() * (b - a);
}
function pick(a) {
  return a[Math.floor(rnd() * a.length)];
}
function gauss() {
  let u = 0,
    v = 0;
  while (!u) u = rnd();
  while (!v) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function clamp(x, a, b) {
  return x < a ? a : x > b ? b : x;
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}
function sum(a) {
  let s = 0;
  for (const x of a) s += x;
  return s;
}
function fmtTime(sec) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = sec % 60;
  return (h ? h + 'h' : '') + String(m).padStart(h ? 2 : 1, '0') + "'" + String(s).padStart(2, '0') + '"';
}
function fmtGap(sec) {
  sec = Math.round(sec);
  if (sec <= 0) return 'm.t.';
  const m = Math.floor(sec / 60),
    s = sec % 60;
  return '+' + (m ? m + "'" : '') + String(s).padStart(m ? 2 : 1, '0') + '"';
}
function fmtMoney(k) {
  return k >= 1000 ? (k / 1000).toFixed(2) + ' M€' : Math.round(k) + ' k€';
}
function fmtDec(v, d = 1) {
  return Number(v).toFixed(d).replace('.', ',');
}
