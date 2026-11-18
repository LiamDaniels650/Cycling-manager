/* Réglages du jeu : les principaux leviers de la simulation, regroupés et commentés.
   Chaque valeur a été réglée pour que la calibration (tests/calibrate.js, 33 mesures comparées au cyclisme réel)
   reste dans les plages réelles. Modifier une valeur change la simulation : ./dev.sh check puis ./dev.sh calib.
   Les tables de données (archétypes, courses, barèmes) restent dans 02-data.js et 04-calendar.js ;
   docs/REGLAGES.md liste aussi toutes les autres constantes nommées du moteur. */
const R = {
  // --- Monde et progression ---
  // vitesse de progression d'un coureur selon son âge (décalé selon l'âge de pic de son profil) : [âge max, facteur]
  progAge: [
    [20, 1.45],
    [23, 1.2],
    [26, 0.55],
    [29, 0.2],
    [99, 0.03],
  ],
  // monde de départ : points ajoutés aux coureurs des équipes selon leur âge, pour qu'il ressemble d'emblée à un
  // peloton formé par le jeu (mesuré sur des parties de 14 saisons : les coureurs de 23-33 ans y valent 2 à 4 points
  // de plus qu'à la création, les tout jeunes un peu moins) : [âge max, points]
  initAge: [
    [19, -4],
    [20, -1.5],
    [21, 1.2],
    [22, 1.7],
    [24, 2.5],
    [30, 3.2],
    [33, 3],
    [99, 3.3],
  ],
  youngGapMax: 1.6, // jusqu'à 22 ans, multiplicateur maximal de progression selon la marge au plafond (1,2 ensuite)
  winterKg: 1.8, // kilos pris à l'intersaison (1 pour un coureur régulier), reperdus à l'entraînement et en course
  kgClimb: 0.013, // perte de capacité par kilo au-dessus du poids de course, dans les fortes pentes
  formeRate: 0.22, // part de l'écart à la forme visée comblée chaque semaine
  daysCap: 75, // jours de course au-delà desquels la forme plafonne plus bas (fatigue chronique)
  daysMalus: 0.15, // points de forme visée perdus par jour de course au-delà
  daysSlackAI: 8, // un coureur IA ne court pas plus de la moitié des jours de course de la saison, plus 8

  // --- Économie ---
  salary: { base: 25, k: 0.35, exp: 2.4, youngMul: 0.7 }, // salaire = base + k × (note − 60)^exp (k€/an), × youngMul avant 24 ans
  lvlRef: 77.3, // niveau de référence du peloton (moyenne des 200 meilleurs, fin de première saison)
  lvlK: 0.75, // part de la hausse du niveau du peloton retranchée de la note pour fixer un salaire
  startPayRef: 2400, // nouvelle partie : masse salariale (k€) au-delà de laquelle le sponsor verse une prime de lancement
  sponsorBase: 52, // apport du sponsor principal (k€ par semaine)
  // part variable de l'apport du sponsor (k€ par semaine) : modeste, comme les primes de résultats d'un vrai contrat
  // (réglée pour qu'une équipe entièrement déléguée finisse en moyenne au niveau des équipes IA voisines en normal)
  sponsorConf: 0.15, // par point de confiance du sponsor
  sponsorUci: 0.0015, // par point UCI de la saison
  raceDay: 4.5, // coût d'une journée de course (k€), avant difficulté

  // --- Licence WorldTour ---
  wtN: 13, // licences WorldTour (sur 18 équipes)
  wtCycle: 3, // saisons par cycle d'attribution
  wtDown: { conf: -15, spons: 0.88, moral: -8 }, // relégation : confiance, apport du sponsor (×), moral de l'effectif
  wtUp: { conf: 10, spons: 1.08, moral: 6 }, // promotion
  wtExit: { p: 0.45, amb: 60, ov: 72 }, // clause de sortie d'un leader d'une équipe reléguée : chance, ambition et note minimales
  wtSign: { star: -0.12, good: -0.05 }, // chance de signature en moins pour une ProTeam (coureur ≥ 75, ≥ 71)

  // --- Commissaires ---
  feedKm: 20, // ravitaillement interdit dans les derniers km
  feedPen: 20, // pénalité (s)
  feedFine: 1, // amende (k€)
  shelterPen: 20, // abri derrière les voitures : pénalité (s)
  shelterFine: 0.5, // et amende (k€)
  shelterSeen: 0.3, // chance d'être vu par les commissaires

  // --- Course ---
  sprintNoise: 4.5, // aléa du sprint (placement, timing, jambes du jour)
  sprintVk: 0.1, // sprint simulé : vitesse de pointe (m/s) gagnée par point de qualité de sprint (16,6 m/s à 75)
  sprintSpread: 0.8, // … mètres de retard sur la tête au dernier km par point de placement manquant (0-100)
  sprintDraft: 0.45, // … gain de vitesse (m/s) dans la roue d'un coureur à moins de 6 m (×1,6 vent de face)
  sprintFade: 0.7, // … perte de vitesse (m/s par s) une fois la pointe tenue (≈ 10 s)
  sprintSpent: 1.2, // … un sprinteur à bout de pointe tombe sous la vitesse du groupe (m/s) : lancer trop tôt se paie
  leaderFollow: 0.8, // chance qu'un leader suive une attaque qui compte (0,95 s'il court défensif)
  leaderFollowDef: 0.95,
  leaderFollowIdle: 0.03, // … et une attaque qui ne compte pas (bagarre pour l'échappée)
  rivalGap: 300, // un attaquant à moins de 300 s au général est un rival qu'on suit
  breakTry: 0.1, // chance par pas de temps qu'un candidat à l'échappée attaque (× baroud / 72)
  hunterTry: 0.6, // idem pour le chasseur du maillot de la montagne (× max(baroud, montagne) / 72)
  hunterBridge: 180, // le chasseur part en contre tant que l'échappée a moins de 180 s
  hunterShare: 85, // % des équipes sans ambition au général qui désignent un chasseur de maillot
  hunterMon: 77, // note de montagne minimale du chasseur
  sitUpPace: 0.74, // allure d'un chasseur relevé (part de la capacité médiane du groupe)
  // classiques d'un jour : les équipes des favoris contrôlent l'échappée (écart toléré = (km restants − catchKm) × gapKm s)
  classicCatchKm: 50, // classique : l'échappée matinale doit être reprise vers 50 km de l'arrivée…
  classicGapKm: 3, // … l'écart toléré diminuant de 3 s par km
  classicChaseMax: 11, // rouleurs engagés au plus dans la poursuite (7 sur une course par étapes)
  classicLeaderKm: 45, // … et dans les derniers km, les favoris sans équipier devant roulent eux-mêmes derrière l'échappée
  classicLeaderWork: 0.86, // intensité du relais d'un favori derrière l'échappée
  classicHardKm: 90, // … et dans les côtes de leurs derniers km, le groupe des favoris monte au rythme des meilleurs
  classicClimbPace: 0.9, // côtes du final : allure (part de la capacité du 15e centile le plus fort du groupe)
  courseSprintW: 0.45, // aptitude au parcours d'une classique à arrivée plate : poids de la pointe de vitesse (sprint du groupe)
  classicCoLeaders: 2, // classique : équipiers au plus gardés en « carte libre » s'ils valent presque le leader…
  classicCoGap: 2.5, // … à moins de 2,5 points d'aptitude au final du parcours
  cobbleBlowN: 12, // final d'une classique pavée : seul un groupe d'au moins 12 coureurs est dynamité par le plus fort
  murPace: 1.1, // mur pavé dans le final d'une classique : allure du plus fort du groupe (part de sa capacité)
  lastClimbPace: 1.07, // dernière côte d'une classique accidentée : allure du plus fort du groupe des favoris
  murFollow: 0.99, // pour suivre une attaque sur un mur pavé, il faut 99 % de la capacité de l'attaquant (95 % ailleurs)
  murAttack: 1.2, // envie d'attaquer d'un leader sur un mur pavé du final (0,6 sur un secteur pavé plat)
  classicMarking: 65, // % du temps où un leader « se regarde » au lieu de chasser un favori parti seul (final de classique)
  mtnChaseK: 0.65, // montagne : marge laissée à l'échappée (écarts mesurés en temps de passage, plus justes en montée)
  summitChaseK: 0.5, // … et pour une arrivée au sommet, marge laissée par les favoris qui visent l'étape
  mtnLeaderGap: 180, // dernière montée d'une étape : les favoris roulent eux-mêmes derrière une échappée à moins de 180 s
  flatChaseK: 0.85, // équipes de sprinteurs : marge laissée à l'échappée (part de l'écart toléré d'origine)
  sprintCatchKm: 8, // poursuite des équipes de sprinteurs : reprendre l'échappée vers 8 km de l'arrivée…
  chaseAhead: 2, // … une équipe en avance sur cet objectif (vitesse de reprise > 1,4 × nécessaire) lève le pied
  chaseBehind: 0.7, // … en retard (< 0,7 × nécessaire), elle accélère et engage un rouleur de plus
  noWorkAhead: 0.7, // classique : allure d'un groupe de tête où personne ne relaie (part de la capacité médiane)
};
