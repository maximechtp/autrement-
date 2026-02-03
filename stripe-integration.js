/**
 * Documentation : Intégration Stripe avec système de base de données
 * 
 * Ce fichier explique comment connecter les paiements Stripe
 * avec le système de gestion utilisateur
 */

// ====== ÉTAPE 1 : Configurer Stripe ======

// Dans vos liens Stripe (déjà dans le HTML), ajoutez des paramètres :
// Exemple :
// https://buy.stripe.com/5kQ3co2Gp6y2cRZ4etd3i00?client_reference_id={USER_EMAIL}

// ====== ÉTAPE 2 : Créer un webhook Stripe ======

// Créez un fichier webhook-stripe.js sur votre serveur :
/*
const express = require('express');
const stripe = require('stripe')('sk_live_VOTRE_CLE_SECRETE');

app.post('/webhook/stripe', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = 'whsec_VOTRE_WEBHOOK_SECRET';
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Gérer l'événement
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      
      // Récupérer l'email du client
      const customerEmail = session.customer_email || session.customer_details.email;
      
      // Déterminer le type d'abonnement
      let subscriptionType = null;
      if (session.amount_total === 499) { // 4,99€
        subscriptionType = 'standard';
      } else if (session.amount_total === 12000) { // 120€
        subscriptionType = 'premium';
      }
      
      // Mettre à jour la base de données
      updateUserSubscription(customerEmail, subscriptionType);
      break;
      
    case 'customer.subscription.deleted':
      // Abonnement annulé
      const subscription = event.data.object;
      const customer = await stripe.customers.retrieve(subscription.customer);
      updateUserSubscription(customer.email, null);
      break;
  }
  
  res.json({received: true});
});
*/

// ====== ÉTAPE 3 : Fonction côté client pour simuler ======

/**
 * Simule un paiement réussi (à utiliser en développement)
 * En production, cette fonction sera appelée via le webhook Stripe
 */
function simulateStripePayment(email, subscriptionType) {
  console.log('💳 Simulation paiement Stripe');
  console.log('Email:', email);
  console.log('Type:', subscriptionType);
  
  // Calculer la date de fin
  let endDate;
  if (subscriptionType === 'standard') {
    endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours
  } else if (subscriptionType === 'premium') {
    endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 an
  }
  
  // Mettre à jour l'abonnement dans la base
  const subscriptionData = {
    type: subscriptionType,
    isActive: true,
    startDate: new Date().toISOString(),
    endDate: endDate.toISOString(),
    stripeCustomerId: 'cus_simulated_' + Date.now()
  };
  
  userDB.updateSubscription(email, subscriptionData)
    .then(user => {
      console.log('✅ Abonnement activé !');
      console.log('Utilisateur:', user);
      
      // Recharger la page ou afficher un message
      alert(`🎉 Abonnement ${subscriptionType} activé avec succès !`);
      
      // Mettre à jour sessionData si c'est l'utilisateur connecté
      if (sessionData.email === email) {
        sessionData.isSubscribed = true;
        sessionData.subscriptionType = subscriptionType;
      }
      
      // Rafraîchir la page pour afficher le nouveau statut
      location.reload();
    })
    .catch(error => {
      console.error('❌ Erreur activation abonnement:', error);
      alert('Erreur lors de l\'activation de l\'abonnement');
    });
}

// ====== ÉTAPE 4 : Modifier les liens Stripe dans le HTML ======

// Au lieu de liens directs, utiliser des boutons avec événements :
/*
<button onclick="handleStripeCheckout('standard')" class="plan-button">
  S'abonner – 4,99 € / mois
</button>

<script>
function handleStripeCheckout(planType) {
  if (!sessionData.isLoggedIn) {
    alert('Veuillez vous connecter pour souscrire');
    goTo('eleve');
    return;
  }
  
  // Enregistrer le plan sélectionné
  localStorage.setItem('pending_subscription', planType);
  
  // Rediriger vers Stripe avec l'email
  const email = encodeURIComponent(sessionData.email);
  let stripeUrl;
  
  if (planType === 'standard') {
    stripeUrl = `https://buy.stripe.com/5kQ3co2Gp6y2cRZ4etd3i00?prefilled_email=${email}`;
  } else if (planType === 'premium') {
    stripeUrl = `https://buy.stripe.com/aFa14g94Nf4y19hh1fd3i01?prefilled_email=${email}`;
  }
  
  window.location.href = stripeUrl;
}
</script>
*/

// ====== ÉTAPE 5 : Page de retour après paiement ======

// Créer une page success.html ou gérer le retour dans index.html :
/*
// Au chargement de la page, vérifier si on revient de Stripe
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  
  if (sessionId) {
    // L'utilisateur revient de Stripe
    const pendingPlan = localStorage.getItem('pending_subscription');
    
    if (pendingPlan && sessionData.isLoggedIn) {
      // Simuler l'activation (en prod, le webhook l'aura déjà fait)
      simulateStripePayment(sessionData.email, pendingPlan);
      localStorage.removeItem('pending_subscription');
    }
  }
});
*/

// ====== COMMANDES DE TEST ======

// Pour tester en console :
// simulateStripePayment('test@example.com', 'standard');
// simulateStripePayment('maxime.chantepiee@gmail.com', 'premium');

console.log('📘 Documentation Stripe chargée');
console.log('Utilisez simulateStripePayment(email, type) pour tester');
