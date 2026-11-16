#!/bin/sh
# Vérification des types (TypeScript en mode JavaScript, sans annotations obligatoires) sur le jeu assemblé.
# Attrape les fautes de frappe, les appels mal formés et les opérations incohérentes avant même les tests.
cd "$(dirname "$0")/.." && python3 build.py >/dev/null || exit 1
D=$(mktemp -d)
python3 - "$D" <<'PY'
import re, sys
s = open('dist/index.html', encoding='utf-8').read()
open(sys.argv[1] + '/all.js', 'w', encoding='utf-8').write('\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', s, re.S)).replace("'use strict';", ''))
PY
cat > "$D/tsconfig.json" <<'JSON'
{ "compilerOptions": { "allowJs": true, "checkJs": true, "noEmit": true, "target": "es2022", "lib": ["es2022", "dom"],
  "strict": false, "skipLibCheck": true }, "files": ["all.js"] }
JSON
if tsc -p "$D"; then echo "Types : aucune erreur."; else echo "Types : erreurs ci-dessus (numéros de ligne de dist/index.html, scripts concaténés)."; exit 1; fi
