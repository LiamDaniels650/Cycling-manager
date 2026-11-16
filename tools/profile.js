// Profil CPU de la simulation (deux saisons de tests/fingerprint.js) : fonctions les plus coûteuses.
// Usage : node tools/profile.js   (≈ 1 min)
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dir = fs.mkdtempSync('/tmp/prof-');
execFileSync(
  process.execPath,
  ['--no-turbo-inlining', '--cpu-prof', '--cpu-prof-dir=' + dir, path.join(__dirname, '../tests/fingerprint.js')],
  {
    stdio: 'ignore',
  }
);
const p = JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0])));
const byId = new Map(p.nodes.map(n => [n.id, n]));
const self = {};
for (const s of p.samples) {
  const f = byId.get(s).callFrame;
  const k = (f.functionName || '(anonyme)') + ' (engine.js:' + (f.lineNumber + 1) + ')';
  self[k] = (self[k] || 0) + 1;
}
const tot = p.samples.length;
for (const [k, v] of Object.entries(self)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 25))
  console.log(((v / tot) * 100).toFixed(1).padStart(5) + ' %  ' + k);
