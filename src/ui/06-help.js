// Premiers pas : une bulle d'aide par écran (jusqu'à ce que le joueur la ferme) et le guide du directeur sportif.
const TIPS = {
  home: "Votre tableau de bord : la prochaine échéance et son bouton d'action, ce qui demande votre attention (touchez une ligne pour y aller), votre situation et vos rivaux directs au classement UCI.",
  team: "Votre effectif. Réglez l'entraînement de chacun (ou laissez l'adjoint 🧑‍💼 le faire), surveillez la fatigue, et prolongez les contrats qui arrivent à échéance. Touchez un coureur pour sa fiche : caractéristiques, seuil en W/kg, caractère, relations.",
  aca: "L'académie forme vos espoirs. Recrutez dans le vivier les jeunes au potentiel élevé (★) — les meilleurs préfèrent une académie réputée. Ils courent le calendrier espoirs (jusqu'au Tour de l'Avenir et au Mondial), passent des tests physiques, progressent plus vite avec un mentor et peuvent être stagiaires chez les pros à partir d'août. Surveillez leur charge de courses, et passez-les pros avant 23 ans ou avant qu'une équipe ne vous les prenne.",
  cal: 'Le calendrier de la saison. Certaines semaines comptent plusieurs courses : vos coureurs ne peuvent pas courir les deux. Vous pouvez simuler une course sans la diriger.',
  prep: 'Choisissez vos coureurs selon le profil des étapes (les caractéristiques utiles sont affichées). La forme, la fraîcheur et le moral comptent autant que le niveau.',
  race: 'Le briefing : donnez une consigne à chaque coureur (leader, sprinteur, équipier, échappée…), réglez le plan de course par phase et, si vous voulez, des ordres conditionnels. Les coureurs obéissent… ou pas, selon leur discipline et leur moral.',
  live: "La course en direct. Choisissez la vitesse en bas de l'écran, suivez les écarts et la puissance de vos coureurs, et parlez-leur à la radio 📻. Le « jus » est leur réserve anaérobie : une attaque la vide, l'abri la recharge.",
  market:
    'Le marché : coureurs libres, en fin de contrat (pré-contrat) ou sous contrat (transfert). Les valeurs des adversaires sont estimées (~) : vos recruteurs et le suivi 👁 les précisent.',
  mgmt: 'La gestion : carrière du DS, adjoint, équipementiers, staff, sponsor et finances. Si la confiance du sponsor tombe sous 15 en fin de saison, vous êtes licencié.',
  press:
    'La presse juge vos résultats et vos réponses. La notoriété aide le sponsor, les invitations aux Grands Tours et le recrutement.',
  stats: 'Les statistiques : classements UCI (équipes et coureurs), historique des courses, records et watts.',
};
// Ferme la bulle d'aide d'un écran.
function tipDone(view) {
  S.tipsSeen = S.tipsSeen || {};
  S.tipsSeen[view] = true;
  save();
  render();
}
// Guide du directeur sportif (Options).
const GUIDE = [
  [
    "S'orienter",
    "L'accueil 🏠 montre la prochaine échéance avec son bouton d'action, la liste des choses à traiter (touchez une ligne pour y aller), votre situation et vos rivaux. Sur téléphone, la barre du bas mène aux écrans principaux ; « Plus » et le bouton ☰ ouvrent tous les autres. Touchez une équipe pour sa fiche (stratégie, matériel, effectif estimé).",
  ],
  [
    'Le principe',
    "Vous ne pilotez pas les coureurs : vous les recrutez, les formez, choisissez leurs courses et leur donnez des consignes. Chaque coureur décide d'obéir selon sa discipline, son moral, son ambition, son caractère et ses relations avec le leader.",
  ],
  [
    'Une course',
    'Avant chaque étape : une consigne par coureur, un plan de course par phase (début, milieu, final), des ordres conditionnels éventuels. Pendant la course : radio individuelle ou collective, ou DS automatique. Les échappées, les poursuites, les bordures, les chutes et les sprints sont simulés groupe par groupe, toutes les 30 secondes de course.',
  ],
  [
    'Les caractéristiques',
    "Toutes comptent, chacune sur son terrain. Plat : coût de l'effort sur le plat et en chrono. Montagne : cols et arrivées au sommet. Collines : bosses et arrivées en côte. Sprint : pointe de vitesse à l'arrivée et aux sprints intermédiaires. CLM : contre-la-montre. Pavés : vitesse et tenue sur les secteurs, moins de pièges à l'entrée. Descente : vitesse et sécurité en descente (les moins bons perdent le contact dans les descentes techniques). Placement : place dans le peloton, sprints, pièges, bordures et chutes. Endurance : la réserve de la journée dure plus longtemps (étapes longues, troisième semaine). Récupération : moins de fatigue accumulée d'un jour à l'autre. Attaque : envie d'attaquer, de prendre l'échappée et d'y insister.",
  ],
  [
    'Effort et puissance',
    "Le fond est la réserve de la journée ; le jus est la réserve anaérobie (W', en kJ) qui se vide au-dessus du seuil et se recharge à l'abri. Les watts affichés sont calculés physiquement (pente, vitesse, poids, abri). L'altitude, la chaleur, le froid et la fringale pèsent sur l'effort.",
  ],
  [
    'La saison',
    'Entraînement et pics de forme, fatigue des Grands Tours, jours sans, maladies. Les adversaires visent leurs propres objectifs et préparent leurs leaders pour leur Grand Tour.',
  ],
  [
    "L'équipe",
    'Contrats, revalorisations, transferts et pré-contrats, académie et vivier de jeunes, staff, équipementiers (le matériel compte : ~1 % de vitesse, 2 % en chrono).',
  ],
  [
    'Sponsor et carrière',
    "Le sponsor fixe des objectifs ; sa confiance règle son versement et se renégocie tous les 2 ou 3 ans. Votre réputation de DS attire les offres d'autres équipes… et un échec peut vous coûter votre poste.",
  ],
  [
    'Course en direct',
    "Avant l'étape, choisissez le matériel et le ravitaillement (ou « Tout régler en auto »). En course, surveillez 🍌 : un coureur qui a faim peut manger ses barres (🍫) ou se faire apporter des bidons. Quand une échappée sans vous file, une équipe peut vous proposer de rouler ensemble : accepter améliore vos relations avec elle, refuser les froisse ; vous pouvez aussi proposer une alliance. Vos coureurs appellent la voiture quand ils ont besoin d'une décision (à bloc, un adversaire qui ne relaie pas, de bonnes jambes dans le final) : sans réponse en 6 minutes de course, ils décident seuls. Dans une échappée, vous pouvez demander à tous de rouler ou passer un pacte (« je roule pour ton général, tu me laisses l'étape ») ; un pacte peut être trahi, et le rompre vous-même se paie. Après l'arrivée, le résumé de l'étape se copie pour être partagé.",
  ],
  [
    "Image de l'équipe",
    "Vos résultats forgent une identité (grimpeurs, sprint, classiques, chrono, baroudeurs, formation) visible dans Gestion. Les coureurs du même profil signent plus volontiers et moins cher, et une identité forte aide à renégocier le sponsor. Elle s'estompe un peu chaque hiver.",
  ],
  [
    'Mercato et rivaux',
    'Marché → Mercato : tous les mouvements du peloton et les rumeurs de presse. Une rumeur peut se confirmer en fin de saison, y compris pour vos coureurs en fin de contrat : prolongez-les à temps. Stats → Rivaux suit semaine après semaine les équipes qui vous entourent au classement UCI.',
  ],
  [
    "L'adjoint",
    'Dans Gestion, déléguez ce que vous voulez (entraînement, contrats, recrutement, académie, presse, matériel, staff). Chaque écran a aussi son bouton 🧑‍💼 pour une décision ponctuelle.',
  ],
];
