// Assemble la version React du jeu en une seule page : dist/react.html.
//   moteur (src/engine, inchangé) + ancienne interface (src/ui, sauf le démarrage, pour les écrans pas encore
//   convertis et ses fonctions d'action) + application React (src/react, assemblée par esbuild) + styles
//   (Tailwind CSS v4 compilé à partir des classes utilisées, puis styles de l'ancienne interface).
// Usage : node tools/build_react.mjs     (React, esbuild et Tailwind viennent de /opt/npm-tools/node_modules)
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
// modules : ceux du dépôt (npm install) s'ils existent, sinon NODE_MODULES, sinon l'installation partagée
const NM = fs.existsSync(path.join(ROOT, 'node_modules', 'esbuild'))
  ? path.join(ROOT, 'node_modules')
  : process.env.NODE_MODULES || '/opt/npm-tools/node_modules';
const require = createRequire(NM + '/');
const esbuild = require('esbuild');
const { compile } = await import(NM + '/tailwindcss/dist/lib.mjs');

const cat = (dir, skip = []) =>
  fs
    .readdirSync(path.join(ROOT, dir))
    .filter(f => f.endsWith('.js') && !skip.includes(f))
    .sort()
    .map(f => `// ---- ${dir}/${f} ----\n` + fs.readFileSync(path.join(ROOT, dir, f), 'utf8'))
    .join('\n');
const engine = "'use strict';\n" + cat('src/engine');
const legacy = "'use strict';\n" + cat('src/ui', ['99-init.js']);

const out = await esbuild.build({
  entryPoints: [path.join(ROOT, 'src/react/main.jsx')],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  jsx: 'automatic',
  target: ['es2020'],
  nodePaths: [NM],
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});
const bundle = out.outputFiles[0].text;

// Tailwind : les classes candidates sont tous les mots des sources React
const srcs = [];
const walk = d => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx|js)$/.test(f)) srcs.push(fs.readFileSync(p, 'utf8'));
  }
};
walk(path.join(ROOT, 'src/react'));
const cands = new Set();
for (const s of srcs) for (const m of s.matchAll(/[A-Za-z0-9_\-:\/\[\]\.%()#,>=!&*+]+/g)) cands.add(m[0]);
const base = NM + '/tailwindcss/';
const tw = await compile(
  '@import "tailwindcss";\n@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1}}',
  {
    base,
    loadStylesheet: async (id, b) => {
      const p =
        id === 'tailwindcss'
          ? base + 'index.css'
          : id.startsWith('tailwindcss/')
            ? base + id.slice(12)
            : path.join(b, id);
      return { content: fs.readFileSync(p, 'utf8'), base: b, path: p };
    },
  }
);
const twCss = tw.build([...cands]);

const shell = fs.readFileSync(path.join(ROOT, 'src/shell.html'), 'utf8');
const legacyCss0 = (shell.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
// Styles de l'ancienne interface : limités aux écrans qu'elle affiche encore (.legacy), placés dans une couche
// au-dessus des remises à zéro de Tailwind mais sous ses classes utilitaires (les composants React gardent la main).
function scopeCss(css) {
  let out = '',
    i = 0,
    depth = 0;
  const kf = []; // profondeurs des blocs @keyframes en cours
  while (i < css.length) {
    const j = css.indexOf('{', i),
      k = css.indexOf('}', i);
    if (k !== -1 && (j === -1 || k < j)) {
      out += css.slice(i, k + 1);
      depth--;
      if (kf.length && kf[kf.length - 1] === depth) kf.pop();
      i = k + 1;
      continue;
    }
    if (j === -1) {
      out += css.slice(i);
      break;
    }
    const sel = css.slice(i, j);
    const t = sel.trim();
    if (t.startsWith('@')) {
      if (/^@(-webkit-)?keyframes/.test(t)) kf.push(depth);
      out += sel + '{';
    } else if (kf.length) out += sel + '{';
    else
      out +=
        sel
          .split(',')
          .map(x => {
            const y = x.trim();
            return /^(:root|html|body)\b/.test(y) ? y : '.legacy ' + y;
          })
          .join(', ') + '{';
    depth++;
    i = j + 1;
  }
  return out;
}
const legacyCss = scopeCss(legacyCss0.replace(/\/\*[\s\S]*?\*\//g, ''));
const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#020617">
<title>Directeur Sportif</title>
<style>@layer theme, base, legacy, components, utilities;
@layer legacy {${legacyCss}}
${twCss}
body{background:#020617;color:#e2e8f0;-webkit-tap-highlight-color:transparent}
#root{min-height:100vh;overflow-x:hidden}
</style>
</head>
<body>
<div id="root"></div>
<script id="engine">${engine}</script>
<script>${legacy}</script>
<script>${bundle}</script>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, 'dist/react.html'), html);
console.log(
  'dist/react.html',
  Math.round(html.length / 1024),
  'Ko (React',
  Math.round(bundle.length / 1024),
  'Ko, Tailwind',
  Math.round(twCss.length / 1024),
  'Ko)'
);
