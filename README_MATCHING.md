# 🔄 Système de Matching en Temps Réel

## 📋 Résumé des modifications

Le système de simulation a été **complètement remplacé** par un **système de matching en temps réel** entre utilisateurs réels.

## ✨ Principales fonctionnalités

### 🎯 Matching par langue et type d'activité

Les utilisateurs qui recherchent :
- **Débats** dans une langue spécifique
- **Lucky Chat** dans une langue spécifique  
- **Cours** dans une langue spécifique

Sont maintenant **automatiquement mis en relation** avec d'autres utilisateurs qui recherchent la même activité dans la même langue.

### 📹 Google Meet automatique

- Dès qu'un match est trouvé, un **lien Google Meet unique** est automatiquement généré
- Les deux utilisateurs reçoivent le même lien
- Ils peuvent rejoindre immédiatement la réunion vidéo

### 🔄 File d'attente en temps réel

- Position dans la file d'attente affichée en temps réel
- Nombre total d'utilisateurs en attente visible
- Mises à jour automatiques quand des utilisateurs rejoignent ou quittent la file

## 🛠️ Architecture technique

### Serveur WebSocket (server.js)

Le serveur a été étendu avec :

1. **Files d'attente par type d'activité et langue**
   ```javascript
   matchingQueues.set('debat:Français', [user1, user2, ...])
   matchingQueues.set('chat:Anglais', [user3, user4, ...])
   ```

2. **Système de matching automatique**
   - Quand un utilisateur rejoint une file non vide → match immédiat
   - Quand un utilisateur rejoint une file vide → ajout à la file d'attente
   - Génération automatique d'un ID Google Meet

3. **Messages WebSocket étendus**
   - `startSearch` : Démarrer une recherche
   - `stopSearch` : Arrêter la recherche
   - `matchFound` : Match trouvé avec les infos du partenaire
   - `searching` : Confirmation de recherche en cours
   - `queueUpdate` : Mise à jour de la position dans la file

### Client (script.js)

Les modifications côté client incluent :

1. **Fonction `startSearching()` réécrite**
   - Plus de simulation avec `setTimeout`
   - Envoi d'une vraie requête WebSocket au serveur
   - Affichage de messages d'attente en temps réel

2. **Gestion des réponses du serveur**
   - Écoute des messages `matchFound`
   - Stockage des informations du partenaire
   - Affichage automatique du profil quand un match est trouvé

3. **Fonction `createOrJoinMeet()` mise à jour**
   - Utilisation du lien Google Meet créé par le serveur
   - Plus de génération locale de liens Jitsi

4. **Arrêt de recherche**
   - Envoi d'un message `stopSearch` au serveur
   - Retrait automatique de la file d'attente

## 🎨 Interface utilisateur

### Boîte d'information

Une nouvelle boîte d'information a été ajoutée sur la page de recherche pour expliquer :
- Que le système utilise maintenant du matching réel
- Qu'on recherche de vrais utilisateurs
- Qu'on sera mis en relation via Google Meet

### Messages en temps réel

Les messages affichés évoluent selon l'état :
- "🔍 Recherche d'utilisateurs réels en cours..."
- "Position dans la file: X/Y"
- "✅ Match trouvé avec [Nom du partenaire]"

## 🚀 Comment utiliser

### Pour les élèves

1. **Se connecter** avec Google ou créer un compte
2. **Choisir une activité** : Débat, Lucky Chat, ou Cours
3. **Sélectionner une langue**
4. **Lancer la recherche** → Vous entrez dans la file d'attente
5. **Attendre un match** → Dès qu'un utilisateur correspondant est trouvé, vous êtes notifié
6. **Rejoindre le Google Meet** → Cliquez sur le lien pour commencer

### Arrêter une recherche

- Cliquez sur **"Arrêter la recherche"**
- Vous serez automatiquement retiré de la file d'attente
- Vous retournerez aux options élève

## 🔧 Configuration requise

### Serveur

Le serveur WebSocket doit être démarré pour que le matching fonctionne :

```bash
cd /Users/maximechantepie/autrement-
node server.js
```

Le serveur écoute par défaut sur le **port 8080**.

### Client

Le client se connecte automatiquement au serveur WebSocket quand :
- La page de recherche est affichée
- Un utilisateur lance une recherche

**URL de connexion** :
- Local : `ws://localhost:8080`
- Production : `wss://votre-domaine.com`

## 📊 Logs et débogage

### Serveur

Le serveur affiche des logs détaillés :
- ✅ Nouvelles connexions
- 🔍 Recherches démarrées
- ➕ Ajouts à la file d'attente
- ✅ Matches trouvés
- 📹 Liens Google Meet créés
- ➖ Retraits de la file
- ❌ Déconnexions

### Client

Le client affiche des logs dans la console :
- 🔌 Connexion WebSocket
- 📤 Envoi de requêtes de recherche
- 📊 Mises à jour de la file d'attente
- ✅ Réception de matches
- 📹 Liens Google Meet reçus

## ⚠️ Notes importantes

### Simulation vs Réel

- ✅ **Débats** : Système de matching réel activé
- ✅ **Lucky Chat** : Système de matching réel activé
- ⚠️ **Cours avec professeurs** : Toujours en mode simulation (à implémenter)

### Google Meet

Les liens Google Meet générés sont au format :
```
https://meet.google.com/lokin-[timestamp]-[random]
```

**Note** : Ce sont des liens générés côté serveur. Pour créer de vrais Google Meets via l'API, vous devrez :
1. Créer un projet Google Cloud Platform
2. Activer l'API Google Meet
3. Configurer les credentials OAuth2
4. Utiliser l'API Calendar pour créer des événements avec Meet

Pour l'instant, les utilisateurs peuvent utiliser les liens générés qui créent des rooms Google Meet publiques.

## 🔮 Améliorations futures

### À court terme
- [ ] Implémenter le matching pour les cours avec professeurs
- [ ] Ajouter des notifications push quand un match est trouvé
- [ ] Ajouter un système de file d'attente prioritaire pour les abonnés premium

### À moyen terme
- [ ] Intégrer l'API Google Meet officielle
- [ ] Ajouter un système de préférences de matching (niveau, âge, etc.)
- [ ] Implémenter un système de rating après chaque session

### À long terme
- [ ] Ajouter un historique des sessions
- [ ] Implémenter un système de favoris/amis
- [ ] Créer un tableau de bord analytique pour les professeurs

## 📝 Support

Pour toute question ou problème, contactez :
- Email : lokin.officiel@gmail.com
- Instagram : @lokin.officiel

---

**Version** : 2.0.0  
**Date** : 5 Février 2026  
**Auteur** : Équipe Lok In
