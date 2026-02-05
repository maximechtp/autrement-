# 🚀 Installation et Démarrage

## ⚠️ Prérequis

Avant de pouvoir utiliser le système de matching en temps réel, vous devez installer Node.js.

### Installation de Node.js

**macOS (avec Homebrew)** :
```bash
brew install node
```

**macOS (sans Homebrew)** :
1. Téléchargez l'installeur depuis https://nodejs.org/
2. Exécutez le fichier `.pkg` téléchargé
3. Suivez les instructions d'installation

**Vérifier l'installation** :
```bash
node --version
npm --version
```

## 📦 Installation des dépendances

Une fois Node.js installé, installez les dépendances du projet :

```bash
cd /Users/maximechantepie/autrement-
npm install ws
```

Le package `ws` est nécessaire pour le serveur WebSocket.

## 🚀 Démarrage du serveur

### Démarrer le serveur WebSocket

```bash
cd /Users/maximechantepie/autrement-
node server.js
```

Vous devriez voir :
```
🚀 Serveur WebSocket démarré sur le port 8080
📡 En attente de connexions...
```

### Garder le serveur en arrière-plan

Pour démarrer le serveur en arrière-plan et le laisser tourner :

**macOS/Linux** :
```bash
nohup node server.js > server.log 2>&1 &
```

**Avec PM2 (recommandé pour la production)** :
```bash
# Installer PM2
npm install -g pm2

# Démarrer le serveur
pm2 start server.js --name "lokin-server"

# Voir les logs
pm2 logs lokin-server

# Arrêter le serveur
pm2 stop lokin-server

# Redémarrer le serveur
pm2 restart lokin-server
```

## 🌐 Ouvrir l'application

Une fois le serveur démarré, ouvrez le fichier HTML dans votre navigateur :

1. **Double-cliquez** sur `index.html`, ou
2. **Utilisez un serveur local** (recommandé) :

```bash
# Avec Python 3
python3 -m http.server 8000

# Puis ouvrez http://localhost:8000 dans votre navigateur
```

## 🧪 Tester le matching

### Test avec 2 navigateurs

Pour tester le système de matching en temps réel :

1. **Ouvrez 2 fenêtres de navigateur** (ou 2 navigateurs différents)
2. Dans chaque fenêtre, connectez-vous avec un compte différent
3. Dans les deux, sélectionnez **Débat** et la **même langue** (ex: Français)
4. Lancez la recherche dans les deux fenêtres
5. Vous devriez voir un **match se créer automatiquement** !

### Vérifier les logs

**Dans la console du serveur** :
```
✅ Nouvelle connexion: user_1738713600000_abc123
🔍 Jean Dupont recherche un debat en Français
➕ user_1738713600000_abc123 ajouté à la file debat:Français (1 en attente)
✅ Nouvelle connexion: user_1738713605000_def456
🔍 Marie Martin recherche un debat en Français
✅ Match trouvé ! Marie Martin ↔️ Jean Dupont
📹 Google Meet créé: https://meet.google.com/lokin-...
```

**Dans la console du navigateur** (F12) :
```
🔌 Connexion au WebSocket: ws://localhost:8080
✅ WebSocket connecté
📱 Connecté avec ID: user_1738713600000_abc123
🔍 Démarrage de la recherche réelle: {option: 'debat', langue: 'Français', ...}
📤 Envoi de la demande de recherche au serveur: {...}
✅ Match trouvé ! {partner: {...}, meetLink: '...'}
```

## 🔧 Dépannage

### Le serveur ne démarre pas

**Erreur** : `Error: listen EADDRINUSE :::8080`  
**Solution** : Le port 8080 est déjà utilisé. Tuez le processus ou changez le port :

```bash
# Trouver le processus qui utilise le port 8080
lsof -i :8080

# Tuer le processus
kill -9 [PID]

# Ou changer le port dans server.js
const PORT = process.env.PORT || 8081;
```

### Le client ne se connecte pas au serveur

**Erreur dans la console** : `WebSocket connection failed`  
**Vérifications** :
1. Le serveur est-il démarré ? → `node server.js`
2. Le port est-il correct ? → Vérifier dans `script.js` ligne ~2260
3. Firewall ? → Autoriser le port 8080

### Pas de match trouvé

**Problèmes possibles** :
1. Un seul utilisateur en recherche → Ouvrez une 2ème fenêtre
2. Langues différentes → Vérifiez que les deux utilisent la même langue
3. Types d'activité différents → Vérifiez que les deux cherchent la même chose (débat, chat, etc.)

### Le serveur se déconnecte souvent

**Solution** : Utilisez PM2 pour garder le serveur actif en permanence :

```bash
pm2 start server.js --name "lokin-server"
pm2 startup  # Configure PM2 pour redémarrer au boot
pm2 save     # Sauvegarde la configuration
```

## 📊 Monitoring

### Voir les utilisateurs connectés

Le serveur affiche en temps réel :
- Nombre d'utilisateurs connectés
- Files d'attente actives
- Matches créés

### Logs détaillés

Pour voir les logs détaillés avec PM2 :
```bash
pm2 logs lokin-server --lines 100
```

Pour voir les logs en temps réel :
```bash
tail -f server.log
```

## 🌍 Déploiement en production

### Hébergement du serveur WebSocket

Pour la production, hébergez le serveur sur :
- **Heroku** (gratuit jusqu'à un certain usage)
- **DigitalOcean** (Droplet à partir de 5$/mois)
- **AWS EC2** (instance t2.micro gratuite 1 an)
- **Railway.app** (gratuit avec limitations)

### Variables d'environnement

Créez un fichier `.env` :
```
PORT=8080
NODE_ENV=production
```

### HTTPS/WSS

En production, utilisez WSS (WebSocket Secure) :
1. Obtenez un certificat SSL (Let's Encrypt)
2. Configurez un reverse proxy (Nginx)
3. Le client se connectera automatiquement en WSS

## 📞 Support

Besoin d'aide ? Contactez :
- Email : lokin.officiel@gmail.com
- Instagram : @lokin.officiel

---

**Bon matching ! 🎉**
