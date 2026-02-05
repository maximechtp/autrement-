#!/usr/bin/env node

/**
 * Test de connexion WebSocket en Node.js
 * Usage: node test-ws-node.js
 */

const WebSocket = require('ws');

console.log('🧪 Test WebSocket depuis Node.js');
console.log('=================================\n');

const wsUrl = 'ws://localhost:8080';
console.log(`🔌 Connexion à: ${wsUrl}\n`);

try {
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log('✅ CONNEXION RÉUSSIE !');
    console.log('   Le serveur WebSocket fonctionne correctement\n');
    
    // Envoyer un message de test
    const testMessage = {
      type: 'test',
      message: 'Test depuis Node.js',
      timestamp: new Date().toISOString()
    };
    ws.send(JSON.stringify(testMessage));
    console.log('📤 Message de test envoyé\n');
  });
  
  ws.on('message', (data) => {
    console.log('📨 Message reçu du serveur:');
    try {
      const parsed = JSON.parse(data);
      console.log('   ', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('   ', data.toString());
    }
    console.log('');
  });
  
  ws.on('error', (error) => {
    console.error('❌ ERREUR DE CONNEXION !');
    console.error('   Message:', error.message);
    console.error('');
    console.error('🔧 Solutions possibles:');
    console.error('   1. Vérifier que le serveur est démarré: node server.js');
    console.error('   2. Vérifier que le port 8080 est libre: lsof -i :8080');
    console.error('   3. Vérifier votre pare-feu');
    console.error('');
    process.exit(1);
  });
  
  ws.on('close', () => {
    console.log('🔌 Connexion fermée');
    console.log('');
    console.log('✅ Test terminé avec succès !');
    process.exit(0);
  });
  
  // Fermer après 3 secondes
  setTimeout(() => {
    console.log('⏱️  Fermeture de la connexion de test...\n');
    ws.close();
  }, 3000);
  
} catch (error) {
  console.error('❌ ERREUR FATALE !');
  console.error('   ', error.message);
  console.error('');
  process.exit(1);
}
