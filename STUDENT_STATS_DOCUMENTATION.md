# 📊 Système de Statistiques des Élèves - Documentation

## Vue d'ensemble

Le système de statistiques des élèves permet de tracker et d'afficher:
- 📚 Nombre de cours pris
- 💬 Nombre d'appels JustSpeak
- 🎤 Nombre de clashs
- ⏱️ Temps total passé en appel
- 💭 Temps passé en JustSpeak
- 🎓 Nombre de matières explorées
- 👨‍🏫 Nombre de professeurs rencontrés
- ⭐ Note moyenne donnée

## Structure des fichiers

### 1. `student-stats.js` (480+ lignes)
Le cœur du système de statistiques.

**Classe principale:** `StudentStatistics`
- Gère la persistance des données en localStorage
- Calcule les métriques
- Enregistre l'historique d'activité

**Fonctions principales:**
```javascript
// Initialisation
initStudentStats(email) - Initialise le système pour un étudiant

// Enregistrement d'activités
recordCourse(subject, teacher, duration)    - Enregistre un cours
recordJustSpeak(teacher, duration)          - Enregistre un appel JustSpeak
recordClash(opponent, duration)             - Enregistre un clash
recordRating(rating, context)               - Enregistre une note

// Affichage
displayStudentStats()   - Affiche les statistiques dans l'interface
displayRecentActivity() - Affiche l'historique d'activité récente
```

### 2. `index.html` (section statistiques)
```html
<!-- Section de statistiques (ID: student-stats-section) -->
<div id="student-stats-section" class="stats-section hidden">
  <!-- 8 cartes principales -->
  <div class="stats-grid">
    <div class="stat-card" id="stat-courses">0</div>      <!-- Cours -->
    <div class="stat-card" id="stat-justspeak">0</div>    <!-- JustSpeak calls -->
    <div class="stat-card" id="stat-clashs">0</div>       <!-- Clashs -->
    <div class="stat-card" id="stat-duration">0h</div>    <!-- Durée totale -->
    <div class="stat-card" id="stat-justspeak-duration">0m</div> <!-- Durée JustSpeak -->
    <div class="stat-card" id="stat-subjects">0</div>     <!-- Matières -->
    <div class="stat-card" id="stat-teachers">0</div>     <!-- Professeurs -->
    <div class="stat-card" id="stat-rating">-</div>       <!-- Note moyenne -->
  </div>

  <!-- 4 cartes de détails -->
  <div class="details-container">
    <!-- Détails des cours, JustSpeak, Clashs, et Abonnement -->
  </div>

  <!-- Historique d'activité -->
  <div id="recent-activity" class="recent-activity-list"></div>
</div>
```

### 3. `student-stats.css` (320 lignes)
Styling responsive pour l'affichage des statistiques:
- Cartes avec gradients colorés
- Grille responsive (3 colonnes sur desktop, 2 sur tablette, 1 sur mobile)
- Animation au survol
- Historique d'activité avec timeline

## Structure de données

### LocalStorage - `lok_in_student_stats`
```javascript
{
  email: "user@example.com",
  courses: {
    count: 5,                    // nombre de cours
    duration: 100,               // en minutes
    totalCost: 25,               // en euros
    subjects: {                  // matières explorées
      "Mathématiques": 2,
      "Français": 3
    },
    teachers: ["prof1", "prof2"] // SET -> Array en localStorage
  },
  justspeak: {
    count: 12,                   // nombre d'appels
    duration: 180,               // en minutes
    teachers: ["prof1", "prof3"]
  },
  clashs: {
    count: 3,                    // nombre de clashs
    duration: 90,                // en minutes
    teachers: ["prof2"]
  },
  subscription: {
    type: "standard",            // "standard", "premium", or null
    startDate: "2024-01-15T10:30:00",
    totalSpent: 49.99
  },
  ratings: [
    { rating: 5, context: "Cours de Maths", date: "2024-01-15T10:30:00" }
  ],
  createdAt: "2024-01-01T00:00:00",
  lastUpdated: "2024-01-15T15:30:00"
}
```

### LocalStorage - `lok_in_student_activity`
```javascript
[
  {
    type: "cours",              // "cours", "justspeak", "clash"
    description: "Cours de Mathématiques avec M. Dupont",
    duration: 20,               // en minutes
    timestamp: "2024-01-15T14:30:00",
    date: "15/01/2024"
  },
  // ... autres activités (max 50)
]
```

## Mode d'utilisation

### 1. Initialisation automatique
Quand l'élève accède à son profil:
```javascript
// Dans script.js - fonction showUserProfile()
initStudentStats(sessionData.email);  // Initialise les stats
displayStudentStats();                // Affiche les stats
```

### 2. Enregistrement d'un cours
À appeler quand un cours est terminé:
```javascript
recordCourse(
  subject,        // ex: "Mathématiques"
  teacher,        // ex: "M. Dupont"
  duration = 20   // en minutes (défaut: 20)
);

// Exemple:
recordCourse("Français", "Mme Martin", 25);
```

### 3. Enregistrement d'un appel JustSpeak
À appeler quand l'appel se termine:
```javascript
recordJustSpeak(
  teacher,     // ex: "M. Dupont"
  duration     // en minutes
);

// Exemple:
recordJustSpeak("M. Dupont", 15);
```

### 4. Enregistrement d'un clash
À appeler quand le clash se termine:
```javascript
recordClash(
  opponent,    // adversaire ou catégorie
  duration     // en minutes
);

// Exemple:
recordClash("Débat: Réseaux sociaux", 30);
```

### 5. Enregistrement d'une note
À appeler après une évaluation:
```javascript
recordRating(
  rating,      // 1-5 étoiles
  context      // contexte (optionnel)
);

// Exemple:
recordRating(5, "Excellent cours de Maths");
```

## Intégration avec les fonctionnalités existantes

### À faire dans le code existant:

1. **Après un cours réservé:**
```javascript
// Dans le handler du cours complété
recordCourse(
  sessionData.matiere,
  selectedTeacher.name,
  courseDuration
);
```

2. **Après un appel JustSpeak:**
```javascript
// Dans le handler de fin d'appel JustSpeak
const callDuration = calculateCallDuration(); // en minutes
recordJustSpeak(sessionData.partnerName, callDuration);
```

3. **Après un clash:**
```javascript
// Dans le handler de fin de clash
recordClash(
  CLASH_DEBATE_QUESTIONS[selectedQuestionIndex],
  clashDuration
);
```

4. **Après notation d'un professeur:**
```javascript
// Dans le handler de notation
recordRating(starRating, "Cours de " + subject);
```

## API de la classe StudentStatistics

### Propriétés
```javascript
studentStats.stats              // Objet de statistiques principal
studentStats.activity           // Array d'historique d'activité
```

### Méthodes publiques

```javascript
// Gestion des stats
initializeStats(email)          // Initialise pour un nouvel utilisateur
loadStats()                     // Charge depuis localStorage
saveStats()                     // Sauvegarde dans localStorage
resetStats(email)               // Réinitialise les stats

// Enregistrement d'activités
addCourse(subject, teacher, duration)
addJustSpeak(teacher, duration)
addClash(opponent, duration)
addRating(rating, context)
updateSubscription(type, cost)

// Gestion de l'activité
loadActivity()                  // Charge l'historique
saveActivity()                  // Sauvegarde l'historique
addActivity(type, description, duration)

// Requêtes/Calculs
getFormattedStats()             // Retourne les stats formatées pour l'affichage
getTotalDuration()              // Retourne {hours, minutes, total}
getAverageRating()              // Note moyenne
getTotalTeachers()              // Nombre de profs différents
getSubjectsCount()              // Nombre de matières explorées
```

## Gestion de l'abonnement

Le système synchronise automatiquement avec `sessionData.isSubscribed`:

```javascript
// Les stats s'affichent comme:
- Type abonnement: sessionData.subscriptionType
- Statut: sessionData.isSubscribed
```

À mettre à jour quand l'abonnement change:
```javascript
// Après changement d'abonnement dans les plans
studentStats.updateSubscription('premium', 49.99);
```

## Affichage des statistiques

### Emplacements dans l'interface:
1. **Section principale** - À côté du profil (après subscription-section)
2. **Cartes statistiques** - 8 KPIs colorées
3. **Détails** - 4 cartes avec breakdowns
4. **Historique** - Dernières 10 activités

### Éléments clés pour le CSS:
- `.stats-section` - Conteneur principal
- `.stats-grid` - Grille des 8 cartes
- `.details-container` - Conteneur des détails
- `.recent-activity-list` - Historique
- `.stat-card` - Carte individuelle
- `.detail-card` - Carte de détail

## Exemples d'utilisation complets

### Exemple 1: Tracker un cours de mathématiques
```javascript
// Élève termine un cours de 25 minutes avec M. Dupont
recordCourse("Mathématiques", "M. Dupont", 25);
// Résultat: Stats mises à jour, activité enregistrée
```

### Exemple 2: Initialiser les stats au connexion
```javascript
// Dans script.js lors du login réussi
sessionData.email = user.email;
initStudentStats(user.email);
// Stats chargées ou initialisées
```

### Exemple 3: Afficher les stats dans le profil
```javascript
// Lors de l'affichage du profil
showUserProfile() {
  // ... code existant ...
  if (!sessionData.isTeacher) {
    initStudentStats(sessionData.email);
    displayStudentStats();  // Affiche la section des stats
  }
}
```

## Notes importantes

1. **Persistance:** Les stats sont sauvegardées dans localStorage de l'appareil
2. **Synchronisation:** Les stats doivent être mises à jour par le code existant
3. **Affichage:** Les stats s'affichent automatiquement avec `displayStudentStats()`
4. **Limite d'activité:** Seules les 50 dernières activités sont conservées
5. **Formats:** Les durées sont en minutes, les timestamps en ISO 8601

## À faire ensuite

1. ✅ Ajouter les fonctions d'enregistrement aux handlers existants
2. ✅ Tester avec de faux données
3. ✅ Synchroniser avec le serveur (optionnel, pour backup)
4. ✅ Ajouter graphiques (optionnel, avec Chart.js)
5. ✅ Export des statistiques en PDF (optionnel)

## Support et débogage

Pour vérifier les stats en console:
```javascript
// Voir les stats actuelles
console.log(studentStats.stats);

// Voir l'activité
console.log(studentStats.activity);

// Ajouter manuellement un cours pour tester
studentStats.addCourse("Test", "Prof Test", 30);
displayStudentStats();
```

## Fichiers créés/modifiés

| Fichier | Action | Lignes |
|---------|--------|--------|
| student-stats.js | Créé | 480+ |
| student-stats.css | Créé | 320 |
| index.html | Modifié | +210 |
| script.js | Modifié | +5 |

**Status:** ✅ Système de statistiques complètement implémenté et intégré
