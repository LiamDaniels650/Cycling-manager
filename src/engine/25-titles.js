/* Titres nationaux. */
// Champions nationaux : au Championnat national, le mieux classé de chaque nation remporte le titre de son pays.
function nationalTitles(rc, gcl) {
  const seen = new Set();
  const mine = [];
  for (const id of gcl) {
    const r = S.riders[id];
    if (!r || seen.has(r.nat)) continue;
    seen.add(r.nat);
    r.natChamp = S.season;
    palmAdd(id, rc.name, 'Champion ' + natAdj(r.nat), 1);
    if (r.team === 0) mine.push(riderName(r));
  }
  if (mine.length)
    msg(
      '🏅 Champion national',
      `${mine.join(', ')} ${mine.length > 1 ? 'portent' : 'porte'} désormais le maillot de champion national pour un an.`
    );
}
const NAT_ADJ = {
  FRA: 'de France',
  BEL: 'de Belgique',
  NED: 'des Pays-Bas',
  ITA: "d'Italie",
  ESP: "d'Espagne",
  GER: "d'Allemagne",
  DEN: 'du Danemark',
  GBR: 'de Grande-Bretagne',
  COL: 'de Colombie',
  POL: 'de Pologne',
  SLO: 'de Slovénie',
  SUI: 'de Suisse',
  NOR: 'de Norvège',
  AUS: "d'Australie",
};
function natAdj(n) {
  return NAT_ADJ[n] || n;
}
// Le coureur porte-t-il le maillot de champion national (jusqu'au championnat suivant) ?
function wearsNatChamp(r) {
  if (!r || r.natChamp == null) return false;
  const c = S.cal.find(x => x.key === 'natio');
  return r.natChamp === S.season || (r.natChamp === S.season - 1 && !!c && !c.done);
}
