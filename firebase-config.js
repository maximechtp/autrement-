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
// 7. Activez le lien de réinitialisation de mot de passe dans Authentication > Templates

// Initialisation Firebase (à décommenter après configuration)
/*
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { 
  db, 
  auth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
};
*/

// ===== SYSTÈME D'AUTHENTIFICATION LOCAL (TEMPORAIRE) =====
// En attendant la configuration Firebase, utilisation du localStorage

const LocalAuth = {
  // Création d'un nouveau compte
  async createUser(email, password, displayName) {
    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = this.getUserByEmail(email);
      if (existingUser) {
        throw new Error('Un compte existe déjà avec cet email');
      }

      // Créer le nouvel utilisateur (mot de passe haché)
      const hashedPassword = await this.hashPassword(password);
      const user = {
        uid: this.generateUID(email),
        email: email.toLowerCase(),
        displayName: displayName,
        passwordHash: hashedPassword,
        createdAt: new Date().toISOString(),
        emailVerified: false
      };

      // Sauvegarder
      const allUsers = this.getAllUsers();
      allUsers[email.toLowerCase()] = user;
      localStorage.setItem('lokin_auth_users', JSON.stringify(allUsers));

      console.log('✅ Compte créé:', email);
      return { user };
    } catch (error) {
      console.error('❌ Erreur création compte:', error);
      throw error;
    }
  },

  // Connexion
  async signIn(email, password) {
    try {
      const user = this.getUserByEmail(email);
      if (!user) {
        throw new Error('Aucun compte trouvé avec cet email');
      }

      // Vérifier le mot de passe
      const hashedPassword = await this.hashPassword(password);
      if (user.passwordHash !== hashedPassword) {
        throw new Error('Mot de passe incorrect');
      }

      console.log('✅ Connexion réussie:', email);
      return { user };
    } catch (error) {
      console.error('❌ Erreur connexion:', error);
      throw error;
    }
  },

  // Envoi email de réinitialisation de mot de passe
  async sendPasswordReset(email) {
    try {
      const user = this.getUserByEmail(email);
      if (!user) {
        throw new Error('Aucun compte trouvé avec cet email');
      }

      // Dans un vrai système, envoyer un email
      // Pour la démo, générer un token temporaire
      const resetToken = this.generateResetToken();
      const resetData = {
        email: email.toLowerCase(),
        token: resetToken,
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 heure
        createdAt: new Date().toISOString()
      };

      // Stocker le token
      const resetTokens = JSON.parse(localStorage.getItem('lokin_reset_tokens') || '{}');
      resetTokens[email.toLowerCase()] = resetData;
      localStorage.setItem('lokin_reset_tokens', JSON.stringify(resetTokens));

      // Dans un vrai système, on enverrait un email avec le lien
      // Pour la démo, afficher le lien dans la console
      const resetLink = `${window.location.origin}?reset=${resetToken}&email=${encodeURIComponent(email)}`;
      console.log('🔗 Lien de réinitialisation (DEMO):', resetLink);

      alert(`📧 Email de réinitialisation envoyé!\n\n(DEMO MODE: Vérifiez la console pour le lien)`);
      return true;
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      throw error;
    }
  },

  // Réinitialisation du mot de passe avec token
  async resetPassword(email, token, newPassword) {
    try {
      const resetTokens = JSON.parse(localStorage.getItem('lokin_reset_tokens') || '{}');
      const resetData = resetTokens[email.toLowerCase()];

      if (!resetData || resetData.token !== token) {
        throw new Error('Token invalide');
      }

      if (new Date(resetData.expiresAt) < new Date()) {
        throw new Error('Token expiré');
      }

      // Mettre à jour le mot de passe
      const user = this.getUserByEmail(email);
      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }

      user.passwordHash = await this.hashPassword(newPassword);
      const allUsers = this.getAllUsers();
      allUsers[email.toLowerCase()] = user;
      localStorage.setItem('lokin_auth_users', JSON.stringify(allUsers));

      // Supprimer le token utilisé
      delete resetTokens[email.toLowerCase()];
      localStorage.setItem('lokin_reset_tokens', JSON.stringify(resetTokens));

      console.log('✅ Mot de passe réinitialisé:', email);
      return true;
    } catch (error) {
      console.error('❌ Erreur réinitialisation:', error);
      throw error;
    }
  },

  // Utilitaires
  getAllUsers() {
    const stored = localStorage.getItem('lokin_auth_users');
    return stored ? JSON.parse(stored) : {};
  },

  getUserByEmail(email) {
    const allUsers = this.getAllUsers();
    return allUsers[email.toLowerCase()] || null;
  },

  generateUID(email) {
    return 'uid_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  },

  async hashPassword(password) {
    // Simple hash pour la démo (utiliser bcrypt en production)
    const encoder = new TextEncoder();
    const data = encoder.encode(password + '_lokin_salt_2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  generateResetToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
};

// Export pour utilisation dans les autres fichiers
if (typeof window !== 'undefined') {
  window.LocalAuth = LocalAuth;
}
