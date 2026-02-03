# 🔐 Système de Gestion Utilisateur - LOK IN

## Vue d'ensemble

Le système utilise **localStorage** comme base de données locale pour stocker les informations utilisateur et les abonnements. Chaque utilisateur a un identifiant unique basé sur son email.

## 📂 Structure des fichiers

- `user-database.js` - Système de gestion BDD
- `firebase-config.js` - Configuration Firebase (optionnel)
- `stripe-integration.js` - Documentation intégration Stripe
- `script.js` - Logique principale (modifiée)

## 🚀 Fonctionnalités

### 1. **Connexion & Persistance**
- ✅ Identifiant unique par email
- ✅ Session automatique (30 jours)
- ✅ Restauration automatique au chargement
- ✅ Séparation élèves/professeurs

### 2. **Abonnements**
- ✅ 3 types : Gratuit, Standard (4,99€/mois), Premium (120€/an)
- ✅ Sauvegarde automatique
- ✅ Vérification à chaque connexion
- ✅ Synchronisation avec Stripe

### 3. **Données stockées par utilisateur**

```javascript
{
  id: "user_xxx",
  email: "user@example.com",
  prenom: "Jean",
  nom: "Dupont",
  classe: "Terminale",
  isTeacher: false,
  photoURL: null,
  
  subscription: {
    type: "premium", // null, "standard", "premium"
    isActive: true,
    startDate: "2026-02-03T10:00:00.000Z",
    endDate: "2027-02-03T10:00:00.000Z",
    stripeCustomerId: "cus_xxxxx"
  },
  
  teacherData: { /* pour les profs */ },
  
  createdAt: "2026-02-03T10:00:00.000Z",
  lastLogin: "2026-02-03T12:00:00.000Z",
  updatedAt: "2026-02-03T12:00:00.000Z"
}
```

## 📖 Utilisation

### Connexion élève/professeur

Le système crée automatiquement un compte à la première connexion :

```javascript
// Première connexion = création compte
// Connexions suivantes = récupération données

// Au chargement de la page
const user = userDB.getCurrentUser();
if (user) {
  // Session active - restaurer les données
  sessionData.email = user.email;
  sessionData.isSubscribed = user.subscription.isActive;
}
```

### Mettre à jour un abonnement

```javascript
// Après paiement Stripe réussi
await userDB.updateSubscription('user@example.com', {
  type: 'premium',
  isActive: true,
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
  stripeCustomerId: 'cus_xxxxx'
});
```

### Vérifier l'abonnement

```javascript
// Vérifier si actif
const hasSubscription = userDB.hasActiveSubscription('user@example.com');

// Ou récupérer l'utilisateur complet
const user = userDB.getUserByEmail('user@example.com');
if (user.subscription.isActive) {
  // Accès premium
}
```

### Déconnexion

```javascript
userDB.logout(); // Supprime la session
```

## 🧪 Tests en console

```javascript
// Voir tous les utilisateurs
userDB.getAllUsers()

// Voir l'utilisateur connecté
userDB.getCurrentUser()

// Simuler un abonnement
simulateStripePayment('test@example.com', 'premium')

// Créer un compte manuellement
await userDB.saveUser({
  email: 'test@example.com',
  prenom: 'Test',
  nom: 'User',
  isTeacher: false,
  subscriptionType: 'premium',
  isSubscribed: true
})

// Export données (RGPD)
userDB.exportUserData('user@example.com')
```

## 🔄 Migration vers Firebase (Recommandé pour production)

### Pourquoi Firebase ?
- ☁️ Base de données cloud
- 🔥 Temps réel
- 🔐 Authentification intégrée
- 💰 Gratuit jusqu'à 50K lectures/jour

### Configuration

1. **Créer un projet Firebase**
   - Aller sur https://console.firebase.google.com/
   - Créer "lokin-app"
   - Activer Firestore Database
   - Activer Authentication (Email/Password)

2. **Copier la configuration**
   - Dans `firebase-config.js`, remplacer les valeurs

3. **Modifier `user-database.js`**
   - Remplacer `localStorage` par Firestore
   - Exemple :
   ```javascript
   import { doc, setDoc, getDoc } from 'firebase/firestore';
   
   async saveUser(userData) {
     const userRef = doc(db, 'users', userData.email);
     await setDoc(userRef, userData, { merge: true });
   }
   ```

## 🎯 Compte Admin

Email : `maxime.chantepiee@gmail.com`  
Mot de passe : `Prmt6g72`

Privilèges :
- ✅ Accès illimité (élève et prof)
- ✅ Toutes les matières autorisées
- ✅ Abonnement Premium permanent
- ✅ Pas de limite d'usage

## 📊 Structure localStorage

```
Clés utilisées :
- lokin_all_users : {userId: userData, ...}
- lokin_session : {userId, email, loginTime, expiresAt}
- lokin_user_data : Données utilisateur courant (ancien système)
- lokin_usage_count : Compteurs d'usage
```

## 🛡️ Sécurité

**⚠️ Important** : localStorage est visible côté client

**Pour la production :**
1. Migrer vers Firebase
2. Utiliser Firebase Authentication
3. Règles de sécurité Firestore
4. Webhook Stripe serveur
5. Ne jamais stocker de mots de passe en clair

## 🐛 Debugging

```javascript
// Voir toutes les données
localStorage

// Supprimer tout
localStorage.clear()

// Session active ?
userDB.getActiveSession()

// Forcer un abonnement (test)
const user = userDB.getUserByEmail('test@example.com');
user.subscription.isActive = true;
await userDB.saveUser(user);
```

## 📝 TODO Production

- [ ] Migrer vers Firebase/Supabase
- [ ] Implémenter webhooks Stripe
- [ ] Hasher les mots de passe
- [ ] Ajouter refresh token
- [ ] Rate limiting
- [ ] Email de confirmation
- [ ] Récupération mot de passe
- [ ] Export données RGPD
- [ ] Tests unitaires
