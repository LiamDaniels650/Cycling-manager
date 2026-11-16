#!/bin/sh
# Analyse statique (ESLint) du jeu assemblé : variables non déclarées, doublons, code inaccessible.
# Les scripts partagent une portée globale : on les analyse concaténés, dans l'ordre du build.
cd "$(dirname "$0")/.." || exit 1
cat src/engine/*.js src/ui/*.js > tests/.lint_all.js
eslint -c tests/eslint.config.mjs tests/.lint_all.js
s=$?
rm -f tests/.lint_all.js
[ $s -eq 0 ] && echo "Lint : aucune erreur."
exit $s
