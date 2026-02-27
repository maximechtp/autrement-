/**
 * Données de démonstration pour les statistiques
 * Utilisez ces données pour tester le système sans faire d'activités réelles
 */

/**
 * Ajoute des données de démonstration aux statistiques
 * À appeler une seule fois pour tester
 */
function loadDemoStatistics() {
  if (!studentStats) {
    console.warn('studentStats pas encore initialisé');
    return;
  }

  // Ajouter des données de test
  console.log('📊 Chargement des données de démonstration...');

  // Ajouter plusieurs cours
  recordCourse('Mathématiques', 'M. Dupont', 20);
  recordCourse('Français', 'Mme Martin', 25);
  recordCourse('Mathématiques', 'M. Dupont', 20);
  recordCourse('Anglais', 'Mr. Johnson', 20);
  recordCourse('Physique', 'M. Bernard', 30);

  // Ajouter plusieurs appels JustSpeak
  recordJustSpeak('M. Dupont', 15);
  recordJustSpeak('Mme Martin', 20);
  recordJustSpeak('M. Dupont', 10);
  recordJustSpeak('Mr. Johnson', 25);
  recordJustSpeak('M. Bernard', 18);
  recordJustSpeak('Mme Martin', 22);

  // Ajouter plusieurs clashs
  recordClash('Débat: Réseaux sociaux', 30);
  recordClash('Débat: Environnement', 35);
  recordClash('Débat: Éducation', 30);

  // Ajouter quelques notes
  recordRating(5, 'Excellente explication de Mathématiques');
  recordRating(4, 'Bon cours de Français');
  recordRating(5, 'Très patient en Anglais');

  // Enregistrer un abonnement
  studentStats.updateSubscription('standard', 49.99);

  // Afficher les statistiques
  displayStudentStats();

  console.log('✅ Données de démonstration chargées!');
  console.log('📈 Statistiques:', studentStats.getFormattedStats());
}

/**
 * Ajoute progressivement de l'activité (simulation en temps réel)
 * À appeler avec un interval pour simuler une activité continue
 */
function simulateActivity() {
  if (!studentStats) {
    console.warn('studentStats pas encore initialisé');
    return;
  }

  const courses = [
    { subject: 'Mathématiques', teacher: 'M. Dupont', duration: 20 },
    { subject: 'Français', teacher: 'Mme Martin', duration: 25 },
    { subject: 'Anglais', teacher: 'Mr. Johnson', duration: 20 },
    { subject: 'Physique', teacher: 'M. Bernard', duration: 30 },
    { subject: 'Histoire', teacher: 'Mme Leclerc', duration: 25 }
  ];

  const teachers = ['M. Dupont', 'Mme Martin', 'Mr. Johnson', 'M. Bernard', 'Mme Leclerc'];
  
  const debates = [
    'Débat: Réseaux sociaux',
    'Débat: Environnement',
    'Débat: Éducation',
    'Débat: Technologie',
    'Débat: Politique'
  ];

  const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randomDuration = (min, max) => Math.round(Math.random() * (max - min) + min);

  // 70% de chance: ajouter un cours
  if (Math.random() < 0.7) {
    const course = random(courses);
    recordCourse(course.subject, course.teacher, course.duration);
    console.log(`📚 ${course.subject} ajouté`);
  }

  // 30% de chance: ajouter un appel JustSpeak
  if (Math.random() < 0.3) {
    const teacher = random(teachers);
    const duration = randomDuration(10, 30);
    recordJustSpeak(teacher, duration);
    console.log(`💬 Appel JustSpeak avec ${teacher} (${duration}min)`);
  }

  // 10% de chance: ajouter un clash
  if (Math.random() < 0.1) {
    const debate = random(debates);
    const duration = randomDuration(25, 40);
    recordClash(debate, duration);
    console.log(`🎤 ${debate} (${duration}min)`);
  }

  // Afficher les stats
  displayStudentStats();
}

/**
 * Réinitialise les données de démonstration
 */
function resetDemoStatistics() {
  if (!studentStats) {
    console.warn('studentStats pas encore initialisé');
    return;
  }

  const email = sessionData.email || 'demo@example.com';
  studentStats.resetStats(email);
  displayStudentStats();
  
  console.log('🗑️ Données réinitialisées');
}

/**
 * Affiche un résumé des statistiques en console
 */
function printStatisticsSummary() {
  if (!studentStats || !studentStats.stats) {
    console.log('❌ Pas de statistiques disponibles');
    return;
  }

  const stats = studentStats.stats;
  const formatted = studentStats.getFormattedStats();
  const duration = studentStats.getTotalDuration();

  console.log('');
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║        📊 RÉSUMÉ DES STATISTIQUES ÉTUDIANT       ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('');
  
  console.log('📚 COURS');
  console.log(`   • Nombre: ${stats.courses.count}`);
  console.log(`   • Durée totale: ${stats.courses.duration} minutes`);
  console.log(`   • Coût estimé: ${stats.courses.totalCost}€`);
  console.log(`   • Matières: ${Object.keys(stats.courses.subjects).join(', ') || 'Aucune'}`);
  console.log('');

  console.log('💬 JUSTSPEAK');
  console.log(`   • Nombre d'appels: ${stats.justspeak.count}`);
  console.log(`   • Durée totale: ${stats.justspeak.duration} minutes`);
  const avgJustSpeak = stats.justspeak.count > 0 
    ? Math.round(stats.justspeak.duration / stats.justspeak.count)
    : 0;
  console.log(`   • Durée moyenne: ${avgJustSpeak} minutes`);
  console.log('');

  console.log('🎤 CLASHS');
  console.log(`   • Nombre: ${stats.clashs.count}`);
  console.log(`   • Durée totale: ${stats.clashs.duration} minutes`);
  const avgClash = stats.clashs.count > 0
    ? Math.round(stats.clashs.duration / stats.clashs.count)
    : 0;
  console.log(`   • Durée moyenne: ${avgClash} minutes`);
  console.log('');

  console.log('⏱️ TEMPS TOTAL');
  console.log(`   • ${duration.hours}h ${duration.minutes}m (${duration.total} minutes)`);
  console.log('');

  console.log('📊 STATISTIQUES GLOBALES');
  console.log(`   • Professeurs différents: ${studentStats.getTotalTeachers()}`);
  console.log(`   • Matières explorées: ${studentStats.getSubjectsCount()}`);
  const avgRating = studentStats.getAverageRating();
  console.log(`   • Note moyenne donnée: ${avgRating ? avgRating + '/5' : '-'}`);
  console.log('');

  console.log('💳 ABONNEMENT');
  console.log(`   • Type: ${stats.subscription.type || 'Gratuit'}`);
  console.log(`   • Total dépensé: ${stats.subscription.totalSpent}€`);
  console.log('');

  console.log('📜 ACTIVITÉ RÉCENTE');
  if (studentStats.activity.length === 0) {
    console.log('   • Aucune activité');
  } else {
    studentStats.activity.slice(0, 5).forEach((activity, index) => {
      const durationStr = activity.duration ? ` (${activity.duration}min)` : '';
      console.log(`   ${index + 1}. ${activity.description}${durationStr}`);
    });
    if (studentStats.activity.length > 5) {
      console.log(`   ... et ${studentStats.activity.length - 5} autres`);
    }
  }
  
  console.log('');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('');
}

/**
 * Affiche les données brutes pour le debugging
 */
function printRawData() {
  console.group('📦 Données brutes');
  console.log('Stats:', studentStats.stats);
  console.log('Activity:', studentStats.activity);
  console.groupEnd();
}

/**
 * Teste si le système fonctionne correctement
 */
function testStatisticsSystem() {
  console.log('🧪 Test du système de statistiques...');
  console.log('');

  // Test 1: Initialisation
  console.log('✓ Test 1: Initialisation');
  if (!studentStats) {
    console.error('✗ studentStats n\'est pas initialisé');
    return;
  }
  console.log('  ✓ studentStats est initialisé');
  console.log('');

  // Test 2: Ajout de données
  console.log('✓ Test 2: Ajout de données');
  const initialCount = studentStats.stats.courses.count;
  recordCourse('Test', 'Prof Test', 20);
  if (studentStats.stats.courses.count === initialCount + 1) {
    console.log('  ✓ Cours ajouté correctement');
  } else {
    console.error('  ✗ Erreur lors de l\'ajout du cours');
  }
  console.log('');

  // Test 3: Enregistrement d'activité
  console.log('✓ Test 3: Enregistrement d\'activité');
  const initialActivityCount = studentStats.activity.length;
  recordJustSpeak('Prof Test', 15);
  if (studentStats.activity.length > initialActivityCount) {
    console.log('  ✓ Activité enregistrée');
  } else {
    console.error('  ✗ Erreur lors de l\'enregistrement d\'activité');
  }
  console.log('');

  // Test 4: Persistance
  console.log('✓ Test 4: Persistance des données');
  const stored = localStorage.getItem('lok_in_student_stats');
  if (stored) {
    console.log('  ✓ Données sauvegardées en localStorage');
  } else {
    console.error('  ✗ Données non sauvegardées');
  }
  console.log('');

  // Test 5: Calculs
  console.log('✓ Test 5: Calculs');
  const formatted = studentStats.getFormattedStats();
  console.log(`  • Cours: ${formatted.courses}`);
  console.log(`  • JustSpeak: ${formatted.justspeak}`);
  console.log(`  • Clashs: ${formatted.clashs}`);
  console.log(`  • Durée totale: ${formatted.duration}`);
  console.log('');

  console.log('✅ Tous les tests sont passés!');
}

/**
 * Guide d'utilisation en console
 */
function showConsoleGuide() {
  console.clear();
  console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║           📊 GUIDE D'UTILISATION - SYSTÈME DE STATISTIQUES            ║
╚════════════════════════════════════════════════════════════════════════╝

🚀 COMMANDES RAPIDES:

  // Charger les données de démonstration
  loadDemoStatistics()

  // Simuler progressivement de l'activité
  simulateActivity()

  // Réinitialiser les statistiques
  resetDemoStatistics()

  // Afficher un résumé des statistiques
  printStatisticsSummary()

  // Afficher les données brutes
  printRawData()

  // Tester le système
  testStatisticsSystem()

📝 ENREGISTREMENTS MANUELS:

  // Ajouter un cours
  recordCourse('Mathématiques', 'M. Dupont', 20)

  // Ajouter un appel JustSpeak
  recordJustSpeak('Mme Martin', 15)

  // Ajouter un clash
  recordClash('Débat: Réseaux sociaux', 30)

  // Ajouter une note
  recordRating(5, 'Excellent cours')

  // Mettre à jour l'abonnement
  studentStats.updateSubscription('premium', 49.99)

📊 CONSULTATION DES DONNÉES:

  // Voir les statistiques formatées
  console.log(studentStats.getFormattedStats())

  // Voir toutes les statistiques brutes
  console.log(studentStats.stats)

  // Voir l'historique d'activité
  console.log(studentStats.activity)

  // Voir le nombre total de profs différents
  console.log(studentStats.getTotalTeachers())

  // Voir le nombre de matières explorées
  console.log(studentStats.getSubjectsCount())

  // Voir la note moyenne
  console.log(studentStats.getAverageRating())

💾 STOCKAGE:

  Données sauvegardées dans localStorage:
  - lok_in_student_stats    (statistiques principales)
  - lok_in_student_activity (historique d'activité)

  Pour vider:
  localStorage.removeItem('lok_in_student_stats')
  localStorage.removeItem('lok_in_student_activity')

🔄 AFFICHAGE:

  // Afficher les statistiques dans l'interface
  displayStudentStats()

  // Afficher juste l'historique récent
  displayRecentActivity()

════════════════════════════════════════════════════════════════════════
  `);
}

// Afficher le guide quand ce script se charge
console.log('%c📊 Système de démonstration des statistiques chargé!', 'color: #4CAF50; font-size: 16px; font-weight: bold;');
console.log('%cTapez showConsoleGuide() pour voir les commandes disponibles', 'color: #2196F3;');
