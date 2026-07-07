#!/bin/sh
# Eligiendo Mi Camino - versión offline (Mac / Linux)
cd "$(dirname "$0")"
echo "Iniciando Eligiendo Mi Camino (offline)... usa Chrome o Edge."
if command -v node >/dev/null 2>&1; then
  node serve.mjs --open
elif command -v python3 >/dev/null 2>&1; then
  ( sleep 1; (open http://localhost:5173 2>/dev/null || xdg-open http://localhost:5173 2>/dev/null) ) &
  python3 -m http.server 5173 --directory dist
else
  echo "Necesitas Node.js o Python instalado."
fi
