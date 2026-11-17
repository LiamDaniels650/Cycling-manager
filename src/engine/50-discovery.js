/* Découverte progressive : en début de partie, certains systèmes sont confiés à l'adjoint et cachés, puis
   débloqués au fil de la première saison, chacun avec une explication. Activée seulement pour une nouvelle partie
   lancée depuis l'écran de départ (S.disco) : les anciennes sauvegardes et les tests n'en ont pas. */

// k : clé du système ; w : semaine de jeu (comptée depuis le début de la partie) où il se débloque ;
// auto : domaines de l'adjoint qui le gèrent en attendant.
const DISCO = [
  {
    k: 'press',
    w: 6,
    lbl: '📰 La presse',
    auto: ['press'],
    txt: 'Les journalistes vous sollicitent après les courses. Vos réponses font la notoriété de l’équipe et le moral des coureurs (menu Presse).',
  },
  {
    k: 'plan',
    w: 9,
    lbl: '📅 La planification de saison',
    auto: [],
    txt: 'Préparez le programme de chaque coureur : jours de course, pics de forme, Grands Tours (Calendrier → Planification).',
  },
  {
    k: 'staff',
    w: 13,
    lbl: '👔 Le staff',
    auto: ['staff'],
    txt: 'Entraîneurs, médecins et recruteurs : ils font progresser, soignent et dénichent les talents. Ils coûtent cher (Gestion → Staff).',
  },
  {
    k: 'equip',
    w: 18,
    lbl: '🚲 Les équipementiers',
    auto: ['equip'],
    txt: 'Vélos de route, de chrono, pneus : chaque marque a ses points forts et vous verse plus ou moins (Gestion → Équipementiers).',
  },
  {
    k: 'stories',
    w: 24,
    lbl: '📖 Les histoires et les relations',
    auto: [],
    txt: 'Rivalités, coqs dans la même équipe, pépites, vieux lions : les coureurs vivent leur saison, et vos décisions comptent (menu Histoires).',
  },
  {
    k: 'aca',
    w: 53,
    lbl: '🎓 L’académie',
    auto: ['academy'],
    txt: 'Recrutez des jeunes, formez-les et faites-les passer pros quand ils sont prêts (menu Académie).',
  },
];
// Lance la découverte progressive (nouvelle partie) : l'adjoint prend les domaines verrouillés.
function discoStart() {
  S.disco = { s0: S.season, open: {}, set: [] };
  for (const d of DISCO)
    for (const a of d.auto)
      if (!(S.auto && S.auto[a])) {
        setAuto(a, true);
        S.disco.set.push(a);
      }
}
// Le système k est-il visible ? (toujours vrai sans découverte progressive)
function discoOpen(k) {
  return !S.disco || !!S.disco.open[k];
}
// Ouvre un système : l'adjoint rend la main sur ce qu'il gérait à sa place (sauf en mode essentiel).
function discoUnlock(d, quiet) {
  S.disco.open[d.k] = true;
  for (const a of d.auto)
    if (S.disco.set.includes(a) && !(S.simple && ['press', 'equip', 'staff'].includes(a))) setAuto(a, false);
  if (!quiet)
    msg(`🔓 Nouveau : ${d.lbl}`, d.txt + '<br><br>L’adjoint s’en occupait jusqu’ici ; c’est désormais à vous.');
}
// Chaque semaine : débloque ce qui arrive à échéance.
function discoWeekly() {
  if (!S.disco) return;
  const t = (S.season - S.disco.s0) * 52 + S.week;
  for (const d of DISCO) if (!S.disco.open[d.k] && t >= d.w) discoUnlock(d);
}
// Tout débloquer d'un coup (Options).
function discoAll() {
  if (!S.disco) return;
  for (const d of DISCO) if (!S.disco.open[d.k]) discoUnlock(d, true);
}
// Prochain système à venir : [libellé, semaines restantes] (accueil).
function discoNext() {
  if (!S.disco) return null;
  const t = (S.season - S.disco.s0) * 52 + S.week;
  const d = DISCO.find(x => !S.disco.open[x.k]);
  return d ? [d.lbl, Math.max(0, d.w - t)] : null;
}
