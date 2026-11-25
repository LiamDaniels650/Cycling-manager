#!/bin/sh
# Commandes de travail. Toujours depuis la racine du projet : ./dev.sh <commande>
#   build          assemble dist/index.html (jeu, interface React) et dist/engine.js (tests)
#   check          build + lint + types + empreinte (≈ 1 min) : vérifie que la simulation n'a PAS changé
#   test           check + fonctionnalités, non-régression, biais, audit, interface (≈ 6 min)
#   calib [n=30]   calibrage sur deux séries de n saisons en parallèle (graines 200 et 300), écarts au réel
#   rapide         calibrage rapide (2 × 20 saisons, ≈ 5 min) pour vérifier en cours de route
#   auto           calibrage avec arrêt anticipé : 20 saisons, puis 60 seulement si une mesure reste douteuse
#   anomalies [n=12] cas invraisemblables sur n saisons (pertes au général sur le plat, échappées folles…) (≈ 4 min)
#   impact         poids de chaque caractéristique et de chaque choix (≈ 4 min)
#   prodiges       jeunes talents sur 9 saisons (≈ 2 min 30)
#   play           une saison jouée comme un joueur dans le navigateur
#   profile        fonctions les plus coûteuses de la simulation
#   accept         après un changement VOULU de la simulation : met à jour empreinte et références
#   fmt            formate le code (prettier)
#   reglages       régénère docs/REGLAGES.md (leviers de 00-params.js et constantes du moteur)
#   adjoint [n] [g] partie entièrement déléguée à l'adjoint, comparée aux équipes IA voisines
#   react          assemble dist/react.html (interface React + Tailwind, moteur inchangé)
#   expert [g] [n] difficulté : joueur passif contre joueur expert automatisé (rangs par saison ; ≈ 5 min)
#   economie       équilibre économique : 4 parties déléguées sur 3 saisons (budget, licenciement ; ≈ 5 min)
#   carriere [n]   mode carrière : une carrière simulée de 16 ans à 16+n ans, avec vérifications (≈ 30 s par saison)
set -e
cd "$(dirname "$0")"
build() { python3 build.py >/dev/null && node tools/build_react.mjs >/dev/null && cp dist/react.html dist/index.html; }
# lance une vérification, n'affiche que sa dernière ligne, mais garde son code de retour (sh n'a pas pipefail)
last() { rc=0; out=$("$@" 2>&1) || rc=$?; printf '%s\n' "$out" | tail -1; return $rc; }
fp_check() {
  now=$(node tests/fingerprint.js 17 | tail -1)
  ref=$(cat tests/baseline/fingerprint.txt)
  if [ "$now" = "$ref" ]; then echo "✔ Empreinte identique : la simulation n'a pas changé."; else
    echo "✖ Empreinte différente : la simulation a changé ($now, référence $ref)."
    echo "  Si c'est voulu : ./dev.sh accept (puis ./dev.sh calib)."; return 1; fi
}
case "$1" in
  build) build; echo "dist/ à jour." ;;
  check)
    build; st=0
    last bash tests/lint.sh || st=1
    last bash tests/typecheck.sh || st=1
    fp_check || st=1
    exit $st ;;
  test)
    build; bash tests/lint.sh | tail -1; bash tests/typecheck.sh | tail -1
    fp_check || true
    node tests/features.js | grep -v '^✔' | tail -3
    node tests/worker_roundtrip.js | tail -1
    node tests/properties.js | tail -1
    node tests/finals.js | tail -1
    bash tests/regress.sh | tail -1
    node tests/bias.js | tail -1
    node tests/audit.js | tail -1
    python3 tests/ui_rng_react.py 2>&1 | tail -1
    python3 tests/ui_replay.py 2>&1 | tail -1
    python3 tests/ui_visual.py 2>&1 | tail -1
    python3 tests/ui_clicks.py 2>&1 | tail -1
    for t in ui_smoke_react ui_auto_react ui_worker; do python3 tests/$t.py 2>&1 | grep -i 'ERREURS JS\|errs \[' | head -1; done ;;
  carriere) build; node tests/career.js "${2:-8}" ;;
  economie) build; node tests/economy.js 4 3 ;;
  finals) build; node tests/finals.js ;;
  expert) build; for m in passif expert; do node tests/expert.js $m ${2:-41} ${3:-8} | tail -1; done ;;
  calib|rapide|auto)
    # rapide : 20 saisons par graine (≈ 5 min), pour les vérifications en cours de route ; calib N : N saisons.
    # Chaque graine répartit ses saisons sur la moitié des cœurs (résultats identiques, saisons indépendantes).
    if [ "$1" = rapide ]; then n=20; elif [ "$1" = auto ]; then n=60; export CAL_STAGE=20; else n=${2:-30}; fi; build
    j=$(( $(nproc) / 2 )); [ "$j" -lt 1 ] && j=1
    JOBS=$j node tests/calibrate.js "$n" 200 > /tmp/calib200.txt 2>&1 &
    JOBS=$j node tests/calibrate.js "$n" 300 > /tmp/calib300.txt 2>&1
    wait
    for s in 200 300; do echo "graine $s : $(grep -c '✔' /tmp/calib$s.txt) mesures dans le réel"; grep '✖\|arrêt anticipé\|on poursuit' /tmp/calib$s.txt || true; done
    echo "(détail : /tmp/calib200.txt, /tmp/calib300.txt)"
    ! grep -q '✖' /tmp/calib200.txt /tmp/calib300.txt ;;
  anomalies) build; node tests/anomalies.js "${2:-12}" 500 ;;
  impact) build; node tests/impact.js 20 ;;
  prodiges) build; node tests/prodigies.js 3 9 ;;
  play) build; python3 tests/play_react.py ;;
  profile) build; node tools/profile.js ;;
  accept)
    build; node tests/fingerprint.js 17 | tail -1 > tests/baseline/fingerprint.txt
    bash tests/regress.sh update; echo "Empreinte : $(cat tests/baseline/fingerprint.txt)" ;;
  fmt) prettier --write src/engine/*.js src/ui/*.js src/react/*.js src/react/*.jsx src/react/*/*.js src/react/*/*.jsx tests/*.js tools/*.js tools/*.mjs >/dev/null; echo "Formaté." ;;
  reglages) python3 tools/reglages.py ;;
  adjoint) Q=1 node tests/adjoint.js "${2:-8}" "${3:-11}" ;;
  react) node tools/build_react.mjs ;;
  *) sed -n '2,13p' "$0" ;;
esac
