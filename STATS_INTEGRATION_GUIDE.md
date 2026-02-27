# 🔗 Guide d'intégration - Enregistrement des activités

Ce guide explique **où et comment** intégrer l'enregistrement des activités dans le code existant.

## 1. Enregistrement d'un Cours 📚

### Où? Dans le flux de cours existant
Le cours est réservé et complété à travers la modal de confirmation.

### Comment procéder?

**Étape 1: Trouver le code qui valide la réservation de cours**
- Chercher dans `script.js` la fonction qui confirme la réservation
- Chercher les mentions de "cours", "confirmCourse", "bookCourse"

**Étape 2: Ajouter l'enregistrement après la confirmation**
```javascript
// Après que le cours est confirmé et que l'utilisateur se connecte à Meet
recordCourse(
  sessionData.matiere,           // La matière sélectionnée
  selectedTeacher.name,          // Le nom du professeur
  20                             // Durée en minutes (20 par défaut)
);
```

**Exemple d'intégration:**
```javascript
function confirmAndBookCourse() {
  // ... code existant pour valider ...
  
  const teacher = selectedTeachersForSelectedSubject[0];
  const courseDuration = 20;
  
  // Redirection vers Jitsi/Meet
  openMeetingLink(teacher.meetLink);
  
  // AJOUTER CETTE LIGNE après la validation:
  recordCourse(
    sessionData.matiere,
    teacher.name,
    courseDuration
  );
}
```

**Timestamp recommandé:**
- ✅ Après que l'utilisateur se connecte au meeting
- ✅ Quand le meeting se ferme (pour enregistrer la durée réelle)
- ❌ Pas au moment de la réservation initiale

---

## 2. Enregistrement d'un appel JustSpeak 💬

### Où? Après la fin de l'appel
L'appel se fait via WebSocket et se termine quand l'utilisateur ferme la fenêtre.

### Comment procéder?

**Étape 1: Trouver le handler de fin d'appel WebSocket**
- Chercher dans `script.js` les mentions de "WebSocket", "ws://", "justspeak", "chat"
- Chercher les fonctions qui gèrent la fermeture de WebSocket

**Étape 2: Calculer la durée et enregistrer**
```javascript
// Quand l'appel se termine (WebSocket fermeture)
const callStartTime = new Date(sessionData.callStartTime);
const callEndTime = new Date();
const callDurationMinutes = Math.round((callEndTime - callStartTime) / 60000);

// AJOUTER CETTE LIGNE:
recordJustSpeak(
  sessionData.partnerName,       // Le partenaire/prof
  callDurationMinutes            // Durée réelle en minutes
);
```

**Exemple d'intégration:**
```javascript
// Dans le handler de fermeture WebSocket
ws.addEventListener('close', () => {
  console.log('WebSocket fermé');
  
  // Calculer la durée
  const duration = Math.round(
    (new Date() - new Date(sessionData.callStartTime)) / 60000
  );
  
  // AJOUTER CES LIGNES:
  if (sessionData.option === 'chat') {
    recordJustSpeak(sessionData.partnerName, duration);
  }
  
  // ... code existant de nettoyage ...
});
```

**Timestamp recommandé:**
- ✅ Quand le WebSocket se ferme proprement
- ✅ Quand l'utilisateur quitte la page d'appel
- ❌ Pas à la création de l'appel

---

## 3. Enregistrement d'un Clash 🎤

### Où? Après la fin du debate/clash
Les clashs ont une durée généralement fixe.

### Comment procéder?

**Étape 1: Trouver le code qui gère la fin du clash**
- Chercher dans `script.js` les mentions de "debat", "clash", "CLASH_DEBATE_QUESTIONS"
- Chercher les fonctions qui terminent le débat

**Étape 2: Enregistrer à la fin**
```javascript
// Quand le clash se termine
recordClash(
  questionDebat,                 // La question du débat
  durationMinutes                // Durée du débat
);
```

**Exemple d'intégration:**
```javascript
function endClashSession() {
  // ... code existant pour terminer le débat ...
  
  const duration = 30; // Durée estimée/réelle du clash
  const question = CLASH_DEBATE_QUESTIONS[selectedQuestionIndex];
  
  // AJOUTER CETTE LIGNE:
  recordClash(question, duration);
  
  // Retourner au menu
  goTo('eleve-options');
}
```

**Timestamp recommandé:**
- ✅ Quand le débat se termine (timer arrive à 0 ou utilisateur quitte)
- ✅ Après le vote sur qui a gagné
- ❌ Pas au démarrage du débat

---

## 4. Enregistrement de notes/ratings ⭐

### Où? Après que l'utilisateur note un professeur
Les utilisateurs laissent des notes après les cours.

### Comment procéder?

**Étape 1: Trouver le code de notation**
- Chercher dans `script.js` ou `index.html` les mentions de "note", "rating", "évaluation", "avis"
- Chercher les systèmes de stars (1-5)

**Étape 2: Enregistrer après validation**
```javascript
// Quand l'utilisateur valide sa note
recordRating(
  starsGiven,                    // 1-5
  contextuelDescription          // Contexte optionnel
);
```

**Exemple d'intégration:**
```javascript
function submitTeacherRating() {
  const rating = document.getElementById('star-rating').value; // 1-5
  const comment = document.getElementById('rating-comment').value;
  
  // Sauvegarder la note dans la base de données
  saveTeacherRating(currentTeacher.id, rating, comment);
  
  // AJOUTER CETTE LIGNE:
  recordRating(
    rating,
    `Cours de ${sessionData.matiere} avec ${currentTeacher.name}`
  );
  
  console.log('✅ Note enregistrée');
}
```

**Timestamp recommandé:**
- ✅ Après validation par l'utilisateur
- ✅ Dans un formulaire de feedback post-cours
- ❌ Pas automatiquement sans confirmation

---

## Résumé des points d'intégration

| Activité | Fonction | Où l'appeler | Paramètres |
|----------|----------|--------------|-----------|
| **Cours** | `recordCourse()` | Après connexion au meeting | subject, teacher, duration |
| **JustSpeak** | `recordJustSpeak()` | Quand WebSocket ferme | teacher, duration |
| **Clash** | `recordClash()` | Quand débat se termine | question, duration |
| **Note** | `recordRating()` | Après validation | rating (1-5), context |

---

## Code à ne PAS oublier

### ⚠️ Essentiels avant d'ajouter les appels:

1. **Vérifier que `studentStats` est initialisé:**
```javascript
if (studentStats) {
  recordCourse(...);
} else {
  console.warn('StudentStats non initialisé');
}
```

2. **Vérifier que l'utilisateur est un élève (pas prof):**
```javascript
if (!sessionData.isTeacher) {
  recordCourse(...);
}
```

3. **Stocker les données de timing au démarrage:**
```javascript
// Quand l'activité commence
sessionData.activityStartTime = new Date().toISOString();

// Quand l'activité se termine
const duration = Math.round(
  (new Date() - new Date(sessionData.activityStartTime)) / 60000
);
recordCourse(..., duration);
```

---

## Exemple complet: Intégration du cours

Avant:
```javascript
function confirmCourse() {
  const teacher = getSelectedTeacher();
  openMeetingLink(teacher.meetLink);
  goTo('meeting-view');
}
```

Après:
```javascript
function confirmCourse() {
  const teacher = getSelectedTeacher();
  
  // Stocker heure de début
  sessionData.activityStartTime = new Date();
  
  // Ouvrir le meeting
  openMeetingLink(teacher.meetLink);
  goTo('meeting-view');
  
  // Enregistrer le cours (durée estimée ou réelle)
  const estimatedDuration = 20;
  recordCourse(
    sessionData.matiere,
    teacher.name,
    estimatedDuration
  );
  
  console.log('📚 Cours enregistré dans les statistiques');
}
```

---

## Tester l'intégration

### Dans la console du navigateur:
```javascript
// Vérifier que studentStats est initialisé
console.log(studentStats);

// Simuler un cours
recordCourse('Mathématiques', 'M. Dupont', 20);

// Vérifier les stats
console.log(studentStats.stats);

// Vérifier l'activité
console.log(studentStats.activity);

// Afficher les stats
displayStudentStats();
```

### Vérifier dans localStorage:
```javascript
// Ouvrir DevTools (F12) → Application → Local Storage
// Chercher: lok_in_student_stats et lok_in_student_activity
```

---

## Priorités d'intégration

### 🔴 CRITIQUE (faire d'abord)
1. Enregistrement des cours
2. Enregistrement des appels JustSpeak

### 🟡 IMPORTANT (faire ensuite)
3. Enregistrement des clashs
4. Calcul correct des durées

### 🟢 BONUS (optionnel)
5. Enregistrement des notes
6. Synchronisation avec le serveur

---

## FAQ d'intégration

**Q: Où exactement dois-je ajouter `recordCourse()`?**
R: Après que l'utilisateur confirme sa réservation et se connecte au meeting. Cherchez les fonctions de confirmation ou de redirection vers Jitsi/Meet.

**Q: Comment récupérer la durée réelle de l'appel?**
R: Enregistrez l'heure de début quand l'appel démarre, calculez la différence quand il se termine:
```javascript
const startTime = new Date();
// ... appel en cours ...
const duration = Math.round((new Date() - startTime) / 60000);
```

**Q: Que faire si j'utilise une WebSocket existante?**
R: Ajoutez l'enregistrement dans les événements `close` ou `message` de la WebSocket, en fonction de votre architecture.

**Q: Les stats doivent-elles être synchronisées avec le serveur?**
R: Non, pour l'instant les stats sont stockées en localStorage. Optionnellement, vous pouvez ajouter une synchronisation avec le serveur plus tard.

**Q: Puis-je tester sans faire les intégrations?**
R: Oui! Utilisez la console pour appeler:
```javascript
recordCourse('Test', 'Prof Test', 20);
displayStudentStats();
```

---

**Status:** 📋 Guide d'intégration complet - Prêt à intégrer dans le code existant
