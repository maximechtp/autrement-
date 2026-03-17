console.log("Script loaded");

// Configuration de l'API REST
const API_BASE_URL = (() => {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1' || window.location.protocol === 'file:') {
    // Développement local
    return 'http://localhost:3000';
  } else {
    // Production : serveur déployé sur Railway
    return 'https://web-production-d08b0.up.railway.app';
  }
})();

console.log('🌐 API Base URL:', API_BASE_URL);

// Store current session data
let sessionData = {
  option: null,
  langue: null,
  matiere: null,
  niveau: null,
  meetLink: null,
  partnerName: null,
  isLoggedIn: false,
  userPhoto: null,
  isSubscribed: false,
  subscriptionType: null, // 'standard', 'premium', or null
  usageCount: 0,
  // Teacher data
  isTeacher: false,
  teacherStats: {
    courses: [],
    subscriptionStartDate: null
  }
};

// Stack to track navigation history
let navigationHistory = [];

// Questions de débat de société pour les Clashs
const CLASH_DEBATE_QUESTIONS = [
  "Les réseaux sociaux font-ils plus de mal que de bien aux jeunes ?",
  "Faut-il interdire les smartphones dans les écoles ?",
  "L'intelligence artificielle est-elle une menace pour l'humanité ?",
  "Devrait-on légaliser le cannabis à des fins récréatives ?",
  "Le nucléaire est-il une solution viable contre le réchauffement climatique ?",
  "Faut-il rendre le vote obligatoire ?",
  "Les jeux vidéo rendent-ils violents ?",
  "L'argent fait-il le bonheur ?",
  "Faut-il supprimer les notes à l'école ?",
  "Le télétravail est-il meilleur pour la productivité ?",
  "Devrait-on réduire la semaine de travail à 4 jours ?",
  "Les influenceurs ont-ils une responsabilité sociale ?",
  "Faut-il interdire les voitures en centre-ville ?",
  "Le sport professionnel est-il trop commercialisé ?",
  "L'exploration spatiale est-elle une priorité pour l'humanité ?",
  "Faut-il légaliser l'euthanasie ?",
  "Les animaux devraient-ils avoir des droits juridiques ?",
  "Le veganisme est-il la solution pour sauver la planète ?",
  "Faut-il limiter le temps d'écran des enfants par la loi ?",
  "La célébrité sur internet est-elle une vraie carrière ?",
  "L'école prépare-t-elle vraiment à la vie professionnelle ?",
  "Faut-il interdire la corrida ?",
  "Le streaming musical tue-t-il l'industrie musicale ?",
  "Les réseaux sociaux devraient-ils vérifier l'âge de leurs utilisateurs ?",
  "Faut-il taxer davantage les grandes fortunes ?",
  "Le patriotisme est-il encore d'actualité ?",
  "Les parents devraient-ils pouvoir choisir le sexe de leur enfant ?",
  "Faut-il rendre l'école obligatoire jusqu'à 18 ans ?",
  "La fast fashion est-elle un fléau écologique ?",
  "Les cryptomonnaies sont-elles l'avenir de la finance ?"
];

// Fonction pour obtenir une question de débat aléatoire
function getRandomDebateQuestion() {
  const randomIndex = Math.floor(Math.random() * CLASH_DEBATE_QUESTIONS.length);
  return CLASH_DEBATE_QUESTIONS[randomIndex];
}

// WebSocket connection
let ws = null;
let wsConnected = false;

// Geolocation data
let userLocation = {
  lat: null,
  lng: null,
  hasPermission: false,
  permissionAsked: false
};

/**
 * Obtenir la localisation approximative de l'utilisateur
 * Ajoute un décalage aléatoire de ~100km pour préserver la confidentialité
 */
function getApproximateLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Géolocalisation non supportée'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        // Ajouter un décalage aléatoire de ~100km
        // 1 degré ≈ 111km, donc ~0.9 degrés = ~100km
        const randomOffset = 0.9;
        const randomAngle = Math.random() * 2 * Math.PI;
        const randomDistance = Math.random() * randomOffset;
        
        const latOffset = randomDistance * Math.cos(randomAngle);
        const lngOffset = randomDistance * Math.sin(randomAngle) / Math.cos(latitude * Math.PI / 180);
        
        const approximateLocation = {
          lat: latitude + latOffset,
          lng: longitude + lngOffset,
          isApproximate: true,
          timestamp: new Date().toISOString()
        };
        
        console.log('📍 Localisation approximative obtenue (décalage ~100km)');
        resolve(approximateLocation);
      },
      (error) => {
        console.error('❌ Erreur géolocalisation:', error.message);
        reject(error);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

// ===== USAGE LIMIT MANAGEMENT =====
const USAGE_LIMITS = {
  chat: 3,
  debat: 3,
  cours: 0
};

const STORAGE_KEY_USAGE = 'lok_in_usage_count';
const STORAGE_KEY_HASH = 'lok_in_usage_hash';
const STORAGE_KEY_TIMESTAMP = 'lok_in_usage_ts';

function generateUsageHash(email, usageData) {
  // Simple hash pour vérification d'intégrité
  const str = `${email}_${JSON.stringify(usageData)}_lok_in_secret_2026`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function getUsageData(email) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_USAGE);
    
    if (!stored) {
      return { chat: 0, debat: 0, cours: 0 };
    }
    
    const allUsageData = JSON.parse(stored);
    const userData = allUsageData[email] || { chat: 0, debat: 0, cours: 0 };
    
    // Récupérer le hash spécifique à cet utilisateur
    const storedHashKey = `${STORAGE_KEY_HASH}_${email}`;
    const storedHash = localStorage.getItem(storedHashKey);
    
    // Si pas de hash stocké pour cet utilisateur, retourner les données (nouveau compte)
    if (!storedHash) {
      return userData;
    }
    
    // Vérifier l'intégrité pour cet utilisateur spécifique
    const expectedHash = generateUsageHash(email, userData);
    if (storedHash !== expectedHash) {
      console.warn(`Usage data tampering detected for ${email}. Blocking access.`);
      return { chat: 999, debat: 999, cours: 999 }; // Bloquer si manipulation
    }
    
    return userData;
  } catch (error) {
    console.error('Error reading usage data:', error);
    return { chat: 0, debat: 0, cours: 0 };
  }
}

function setUsageData(email, usageData) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_USAGE);
    const allUsageData = stored ? JSON.parse(stored) : {};
    
    allUsageData[email] = usageData;
    
    // Stocker les données de tous les utilisateurs
    localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(allUsageData));
    
    // Stocker un hash spécifique pour cet utilisateur
    const hashKey = `${STORAGE_KEY_HASH}_${email}`;
    localStorage.setItem(hashKey, generateUsageHash(email, usageData));
    
    // Stocker le timestamp global
    localStorage.setItem(STORAGE_KEY_TIMESTAMP, Date.now().toString());
    
    // Double stockage dans sessionStorage
    sessionStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(allUsageData));
    
    console.log(`✅ Usage data saved for ${email}:`, usageData);
  } catch (error) {
    console.error('Error saving usage data:', error);
  }
}

function incrementUsage(email, type) {
  const usageData = getUsageData(email);
  usageData[type] = (usageData[type] || 0) + 1;
  setUsageData(email, usageData);
  sessionData.usageCount = usageData;
  return usageData[type];
}

function checkUsageLimit(email, type) {
  // Comptes admin : accès illimité automatique
  const adminEmails = ['maxime.chantepiee@gmail.com', 'jan.smid14@gmail.com'];
  if (email && adminEmails.includes(email.toLowerCase())) {
    return { allowed: true, remaining: Infinity, current: 0, limit: Infinity };
  }
  
  // Si abonné, pas de limite
  if (sessionData.isSubscribed) {
    return { allowed: true, remaining: Infinity, current: 0 };
  }
  
  const usageData = getUsageData(email);
  const currentCount = usageData[type] || 0;
  const limit = USAGE_LIMITS[type];
  const remaining = Math.max(0, limit - currentCount);
  const allowed = currentCount < limit;
  
  return { allowed, remaining, current: currentCount, limit };
}

function showUsageLimitPage(type) {
  const typeNames = {
    chat: 'JustSpeak',
    debat: 'Clashs',
    cours: 'Cours'
  };
  
  // Afficher un message puis rediriger vers les abonnements
  alert(`⚠️ Limite atteinte\n\nVous avez épuisé vos ${USAGE_LIMITS[type]} essais gratuits pour ${typeNames[type]}.\n\nDécouvrez nos plans d'abonnement pour continuer !`);
  
  // Rediriger vers la page des abonnements
  if (sessionData.isLoggedIn) {
    showUserProfile();
  } else {
    // Si pas connecté, rediriger vers la page de connexion
    alert('Veuillez vous connecter pour voir les plans d\'abonnement.');
    goTo('eleve');
  }
}

// ===== TEACHER PROFILE MANAGEMENT =====
function calculateTeacherStats(courses) {
  // Calculate average score
  const coursesWithScores = courses.filter(c => c.score !== null && c.score !== undefined);
  const avgScore = coursesWithScores.length > 0 
    ? (coursesWithScores.reduce((sum, c) => sum + c.score, 0) / coursesWithScores.length).toFixed(1)
    : 0;
  
  // Calculate courses in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const coursesLast30Days = courses.filter(c => new Date(c.date) >= thirtyDaysAgo).length;
  
  // Total courses
  const totalCourses = courses.length;
  
  return {
    avgScore,
    coursesLast30Days,
    totalCourses
  };
}

function displayTeacherProfile(teacherData) {
  // Update teacher name
  document.getElementById('prof-display-name').textContent = teacherData.name || 'Professeur';
  
  // Calculate and display stats
  const stats = calculateTeacherStats(teacherData.courses || []);
  
  document.getElementById('prof-avg-score').textContent = stats.avgScore;
  document.getElementById('prof-courses-30days').textContent = stats.coursesLast30Days;
  document.getElementById('prof-courses-total').textContent = stats.totalCourses;
  
  // Navigate to prof page
  goTo('prof-dashboard');
}

// Demo function to show a sample teacher profile
function showSampleTeacherProfile() {
  // Sample data for demonstration
  const sampleTeacher = {
    name: 'Marie Dupont',
    courses: [
      { date: '2026-01-29', score: 4.8 },
      { date: '2026-01-28', score: 4.9 },
      { date: '2026-01-25', score: 4.7 },
      { date: '2026-01-20', score: 5.0 },
      { date: '2026-01-15', score: 4.6 },
      { date: '2026-01-10', score: 4.8 },
      { date: '2026-01-05', score: 4.9 },
      { date: '2025-12-28', score: 4.7 },
      { date: '2025-12-20', score: 4.8 },
      { date: '2025-12-15', score: 4.9 },
      { date: '2025-12-10', score: 5.0 },
      { date: '2025-12-05', score: 4.6 },
      { date: '2025-11-25', score: 4.8 },
      { date: '2025-11-20', score: 4.7 },
      { date: '2025-11-15', score: 4.9 }
    ]
  };
  
  displayTeacherProfile(sampleTeacher);
}

// ===== USER SESSION MANAGEMENT =====
function saveSessionToStorage() {
  // Optimisation: sauvegarder en un seul objet JSON
  const sessionObj = {
    isLoggedIn: true,
    email: sessionData.email || '',
    prenom: sessionData.prenom || '',
    nom: sessionData.nom || '',
    classe: sessionData.classe || '',
    password: sessionData.password || '',
    isSubscribed: sessionData.isSubscribed,
    userPhoto: sessionData.userPhoto || '',
    googleUser: sessionData.googleUser,
    isTeacher: sessionData.isTeacher,
    usageCount: sessionData.usageCount || {},
    subscriptionType: sessionData.subscriptionType
  };
  sessionStorage.setItem('lok_in_session', JSON.stringify(sessionObj));
}

// Optimisation: lire en un seul accès
function restoreSessionFromStorage() {
  try {
    const sessionStr = sessionStorage.getItem('lok_in_session');
    if (!sessionStr) return false;
    
    const sessionObj = JSON.parse(sessionStr);
    if (sessionObj.isLoggedIn) {
      Object.assign(sessionData, sessionObj);
      
      // Rediriger vers la page appropriée
      if (sessionData.isTeacher) {
        goTo('prof-dashboard');
        requestAnimationFrame(() => loadCourseRequests());
      } else {
        goTo('eleve-options');
      }
      
      return true;
    }
  } catch (e) {
    console.error('Error restoring session:', e);
  }
  return false;
}

function clearSessionStorage() {
  sessionStorage.removeItem('isLoggedIn');
  sessionStorage.removeItem('email');
  sessionStorage.removeItem('prenom');
  sessionStorage.removeItem('nom');
  sessionStorage.removeItem('classe');
  sessionStorage.removeItem('password');
  sessionStorage.removeItem('isSubscribed');
  sessionStorage.removeItem('userPhoto');
  sessionStorage.removeItem('googleUser');
  sessionStorage.removeItem('usageCount');
}

function checkSubscription(email) {
  // TODO: Remplacer par un appel API backend réel pour vérifier l'abonnement via Stripe
  // Exemple: fetch('/api/check-subscription', { method: 'POST', body: JSON.stringify({ email }) })
  
  // Pour la démo, simulation avec une liste d'emails abonnés
  const subscribedEmails = {
    'abonne@example.com': 'standard',
    'premium@gmail.com': 'premium',
    'subscriber@test.com': 'standard',
    'test@premium.com': 'premium'
  };
  
  // Vérifier si l'email est dans la liste des abonnés
  const subscriptionType = subscribedEmails[email?.toLowerCase()] || null;
  
  if (subscriptionType) {
    sessionData.isSubscribed = true;
    sessionData.subscriptionType = subscriptionType;
    console.log(`Subscription check for ${email}: ${subscriptionType.toUpperCase()}`);
  } else {
    sessionData.isSubscribed = false;
    sessionData.subscriptionType = null;
    console.log(`Subscription check for ${email}: NOT SUBSCRIBED`);
  }
  
  return sessionData.isSubscribed;
}

function updateUserAvatar() {
  const avatar = document.getElementById('user-avatar');
  const avatarImg = document.getElementById('avatar-img');
  
  if (sessionData.isLoggedIn) {
    avatar.classList.remove('hidden');
    
    // Generate avatar from initials (first letter of prenom + first letter of nom)
    const initials = (sessionData.prenom?.charAt(0) || '') + (sessionData.nom?.charAt(0) || '');
    avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=667eea&color=fff&size=200&bold=true`;
    
    // Update border and styling based on user type
    if (sessionData.isTeacher) {
      avatar.style.borderColor = '#3b82f6'; // Blue for teachers
      avatar.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
      avatar.title = `${sessionData.prenom} ${sessionData.nom}\n👨‍🏫 Enseignant - Accès Illimité`;
    } else {
      // Student - check subscription status
      if (sessionData.isSubscribed) {
        avatar.style.borderColor = '#10b981'; // Green for subscribed
        avatar.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
      } else {
        avatar.style.borderColor = '#ef4444'; // Red for not subscribed
        avatar.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
      }
      const subscriptionStatus = sessionData.isSubscribed ? 'Abonné' : 'Non abonné';
      avatar.title = `${sessionData.prenom} ${sessionData.nom}\n${subscriptionStatus}`;
    }
    
    // Utiliser un seul handler (optimisation)
    if (!avatar.dataset.handlerSet) {
      avatar.onclick = () => {
        if (sessionData.isTeacher) {
          showTeacherProfile();
        } else {
          showUserProfile();
        }
      };
      avatar.dataset.handlerSet = 'true';
    }
    
    // Afficher le bouton admin si l'utilisateur est administrateur
    updateAdminButton();
  } else {
    avatar.classList.add('hidden');
    const adminBtn = document.getElementById('btn-admin');
    if (adminBtn) {
      adminBtn.classList.add('hidden');
    }
  }
}

function updateAdminButton() {
  const adminEmails = ['maxime.chantepiee@gmail.com', 'jan.smid14@gmail.com'];
  const adminBtn = document.getElementById('btn-admin');
  
  if (sessionData.isLoggedIn && adminBtn) {
    if (adminEmails.includes(sessionData.email.toLowerCase())) {
      adminBtn.classList.remove('hidden');
      adminBtn.onclick = () => {
        window.location.href = 'admin-panel.html';
      };
    } else {
      adminBtn.classList.add('hidden');
    }
  }
}


function showUserProfile() {
  // Update profile information
  const profileAvatarImg = document.getElementById('profile-avatar-img');
  const profileName = document.getElementById('profile-name');
  const profileEmail = document.getElementById('profile-email');
  const profileClasse = document.getElementById('profile-classe');
  const profileStatus = document.getElementById('profile-status');
  
  // Set avatar
  if (sessionData.userPhoto) {
    profileAvatarImg.src = sessionData.userPhoto;
  } else {
    profileAvatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(sessionData.prenom + ' ' + sessionData.nom)}&background=667eea&color=fff&size=200`;
  }
  
  // Set profile info
  profileName.textContent = `${sessionData.prenom} ${sessionData.nom}`;
  profileEmail.textContent = `📧 ${sessionData.email}`;
  profileClasse.textContent = sessionData.classe ? `🏫 ${sessionData.classe}` : '🏫 Classe non spécifiée';
  
  // Set subscription status
  profileStatus.className = 'profile-status ' + (sessionData.isSubscribed ? 'subscribed' : 'not-subscribed');
  profileStatus.textContent = sessionData.isSubscribed ? 'Abonné' : 'Non abonné';
  
  // Update plan buttons based on current subscription
  updatePlanButtons();
  
  // Show/hide extra courses section for Premium subscribers
  updateExtraCoursesVisibility();
  
  // Initialize and display student statistics
  if (!sessionData.isTeacher) {
    initStudentStats(sessionData.email);
    displayStudentStats();
  }
  
  // Navigate to profile page
  goTo('user-profile');
}

function placeStudentStatsInEleveOptions() {
  const statsSection = document.getElementById('student-stats-section');
  const eleveOptionsPage = document.getElementById('eleve-options');

  if (!statsSection || !eleveOptionsPage) return;

  // Déplacer la section stats dans la page élève options
  // pour qu'elle s'affiche sur cette page plutôt que dans le profil.
  if (statsSection.parentElement !== eleveOptionsPage) {
    eleveOptionsPage.appendChild(statsSection);
  }
}

function updateExtraCoursesVisibility() {
  const extraCoursesSection = document.getElementById('extra-courses-section');
  if (extraCoursesSection) {
    if (sessionData.subscriptionType === 'premium') {
      extraCoursesSection.classList.remove('hidden');
    } else {
      extraCoursesSection.classList.add('hidden');
    }
  }
}

function updatePlanButtons() {
  const planButtons = document.querySelectorAll('.plan-button');
  planButtons.forEach(button => {
    button.disabled = false;
    button.textContent = 'Choisir ce plan';
    button.classList.remove('plan-current');
  });
  
  // Mark current plan
  if (!sessionData.isSubscribed) {
    // Free plan is current
    const freeButton = document.querySelector('.plan-card:first-child .plan-button');
    if (freeButton) {
      freeButton.disabled = true;
      freeButton.textContent = 'Plan actuel';
      freeButton.classList.add('plan-current');
    }
  } else if (sessionData.subscriptionType === 'standard') {
    // Standard plan is current
    const standardButton = document.querySelector('.plan-popular .plan-button');
    if (standardButton) {
      standardButton.disabled = true;
      standardButton.textContent = 'Plan actuel';
      standardButton.classList.add('plan-current');
    }
  } else if (sessionData.subscriptionType === 'premium') {
    // Premium plan is current
    const premiumButton = document.querySelector('.plan-premium .plan-button');
    if (premiumButton) {
      premiumButton.disabled = true;
      premiumButton.textContent = 'Plan actuel';
      premiumButton.classList.add('plan-current');
    }
  }
}

function showTeacherProfile() {
  // Update teacher profile information
  const profilProfAvatarImg = document.getElementById('profil-prof-avatar-img');
  const profilProfName = document.getElementById('profil-prof-name');
  const profilProfEmail = document.getElementById('profil-prof-email');
  
  // Set avatar
  if (sessionData.userPhoto) {
    profilProfAvatarImg.src = sessionData.userPhoto;
  } else {
    profilProfAvatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(sessionData.prenom + ' ' + sessionData.nom)}&background=3b82f6&color=fff&size=200`;
  }
  
  // Set profile info
  profilProfName.textContent = `${sessionData.prenom} ${sessionData.nom}`;
  profilProfEmail.textContent = `📧 ${sessionData.email}`;
  
  // Update teacher stats (for now, use placeholder values)
  document.getElementById('prof-total-cours').textContent = '0';
  document.getElementById('prof-note-moyenne').textContent = '-';
  document.getElementById('prof-heures-totales').textContent = '0h';
  document.getElementById('prof-matieres-actives').textContent = '0';
  
  // Navigate to teacher profile page
  goTo('profil-professeur');
}

function checkLoginRequired(targetPage) {
  const protectedPages = ['eleve-options', 'prof-options', 'langue-selection', 'matiere-selection', 'niveau-selection', 'option-confirmation'];
  
  if (protectedPages.includes(targetPage) && !sessionData.isLoggedIn) {
    alert('Vous devez vous connecter pour accéder à cette page.');
    goTo('eleve');
    return false;
  }
  return true;
}

// ===== GOOGLE SIGN-IN =====
function handleGoogleSignIn(response) {
  console.log('✅ Google Sign-In successful!');
  
  try {
    // Decode the JWT token to get user info
    const payload = parseJwt(response.credential);
    
    console.log('👤 Utilisateur Google:', payload);
    
    const email = payload.email;
    const prenom = payload.given_name || '';
    const nom = payload.family_name || '';
    const photoURL = payload.picture || null;
    
    // Créer ou mettre à jour l'utilisateur dans la base
    const userData = {
      email: email,
      prenom: prenom,
      nom: nom,
      classe: '',
      isTeacher: false,
      photoURL: photoURL,
      subscriptionType: null,
      isSubscribed: false
    };
    
    userDB.saveUser(userData).then(user => {
      // Créer la session
      userDB.createSession(user);
      
      // Mettre à jour sessionData
      sessionData.prenom = user.prenom;
      sessionData.nom = user.nom;
      sessionData.email = user.email;
      sessionData.classe = user.classe;
      sessionData.googleUser = true;
      sessionData.isLoggedIn = true;
      sessionData.userPhoto = user.photoURL;
      sessionData.isTeacher = user.isTeacher;
      sessionData.isSubscribed = user.subscription.isActive;
      sessionData.subscriptionType = user.subscription.type;
      sessionData.usageCount = getUsageData(user.email);
      
      console.log('✅ Connexion Google réussie pour:', user.email);
      console.log('📊 Statut abonnement:', sessionData.isSubscribed);
      
      // Fermer le modal Google s'il existe
      if (activeGoogleModal && document.body.contains(activeGoogleModal)) {
        document.body.removeChild(activeGoogleModal);
        activeGoogleModal = null;
        console.log('🔒 Modal Google fermé automatiquement');
      }
      
      // Sauvegarder la session
      saveSessionToStorage();
      
      // Update avatar
      updateUserAvatar();
      
      // Redirection après un court délai pour une transition fluide
      setTimeout(() => {
        goTo("eleve-options");
      }, 100);
    }).catch(error => {
      console.error('❌ Erreur sauvegarde utilisateur Google:', error);
      alert('Erreur lors de la connexion. Veuillez réessayer.');
    });
    
  } catch (error) {
    console.error('❌ Error processing Google Sign-In response:', error);
    alert('Erreur lors du traitement de la réponse Google. Veuillez réessayer.');
  }
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Error parsing JWT:', e);
    return {};
  }
}

// Stockage global du modal Google pour pouvoir le fermer après connexion
let activeGoogleModal = null;

function initGoogleSignIn() {
  const btnGoogleLogin = document.getElementById('btn-google-login');
  if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', () => {
      // Check if Google API is loaded
      if (typeof google === 'undefined' || !google.accounts) {
        alert('⌛ Chargement de Google Sign-In en cours...\n\nVeuillez patienter quelques secondes et réessayer.');
        console.warn('Google API not loaded yet. Please wait and try again.');
        
        // Attendre 2 secondes et réessayer automatiquement
        setTimeout(() => {
          if (typeof google !== 'undefined' && google.accounts) {
            console.log('✅ Google API chargée, vous pouvez maintenant vous connecter');
            alert('✅ Google Sign-In prêt ! Vous pouvez maintenant cliquer sur le bouton.');
          }
        }, 2000);
        return;
      }
      
      try {
        console.log('🔑 Initialisation Google Sign-In...');
        
        // Initialize Google Sign-In
        google.accounts.id.initialize({
          client_id: '854092990889-0jri4gljn2tca49ke5m9oetucdrvjlfh.apps.googleusercontent.com',
          callback: handleGoogleSignIn,
          auto_select: false,
          cancel_on_tap_outside: true
        });
        
        // Afficher directement le bouton de sélection de compte
        // Créer un overlay semi-transparent
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0, 0, 0, 0.5)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        
        const buttonDiv = document.createElement('div');
        buttonDiv.style.position = 'relative';
        buttonDiv.style.background = 'white';
        buttonDiv.style.padding = '30px';
        buttonDiv.style.borderRadius = '10px';
        buttonDiv.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        
        const googleBtnContainer = document.createElement('div');
        googleBtnContainer.id = 'google-signin-button-temp';
        
        buttonDiv.appendChild(googleBtnContainer);
        overlay.appendChild(buttonDiv);
        document.body.appendChild(overlay);
        
        // Stocker la référence globale
        activeGoogleModal = overlay;
        
        // Fermer automatiquement après authentification ou au clic sur l'overlay
        const closePopup = () => {
          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
            activeGoogleModal = null;
          }
        };
        
        // Fermer si on clique sur l'overlay (pas sur le bouton)
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            closePopup();
          }
        });
        
        google.accounts.id.renderButton(
          googleBtnContainer,
          { theme: 'outline', size: 'large', text: 'signin_with', width: 300 }
        );
        
        // Simuler automatiquement un clic sur le bouton Google pour ouvrir le sélecteur
        setTimeout(() => {
          const googleBtn = googleBtnContainer.querySelector('[role="button"]');
          if (googleBtn) {
            console.log('🖱️ Clic automatique sur le bouton Google');
            googleBtn.click();
          }
        }, 100);
      } catch (error) {
        console.error('❌ Error initializing Google Sign-In:', error);
        alert('❌ Erreur lors de l\'initialisation de Google Sign-In.\n\nVeuillez vérifier votre connexion Internet et réessayer.');
      }
    });
  }
}

// Simulate Google Sign-In for development/testing (DISABLED - Use real Google Auth)
// Uncomment only for development without internet
function simulateGoogleSignIn() {
  console.warn('⚠️ Simulation Google Sign-In (mode développement)');
  
  const confirmed = confirm('MODE DÉVELOPPEMENT\n\nSimulation de connexion Google\n\nVoulez-vous continuer avec un compte simulé ?');
  if (!confirmed) return;
  
  const email = prompt('Entrez un email pour la simulation:', 'test@gmail.com');
  if (!email) return;
  
  // Simulate user data
  const userData = {
    email: email,
    prenom: 'Utilisateur',
    nom: 'Simulé',
    classe: '',
    isTeacher: false,
    photoURL: null,
    subscriptionType: null,
    isSubscribed: false
  };
  
  // Créer/mettre à jour dans la base
  userDB.saveUser(userData).then(user => {
    userDB.createSession(user);
    
    sessionData.prenom = user.prenom;
    sessionData.nom = user.nom;
    sessionData.email = user.email;
    sessionData.classe = user.classe;
    sessionData.googleUser = true;
    sessionData.isLoggedIn = true;
    sessionData.userPhoto = user.photoURL;
    sessionData.isTeacher = user.isTeacher;
    sessionData.isSubscribed = user.subscription.isActive;
    sessionData.subscriptionType = user.subscription.type;
    sessionData.usageCount = getUsageData(user.email);
    
    console.log('⚙️ Simulation: Google Sign-In successful');
    
    saveSessionToStorage();
    updateUserAvatar();
    goTo("eleve-options");
  });
}

// ===== VALIDATION FORM =====
function sanitizeText(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validateForm() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const errors = {
    email: '',
    password: ''
  };

  if (!email) {
    errors.email = 'L\'email est requis';
  } else if (!validateEmail(email)) {
    errors.email = 'Email invalide';
  }
  if (!password) {
    errors.password = 'Le mot de passe est requis';
  } else if (password.length < 6) {
    errors.password = 'Le mot de passe doit contenir au moins 6 caractères';
  }

  // Display errors
  document.getElementById('error-email').textContent = sanitizeText(errors.email);
  document.getElementById('error-password').textContent = sanitizeText(errors.password);

  // Update input styling
  document.getElementById('email').classList.toggle('error', !!errors.email);
  document.getElementById('password').classList.toggle('error', !!errors.password);

  const isValid = !errors.email && !errors.password;
  document.getElementById('btn-submit-eleve').disabled = !isValid;

  return isValid;
}

function setupFormValidation() {
  // Form validation for students
  const form = document.getElementById('form-eleve');
  const inputs = form.querySelectorAll('#email, #password');
  
  inputs.forEach(input => {
    input.addEventListener('input', validateForm);
    input.addEventListener('change', validateForm);
  });

  // Le submit est maintenant géré par auth-handler.js
  // On garde juste la validation
  
  // Form validation for teachers
  setupProfessorFormValidation();
}

function validateProfessorForm() {
  const email = document.getElementById('prof-email').value.trim();
  const password = document.getElementById('prof-password').value;

  const errors = {
    email: '',
    password: ''
  };

  if (!email) {
    errors.email = 'L\'email est requis';
  } else if (!validateEmail(email)) {
    errors.email = 'Email invalide';
  }
  if (!password) {
    errors.password = 'Le mot de passe est requis';
  } else if (password.length < 6) {
    errors.password = 'Le mot de passe doit contenir au moins 6 caractères';
  }

  // Display errors
  document.getElementById('error-prof-email').textContent = sanitizeText(errors.email);
  document.getElementById('error-prof-password').textContent = sanitizeText(errors.password);

  // Update input styling
  document.getElementById('prof-email').classList.toggle('error', !!errors.email);
  document.getElementById('prof-password').classList.toggle('error', !!errors.password);

  const isValid = !errors.email && !errors.password;
  document.getElementById('btn-submit-professeur').disabled = !isValid;

  return isValid;
}

function setupProfessorFormValidation() {
  const form = document.getElementById('form-professeur');
  if (!form) return;
  
  const inputs = form.querySelectorAll('#prof-email, #prof-password');
  
  inputs.forEach(input => {
    input.addEventListener('input', validateProfessorForm);
    input.addEventListener('change', validateProfessorForm);
  });

  // Le submit est maintenant géré par auth-handler.js
  // On garde juste la validation
}

function initGoogleSignInProfessor() {
  const btnGoogleLoginProf = document.getElementById('btn-google-login-prof');
  if (btnGoogleLoginProf) {
    btnGoogleLoginProf.addEventListener('click', () => {
      // Check if Google API is loaded
      if (typeof google === 'undefined' || !google.accounts) {
        alert('⌛ Chargement de Google Sign-In en cours...\n\nVeuillez patienter quelques secondes et réessayer.');
        console.warn('Google API not loaded yet. Please wait and try again.');
        
        // Attendre 2 secondes et réessayer automatiquement
        setTimeout(() => {
          if (typeof google !== 'undefined' && google.accounts) {
            console.log('✅ Google API chargée, vous pouvez maintenant vous connecter');
            alert('✅ Google Sign-In prêt ! Vous pouvez maintenant cliquer sur le bouton.');
          }
        }, 2000);
        return;
      }
      
      try {
        console.log('🔑 Initialisation Google Sign-In (Professeur)...');
        
        // Initialize Google Sign-In
        google.accounts.id.initialize({
          client_id: '854092990889-0jri4gljn2tca49ke5m9oetucdrvjlfh.apps.googleusercontent.com',
          callback: handleGoogleSignInProfessor,
          auto_select: false,
          cancel_on_tap_outside: true
        });
        
        // Afficher directement le bouton de sélection de compte
        // Créer un overlay semi-transparent
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0, 0, 0, 0.5)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        
        const buttonDiv = document.createElement('div');
        buttonDiv.style.position = 'relative';
        buttonDiv.style.background = 'white';
        buttonDiv.style.padding = '30px';
        buttonDiv.style.borderRadius = '10px';
        buttonDiv.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        
        const googleBtnContainer = document.createElement('div');
        googleBtnContainer.id = 'google-signin-button-temp-prof';
        
        buttonDiv.appendChild(googleBtnContainer);
        overlay.appendChild(buttonDiv);
        document.body.appendChild(overlay);
        
        // Stocker la référence globale
        activeGoogleModal = overlay;
        
        // Fermer automatiquement après authentification ou au clic sur l'overlay
        const closePopup = () => {
          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
            activeGoogleModal = null;
          }
        };
        
        // Fermer si on clique sur l'overlay (pas sur le bouton)
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            closePopup();
          }
        });
        
        google.accounts.id.renderButton(
          googleBtnContainer,
          { theme: 'outline', size: 'large', text: 'signin_with', width: 300 }
        );
        
        // Simuler automatiquement un clic sur le bouton Google pour ouvrir le sélecteur
        setTimeout(() => {
          const googleBtn = googleBtnContainer.querySelector('[role="button"]');
          if (googleBtn) {
            console.log('🖱️ Clic automatique sur le bouton Google');
            googleBtn.click();
          }
        }, 100);
      } catch (error) {
        console.error('❌ Error initializing Google Sign-In:', error);
        alert('❌ Erreur lors de l\'initialisation de Google Sign-In.\n\nVeuillez vérifier votre connexion Internet et réessayer.');
      }
    });
  }
}

function handleGoogleSignInProfessor(response) {
  console.log('✅ Google Sign-In successful (Professor)!');
  
  try {
    const payload = parseJwt(response.credential);
    
    console.log('👨\u200d🏫 Professeur Google:', payload);
    
    const email = payload.email;
    const prenom = payload.given_name || '';
    const nom = payload.family_name || '';
    const photoURL = payload.picture || null;
    
    // Créer ou mettre à jour l'utilisateur professeur dans la base
    const userData = {
      email: email,
      prenom: prenom,
      nom: nom,
      classe: 'Professeur',
      isTeacher: true,
      photoURL: photoURL,
      subscriptionType: null,
      isSubscribed: false
    };
    
    userDB.saveUser(userData).then(user => {
      // Créer la session
      userDB.createSession(user);
      
      // Mettre à jour sessionData
      sessionData.prenom = user.prenom;
      sessionData.nom = user.nom;
      sessionData.email = user.email;
      sessionData.classe = 'Professeur';
      sessionData.googleUser = true;
      sessionData.isLoggedIn = true;
      sessionData.userPhoto = user.photoURL;
      sessionData.isTeacher = true;
      sessionData.isSubscribed = user.subscription.isActive;
      sessionData.subscriptionType = user.subscription.type;
      sessionData.usageCount = getUsageData(user.email);
      
      console.log('✅ Connexion Google réussie pour professeur:', user.email);
      console.log('📊 Statut abonnement:', sessionData.isSubscribed);
      
      // Fermer le modal Google s'il existe
      if (activeGoogleModal && document.body.contains(activeGoogleModal)) {
        document.body.removeChild(activeGoogleModal);
        activeGoogleModal = null;
        console.log('🔒 Modal Google fermé automatiquement');
      }
      
      // Sauvegarder la session
      saveSessionToStorage();
      
      // Update avatar
      updateUserAvatar();
      
      // Redirection après un court délai pour une transition fluide
      setTimeout(() => {
        goTo("prof-dashboard");
      }, 100);
    }).catch(error => {
      console.error('❌ Erreur sauvegarde professeur Google:', error);
      alert('Erreur lors de la connexion. Veuillez réessayer.');
    });
    
  } catch (error) {
    console.error('❌ Error processing Google Sign-In response:', error);
    alert('Erreur lors du traitement de la réponse Google. Veuillez réessayer.');
  }
}

// Simulate Google Sign-In for professor (DISABLED - Use real Google Auth)
// Uncomment only for development without internet
function simulateGoogleSignInProfessor() {
  console.warn('⚠️ Simulation Google Sign-In Professeur (mode développement)');
  
  const confirmed = confirm('MODE DÉVELOPPEMENT\n\nSimulation de connexion Google Professeur\n\nVoulez-vous continuer avec un compte simulé ?');
  if (!confirmed) return;
  
  const email = prompt('Entrez un email pour la simulation:', 'prof@gmail.com');
  if (!email) return;
  
  const userData = {
    email: email,
    prenom: 'Professeur',
    nom: 'Simulé',
    classe: 'Professeur',
    isTeacher: true,
    photoURL: null,
    subscriptionType: null,
    isSubscribed: false
  };
  
  userDB.saveUser(userData).then(user => {
    userDB.createSession(user);
    
    sessionData.prenom = user.prenom;
    sessionData.nom = user.nom;
    sessionData.email = user.email;
    sessionData.classe = 'Professeur';
    sessionData.googleUser = true;
    sessionData.isLoggedIn = true;
    sessionData.userPhoto = user.photoURL;
    sessionData.isTeacher = true;
    sessionData.isSubscribed = user.subscription.isActive;
    sessionData.subscriptionType = user.subscription.type;
    sessionData.usageCount = getUsageData(user.email);
    
    console.log('⚙️ Simulation: Professor Google Sign-In successful');
    
    saveSessionToStorage();
    updateUserAvatar();
    goTo("prof-dashboard");
  });
}

// ===== MODAL MANAGER - ACCESSIBILITY & FOCUS MANAGEMENT =====
class ModalManager {
  constructor(modalId, overlayId) {
    this.modal = document.getElementById(modalId);
    this.overlay = document.getElementById(overlayId);
    this.triggerButton = null;
    this.previousFocus = null;
    this.keydownHandler = null;
  }

  getFocusableElements() {
    return Array.from(this.modal.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetParent !== null);
  }

  setupFocusTrap() {
    const focusableElements = this.getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    this.keydownHandler = (e) => {
      // ESC pour fermer
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        return;
      }

      // Tab - circular focus trap
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    this.modal.addEventListener('keydown', this.keydownHandler);
    firstElement.focus();
  }

  open(triggerButton) {
    this.triggerButton = triggerButton || document.activeElement;
    this.previousFocus = document.activeElement;
    
    this.modal.classList.remove('hidden');
    this.overlay.classList.remove('hidden');
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Setup focus trap et overlay click
    this.setupFocusTrap();
    this.setupOverlayClick();
  }

  close() {
    this.modal.classList.add('hidden');
    this.overlay.classList.add('hidden');
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Remove event listeners
    if (this.keydownHandler) {
      this.modal.removeEventListener('keydown', this.keydownHandler);
    }
    if (this.overlayClickHandler) {
      this.overlay.removeEventListener('click', this.overlayClickHandler);
    }
    
    // Return focus to trigger button
    if (this.previousFocus && this.previousFocus.focus) {
      setTimeout(() => this.previousFocus.focus(), 100);
    }
  }

  setupOverlayClick() {
    this.overlayClickHandler = (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    };
    this.overlay.addEventListener('click', this.overlayClickHandler);
  }
}

let modalManager = null;

function initializeModalManager() {
  modalManager = new ModalManager('confirmation', 'modal-overlay');
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded fired");

  // Setup accessibility
  initializeModalManager();

  // Setup form validation
  setupFormValidation();
  
  // Setup authentication handlers (nouveau système)
  if (typeof initAuthHandlers !== 'undefined') {
    initAuthHandlers();
  }
  
  // Setup Google Sign-In
  initGoogleSignIn();
  initGoogleSignInProfessor();

  // Setup back button
  setupBackButton();

  // Ensure main option buttons work even if global handler misses clicks
  try {
    const optionButtons = document.querySelectorAll('[data-action="chooseOption"]');
    if (optionButtons && optionButtons.length) {
      optionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const param = btn.dataset.param || btn.getAttribute('data-param');
          try {
            handleChooseOption(param);
          } catch (err) {
            console.error('Error in direct chooseOption handler:', err);
          }
        });
      });
    }
  } catch (err) {
    console.warn('Could not attach direct handlers to option buttons:', err);
  }
  
  // Setup footer scroll detection
  initializeFooterScroll();
  
  // Setup language card selection (multi-select)
  setupLanguageCardSelection();
  
  // Restaurer la session depuis la base de données
  const user = userDB.getCurrentUser();
  if (user) {
    console.log('🔄 Restauration session automatique pour:', user.email);
    
    // Restaurer sessionData depuis la base de données
    sessionData.prenom = user.prenom;
    sessionData.nom = user.nom;
    sessionData.email = user.email;
    sessionData.classe = user.classe;
    sessionData.isLoggedIn = true;
    sessionData.userPhoto = user.photoURL;
    sessionData.isTeacher = user.isTeacher;
    sessionData.isSubscribed = user.subscription.isActive;
    sessionData.subscriptionType = user.subscription.type;
    sessionData.usageCount = getUsageData(user.email);

    // Important: persister aussi dans sessionStorage pour les pages annexes
    // (ex: admin-panel.html) qui valident l'accès via lok_in_session.
    saveSessionToStorage();
    
    console.log('✅ Session restaurée automatiquement');
    console.log('📊 Abonnement actif:', sessionData.isSubscribed);
    
    updateUserAvatar();
    
    // NE PAS rediriger automatiquement - laisser l'utilisateur sur la page d'accueil
    // Il pourra cliquer sur "Je suis élève" ou "Je suis professeur" pour naviguer
    console.log('ℹ️ Session active - utilisateur peut naviguer depuis l\'accueil');
  }
  
  // Afficher la page d'accueil par défaut
  console.log('📱 Affichage page d\'accueil');
  goTo("home");

  /**
   * Handler réutilisable pour les boutons d'option (cours, debat, chat).
   * Peut être appelé depuis le global click handler ou directement depuis
   * des listeners attachés aux boutons pour garantir la réactivité.
   */
  function handleChooseOption(param) {
    console.log("handleChooseOption called with:", param);
    sessionData.option = param;

    console.log("chooseOption clicked with param:", param);
    console.log("User logged in:", sessionData.isLoggedIn);
    console.log("User email:", sessionData.email);

    const currentUser = userDB.getCurrentUser();
    let isAdmin = false;
    if (currentUser && typeof stripePayment !== 'undefined') {
      const adminEmails = ['maxime.chantepiee@gmail.com', 'jan.smid14@gmail.com'];
      isAdmin = adminEmails.includes((currentUser.email || '').toLowerCase());

      const canUse = stripePayment.canUseFeature(
        param === 'chat' ? 'ai' : 
        param === 'debat' ? 'ai' : 
        'book_classes'
      );

      if (!isAdmin && !canUse && param === 'cours') {
        const access = stripePayment.getSubscriptionAccess(
          currentUser.subscription.isActive ? currentUser.subscription.type : 'gratuit'
        );
        if (!access.canBookClasses) {
          console.log('❌ Accès refusé: cours réservés aux abonnés');
          stripePayment.showUpgradeModal('book_classes');
          return;
        }
      }
    }

    if (!sessionData.isSubscribed) {
      let activityType = param === 'chat' ? 'chat' : (param === 'debat' ? 'debat' : 'cours');
      const emailToCheck = sessionData.email || 'anonymous_user';
      const usageStatus = checkUsageLimit(emailToCheck, activityType);
      console.log('Usage status:', usageStatus);

      if (!usageStatus.allowed) {
        showUsageLimitPage(activityType);
        return;
      }

      if (!isAdmin) {
        incrementUsage(emailToCheck, activityType);
        if (usageStatus.remaining <= 1) {
          const typeNames = { chat: 'JustSpeak', debat: 'Clash', cours: 'Cours' };
          alert(`Attention: Il vous reste ${usageStatus.remaining} essai gratuit pour ${typeNames[activityType]}.`);
        }
      }
    }

    if (param === 'cours') {
      openConfirmation(param);
    } else if (param === 'chat' || param === 'debat') {
      goTo('langue-selection');
      updateLanguageTitle(param);
    }
  }

  document.body.addEventListener("click", (event) => {
    try {
      const clicked = event.target.closest('[data-action]');
      if (!clicked) return;

      const target = clicked;
      const action = target.dataset.action;
      // If this action was already handled in capture phase, skip to avoid double-run
      if (target.dataset._dispatched === '1') {
        delete target.dataset._dispatched;
        return;
      }
      const param = target.dataset.param;

      if (!action) return;

      console.log("CLICK detected on action:", action, param);

    switch (action) {
      case "goTo":
        goTo(param);
        break;
      
      case "checkLoginAndGo":
        // Si déjà connecté, aller directement aux options, sinon à la page de connexion
        console.log("checkLoginAndGo triggered, isLoggedIn:", sessionData.isLoggedIn, "param:", param);
        
        // Attendre un peu pour s'assurer que la session est bien chargée
        requestAnimationFrame(() => {
          if (sessionData.isLoggedIn) {
            console.log("User is logged in, checking user type. isTeacher:", sessionData.isTeacher);
            
            // Vérifier le type d'utilisateur et la destination
            if (sessionData.isTeacher) {
              // Si c'est un professeur
              if (param === "eleve") {
                alert("Vous êtes déjà connecté en tant que professeur. Déconnectez-vous pour accéder à l'espace élève.");
                return;
              }
              // Professeur clique sur "Je suis professeur" - retour à la page prof
              console.log("✅ Redirecting teacher to prof page");
              goTo("prof-dashboard");
              // Charger les demandes de cours immédiatement
              requestAnimationFrame(() => loadCourseRequests());
            } else {
              // Si c'est un élève
              if (param === "professeur") {
                alert("Vous êtes déjà connecté en tant qu'élève. Déconnectez-vous pour accéder à l'espace professeur.");
                return;
              }
              // Élève clique sur "Je suis élève" - retour aux options
              console.log("✅ Redirecting student to eleve-options");
              goTo("eleve-options");
            }
          } else {
            console.log("User not logged in, going to:", param);
            goTo(param);
          }
        });
        break;

      case "chooseOption":
        handleChooseOption(param);
        break;

      case "continueFromOption":
        // For courses, go directly to confirmation
        openConfirmation(sessionData.option);
        break;

      case "cancelFromOption":
        goTo("eleve-options");
        sessionData.option = null;
        break;

      case "confirmLanguage":
        confirmLanguage();
        break;

      case "cancelLanguage":
        goTo("eleve-options");
        sessionData.option = null;
        break;
      
      case "subscribe":
        handleSubscription(param);
        break;
      
      case "logout":
        handleLogout();
        break;
      
      case "showSampleTeacher":
        showSampleTeacherProfile();
        break;
      
      case "viewSubscriptionPlans":
        if (sessionData.isLoggedIn) {
          showUserProfile();
        } else {
          alert('⚠️ Veuillez vous connecter pour accéder aux plans d\'abonnement.');
          goTo('eleve');
        }
        break;

      case "confirmChoice":
        sessionData.matiere = document.getElementById("matiere-confirm").value;
        sessionData.niveau = document.getElementById("niveau-confirm").value;
        
        // Pour les cours, lancer directement la recherche de professeur
        if (sessionData.option === "cours") {
          modalManager.close();
          goTo("search");
          startSearchingTeacher();
        } else {
          modalManager.close();
          goTo("search");
          startSearching();
        }
        break;

      case "cancelChoice":
        modalManager.close();
        goTo("eleve-options");
        break;

      case "startDebate":
        goTo("search");
        startSearching();
        break;

      case "stopSearch":
        // Envoyer la demande d'arrêt au serveur
        if (ws && wsConnected) {
          ws.send(JSON.stringify({ type: 'stopSearch' }));
          console.log('🛑 Demande d\'arrêt envoyée au serveur');
        }
        // Retourner aux options
        goTo("eleve-options");
        break;

      case "acceptConnection":
        createOrJoinMeet();
        break;

      case "refuseConnection":
        goTo("search");
        break;

      case "acceptClashMatch":
        acceptClashMatch();
        break;

      case "refuseClashMatch":
        refuseClashMatch();
        break;

      case "copyMeetLink":
        copyToClipboard();
        break;

      case "endCall":
        goTo("rating");
        break;

      case "rate":
        setRating(param);
        break;

      case "submitRating":
        // Enregistrer la note donnée pour le partenaire (si présent)
        try {
          submitCallRating();
        } catch (e) {
          console.warn('Erreur lors de l\'enregistrement de la note:', e);
        }

        // Afficher l'invitation Google Review après l'évaluation
        setTimeout(() => {
          showGoogleReviewPrompt();
        }, 500);

        // Rediriger vers le profil utilisateur ou l'accueil
        if (sessionData.isLoggedIn) {
          showUserProfile();
        } else {
          goTo("home");
        }
        break;

      case "startProfWaiting":
        goTo("prof-waiting");
        break;

      case "stopProfWaiting":
        goTo("prof-dashboard");
        break;
      
      case "toggleMatiere":
        toggleMatiereAvailability(target);
        break;

      case "demanderAutorisation":
        demanderAutorisationMatieres();
        break;

      case "openReviewModal":
        openReviewModal();
        break;

      case "closeReviewModal":
        closeReviewModal();
        break;

      case "goToStripeCheckout":
        goToStripeCheckout(param);
        break;

      default:
        console.warn("Action inconnue :", action);
    }
    } catch (err) {
      console.error('Error handling global click:', err);
    }
  });

  // Capture-phase dispatcher to increase robustness (fires before bubbling handlers)
  document.documentElement.addEventListener('click', (event) => {
    try {
      const clicked = event.target.closest('[data-action]');
      if (!clicked) return;

      const action = clicked.dataset.action;
      const param = clicked.dataset.param;
      if (!action) return;

      // mark as dispatched so bubble handler skips duplicate
      clicked.dataset._dispatched = '1';

      // Try dispatching safely
      dispatchAction(action, param, clicked);
    } catch (e) {
      console.warn('Capture dispatcher error', e);
    }
  }, true);

  // Make data-action elements keyboard accessible and add key handlers
  function enhanceActionElements(root = document) {
    const els = (root || document).querySelectorAll('[data-action]');
    els.forEach(el => {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.hasAttribute('role')) el.setAttribute('role', el.tagName.toLowerCase() === 'button' ? 'button' : 'button');
      if (!el.dataset._keybound) {
        el.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            el.click();
          }
        });
        el.dataset._keybound = '1';
      }
    });
  }

  // Observe DOM changes to enhance newly added action elements
  const actionObserver = new MutationObserver(muts => {
    muts.forEach(m => {
      if (m.addedNodes && m.addedNodes.length) {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1) enhanceActionElements(node);
        });
      }
    });
  });
  actionObserver.observe(document.body, { childList: true, subtree: true });
  // initial enhancement
  enhanceActionElements(document);

  // Handler pour fermer la modale review en cliquant en dehors
  const reviewModal = document.getElementById('review-modal');
  if (reviewModal) {
    reviewModal.addEventListener('click', (event) => {
      // Fermer si on clique sur le backdrop (pas sur le contenu)
      if (event.target === reviewModal) {
        closeReviewModal();
      }
    });
  }

  // Setup review form and star rating
  initReviewForm();
});

/* ---------- Navigation ---------- */
function setupBackButton() {
  const backBtn = document.getElementById("btn-back");
  backBtn.addEventListener("click", () => {
    goBack();
  });
}

function goBack() {
  if (navigationHistory.length > 0) {
    const previousPage = navigationHistory.pop();
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    document.getElementById("modal-overlay").classList.add("hidden");
    const page = document.getElementById(previousPage);
    if (page) {
      page.classList.remove("hidden");
    }
  } else {
    // If no history, go to home
    goTo("home");
  }
}

/* ---------- Navigation ---------- */
// Cache DOM pour optimisation
const pageCache = { pages: null, modalOverlay: null };

function updateProfDashboardName() {
  const profNameElement = document.getElementById('prof-display-name');
  if (!profNameElement) return;

  const fullName = `${sessionData.prenom || ''} ${sessionData.nom || ''}`.trim();
  profNameElement.textContent = fullName || 'Professeur';
}

function goTo(pageId) {
  // Si déjà connecté et qu'on essaie d'aller sur la page de connexion, rediriger
  if (sessionData.isLoggedIn && pageId === 'eleve') {
    pageId = 'eleve-options';
  }
  
  // Check if login is required
  if (!checkLoginRequired(pageId)) {
    return;
  }
  
  // Initialiser le cache
  if (!pageCache.pages) {
    pageCache.pages = document.querySelectorAll('.page');
    pageCache.modalOverlay = document.getElementById('modal-overlay');
  }
  
  // Clean up map if leaving search page
  const currentPage = document.querySelector('.page:not(.hidden)');
  if (currentPage?.id === 'search' && pageId !== 'search') {
    cleanupWorldMap();
  }
  
  // Batch DOM updates avec requestAnimationFrame
  requestAnimationFrame(() => {
    const targetPage = document.getElementById(pageId);
    if (!targetPage) {
      console.error('Page introuvable:', pageId);
      return;
    }
    
    // Hide all pages et show target
    pageCache.pages.forEach(p => p.classList.add('hidden'));
    pageCache.modalOverlay?.classList.add('hidden');
    targetPage.classList.remove('hidden');
    
    // Initialize map AFTER the search page is visible
    if (pageId === 'search') {
      console.log('🗺️ Search page now visible, initializing map...');
      // Utiliser requestIdleCallback si disponible
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          initializeWorldMap();
          connectWebSocket();
          // La géolocalisation est demandée uniquement lors de l'inscription
        }, { timeout: 300 });
      } else {
        setTimeout(() => {
          initializeWorldMap();
          connectWebSocket();
          // La géolocalisation est demandée uniquement lors de l'inscription
        }, 150);
      }
    }
    
    // Load teacher dashboard data when accessing professor dashboard
    if (pageId === 'prof-dashboard' && sessionData.isTeacher) {
      requestAnimationFrame(() => {
        updateProfDashboardName();
        loadCourseRequests();
        loadAuthorizedMatieres();
        updateCagnotteDisplay();
      });
    }
    
    // Update welcome message when accessing eleve-options or prof page
    if ((pageId === 'eleve-options' || pageId === 'prof-dashboard') && sessionData.isLoggedIn && sessionData.prenom) {
      // Cacher tous les messages de bienvenue
      document.getElementById('welcome-message-eleve')?.classList.add('hidden');
      document.getElementById('welcome-message-prof')?.classList.add('hidden');
      
      // Afficher et mettre à jour le bon message
      const welcomeMessageId = pageId === 'prof-dashboard' ? 'welcome-message-prof' : 'welcome-message-eleve';
      const welcomeTextId = pageId === 'prof-dashboard' ? 'welcome-text-prof' : 'welcome-text-eleve';
      
      const welcomeMessage = document.getElementById(welcomeMessageId);
      const welcomeElement = document.getElementById(welcomeTextId);
      
      if (welcomeMessage && welcomeElement) {
        welcomeElement.textContent = `👋 Bonjour ${sessionData.prenom}`;
        welcomeMessage.classList.remove('hidden');
      }

      // Afficher les statistiques directement sur la page élève options
      if (pageId === 'eleve-options' && !sessionData.isTeacher && sessionData.email) {
        placeStudentStatsInEleveOptions();
        initStudentStats(sessionData.email);
        displayStudentStats();
      }
    } else {
      // Cacher les messages de bienvenue sur les autres pages
      document.getElementById('welcome-message-eleve')?.classList.add('hidden');
      document.getElementById('welcome-message-prof')?.classList.add('hidden');
    }
  });
}

/* ---------- Language Selection ---------- */
function updateLanguageTitle(option) {
  const title = document.getElementById("langue-title");
  if (option === "debat") {
    title.textContent = "Choisissez une langue pour le clash";
  } else if (option === "chat") {
    title.textContent = "Choisissez une langue pour le JustSpeak";
  }
}

/* ---------- Language Selection (Multi-select) ---------- */
function setupLanguageCardSelection() {
  const languageCards = document.querySelectorAll('.language-card');
  
  languageCards.forEach(card => {
    card.addEventListener('click', () => {
      // Toggle la classe selected
      card.classList.toggle('selected');
      
      // Mettre à jour le select caché pour compatibilité
      const select = document.getElementById('langue-select');
      const selectedCards = document.querySelectorAll('.language-card.selected');
      
      if (selectedCards.length > 0) {
        // Mettre la première langue sélectionnée dans le select
        select.value = selectedCards[0].dataset.lang;
      }
    });
  });
}

function confirmLanguage() {
  const selectedCards = document.querySelectorAll('.language-card.selected');
  
  if (selectedCards.length === 0) {
    alert('Veuillez sélectionner au moins une langue');
    return;
  }
  
  // Récupérer toutes les langues sélectionnées
  sessionData.langues = Array.from(selectedCards).map(card => card.dataset.lang);
  // Garder la compatibilité avec l'ancien code
  sessionData.langue = sessionData.langues[0];
  
  console.log("Languages selected:", sessionData.langues);
  
  // Pour le Clash et JustSpeak, aller directement à la recherche en temps réel
  if (sessionData.option === "debat" || sessionData.option === "chat") {
    // Définir la matière par défaut
    if (sessionData.option === "debat") {
      sessionData.matiere = "Clash";
    } else {
      sessionData.matiere = "Conversation générale";
    }
    sessionData.niveau = "N/A";
    
    // Aller à la page de recherche et démarrer le matching
    goTo("search");
    startSearching();
  } else {
    // For courses, show confirmation with subject selection
    openConfirmation(sessionData.option);
  }
}

function openClashMeetWithQuestion() {
  // Ouvrir directement Google Meet avec la question de débat
  console.log('🎯 Ouverture du Clash Meet avec la question');
  
  // Mettre à jour le profil du partenaire dans la page call
  updatePartnerProfile();
  
  // Générer les avis utilisateurs
  generateReviews();
  
  // Afficher la question de débat dans l'interface d'appel
  const callTitle = document.getElementById('call-title');
  if (callTitle) {
    callTitle.textContent = 'Clash en cours';
  }
  
  // Créer un élément pour afficher la question dans la page d'appel
  const callContainer = document.querySelector('#call .call-container');
  if (callContainer) {
    // Vérifier si l'élément de question existe déjà
    let questionElement = document.getElementById('call-debate-question');
    if (!questionElement) {
      questionElement = document.createElement('div');
      questionElement.id = 'call-debate-question';
      questionElement.className = 'clash-debate-question';
      questionElement.innerHTML = `
        <h3>📝 Question de débat</h3>
        <div class="debate-question-box">
          <p>${sessionData.debateQuestion}</p>
        </div>
      `;
      // Insérer après le header
      const header = callContainer.querySelector('.call-header');
      if (header) {
        header.after(questionElement);
      } else {
        callContainer.insertBefore(questionElement, callContainer.firstChild);
      }
    } else {
      // Mettre à jour la question
      const questionBox = questionElement.querySelector('.debate-question-box p');
      if (questionBox) {
        questionBox.textContent = sessionData.debateQuestion;
      }
    }
  }
  
  // Aller à la page d'appel
  goTo("call");
  
  // Définir le lien du bouton "Rejoindre la visio"
  if (sessionData.meetLink) {
    document.getElementById("meet-link").href = sessionData.meetLink;
    document.getElementById("meet-info").textContent = `ID: ${sessionData.meetId || 'N/A'}`;
    console.log('🔗 Lien Meet assigné au bouton:', sessionData.meetLink);
    
    // Ouvrir automatiquement le lien Google Meet dans un nouvel onglet
    console.log('🔗 Ouverture automatique du lien Google Meet:', sessionData.meetLink);
    window.open(sessionData.meetLink, '_blank');
  } else {
    console.error('❌ Aucun lien Google Meet disponible');
  }
}

function handleSubscription(plan) {
  const planNames = {
    standard: 'Standard (4,99€/mois)',
    premium: 'Premium (120€/an)'
  };
  
  const confirmed = confirm(`Voulez-vous souscrire au plan ${planNames[plan]} ?\n\nCette fonctionnalité sera bientôt disponible.`);
  
  if (confirmed) {
    // TODO: Implémenter la souscription réelle
    alert('🚧 Fonctionnalité en cours de développement\n\nLa gestion des paiements sera disponible prochainement.');
  }
}

function handleLogout() {
  const confirmed = confirm('Voulez-vous vraiment vous déconnecter ?');
  
  if (confirmed) {
    // Déconnecter de la base de données
    userDB.logout();
    
    // Reset session data
    sessionData = {
      option: null,
      langue: null,
      matiere: null,
      niveau: null,
      meetLink: null,
      partnerName: null,
      isLoggedIn: false,
      userPhoto: null,
      isSubscribed: false,
      subscriptionType: null,
      usageCount: {},
      isTeacher: false
    };
    
    // Nettoyer le sessionStorage
    clearSessionStorage();
    
    // Hide avatar
    updateUserAvatar();
    
    // Clear form
    const form = document.getElementById('form-eleve');
    if (form) form.reset();
    
    const formProf = document.getElementById('form-professeur');
    if (formProf) formProf.reset();
    
    // Navigate to home
    goTo('home');
    
    console.log('👋 Déconnexion réussie');
  }
}

/* ---------- Confirmation ---------- */
function showOptionConfirmation(option) {
  let optionText = "";
  if (option === "cours") {
    optionText = "Vous avez choisi l'option : Cours 20 min";
  }
  
  document.getElementById("option-confirm-text").textContent = optionText;
  goTo("option-confirmation");
}

function openConfirmation(option) {
  console.log("openConfirmation called with:", option);
  console.log("sessionData:", sessionData);
  
  const confirmText = `Vous avez choisi l'option : ${option}${sessionData.langue ? ` en ${sessionData.langue}` : ''}`;
  
  document.getElementById("confirm-text").textContent = confirmText;
  
  // Hide subject/level selectors for chat and debate
  if (sessionData.option === "chat" || sessionData.option === "debat") {
    document.getElementById("matiere-confirm").style.display = "none";
    document.getElementById("niveau-confirm").style.display = "none";
    console.log("Hidden matiere/niveau selectors for chat/debat");
  } else {
    document.getElementById("matiere-confirm").style.display = "block";
    document.getElementById("niveau-confirm").style.display = "block";
    console.log("Showing matiere/niveau selectors for cours");
  }
  
  // Open modal using ModalManager
  console.log("Opening modal...");
  modalManager.open(document.activeElement);
}

/* ---------- Search & Meeting ---------- */
function startSearching() {
  console.log("🔍 Démarrage de la recherche réelle:", sessionData);
  
  // Vérifier que le WebSocket est connecté
  if (!ws || !wsConnected) {
    console.warn('⚠️ WebSocket non connecté, tentative de reconnexion...');
    connectWebSocket();
    
    // Attendre la connexion puis relancer
    setTimeout(() => {
      if (wsConnected) {
        startSearching();
      } else {
        alert('❌ Impossible de se connecter au serveur.\n\nVeuillez vérifier votre connexion Internet et réessayer.');
        goTo('eleve-options');
      }
    }, 2000);
    return;
  }
  
  // Mettre à jour l'interface pour indiquer qu'on recherche vraiment
  const searchTitle = document.getElementById('search-title');
  const searchText = document.getElementById('search-text');
  
  if (searchTitle) {
    searchTitle.textContent = '🔍 Recherche d\'utilisateurs réels en cours...';
  }
  if (searchText) {
    const activityType = sessionData.option === 'debat' ? 'Clash' : 
                         sessionData.option === 'chat' ? 'JustSpeak' : 'Cours';
    const languesText = sessionData.langues && sessionData.langues.length > 1 
      ? sessionData.langues.join(', ') 
      : sessionData.langue;
    searchText.textContent = `Recherche d'un partenaire pour ${activityType} en ${languesText}.\nVous serez mis en relation dès qu'un utilisateur sera disponible.`;
  }
  
  // Envoyer la demande de recherche au serveur
  const searchRequest = {
    type: 'startSearch',
    searchType: sessionData.option,
    language: sessionData.langue,
    languages: sessionData.langues || [sessionData.langue], // Envoyer toutes les langues
    matiere: sessionData.matiere,
    niveau: sessionData.niveau,
    email: sessionData.email,
    prenom: sessionData.prenom,
    nom: sessionData.nom,
    classe: sessionData.classe
  };
  
  console.log('📤 Envoi de la demande de recherche au serveur:', searchRequest);
  ws.send(JSON.stringify(searchRequest));
}

function startSearchingTeacher() {
  console.log("🔍 Démarrage de la recherche réelle de professeur:", sessionData.matiere, sessionData.niveau);
  
  // Vérifier que le WebSocket est connecté
  if (!ws || !wsConnected) {
    console.warn('⚠️ WebSocket non connecté, tentative de reconnexion...');
    connectWebSocket();
    
    setTimeout(() => {
      if (wsConnected) {
        startSearchingTeacher();
      } else {
        alert('❌ Impossible de se connecter au serveur.\n\nVeuillez vérifier votre connexion Internet et réessayer.');
        goTo('eleve-options');
      }
    }, 2000);
    return;
  }
  
  // Mettre à jour l'interface
  const searchTitle = document.getElementById('search-title');
  const searchText = document.getElementById('search-text');
  
  if (searchTitle) {
    searchTitle.textContent = '🔍 Recherche d\'un professeur...';
  }
  if (searchText) {
    searchText.textContent = `Recherche d'un professeur disponible pour ${sessionData.matiere} (${sessionData.niveau}).\nVous serez mis en relation dès qu'un professeur sera disponible.`;
  }
  
  // Envoyer la demande de recherche de cours au serveur
  const searchRequest = {
    type: 'startSearch',
    searchType: 'cours',
    language: sessionData.langue || 'Français',
    matiere: sessionData.matiere,
    niveau: sessionData.niveau,
    email: sessionData.email,
    prenom: sessionData.prenom,
    nom: sessionData.nom,
    classe: sessionData.classe
  };
  
  console.log('📤 Envoi de la demande de cours au serveur:', searchRequest);
  ws.send(JSON.stringify(searchRequest));
}

function showFoundTeacher() {
  // Cette fonction est maintenant appelée quand on reçoit un message 'matchFound' du serveur
  const teacherInfo = sessionData.partnerName || 'Professeur';
  const partnerClasse = sessionData.partnerClasse || 'Professeur';
  const partnerEmail = sessionData.partnerEmail || '';
  
  // Mettre à jour le profil avec les vraies données du professeur
  document.getElementById('profile-partner-name').textContent = teacherInfo;
  document.getElementById('profile-partner-class').textContent = partnerClasse;
  
  // Initiales pour l'avatar
  const initials = getInitials(teacherInfo);
  document.getElementById('profile-avatar-initial').textContent = initials;
  
  // Activité et matière
  document.getElementById('profile-activity-type').textContent = `Cours de ${sessionData.matiere || 'matière'}`;
  document.getElementById('profile-language-type').textContent = sessionData.niveau || 'Tous niveaux';
  
  // Récupérer les vraies stats depuis la base de données
  getRealPartnerStats(partnerEmail).then(stats => {
    document.getElementById('profile-calls-count').textContent = stats.callsCount;
    document.getElementById('profile-rating').textContent = stats.rating.toFixed(1);
  });
  
  goTo("profile");
}

function showFoundProfile() {
  // Cette fonction est maintenant appelée quand on reçoit un message 'matchFound' du serveur
  // Elle affiche le profil du partenaire trouvé avec les VRAIES données
  
  // Si c'est un Clash, afficher la page spéciale avec question de débat
  if (sessionData.option === "debat") {
    showClashMatch();
    return;
  }
  
  // Adapter le message selon l'option choisie
  let activityText = "";
  if (sessionData.option === "chat") {
    activityText = "JustSpeak";
  } else if (sessionData.option === "cours") {
    activityText = "Cours";
  }
  
  // VRAIES données du partenaire
  const partnerName = sessionData.partnerName || 'Utilisateur';
  const partnerClasse = sessionData.partnerClasse || 'Non spécifiée';
  const partnerEmail = sessionData.partnerEmail || '';
  
  // Mettre à jour le profil avec les vraies données
  document.getElementById('profile-partner-name').textContent = partnerName;
  document.getElementById('profile-partner-class').textContent = `Classe: ${partnerClasse}`;
  
  // Initiales pour l'avatar
  const initials = getInitials(partnerName);
  document.getElementById('profile-avatar-initial').textContent = initials;
  
  // Activité et langue
  document.getElementById('profile-activity-type').textContent = activityText;
  document.getElementById('profile-language-type').textContent = sessionData.langue || 'Non spécifiée';
  
  // Récupérer les vraies stats depuis la base de données
  getRealPartnerStats(partnerEmail).then(stats => {
    document.getElementById('profile-calls-count').textContent = stats.callsCount;
    document.getElementById('profile-rating').textContent = stats.rating.toFixed(1);
  });
  
  goTo("profile");
}

function showClashMatch() {
  // Afficher la page spéciale pour le Clash avec question de débat
  
  // VRAIES données du partenaire
  const partnerName = sessionData.partnerName || 'Utilisateur';
  const partnerClasse = sessionData.partnerClasse || 'Non spécifiée';
  const partnerEmail = sessionData.partnerEmail || '';
  
  // Mettre à jour le profil avec les vraies données
  document.getElementById('clash-partner-name').textContent = partnerName;
  document.getElementById('clash-partner-class').textContent = `Classe: ${partnerClasse}`;
  
  // Initiales pour l'avatar
  const initials = getInitials(partnerName);
  document.getElementById('clash-avatar-initial').textContent = initials;
  
  // Langue
  document.getElementById('clash-language-type').textContent = sessionData.langue || 'Non spécifiée';
  
  // Utiliser la question de débat reçue du serveur (déjà stockée dans sessionData.debateQuestion)
  const debateQuestion = sessionData.debateQuestion;
  document.getElementById('clash-debate-question').textContent = debateQuestion;
  
  console.log('📝 Affichage de la question de débat:', debateQuestion);
  
  // Récupérer les vraies stats depuis la base de données
  getRealPartnerStats(partnerEmail).then(stats => {
    document.getElementById('clash-calls-count').textContent = stats.callsCount;
    document.getElementById('clash-rating').textContent = stats.rating.toFixed(1);
  });
  
  // Masquer le message d'attente au début
  document.getElementById('clash-waiting-acceptance').classList.add('hidden');

  // Réafficher les boutons Accepter / Refuser au cas où ils auraient été masqués précédemment
  try {
    const acceptBtn = document.querySelector('[data-action="acceptClashMatch"]');
    const refuseBtn = document.querySelector('[data-action="refuseClashMatch"]');
    if (acceptBtn) acceptBtn.style.display = '';
    if (refuseBtn) refuseBtn.style.display = '';
  } catch (e) {
    console.warn('Impossible de réafficher les boutons clash:', e);
  }
  
  goTo("clash-match");
}

function acceptClashMatch() {
  console.log('✅ Acceptation du Clash par l\'utilisateur');
  
  // Masquer les boutons et afficher le message d'attente
  try {
    const acceptBtn = document.querySelector('[data-action="acceptClashMatch"]');
    const refuseBtn = document.querySelector('[data-action="refuseClashMatch"]');
    if (acceptBtn) acceptBtn.style.display = 'none';
    if (refuseBtn) refuseBtn.style.display = 'none';
  } catch (e) {
    console.warn('Erreur en masquant les boutons accept/refuse:', e);
  }
  document.getElementById('clash-waiting-acceptance').classList.remove('hidden');
  
  // Envoyer l'acceptation au serveur via WebSocket
  if (ws && wsConnected) {
    ws.send(JSON.stringify({
      type: 'clashAccepted',
      matchId: sessionData.matchId,
      email: sessionData.email
    }));
    
    console.log('📤 Envoi de l\'acceptation du Clash au serveur');
  } else {
    console.error('❌ WebSocket non connecté, impossible d\'envoyer l\'acceptation');
    alert('Erreur de connexion. Veuillez réessayer.');
    goTo('eleve-options');
  }
}

function refuseClashMatch() {
  console.log('❌ Refus du Clash par l\'utilisateur');
  
  // Envoyer le refus au serveur via WebSocket
  if (ws && wsConnected) {
    ws.send(JSON.stringify({
      type: 'clashRefused',
      matchId: sessionData.matchId,
      email: sessionData.email
    }));
  }
  
  // Retourner à la page de recherche et relancer automatiquement
  console.log('🔄 Relance automatique de la recherche');
  goTo('search');
  
  // Relancer la recherche après un court délai
  setTimeout(() => {
    startSearching();
  }, 500);
}

function openClashMeetWithQuestion() {
  // Ouvrir Google Meet avec la question de débat affichée dans l'interface
  console.log('🎯 Ouverture du Clash Meet avec la question');
  
  // Mettre à jour le profil du partenaire dans la page call
  updatePartnerProfile();
  
  // Générer les avis utilisateurs
  generateReviews();
  
  // Afficher la question de débat dans l'interface d'appel
  const callTitle = document.getElementById('call-title');
  if (callTitle) {
    callTitle.textContent = 'Clash en cours';
  }
  
  // Créer un élément pour afficher la question dans la page d'appel
  const callContainer = document.querySelector('#call .call-container');
  if (callContainer) {
    // Vérifier si l'élément de question existe déjà
    let questionElement = document.getElementById('call-debate-question');
    if (!questionElement) {
      questionElement = document.createElement('div');
      questionElement.id = 'call-debate-question';
      questionElement.className = 'clash-debate-question';
      questionElement.innerHTML = `
        <h3>📝 Question de débat</h3>
        <div class="debate-question-box">
          <p>${sessionData.debateQuestion}</p>
        </div>
      `;
      // Insérer après le header
      const header = callContainer.querySelector('.call-header');
      if (header) {
        header.after(questionElement);
      } else {
        callContainer.insertBefore(questionElement, callContainer.firstChild);
      }
    } else {
      // Mettre à jour la question
      const questionBox = questionElement.querySelector('.debate-question-box p');
      if (questionBox) {
        questionBox.textContent = sessionData.debateQuestion;
      }
    }
  }
  
  // Aller à la page d'appel
  goTo("call");
  
  // Définir le lien du bouton "Rejoindre la visio"
  if (sessionData.meetLink) {
    document.getElementById("meet-link").href = sessionData.meetLink;
    document.getElementById("meet-info").textContent = `ID: ${sessionData.meetId || 'N/A'}`;
    console.log('🔗 Lien Meet assigné au bouton:', sessionData.meetLink);
    
    // Ouvrir automatiquement le lien Google Meet dans un nouvel onglet
    window.open(sessionData.meetLink, '_blank');
  } else {
    console.error('❌ Aucun lien Google Meet disponible');
  }
}

function createOrJoinMeet() {
  // Utiliser le lien Google Meet créé par le serveur lors du matching
  if (sessionData.meetLink) {
    // Mettre à jour le profil du partenaire
    updatePartnerProfile();
    
    // Générer les avis utilisateurs
    generateReviews();
    
    document.getElementById("meet-link").href = sessionData.meetLink;
    document.getElementById("meet-info").textContent = `ID: ${sessionData.meetId || 'N/A'}`;
    
    goTo("call");
  } else {
    // Fallback si pas de lien Meet (ne devrait pas arriver)
    console.error('❌ Aucun lien Google Meet disponible');
    alert('❌ Erreur: Aucun lien de réunion disponible.\n\nVeuillez réessayer.');
    goTo('eleve-options');
  }
}

function updatePartnerProfile() {
  // Nom et prénom du partenaire
  const partnerName = sessionData.partnerName || 'Utilisateur';
  document.getElementById('partner-name').textContent = partnerName;
  
  // Classe du partenaire
  const partnerClasse = sessionData.partnerClasse || 'Non spécifiée';
  document.getElementById('partner-class').textContent = `Classe: ${partnerClasse}`;
  
  // Initiales pour l'avatar
  const initials = getInitials(partnerName);
  document.getElementById('partner-avatar-initial').textContent = initials;
  
  // Récupérer les vraies stats depuis la base de données
  const partnerEmail = sessionData.partnerEmail || '';
  getRealPartnerStats(partnerEmail).then(stats => {
    document.getElementById('partner-calls-count').textContent = stats.callsCount;
    document.getElementById('partner-rating').textContent = stats.rating.toFixed(1);
  });
}

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Fonction pour récupérer les VRAIES stats d'un utilisateur depuis la base de données
async function getRealPartnerStats(email) {
  if (!email) {
    return { callsCount: 0, rating: 0.0 };
  }

  try {
    // Récupérer les données depuis Firebase
    const userRef = ref(database, `users/${email.replace(/\./g, ',')}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      const userData = snapshot.val();
      
      // Compter le nombre d'appels dans l'historique
      const callHistory = userData.callHistory || {};
      const callsCount = Object.keys(callHistory).length;
      
      // Calculer la moyenne des notes reçues
      const ratings = userData.ratings || {};
      const ratingsArray = Object.values(ratings);
      let averageRating = 0;
      
      if (ratingsArray.length > 0) {
        const sum = ratingsArray.reduce((acc, val) => acc + (val.rating || 0), 0);
        averageRating = sum / ratingsArray.length;
      } else {
        // Si pas encore de notes, afficher 5.0 par défaut
        averageRating = 5.0;
      }
      
      return {
        callsCount: callsCount,
        rating: averageRating
      };
    } else {
      // Utilisateur pas encore dans la base ou nouveau
      return { callsCount: 0, rating: 5.0 };
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des stats:', error);
    // En cas d'erreur, retourner des valeurs par défaut
    return { callsCount: 0, rating: 5.0 };
  }
}

/**
 * Génère les avis clients à partir de l'API serveur
 */
async function generateReviews() {
  const reviewsDisplay = document.getElementById('reviews-display');
  if (!reviewsDisplay) return;
  
  try {
    // Récupérer les avis depuis le serveur
    const response = await fetch(`${API_BASE_URL}/api/reviews`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error('Erreur lors de la récupération des avis');
    }
    
    const reviews = data.reviews || [];
  
    // Avis par défaut si aucun avis
    if (reviews.length === 0) {
      reviewsDisplay.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
          <div style="font-size: 48px; margin-bottom: 20px; opacity: 0.3;">💬</div>
          <p style="font-size: 18px; color: #718096; font-weight: 500;">Aucun avis pour le moment</p>
          <p style="font-size: 14px; color: #a0aec0; margin-top: 8px;">Soyez le premier à partager votre expérience !</p>
        </div>
      `;
      return;
    }
  
    // Afficher les avis avec un design moderne
    reviewsDisplay.innerHTML = `
      <div style="display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
        ${reviews.map(review => `
          <div style="background: white; padding: 28px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; transition: all 0.3s;"
               onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 30px rgba(0,0,0,0.12)'"
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 20px rgba(0,0,0,0.08)'">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
              <div>
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                  <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 18px;">
                    ${escapeHtml(review.name).charAt(0).toUpperCase()}
                  </div>
                  <strong style="color: #2d3748; font-size: 17px; font-weight: 600;">${escapeHtml(review.name)}</strong>
                </div>
                <div style="color: #fbbf24; font-size: 20px; letter-spacing: 2px;">
                  ${'★'.repeat(review.rating)}${review.rating < 5 ? '<span style="color: #e2e8f0;">' + '★'.repeat(5 - review.rating) + '</span>' : ''}
                </div>
              </div>
              <span style="color: #a0aec0; font-size: 13px; white-space: nowrap;">${review.date}</span>
            </div>
            <p style="color: #4a5568; line-height: 1.7; margin: 0; font-size: 15px;">${escapeHtml(review.text)}</p>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('❌ Erreur lors du chargement des avis:', error);
    reviewsDisplay.innerHTML = `
      <div style="text-align: center; padding: 60px 20px;">
        <div style="font-size: 48px; margin-bottom: 20px; opacity: 0.3;">⚠️</div>
        <p style="font-size: 18px; color: #718096; font-weight: 500;">Erreur de chargement des avis</p>
        <p style="font-size: 14px; color: #a0aec0; margin-top: 8px;">Veuillez réessayer plus tard</p>
      </div>
    `;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function initReviewForm() {
  // Gestion des étoiles
  const stars = document.querySelectorAll('.star-input');
  const ratingInput = document.getElementById('review-rating');
  
  if (!stars.length || !ratingInput) return;
  
  stars.forEach(star => {
    star.addEventListener('click', function() {
      const rating = parseInt(this.getAttribute('data-rating'));
      ratingInput.value = rating;
      
      stars.forEach((s, index) => {
        if (index < rating) {
          s.textContent = '★';
          s.style.color = '#fbbf24';
          s.style.transform = 'scale(1.2)';
          setTimeout(() => s.style.transform = 'scale(1)', 200);
        } else {
          s.textContent = '☆';
          s.style.color = '#e2e8f0';
        }
      });
    });
    
    star.addEventListener('mouseenter', function() {
      const rating = parseInt(this.getAttribute('data-rating'));
      stars.forEach((s, index) => {
        if (index < rating) {
          s.style.color = '#fbbf24';
          s.style.transform = 'scale(1.15)';
        }
      });
    });
    
    star.addEventListener('mouseleave', function() {
      const currentRating = parseInt(ratingInput.value);
      stars.forEach((s, index) => {
        if (index < currentRating) {
          s.style.color = '#fbbf24';
        } else {
          s.style.color = '#e2e8f0';
        }
        s.style.transform = 'scale(1)';
      });
    });
  });
  
  // Gestion du formulaire
  const form = document.getElementById('review-form');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const name = document.getElementById('review-name').value;
      const rating = parseInt(document.getElementById('review-rating').value);
      const text = document.getElementById('review-text').value;
      
      if (!rating) {
        alert('Veuillez sélectionner une note en cliquant sur les étoiles');
        return;
      }
      
      // Vérifier que l'utilisateur est connecté
      if (!sessionData.isLoggedIn || !sessionData.email) {
        alert('⚠️ Vous devez être connecté pour laisser un avis');
        closeReviewModal();
        goTo('eleve'); // Rediriger vers la page de connexion
        return;
      }
      
      try {
        // Envoyer l'avis au serveur avec l'email de l'utilisateur
        const response = await fetch(`${API_BASE_URL}/api/reviews`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            name, 
            email: sessionData.email, // Inclure l'email pour identifier l'utilisateur
            rating, 
            text 
          })
        });
        
        const data = await response.json();
        
        if (!data.success) {
          // Afficher le message d'erreur du serveur (par ex: déjà laissé un avis)
          alert(data.error || 'Erreur lors de l\'envoi de l\'avis');
          if (response.status === 409) {
            // L'utilisateur a déjà laissé un avis, fermer la modale
            closeReviewModal();
          }
          return;
        }
        
        // Réinitialiser le formulaire
        form.reset();
        document.getElementById('review-rating').value = '0';
        stars.forEach(s => {
          s.textContent = '☆';
          s.style.color = '#e2e8f0';
          s.style.transform = 'scale(1)';
        });
        
        // Recharger les avis
        await generateReviews();
        
        // Fermer la modale
        closeReviewModal();
        
        // Message de confirmation stylé
        const confirmMsg = document.createElement('div');
        confirmMsg.innerHTML = `
          <div style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; border-radius: 12px; box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4); z-index: 10000; animation: slideDown 0.3s ease-out;">
            <p style="margin: 0; font-weight: 500; font-size: 15px;">✓ Merci ! Votre avis a été publié avec succès</p>
          </div>
        `;
        document.body.appendChild(confirmMsg);
        setTimeout(() => confirmMsg.remove(), 3000);
        
        // Scroller vers les avis
        setTimeout(() => {
          document.getElementById('reviews-display').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      } catch (error) {
        console.error('❌ Erreur lors de l\'envoi de l\'avis:', error);
        alert('❌ Une erreur est survenue lors de l\'envoi de votre avis. Veuillez réessayer.');
      }
    });
  }
}

function showGoogleReviewPrompt() {
  // Afficher une invitation à laisser un avis après une session réussie
  const notification = document.createElement('div');
  notification.className = 'google-review-notification';
  notification.innerHTML = `
    <div style="position: fixed; bottom: 20px; right: 20px; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 10000; max-width: 350px; animation: slideIn 0.3s ease-out;">
      <button onclick="this.parentElement.parentElement.remove()" style="position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">X</button>
      <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 500; color: #333;">✨ Session terminée !</p>
      <p style="margin: 0 0 15px 0; font-size: 14px; color: #666;">Vous avez apprécié LOK IN ? Votre avis compte beaucoup pour nous !</p>
      <a href="https://g.page/r/CSuSLlcLU4I-EAE/review" target="_blank" 
         onclick="this.parentElement.parentElement.remove()"
         style="display: block; text-align: center; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
        ⭐ Laisser un avis Google
      </a>
    </div>
  `;
  document.body.appendChild(notification);
  
  // Supprimer automatiquement après 15 secondes
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 15000);
}

// Fonctions pour gérer la modale d'avis
async function openReviewModal() {
  // Vérifier que l'utilisateur est connecté
  if (!sessionData.isLoggedIn || !sessionData.email) {
    alert('⚠️ Vous devez être connecté pour laisser un avis');
    goTo('eleve'); // Rediriger vers la page de connexion
    return;
  }
  
  // Vérifier si l'utilisateur a déjà laissé un avis
  try {
    const response = await fetch(`${API_BASE_URL}/api/reviews/check/${encodeURIComponent(sessionData.email)}`);
    const data = await response.json();
    
    if (data.success && data.hasReviewed) {
      alert('✅ Vous avez déjà laissé un avis. Merci pour votre participation !');
      return;
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'avis:', error);
    // Continuer même en cas d'erreur réseau
  }
  
  const modal = document.getElementById('review-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Empêcher le scroll
  }
}

function closeReviewModal() {
  const modal = document.getElementById('review-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = ''; // Réactiver le scroll
  }
}

// Fermer la modale avec la touche Échap
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeReviewModal();
  }
});

/**
 * Affiche de vrais avis Google (à implémenter avec l'API Google Places)
 * Documentation : https://developers.google.com/maps/documentation/places/web-service/reviews
 */
function loadGoogleReviews() {
  // TODO: Implémenter l'intégration avec Google Places API
  // Nécessite une clé API Google et un Place ID
  console.log('Google Reviews : À implémenter');
}

function generateMeetId() {
  // Générer un ID au format Google Meet valide: xxx-yyyy-zzz
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  
  const segment1 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const segment2 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const segment3 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  
  return `${segment1}-${segment2}-${segment3}`;
}

function copyToClipboard() {
  if (sessionData.meetLink) {
    navigator.clipboard.writeText(sessionData.meetLink).then(() => {
      alert("Lien copié dans le presse-papiers!");
    }).catch(err => {
      console.error("Erreur lors de la copie:", err);
    });
  }
}

function setRating(rating) {
  const r = parseInt(rating, 10) || 0;
  console.log("Rating given:", r);
  // Cibler les boutons (dans la page #rating les étoiles sont des <button>)
  const stars = document.querySelectorAll("#stars button");
  if (stars && stars.length) {
    stars.forEach((star, index) => {
      if (index < r) {
        star.style.color = "#fbbf24"; // gold
        star.style.transform = 'scale(1.15)';
      } else {
        star.style.color = "#a0aec0"; // gray
        star.style.transform = 'scale(1)';
      }
    });
  }

  // Mémoriser la note en attente (sera envoyée au submit)
  sessionData.pendingRating = r;
}

/**
 * Enregistre la note du prochain call pour le partenaire associé à la session.
 * Stocke localement dans `lokin_partner_ratings` (démo sans backend/Firebase).
 */
function submitCallRating() {
  const rating = sessionData.pendingRating || 0;
  if (!rating) {
    alert('Veuillez sélectionner une note avant de soumettre.');
    return;
  }

  const partnerEmail = sessionData.partnerEmail || sessionData.partnerEmailFound || null;

  const record = {
    rating: rating,
    from: sessionData.email || 'anonymous',
    date: new Date().toISOString()
  };

  try {
    const key = 'lokin_partner_ratings';
    const raw = localStorage.getItem(key);
    const all = raw ? JSON.parse(raw) : {};

    if (partnerEmail) {
      const normalized = partnerEmail.toLowerCase();
      all[normalized] = all[normalized] || [];
      all[normalized].push(record);
      localStorage.setItem(key, JSON.stringify(all));

      // Mettre à jour l'affichage immédiat si le profil du partenaire est visible
      try {
        // calculer moyenne locale
        const arr = all[normalized];
        const sum = arr.reduce((s, r) => s + (r.rating || 0), 0);
        const avg = (sum / arr.length).toFixed(1);
        const partnerRatingEls = document.querySelectorAll('#partner-rating, #profile-rating, #prof-avg-score');
        partnerRatingEls.forEach(el => { if (el) el.textContent = avg; });
      } catch (err) {
        console.warn('Impossible de mettre à jour l\'UI du partenaire:', err);
      }
    } else {
      // Si pas de partenaire connu, stocker globalement sous "anonymous"
      all['anonymous'] = all['anonymous'] || [];
      all['anonymous'].push(record);
      localStorage.setItem(key, JSON.stringify(all));
    }

    // Nettoyer la note en attente
    sessionData.pendingRating = 0;
  } catch (error) {
    console.error('Erreur sauvegarde note:', error);
  }
}

function resetSession() {
  sessionData = {
    option: null,
    langue: null,
    matiere: null,
    niveau: null,
    meetLink: null,
    partnerName: null
  };
  // Reset stars color
  document.querySelectorAll("#stars span").forEach(star => {
    star.style.color = "gray";
  });
}

/* ---------- World Map ---------- */
let map = null;
let mapMarkers = [];
let mapInitialized = false;

/**
 * Récupère tous les utilisateurs qui ont partagé leur localisation
 * @returns {Array} Liste des utilisateurs avec {name, lat, lng, emoji, lang}
 */
function getAllUsersWithLocation() {
  try {
    const allUsersData = localStorage.getItem(userDB.USERS_KEY);
    if (!allUsersData) {
      return [];
    }
    
    const users = JSON.parse(allUsersData);
    const usersWithLocation = [];
    
    for (const email in users) {
      const user = users[email];
      if (user.location && user.location.lat && user.location.lng) {
        // Créer un emoji basé sur le type d'utilisateur
        const emoji = user.isTeacher ? '👨‍🏫' : '👨‍🎓';
        
        // Déterminer une "langue" fictive ou utiliser la classe
        const displayInfo = user.isTeacher ? 'Professeur' : (user.classe || 'Élève');
        
        usersWithLocation.push({
          name: `${user.prenom} ${user.nom.charAt(0)}.`,
          lat: user.location.lat,
          lng: user.location.lng,
          emoji: emoji,
          lang: displayInfo
        });
      }
    }
    
    console.log(`📍 ${usersWithLocation.length} utilisateur(s) avec localisation trouvé(s)`);
    return usersWithLocation;
  } catch (error) {
    console.error('❌ Erreur récupération utilisateurs avec localisation:', error);
    return [];
  }
}

function cleanupWorldMap() {
  if (map) {
    // Remove all markers
    mapMarkers.forEach(marker => map.removeLayer(marker));
    mapMarkers = [];
    
    // Clear real user markers
    realUserMarkers.forEach((marker) => {
      if (map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    });
    realUserMarkers.clear();
    
    // Remove map
    map.remove();
    map = null;
    mapInitialized = false;
  }
  
  // Ne pas déconnecter le WebSocket automatiquement
  // Il peut être nécessaire pour d'autres fonctionnalités (professeurs, etc.)
  console.log('🗺️ Carte nettoyée (WebSocket maintenu pour autres fonctionnalités)');
}

function generateRandomUsers(count = 12) {
  const cities = [
    { name: "Paris", lat: 48.8566, lng: 2.3522, emoji: "🇫🇷" },
    { name: "Londres", lat: 51.5074, lng: -0.1278, emoji: "🇬🇧" },
    { name: "Madrid", lat: 40.4168, lng: -3.7038, emoji: "🇪🇸" },
    { name: "Berlin", lat: 52.52, lng: 13.405, emoji: "🇩🇪" },
    { name: "Rome", lat: 41.9028, lng: 12.4964, emoji: "🇮🇹" },
    { name: "Amsterdam", lat: 52.3676, lng: 4.9041, emoji: "🇳🇱" },
    { name: "Barcelone", lat: 41.3851, lng: 2.1734, emoji: "🇪🇸" },
    { name: "Lisbonne", lat: 38.7223, lng: -9.1393, emoji: "🇵🇹" },
    { name: "Vienne", lat: 48.2082, lng: 16.3738, emoji: "🇦🇹" },
    { name: "Prague", lat: 50.0755, lng: 14.4378, emoji: "🇨🇿" },
    { name: "Édimbourg", lat: 55.9533, lng: -3.1883, emoji: "🇬🇧" },
    { name: "Stockholm", lat: 59.3293, lng: 18.0686, emoji: "🇸🇪" },
    { name: "Varsovie", lat: 52.2297, lng: 21.0122, emoji: "🇵🇱" },
    { name: "Copenhague", lat: 55.6761, lng: 12.5683, emoji: "🇩🇰" },
    { name: "Bruxelles", lat: 50.8503, lng: 4.3517, emoji: "🇧🇪" },
    { name: "Zürich", lat: 47.3769, lng: 8.5472, emoji: "🇨🇭" },
  ];

  const names = ["Alice", "Marc", "Sophie", "Thomas", "Giulia", "Carlos", "Emma", "Jean", "Marie", "Pierre", "Anne", "Luc"];
  const languages = ["Français", "Anglais", "Espagnol", "Allemand", "Italien", "Néerlandais"];

  const users = [];
  for (let i = 0; i < Math.min(count, cities.length); i++) {
    const city = cities[i];
    const randomVariation = {
      lat: city.lat + (Math.random() - 0.5) * 1.5,
      lng: city.lng + (Math.random() - 0.5) * 1.5
    };
    
    users.push({
      name: names[Math.floor(Math.random() * names.length)],
      lang: languages[Math.floor(Math.random() * languages.length)],
      lat: randomVariation.lat,
      lng: randomVariation.lng,
      emoji: city.emoji
    });
  }
  return users;
}

function initializeWorldMap() {
  const mapElement = document.getElementById("world-map");
  if (!mapElement) {
    console.warn("Element #world-map not found");
    return;
  }

  // Éviter la double initialisation
  if (mapInitialized && map) {
    console.log("Map already initialized, recalculating size");
    // Si la carte existe déjà, juste recalculer la taille
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return;
  }

  // Nettoyer toute instance existante (mais ne pas déconnecter WebSocket)
  if (map) {
    mapMarkers.forEach(marker => map.removeLayer(marker));
    mapMarkers = [];
    map.remove();
    map = null;
    mapInitialized = false;
  }

  console.log("Initializing world map...");

  // Attendre que le DOM soit complètement rendu
  setTimeout(() => {
    const searchPage = document.getElementById("search");
    
    // Vérifier que la page search existe
    if (!searchPage) {
      console.warn("Search page not found");
      return;
    }

    // Log pour debug
    console.log("Search page hidden:", searchPage.classList.contains("hidden"));

    // Initialiser la carte centrée sur l'Europe avec OpenStreetMap
    try {
      map = L.map("world-map", {
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: false
      }).setView([50, 10], 3);

      console.log("Map instance created");

      // Ajouter les tuiles OpenStreetMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      console.log("Tiles added");

      // Récupérer les utilisateurs avec localisation depuis la base de données
      const usersWithLocation = getAllUsersWithLocation();
      
      // Si nous avons des utilisateurs réels avec localisation, les utiliser
      // Sinon, générer des utilisateurs aléatoires pour la démonstration
      const users = usersWithLocation.length > 0 ? usersWithLocation : generateRandomUsers(12);

      // Ajouter les marqueurs
      users.forEach((user) => {
        const customIcon = L.divIcon({
          className: "user-marker",
          html: `<div class="pin-marker">
                   <div class="pin-head"></div>
                   <div class="pin-point"></div>
                   <div class="pin-pulse"></div>
                 </div>`,
          iconSize: [40, 50],
          iconAnchor: [20, 50],
          popupAnchor: [0, -50]
        });

        const marker = L.marker([user.lat, user.lng], { icon: customIcon }).addTo(map);
        marker.bindPopup(`<strong>${user.name}</strong><br/>Langue: ${user.lang}<br/><small>🟢 En ligne</small>`);
        mapMarkers.push(marker);
      });

      console.log(`${mapMarkers.length} markers added`);

      // Marquer comme initialisée
      mapInitialized = true;

      // Forcer la carte à recalculer sa taille après l'affichage
      setTimeout(() => {
        if (map) {
          map.invalidateSize();
          console.log("✅ Map fully initialized and sized");
        }
      }, 200);

    } catch (error) {
      console.error("❌ Error initializing map:", error);
    }
  }, 200);
}

/**
 * Ajoute un marqueur utilisateur sur la carte Leaflet
 * @param {number} lat - Latitude du marqueur
 * @param {number} lng - Longitude du marqueur
 * @param {string} label - Nom/libellé de l'utilisateur à afficher
 */
function addUserMarker(lat, lng, label) {
  // Ne rien faire si la carte n'est pas initialisée
  if (!map || !mapInitialized) {
    console.warn('Cannot add marker: map is not initialized yet');
    return;
  }

  // Créer un marqueur avec un icône personnalisé
  const customIcon = L.divIcon({
    className: "user-marker",
    html: "👤",
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  // Ajouter le marqueur sur la carte
  const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
  
  // Ajouter un popup avec le nom de l'utilisateur
  marker.bindPopup(`<strong>${label}</strong><br/><small>Utilisateur en ligne</small>`);
  
  // Stocker le marqueur pour un nettoyage ultérieur si nécessaire
  mapMarkers.push(marker);
  
  return marker;
}

// ===== GEOLOCATION =====
/**
 * Demande l'autorisation de géolocalisation à l'utilisateur
 * Utilise l'API HTML5 Geolocation avec une précision raisonnable
 */
function requestGeolocation() {
  // Ne demander qu'une seule fois
  if (userLocation.permissionAsked) {
    return Promise.resolve(userLocation.hasPermission);
  }

  return new Promise((resolve) => {
    // Vérifier si la géolocalisation est disponible
    if (!navigator.geolocation) {
      console.warn('Géolocalisation non disponible sur ce navigateur');
      userLocation.permissionAsked = true;
      userLocation.hasPermission = false;
      resolve(false);
      return;
    }

    userLocation.permissionAsked = true;

    // Options de géolocalisation (précision raisonnable)
    const options = {
      enableHighAccuracy: false, // Précision raisonnable, pas ultra-précise
      timeout: 10000, // 10 secondes max
      maximumAge: 300000 // Cache de 5 minutes acceptable
    };

    // Demander la position actuelle
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Succès : stocker les coordonnées
        userLocation.lat = position.coords.latitude;
        userLocation.lng = position.coords.longitude;
        userLocation.hasPermission = true;

        console.log('📍 Géolocalisation obtenue:', {
          lat: userLocation.lat,
          lng: userLocation.lng
        });

        // Envoyer au serveur WebSocket si connecté
        if (wsConnected && ws) {
          sendLocationToServer();
        }

        resolve(true);
      },
      (error) => {
        // Erreur ou refus : ne pas bloquer l'interface
        userLocation.hasPermission = false;
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            console.log('ℹ️ Utilisateur a refusé la géolocalisation');
            break;
          case error.POSITION_UNAVAILABLE:
            console.warn('⚠️ Position indisponible');
            break;
          case error.TIMEOUT:
            console.warn('⏱️ Timeout de géolocalisation');
            break;
        }

        // Ne pas bloquer, continuer sans géolocalisation
        resolve(false);
      },
      options
    );
  });
}

/**
 * Envoie la position de l'utilisateur au serveur WebSocket
 */
function sendLocationToServer() {
  if (!ws || !wsConnected) {
    console.warn('WebSocket non connecté');
    return;
  }

  if (!userLocation.lat || !userLocation.lng) {
    console.warn('Position non disponible');
    return;
  }

  const userName = sessionData.isLoggedIn 
    ? `${sessionData.prenom || ''} ${sessionData.nom || ''}`.trim() 
    : 'Utilisateur anonyme';

  const message = {
    type: 'updatePosition',
    name: userName || 'Utilisateur',
    lat: userLocation.lat,
    lng: userLocation.lng
  };

  ws.send(JSON.stringify(message));
  console.log('📤 Position envoyée au serveur:', message);
}

// ===== WEBSOCKET =====
/**
 * Configuration WebSocket avec retry et fallback
 */
let wsRetryCount = 0;
const WS_MAX_RETRIES = 5;
const WS_RETRY_DELAY = 2000; // 2 secondes
let wsRetryTimeout = null;

/**
 * Connecte au serveur WebSocket pour le partage de positions en temps réel
 */
function connectWebSocket() {
  // Éviter les connexions multiples
  if (ws && wsConnected) {
    console.log('WebSocket déjà connecté');
    return;
  }

  // Déterminer l'URL du serveur WebSocket
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  let wsHost;
  
  // Configuration selon l'environnement
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  if (protocol === 'file:' || !hostname || hostname === '') {
    // Fichier ouvert directement (file://) - forcer localhost
    wsHost = 'localhost:8080';
    console.log('📁 Détection: fichier local (file://), utilisation de localhost:8080');
  } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Développement local
    wsHost = 'localhost:8080';
  } else {
    // Production : serveur WebSocket déployé sur Railway
    wsHost = 'web-production-d08b0.up.railway.app';
    console.log('🚀 Connexion au serveur Railway');
  }
  
  // Validation de l'URL avant création
  if (!wsHost || wsHost.trim() === '') {
    console.error('❌ Erreur: impossible de déterminer l\'hôte WebSocket');
    wsHost = 'localhost:8080'; // Fallback par défaut
  }
  
  const wsUrl = `${wsProtocol}//${wsHost}`;

  console.log(`🔌 Tentative de connexion WebSocket (essai ${wsRetryCount + 1}/${WS_MAX_RETRIES}): ${wsUrl}`);

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      wsConnected = true;
      resetWebSocketRetry(); // Réinitialiser le compteur de retry
      console.log('✅ WebSocket connecté avec succès');

      // Envoyer la localisation si elle existe déjà dans la session
      if (sessionData.isLoggedIn && sessionData.email) {
        const user = userDB.getUserByEmail(sessionData.email);
        if (user && user.location) {
          userLocation.lat = user.location.lat;
          userLocation.lng = user.location.lng;
          userLocation.hasPermission = true;
          sendLocationToServer();
        }
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (!data || !data.type) {
          console.warn('⚠️ Message WebSocket invalide:', event.data);
          return;
        }
        
        switch (data.type) {
          case 'connected':
            console.log('📱 Connecté avec ID:', data.clientId);
            // Stocker l'ID client pour référence future
            sessionData.wsClientId = data.clientId;
            break;

          case 'searching':
            // Confirmation que la recherche est en cours
            console.log('🔍 Recherche en cours...', data);
            const searchText = document.getElementById('search-text');
            if (searchText) {
              searchText.textContent = `${data.message}\nPosition dans la file: ${data.queuePosition}`;
            }
            break;

          case 'queueUpdate':
            // Mise à jour de la position dans la file
            console.log('📊 Mise à jour file d\'attente:', data);
            const searchTextUpdate = document.getElementById('search-text');
            if (searchTextUpdate) {
              searchTextUpdate.textContent = `Recherche en cours...\nPosition dans la file: ${data.queuePosition}/${data.queueSize}\n${data.message}`;
            }
            break;

          case 'matchFound':
            // Un match a été trouvé !
            console.log('✅ Match trouvé !', data);
            
            // Stocker les informations du partenaire
            sessionData.partnerName = `${data.partner.prenom || ''} ${data.partner.nom || ''}`.trim() || data.partner.name;
            sessionData.partnerClasse = data.partner.classe;
            sessionData.partnerEmail = data.partner.email;
            sessionData.partnerIsTeacher = data.partner.isTeacher || false;
            sessionData.meetLink = data.meetLink;
            sessionData.meetId = data.meetId;
            sessionData.matchId = data.matchId; // Important pour le Clash
            sessionData.matiere = data.matiere || sessionData.matiere;
            sessionData.niveau = data.niveau || sessionData.niveau;
            
            // Stocker la question de débat si c'est un Clash (générée par le serveur)
            if (data.debateQuestion) {
              sessionData.debateQuestion = data.debateQuestion;
              console.log('💬 Question de débat reçue du serveur:', data.debateQuestion);
            }
            
            // Afficher le profil du partenaire trouvé
            if (sessionData.partnerIsTeacher || sessionData.option === 'cours') {
              showFoundTeacher();
            } else {
              showFoundProfile();
            }
            break;

          case 'clashBothAccepted':
            // Les deux utilisateurs ont accepté le Clash !
            console.log('🎉 Les deux utilisateurs ont accepté le Clash !');
            
            // Mettre à jour le lien Meet et la question de débat depuis le serveur
            if (data.meetLink) {
              sessionData.meetLink = data.meetLink;
            }
            if (data.meetId) {
              sessionData.meetId = data.meetId;
            }
            if (data.debateQuestion) {
              sessionData.debateQuestion = data.debateQuestion;
            }
            
            console.log('🔗 Lien Google Meet confirmé:', sessionData.meetLink);
            
            // Ouvrir le Meet avec la question de débat
            openClashMeetWithQuestion();
            break;

          case 'clashPartnerRefused':
            // L'autre utilisateur a refusé le Clash
            console.log('❌ Votre partenaire a refusé le Clash');
            
            // Afficher une notification
            const notification = document.createElement('div');
            notification.style.cssText = `
              position: fixed;
              top: 20px;
              left: 50%;
              transform: translateX(-50%);
              background: #ff6b6b;
              color: white;
              padding: 15px 30px;
              border-radius: 10px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              z-index: 10000;
              font-size: 16px;
              animation: slideDown 0.3s ease;
            `;
            notification.textContent = '❌ Votre partenaire a refusé. Nouvelle recherche...';
            document.body.appendChild(notification);
            
            // Supprimer la notification après 3 secondes
            setTimeout(() => {
              notification.remove();
            }, 3000);
            
            // Retourner à la recherche et relancer automatiquement
            goTo('search');
            setTimeout(() => {
              startSearching();
            }, 500);
            break;

          case 'teacherAvailableConfirmed':
            // Confirmation que le professeur est maintenant disponible
            console.log('✅ Disponibilité confirmée:', data.matiere);
            break;

          case 'teacherUnavailableConfirmed':
            // Confirmation que le professeur n'est plus disponible
            console.log('❌ Indisponibilité confirmée:', data.matiere);
            break;

          case 'courseSearchNotification':
            // Notification envoyée aux professeurs autorisés pour une matière
            if (sessionData.isTeacher) {
              showTeacherCourseSearchNotification(data);
            }
            break;

          case 'searchStopped':
            // La recherche a été arrêtée
            console.log('🛑 Recherche arrêtée');
            goTo('eleve-options');
            break;

          case 'userList':
            console.log(`👥 ${data.count} utilisateur(s) connecté(s)`);
            
            // Mettre à jour dynamiquement la carte avec les utilisateurs réels
            if (map && mapInitialized) {
              updateRealUserMarkers(data.users);
            }
            break;

          case 'error':
            console.error('❌ Erreur serveur:', data.message);
            // Ne pas afficher d'alert pour ne pas bloquer l'utilisateur
            console.warn('Erreur reçue du serveur:', data.message);
            break;
          
          default:
            // Message de type inconnu - juste logger sans bloquer
            console.log('📨 Message WebSocket non géré:', data.type, data);
            break;
        }
      } catch (error) {
        console.error('Erreur traitement message WebSocket:', error);
      }
    };

    ws.onclose = () => {
      wsConnected = false;
      console.log('🔌 WebSocket déconnecté');
      
      // Nettoyer la référence WebSocket
      ws = null;
      
      // Tentative de reconnexion uniquement si on est sur une page qui en a besoin
      setTimeout(() => {
        const searchPage = document.getElementById('search');
        const profPage = document.getElementById('prof');
        
        // Reconnexion si on est sur la page de recherche ou page professeur (et pas cachée)
        if ((searchPage && !searchPage.classList.contains('hidden')) || 
            (profPage && !profPage.classList.contains('hidden') && sessionData.isTeacher)) {
          console.log('🔄 Tentative de reconnexion...');
          connectWebSocket();
        }
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('⚠️ Erreur WebSocket:', error);
      wsConnected = false;
      
      // Message d'erreur plus explicite
      if (wsRetryCount === 0) {
        console.error(`❌ Impossible de se connecter au serveur WebSocket sur ${wsUrl}`);
        console.error('Vérifiez que:');
        console.error('1. Le serveur WebSocket est démarré (node server.js)');
        console.error('2. Le port 8080 est accessible');
        console.error('3. Votre pare-feu autorise les connexions WebSocket');
      }
    };

  } catch (error) {
    console.error('❌ Erreur création WebSocket:', error);
    wsConnected = false;
    
    // Retry avec backoff exponentiel
    if (wsRetryCount < WS_MAX_RETRIES) {
      wsRetryCount++;
      const retryDelay = WS_RETRY_DELAY * Math.pow(1.5, wsRetryCount - 1);
      console.log(`🔄 Nouvelle tentative dans ${Math.round(retryDelay / 1000)}s...`);
      
      wsRetryTimeout = setTimeout(() => {
        connectWebSocket();
      }, retryDelay);
    } else {
      console.error('❌ Nombre maximum de tentatives atteint. WebSocket désactivé.');
      console.error('Le site fonctionnera en mode dégradé (sans matching en temps réel).');
      
      // Afficher un message à l'utilisateur
      if (document.getElementById('search-text')) {
        const searchText = document.getElementById('search-text');
        searchText.innerHTML = `<span style="color: #dc3545;">⚠️ Connexion au serveur impossible</span><br><br>
          Le système de matching en temps réel n\'est pas disponible.<br>
          Veuillez réessayer plus tard ou contacter le support.`;
      }
    }
  }
}

/**
 * Affiche une notification élégante pour les professeurs lorsqu'un élève recherche un cours
 */
function showTeacherCourseSearchNotification(data) {
  const studentName = data?.student?.name || `${data?.student?.prenom || ''} ${data?.student?.nom || ''}`.trim() || 'Un élève';
  const matiere = data?.matiere || 'une matière';
  const niveau = data?.niveau ? ` (${data.niveau})` : '';

  const notif = document.createElement('div');
  notif.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 360px;
    background: #0f172a;
    color: #ffffff;
    border: 1px solid #1e293b;
    border-left: 4px solid #6366f1;
    border-radius: 12px;
    padding: 14px 16px;
    box-shadow: 0 16px 32px rgba(2, 6, 23, 0.35);
    z-index: 10000;
    font-size: 14px;
    line-height: 1.4;
    animation: slideIn 0.25s ease-out;
  `;

  notif.innerHTML = `
    <div style="font-weight:700; margin-bottom:4px;">📚 Nouvelle demande de cours</div>
    <div><strong>${studentName}</strong> recherche <strong>${matiere}</strong>${niveau}</div>
  `;

  document.body.appendChild(notif);

  setTimeout(() => {
    notif.style.opacity = '0';
    notif.style.transform = 'translateY(-6px)';
    notif.style.transition = 'all 0.2s ease';
    setTimeout(() => notif.remove(), 220);
  }, 5000);
}

/**
 * Réinitialise le compteur de retry (appelé après une connexion réussie)
 */
function resetWebSocketRetry() {
  wsRetryCount = 0;
  if (wsRetryTimeout) {
    clearTimeout(wsRetryTimeout);
    wsRetryTimeout = null;
  }
}

/**
 * Déconnecte le WebSocket
 */
function disconnectWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
    wsConnected = false;
    console.log('🔌 WebSocket fermé manuellement');
  }
}

// Stocker les marqueurs d'utilisateurs réels séparément
let realUserMarkers = new Map();

/**
 * Met à jour les marqueurs des utilisateurs réels sur la carte
 * @param {Array} users - Liste des utilisateurs connectés
 */
function updateRealUserMarkers(users) {
  if (!map || !mapInitialized) return;

  // Créer un Set des IDs d'utilisateurs actuels
  const currentUserIds = new Set(users.map(u => u.id));

  // Supprimer les marqueurs des utilisateurs déconnectés
  realUserMarkers.forEach((marker, userId) => {
    if (!currentUserIds.has(userId)) {
      map.removeLayer(marker);
      realUserMarkers.delete(userId);
      console.log(`🗑️ Marqueur supprimé pour ${userId}`);
    }
  });

  // Ajouter ou mettre à jour les marqueurs des utilisateurs connectés
  users.forEach(user => {
    if (!user.lat || !user.lng || !user.name) return;

    // Si le marqueur existe déjà, le mettre à jour
    if (realUserMarkers.has(user.id)) {
      const marker = realUserMarkers.get(user.id);
      const newLatLng = L.latLng(user.lat, user.lng);
      
      // Mettre à jour la position si elle a changé
      if (!marker.getLatLng().equals(newLatLng)) {
        marker.setLatLng(newLatLng);
        console.log(`📍 Position mise à jour pour ${user.name}`);
      }
      
      // Mettre à jour le popup
      marker.setPopupContent(`<strong>${user.name}</strong><br/><small>En ligne</small>`);
    } else {
      // Créer un nouveau marqueur
      const customIcon = L.divIcon({
        className: "user-marker",
        html: `<div class="pin-marker">
                 <div class="pin-head"></div>
                 <div class="pin-point"></div>
                 <div class="pin-pulse"></div>
               </div>`,
        iconSize: [40, 50],
        iconAnchor: [20, 50],
        popupAnchor: [0, -50]
      });

      const marker = L.marker([user.lat, user.lng], { icon: customIcon }).addTo(map);
      marker.bindPopup(`<strong>${user.name}</strong><br/><small>🟢 En ligne</small>`);
      
      realUserMarkers.set(user.id, marker);
      console.log(`✅ Nouveau marqueur ajouté pour ${user.name}`);
    }
  });
}

// ===== FOOTER SCROLL DETECTION =====
function initializeFooterScroll() {
  const footer = document.querySelector('.global-footer');
  let scrollThreshold = 150; // Afficher après 150px de scroll
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > scrollThreshold) {
      footer.classList.add('visible');
    } else {
      footer.classList.remove('visible');
    }
  });
}

// ===== PROFESSOR AVAILABILITY MANAGEMENT =====
let activeRequests = {}; // Stocke les timers pour chaque demande active
let requestCounter = 1; // Compteur pour générer des IDs uniques

function toggleMatiereAvailability(checkboxElement) {
  const matiere = checkboxElement.dataset.matiere;
  const isChecked = checkboxElement.checked;
  
  // Trouver le span de statut correspondant
  const label = checkboxElement.closest('label');
  const statusSpan = label.querySelector('.matiere-status');
  
  if (isChecked) {
    // Marquer comme disponible
    statusSpan.textContent = '🟢 Disponible';
    statusSpan.classList.remove('matiere-indisponible');
    statusSpan.classList.add('matiere-disponible');
    console.log(`✅ Professeur disponible pour: ${matiere}`);
    
    // Envoyer au serveur WebSocket
    sendTeacherAvailability(matiere, true);
  } else {
    // Marquer comme indisponible
    statusSpan.textContent = '🔴 Indisponible';
    statusSpan.classList.remove('matiere-disponible');
    statusSpan.classList.add('matiere-indisponible');
    console.log(`❌ Professeur indisponible pour: ${matiere}`);
    
    // Envoyer au serveur WebSocket
    sendTeacherAvailability(matiere, false);
  }
  
  // Mettre à jour le compteur de matières actives dans le profil
  updateTeacherMatiereCount();
}

/**
 * Envoie la disponibilité du professeur au serveur WebSocket
 */
function sendTeacherAvailability(matiere, isAvailable) {
  if (!ws || !wsConnected) {
    console.warn('⚠️ WebSocket non connecté');
    // Tenter de se connecter
    connectWebSocket();
    setTimeout(() => {
      if (wsConnected) {
        sendTeacherAvailability(matiere, isAvailable);
      }
    }, 1000);
    return;
  }
  
  const message = {
    type: isAvailable ? 'teacherAvailable' : 'teacherUnavailable',
    matiere: matiere,
    email: sessionData.email,
    prenom: sessionData.prenom,
    nom: sessionData.nom
  };
  
  console.log('📤 Envoi disponibilité professeur:', message);
  ws.send(JSON.stringify(message));
}

function getAvailableMatieres() {
  const checkboxes = document.querySelectorAll('.matiere-item input[type="checkbox"]:checked');
  const matieres = [];
  checkboxes.forEach(checkbox => {
    matieres.push(checkbox.dataset.matiere);
  });
  return matieres;
}

function updateTeacherMatiereCount() {
  const activeCheckboxes = document.querySelectorAll('.matiere-item input[type="checkbox"]:checked');
  const count = activeCheckboxes.length;
  const countElement = document.getElementById('prof-matieres-actives');
  if (countElement) {
    countElement.textContent = count;
  }
}

function loadCourseRequests() {
  const listeDemandesContainer = document.getElementById('liste-demandes-cours');
  if (!listeDemandesContainer) return;
  
  // Vider le contenu actuel
  listeDemandesContainer.innerHTML = '';
  
  const activeRequestsArray = Object.values(activeRequests);
  
  if (activeRequestsArray.length === 0) {
    const availableMatieres = getAvailableMatieres();
    if (availableMatieres.length === 0) {
      listeDemandesContainer.innerHTML = '<p class="no-demandes">Activez vos disponibilités dans les matières ci-dessus pour commencer à recevoir des demandes de cours en temps réel.</p>';
    } else {
      listeDemandesContainer.innerHTML = '<p class="no-demandes">🔍 Recherche de demandes en cours... Les demandes apparaîtront ici en temps réel.</p>';
    }
    return;
  }
  
  // Afficher chaque demande active avec timer
  activeRequestsArray.forEach(request => {
    const demandeElement = document.createElement('div');
    demandeElement.className = 'demande-item';
    demandeElement.dataset.requestId = request.id;
    
    const timeElapsed = Math.floor((Date.now() - request.timestamp) / 1000);
    const timeRemaining = Math.max(0, 20 - timeElapsed);
    
    demandeElement.innerHTML = `
      <div class="demande-info">
        <h4>${request.subject} - ${request.level}</h4>
        <p>👤 Élève: ${request.studentName}</p>
        <p>⏱️ Durée: 20 minutes</p>
        <p class="timer-text">⏰ Temps restant: <span class="timer-countdown" data-request-id="${request.id}">${timeRemaining}s</span></p>
      </div>
      <div class="demande-actions">
        <button class="btn-accepter" onclick="acceptCourseRequest('${request.id}')">Accepter</button>
        <button class="btn-refuser" onclick="refuseCourseRequest('${request.id}')">✗ Refuser</button>
      </div>
    `;
    listeDemandesContainer.appendChild(demandeElement);
    
    // Mettre à jour le compte à rebours chaque seconde
    updateCountdown(request.id, timeRemaining);
  });
}

function updateCountdown(requestId, initialTime) {
  let remainingTime = initialTime;
  
  const countdownInterval = setInterval(() => {
    remainingTime--;
    const timerElement = document.querySelector(`.timer-countdown[data-request-id="${requestId}"]`);
    
    if (!timerElement || remainingTime < 0) {
      clearInterval(countdownInterval);
      return;
    }
    
    timerElement.textContent = `${remainingTime}s`;
    
    // Changer la couleur selon le temps restant
    if (remainingTime <= 5) {
      timerElement.style.color = '#ef4444';
      timerElement.style.fontWeight = 'bold';
    } else if (remainingTime <= 10) {
      timerElement.style.color = '#f59e0b';
    }
    
    if (remainingTime <= 0) {
      clearInterval(countdownInterval);
    }
  }, 1000);
}

function autoRefuseRequest(requestId) {
  console.log(`Refus automatique de la demande ${requestId} (timeout 20s)`);
  
  const request = activeRequests[requestId];
  if (request) {
    delete activeRequests[requestId];
    loadCourseRequests();
    
    // Notification pour l'utilisateur
    const notification = document.createElement('div');
    notification.className = 'auto-refuse-notification';
    notification.textContent = `⏰ Demande expirée: ${request.subject} - ${request.studentName}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

function acceptCourseRequest(requestId) {
  console.log(`Cours accepté: ${requestId}`);
  
  const request = activeRequests[requestId];
  if (!request) {
    alert('Cette demande n\'est plus disponible.');
    return;
  }
  
  // Annuler le timer
  clearTimeout(request.timer);
  delete activeRequests[requestId];
  
  // Incrémenter la cagnotte du professeur
  if (sessionData.isTeacher && sessionData.email) {
    addCoursToTeacherEarnings(sessionData.email);
    updateCagnotteDisplay();
  }
  
  // Créer un Google Meet
  const meetLink = createGoogleMeet(request);
  
  // Afficher confirmation et ouvrir le Meet
  if (confirm(`Cours accepté avec ${request.studentName}!\n\n+5€ ajoutés à votre cagnotte!\n\nCliquez sur OK pour ouvrir Google Meet.`)) {
    window.open(meetLink, '_blank');
  }
  
  // Recharger les demandes
  loadCourseRequests();
}

function refuseCourseRequest(requestId) {
  console.log(`Cours refusé: ${requestId}`);
  
  const request = activeRequests[requestId];
  if (!request) {
    alert('Cette demande n\'est plus disponible.');
    return;
  }
  
  // Annuler le timer
  clearTimeout(request.timer);
  delete activeRequests[requestId];
  
  // Notification
  alert(`Demande refusée: ${request.subject} - ${request.studentName}\n\nLa place est maintenant disponible pour une nouvelle demande.`);
  
  // Recharger les demandes
  loadCourseRequests();
}

function createGoogleMeet(request) {
  // Créer une salle Jitsi avec notre intégration personnalisée
  const meetId = generateMeetId();
  return `https://lokin.online/jitsi-room.html?room=${meetId}`;
}

// ===== TEACHER EARNINGS SYSTEM =====
const COURS_REMUNERATION = 5; // 5€ par cours de 20min

function getTeacherEarnings(email) {
  const key = `teacher_earnings_${email}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      return { totalCours: 0, totalEarnings: 0, coursByMonth: {} };
    }
  }
  return { totalCours: 0, totalEarnings: 0, coursByMonth: {} };
}

function setTeacherEarnings(email, earnings) {
  const key = `teacher_earnings_${email}`;
  localStorage.setItem(key, JSON.stringify(earnings));
}

function addCoursToTeacherEarnings(email) {
  const earnings = getTeacherEarnings(email);
  
  // Incrémenter le total
  earnings.totalCours += 1;
  earnings.totalEarnings += COURS_REMUNERATION;
  
  // Ajouter au mois en cours
  const currentMonth = new Date().toISOString().substring(0, 7); // Format: "2026-01"
  if (!earnings.coursByMonth[currentMonth]) {
    earnings.coursByMonth[currentMonth] = { cours: 0, earnings: 0 };
  }
  earnings.coursByMonth[currentMonth].cours += 1;
  earnings.coursByMonth[currentMonth].earnings += COURS_REMUNERATION;
  
  setTeacherEarnings(email, earnings);
}

function updateCagnotteDisplay() {
  if (!sessionData.isTeacher || !sessionData.email) {
    return;
  }
  
  const earnings = getTeacherEarnings(sessionData.email);
  const currentMonth = new Date().toISOString().substring(0, 7);
  const monthData = earnings.coursByMonth[currentMonth] || { cours: 0, earnings: 0 };
  
  // Mettre à jour les éléments de la page
  const cagnotteTotal = document.getElementById('prof-cagnotte-total');
  const coursMois = document.getElementById('prof-cours-mois');
  const gainsMois = document.getElementById('prof-gains-mois');
  
  if (cagnotteTotal) {
    cagnotteTotal.textContent = `${earnings.totalEarnings}€`;
  }
  if (coursMois) {
    coursMois.textContent = monthData.cours;
  }
  if (gainsMois) {
    gainsMois.textContent = `${monthData.earnings}€`;
  }
  
  // Mettre à jour aussi le total de cours dans les stats
  const profCoursTotal = document.getElementById('prof-courses-total');
  if (profCoursTotal) {
    profCoursTotal.textContent = earnings.totalCours;
  }
}

// ===== TEACHER AUTHORIZATION SYSTEM =====
function getTeacherAuthorizations(email) {
  // Récupérer les matières autorisées depuis localStorage
  const key = `teacher_auth_${email}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      return [];
    }
  }
  return [];
}

function setTeacherAuthorizations(email, matieres) {
  // Sauvegarder les matières autorisées
  const key = `teacher_auth_${email}`;
  localStorage.setItem(key, JSON.stringify(matieres));
}

// DEMO: Pour tester le système, vous pouvez accorder des autorisations en ouvrant la console
// et en exécutant: setTeacherAuthorizations('email@prof.com', ['Mathématiques', 'Français', 'Anglais'])
// Ensuite, rechargez la page prof pour voir les matières autorisées apparaître

function loadAuthorizedMatieres() {
  if (!sessionData.isTeacher || !sessionData.email) {
    return;
  }
  
  const authorizedMatieres = getTeacherAuthorizations(sessionData.email);
  const container = document.getElementById('matieres-disponibilite-toggle');
  const noMatieresMsg = document.querySelector('.no-matieres-autorisees');
  
  if (authorizedMatieres.length === 0) {
    if (noMatieresMsg) {
      noMatieresMsg.style.display = 'block';
    }
    if (container) {
      container.classList.add('hidden');
    }
    return;
  }
  
  // Masquer le message "aucune matière"
  if (noMatieresMsg) {
    noMatieresMsg.style.display = 'none';
  }
  
  // Afficher les matières autorisées avec toggle
  if (container) {
    container.classList.remove('hidden');
    container.innerHTML = '';
    
    authorizedMatieres.forEach(matiere => {
      const label = document.createElement('label');
      label.className = 'matiere-item';
      label.innerHTML = `
        <input type="checkbox" data-action="toggleMatiere" data-matiere="${matiere}">
        <span class="matiere-status matiere-indisponible">🔴 Indisponible</span>
        <span class="matiere-label">${matiere}</span>
      `;
      container.appendChild(label);
    });
  }
}

async function demanderAutorisationMatieres() {
  if (!sessionData.isLoggedIn || !sessionData.email) {
    alert('⚠️ Veuillez vous connecter pour envoyer une demande.');
    return;
  }

  try {
    // Charger les matières disponibles
    const subjectsResponse = await fetch(`${API_BASE_URL}/api/admin/subjects?adminEmail=${encodeURIComponent('maxime.chantepiee@gmail.com')}`);
    const subjectsData = await subjectsResponse.json();
    const availableSubjects = subjectsData.subjects || [];

    // Afficher la modal avec les matières
    showTeacherSubjectsModal(availableSubjects);
  } catch (error) {
    console.error('❌ Erreur chargement matières:', error);
    alert('❌ Impossible de charger les matières disponibles');
  }
}

function showTeacherSubjectsModal(subjects) {
  const modal = document.getElementById('modal-teacher-subjects');
  const checklistContainer = document.getElementById('subjects-checklist');
  const submitBtn = document.getElementById('submit-teacher-subjects');
  const cancelBtn = document.getElementById('cancel-teacher-subjects');
  const closeBtn = document.getElementById('close-subjects-modal');

  // Remplir la liste des matières
  checklistContainer.innerHTML = '';
  subjects.sort().forEach(subject => {
    const label = document.createElement('label');
    label.className = 'subject-checkbox-label';
    label.innerHTML = `
      <input type="checkbox" class="teacher-subject-checkbox" value="${subject}">
      <span>${subject}</span>
    `;
    checklistContainer.appendChild(label);
  });

  // Afficher la modal
  modal.classList.remove('hidden');

  // Gérer la soumission
  const handleSubmit = async () => {
    const selectedCheckboxes = checklistContainer.querySelectorAll('.teacher-subject-checkbox:checked');
    const requestedSubjects = Array.from(selectedCheckboxes).map(cb => cb.value);

    if (requestedSubjects.length === 0) {
      alert('⚠️ Veuillez sélectionner au moins une matière');
      return;
    }

    const note = `Demande envoyée depuis l'espace professeur le ${new Date().toLocaleString('fr-FR')}`;

    try {
      const response = await fetch(`${API_BASE_URL}/api/teacher-authorization-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: sessionData.email,
          prenom: sessionData.prenom || '',
          nom: sessionData.nom || '',
          requestedSubjects,
          note
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi de la demande');
      }

      alert('✅ Votre demande a été envoyée à l\'administration.\n\nMatières sélectionnées: ' + requestedSubjects.join(', ') + '\n\nVous serez contacté pour le rendez-vous.');
      modal.classList.add('hidden');
    } catch (error) {
      console.error('❌ Erreur demande autorisation professeur:', error);
      alert(`❌ ${error.message}`);
    }
  };

  const handleCancel = () => {
    modal.classList.add('hidden');
  };

  // Ajouter les event listeners
  submitBtn.onclick = handleSubmit;
  cancelBtn.onclick = handleCancel;
  closeBtn.onclick = handleCancel;
}

// ===== STRIPE INTEGRATION =====

/**
 * Redirige vers la page de paiement Stripe avec l'email de l'utilisateur
 */
function goToStripeCheckout(plan) {
  console.log('💳 Redirection vers Stripe:', plan);
  
  // Vérifier que l'utilisateur est connecté
  const currentUser = userDB.getCurrentUser();
  if (!currentUser) {
    alert('⚠️ Veuillez vous connecter avant de souscrire à un abonnement.');
    goTo('eleve');
    return;
  }
  
  const email = currentUser.email;
  
  // URLs Stripe selon le plan
  const stripeUrls = {
    standard: 'https://buy.stripe.com/5kQ3co2Gp6y2cRZ4etd3i00',
    premium: 'https://buy.stripe.com/aFa14g94Nf4y19hh1fd3i01',
    extra: 'https://buy.stripe.com/fZu3co1Cl1dI4lt26ld3i02'
  };
  
  if (!stripeUrls[plan]) {
    console.error('❌ Plan inconnu:', plan);
    return;
  }
  
  // URL de retour après paiement (votre site)
  const returnUrl = window.location.origin + window.location.pathname + '?success=true&session_id={CHECKOUT_SESSION_ID}';
  const cancelUrl = window.location.origin + window.location.pathname + '?canceled=true';
  
  // Construire l'URL Stripe avec les paramètres
  const stripeUrl = stripeUrls[plan] + 
    `?prefilled_email=${encodeURIComponent(email)}` +
    `&client_reference_id=${encodeURIComponent(email)}`;
  
  console.log('🔗 Redirection vers:', stripeUrl);
  console.log('📧 Email:', email);
  
  // Ouvrir Stripe dans le même onglet
  window.location.href = stripeUrl;
}

/**
 * Simule un paiement Stripe réussi (pour tests)
 * En production, cette fonction sera appelée via webhook Stripe
 */
function simulateStripePayment(email, subscriptionType) {
  console.log('💳 Simulation paiement Stripe');
  console.log('📧 Email:', email);
  console.log('📦 Type:', subscriptionType);
  
  if (!email) {
    console.error('Email requis');
    return;
  }
  
  // Calculer la date de fin
  let endDate;
  if (subscriptionType === 'standard') {
    endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours
  } else if (subscriptionType === 'premium') {
    endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 an
  } else {
    console.error('Type invalide:', subscriptionType);
    return;
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
      console.log('👤 Utilisateur:', user);
      
      // Mettre à jour sessionData si c'est l'utilisateur connecté
      if (sessionData.email === email) {
        sessionData.isSubscribed = true;
        sessionData.subscriptionType = subscriptionType;
        console.log('🔄 Session mise à jour');
      }
      
      // Afficher un message
      alert(`🎉 Abonnement ${subscriptionType.toUpperCase()} activé avec succès !\n\nVous pouvez maintenant profiter de tous les avantages.`);
      
      // Rafraîchir la page pour afficher le nouveau statut
      location.reload();
    })
    .catch(error => {
      console.error('❌ Erreur activation abonnement:', error);
      alert('Erreur lors de l\'activation de l\'abonnement');
    });
}

// Rendre disponible globalement pour tests console et boutons HTML
window.simulateStripePayment = simulateStripePayment;
window.goToStripeCheckout = goToStripeCheckout;

console.log('💳 Stripe integration loaded');
console.log('🧪 Test: simulateStripePayment("email@example.com", "premium")');

// Initialiser le système d'avis au chargement
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    generateReviews();
    initReviewForm();
  });
} else {
  generateReviews();
  initReviewForm();
}

/* ---------- Keep floating elements inside viewport ---------- */
function clampFloatingElements() {
  try {
    const margin = 8; // px
    // look for elements that are fixed or absolute and visible
    const candidates = Array.from(document.querySelectorAll('body *'))
      .filter(el => el instanceof HTMLElement)
      .filter(el => {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
        return style.position === 'fixed' || style.position === 'absolute';
      });

    candidates.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      let dx = 0, dy = 0;
      if (rect.left < margin) dx = margin - rect.left;
      if (rect.right > window.innerWidth - margin) dx = (window.innerWidth - margin) - rect.right;
      if (rect.top < margin) dy = margin - rect.top;
      if (rect.bottom > window.innerHeight - margin) dy = (window.innerHeight - margin) - rect.bottom;

      if (dx !== 0 || dy !== 0) {
        const style = getComputedStyle(el);
        if (style.transform && style.transform !== 'none') {
          el.style.transform = 'none';
        }

        // compute numeric left/top (fall back to offset if 'auto')
        const curLeft = parseFloat(el.style.left || style.left) || el.offsetLeft || 0;
        const curTop = parseFloat(el.style.top || style.top) || el.offsetTop || 0;

        if (style.position === 'fixed' || style.position === 'absolute') {
          el.style.left = (curLeft + dx) + 'px';
          el.style.top = (curTop + dy) + 'px';
        }
      }
    });
  } catch (err) {
    console.warn('clampFloatingElements error', err);
  }
}

// Observe DOM mutations and window resizes to keep floating elements in view
const clampObserver = new MutationObserver(() => clampFloatingElements());
clampObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
window.addEventListener('resize', clampFloatingElements);
window.addEventListener('orientationchange', clampFloatingElements);
setTimeout(clampFloatingElements, 300);

/**
 * Dispatch an action name safely: try global function, then known handlers
 */
function dispatchAction(action, param, target) {
  try {
    // If a global function with this name exists, call it
    if (typeof window[action] === 'function') {
      try { window[action](param, target); return true; } catch(e){}
    }

    // Map of common actions -> functions (if defined)
    const map = {
      goTo, handleChooseOption, confirmLanguage, handleSubscription,
      handleLogout, showSampleTeacherProfile, showUserProfile, openReviewModal,
      closeReviewModal, acceptClashMatch, refuseClashMatch, copyToClipboard,
      startSearching, startSearchingTeacher
    };

    if (map[action] && typeof map[action] === 'function') {
      try { map[action](param, target); return true; } catch(e){}
    }

    // Fallback: try to trigger click on the element itself
    if (target && typeof target.click === 'function') {
      try { target.click(); return true; } catch(e){}
    }

    console.warn('dispatchAction: action not handled', action);
    return false;
  } catch (err) {
    console.error('dispatchAction error', err);
    return false;
  }
}
