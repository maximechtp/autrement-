/**
 * Admin Panel Script - Gestion des matières des professeurs
 */

const API_BASE_URL = (() => {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1' || window.location.protocol === 'file:') {
    return 'http://localhost:3000';
  } else {
    return 'https://web-production-d08b0.up.railway.app';
  }
})();

// Admin emails autorisés
const ADMIN_EMAILS = ['maxime.chantepiee@gmail.com', 'jan.smid14@gmail.com'];

// État de l'application
let appState = {
  currentAdminEmail: null,
  teachers: [],
  authorizationRequests: [],
  allSubjects: new Set(),
  selectedTeacher: null,
  selectedSubjects: []
};

// ===== INITIALISATION =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('Admin Panel initializing...');
  
  // Vérifier l'authentification
  checkAdminAuth();
  
  // Configurer les event listeners
  setupEventListeners();
});

// ===== AUTHENTIFICATION =====
function checkAdminAuth() {
  // Récupérer l'utilisateur actuel depuis sessionStorage
  let sessionData = sessionStorage.getItem('lok_in_session');

  // Fallback: restaurer depuis userDB si la sessionStorage est vide
  // (cas possible après restauration auto sur la page principale)
  if (!sessionData && typeof userDB !== 'undefined' && userDB.getCurrentUser) {
    const currentUser = userDB.getCurrentUser();
    if (currentUser) {
      const fallbackSession = {
        isLoggedIn: true,
        email: currentUser.email || '',
        prenom: currentUser.prenom || '',
        nom: currentUser.nom || '',
        classe: currentUser.classe || '',
        isTeacher: !!currentUser.isTeacher,
        isSubscribed: !!(currentUser.subscription && currentUser.subscription.isActive),
        subscriptionType: (currentUser.subscription && currentUser.subscription.type) || null
      };
      sessionStorage.setItem('lok_in_session', JSON.stringify(fallbackSession));
      sessionData = JSON.stringify(fallbackSession);
    }
  }

  if (!sessionData) {
    redirectToHome();
    return;
  }

  try {
    const session = JSON.parse(sessionData);
    const email = session.email;

    if (!ADMIN_EMAILS.includes(email.toLowerCase())) {
      console.error('Non autorisé:', email);
      redirectToHome();
      return;
    }

    appState.currentAdminEmail = email;
    updateAdminGreeting(session);
    loadTeachers();
    loadAvailableSubjects();
    loadTeacherAuthorizationRequests();

    // Rafraîchissement périodique des demandes pour afficher les nouvelles notifications
    setInterval(() => {
      if (appState.currentAdminEmail) {
        loadTeacherAuthorizationRequests();
      }
    }, 15000);

  } catch (error) {
    console.error('Erreur d\'authentification:', error);
    redirectToHome();
  }
}

function redirectToHome() {
  window.location.href = 'index.html';
}

function updateAdminGreeting(session) {
  const greeting = document.getElementById('admin-greeting');
  const statsSection = document.getElementById('admin-stats');
  
  greeting.textContent = `Bienvenue ${session.prenom || 'Administrateur'} ! Vous pouvez maintenant gérer les matières des professeurs.`;
  statsSection.classList.remove('hidden');
}

// ===== CHARGEMENT DES DONNÉES =====
async function loadTeachers() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/teachers?adminEmail=${encodeURIComponent(appState.currentAdminEmail)}`
    );

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des professeurs');
    }

    const data = await response.json();
    appState.teachers = data.teachers || [];
    
    updateTeachersList();
    updateStats();

  } catch (error) {
    console.error('Erreur loadTeachers:', error);
    showNotification('Erreur lors du chargement des professeurs', 'error');
  }
}

async function loadAvailableSubjects() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/subjects?adminEmail=${encodeURIComponent(appState.currentAdminEmail)}`
    );

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des matières');
    }

    const data = await response.json();
    appState.allSubjects = new Set(data.subjects || []);
    
    updateSubjectsList();
    updateSubjectFilters();

  } catch (error) {
    console.error('Erreur loadAvailableSubjects:', error);
  }
}

async function loadTeacherAuthorizationRequests() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/teacher-authorization-requests?adminEmail=${encodeURIComponent(appState.currentAdminEmail)}`
    );

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des demandes');
    }

    const data = await response.json();
    appState.authorizationRequests = data.requests || [];

    updateAuthorizationRequestsList();
  } catch (error) {
    console.error('Erreur loadTeacherAuthorizationRequests:', error);
    showNotification('Erreur lors du chargement des demandes de rendez-vous', 'error');
  }
}

// ===== AFFICHAGE DES DONNÉES =====
function updateAuthorizationRequestsList() {
  const container = document.getElementById('authorization-requests-container');
  const pendingCount = appState.authorizationRequests.filter(r => r.status === 'pending').length;
  const pendingCountEl = document.getElementById('pending-requests-count');

  if (pendingCountEl) {
    pendingCountEl.textContent = String(pendingCount);
  }

  if (!container) {
    return;
  }

  if (!appState.authorizationRequests.length) {
    container.innerHTML = '<p class="no-data">Aucune demande pour le moment</p>';
    return;
  }

  let html = '<div class="authorization-requests-grid">';

  appState.authorizationRequests.forEach(request => {
    const fullName = `${request.prenom || ''} ${request.nom || ''}`.trim() || 'Professeur';
    const statusLabel = request.status === 'processed' ? 'traitée' : 'en attente';
    const requestedSubjects = Array.isArray(request.requestedSubjects) && request.requestedSubjects.length
      ? request.requestedSubjects.join(', ')
      : 'À préciser';

    html += `
      <div class="authorization-request-card ${request.status}">
        <div class="request-header">
          <strong>${fullName}</strong>
          <span class="request-status ${request.status}">${statusLabel}</span>
        </div>
        <p class="teacher-email">${request.email}</p>
        <p class="request-subjects"><strong>Matières souhaitées :</strong> ${requestedSubjects}</p>
        ${request.note ? `<p class="request-note">${request.note}</p>` : ''}
        <p class="request-meta">
          Demande: ${new Date(request.createdAt).toLocaleString('fr-FR')}
          ${request.status === 'processed' && request.processedBy
            ? `<br>Traitée par: ${request.processedBy}`
            : ''}
        </p>
        <div class="request-actions">
          <button class="btn-action btn-primary btn-prefill-request" data-request-id="${request.id}">
            ✍️ Pré-remplir le formulaire prof
          </button>
          ${request.status === 'pending'
            ? `<button class="btn-action btn-secondary btn-mark-request-processed" data-request-id="${request.id}">✅ Marquer traitée</button>`
            : ''
          }
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;

  document.querySelectorAll('.btn-prefill-request').forEach(btn => {
    btn.addEventListener('click', () => {
      const requestId = btn.dataset.requestId;
      prefillTeacherFormFromRequest(requestId);
    });
  });

  document.querySelectorAll('.btn-mark-request-processed').forEach(btn => {
    btn.addEventListener('click', async () => {
      const requestId = btn.dataset.requestId;
      await updateAuthorizationRequestStatus(requestId, 'processed');
    });
  });
}

function prefillTeacherFormFromRequest(requestId) {
  const request = appState.authorizationRequests.find(r => r.id === requestId);
  if (!request) return;

  document.getElementById('new-teacher-request-id').value = request.id;
  document.getElementById('new-teacher-email').value = request.email || '';
  document.getElementById('new-teacher-prenom').value = request.prenom || '';
  document.getElementById('new-teacher-nom').value = request.nom || '';
  document.getElementById('new-teacher-subjects').value = Array.isArray(request.requestedSubjects)
    ? request.requestedSubjects.join(', ')
    : '';

  showNotification('Formulaire professeur pré-rempli depuis la demande', 'info');
}

async function updateAuthorizationRequestStatus(requestId, status) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/teacher-authorization-request/${encodeURIComponent(requestId)}/status?adminEmail=${encodeURIComponent(appState.currentAdminEmail)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Impossible de mettre à jour la demande');
    }

    await loadTeacherAuthorizationRequests();
    showNotification('Demande mise à jour', 'success');
  } catch (error) {
    console.error('Erreur updateAuthorizationRequestStatus:', error);
    showNotification(error.message, 'error');
  }
}

function updateTeachersList() {
  const container = document.getElementById('teachers-list-container');
  
  if (!appState.teachers || appState.teachers.length === 0) {
    container.innerHTML = '<p class="no-data">Aucun professeur trouvé</p>';
    return;
  }

  let html = '<div class="teachers-grid">';
  
  appState.teachers.forEach(teacher => {
    const activeCount = teacher.availableSubjects?.length || 0;
    const authorizedCount = teacher.authorizedSubjects?.length || 0;
    
    html += `
      <div class="teacher-card">
        <div class="teacher-info">
          <h3>${teacher.prenom} ${teacher.nom}</h3>
          <p class="teacher-email">${teacher.email}</p>
          ${teacher.rating ? `<p class="teacher-rating">⭐ ${teacher.rating}/5 (${teacher.courses} cours)</p>` : ''}
        </div>
        <div class="teacher-subjects">
          <p class="subjects-count">
            <span class="authorized">${authorizedCount} autorisée${authorizedCount !== 1 ? 's' : ''}</span>
            <span class="separator">•</span>
            <span class="active">${activeCount} active${activeCount !== 1 ? 's' : ''}</span>
          </p>
          <div class="authorized-subjects">
            ${authorizedCount > 0 
              ? `<strong>Matières :</strong> ${teacher.authorizedSubjects.join(', ')}`
              : '<em>Aucune matière autorisée</em>'
            }
          </div>
        </div>
        <button class="btn-edit" data-email="${teacher.email}">
          ✏️ Gérer les matières
        </button>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;

  // Ajouter event listeners aux boutons
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const email = btn.dataset.email;
      openEditModal(email);
    });
  });
}

function updateSubjectsList() {
  const container = document.getElementById('available-subjects');
  
  if (appState.allSubjects.size === 0) {
    container.innerHTML = '<p class="no-data">Aucune matière disponible</p>';
    return;
  }

  let html = '<div class="subjects-list-grid">';
  
  Array.from(appState.allSubjects).sort().forEach(subject => {
    const teacherCount = appState.teachers.filter(t => 
      t.authorizedSubjects.includes(subject)
    ).length;
    
    html += `
      <div class="subject-item">
        <span class="subject-name">${subject}</span>
        <span class="teacher-count">${teacherCount} prof${teacherCount !== 1 ? 's' : ''}</span>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

function updateStats() {
  const totalTeachers = appState.teachers.length;
  const totalAuthorizedSubjects = Array.from(appState.allSubjects).length;
  const totalActiveSubjects = new Set(
    appState.teachers.flatMap(t => t.availableSubjects || [])
  ).size;

  document.getElementById('total-teachers').textContent = totalTeachers;
  document.getElementById('total-authorized-subjects').textContent = totalAuthorizedSubjects;
  document.getElementById('total-active-subjects').textContent = totalActiveSubjects;
}

function updateSubjectFilters() {
  const select = document.getElementById('filter-subjects');
  const currentValue = select.value;
  
  let html = '<option value="">Toutes les matières</option>';
  
  Array.from(appState.allSubjects).sort().forEach(subject => {
    html += `<option value="${subject}">${subject}</option>`;
  });
  
  select.innerHTML = html;
  select.value = currentValue;
}

// ===== MODAL DE GESTION DES MATIÈRES =====
function openEditModal(teacherEmail) {
  const teacher = appState.teachers.find(t => t.email === teacherEmail);
  if (!teacher) return;

  appState.selectedTeacher = teacher;
  appState.selectedSubjects = [...(teacher.authorizedSubjects || [])];

  // Remplir les infos du professeur
  document.getElementById('modal-teacher-info').textContent = 
    `Matières autorisées pour ${teacher.prenom} ${teacher.nom} (${teacher.email})`;

  // Créer la grille de sélection des matières
  const grid = document.getElementById('modal-subjects-grid');
  let html = '';
  
  Array.from(appState.allSubjects).sort().forEach(subject => {
    const isSelected = appState.selectedSubjects.includes(subject);
    html += `
      <label class="subject-checkbox">
        <input 
          type="checkbox" 
          value="${subject}" 
          ${isSelected ? 'checked' : ''}
          class="subject-input"
        />
        <span>${subject}</span>
      </label>
    `;
  });
  
  // Ajouter un champ pour ajouter une nouvelle matière
  html += `
    <div class="add-new-subject">
      <input 
        type="text" 
        id="new-subject-input" 
        placeholder="Nouvelle matière"
        class="new-subject-field"
      />
      <button id="add-new-subject-btn" class="btn-action btn-add">+</button>
    </div>
  `;
  
  grid.innerHTML = html;

  // Configurer les événements
  document.querySelectorAll('.subject-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const subject = e.target.value;
      if (e.target.checked) {
        if (!appState.selectedSubjects.includes(subject)) {
          appState.selectedSubjects.push(subject);
        }
      } else {
        appState.selectedSubjects = appState.selectedSubjects.filter(s => s !== subject);
      }
    });
  });

  // Bouton pour ajouter une nouvelle matière
  document.getElementById('add-new-subject-btn').addEventListener('click', () => {
    const input = document.getElementById('new-subject-input');
    const newSubject = input.value.trim();
    
    if (newSubject && !appState.allSubjects.has(newSubject)) {
      appState.allSubjects.add(newSubject);
      appState.selectedSubjects.push(newSubject);
      
      // Actualiser la modal
      openEditModal(teacherEmail);
      showNotification(`Matière "${newSubject}" créée`, 'success');
    }
  });

  // Afficher la modal
  document.getElementById('edit-subjects-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-subjects-modal').classList.add('hidden');
  appState.selectedTeacher = null;
  appState.selectedSubjects = [];
}

async function saveSubjectsChanges() {
  if (!appState.selectedTeacher) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/teacher/${encodeURIComponent(appState.selectedTeacher.email)}/subjects?adminEmail=${encodeURIComponent(appState.currentAdminEmail)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          authorizedSubjects: appState.selectedSubjects
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la sauvegarde');
    }

    const data = await response.json();
    console.log('✅ Matières sauvegardées:', data);

    // Actualiser les données
    await loadTeachers();
    await loadAvailableSubjects();
    closeEditModal();
    showNotification('Matières mises à jour avec succès', 'success');

  } catch (error) {
    console.error('Erreur saveSubjectsChanges:', error);
    showNotification(error.message, 'error');
  }
}

async function createTeacher() {
  const emailInput = document.getElementById('new-teacher-email');
  const prenomInput = document.getElementById('new-teacher-prenom');
  const nomInput = document.getElementById('new-teacher-nom');
  const subjectsInput = document.getElementById('new-teacher-subjects');
  const requestIdInput = document.getElementById('new-teacher-request-id');

  const email = emailInput.value.trim().toLowerCase();
  const prenom = prenomInput.value.trim();
  const nom = nomInput.value.trim();
  const authorizationRequestId = requestIdInput.value.trim() || null;
  const authorizedSubjects = subjectsInput.value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (!email || !prenom || !nom) {
    showNotification('Email, prénom et nom sont requis', 'error');
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/teacher?adminEmail=${encodeURIComponent(appState.currentAdminEmail)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          prenom,
          nom,
          authorizedSubjects,
          authorizationRequestId
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erreur lors de la création du professeur');
    }

    document.getElementById('add-teacher-form').reset();
  requestIdInput.value = '';

    await loadTeachers();
    await loadAvailableSubjects();
  await loadTeacherAuthorizationRequests();

    showNotification(`Professeur ajouté: ${prenom} ${nom}`, 'success');
  } catch (error) {
    console.error('Erreur createTeacher:', error);
    showNotification(error.message, 'error');
  }
}

// ===== ÉVÉNEMENTS =====
function setupEventListeners() {
  // Bouton retour
  document.getElementById('btn-back').addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // Bouton actualiser
  document.getElementById('btn-refresh').addEventListener('click', async () => {
    showNotification('Actualisation en cours...', 'info');
    await loadTeachers();
    await loadAvailableSubjects();
    await loadTeacherAuthorizationRequests();
    showNotification('Données actualisées', 'success');
  });

  // Recherche et filtres
  document.getElementById('search-teachers').addEventListener('input', filterTeachers);
  document.getElementById('filter-subjects').addEventListener('change', filterTeachers);

  // Modal - Boutons
  document.getElementById('close-modal').addEventListener('click', closeEditModal);
  document.getElementById('cancel-edit').addEventListener('click', closeEditModal);
  document.getElementById('save-subjects').addEventListener('click', saveSubjectsChanges);

  // Fermer la modal en cliquant en dehors
  document.getElementById('edit-subjects-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-subjects-modal') {
      closeEditModal();
    }
  });

  // Ajouter une matière
  document.getElementById('add-subject-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const input = document.getElementById('new-subject-name');
    const subject = input.value.trim();
    
    if (!subject) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/subject?adminEmail=${encodeURIComponent(appState.currentAdminEmail)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ subject })
        }
      );

      if (!response.ok) {
        throw new Error('Erreur lors de l\'ajout de la matière');
      }

      appState.allSubjects.add(subject);
      input.value = '';
      updateSubjectsList();
      updateSubjectFilters();
      showNotification(`Matière "${subject}" ajoutée`, 'success');

    } catch (error) {
      console.error('Erreur addSubject:', error);
      showNotification(error.message, 'error');
    }
  });

  // Ajouter un professeur
  document.getElementById('add-teacher-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await createTeacher();
  });
}

// ===== FILTRAGE =====
function filterTeachers() {
  const searchText = document.getElementById('search-teachers').value.toLowerCase();
  const filterSubject = document.getElementById('filter-subjects').value;

  const filtered = appState.teachers.filter(teacher => {
    const matchesSearch = 
      teacher.prenom.toLowerCase().includes(searchText) ||
      teacher.nom.toLowerCase().includes(searchText) ||
      teacher.email.toLowerCase().includes(searchText);

    const matchesSubject = !filterSubject || 
      teacher.authorizedSubjects.includes(filterSubject);

    return matchesSearch && matchesSubject;
  });

  // Afficher les résultats filtrés
  const container = document.getElementById('teachers-list-container');
  
  if (filtered.length === 0) {
    container.innerHTML = '<p class="no-data">Aucun professeur ne correspond aux critères</p>';
    return;
  }

  let html = '<div class="teachers-grid">';
  
  filtered.forEach(teacher => {
    const activeCount = teacher.availableSubjects?.length || 0;
    const authorizedCount = teacher.authorizedSubjects?.length || 0;
    
    html += `
      <div class="teacher-card">
        <div class="teacher-info">
          <h3>${teacher.prenom} ${teacher.nom}</h3>
          <p class="teacher-email">${teacher.email}</p>
          ${teacher.rating ? `<p class="teacher-rating">⭐ ${teacher.rating}/5 (${teacher.courses} cours)</p>` : ''}
        </div>
        <div class="teacher-subjects">
          <p class="subjects-count">
            <span class="authorized">${authorizedCount} autorisée${authorizedCount !== 1 ? 's' : ''}</span>
            <span class="separator">•</span>
            <span class="active">${activeCount} active${activeCount !== 1 ? 's' : ''}</span>
          </p>
          <div class="authorized-subjects">
            ${authorizedCount > 0 
              ? `<strong>Matières :</strong> ${teacher.authorizedSubjects.join(', ')}`
              : '<em>Aucune matière autorisée</em>'
            }
          </div>
        </div>
        <button class="btn-edit" data-email="${teacher.email}">
          ✏️ Gérer les matières
        </button>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;

  // Ajouter event listeners aux boutons
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const email = btn.dataset.email;
      openEditModal(email);
    });
  });
}

// ===== NOTIFICATIONS =====
function showNotification(message, type = 'info') {
  const toast = document.getElementById('notification-toast');
  const toastMessage = document.getElementById('toast-message');
  
  toastMessage.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}
