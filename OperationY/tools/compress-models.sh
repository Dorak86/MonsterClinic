#!/bin/sh
# Komprimiert die Blender-Exporte (assets/) für das Spiel (src/models/), Knotennamen bleiben erhalten
set -e
cd "$(dirname "$0")/.."
for f in assets/*.glb; do
  npx gltf-transform optimize "$f" "src/models/$(basename "$f")" --compress meshopt --texture-compress false \
    --simplify false --join false --flatten false --instance false --prune false >/dev/null
done
echo "Modelle komprimiert"
