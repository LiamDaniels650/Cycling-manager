# Directeur Sportif — code source

Jeu de gestion d'équipe cycliste joué dans le navigateur, en un seul fichier HTML hors ligne.

## Dans ce dépôt

- `index.html` : le jeu prêt à jouer (ouvrir dans un navigateur).
- Construire depuis les sources : `npm install`, puis `npm run build` (ou `./dev.sh build`). Le jeu (interface
  React) sort dans `dist/index.html` (et `dist/react.html`) ; le moteur seul, utilisé par les tests Node, dans
  `dist/engine.js`. Copier `dist/index.html` en `index.html` pour publier.
- Vérifications : `./dev.sh check` (lint, types, empreinte de la simulation), `./dev.sh test` (tout, interface
  comprise), `./dev.sh calib 60` (réalisme, 2 × 60 saisons), `node tests/career.js`, `python3 tests/play_react.py`.
  L'intégration continue GitHub (`.github/workflows/verifications.yml`) lance check, tests fonctionnels et
  non-régression à chaque push.

Le moteur est assemblé par `build.py` (tests) ; le jeu par `tools/build_react.mjs` (moteur + fonctions d'action de
`src/ui` + application React de `src/react`). Il n'y a plus qu'une interface : React.

## Organisation

```
src/
  shell.html              page HTML + CSS ; build.py y injecte le moteur et l'interface
  engine/                 moteur (exécutable aussi dans Node pour les tests)
    01-util.js            hasard reproductible (graine), formats de temps/argent
    02-data.js            données de référence : caractéristiques, nations, archétypes, ordres, barèmes
    03-world.js           génération des coureurs et des équipes, nouvelle partie
    04-calendar.js        calendrier, profils d'étapes, météo, vent
    05-physics.js         capacité d'un coureur, vitesse, aspiration
    06-race-setup.js      sélection, consignes et plans de course des équipes IA
    07-tactics.js         obéissance, radio, ordres conditionnels, DS auto, attaques, poursuites, bordures
    08-stage-sim.js       simulation d'une étape en ligne, pas de 30 s (simTick et ses étapes)
    09-stage-finish.js    sommets des côtes, arrivées, classement de l'étape, watts et records de puissance
    10-time-trials.js     contre-la-montre individuels et par équipes
    11-results.js         résultats, classements, palmarès, primes
    12-season.js          semaine, finances, staff, sponsor, fin de saison
    13-people.js          brouillard d'information, académie, marché, relations entre coureurs
    14-press.js           presse, interviews, notoriété de l'équipe, popularité des coureurs
    15-equipment.js       équipementiers : marques, effets en course, contrats et offres
    16-career.js          carrière du DS : réputation, offres d'emploi, changement d'équipe, licenciement
    17-commentary.js      commentateur, moments forts, réponses radio selon le caractère (sans toucher au hasard de la course)
    18-assistant.js       adjoint : décisions automatiques de gestion (boutons « Auto » et délégation hebdomadaire)
    19-economy.js         difficulté, contrat du sponsor (renégocié tous les 2-3 ans), revalorisations salariales
    20-ai-season.js       stratégie de saison des équipes IA : objectif (général, sprints, classiques), Grand Tour visé, style
    21-planner.js         planificateur de saison (programme de courses par coureur, jours de course, planification auto)
    22-goals.js           objectifs personnels des coureurs (suivi pendant la saison, effet sur le moral)
    23-gear.js            matériel du jour (roues, pneus) selon le profil et la météo ; reconnaissances de parcours
    24-worlds.js          Championnats du monde par sélections nationales (maillot arc-en-ciel) ; légendes (score de palmarès)
    25-titles.js          titres de champion national, bilan individuel de fin de saison
    26-mercato.js         journal du mercato (transferts, signatures, départs, retraites) et rumeurs de presse
    27-raceplus.js        course : plan d'alimentation, barres en poche, alliances de poursuite, résumé d'étape
    28-image.js           image de l'équipe (identité construite par les résultats) et ses effets
    29-ai-economy.js      économie des équipes IA (budget selon le standing, masse salariale, standing qui évolue)
    52-commentary.js      le résumé du commentateur à la fin de chaque étape (lecture seule des relevés d'étape)
    99-migration.js       mise à niveau des anciennes sauvegardes (champ S.v) — toujours en dernier
  ui/                     interface
    01-core.js            sauvegarde, rendu, navigation, modales, tableau de coureurs
    02-team.js            effectif, fiche coureur, négociation, académie
    03-calendar.js        calendrier et sélection
    04-race.js            briefing, course en direct, radio, résultats
    05-office.js          marché, gestion, statistiques, messages, options
    06-help.js            premiers pas (bulles d'aide par écran) et guide du directeur sportif
    07-home.js            tableau de bord (accueil), navigation mobile (barre du bas, menu), fiche d'équipe, rivaux
tests/
  season_report.js        une saison complète simulée, résultats course par course
  multi_seasons.js        plusieurs saisons : stabilité, finances, progression des jeunes
  regress.sh              non-régression à graine fixe (résultats identiques attendus)
  features.js             tests fonctionnels : matériel, presse, carrière du DS
  ui_smoke_react.py       interface dans Chrome sans écran (aucune erreur JS tolérée)
  ui_auto_react.py        chaque bouton « Auto » cliqué pour de vrai, appel radio, DS automatique
  ui_worker.py            simulation d'une course dans un Web Worker (même résultat qu'en direct)
  calibrate.js            comparaison avec le cyclisme réel (vitesses, écarts, échappées, profils de vainqueurs)
  baseline/calibrage.txt  dernière mesure de calibration de référence
  fixtures/               anciennes sauvegardes pour tester la migration
  out/                    captures d'écran produites par ui_smoke_react.py
dist/                     fichiers produits (ne pas éditer)
```

Les fichiers sont concaténés dans l'ordre alphabétique : tout est global, les dépendances
entre modules passent par des fonctions (déclarées avant d'être appelées à l'exécution).

## Style

Le code est formaté avec Prettier (`.prettierrc`, lignes de 120 caractères) :
`prettier --write "src/**/*.js" "tests/*.js"`. Chaque fonction non évidente du moteur porte
un commentaire d'une ligne qui dit ce qu'elle fait.

## Commandes

```
./dev.sh build                       # produit dist/index.html (jeu) et dist/engine.js (tests)
tests/regress.sh                     # vérifie qu'un nettoyage n'a rien changé
tests/regress.sh update              # après un changement voulu de comportement
node tests/season_report.js 7        # une saison, graine 7 (L=1 pour le journal, AUTO=1 pour le DS auto)
node tests/multi_seasons.js 11 5     # 5 saisons, graine 11
python3 tests/ui_smoke_react.py      # test complet de l'interface
node tests/features.js               # matériel, presse, carrière (changement d'équipe, licenciement)
node tests/calibrate.js 6 100        # réalisme sur 6 saisons, comparé aux fourchettes réelles (✔/✖)
./dev.sh calib 60                    # référence : deux séries de 60 saisons (graines 200 et 300)
```

## Points clés du modèle

- La course est simulée par groupes (échappée, peloton, contres, lâchés). Le rythme d'un groupe
  vient de ceux qui roulent ; chaque coureur a une réserve de fond, une réserve d'explosivité (jus)
  et une jauge d'alimentation ; un coureur au-delà de ses capacités est lâché.
- Les consignes passent toujours par un test d'obéissance (discipline, moral, ambition, caractère,
  relations avec le leader, situation de course).
- Les sauvegardes ne doivent jamais casser : toute nouvelle donnée a une valeur par défaut dans
  `99-migration.js`.
- Le « peloton » (sim.pel) est le groupe principal contenant le plus de favoris, pas forcément le
  plus gros (le gruppetto peut l'être).
- Règle des 3 km sur les arrivées plates des courses par étapes ; abri de la caravane pour les
  petits groupes juste derrière le peloton sur le plat.
- Watts : chaque montée de plus de 1,5 km est chronométrée par coureur ; la puissance est calculée
  physiquement (gravité, roulement, air) à partir du temps, de la pente et du poids (r.kg).
- Effort : modèle « puissance critique ». Chaque coureur a une réserve anaérobie W' (kJ) qui se vide
  au-dessus de son seuil et se recharge en dessous (récupération de Skiba) ; la jauge « jus » = W'bal / W'.
- Dernière montée (arrivée au sommet, ou dernier col à moins de 40 km) : chaque lâché forme son propre
  groupe et monte à son rythme maximal ; le groupe des favoris s'égrène coureur par coureur.
- Sprints : trains de poissons-pilotes (compte à 3 km, « train perdu »), saut de roue, coureurs enfermés,
  vent de face ou de dos à l'arrivée.
- Altitude : -7 % de capacité par 1 000 m au-dessus de 1 500 m (moitié moins si acclimaté) ; froid en haute
  montagne ; jours sans plus fréquents avec la fatigue ; virus qui circule dans une équipe.
- Classement par équipes (3 meilleurs temps par étape), bonifications 10-6-4 s, délais par type d'étape.
- IA : pic de forme et stage en altitude des leaders avant leur Grand Tour ; mercato entre équipes IA.
- Carrières : âges de pic par profil (PEAK_AGE), déclin plus rapide du sprint, révélations tardives.
- Terrain : routes étroites (il faut être placé), vent qui tourne en cours d'étape.
- Le commentateur et l'interface n'utilisent jamais le hasard de la course : ils ne changent aucun résultat.
- Peloton : 18 équipes ; 36 courses, certaines la même semaine ; les équipes IA choisissent leur programme.
- Économie : trois niveaux de difficulté ; le sponsor principal se renégocie et peut partir ; les coureurs
  qui progressent demandent une augmentation ; frais par jour de course.
- Sauvegarde : les coureurs retraités sans victoire sont oubliés après un an (pruneWorld) ; si le stockage
  du navigateur est plein, élagage d'urgence puis alerte.
- Interface : sur écran étroit, les listes de coureurs s'affichent en cartes (bouton pour le tableau complet).
- Peloton : 18 équipes ; 37 courses (dont les Mondiaux en semaine 36), certaines la même semaine.
- Mondiaux : les 14 meilleures nations alignent 6 coureurs choisis selon le parcours et la forme ; les équipes
  de marque sont mises de côté le temps de la course puis restaurées (runWorlds). Le joueur est spectateur.
- Matériel : roues hautes (+ plat/chrono, − montée, chutes par grand vent), basses (+ montée), pneus larges
  (+ pavés, − crevaisons, chutes sous la pluie). Les équipes IA prennent le choix « de bon sens » (autoGear).
- Reconnaissance : coût selon le nombre d'étapes, +3 de fatigue ; pièges et chutes en descente moins fréquents.
- Optimisations : simulation des courses sans le joueur étape par étape (l'écran reste réactif) ; sauvegarde
  compressée (gzip) dans IndexedDB ; calibrage réparti sur plusieurs processus ; vérification des types
  (tests/typecheck.sh).
- Mondiaux : le DS peut demander un rôle (leader, carte libre, équipier) pour ses coureurs sélectionnés ;
  le rôle de leader n'est accordé qu'aux deux meilleurs de leur sélection.
- Championnat national : le mieux classé de chaque nation devient champion de son pays pour un an (🏅).
- Performance du moteur : tous les coureurs et tous les groupes ont la même forme d'objet (champs déclarés à la
  création), tables de poursuite à clés numériques, équipiers protecteurs comptés une fois par groupe. Simulation
  2,1 fois plus rapide, résultats identiques à l'octet (tests/regress.sh, empreinte md5 de l'état).
- Vérifications : tests/lint.sh (ESLint sur le jeu assemblé), tests/typecheck.sh, tests/features.js,
  tests/regress.sh, tests/calibrate.js, tests/ui_smoke.py.
- Équipementiers : chaque offre se négocie une fois — plus d'argent (risque de refus ou de retrait de l'offre),
  prototypes (moins d'argent, matériel plus aéro et plus léger mais plus fragile, réservé au joueur) ou prime à
  la victoire (moins de fixe, bonus par succès versé en fin de saison).
- Mercato : tous les mouvements de coureurs sont journalisés (S.merc). Les rumeurs de presse sont tirées par un
  hachage (saison, semaine) et ne consomment jamais le hasard de la partie : elles ne changent aucun résultat.
- Rumeurs fiables : une rumeur marque le coureur (r.rumor). En fin de contrat, un coureur IA visé rejoint
  l'équipe citée dans 60 % des cas ; un coureur du joueur visé a 2,5 fois plus de chances de signer un
  pré-contrat, et c'est l'équipe citée qui le fait signer.
- Rivaux : points UCI de chaque équipe relevés chaque semaine (S.uciTrack, saison précédente dans S.uciPrev).
- Interface : l'accueil réunit la prochaine échéance, les choses à traiter, la situation et les rivaux. Sur
  téléphone, barre de navigation en bas et menu ☰ ; calendrier en liste, courses passées repliées.
- Outils communs : teamById(id) et uciRanking() (moteur) remplacent les recherches et tris répétés.
- Course : plan d'alimentation par étape (normal / renforcé, 3 k€), deux barres en poche par coureur, alerte faim ;
  alliances de poursuite (propositions des IA au joueur, demandes du joueur, relations S.teamRel) ; résumé
  d'étape copiable. Les équipes IA courent exactement comme avant.
- Image de l'équipe (S.image) : six axes nourris par les résultats, estompés chaque hiver ; effets sur les
  demandes salariales et l'acceptation des coureurs du même profil, et sur la renégociation du sponsor.
- Réalisme (audit) : sprint plus ouvert (aléa accru, écarts resserrés au sommet : sprintPeak) ; fatigue
  chronique au-delà de 75 jours de course ; la sélection proposée au joueur suit la même rotation que les IA ;
  gestion de l'effort identique pour coureurs du joueur et de l'IA ; les IA disputent 96 % des courses de
  catégorie 1 ; l'adjoint ne signe plus de salaires que les recettes ne couvrent pas (payrollRoom).
- Vérifications : tests/audit.js (cohérence sur plusieurs saisons, adjoint aux commandes) et tests/ui_auto.py
  (chaque bouton « auto » cliqué pour de vrai, DS automatique en course).
- Équilibrage (v2.1) :
  - Bug majeur corrigé : à égalité de temps, le classement d'une course d'un jour suivait le numéro interne des
    coureurs (ceux du joueur, créés en premier, raflaient les places d'honneur). Départage UCI : somme des places.
  - Effectifs réels : 24 à 28 coureurs par équipe IA, 22 pour le joueur (16 minimum, 30 maximum) ; rotation à
    environ la moitié du calendrier (jours de course : 80 pour le 90e centile, 98 au maximum).
  - Classement UCI par équipes sur les 20 meilleurs coureurs de l'effectif actuel (uciRefresh).
  - Économie IA : budget salarial selon le standing ; le standing suit le classement (80/20 par saison) ;
    signatures, prolongations, transferts et rumeurs limités par les moyens ; dégraissage des équipes trop chères.
  - Charge récente (r.load) : un bloc de courses enchaînées se récupère jusqu'à 35 % moins vite.
  - Climat : régimes météo hebdomadaires persistants (anticyclone, variable, perturbé) selon la période.
  - Économie du joueur recalée sur les nouveaux effectifs (sponsor 52, frais de course 4,5 k€ par jour).
- v5.1 — final immersif et économie de départ :
  - Sprint rejoué : les 450 derniers mètres animés coureur par coureur (lancements, enfermements, prises de tête),
    commentés en direct, puis photo-finish avec les écarts en boyaux et longueurs. « Revoir » et « Passer ».
  - Arrivées en solitaire et en côte rejouées aussi (dernier kilomètre) : l'échappé et l'écart de ses poursuivants,
    l'attaque décisive et ceux qui lâchent prise dans une arrivée en bosse, commentaire adapté à l'écart.
  - Ordres de sprint en direct dans les 4 derniers km : lancer long, attendre, ou prendre la roue d'un rival.
  - Ordres de final en côte (3 derniers km, pour un coureur qui joue la gagne) : attaquer maintenant, attendre la
    fin (paie pour un puncheur explosif, coûte à un pur grimpeur) ou suivre le meilleur grimpeur adverse (marquage :
    gros gain s'il est à portée, explosion s'il est trop fort). Sans ordre, la course ne change pas.
  - Bouton 🤖 Auto pour ces ordres de final : l'adjoint choisit et explique à la radio (sprint : mal placé, dans la
    roue du plus rapide, sinon lancer long ; côte : attendre si explosif, roue du meilleur grimpeur s'il est proche,
    son rythme s'il est un peu plus fort, rien forcer s'il est bien plus fort). Réglé sur des arrivées rejouées :
    +3,3 places en moyenne au sprint, +2,8 en côte, sans perte notable.
  - Sprint recalé : un sprinteur à bout de pointe tombe sous la vitesse du groupe (partir trop tôt se paie), la
    pointe dépend davantage de l'endurance, le vent agit dans le bon sens (face : attendre ; dos : lancer long),
    un coureur collé à un lanceur suit son accélération dans l'aspiration. Lancer long (≈ 280 m) sert l'endurant ou
    le vent de dos, attendre (≈ 170 m) le vent de face ou le finisseur explosif ; aucun ordre ne domine.
  - Écran de course allégé : un seul message à la fois au-dessus des commandes (décision, message, moment fort),
    plus court et fermé d'un toucher ; moments forts des autres équipes espacés ; négociation dans l'échappée et
    pacte dans la page ; réglages de la course (rythme, pauses, DS auto) repliés derrière ⚙.
  - Les équipes de l'ordinateur jouent aussi leurs finals : à 3 km, leur directeur raisonne comme le bouton Auto
    (sprint : roue, lancer long ou attendre selon placement, vent et endurance ; côte : attendre, attaquer, suivre ou
    monter à son rythme), un sur quatre laisse faire l'instinct. Mon équipe en profite quand l'adjoint la dirige
    (DS auto, course confiée) ; un ordre du joueur n'est jamais remplacé.
  - 🎙️ Le résumé du commentateur à la fin de chaque étape : le cadre, l'échappée et qui l'a reprise, les moments
    décisifs, la montée la plus rapide (W/kg), le final, le vainqueur et son compteur de victoires, le maillot de
    leader, et notre équipe. Tournures variées d'une étape à l'autre ; aussi dans le bilan d'une course d'un jour
    confiée à l'adjoint.
  - Le dernier kilomètre des arrivées en côte se court au détail (à la demi-seconde), comme le sprint : allure de
    chacun selon sa forme du jour, réserve explosive (W') pour tenir une roue plus rapide ou attaquer, aspiration
    sous 7 %, lâchés quand la réserve est vide ; le plus fort grimpeur attaque de loin, les puncheurs attendent les
    300 m, les groupes proches courent ensemble (on peut revenir ou être repris). Les ordres « attendre la fin » et
    « suivre » y agissent pour de vrai ; le rejeu montre ce kilomètre (attaques, lâchés, passages en tête).
  - Économie : prime de lancement selon la masse salariale héritée (plus de faillite en saison 1), objectifs du
    sponsor adaptés au rang de l'équipe. Nouveau test `./dev.sh economie`.
- v5.0 — explications, récit, IA de course, sprint simulé, base de données ouverte, une seule interface :
  - Bilan d'étape : pourquoi ils ont lâché, sprint perdu ou gagné (placement, train, lancement, enfermement),
    échappée reprise ou allée au bout, raisons des désobéissances, moments décisifs. Récit des courses confiées à
    l'adjoint. Le film de la saison (Statistiques → Film).
  - Découverte progressive : presse, planification, staff, équipementiers, histoires et académie se débloquent au
    fil de la première saison (l'adjoint s'en charge en attendant).
  - IA : peloton bien désigné dans les finals ; écarts mesurés en temps de passage (justes en montée) ; poursuite
    par projection du point de jonction ; les favoris roulent eux-mêmes derrière l'échappée sur la dernière montée.
  - Sprint simulé au quart de seconde sur le dernier kilomètre ; ordres de sprint (lancement long ou court, dans la
    roue d'un sprinteur adverse).
  - Progression décimale liée à la charge de course ; poids de forme (kilos de l'intersaison, coût en montée) ;
    secteurs pavés de 1 à 5 étoiles.
  - Base de données ouverte : export / import complet (coureurs et caractéristiques, équipes, courses, parcours),
    ajout de coureurs ; parcours réels importés en GPX.
  - Une seule interface (React) ; ≈ 2 080 lignes de l'ancienne interface supprimées ; intégration continue GitHub.
  - Calibration 2 × 60 saisons.
- v4.15 — classiques réalistes et recalibration (40 mesures, dont 7 nouvelles) :
  - Diagnostic : les classiques étaient gagnées par des outsiders (favoris vainqueurs : 6 % sur les monts pavés, 8 %
    dans les Ardennes ; réel ≈ 80-90 %). Les équipes désignaient leur leader sur une seule caractéristique (7 des 10
    meilleurs du parcours couraient en équipiers), l'échappée n'était pas contrôlée, et les favoris s'éparpillaient
    sur les pavés.
  - Classiques d'un jour : favoris et leaders d'après l'aptitude au final du parcours (courseScorer), co-leaders en
    carte libre, sprinteur désigné seulement s'il peut suivre ; contrôle de l'échappée pour la reprendre vers 50 km ;
    les favoris roulent eux-mêmes dans le final ; sélection par le plus fort sur les murs pavés et la dernière côte ;
    les leaders se regardent derrière un favori parti seul ; dernier mur à 14-16 km, côtes ardennaises resserrées.
  - Jours de course : l'IA compte la course à venir (le plus chargé passe de ≈97 à ≈91 jours ; réel 85-89).
  - Jeunes : progression plus rapide jusqu'à 23 ans (2 moins de 23 ans dans le top 20 ; avant 0,5).
  - Chasseurs de maillot de la montagne plus nombreux (70 %).
  - Bilan d'étape : « pourquoi ils ont lâché » (origine du rythme, état du coureur, conseil).
  - Calibration 2×30 saisons : 40/40 sur les deux graines.
- v4.14 — les coureurs du joueur courent d'eux-mêmes. Avant, sans DS automatique, ils attendaient les ordres :
  personne ne chassait, ne suivait, ne profitait d'une bordure (et c'était aussi le cas des coureurs de l'académie
  et de l'équipe du joueur dans le banc de calibrage). Désormais ils jugent la course comme ceux des autres équipes,
  selon leur consigne ; un ordre radio ou une consigne conditionnelle du joueur prime jusqu'à « retour à la
  consigne ». Sans réponse à un appel, le coureur choisit lui-même la bonne option (les caractères marqués suivent
  leur pente) ; une alliance proposée est jugée par les coureurs. Le DS automatique ne fait plus que répondre aux
  appels à la place du joueur. Mesure sur 9 classiques : sans rien toucher, place moyenne 12,4 contre 15,2 avec le
  DS auto (avant : 22 contre 16), au niveau des équipes de l'ordinateur de même force. Sans DS automatique, l'équipe
  du joueur suit exactement la logique d'une équipe de l'ordinateur ; le DS automatique y ajoute ses consignes
  radio. Calibrage 33/33 sur les deux séries (30 saisons).
- v4.13 — chantier de la critique. Clause de leader dans les contrats (offerte par une équipe où tu es parmi les
  trois meilleurs, ou négociée : chance selon statut et agent), offres et transferts d'équipes plus modestes qui
  font de toi leur leader ; en course, la clause fait de toi le leader (ou le sprinteur désigné sur le plat). Talent
  à la création (modeste, prometteur, doué, phénomène). L'argent sert : entraîneur personnel, ostéo et nutritionniste,
  soufflerie, stage privé en altitude, aide au club formateur. Écran Entraînement en deux onglets (Entraînement /
  Corps et staff), menu Plus réduit à quatre entrées (palmarès et génération, image, vie et argent, options et aide).
  Déclin : vérifié contre le monde (même rythme ; âges du top 30 et des retraites réalistes), pas de changement.
  « Moments clés » s'arrête à la distance de la tête de course, cohérente avec l'écran du final.
  Parties jouées : actions du final remontées sous la route (visibles sans défiler), message de course qui s'efface
  seul, étiquettes d'écarts qui ne se chevauchent plus, retour au bureau depuis les messages, écran Vie simplifié
  tant qu'on vit chez ses parents. Talents plus marqués (un « doué » ne tombe plus sur un potentiel de modeste).
  Gérone +12 % d'entraînement, Andorre +6 %. Le moral du coureur revenait deux fois par semaine vers la normale.
  Nouveau test tests/play_react.py : parties jouées par de vrais clics (directeur puis carrière).
- v4.12 — audit de cohérence (carrières complètes simulées de 16 à 36 ans). Corrigé : fatigue de course comptée
  deux fois (forme des pros bloquée vers 50), moral sans retour à la normale (il tombait sous 20), équipier puni
  pour sa place alors qu'il a fait son travail, interviews de « contre-performance » pour un équipier, progression
  des jours de course qui annulait le déclin après le pic, coureur épuisé sélectionné quand même, pro « anonyme »,
  pro qui reste chez ses parents (question du logement au premier contrat), compagne tirée dans les prénoms de
  coureurs, tensions de couple trop rapides, train de vie modeste trop cher pour un néo-pro. Le héros démarre
  parmi les bons cadets de sa région. Guide « Comment ça marche » dans les options du mode carrière.
- v4.11 — mode carrière, passe 7 : fin de carrière et après (moteur 49-career-end.js). Record de l'heure (une
  tentative par saison, niveau de la mer ou altitude), retraite choisie dès 33 ans et imposée à 39, bilan, rêves
  d'enfant accomplis ou non, biographie, reconversion (directeur sportif, fondateur d'équipe, consultant) et
  ouverture du mode directeur : l'équipe (à ton nom si tu la fondes, budget gonflé par tes économies) et ton ancien
  coureur dans les légendes du nouveau monde.
- v4.10 — mode carrière, passe 6 : vie hors vélo (moteur 48-career-life.js, écran Vie). Lieu de vie (parents,
  région, Gérone, Andorre, Monaco : entraînement, forme, impôts, loyer, moral), train de vie, placements de l'épargne,
  dettes qui pèsent sur le moral, couple et enfants, priorité vélo ou famille et tensions dues aux absences, crise de
  couple, naissance pendant une course, l'ami qui monte une marque de vélos.
- v4.9 — mode carrière, passe 5 : réputation (moteur 47-career-rep.js, écran Image). Popularité, relations avec la
  presse, abonnés, style de course déduit de tes courses (attaquant, gagneur, finisseur, équipier de l'ombre),
  déclarations d'après-course (humble, ambitions à tenir, pique au rival, langue de bois), surnom, statut, réseaux
  sociaux (popularité contre polémiques), sponsors personnels (argent contre obligations) et rang parmi les légendes.
  La popularité augmente les salaires proposés et, au-delà de 70, la place dans les sélections pros.
- v4.8 — mode carrière, passe 4 : corps et santé (moteur 46-career-body.js). Hygiène de vie (stricte, normale,
  relâchée), poids visé dès 19 ans (gain en montée contre perte sur le plat, sprint et pavés ; trop maigre = blessures
  et maladies), maladies d'hiver, rééducation prudente ou accélérée avec risque de rechute, déclin modulé par
  l'hygiène, caractère (mental fragile, régulier, équipier modèle, leader né…) qui pèse sur moral, forme et confiance,
  courses des rêves qui motivent. « Demander ma chance » passe par le moteur (type de directeur sportif, confiance,
  forme, caractère). Nouveau test tests/career_impact.js : chaque choix du joueur, joué contre son contraire sur les
  mêmes graines, doit changer le résultat.
- v4.7 — mode carrière, passe 3 : chez les pros (moteur 45-career-team.js, écran Équipe). Directeur sportif
  avec sa personnalité (paternaliste, exigeant, calculateur, joueur) et sa confiance : il juge chaque course
  (consigne respectée, attaque pour soi au lieu d'aider — pardonnée seulement sur un podium —, résultats, panache
  pour le « joueur »), et la confiance pèse sur la sélection et sur la carte libre accordée. Coéquipiers : leader,
  rival interne (même profil, même niveau), amitiés et tensions selon le travail rendu, équipier fidèle qui te suit
  en cas de transfert. Transferts : offres en cours de saison (selon niveau, visibilité, agent, confiance), directeur
  sportif qui change d'équipe et veut t'emmener. Changer de profil : environ deux saisons d'entraînement ciblé.
  Ordres radio du joueur suivis en course (rc.carRadio). Simulation du mode directeur inchangée.
- v4.6 — course plus lisible et écran stable. Ordres expliqués : chaque ordre radio avec ce qu'il fait et ce
  qu'il coûte, regroupés (attaquer, rouler, économiser, ravitaillement) ; sur chaque coureur, sa consigne (et son
  explication), l'ordre radio en cours (annulable d'un tap) et ce qu'il fait en ce moment (mène à bloc, abrité dans
  les roues, en pleine attaque, dans le rouge…) ; boutons du final avec leur effet. Écran stable : hauteurs fixes
  (groupes et radio-course défilent dans leur cadre, graphiques et lignes réservés), cartes des coureurs dans un
  ordre fixe, décisions (appel radio, échappée, alliance) et annonces dans un panneau flottant au-dessus des
  commandes ; seuls l'entrée dans le final et l'arrivée remontent l'écran, une fois.
- v4.5 — mode carrière, passe 2 : les espoirs (19-22 ans). Équipe formatrice, réserve d'une équipe pro ou club
  amateur ; calendrier espoirs de 11 courses (classiques, Ronde, Petite Boucle, Tour de l'Avenir et Mondiaux sur
  sélection nationale, jeunes pros aux grands rendez-vous) ; agent (sérieux, gourmand ou ami de la famille :
  commission, nombre d'offres, salaires) ; stage chez les pros en août (jusqu'à 4 courses pros) ; offres de contrat
  pro, ou une saison espoir de plus ; puis vie de pro : programme de courses décidé par le directeur sportif
  (rotation, Grands Tours aux meilleurs), courses pros en direct (un seul coureur piloté dans le vrai peloton,
  résultats comptés comme les autres), salaire et épargne, renouvellement de contrat. La génération suivie progresse
  chez les espoirs et passe pro chaque hiver. Code : carrière découpée en quatre fichiers (41 à 44), gain
  d'entraînement commun au monde pro et à la carrière (`trainGain`), test `tests/career.js` (./dev.sh carriere),
  formatage de l'interface React ajouté à ./dev.sh fmt. Simulation du mode directeur inchangée.
- v4.4 — mode carrière, passe 1 (moteur 41-career.js, écrans career/) : partie séparée (deux emplacements de
  sauvegarde, passage d'un mode à l'autre sans rien perdre). Création du coureur à 16 ans (nom, nation, caractère,
  profil, gabarit, rêves d'enfant, études) avec potentiel et taille adulte cachés ; croissance jusqu'à 19 ans (chaque
  kilo change le profil) ; cadets puis juniors : calendrier de 8 à 11 courses (régionales, coupe, championnat
  national, internationales, Mondiaux juniors sur sélection), courues en direct (le joueur ne pilote que son
  coureur, toujours obéissant ; ses équipiers suivent le directeur sportif du club, qui fixe les rôles ; on peut
  demander sa chance), simulées ou sautées ; entraînement (plan, volume, blessures, surmenage), études et bac,
  changement de club, génération suivie (classement, duels) qui rejoint ensuite le vivier du monde pro ; le monde pro
  tourne autour (courses dans le Web Worker). Moteur de course : un seul coureur piloté (sim.carId), simulation du
  mode directeur inchangée.
- v4.3 — Histoires (écran 📖, moteur 40-stories.js) : arcs narratifs nés du caractère des coureurs et des
  résultats, avec une décision à prendre (option par défaut à l'échéance de trois semaines) : bête noire (duels
  comptés, rivalité attisée ou non), deux coqs (choisir le leader ou laisser la route décider), la pépite (protéger,
  lancer, prolonger), le vieux lion (tournée d'adieux, saison de plus), l'équipier frustré, la tête brûlée. Effets
  par les leviers existants (moral, discipline, ambition, relations, promesse, envie de partir, contrat, retraite) ;
  hasard propre aux histoires (série de courses inchangée). Histoires visibles dans « À traiter » et la fiche coureur.
- v4.2 — tes vrais noms (Options → « Tes vrais noms ») : équipes (nom, abréviation, couleur), coureurs (prénom,
  nom, recherche), courses (avec retour au nom d'origine). L'historique suit : palmarès, records, mercato, légendes,
  objectifs (moteur : 39-names.js ; les noms de courses sont gardés dans S.names car le calendrier est reconstruit
  chaque saison). Fichier de noms à exporter, modifier sur ordinateur et réimporter (seuls les changements sont
  appliqués ; échange de deux noms d'équipes possible). Simulation identique.
- v4.1 — course en direct au bon rythme : « Rythme auto » (activé par défaut) accélère quand il ne se passe rien
  (×600 en milieu d'étape calme, ×150 pendant la bagarre pour l'échappée, ×45 sur pavés, cols et à l'approche du
  final) et revient instantanément à la vitesse choisie dès un moment fort, un appel ou un souci d'un de vos coureurs ;
  le final garde son ralenti. Moments forts en bandeau flottant au-dessus des commandes, visibles où que l'on soit
  dans la page (vibration brève quand ils concernent votre équipe). Étape d'environ 4 minutes sans rien toucher.
- v4.0 — l'interface React devient le jeu principal (même adresse, mêmes sauvegardes) : derniers morceaux de
  l'ancienne interface convertis (fiche d'une équipe, Mondiaux, pictos d'étapes, difficultés et « Ce qui va décider
  l'étape »). L'ancienne interface ne sert plus que de couche de commandes (mêmes fonctions de jeu).
- v4.0-α8 — chantier moteur, étape 1 (mesure) : profil d'une saison (0,2 s par étape sur serveur ; physique 42 %,
  plans d'équipe 24 %, décisions 14 % ; aucun goulot isolé, micro-optimisations sans gain mesurable, donc non
  gardées). Banc d'essai dans Options (« Vitesse du moteur ») : six étapes d'une partie à part, dans un Web Worker,
  pour mesurer la vitesse réelle de l'appareil. Simulation identique.
- v4.0-α7 — final de course repensé pour le téléphone : dans les 15 derniers km l'écran bascule en mode final
  (décompte, carte des groupes jusqu'à la ligne avec bornes et difficultés, écarts avec tendance ▼/▲, puis « Mes
  cartes pour le final » : la meilleure carte de chaque groupe, deux jauges et 2-3 ordres radio selon la situation,
  dernière réponse radio, ordres d'équipe) ; retransmission, groupes et radio-course repliés. Vibration à l'arrivée.
  Mêmes ordres moteur qu'avant : simulation identique.
- v4.0-α6 — interface React : statistiques (10 onglets : saison en cours ou passée, courses, records, UCI coureurs,
  watts, palmarès, rivaux avec courbe SVG, légendes, bilan, équipes), presse (notoriété, interview, popularité,
  revue de presse), options (sauvegardes, copies de sécurité, mode essentiel, renommage, nouvelle partie, guide),
  écran de démarrage et bulles « premiers pas » convertis en composants. Tous les écrans sont désormais en React.
- v4.0-α5 — interface React : gestion (sponsor et objectifs, finances, staff, historique, adjoint et délégation,
  équipementiers, carrière et offres d'emploi, image de l'équipe) et messages (importants ou tous, marqués lus
  après affichage) convertis en composants.
- v4.0-α4 — interface React : marché (libres, fins de contrat, sous contrat, suivis, mercato ; filtre de profil,
  profils de l'effectif, demande, indemnité, pastilles d'aide à la décision) et académie (espoirs avec charge,
  mentor, programme, entraînement, tests, stagiaires ; calendrier et résultats espoirs ; vivier ; anciens)
  convertis en composants. Bouton « danger » pour les actions irréversibles.
- v4.0-α3 — interface React : calendrier (prochaine action, courses et espoirs, atout de l'équipe, courses
  importantes) et planification de la saison, sélection d'une course (barre d'actions fixée en bas), briefing
  (profil, ce qui va décider l'étape, matériel et ravitaillement, consignes, chrono par équipes, plan de course,
  ordres conditionnels, départ), résultats d'étape (bilan, arrivée, analyse, désobéissances, classements, résumé
  à copier, puissances) et voile de progression des courses confiées à l'adjoint convertis en composants.
- v4.0-α2 — interface React : accueil (prochaine action, à traiter, situation, rivaux, nouvelles), effectif
  (liste triable en cartes sur téléphone ou en tableau complet, plans d'entraînement, demande d'augmentation) et
  fiche coureur (onglets Fiche / Carrière / Palmarès, puissance, actions, négociation avec chance estimée,
  relations, courbe de progression, records) convertis en composants. `src/react/screens/`.
- v4.0-α1 — interface React (en cours, publiée à part ; le jeu principal reste l'interface classique) :
  - `src/react/` (JSX, Tailwind CSS v4, icônes lucide intégrées), assemblé par `./dev.sh react` en
    `dist/react.html` avec esbuild. Le moteur est inclus tel quel (zéro changement de simulation).
  - Converti en composants : en-tête, navigation (barre du bas sur téléphone, onglets sur grand écran), fenêtres,
    course en direct complète (retransmission, profil de l'étape, groupes sur la route, écart, final et
    photo-finish, peloton, mes coureurs avec jauges, négociations, alliances, ordres d'équipe, radio d'un coureur,
    radio-course, commandes de vitesse fixées en bas).
  - Écrans pas encore convertis : affichés par l'ancienne interface dans l'application React (mêmes fonctions,
    mêmes boutons) — rien n'est perdu pendant la conversion. `tests/ui_smoke_react.py` : saison complète sans
    erreur.
- v3.15 — bilan « pourquoi » de la saison et rangement du code (simulation inchangée) :
  - Fin de saison : message et carte « 🔎 Pourquoi la saison » (Stats) — rang et évolution, d'où viennent les
    points (dépendance à un coureur), victoires, objectifs et confiance du sponsor, recettes et dépenses, progression
    de l'effectif, coureurs surchargés (80 jours et plus), position pour la licence. Saisons précédentes repliées.
  - Code rangé par domaine (empreinte identique) : finances, staff et sponsor dans 19-economy ; entraînement des IA
    dans 20-ai-season ; transferts IA dans 26-mercato ; objectifs du sponsor dans 22-goals ; académie dans
    31-academy ; nouveaux fichiers 36-inbox (messages), 37-relations, 38-review (bilans). `tools/split.py` sait
    ajouter à un fichier existant. Carte « Où changer quoi » de docs/ARCHITECTURE.md complétée.
- v3.14 — mode normal plus exigeant sur une longue carrière (équipes IA et calibration inchangées) :
  - Part variable du sponsor réduite (0,15 k€/semaine par point de confiance au lieu de 0,23 ; 0,0015 par point
    UCI au lieu de 0,004) : le succès ne s'autofinance plus aussi vite.
  - Staff 2,5 fois plus cher (100 à 900 k€/an selon le niveau) : renforcer entraîneurs, médecins et recruteurs
    devient un vrai choix économique.
  - Banc de l'adjoint sur 8 saisons : en normal, équipe déléguée 10e-12e (équipes IA voisines 10e-12e ; avant
    5e-6e) ; facile 9e-10e ; difficile ≈16e avec licenciements : il faut gérer soi-même.
- v3.13 — roadmap v4.0, étape 4 : mécaniques visibles (simulation inchangée) :
  - Négociation : chance estimée d'accord et ce qui la compose (salaire et rang de l'équipe, promesse, notoriété,
    image, statut ProTeam, durée, attachement à son équipe), mise à jour en bougeant le curseur ; calculée sur le
    salaire demandé estimé, le seul que voit le directeur sportif (moteur : negoChance, partagée avec negotiate).
  - Course : une crevaison dit le temps perdu et pourquoi (place de la voiture dans la file, dépannage neutre,
    voiture derrière l'échappée, retour à l'abri des voitures) ; bilan d'étape « Ce qui a pesé » (crevaisons,
    chutes, pénalités de mes coureurs).
  - Licence : en ProTeam, chances d'invitation à un Grand Tour et à une grande course (wtInviteOdds).
- v3.12 — roadmap v4.0, étape 3 : l'adjoint (simulation inchangée hors texte des messages) :
  - Nouveau banc `./dev.sh adjoint` (tests/adjoint.js) : partie entièrement déléguée, courses dirigées par
    l'adjoint, comparée aux équipes IA de standing voisin.
  - Constat (corrige le diagnostic précédent, faussé par un banc où l'équipe du joueur ne courait pas) : en
    difficulté normale, l'équipe déléguée finit en moyenne 5e-6e sur 18 (équipes voisines : 11e-12e) et garde
    2 à 4 M€ de réserve ; en difficile, 14e, avec des licenciements. L'adjoint est compétent ; la difficulté
    normale est plutôt généreuse sur une longue carrière.
  - Les rapports de l'adjoint expliquent ses choix : motif d'une augmentation accordée ou refusée, d'une
    prolongation, d'un recrutement (niveau estimé, salaire), coût d'un renfort de staff.
- v3.11 — roadmap v4.0, étape 2 : monde de départ en régime de croisière :
  - À la création, chaque coureur d'équipe reçoit le niveau qu'aurait un coureur du même âge formé par le jeu
    (R.initAge, mesuré sur des parties de 14 saisons) ; ses contrats ont été signés une ou deux saisons plus tôt.
  - Résultat sur 25 saisons (deux graines) : niveau du peloton, nombre de coureurs à 80+ (≈100-120) et masse
    salariale (≈4 500-5 000 k€ par équipe IA) stables dès la première saison. Avant : 36 coureurs à 80+ au départ.
  - Calibration 2×30 saisons : 33/33.
- v3.10 — roadmap v4.0, étape 1 (socle ; aucun changement de simulation, empreinte identique) :
  - `src/engine/00-params.js` : les principaux leviers du moteur réunis et commentés (objet `R`) ;
    `./dev.sh reglages` génère `docs/REGLAGES.md` (ces leviers et l'inventaire des autres constantes).
  - `docs/SOURCES.md` : origine de chaque fourchette de calibration (sourcée, dérivée, estimée, à l'échelle du
    jeu). Correction : abandons par étape de Grand Tour 0,8–2,1 (l'ancienne borne contredisait celle des
    arrivants). Écart relevé : le coureur le plus chargé court ≈97 jours, contre 85-89 en vrai.
- v3.9 — vers une version finale : sauvegardes et longues carrières :
  - Sauvegardes : chargement d'un fichier depuis l'appareil ; import vérifié (une sauvegarde invalide ne touche plus
    la partie en cours) ; si la sauvegarde est illisible au démarrage, reprise automatique à la dernière copie de
    sécurité ; stockage protégé demandé au navigateur ; date du dernier fichier téléchargé dans les options et rappel
    sur l'accueil en début de saison.
  - Partie test de 25 saisons (sans erreur, ≈22 s par saison simulée, sauvegarde compressée < 500 Ko) : le niveau
    du peloton monte les premières saisons puis se stabilise (top 10 ≈86). Les salaires suivent désormais ce niveau
    (S.lvl) : masse salariale stable (±5 %) au lieu de +18 %.
  - Calibration 2×30 saisons : 33/33.
- v3.8 — course de montagne plus réaliste, maillot de la montagne recalé :
  - Diagnostic : les leaders du général se retrouvaient devant dès le début des étapes de montagne (ils suivaient
    toutes les attaques de la bagarre pour l'échappée, et des coureurs du top 10 étaient envoyés dans l'échappée),
    puis raflaient les points des cols intermédiaires.
  - Un leader ne suit plus que les attaques qui comptent : un favori, un rival à moins de 5 min au général, ou tout
    ce qui bouge dans le final. Un coureur du top 10 au général n'est plus envoyé dans l'échappée.
  - Calibration 2×30 saisons : 33 mesures sur 33 dans les plages réelles, pour la première fois. Maillot de la
    montagne gagné par un coureur du top 10 : 0,41 et 0,46 (réel 0,2-0,55 ; avant ≈0,65).
- v3.7 — licence WorldTour qui pèse, maillot de la montagne :
  - Relégation : clause du sponsor (−12 % d'apport), confiance −15, moral −8, les leaders ambitieux font jouer leur
    clause de sortie (aussi dans les équipes IA). Promotion : +8 % d'apport, moral +6. Une ProTeam attire moins les
    coureurs cotés (−5 à −12 points de chance de signature). Dernière saison du cycle : alertes en semaines 20 et 34.
  - Maillot de la montagne : barèmes propres à chaque Grand Tour (Tour : arrivées au sommet doublées ; Giro : gros
    écart pour le premier ; Vuelta : peu de places classées). Le chasseur de maillot se bat pour l'échappée (contre
    jusqu'à 3 min au pied d'une montée) et, repris, se relève pour la suivante : il perd du temps au général. Un
    leader au général ne contre plus dans la première partie d'une étape.
  - Calibration 2×30 saisons : maillot de la montagne gagné par un coureur du top 10 ≈0,65 (avant ≈0,70 ; réel
    ≈0,25-0,55) ; tout le reste dans les plages réelles. Les leaders marquent encore beaucoup dans les cols
    intermédiaires quand la course explose tôt : piste suivante.
- v3.6 — licences WorldTour, file des voitures et commissaires (engine/35-officials.js) :
  - 13 licences WorldTour attribuées sur un cycle de trois saisons (points UCI cumulés) ; relégation ou promotion
    en fin de cycle (moral de l'équipe ±). Les équipes WorldTour vont partout, les 2 meilleures ProTeams de la saison
    sont invitées d'office ; les autres dépendent de la réputation et de la confiance du sponsor.
  - File des voitures : ordre selon le meilleur coureur au général de chaque équipe (classement UCI pour les
    classiques). Une crevaison coûte plus cher quand la voiture est loin dans la file ou le coureur hors du peloton.
  - Commissaires : ravitaillement interdit dans les 20 derniers km (20 s + amende), abri derrière la voiture
    sanctionné parfois (20 s + amende). Pénalités ajoutées au temps à l'arrivée et signalées en course.
  - Interface : statut WorldTour sur l'accueil, classement des licences dans Stats, place de la voiture en direct.
  - Calibration 2×30 saisons : toutes les mesures dans les plages réelles sauf le maillot de la montagne (inchangé).
- v3.5 — interface et aide à la décision (aucun changement de simulation : empreinte identique) :
  - Course en direct : résumé « en bref », peloton toujours affiché, cartes de mes coureurs triées (jauges Fond, Jus,
    Alimentation), radio-course alignée et colorée, ligne de mon meilleur coureur dans le final.
  - Briefing : carte « Ce qui va décider l'étape » (final, grands cols, pavés, vent, météo) et adversaires à surveiller.
  - Résultats d'étape : bilan (meilleur coureur, général, coureurs vidés, abandons, étape suivante), puissances repliées.
  - Accueil (actions pleine largeur), effectif (jauges nommées), marché (badges besoin / prix / âge, profils de
    l'effectif), calendrier (atout de l'équipe), classement UCI (écart à l'objectif du sponsor), gestion (ordre par
    importance, projection des flux réguliers), fiche coureur (terrains de prédilection, grille de saison), messages
    (par semaine, icônes, regroupements), presse, planification (6 courses dépliées, meilleurs candidats), vivier
    (badges). Aides calculées uniquement sur ce que voit le directeur sportif (ui/08-insights.js).
  - Maillot de la montagne : trois pistes testées et abandonnées (chasseurs plus offensifs : échappées trop
    victorieuses ; points des cols intermédiaires réservés aux hommes de tête : sans effet). Les leaders du général
    marquent surtout aux arrivées au sommet : écart toujours ouvert (≈0,73 contre ≈0,3).
- v3.4.1 — code (aucun changement de jeu : empreinte de simulation identique) :
  - `./dev.sh` : check (≈ 1 min, empreinte exacte), test, calib (deux graines en parallèle), impact, prodiges,
    play, profile, accept, fmt. Guide du code : docs/ARCHITECTURE.md.
  - tests/fingerprint.js : deux saisons à graine fixe hachées ; toute optimisation doit la conserver.
  - Fichiers découpés par rôle : 08-stage-sim (boucle), 08b-decide (décisions), 08c-physics-tick (physique,
    incidents), 34-jerseys (maillots) ; interface 04-race (briefing), 04b-live (direct), 04c-results (après l'étape).
  - Petites optimisations sans effet sur les résultats (groupes devant et équipes devant calculés une fois par pas,
    score du peloton calculé une fois par groupe) ; correction d'une erreur de type (téléchargement).
- v3.4 — final des étapes en direct (src/engine/33-finale.js) et maillot de la montagne :
  - Carte « Final » dans les 15 derniers km : compte à rebours (en mètres sous la flamme rouge), ce qui reste à
    franchir (dernière difficulté, secteurs pavés, arrivée en côte ou au sprint), la tête, le peloton et les
    lâchés qui comptent (mes coureurs, favoris) avec leurs écarts, les équipes qui mènent ou roulent, la tendance
    de l'écart tête/peloton et sa projection (« jonction prévue vers 2,3 km », « la tête devrait garder ~12 s »),
    les trois derniers faits marquants.
  - Annonces aux points de passage (10 km, 5 km, 3 km, flamme rouge) avec la situation de course (bandeau et
    radio-course) ; ralenti automatique à 8 km puis à 1,6 km (le joueur peut réaccélérer).
  - Photo-finish : ordre d'arrivée du premier groupe, apparition un par un, écarts lus sur la ligne (un boyau, une
    demi-longueur, une longueur…) pour un sprint, en secondes pour une arrivée en côte, avance du vainqueur en
    solitaire ; mes coureurs déjà arrivés. Rien ne tire au hasard : la course est la même, mieux racontée.
  - Maillot de la montagne : un chasseur de maillot désigné par équipe pour toute la course par étapes (déjà bien
    classé, ou meilleur grimpeur d'une équipe sans ambition au général), qui prend l'échappée dès qu'il y a des
    cols. Mesure toujours trop haute (0,72-0,73 contre ~0,3 en réalité) : les leaders du général ramassent les
    places restantes dans les groupes d'élite et les arrivées au sommet.
- v3.3 — « bon à jouer » :
  - Délégation des courses (src/engine/32-delegate.js) : « Confier à l'adjoint » une course, ou « Confier jusqu'à »
    la prochaine course importante (Grands Tours, monuments, Mondiaux ; étoile ☆/★ du calendrier pour en ajouter ou
    en retirer). L'adjoint sélectionne, donne les consignes, règle matériel, ravitaillement et plan, dirige la
    course comme les DS IA (calcul dans le Worker, progression affichée, arrêt possible après la course en cours).
  - Mode essentiel (nouvelle partie, cochée par défaut ; Options) : l'adjoint règle matériel, ravitaillement, plan,
    presse, staff et équipementiers ; les réglages restent accessibles, repliés.
  - Course en direct : bouton 🎬 « moments clés » (avance rapide jusqu'au final ou à un événement de l'équipe).
  - Messages : regroupés quand le même sujet revient la même semaine ; onglets Importants / Tous ; pastilles et
    « choses à traiter » ne comptent que les importants.
  - Fin de saison : moments forts (plus belles victoires) et coureur de la saison dans le bilan du sponsor.
  - Sauvegarde : copie de sécurité automatique avant chaque fin de saison (trois dernières, restaurables dans
    Options), téléchargement d'un fichier ; historique des courses allégé au-delà de cinq saisons.
  - Noms courts uniques parmi les coureurs en activité.
  - Moteur : attentisme des poursuivants (« on ne roule pas pour les autres » : sur un parcours accidenté,
    quand plusieurs équipes ont intérêt à chasser, chacune laisse parfois les autres rouler quelques minutes) ;
    final des classiques pavées qui explose (les meilleurs spécialistes à bloc dans les derniers 35 %) et pavés
    qui usent davantage ceux qui ne savent pas y rouler ; les leaders ne disputent plus les points de la montagne
    aux sommets intermédiaires. Mesure du maillot de la montagne recalée sur le réel (Grands Tours 2019-2025 :
    environ 6 vainqueurs sur 21 dans le top 10 du général) : 0,60-0,71 dans le jeu, encore trop haut.
  - tests/playthrough.py : une saison jouée comme un joueur dans le navigateur (~45 s de calcul, ~300 actions
    dont ~200 pour les étapes des courses importantes dirigées une à une).
- v3.2 — intelligence des directeurs sportifs (IA et boutons auto, même raisonnement) :
  - Avant l'étape (autoOrders) : situation au général de chaque leader (gcSituation : rang, retard, avance,
    étapes clés restantes, encore jouable ou non) ; façon de courir du leader (leaderAtt) : à l'abri sur les
    étapes de transition, maillot qui contrôle quand son avance est confortable, attaque de loin quand il faut
    reprendre du temps avec peu d'étapes clés ; sprinteurs au gruppetto en montagne ; grimpeurs équipiers
    préservés sur les étapes de transition qui précèdent la montagne ; « relais devant » (un équipier dans
    l'échappée pour un leader qui joue le podium en Grand Tour) ; équipe sans leader au général : chasse aux étapes,
    parfois avec son meilleur grimpeur dans l'échappée.
  - Plan de course selon le général (aiPlan) : le maillot contrôle l'échappée (en lui laissant une marge, bien plus
    large si elle ne menace pas le général), un prétendant en retard fait durcir les dernières étapes de montagne.
    Le bouton « Plan auto » du joueur suit le même raisonnement.
  - En course (dsBrain, le même cerveau pour l'IA et le DS automatique du joueur) : placement avant pavés et vent,
    marquage du rival direct au général dans le final, leader en jour sans qui monte à son rythme, relais devant
    qui se relève pour son leader, coureurs qui mangent, échappée condamnée qui se relève (seulement si elle n'a plus
    que quelques secondes, loin de l'arrivée, face à un peloton qui roule). Les radios de l'IA ne s'affichent pas.
  - Boutons « Consignes auto » et « Tout régler en auto » : le message explique les choix du DS.
  - Tenue dans la durée : au-delà de ~25 kJ/kg de travail dans la journée, la puissance s'érode (moins chez les
    endurants) ; les échappés qui ont beaucoup roulé faiblissent dans le final. Mesure du risque de chute
    (st.risk) ; tests/impact.js plus robuste (cibles fixées, même hasard hors course, plusieurs mondes).
  - Calibrage 33/33 sur deux séries de 30 saisons.
- v3.1 — prodiges, poids des caractéristiques et des choix, académie et interface :
  - Jeunes : 2,5 % de prodiges (plafond 86-89, déjà parmi les bons pros à 20-21 ans), 6 % de pépites précoces
    (82-86) ; plafond de tout jeune limité à 90, révélations tardives à 89 ; un talent précoce sur quatre plafonne
    entre 21 et 23 ans. Vedettes du monde initial surtout confirmées (23-34 ans). tests/prodigies.js : 2 à 5
    coureurs de 23 ans et moins dans le top 20 (réel 2-5), meilleur niveau ≤ 90.
  - tests/impact.js : expériences appariées croisées (même monde, même hasard) ; chaque caractéristique change le
    résultat sur son terrain, chaque choix testé du joueur a un effet (reconnaissance, ravitaillement, équipiers
    au service du leader, coureur gardé au chaud, entraînement, entraîneurs).
  - Moteur, pour que tout pèse : position dans le peloton = rang réel (pas de place pour tous devant, le placement
    la défend) ; secteurs pavés plus sélectifs en seconde moitié de course ; descentes techniques où les moins bons
    descendeurs perdent le contact ; réserves sous 60 % qui coûtent plus cher (l'endurance compte sur les longues
    étapes) ; récupération qui règle la fatigue accumulée d'une étape à l'autre ; abri des équipiers pour le
    leader et le sprinteur (jusqu'à ~5 % d'effort en moins sur le plat) ; reconnaissance utile aussi sur les pavés ;
    placement plus important au sprint ; aux sommets intermédiaires, les leaders ne disputent pas les points.
  - Académie : juniors (17-18 ans, 4 courses dont un Mondial) séparés des espoirs (19-22 ans) ; cartes par jeune
    avec un volet « Gérer » ; libérer un jeune depuis sa carte.
  - Interface : textes d'explication repliés (ℹ️), marges et boutons plus grands, tri par liste déroulante,
    effectif affiché sur le vrai maximum (30). Aide : ce que fait chaque caractéristique.
- Académie (v3.0) — src/engine/31-academy.js :
  - Calendrier espoirs de 8 rendez-vous (courses de club, Ronde des Espoirs en 4 étapes, championnats nationaux,
    Tour de l'Avenir en 6 étapes, Mondial), simulés par le vrai moteur de course : l'académie court sous les
    couleurs du joueur face au vivier et à des clubs espoirs (coureurs créés pour la course puis effacés) ;
    championnats, Avenir et Mondial en sélections nationales (U23 des équipes pros compris), où un espoir peut ne
    pas être retenu. Jours de course comptés à part, ni victoire pro ni point UCI ; pas de records de puissance.
  - Stagiaires : à partir d'août (semaine 31), 3 espoirs de 19 ans et plus peuvent courir avec les pros
    (auparavant, tout espoir de 18 ans pouvait courir chez les pros toute la saison).
  - Maturité des jeunes (précoce, normale, tardive ; quelques pépites précoces) ; tests physiques
    (profil de puissance 5 s / 1 min / 5 min / 20 min, VO2max) qui révèlent la maturité et affinent le potentiel.
  - Mentors (coureur de l'équipe de 27 ans et plus, deux espoirs au plus) : progression +10 à 20 %, moral,
    discipline. Surmenage : au-delà d'une charge de courses selon l'âge, moral et potentiel s'érodent.
  - Concurrence : les équipes pros signent en cours de saison des pré-contrats avec les jeunes du vivier qui
    brillent, et approchent les espoirs de l'académie après un résultat (départ possible en fin de saison).
  - Réputation de l'académie (résultats espoirs, réussite des anciens) : les plus grands talents refusent une
    académie peu réputée. Onglets Courses espoirs et Anciens. L'adjoint gère aussi mentors, tests, stagiaires, charge.
- Moteur (v3.0) — maillots : les prétendants aux maillots de la montagne et des points se dépensent pour passer
  en tête aux sommets et aux sprints intermédiaires ; l'IA envoie son prétendant à la montagne dans l'échappée.
  Nouvelle mesure : le maillot de la montagne revient à un coureur du top 10 du général dans 72-73 % des cas
  (réel 30-75 %). Ambitieux non sélectionnés : mécontents seulement s'ils étaient disponibles et peu utilisés,
  un message au plus toutes les six semaines (auparavant à chaque grande course, ce qui minait le moral).
- Vérifié (v3.0) : calibrage 33/33 sur deux séries de 30 saisons, 6 saisons enchaînées, tous les tests.
- Moteur (v2.6) — ententes entre coureurs IA :
  - Dans une échappée d'une course par étapes, un leader IA ambitieux au général (top 30) peut s'entendre avec
    un chasseur d'étapes d'une autre équipe : l'un roule pour le général de l'autre, qui lui laisse l'étape.
    Accord plus probable si le chasseur n'est pas sûr de battre le leader au final ; refusé si son propre leader
    est en difficulté derrière. Trahisons possibles à l'arrivée, annoncées à la radio-course.
  - Nettoyage : formatage uniforme (prettier), aucun code mort hors simulateRaceAuto (outil des tests).
  - Vérifié : calibrage 32/32 sur 30 saisons, 6 saisons enchaînées sans incident (multi_seasons), tous les tests.
- Course en direct (v2.5) — radio vivante et négociations (src/engine/30-radio.js) :
  - Appels radio : un coureur demande une décision (« je suis à bloc », « il ne passe plus ses relais »,
    « j'ai de bonnes jambes, j'y vais ? »). Une question à la fois, affichée sous la télé ; sans réponse en
    6 minutes de course, le coureur décide seul selon son caractère ; le DS automatique répond aussitôt.
  - Échappée : demander à tous de rouler (refus si un leader ou un sprinteur attend derrière) ; pactes
    « je roule pour ton général, tu me laisses l'étape » (ou l'inverse), proposés par un adversaire ambitieux
    au général ou par le joueur. À l'arrivée, celui qui s'est engagé laisse passer son partenaire ; un adversaire
    peut trahir (plus souvent les têtes brûlées et les gagneurs), un refus vexe (il ne relaie plus 20 min),
    rompre un pacte coûte cher dans les relations entre équipes.
  - Tests : features (pacte à l'arrivée, décision du coureur sans réponse, réponse du DS auto),
    ui_auto (carte d'appel radio cliquée pour de vrai).
- Moteur (v2.4) — consolidation :
  - L'échappée se disperse dans la dernière montée : les meilleurs grimpeurs durcissent dès le pied et une grosse
    échappée de montagne (plus de 14 coureurs) s'attaque dans le final au lieu d'arriver groupée.
  - Jour sans : en plus de la forme du jour, 3 à 7 % de capacité en moins (1 à 3 minutes perdues en montagne).
  - Un leader ne roule plus derrière un grimpeur déjà loin au général (course par étapes) : les échappées
    d'arrivée au sommet arrivent au pied avec une vraie avance.
  - Banc de calibrage : référence sur 30 saisons (erreur type divisée par 1,7) ; 32/32 mesures sur deux séries
    de 30 saisons. Résultats d'un sous-processus écrits en entier avant de sortir (gros volumes).
- Moteur (v2.3) — formation de l'échappée :
  - Bataille pour l'échappée : chaque étape a une taille d'échappée cible (plat 2–5, montagne de GT 14–30, hors GT 7–16,
    pavés 5–12). Tant que le bon coup n'est pas parti, les équipes qui n'y ont personne roulent, les contres font la
    jonction et les attaquants isolés se relèvent ; l'échappée est « partie » quand elle atteint sa taille avec de l'avance,
    ou au plus tard à 15–35 % de l'étape.
  - Le peloton n'est plus confondu avec une grosse échappée contenant des favoris.
  - Calibrage : 32 mesures dans les fourchettes réelles (taille médiane de l'échappée en montagne de GT : 11 à 16).
- Moteur (v2.2) :
  - Hasard par étape : stageSeed(saison, course, étape) ; sélections IA et parcours ont aussi leur série.
    Une étape se rejoue à l'identique avec les mêmes choix ; les menus ne changent plus le déroulement des courses.
  - Physique de la vitesse (05-physics) : la vitesse calibrée vaut pour des conditions de référence ; la puissance
    (gravité + roulement + air) recalcule la vitesse selon l'altitude et la température (densité de l'air), le vent
    dans l'axe de la route (orientation par tronçons de 10 km), les pavés et la pluie (roulement), et limite la vitesse
    en descente selon sa technicité. Watts affichés calculés dans les mêmes conditions.
  - Physiologie : « allumettes brûlées » (chaque passage dans le rouge ralentit la recharge de W').
  - Descentes : technicité par descente (0,2 à 1) ; vitesse maximale et risque de chute en dépendent, pluie aggravante.
  - Tactique : intérêt des attaques (attackUtility : chance de tenir, valeur, fraîcheur) ; stratégie sur la course par
    étapes (leaders économisés sur les étapes de transition, attaque de loin quand il reste peu de grandes étapes) ;
    « isoler le maillot » ; lutte de placement (avant une difficulté, remonter un gros peloton coûte des forces).
  - Départages : maillots à égalité de points départagés au général (classOrder), jamais par numéro.
  - Courses simulées dans un Web Worker (même résultat qu'en direct ; repli par étapes si indisponible).
  - Tests : tests/bias.js (invariance numéros / ordre des équipes), tests/ui_worker.py ; banc de calibrage élargi
    (taille des échappées, abandons sur Grand Tour, jours de course) : 31 mesures dans les fourchettes réelles.

