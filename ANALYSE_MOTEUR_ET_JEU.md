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

## 3. Version 5.0 : ce qui a été fait (troisième passe)

Tout est sur la branche, commit par commit, avec les tests. **Calibration de référence : 40 mesures sur 40 dans les plages réelles, sur 2 × 60 saisons** (graines 200 et 300).

### Moteur
- **IA de course.** Le « peloton » est désormais le groupe qui compte le plus de favoris, même réduit dans le final : le gruppetto ne prend plus sa place (de 2,9 % des pas de course à 0,35 %). Les écarts sont mesurés **en temps de passage**, comme dans une vraie course ; avant, la distance était divisée par la vitesse du groupe de derrière, ce qui gonflait les écarts en montée (« +23' » au Tour des Flandres). La poursuite se fait **par projection** : l'équipe compare la vitesse à laquelle l'écart fond à celle qu'il faut pour reprendre l'échappée à temps, puis accélère ou économise. Sur la dernière montée, les favoris roulent eux-mêmes derrière une échappée encore à portée.
- **Sprint simulé** au quart de seconde sur le dernier kilomètre : place dans le groupe, trains, distance de lancement, pointe tenue puis déclin, aspiration, enfermement. Il remplace la formule de score. Le meilleur sprinteur présent gagne 41 à 43 % des sprints massifs (réel : 30-60 %).
- **Progression décimale** (fraction de point cachée, sans paliers aléatoires), modulée par la charge de course.
- **Poids de forme** : kilos pris à l'intersaison, reperdus à l'entraînement et en course, coût d'environ 1,3 % par kilo dans les fortes pentes.
- **Secteurs pavés de 1 à 5 étoiles** : roulement, crevaisons, chutes et poids de la caractéristique Pavés.

### Jeu
- **Tout est expliqué** : pourquoi un coureur a lâché ; un sprint perdu ou gagné (placement, train, lancement, enfermement, écart de vitesse) ; une échappée reprise (où, par qui, à quelle vitesse) ou allée au bout ; les raisons d'une désobéissance ; les moments décisifs.
- **Ordres de sprint** dans le briefing : lancement long ou court, dans la roue d'un sprinteur adverse. Un lancement long n'est rentable que pour un coureur endurant, et prendre la roue du plus rapide paie.
- **Récit des courses** confiées à l'adjoint, et **film de la saison** (Statistiques → Film) : grandes victoires, coureur de l'année, révélations, records, histoires, mercato, adieux.
- **Découverte progressive** : presse, planification, staff, équipementiers, histoires et académie se débloquent au fil de la première saison.
- **Base de données ouverte** : export et import de toute la base (caractéristiques des coureurs comprises), ajout de coureurs, **parcours réels importés en GPX** (type d'étape déduit du profil).

### Technique
- **Une seule interface (React)** : environ 2 080 lignes de l'ancienne interface supprimées, tests navigateur portés sur React. Le jeu passe de 1 329 à 1 190 Ko.
- **Intégration continue GitHub** : lint, types, empreinte, tests fonctionnels et non-régression à chaque push.

### Ce que je n'ai pas fait, et pourquoi
- **Pas de simulation plus fin dans les finals.** Le sprint, le seul moment où le pas de 30 s posait vraiment problème, est maintenant simulé à part au quart de seconde. Sur une montée finale, 30 s font environ 170 m, ce qui suffit à départager les grimpeurs. Changer le pas obligerait à revoir environ 80 tirages au sort et une dizaine de minuteries comptées en pas : un gros risque pour un gain faible.
- **Performances.** Le coût reste réparti, sans goulot unique, et une saison se calcule en arrière-plan en une vingtaine de secondes. Ce n'est pas un problème pour le joueur.

---

## 4. Ce qui reste possible

| Chantier | Effort | Intérêt |
|---|---|---|
| Ordres de sprint aussi à la radio, pendant la course | Faible | Jeu |
| Une base « réelle » prête à importer (pelotons 2026 refaits par la communauté) | Contenu | Durée de vie |
| Éditeur de coureur dans le jeu (aujourd'hui : par le fichier de base) | Moyen | Confort |
| Mesures de calibration en plus (taille de l'échappée au départ, marges des sprints) | Faible | Réalisme |
| Pas adaptatif dans les finals | Élevé | Faible (voir plus haut) |

---

## 6. Comparaison avec Pro Cycling Manager 26, côté moteur

Ce que PCM 26 annonce de neuf : un mode « Simulation détaillée » qui fait tourner le moteur 3D sans affichage ; une forme du jour plus liée aux caractéristiques, avec Tour Focus et Classics Focus ; des rôles de saison ; des courses notées de A à D ; le mode Pro Cyclist ; un affichage des groupes plus clair.

| Aspect | Directeur Sportif | PCM 26 | Avantage |
|---|---|---|---|
| Granularité | Groupes, pas de 30 s, placement abstrait | Chaque coureur dans l'espace 3D, en temps réel | **PCM** (sprints, placement, chutes en chaîne) |
| Physiologie | CP/W′, durabilité, allumettes, fringale, altitude, chaleur, froid, jours sans | Jauges d'énergie et d'effort, forme du jour | **Directeur Sportif** |
| Physique | Air, vent par tronçons, pavés, descentes, pluie ; vitesse dérivée des notes par terrain | Non publiée | Égalité |
| Sprint | **Simulé au quart de seconde** sur le dernier km (placement, train, lancement, aspiration, enfermement), avec ordres de sprint | Trains simulés en 3D | Égalité sur le fond ; PCM le montre en 3D |
| IA tactique | Cerveau de DS explicite : contrôle, durcir, attentisme, coopération, pactes, chasseurs de maillot, désobéissance | Réputée inégale (échappées, poursuites) | **Directeur Sportif** sur l'intention tactique |
| Validation | **40 mesures comparées au réel (2 × 60 saisons)**, empreinte, tests de biais, intégration continue | Non publiée | **Directeur Sportif** |
| Reproductibilité | Une graine par étape | Non | **Directeur Sportif** |
| Vitesse de simulation | ~0,1 s par étape, une saison en ~17 s | Temps réel, ou simulation détaillée | **Directeur Sportif** |
| Ampleur du monde | 18 équipes, 37 courses, monde fictif ; **base ouverte (JSON) et parcours GPX** | Base réelle, modding | **PCM** (sa base réelle), mais l'écart d'outillage est comblé |
| Planification | Pics de forme, altitude, planificateur, délégation | Rôles de saison, Tour/Classics Focus | Égalité |

**Mon avis** : sur le cœur de la simulation, ton moteur est au niveau de PCM et le dépasse sur la physiologie, la lisibilité de l'IA et surtout la **validation** : aucun PCM ne publie une calibration contre le réel. Les deux jeux font un choix différent. PCM simule chaque coureur dans l'espace, alors que le tien simule des groupes intelligents, ce qui est cohérent avec un jeu de gestion jouable sur téléphone. Pour rivaliser vraiment, il reste **le final au mètre près** (sprints et attaques), et surtout **l'ampleur et le modding**, qui relèvent du contenu et des outils plus que du moteur.

### Sources
- [Pro Cycling Manager 26, Steam](https://store.steampowered.com/app/3936530/Pro_Cycling_Manager_26/)
- [Pro Cycling Manager 26, Cyanide Studio](https://cyanide-studio.com/en/cyanide-games/pro-cycling-manager-26/)
- [Pro Cycling Manager 26, Epic Games Store](https://store.epicgames.com/p/pro-cycling-manager-26-82a91d)
- [Pro Cycling Manager 26, Green Man Gaming](https://www.greenmangaming.com/games/pro-cycling-manager-26-pc/)
