/* Interface — marché, gestion, statistiques, messages, options */
function viewMarket() {
  const tab = UI.mkt;
  let rs;
  if (tab === 'free') rs = S.free.map(id => S.riders[id]).filter(r => r && !r.retired);
  else if (tab === 'pre')
    rs = Object.values(S.riders).filter(r => !r.retired && r.team > 0 && r.contract <= 1 && r.nextTeam == null);
  else if (tab === 'transfer') rs = Object.values(S.riders).filter(r => !r.retired && r.team > 0 && r.contract > 1);
  else rs = S.watch.map(id => S.riders[id]).filter(Boolean);
  if (UI.mktFilter) rs = rs.filter(r => r.arch === UI.mktFilter);
  let h = `<div class="tabs">${[
    ['free', 'Libres'],
    ['pre', 'Fin de contrat'],
    ['transfer', 'Sous contrat'],
    ['watch', `👁 Suivis (${S.watch.length})`],
    ['merc', '📰 Mercato'],
  ]
    .map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" onclick="UI.mkt='${k}';render()">${l}</button>`)
    .join('')}</div>`;
  if (tab === 'merc') return h + mercatoCard();
  const prof = rosterProfile();
  h += `
 <div class="card"><div class="row">${autoBtn('recruit', "Compléter l'effectif")}</div><p class="small mut">${{ free: 'Coureurs sans équipe : négociez directement.', pre: 'Coureurs dont le contrat se termine : un pré-contrat les fait arriver en fin de saison, sans indemnité.', transfer: 'Coureurs sous contrat : il faut payer une indemnité de transfert ; les équipes refusent de céder leurs deux meilleurs.', watch: 'Votre liste de suivi : vos recruteurs affinent chaque semaine leurs estimations.' }[tab]} Budget : <b>${fmtMoney(S.budget)}</b> · effectif ${P().riders.length}/${ROSTER.max} (au moins ${ROSTER.minPlayer}). Les valeurs « ~ » sont des estimations.</p>
 <div class="row small"><label>Profil <select onchange="UI.mktFilter=this.value;render()"><option value="">Tous</option>${Object.entries(
   ARCH
 )
   .map(([k, a]) => `<option value="${k}" ${UI.mktFilter === k ? 'selected' : ''}>${a.lbl}</option>`)
   .join('')}</select></label></div>
 <details class="manage"><summary>Profils de votre effectif</summary>${rosterSummaryHTML()}</details>
 ${riderTable(rs.slice(0, 300), { cols: [['Équipe', r => tshort(r)], ['Demande', r => '~' + fmtMoney(contractDemand(r))], ...(tab === 'transfer' ? [['Indemnité', r => fmtMoney(transferFee(r))]] : []), ['', r => badgesHTML(marketBadges(r, prof))]] })}</div>`;
  return h;
}
// Gestion : staff, sponsor, finances, historique.
function viewMgmt() {
  // l'essentiel d'abord (sponsor et objectifs, finances, staff), puis l'adjoint, le matériel, la carrière
  let h = '';
  h += `<div class="card"><h2>Sponsor${S.spons ? ' : ' + esc(S.spons.name) : ''}</h2><div class="small mut">${S.spons ? `Contrat : encore ${S.spons.years} saison(s) · difficulté ${diffOf().lbl}` : ''}</div><div>Confiance : <b>${S.conf}/100</b> ${bar(S.conf)} · versement ${fmtMoney(sponsorWeekly())}/sem.</div><h3>Objectifs ${S.season}</h3><table class="t wrap"><tbody>${(
    S.obj || []
  )
    .map(o => {
      const st = objStatus(o);
      return `<tr><td>${st.ok ? '✅' : '⬜'}</td><td>${esc(o.txt)}</td><td class="small mut">${st.prog}</td><td class="small">${fmtMoney(o.rew)}</td></tr>`;
    })
    .join('')}</tbody></table>
 <p class="small mut">Chaque objectif atteint rapporte une prime et de la confiance ; chaque échec en coûte. La confiance fixe le versement hebdomadaire du sponsor.</p></div>`;
  const f = (S.fin || {})[S.season] || {};
  const L = {
    spons: 'Sponsor',
    equip: 'Équipementiers',
    prize: 'Primes de course',
    sal: 'Salaires pros',
    aca: 'Académie',
    staff: 'Staff',
    transf: 'Transferts & indemnités',
    other: 'Frais de course & stages',
  };
  h += `<div class="card"><h2>Finances ${S.season}</h2><table class="t"><tbody>${Object.keys(L)
    .map(
      k =>
        `<tr><td>${L[k]}</td><td class="${(f[k] || 0) < 0 ? 'neg' : ''}">${fmtMoney(Math.round(f[k] || 0))}</td></tr>`
    )
    .join(
      ''
    )}<tr><td><b>Solde de la saison</b></td><td><b>${fmtMoney(Math.round(sum(Object.values(f))))}</b></td></tr></tbody></table>
 ${(() => {
   const pj = budgetProjection();
   return pj.wk
     ? `<div class="brief">📈 Flux réguliers (sponsor, équipementiers, salaires, staff) : <b>${pj.weekly >= 0 ? '+' : ''}${fmtMoney(Math.round(pj.weekly))}/sem.</b> → budget estimé en fin de saison : <b>${fmtMoney(Math.round(pj.end))}</b> <span class="mut">(hors primes de course, frais de course, transferts et primes d'objectifs)</span></div>`
     : '';
 })()}
 <p class="small">Masse salariale annuelle : pros ${fmtMoney(sum(myRiders().map(r => r.salary)))}, académie ${fmtMoney(sum(acaRiders().map(r => r.salary)))}, staff ${fmtMoney(sum(Object.values(S.staff).map(l => STAFF_COST[l])))}.</p></div>`;
  h += `<div class="card"><div class="row sb"><h2>Staff</h2>${autoBtn('staff', 'Staff auto')}</div><table class="t wrap"><tbody>${Object.keys(
    STAFF_LBL
  )
    .map(
      k =>
        `<tr><td><b>${STAFF_LBL[k]}</b><div class="small mut">${STAFF_DESC[k]}</div></td><td>${'●'.repeat(S.staff[k])}${'○'.repeat(5 - S.staff[k])}<div class="small mut">${fmtMoney(STAFF_COST[S.staff[k]])}/an</div></td><td><button ${S.staff[k] >= 5 ? 'disabled' : ''} onclick="staff('${k}',1)">+</button> <button ${S.staff[k] <= 1 ? 'disabled' : ''} onclick="staff('${k}',-1)">−</button></td></tr>`
    )
    .join('')}</tbody></table>
 <p class="small mut">Monter d'un niveau coûte une prime d'embauche (50 % de la différence de salaire annuel).</p></div>`;
  if (S.teamHist.length)
    h += `<div class="card"><h2>Historique</h2><div class="tw"><table class="t"><thead><tr><th>Saison</th><th>Club</th><th>Rang UCI</th><th>Points</th><th>Victoires</th><th>Budget</th><th>Confiance</th><th>Notoriété</th></tr></thead><tbody>${S.teamHist
      .slice()
      .reverse()
      .map(
        t =>
          `<tr><td>${t.s}</td><td class="small">${esc(t.club || P().name)}</td><td>${t.rank}e</td><td>${t.uci}</td><td>${t.wins}</td><td>${fmtMoney(t.budget)}</td><td>${t.conf}</td><td>${t.rep != null ? t.rep : '—'}</td></tr>`
      )
      .join('')}</tbody></table></div></div>`;
  h += assistantCard() + equipCard() + careerCard() + imageCard();
  return h;
}
function staff(k, d) {
  const e = setStaff(k, S.staff[k] + d);
  save();
  if (e) UI.flash = e;
  render();
}
// Statistiques : saison, courses, records, watts, palmarès, équipes.
function viewStats() {
  const tab = UI.stats;
  let h = `<div class="tabs">${[
    ['season', 'Saison'],
    ['races', 'Courses'],
    ['records', 'Records'],
    ['uci', 'UCI coureurs'],
    ['watts', 'Watts'],
    ['palm', 'Mon palmarès'],
    ['rivals', '🆚 Rivaux'],
    ['legends', '🏛️ Légendes'],
    ['review', '📋 Bilan'],
    ['teams', 'Équipes'],
  ]
    .map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" onclick="UI.stats='${k}';render()">${l}</button>`)
    .join('')}</div>`;
  const active = Object.values(S.riders).filter(r => !r.retired && r.team !== null && !r.aca);
  if (tab === 'season') {
    const past = Object.keys(S.seasonRank || {})
      .map(Number)
      .sort((a, b) => b - a);
    const ss = UI.statSeason && UI.statSeason !== S.season && past.includes(UI.statSeason) ? UI.statSeason : S.season;
    h += `<div class="sorts">Saison : ${[S.season, ...past].map(s => `<button class="${ss === s ? 'on' : ''}" onclick="UI.statSeason=${s};render()">${s}</button>`).join('')}</div>`;
    if (ss !== S.season) {
      const tr = S.seasonRank[ss];
      h += `<div class="card"><h2>Classement UCI ${ss} (final)</h2><table class="t"><tbody>${tr.map((t, i) => `<tr class="${t.p ? 'mrow' : ''}"><td>${i + 1}</td><td><b style="color:${t.c}">■</b> ${esc(t.n)}</td><td>${t.u} pts</td><td class="small mut">${t.w} v.</td></tr>`).join('')}</tbody></table></div>`;
      const pool = Object.values(S.riders)
        .map(r => [r, (r.career || []).find(c => c.s === ss)])
        .filter(a => a[1]);
      const lst2 = (title, fn, fmt) => {
        const rs = pool
          .slice()
          .sort((a, b) => fn(b[1]) - fn(a[1]))
          .filter(a => fn(a[1]) > 0)
          .slice(0, 10);
        return `<div class="card"><h3>${title}</h3><table class="t"><tbody>${rs.map(([r, c], i) => `<tr class="${c.t === P().short ? 'mrow' : ''}"><td>${i + 1}</td><td>${rlink(r)}</td><td class="small mut">${c.t}</td><td>${fmt ? fmt(fn(c)) : fn(c)}</td></tr>`).join('') || '<tr><td class="mut">—</td></tr>'}</tbody></table></div>`;
      };
      return (
        h +
        lst2('Points UCI', c => c.u) +
        lst2('Victoires', c => c.w) +
        lst2('Podiums', c => c.p) +
        lst2(
          "Kilomètres à l'avant",
          c => c.kf || 0,
          v => v + ' km'
        ) +
        lst2('Jours de course', c => c.d)
      );
    }
    h += seasonWhyHTML();
    const teams = uciRanking();
    const lead = (teams[0] && teams[0].uci) || 1;
    h += `<div class="card"><h2>Classement UCI ${S.season}</h2>${uciObjectiveHTML()}<table class="t"><tbody>${teams.map((t, i) => `<tr class="${t.player ? 'mrow' : ''}"><td>${i + 1}</td><td><b style="color:${t.color}">■</b> ${esc(t.name)}<div class="hb"><i style="width:${(((t.uci || 0) / lead) * 100).toFixed(0)}%;background:${t.color}"></i></div></td><td>${t.uci || 0} pts</td><td class="small mut">${seasonWins(t.id)} v.</td></tr>`).join('')}</tbody></table></div>`;
    h += wtTableHTML();
    const lst = (title, fn, fmt) => {
      const rs = active
        .slice()
        .sort((a, b) => fn(b) - fn(a))
        .filter(r => fn(r) > 0)
        .slice(0, 10);
      return `<div class="card"><h3>${title}</h3><table class="t"><tbody>${rs.map((r, i) => `<tr class="${r.team === 0 ? 'mrow' : ''}"><td>${i + 1}</td><td>${rlink(r)}</td><td class="small mut">${tshort(r)}</td><td>${fmt ? fmt(fn(r)) : fn(r)}</td></tr>`).join('') || '<tr><td class="mut">—</td></tr>'}</tbody></table></div>`;
    };
    h +=
      lst('Points UCI', r => r.stats.pts) +
      lst('Victoires', r => r.stats.wins) +
      lst('Podiums', r => r.stats.podiums) +
      lst(
        "Kilomètres à l'avant",
        r => Math.round(r.stats.kf || 0),
        v => v + ' km'
      ) +
      lst('Attaques', r => r.stats.att || 0) +
      lst('Jours de course', r => r.stats.days);
  } else if (tab === 'races') {
    h += `<div class="card"><h2>Historique des courses</h2>${S.cal
      .map(c => {
        const hs = (S.raceHist[c.key] || []).slice().reverse();
        return `<details ${hs.length ? '' : 'class="mut"'}><summary><b>${esc(c.name)}</b> <span class="small mut">${hs.length} édition(s)</span></summary>${hs.length ? `<table class="t"><tbody>${hs.map(e => `<tr><td>${e.s}</td><td>🥇 ${esc(e.pod[0] ? e.pod[0].n : '')} <span class="mut small">${e.pod[0] ? e.pod[0].t : ''}</span></td><td class="small">🥈 ${esc(e.pod[1] ? e.pod[1].n : '')} · 🥉 ${esc(e.pod[2] ? e.pod[2].n : '')}</td></tr>${e.pts ? `<tr><td></td><td colspan="2" class="small mut">Points : ${esc(e.pts)} · Montagne : ${esc(e.kom || '—')} · Jeune : ${esc(e.yg || '—')}${e.stages ? '<br>Étapes : ' + e.stages.map((s, i) => i + 1 + '. ' + esc(s.n)).join(' · ') : ''}</td></tr>` : ''}`).join('')}</tbody></table>` : ''}</details>`;
      })
      .join('')}</div>`;
  } else if (tab === 'records') {
    const all = Object.values(S.riders).filter(r => (r.palm && r.palm.length) || (r.career && r.career.length));
    const wins = r =>
      (r.palm || []).filter(p => p.k === 1 && p.e !== 'Course espoirs' && !/Maillot|grimpeur|jeune/.test(p.e)).length;
    const gts = r =>
      (r.palm || []).filter(p => p.k === 1 && p.r === 'Grande Boucle' && p.e === 'Classement général').length;
    const pts = r => sum((r.career || []).map(c => c.u)) + r.stats.pts;
    const lst = (title, fn) => {
      const rs = all
        .slice()
        .sort((a, b) => fn(b) - fn(a))
        .filter(r => fn(r) > 0)
        .slice(0, 10);
      return `<div class="card"><h3>${title}</h3><table class="t"><tbody>${rs.map((r, i) => `<tr class="${r.team === 0 ? 'mrow' : ''}"><td>${i + 1}</td><td>${rlink(r)}${r.retired ? ' <span class="small mut">retraité</span>' : ''}</td><td>${fn(r)}</td></tr>`).join('') || '<tr><td class="mut">Pas encore de données.</td></tr>'}</tbody></table></div>`;
    };
    h +=
      lst('Victoires en carrière (courses, étapes, généraux)', wins) +
      lst('Victoires sur la Grande Boucle (général)', gts) +
      lst('Points UCI en carrière', pts);
  } else if (tab === 'rivals') {
    h += viewRivals();
  } else if (tab === 'review') {
    const rv = S.review;
    h += `<div class="card"><h2>📋 Bilan individuel${rv ? ' ' + rv.s : ''}</h2><p class="small mut">Établi à la clôture de chaque saison : jours de course, résultats, évolution du niveau global et objectif personnel.</p>${
      rv && rv.rows.length
        ? `<div class="tw"><table class="t"><thead><tr><th>Coureur</th><th>Jours</th><th>Vict.</th><th>Pod.</th><th>UCI</th><th>Niveau</th><th>Objectif</th></tr></thead><tbody>${rv.rows
            .map(x => {
              const r = S.riders[x.id];
              if (!r) return '';
              const d =
                x.dov == null
                  ? ''
                  : ` <span class="${x.dov > 0 ? 'pos' : x.dov < 0 ? 'neg' : 'mut'}">${x.dov > 0 ? '+' : ''}${x.dov}</span>`;
              return `<tr><td>${rlink(r)}</td><td>${x.d}</td><td>${x.w}</td><td>${x.p}</td><td>${x.u}</td><td>${x.ov}${d}</td><td class="small">${x.goal ? `${x.goal.ok ? '✅' : '❌'} ${GOAL_SHORT[x.goal.k]}` : '—'}</td></tr>`;
            })
            .join('')}</tbody></table></div>`
        : '<p class="mut">Le premier bilan sera établi à la fin de la saison.</p>'
    }</div>`;
  } else if (tab === 'legends') {
    const L = legends(25);
    h += `<div class="card"><h2>🏛️ Légendes du peloton</h2><details class="info"><summary>ℹ️ Explications</summary><p class="small mut">Toutes saisons confondues, retraités compris. Barème : Grand Tour 25 pts, monument ou Mondiaux 15, course par étapes majeure 8, classique majeure 6, étape de Grand Tour 3, podiums et maillots.</p></details>${
      L.length
        ? `<div class="tw"><table class="t"><thead><tr><th>#</th><th>Coureur</th><th>Pts</th><th>GT</th><th>Monum.</th><th>🌈</th><th>Vict.</th><th></th></tr></thead><tbody>${L.map(
            (x, i) =>
              `<tr class="${x.r.team === 0 ? 'mrow' : ''}"><td>${i + 1}</td><td>${rlink(x.r)} ${flag(x.r.nat)}</td><td><b>${x.s}</b></td><td>${x.gt || ''}</td><td>${x.mon || ''}</td><td>${x.worlds || ''}</td><td>${x.wins}</td><td class="small mut">${x.r.retired ? 'retraité' : esc(teamOf(x.r) ? teamOf(x.r).short : 'libre')}</td></tr>`
          ).join('')}</tbody></table></div>`
        : '<p class="mut">Aucun palmarès pour l\'instant.</p>'
    }</div>`;
  } else if (tab === 'uci') {
    // classement UCI individuel de la saison : top 50 et position de chacun de vos coureurs
    const all = Object.values(S.riders)
      .filter(r => !r.retired && r.team !== null && !r.aca && r.stats.pts > 0)
      .sort((a, b) => b.stats.pts - a.stats.pts);
    const rows = all.map((r, i) => [r, i + 1]).filter(([r, k]) => k <= 50 || r.team === 0);
    h += `<div class="card"><h2>Classement UCI individuel ${S.season}</h2><table class="t"><tbody>${rows.map(([r, k]) => `<tr class="${r.team === 0 ? 'mrow' : ''}"><td>${k}</td><td>${rlink(r)}</td><td class="small mut">${tshort(r)} · ${ARCH[r.arch].lbl}</td><td>${r.stats.pts} pts</td><td class="small mut">${r.stats.wins} v.</td></tr>`).join('') || '<tr><td class="mut">Pas encore de points cette saison.</td></tr>'}</tbody></table></div>`;
  } else if (tab === 'watts') {
    const L = S.pwRec || [];
    h += `<div class="card"><h2>⚡ Meilleures performances en montée</h2><p class="small mut">Efforts de 20 minutes et plus, toutes saisons confondues, classés en watts par kilo.</p>${
      L.length
        ? `<div class="tw"><table class="t"><thead><tr><th>#</th><th>Coureur</th><th>W/kg</th><th>W</th><th>Montée</th><th>Course</th></tr></thead><tbody>${L.map(
            (q, i) => {
              const r = S.riders[q.id];
              return `<tr class="${r && r.team === 0 ? 'mrow' : ''}"><td>${i + 1}</td><td>${rlink(r)}</td><td><b>${fmtDec(q.wkg, 2)}</b></td><td>${q.w}</td><td class="small">${esc(q.climb)} · ${q.len} km à ${fmtDec(q.avg, 1)} % · ${fmtTime(q.dur)} · VAM ${q.vam}</td><td class="small mut">${esc(q.race)} ${q.season}</td></tr>`;
            }
          ).join('')}</tbody></table></div>`
        : '<p class="mut">Aucune grande montée courue pour l\'instant.</p>'
    }</div>`;
    const pool = Object.values(S.riders).filter(r => !r.retired && r.pb && (r.pb.m || r.pb.l));
    const best = r => Math.max(r.pb.m ? r.pb.m.wkg : 0, r.pb.l ? r.pb.l.wkg : 0);
    const top = pool.sort((a, b) => best(b) - best(a)).slice(0, 15);
    h += `<div class="card"><h3>Meilleurs grimpeurs en activité (record personnel, 15 min et plus)</h3><table class="t"><tbody>${top.map((r, i) => `<tr class="${r.team === 0 ? 'mrow' : ''}"><td>${i + 1}</td><td>${rlink(r)}</td><td class="small mut">${tshort(r)} · ${r.kg} kg</td><td><b>${fmtDec(best(r), 2)}</b> W/kg</td></tr>`).join('') || '<tr><td class="mut">—</td></tr>'}</tbody></table></div>`;
  } else if (tab === 'palm') {
    const items = [];
    for (const r of Object.values(S.riders)) for (const p of r.palm || []) if (p.my) items.push([p, r]);
    items.sort((a, b) => b[0].s - a[0].s || a[0].k - b[0].k);
    h += `<div class="card"><h2>Palmarès de ${esc(P().name)}</h2>${items.length ? `<table class="t"><tbody>${items.map(([p, r]) => `<tr><td>${p.s}</td><td>${p.k === 1 ? '🥇' : p.k === 2 ? '🥈' : '🥉'}</td><td>${esc(p.r)}<div class="small mut">${esc(p.e)}</div></td><td>${rlink(r)}</td></tr>`).join('')}</tbody></table>` : '<p class="mut">Aucun résultat pour l\'instant.</p>'}</div>`;
  } else {
    h += `<div class="card"><h2>Équipes</h2>${S.teams
      .filter(t => !t.player)
      .map(
        t =>
          `<details><summary><b style="color:${t.color}">■</b> ${esc(t.name)} <span class="small mut">${STYLES[t.style] || ''}</span> <button class="small" onclick="event.preventDefault();openTeam(${t.id})">Fiche</button></summary>${t.riders
            .map(id => S.riders[id])
            .sort((a, b) => shownOv(b) - shownOv(a))
            .map(r => `${rlink(r)} <span class="small mut">${ARCH[r.arch].lbl} ${svOv(r)}</span>`)
            .join(' · ')}</details>`
      )
      .join('')}</div>`;
  }
  return h;
}
// Messages.
function viewInbox() {
  const all = UI.inboxAll;
  const imp = m => (m.imp != null ? m.imp : msgImportant(m.title, m.body));
  const L = groupMsgs(all ? S.inbox : S.inbox.filter(imp));
  const nImp = S.inbox.filter(m => imp(m) && !m.read).length;
  const h = `<div class="tabs"><button class="${all ? '' : 'on'}" onclick="UI.inboxAll=false;render()">Importants${nImp ? ` (${nImp})` : ''}</button><button class="${all ? 'on' : ''}" onclick="UI.inboxAll=true;render()">Tous</button></div><div class="card"><h2>Messages</h2>${
    L.map((m, i) => {
      const head =
        !i || L[i - 1].w !== m.w || L[i - 1].season !== m.season
          ? `<div class="wk">Semaine ${m.w}${m.season !== S.season ? ' · ' + m.season : ''}</div>`
          : '';
      return `${head}<div class="msg2 ${m.read ? '' : 'unread'}"><span class="mi">${msgIcon(m.title)}</span><div><div class="mt">${esc(m.title.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, ''))}${m.n > 1 ? ` <span class="badge">${m.n}</span>` : ''}</div><div class="small">${m.body}</div></div></div>`;
    }).join('') || `<p class="mut">${all ? 'Aucun message.' : 'Rien d’important : tout est dans « Tous ».'}</p>`
  }</div>`;
  L.forEach(m => (m._src ? m._src.forEach(x => (x.read = true)) : (m.read = true)));
  save();
  return h;
}
// Options : export/import, nouvelle partie.
function viewOpt() {
  return `<div class="card"><h2>Sauvegarde</h2><p class="small mut">La partie est sauvegardée automatiquement dans ce navigateur. Pour la mettre à l’abri, téléchargez régulièrement un fichier de sauvegarde.</p>
 <p class="small mut">${UI.idbOk ? `Copie compressée : ${Math.round((UI.idbSize || 0) / 1024)} Ko (partie brute : ${Math.round(JSON.stringify(S).length / 1024)} Ko).` : 'Copie compressée indisponible sur ce navigateur : sauvegarde locale simple.'}</p>
 <div class="row"><button onclick="copySave(this)">📋 Copier la sauvegarde</button><button onclick="dlSave()">💾 Télécharger</button></div>
 <div id="bkp" class="small"></div>
 <p class="small">${exportStatus()}${UI.persist ? ' · stockage protégé par le navigateur' : ''}</p>
 <div class="row"><label class="btnlike">📂 Charger un fichier<input type="file" accept=".json,application/json,text/plain" style="display:none" onchange="importFile(this)"></label></div>
 <textarea id="imp" rows="3" placeholder="…ou collez une sauvegarde ici pour l'importer"></textarea><div class="row"><button onclick="doImport()">Importer</button></div>
 <h2>Jeu</h2><div class="row"><label><input type="checkbox" ${S.simple ? 'checked' : ''} onchange="setSimple(this.checked);save();render()"> Mode essentiel</label></div>
 <p class="small mut">L'adjoint règle matériel, ravitaillement, plan de course, presse, staff et équipementiers ; les réglages restent accessibles (repliés).</p>
 <h2>Équipe</h2><div class="row"><input id="tname" value="${esc(P().name)}" maxlength="30"><button onclick="P().name=$('#tname').value||P().name;save();render()">Renommer</button></div>
 <h2>Danger</h2><button class="danger" onclick="confirmBox('Effacer la partie et recommencer ?',()=>{try{localStorage.removeItem(SAVE_KEY)}catch(e){};idbClear();S=null;UI.sim=null;stopTimer();render();})">Nouvelle partie</button>
 <p class="small mut">Version 3.15</p></div>${guideCard()}`;
}
// Téléchargement d'un fichier de sauvegarde (repli : copie du texte si le navigateur l'interdit).
// (dans la page publiée, par le service de téléchargement de Claude, qui demande confirmation au joueur)
async function dlSave() {
  const t = JSON.stringify({ S, sd: _sd, rid: _rid });
  const filename = `directeur-sportif-${S.season}-sem${S.week}.json`;
  try {
    const cl = /** @type {any} */ (window).claude;
    const dl = cl && cl.use ? await cl.use('downloads') : null;
    if (!dl) throw new Error('indisponible');
    await dl.save({ filename, data: t });
    S.lastExport = { season: S.season, week: S.week };
    save();
    UI.flash = '💾 Fichier de sauvegarde proposé au téléchargement.';
  } catch (e) {
    UI.flash = 'Téléchargement impossible ici : utilisez « Copier la sauvegarde ».';
  }
  render();
}
// Dernier fichier de sauvegarde téléchargé (copie hors du navigateur).
function exportStatus() {
  const e = S.lastExport;
  if (!e)
    return '⚠️ Aucun fichier de sauvegarde téléchargé : en cas de nettoyage du navigateur, la partie serait perdue.';
  const ago = (S.season - e.season) * 52 + (S.week - e.week);
  return `Dernier fichier téléchargé : ${e.season}, semaine ${e.week}${ago > 26 ? ' — pensez à en refaire un' : ''}.`;
}
// Import d'un fichier de sauvegarde choisi sur l'appareil.
function importFile(inp) {
  const f = inp.files && inp.files[0];
  if (!f) return;
  f.text().then(t => {
    if (importSave(t)) {
      save();
      UI.view = 'home';
      UI.sim = null;
      UI.flash = 'Partie chargée depuis le fichier.';
      render();
    } else alertBox('Ce fichier n’est pas une sauvegarde valide : la partie en cours est conservée.');
  });
}
// Copies de sécurité de début de saison, affichées dans les options.
function showBackups() {
  idbBackups().then(keys => {
    const el = $('#bkp');
    if (!el) return;
    el.innerHTML = keys.length
      ? `Copies de sécurité (avant chaque fin de saison) : ${keys
          .map(
            k =>
              `<button onclick="confirmBox('Revenir à la copie ${k.replace('saison-', 'de fin de saison ')} ? La partie actuelle sera remplacée.',()=>idbRestore('${k}').then(ok=>{save();UI.flash=ok?'Copie restaurée.':'Copie illisible.';UI.view='home';render();}))">${k.replace('saison-', 'Fin ')}</button>`
          )
          .join(' ')}`
      : '<span class="mut">Une copie de sécurité est faite automatiquement à chaque fin de saison.</span>';
  });
}
function copySave(btn) {
  const t = JSON.stringify({ S, sd: _sd, rid: _rid });
  try {
    navigator.clipboard.writeText(t).then(
      () => {
        btn.textContent = '✅ Copié';
      },
      () => {
        $('#imp').value = t;
        btn.textContent = 'Copie bloquée : texte affiché ci-dessous';
      }
    );
  } catch (e) {
    $('#imp').value = t;
  }
}

// Presse : notoriété, interview en attente, articles, popularité
function viewPress() {
  const rep = Math.round(repOf());
  let h = `<div class="card"><h2>📰 Presse et notoriété</h2><div>Notoriété de l'équipe : <b>${rep}/100</b> — ${repLabel(rep)} ${bar(rep)}</div>
 <details class="info"><summary>ℹ️ Explications</summary><p class="small mut">La notoriété rassure le sponsor (confiance en fin de saison), augmente vos chances d'invitation aux Grands Tours, attire les coureurs en négociation et rapporte des produits dérivés. Elle monte avec les victoires et les bonnes réponses aux journalistes, baisse avec les déceptions et les polémiques.</p></details></div>`;
  const Q = S.pressQ;
  if (Q)
    h += `<div class="card"><div class="row sb"><h3>🎤 Question d'un journaliste</h3>${autoBtn('press', 'Réponse auto')}</div><p><i>« ${esc(Q.q)} »</i></p><div class="col">${Q.opts.map((o, k) => `<button onclick="doAnswer(${k})">${esc(o.t)}</button>`).join('')}</div><p class="small mut">Sans réponse avant la semaine ${Q.exp}, la presse vous jugera distant.</p></div>`;
  const my = myRiders()
    .slice()
    .sort((a, b) => (b.pop || 0) - (a.pop || 0));
  const popRow = r =>
    `<tr><td>${rlink(r)}</td><td>${Math.round(r.pop || 0)}</td><td style="width:45%">${bar(r.pop || 0)}</td></tr>`;
  h += `<div class="card"><h3>Popularité de mes coureurs</h3><table class="t"><tbody>${my.slice(0, 8).map(popRow).join('')}</tbody></table>${my.length > 8 ? `<details class="manage"><summary>Les ${my.length - 8} autres</summary><table class="t"><tbody>${my.slice(8).map(popRow).join('')}</tbody></table></details>` : ''}<p class="small mut">Un coureur populaire rapporte en produits dérivés, mais il demande un meilleur salaire.</p></div>`;
  const stars = Object.values(S.riders)
    .filter(r => !r.retired && r.team !== null && !r.aca)
    .sort((a, b) => (b.pop || 0) - (a.pop || 0))
    .slice(0, 10);
  h += `<div class="card"><h3>Les chouchous du public</h3><table class="t"><tbody>${stars.map((r, i) => `<tr class="${r.team === 0 ? 'mrow' : ''}"><td>${i + 1}</td><td>${rlink(r)}</td><td class="small mut">${tshort(r)}</td><td>${Math.round(r.pop || 0)}</td></tr>`).join('')}</tbody></table></div>`;
  const A = (S.press || []).slice(0, 40);
  h += `<div class="card"><h3>Revue de presse</h3>${A.length ? A.map(a => `<div class="art"><div class="small mut">${esc(a.j)} · ${a.s}, sem. ${a.w}${a.tone > 0.4 ? ' · <span class="pos">👍</span>' : a.tone < -0.4 ? ' · <span class="neg">👎</span>' : ''}</div><b>${esc(a.title)}</b><div class="small">${a.body}</div></div>`).join('') : '<p class="mut">Aucun article pour l\'instant.</p>'}</div>`;
  return h;
}
function doAnswer(k) {
  const t = answerPress(k);
  save();
  if (t) UI.flash = t;
  render();
}

// Équipementiers : matériel actuel, effets, offres pour la saison prochaine.
function eqTraits(cat, b) {
  const pct = v => Math.round(v * 100);
  return cat === 'bike'
    ? `aéro ${pct(b.aero)} · légèreté ${pct(b.leger)} · confort ${pct(b.confort)} · robustesse ${pct(b.robuste)}`
    : `aérodynamisme ${pct(b.aero)}`;
}
function equipCard() {
  const T = P();
  let h = `<div class="card"><div class="row sb"><h2>🚲 Équipementiers</h2>${S.eqOffers ? autoBtn('equip', 'Choix auto') : ''}</div><table class="t wrap"><tbody>`;
  for (const cat of Object.keys(EQ_CATS)) {
    const b = eqUsed(T, cat),
      d = S.eqDeal[cat];
    h += `<tr><td><b>${EQ_CATS[cat].lbl}</b><div class="small mut">${eqTraits(cat, b)}</div></td><td><b>${esc(b.name)}</b>${d.proto ? ' <span class="badge">🧪 prototypes</span>' : ''}<div class="small mut">${fmtMoney(d.pay)}/saison${d.perf ? ` + ${fmtMoney(d.perf)} par victoire` : ''} · ${d.years} an(s) restant(s)</div></td></tr>`;
  }
  h += `</tbody></table><details class="info"><summary>ℹ️ Explications</summary><p class="small mut">Aéro : vitesse sur le plat et en vallonné · légèreté : montées · confort : pavés (vitesse et crevaisons) · robustesse : crevaisons · chrono : contre-la-montre. Écart entre le meilleur et le moins bon matériel : environ 1 % de vitesse, 2 % en chrono. Les meilleures marques paient moins mais exigent de la notoriété.</p></details>`;
  if (S.eqOffers && Object.keys(S.eqOffers).length) {
    h += `<h3>Offres pour la saison ${S.season + 1}</h3>`;
    for (const cat of Object.keys(S.eqOffers)) {
      h += `<div class="small"><b>${EQ_CATS[cat].lbl}</b></div><table class="t wrap"><tbody>${S.eqOffers[cat]
        .map((o, k) => {
          const b = eqBrand(cat, o.id),
            on = S.eqChoice[cat] === k;
          if (o.gone)
            return `<tr class="mut"><td><s>${esc(b.name)}</s></td><td colspan="2" class="small">offre retirée</td></tr>`;
          const nego = o.neg
            ? ''
            : `<select class="small" onchange="doEqNego('${cat}',${k},this.value)"><option value="">Négocier…</option>${Object.entries(
                EQ_NEGO
              )
                .map(([m, l]) => `<option value="${m}">${l}</option>`)
                .join('')}</select>`;
          return `<tr class="${on ? 'mrow' : ''}"><td><b>${esc(b.name)}</b>${o.proto ? ' <span class="badge">🧪 prototypes</span>' : ''}<div class="small mut">${eqTraits(cat, o.proto ? protoBrand(cat, b) : b)}</div></td><td>${fmtMoney(o.pay)}/saison${o.perf ? `<div class="small">+ ${fmtMoney(o.perf)}/victoire</div>` : ''}<div class="small mut">${o.years} an(s)</div></td><td>${on ? '✅ choisi' : `<button onclick="doEq('${cat}',${k})">Choisir</button>`}${nego}</td></tr>`;
        })
        .join('')}</tbody></table>`;
    }
    h += `<details class="info"><summary>ℹ️ Explications</summary><p class="small mut">Une seule négociation par offre. Plus d'argent : la marque peut refuser, voire retirer son offre si votre notoriété est juste. Prototypes : moins d'argent, matériel plus aéro et plus léger mais un peu plus fragile (notoriété requise). Prime à la victoire : moins de fixe, un bonus par succès versé en fin de saison. Sans choix de votre part, la meilleure offre financière sera retenue.</p></details>`;
  } else if (S.week < EQ_OFFER_WEEK)
    h += `<p class="small mut">Les offres pour la saison prochaine arrivent en semaine ${EQ_OFFER_WEEK}.</p>`;
  return h + `</div>`;
}
function doEqNego(cat, k, mode) {
  if (!mode) return;
  UI.flash = eqNegotiate(cat, k, mode);
  save();
  render();
}
function doEq(cat, k) {
  UI.flash = chooseEq(cat, k);
  save();
  render();
}
// Journal du mercato : mouvements de la saison et des précédentes, rumeurs de presse.
function mercatoCard() {
  const all = S.merc || [];
  const L = all.filter(e => (UI.mercAll ? true : e.imp) && (!UI.mercMine || e.my)).slice(0, 80);
  const btn = (k, on, l) => `<button class="${on ? 'on' : ''}" onclick="UI.${k}=${!on};render()">${l}</button>`;
  return `<div class="card"><h2>📰 Mercato</h2><details class="info"><summary>ℹ️ Explications</summary><p class="small mut">Transferts, signatures, départs et retraites dans le peloton, et rumeurs de la presse (à prendre avec prudence). Par défaut, seuls les coureurs en vue (victoires, points UCI) et les mouvements de votre équipe sont listés.</p></details>
 <div class="sorts">${btn('mercAll', !!UI.mercAll, 'Tous les mouvements')}${btn('mercMine', !!UI.mercMine, 'Mon équipe seulement')}</div>
 ${
   L.length
     ? `<div class="tw"><table class="t"><tbody>${L.map(e => {
         const r = S.riders[e.id];
         return `<tr class="${e.my ? 'mrow' : ''}"><td class="small mut">${e.s} · S${e.w}</td><td class="small">${MERC_KIND[e.k] || e.k}</td><td>${r ? rlink(r) : esc(e.n)}</td><td class="small">${esc(e.f)} → <b>${esc(e.t)}</b></td></tr>`;
       }).join('')}</tbody></table></div>`
     : '<p class="mut">Aucun mouvement pour l\'instant : le gros du mercato a lieu en fin de saison.</p>'
 }</div>`;
}
// Carrière du directeur sportif : réputation, clubs dirigés, offres d'emploi.
function careerCard() {
  const C = S.career || { rep: 45, clubs: [] };
  let h = `<div class="card"><h2>👔 Carrière du directeur sportif</h2><div>Réputation : <b>${Math.round(C.rep)}/100</b> — ${careerLabel(C.rep)} ${bar(C.rep)}</div>`;
  if (S.fired)
    h += `<p class="warn"><b>Vous avez été licencié.</b> Acceptez l'une des offres ci-dessous avant la première course.</p>`;
  else if (S.conf < 25)
    h += `<p class="warn small">Confiance du sponsor très basse (${S.conf}/100) : en dessous de 15 en fin de saison, c'est le licenciement.</p>`;
  if (S.jobOffers && S.jobOffers.length) {
    h += `<h3>Offres d'emploi</h3><table class="t wrap"><tbody>${S.jobOffers
      .map(o => {
        const T = teamById(o.tid);
        const best = T.riders
          .map(id => S.riders[id])
          .sort((a, b) => shownOv(b) - shownOv(a))
          .slice(0, 3);
        return `<tr><td><b style="color:${T.color}">■</b> <b>${esc(o.name)}</b><div class="small mut">${o.rank}e au classement · budget ${fmtMoney(o.budget)} · leaders : ${best.map(r => esc(riderName(r)) + ' ' + svOv(r)).join(', ')}</div></td><td><button class="pri" onclick="doJob(${o.tid})">Accepter</button></td></tr>`;
      })
      .join(
        ''
      )}</tbody></table>${S.fired ? '' : `<button onclick="doDecline()">Refuser et rester</button>`}<p class="small mut">Changer d'équipe : vous reprenez son effectif, son matériel, son budget et ses objectifs. Votre académie reste à votre ancien club.</p>`;
  }
  if (C.clubs && C.clubs.length)
    h += `<h3>Clubs dirigés</h3><table class="t"><tbody>${C.clubs.map(c => `<tr><td>${esc(c.name)}</td><td class="small mut">${c.from}–${c.to || "aujourd'hui"}</td></tr>`).join('')}</tbody></table>`;
  h += `<p class="small mut">La réputation monte quand l'équipe fait mieux que son rang attendu (${S.expRank || '?'}e cette saison) et atteint ses objectifs. Elle attire les offres des meilleures équipes.</p>`;
  return h + `</div>`;
}
function doJob(tid) {
  confirmBox('Quitter votre équipe pour celle-ci ?', () => {
    UI.flash = acceptJob(tid);
    save();
    UI.view = 'home';
    render();
  });
}
function doDecline() {
  UI.flash = declineJobs();
  save();
  render();
}

// Adjoint : délégation par domaine et exécution immédiate.
function assistantCard() {
  const A = S.auto || {};
  const on = Object.keys(AUTO_LBL).filter(k => A[k]).length;
  return `<div class="card"><div class="row sb"><h2>🧑‍💼 Adjoint</h2><span class="small mut">${on}/${Object.keys(AUTO_LBL).length} domaines délégués</span></div>
 <details class="info"><summary>ℹ️ Explications</summary><p class="small mut">Cochez ce que votre adjoint gère chaque semaine à votre place. Il vous envoie un rapport quand il prend une décision importante. Chaque écran a aussi son bouton « Auto » pour une décision ponctuelle.</p></details>
 <table class="t wrap"><tbody>${Object.entries(AUTO_LBL)
   .map(
     ([k, [l, d]]) =>
       `<tr><td><label><input type="checkbox" ${A[k] ? 'checked' : ''} onchange="setAuto('${k}',this.checked);save();render()"> <b>${l}</b></label><div class="small mut">${d}</div></td><td><button onclick="doAsst('${k}')">Auto maintenant</button></td></tr>`
   )
   .join('')}</tbody></table>
 <div class="row"><button onclick="Object.keys(AUTO_LBL).forEach(k=>setAuto(k,true));save();render()">Tout déléguer</button><button onclick="Object.keys(AUTO_LBL).forEach(k=>setAuto(k,false));save();render()">Tout reprendre en main</button></div></div>`;
}
// Bouton « Auto » ponctuel : exécute une décision de l'adjoint et affiche ce qu'il a fait.
function doAsst(k) {
  const t = ASST_FN[k]();
  save();
  UI.flash = '🧑‍💼 ' + (t || "Rien à faire pour l'instant.");
  render();
}
function autoBtn(k, lbl) {
  return `<button class="auto" onclick="doAsst('${k}')">🧑‍💼 ${lbl || 'Auto'}</button>`;
}
