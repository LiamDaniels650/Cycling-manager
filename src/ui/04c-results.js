/* Interface — après l'étape : arrivée, analyse de mes coureurs, résumé, classements, watts des montées,
   étape suivante et fin de course. */

// Courbes des réserves de mes coureurs pendant l'étape.
function energyChart(stats, ids) {
  const cols = ['#ff6fa5', '#4fc3f7', '#ffd54f', '#81c784', '#ba68c8', '#ff8a65', '#90a4ae', '#e57373'];
  const lines = ids.filter(id => stats[id] && stats[id].cv && stats[id].cv.length > 1);
  if (!lines.length) return '';
  const W = 320,
    H = 110,
    maxN = Math.max(...lines.map(id => stats[id].cv.length));
  const X = i => 22 + (i / (maxN - 1)) * (W - 28),
    Y = v => H - 14 - (v / 100) * (H - 22);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart">${[0, 50, 100].map(v => `<line x1="22" x2="${W - 6}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/><text x="2" y="${Y(v) + 3}" class="kt">${v}</text>`).join('')}`;
  lines.forEach((id, k) => {
    s += `<polyline points="${stats[id].cv.map((v, i) => X(i) + ',' + Y(v)).join(' ')}" fill="none" stroke="${cols[k % cols.length]}" stroke-width="1.6"/>`;
  });
  s += `<text x="${W - 6}" y="${H - 2}" class="kt" text-anchor="end">km →</text></svg>`;
  return (
    s +
    `<div class="small">${lines.map((id, k) => `<span style="color:${cols[k % cols.length]}">■</span> ${esc(riderName(S.riders[id]))}`).join(' · ')}</div>`
  );
}
// Résultats d'une étape : arrivée, watts, analyse de mes coureurs, désobéissances, classements.
function viewStageResult() {
  const rc = S.rc;
  const L = UI.lastStage;
  const st = rc.stageRes[L.idx];
  const res = st.res;
  const mine = new Set(rc.sel[0]);
  let h = '';
  if (L.ttt && rc.tttLog) {
    h += `<div class="card"><h2>${esc(rc.name)}</h2><div class="mut">${esc(st.name)} — Classement des équipes</div><table class="t"><tbody>${rc.tttLog
      .map((e, i) => {
        const T = teamById(e.team);
        return `<tr class="${T.player ? 'mrow' : ''}"><td>${i + 1}</td><td><b style="color:${T.color}">■</b> ${esc(T.name)}</td><td>${i ? fmtGap(e.time - rc.tttLog[0].time) : fmtTime(e.time)}</td><td class="small mut">${e.lost ? e.lost + ' lâché(s)' : ''}${e.ldrLost ? ' · leader lâché !' : ''}</td></tr>`;
      })
      .join('')}</tbody></table></div>`;
  }
  h += stageDebriefHTML(rc, L, st, mine);
  h += `<div class="card"><h2>${esc(rc.name)}</h2><div class="mut">${esc(st.name)} — Arrivée</div><table class="t"><tbody>`;
  const show = res.map((e, i) => [e, i]).filter(([e, i]) => i < 15 || mine.has(e.id));
  let prev = -1;
  for (const [e, i] of show) {
    if (i !== prev + 1) h += `<tr><td colspan="4" class="mut">…</td></tr>`;
    prev = i;
    const r = S.riders[e.id];
    h += `<tr class="${mine.has(e.id) ? 'mrow' : ''}"><td>${i + 1}</td><td>${rlink(r)}</td><td class="small mut">${tshort(r)}</td><td>${i === 0 ? fmtTime(e.time) : fmtGap(e.gap)}</td></tr>`;
  }
  h += `</tbody></table>`;
  if (rc.specs[L.idx] && rc.specs[L.idx].rest && !rc.done)
    h += `<p class="small">🛌 Journée de repos : récupération accrue avant l'étape suivante.</p>`;
  if (st.komb) h += `<p class="small">🔥 Prix de la combativité : ${rlink(S.riders[st.komb])}</p>`;
  if (st.cut && st.cut.length)
    h += `<p class="small warn">⏱ Hors délais (éliminés) : ${st.cut.map(id => rlink(S.riders[id])).join(', ')}</p>`;
  h += `</div>`;
  if (st.stats) {
    const ids = Object.keys(st.stats).map(Number);
    h += `<div class="card"><h3>Analyse de mes coureurs</h3><div class="tw"><table class="t"><thead><tr><th>Coureur</th><th>Place</th><th>km à l'avant</th><th>km de relais</th><th>Attaques</th><th>Effort moy.</th><th>Fond final</th></tr></thead><tbody>
  ${ids
    .map(id => {
      const s = st.stats[id];
      const rk = res.findIndex(e => e.id === id) + 1;
      return `<tr><td>${rlink(S.riders[id])}</td><td>${rk || 'ab.'}</td><td>${s.kf}</td><td>${s.kw}</td><td>${s.att}</td><td>${Math.round(s.I * 100)}%</td><td>${s.e}%</td></tr>`;
    })
    .join('')}</tbody></table></div>
  <h3>Évolution des réserves (fond)</h3>${energyChart(st.stats, ids)}</div>`;
  }
  const sim = L.sim;
  if (sim) {
    const bad = new Set([...(sim.disob || []), ...(sim.refusals ? [...sim.refusals] : [])]);
    if (bad.size) {
      h += `<div class="card"><h3>Désobéissances</h3>${[...bad]
        .map(id => {
          const r = S.riders[id];
          return `<div class="row sb"><span>${rlink(r)} n'a pas respecté les consignes.</span><span><button onclick="postTalk(${id},'recadrer',this)">Recadrer</button><button onclick="this.parentNode.innerHTML='<i class=mut>ignoré</i>'">Ignorer</button></span></div>`;
        })
        .join('')}</div>`;
    }
  }
  if (rc.specs.length > 1) h += standingsCard(rc, false);
  h += summaryCard(rc, L.idx, L.sim);
  // les données de puissance, précieuses mais denses, sont repliées
  if ((st.power && st.power.length) || (st.climbs && st.climbs.length))
    h += `<details class="manage card"><summary>⚡ Puissances : étape et montées</summary>${st.power && st.power.length ? stagePowerCard(st.power) : ''}${st.climbs && st.climbs.length ? climbWattsCard(st.climbs, mine) : ''}</details>`;
  h += `<div class="card"><div class="row">${rc.done ? `<button class="pri big" onclick="closeRace()">Terminer : retour</button>` : `<button class="pri big" onclick="nextStage()">Étape suivante : ${esc(rc.specs[rc.si].name)}</button>`}</div></div>`;
  return h;
}
// Bilan de l'étape pour le directeur sportif : meilleur résultat, général, coureurs à ménager, étape suivante.
function stageDebriefHTML(rc, L, st, mine) {
  const res = st.res;
  const myRes = res.map((e, i) => [e, i]).filter(([e]) => mine.has(e.id));
  const L2 = [];
  if (myRes.length) {
    const [e, i] = myRes[0];
    L2.push(
      `🏁 Meilleur de l'équipe : <b>${esc(riderName(S.riders[e.id]))}</b>, ${i + 1}e${i ? ` (${fmtGap(e.gap)})` : ' — victoire ! 🎉'}`
    );
  }
  if (rc.specs.length > 1) {
    const g = gcList(rc);
    const k = g.findIndex(id => S.riders[id].team === 0);
    if (k >= 0)
      L2.push(
        `🟡 Au général : <b>${esc(riderName(S.riders[g[k]]))}</b>, ${k + 1}e${k ? ` à ${fmtGap(rc.gc[g[k]] - rc.gc[g[0]])}` : ' — maillot de leader !'}`
      );
  }
  if (st.stats) {
    const tired = Object.keys(st.stats)
      .map(Number)
      .filter(id => st.stats[id].e < 15 && !rc.out[id]);
    if (tired.length && !rc.done)
      L2.push(
        `⚠️ Vidés (fond < 15 %) : ${tired.map(id => esc(riderName(S.riders[id]))).join(', ')} — à ménager demain`
      );
  }
  const out = rc.sel[0].filter(id => rc.out[id]);
  if (out.length) L2.push(`🚑 Hors course : ${out.map(id => esc(riderName(S.riders[id]))).join(', ')}`);
  // pourquoi : les incidents et décisions de course qui ont coûté (ou rapporté) du temps à mes coureurs
  const why = ((L.sim && L.sim.log) || [])
    .filter(l => l.cls === 'bad' && /^(🔧|💥|👮|⚠️ La chute)/.test(l.txt))
    .slice(-4)
    .map(l => `<span class="small">km ${Math.round(l.km)} · ${l.txt}</span>`);
  if (why.length) L2.push(`🔎 Ce qui a pesé :<br>${why.join('<br>')}`);
  if (!rc.done) {
    const nx = rc.specs[rc.si];
    L2.push(`➡️ Demain : <b>${esc(nx.name)}</b>${nx.rest ? ' (après une journée de repos)' : ''}`);
  }
  return `<div class="card"><h2>Bilan de l'étape</h2>${L2.map(t => `<div class="dbl">${t}</div>`).join('')}<div class="acts">${rc.done ? `<button class="pri" onclick="closeRace()">Terminer : retour</button>` : `<button class="pri" onclick="nextStage()">Préparer l'étape suivante</button>`}</div></div>`;
}
// Résumé de l'étape : moments clés, courbe de l'écart, texte à copier pour le partager.
function summaryCard(rc, idx, sim) {
  const L = stageSummary(rc, idx, sim);
  if (!L) return '';
  UI.sumTxt = L.join('\n');
  const [title, ...rest] = L;
  return `<div class="card"><div class="row sb"><h3>📝 Résumé</h3><button onclick="copySummary(this)">📋 Copier</button></div><div class="small"><b>${esc(title)}</b></div>${sim ? gapChart(sim) : ''}<div class="small sumtx">${rest
    .map(l => (l.startsWith('  • ') ? `<div class="mut">${esc(l.trim())}</div>` : `<div>${esc(l)}</div>`))
    .join('')}</div></div>`;
}
function copySummary(btn) {
  const t = UI.sumTxt || '';
  const done = () => (btn.textContent = '✅ Copié');
  try {
    navigator.clipboard.writeText(t).then(done, () => alertBox(t.replace(/\n/g, '<br>')));
  } catch (e) {
    alertBox(t.replace(/\n/g, '<br>'));
  }
}
function postTalk(id, k, btn) {
  const t = talkRider(id, k);
  save();
  btn.parentNode.innerHTML = `<i class="small">${t}</i>`;
}
// Classements généraux et annexes.
function standingsCard(rc, brief) {
  const g = gcList(rc);
  const mine = new Set(rc.sel[0]);
  const t0 = rc.gc[g[0]];
  const rows = g.map((id, i) => [id, i]).filter(([id, i]) => i < 10 || mine.has(id));
  let h = `<div class="card"><h3>Classement général${brief ? " (avant l'étape)" : ''}</h3><table class="t"><tbody>`;
  for (const [id, i] of rows) {
    const r = S.riders[id];
    h += `<tr class="${mine.has(id) ? 'mrow' : ''}"><td>${i + 1}</td><td>${rlink(r)}${r.age <= 25 ? ' <span class="small mut">j</span>' : ''}</td><td class="small mut">${tshort(r)}</td><td>${i === 0 ? fmtTime(t0) : fmtGap(rc.gc[id] - t0)}</td></tr>`;
  }
  h += `</tbody></table>`;
  const top = o =>
    classOrder(rc, o)
      .slice(0, 3)
      .map(id => `${riderName(S.riders[id])} (${o[id]})`)
      .join(', ');
  const yg = ygList(rc)
    .slice(0, 3)
    .map(id => `${riderName(S.riders[id])} ${fmtGap(rc.gc[id] - t0)}`)
    .join(', ');
  const tl = teamGcList(rc).slice(0, 3);
  const tg = tl
    .map(id => {
      const T = teamById(id);
      return `${T.short}${id === tl[0] ? '' : ' ' + fmtGap(rc.teamGc[id] - rc.teamGc[tl[0]])}`;
    })
    .join(', ');
  h += `<p class="small">🟢 Points : ${top(rc.pts)}<br>🔴 Montagne : ${top(rc.kom)}<br>⚪ Jeunes : ${yg || '—'}${tg ? '<br>👥 Équipes : ' + tg : ''}</p></div>`;
  return h;
}
function nextStage() {
  UI.lastStage = null;
  const rc = S.rc;
  Object.assign(rc.orders, autoOrdersKeep(rc));
  save();
  render();
  window.scrollTo(0, 0);
}
function autoOrdersKeep(rc) {
  const spec = rc.specs[rc.si];
  const a = autoOrders(0, spec, rc);
  const out = {};
  for (const id in a) {
    const prev = rc.orders[id];
    if (isITT(spec)) out[id] = a[id];
    else if (prev && prev.o && prev.o !== 'itt') out[id] = prev;
    else out[id] = a[id];
  }
  return out;
}
function closeRace() {
  UI.lastStage = null;
  S.rc = null;
  save();
  UI.view = 'inbox';
  render();
}

// Watts des montées : temps d'ascension, vitesse, VAM, puissance estimée.
function climbWattsCard(climbs, mine) {
  let h = `<div class="card"><h3>⚡ Watts des montées</h3><p class="small mut">Puissance estimée d'après le temps d'ascension, la pente et le poids du coureur (vélo compris). VAM = mètres de dénivelé gravis par heure.</p>`;
  climbs.forEach((c, k) => {
    h += `<details ${k === climbs.length - 1 ? 'open' : ''}><summary><b>${esc(c.name)}</b> <span class="small mut">cat. ${c.cat} · ${c.len} km à ${fmtDec(c.avg, 1)} %</span></summary><div class="tw"><table class="t"><thead><tr><th>#</th><th>Coureur</th><th>Temps</th><th>km/h</th><th>VAM</th><th>W</th><th>W/kg</th></tr></thead><tbody>`;
    let prev = 0;
    for (const e of c.top) {
      if (e.rk !== prev + 1) h += `<tr><td colspan="7" class="mut">…</td></tr>`;
      prev = e.rk;
      const r = S.riders[e.id];
      h += `<tr class="${mine.has(e.id) ? 'mrow' : ''}"><td>${e.rk}</td><td>${rlink(r)} <span class="small mut">${r.kg || '?'} kg</span></td><td>${fmtTime(e.dur)}</td><td>${fmtDec(e.kmh, 1)}</td><td>${e.vam}</td><td>${e.w}</td><td><b>${fmtDec(e.wkg, 2)}</b></td></tr>`;
    }
    h += `</tbody></table></div></details>`;
  });
  return h + `</div>`;
}
// Records de puissance d'un coureur.
function pbTable(r) {
  if (!r.pb || !Object.keys(r.pb).length) return '';
  return `<h3>Records de puissance</h3><table class="t"><thead><tr><th>Effort</th><th>W/kg</th><th>W</th><th>Montée</th></tr></thead><tbody>${PW_BUCKETS.filter(
    B => r.pb[B[0]]
  )
    .map(B => {
      const q = r.pb[B[0]];
      return `<tr><td>${B[1]}</td><td><b>${fmtDec(q.wkg, 2)}</b></td><td>${q.w}</td><td class="small">${esc(q.climb)} (${fmtTime(q.dur)}) <span class="mut">${esc(q.race)} ${q.season}</span></td></tr>`;
    })
    .join('')}</tbody></table>`;
}

// Bilan de puissance de l'étape : mes coureurs et les dix premiers.
function stagePowerCard(power) {
  return `<div class="card"><h3>⚡ Puissance sur l'étape</h3><div class="tw"><table class="t"><thead><tr><th>#</th><th>Coureur</th><th>Moy.</th><th>W/kg</th><th>NP</th><th>Pic 5 min</th><th>Énergie</th></tr></thead><tbody>${power
    .map(e => {
      const r = S.riders[e.id];
      return `<tr class="${r.team === 0 ? 'mrow' : ''}"><td>${e.rk || 'ab.'}</td><td>${rlink(r)} <span class="small mut">${e.kg} kg</span></td><td><b>${e.avg} W</b></td><td>${fmtDec(e.wkg, 2)}</td><td>${e.np} W<div class="small mut">${fmtDec(e.npkg, 2)} W/kg</div></td><td>${e.p5} W</td><td>${e.kj} kJ</td></tr>`;
    })
    .join(
      ''
    )}</tbody></table></div><details class="info"><summary>ℹ️ Explications</summary><p class="small mut">Moy. = puissance moyenne. NP = puissance normalisée : elle tient compte des accélérations et reflète mieux le coût réel de l'effort. Pic 5 min = meilleure moyenne sur 5 minutes. Énergie = travail mécanique total (≈ kcal dépensées). Un coureur abrité dans le peloton pousse bien moins fort qu'un équipier qui roule en tête ou qu'un échappé.</p></details></div>`;
}
