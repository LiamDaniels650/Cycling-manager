// Assemble la version React du jeu en une seule page : dist/react.html.
//   moteur (src/engine) + couche d'application (src/ui : sauvegardes, Web Worker, boucle de la course en direct,
//   actions du joueur) + application React (src/react, assemblée par esbuild) + styles (Tailwind CSS v4 compilé
//   à partir des classes utilisées, et quelques règles de base).
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

// Langage visuel du jeu : asphalte (les gris), couleurs des maillots (jaune : action et sélection ; vert : bon état ;
// rouge à pois : alerte ; votre couleur : rose), typographie de signalisation routière (Barlow, étroite pour les titres
// et les chiffres). Les classes existantes (slate, sky, amber…) prennent ces valeurs : tout l'écran suit.
const THEME = `@theme {
  --font-sans: "Barlow", "Segoe UI", system-ui, sans-serif;
  --font-display: "Barlow Semi Condensed", "Arial Narrow", "Roboto Condensed", sans-serif;
  --color-slate-50: #f5f7fa; --color-slate-100: #e8ecf1; --color-slate-200: #d4dae2; --color-slate-300: #b9c2cf;
  --color-slate-400: #95a1b3; --color-slate-500: #6b7686; --color-slate-600: #4a5463; --color-slate-700: #2f3847;
  --color-slate-800: #262d3a; --color-slate-900: #1f2530; --color-slate-950: #171b22;
  --color-sky-100: #fdf3d3; --color-sky-200: #fbe7a8; --color-sky-300: #f7d877; --color-sky-400: #f5cf5f;
  --color-sky-500: #f2c94c; --color-sky-600: #d9ad2c; --color-sky-700: #a8841e; --color-sky-900: #4a3b10;
  --color-amber-100: #ffe8d4; --color-amber-200: #ffd0a8; --color-amber-300: #ffb57a; --color-amber-400: #ff9d52;
  --color-amber-500: #f5842f; --color-amber-600: #d96a17;
  --color-emerald-200: #b8ecd0; --color-emerald-300: #7fd9a8; --color-emerald-400: #3dbe7a; --color-emerald-500: #2ea866;
  --color-rose-200: #ffc9cb; --color-rose-300: #ff9a9d; --color-rose-400: #f26b6f; --color-rose-500: #e5484d; --color-rose-600: #c93338;
}`;
// Polices intégrées (assets/fonts, licence SIL OFL) : le jeu garde sa typographie hors connexion.
const FONTS = (() => {
  const dir = path.join(ROOT, 'assets/fonts');
  if (!fs.existsSync(path.join(dir, 'fonts.json'))) return '';
  return JSON.parse(fs.readFileSync(path.join(dir, 'fonts.json'), 'utf8'))
    .map(
      f =>
        `@font-face{font-family:'${f.fam}';font-style:normal;font-weight:${f.w};font-display:swap;src:url(data:font/woff2;base64,${fs
          .readFileSync(path.join(dir, f.file))
          .toString('base64')}) format('woff2');unicode-range:${f.ur}}`
    )
    .join('\n');
})();
const cat = (dir, skip = []) =>
  fs
    .readdirSync(path.join(ROOT, dir))
    .filter(f => f.endsWith('.js') && !skip.includes(f))
    .sort()
    .map(f => `// ---- ${dir}/${f} ----\n` + fs.readFileSync(path.join(ROOT, dir, f), 'utf8'))
    .join('\n');
const engine = "'use strict';\n" + cat('src/engine');
const appLayer = "'use strict';\n" + cat('src/ui', []); // couche d'application (src/ui)

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
  '@import "tailwindcss";\n@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1}}\n' + THEME,
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

// Styles de base hérités de la première interface, les seuls encore en vigueur (l'ancienne feuille de 1 275 lignes ne
// s'appliquait plus qu'à ces règles) : texte de 15 px, interligne 1,5, marge basse sur téléphone sous la barre de
// navigation fixe, et le texte atténué (.mut) des messages du moteur affichés tels quels (.legacy).
const legacyCss = `body{margin:0;font-size:15px;line-height:1.5}
@media (max-width:639px){body{padding-bottom:64px}}
.legacy .mut{color:#8a909a}`;
const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#171b22">
<title>Directeur Sportif</title>

<style>${FONTS}
@layer theme, base, legacy, components, utilities;
@layer legacy {${legacyCss}}
${twCss}
body{background:#171b22;color:#e8ecf1;font-family:var(--font-sans);-webkit-tap-highlight-color:transparent;font-variant-numeric:tabular-nums}
h1,h2,h3,h4{font-family:var(--font-display)}
:focus-visible{outline:2px solid #f2c94c;outline-offset:2px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
html.hc .text-slate-400{color:#c6cfdb}html.hc .text-slate-500{color:#aeb8c6}html.hc .text-slate-300{color:#dde3ea}
html.hc .border-slate-800,html.hc .divide-slate-800>*{border-color:#556070}html.hc .bg-slate-900{box-shadow:inset 0 0 0 1px #3b4555}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
#root{min-height:100vh;overflow-x:clip}
</style>
</head>
<body>
<div id="root"></div>
<script id="engine">${engine}</script>
<script>${appLayer}</script>
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
