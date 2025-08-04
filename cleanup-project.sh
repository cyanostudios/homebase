#!/bin/bash

# Homebase Project Cleanup Script
# Tar bort onödiga filer före server-migration

echo "🧹 Rensar Homebase-projektet..."

# Backup gamla deployment-paket (ifall du vill behålla dem)
echo "📦 Skapar backup av gamla deployment-paket..."
mkdir -p .backup
mv homebase-inleed.tar.gz .backup/ 2>/dev/null
mv homebase-v5.tar.gz .backup/ 2>/dev/null
mv homebase-deploy.tar.gz .backup/ 2>/dev/null

# Ta bort temporära filer
echo "🗑️  Tar bort temporära filer..."
rm -f cookies.txt
rm -f session_cookies.txt
rm -f temp_contact_details.txt

# Ta bort gamla konfigurationer
echo "⚙️  Tar bort gamla config-filer..."
rm -f package.json.backup
rm -f package-mysql.json

# Ta bort gamla HTML-filer (vi har React SPA)
echo "🌐 Tar bort gamla HTML-filer..."
rm -f index.html

# Ta bort preservation mapp (backup-mapp)
echo "💾 Tar bort preservation backup-mapp..."
rm -rf preservation/

# Ta bort server-dist (gammal build)
echo "🏗️  Tar bort gamla builds..."
rm -rf server-dist/

# Rensa dist-mappen (byggs om på nya servern)
echo "📁 Rensar dist-mappen..."
rm -rf dist/

# Visa resultat
echo ""
echo "✅ Rensning klar!"
echo ""
echo "📊 PROJEKTSTRUKTUR EFTER RENSNING:"
echo "✅ Behållet - Frontend: client/"
echo "✅ Behållet - Backend: server/"
echo "✅ Behållet - Plugins: plugins/"
echo "✅ Behållet - Database scripts: scripts/"
echo "✅ Behållet - Dokumentation: docs/"
echo "✅ Behållet - MySQL server: index-mysql.js"
echo "✅ Behållet - Konfiguration: package.json, .env.local, vite.config.ts"
echo "✅ Behållet - Dependencies: node_modules/"
echo ""
echo "🗂️  Backup av gamla filer: .backup/"
echo ""
echo "🚀 Projektet är nu redo för migration till ny server!"

# Visa projektets nya storlek
echo ""
echo "📏 Projektets storlek efter rensning:"
du -sh . --exclude=node_modules --exclude=.git
