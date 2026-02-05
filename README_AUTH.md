# Système d'Authentification LOK IN

## 📋 Vue d'ensemble

Le système d'authentification de LOK IN permet aux utilisateurs de :
- ✅ Se connecter avec email et mot de passe
- ✅ Créer un nouveau profil (élève ou professeur)
- ✅ Récupérer leur mot de passe par email

## 🔧 Fichiers principaux

### 1. `firebase-config.js`
Configuration Firebase et système d'authentification local (temporaire).

**Fonctionnalités :**
- Authentification par email/mot de passe avec hachage SHA-256
- Système de tokens de réinitialisation de mot de passe
- Stockage sécurisé dans localStorage

**Fonctions principales :**
```javascript
LocalAuth.createUser(email, password, displayName)  // Créer un compte
LocalAuth.signIn(email, password)                   // Se connecter
LocalAuth.sendPasswordReset(email)                  // Envoyer lien de réinitialisation
```

### 2. `user-database.js`
Gestion de la base de données utilisateurs.

**Nouvelles fonctions :**
```javascript
userDB.registerUser(email, password, userData)  // Enregistrer un nouvel utilisateur
userDB.loginUser(email, password)               // Connecter un utilisateur
userDB.requestPasswordReset(email)              // Demander réinitialisation
userDB.userExists(email)                        // Vérifier si utilisateur existe
```

### 3. `auth-handler.js`
Gestionnaire des interactions UI pour l'authentification.

**Fonctionnalités :**
- Gestion des modals de création de compte et récupération de mot de passe
- Validation des formulaires en temps réel
- Gestion des erreurs et retours utilisateur

**Fonctions principales :**
```javascript
initAuthHandlers()                              // Initialiser les gestionnaires
handleCreateAccountClick(accountType)           // Ouvrir modal création compte
handleForgotPasswordClick(accountType)          // Ouvrir modal mot de passe oublié
handleLoginSubmit(event, accountType)          // Gérer connexion
```

### 4. `auth-styles.css`
Styles CSS pour les modals et boutons d'authentification.

## 🎨 Interface utilisateur

### Pages de connexion
- **Élève** : `/index.html#eleve`
- **Professeur** : `/index.html#professeur`

### Nouveaux éléments UI

#### Boutons sous les formulaires :
1. **"Créer un profil"** : Ouvre un modal pour créer un nouveau compte
2. **"Mot de passe oublié ?"** : Ouvre un modal pour récupérer le mot de passe

#### Modal de création de profil
Champs :
- Prénom *
- Nom *
- Email *
- Mot de passe * (minimum 6 caractères)
- Confirmer mot de passe *
- Classe (optionnel, uniquement pour élèves)

#### Modal de récupération de mot de passe
Champs :
- Email *

## 🔐 Flux d'authentification

### Connexion
1. L'utilisateur saisit email et mot de passe
2. Le système vérifie les identifiants via `LocalAuth.signIn()`
3. Si valide, création d'une session via `userDB.loginUser()`
4. Redirection vers la page appropriée (élève-options ou prof)

### Inscription
1. L'utilisateur clique sur "Créer un profil"
2. Remplissage du formulaire dans le modal
3. Validation des données (email unique, mots de passe correspondants)
4. Création du compte via `userDB.registerUser()`
5. Connexion automatique et redirection

### Récupération de mot de passe
1. L'utilisateur clique sur "Mot de passe oublié ?"
2. Saisit son email dans le modal
3. Le système génère un token de réinitialisation
4. **Mode DEMO** : Le lien apparaît dans la console
5. **Mode PRODUCTION** : Un email est envoyé avec le lien

## 🚀 Migration vers Firebase

Pour activer Firebase Authentication (recommandé pour la production) :

1. Créer un projet sur [Firebase Console](https://console.firebase.google.com/)
2. Activer **Authentication > Email/Password**
3. Copier la configuration dans `firebase-config.js`
4. Décommenter le code Firebase dans `firebase-config.js`
5. Les fonctions `LocalAuth` seront automatiquement remplacées

## 🔒 Sécurité

### Actuel (localStorage)
- ⚠️ Mots de passe hachés avec SHA-256 + salt
- ⚠️ Stockage en localStorage (visible dans DevTools)
- ✅ Validation côté client
- ✅ Protection contre les injections

### Recommandé (Firebase)
- ✅ Hachage bcrypt côté serveur
- ✅ Tokens JWT sécurisés
- ✅ Protection CSRF
- ✅ Rate limiting automatique
- ✅ Vérification d'email
- ✅ Authentification à deux facteurs

## 📝 Validation des données

### Email
- Format valide : `example@domain.com`
- Unique dans la base de données

### Mot de passe
- Minimum 6 caractères
- Hachage avant stockage

### Prénom/Nom
- Requis
- Nettoyage des caractères spéciaux

## 🎯 Tests

### Créer un compte de test
```javascript
// Dans la console du navigateur
const testUser = await userDB.registerUser(
  'test@lokin.fr',
  'password123',
  {
    prenom: 'Jean',
    nom: 'Dupont',
    classe: '1ère',
    isTeacher: false
  }
);
```

### Se connecter
```javascript
const user = await userDB.loginUser('test@lokin.fr', 'password123');
```

### Récupérer mot de passe
```javascript
await userDB.requestPasswordReset('test@lokin.fr');
// Vérifier la console pour le lien (mode DEMO)
```

## 📱 Responsive

Les modals sont entièrement responsives :
- Desktop : Centré, largeur max 500px
- Mobile : Pleine largeur avec padding réduit
- Fermeture : Bouton X ou clic à l'extérieur

## 🐛 Débogage

Activer les logs détaillés :
```javascript
// Dans la console
localStorage.setItem('debug_auth', 'true');
```

Voir tous les utilisateurs :
```javascript
userDB.getAllUsers();
```

Réinitialiser l'authentification :
```javascript
localStorage.removeItem('lokin_auth_users');
localStorage.removeItem('lokin_reset_tokens');
```

## 📚 Ressources

- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

## ✨ Améliorations futures

- [ ] Vérification d'email après inscription
- [ ] Authentification à deux facteurs (2FA)
- [ ] Connexion avec Google améliorée
- [ ] Gestion des sessions avec JWT
- [ ] Rate limiting sur les tentatives de connexion
- [ ] Historique des connexions
- [ ] Notification d'activité suspecte
