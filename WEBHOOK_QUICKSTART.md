# 🚀 Guide de Démarrage Rapide - Webhook Stripe

## ⚡ Installation rapide (5 minutes)

### 1. Installer les dépendances
```bash
npm install
```

### 2. Configurer les variables d'environnement dans Vercel

Allez sur [vercel.com](https://vercel.com) → Votre projet → Settings → Environment Variables

Ajoutez ces 3 variables :

| Variable | Où la trouver | Exemple |
|----------|---------------|---------|
| `STRIPE_SECRET_KEY` | [Dashboard Stripe > API Keys](https://dashboard.stripe.com/apikeys) | `sk_test_...` |
| `STRIPE_PUBLISHABLE_KEY` | [Dashboard Stripe > API Keys](https://dashboard.stripe.com/apikeys) | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Après création du webhook (étape 3) | `whsec_...` |

### 3. Créer le webhook dans Stripe

1. Allez sur [Dashboard Stripe > Webhooks](https://dashboard.stripe.com/webhooks)
2. Cliquez sur **+ Add endpoint**
3. URL : `https://lokin.online/api/stripe-webhook`
4. Événements à sélectionner :
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_failed`
5. Cliquez sur **Add endpoint**
6. **Copiez le Signing Secret** (`whsec_...`)
7. Ajoutez-le comme `STRIPE_WEBHOOK_SECRET` dans Vercel

### 4. Redéployer
```bash
# Si vous déployez depuis le CLI
vercel --prod

# Ou depuis Vercel Dashboard :
# Deployments → dernier déploiement → ⋯ → Redeploy
```

### 5. Tester

#### Test rapide avec Stripe CLI
```bash
# Installer Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# Ou télécharger : https://github.com/stripe/stripe-cli/releases

# Se connecter
stripe login

# Tester
stripe trigger checkout.session.completed --override checkout_session:customer_email=test@example.com
```

#### Test avec le Dashboard
1. [Webhooks](https://dashboard.stripe.com/webhooks) → Votre webhook
2. Onglet **Send test webhook**
3. Sélectionnez `checkout.session.completed`
4. Cliquez sur **Send test webhook**

### 6. Vérifier les logs
Vercel Dashboard → Functions → `/api/stripe-webhook` → Logs

Vous devriez voir :
```
✅ Abonné STANDARD : test@example.com
```

---

## 🧪 Test local (optionnel)

```bash
# 1. Installer Stripe CLI
brew install stripe/stripe-cli/stripe

# 2. Se connecter
stripe login

# 3. Rediriger les webhooks vers localhost
stripe listen --forward-to localhost:3000/api/stripe-webhook

# 4. Copier le webhook secret affiché (whsec_...)

# 5. Dans un autre terminal, déclencher un test
stripe trigger checkout.session.completed
```

---

## ✅ Checklist de vérification

- [ ] Les 3 variables d'environnement sont configurées dans Vercel
- [ ] Le webhook est créé dans Stripe Dashboard
- [ ] L'URL du webhook pointe vers `https://lokin.online/api/stripe-webhook`
- [ ] Les événements sont sélectionnés (checkout.session.completed minimum)
- [ ] Le projet est redéployé après l'ajout des variables
- [ ] Un test webhook envoie bien les logs dans Vercel

---

## 📝 Ce qui se passe quand un client paie

1. **Client paie** sur votre site avec Stripe Checkout
2. **Stripe envoie** un événement `checkout.session.completed` à votre webhook
3. **Webhook vérifie** la signature pour sécurité
4. **Webhook récupère** l'email et le type d'abonnement
5. **Webhook affiche** : `✅ Abonné STANDARD : email@client.com`
6. **Vous pouvez** maintenant ajouter la logique pour :
   - Mettre à jour Firebase
   - Envoyer un email de confirmation
   - Activer les fonctionnalités premium

---

## 🆘 Problème ?

Consultez le fichier [STRIPE_WEBHOOK_CONFIG.md](./STRIPE_WEBHOOK_CONFIG.md) pour le guide complet avec dépannage.

---

## 📞 Support

- [Documentation Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
