#!/bin/bash

# Script de démarrage du serveur WebSocket LOK IN
# Usage: ./start-server.sh [dev|prod]

MODE=${1:-dev}

echo "🚀 Démarrage du serveur WebSocket LOK IN..."
echo "📍 Mode: $MODE"
echo ""

if [ "$MODE" = "prod" ]; then
  echo "⚙️  Mode Production"
  echo "   - Port: 8080"
  echo "   - Auto-restart: Oui"
  echo "   - Logs: Activés"
  echo ""
  
  # Vérifier si nodemon est installé
  if ! command -v nodemon &> /dev/null; then
    echo "❌ nodemon n'est pas installé"
    echo "📦 Installation de nodemon..."
    npm install -g nodemon
  fi
  
  # Démarrer avec nodemon pour auto-restart
  nodemon server.js
else
  echo "⚙️  Mode Développement"
  echo "   - Port: 8080"
  echo "   - Auto-restart: Non"
  echo ""
  
  # Démarrer normalement
  node server.js
fi
