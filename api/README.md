# 📁 Dossier /api - Fonctions Serverless Vercel

Ce dossier contient les fonctions serverless (API endpoints) déployées sur Vercel.

## 📄 Fichiers

### `stripe-webhook.js` 
**✅ Prêt à l'emploi**

Webhook Stripe qui écoute les événements de paiement et met à jour automatiquement le statut d'abonnement des utilisateurs.

- **URL de production** : `https://lokin.online/api/stripe-webhook`
- **Méthode** : POST (appelée par Stripe)
- **Événements gérés** :
  - `checkout.session.completed` - Paiement réussi
  - `customer.subscription.updated` - Abonnement modifié
  - `customer.subscription.deleted` - Abonnement annulé
  - `invoice.payment_failed` - Échec de paiement

**Variables d'environnement requises** :
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

### `firebase-integration-example.js`
**📚 Exemple / Template**

Fichier d'exemple montrant comment intégrer Firebase/Firestore pour sauvegarder les abonnements.

**Ne pas déployer tel quel** - C'est un template à adapter selon vos besoins.

## 🚀 Déploiement

Ces fichiers sont automatiquement déployés par Vercel quand vous :
1. Poussez sur la branche principale (main/master)
2. Ou déployez manuellement avec `vercel --prod`

Chaque fichier `.js` dans `/api` devient automatiquement un endpoint :
- `/api/stripe-webhook.js` → `https://lokin.online/api/stripe-webhook`
- `/api/autre-fonction.js` → `https://lokin.online/api/autre-fonction`

## 📖 Documentation complète

- [WEBHOOK_QUICKSTART.md](../WEBHOOK_QUICKSTART.md) - Guide de démarrage rapide
- [STRIPE_WEBHOOK_CONFIG.md](../STRIPE_WEBHOOK_CONFIG.md) - Configuration détaillée
- [WEBHOOK_FLOW.md](../WEBHOOK_FLOW.md) - Diagramme du flux de paiement

## 🧪 Tests

### Test du webhook en local
```bash
node test-webhook.js
```

### Test avec Stripe CLI
```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
stripe trigger checkout.session.completed
```

### Test en production
Depuis le [Dashboard Stripe > Webhooks](https://dashboard.stripe.com/webhooks) :
1. Cliquez sur votre webhook
2. Onglet "Send test webhook"
3. Sélectionnez l'événement à tester

## 🔐 Sécurité

- ✅ Vérification de la signature Stripe (empêche les fausses requêtes)
- ✅ Variables d'environnement sécurisées dans Vercel
- ✅ HTTPS obligatoire pour les webhooks
- ✅ Logs sécurisés (ne pas logger les données sensibles)

## 📊 Monitoring

Les logs sont disponibles dans :
- **Vercel Dashboard** : Functions → `/api/stripe-webhook` → Logs
- **Stripe Dashboard** : Webhooks → Recent deliveries

## ⚠️ Important

- Ne jamais committer les fichiers `.env` avec de vraies clés
- Toujours tester avec les clés de test (`sk_test_...`) avant la production
- Vérifier que `STRIPE_WEBHOOK_SECRET` est bien configuré en production
- Redéployer après avoir ajouté/modifié des variables d'environnement

## 🆘 Support

En cas de problème, consultez la section Dépannage dans [STRIPE_WEBHOOK_CONFIG.md](../STRIPE_WEBHOOK_CONFIG.md).
