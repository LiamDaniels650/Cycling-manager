// Ordres en course expliqués : ce que fait chaque ordre radio, ce qu'il coûte, quand l'utiliser ; et ce que fait
// un coureur en ce moment (lu dans l'état de la simulation). Pur affichage : les ordres restent ceux du moteur.

// Groupes d'ordres radio (ordre d'affichage) et explication de chacun.
export const RADIO_GROUPS = [
  ['Attaquer', ['attack', 'bridge', 'mark']],
  ['Rouler', ['chase', 'tempo', 'front']],
  ['Économiser', ['stop', 'nopull', 'pace', 'wait']],
  ['Ravitaillement', ['eat', 'bottles']],
  ['Annuler', ['reset']],
];
export const RADIO_HELP = {
  attack: {
    ic: '⚡',
    short: 'Attaquer',
    d: 'Part seul ou avec quelques coureurs. Coûte beaucoup de jus : impossible sous ~30 %.',
  },
  bridge: {
    ic: '🌉',
    short: 'Rejoindre devant',
    d: 'Effort court et violent pour boucher le trou vers le groupe de devant.',
  },
  mark: { ic: '👀', short: 'Marquer un favori', d: 'Reste dans sa roue et répond à ses attaques.' },
  chase: { ic: '🔥', short: 'Chasser', d: 'Mène le groupe à fond pour reprendre ceux de devant. Vide le fond.' },
  tempo: { ic: '🚂', short: 'Tempo', d: 'Mène à un rythme soutenu : décourage les attaques, use les autres.' },
  front: {
    ic: '⬆️',
    short: 'Se placer devant',
    d: 'Remonte en tête du groupe (20 min) avant pavés, vent ou sprint. Coûte un peu.',
  },
  stop: { ic: '✋', short: 'Arrêter de rouler', d: 'Ne mène plus : économise et laisse les autres travailler.' },
  nopull: {
    ic: '🧊',
    short: 'Ne plus relayer',
    d: 'Dans un petit groupe, reste dans les roues pour garder des forces pour le final.',
  },
  pace: { ic: '🧗', short: 'À ton rythme', d: 'En montée, lâche prise volontairement pour ne pas exploser.' },
  wait: { ic: '🤝', short: 'Attendre le leader', d: "Se laisse rejoindre par son leader pour l'aider à revenir." },
  eat: { ic: '🍫', short: 'Manger', d: "Prend une barre en poche : remonte l'alimentation." },
  bottles: {
    ic: '🍶',
    short: 'Aller aux bidons',
    d: "Redescend à la voiture pour ravitailler l'équipe. Perd du temps. Interdit dans les 20 derniers km.",
  },
  reset: { ic: '↩️', short: "Consigne d'avant-course", d: "Annule l'ordre radio en cours." },
};
// Ce que fait le coureur en ce moment, en une phrase courte.
export function doingNow(sim, x) {
  if (x.dnf) return 'abandon';
  if (x.fin) return `arrivé ${sim.finish.indexOf(x) + 1}e`;
  const G = x.g;
  if (!G) return '—';
  if (G.attacker === x && G.burst > 0) return '⚡ en pleine attaque';
  if (x.bonk) return '🍌 en fringale';
  if (x.sitUp) return 'se relève, garde des forces';
  if (x.radio === 'wait') return 'attend son leader';
  if (x.frontUntil > sim.t) return 'remonte en tête du groupe';
  if (x.work >= 0.75) return '🔥 mène le groupe à bloc';
  if (x.work > 0) return 'prend des relais';
  if (x.markId && S.riders[x.markId]) return `marque ${riderName(S.riders[x.markId])}`;
  if (x.ownPace != null && sim.t - x.ownPace < 3) return 'monte à son rythme';
  if (x.punch < 25) return 'dans le rouge, plus de jus';
  if (G.riders.length < 2) return 'seul';
  return x.pos >= 70
    ? 'abrité, bien placé devant'
    : x.pos <= 30
      ? 'abrité, en queue de groupe'
      : 'abrité dans les roues';
}
// Libellé de la consigne d'avant-course et son explication.
export function orderInfo(x) {
  const o = ORDERS[x.order];
  return o ? { lbl: o.lbl, d: o.d } : { lbl: x.order, d: '' };
}
