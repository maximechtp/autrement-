# 📋 Guide d'Administration - Gestion des Matières

## 🎯 Objectif

En tant qu'administrateur du site Lok In, vous pouvez maintenant contrôler quelles matières chaque professeur est autorisé à enseigner. Ce système vous permet de :

- ✅ **Visualiser tous les professeurs** inscrits sur la plateforme
- ✅ **Gérer les matières autorisées** pour chaque professeur
- ✅ **Ajouter des matières** à la base de données
- ✅ **Suivre les statistiques** d'utilisation des matières

---

## 🚀 Accès au Panneau Admin

### Pour les Administrateurs

1. **Connectez-vous** à votre compte administrateur
2. Un bouton **⚙️ Admin** apparaîtra en haut à droite
3. Cliquez dessus pour accéder au panneau d'administration

### Emails Administrateurs Autorisés

- `maxime.chantepiee@gmail.com`
- `jan.smid14@gmail.com`

> **Note** : Seuls ces emails ont accès au panneau admin.

---

## 📊 Fonctionnalités du Panneau Admin

### 1. **Dashboard Statistiques**

En haut du panneau, vous verrez :
- 📚 **Nombre de professeurs** inscrits
- 🎯 **Nombre de matières autorisées** au total
- ⚡ **Nombre de matières actives** (actuellement utilisées)

### 2. **Gestion des Matières des Professeurs**

#### Recherche et Filtrage
- **Recherche par nom, email** : Trouvez rapidement un professeur
- **Filtrer par matière** : Voir tous les profs d'une matière spécifique
- **Bouton Actualiser** : Recharger les données en temps réel

#### Carte Professeur
Chaque professeur affiche :
- 👤 **Nom et Email**
- ⭐ **Note de qualité** (si disponible) + nombre de cours
- 📚 **Matières autorisées**
- ✏️ **Bouton "Gérer les matières"**

#### Éditer les Matières d'un Professeur

1. Cliquez sur **✏️ Gérer les matières** sur une carte professeur
2. Une modal s'ouvre avec :
   - ☑️ Checkboxes pour chaque matière existante
   - 📝 Champ pour ajouter une nouvelle matière
3. Cochez/décochez les matières à autoriser
4. Cliquez sur **💾 Sauvegarder**

**Résultat** : 
- Les matières autorisées sont mises à jour
- Les matières non-autorisées qui étaient actives sont désactivées automatiquement
- Le professeur reçoit une notification (si WebSocket est actif)

### 3. **Gestion des Matières Disponibles**

#### Vue des Matières Existantes
- Liste complète avec le **nombre de professeurs** par matière
- Mise à jour en temps réel

#### Ajouter une Matière
1. Remplissez le champ **"Nom de la matière"**
2. Cliquez sur **+ Ajouter**
3. La matière s'ajoute à la base de données et peut être attribuée aux professeurs

---

## 🔄 Flux de Travail Typique

### Scénario 1 : Autoriser un professeur à enseigner

```
1. Cherchez le professeur par son nom/email
2. Cliquez sur "Gérer les matières"
3. Cochez les matières qu'il peut enseigner
4. Cliquez sur "Sauvegarder"
✅ Les matières sont maintenant autorisées pour ce professeur
```

### Scénario 2 : Ajouter une nouvelle matière à la plateforme

```
1. Scrollez vers la section "Matières Disponibles"
2. Remplissez le formulaire "Ajouter une matière"
3. Cliquez sur "+ Ajouter"
✅ La matière est créée et disponible pour les attributions
```

### Scénario 3 : Retirer l'accès à une matière

```
1. Ouvrez la modal du professeur
2. Décochez la matière à retirer
3. Cliquez sur "Sauvegarder"
✅ L'accès est révoqué automatiquement
```

---

## 📱 Interface Responsive

Le panneau admin s'adapte à tous les écrans :
- **Desktop** : Affichage optimisé multi-colonnes
- **Tablet** : Layout adaptatif
- **Mobile** : Affichage mono-colonne avec menus adaptés

---

## 🔐 Sécurité

### Authentification
- ✅ Vérification du email administrateur côté client ET serveur
- ✅ Session stockée dans sessionStorage
- ✅ Redirection automatique si non-autorisé

### Données
- ✅ Les modifications sont persistées dans la base de données
- ✅ Validation côté serveur de toutes les requêtes
- ✅ Logs de chaque modification administrative

---

## 📡 Intégration WebSocket

Lorsqu'un administrateur modifie les matières d'un professeur :

1. **Mise à jour serveur** : Les données sont sauvegardées
2. **Notification professeur** : Si le professeur est connecté, il reçoit une notification
3. **Rechargement dynamique** : L'interface du professeur se met à jour en temps réel

---

## 🐛 Dépannage

### Le bouton Admin n'apparaît pas
- ✅ Vérifiez que vous êtes connecté
- ✅ Vérifiez que votre email est dans la liste des admins
- ✅ Rafraîchissez la page (F5)

### Les modifications ne se sauvegardent pas
- ✅ Vérifiez la connexion Internet
- ✅ Vérifiez la console du navigateur (F12) pour les erreurs
- ✅ Vérifiez que le serveur est actif

### Un professeur n'apparaît pas dans la liste
- ✅ Utilisez la recherche pour vérifier
- ✅ Le professeur doit être enregistré et avoir un statut "Professeur"
- ✅ Cliquez sur "Actualiser" pour recharger la liste

---

## 📈 Statistiques et Rapports

Le dashboard montre :
- **Professeurs** : Nombre total de professeurs inscrits
- **Matières Autorisées** : Nombre total de matières accordées
- **Matières Actives** : Matières actuellement activées par les professeurs

> Les statistiques se mettent à jour en temps réel.

---

## 💡 Bonnes Pratiques

### ✅ À Faire
- Vérifiez régulièrement les nouveaux professeurs
- Autorisez les matières en fonction des qualifications
- Maintenez à jour la liste des matières disponibles
- Utilisez la recherche pour les tâches de gestion

### ❌ À Éviter
- Ne revoqued pas l'accès sans notifier le professeur
- Évitez de créer des doublons de matières
- Ne modifiez pas les données directement dans la BD sans passer par l'admin panel

---

## 🔄 API Endpoints (Pour Développeurs)

### GET /api/admin/teachers
```
Récupère la liste de tous les professeurs
Query params: adminEmail (email de l'admin)
Response: { teachers: [{email, prenom, nom, authorizedSubjects, ...}] }
```

### GET /api/admin/subjects
```
Récupère la liste de toutes les matières
Query params: adminEmail (email de l'admin)
Response: { subjects: [matière1, matière2, ...] }
```

### PUT /api/admin/teacher/:email/subjects
```
Met à jour les matières autorisées d'un professeur
Query params: adminEmail (email de l'admin)
Body: { authorizedSubjects: [matière1, matière2, ...] }
Response: { teacher: {...} }
```

### POST /api/admin/subject
```
Crée une nouvelle matière
Query params: adminEmail (email de l'admin)
Body: { subject: "Nom de la matière" }
Response: { subject: "Nom de la matière" }
```

---

## 📞 Support

Pour toute question ou problème :
- 📧 Contactez l'équipe technique
- 🐛 Signalez les bugs
- 💬 Demandez des améliorations

---

**Dernière mise à jour** : 27 Février 2026  
**Version** : 1.0.0
