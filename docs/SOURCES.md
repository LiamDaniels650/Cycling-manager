# Sources des fourchettes de calibration

`tests/calibrate.js` compare 33 mesures de la simulation à des fourchettes réelles. Ce document dit d'où vient
chacune. Statut : **sourcée** (chiffre publié), **dérivée** (déduite d'une mesure sourcée), **à l'échelle du jeu**
(le jeu a 18 équipes et un calendrier resserré : pas de comparaison directe possible), **estimée** (ordre de
grandeur connu du milieu, sans chiffre publié retrouvé).

| Mesure | Fourchette | Statut | Source / raisonnement |
|---|---|---|---|
| GT_vitesse | 39–42,5 km/h | sourcée | Tour 2016-2025 : 39,6 à 42,8 km/h (BikeRadar, ProCyclingStats) ; Giro et Vuelta plus lents |
| GT_finishers_pct | 75–90 % | sourcée | Tour 2019-2024 : 135 à 155 arrivants pour 176 à 184 partants (77 à 88 %) |
| GT_abandons_etape | 0,8–2,1 | dérivée | mêmes éditions : 21 à 43 abandons en 21 étapes (corrigée en v4 : l'ancienne borne 0,4–1,6 contredisait la précédente) |
| echap_plat | 3–15 % | sourcée / élargie | Tour : 2 % des étapes plates gagnées par l'échappée (Frontier Economics) ; borne haute élargie pour les courses moins contrôlées |
| echap_vallonne | 35–55 % | sourcée | Tour, moyenne montagne : 43 % (Frontier Economics) |
| echap_montagne | 35–60 % | sourcée | Tour, haute montagne : 47 % (Frontier Economics) |
| echap_punch, echap_sommet | 20–45 %, 28–45 % | estimée | entre le plat et la montagne ; arrivées au sommet plus souvent pour les favoris |
| taille_echap_montagne_GT | 8–35 | sourcée (indirecte) | les échappées de 16 coureurs et plus réussissent dans 77 % des cas (Frontier Economics) : elles sont fréquentes en montagne |
| taille_echap_plat | 2–7 | estimée | échappées de 2 à 6 coureurs sur les étapes de sprint |
| watts_vainqueur_col | 5,8–6,9 W/kg | sourcée | estimations : 6,0-6,4 W/kg pour gagner une montée de 30-40 min, jusqu'à ≈7 pour Pogačar (Velo, Rouleur) |
| kom_vainqueur_top10_gc | 0,2–0,55 | sourcée | Grands Tours 2019-2025 : 5 maillots sur 21 gagnés par un coureur du top 10 (Tour 4, Giro 1, Vuelta 0) |
| gc2_GT, gc3_GT, gc10_GT | 0,5–8, 2–12, 10–30 min | sourcée (partielle) | Tour 2019-2024 : 2e à 1:11-7:29, 3e à 1:31-10:56 ; le 10e est plus loin sur le Tour récent (jusqu'à ≈30-45 min), plus près sur Giro et Vuelta |
| gc2/3/10_1sem | 0,1–1,5, 0,3–2,5, 2–7 min | estimée | courses d'une semaine (Paris-Nice, Dauphiné…) |
| v_* (vitesses par type d'étape) | voir le fichier | estimée | ordres de grandeur PCS ; contre-la-montre 48-54 km/h (étape 7 du Tour 2024 : plus de 52 km/h) |
| 10e_* (écart du 10e de l'étape) | voir le fichier | estimée | |
| jours_course_p90, jours_course_max | 60–90, 75–105 | sourcée (partielle) | ProCyclingStats : 85 à 89 jours pour les coureurs les plus chargés (2024, 2026). **À surveiller : le jeu donne ≈97 jours au plus chargé, au-dessus du réel.** |
| saison_victoires_n1 | 10–28 | à l'échelle du jeu | l'équipe dominante réelle gagne 50 à 80 courses (UAE 2024), mais sur un calendrier 3 à 4 fois plus long |
| hors_delais | 0–1 par étape | estimée | |
| GT_abandons / arrivées | | | voir plus haut |

Sources principales : Frontier Economics, *The Tour de France: breaking down the breakaway* ; BikeRadar et
Domestique (vitesses moyennes du Tour) ; Velo, Rouleur, FasCat (estimations de puissance) ; ProCyclingStats
(classements, jours de course).
