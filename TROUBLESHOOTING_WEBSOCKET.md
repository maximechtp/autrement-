# 🔧 Guide de dépannage WebSocket - LOK IN

## ❌ Problème : "Impossible de se connecter au serveur"

### 🔍 Diagnostic

#### 1. **Vérifier que le serveur est lancé**

```bash
# Vérifier si le processus tourne
ps aux | grep "node server.js"

# OU vérifier si le port 8080 est en écoute
lsof -i :8080
# ou sur Linux: netstat -tulpn | grep 8080
```

**Si rien n'apparaît** → Le serveur n'est PAS lancé ⚠️

#### 2. **Vérifier les logs du navigateur**

Ouvrez la console (F12) et cherchez :
```
❌ Impossible de se connecter au serveur WebSocket sur ws://localhost:8080
```

#### 3. **Problèmes courants**

| Symptôme | Cause | Solution |
|----------|-------|----------|
| `WebSocket connection failed` | Serveur non démarré | Lancer `node server.js` |
| `Mixed Content` (HTTPS → WS) | Protocole non sécurisé | Utiliser WSS en production |
| `Connection refused` | Port bloqué/occupé | Vérifier pare-feu ou changer de port |
| `EADDRINUSE` | Port 8080 déjà utilisé | Tuer le processus existant |

---

## ✅ Solutions

### Solution 1 : Démarrer le serveur

```bash
# Option A : Démarrage simple
cd /Users/maximechantepie/autrement-
node server.js

# Option B : Avec le script (auto-restart)
./start-server.sh dev

# Option C : En arrière-plan (production)
nohup node server.js > websocket.log 2>&1 &
```

**Vérification** : Vous devez voir ce message :
```
╔════════════════════════════════════════════════╗
║   🚀 Serveur WebSocket LOK IN                 ║
╚════════════════════════════════════════════════╝
✅ Serveur prêt à recevoir des connexions
```

---

### Solution 2 : Débloquer le port 8080

**Sur macOS :**
```bash
# Trouver le processus qui utilise le port 8080
lsof -ti:8080

# Tuer le processus
kill -9 $(lsof -ti:8080)
```

**Sur Linux :**
```bash
# Trouver le processus
sudo netstat -tulpn | grep :8080

# Tuer le processus
sudo kill -9 <PID>
```

---

### Solution 3 : Configuration pour HTTPS (Production)

Si votre site est en **HTTPS**, vous devez :

#### Option A : Utiliser un reverse proxy (NGINX/Apache)

**NGINX :**
```nginx
server {
    listen 443 ssl;
    server_name votre-domaine.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### Option B : Serveur WebSocket avec SSL natif

**Modifier `server.js` :**
```javascript
const https = require('https');
const fs = require('fs');
const WebSocket = require('ws');

const server = https.createServer({
  cert: fs.readFileSync('/path/to/cert.pem'),
  key: fs.readFileSync('/path/to/key.pem')
});

const wss = new WebSocket.Server({ server });

server.listen(8080, () => {
  console.log('🚀 Serveur WSS (sécurisé) sur port 8080');
});
```

**Modifier `script.js` (déjà fait) :**
```javascript
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
```

---

### Solution 4 : Tester la connexion manuellement

**Test avec curl :**
```bash
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Host: localhost:8080" \
     -H "Origin: http://localhost:8080" \
     http://localhost:8080/
```

**Test avec websocat (outil spécialisé) :**
```bash
# Installation
brew install websocat  # macOS
# ou: cargo install websocat  # Rust

# Test
websocat ws://localhost:8080
```

---

## 🚀 Démarrage automatique (Production)

### Option 1 : PM2 (recommandé)

```bash
# Installation
npm install -g pm2

# Démarrage
pm2 start server.js --name "lokin-websocket"

# Auto-restart au démarrage du système
pm2 startup
pm2 save

# Monitoring
pm2 monit
pm2 logs lokin-websocket
```

### Option 2 : systemd (Linux)

Créer `/etc/systemd/system/lokin-websocket.service` :
```ini
[Unit]
Description=LOK IN WebSocket Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/lokin
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable lokin-websocket
sudo systemctl start lokin-websocket
sudo systemctl status lokin-websocket
```

---

## 📊 Monitoring

### Logs en temps réel

```bash
# Si lancé avec PM2
pm2 logs lokin-websocket --lines 100

# Si lancé manuellement avec redirection
tail -f websocket.log

# Logs du système
journalctl -u lokin-websocket -f
```

### Statistiques

```bash
# Connexions actives
netstat -an | grep :8080 | grep ESTABLISHED | wc -l

# Mémoire utilisée
ps aux | grep "node server.js" | awk '{print $6/1024 " MB"}'
```

---

## 🔒 Sécurité

### Pare-feu

**Autoriser le port 8080 :**
```bash
# macOS
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node

# Ubuntu/Debian
sudo ufw allow 8080/tcp

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

### Limiter les origines (script.js déjà configuré)

**Dans `server.js` :**
```javascript
verifyClient: (info) => {
  const allowedOrigins = [
    'https://votre-domaine.com',
    'http://localhost:3000'
  ];
  return allowedOrigins.includes(info.origin);
}
```

---

## 🧪 Tests

**Test de charge avec Artillery :**
```bash
npm install -g artillery

# Créer test-websocket.yml
artillery quick --count 100 --num 10 ws://localhost:8080
```

---

## 📞 Support

Si le problème persiste :

1. Vérifiez les logs : `pm2 logs` ou `tail -f websocket.log`
2. Testez avec `websocat ws://localhost:8080`
3. Vérifiez la console navigateur (F12)
4. Contactez le support avec ces informations

---

## 📝 Checklist de déploiement

- [ ] Serveur WebSocket lancé
- [ ] Port 8080 ouvert dans le pare-feu
- [ ] SSL/TLS configuré (production)
- [ ] Auto-restart configuré (PM2/systemd)
- [ ] Logs actifs et surveillés
- [ ] Test de connexion réussi depuis le client
- [ ] Monitoring en place

---

**Dernière mise à jour :** 5 février 2026
