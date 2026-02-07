# 📦 Résumé du Webhook Stripe - Fichiers créés

## ✅ Fichiers créés

```
autrement-/
├── api/
│   ├── stripe-webhook.js              ← 🎯 WEBHOOK PRINCIPAL (à déployer)
│   ├── firebase-integration-example.js ← 📚 Exemple Firebase (template)
│   └── README.md                       ← 📖 Documentation du dossier /api
│
├── test-webhook.js                     ← 🧪 Script de test local
├── .env.example                        ← 📝 Template des variables d'env
│
├── WEBHOOK_QUICKSTART.md               ← ⚡ Guide de démarrage rapide (5 min)
├── STRIPE_WEBHOOK_CONFIG.md            ← 📘 Guide complet avec dépannage
└── WEBHOOK_FLOW.md                     ← 📊 Diagramme du flux de paiement
```

---

## 🎯 Réponse à vos questions

### ❓ Quelles variables d'environnement Stripe sont nécessaires ?

**3 variables obligatoires** :

| Variable | Où la trouver | Format |
|----------|---------------|--------|
| `STRIPE_SECRET_KEY` | [Dashboard Stripe > API Keys](https://dashboard.stripe.com/apikeys) | `sk_test_...` ou `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY` | [Dashboard Stripe > API Keys](https://dashboard.stripe.com/apikeys) | `pk_test_...` ou `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Après création du webhook | `whsec_...` |

---

### ❓ Où les ajouter dans Vercel ?

**Étapes détaillées** :

1. Allez sur [vercel.com](https://vercel.com)
2. Sélectionnez votre projet **"autrement-"**
3. Cliquez sur **Settings** ⚙️
4. Menu latéral : **Environment Variables**
5. Cliquez sur **Add New**
6. Pour chaque variable :
   ```
   Name: STRIPE_SECRET_KEY
   Value: sk_test_votre_cle
   Environment: ☑️ Production ☑️ Preview ☑️ Development
   ```
7. Répétez pour les 3 variables
8. **Important** : Pour `STRIPE_WEBHOOK_SECRET`, cochez UNIQUEMENT **Production**

**Puis redéployer** :
- Allez dans **Deployments**
- Dernier déploiement → **⋯** → **Redeploy**

---

### ❓ Comment configurer l'endpoint webhook dans le dashboard Stripe ?

**Étapes détaillées** :

1. **Accéder aux Webhooks**
   - Allez sur [https://dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)

2. **Créer un nouveau webhook**
   - Cliquez sur **+ Add endpoint**

3. **Configurer l'URL**
   ```
   Endpoint URL: https://lokin.online/api/stripe-webhook
   ```

4. **Sélectionner les événements**
   
   Minimum requis :
   - ✅ `checkout.session.completed` ← OBLIGATOIRE (paiement réussi)
   
   Recommandés :
   - ✅ `customer.subscription.updated` (modification d'abonnement)
   - ✅ `customer.subscription.deleted` (annulation)
   - ✅ `invoice.payment_failed` (échec de paiement)

5. **Version de l'API**
   - Sélectionnez **Latest API version**

6. **Créer l'endpoint**
   - Cliquez sur **Add endpoint**

7. **Copier le Signing Secret**
   - Une fois créé, cliquez sur votre webhook
   - Section **Signing secret**
   - Cliquez sur **Reveal** puis **Copy**
   - Ce sera votre `STRIPE_WEBHOOK_SECRET` (format : `whsec_...`)

8. **Ajouter dans Vercel**
   - Retournez dans Vercel > Settings > Environment Variables
   - Ajoutez `STRIPE_WEBHOOK_SECRET` avec la valeur copiée
   - **UNIQUEMENT pour Production**
   - Redéployez

---

### ❓ Comment tester que tout fonctionne ?

#### ✅ TEST 1 : Vérification de base (30 secondes)

**Vérifier que le webhook est accessible** :
```bash
curl -X POST https://lokin.online/api/stripe-webhook
```

Attendu : Erreur 400 (normal, car pas de signature) mais confirme que l'endpoint existe.

---

#### ✅ TEST 2 : Test avec Stripe Dashboard (2 minutes)

1. Allez sur [Dashboard Stripe > Webhooks](https://dashboard.stripe.com/webhooks)
2. Cliquez sur votre webhook
3. Onglet **"Send test webhook"**
4. Sélectionnez `checkout.session.completed`
5. Cliquez sur **"Send test webhook"**

**Vérifier les résultats** :
- Dans Stripe : devrait montrer "Succeeded" avec code 200
- Dans Vercel :
  1. Allez dans **Functions**
  2. Cliquez sur `/api/stripe-webhook`
  3. Vous verrez les logs :
     ```
     ✅ Abonné STANDARD : test@example.com
     ```

---

#### ✅ TEST 3 : Test avec Stripe CLI (développeurs)

**Installation** :
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows/Linux : https://github.com/stripe/stripe-cli/releases
```

**Utilisation** :
```bash
# 1. Se connecter à Stripe
stripe login

# 2. Déclencher un événement de test
stripe trigger checkout.session.completed \
  --override checkout_session:customer_email=test@example.com

# 3. Vérifier les logs dans Vercel
```

---

#### ✅ TEST 4 : Test avec un vrai paiement (Mode Test)

1. **Utiliser des cartes de test Stripe** :
   - Carte valide : `4242 4242 4242 4242`
   - CVV : n'importe quel 3 chiffres
   - Date : n'importe quelle date future
   - Email : votre vrai email (pour recevoir des notifications)

2. **Faire un paiement test** sur votre site

3. **Vérifier** :
   - Dans Stripe Dashboard > Payments : paiement apparaît
   - Dans Stripe Dashboard > Webhooks > Recent deliveries : événement envoyé
   - Dans Vercel > Functions > Logs : message d'abonnement

---

## 🎉 Résultat attendu

Quand tout fonctionne, vous devriez voir dans les **logs Vercel** :

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
🔑 Customer ID: cus_ABC123XYZ
🔑 Subscription ID: sub_123456789
════════════════════════════════════════
✅ Abonné STANDARD : client@example.com
```

---

## 🔄 Prochaines étapes

Maintenant que le webhook fonctionne, vous pouvez :

1. **Connecter Firebase** (voir `api/firebase-integration-example.js`)
2. **Envoyer des emails** de confirmation
3. **Mettre à jour votre frontend** pour afficher le statut d'abonnement
4. **Débloquer les fonctionnalités** premium dans l'application

---

## 📚 Documentation

| Fichier | Usage |
|---------|-------|
| [WEBHOOK_QUICKSTART.md](WEBHOOK_QUICKSTART.md) | ⚡ Démarrage rapide (5 min) |
| [STRIPE_WEBHOOK_CONFIG.md](STRIPE_WEBHOOK_CONFIG.md) | 📘 Configuration complète |
| [WEBHOOK_FLOW.md](WEBHOOK_FLOW.md) | 📊 Diagramme du flux |
| [api/README.md](api/README.md) | 📁 Doc du dossier /api |

---

## ✅ Checklist finale

Avant de passer en production, vérifiez :

- [ ] Les 3 variables d'environnement sont dans Vercel
- [ ] Le webhook est créé dans Stripe Dashboard
- [ ] L'URL pointe vers `https://lokin.online/api/stripe-webhook`
- [ ] Les événements sont sélectionnés (minimum : `checkout.session.completed`)
- [ ] Le `STRIPE_WEBHOOK_SECRET` est bien configuré
- [ ] Un test webhook renvoie 200 OK
- [ ] Les logs apparaissent dans Vercel
- [ ] Vous voyez le message : `✅ Abonné STANDARD : email`

---

## 🆘 Besoin d'aide ?

Consultez la section **Dépannage** dans [STRIPE_WEBHOOK_CONFIG.md](STRIPE_WEBHOOK_CONFIG.md)

---

**Webhook créé avec succès ! 🎉**
