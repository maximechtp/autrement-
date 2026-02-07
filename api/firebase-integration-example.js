/**
 * ============================================
 * EXEMPLE D'INTÉGRATION FIREBASE
 * ============================================
 * 
 * Ce fichier montre comment intégrer Firebase/Firestore
 * avec votre webhook Stripe pour sauvegarder les abonnements.
 * 
 * À FAIRE :
 * 1. Créer un projet Firebase : https://console.firebase.google.com
 * 2. Créer une base Firestore
 * 3. Générer une clé de service : Settings > Service accounts > Generate new private key
 * 4. Ajouter les variables d'environnement dans Vercel
 */

// ===== INSTALLATION =====
// npm install firebase-admin

// ===== VARIABLES D'ENVIRONNEMENT NÉCESSAIRES =====
/*
Dans Vercel, ajoutez ces variables :

FIREBASE_PROJECT_ID=votre-projet-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@votre-projet.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

⚠️ Important : Pour FIREBASE_PRIVATE_KEY, gardez les guillemets et les \n
*/

const admin = require('firebase-admin');

// ===== INITIALISATION FIREBASE =====
// Cette fonction initialise Firebase une seule fois
function initializeFirebase() {
  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Remplacer les \n littéraux par de vrais retours à la ligne
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
      });
      console.log('✅ Firebase initialisé');
    } catch (error) {
      console.error('❌ Erreur initialisation Firebase:', error);
    }
  }
  return admin.firestore();
}

// ===== FONCTION POUR CRÉER/METTRE À JOUR UN ABONNEMENT =====
async function saveSubscription(subscriptionData) {
  const db = initializeFirebase();
  
  const {
    email,
    planType,
    subscriptionId,
    customerId,
    amount,
    currency,
    status = 'active'
  } = subscriptionData;

  try {
    // Créer ou mettre à jour le document utilisateur
    await db.collection('users').doc(email).set({
      email: email,
      isSubscribed: true,
      subscriptionType: planType, // 'standard' ou 'premium'
      subscriptionId: subscriptionId,
      customerId: customerId,
      subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
      subscriptionStatus: status,
      lastPayment: {
        amount: amount,
        currency: currency,
        date: admin.firestore.FieldValue.serverTimestamp()
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true }); // merge: true pour ne pas écraser les autres données

    console.log(`✅ Abonnement sauvegardé pour ${email}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur sauvegarde Firebase:', error);
    return { success: false, error: error.message };
  }
}

// ===== FONCTION POUR ANNULER UN ABONNEMENT =====
async function cancelSubscription(subscriptionId) {
  const db = initializeFirebase();

  try {
    // Trouver l'utilisateur avec ce subscriptionId
    const snapshot = await db.collection('users')
      .where('subscriptionId', '==', subscriptionId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log('⚠️ Aucun utilisateur trouvé avec ce subscriptionId');
      return { success: false, error: 'User not found' };
    }

    // Mettre à jour le statut
    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({
      isSubscribed: false,
      subscriptionStatus: 'canceled',
      subscriptionEndDate: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Abonnement annulé pour ${userDoc.id}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur annulation Firebase:', error);
    return { success: false, error: error.message };
  }
}

// ===== FONCTION POUR RÉCUPÉRER UN ABONNEMENT =====
async function getSubscription(email) {
  const db = initializeFirebase();

  try {
    const doc = await db.collection('users').doc(email).get();
    
    if (!doc.exists) {
      return { exists: false };
    }

    return { 
      exists: true, 
      data: doc.data() 
    };
  } catch (error) {
    console.error('❌ Erreur récupération Firebase:', error);
    return { exists: false, error: error.message };
  }
}

// ===== EXEMPLE D'UTILISATION DANS LE WEBHOOK =====
/*

// Dans votre fichier api/stripe-webhook.js, après avoir vérifié la signature :

if (event.type === 'checkout.session.completed') {
  const session = event.data.object;
  
  // Sauvegarder dans Firebase
  await saveSubscription({
    email: session.customer_email,
    planType: session.metadata?.planType || 'standard',
    subscriptionId: session.subscription,
    customerId: session.customer,
    amount: session.amount_total / 100,
    currency: session.currency.toUpperCase()
  });
}

else if (event.type === 'customer.subscription.deleted') {
  const subscription = event.data.object;
  
  // Annuler dans Firebase
  await cancelSubscription(subscription.id);
}

*/

// ===== STRUCTURE DE LA BASE FIRESTORE =====
/*

Collection: users
Document ID: email@example.com
{
  email: "client@example.com",
  isSubscribed: true,
  subscriptionType: "standard", // ou "premium"
  subscriptionId: "sub_1234567890",
  customerId: "cus_ABC123XYZ",
  subscriptionStatus: "active", // "active", "canceled", "past_due"
  subscriptionStartDate: Timestamp,
  subscriptionEndDate: Timestamp (si annulé),
  lastPayment: {
    amount: 9.99,
    currency: "EUR",
    date: Timestamp
  },
  updatedAt: Timestamp
}

*/

// ===== RÈGLES DE SÉCURITÉ FIRESTORE =====
/*

Collez ces règles dans Firestore > Règles :

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Les utilisateurs peuvent lire leurs propres données
    match /users/{email} {
      allow read: if request.auth != null && request.auth.token.email == email;
      allow write: if false; // Seul le serveur peut écrire via l'admin SDK
    }
  }
}

*/

// ===== VÉRIFICATION CÔTÉ CLIENT =====
/*

Dans votre frontend (script.js), pour vérifier si l'utilisateur est abonné :

async function checkSubscription(email) {
  try {
    const doc = await db.collection('users').doc(email).get();
    
    if (doc.exists && doc.data().isSubscribed) {
      const data = doc.data();
      console.log('✅ Utilisateur abonné:', data.subscriptionType);
      
      // Stocker dans sessionData
      sessionData.isSubscribed = true;
      sessionData.subscriptionType = data.subscriptionType;
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Erreur vérification abonnement:', error);
    return false;
  }
}

// Appeler au login
await checkSubscription(sessionData.email);

*/

module.exports = {
  saveSubscription,
  cancelSubscription,
  getSubscription
};
