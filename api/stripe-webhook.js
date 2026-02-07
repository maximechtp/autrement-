/**
 * ============================================
 * STRIPE WEBHOOK - Vercel Serverless Function
 * ============================================
 * 
 * Ce webhook écoute les événements de paiement Stripe et met à jour
 * automatiquement le statut d'abonnement des utilisateurs.
 * 
 * Compatible avec le déploiement sur Vercel.
 */

// Import de la bibliothèque Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Configuration pour désactiver le parsing automatique du body
 * Stripe a besoin du body brut pour vérifier la signature
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Fonction utilitaire pour lire le body brut de la requête
 * @param {Object} req - L'objet requête
 * @returns {Promise<Buffer>} Le body brut
 */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

/**
 * Handler principal du webhook
 * @param {Object} req - Requête HTTP
 * @param {Object} res - Réponse HTTP
 */
export default async function handler(req, res) {
  // ===== 1. VÉRIFIER LA MÉTHODE HTTP =====
  if (req.method !== 'POST') {
    console.log('❌ Méthode non autorisée:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('📥 Webhook Stripe reçu');

  try {
    // ===== 2. RÉCUPÉRER LE BODY BRUT =====
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    // Vérifier que la signature existe
    if (!sig) {
      console.log('❌ Signature Stripe manquante');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // ===== 3. VÉRIFIER LA SIGNATURE STRIPE =====
    let event;
    try {
      // Construire l'événement en vérifiant la signature
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      console.log('✅ Signature Stripe vérifiée');
    } catch (err) {
      console.error('❌ Erreur de vérification de signature:', err.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    // ===== 4. TRAITER L'ÉVÉNEMENT =====
    console.log('📋 Type d\'événement:', event.type);

    // Gérer l'événement checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // Récupérer les informations importantes
      const customerEmail = session.customer_email || session.customer_details?.email;
      const subscriptionId = session.subscription;
      const customerId = session.customer;
      const amountTotal = session.amount_total / 100; // Convertir de centimes en euros
      const currency = session.currency.toUpperCase();
      
      // Récupérer les métadonnées (plan type, etc.)
      const planType = session.metadata?.planType || 'standard';
      
      console.log('════════════════════════════════════════');
      console.log('🎉 NOUVEAU PAIEMENT RÉUSSI !');
      console.log('════════════════════════════════════════');
      console.log(`📧 Email: ${customerEmail}`);
      console.log(`📦 Plan: ${planType.toUpperCase()}`);
      console.log(`💰 Montant: ${amountTotal} ${currency}`);
      console.log(`🔑 Customer ID: ${customerId}`);
      console.log(`🔑 Subscription ID: ${subscriptionId}`);
      console.log('════════════════════════════════════════');

      // ===== 5. LOGIQUE MÉTIER =====
      // Afficher le message demandé
      console.log(`✅ Abonné ${planType.toUpperCase()} : ${customerEmail}`);

      // TODO: ICI, AJOUTER LA LOGIQUE POUR METTRE À JOUR VOTRE BASE DE DONNÉES
      // Exemples d'actions à faire :
      // - Mettre à jour Firebase/Firestore avec le statut d'abonnement
      // - Envoyer un email de confirmation à l'utilisateur
      // - Activer les fonctionnalités premium dans l'application
      
      /**
       * Exemple de mise à jour Firebase (à décommenter et adapter) :
       * 
       * const admin = require('firebase-admin');
       * const db = admin.firestore();
       * 
       * await db.collection('users').doc(customerEmail).update({
       *   isSubscribed: true,
       *   subscriptionType: planType,
       *   subscriptionId: subscriptionId,
       *   customerId: customerId,
       *   subscriptionStartDate: new Date().toISOString(),
       *   subscriptionStatus: 'active'
       * });
       */

    }

    // ===== 6. GÉRER D'AUTRES ÉVÉNEMENTS (OPTIONNEL) =====
    // Vous pouvez ajouter d'autres événements ici
    else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      console.log('🔄 Abonnement mis à jour:', subscription.id);
      // TODO: Mettre à jour le statut de l'abonnement dans votre DB
    }
    
    else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      console.log('❌ Abonnement annulé:', subscription.id);
      // TODO: Désactiver l'abonnement dans votre DB
    }
    
    else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      console.log('⚠️ Paiement échoué:', invoice.id);
      // TODO: Notifier l'utilisateur et gérer l'échec de paiement
    }

    // ===== 7. RETOURNER UNE RÉPONSE DE SUCCÈS =====
    // Important : toujours retourner 200 pour indiquer à Stripe que le webhook a été reçu
    return res.status(200).json({ 
      received: true,
      eventType: event.type,
      message: 'Webhook traité avec succès'
    });

  } catch (error) {
    // ===== 8. GESTION DES ERREURS =====
    console.error('❌ Erreur lors du traitement du webhook:', error);
    return res.status(500).json({ 
      error: 'Webhook handler failed',
      message: error.message 
    });
  }
}
