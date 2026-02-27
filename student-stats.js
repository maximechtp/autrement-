/**
 * Système de gestion des statistiques des élèves
 * Track les cours, appels, clashs, temps passé, etc.
 */

class StudentStatistics {
  constructor() {
    this.STORAGE_KEY = 'lok_in_student_stats';
    this.ACTIVITY_KEY = 'lok_in_student_activity';
    this.loadStats();
    this.loadActivity();
  }

  /**
   * Initialise les statistiques pour un nouvel étudiant
   */
  initializeStats(email) {
    const stats = {
      email: email,
      courses: {
        count: 0,
        duration: 0,        // en minutes
        totalCost: 0,
        subjects: {},       // {subject: count}
        teachers: new Set()  // professeurs rencontrés
      },
      justspeak: {
        count: 0,
        duration: 0,        // en minutes
        teachers: new Set()
      },
      clashs: {
        count: 0,
        duration: 0,        // en minutes
        teachers: new Set()
      },
      subscription: {
        type: null,         // null, 'standard', 'premium'
        startDate: null,
        totalSpent: 0
      },
      ratings: [],         // [{ rating, date, context }]
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    this.saveStats(stats);
    return stats;
  }

  /**
   * Charge les statistiques depuis le localStorage
   */
  loadStats() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.stats = JSON.parse(stored);
        // Convertir les Sets
        if (this.stats.courses) this.stats.courses.teachers = new Set(this.stats.courses.teachers || []);
        if (this.stats.justspeak) this.stats.justspeak.teachers = new Set(this.stats.justspeak.teachers || []);
        if (this.stats.clashs) this.stats.clashs.teachers = new Set(this.stats.clashs.teachers || []);
      } else {
        this.stats = null;
      }
    } catch (error) {
      console.error('Erreur chargement stats:', error);
      this.stats = null;
    }
  }

  /**
   * Sauvegarde les statistiques dans le localStorage
   */
  saveStats(stats = null) {
    try {
      const toSave = stats || this.stats;
      if (!toSave) return;
      
      const copy = JSON.parse(JSON.stringify(toSave));
      // Convertir les Sets en Array pour JSON
      if (copy.courses && copy.courses.teachers) {
        copy.courses.teachers = Array.from(copy.courses.teachers);
      }
      if (copy.justspeak && copy.justspeak.teachers) {
        copy.justspeak.teachers = Array.from(copy.justspeak.teachers);
      }
      if (copy.clashs && copy.clashs.teachers) {
        copy.clashs.teachers = Array.from(copy.clashs.teachers);
      }
      
      copy.lastUpdated = new Date().toISOString();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(copy));
    } catch (error) {
      console.error('Erreur sauvegarde stats:', error);
    }
  }

  /**
   * Charge l'historique d'activité
   */
  loadActivity() {
    try {
      const stored = localStorage.getItem(this.ACTIVITY_KEY);
      this.activity = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Erreur chargement activité:', error);
      this.activity = [];
    }
  }

  /**
   * Sauvegarde l'historique d'activité
   */
  saveActivity() {
    try {
      localStorage.setItem(this.ACTIVITY_KEY, JSON.stringify(this.activity));
    } catch (error) {
      console.error('Erreur sauvegarde activité:', error);
    }
  }

  /**
   * Ajoute une activité à l'historique (limité aux 50 derniers)
   */
  addActivity(type, description, duration = null) {
    const activity = {
      type: type,           // 'cours', 'justspeak', 'clash'
      description: description,
      duration: duration,   // en minutes
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString('fr-FR')
    };
    
    this.activity.unshift(activity);
    // Garder que les 50 dernières activités
    if (this.activity.length > 50) {
      this.activity = this.activity.slice(0, 50);
    }
    this.saveActivity();
    return activity;
  }

  /**
   * Enregistre un cours suivi
   */
  addCourse(subject, teacher, duration = 20) {
    if (!this.stats) return;
    
    this.stats.courses.count++;
    this.stats.courses.duration += duration;
    this.stats.courses.totalCost += 5; // Coût estimé
    this.stats.courses.subjects[subject] = (this.stats.courses.subjects[subject] || 0) + 1;
    this.stats.courses.teachers.add(teacher);
    
    this.addActivity('cours', `Cours de ${subject} avec ${teacher}`, duration);
    this.saveStats();
  }

  /**
   * Enregistre un appel JustSpeak
   */
  addJustSpeak(teacher, duration) {
    if (!this.stats) return;
    
    this.stats.justspeak.count++;
    this.stats.justspeak.duration += duration;
    this.stats.justspeak.teachers.add(teacher);
    
    this.addActivity('justspeak', `Appel JustSpeak avec ${teacher}`, duration);
    this.saveStats();
  }

  /**
   * Enregistre un clash
   */
  addClash(opponent, duration) {
    if (!this.stats) return;
    
    this.stats.clashs.count++;
    this.stats.clashs.duration += duration;
    
    this.addActivity('clash', `Clash contre ${opponent}`, duration);
    this.saveStats();
  }

  /**
   * Ajoute une note/rating
   */
  addRating(rating, context) {
    if (!this.stats) return;
    
    this.stats.ratings.push({
      rating: rating,
      context: context,
      date: new Date().toISOString()
    });
    
    this.saveStats();
  }

  /**
   * Met à jour le type d'abonnement
   */
  updateSubscription(type, cost = 0) {
    if (!this.stats) return;
    
    this.stats.subscription.type = type;
    this.stats.subscription.startDate = new Date().toISOString();
    this.stats.subscription.totalSpent += cost;
    
    this.saveStats();
  }

  /**
   * Récupère le nombre total de professeurs différents
   */
  getTotalTeachers() {
    if (!this.stats) return 0;
    
    const allTeachers = new Set([
      ...this.stats.courses.teachers,
      ...this.stats.justspeak.teachers,
      ...this.stats.clashs.teachers
    ]);
    
    return allTeachers.size;
  }

  /**
   * Récupère le nombre de matières explorées
   */
  getSubjectsCount() {
    if (!this.stats) return 0;
    return Object.keys(this.stats.courses.subjects).length;
  }

  /**
   * Calcule la note moyenne donnée
   */
  getAverageRating() {
    if (!this.stats || this.stats.ratings.length === 0) return null;
    
    const sum = this.stats.ratings.reduce((acc, r) => acc + r.rating, 0);
    return (sum / this.stats.ratings.length).toFixed(1);
  }

  /**
   * Récupère le temps total en heures et minutes
   */
  getTotalDuration() {
    if (!this.stats) return { hours: 0, minutes: 0 };
    
    const totalMinutes = this.stats.courses.duration + 
                        this.stats.justspeak.duration + 
                        this.stats.clashs.duration;
    
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
      total: totalMinutes
    };
  }

  /**
   * Récupère les statistiques formatées pour l'affichage
   */
  getFormattedStats() {
    if (!this.stats) {
      return {
        courses: 0,
        justspeak: 0,
        clashs: 0,
        duration: '0h',
        justspeakDuration: '0m',
        subjects: 0,
        teachers: 0,
        rating: '-'
      };
    }

    const totalDuration = this.getTotalDuration();
    const durationStr = totalDuration.hours > 0 
      ? `${totalDuration.hours}h${totalDuration.minutes > 0 ? totalDuration.minutes + 'm' : ''}` 
      : `${totalDuration.minutes}m`;

    const justspeakDur = this.stats.justspeak.duration;
    const justspeakStr = justspeakDur >= 60 
      ? `${Math.floor(justspeakDur / 60)}h${justspeakDur % 60}m` 
      : `${justspeakDur}m`;

    return {
      courses: this.stats.courses.count,
      justspeak: this.stats.justspeak.count,
      clashs: this.stats.clashs.count,
      duration: durationStr,
      justspeakDuration: justspeakStr,
      subjects: this.getSubjectsCount(),
      teachers: this.getTotalTeachers(),
      rating: this.getAverageRating() || '-'
    };
  }

  /**
   * Réinitialise les statistiques
   */
  resetStats(email) {
    this.stats = this.initializeStats(email);
    this.activity = [];
    this.saveActivity();
  }
}

// Instance globale
let studentStats = null;

/**
 * Initialise le système de statistiques pour un étudiant
 */
function initStudentStats(email) {
  studentStats = new StudentStatistics();
  
  // Si l'utilisateur n'a pas de stats, les initialiser
  if (!studentStats.stats || studentStats.stats.email !== email) {
    studentStats.initializeStats(email);
  }
}

/**
 * Affiche les statistiques dans le profil
 */
function displayStudentStats() {
  if (!studentStats || !studentStats.stats) return;

  const statsSection = document.getElementById('student-stats-section');
  if (!statsSection) return;

  const formatted = studentStats.getFormattedStats();

  // Mettre à jour les statistiques principales
  document.getElementById('stat-courses').textContent = formatted.courses;
  document.getElementById('stat-justspeak').textContent = formatted.justspeak;
  document.getElementById('stat-clashs').textContent = formatted.clashs;
  document.getElementById('stat-duration').textContent = formatted.duration;
  document.getElementById('stat-justspeak-duration').textContent = formatted.justspeakDuration;
  document.getElementById('stat-subjects').textContent = formatted.subjects;
  document.getElementById('stat-teachers').textContent = formatted.teachers;
  document.getElementById('stat-rating').textContent = formatted.rating;

  // Mettre à jour les détails
  document.getElementById('detail-courses-count').textContent = studentStats.stats.courses.count;
  document.getElementById('detail-courses-duration').textContent = `${studentStats.stats.courses.duration} min`;
  document.getElementById('detail-courses-cost').textContent = `${studentStats.stats.courses.totalCost}€`;

  document.getElementById('detail-justspeak-count').textContent = studentStats.stats.justspeak.count;
  document.getElementById('detail-justspeak-duration').textContent = `${studentStats.stats.justspeak.duration} min`;
  const avgJS = studentStats.stats.justspeak.count > 0 
    ? Math.round(studentStats.stats.justspeak.duration / studentStats.stats.justspeak.count) 
    : 0;
  document.getElementById('detail-justspeak-avg').textContent = `${avgJS} min`;

  document.getElementById('detail-clashs-count').textContent = studentStats.stats.clashs.count;
  document.getElementById('detail-clashs-duration').textContent = `${studentStats.stats.clashs.duration} min`;
  const avgClash = studentStats.stats.clashs.count > 0 
    ? Math.round(studentStats.stats.clashs.duration / studentStats.stats.clashs.count) 
    : 0;
  document.getElementById('detail-clashs-avg').textContent = `${avgClash} min`;

  // Mettre à jour l'abonnement
  const subType = studentStats.stats.subscription.type || 'Gratuit';
  document.getElementById('detail-subscription-status').textContent = 
    sessionData.isSubscribed ? 'Actif' : 'Inactif';
  document.getElementById('detail-subscription-type').textContent = sessionData.subscriptionType || '-';
  document.getElementById('detail-total-spent').textContent = `${studentStats.stats.subscription.totalSpent}€`;

  // Afficher l'historique d'activité
  displayRecentActivity();

  // Afficher la section
  statsSection.classList.remove('hidden');
}

/**
 * Affiche l'activité récente
 */
function displayRecentActivity() {
  const activityContainer = document.getElementById('recent-activity');
  if (!activityContainer || !studentStats.activity) return;

  if (studentStats.activity.length === 0) {
    activityContainer.innerHTML = '<p class="no-activity">Aucune activité enregistrée</p>';
    return;
  }

  let html = '';
  studentStats.activity.slice(0, 10).forEach(activity => {
    const iconMap = {
      'cours': '📚',
      'justspeak': '💬',
      'clash': '🎤'
    };

    const icon = iconMap[activity.type] || '📌';
    const duration = activity.duration ? ` (${activity.duration}min)` : '';

    html += `
      <div class="activity-item">
        <div class="activity-content">
          <div class="activity-text">${icon} ${activity.description}${duration}</div>
          <div class="activity-time">${new Date(activity.timestamp).toLocaleString('fr-FR')}</div>
        </div>
        <span class="activity-type">${activity.type}</span>
      </div>
    `;
  });

  activityContainer.innerHTML = html;
}

/**
 * Ajoute un cours (à appeler quand l'utilisateur termine un cours)
 */
function recordCourse(subject, teacher, duration = 20) {
  if (!studentStats) return;
  studentStats.addCourse(subject, teacher, duration);
  displayStudentStats();
}

/**
 * Ajoute un appel JustSpeak (à appeler quand l'appel se termine)
 */
function recordJustSpeak(teacher, duration) {
  if (!studentStats) return;
  studentStats.addJustSpeak(teacher, duration);
  displayStudentStats();
}

/**
 * Ajoute un clash (à appeler quand le clash se termine)
 */
function recordClash(opponent, duration) {
  if (!studentStats) return;
  studentStats.addClash(opponent, duration);
  displayStudentStats();
}

/**
 * Enregistre une note/rating
 */
function recordRating(rating, context = '') {
  if (!studentStats) return;
  studentStats.addRating(rating, context);
  displayStudentStats();
}
