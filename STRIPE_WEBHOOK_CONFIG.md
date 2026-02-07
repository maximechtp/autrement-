# 🔧 Configuration du Webhook Stripe sur Vercel

## 📋 Table des matières
1. [Variables d'environnement nécessaires](#variables-denvironnement)
2. [Configuration dans Vercel](#configuration-vercel)
3. [Configuration dans Stripe Dashboard](#configuration-stripe)
4. [Tests et vérification](#tests)
5. [Dépannage](#dépannage)

---

## 1️⃣ Variables d'environnement nécessaires {#variables-denvironnement}

Vous avez besoin de **3 variables d'environnement Stripe** :

### `STRIPE_SECRET_KEY` (Clé secrète)
- **Où la trouver** : [Dashboard Stripe](https://dashboard.stripe.com/apikeys)
- **Format** : `sk_test_...` (test) ou `sk_live_...` (production)
- **Usage** : Authentifier les requêtes vers l'API Stripe

### `STRIPE_PUBLISHABLE_KEY` (Clé publique)
- **Où la trouver** : [Dashboard Stripe](https://dashboard.stripe.com/apikeys)
- **Format** : `pk_test_...` (test) ou `pk_live_...` (production)
- **Usage** : Initialiser Stripe.js côté client

### `STRIPE_WEBHOOK_SECRET` (Secret du webhook)
- **Où la trouver** : Voir section 3 ci-dessous (après création du webhook)
- **Format** : `whsec_...`
- **Usage** : Vérifier l'authenticité des événements webhook

---

## 2️⃣ Configuration dans Vercel {#configuration-vercel}

### Étape 1 : Accéder aux paramètres
1. Allez sur [vercel.com](https://vercel.com)
2. Sélectionnez votre projet
3. Cliquez sur **Settings** (⚙️)
4. Allez dans **Environment Variables**

### Étape 2 : Ajouter les variables
Pour chaque variable, cliquez sur **Add New** :

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `STRIPE_SECRET_KEY` | `sk_test_...` | Production, Preview, Development |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | Production, Preview, Development |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Production (uniquement) |

⚠️ **Important** : 
- Pour `STRIPE_WEBHOOK_SECRET`, cochez **UNIQUEMENT** "Production"
- Les deux autres peuvent être sur tous les environnements

### Étape 3 : Redéployer
Après avoir ajouté les variables :
1. Allez dans l'onglet **Deployments**
2. Trouvez votre dernier déploiement
3. Cliquez sur les **⋯** (trois points)
4. Sélectionnez **Redeploy**

---

## 3️⃣ Configuration dans Stripe Dashboard {#configuration-stripe}

### Étape 1 : Obtenir l'URL du webhook
Votre URL de webhook sera :
```
https://votre-domaine.vercel.app/api/stripe-webhook
```

Exemple avec votre projet :
```
https://lokin.online/api/stripe-webhook
```

### Étape 2 : Créer le webhook dans Stripe
1. Allez sur [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Cliquez sur **+ Add endpoint**
3. Entrez votre URL : `https://lokin.online/api/stripe-webhook`
4. Sélectionnez **Latest API version**

### Étape 3 : Sélectionner les événements à écouter
Cochez ces événements **minimum** :
- ✅ `checkout.session.completed` (paiement réussi)
- ✅ `customer.subscription.updated` (abonnement modifié)
- ✅ `customer.subscription.deleted` (abonnement annulé)
- ✅ `invoice.payment_failed` (échec de paiement)

### Étape 4 : Récupérer le signing secret
1. Après avoir créé le webhook, cliquez dessus
2. Dans la section **Signing secret**, cliquez sur **Reveal**
3. Copiez la valeur qui commence par `whsec_...`
4. **Ajoutez-la dans Vercel** comme `STRIPE_WEBHOOK_SECRET`

---

## 4️⃣ Tests et vérification {#tests}

### Test en local avec Stripe CLI

#### Installation
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Ou télécharger : https://github.com/stripe/stripe-cli/releases
```

#### Configuration
```bash
# Se connecter à Stripe
stripe login

# Transférer les événements webhook vers votre serveur local
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

Vous verrez un message :
```
> Ready! Your webhook signing secret is whsec_... (^C to quit)
```

Copiez ce secret et utilisez-le temporairement comme `STRIPE_WEBHOOK_SECRET` en local.

#### Déclencher un événement de test
```bash
stripe trigger checkout.session.completed
```

### Test en production

#### Avec Stripe Dashboard
1. Allez dans [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Cliquez sur votre webhook
3. Allez dans l'onglet **Send test webhook**
4. Sélectionnez `checkout.session.completed`
5. Cliquez sur **Send test webhook**

#### Vérifier les logs
1. Dans Vercel, allez dans **Functions**
2. Cliquez sur `/api/stripe-webhook`
3. Vous verrez les logs en temps réel

### Test avec un vrai paiement (mode test)
1. Utilisez une [carte de test Stripe](https://stripe.com/docs/testing#cards)
   - Carte valide : `4242 4242 4242 4242`
   - CVV : n'importe quel 3 chiffres
   - Date : n'importe quelle date future
2. Faites un paiement test sur votre site
3. Vérifiez les logs dans Vercel

---

## 5️⃣ Dépannage {#dépannage}

### ❌ Erreur : "Webhook signature verification failed"
**Cause** : Le `STRIPE_WEBHOOK_SECRET` est incorrect ou manquant

**Solution** :
1. Vérifiez que vous avez bien copié le secret depuis Stripe Dashboard
2. Assurez-vous que la variable est bien configurée dans Vercel
3. Redéployez votre projet après avoir ajouté la variable

### ❌ Erreur : "Missing stripe-signature header"
**Cause** : Le webhook n'est pas appelé par Stripe

**Solution** :
- Vérifiez que l'URL du webhook dans Stripe est correcte
- Testez avec `stripe trigger` en local

### ❌ Les logs n'apparaissent pas dans Vercel
**Cause** : Le webhook n'est pas déclenché ou l'URL est incorrecte

**Solution** :
1. Vérifiez l'URL du webhook dans Stripe Dashboard
2. Testez manuellement avec "Send test webhook"
3. Regardez l'onglet **Recent deliveries** dans Stripe pour voir si le webhook a été appelé

### ❌ Erreur 405 "Method not allowed"
**Cause** : Le webhook est appelé avec une méthode autre que POST

**Solution** :
- Normalement Stripe envoie toujours des POST
- Vérifiez que vous n'accédez pas au webhook directement dans le navigateur

---

## 📊 Exemple de log attendu

Quand tout fonctionne, vous devriez voir dans les logs Vercel :

```
📥 Webhook Stripe reçu
✅ Signature Stripe vérifiée
📋 Type d'événement: checkout.session.completed
════════════════════════════════════════
🎉 NOUVEAU PAIEMENT RÉUSSI !
════════════════════════════════════════
📧 Email: client@example.com
📦 Plan: STANDARD
💰 Montant: 9.99 EUR
🔑 Customer ID: cus_ABC123
🔑 Subscription ID: sub_XYZ789
════════════════════════════════════════
✅ Abonné STANDARD : client@example.com
```

---

## 🔄 Prochaines étapes

Une fois le webhook fonctionnel, vous devrez :

1. **Connecter Firebase** pour sauvegarder les abonnements
2. **Envoyer des emails** de confirmation
3. **Mettre à jour l'interface** pour activer les fonctionnalités premium
4. **Gérer les annulations** et les échecs de paiement

---

## 📚 Ressources utiles

- [Documentation Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Vercel Serverless Functions](https://vercel.com/docs/concepts/functions/serverless-functions)
- [Cartes de test Stripe](https://stripe.com/docs/testing#cards)

---

✅ **Configuration terminée !** Votre webhook est maintenant prêt à recevoir les paiements.
