# Directeur Sportif : analyse du moteur et du jeu

*Analyse du 16/11/2026, faite sur `index.html` (commit `12dbfa2`, ~21 500 lignes).*

## Méthode

- Lecture du moteur (`src/engine/00` à `49`, environ 14 600 lignes dans le build). La physique, la simulation d'étape, les décisions des coureurs, l'IA tactique et le sprint ont été lus en détail. La saison, l'économie, le mercato et la carrière ont été survolés.
- **Exécution réelle du moteur hors navigateur** (Node 22), sans l'interface, sur 1 à 5 saisons complètes avec plusieurs graines. J'ai relevé les temps de calcul, un profil CPU, les vainqueurs par type d'étape, les vitesses, les écarts en Grand Tour, les abandons et la taille des sauvegardes.
- L'interface n'a pas été évaluée visuellement. Ce document porte sur le moteur et la conception du jeu.

> ⚠️ **Point important** : le dépôt ne contient que le fichier compilé `index.html`. Les sources (`src/engine/*.js`, `src/ui/*.js`), `tests/calibrate.js`, `dev.sh` et `docs/REGLAGES.md` sont cités dans le code mais absents du dépôt. Il faudrait les pousser : sans eux, aucune revue de code, aucun historique utile et aucune intégration continue ne sont possibles.

---

## 1. Verdict global

Pour un jeu de gestion de cyclisme qui tourne dans un navigateur, **le moteur est remarquablement riche et sérieux**. Il intègre une physiologie moderne (puissance critique CP/W′ avec recharge de Skiba, durabilité en kJ/kg, « allumettes brûlées », fringale et ravitaillement, altitude, chaleur, froid). La physique est réelle : densité de l'air, vent dans l'axe par tronçons de 10 km, roulement sur les pavés, limites de vitesse en descente selon la technicité et la pluie. L'IA tactique va loin : bagarre pour l'échappée, coopération et pactes, « on ne roule pas pour les autres », chasseurs de maillot, désobéissance. Le hasard est **reproductible par étape**, et le code annonce une **calibration sur 33 mesures réelles**.

Ses faiblesses tiennent surtout à trois choses :
1. Le modèle est **hybride**. La vitesse vient des notes du coureur, et les watts sont recalculés ensuite. Le poids du coureur ne change donc rien à sa vitesse en montée.
2. La résolution est **grossière dans les finals** : pas de 30 s, et un sprint réglé par une formule de score.
3. Le comportement dépend de **centaines de constantes et de probabilités par pas**, réglées à la main. L'équilibre obtenu est fragile.

---

## 2. Moteur : ce qui marche (mesuré)

Mesures sur 3 saisons (468 étapes, graine 4242) :

| Type d'étape | Vainqueurs (archétype) | Vitesse médiane | Groupe du vainqueur (médiane) |
|---|---|---|---|
| Plat | sprinteur 90 % | 45,3 km/h | 68 coureurs |
| Vallonné | sprinteur 29 %, complet 24 %, rouleur 15 %, puncheur 13 % | 42,5 | 3 |
| Punch | puncheur 42 %, complet 24 % | 42,1 | 1 |
| Montagne | complet 54 %, grimpeur 46 % | 38,4 | 2 |
| Arrivée au sommet | grimpeur 65 %, complet 35 % | 38,2 | 1 |
| Pavés | rouleur 58 %, flahute 25 % | 45,7 | 2 |
| CLM / CLM par équipes | complet/rouleur | 51,6 / 58,5 | — |

- Les **hiérarchies par terrain sont crédibles**, et les vitesses tombent dans les plages réelles de 2024-2025.
- La **diversité est bonne** : 127 vainqueurs différents sur 468 étapes. Le meilleur coureur gagne environ 15 étapes par saison, ce qui ressemble à une domination de type « Pogačar » sans être écrasant.
- En Grand Tour, le 2ᵉ finit entre 15 s et 6 min. C'est réaliste et la lutte reste ouverte.
- **Performances correctes** : environ 105 ms par étape, 17 s pour une saison complète de 37 courses, calculée dans un Web Worker.
- **Sauvegarde robuste** : IndexedDB compressée, repli sur localStorage, élagage d'urgence. Elle pèse environ 600 Ko après une saison et environ 1 Mo après cinq, avec une croissance maîtrisée.

---

## 3. Moteur : améliorations, par priorité

### 🔴 P1. Passer d'un modèle « note → vitesse » à un modèle « note → watts → vitesse »
`speedOf` (index.html:4762) transforme un niveau L (tiré des notes) en vitesse. La physique (`physSpeed`, :4819) ne fait que corriger cette vitesse selon les conditions du jour, et elle utilise une **masse fixe de 78 kg** (`PHY`, :4776). Les watts affichés (`riderWatts`) sont calculés **après coup**.
- **Conséquence** : un grimpeur de 58 kg et un rouleur de 80 kg ayant la même note de montagne montent à la même vitesse. Le W/kg affiché est décoratif.
- **Proposition** : faire dériver de chaque note un seuil en W/kg et une réserve W′ propres au coureur, puis laisser `speedFor` calculer la vitesse avec sa vraie masse et son CdA (le gabarit compte sur le plat et dans le vent). Toute l'infrastructure existe déjà (`powerAt`, `speedFor`, `wbalStep`). C'est le changement qui apporterait le plus de cohérence et de profondeur : poids de forme, gabarits, rouleurs lourds face aux grimpeurs légers.
- **Coût** : recalibration complète, à faire avec `tests/calibrate.js`.

### 🔴 P2. Résolution plus fine dans les finals
Un pas de 30 s (:6442) correspond à environ 375 m sur le plat. C'est bien pour 90 % de l'étape, mais trop grossier pour un final de côte, une relance ou un sprint.
- **Pas adaptatif** : 5 à 10 s dans les 3 derniers km, dans les 2 derniers km d'une montée finale et pendant une attaque (`burst`).
- **Sprint simulé plutôt que tiré au sort** : `finishGroup` (:7648) calcule un score (note de sprint, bruit de 4,5, placement, train, vent). Il faudrait simuler les 1 500 derniers mètres : train qui se désagrège relais après relais, moment du lancement, sillage, enfermement. Les ordres du joueur (« lance à 250 m », « prends la roue de X ») deviendraient alors possibles. C'est le point où PCM garde l'avantage (voir § 6).

### 🟠 P3. Remplacer les seuils écrits à la main par des estimations
Presque tous les comportements sont des règles du type `if (gap < 240 && energy > 25 …)` ou des probabilités `rnd() < p * dtMin` (:7000, :7076…). Le rythme du peloton sans rouleur, par exemple, vaut « médiane des capacités × 0,64 » (:7208).
- **Poursuite** : les seuils `(kmLeft − 15) × 5,5 s` (:5910) suivent la règle « 1 min tous les 10 km ». Il serait plus juste de **prédire le point de jonction** à partir des vitesses réelles des groupes et des capacités des rouleurs disponibles, puis de décider d'après le gain attendu (« si on roule à 0,88 avec 3 hommes, on rentre au km X »). L'IA saurait alors gérer une échappée de puncheurs face à une échappée de rouleurs, ou le vent de face dans le final.
- **Attaques** : `attackUtility` (:6145) va dans le bon sens. Il faudrait la généraliser : chance estimée de tenir jusqu'à l'arrivée (W′bal, écart, coopération derrière) multipliée par la valeur (étape, général, maillots).
- **Ranger toutes les constantes dans `R`** (00-params) avec leur plage réelle. C'est déjà commencé, mais `decideRider` et `tickPhysics` contiennent encore des dizaines de nombres en dur.

### 🟠 P4. Mesures et réalisme des scénarios
- **La victoire d'échappée n'est pas mesurée** par le moteur. `brkIds` n'est rempli que si l'échappée atteint sa taille cible. Selon la mesure que j'ai utilisée, le taux varie de 0 à 80 % en montagne, donc impossible de conclure. Il faudrait l'ajouter à la calibration : en réalité, environ 5–10 % sur le plat, 30–40 % en vallonné et 40–50 % en haute montagne de Grand Tour.
- **Définition du « peloton »** (:6491+) : c'est le groupe qui compte le plus de favoris, mais seulement s'il a au moins 10 coureurs. Quand le groupe des favoris tombe sous 10, le gruppetto peut devenir « le peloton ». Cela fausse `ahead`, les écarts annoncés et certaines décisions.
- **Abandons trop rares** : 0,2–0,3 % par coureur et par étape (mesuré). La réalité tourne autour de 0,5–0,7 % en Grand Tour, et les classiques sont bien plus sélectives, car les équipiers s'arrêtent une fois leur travail fait. Ajouter des abandons tactiques, la maladie qui progresse sur 3 semaines et les délais d'élimination.
- **Écarts en Grand Tour un peu larges certaines années** : le 10ᵉ finit entre 10 et 42 min (Ronde Ibérique de la saison 1 : 42 min). Surveiller le rythme du gruppetto et la récupération sur 3 semaines.

### 🟡 P5. Progression des coureurs
`trainGain` (:8488) ajoute **+1 point entier avec une probabilité donnée**. La progression se fait par paliers et reste très aléatoire à court terme. Il vaudrait mieux garder des valeurs décimales cachées (`r.sx`) et n'afficher que l'arrondi. On pourrait aussi faire dépendre le gain de la **charge réelle** (kJ et intensité accumulés en course, que le moteur calcule déjà) plutôt que du seul plan choisi.

### 🟡 P6. Performances (si vous voulez simuler beaucoup)
Profil CPU : `simStep`, `tickPhysics` et `tickTeamPlans` prennent environ 46 % du temps, le ramasse-miettes environ 6,5 %. Une `Map` et des tableaux triés sont recréés pour chaque groupe à chaque pas. On peut viser un gain de 2 à 3× en réutilisant les tampons, en triant une fois par pas et en remplaçant les `filter`/`every` dans la boucle. Ce n'est pas urgent : c'est utile pour des simulations de 20 saisons ou un mode « simulation détaillée » à la PCM.

---

## 4. Côté jeu

### Points forts
- **Contenu très dense** : 37 courses par saison, licences WorldTour avec promotions et relégations, sponsor avec niveau de confiance, staff, centre de formation, matériel, reconnaissance des parcours, ravitaillement et commissaires, presse, relations entre coureurs, histoires, Mondiaux et titres nationaux. Il y a aussi **un mode carrière de coureur complet** (9 modules : U23, pro, corps, réputation, vie, fin de carrière).
- **Consignes de course expressives** : 8 rôles, 3 styles d'attaque, radio (attaque, jonction, chasse, tempo, marquage…) et **ordres conditionnels**. Le DS automatique utilise le même « cerveau » que l'IA, ce qui garantit l'équité.
- **Délégation à l'adjoint**, avec un arrêt automatique avant les courses importantes. C'est excellent pour le rythme d'une saison.
- La **désobéissance** (discipline, ambition, relations) donne de la personnalité aux coureurs.

### À améliorer
1. **Lisibilité des mécaniques.** Le moteur calcule beaucoup de choses invisibles (W′bal, allumettes, nourriture, placement, abri de l'équipe). Il faudrait montrer **pourquoi** un résultat est arrivé : « lâché parce que W′ à 12 % et intensité à 1,08 », ou « sprint perdu : enfermé, placement 58 ». Un rapport d'après-course qui explique les causes vaudrait plus que des fonctionnalités supplémentaires.
2. **Peu de décisions en course pendant le final.** Avec des pas de 30 s, le joueur ne peut pas vraiment jouer le timing d'une attaque ou d'un sprint (voir P2). C'est pourtant le moment le plus fort d'un jeu de DS.
3. **Monde fictif fermé** : 18 équipes, environ 600 coureurs. Il faudrait **un format de base de données ouvert** (JSON importable ou exportable : équipes, coureurs, courses, parcours) et un éditeur. L'export de noms existe déjà. C'est ce qui fait vivre PCM depuis 20 ans : la communauté refait les bases réelles.
4. **Éditeur de parcours.** Les profils sont générés (`buildProfile`). Pouvoir dessiner ou importer une étape (GPX → pentes, secteurs, cols) serait un gros atout.
5. **Économie à surveiller** : en délégation complète, le budget de mon équipe test a fait +482, −281 puis +195 k€. C'est sain, mais les marges sont faibles. Il faut vérifier qu'une équipe gérée prudemment ne se retrouve pas bloquée.
6. **Risque de surcharge** : avec plus de 50 systèmes, l'arrivée dans le jeu est critique. Il faudrait débloquer les systèmes progressivement (staff, matériel, relations au fil des saisons).

### Technique et outillage
- **Pousser les sources, les tests et les scripts dans le dépôt.** Mettre en place une intégration continue qui lance la calibration à chaque modification : avec autant de constantes, c'est la seule protection contre les régressions d'équilibre.
- **L'interface mélange deux approches** : un bundle React de 466 Ko et du HTML en chaînes injecté via `dangerouslySetInnerHTML` (21 fois). À terme, il faudra en garder une seule.
- L'état global (`var S`, `_sd`) reste acceptable puisque le moteur tourne aussi dans un Worker. Le moteur gagnerait pourtant à devenir un module ES importable : tests unitaires, outils, version serveur.

---

## 5. Feuille de route conseillée

| Ordre | Chantier | Effort | Effet |
|---|---|---|---|
| 1 | Sources, tests et calibration dans le dépôt, avec intégration continue | Faible | Indispensable |
| 2 | Mesures supplémentaires : % de victoires d'échappée, abandons, définition du peloton | Faible | Réalisme |
| 3 | Rapport d'après-course qui explique les causes | Moyen | Fort (côté jeu) |
| 4 | Pas adaptatif dans les finals et sprint simulé, avec ordres de timing | Moyen-élevé | Fort (moteur et jeu) |
| 5 | Modèle « watts → vitesse » avec masse et CdA propres à chaque coureur | Élevé | Très fort (profondeur) |
| 6 | IA de poursuite fondée sur la prédiction de jonction | Moyen | Fort |
| 7 | Base de données ouverte et éditeur (coureurs, équipes, parcours, GPX) | Moyen-élevé | Durée de vie |
| 8 | Optimisation ×2–3 et mode « simulation de N saisons » | Moyen | Confort |

---

## 6. Comparaison avec Pro Cycling Manager 26, côté moteur

Ce que PCM 26 annonce de neuf : un mode **« Simulation détaillée »**, qui fait tourner le moteur 3D sans affichage pour des résultats rapides et précis ; une forme du jour plus liée aux caractéristiques, avec **Tour Focus / Classics Focus** ; des rôles de saison (leader principal, leader secondaire, équipier) ; des courses notées de A à D ; le mode Pro Cyclist ; un affichage des groupes plus clair. Sources plus bas.

| Aspect | Directeur Sportif | PCM 26 | Avantage |
|---|---|---|---|
| Granularité | Groupes, pas de 30 s, placement abstrait (0–100) | Chaque coureur dans l'espace 3D, en temps réel | **PCM** (sprints, placement, chutes en chaîne) |
| Physiologie | CP/W′ (Skiba), durabilité kJ/kg, allumettes, nourriture/fringale, altitude, chaleur, froid, jours sans | Jauges d'énergie et d'effort classiques, forme du jour | **Directeur Sportif** : plus moderne et plus proche de la science du sport |
| Physique | Densité de l'air, vent par tronçons, roulement sur pavés, descentes et pluie, mais **vitesse dérivée des notes, masse fixe** | Physique interne non publiée | Égalité : votre modèle est plus explicite, mais l'hybride limite son intérêt (P1) |
| Sprint | Formule de score à la ligne | Trains et placement simulés en 3D | **PCM** |
| IA tactique | Cerveau de DS explicite : contrôle, durcir, attentisme, coopération, pactes, chasseurs de maillot, désobéissance | IA réputée inégale : échappées et poursuites souvent critiquées par la communauté | **Directeur Sportif** sur l'intention tactique ; à confirmer par des mesures (P4) |
| Reproductibilité | Une graine par étape : une étape se rejoue à l'identique | Non | **Directeur Sportif** (débogage, équilibrage, défis entre joueurs) |
| Vitesse de simulation | ~0,1 s par étape, saison complète en ~17 s | Temps réel, ou « simulation détaillée » plus lente | **Directeur Sportif** |
| Calibration | 33 mesures comparées au réel (selon le code) | Non publiée | **Directeur Sportif** (si les tests sont versionnés) |
| Ampleur du monde | 18 équipes, 37 courses, monde fictif | Base réelle, des centaines d'équipes et de courses, modding | **PCM** de loin |
| Planification de saison | Pics de forme, altitude, planificateur, délégation | Rôles de saison, Tour/Classics Focus (nouveau en 26) | Égalité sur les concepts |

**Mon avis** : sur le **cœur de simulation** (physiologie, logique tactique, reproductibilité, calibration, vitesse), ton moteur rivalise avec PCM et le dépasse même par endroits. PCM simule chaque coureur dans l'espace, alors que ton moteur simule une **course de groupes intelligents**, plus proche d'un « Football Manager du vélo ». C'est un vrai choix de conception, cohérent avec un jeu de gestion jouable dans un navigateur.

Pour vraiment rivaliser, il reste trois chantiers :
1. **Rendre la physique causale** (P1) : le poids et le gabarit doivent compter.
2. **Un final fin** (P2) : sprints et attaques au mètre près, là où PCM brille.
3. **L'ampleur et le modding** : c'est le vrai fossé, mais il relève du contenu et de l'outillage plus que du moteur.

### Sources
- [Pro Cycling Manager 26, Steam](https://store.steampowered.com/app/3936530/Pro_Cycling_Manager_26/)
- [Pro Cycling Manager 26, Cyanide Studio](https://cyanide-studio.com/en/cyanide-games/pro-cycling-manager-26/)
- [Pro Cycling Manager 26, Epic Games Store](https://store.epicgames.com/p/pro-cycling-manager-26-82a91d)
- [Pro Cycling Manager 26, Green Man Gaming](https://www.greenmangaming.com/games/pro-cycling-manager-26-pc/)
