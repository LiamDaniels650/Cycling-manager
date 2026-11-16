/* Bilans de fin de saison : bilan individuel des coureurs et bilan « pourquoi » de l'équipe (lecture seule de la
   saison qui s'achève, sans hasard). */

// Bilan individuel de la saison pour les coureurs du joueur (à partir de la ligne de carrière de la saison).
function seasonReview() {
  const rows = [];
  for (const id of S.teams[0].riders.concat(S.academy)) {
    const r = S.riders[id];
    if (!r || !r.career || !r.career.length) continue;
    const cur = r.career[r.career.length - 1];
    if (cur.s !== S.season || !cur.d) continue;
    const prev = r.career.length > 1 ? r.career[r.career.length - 2] : null;
    rows.push({
      id,
      d: cur.d,
      w: cur.w,
      p: cur.p,
      u: cur.u,
      ov: cur.ov,
      dov: prev ? cur.ov - prev.ov : null,
      goal: r.goal && r.goal.s === S.season ? { k: r.goal.k, ok: !!r.goal.done } : null,
    });
  }
  rows.sort((a, b) => b.u - a.u || b.w - a.w);
  S.review = { s: S.season, rows };
  if (rows.length) {
    const nm = x => riderName(S.riders[x.id]);
    const prog = rows.filter(x => x.dov != null).sort((a, b) => b.dov - a.dov)[0];
    msg(
      `📋 Bilan individuel ${S.season}`,
      `Meilleur coureur : <b>${nm(rows[0])}</b> (${rows[0].u} pts UCI, ${rows[0].w} victoire(s)).` +
        (prog && prog.dov > 0 ? `<br>Plus forte progression : ${nm(prog)} (+${prog.dov} de niveau global).` : '') +
        `<br>Détail par coureur : Stats → Bilan.`
    );
  }
  return S.review;
}
// Bilan « pourquoi » de la saison : ce qui explique le classement, la confiance du sponsor et les finances.
// (aucun hasard : simple lecture de la saison qui s'achève)
function seasonWhy(myRank, why0, objLines, objMoney) {
  const P = S.teams[0];
  const L = [];
  const pts = P.uci || 0;
  const evo = why0.rank ? why0.rank - myRank : 0;
  L.push(
    `🏁 <b>${myRank}e</b> sur ${S.teams.length} au classement UCI (${pts} pts)${why0.rank ? ` — ${evo > 0 ? `${evo} place(s) gagnée(s)` : evo < 0 ? `${-evo} place(s) perdue(s)` : 'même rang'} par rapport à la saison passée` : ''}.`
  );
  const rows = (S.review && S.review.s === S.season ? S.review.rows : []).filter(x => x.u > 0);
  if (rows.length && pts > 0) {
    const nm = x => riderName(S.riders[x.id]);
    const top = rows.slice(0, 3).map(x => `${nm(x)} ${Math.round((x.u / pts) * 100)} %`);
    const share = rows[0].u / pts;
    L.push(
      `📊 D'où viennent les points : ${top.join(', ')}${share >= 0.4 ? ` — <b>forte dépendance à ${nm(rows[0])}</b> : une blessure ou un départ coûterait cher` : rows.length >= 6 && share < 0.25 ? ' — points bien répartis' : ''}.`
    );
  }
  const wins = seasonWins(0);
  const winners = (S.review && S.review.rows ? S.review.rows : []).filter(x => x.w > 0);
  L.push(
    wins
      ? `🏆 ${wins} victoire(s) : ${winners.map(x => `${riderName(S.riders[x.id])} (${x.w})`).join(', ')}.`
      : '🏆 Aucune victoire : il manque un coureur capable de conclure (sprinteur ou puncheur de premier plan).'
  );
  const ok = objLines.filter(t => t.startsWith('✅')).length;
  const dc = S.conf - why0.conf;
  L.push(
    `🤝 Objectifs du sponsor : ${ok}/${objLines.length} atteints (primes d’objectifs et de classement : ${fmtMoney(objMoney)}) — confiance ${why0.conf} → ${S.conf} (${dc >= 0 ? '+' : ''}${dc})${S.conf < 35 ? ' : <b>le contrat est menacé au prochain renouvellement</b>' : S.conf >= 60 ? ' : il prolongera volontiers, avec une hausse' : ''}.`
  );
  const f = S.fin && S.fin[S.season];
  if (f) {
    const inc = f.spons + f.prize + (f.equip || 0);
    const exp = f.sal + f.staff + f.other + f.aca + f.transf; // négatifs
    const parts = /** @type {[string, number][]} */ ([
      ['salaires', -f.sal],
      ['staff', -f.staff],
      ['courses et stages', -f.other],
      ['académie', -f.aca],
      ['transferts', -f.transf],
    ]);
    parts.sort((a, b) => b[1] - a[1]);
    L.push(
      `💶 Recettes ${fmtMoney(Math.round(inc))} (sponsor ${Math.round((f.spons / Math.max(1, inc)) * 100)} %, primes de course ${fmtMoney(Math.round(f.prize))}) ; dépenses ${fmtMoney(Math.round(-exp))}, dont ${parts[0][0]} ${Math.round((parts[0][1] / Math.max(1, -exp)) * 100)} % — solde de la saison ${inc + exp >= 0 ? '+' : ''}${fmtMoney(Math.round(inc + exp))}.`
    );
  }
  const prog = (S.review && S.review.rows ? S.review.rows : []).filter(x => x.dov != null);
  if (prog.length) {
    const avg = prog.reduce((a, x) => a + x.dov, 0) / prog.length;
    const best = prog.slice().sort((a, b) => b.dov - a.dov)[0];
    L.push(
      `📈 Progression de l'effectif : ${avg >= 0 ? '+' : ''}${avg.toFixed(1)} de niveau global en moyenne${best.dov > 0 ? ` (meilleure : ${riderName(S.riders[best.id])} +${best.dov})` : ''}${avg < 0 ? ' — effectif vieillissant : pensez aux jeunes' : ''}.`
    );
  }
  const busy = (S.review && S.review.rows ? S.review.rows : []).filter(x => x.d >= 80);
  if (busy.length)
    L.push(
      `😮‍💨 Trop de jours de course pour ${busy.map(x => `${riderName(S.riders[x.id])} (${x.d})`).join(', ')} : au-delà de 75, la forme plafonne plus bas.`
    );
  const w = why0.wt;
  if (w)
    L.push(
      `🪪 ${w.member ? 'WorldTour' : 'ProTeam'} : ${w.rk}e du classement des licences (saison ${w.y}/${WT_CYCLE} du cycle)${w.y >= WT_CYCLE ? ' — licences réattribuées : voir le message dédié' : w.rk > WT_N ? ' — sous la ligne de licence' : w.rk > WT_N - 3 ? ' — juste au-dessus de la ligne' : ''}.`
    );
  S.seasonWhy = S.seasonWhy || {};
  S.seasonWhy[S.season] = L;
  msg(`🔎 Pourquoi cette saison ${S.season}`, L.join('<br>'));
  return L;
}
// Moments forts de la saison de l'équipe du joueur : plus belles victoires et coureur de l'année.
function seasonHighlights() {
  const mine = S.teams[0].riders.map(id => S.riders[id]).filter(Boolean);
  const wins = [];
  for (const r of mine)
    for (const p of r.palm || [])
      if (p.s === S.season && p.k === 1 && !/espoirs|juniors/i.test(p.e)) wins.push({ r, p });
  const cat = p => {
    const c = S.cal.find(c => c.name === p.r);
    return c ? c.cat : 2;
  };
  wins.sort(
    (a, b) =>
      cat(a.p) - cat(b.p) || (/général|Classement/i.test(b.p.e) ? 1 : 0) - (/général|Classement/i.test(a.p.e) ? 1 : 0)
  );
  const best = mine.slice().sort((a, b) => (b.stats.pts || 0) - (a.stats.pts || 0))[0];
  let h = '';
  if (wins.length)
    h += `<br><br><b>Moments forts</b> :<br>${wins
      .slice(0, 5)
      .map(w => `🏆 ${riderName(w.r)} — ${w.p.r}, ${w.p.e.toLowerCase()}`)
      .join('<br>')}`;
  if (best && best.stats.pts)
    h += `<br><b>Coureur de la saison</b> : ${riderName(best)} (${best.stats.pts} pts UCI, ${best.stats.wins || 0} victoire(s)).`;
  return h;
}
