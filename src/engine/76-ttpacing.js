/* Gestion de l'effort en contre-la-montre individuel. Le directeur sportif choisit une allure pour chaque coureur :
   - prudent : économiser pour les jours suivants (grand tour) ;
   - régulier : un effort constant, un peu sous la limite ;
   - à bloc : tout donner du départ à l'arrivée ;
   - départ prudent, fin à bloc (« split négatif ») : la gestion des spécialistes sur un long chrono ;
   - tout pour la montée : récupérer sur le plat, tout donner dans la montée (chrono qui finit en côte).
   Chaque coureur a une allure tenable (sa limite) qui dépend de son endurance, de sa spécialité, de la distance et
   de sa fraîcheur, avec une petite incertitude du jour : personne ne connaît exactement sa limite. Au-dessus, une
   réserve se vide ; à sec, il « explose » et finit nettement sous sa limite (la vraie raison de partir moins vite).
   Les temps intermédiaires (au tiers et aux deux tiers) sont gardés pour le bilan. */

const TT_PACE = {
  prudent: {
    lbl: 'Prudent (économiser)',
    d: 'Bien sous sa limite : du temps perdu, des forces gardées pour la suite.',
  },
  gerer: { lbl: 'Régulier', d: 'Un effort constant, un peu sous la limite : sans risque.' },
  fond: { lbl: 'À bloc', d: 'Tout donner dès le départ : le plus rapide… si la limite tient jusqu’au bout.' },
  negatif: {
    lbl: 'Départ prudent, fin à bloc',
    d: 'Se garder sur la première moitié, tout donner ensuite : sûr sur un long chrono.',
  },
  montee: {
    lbl: 'Tout pour la montée',
    d: 'Récupérer sur le plat, tout donner dans la montée : pour un chrono qui finit en côte.',
  },
};
// Intensité visée (part de la capacité) selon l'allure, l'avancement (0-1) et la pente.
function ttIntensity(mode, frac, g) {
  if (mode === 'prudent') return 0.86;
  if (mode === 'gerer') return 0.9;
  if (mode === 'negatif') return frac < 0.55 ? 0.93 : 0.97;
  if (mode === 'montee') return g >= 3 ? 1.0 : 0.905;
  return 0.975;
}
// Allure tenable sans exploser (part de la capacité), incertitude du jour comprise.
function ttLimit(r, dist) {
  return (
    0.96 +
    ((r.s.end || 70) - 70) * 0.0012 +
    ((r.s.clm || 70) - 70) * 0.0005 -
    Math.max(0, dist - 25) * 0.0008 -
    (r.fatigue || 0) / 4000 +
    gauss() * 0.012
  );
}
const TT_DRAIN = 5000; // vidange de la réserve par unité d'intensité au-dessus de la limite et par heure
// Le chrono finit-il en côte (dernier tiers en montée) ?
function ttClimbFinish(P) {
  const i0 = Math.floor(P.n * 0.66);
  let up = 0;
  for (let i = i0; i < P.n; i++) if (P.g[i] >= 3) up++;
  return up / Math.max(1, P.n - i0) >= 0.4;
}
// Allure conseillée (adjoint, équipes de l'ordinateur) : selon le parcours, la distance et le coureur.
function ttAdvice(r, spec, P, role) {
  if (role === 'equipier') return 'prudent';
  if (P && ttClimbFinish(P)) return 'montee';
  if (spec.dist > 30 && (r.s.end || 70) < 74) return 'negatif';
  return (r.s.end || 70) + (r.s.clm || 70) / 4 >= 85 || spec.dist <= 15 ? 'fond' : 'negatif';
}
