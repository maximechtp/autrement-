# 🚀 Déploiement Railway.app - Guide Complet

## 📋 Fichiers préparés

✅ `package.json` - Configuration Node.js avec script start
✅ `server.js` - Serveur WebSocket
✅ `Procfile` - Configuration pour Railway
✅ `railway.json` - Configuration Railway
✅ `.gitignore` - Fichiers à ignorer

## 🎯 Étapes de déploiement

### Étape 1 : Créer un compte Railway

1. Allez sur [railway.app](https://railway.app)
2. Cliquez sur "Login" puis "Login with GitHub"
3. Autorisez Railway à accéder à votre GitHub

### Étape 2 : Créer un repository GitHub (si pas déjà fait)

```bash
# Vérifier si vous avez déjà un repo
git remote -v
```

Si vous n'avez pas de repository GitHub :

```bash
# Initialiser Git (si pas déjà fait)
git init

# Ajouter tous les fichiers
git add .

# Faire un commit
git commit -m "Préparation déploiement Railway"

# Créer un repo sur GitHub.com
# Puis ajouter le remote :
git remote add origin https://github.com/VOTRE-USERNAME/VOTRE-REPO.git
git branch -M main
git push -u origin main
```

### Étape 3 : Déployer sur Railway

#### Option A : Depuis GitHub (RECOMMANDÉ)

1. Sur Railway, cliquez sur **"New Project"**
2. Sélectionnez **"Deploy from GitHub repo"**
3. Choisissez votre repository **autrement-**
4. Railway va automatiquement :
   - Détecter que c'est un projet Node.js
   - Installer les dépendances (`npm install`)
   - Lancer `node server.js`

#### Option B : Depuis CLI Railway

```bash
# Installer Railway CLI
npm i -g @railway/cli

# Se connecter
railway login

# Initialiser le projet
railway init

# Déployer
railway up
```

### Étape 4 : Configurer le domaine

1. Une fois déployé, allez dans **Settings** de votre projet
2. Trouvez la section **"Networking"** ou **"Domains"**
3. Cliquez sur **"Generate Domain"**
4. Vous obtiendrez une URL comme : `your-app.up.railway.app`

### Étape 5 : Tester le déploiement

Votre serveur WebSocket sera accessible à :
```
wss://your-app.up.railway.app
```

Pour tester :
```bash
# Test avec websocat (à installer si besoin)
websocat wss://your-app.up.railway.app

# Ou avec curl
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" \
  https://your-app.up.railway.app
```

### Étape 6 : Mettre à jour votre site

Une fois déployé, copiez l'URL de Railway et mettez à jour `script.js` :

```javascript
// Dans script.js, ligne ~2325
} else {
  // Production : serveur Railway
  wsHost = 'your-app.up.railway.app'; // ⬅️ REMPLACER par votre URL Railway
}
```

Puis commitez et poussez sur GitHub :
```bash
git add script.js
git commit -m "Configure WebSocket for Railway production"
git push
```

## 🔍 Vérification

1. Ouvrez lokin.online
2. Ouvrez la console du navigateur (F12)
3. Cherchez les logs WebSocket
4. Vous devriez voir :
   ```
   🔌 Tentative de connexion WebSocket: wss://your-app.up.railway.app
   ✅ WebSocket connecté !
   ```

## 📊 Surveiller le serveur

Sur Railway :
- **Logs** : Voir les connexions en temps réel
- **Metrics** : CPU, RAM, bande passante
- **Deployments** : Historique des déploiements

## 🆓 Plan gratuit Railway

- 500 heures/mois (suffisant pour débuter)
- $5 de crédit gratuit/mois
- Passe en veille après 1h d'inactivité (se réveille automatiquement)

⚠️ Si vous dépassez, le service s'arrête jusqu'au mois prochain (ou upgrade vers plan payant)

## 🔧 Variables d'environnement (optionnel)

Sur Railway, allez dans **Variables** et ajoutez :
```
PORT=8080
NODE_ENV=production
```

Railway définit automatiquement `PORT`, mais vous pouvez forcer 8080 si nécessaire.

## 🚨 Dépannage

### Le serveur ne démarre pas
- Vérifiez les logs sur Railway
- Assurez-vous que `package.json` a `"start": "node server.js"`
- Vérifiez qu'il n'y a pas d'erreur dans `server.js`

### Connexion refuse
- Le domaine Railway prend 1-2 minutes à se propager
- Vérifiez que vous utilisez `wss://` (pas `ws://`)
- Vérifiez les logs Railway pour voir si le serveur écoute

### Erreur CORS
- Le serveur a déjà `verifyClient` pour accepter les connexions
- Si problème, ajoutez votre domaine dans la whitelist

## 📞 Besoin d'aide ?

Dites-moi où vous bloquez et je vous aiderai !

## 🎉 Une fois déployé

Vous pourrez :
- ✅ Matching en temps réel entre utilisateurs
- ✅ Recherche de professeurs en direct
- ✅ Notifications instantanées
- ✅ Chat et clashs synchronisés
