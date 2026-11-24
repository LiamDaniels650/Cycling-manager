/* Bilan tactique d'une étape et d'une course par étapes, en plus du bilan existant (lâchés, sprint, échappée,
   moments décisifs, notes des coureurs) :
   - ce que l'ordinateur a fait contre vous : rancunes, alliances et coalitions, poursuites derrière vos coureurs ;
   - vos consignes : le travail de vos équipiers (km en tête), les attaques, les refus et désobéissances ;
   - où le général se joue (course par étapes) : les étapes où votre meilleur coureur a perdu ou repris du temps sur
     le leader, et l'étape qui a fait le vainqueur.
   Lecture seule : rien ici ne change la course. */

const TAC_AI = /^(🗡️|🤝 Alliance de poursuite|⚔️ Coalition|🎯)/;
// Notes tactiques d'une étape (gardées avec le résultat de l'étape).
function tacticalNotes(sim) {
  const myTeam = S.teams[0];
  const ai = (sim.log || [])
    .filter(
      l => TAC_AI.test(l.txt) || (l.cls === 'bad' && /votre|vos /.test(l.txt) && /roule|chasse|marque/.test(l.txt))
    )
    .filter(l => !/vos équipiers prennent/.test(l.txt))
    .slice(-4)
    .map(l => ({ km: Math.round(l.km), txt: l.txt.replace(/<[^>]+>/g, '') }));
  const mine = sim.runners.filter(x => x.player || (myTeam && x.team === myTeam && !x.player && x.r.team === 0));
  const work = mine
    .filter(x => x.st && x.st.kw >= 3)
    .sort((a, b) => b.st.kw - a.st.kw)
    .slice(0, 4)
    .map(x => ({ id: x.id, km: Math.round(x.st.kw) }));
  const att = mine.filter(x => x.st && x.st.att > 0).map(x => ({ id: x.id, n: x.st.att }));
  const refused = [...new Set([...(sim.refusals ? [...sim.refusals] : []), ...(sim.disob || [])])];
  return { ai, work, att, refused };
}
// Où le général se joue : écart de chaque étape entre mon meilleur coureur au général et le leader actuel.
function gcStory(rc) {
  if (!rc || rc.specs.length < 2 || !rc.stageRes.length) return null;
  const g = gcList(rc);
  const me = g.find(id => S.riders[id] && S.riders[id].team === 0);
  const lead = g[0];
  if (me == null || lead == null) return null;
  const gapOf = (st, id) => {
    const e = st.res.find(y => y.id === id);
    return e ? e.gap || 0 : null;
  };
  const rows = rc.stageRes
    .map((st, k) => {
      const a = gapOf(st, me),
        b = gapOf(st, lead);
      return a == null || b == null ? null : { k: k + 1, name: st.name, d: Math.round(a - b), type: st.type };
    })
    .filter(Boolean);
  const loss = rows
    .filter(r => r.d > 5)
    .sort((a, b) => b.d - a.d)
    .slice(0, 2);
  const gain = rows
    .filter(r => r.d < -5)
    .sort((a, b) => a.d - b.d)
    .slice(0, 1);
  // l'étape qui a fait le leader : celle où il a pris le plus de temps à son dauphin
  let made = null;
  if (g[1] != null) {
    const r2 = rc.stageRes
      .map((st, k) => ({ k: k + 1, name: st.name, d: Math.round((gapOf(st, g[1]) || 0) - (gapOf(st, lead) || 0)) }))
      .sort((a, b) => b.d - a.d)[0];
    if (r2 && r2.d > 10) made = r2;
  }
  return { me, lead, isLead: me === lead, total: Math.round(rc.gc[me] - rc.gc[lead]), loss, gain, made };
}
