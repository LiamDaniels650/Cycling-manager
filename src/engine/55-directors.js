/* Les directeurs sportifs adverses : chaque équipe de l'ordinateur a un directeur avec un nom, un âge, un
   caractère (rancunier, pragmatique, loyal), le style de jeu de l'équipe, une mémoire de ce que je lui ai fait
   (pactes trahis ou tenus, alliances refusées ou acceptées, coureurs pris) et deux courses objectifs par saison.
   Identité tirée d'une empreinte de l'équipe (aucun tirage : la génération du monde ne change pas). */

const DS_TEMPER = {
  rancunier: { lbl: 'Rancunier', d: "N'oublie rien : un affront compte double, il vous le fera payer en course." },
  pragmatique: { lbl: 'Pragmatique', d: 'Les affaires avant tout : il pardonne vite si vous lui êtes utile.' },
  loyal: { lbl: 'Loyal', d: 'Fidèle en affaires : un service rendu compte double.' },
};
const DS_STYLE_LBL = {
  gc: 'bâtisseur de grands tours',
  agressif: 'offensif, il fait la course',
  defensif: 'prudent, il verrouille la course',
  sprint: 'homme de sprint',
  opportuniste: 'opportuniste',
};
function dsHash(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
// Le directeur d'une équipe de l'ordinateur (créé à la première demande, stable d'une partie à l'autre).
function dsOf(T) {
  if (!T || T.player) return null;
  if (!T.ds) {
    const N = NATS[T.natBias] || NATS.FRA;
    const h = dsHash(T.name);
    const tempers = Object.keys(DS_TEMPER);
    T.ds = {
      fn: N.fn[h % N.fn.length],
      ln: N.ln[(h >>> 8) % N.ln.length],
      age: 38 + ((h >>> 16) % 25),
      temper: tempers[(h >>> 4) % tempers.length],
      mem: [],
      goals: [],
    };
  }
  return T.ds;
}
const dsName = T => {
  const d = dsOf(T);
  return d ? `${d.fn} ${d.ln}` : '';
};
// Relation avec une équipe qui bouge : le caractère du directeur amplifie ou atténue, et il s'en souvient.
function dsRemember(T, v, txt) {
  const d = dsOf(T);
  if (!d) return v;
  let k = 1;
  if (v < 0) k = d.temper === 'rancunier' ? 1.5 : d.temper === 'pragmatique' ? 0.7 : 1;
  else k = d.temper === 'loyal' ? 1.3 : 1;
  if (txt) {
    d.mem.push({ s: S.season, txt, v: Math.sign(v) });
    if (d.mem.length > 8) d.mem.shift();
  }
  return v * k;
}
// Rancune en course : un directeur rancunier, fâché avec moi, fait rouler ses hommes derrière mon échappée.
function dsGrudgeChase(sim, T, G, out) {
  const d = T.player ? null : dsOf(T);
  if (!d || d.temper !== 'rancunier' || teamRelOf(T.id) > -2 || G !== sim.pel) return out;
  if (!G.riders.some(y => y.team === T && !y.fin)) return out;
  const mine = sim.groups.some(H => H !== G && H.pos > G.pos + 0.03 && H.riders.some(y => y.player && !y.fin));
  if (!mine) return out;
  sim.grudgeLog = sim.grudgeLog || {};
  if (!sim.grudgeLog[T.id]) {
    sim.grudgeLog[T.id] = true;
    log(sim, `🗡️ ${T.name} roule derrière votre échappée : ${dsName(T)} n'a pas oublié.`, 'bad');
    highlight(sim, `🗡️ ${T.name} vous fait payer la rancune de son directeur`, true);
  }
  return [Math.max(out[0], 0.86), Math.max(out[1], 2)];
}
// Objectifs de la saison : deux courses choisies selon le style du directeur (grand tour pour un bâtisseur,
// classiques pour un offensif, plat pour un homme de sprint…), en dehors des Mondiaux.
function dsSeasonGoals() {
  for (const T of S.teams) {
    const d = dsOf(T);
    if (!d) continue;
    const fit = c => {
      const ty = c.stagesSpec.map(s => s[0]);
      const n = ty.length;
      const share = k => ty.filter(t => t === k).length / n;
      if (T.style === 'gc') return c.cat === 0 ? 3 : n > 1 ? 2 + share('montagne') : 0;
      if (T.style === 'sprint') return share('plat') * 2 + (c.cat <= 1 ? 1 : 0);
      if (T.style === 'agressif') return (n === 1 ? 2 : 0) + share('vallonne') + share('paves') * 2;
      if (T.style === 'defensif') return n > 1 && c.cat <= 1 ? 2 : 0.5;
      return (n === 1 ? 1.5 : 0.5) + share('punch');
    };
    const L = S.cal
      .filter(c => !c.worlds && (!c.inv || c.inv.includes(T.id)))
      .map(c => [c, fit(c) + (dsHash(T.name + c.key + S.season) % 100) / 200])
      .sort((a, b) => b[1] - a[1]);
    d.goals = L.slice(0, 2).map(([c]) => c.key);
    d.gs = S.season;
  }
}
// Course objectif d'une équipe : ses coureurs ont préparé le rendez-vous (forme du jour un peu plus haute).
function dsGoalBoost(rc, T) {
  const d = T && !T.player ? dsOf(T) : null;
  if (d && d.gs !== S.season) dsSeasonGoals(); // nouvelle saison (ou ancienne sauvegarde) : objectifs à fixer
  return d && d.goals.includes(rc.key) ? 2 : 0;
}
// Au départ d'une course où je suis engagé : les directeurs qui en ont fait leur objectif l'annoncent.
function dsAnnounce(sim) {
  if (!sim.runners.some(x => x.player)) return;
  const said = new Set();
  for (const x of sim.runners) {
    const T = x.team;
    if (T.player || said.has(T.id) || !dsGoalBoost(sim.rc, T)) continue;
    said.add(T.id);
    const d = dsOf(T);
    const q =
      d.temper === 'rancunier' && teamRelOf(T.id) <= -1
        ? '« Cette course, on la veut. Et on n’a rien oublié. »'
        : T.style === 'gc'
          ? '« Toute la saison est tournée vers ce rendez-vous. »'
          : T.style === 'sprint'
            ? '« Le train est prêt, on vient pour gagner. »'
            : '« C’est notre objectif de l’année, on sera devant. »';
    log(sim, `🎙️ ${dsName(T)}, directeur ${/^[AEIOUYÉÈH]/.test(T.name) ? "d'" : 'de '}${T.name} : ${q}`, 'info');
  }
}
