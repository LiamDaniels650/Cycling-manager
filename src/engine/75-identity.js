/* Identité des équipes de l'ordinateur. Chaque équipe a un projet sportif qui guide sa construction :
   - grands tours : un leader de classement général, des grimpeurs et des rouleurs pour l'entourer ;
   - classiques : Flandriens et puncheurs, des rouleurs pour les placer ;
   - sprint : un ou deux sprinteurs et leur train de rouleurs ;
   - échappées : baroudeurs, puncheurs et grimpeurs qui vivent des coups de loin (souvent les petites équipes) ;
   - super-équipe : l'équipe la plus riche, qui gagne partout (leader de grand tour, sprinteur, hommes de classiques).
   L'identité vient du style de jeu de l'équipe (55-directors.js) ; la super-équipe est celle au plus haut standing.
   Elle oriente : les vedettes du monde de départ, le recrutement (marché libre, transferts, néo-pros : un coureur
   du profil qui manque vaut 3 points de plus aux yeux de l'équipe) et l'envie d'échappée des petites équipes. */

const IDENT = {
  super: {
    lbl: 'Super-équipe',
    d: 'Le plus gros budget du peloton : un leader de grand tour, un sprinteur, des hommes de classiques.',
    stars: { complet: 40, sprinteur: 25, puncheur: 15, flahute: 15, grimpeur: 5 },
    need: { complet: 2, grimpeur: 4, sprinteur: 1, flahute: 2, puncheur: 2, rouleur: 4 },
  },
  gt: {
    lbl: 'Grands tours',
    d: 'Tout pour le classement général : un leader, des grimpeurs et des rouleurs pour l’entourer.',
    stars: { complet: 55, grimpeur: 35, puncheur: 10 },
    need: { complet: 2, grimpeur: 5, rouleur: 4 },
  },
  classiques: {
    lbl: 'Classiques',
    d: 'Les pavés et les côtes du printemps : Flandriens et puncheurs, des rouleurs pour les placer.',
    stars: { flahute: 45, puncheur: 35, sprinteur: 10, complet: 10 },
    need: { flahute: 4, puncheur: 3, rouleur: 4 },
  },
  sprint: {
    lbl: 'Sprint',
    d: 'Un ou deux sprinteurs et leur train : la victoire d’étape au sprint avant tout.',
    stars: { sprinteur: 60, flahute: 20, rouleur: 20 },
    need: { sprinteur: 2, rouleur: 6 },
  },
  echappees: {
    lbl: 'Échappées',
    d: 'Faute de leader, elle fait la course de loin : baroudeurs, puncheurs et grimpeurs.',
    stars: { baroudeur: 40, puncheur: 30, grimpeur: 30 },
    need: { baroudeur: 4, puncheur: 3, grimpeur: 3 },
  },
};
const STYLE_IDENT = { gc: 'gt', defensif: 'gt', sprint: 'sprint', agressif: 'classiques', opportuniste: 'echappees' };
// La super-équipe : l'équipe de l'ordinateur au plus haut standing.
function superTeam() {
  let best = null;
  for (const T of S.teams) if (!T.player && (!best || T.tier > best.tier)) best = T;
  return best;
}
function identOf(T) {
  if (!T || T.player) return null;
  if (T === superTeam()) return 'super';
  return STYLE_IDENT[T.style] || 'echappees';
}
// Poids des profils de vedettes au départ (monde de départ).
function identStars(T) {
  const k = identOf(T);
  return k ? Object.entries(IDENT[k].stars) : null;
}
// Bonus de recrutement : le coureur a-t-il le profil qui manque à l'équipe ?
function aiWant(T, r) {
  const k = identOf(T);
  if (!k || !r) return 0;
  const need = IDENT[k].need[r.arch] || 0;
  if (!need) return 0;
  let n = 0;
  for (const id of T.riders) if (S.riders[id] && S.riders[id].arch === r.arch) n++;
  return n < need ? 3 : 0;
}
// Course par étapes, passé le premier tiers : une équipe sans victoire d'étape veut sauver sa course.
function identHungry(rc, T) {
  if (!rc || T.player || rc.specs.length < 5 || rc.si < rc.specs.length / 3) return false;
  return !rc.stageRes.some(st => st.res[0] && S.riders[st.res[0].id] && S.riders[st.res[0].id].team === T.id);
}
// Petites équipes : plus d'envie de prendre l'échappée (elles vivent de leur visibilité).
function identBreakMul(T) {
  if (!T || T.player) return 1;
  return T.tier < -1 ? 1.25 : 1;
}
