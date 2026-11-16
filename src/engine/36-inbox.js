/* Boîte de réception du joueur : messages (regroupés par sujet et par semaine) et tri des messages importants. */

// Ajoute un message dans la boîte de réception du joueur.
function msg(title, body) {
  // même sujet la même semaine : un seul message qui regroupe tout (fins de contrat, signatures…)
  const m0 = S.inbox[0];
  if (m0 && !m0.read && m0.title === title && m0.w === S.week && m0.season === S.season) {
    m0.body += '<br>' + body;
    m0.n = (m0.n || 1) + 1;
    return;
  }
  S.inbox.unshift({
    id: S.nextMsg++,
    w: S.week,
    season: S.season,
    title,
    body,
    read: false,
    imp: msgImportant(title, body),
  });
  if (S.inbox.length > 120) S.inbox.length = 120;
}
// Messages qui demandent l'attention du directeur sportif (le reste est de l'information).
const MSG_IMP =
  /sponsor|licenci|offre|augmentation|bless|courtisé|plafond|confiance|fin de saison|bilan individuel|objectif|effectif minimum|équipementier|contrat|stagiaire|pré-contrat|veut partir|mécontent|surmen|recrut|❌|⚠️|🏆|surpren/i;
function msgImportant(title, body) {
  return MSG_IMP.test(title) || /⚠️|❌/.test(body);
}
