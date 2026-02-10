# Configuration du Webhook Stripe

## 🎯 Objectif
Configurer Stripe pour qu'il envoie automatiquement les événements de paiement à votre serveur.

## 📋 Étapes de configuration

### 1. Accéder au Dashboard Stripe
1. Allez sur https://dashboard.stripe.com
2. Assurez-vous d'être en mode **Test** (pour les tests) ou **Live** (pour la production)

### 2. Créer le Webhook
1. Dans le menu de gauche, cliquez sur **Developers** → **Webhooks**
2. Cliquez sur **Add endpoint**

### 3. Configurer l'URL du Webhook
**URL à utiliser :** 
```
https://web-production-d08b0.up.railway.app/api/stripe-webhook
```

### 4. Sélectionner les événements
Cochez les événements suivants :
- ✅ `checkout.session.completed` (quand un paiement est complété)
- ✅ `customer.subscription.updated` (quand un abonnement est mis à jour)
- ✅ `customer.subscription.deleted` (quand un abonnement est annulé)
- ✅ `invoice.payment_failed` (quand un paiement échoue)

### 5. Récupérer le Webhook Secret
1. Une fois le webhook créé, Stripe vous donne un **Signing secret**
2. Il ressemble à : `whsec_...`
3. **Copiez ce secret** - vous en aurez besoin pour Railway

### 6. Ajouter le secret à Railway
1. Allez sur https://railway.app
2. Ouvrez votre projet **LOK IN**
3. Allez dans **Variables**
4. Ajoutez ces 2 variables d'environnement :

```
STRIPE_SECRET_KEY=sk_test_... (ou sk_live_... en production)
STRIPE_WEBHOOK_SECRET=whsec_... (le secret du webhook)
```

5. Railway va automatiquement redéployer votre application

## ✅ Test du Webhook

### Test en production
1. Allez dans Stripe Dashboard → Developers → Webhooks
2. Cliquez sur votre webhook
3. Cliquez sur **Send test webhook**
4. Sélectionnez `checkout.session.completed`
5. Vérifiez les logs dans Railway pour voir si le webhook a été reçu

## 🔍 Vérification

Pour vérifier que tout fonctionne :

1. **Dans Stripe Dashboard** : 
   - Allez dans Webhooks
   - Vous devriez voir des ✅ verts pour les événements reçus

2. **Dans Railway logs** :
   - Vous devriez voir des messages comme :
   ```
   📥 Webhook Stripe reçu
   ✅ Signature Stripe vérifiée
   🎉 NOUVEAU PAIEMENT RÉUSSI !
   ✅ Abonnement STANDARD activé pour email@example.com
   ```

3. **Test complet** :
   - Faites un paiement test sur votre site
   - L'utilisateur devrait voir son abonnement actif immédiatement
   - Vérifiez dans `users.json` sur le serveur que l'abonnement est bien enregistré

## 🚨 Important

- **Mode Test** : Utilisez les clés de test (`sk_test_...` et `whsec_test_...`)
- **Mode Live** : Utilisez les clés de production (`sk_live_...` et `whsec_live_...`)
- **Sécurité** : Ne committez JAMAIS vos clés dans Git !

## 📞 En cas de problème

Si le webhook ne fonctionne pas :
1. Vérifiez que l'URL est correcte dans Stripe
2. Vérifiez que `STRIPE_WEBHOOK_SECRET` est bien dans Railway
3. Consultez les logs Railway pour voir les erreurs
4. Consultez les logs Stripe pour voir si le webhook est bien envoyé
