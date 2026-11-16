# Directeur Sportif : analyse du moteur et du jeu

*Analyse du 16/11/2026, mise à jour après l'ajout des sources (`src/`, `tests/`, `docs/`).*

## Méthode

- Lecture du moteur (`src/engine/00` à `49`). La physique, la simulation d'étape, les décisions des coureurs, l'IA tactique et le sprint ont été lus en détail. La saison, l'économie, le mercato et la carrière ont été survolés.
- Exécution du moteur dans Node sur 1 à 16 saisons complètes avec plusieurs graines : profils CPU, vainqueurs par terrain, vitesses, écarts, abandons, sauvegardes, biais.
- Lancement de toute la chaîne de vérification du projet : `./dev.sh check`, `./dev.sh test` (fonctionnalités, non-régression, biais, audit, interface dans Chrome), `tests/career.js`. Comparaison avec la calibration de référence (`tests/baseline/calibrage.txt`, 33 mesures comparées au cyclisme réel).

---

## 0. Ce qui a été corrigé ou ajouté (branche `claude/sports-manager-engine-analysis-ubxbgp`)

| Changement | Effet sur la simulation |
|---|---|
| **7 erreurs de types corrigées.** `./dev.sh check` annonçait des erreurs TypeScript sans échouer. | Aucun (empreinte identique) |
| **`./dev.sh check` échoue vraiment** si le lint, les types ou l'empreinte échouent. Le `| tail -1` masquait le code de retour. | — |
| **Bilan d'étape : « Pourquoi ils ont lâché »** (détail ci-dessous) | Aucun : lecture seule, sans hasard (empreinte identique) |
| **Test de biais corrigé.** Le mode B renumérotait les coureurs du joueur sans reporter leurs relations ni la connaissance qu'on a d'eux. Le « biais » de −2,8 places venait du test, pas du moteur. 10 graines par défaut au lieu de 6, qui donnaient des fausses alertes. | — |
| `index.html` reconstruit depuis les sources, `package-lock.json` versionné | — |

**Nouvelle fonctionnalité de jeu.** Quand un coureur du joueur perd le contact, le moteur relève :
- l'origine du rythme : attaque de X, tempo imposé par telles équipes, pavés, sélection par les grimpeurs, final ;
- l'état du coureur : intensité, réserve d'attaque, fond, fringale, efforts dans le rouge, jambes du jour.

Le bilan d'étape l'explique pour les leaders, sprinteurs, cartes libres et le meilleur de l'équipe, avec un conseil. Exemple :

> F. Wolf a perdu le contact à 36,2 km de l'arrivée (pente 8,0 %), sur le tempo imposé par ALP, PDO.
> Le rythme dépassait ses moyens du jour (123 % de sa capacité). Facteurs : mauvaises jambes ce jour-là.
> 💡 Normal pour un sprinteur dans une telle montée : l'important est de finir dans les délais.

Le conseil s'adapte : renforcer l'alimentation, économiser avant le moment décisif, ou demander à ses propres équipiers de ne plus rouler quand ce sont eux qui ont lâché le coureur.

État final des vérifications : lint et types sans erreur, empreinte identique, `features.js` tout bon (3 nouvelles vérifications), audit sans incohérence, interface React sans erreur JavaScript, biais absent sur 10 et 16 graines, carrière tout bon.

---

## 0 bis. Recalibration (deuxième passe)

**Résultat : 40 mesures sur 40 dans les plages réelles, sur les deux graines de référence (2 × 30 saisons).** Le calibrage comptait 33 mesures. J'en ai ajouté 7, avec leurs sources dans `docs/SOURCES.md` :
- victoires en solitaire dans les classiques (`solo_flandres_1j`, `solo_ardennes_1j`, `solo_paves_1j`) ;
- classiques gagnées par un favori d'avant-course (`favori_flandres_1j`, `favori_paves_1j`, `favori_ardennes_1j`) ;
- sprints massifs gagnés par le meilleur sprinteur présent (`sprint_meilleur`).

### Le défaut trouvé : les classiques étaient gagnées par des outsiders

| Classiques | Gagnées par un favori, avant | Après | Réel 2016-2025 |
|---|---|---|---|
| Flandriennes (monts pavés) | 6 % | **69-82 %** | ≈ 90 % |
| Pavées (type Roubaix) | 25 % | **75-92 %** | ≈ 90 % |
| Ardennaises | 8 % | **50-57 %** | ≈ 70-80 % |
| Victoires en solitaire, flandriennes | 40-44 % | **63-75 %** | 50-85 % (Flandres 7/10) |
| Victoires de l'échappée matinale (au sens strict) | jusqu'à 25 % | **0-10 %** | ≈ 5 % (Hayman, Roubaix 2016) |

Les causes, trouvées en suivant les courses groupe par groupe :
1. **Les équipes désignaient mal leurs leaders.** Le leader était choisi sur une seule note (« Pavés » ou « Collines »). Sur les 10 meilleurs coureurs du parcours, 7 avaient une consigne d'équipier. *Correction* : dans une classique, le leader est le meilleur sur le final du parcours (pentes, pavés, pointe de vitesse si l'arrivée est plate), et jusqu'à deux équipiers presque aussi forts gardent leur carte (co-leaders). Un sprinteur n'est désigné que s'il peut suivre sur ce parcours. Les favoris de la course (`sim.favs`), que l'IA utilise pour ses décisions, sont calculés de la même façon.
2. **Personne ne contrôlait l'échappée.** Les équipes des favoris la laissaient prendre 6 à 10 minutes et ne roulaient qu'à 40 km de l'arrivée. *Correction* : contrôle progressif pour la reprendre vers 50 km, jusqu'à 11 rouleurs engagés. Les favoris sans équipier devant roulent eux-mêmes dans les 45 derniers km.
3. **Une échappée qui ne relaie pas roulait aussi vite qu'un peloton en chasse.** *Correction* : dans une classique, un groupe de tête où personne ne relaie se relève.
4. **La sélection du final était mal réglée.** Sur les pavés, chaque groupe de 6 coureurs ou plus était dynamité par son plus fort, ce qui éparpillait les favoris. Les côtes, elles, ne triaient rien. *Correction* : seuls les gros groupes sont dynamités ; sur les murs pavés et la dernière côte, le plus fort impose son rythme et on ne suit plus dans sa roue. Derrière un favori parti seul, les autres leaders « se regardent ».
5. **Les parcours n'étaient pas réalistes.** Le dernier mur pavé tombait à 25-30 km de l'arrivée (Paterberg : 13 km), et les côtes ardennaises s'arrêtaient à 35 km. *Correction* : dernier mur à 14-16 km, côtes resserrées dans le final.

### Autres corrections de cette passe
- **Jours de course.** Le plus chargé du peloton courait 97 jours, contre 85 à 89 dans la réalité. Un coureur juste sous la limite partait sur un Grand Tour et la dépassait de 20 jours. L'IA compte maintenant la course à venir : on tombe à environ 91 jours.
- **Prodiges.** Le test `prodigies.js` échouait déjà avant mes changements, avec 0,5 moins de 23 ans dans le top 20 contre 2 à 5 en réalité. Les jeunes progressent maintenant plus vite jusqu'à 23 ans, les plus doués davantage encore : on obtient 2,0, avec un prodige à 86 à 20 ans, et le meilleur niveau reste plafonné à 88.
- **Maillot de la montagne.** Il était gagné trop souvent par un coureur du top 10 du général (0,5 à 0,6, contre 0,24 réel). Plus d'équipes envoient maintenant un chasseur de maillot dans les échappées (70 %) ; on revient à 0,43-0,51.

Les courses par étapes ne sont pas touchées directement : toutes les nouvelles règles de course ne s'appliquent qu'aux courses d'un jour. Tous les réglages sont dans `src/engine/00-params.js` et `docs/REGLAGES.md` (régénéré). L'équipe entièrement déléguée finit toujours au niveau des équipes IA voisines (rang moyen 11,1 contre 11,0 sur 3 graines).

**Limite qui reste** : les Ardennes sont dans la plage réelle (≥ 50 %), mais à son bas. Ces courses finissent souvent au sprint d'un groupe de puncheurs, et le pas de 30 s ne permet pas de modéliser finement la sélection du dernier kilomètre (voir P1 ci-dessous).

---

## 1. Verdict global

Pour un jeu de gestion de cyclisme dans un navigateur, **le moteur est remarquablement riche et, surtout, bien outillé** :
- physiologie moderne : puissance critique et réserve anaérobie avec recharge de Skiba, durabilité, fringale, altitude, chaleur ;
- physique réelle : air, vent par tronçons, pavés, descentes ;
- IA tactique détaillée ;
- hasard reproductible pour chaque étape ;
- **empreinte de simulation** qui garantit qu'une optimisation ne change rien ;
- **40 mesures de calibration (33 à l’origine), toutes dans les plages réelles**, dont les vitesses, les écarts en Grand Tour, le taux de victoires d'échappée selon le terrain (4 % sur le plat, 40 % en vallonné, 48 % en montagne), les abandons en Grand Tour et le nombre de victoires du meilleur coureur.

Peu de jeux du genre, commerciaux compris, ont ce niveau de rigueur.

Après lecture des sources, les vraies limites sont :
1. **La résolution des finals** : un pas de 30 s, et un sprint réglé par une formule de score.
2. **Le comportement repose sur des seuils et des probabilités réglés à la main.** La calibration les tient en équilibre, mais chaque nouveau comportement coûte cher à régler.
3. **L'ampleur et l'ouverture du monde** : 18 équipes fictives, pas de base de données modifiable.

---

## 2. Corrections par rapport à ma première analyse

J'avais travaillé sur le seul fichier compilé. Les sources et la calibration corrigent trois points :

- **Le poids du coureur (ancienne priorité P1, revue à la baisse).** C'est exact : la vitesse vient des notes et non des watts, et la physique utilise une masse fixe. Mais les notes représentent déjà l'aptitude **sur un terrain donné** : « Montagne » joue le rôle du W/kg en montée, « Plat » et « CLM » celui des watts absolus. Le mélange selon la pente (`terrStat`) traduit le passage du rouleur au grimpeur. Le poids existe déjà par profil et sert là où il compte : réserve anaérobie, sprint avec vent de dos, affichage des watts. Passer à un moteur « watts → vitesse » serait une refonte lourde avec recalibration complète, pour un gain de jeu modeste. **Ce n'est pas une priorité.** Cela ne deviendrait intéressant que pour gérer un poids de forme (régime, prise de poids).
- **Victoires d'échappée et abandons.** Je les jugeais non mesurés ou trop rares. La calibration les mesure, et ils sont dans le réel : échappées selon le terrain, 1,2 abandon par étape de Grand Tour, 79 % de coureurs à l'arrivée. Mes chiffres mélangeaient les classiques et les courses par étapes.
- **Écarts en Grand Tour.** Ils sont dans le réel sur 30 Grands Tours : 10ᵉ à 12 min en médiane.

---

## 3. Moteur : ce qui reste à améliorer

### 🔴 P1. Résolution fine dans les finals
Le pas de 30 s (`DT_MIN`) correspond à environ 375 m sur le plat. C'est parfait pour 90 % de l'étape, mais trop grossier pour une attaque à la flamme rouge ou un sprint.
- **Pas adaptatif** de 5 à 10 s dans les 3 derniers km et dans la fin de la dernière montée. **Attention** : plusieurs minuteries comptent en pas et non en minutes (`burst`, `noMerge`, `waitCD`). Il faut d'abord les convertir en temps, puis vérifier l'empreinte et la calibration.
- **Sprint simulé** dans les 1 500 derniers mètres au lieu de la formule de `finishGroup` (`09-stage-finish.js`) : désagrégation du train, moment du lancement, sillage, enfermement. Cela ouvrirait des ordres de jeu (« lance à 250 m », « prends la roue de X »). Les indicateurs « enfermé », « parti trop tôt » et « train perdu » existent déjà et serviraient de base.

### 🟠 P2. Remplacer des seuils par des estimations
La poursuite suit des règles du type « (km restants − 15) × 5,5 s » (`teamChaseLevel1`). Il serait plus juste de **prédire la jonction** à partir des vitesses réelles des groupes et des rouleurs disponibles. `finale.js` calcule déjà une projection d'écart pour l'affichage : il suffirait de la réutiliser dans l'IA. Les attaques gagneraient à généraliser `attackUtility` : chance estimée de tenir jusqu'à l'arrivée multipliée par l'enjeu.

### 🟡 P3. La définition du « peloton » (mesurée, laissée telle quelle)
Le « peloton » est le groupe qui compte le plus de favoris, mais seulement s'il a au moins 10 coureurs. Quand les favoris se retrouvent à moins de 10 dans le final, le groupe de derrière devient « le peloton » et celui des favoris est traité comme une échappée. Mesure : **2,9 % des pas, dans 45 % des étapes, presque uniquement dans les finals**. C'est assez réaliste (une sélection de favoris court comme un groupe de tête), et la calibration est réglée avec ce comportement : je ne l'ai pas modifié. Il gonfle en revanche les kilomètres « en tête » des favoris, qui servent au prix de la combativité. À corriger le jour où ce prix compte.

### ✅ P4. Mesures des classiques : fait (voir 0 bis)

### 🟡 P5. Progression par points entiers
`trainGain` ajoute +1 point avec une certaine probabilité. Garder une valeur décimale cachée lisserait la progression d'une semaine à l'autre. Cela change la simulation : à faire avec `./dev.sh prodiges` et la calibration. La vitesse de progression des jeunes a déjà été recalée (voir 0 bis).

### 🟡 P7. Bruit de mesure de la calibration
Avec 30 saisons, une mesure qui porte sur 60 à 120 courses (les classiques) a une incertitude d'environ ±0,05. Une mesure proche d'une borne peut donc basculer d'une exécution à l'autre sans que rien n'ait changé. Pour les classiques, `./dev.sh calib 60` donnerait des verdicts plus stables, pour un temps doublé.

### ⚪ P6. Performances : pas de priorité
Il faut environ 105 ms par étape, soit 17 s par saison, dans un Web Worker. Le profil montre un coût réparti dans `tickPhysics`, `tickTeamPlans` et `decideRider`, sans goulot unique. Un gain de 20 à 30 % est possible avec beaucoup de micro-optimisations délicates. Ce n'est utile que pour un mode « simuler 20 saisons ».

---

## 4. Côté jeu

### Points forts
- Contenu très dense : WorldTour avec promotions et relégations, sponsor, staff, centre de formation, matériel, reconnaissance, ravitaillement, commissaires, presse, relations entre coureurs, histoires, Mondiaux, **mode carrière de coureur complet**, **délégation à l'adjoint**.
- Consignes expressives : rôles, styles d'attaque, radio, ordres conditionnels, alliances de poursuite. Le DS automatique utilise le même cerveau que l'IA.
- La désobéissance (discipline, ambition, relations) donne de la personnalité aux coureurs.

### À améliorer
1. **Expliquer encore plus**. C'est commencé avec « Pourquoi ils ont lâché ». La même logique pourrait s'étendre aux sprints perdus (les indicateurs existent), aux échappées reprises (« reprise à 4 km : AVE et ALP ont roulé à 3 ») et aux désobéissances (« il voulait sa chance : ambition 85, relation tendue avec le leader »).
2. **Décider dans les finals** : cela dépend de la priorité moteur P1.
3. **Base de données ouverte et éditeur** (équipes, coureurs, courses, parcours, import GPX). C'est ce qui fait durer PCM depuis 20 ans. L'export de noms existe déjà.
4. **Découverte progressive des systèmes** : avec plus de 50 systèmes, il faut débloquer staff, matériel et relations au fil des saisons.
5. **Interface** : deux interfaces coexistent, React et l'ancienne en chaînes HTML. La nouvelle explication n'est branchée que sur l'interface React, qui est le jeu principal selon le README.

---

## 5. Feuille de route conseillée

| Ordre | Chantier | Effort | Effet |
|---|---|---|---|
| ✅ | Classiques réalistes (favoris, solos, échappées) ; jours de course ; prodiges | — | Fait |
| 2 | Explications étendues : sprints, échappées reprises, désobéissances | Faible | Fort (jeu) |
| 3 | Minuteries en temps, puis pas adaptatif dans les finals | Moyen | Fort |
| 4 | Sprint simulé avec ordres de timing | Moyen-élevé | Fort |
| 5 | IA de poursuite fondée sur la projection de jonction | Moyen | Fort |
| 6 | Base de données ouverte et éditeur | Moyen-élevé | Durée de vie |
| 7 | Progression décimale | Faible | Confort |

---

## 6. Comparaison avec Pro Cycling Manager 26, côté moteur

Ce que PCM 26 annonce de neuf : un mode « Simulation détaillée » qui fait tourner le moteur 3D sans affichage ; une forme du jour plus liée aux caractéristiques, avec Tour Focus et Classics Focus ; des rôles de saison ; des courses notées de A à D ; le mode Pro Cyclist ; un affichage des groupes plus clair.

| Aspect | Directeur Sportif | PCM 26 | Avantage |
|---|---|---|---|
| Granularité | Groupes, pas de 30 s, placement abstrait | Chaque coureur dans l'espace 3D, en temps réel | **PCM** (sprints, placement, chutes en chaîne) |
| Physiologie | CP/W′, durabilité, allumettes, fringale, altitude, chaleur, froid, jours sans | Jauges d'énergie et d'effort, forme du jour | **Directeur Sportif** |
| Physique | Air, vent par tronçons, pavés, descentes, pluie ; vitesse dérivée des notes par terrain | Non publiée | Égalité |
| Sprint | Formule de score (placement, train, vent, enfermement) | Trains simulés en 3D | **PCM** |
| IA tactique | Cerveau de DS explicite : contrôle, durcir, attentisme, coopération, pactes, chasseurs de maillot, désobéissance | Réputée inégale (échappées, poursuites) | **Directeur Sportif** sur l'intention tactique |
| Validation | **40 mesures comparées au réel**, empreinte, tests de biais | Non publiée | **Directeur Sportif** |
| Reproductibilité | Une graine par étape | Non | **Directeur Sportif** |
| Vitesse de simulation | ~0,1 s par étape, une saison en ~17 s | Temps réel, ou simulation détaillée | **Directeur Sportif** |
| Ampleur du monde | 18 équipes, 37 courses, monde fictif | Base réelle, modding | **PCM** de loin |
| Planification | Pics de forme, altitude, planificateur, délégation | Rôles de saison, Tour/Classics Focus | Égalité |

**Mon avis** : sur le cœur de la simulation, ton moteur est au niveau de PCM et le dépasse sur la physiologie, la lisibilité de l'IA et surtout la **validation** : aucun PCM ne publie une calibration contre le réel. Les deux jeux font un choix différent. PCM simule chaque coureur dans l'espace, alors que le tien simule des groupes intelligents, ce qui est cohérent avec un jeu de gestion jouable sur téléphone. Pour rivaliser vraiment, il reste **le final au mètre près** (sprints et attaques), et surtout **l'ampleur et le modding**, qui relèvent du contenu et des outils plus que du moteur.

### Sources
- [Pro Cycling Manager 26, Steam](https://store.steampowered.com/app/3936530/Pro_Cycling_Manager_26/)
- [Pro Cycling Manager 26, Cyanide Studio](https://cyanide-studio.com/en/cyanide-games/pro-cycling-manager-26/)
- [Pro Cycling Manager 26, Epic Games Store](https://store.epicgames.com/p/pro-cycling-manager-26-82a91d)
- [Pro Cycling Manager 26, Green Man Gaming](https://www.greenmangaming.com/games/pro-cycling-manager-26-pc/)
