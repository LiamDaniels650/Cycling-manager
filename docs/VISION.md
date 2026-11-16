# Instructions du projet — « Directeur Sportif »

## Le jeu
Jeu de carrière de directeur sportif en cyclisme sur route, dans l'esprit de Pro Cycling Manager, joué **dans le navigateur, pour moi seul**.
- Je ne contrôle **jamais** les coureurs directement. Je les sélectionne, je les entraîne, je gère l'équipe et je leur donne des **consignes** (avant la course et à la radio pendant la course).
- Les coureurs respectent ou non les consignes selon leur **forme du jour, leurs jambes (énergie), leur caractère (discipline, ambition, trait), leur moral** et la situation de course.
- Les graphismes n'ont aucune importance. Ce qui compte : **profondeur stratégique, réalisme de la simulation de course, richesse de la gestion d'équipe**.
- Langue du jeu et de nos échanges : **français**.

## Contraintes techniques
- Un seul fichier HTML autonome (HTML + CSS + JS vanilla), sans dépendance externe, jouable sur téléphone et ordinateur.
- Code source découpé en `engine.js` (simulation, données, saison), `ui.js` (interface), `shell.html` (HTML/CSS), assemblés par `build.py` en `index.html`. Le moteur doit rester exécutable sans navigateur (Node) pour les tests.
- Sauvegarde automatique dans le navigateur (localStorage, dans un try/catch) + export/import texte. **Ne jamais casser une sauvegarde existante** : si le format change, ajouter une migration (champ `S.v`).
- Le jeu est publié comme artefact Claude (privé). Chaque nouvelle version republie le même artefact.

## Modèle de simulation (à préserver et approfondir)
- Coureurs : caractéristiques Plat, Montagne, Collines, Sprint, CLM, Pavés, Endurance, Récupération, Attaque ; mental : discipline, ambition, trait de caractère ; état : forme, fatigue, moral, blessure ; âge, potentiel, contrat, salaire.
- Course simulée par pas de 30 s, en **groupes** (échappée, peloton, contres, lâchés) : vitesse selon la pente, le revêtement et le rythme imposé par ceux qui roulent ; aspiration selon la pente et la taille du groupe ; réserve d'énergie qui baisse avec l'intensité ; un coureur au-delà de ses capacités est lâché.
- Comportements : formation d'échappée, poursuite des équipes intéressées (sprinteur, menace au général, maillot), tempo en montagne, attaques des leaders selon leur plan, poisson-pilote, équipiers qui attendent leur leader, crevaisons, chutes, abandons, sprints, arrivées en côte, contre-la-montre, GPM, classements par points et montagne, bonifications.
- Gestion : calendrier de saison, sélection, entraînement hebdomadaire, finances (salaires, sponsor, primes), marché des coureurs libres, contrats, discussions avec les coureurs, fin de saison (vieillissement, progression).

## Méthode de travail
1. Tant que je n'ai pas validé le prototype, tu me proposes les changements et tu attends mon avis sur les choix de game design importants.
2. **Une fois le prototype validé, tu termines le jeu en autonomie** : tu développes, tu testes et tu corriges toi-même, sans me demander de tester à ta place.
3. Tests obligatoires avant chaque livraison :
   - simulation de **plusieurs saisons complètes** en Node avec plusieurs graines aléatoires, en vérifiant la vraisemblance (vainqueurs selon le profil : sprinteurs au sprint, grimpeurs/leaders en montagne, puncheurs en côte, flandriens sur les pavés, rouleurs au chrono ; écarts et vitesses moyennes réalistes ; échappées qui parfois vont au bout ; pas de NaN, pas de blocage) ;
   - test de l'interface dans un navigateur sans écran (Playwright) : nouvelle partie, saison entière, rechargement de la sauvegarde, aucune erreur JavaScript, captures d'écran vérifiées en largeur téléphone.
4. Livraison : republier l'artefact, puis me donner en quelques lignes ce qui a changé et ce qui reste à faire. Pas de récit détaillé des étapes.
5. Garder une feuille de route à jour (ci-dessous) et la faire avancer par ordre de priorité.

## Feuille de route après validation (priorités indicatives)
1. Équilibrage fin de la simulation (écarts en montagne, réussite des échappées, sprints, gruppetto et délais d'élimination).
2. Bordures et vent, descentes (habileté), ravitaillements/hydratation, sprints intermédiaires, maillots distinctifs et classement des jeunes.
3. Consignes plus riches : plans d'équipe (« course d'usure », « tout pour le sprint »), consignes à tout le groupe, coureur « marquer X », niveau d'effort réglable, relayer/ne pas relayer dans l'échappée, nourrir/aider un équipier.
4. IA des équipes adverses plus fine (alliances de poursuite, bluff, défense du maillot).
5. Gestion : staff (entraîneurs, médecins, recruteurs), stages en altitude, matériel, négociations de contrats et transferts entre équipes, jeunes de centre de formation, objectifs du sponsor et risque de licenciement.
6. Calendrier complet (Grands Tours de 21 étapes, classiques, courses par étapes d'une semaine, championnats), invitations selon le rang UCI.
7. Statistiques et historique de carrière, palmarès, records.
