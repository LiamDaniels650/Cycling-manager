#!/usr/bin/env bash
# Réduit les polices intégrées aux caractères dont le jeu a besoin (français, noms des coureurs de toutes les
# nations, flèches et ponctuation de l'interface) : 261 Ko → 119 Ko, la page s'ouvre plus vite sur téléphone.
# Originaux complets dans assets/fonts/full/. Nécessite fonttools et brotli (pip install fonttools brotli).
# Usage : bash tools/subset_fonts.sh   (puis node tools/build_react.mjs)
set -e
cd "$(dirname "$0")/../assets/fonts"
LAT="U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2009-200B,U+200D,U+2010-2014,U+2018-201E,U+2022,U+2026,U+202F,U+2032,U+2039-203A,U+20AC,U+2122,U+2190-2199,U+21A9-21AA,U+21BA,U+2212,U+FEFF,U+FFFD"
EXT=$(python3 -c "print(','.join('U+%04X'%ord(c) for c in 'ĄąĆćČčĎďĐđĘęĚěĞğİŁłŃńŇňŐőŘřŚśŞşŠšŤťŮůŰűŹźŻżŽžĀāĒēĪīŌōŪū'))")
for f in full/*.woff2; do
  b=$(basename "$f")
  case $b in *latin-ext*) U=$EXT ;; *) U=$LAT ;; esac
  pyftsubset "$f" --unicodes="$U" --layout-features='kern,liga,tnum,lnum,ccmp,mark,mkmk' --no-hinting \
    --desubroutinize --flavor=woff2 --output-file="$b"
done
du -cb ./*.woff2 | tail -1
