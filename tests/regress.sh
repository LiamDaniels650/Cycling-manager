#!/bin/sh
# Non-régression : à graine fixe, la simulation doit produire exactement les mêmes résultats.
# Usage : tests/regress.sh          -> compare
#         tests/regress.sh update   -> met à jour les références (après un changement voulu)
cd "$(dirname "$0")/.." && python3 build.py >/dev/null || exit 1
run(){ node tests/season_report.js 3; L=1 node tests/season_report.js 4 | grep -v json; node tests/multi_seasons.js 4 2 | grep -v time; }
if [ "$1" = "update" ]; then run > tests/baseline/reference.txt; echo "Références mises à jour."; exit 0; fi
run > /tmp/regress_now.txt
if diff -q tests/baseline/reference.txt /tmp/regress_now.txt >/dev/null; then echo "OK : résultats identiques."; else echo "DIFFÉRENCES :"; diff tests/baseline/reference.txt /tmp/regress_now.txt | head -40; exit 1; fi
