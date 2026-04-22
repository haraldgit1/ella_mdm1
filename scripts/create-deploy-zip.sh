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

# git archive exportiert exakt die versionierten Dateien — kein node_modules, kein .next, keine DB
git archive --format=zip --output="$OUTPUT" HEAD

# DEPLOY.md ist ggf. noch nicht committed — separat hinzufügen falls vorhanden
if [ -f "DEPLOY.md" ] && ! git ls-files --error-unmatch DEPLOY.md 2>/dev/null; then
  zip "$OUTPUT" DEPLOY.md
fi

SIZE=$(du -sh "$OUTPUT" | cut -f1)
echo ""
echo "✅ Fertig: $(basename $OUTPUT) ($SIZE)"
echo ""
echo "Windows-Zielrechner:"
echo "  1. ZIP entpacken nach C:\\Apps\\ella_edge_hub\\"
echo "  2. .env.local anlegen (siehe DEPLOY.md)"
echo "  3. bun install"
echo "  4. bun run build"
echo "  5. bun start  →  http://localhost:3000"
