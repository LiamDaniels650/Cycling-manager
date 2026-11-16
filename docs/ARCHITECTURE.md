# Directeur Sportif — guide du code

Un seul fichier jouable (`dist/index.html`) assemblé à partir de `src/` par `build.py` : le moteur
(`src/engine/*.js`, ordre alphabétique) puis l'interface (`src/ui/*.js`), insérés dans `src/shell.html`.
Tout est global (pas de modules) ; les fonctions sont des déclarations, donc l'ordre des fichiers ne compte
qu'au chargement des constantes. `dist/engine.js` (moteur seul) sert aux tests Node.

## Travailler vite

```
./dev.sh check     # ≈ 1 min : build + lint + types + empreinte (la simulation n'a-t-elle PAS changé ?)
./dev.sh test      # ≈ 6 min : + fonctionnalités, non-régression, biais, audit, interface
./dev.sh calib     # ≈ 10 min : calibrage sur 2 × 30 saisons en parallèle, écarts au réel
./dev.sh accept    # après un changement VOULU de la simulation : nouvelle empreinte et références
./dev.sh profile   # fonctions les plus coûteuses
./dev.sh fmt       # prettier
```

Règle d'or :
- **Nettoyage, optimisation, interface** : `./dev.sh check` doit afficher « Empreinte identique ».
- **Changement de mécanique ou de réglage** : `./dev.sh check` montre l'empreinte changée → `./dev.sh calib`
  (toutes les mesures dans le réel sur les deux graines) → `./dev.sh test` → `./dev.sh accept`.

Outils : `tools/split.py` déplace des fonctions d'un fichier à l'autre sans les modifier ;
`tools/profile.js` profile la simulation.

## Réglages

- `src/engine/00-params.js` (objet `R`) regroupe les principaux leviers commentés : progression, économie,
  licence WorldTour, commissaires, course. `./dev.sh reglages` régénère `docs/REGLAGES.md`, qui liste aussi
  toutes les autres constantes nommées. Changer un réglage change la simulation : `./dev.sh check`, puis `calib`.

## Hasard et déterminisme (à ne jamais casser)

- `rnd()` (01-util) est le seul hasard du jeu. Chaque étape a sa propre série : `stageSeed(cal, si)` et
  `withSeed(holder, fn)` ; sélection IA (index -2), profils (-1), courses espoirs (-3).
- Simuler une course dans le navigateur, dans le Worker ou dans Node donne exactement le même résultat.
- Le commentaire (17), la presse (14), les rumeurs (26) et le final raconté (33) n'appellent jamais `rnd()`.
- Toute action de l'interface qui touche la simulation passe par `inSim()` (04b-live).
- Une optimisation ne doit changer ni l'ordre ni le nombre d'appels à `rnd()` : l'empreinte le vérifie.

## Données

- `S` (01-util) : toute la partie, sérialisable (sauvegarde = `JSON.stringify({S, sd, rid})`).
  `S.riders[id]` (coureurs, `r.s` = caractéristiques), `S.teams` (`S.teams[0]` = le joueur),
  `S.cal` (courses de la saison), `S.rc` (course en cours), `S.academy`, `S.youth`, `S.inbox`…
- `rc` (06-race-setup) : une course — sélections `sel`, consignes `orders`, général `gc`, points `pts`/`kom`,
  énergies entre étapes `energy`, résultats `stageRes`, plans `plan`.
- `sim` (08-stage-sim) : une étape en cours — `runners` (un `x` par coureur : `x.r` le coureur, `x.g` son
  groupe, `energy`, `food`, `punch`/W', `work`, `order`, `radio`…), `groups` (triés de la tête à la queue),
  `pel` (le peloton), `log`, `hls` (moments forts), `P` (profil : pentes, cols, secteurs).

## Moteur : une étape, pas à pas (30 s de course)

`simStep` (08-stage-sim) :
1. `tickPrepare` — nettoie les groupes, désigne le peloton, état de l'échappée (`breakUpdate`).
2. `tickRoadEvents` — vent et bordures, entrée des secteurs pavés, routes étroites, descentes techniques.
3. `tickTeamPlans` — niveau de poursuite de chaque équipe dans chaque groupe (`teamChaseLevel`, 07),
   alliances, cerveau des directeurs sportifs (`dsBrain`, 07), ordres conditionnels.
4. `decideRider` (08b) — chaque coureur, ordre aléatoire : relais, attaques, jonctions, placement, échappée.
5. `radioTick` (30) — appels radio du joueur, pactes et ententes dans l'échappée.
6. `tickPhysics` (08c) — rythme `L` du groupe, vitesse (05 : `speedOf`, `physSpeed`), effort `I`,
   énergie, W', lâchés ; `tickIncidents` (chutes, crevaisons), `tickMerges` (regroupements).
7. `tickCrossings` (09) — sommets (points, chronos de montée), arrivées (`finishGroup`, sprint ou côte).
8. `finaleTick` (33) — le final raconté ; `commentTick` (17) — le commentateur.

Avant le départ : `autoOrders` et `aiPlan` (06) — consignes et plan de chaque équipe (le même raisonnement pour
l'IA et les boutons « auto » du joueur), `jerseyAims` (34). Après : `applyStageResult` (11).

## Où changer quoi

| Sujet | Fichier |
|---|---|
| Capacité d'un coureur selon le terrain, forme, fatigue, tenue dans la durée | 05-physics (`capRaw`, `terrStat`) |
| Vitesse, aspiration, air, vent, pluie | 05-physics |
| Poursuites, contrôle, attentisme, plans de course | 07-tactics (`teamChaseLevel*`, `planMode`) |
| Directeur sportif en course (IA et auto) | 07-tactics (`dsBrain`) |
| Consignes avant l'étape, situation au général | 06-race-setup (`autoOrders`, `gcSituation`, `leaderAtt`) |
| Attaques, relais, échappée | 08b-decide, 07-tactics (`doAttack`, `attackUtility`) |
| Rythme des groupes, lâchés, énergie | 08c-physics-tick |
| Sprint, arrivées en côte, photo-finish | 09-stage-finish (`finishGroup`) |
| Contre-la-montre | 10-time-trials |
| Classements, primes, palmarès | 11-results |
| Semaine, progression des coureurs, fin de saison | 12-season |
| Marché, contrats, négociation (chance d'accord : `negoChance`) | 13-people |
| Finances, staff, sponsor (part variable : `sponsorWeekly`), difficulté | 19-economy (réglages dans 00-params) |
| Entraînement et transferts des équipes IA | 20-ai-season, 26-mercato, 29-ai-economy |
| Objectifs du sponsor | 22-goals (`genObjectives`, `objStatus`) |
| Académie, espoirs, juniors, prodiges | 31-academy (+ progression dans 12-season) |
| Maillots de la montagne et des points, barèmes des Grands Tours | 34-jerseys (`komPts`), 02-data |
| Licence WorldTour, file des voitures, commissaires | 35-officials |
| Messages du joueur | 36-inbox (`msg`) |
| Relations entre coéquipiers | 37-relations |
| Bilans de fin de saison (individuel, « pourquoi ») | 38-review |
| Niveau du peloton et salaires | 03-world (`worldLevel`, `salaryFor`, monde de départ : `matureRider`) |
| Délégation des courses à l'adjoint | 32-delegate, 18-assistant |
| Écran de course en direct, final, rythme auto | ui/04b-live, react/race |
| Noms personnalisés (équipes, coureurs, courses) | 39-names |
| Histoires (rivalités, conflits de leaders…) | 40-stories |
| Mode carrière : état, journal, décisions (`CAR_FX`), progression, saisons | 41-career |
| Mode carrière : courses des jeunes (cadets, juniors, espoirs), bascule des équipes le temps d'une course | 42-career-races |
| Mode carrière : équipes espoirs, agent, stage, contrats pros | 43-career-u23 |
| Mode carrière : courses pros du joueur (sélection `carSelHook`, un seul coureur piloté `rc.carId`) | 44-career-pro |
| Mode carrière : directeur sportif et confiance, coéquipiers, transferts, changement de profil | 45-career-team |
| Mode carrière : hygiène, poids, maladies, rééducation, déclin, caractère, rêves | 46-career-body |
| Mode carrière : popularité, presse, style, déclarations, surnom, statut, sponsors, légendes | 47-career-rep |
| Mode carrière : lieu de vie, argent, placements, couple, enfants, tensions | 48-career-life |
| Mode carrière : record de l'heure, retraite, bilan, biographie, reconversion, passage au mode directeur | 49-career-end |
| Interface React (écrans, course, carrière) | react/ (App.jsx, screens/, race/, career/) |

Mode carrière : une partie séparée (emplacement de sauvegarde `car`, voir `setSlot` dans ui/01-core). Le monde pro y
tourne seul (l'équipe 0 est confiée à l'adjoint). Le moteur ne connaît le joueur que par `S.car` et `rc.carId` :
sans eux, aucun chemin ne change (l'empreinte du mode directeur reste identique). Les crochets dans le moteur
commun : `carSelHook` (06-race-setup), `carOrderHook` et `sim.carId` (08-stage-sim), `obeyCheck` et `askOpen`
(07-tactics, 30-radio), et les gardes `r.car` (12-season, 26-mercato) qui laissent au joueur ses décisions.

## Tests

| Test | Rôle |
|---|---|
| `tests/fingerprint.js` | empreinte exacte de deux saisons : rien n'a changé |
| `tests/calibrate.js` | 40 mesures comparées aux fourchettes réelles (`REAL`) |
| `tests/features.js` | ~110 vérifications ciblées des fonctionnalités |
| `tests/regress.sh` | non-régression des rapports de saison |
| `tests/impact.js` | chaque caractéristique et chaque choix du joueur pèse |
| `tests/bias.js`, `tests/audit.js` | biais d'ordre, cohérence sur plusieurs saisons |
| `tests/prodigies.js` | jeunes talents sur 9 saisons |
| `tests/career.js` | mode carrière : une carrière simulée de 16 ans à 24 ans, avec vérifications (`./dev.sh carriere`) |
| `tests/ui_*.py`, `tests/playthrough.py` | interface dans le navigateur (Playwright) |

## Conventions

- Commentaires et textes en français ; une phrase d'en-tête par fichier et par fonction non évidente.
- Les nouveaux champs de `S` doivent être tolérés absents (anciennes sauvegardes) ou migrés dans 99-migration.
- Le moteur ne dépend jamais de l'interface ; l'interface ne fait aucun calcul de course elle-même.
