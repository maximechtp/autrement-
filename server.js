const WebSocket = require('ws');

// Configuration du serveur WebSocket
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Stockage des utilisateurs connectés en mémoire
// Structure: { clientId: { ws, name, lat, lng, timestamp } }
const connectedUsers = new Map();

// Génère un ID unique pour chaque client
function generateClientId() {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Broadcast la liste des utilisateurs à tous les clients connectés
function broadcastUserList() {
  const userList = Array.from(connectedUsers.entries()).map(([id, user]) => ({
    id,
    name: user.name,
    lat: user.lat,
    lng: user.lng,
    timestamp: user.timestamp
  }));

  const message = JSON.stringify({
    type: 'userList',
    users: userList,
    count: userList.length
  });

  // Envoyer à tous les clients connectés
  connectedUsers.forEach((user) => {
    if (user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(message);
    }
  });

  console.log(`📡 Broadcast: ${userList.length} utilisateur(s) connecté(s)`);
}

// Gestion des connexions WebSocket
wss.on('connection', (ws) => {
  const clientId = generateClientId();
  console.log(`✅ Nouvelle connexion: ${clientId}`);

  // Initialiser l'utilisateur (sans position pour l'instant)
  connectedUsers.set(clientId, {
    ws,
    name: null,
    lat: null,
    lng: null,
    timestamp: Date.now()
  });

  // Envoyer l'ID au client
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    message: 'Connexion établie'
  }));

  // Gestion des messages reçus
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      const user = connectedUsers.get(clientId);

      if (!user) return;

      switch (message.type) {
        case 'updatePosition':
          // Mise à jour de la position GPS de l'utilisateur
          if (typeof message.lat === 'number' && typeof message.lng === 'number') {
            user.lat = message.lat;
            user.lng = message.lng;
            user.name = message.name || `Utilisateur ${clientId.slice(-4)}`;
            user.timestamp = Date.now();

            console.log(`📍 Position mise à jour: ${user.name} (${user.lat}, ${user.lng})`);

            // Broadcaster la liste mise à jour
            broadcastUserList();
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Latitude et longitude invalides'
            }));
          }
          break;

        case 'requestUserList':
          // Envoyer la liste des utilisateurs au client qui la demande
          const userList = Array.from(connectedUsers.entries()).map(([id, u]) => ({
            id,
            name: u.name,
            lat: u.lat,
            lng: u.lng,
            timestamp: u.timestamp
          }));

          ws.send(JSON.stringify({
            type: 'userList',
            users: userList,
            count: userList.length
          }));
          break;

        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Type de message non reconnu'
          }));
      }
    } catch (error) {
      console.error('❌ Erreur lors du traitement du message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Erreur de traitement du message'
      }));
    }
  });

  // Gestion de la déconnexion
  ws.on('close', () => {
    const user = connectedUsers.get(clientId);
    const userName = user?.name || clientId;
    
    // Supprimer l'utilisateur de la liste
    connectedUsers.delete(clientId);
    
    console.log(`❌ Déconnexion: ${userName}`);
    console.log(`👥 Utilisateurs restants: ${connectedUsers.size}`);

    // Broadcaster la liste mise à jour après suppression
    broadcastUserList();
  });

  // Gestion des erreurs
  ws.on('error', (error) => {
    console.error(`⚠️ Erreur WebSocket pour ${clientId}:`, error);
  });
});

// Nettoyage périodique des connexions inactives (toutes les 30 secondes)
setInterval(() => {
  const now = Date.now();
  const TIMEOUT = 5 * 60 * 1000; // 5 minutes

  connectedUsers.forEach((user, clientId) => {
    if (now - user.timestamp > TIMEOUT) {
      console.log(`⏰ Timeout: suppression de ${user.name || clientId}`);
      user.ws.close();
      connectedUsers.delete(clientId);
    }
  });
}, 30000);

console.log(`🚀 Serveur WebSocket démarré sur le port ${PORT}`);
console.log(`📡 En attente de connexions...`);

// Gestion de l'arrêt propre du serveur
process.on('SIGTERM', () => {
  console.log('🛑 Arrêt du serveur...');
  wss.close(() => {
    console.log('✅ Serveur arrêté proprement');
    process.exit(0);
  });
});
