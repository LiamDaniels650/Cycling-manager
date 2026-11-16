# Réglages du moteur

Fichier généré par `python3 tools/reglages.py` (ne pas modifier à la main).

## Leviers principaux (`src/engine/00-params.js`, objet `R`)


### Monde et progression

| Réglage | Valeur | Rôle |
|---|---|---|
| `R.progAge` | `(table)` | vitesse de progression d'un coureur selon son âge (décalé selon l'âge de pic de son profil) : [âge max, facteur] |
| `R.initAge` | `(table)` | de plus qu'à la création, les tout jeunes un peu moins) : [âge max, points] |
| `R.formeRate` | `0.22` | part de l'écart à la forme visée comblée chaque semaine |
| `R.daysCap` | `75` | jours de course au-delà desquels la forme plafonne plus bas (fatigue chronique) |
| `R.daysMalus` | `0.15` | points de forme visée perdus par jour de course au-delà |

### Économie

| Réglage | Valeur | Rôle |
|---|---|---|
| `R.salary` | `{ base: 25, k: 0.35, exp: 2.4, youngMul: 0.7 }` | salaire = base + k × (note − 60)^exp (k€/an), × youngMul avant 24 ans |
| `R.lvlRef` | `77.3` | niveau de référence du peloton (moyenne des 200 meilleurs, fin de première saison) |
| `R.lvlK` | `0.75` | part de la hausse du niveau du peloton retranchée de la note pour fixer un salaire |
| `R.sponsorBase` | `52` | apport du sponsor principal (k€ par semaine) |
| `R.sponsorConf` | `0.15` | par point de confiance du sponsor |
| `R.sponsorUci` | `0.0015` | par point UCI de la saison |
| `R.raceDay` | `4.5` | coût d'une journée de course (k€), avant difficulté |

### Licence WorldTour

| Réglage | Valeur | Rôle |
|---|---|---|
| `R.wtN` | `13` | licences WorldTour (sur 18 équipes) |
| `R.wtCycle` | `3` | saisons par cycle d'attribution |
| `R.wtDown` | `{ conf: -15, spons: 0.88, moral: -8 }` | relégation : confiance, apport du sponsor (×), moral de l'effectif |
| `R.wtUp` | `{ conf: 10, spons: 1.08, moral: 6 }` | promotion |
| `R.wtExit` | `{ p: 0.45, amb: 60, ov: 72 }` | clause de sortie d'un leader d'une équipe reléguée : chance, ambition et note minimales |
| `R.wtSign` | `{ star: -0.12, good: -0.05 }` | chance de signature en moins pour une ProTeam (coureur ≥ 75, ≥ 71) |

### Commissaires

| Réglage | Valeur | Rôle |
|---|---|---|
| `R.feedKm` | `20` | ravitaillement interdit dans les derniers km |
| `R.feedPen` | `20` | pénalité (s) |
| `R.feedFine` | `1` | amende (k€) |
| `R.shelterPen` | `20` | abri derrière les voitures : pénalité (s) |
| `R.shelterFine` | `0.5` | et amende (k€) |
| `R.shelterSeen` | `0.3` | chance d'être vu par les commissaires |

### Course

| Réglage | Valeur | Rôle |
|---|---|---|
| `R.sprintNoise` | `4.5` | aléa du sprint (placement, timing, jambes du jour) |
| `R.leaderFollow` | `0.8` | chance qu'un leader suive une attaque qui compte (0,95 s'il court défensif) |
| `R.leaderFollowDef` | `0.95` |  |
| `R.leaderFollowIdle` | `0.03` | … et une attaque qui ne compte pas (bagarre pour l'échappée) |
| `R.rivalGap` | `300` | un attaquant à moins de 300 s au général est un rival qu'on suit |
| `R.breakTry` | `0.1` | chance par pas de temps qu'un candidat à l'échappée attaque (× baroud / 72) |
| `R.hunterTry` | `0.6` | idem pour le chasseur du maillot de la montagne (× max(baroud, montagne) / 72) |
| `R.hunterBridge` | `180` | le chasseur part en contre tant que l'échappée a moins de 180 s |
| `R.hunterShare` | `40` | % des équipes sans ambition au général qui désignent un chasseur de maillot |
| `R.hunterMon` | `77` | note de montagne minimale du chasseur |
| `R.sitUpPace` | `0.74` | allure d'un chasseur relevé (part de la capacité médiane du groupe) |

## Autres constantes nommées

| Constante | Fichier | Commentaire |
|---|---|---|
| `STATS` | 02-data.js:2 |  |
| `STAT_LBL` | 02-data.js:3 |  |
| `NATS` | 02-data.js:16 |  |
| `NAT_W` | 02-data.js:372 |  |
| `ARCH` | 02-data.js:397 |  |
| `PRIMARY` | 02-data.js:497 |  |
| `STYLES` | 02-data.js:506 |  |
| `TRAITS` | 02-data.js:513 |  |
| `TRAIT_W` | 02-data.js:524 |  |
| `ORDERS` | 02-data.js:541 |  |
| `ATT` | 02-data.js:551 |  |
| `RADIO` | 02-data.js:556 |  |
| `TRAINING` | 02-data.js:571 |  |
| `STEP` | 02-data.js:583 |  |
| `WX` | 02-data.js:584 |  |
| `SUBORD` | 02-data.js:590 |  |
| `COND` | 02-data.js:591 |  |
| `COND_ACT` | 02-data.js:600 |  |
| `PLAN_MODES` | 02-data.js:602 | décision d'équipe : intensité de poursuite pour ce groupe |
| `ISP_PTS` | 02-data.js:609 |  |
| `KOM_PTS` | 02-data.js:610 |  |
| `KOM_GT` | 02-data.js:613 | le Giro récompense très fortement le premier au sommet, la Vuelta ne classe que les premiers passages. |
| `STAGE_PTS` | 02-data.js:624 |  |
| `PRIZE` | 02-data.js:629 |  |
| `UCI` | 02-data.js:634 |  |
| `PEAK_AGE` | 02-data.js:640 | Âges de pic par profil [début, fin] : les sprinteurs culminent tôt, les grimpeurs et rouleurs plus tard. |
| `LVL_REF` | 03-world.js:13 | masse salariale reste stable sur une longue carrière (coefficient réglé sur des parties de 25 saisons). |
| `TEAM_NAMES` | 03-world.js:75 |  |
| `TIERS` | 03-world.js:95 | Niveaux des 17 équipes IA (du WorldTour de pointe aux équipes invitées) ; votre équipe démarre à -0,8. |
| `ROSTER` | 03-world.js:98 | chacun dispute ainsi 50 à 80 jours de course par saison. min : seuil sous lequel l'équipe doit recruter. |
| `COMPO_EXTRA` | 03-world.js:104 | Seconde moitié d'effectif : équipiers et jeunes, un cran en dessous du noyau. |
| `COMPO` | 03-world.js:122 |  |
| `GB_ST` | 04-calendar.js:2 |  |
| `GI_ST` | 04-calendar.js:25 |  |
| `VU_ST` | 04-calendar.js:48 |  |
| `RACE_DEFS` | 04-calendar.js:71 |  |
| `LAST_WEEK` | 04-calendar.js:266 |  |
| `PLACE` | 04-calendar.js:284 |  |
| `WX_REGIME` | 04-calendar.js:554 | plusieurs semaines, avec des tendances de saison (giboulées de printemps, canicules d'été, automne humide). |
| `SPEED_K` | 05-physics.js:43 | Calibrage 2024-2025 : plat ~44 km/h, montagne ~35-38, chrono ~52, CLM par équipes ~55 (voir tests/calibrate.js). |
| `PHY` | 05-physics.js:60 | conditions du jour : air moins dense en altitude ou par la chaleur, vent de face ou de dos, pavés, pluie. |
| `RADIO_ACTS` | 08-stage-sim.js:200 | Consigne effective d'un coureur (radio ponctuelle, rébellion ou consigne d'avant course). |
| `ESCORT_ORD` | 08-stage-sim.js:201 |  |
| `DT_MIN` | 08-stage-sim.js:258 | Un pas de simulation = 30 secondes de course. |
| `SPRINT_NOISE` | 09-stage-finish.js:64 | Aléa du sprint (placement, timing, jambes du jour) : le meilleur sprinteur ne gagne pas tous les sprints. |
| `PW_BUCKETS` | 09-stage-finish.js:308 | Records de puissance : meilleur effort personnel par durée et palmarès mondial des ascensions (20 min et plus). |
| `GC_CACHE` | 11-results.js:135 | Le général ne change qu'entre les étapes (ou sur abandon) : il est mis en cache et invalidé par gcDirty(). |
| `UCI_COUNT` | 11-results.js:353 | Classement UCI par équipes (règle réelle) : somme des points de la saison de ses 20 meilleurs coureurs actuels. |
| `JOURNALS` | 14-press.js:2 |  |
| `EQ_BIKES` | 15-equipment.js:5 | minRep : notoriété minimale pour que la marque vous fasse une offre ; pay : versement de base (k€/saison). |
| `EQ_TT` | 15-equipment.js:15 | Matériel de contre-la-montre (vélo, roues pleines, combinaison). |
| `EQ_CATS` | 15-equipment.js:21 |  |
| `EQ_OFFER_WEEK` | 15-equipment.js:22 |  |
| `EQ_NEGO` | 15-equipment.js:118 | perf  : 25 % d'argent fixe en moins contre une prime par victoire (étapes comprises). |
| `REPLIES` | 17-commentary.js:21 | Réponse radio d'un coureur selon son caractère et son état. kind : 'ok' / 'no' / 'legs'. |
| `COM_MARKS` | 17-commentary.js:53 | Points d'annonce du commentateur (km de l'arrivée). |
| `AUTO_LBL` | 18-assistant.js:3 |  |
| `ASST_FN` | 18-assistant.js:240 |  |
| `DIFF` | 19-economy.js:3 |  |
| `SPONSOR_NAMES` | 19-economy.js:8 |  |
| `STAFF_COST` | 19-economy.js:115 | coût annuel du staff par niveau (k€) : un vrai choix économique (entraîneurs, médecins, recruteurs) |
| `STAFF_LBL` | 19-economy.js:116 |  |
| `STAFF_DESC` | 19-economy.js:117 |  |
| `GOALS` | 22-goals.js:3 |  |
| `GOAL_SHORT` | 22-goals.js:12 |  |
| `GEAR` | 23-gear.js:2 |  |
| `NAT_NAME` | 24-worlds.js:2 |  |
| `WORLDS_NATIONS` | 24-worlds.js:18 |  |
| `WORLDS_WISH` | 24-worlds.js:127 | qu'aux deux meilleurs de la sélection ; sinon le coureur reçoit une carte libre. |
| `MONUMENTS` | 24-worlds.js:242 |  |
| `NAT_ADJ` | 25-titles.js:20 |  |
| `MERC_KIND` | 26-mercato.js:4 |  |
| `FEED_PLANS` | 27-raceplus.js:6 | ---------- Alimentation ---------- |
| `FEED_COST` | 27-raceplus.js:13 |  |
| `IMAGE_AXES` | 28-image.js:4 |  |
| `ASK_TTL` | 30-radio.js:5 | 6 minutes de course pour répondre (sim.t est en minutes) |
| `ASK_GAP` | 30-radio.js:6 | au moins 4 minutes entre deux appels |
| `ESP_CAL` | 31-academy.js:6 | nat (championnats nationaux), tour (le « Tour de l'Avenir » du jeu, sélections nationales), monde. |
| `ESP_WEEKS` | 31-academy.js:56 |  |
| `ESP_PROG` | 31-academy.js:57 |  |
| `STAG_WEEK` | 31-academy.js:58 | stagiaires chez les pros à partir du 1er août |
| `STAG_MAX` | 31-academy.js:59 |  |
| `TEST_COST` | 31-academy.js:60 |  |
| `CLUBS` | 31-academy.js:61 |  |
| `DEV_LBL` | 31-academy.js:109 |  |
| `ACA_MAX` | 31-academy.js:621 |  |
| `FINALE_KM` | 33-finale.js:5 | le final commence à 15 km de l'arrivée |
| `FINALE_MARKS` | 33-finale.js:6 |  |
| `WT_N` | 35-officials.js:15 |  |
| `WT_CYCLE` | 35-officials.js:16 |  |
| `MSG_IMP` | 36-inbox.js:24 | Messages qui demandent l'attention du directeur sportif (le reste est de l'information). |
