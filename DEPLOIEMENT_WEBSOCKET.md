# 🚀 Guide de déploiement du serveur WebSocket

## Situation actuelle
- ✅ Serveur WebSocket fonctionne en local (localhost:8080)
- ❌ Pas encore déployé en production
- 🔧 WebSocket désactivé temporairement sur lokin.online pour éviter les erreurs

## Pourquoi le WebSocket ne fonctionne pas en production ?

Votre site lokin.online est hébergé sur un serveur distant, mais votre serveur WebSocket (`server.js`) tourne uniquement sur votre ordinateur local. Les visiteurs du site ne peuvent pas accéder à votre localhost.

## Options de déploiement

### Option 1 : Déployer sur le même serveur que votre site (RECOMMANDÉ)

**Avantages :**
- Pas de problème de CORS
- Configuration simple
- Même domaine = plus sécurisé

**Étapes :**

1. **Connectez-vous à votre serveur (SSH)**
   ```bash
   ssh utilisateur@lokin.online
   ```

2. **Installez Node.js si nécessaire**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Uploadez les fichiers nécessaires**
   ```bash
   # Sur votre machine locale
   scp server.js utilisateur@lokin.online:/var/www/votre-site/
   scp package.json utilisateur@lokin.online:/var/www/votre-site/
   ```

4. **Installez les dépendances sur le serveur**
   ```bash
   # Sur le serveur
   cd /var/www/votre-site/
   npm install ws
   ```

5. **Démarrez le serveur avec PM2 (process manager)**
   ```bash
   # Installer PM2
   sudo npm install -g pm2
   
   # Démarrer le serveur
   pm2 start server.js --name "websocket-server"
   
   # Auto-démarrage au reboot
   pm2 startup
   pm2 save
   ```

6. **Configurez votre firewall**
   ```bash
   # Autoriser le port 8080
   sudo ufw allow 8080
   ```

7. **Configurez NGINX (si vous l'utilisez)**
   
   Ajoutez dans votre configuration NGINX :
   ```nginx
   # WebSocket proxy
   location /ws {
       proxy_pass http://localhost:8080;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_read_timeout 86400;
   }
   ```

8. **Activez SSL/WSS (OBLIGATOIRE pour HTTPS)**
   
   Si votre site utilise HTTPS (comme lokin.online), vous DEVEZ utiliser WSS (WebSocket Secure).
   
   Avec Let's Encrypt :
   ```bash
   sudo certbot --nginx -d lokin.online
   ```

9. **Mettez à jour script.js**
   
   Changez la ligne dans script.js (ligne ~2325) :
   ```javascript
   // De :
   return;
   
   // À :
   wsHost = window.location.host; // Utilisera lokin.online
   ```

### Option 2 : Utiliser un service cloud gratuit

#### A. Railway.app (RECOMMANDÉ - facile)

1. Créez un compte sur [railway.app](https://railway.app)
2. Créez un nouveau projet
3. Connectez votre GitHub ou uploadez les fichiers
4. Railway détectera automatiquement Node.js
5. Copiez l'URL fournie (ex: your-app.up.railway.app)
6. Mettez à jour script.js avec cette URL

#### B. Render.com

1. Créez un compte sur [render.com](https://render.com)
2. Créez un nouveau "Web Service"
3. Connectez votre repo GitHub
4. Configuration :
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. Copiez l'URL fournie
6. Mettez à jour script.js

#### C. Glitch.com

1. Créez un compte sur [glitch.com](https://glitch.com)
2. Créez un nouveau projet Node.js
3. Collez le contenu de server.js et package.json
4. Le serveur démarre automatiquement
5. Copiez l'URL du projet
6. Mettez à jour script.js

### Option 3 : Utiliser ngrok (test temporaire uniquement)

Pour tester rapidement sans déployer :

```bash
# Installer ngrok
brew install ngrok

# Exposer le port 8080
ngrok http 8080
```

Copiez l'URL WSS fournie et mettez à jour temporairement script.js.

⚠️ **ATTENTION** : ngrok est pour les tests uniquement, pas pour la production.

## Configuration finale dans script.js

Une fois le serveur déployé, modifiez script.js (ligne ~2325) :

```javascript
} else {
  // Production : serveur WebSocket déployé
  wsHost = window.location.host; // Pour lokin.online
  
  // OU si serveur sur un autre domaine/port :
  // wsHost = 'ws.lokin.online'; // Sous-domaine dédié
  // wsHost = 'your-app.railway.app'; // Service cloud
}
```

## Vérification

Une fois déployé :

1. Ouvrez la console du navigateur sur lokin.online
2. Cherchez les logs WebSocket
3. Devrait afficher : `✅ WebSocket connecté !`

## Problèmes courants

### ERR_CONNECTION_REFUSED
- Le serveur n'est pas démarré
- Le port est bloqué par un firewall
- L'URL est incorrecte

### ERR_SSL_PROTOCOL_ERROR
- Vous utilisez ws:// au lieu de wss:// sur HTTPS
- Le certificat SSL n'est pas configuré

### 403 Forbidden
- Configuration NGINX incorrecte
- CORS non autorisé

## Support

Si vous avez besoin d'aide pour déployer, dites-moi :
1. Où est hébergé lokin.online ? (OVH, AWS, DigitalOcean, etc.)
2. Avez-vous accès SSH ?
3. Utilisez-vous NGINX ou Apache ?

Je pourrai vous donner des instructions spécifiques à votre configuration.
