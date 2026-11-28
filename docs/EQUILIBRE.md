# Équilibre du jeu — bilan du 28 novembre 2026

Mesures faites avec les bancs du projet, après les corrections du moteur de fin novembre (écarts en temps,
poursuites, échappées, staff créé dès le départ).

## Difficulté : passif, adjoint, expert (tests/expert.js, 4 parties de 8 saisons)

Classement UCI par équipes de mon équipe (18 équipes), saison par saison :

| Partie | Joueur passif | Tout délégué à l'adjoint | Joueur expert automatisé |
|---|---|---|---|
| graine 41 | 15 14 12 11 10 13 12 13 | 11 13 11 17 15 13 12 13 | 13 9 10 7 8 6 4 **3** |
| graine 57 | 13 12 18 13 12 15 15 16 | 14 13 14 17 18 16 17 10 | 12 13 12 17 14 13 13 13 |
| graine 73 | 14 14 14 18 8 10 10 9 | 14 12 14 12 14 12 7 16 | 13 12 7 7 9 15 14 12 |
| graine 89 | 6 9 9 9 7 10 15 9 | 8 10 9 7 10 5 4 **3** | 7 7 4 5 4 5 3 **2** |
| **rang moyen** | **12,0** | **11,9** | **9,2** |

- **L'habileté paie, sans rendre le jeu trivial.** L'expert gagne en moyenne trois places sur le passif, et finit
  sur le podium UCI dans deux parties sur quatre au bout de huit saisons ; jamais premier. Dans les deux autres,
  il stagne : la qualité de l'effectif de départ et la chance comptent encore beaucoup.
- **Le départ pèse lourd.** Avec la graine 89, les trois façons de jouer finissent bien placées ; avec la 57,
  aucune.
- **Déléguer ne fait pas mieux que ne rien faire** dans ce banc (11,9 contre 12,0). À nuancer : le banc fait
  lui-même le recrutement d'intersaison pour l'adjoint (12 coureurs visés, comme le passif). Le banc d'économie,
  où l'adjoint gère aussi le recrutement, montre une gestion saine (confiance du sponsor de 51-54 à 59-100 en
  trois saisons).
- **Licenciements fréquents** : 20 saisons sur 96 finies avec une confiance du sponsor à 15 ou moins, surtout chez
  le joueur passif (objectifs manqués, environ −6 par objectif) et chez l'expert du banc, qui dépense dès qu'il
  le peut (staff, stages, 16 coureurs) et passe jusqu'à 28 semaines dans le rouge : −1 de confiance toutes les
  deux semaines, soit −14 sur la saison, même avec tous les objectifs remplis.

## Chaque choix compte-t-il ? (tests/impact.js, 30 essais appariés)

Toutes les caractéristiques changent le résultat sur leur terrain, dans le bon sens (montagne, collines,
sprint, chrono, pavés, plat, endurance, descente, placement, récupération, baroud). Les plus faibles : descente
(mieux dans 52 % des paires) et placement (51 %).

Choix du joueur : reconnaissance des pavés, ravitaillement renforcé, équipiers au service du leader,
entraînement ciblé, niveau des entraîneurs : tous efficaces. **« Garder au chaud » ne l'était presque pas**
(+3 points d'énergie) : le coureur suivait le groupe dans chaque côte. Corrigé : il laisse filer dès que ça monte
fort et grimpe à son rythme, et profite mieux de l'abri (+8 points).

## Économie (tests/economy.js, 4 graines, 3 saisons, tout délégué)

Budget positif chaque saison, aucun licenciement, confiance en hausse : la première saison ne se joue pas sur la
loterie de l'effectif de départ.

## Défaut trouvé en chemin

Un changement d'équipe (offre acceptée ou licenciement) recréait les contrats d'équipementiers pour deux
catégories sur cinq : la partie plantait la semaine suivante. Corrigé, avec un test.

## Pistes

- Banc de difficulté : laisser l'adjoint recruter lui-même en mode « adjoint », et faire dépenser l'expert
  avec prudence (garder une réserve), pour que le banc mesure le jeu et non ses propres raccourcis.
- Trésorerie : prévenir plus tôt le joueur qui va passer dans le rouge (prévision de trésorerie sur
  les semaines à venir), plutôt que de le sanctionner semaine après semaine.
- Départ : l'écart entre les effectifs de départ reste grand ; à surveiller si des joueurs trouvent leur
  partie jouée d'avance.
