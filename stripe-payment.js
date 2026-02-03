/**
 * Système de gestion des paiements Stripe
 * Détecte automatiquement les paiements et active les abonnements
 */

// Configuration Stripe
const STRIPE_CONFIG = {
  // Remplacez par votre clé publique Stripe
  publishableKey: 'pk_live_VOTRE_CLE_PUBLIQUE',
  
  // Prix IDs de vos produits Stripe
  prices: {
    standard: {
      monthly: 'price_XXXXXX', // Prix ID pour Standard mensuel (4,99€)
      amount: 499, // en centimes
      duration: 30 // jours
    },
    premium: {
      yearly: 'price_XXXXXX', // Prix ID pour Premium annuel (120€)
      amount: 12000, // en centimes
      duration: 365 // jours
    }
  }
};

/**
 * Vérifie si l'utilisateur revient après un paiement Stripe
 * Stripe redirige avec ?success=true et ?session_id=xxx
 */
function checkStripePaymentReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get('success');
  const sessionId = urlParams.get('session_id');
  const canceled = urlParams.get('canceled');
  
  if (canceled === 'true') {
    console.log('❌ Paiement annulé');
    alert('⚠️ Paiement annulé\n\nVous pouvez réessayer quand vous voulez.');
    // Nettoyer l'URL
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }
  
  if (success === 'true' && sessionId) {
    console.log('💳 Retour après paiement Stripe, session:', sessionId);
    handleSuccessfulPayment(sessionId);
  }
}

/**
 * Gère un paiement réussi
 * En production, cette fonction communiquerait avec votre serveur
 * qui aurait déjà reçu le webhook Stripe
 */
async function handleSuccessfulPayment(sessionId) {
  try {
    console.log('✅ Paiement détecté, activation de l\'abonnement...');
    
    // Récupérer l'utilisateur connecté
    const currentUser = userDB.getCurrentUser();
    if (!currentUser) {
      console.error('❌ Aucun utilisateur connecté');
      alert('Erreur: Vous devez être connecté pour activer votre abonnement.');
      return;
    }
    
    // Demander le type d'abonnement acheté
    // En production, cela serait automatique via le webhook
    const subscriptionType = prompt(
      'Quel abonnement avez-vous acheté?\n\n' +
      'Tapez "standard" pour Standard (4,99€/mois)\n' +
      'Tapez "premium" pour Premium (120€/an)',
      'standard'
    );
    
    if (!subscriptionType || (subscriptionType !== 'standard' && subscriptionType !== 'premium')) {
      console.log('❌ Type d\'abonnement invalide');
      return;
    }
    
    // Activer l'abonnement
    await activateSubscription(currentUser.email, subscriptionType, sessionId);
    
    // Nettoyer l'URL
    window.history.replaceState({}, document.title, window.location.pathname);
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'activation:', error);
    alert('Erreur lors de l\'activation de votre abonnement. Veuillez contacter le support.');
  }
}

/**
 * Active un abonnement pour un utilisateur
 */
async function activateSubscription(email, subscriptionType, stripeSessionId = null) {
  console.log(`💎 Activation abonnement ${subscriptionType} pour ${email}`);
  
  // Calculer la date de fin selon le type
  let endDate;
  let duration;
  
  if (subscriptionType === 'standard') {
    duration = 30; // 30 jours
    endDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
  } else if (subscriptionType === 'premium') {
    duration = 365; // 1 an
    endDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
  } else {
    throw new Error('Type d\'abonnement invalide');
  }
  
  // Préparer les données d'abonnement
  const subscriptionData = {
    type: subscriptionType,
    isActive: true,
    startDate: new Date().toISOString(),
    endDate: endDate.toISOString(),
    stripeSessionId: stripeSessionId || `manual_${Date.now()}`,
    activatedAt: new Date().toISOString()
  };
  
  try {
    // Mettre à jour dans la base de données
    const updatedUser = await userDB.updateSubscription(email, subscriptionData);
    
    console.log('✅ Abonnement activé avec succès !');
    console.log('📊 Données utilisateur mises à jour:', updatedUser);
    
    // Mettre à jour la session en cours si c'est l'utilisateur connecté
    if (sessionData.email === email) {
      sessionData.isSubscribed = true;
      sessionData.subscriptionType = subscriptionType;
      saveSessionToStorage();
    }
    
    // Afficher un message de succès
    alert(
      `🎉 Abonnement ${subscriptionType.toUpperCase()} activé !\n\n` +
      `✅ Valide jusqu'au ${endDate.toLocaleDateString('fr-FR')}\n\n` +
      `Vous avez maintenant accès à toutes les fonctionnalités ${subscriptionType === 'premium' ? 'illimitées' : 'du plan Standard'} !`
    );
    
    // Recharger la page pour appliquer les nouveaux accès
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    
    return updatedUser;
    
  } catch (error) {
    console.error('❌ Erreur mise à jour abonnement:', error);
    throw error;
  }
}

/**
 * Vérifie si un abonnement est encore valide
 */
function checkSubscriptionValidity(user) {
  if (!user.subscription || !user.subscription.isActive) {
    return false;
  }
  
  const now = new Date();
  const endDate = new Date(user.subscription.endDate);
  
  if (now > endDate) {
    console.log('⚠️ Abonnement expiré');
    return false;
  }
  
  return true;
}

/**
 * Désactive automatiquement les abonnements expirés
 */
async function checkAndDisableExpiredSubscriptions() {
  const currentUser = userDB.getCurrentUser();
  if (!currentUser) return;
  
  const isValid = checkSubscriptionValidity(currentUser);
  
  if (!isValid && currentUser.subscription.isActive) {
    console.log('⏰ Désactivation de l\'abonnement expiré');
    
    // Mettre à jour l'abonnement
    await userDB.updateSubscription(currentUser.email, {
      ...currentUser.subscription,
      isActive: false
    });
    
    // Mettre à jour la session
    sessionData.isSubscribed = false;
    sessionData.subscriptionType = null;
    saveSessionToStorage();
    
    alert('⚠️ Votre abonnement a expiré.\n\nRenouveler votre abonnement pour continuer à profiter des fonctionnalités premium.');
  }
}

/**
 * Obtient les accès accordés selon le type d'abonnement
 */
function getSubscriptionAccess(subscriptionType) {
  const access = {
    gratuit: {
      canUseAI: true,
      maxAIUsagePerDay: 5, // 5 utilisations gratuites par jour
      canSearchTeachers: false,
      canBookClasses: false,
      canAccessPremiumContent: false,
      features: ['IA basique (5/jour)', 'Révisions simples']
    },
    standard: {
      canUseAI: true,
      maxAIUsagePerDay: 50, // 50 utilisations par jour
      canSearchTeachers: true,
      canBookClasses: true,
      canAccessPremiumContent: false,
      features: ['IA avancée (50/jour)', 'Recherche professeurs', 'Réservation cours', 'Exercices personnalisés']
    },
    premium: {
      canUseAI: true,
      maxAIUsagePerDay: -1, // Illimité
      canSearchTeachers: true,
      canBookClasses: true,
      canAccessPremiumContent: true,
      features: ['IA illimitée', 'Tous les professeurs', 'Cours illimités', 'Contenu exclusif', 'Support prioritaire']
    }
  };
  
  return access[subscriptionType] || access.gratuit;
}

/**
 * Vérifie si l'utilisateur peut utiliser une fonctionnalité
 */
function canUseFeature(featureName) {
  const currentUser = userDB.getCurrentUser();
  if (!currentUser) {
    console.warn('⚠️ Aucun utilisateur connecté');
    return false;
  }
  
  const subscriptionType = currentUser.subscription.isActive 
    ? currentUser.subscription.type 
    : 'gratuit';
    
  const access = getSubscriptionAccess(subscriptionType);
  
  switch (featureName) {
    case 'ai':
      return access.canUseAI;
    case 'search_teachers':
      return access.canSearchTeachers;
    case 'book_classes':
      return access.canBookClasses;
    case 'premium_content':
      return access.canAccessPremiumContent;
    default:
      return false;
  }
}

/**
 * Affiche une modal d'upgrade si l'utilisateur n'a pas accès
 */
function showUpgradeModal(featureName) {
  const featureNames = {
    'ai': 'l\'intelligence artificielle',
    'search_teachers': 'la recherche de professeurs',
    'book_classes': 'la réservation de cours',
    'premium_content': 'le contenu premium'
  };
  
  const message = `🔒 Accès Restreint\n\n` +
    `Pour utiliser ${featureNames[featureName] || 'cette fonctionnalité'}, ` +
    `vous devez souscrire à un abonnement.\n\n` +
    `Voulez-vous voir les offres d'abonnement ?`;
  
  if (confirm(message)) {
    goTo('abonnement');
  }
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  console.log('💳 Système de paiement Stripe initialisé');
  
  // Vérifier si l'utilisateur revient après un paiement
  checkStripePaymentReturn();
  
  // Vérifier les abonnements expirés toutes les heures
  setInterval(checkAndDisableExpiredSubscriptions, 60 * 60 * 1000);
  
  // Vérification initiale
  checkAndDisableExpiredSubscriptions();
});

// Exposer les fonctions globalement
window.stripePayment = {
  activateSubscription,
  checkSubscriptionValidity,
  getSubscriptionAccess,
  canUseFeature,
  showUpgradeModal
};
