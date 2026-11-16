/* Réglages du jeu : les principaux leviers de la simulation, regroupés et commentés.
   Chaque valeur a été réglée pour que la calibration (tests/calibrate.js, 33 mesures comparées au cyclisme réel)
   reste dans les plages réelles. Modifier une valeur change la simulation : ./dev.sh check puis ./dev.sh calib.
   Les tables de données (archétypes, courses, barèmes) restent dans 02-data.js et 04-calendar.js ;
   docs/REGLAGES.md liste aussi toutes les autres constantes nommées du moteur. */
const R = {
  // --- Monde et progression ---
  // vitesse de progression d'un coureur selon son âge (décalé selon l'âge de pic de son profil) : [âge max, facteur]
  progAge: [
    [20, 1.3],
    [23, 1],
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
  formeRate: 0.22, // part de l'écart à la forme visée comblée chaque semaine
  daysCap: 75, // jours de course au-delà desquels la forme plafonne plus bas (fatigue chronique)
  daysMalus: 0.15, // points de forme visée perdus par jour de course au-delà

  // --- Économie ---
  salary: { base: 25, k: 0.35, exp: 2.4, youngMul: 0.7 }, // salaire = base + k × (note − 60)^exp (k€/an), × youngMul avant 24 ans
  lvlRef: 77.3, // niveau de référence du peloton (moyenne des 200 meilleurs, fin de première saison)
  lvlK: 0.75, // part de la hausse du niveau du peloton retranchée de la note pour fixer un salaire
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
  leaderFollow: 0.8, // chance qu'un leader suive une attaque qui compte (0,95 s'il court défensif)
  leaderFollowDef: 0.95,
  leaderFollowIdle: 0.03, // … et une attaque qui ne compte pas (bagarre pour l'échappée)
  rivalGap: 300, // un attaquant à moins de 300 s au général est un rival qu'on suit
  breakTry: 0.1, // chance par pas de temps qu'un candidat à l'échappée attaque (× baroud / 72)
  hunterTry: 0.6, // idem pour le chasseur du maillot de la montagne (× max(baroud, montagne) / 72)
  hunterBridge: 180, // le chasseur part en contre tant que l'échappée a moins de 180 s
  hunterShare: 40, // % des équipes sans ambition au général qui désignent un chasseur de maillot
  hunterMon: 77, // note de montagne minimale du chasseur
  sitUpPace: 0.74, // allure d'un chasseur relevé (part de la capacité médiane du groupe)
};
