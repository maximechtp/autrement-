console.log("Script loaded");

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
    const storedHash = localStorage.getItem(STORAGE_KEY_HASH);
    
    if (!stored || !storedHash) {
      return { chat: 0, debat: 0, cours: 0 };
    }
    
    const allUsageData = JSON.parse(stored);
    const userData = allUsageData[email] || { chat: 0, debat: 0, cours: 0 };
    
    // Vérifier l'intégrité
    const expectedHash = generateUsageHash(email, userData);
    if (storedHash !== expectedHash) {
      console.warn('Usage data tampering detected. Blocking access.');
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
    
    localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(allUsageData));
    localStorage.setItem(STORAGE_KEY_HASH, generateUsageHash(email, usageData));
    localStorage.setItem(STORAGE_KEY_TIMESTAMP, Date.now().toString());
    
    // Double stockage dans sessionStorage
    sessionStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(allUsageData));
    
    console.log(`Usage data for ${email}:`, usageData);
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
  // Compte admin : accès illimité automatique
  if (email?.toLowerCase() === 'maxime.chantepiee@gmail.com') {
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
    chat: 'Lucky Chat',
    debat: 'Débats',
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
  goTo('prof');
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
  // Sauvegarder toutes les données de session dans sessionStorage
  sessionStorage.setItem('isLoggedIn', 'true');
  sessionStorage.setItem('email', sessionData.email || '');
  sessionStorage.setItem('prenom', sessionData.prenom || '');
  sessionStorage.setItem('nom', sessionData.nom || '');
  sessionStorage.setItem('classe', sessionData.classe || '');
  sessionStorage.setItem('password', sessionData.password || '');
  sessionStorage.setItem('isSubscribed', sessionData.isSubscribed ? 'true' : 'false');
  sessionStorage.setItem('userPhoto', sessionData.userPhoto || '');
  sessionStorage.setItem('googleUser', sessionData.googleUser ? 'true' : 'false');
  sessionStorage.setItem('isTeacher', sessionData.isTeacher ? 'true' : 'false');
  sessionStorage.setItem('usageCount', JSON.stringify(sessionData.usageCount || {}));
}

function restoreSessionFromStorage() {
  const isLoggedIn = sessionStorage.getItem('isLoggedIn');
  if (isLoggedIn === 'true') {
    sessionData.isLoggedIn = true;
    sessionData.email = sessionStorage.getItem('email') || '';
    sessionData.prenom = sessionStorage.getItem('prenom') || '';
    sessionData.nom = sessionStorage.getItem('nom') || '';
    sessionData.classe = sessionStorage.getItem('classe') || '';
    sessionData.password = sessionStorage.getItem('password') || '';
    sessionData.isSubscribed = sessionStorage.getItem('isSubscribed') === 'true';
    sessionData.userPhoto = sessionStorage.getItem('userPhoto') || null;
    sessionData.googleUser = sessionStorage.getItem('googleUser') === 'true';
    sessionData.isTeacher = sessionStorage.getItem('isTeacher') === 'true';
    try {
      sessionData.usageCount = JSON.parse(sessionStorage.getItem('usageCount') || '{}');
    } catch (e) {
      sessionData.usageCount = {};
    }
    
    // Rediriger vers la page appropriée
    if (sessionData.isTeacher) {
      goTo('prof');
      // Charger les demandes de cours pour le professeur
      setTimeout(() => loadCourseRequests(), 100);
    } else {
      goTo('eleve-options');
    }
    
    return true;
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
      const subscriptionStatus = sessionData.isSubscribed ? '✓ Abonné' : '✗ Non abonné';
      avatar.title = `${sessionData.prenom} ${sessionData.nom}\n${subscriptionStatus}`;
    }
    
    // Add click handler to show appropriate profile
    avatar.onclick = () => {
      if (sessionData.isTeacher) {
        showTeacherProfile();
      } else {
        showUserProfile();
      }
    };
  } else {
    avatar.classList.add('hidden');
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
  profileStatus.textContent = sessionData.isSubscribed ? '✓ Abonné' : '✗ Non abonné';
  
  // Update plan buttons based on current subscription
  updatePlanButtons();
  
  // Show/hide extra courses section for Premium subscribers
  updateExtraCoursesVisibility();
  
  // Navigate to profile page
  goTo('user-profile');
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
      
      // Sauvegarder la session
      saveSessionToStorage();
      
      // Update avatar
      updateUserAvatar();
      
      goTo("eleve-options");
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
        
        // Initialize and trigger Google Sign-In
        google.accounts.id.initialize({
          client_id: '854092990889-0jri4gljn2tca49ke5m9oetucdrvjlfh.apps.googleusercontent.com',
          callback: handleGoogleSignIn,
          auto_select: false,
          cancel_on_tap_outside: false
        });
        
        // Afficher le prompt Google
        google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed()) {
            console.log('⚠️ Google Sign-In prompt not displayed:', notification.getNotDisplayedReason());
            
            // Si le prompt ne s'affiche pas, essayer renderButton
            const buttonDiv = document.createElement('div');
            buttonDiv.style.position = 'fixed';
            buttonDiv.style.top = '50%';
            buttonDiv.style.left = '50%';
            buttonDiv.style.transform = 'translate(-50%, -50%)';
            buttonDiv.style.zIndex = '10000';
            buttonDiv.style.background = 'white';
            buttonDiv.style.padding = '30px';
            buttonDiv.style.borderRadius = '10px';
            buttonDiv.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
            
            const googleBtnContainer = document.createElement('div');
            googleBtnContainer.id = 'google-signin-button-temp';
            
            buttonDiv.appendChild(googleBtnContainer);
            document.body.appendChild(buttonDiv);
            
            // Fermer automatiquement après authentification ou au clic en dehors
            const closePopup = () => {
              if (document.body.contains(buttonDiv)) {
                document.body.removeChild(buttonDiv);
              }
            };
            
            // Fermer si on clique en dehors
            setTimeout(() => {
              document.addEventListener('click', (e) => {
                if (!buttonDiv.contains(e.target)) {
                  closePopup();
                }
              }, { once: true });
            }, 100);
            
            google.accounts.id.renderButton(
              googleBtnContainer,
              { theme: 'outline', size: 'large', text: 'signin_with', width: 300 }
            );
          }
        });
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
  const prenom = document.getElementById('prenom').value.trim();
  const nom = document.getElementById('nom').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const classe = document.getElementById('classe').value;

  const errors = {
    prenom: '',
    nom: '',
    email: '',
    password: '',
    classe: ''
  };

  if (!prenom) {
    errors.prenom = 'Le prénom est requis';
  }
  if (!nom) {
    errors.nom = 'Le nom est requis';
  }
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
  // Classe est optionnelle - pas d'erreur si vide

  // Display errors
  document.getElementById('error-prenom').textContent = sanitizeText(errors.prenom);
  document.getElementById('error-nom').textContent = sanitizeText(errors.nom);
  document.getElementById('error-email').textContent = sanitizeText(errors.email);
  document.getElementById('error-password').textContent = sanitizeText(errors.password);
  document.getElementById('error-classe').textContent = ''; // Toujours vide car optionnel

  // Update input styling
  document.getElementById('prenom').classList.toggle('error', !!errors.prenom);
  document.getElementById('nom').classList.toggle('error', !!errors.nom);
  document.getElementById('email').classList.toggle('error', !!errors.email);
  document.getElementById('password').classList.toggle('error', !!errors.password);
  document.getElementById('classe').classList.remove('error'); // Jamais en erreur

  const isValid = !errors.prenom && !errors.nom && !errors.email && !errors.password;
  document.getElementById('btn-submit-eleve').disabled = !isValid;

  return isValid;
}

function setupFormValidation() {
  // Form validation for students
  const form = document.getElementById('form-eleve');
  const inputs = form.querySelectorAll('#prenom, #nom, #email, #password, #classe');
  
  inputs.forEach(input => {
    input.addEventListener('input', validateForm);
    input.addEventListener('change', validateForm);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (validateForm()) {
      const prenom = sanitizeText(document.getElementById('prenom').value);
      const nom = sanitizeText(document.getElementById('nom').value);
      const email = sanitizeText(document.getElementById('email').value);
      const password = document.getElementById('password').value;
      const classe = sanitizeText(document.getElementById('classe').value);
      
      try {
        // Vérifier si l'utilisateur existe déjà dans la base
        let user = userDB.getUserByEmail(email);
        
        if (!user) {
          // Nouveau compte - créer l'utilisateur
          console.log('📝 Création nouveau compte élève:', email);
          
          const userData = {
            email: email,
            prenom: prenom,
            nom: nom,
            classe: classe,
            isTeacher: false,
            photoURL: null,
            subscriptionType: null,
            isSubscribed: false
          };
          
          // Compte admin avec privilèges
          if (email.toLowerCase() === 'maxime.chantepiee@gmail.com') {
            if (password !== 'Prmt6g72') {
              alert('Mot de passe incorrect pour ce compte.');
              return;
            }
            console.log('✅ Connexion compte administrateur');
            userData.subscriptionType = 'premium';
            userData.isSubscribed = true;
          }
          
          user = await userDB.saveUser(userData);
        } else {
          // Utilisateur existant - mettre à jour la dernière connexion
          console.log('👤 Connexion utilisateur existant:', email);
          user.lastLogin = new Date().toISOString();
          await userDB.saveUser(user);
        }
        
        // Créer la session
        userDB.createSession(user);
        
        // Mettre à jour sessionData
        sessionData.prenom = user.prenom;
        sessionData.nom = user.nom;
        sessionData.email = user.email;
        sessionData.classe = user.classe;
        sessionData.isLoggedIn = true;
        sessionData.userPhoto = user.photoURL;
        sessionData.isTeacher = user.isTeacher;
        sessionData.isSubscribed = user.subscription.isActive;
        sessionData.subscriptionType = user.subscription.type;
        
        // Load usage data
        sessionData.usageCount = getUsageData(user.email);
        
        console.log('✅ Connexion réussie');
        console.log('📊 Statut abonnement:', sessionData.isSubscribed);
        console.log('📈 Données usage:', sessionData.usageCount);
        
        // Sauvegarder la session
        saveSessionToStorage();
        
        // Update avatar
        updateUserAvatar();
        
        goTo("eleve-options");
        
      } catch (error) {
        console.error('❌ Erreur connexion:', error);
        alert('Erreur lors de la connexion. Veuillez réessayer.');
      }
    }
  });
  
  // Form validation for teachers
  setupProfessorFormValidation();
}

function validateProfessorForm() {
  const prenom = document.getElementById('prof-prenom').value.trim();
  const nom = document.getElementById('prof-nom').value.trim();
  const email = document.getElementById('prof-email').value.trim();
  const password = document.getElementById('prof-password').value;

  const errors = {
    prenom: '',
    nom: '',
    email: '',
    password: ''
  };

  if (!prenom) {
    errors.prenom = 'Le prénom est requis';
  }
  if (!nom) {
    errors.nom = 'Le nom est requis';
  }
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
  document.getElementById('error-prof-prenom').textContent = sanitizeText(errors.prenom);
  document.getElementById('error-prof-nom').textContent = sanitizeText(errors.nom);
  document.getElementById('error-prof-email').textContent = sanitizeText(errors.email);
  document.getElementById('error-prof-password').textContent = sanitizeText(errors.password);

  // Update input styling
  document.getElementById('prof-prenom').classList.toggle('error', !!errors.prenom);
  document.getElementById('prof-nom').classList.toggle('error', !!errors.nom);
  document.getElementById('prof-email').classList.toggle('error', !!errors.email);
  document.getElementById('prof-password').classList.toggle('error', !!errors.password);

  const isValid = !errors.prenom && !errors.nom && !errors.email && !errors.password;
  document.getElementById('btn-submit-professeur').disabled = !isValid;

  return isValid;
}

function setupProfessorFormValidation() {
  const form = document.getElementById('form-professeur');
  if (!form) return;
  
  const inputs = form.querySelectorAll('#prof-prenom, #prof-nom, #prof-email, #prof-password');
  
  inputs.forEach(input => {
    input.addEventListener('input', validateProfessorForm);
    input.addEventListener('change', validateProfessorForm);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (validateProfessorForm()) {
      const prenom = sanitizeText(document.getElementById('prof-prenom').value);
      const nom = sanitizeText(document.getElementById('prof-nom').value);
      const email = sanitizeText(document.getElementById('prof-email').value);
      const password = document.getElementById('prof-password').value;
      
      try {
        // Vérifier si l'utilisateur existe déjà dans la base
        let user = userDB.getUserByEmail(email);
        
        if (!user) {
          // Nouveau compte professeur
          console.log('📝 Création nouveau compte professeur:', email);
          
          const userData = {
            email: email,
            prenom: prenom,
            nom: nom,
            classe: 'Professeur',
            isTeacher: true,
            photoURL: null,
            subscriptionType: null,
            isSubscribed: false,
            authorizedSubjects: [],
            availableSubjects: [],
            courses: [],
            totalEarnings: 0,
            rating: null
          };
          
          // Compte admin avec tous les privilèges
          if (email.toLowerCase() === 'maxime.chantepiee@gmail.com') {
            if (password !== 'Prmt6g72') {
              alert('Mot de passe incorrect pour ce compte.');
              return;
            }
            console.log('✅ Connexion compte administrateur professeur');
            userData.subscriptionType = 'premium';
            userData.isSubscribed = true;
            userData.authorizedSubjects = ['Mathématiques', 'Français', 'Histoire-Géographie', 'Philosophie', 
                                          'Physique-Chimie', 'SVT', 'Anglais', 'Espagnol', 'Allemand', 
                                          'Italien', 'Latin', 'Grec ancien', 'Économie', 'SES', 'Arts plastiques'];
          }
          
          user = await userDB.saveUser(userData);
        } else {
          // Utilisateur existant
          console.log('👤 Connexion professeur existant:', email);
          user.lastLogin = new Date().toISOString();
          await userDB.saveUser(user);
        }
        
        // Créer la session
        userDB.createSession(user);
        
        // Mettre à jour sessionData
        sessionData.prenom = user.prenom;
        sessionData.nom = user.nom;
        sessionData.email = user.email;
        sessionData.classe = 'Professeur';
        sessionData.isLoggedIn = true;
        sessionData.userPhoto = user.photoURL;
        sessionData.isTeacher = true;
        sessionData.isSubscribed = user.subscription.isActive;
        sessionData.subscriptionType = user.subscription.type;
        
        console.log('✅ Connexion professeur réussie');
        console.log('📊 Statut abonnement:', sessionData.isSubscribed);
        
        // Sauvegarder la session
        saveSessionToStorage();
        
        // Update avatar
        updateUserAvatar();
        
        goTo("prof");
        
      } catch (error) {
        console.error('❌ Erreur connexion professeur:', error);
        alert('Erreur lors de la connexion. Veuillez réessayer.');
      }
    }
  });
}

function initGoogleSignInProfessor() {
  const btnGoogleLoginProf = document.getElementById('btn-google-login-prof');
  if (btnGoogleLoginProf) {
    btnGoogleLoginProf.addEventListener('click', () => {
      if (typeof google === 'undefined' || !google.accounts) {
        console.warn('Google API not loaded yet. Simulating sign-in for professor...');
        simulateGoogleSignInProfessor();
        return;
      }
      
      try {
        google.accounts.id.initialize({
          client_id: '854092990889-0jri4gljn2tca49ke5m9oetucdrvjlfh.apps.googleusercontent.com',
          callback: handleGoogleSignInProfessor,
          auto_select: false
        });
        google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.log('Google Sign-In prompt not displayed:', notification.getNotDisplayedReason());
            simulateGoogleSignInProfessor();
          }
        });
      } catch (error) {
        console.error('Error initializing Google Sign-In:', error);
        simulateGoogleSignInProfessor();
      }
    });
  }
}

function handleGoogleSignInProfessor(response) {
  const userData = parseJwt(response.credential);
  
  sessionData.prenom = userData.given_name || '';
  sessionData.nom = userData.family_name || '';
  sessionData.email = userData.email || '';
  sessionData.classe = 'Professeur';
  sessionData.googleUser = true;
  sessionData.isLoggedIn = true;
  sessionData.userPhoto = userData.picture || null;
  sessionData.isTeacher = true;
  
  sessionData.isSubscribed = checkSubscription(userData.email);
  
  console.log('Google Sign-In successful (Professor):', userData);
  console.log('Subscription status:', sessionData.isSubscribed);
  
  saveSessionToStorage();
  updateUserAvatar();
  
  goTo("prof");
}

function simulateGoogleSignInProfessor() {
  const confirmed = confirm('Simulation de connexion Google Professeur\n\nVoulez-vous vous connecter avec un compte Google simulé?');
  if (confirmed) {
    sessionData.prenom = 'Professeur';
    sessionData.nom = 'Google';
    sessionData.email = 'prof@gmail.com';
    sessionData.classe = 'Professeur';
    sessionData.googleUser = true;
    sessionData.isLoggedIn = true;
    sessionData.userPhoto = null;
    sessionData.isTeacher = true;
    
    sessionData.isSubscribed = checkSubscription(sessionData.email);
    
    console.log('Simulation: Professor Google Sign-In successful');
    console.log('Subscription status:', sessionData.isSubscribed);
    
    saveSessionToStorage();
    updateUserAvatar();
    
    goTo("prof");
  }
}

function setupFormValidation() {
  const form = document.getElementById('form-eleve');
  const inputs = form.querySelectorAll('input');
  
  inputs.forEach(input => {
    input.addEventListener('input', validateForm);
    input.addEventListener('change', validateForm);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (validateForm()) {
      sessionData.prenom = sanitizeText(document.getElementById('prenom').value);
      sessionData.nom = sanitizeText(document.getElementById('nom').value);
      sessionData.email = sanitizeText(document.getElementById('email').value);
      sessionData.password = document.getElementById('password').value; // En production, hasher le mot de passe
      sessionData.classe = sanitizeText(document.getElementById('classe').value);
      sessionData.isLoggedIn = true;
      sessionData.userPhoto = null;
      
      // Check subscription status
      sessionData.isSubscribed = checkSubscription(sessionData.email);
      
      // Load usage data
      sessionData.usageCount = getUsageData(sessionData.email);
      
      console.log('Form login successful');
      console.log('Subscription status:', sessionData.isSubscribed);
      console.log('Usage data:', sessionData.usageCount);
      
      // Sauvegarder la session
      saveSessionToStorage();
      
      // Update avatar
      updateUserAvatar();
      
      goTo("eleve-options");
    }
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
  
  // Setup Google Sign-In
  initGoogleSignIn();
  initGoogleSignInProfessor();

  // Setup back button
  setupBackButton();
  
  // Setup footer scroll detection
  initializeFooterScroll();
  
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
    
    console.log('✅ Session restaurée automatiquement');
    console.log('📊 Abonnement actif:', sessionData.isSubscribed);
    
    updateUserAvatar();
    
    // Rediriger vers la bonne page selon le type d'utilisateur
    if (user.isTeacher) {
      goTo("prof");
    } else {
      goTo("eleve-options");
    }
    return;
  }
  
  // Sinon, afficher la page d'accueil
  console.log('ℹ️ Aucune session active');
  goTo("home");

  document.body.addEventListener("click", (event) => {
    const target = event.target;
    const action = target.dataset.action;
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
            console.log("Redirecting teacher to prof page");
            goTo("prof");
          } else {
            // Si c'est un élève
            if (param === "professeur") {
              alert("Vous êtes déjà connecté en tant qu'élève. Déconnectez-vous pour accéder à l'espace professeur.");
              return;
            }
            // Élève clique sur "Je suis élève" - retour aux options
            console.log("Redirecting student to eleve-options");
            goTo("eleve-options");
          }
        } else {
          console.log("User not logged in, going to:", param);
          goTo(param);
        }
        break;

      case "chooseOption":
        console.log("chooseOption clicked with param:", param);
        console.log("User logged in:", sessionData.isLoggedIn);
        console.log("User email:", sessionData.email);
        
        // Vérifier les accès selon le type d'abonnement
        const currentUser = userDB.getCurrentUser();
        if (currentUser && typeof stripePayment !== 'undefined') {
          const canUse = stripePayment.canUseFeature(
            param === 'chat' ? 'ai' : 
            param === 'debat' ? 'ai' : 
            'book_classes'
          );
          
          if (!canUse && param === 'cours') {
            // Pour les cours, vérifier l'accès spécifique
            const access = stripePayment.getSubscriptionAccess(
              currentUser.subscription.isActive ? currentUser.subscription.type : 'gratuit'
            );
            
            if (!access.canBookClasses) {
              console.log('❌ Accès refusé: cours réservés aux abonnés');
              stripePayment.showUpgradeModal('book_classes');
              break;
            }
          }
        }
        
        // Vérifier la limite d'utilisation pour les utilisateurs gratuits
        if (!sessionData.isSubscribed) {
          // Déterminer le type d'activité
          let activityType = param === 'chat' ? 'chat' : (param === 'debat' ? 'debat' : 'cours');
          
          console.log("Checking usage limit for:", activityType);
          
          // Utiliser un email par défaut si l'utilisateur n'est pas connecté
          const emailToCheck = sessionData.email || 'anonymous_user';
          
          const usageStatus = checkUsageLimit(emailToCheck, activityType);
          console.log("Usage status:", usageStatus);
          
          if (!usageStatus.allowed) {
            console.log("Usage limit reached, showing limit page");
            showUsageLimitPage(activityType);
            break;
          }
          
          // Incrémenter le compteur
          incrementUsage(emailToCheck, activityType);
          
          // Afficher un message sur les essais restants
          if (usageStatus.remaining <= 1) {
            const typeNames = { chat: 'Lucky Chat', debat: 'Débat', cours: 'Cours' };
            alert(`Attention: Il vous reste ${usageStatus.remaining} essai gratuit pour ${typeNames[activityType]}.`);
          }
        }
        
        // For courses, show option confirmation first
        if (param === "cours") {
          console.log("Course option selected, opening confirmation modal");
          sessionData.option = param;
          // Ouvrir directement la modal de confirmation pour choisir matière et niveau
          openConfirmation(param);
        } else if (param === "chat" || param === "debat") {
          // For chat and debate, show language selection first
          console.log("Chat/Debat option selected, going to language selection");
          sessionData.option = param;
          goTo("langue-selection");
          updateLanguageTitle(param);
        }
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
        // Fermer proprement la connexion WebSocket
        disconnectWebSocket();
        goTo("home");
        resetSession();
        break;

      case "acceptConnection":
        createOrJoinMeet();
        break;

      case "refuseConnection":
        goTo("search");
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
        // Rediriger vers la page des abonnements après avoir terminé
        if (sessionData.isLoggedIn) {
          showUserProfile();
        } else {
          goTo("home");
        }
        // Ne pas réinitialiser la session pour garder les données utilisateur
        break;

      case "startProfWaiting":
        goTo("prof-waiting");
        break;

      case "stopProfWaiting":
        goTo("prof");
        break;
      
      case "toggleMatiere":
        toggleMatiereAvailability(target);
        break;

      case "demanderAutorisation":
        demanderAutorisationMatieres();
        break;

      default:
        console.warn("Action inconnue :", action);
    }
  });
});

/* ---------- Navigation ---------- */
function setupBackButton() {
  const backBtn = document.getElementById("btn-back");
  backBtn.addEventListener("click", () => {
    goBack();
  });
}

function goTo(pageId) {
  // Si déjà connecté et qu'on essaie d'aller sur la page de connexion, rediriger vers eleve-options
  if (sessionData.isLoggedIn && pageId === 'eleve') {
    pageId = 'eleve-options';
  }
  
  // Check if login is required for this page
  if (!checkLoginRequired(pageId)) {
    return;
  }
  
  // Get current visible page before changing
  const currentPage = document.querySelector(".page:not(.hidden)");
  
  // Add to history only when navigating away from a page that's not home
  if (currentPage && currentPage.id !== pageId && currentPage.id !== "home") {
    navigationHistory.push(currentPage.id);
  }

  // Hide all pages
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  // Hide modal overlay
  document.getElementById("modal-overlay").classList.add("hidden");
  
  const page = document.getElementById(pageId);
  if (page) {
    page.classList.remove("hidden");
  } else {
    console.error("Page introuvable :", pageId);
  }
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
function goTo(pageId) {
  // Hide all pages
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  // Hide modal overlay
  document.getElementById("modal-overlay").classList.add("hidden");
  
  // Clean up map if leaving search page
  if (pageId !== "search") {
    cleanupWorldMap();
  }
  
  const page = document.getElementById(pageId);
  if (page) {
    page.classList.remove("hidden");
    
    // Initialize map AFTER the search page is visible
    if (pageId === "search") {
      console.log("🗺️ Search page now visible, initializing map...");
      setTimeout(() => {
        initializeWorldMap();
        connectWebSocket();
        requestGeolocation();
      }, 300);
    }
    
    // Load course requests when accessing professor page
    if (pageId === "prof" && sessionData.isTeacher) {
      setTimeout(() => {
        loadCourseRequests();
        loadAuthorizedMatieres();
        updateCagnotteDisplay();
      }, 100);
    }
  } else {
    console.error("Page introuvable :", pageId);
  }
}

/* ---------- Language Selection ---------- */
function updateLanguageTitle(option) {
  const title = document.getElementById("langue-title");
  if (option === "debat") {
    title.textContent = "Choisissez une langue pour le débat";
  } else if (option === "chat") {
    title.textContent = "Choisissez une langue pour le Lucky Chat";
  }
}

function confirmLanguage() {
  const languageSelect = document.getElementById("langue-select");
  sessionData.langue = languageSelect.value;
  console.log("Language selected:", sessionData.langue);
  
  // For debate, create and show the Meet immediately
  if (sessionData.option === "debat") {
    createDebateMeet();
  } else if (sessionData.option === "chat") {
    // For chat, go directly to search without asking for subject
    sessionData.matiere = "Conversation générale";
    sessionData.niveau = "N/A";
    goTo("search");
    startSearching();
  } else {
    // For courses, show confirmation with subject selection
    openConfirmation(sessionData.option);
  }
}

function createDebateMeet() {
  // Generate a unique meet ID
  const meetId = generateMeetId();
  // Use Jitsi Meet for live video conferencing
  sessionData.meetLink = `https://meet.jitsi/${meetId}`;
  sessionData.matiere = "Débat";
  sessionData.niveau = "N/A";
  
  // Display the Meet creation page
  document.getElementById("meet-created-link").href = sessionData.meetLink;
  document.getElementById("meet-created-id").textContent = `ID de réunion: ${meetId}`;
  document.getElementById("meet-created-text").textContent = 
    `Votre débat en ${sessionData.langue} a été créé! Partagez le lien ci-dessous avec les autres participants.`;
  
  goTo("meet-created");
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
  console.log("Starting search with:", sessionData);
  
  // Map initialization now happens in goTo()
  // Simulate search after 3 seconds
  setTimeout(() => {
    showFoundProfile();
  }, 3000);
}

function startSearchingTeacher() {
  console.log("Starting teacher search for:", sessionData.matiere, sessionData.niveau);
  
  // Map initialization now happens in goTo()
  // Simuler la recherche d'un professeur (plus rapide)
  setTimeout(() => {
    showFoundTeacher();
  }, 2000);
}

function showFoundTeacher() {
  // Simuler la découverte d'un professeur spécialisé dans la matière
  const teacherNames = [
    "Prof. Martin",
    "Prof. Dupont",
    "Prof. Bernard",
    "Prof. Rousseau",
    "Prof. Laurent"
  ];
  
  const randomTeacher = teacherNames[Math.floor(Math.random() * teacherNames.length)];
  sessionData.partnerName = randomTeacher;
  
  document.getElementById("profile-info").textContent = 
    `Professeur trouvé : ${randomTeacher}\nMatière : ${sessionData.matiere}\nNiveau : ${sessionData.niveau}\nExpérience : 5+ ans`;
  
  goTo("profile");
}

function showFoundProfile() {
  // Trouver un élève qui cherche la même activité
  const studentNames = [
    "Alice - Classe: 2nde",
    "Marc - Classe: 1ère",
    "Sophie - Classe: Terminale",
    "Thomas - Classe: 3e",
    "Emma - Classe: 2nde",
    "Lucas - Classe: 1ère",
    "Léa - Classe: Terminale",
    "Hugo - Classe: 3e"
  ];
  
  sessionData.partnerName = studentNames[Math.floor(Math.random() * studentNames.length)];
  
  // Adapter le message selon l'option choisie
  let activityText = "";
  if (sessionData.option === "chat") {
    activityText = "Lucky Chat";
  } else if (sessionData.option === "debat") {
    activityText = "Débat";
  }
  
  document.getElementById("profile-info").textContent = 
    `Élève trouvé : ${sessionData.partnerName}\nRecherche : ${activityText} en ${sessionData.langue}\nStatut : Disponible`;
  
  goTo("profile");
}

function createOrJoinMeet() {
  // Generate a unique meet ID based on session data
  const meetId = generateMeetId();
  // Use Jitsi Meet for live video conferencing
  sessionData.meetLink = `https://meet.jitsi/${meetId}`;
  
  document.getElementById("meet-link").href = sessionData.meetLink;
  document.getElementById("meet-info").textContent = `ID de réunion: ${meetId}`;
  
  // Determine if creating or joining
  const isCreator = Math.random() > 0.5;
  if (isCreator) {
    document.getElementById("call-status").textContent = 
      "Vous avez créé une réunion. Votre partenaire a reçu le lien et arrive...";
  } else {
    document.getElementById("call-status").textContent = 
      "Vous avez rejoint la réunion de votre partenaire. La conversation commence...";
  }
  
  goTo("call");
}

function generateMeetId() {
  // Generate a Jitsi Meet room name
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  const roomName = `specialistes-${timestamp}-${randomStr}`;
  return roomName;
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
  console.log("Rating given:", rating);
  const stars = document.querySelectorAll("#stars span");
  stars.forEach((star, index) => {
    if (index < rating) {
      star.style.color = "gold";
    } else {
      star.style.color = "gray";
    }
  });
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

function cleanupWorldMap() {
  if (map) {
    // Remove all markers
    mapMarkers.forEach(marker => map.removeLayer(marker));
    mapMarkers = [];
    
    // Remove map
    map.remove();
    map = null;
    mapInitialized = false;
  }
  
  // Déconnecter le WebSocket quand on quitte la page de recherche
  disconnectWebSocket();
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

      // Générer des utilisateurs aléatoires réalistes
      const users = generateRandomUsers(12);

      // Ajouter les marqueurs
      users.forEach((user) => {
        const customIcon = L.divIcon({
          className: "user-marker",
          html: user.emoji,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker([user.lat, user.lng], { icon: customIcon }).addTo(map);
        marker.bindPopup(`<strong>${user.name}</strong><br/>Langue: ${user.lang}<br/><small>En ligne</small>`);
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
  const wsHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'localhost:8080'
    : window.location.host; // Utiliser le même host en production
  
  const wsUrl = `${wsProtocol}//${wsHost}`;

  console.log(`🔌 Connexion au WebSocket: ${wsUrl}`);

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      wsConnected = true;
      console.log('✅ WebSocket connecté');

      // Demander la géolocalisation si pas encore fait
      requestGeolocation().then((hasPermission) => {
        if (hasPermission) {
          sendLocationToServer();
        } else {
          console.log('ℹ️ Utilisation sans géolocalisation');
        }
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connected':
            console.log('📱 Connecté avec ID:', data.clientId);
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
            break;
        }
      } catch (error) {
        console.error('Erreur traitement message WebSocket:', error);
      }
    };

    ws.onclose = () => {
      wsConnected = false;
      console.log('🔌 WebSocket déconnecté');
      
      // Tentative de reconnexion après 5 secondes
      setTimeout(() => {
        if (document.getElementById('search') && !document.getElementById('search').classList.contains('hidden')) {
          console.log('🔄 Tentative de reconnexion...');
          connectWebSocket();
        }
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('⚠️ Erreur WebSocket:', error);
      wsConnected = false;
    };

  } catch (error) {
    console.error('Erreur création WebSocket:', error);
    wsConnected = false;
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
        html: "👤",
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([user.lat, user.lng], { icon: customIcon }).addTo(map);
      marker.bindPopup(`<strong>${user.name}</strong><br/><small>En ligne</small>`);
      
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
    console.log(`Professeur disponible pour: ${matiere}`);
    
    // Démarrer la recherche de demandes pour cette matière
    startSearchingForRequests(matiere);
  } else {
    // Marquer comme indisponible
    statusSpan.textContent = '🔴 Indisponible';
    statusSpan.classList.remove('matiere-disponible');
    statusSpan.classList.add('matiere-indisponible');
    console.log(`Professeur indisponible pour: ${matiere}`);
    
    // Arrêter la recherche pour cette matière
    stopSearchingForRequests(matiere);
  }
  
  // Mettre à jour le compteur de matières actives dans le profil
  updateTeacherMatiereCount();
  
  // TODO: Envoyer au backend pour notifier le système de matching
  // updateProfessorAvailability(matiere, isChecked);
}

function getAvailableMatieres() {
  const checkboxes = document.querySelectorAll('.matiere-item input[type="checkbox"]:checked');
  const matieres = [];
  checkboxes.forEach(checkbox => {
    matieres.push(checkbox.dataset.matiere);
  });
  return matieres;
}

function startSearchingForRequests(matiere) {
  console.log(`Recherche de demandes pour ${matiere}...`);
  
  // Simuler l'arrivée de demandes (dans un vrai système, ce serait via WebSocket/SSE)
  setTimeout(() => {
    if (getAvailableMatieres().includes(matiere)) {
      simulateIncomingRequest(matiere);
    }
  }, Math.random() * 5000 + 2000); // Entre 2 et 7 secondes
}

function stopSearchingForRequests(matiere) {
  console.log(`Arrêt de la recherche pour ${matiere}`);
  // Annuler toutes les demandes actives pour cette matière
  Object.keys(activeRequests).forEach(requestId => {
    const request = activeRequests[requestId];
    if (request.subject === matiere) {
      clearTimeout(request.timer);
      delete activeRequests[requestId];
    }
  });
  
  loadCourseRequests();
}

function simulateIncomingRequest(matiere) {
  const students = ['Sophie Martin', 'Thomas Dubois', 'Emma Laurent', 'Lucas Bernard', 'Marie Petit', 'Antoine Moreau'];
  const levels = ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6e', '5e', '4e', '3e', '2nde', '1ère', 'Terminale'];
  
  const requestId = `req_${Date.now()}_${requestCounter++}`;
  const request = {
    id: requestId,
    studentName: students[Math.floor(Math.random() * students.length)],
    subject: matiere,
    level: levels[Math.floor(Math.random() * levels.length)],
    timestamp: Date.now()
  };
  
  // Ajouter la demande avec un timer de 20 secondes
  activeRequests[requestId] = {
    ...request,
    timer: setTimeout(() => {
      autoRefuseRequest(requestId);
    }, 20000) // 20 secondes
  };
  
  console.log(`Nouvelle demande reçue:`, request);
  loadCourseRequests();
  
  // Continuer à chercher d'autres demandes si toujours disponible
  if (getAvailableMatieres().includes(matiere)) {
    setTimeout(() => {
      if (getAvailableMatieres().includes(matiere) && Math.random() > 0.5) {
        simulateIncomingRequest(matiere);
      }
    }, Math.random() * 10000 + 5000); // Entre 5 et 15 secondes
  }
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
        <button class="btn-accepter" onclick="acceptCourseRequest('${request.id}')">✓ Accepter</button>
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
  // En production, cela créerait un vrai Google Meet via l'API
  // Pour l'instant, on simule avec un lien vers Google Meet
  const meetId = `lokin-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  return `https://meet.google.com/${meetId}`;
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

function demanderAutorisationMatieres() {
  const email = 'lokin.officiel@gmail.com';
  const subject = encodeURIComponent('Demande d\'autorisation pour enseigner des matières');
  const body = encodeURIComponent(
    `Bonjour,\n\n` +
    `Je souhaite prendre rendez-vous pour obtenir l'autorisation d'enseigner des matières sur la plateforme Lok In.\n\n` +
    `Mes informations:\n` +
    `Nom: ${sessionData.prenom} ${sessionData.nom}\n` +
    `Email: ${sessionData.email}\n\n` +
    `Matières souhaitées: [À préciser lors du rendez-vous]\n\n` +
    `Merci de me contacter pour fixer un rendez-vous.\n\n` +
    `Cordialement,\n` +
    `${sessionData.prenom} ${sessionData.nom}`
  );
  
  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
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
