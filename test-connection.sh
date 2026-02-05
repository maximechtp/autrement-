#!/bin/bash

echo "🧪 Test de connexion WebSocket - LOK IN"
echo "========================================"
echo ""

# Vérifier si le serveur tourne
echo "1️⃣ Vérification du serveur..."
if lsof -ti:8080 > /dev/null 2>&1; then
    PID=$(lsof -ti:8080)
    echo "   ✅ Serveur actif (PID: $PID)"
else
    echo "   ❌ Serveur non démarré"
    echo "   💡 Lancez: node server.js"
    exit 1
fi

echo ""
echo "2️⃣ Test de connexion HTTP..."
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>&1)
if [ "$HTTP_RESPONSE" = "400" ] || [ "$HTTP_RESPONSE" = "426" ]; then
    echo "   ✅ Serveur répond (code $HTTP_RESPONSE - normal pour WebSocket)"
else
    echo "   ⚠️  Réponse: $HTTP_RESPONSE"
fi

echo ""
echo "3️⃣ Affichage des connexions actives..."
CONNECTIONS=$(netstat -an 2>/dev/null | grep :8080 | grep ESTABLISHED | wc -l | tr -d ' ')
echo "   📊 Connexions WebSocket actives: $CONNECTIONS"

echo ""
echo "4️⃣ Instructions de test:"
echo "   • Ouvrir: test-websocket.html"
echo "   • Ou visiter: http://localhost:8080 (dans le navigateur)"
echo "   • Console dev (F12): Vérifier les logs de connexion"

echo ""
echo "✅ Test terminé"
