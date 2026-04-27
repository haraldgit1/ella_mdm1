#!/bin/bash
# Erstellt ein sauberes Deployment-ZIP für Windows
# Aufruf: bash scripts/create-deploy-zip.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VERSION=$(date +"%Y%m%d_%H%M")
OUTPUT="$PROJECT_DIR/../ella_edge_hub_${VERSION}.zip"

echo "📦 Erstelle Deployment-ZIP..."
echo "   Quelle:  $PROJECT_DIR"
echo "   Ziel:    $OUTPUT"

cd "$PROJECT_DIR"

# Next.js Production-Build auf dem Mac ausführen
echo ""
echo "🔨 Starte Next.js Build..."
bun run build
echo "✓ Build fertig"

# git archive exportiert exakt die versionierten Dateien — kein node_modules, keine DB
git archive --format=zip --output="$OUTPUT" HEAD

# Nicht-versionierte Dateien ergänzen
for f in DEPLOY.md install-windows.bat; do
  [ -f "$f" ] && ! git ls-files --error-unmatch "$f" 2>/dev/null && zip "$OUTPUT" "$f"
done

# deploy-assets (bun.exe, better-sqlite3 Binary)
if [ -d "deploy-assets" ]; then
  zip -r "$OUTPUT" deploy-assets/
fi

# .next Build-Output hinzufügen (ohne Dev-Cache und Diagnostics)
echo ""
echo "📁 Füge .next Build-Output hinzu..."
zip -r "$OUTPUT" .next/ \
  -x ".next/dev/*" \
  -x ".next/diagnostics/*" \
  -x ".next/types/*"

SIZE=$(du -sh "$OUTPUT" | cut -f1)
echo ""
echo "✅ Fertig: $(basename $OUTPUT) ($SIZE)"
echo ""
echo "Windows-Zielrechner:"
echo "  1. ZIP entpacken nach C:\\Apps\\ella_edge_hub\\"
echo "  2. .env.local anlegen (siehe DEPLOY.md)"
echo "  3. install-windows.bat ausführen"
echo "  4. bun.exe start  →  http://localhost:3000"
