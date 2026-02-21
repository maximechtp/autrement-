const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Configuration des ports
// Sur Railway, process.env.PORT est utilisé pour le serveur HTTP principal
// En local, on utilise des ports différents
const PORT = process.env.PORT || 8080;
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;

// Fichiers de persistence
const REVIEWS_FILE = path.join(__dirname, 'reviews.json');
const USERS_FILE = path.join(__dirname, 'users.json');

// Configuration Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Configuration du serveur HTTP pour les API REST
const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);

// Configuration du serveur WebSocket
// En production (Railway), WebSocket et HTTP partagent le même serveur
// En local, HTTP et WebSocket partagent aussi le même serveur pour éviter les conflits
wss = new WebSocket.Server({ server: httpServer });

if (isProduction) {
  console.log('🔧 Mode Production: WebSocket attaché au serveur HTTP');
} else {
  console.log('🔧 Mode Développement: WebSocket attaché au serveur HTTP');
}

// Stockage des utilisateurs connectés en mémoire
// Structure: { clientId: { ws, name, lat, lng, timestamp, email, prenom, nom } }
const connectedUsers = new Map();

// Files d'attente pour le matching d'utilisateurs
// Structure: { 'debat:Français': [clientId1, clientId2, ...], 'chat:Anglais': [...], ... }
const matchingQueues = new Map();

// Professeurs disponibles par matière
// Structure: { 'Mathématiques': [clientId1, clientId2, ...], 'Français': [...], ... }
const availableTeachers = new Map();

// Acceptations de Clash en attente (pour acceptation mutuelle)
// Structure: { matchId: { user1: clientId1, user2: clientId2, user1Accepted: false, user2Accepted: false, debateQuestion: string, meetLink: string } }
const clashAcceptances = new Map();

// Stockage des avis clients (partagé entre tous les utilisateurs)
// Structure: [{ name, email, rating, text, date, timestamp }, ...]
// Un utilisateur (identifié par email) ne peut laisser qu'un seul avis
let reviews = [];

// Charger les avis depuis le fichier au démarrage
function loadReviews() {
  try {
    if (fs.existsSync(REVIEWS_FILE)) {
      const data = fs.readFileSync(REVIEWS_FILE, 'utf8');
      reviews = JSON.parse(data);
      console.log(`✅ ${reviews.length} avis chargés depuis le fichier`);
    } else {
      console.log('📝 Aucun fichier d\'avis trouvé, démarrage avec une liste vide');
    }
  } catch (error) {
    console.error('❌ Erreur lors du chargement des avis:', error);
    reviews = [];
  }
}

// Sauvegarder les avis dans le fichier
function saveReviews() {
  try {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), 'utf8');
    console.log(`💾 ${reviews.length} avis sauvegardés dans le fichier`);
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde des avis:', error);
  }
}

// Charger les avis au démarrage du serveur
loadReviews();

// Stockage des utilisateurs (partagé entre tous les utilisateurs)
// Structure: { email: { email, prenom, nom, subscription, ... }, ... }
let users = {};

// Charger les utilisateurs depuis le fichier au démarrage
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      users = JSON.parse(data);
      console.log(`✅ ${Object.keys(users).length} utilisateurs chargés depuis le fichier`);
    } else {
      console.log('📝 Aucun fichier utilisateur trouvé, démarrage avec une liste vide');
    }
  } catch (error) {
    console.error('❌ Erreur lors du chargement des utilisateurs:', error);
    users = {};
  }
}

// Sauvegarder les utilisateurs dans le fichier
function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    console.log(`💾 ${Object.keys(users).length} utilisateurs sauvegardés dans le fichier`);
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde des utilisateurs:', error);
  }
}

// Charger les utilisateurs au démarrage
loadUsers();

// Génère un ID unique pour chaque client
function generateClientId() {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Génère un ID unique pour une room Google Meet
function generateMeetId() {
  // Générer un ID au format Google Meet valide: xxx-yyyy-zzz
  // Utilise uniquement des lettres minuscules pour compatibilité
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  
  const segment1 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const segment2 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const segment3 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  
  return `${segment1}-${segment2}-${segment3}`;
}

// Broadcast la liste des utilisateurs à tous les clients connectés
function broadcastUserList() {
  const userList = Array.from(connectedUsers.entries()).map(([id, user]) => ({
    id,
    name: user.name,
    lat: user.lat,
    lng: user.lng,
    timestamp: user.timestamp
  }));

  const message = JSON.stringify({
    type: 'userList',
    users: userList,
    count: userList.length
  });

  // Envoyer à tous les clients connectés
  connectedUsers.forEach((user) => {
    if (user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(message);
    }
  });

  console.log(`📡 Broadcast: ${userList.length} utilisateur(s) connecté(s)`);
}

// Gestion des connexions WebSocket
wss.on('connection', (ws) => {
  const clientId = generateClientId();
  console.log(`✅ Nouvelle connexion: ${clientId}`);

  // Initialiser l'utilisateur (sans position pour l'instant)
  connectedUsers.set(clientId, {
    ws,
    name: null,
    email: null,
    prenom: null,
    nom: null,
    classe: null,
    lat: null,
    lng: null,
    timestamp: Date.now(),
    isSearching: false,
    searchType: null, // 'debat', 'chat', 'cours'
    searchLanguage: null,
    searchMatiere: null,
    searchNiveau: null
  });

  // Envoyer l'ID au client
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    message: 'Connexion établie'
  }));

  // Gestion des messages reçus
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      const user = connectedUsers.get(clientId);

      if (!user) return;

      switch (message.type) {
        case 'updatePosition':
          // Mise à jour de la position GPS de l'utilisateur
          if (typeof message.lat === 'number' && typeof message.lng === 'number') {
            user.lat = message.lat;
            user.lng = message.lng;
            user.name = message.name || `Utilisateur ${clientId.slice(-4)}`;
            user.email = message.email || null;
            user.prenom = message.prenom || null;
            user.nom = message.nom || null;
            user.classe = message.classe || null;
            user.timestamp = Date.now();

            console.log(`📍 Position mise à jour: ${user.name} (${user.lat}, ${user.lng})`);

            // Broadcaster la liste mise à jour
            broadcastUserList();
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Latitude et longitude invalides'
            }));
          }
          break;

        case 'startSearch':
          // Utilisateur démarre une recherche
          handleStartSearch(clientId, message);
          break;

        case 'stopSearch':
          // Utilisateur arrête sa recherche
          handleStopSearch(clientId);
          break;

        case 'teacherAvailable':
          // Professeur se rend disponible pour une matière
          handleTeacherAvailable(clientId, message);
          break;

        case 'teacherUnavailable':
          // Professeur se rend indisponible pour une matière
          handleTeacherUnavailable(clientId, message);
          break;

        case 'clashAccepted':
          // Utilisateur accepte le Clash
          handleClashAccepted(clientId, message);
          break;

        case 'clashRefused':
          // Utilisateur refuse le Clash
          handleClashRefused(clientId, message);
          break;

        case 'requestUserList':
          // Envoyer la liste des utilisateurs au client qui la demande
          const userList = Array.from(connectedUsers.entries()).map(([id, u]) => ({
            id,
            name: u.name,
            lat: u.lat,
            lng: u.lng,
            timestamp: u.timestamp
          }));

          ws.send(JSON.stringify({
            type: 'userList',
            users: userList,
            count: userList.length
          }));
          break;

        default:
          console.log('⚠️ Type de message non reconnu:', message.type, 'de', clientId);
          // Ne pas envoyer d'erreur au client pour ne pas le bloquer
          // ws.send(JSON.stringify({
          //   type: 'error',
          //   message: 'Type de message non reconnu'
          // }));
      }
    } catch (error) {
      console.error('❌ Erreur lors du traitement du message:', error);
      // Ne pas bloquer le client avec une erreur
      console.error('Message problématique:', messageData);
    }
  });

  // Gestion de la déconnexion
  ws.on('close', () => {
    const user = connectedUsers.get(clientId);
    const userName = user?.name || clientId;
    
    // Retirer de la file d'attente si en recherche
    if (user?.isSearching) {
      removeFromQueue(clientId, user);
    }
    
    // Retirer des listes de professeurs disponibles si professeur
    if (user?.isTeacher) {
      removeTeacherFromAllSubjects(clientId);
    }
    
    // Supprimer l'utilisateur de la liste
    connectedUsers.delete(clientId);
    
    console.log(`❌ Déconnexion: ${userName}`);
    console.log(`👥 Utilisateurs restants: ${connectedUsers.size}`);

    // Broadcaster la liste mise à jour après suppression
    broadcastUserList();
  });

  // Gestion des erreurs
  ws.on('error', (error) => {
    console.error(`⚠️ Erreur WebSocket pour ${clientId}:`, error);
  });
});

// ===== SYSTÈME DE MATCHING =====

/**
 * Ajoute un utilisateur dans la file d'attente de matching
 */
function handleStartSearch(clientId, message) {
  const user = connectedUsers.get(clientId);
  if (!user) {
    console.error('❌ Utilisateur non trouvé:', clientId);
    return;
  }

  const { searchType, language, languages, matiere, niveau, email, prenom, nom, classe } = message;
  
  // Valider les paramètres
  if (!searchType) {
    user.ws.send(JSON.stringify({
      type: 'error',
      message: 'Paramètres de recherche manquants'
    }));
    return;
  }

  // Mettre à jour les informations de l'utilisateur
  user.isSearching = true;
  user.searchType = searchType;
  user.searchLanguage = language;
  user.searchLanguages = languages || [language]; // Stocker toutes les langues
  user.searchMatiere = matiere || null;
  user.searchNiveau = niveau || null;
  user.email = email || user.email;
  user.prenom = prenom || user.prenom;
  user.nom = nom || user.nom;
  user.classe = classe || user.classe;
  user.name = `${prenom || ''} ${nom || ''}`.trim() || user.name;

  // Si c'est une recherche de cours, chercher un professeur disponible
  if (searchType === 'cours' && matiere) {
    console.log(`🔍 ${user.name} recherche un cours de ${matiere} (${niveau})`);
    handleStudentSearchingTeacher(clientId, user);
    return;
  }

  const languesText = user.searchLanguages.join(', ');
  console.log(`🔍 ${user.name} recherche un ${searchType} en ${languesText}`);

  // Chercher un match dans toutes les files correspondant aux langues de l'utilisateur
  let matched = false;
  
  for (const userLang of user.searchLanguages) {
    if (matched) break;
    
    const queueKey = `${searchType}:${userLang}`;
    
    // Initialiser la file si elle n'existe pas
    if (!matchingQueues.has(queueKey)) {
      matchingQueues.set(queueKey, []);
    }

    const queue = matchingQueues.get(queueKey);
    
    // Chercher un utilisateur compatible (qui a au moins une langue en commun)
    for (let i = 0; i < queue.length; i++) {
      const matchedClientId = queue[i];
      const matchedUser = connectedUsers.get(matchedClientId);
      
      if (!matchedUser || matchedUser.ws.readyState !== WebSocket.OPEN) {
        // Retirer les utilisateurs déconnectés
        queue.splice(i, 1);
        i--;
        continue;
      }
      
      // S'assurer que matchedUser a searchLanguages défini (compatibilité)
      if (!matchedUser.searchLanguages || matchedUser.searchLanguages.length === 0) {
        matchedUser.searchLanguages = [matchedUser.searchLanguage || userLang];
      }
      
      // Vérifier s'il y a une langue en commun
      const commonLanguages = user.searchLanguages.filter(lang => 
        matchedUser.searchLanguages.includes(lang)
      );
      
      if (commonLanguages.length > 0) {
        // Match trouvé! Retirer de la file
        queue.splice(i, 1);
        matched = true;
        
        // Créer une salle Jitsi avec notre intégration personnalisée
        const meetId = generateMeetId();
        const meetLink = `https://lokin.online/jitsi-room.html?room=${meetId}`;
        
        // Générer un matchId unique pour gérer les acceptations
        const matchIdUnique = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const commonLangsText = commonLanguages.join(', ');
        console.log(`✅ Match trouvé ! ${user.name} ↔️ ${matchedUser.name} (langue(s) commune(s): ${commonLangsText})`);
        console.log(`📹 Google Meet créé: ${meetLink}`);
        
        // Si c'est un Clash (debat), initialiser le système d'acceptation mutuelle
        if (searchType === 'debat') {
          clashAcceptances.set(matchIdUnique, {
            user1: clientId,
            user2: matchedClientId,
            user1Accepted: false,
            user2Accepted: false,
            debateQuestion: null,
            meetLink: meetLink,
            meetId: meetId,
            timestamp: Date.now()
          });
          
          console.log(`🔥 Clash initialisé avec matchId: ${matchIdUnique}`);
        }
        
        // Envoyer le match aux deux utilisateurs
        const matchData = {
          type: 'matchFound',
          meetLink: meetLink,
          meetId: meetId,
          matchId: matchIdUnique,
          partner: {
            name: matchedUser.name,
            prenom: matchedUser.prenom,
            nom: matchedUser.nom,
            classe: matchedUser.classe,
            email: matchedUser.email
          }
        };
        
        const matchDataForMatched = {
          type: 'matchFound',
          meetLink: meetLink,
          meetId: meetId,
          matchId: matchIdUnique,
          partner: {
            name: user.name,
            prenom: user.prenom,
            nom: user.nom,
            classe: user.classe,
            email: user.email
          }
        };
        
        // Envoyer aux deux utilisateurs avec vérification de l'état de connexion
        if (user.ws.readyState === WebSocket.OPEN) {
          user.ws.send(JSON.stringify(matchData));
        } else {
          console.warn(`⚠️ Impossible d'envoyer le match à ${user.name} (connexion fermée)`);
        }
        
        if (matchedUser.ws.readyState === WebSocket.OPEN) {
          matchedUser.ws.send(JSON.stringify(matchDataForMatched));
        } else {
          console.warn(`⚠️ Impossible d'envoyer le match à ${matchedUser.name} (connexion fermée)`);
        }
        
        // Marquer comme non plus en recherche (sauf pour les Clash où on attend l'acceptation)
        if (searchType !== 'debat') {
          user.isSearching = false;
          matchedUser.isSearching = false;
        }
        
        // Nettoyer les données de recherche
        user.searchType = null;
        user.searchLanguage = null;
        user.searchLanguages = [];
        matchedUser.searchType = null;
        matchedUser.searchLanguage = null;
        matchedUser.searchLanguages = [];
        
        break; // Sortir de la boucle for
      }
    }
    
    if (matched) break; // Sortir de la boucle des langues
  }
  
  // Si aucun match trouvé, ajouter à toutes les files d'attente correspondant aux langues
  if (!matched) {
    for (const userLang of user.searchLanguages) {
      const queueKey = `${searchType}:${userLang}`;
      if (!matchingQueues.has(queueKey)) {
        matchingQueues.set(queueKey, []);
      }
      const queue = matchingQueues.get(queueKey);
      if (!queue.includes(clientId)) {
        queue.push(clientId);
      }
      // Envoyer la mise à jour pour chaque file
      broadcastQueueStatus(queueKey);
    }
    console.log(`⏳ ${user.name} ajouté aux files d'attente pour: ${user.searchLanguages.join(', ')}`);
  }
}

/**
 * Ajoute un utilisateur à la file d'attente
 */
function addToQueue(clientId, queueKey) {
  const queue = matchingQueues.get(queueKey);
  if (!queue.includes(clientId)) {
    queue.push(clientId);
    console.log(`➕ ${clientId} ajouté à la file ${queueKey} (${queue.length} en attente)`);
    
    const user = connectedUsers.get(clientId);
    if (user) {
      user.ws.send(JSON.stringify({
        type: 'searching',
        message: 'Recherche en cours...',
        queuePosition: queue.length,
        queueKey: queueKey
      }));
    }
  }
}

/**
 * Retire un utilisateur de la file d'attente
 */
function handleStopSearch(clientId) {
  const user = connectedUsers.get(clientId);
  if (!user || !user.isSearching) return;
  
  removeFromQueue(clientId, user);
  
  user.isSearching = false;
  user.searchType = null;
  user.searchLanguage = null;
  user.searchLanguages = [];
  user.searchMatiere = null;
  user.searchNiveau = null;
  
  user.ws.send(JSON.stringify({
    type: 'searchStopped',
    message: 'Recherche arrêtée'
  }));
  
  console.log(`🛑 ${user.name} a arrêté sa recherche`);
}

/**
 * Retire un utilisateur de sa file d'attente
 */
function removeFromQueue(clientId, user) {
  if (!user.searchType) return;
  
  // Retirer de toutes les files d'attente pour toutes les langues
  const languages = user.searchLanguages || [user.searchLanguage];
  
  languages.forEach(lang => {
    if (!lang) return;
    
    const queueKey = `${user.searchType}:${lang}`;
    const queue = matchingQueues.get(queueKey);
    
    if (queue) {
      const index = queue.indexOf(clientId);
      if (index > -1) {
        queue.splice(index, 1);
        console.log(`➖ ${clientId} retiré de la file ${queueKey} (${queue.length} restants)`);
        broadcastQueueStatus(queueKey);
      }
    }
  });
}

/**
 * Envoie le statut de la file d'attente à tous les utilisateurs concernés
 */
function broadcastQueueStatus(queueKey) {
  const queue = matchingQueues.get(queueKey);
  if (!queue) return;
  
  queue.forEach((clientId, index) => {
    const user = connectedUsers.get(clientId);
    if (user && user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(JSON.stringify({
        type: 'queueUpdate',
        queuePosition: index + 1,
        queueSize: queue.length,
        message: `${queue.length} utilisateur(s) en attente dans cette file`
      }));
    }
  });
}

/**
 * Retire un professeur de toutes les matières où il était disponible
 */
function removeTeacherFromAllSubjects(teacherClientId) {
  availableTeachers.forEach((teacherList, matiere) => {
    const index = teacherList.indexOf(teacherClientId);
    if (index > -1) {
      teacherList.splice(index, 1);
      console.log(`🗑️ Professeur retiré de ${matiere} (déconnexion)`);
    }
  });
}

// ===== SYSTÈME DE MATCHING PROFESSEUR-ÉLÈVE =====

/**
 * Professeur se rend disponible pour une matière
 */
function handleTeacherAvailable(clientId, message) {
  const teacher = connectedUsers.get(clientId);
  if (!teacher) return;

  const { matiere, email, prenom, nom } = message;
  
  if (!matiere) {
    teacher.ws.send(JSON.stringify({
      type: 'error',
      message: 'Matière manquante'
    }));
    return;
  }

  // Mettre à jour les infos du professeur
  teacher.isTeacher = true;
  teacher.email = email || teacher.email;
  teacher.prenom = prenom || teacher.prenom;
  teacher.nom = nom || teacher.nom;
  teacher.name = `${prenom || ''} ${nom || ''}`.trim() || teacher.name;

  // Initialiser la liste des professeurs pour cette matière
  if (!availableTeachers.has(matiere)) {
    availableTeachers.set(matiere, []);
  }

  const teacherList = availableTeachers.get(matiere);
  
  // Ajouter le professeur s'il n'est pas déjà dans la liste
  if (!teacherList.includes(clientId)) {
    teacherList.push(clientId);
    console.log(`👨‍🏫 ${teacher.name} est maintenant disponible pour ${matiere} (${teacherList.length} prof(s) disponibles)`);
    
    teacher.ws.send(JSON.stringify({
      type: 'teacherAvailableConfirmed',
      matiere: matiere,
      message: `Vous êtes maintenant disponible pour ${matiere}`
    }));

    // Vérifier s'il y a des élèves en attente pour cette matière
    checkForWaitingStudents(matiere);
  }
}

/**
 * Professeur se rend indisponible pour une matière
 */
function handleTeacherUnavailable(clientId, message) {
  const teacher = connectedUsers.get(clientId);
  if (!teacher) return;

  const { matiere } = message;
  
  if (!matiere) return;

  const teacherList = availableTeachers.get(matiere);
  if (teacherList) {
    const index = teacherList.indexOf(clientId);
    if (index > -1) {
      teacherList.splice(index, 1);
      console.log(`👨‍🏫 ${teacher.name} n'est plus disponible pour ${matiere} (${teacherList.length} prof(s) restants)`);
      
      teacher.ws.send(JSON.stringify({
        type: 'teacherUnavailableConfirmed',
        matiere: matiere,
        message: `Vous n'êtes plus disponible pour ${matiere}`
      }));
    }
  }
}

/**
 * Élève recherche un professeur pour une matière
 */
function handleStudentSearchingTeacher(clientId, student) {
  const matiere = student.searchMatiere;
  
  if (!matiere) {
    student.ws.send(JSON.stringify({
      type: 'error',
      message: 'Matière non spécifiée'
    }));
    return;
  }

  // Chercher un professeur disponible pour cette matière
  const teacherList = availableTeachers.get(matiere);
  
  if (teacherList && teacherList.length > 0) {
    // Prendre le premier professeur disponible
    const teacherClientId = teacherList.shift();
    const teacher = connectedUsers.get(teacherClientId);
    
    if (teacher && teacher.ws.readyState === WebSocket.OPEN) {
      // Match trouvé !
      createTeacherStudentMatch(teacher, teacherClientId, student, clientId);
    } else {
      // Le professeur n'est plus connecté, réessayer avec le suivant
      if (teacherList.length > 0) {
        handleStudentSearchingTeacher(clientId, student);
      } else {
        // Aucun professeur disponible, mettre l'élève en attente
        addStudentToWaitingQueue(clientId, student);
      }
    }
  } else {
    // Aucun professeur disponible, mettre l'élève en attente
    addStudentToWaitingQueue(clientId, student);
  }
}

/**
 * Ajoute un élève à la file d'attente pour une matière
 */
function addStudentToWaitingQueue(clientId, student) {
  const matiere = student.searchMatiere;
  const queueKey = `cours:${matiere}`;
  
  if (!matchingQueues.has(queueKey)) {
    matchingQueues.set(queueKey, []);
  }

  const queue = matchingQueues.get(queueKey);
  if (!queue.includes(clientId)) {
    queue.push(clientId);
    console.log(`⏳ ${student.name} en attente d'un professeur de ${matiere} (${queue.length} élève(s) en attente)`);
    
    student.ws.send(JSON.stringify({
      type: 'searching',
      message: 'Recherche d\'un professeur disponible...',
      queuePosition: queue.length,
      queueKey: queueKey
    }));
  }
}

/**
 * Vérifie s'il y a des élèves en attente pour une matière
 */
function checkForWaitingStudents(matiere) {
  const queueKey = `cours:${matiere}`;
  const queue = matchingQueues.get(queueKey);
  
  if (queue && queue.length > 0) {
    const studentClientId = queue.shift();
    const student = connectedUsers.get(studentClientId);
    
    if (student && student.ws.readyState === WebSocket.OPEN) {
      // Relancer la recherche pour cet élève
      handleStudentSearchingTeacher(studentClientId, student);
    } else {
      // L'élève n'est plus connecté, vérifier le suivant
      if (queue.length > 0) {
        checkForWaitingStudents(matiere);
      }
    }
  }
}

/**
 * Crée un match entre un professeur et un élève
 */
function createTeacherStudentMatch(teacher, teacherClientId, student, studentClientId) {
  const meetId = generateMeetId();
  const meetLink = `https://lokin.online/jitsi-room.html?room=${meetId}`;
  
  console.log(`✅ Match trouvé ! Élève: ${student.name} ↔️ Prof: ${teacher.name} (${student.searchMatiere})`);
  console.log(`📹 Google Meet créé: ${meetLink}`);
  
  // Données pour l'élève
  const studentMatchData = {
    type: 'matchFound',
    meetLink: meetLink,
    meetId: meetId,
    partner: {
      name: teacher.name,
      prenom: teacher.prenom,
      nom: teacher.nom,
      email: teacher.email,
      isTeacher: true
    },
    matiere: student.searchMatiere,
    niveau: student.searchNiveau
  };
  
  // Données pour le professeur
  const teacherMatchData = {
    type: 'matchFound',
    meetLink: meetLink,
    meetId: meetId,
    partner: {
      name: student.name,
      prenom: student.prenom,
      nom: student.nom,
      classe: student.classe,
      email: student.email,
      isTeacher: false
    },
    matiere: student.searchMatiere,
    niveau: student.searchNiveau
  };
  
  // Envoyer aux deux parties
  student.ws.send(JSON.stringify(studentMatchData));
  teacher.ws.send(JSON.stringify(teacherMatchData));
  
  // Marquer comme non plus en recherche
  student.isSearching = false;
  student.searchType = null;
  student.searchMatiere = null;
  student.searchNiveau = null;
}

// ===== GESTION DES ACCEPTATIONS CLASH =====

/**
 * Gère l'acceptation d'un Clash par un utilisateur
 */
function handleClashAccepted(clientId, message) {
  const user = connectedUsers.get(clientId);
  if (!user) {
    console.error('❌ Utilisateur non trouvé:', clientId);
    return;
  }

  const { matchId, debateQuestion } = message;
  const clashData = clashAcceptances.get(matchId);
  
  if (!clashData) {
    console.error('❌ Match Clash non trouvé:', matchId);
    user.ws.send(JSON.stringify({
      type: 'error',
      message: 'Match non trouvé'
    }));
    return;
  }

  // Déterminer quel utilisateur a accepté
  let isUser1 = clashData.user1 === clientId;
  let isUser2 = clashData.user2 === clientId;
  
  if (!isUser1 && !isUser2) {
    console.error('❌ Utilisateur non impliqué dans ce match:', clientId);
    return;
  }

  // Marquer l'acceptation
  if (isUser1) {
    clashData.user1Accepted = true;
    console.log(`✅ User1 (${user.name}) a accepté le Clash`);
  } else {
    clashData.user2Accepted = true;
    console.log(`✅ User2 (${user.name}) a accepté le Clash`);
  }
  
  // Stocker la question de débat (la première reçue)
  if (!clashData.debateQuestion && debateQuestion) {
    clashData.debateQuestion = debateQuestion;
  }

  // Vérifier si les deux ont accepté
  if (clashData.user1Accepted && clashData.user2Accepted) {
    console.log('🎉 Les deux utilisateurs ont accepté le Clash !');
    
    // Récupérer les deux utilisateurs
    const user1 = connectedUsers.get(clashData.user1);
    const user2 = connectedUsers.get(clashData.user2);
    
    if (user1 && user2) {
      // Envoyer la confirmation aux deux utilisateurs
      const confirmationMessage = {
        type: 'clashBothAccepted',
        meetLink: clashData.meetLink,
        meetId: clashData.meetId,
        debateQuestion: clashData.debateQuestion
      };
      
      if (user1.ws.readyState === WebSocket.OPEN) {
        user1.ws.send(JSON.stringify(confirmationMessage));
      }
      
      if (user2.ws.readyState === WebSocket.OPEN) {
        user2.ws.send(JSON.stringify(confirmationMessage));
      }
      
      // Marquer comme non plus en recherche
      user1.isSearching = false;
      user2.isSearching = false;
      
      // Nettoyer les données de recherche
      user1.searchType = null;
      user1.searchLanguage = null;
      user2.searchType = null;
      user2.searchLanguage = null;
      
      // Supprimer de la Map après 1 minute (pour éviter les fuites mémoire)
      setTimeout(() => {
        clashAcceptances.delete(matchId);
        console.log(`🧹 Nettoyage du match Clash: ${matchId}`);
      }, 60000);
    }
  } else {
    console.log(`⏳ En attente de l'acceptation de l'autre utilisateur...`);
  }
}

/**
 * Gère le refus d'un Clash par un utilisateur
 */
function handleClashRefused(clientId, message) {
  const user = connectedUsers.get(clientId);
  if (!user) {
    console.error('❌ Utilisateur non trouvé:', clientId);
    return;
  }

  const { matchId } = message;
  const clashData = clashAcceptances.get(matchId);
  
  if (!clashData) {
    console.error('❌ Match Clash non trouvé:', matchId);
    return;
  }

  // Déterminer quel utilisateur a refusé et notifier l'autre
  let otherUserId;
  if (clashData.user1 === clientId) {
    otherUserId = clashData.user2;
    console.log(`❌ User1 (${user.name}) a refusé le Clash`);
  } else if (clashData.user2 === clientId) {
    otherUserId = clashData.user1;
    console.log(`❌ User2 (${user.name}) a refusé le Clash`);
  } else {
    console.error('❌ Utilisateur non impliqué dans ce match:', clientId);
    return;
  }

  // Notifier l'autre utilisateur
  const otherUser = connectedUsers.get(otherUserId);
  if (otherUser && otherUser.ws.readyState === WebSocket.OPEN) {
    otherUser.ws.send(JSON.stringify({
      type: 'clashPartnerRefused',
      message: 'Votre partenaire a refusé le Clash'
    }));
    
    // Remettre l'autre utilisateur en recherche
    otherUser.isSearching = false;
  }

  // Supprimer le match de la Map
  clashAcceptances.delete(matchId);
  
  // Remettre l'utilisateur qui a refusé en mode non-recherche
  user.isSearching = false;
  user.searchType = null;
  user.searchLanguage = null;
}

// Nettoyage périodique des connexions inactives (toutes les 30 secondes)
setInterval(() => {
  const now = Date.now();
  const TIMEOUT = 5 * 60 * 1000; // 5 minutes

  connectedUsers.forEach((user, clientId) => {
    if (now - user.timestamp > TIMEOUT) {
      console.log(`⏰ Timeout: suppression de ${user.name || clientId}`);
      user.ws.close();
      connectedUsers.delete(clientId);
    }
  });
}, 30000);

// ============== ENDPOINT WEBHOOK STRIPE ==============

/**
 * POST /api/stripe-webhook - Webhook pour recevoir les événements Stripe
 * Utilise express.raw() pour le body car Stripe a besoin du body brut pour vérifier la signature
 */
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  console.log('📥 Webhook Stripe reçu');

  let event;

  try {
    // Vérifier la signature Stripe
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('✅ Signature Stripe vérifiée');
  } catch (err) {
    console.error('❌ Erreur de vérification de signature:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('📋 Type d\'événement:', event.type);

  // Gérer les différents types d'événements
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        // Récupérer les informations importantes
        const customerEmail = session.customer_email || session.customer_details?.email;
        const subscriptionId = session.subscription;
        const customerId = session.customer;
        const amountTotal = session.amount_total / 100;
        const currency = session.currency.toUpperCase();
        const planType = session.metadata?.planType || 'standard';
        
        console.log('════════════════════════════════════════');
        console.log('🎉 NOUVEAU PAIEMENT RÉUSSI !');
        console.log('════════════════════════════════════════');
        console.log(`📧 Email: ${customerEmail}`);
        console.log(`📦 Plan: ${planType.toUpperCase()}`);
        console.log(`💰 Montant: ${amountTotal} ${currency}`);
        console.log(`🔑 Customer ID: ${customerId}`);
        console.log(`🔑 Subscription ID: ${subscriptionId}`);
        console.log('════════════════════════════════════════');

        // Mettre à jour l'utilisateur
        if (!users[customerEmail]) {
          users[customerEmail] = {
            email: customerEmail,
            createdAt: new Date().toISOString()
          };
        }

        users[customerEmail].subscription = {
          type: planType,
          isActive: true,
          startDate: new Date().toISOString(),
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          status: 'active'
        };
        users[customerEmail].updatedAt = new Date().toISOString();

        // Sauvegarder
        saveUsers();
        
        console.log(`✅ Abonnement ${planType.toUpperCase()} activé pour ${customerEmail}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerEmail = subscription.metadata?.email;
        
        console.log('🔄 Abonnement mis à jour:', subscription.id);
        
        if (customerEmail && users[customerEmail]) {
          users[customerEmail].subscription.status = subscription.status;
          users[customerEmail].updatedAt = new Date().toISOString();
          saveUsers();
          console.log(`✅ Statut d'abonnement mis à jour pour ${customerEmail}: ${subscription.status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerEmail = subscription.metadata?.email;
        
        console.log('❌ Abonnement annulé:', subscription.id);
        
        if (customerEmail && users[customerEmail]) {
          users[customerEmail].subscription.isActive = false;
          users[customerEmail].subscription.status = 'canceled';
          users[customerEmail].updatedAt = new Date().toISOString();
          saveUsers();
          console.log(`✅ Abonnement désactivé pour ${customerEmail}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log('⚠️ Paiement échoué:', invoice.id);
        // TODO: Notifier l'utilisateur
        break;
      }

      default:
        console.log(`ℹ️ Événement non géré: ${event.type}`);
    }

    // Toujours retourner 200 pour confirmer la réception
    res.json({ received: true, eventType: event.type });

  } catch (error) {
    console.error('❌ Erreur lors du traitement de l\'événement:', error);
    res.status(500).json({ error: 'Erreur de traitement' });
  }
});

// ============== ENDPOINTS API REST POUR LES UTILISATEURS ==============

/**
 * GET /api/user/:email - Récupérer les informations d'un utilisateur
 */
app.get('/api/user/:email', (req, res) => {
  const email = req.params.email.toLowerCase();
  const user = users[email];
  
  if (user) {
    console.log(`📖 Utilisateur trouvé: ${email}`);
    res.json({ success: true, user: user });
  } else {
    console.log(`❌ Utilisateur non trouvé: ${email}`);
    res.json({ success: false, user: null });
  }
});

/**
 * POST /api/user - Créer ou mettre à jour un utilisateur
 */
app.post('/api/user', (req, res) => {
  const { email, prenom, nom, classe, isTeacher } = req.body;
  
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email requis' });
  }
  
  const emailLower = email.toLowerCase();
  
  if (!users[emailLower]) {
    users[emailLower] = {
      email: emailLower,
      createdAt: new Date().toISOString(),
      subscription: {
        type: null,
        isActive: false
      }
    };
  }
  
  // Mettre à jour les informations
  if (prenom) users[emailLower].prenom = prenom;
  if (nom) users[emailLower].nom = nom;
  if (classe) users[emailLower].classe = classe;
  if (typeof isTeacher !== 'undefined') users[emailLower].isTeacher = isTeacher;
  users[emailLower].updatedAt = new Date().toISOString();
  
  saveUsers();
  
  console.log(`✅ Utilisateur sauvegardé: ${emailLower}`);
  res.json({ success: true, user: users[emailLower] });
});

// ============== ENDPOINTS API REST POUR LES AVIS ==============

/**
 * GET /api/reviews - Récupérer tous les avis (sans les emails pour la confidentialité)
 */
app.get('/api/reviews', (req, res) => {
  console.log('📖 Requête GET /api/reviews - Récupération des avis');
  // Ne pas exposer les emails publiquement
  const publicReviews = reviews.map(({ email, ...review }) => review);
  res.json({ success: true, reviews: publicReviews });
});

/**
 * GET /api/reviews/check/:email - Vérifier si un utilisateur a déjà laissé un avis
 */
app.get('/api/reviews/check/:email', (req, res) => {
  const email = req.params.email;
  const hasReviewed = reviews.some(r => r.email === email);
  console.log(`🔍 Vérification avis pour ${email}: ${hasReviewed ? 'Déjà laissé' : 'Pas encore'}`);
  res.json({ success: true, hasReviewed: hasReviewed });
});

/**
 * POST /api/reviews - Ajouter un nouvel avis
 */
app.post('/api/reviews', (req, res) => {
  const { name, email, rating, text } = req.body;
  
  // Validation
  if (!name || !email || !rating || !text) {
    console.log('❌ Avis invalide: données manquantes');
    return res.status(400).json({ success: false, error: 'Données manquantes' });
  }
  
  if (rating < 1 || rating > 5) {
    console.log('❌ Avis invalide: note incorrecte');
    return res.status(400).json({ success: false, error: 'La note doit être entre 1 et 5' });
  }
  
  // Vérifier si l'utilisateur a déjà laissé un avis
  const existingReview = reviews.find(r => r.email === email);
  if (existingReview) {
    console.log(`⚠️ L'utilisateur ${email} a déjà laissé un avis`);
    return res.status(409).json({ 
      success: false, 
      error: 'Vous avez déjà laissé un avis. Merci pour votre participation !' 
    });
  }
  
  // Créer l'avis
  const review = {
    name: name,
    email: email, // Stocker l'email (ne sera pas affiché publiquement)
    rating: rating,
    text: text,
    date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    timestamp: Date.now()
  };
  
  // Ajouter en début de liste
  reviews.unshift(review);
  
  // Sauvegarder immédiatement dans le fichier
  saveReviews();
  
  console.log(`✅ Nouvel avis ajouté: ${name} - ${rating}★`);
  console.log(`   Total avis: ${reviews.length}`);
  
  res.json({ success: true, review: review });
});

// Démarrer le serveur HTTP
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('║   🚀 SERVEUR LOK IN DÉMARRÉ                  ║');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`🌐 Port: ${PORT}`);
  console.log(`🌐 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`🌐 WebSocket: ${isProduction ? 'Partagé avec HTTP' : 'Port séparé'}`);
  console.log(`⏰ Démarré le: ${new Date().toLocaleString('fr-FR')}`);
  console.log('');
  console.log('📊 Statistiques:');
  console.log(`   - Utilisateurs connectés: 0`);
  console.log(`   - Files d'attente actives: 0`);
  console.log(`   - Professeurs disponibles: 0`);
  console.log(`   - Avis partagés: ${reviews.length}`);
  console.log('');
  console.log('✅ Serveurs prêts à recevoir des connexions');
  console.log('📡 En attente...');
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════');


// Gestion de l'arrêt propre du serveur
process.on('SIGTERM', () => {
  console.log('🛑 Arrêt du serveur...');
  wss.close(() => {
    console.log('✅ Serveur arrêté proprement');
    process.exit(0);
  });
});
