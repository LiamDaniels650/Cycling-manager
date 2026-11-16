"""Déplace des fonctions (avec leurs commentaires d'en-tête) d'un fichier vers un autre, sans rien modifier.
Usage : python3 tools/split.py plan.json  (liste de {src, dst, names, header} ; header vide = ajout à la fin d'un
fichier existant, sinon nouveau fichier avec cet en-tête)."""
import re, sys
def block_start(lines, i):
    # remonte sur les lignes de commentaire collées au-dessus
    while i > 0 and lines[i-1].lstrip().startswith('//'):
        i -= 1
    return i
def find_top(lines, name):
    pat = re.compile(r'^(async )?function ' + re.escape(name) + r'\(|^(const|let) ' + re.escape(name) + r'\b')
    for i, l in enumerate(lines):
        if pat.match(l): return i
    raise SystemExit('introuvable : ' + name)
def top_starts(lines):
    return [i for i, l in enumerate(lines) if re.match(r'^((async )?function |const |let |var )', l)]
def move(src, dst, names, header):
    lines = open(src, encoding='utf-8').read().split('\n')
    tops = top_starts(lines)
    spans = []
    for n in names:
        i = find_top(lines, n)
        nxt = [t for t in tops if t > i]
        end = block_start(lines, nxt[0]) if nxt else len(lines)
        spans.append((block_start(lines, i), end))
    spans.sort()
    out, keep, last = [], [], 0
    for a, b in spans:
        keep += lines[last:a]; out += lines[a:b]; last = b
    keep += lines[last:]
    open(src, 'w', encoding='utf-8').write('\n'.join(keep).rstrip('\n') + '\n')
    import os
    if os.path.exists(dst) and not header:
        # fichier existant : les blocs sont ajoutés à la fin
        old = open(dst, encoding='utf-8').read().rstrip('\n')
        open(dst, 'w', encoding='utf-8').write(old + '\n' + '\n'.join(out).rstrip('\n') + '\n')
    else:
        open(dst, 'w', encoding='utf-8').write(header.rstrip('\n') + '\n\n' + '\n'.join(out).rstrip('\n') + '\n')
if __name__ == '__main__':
    import json
    cfg = json.load(open(sys.argv[1]))
    for m in cfg: move(m['src'], m['dst'], m['names'], m['header'])
