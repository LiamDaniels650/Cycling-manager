#!/usr/bin/env python3
"""Génère docs/REGLAGES.md : les leviers de src/engine/00-params.js (avec leurs commentaires) puis l'inventaire
de toutes les constantes nommées du moteur (fichier, ligne, commentaire qui les précède)."""
import os, re, glob
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
out = ['# Réglages du moteur', '', 'Fichier généré par `python3 tools/reglages.py` (ne pas modifier à la main).', '',
       '## Leviers principaux (`src/engine/00-params.js`, objet `R`)', '']
src = open(os.path.join(ROOT, 'src/engine/00-params.js'), encoding='utf8').read()
body = src[src.index('const R = {'):]
prev = ''
for line in body.splitlines()[1:]:
    t = line.strip()
    if t.startswith('//') and not t.startswith('// ---'):
        prev = t[2:].strip()
        continue
    if t.startswith('// ---'):
        out += ['', '### ' + t.strip('/ -'), '', '| Réglage | Valeur | Rôle |', '|---|---|---|']
        continue
    m = re.match(r'(\w+):\s*(.+?),?\s*(?://\s*(.*))?$', t)
    if m and not t.startswith('//') and not t.startswith('['):
        k, v, c = m.group(1), m.group(2).rstrip(','), m.group(3) or ''
        if v == '[':
            v = '(table)'
            c = c or prev
        prev = ''
        out.append(f'| `R.{k}` | `{v}` | {c} |')
out += ['', '## Autres constantes nommées', '', '| Constante | Fichier | Commentaire |', '|---|---|---|']
for f in sorted(glob.glob(os.path.join(ROOT, 'src/engine/*.js'))):
    lines = open(f, encoding='utf8').read().splitlines()
    for i, l in enumerate(lines):
        m = re.match(r'const ([A-Z][A-Z0-9_]+)\s*=', l)
        if not m:
            continue
        c = ''
        tail = re.search(r'//\s*(.*)$', l)
        if tail:
            c = tail.group(1)
        elif i and lines[i - 1].strip().startswith('//'):
            c = lines[i - 1].strip()[2:].strip()
        out.append(f'| `{m.group(1)}` | {os.path.basename(f)}:{i + 1} | {c.replace("|", "/")} |')
open(os.path.join(ROOT, 'docs/REGLAGES.md'), 'w', encoding='utf8').write('\n'.join(out) + '\n')
print('docs/REGLAGES.md :', len(out), 'lignes')
