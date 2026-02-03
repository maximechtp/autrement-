# Serveur WebSocket LOK IN

## Installation

```bash
npm install
```

## Démarrage

```bash
# Production
npm start

# Développement (avec auto-reload)
npm run dev
```

Le serveur démarre par défaut sur le port **8080**.

## Protocole WebSocket

### Messages envoyés par le client

#### 1. Mise à jour de position
```json
{
  "type": "updatePosition",
  "name": "Marie Dupont",
  "lat": 48.8566,
  "lng": 2.3522
}
```

#### 2. Demande de la liste des utilisateurs
```json
{
  "type": "requestUserList"
}
```

### Messages reçus du serveur

#### 1. Confirmation de connexion
```json
{
  "type": "connected",
  "clientId": "user_1234567890_abc123",
  "message": "Connexion établie"
}
```

#### 2. Liste des utilisateurs connectés
```json
{
  "type": "userList",
  "users": [
    {
      "id": "user_1234567890_abc123",
      "name": "Marie Dupont",
      "lat": 48.8566,
      "lng": 2.3522,
      "timestamp": 1735906800000
    }
  ],
  "count": 1
}
```

#### 3. Erreur
```json
{
  "type": "error",
  "message": "Description de l'erreur"
}
```

## Exemple d'utilisation côté client

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  console.log('Connecté au serveur');
  
  // Envoyer sa position GPS
  ws.send(JSON.stringify({
    type: 'updatePosition',
    name: 'Marie Dupont',
    lat: 48.8566,
    lng: 2.3522
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'userList') {
    console.log(`${data.count} utilisateurs connectés:`, data.users);
    // Afficher les marqueurs sur la carte Leaflet
    data.users.forEach(user => {
      addUserMarker(user.lat, user.lng, user.name);
    });
  }
};

ws.onclose = () => {
  console.log('Déconnecté du serveur');
};
```

## Fonctionnalités

- ✅ Connexions WebSocket en temps réel
- ✅ Stockage des utilisateurs en mémoire
- ✅ Broadcast automatique de la liste des utilisateurs
- ✅ Suppression automatique à la déconnexion
- ✅ Nettoyage des connexions inactives (timeout 5 min)
- ✅ Gestion des erreurs
- ✅ Arrêt propre du serveur

## Variables d'environnement

- `PORT` : Port du serveur (défaut: 8080)

Exemple:
```bash
PORT=3000 npm start
```
