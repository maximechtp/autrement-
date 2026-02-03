/**
 * Système de gestion des utilisateurs avec base de données
 * Gère l'authentification, les abonnements et la persistance des données
 */

// Structure de données utilisateur
class UserDatabase {
  constructor() {
    this.STORAGE_KEY = 'lokin_user_data';
    this.USERS_KEY = 'lokin_all_users';
    this.SESSION_KEY = 'lokin_session';
  }

  /**
   * Génère un identifiant unique pour un utilisateur
   */
  generateUserId(email) {
    // Créer un ID unique basé sur l'email
    return 'user_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  }

  /**
   * Crée ou met à jour un utilisateur dans la base de données
   */
  async saveUser(userData) {
    try {
      const userId = this.generateUserId(userData.email);
      
      // Structure complète de l'utilisateur
      const userRecord = {
        id: userId,
        email: userData.email.toLowerCase(),
        prenom: userData.prenom || '',
        nom: userData.nom || '',
        classe: userData.classe || '',
        isTeacher: userData.isTeacher || false,
        photoURL: userData.photoURL || null,
        
        // Abonnement
        subscription: {
          type: userData.subscriptionType || null, // 'standard', 'premium', null
          isActive: userData.isSubscribed || false,
          startDate: userData.subscriptionStartDate || null,
          endDate: userData.subscriptionEndDate || null,
          stripeCustomerId: userData.stripeCustomerId || null
        },
        
        // Pour les professeurs
        teacherData: userData.isTeacher ? {
          authorizedSubjects: userData.authorizedSubjects || [],
          availableSubjects: userData.availableSubjects || [],
          courses: userData.courses || [],
          totalEarnings: userData.totalEarnings || 0,
          rating: userData.rating || null
        } : null,
        
        // Métadonnées
        createdAt: userData.createdAt || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Sauvegarder dans localStorage (simulation base de données)
      const allUsers = this.getAllUsers();
      allUsers[userId] = userRecord;
      localStorage.setItem(this.USERS_KEY, JSON.stringify(allUsers));

      console.log('✅ Utilisateur sauvegardé:', userId);
      return userRecord;
    } catch (error) {
      console.error('❌ Erreur sauvegarde utilisateur:', error);
      throw error;
    }
  }

  /**
   * Récupère tous les utilisateurs
   */
  getAllUsers() {
    try {
      const stored = localStorage.getItem(this.USERS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Erreur lecture utilisateurs:', error);
      return {};
    }
  }

  /**
   * Récupère un utilisateur par email
   */
  getUserByEmail(email) {
    if (!email) return null;
    
    const userId = this.generateUserId(email);
    const allUsers = this.getAllUsers();
    return allUsers[userId] || null;
  }

  /**
   * Récupère un utilisateur par ID
   */
  getUserById(userId) {
    const allUsers = this.getAllUsers();
    return allUsers[userId] || null;
  }

  /**
   * Connecte un utilisateur et crée une session
   */
  async loginUser(email, password) {
    try {
      const user = this.getUserByEmail(email);
      
      if (!user) {
        // Nouvel utilisateur - créer le compte
        console.log('📝 Création nouveau compte pour:', email);
        return null;
      }

      // Mettre à jour la date de dernière connexion
      user.lastLogin = new Date().toISOString();
      await this.saveUser(user);

      // Créer une session
      this.createSession(user);

      console.log('✅ Connexion réussie:', user.email);
      return user;
    } catch (error) {
      console.error('❌ Erreur connexion:', error);
      throw error;
    }
  }

  /**
   * Crée une session utilisateur
   */
  createSession(user) {
    const session = {
      userId: user.id,
      email: user.email,
      loginTime: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 jours
    };
    
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    
    console.log('🔐 Session créée pour:', user.email);
  }

  /**
   * Récupère la session active
   */
  getActiveSession() {
    try {
      const sessionStr = localStorage.getItem(this.SESSION_KEY);
      if (!sessionStr) return null;

      const session = JSON.parse(sessionStr);
      
      // Vérifier si la session a expiré
      if (new Date(session.expiresAt) < new Date()) {
        console.log('⏰ Session expirée');
        this.logout();
        return null;
      }

      return session;
    } catch (error) {
      console.error('Erreur lecture session:', error);
      return null;
    }
  }

  /**
   * Récupère l'utilisateur connecté
   */
  getCurrentUser() {
    const session = this.getActiveSession();
    if (!session) return null;

    // Récupérer les données utilisateur à jour
    return this.getUserById(session.userId);
  }

  /**
   * Met à jour l'abonnement d'un utilisateur
   */
  async updateSubscription(email, subscriptionData) {
    try {
      const user = this.getUserByEmail(email);
      if (!user) {
        console.error('Utilisateur non trouvé:', email);
        return null;
      }

      user.subscription = {
        ...user.subscription,
        ...subscriptionData,
        isActive: true,
        updatedAt: new Date().toISOString()
      };

      await this.saveUser(user);
      
      // Mettre à jour la session si c'est l'utilisateur connecté
      const currentSession = this.getActiveSession();
      if (currentSession && currentSession.email === email) {
        this.createSession(user);
      }

      console.log('✅ Abonnement mis à jour pour:', email);
      return user;
    } catch (error) {
      console.error('❌ Erreur mise à jour abonnement:', error);
      throw error;
    }
  }

  /**
   * Vérifie si un utilisateur a un abonnement actif
   */
  hasActiveSubscription(email) {
    const user = this.getUserByEmail(email);
    if (!user) return false;

    const sub = user.subscription;
    if (!sub || !sub.isActive) return false;

    // Vérifier la date d'expiration si présente
    if (sub.endDate && new Date(sub.endDate) < new Date()) {
      return false;
    }

    return true;
  }

  /**
   * Déconnexion
   */
  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('👋 Déconnexion réussie');
  }

  /**
   * Supprime complètement un compte
   */
  deleteAccount(email) {
    const userId = this.generateUserId(email);
    const allUsers = this.getAllUsers();
    delete allUsers[userId];
    localStorage.setItem(this.USERS_KEY, JSON.stringify(allUsers));
    this.logout();
    console.log('🗑️ Compte supprimé:', email);
  }

  /**
   * Pour les professeurs : met à jour les données enseignant
   */
  async updateTeacherData(email, teacherData) {
    try {
      const user = this.getUserByEmail(email);
      if (!user || !user.isTeacher) {
        console.error('Professeur non trouvé:', email);
        return null;
      }

      user.teacherData = {
        ...user.teacherData,
        ...teacherData,
        updatedAt: new Date().toISOString()
      };

      await this.saveUser(user);
      console.log('✅ Données professeur mises à jour:', email);
      return user;
    } catch (error) {
      console.error('❌ Erreur mise à jour professeur:', error);
      throw error;
    }
  }

  /**
   * Export des données utilisateur (RGPD)
   */
  exportUserData(email) {
    const user = this.getUserByEmail(email);
    if (!user) return null;
    
    return {
      ...user,
      exportDate: new Date().toISOString()
    };
  }
}

// Instance globale
const userDB = new UserDatabase();

// Export pour utilisation dans d'autres fichiers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UserDatabase, userDB };
}
