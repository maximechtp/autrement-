// Configuration Firebase pour LOK IN
// Base de données Firestore pour gérer les utilisateurs et abonnements

const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "lokin-app.firebaseapp.com",
  projectId: "lokin-app",
  storageBucket: "lokin-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "VOTRE_APP_ID"
};

// Instructions pour configurer Firebase :
// 1. Allez sur https://console.firebase.google.com/
// 2. Créez un nouveau projet "lokin-app"
// 3. Activez Firestore Database
// 4. Ajoutez une application Web
// 5. Copiez la configuration ici
// 6. Activez Authentication > Email/Password

// Initialisation Firebase (à décommenter après configuration)
/*
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
*/
