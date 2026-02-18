#!/bin/bash
# ================================================================
# SWITCH TO DEMO DATABASE (people-power-change.lumoviz)
# ================================================================
# This script updates your .env file to point to the demo database
# 
# Usage: bash switch-to-demo.sh
# To revert: bash switch-to-production.sh
# ================================================================

echo "🔄 Switching to demo database (organizing-data-487317.lumoviz)..."

# Backup current .env
cp server/.env server/.env.backup
echo "💾 Backed up server/.env to server/.env.backup"

# Update PROJECT_ID in server/.env
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  sed -i '' 's/PROJECT_ID=chapter-448015/PROJECT_ID=organizing-data-487317/g' server/.env
else
  # Linux
  sed -i 's/PROJECT_ID=chapter-448015/PROJECT_ID=organizing-data-487317/g' server/.env
fi

echo "✅ Updated server/.env"
echo ""
echo "📋 Current configuration:"
grep "PROJECT_ID=" server/.env
echo ""
echo "📊 You're now pointing to:"
echo "   Project: organizing-data-487317"
echo "   Dataset: lumoviz"
echo ""
echo "⚠️  Make sure you've loaded the demo data:"
echo "   1. bigquery-setup/01_SEED_DATA_DEMO.sql"
echo "   2. bigquery-setup/02_CREATE_CONTACTS_VIEW_DEMO.sql"
echo ""
echo "🚀 Next steps:"
echo "   1. Restart your server: cd server && node index.js"
echo "   2. Open the app and check Teams view for:"
echo "      - Leadership Team (Marshall, Steph, Emily)"
echo "      - Data Team (Emily, Maggie, Zainab)"
echo "      - TFs (Alyssa, Svetlana, Sepi, Zainab)"
echo ""
echo "   3. To revert back: bash switch-to-production.sh"
