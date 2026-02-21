/**
 * Gestionnaire d'authentification pour LOK IN
 * Gère la connexion, l'inscription et la récupération de mot de passe
 */

// Variables globales pour l'authentification
let currentAccountType = 'eleve'; // 'eleve' ou 'professeur'

// ===== SUBSCRIPTION SYNC =====

/**
 * Synchronise le statut d'abonnement avec le serveur
 */
async function syncSubscriptionStatus(email) {
  if (!email) return false;
  
  try {
    console.log('🔄 Synchronisation du statut d\'abonnement pour:', email);
    const response = await fetch(`${API_BASE_URL}/api/user/${encodeURIComponent(email)}`);
    const data = await response.json();
    
    if (data.success && data.user && data.user.subscription) {
      const sub = data.user.subscription;
      
      // Mettre à jour sessionData
      sessionData.isSubscribed = sub.isActive || false;
      sessionData.subscriptionType = sub.type || null;
      
      // Mettre à jour localStorage
      const user = userDB.getUserByEmail(email);
      if (user) {
        user.subscription = sub;
        await userDB.saveUser(user);
      }
      
      console.log(`✅ Abonnement synchronisé: ${sub.isActive ? 'Actif' : 'Inactif'} (${sub.type || 'aucun'})`);
      return sub.isActive;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Erreur synchronisation abonnement:', error);
    return false;
  }
}

// ===== MODAL MANAGEMENT =====

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    // Sauvegarder la position de scroll actuelle
    const scrollY = window.scrollY;
    
    // Empêcher le scroll du body
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    
    // Afficher le modal
    modal.classList.remove('hidden');
    
    // Focus sur le modal pour l'accessibilité
    requestAnimationFrame(() => {
      const firstInput = modal.querySelector('input');
      if (firstInput) {
        firstInput.focus();
      }
    });
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    // Cacher le modal
    modal.classList.add('hidden');
    
    // Restaurer le scroll du body
    const scrollY = document.body.style.top;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.overflow = '';
    document.body.style.width = '';
    
    // Restaurer la position de scroll
    if (scrollY) {
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    
    // Réinitialiser le formulaire
    const form = modal.querySelector('form');
    if (form) {
      form.reset();
      clearModalErrors(form);
    }
  }
}

function clearModalErrors(form) {
  const errorMessages = form.querySelectorAll('.error-message');
  errorMessages.forEach(error => error.textContent = '');
  
  const inputs = form.querySelectorAll('input, select');
  inputs.forEach(input => input.classList.remove('error'));
}

// ===== AUTHENTICATION LOGIC =====

/**
 * Met à jour le message de bienvenue sur la page
 */
function updateWelcomeMessage(prenom, accountType) {
  const welcomeTextId = accountType === 'professeur' ? 'welcome-text-prof' : 'welcome-text-eleve';
  const welcomeElement = document.getElementById(welcomeTextId);
  
  if (welcomeElement) {
    welcomeElement.textContent = `👋 Bonjour ${prenom}`;
  }
}

/**
 * Gestion du bouton "Créer un profil"
 */
function handleCreateAccountClick(accountType) {
  console.log('📝 Ouverture modal création profil:', accountType);
  currentAccountType = accountType;
  
  // Montrer/cacher le champ classe selon le type de compte
  const classeGroup = document.getElementById('new-classe-group');
  if (classeGroup) {
    classeGroup.style.display = accountType === 'eleve' ? 'block' : 'none';
  }
  
  openModal('modal-create-account');
}

/**
 * Gestion du bouton "Mot de passe oublié"
 */
function handleForgotPasswordClick(accountType) {
  console.log('🔑 Ouverture modal récupération mot de passe:', accountType);
  currentAccountType = accountType;
  openModal('modal-forgot-password');
}

/**
 * Validation et soumission du formulaire de création de compte
 */
async function handleCreateAccountSubmit(event) {
  event.preventDefault();
  console.log('📝 Soumission formulaire création compte pour:', currentAccountType);
  
  // Récupérer les valeurs
  const prenom = document.getElementById('new-prenom').value.trim();
  const nom = document.getElementById('new-nom').value.trim();
  const email = document.getElementById('new-email').value.trim();
  const password = document.getElementById('new-password').value;
  const passwordConfirm = document.getElementById('new-password-confirm').value;
  const classe = document.getElementById('new-classe').value;
  
  // Validation
  const errors = {};
  
  if (!prenom) {
    errors.prenom = 'Le prénom est requis';
  }
  
  if (!nom) {
    errors.nom = 'Le nom est requis';
  }
  
  if (!email) {
    errors.email = 'L\'email est requis';
  } else if (!validateEmail(email)) {
    errors.email = 'Adresse email invalide';
  }
  
  if (!password) {
    errors.password = 'Le mot de passe est requis';
  } else if (password.length < 6) {
    errors.password = 'Le mot de passe doit contenir au moins 6 caractères';
  }
  
  if (!passwordConfirm) {
    errors.passwordConfirm = 'Veuillez confirmer le mot de passe';
  } else if (password !== passwordConfirm) {
    errors.passwordConfirm = 'Les mots de passe ne correspondent pas';
  }
  
  // Afficher les erreurs
  document.getElementById('error-new-prenom').textContent = errors.prenom || '';
  document.getElementById('error-new-nom').textContent = errors.nom || '';
  document.getElementById('error-new-email').textContent = errors.email || '';
  document.getElementById('error-new-password').textContent = errors.password || '';
  document.getElementById('error-new-password-confirm').textContent = errors.passwordConfirm || '';
  
  // Si des erreurs, arrêter
  if (Object.keys(errors).length > 0) {
    console.log('❌ Erreurs de validation:', errors);
    return;
  }
  
  try {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = userDB.getUserByEmail(email);
    if (existingUser) {
      document.getElementById('error-new-email').textContent = 'Un compte existe déjà avec cet email';
      alert('⚠️ Un compte existe déjà avec cet email.\n\nVoulez-vous vous connecter à la place?');
      closeModal('modal-create-account');
      return;
    }
    
    // Créer le compte
    const isTeacher = currentAccountType === 'professeur';
    const userData = {
      email: email,
      prenom: prenom,
      nom: nom,
      classe: isTeacher ? '' : (classe || ''),
      isTeacher: isTeacher
    };
    
    // Gérer la géolocalisation si activée
    const enableLocation = document.getElementById('new-enable-location').checked;
    if (enableLocation) {
      try {
        console.log('📍 Demande de géolocalisation approximative...');
        const location = await getApproximateLocation();
        userData.location = location;
        console.log('✅ Localisation approximative enregistrée');
      } catch (error) {
        console.warn('⚠️ Impossible d\'obtenir la localisation:', error.message);
        // Continuer la création du compte même sans géolocalisation
      }
    }
    
    console.log('🔄 Création du compte:', userData);
    const user = await userDB.registerUser(email, password, userData);
    
    if (user) {
      console.log('✅ Compte créé avec succès:', user.email);
      
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
      sessionData.usageCount = getUsageData(user.email);
      
      // Sauvegarder la session
      saveSessionToStorage();
      
      // Mettre à jour l'avatar
      updateUserAvatar();
      
      // Fermer le modal
      closeModal('modal-create-account');
      
      // Mettre à jour le message de bienvenue
      updateWelcomeMessage(user.prenom, currentAccountType);
      
      // Rediriger vers la page appropriée
      if (isTeacher) {
        goTo('prof-dashboard');
        requestAnimationFrame(() => {
          if (typeof loadCourseRequests !== 'undefined') {
            loadCourseRequests();
          }
        });
      } else {
        goTo('eleve-options');
      }
    }
  } catch (error) {
    console.error('❌ Erreur création compte:', error);
    alert('❌ Erreur lors de la création du compte: ' + error.message);
  }
}

/**
 * Validation et soumission du formulaire de récupération de mot de passe
 */
async function handleForgotPasswordSubmit(event) {
  event.preventDefault();
  console.log('🔑 Soumission formulaire récupération mot de passe');
  
  const email = document.getElementById('reset-email').value.trim();
  
  // Validation
  if (!email) {
    document.getElementById('error-reset-email').textContent = 'L\'email est requis';
    return;
  }
  
  if (!validateEmail(email)) {
    document.getElementById('error-reset-email').textContent = 'Adresse email invalide';
    return;
  }
  
  // Effacer les erreurs
  document.getElementById('error-reset-email').textContent = '';
  
  try {
    // Envoyer l'email de réinitialisation
    await userDB.requestPasswordReset(email);
    
    // Fermer le modal
    closeModal('modal-forgot-password');
    
    // Afficher message de succès
    alert('✅ Un email de réinitialisation a été envoyé à ' + email + '\n\nVérifiez votre boîte de réception (et vos spams).');
  } catch (error) {
    console.error('❌ Erreur récupération mot de passe:', error);
    
    if (error.message.includes('Aucun compte')) {
      document.getElementById('error-reset-email').textContent = 'Aucun compte trouvé avec cet email';
    } else {
      alert('❌ Erreur lors de l\'envoi de l\'email: ' + error.message);
    }
  }
}

/**
 * Modification de la logique de connexion existante
 * Connexion simplifiée avec email et mot de passe uniquement
 */
async function handleLoginSubmit(event, accountType) {
  event.preventDefault();
  console.log('🔐 Tentative de connexion:', accountType);
  
  // Déterminer les IDs des champs selon le type de compte
  const prefix = accountType === 'professeur' ? 'prof-' : '';
  const emailInput = document.getElementById(prefix + 'email');
  const passwordInput = document.getElementById(prefix + 'password');
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  // Vérifier d'abord si l'utilisateur existe
  const userExists = userDB.userExists(email);
  
  if (!userExists) {
    // Premier utilisateur - proposer de créer un compte
    console.log('📝 Première connexion détectée pour:', email);
    
    const createAccount = confirm(
      '🎉 Bienvenue sur LOK IN!\n\n' +
      'Aucun compte trouvé avec cet email.\n\n' +
      'Voulez-vous créer votre profil maintenant?\n\n' +
      '✅ Cliquez sur "OK" pour créer votre compte\n' +
      '❌ Cliquez sur "Annuler" pour vérifier vos informations'
    );
    
    if (createAccount) {
      // Pré-remplir le modal avec l'email saisi
      document.getElementById('new-email').value = email;
      document.getElementById('new-password').value = password;
      
      // Ouvrir le modal de création
      handleCreateAccountClick(accountType);
    }
    return;
  }
  
  try {
    // L'utilisateur existe - tenter la connexion
    console.log('👤 Connexion utilisateur existant:', email);
    const user = await userDB.loginUser(email, password);
    
    if (user) {
      console.log('✅ Connexion réussie:', user.email);
      
      // Vérifier que le type de compte correspond
      if (user.isTeacher && accountType === 'eleve') {
        alert('⚠️ Ce compte est enregistré comme professeur.\n\nVeuillez utiliser la page "Je suis professeur".');
        return;
      }
      
      if (!user.isTeacher && accountType === 'professeur') {
        alert('⚠️ Ce compte est enregistré comme élève.\n\nVeuillez utiliser la page "Je suis élève".');
        return;
      }
      
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
      sessionData.usageCount = getUsageData(user.email);
      
      // Synchroniser l'abonnement avec le serveur
      await syncSubscriptionStatus(user.email);
      
      // Sauvegarder la session
      saveSessionToStorage();
      
      // Mettre à jour l'avatar
      updateUserAvatar();
      
      // Mettre à jour le message de bienvenue
      updateWelcomeMessage(user.prenom, accountType);
      
      // Rediriger vers la page appropriée
      if (accountType === 'professeur') {
        goTo('prof-dashboard');
        requestAnimationFrame(() => {
          if (typeof loadCourseRequests !== 'undefined') {
            loadCourseRequests();
          }
        });
      } else {
        goTo('eleve-options');
      }
    }
  } catch (error) {
    console.error('❌ Erreur connexion:', error);
    
    if (error.message.includes('incorrect')) {
      const retry = confirm(
        '❌ Mot de passe incorrect!\n\n' +
        '🔑 Avez-vous oublié votre mot de passe?\n\n' +
        '✅ Cliquez sur "OK" pour le réinitialiser\n' +
        '❌ Cliquez sur "Annuler" pour réessayer'
      );
      
      if (retry) {
        // Pré-remplir l'email dans le modal de récupération
        document.getElementById('reset-email').value = email;
        handleForgotPasswordClick(accountType);
      }
    } else {
      alert('❌ Erreur lors de la connexion: ' + error.message);
    }
  }
}

// ===== INITIALIZATION =====

/**
 * Initialisation des gestionnaires d'événements pour l'authentification
 */
function initAuthHandlers() {
  console.log('🔧 Initialisation des gestionnaires d\'authentification');
  
  // Boutons "Créer un profil"
  const btnCreateEleve = document.getElementById('btn-create-account-eleve');
  if (btnCreateEleve) {
    btnCreateEleve.addEventListener('click', () => handleCreateAccountClick('eleve'));
  }
  
  const btnCreateProf = document.getElementById('btn-create-account-prof');
  if (btnCreateProf) {
    btnCreateProf.addEventListener('click', () => handleCreateAccountClick('professeur'));
  }
  
  // Boutons "Mot de passe oublié"
  const btnForgotEleve = document.getElementById('btn-forgot-password-eleve');
  if (btnForgotEleve) {
    btnForgotEleve.addEventListener('click', () => handleForgotPasswordClick('eleve'));
  }
  
  const btnForgotProf = document.getElementById('btn-forgot-password-prof');
  if (btnForgotProf) {
    btnForgotProf.addEventListener('click', () => handleForgotPasswordClick('professeur'));
  }
  
  // Boutons de fermeture des modals
  const modalCloseButtons = document.querySelectorAll('.modal-close');
  modalCloseButtons.forEach(button => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal');
      if (modal) {
        closeModal(modal.id);
      }
    });
  });
  
  // Fermeture des modals en cliquant à l'extérieur
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal(modal.id);
      }
    });
  });
  
  // Formulaire de création de compte
  const formCreateAccount = document.getElementById('form-create-account');
  if (formCreateAccount) {
    formCreateAccount.addEventListener('submit', handleCreateAccountSubmit);
  }
  
  // Formulaire de récupération de mot de passe
  const formForgotPassword = document.getElementById('form-forgot-password');
  if (formForgotPassword) {
    formForgotPassword.addEventListener('submit', handleForgotPasswordSubmit);
  }
  
  // Modifier les formulaires de connexion existants
  const formEleve = document.getElementById('form-eleve');
  if (formEleve) {
    // Retirer l'ancien listener (en recréant le formulaire)
    const newFormEleve = formEleve.cloneNode(true);
    formEleve.parentNode.replaceChild(newFormEleve, formEleve);
    
    // Ajouter le nouveau listener
    newFormEleve.addEventListener('submit', (e) => handleLoginSubmit(e, 'eleve'));
    
    // Réactiver la validation
    const inputs = newFormEleve.querySelectorAll('#email, #password');
    inputs.forEach(input => {
      input.addEventListener('input', validateForm);
      input.addEventListener('change', validateForm);
    });
  }
  
  const formProfesseur = document.getElementById('form-professeur');
  if (formProfesseur) {
    // Retirer l'ancien listener
    const newFormProf = formProfesseur.cloneNode(true);
    formProfesseur.parentNode.replaceChild(newFormProf, formProfesseur);
    
    // Ajouter le nouveau listener
    newFormProf.addEventListener('submit', (e) => handleLoginSubmit(e, 'professeur'));
    
    // Réactiver la validation
    const inputs = newFormProf.querySelectorAll('#prof-email, #prof-password');
    inputs.forEach(input => {
      input.addEventListener('input', validateProfessorForm);
      input.addEventListener('change', validateProfessorForm);
    });
  }
  
  console.log('✅ Gestionnaires d\'authentification initialisés');
}

// Fonction utilitaire de validation d'email (réutilisée)
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Export pour utilisation dans d'autres fichiers
if (typeof window !== 'undefined') {
  window.initAuthHandlers = initAuthHandlers;
}
