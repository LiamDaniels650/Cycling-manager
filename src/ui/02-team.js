/* Interface — effectif, fiche coureur, négociation, académie */
function viewTeam() {
  const rs = myRiders();
  const sal = sum(rs.map(r => r.salary));
  const nxt = S.cal.find(c => !c.done);
  const ending = rs.filter(r => r.contract <= 1 && r.nextTeam == null);
  let h = `<div class="card"><div class="row sb"><h2>Effectif pro (${rs.length}/${ROSTER.max})</h2><span class="mut small">Salaires : ${fmtMoney(sal)}/an</span></div>
 ${raiseCard()}
 <div class="row wrap">${autoBtn('train', 'Entraînement auto')}${autoBtn('contracts', 'Prolongations auto')}</div>
 <div class="mut small">Prochaine course : ${nxt ? `<b>${esc(nxt.name)}</b> (sem. ${nxt.w})` : 'fin de saison'}. Touchez un coureur pour sa fiche, sa carrière et les discussions.</div>
 ${ending.length ? `<div class="warn small">⚠️ Fin de contrat cette saison : ${ending.map(r => rlink(r)).join(', ')} — prolongez-les avant que d'autres équipes ne leur fassent signer un pré-contrat.</div>` : ''}
 ${riderTable(rs, {
   state: true,
   cols: [
     [
       'Liens',
       r => {
         const rl = relationsOf(r.id);
         const f = rl.filter(a => a[1] > 0).length,
           x = rl.filter(a => a[1] < 0).length;
         return (f ? '🤝' + f + ' ' : '') + (x ? '⚡' + x : '');
       },
     ],
     ['Objectif', r => goalTag(r)],
     ['Contrat', r => r.contract + ' an'],
     ['Entraînement', r => trainSel(r)],
   ],
 })}</div>`;
  h += `<div class="card small mut"><b>Entraînement</b> : « Repos » fait baisser la fatigue mais aussi la forme ; « Bloc intensif » monte la forme vite mais fatigue ; « Pic de forme » vise ~92 de forme la semaine de la course choisie, puis un creux ; « Stage en altitude » (10 k€/sem.) : forme, montagne et endurance. Les plans spécifiques font progresser une caractéristique, d'autant plus que le coureur est jeune, loin de son potentiel et que vos entraîneurs sont bons.</div>`;
  return h;
}
function setTraining(id, v) {
  S.riders[id].training = v;
  if (v !== 'pic') S.riders[id].peakW = null;
  save();
  render();
}
function setPeak(id, w) {
  S.riders[id].peakW = w ? +w : null;
  save();
}
function openRider(id) {
  UI.modal = { type: 'rider', id };
  UI.riderTab = 'fiche';
  UI.nego = null;
  renderModal();
}
// Courbe d'évolution de la note globale.
function ovChart(r) {
  if (isEst(r))
    return '<p class="small mut">Courbe de progression connue seulement pour vos coureurs (ou bien observés).</p>';
  const pts = (r.career || []).map(c => [c.s, c.ov]).concat([[S.season, overall(r.s)]]);
  if (pts.length < 2) return '<p class="small mut">La courbe de progression apparaîtra après une saison.</p>';
  const W = 300,
    H = 90,
    mn = Math.min(...pts.map(p => p[1])) - 2,
    mx = Math.max(...pts.map(p => p[1])) + 2;
  const X = i => 20 + (i / (pts.length - 1)) * (W - 30),
    Y = v => H - 15 - ((v - mn) / (mx - mn || 1)) * (H - 25);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart"><polyline points="${pts.map((p, i) => X(i) + ',' + Y(p[1])).join(' ')}" class="cl"/>${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p[1])}" r="2.5" class="cd"/><text x="${X(i)}" y="${H - 2}" class="kt">${p[0]}</text><text x="${X(i)}" y="${Y(p[1]) - 5}" class="gt" text-anchor="middle">${p[1]}</text>`).join('')}</svg>`;
}
// Fiche d'un coureur : caractéristiques, état, contrat, actions ; onglets carrière et palmarès.
function riderCard(r) {
  const T = teamOf(r);
  const mine = r.team === 0;
  const kind = marketKind(r);
  const est = isEst(r);
  let h = `<div class="row sb"><h2>${esc(r.fn)} ${esc(r.ln)} ${flag(r.nat)}</h2><button onclick="closeModal()">✕</button></div>
 <div class="mut">${ARCH[r.arch].lbl} · ${r.age} ans · ${r.retired ? 'Retraité' : r.aca ? 'Académie' : T ? esc(T.name) : r.youth ? 'Vivier des jeunes' : 'Libre'} · ${r.kg || '?'} kg · Popularité ${Math.round(r.pop || 0)} · Global <b>${svOv(r)}</b> · Potentiel ${stars(potEst(r))}${potKnow(r) < 70 ? ' <span class="small">(estimé)</span>' : ''}</div>
 <div class="tabs">${[
   ['fiche', 'Fiche'],
   ['car', 'Carrière'],
   ['palm', 'Palmarès'],
 ]
   .map(
     ([k, l]) =>
       `<button class="${UI.riderTab === k ? 'on' : ''}" onclick="UI.riderTab='${k}';renderModal()">${l}</button>`
   )
   .join('')}</div>`;
  if (UI.riderTab === 'fiche') {
    if (est)
      h += `<p class="small warn">Valeurs estimées (connaissance ${Math.round(knowOf(r))}%). Observez-le en course ou ajoutez-le à votre liste de suivi pour affiner.</p>`;
    if (mine || !est) {
      const cp = riderCP(r);
      h += `<p class="small">⚡ Seuil en montée ≈ <b>${cp} W</b> (${fmtDec(cp / (r.kg || 68), 1)} W/kg) · réserve anaérobie (W') ≈ <b>${fmtDec(wPrime(r), 1)} kJ</b>${r.sick > 0 ? ' · 🤒 malade' : ''}${r.altBoost > 0 ? " · ⛰️ acclimaté à l'altitude" : ''}</p>`;
    }
    h += `<div class="grid2">${STATS.map(k => {
      const v = shownStat(r, k);
      return `<div class="st"><span>${STAT_LBL[k]}</span><b class="${statCls(v)}">${est ? '~' : ''}${v}</b>${bar(v, 95, 'b')}</div>`;
    }).join('')}</div>`;
    if (mine || !est)
      h += `<div class="grid2">
   <div class="st"><span>Forme</span><b>${Math.round(r.forme)}</b>${bar(r.forme)}</div>
   <div class="st"><span>Fatigue</span><b>${Math.round(r.fatigue)}</b>${bar(100 - r.fatigue)}</div>
   <div class="st"><span>Moral</span><b>${Math.round(r.moral)}</b>${bar(r.moral)}</div>
   <div class="st"><span>Discipline</span><b>${r.dis}</b>${bar(r.dis, 100, 'b')}</div>
   <div class="st"><span>Ambition</span><b>${r.amb}</b>${bar(r.amb, 100, 'b')}</div></div>
   <p><b>Caractère :</b> ${r.trait === 'aucun' ? '' : TRAITS[r.trait].lbl + ' — '}<span class="mut">${TRAITS[r.trait].d}</span></p>
   ${mine && r.goal && r.goal.s === S.season ? `<p class="small"><b>Objectif de la saison :</b> ${GOALS[r.goal.k]} ${r.goal.done ? '✅' : '⏳'} <span class="mut">(atteint : moral et fidélité ; manqué : un ambitieux peut le mal vivre)</span></p>` : ''}${r.rainbow ? `<p class="small">🌈 Champion du monde ${r.rainbow}</p>` : ''}`;
    else h += `<p class="small mut">Caractère et état de forme inconnus tant qu'il n'est pas dans votre équipe.</p>`;
    h += `<div class="brief">🧭 <b>Terrains de prédilection :</b> ${esc(riderTerrains(r).join(', '))}</div>`;
    const ctr = r.retired
      ? ''
      : mine && !r.aca
        ? `${r.contract} an(s) · ${fmtMoney(r.salary)}/an`
        : r.aca
          ? `Académie · ${fmtMoney(r.salary)}/an`
          : kind === 'free'
            ? `Libre · demande ~${fmtMoney(contractDemand(r))}/an`
            : T
              ? `${r.contract} an(s) chez ${esc(T.name)}`
              : '';
    const kv = [
      ['Contrat', ctr],
      ['Jours de course', r.stats.days + (r.stats.espD ? ` (+${r.stats.espD} espoirs)` : '')],
      ['Victoires', r.stats.wins + (r.stats.espW ? ` (+${r.stats.espW} espoirs)` : '')],
      ['Podiums', r.stats.podiums],
      ['Points UCI', r.stats.pts],
      ["Km à l'avant", Math.round(r.stats.kf || 0)],
      ['Attaques', r.stats.att || 0],
      ...(mine ? [['Désobéissances', r.stats.disob]] : []),
    ].filter(([, v]) => v !== '');
    h += `<div class="kvg">${kv.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
    if (r.retired) return h;
    if (mine && !r.aca) {
      h +=
        `<div class="row wrap"><button onclick="talk(${r.id},'feliciter')">👏 Encourager</button><button onclick="talk(${r.id},'recadrer')">☝️ Recadrer</button><button onclick="talk(${r.id},'promettre')">🤝 Promettre un rôle de leader</button>
    <button onclick="extend(${r.id},1)">✍️ Prolonger 1 an</button><button onclick="extend(${r.id},2)">✍️ Prolonger 2 ans</button><button class="danger" onclick="release(${r.id})">Libérer (${fmtMoney(Math.round(r.salary * 0.5 * r.contract))})</button></div>
    <p class="small mut">Prolongation demandée : ${fmtMoney(contractDemand(r))}/an.${r.promise ? ' Vous lui avez promis un rôle de leader.' : ''}</p>` +
        relCard(r);
    } else if (r.aca) {
      h += `<div class="row wrap"><button class="pri" onclick="promote(${r.id})">⬆️ Passer pro (2 ans)</button><button onclick="talk(${r.id},'feliciter')">👏 Encourager</button><button class="danger" onclick="acaRelease(${r.id})">Libérer de l'académie</button></div>`;
    } else if (r.youth) {
      h += `<div class="row wrap"><button class="pri" onclick="acaJoin(${r.id})">🎓 Recruter à l'académie (10 k€ + 12 k€/an)</button><button onclick="watch(${r.id})">${S.watch.includes(r.id) ? '👁 Ne plus suivre' : '👁 Suivre'}</button></div>`;
    } else {
      h +=
        `<div class="row wrap"><button onclick="watch(${r.id})">${S.watch.includes(r.id) ? '👁 Ne plus suivre' : '👁 Ajouter au suivi'}</button></div>` +
        negoForm(r);
    }
  } else if (UI.riderTab === 'car') {
    h += ovChart(r) + pbTable(r);
    const rows = (r.career || []).slice().reverse();
    h += `<table class="t"><thead><tr><th>Saison</th><th>Équipe</th><th>Gl.</th><th>Jours</th><th>V.</th><th>Pod.</th><th>UCI</th><th>km avant</th></tr></thead><tbody>
  <tr><td>${S.season}*</td><td>${tshort(r)}</td><td>${svOv(r)}</td><td>${r.stats.days}</td><td>${r.stats.wins}</td><td>${r.stats.podiums}</td><td>${r.stats.pts}</td><td>${Math.round(r.stats.kf || 0)}</td></tr>
  ${rows.map(c => `<tr><td>${c.s}</td><td>${c.t}</td><td>${mine || !est ? c.ov : '?'}</td><td>${c.d}</td><td>${c.w}</td><td>${c.p}</td><td>${c.u}</td><td>${c.kf || 0}</td></tr>`).join('')}</tbody></table><p class="small mut">* saison en cours</p>`;
  } else {
    const pl = (r.palm || []).slice().reverse();
    h += pl.length
      ? `<table class="t"><tbody>${pl.map(p => `<tr><td>${p.s}</td><td>${p.k === 1 ? '🥇' : p.k === 2 ? '🥈' : '🥉'}</td><td>${esc(p.r)}</td><td class="small">${esc(p.e)}</td><td class="small mut">${p.t}</td></tr>`).join('')}</tbody></table>`
      : '<p class="mut">Palmarès vierge.</p>';
  }
  return h;
}
// Relations d'un coureur avec ses équipiers.
function relCard(r) {
  const rl = relationsOf(r.id);
  if (!rl.length) return '<p class="small mut">Relations : rien de particulier avec ses coéquipiers.</p>';
  return `<h3>Relations</h3><div class="small">${rl.map(([o, v]) => `<div class="row sb"><span>${v > 0 ? '🤝' : '⚡'} ${rlink(S.riders[o])} <span class="mut">${v >= 60 ? 'grande complicité' : v > 0 ? 'bonne entente' : v <= -60 ? 'conflit ouvert' : 'tensions'} (${v > 0 ? '+' : ''}${v})</span></span>${v < 0 ? `<button onclick="doMediate(${r.id},${o})">Les réunir pour discuter</button>` : ''}</div>`).join('')}</div><p class="small mut">Un équipier proche de son leader lui obéit mieux et l'attend plus volontiers ; un rival refuse de se sacrifier pour lui.</p>`;
}
function doMediate(a, b) {
  const t = mediate(a, b);
  save();
  UI.flash = t;
  closeModal();
  render();
}
// Formulaire de négociation de contrat.
function negoForm(r) {
  const kind = marketKind(r);
  const dem = contractDemand(r);
  if (r.nextTeam != null) return `<p class="small mut">S'est déjà engagé pour la saison prochaine.</p>`;
  const n = UI.nego && UI.nego.id === r.id ? UI.nego : { id: r.id, sal: dem, years: 2, promise: false };
  UI.nego = n;
  const fee = kind === 'transfer' ? transferFee(r) : 0;
  return `<div class="nego"><b>${kind === 'free' ? 'Négocier un contrat' : kind === 'pre' ? 'Pré-contrat (arrivée en fin de saison)' : 'Transfert'}</b>
 <div class="small mut">Salaire demandé estimé : ~${fmtMoney(demEst(r))}/an${fee ? ` · indemnité de transfert : ${fmtMoney(fee)}` : ''} · prime à la signature : 10 % du salaire</div>${imageAffinity(r) >= 0.25 ? `<div class="small pos">✨ Attiré par l'image de votre équipe (${imageLabel().lbl.toLowerCase()}) : il signera plus volontiers.</div>` : ''}
 <div class="row">Salaire <input type="range" min="${Math.round(dem * 0.6)}" max="${Math.round(dem * 1.6)}" step="5" value="${n.sal}" oninput="UI.nego.sal=+this.value;$('#nsal').textContent=fmtMoney(+this.value);$('#nodds').innerHTML=negoOddsHTML(${r.id})"> <b id="nsal">${fmtMoney(n.sal)}</b></div>
 <div class="row">Durée ${[1, 2, 3].map(y => `<button class="${n.years === y ? 'on' : ''}" onclick="UI.nego.years=${y};renderModal()">${y} an${y > 1 ? 's' : ''}</button>`).join('')}
 <label class="small"><input type="checkbox" ${n.promise ? 'checked' : ''} onchange="UI.nego.promise=this.checked;$('#nodds').innerHTML=negoOddsHTML(${r.id})"> promettre un rôle de leader</label></div>
 <div id="nodds">${negoOddsHTML(r.id)}</div>
 <button class="pri" onclick="doNego(${r.id})">Faire l'offre</button></div>`;
}
// Salaire demandé tel que l'estime le directeur sportif (erreur propre au coureur, la même à chaque affichage).
function demEst(r) {
  return Math.round((contractDemand(r) * (0.9 + (0.2 * ((r.nzc || 0) + 1.6)) / 3.2)) / 5) * 5;
}
// Chance estimée d'accord et ce qui la compose, d'après ce que sait le directeur sportif.
function negoOddsHTML(id) {
  const r = S.riders[id],
    n = UI.nego;
  if (!r || !n) return '';
  const o = negoChance(r, n.sal, n.years, n.promise, demEst(r));
  const pc = v => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`;
  const cls = o.p >= 0.6 ? 'pos' : o.p >= 0.3 ? '' : 'neg';
  return `<div class="small"><b class="${cls}">Chance estimée d'accord : ≈${Math.round(o.p * 100)} %</b> <span class="mut">(sur le salaire demandé estimé)</span><br>${o.parts
    .map(([l, v], i) => `<span class="mut">${l} : ${i ? pc(v) + ' pts' : Math.round(v * 100) + ' %'}</span>`)
    .join(' · ')}</div>`;
}
function doNego(id) {
  const n = UI.nego;
  const res = negotiate(id, n.sal, n.years, n.promise);
  save();
  UI.flash = (res.ok ? '✅ ' : '❌ ') + res.txt;
  closeModal();
  render();
}
function talk(id, k) {
  const t = talkRider(id, k);
  save();
  UI.flash = t;
  closeModal();
  render();
}
function extend(id, y) {
  const e = extendRider(id, y);
  save();
  UI.flash = e || `Contrat prolongé de ${y} an(s).`;
  closeModal();
  render();
}
function release(id) {
  confirmBox('Libérer ce coureur ?', () => {
    const e = releaseRider(id);
    save();
    UI.flash = e || 'Coureur libéré.';
    render();
  });
}
function promote(id) {
  const e = promoteRider(id);
  save();
  UI.flash = e || 'Nouveau néo-pro !';
  closeModal();
  render();
}
function acaJoin(id) {
  const e = joinAcademy(id);
  save();
  UI.flash = e || "Bienvenue à l'académie !";
  closeModal();
  render();
}
function acaRelease(id) {
  confirmBox("Libérer ce jeune de l'académie ?", () => {
    releaseAcademy(id);
    save();
    render();
  });
}
function watch(id) {
  const e = toggleWatch(id);
  save();
  if (e) UI.flash = e;
  renderModal();
}
// Académie et vivier de jeunes.
function viewAcademy() {
  const tab = UI.acaTab;
  let h = `<div class="tabs">${[
    ['aca', `Mon académie (${S.academy.length}/${ACA_MAX})`],
    ['esp', 'Courses espoirs'],
    ['youth', `Vivier (${S.youth.length})`],
    ['alum', 'Anciens'],
  ]
    .map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" onclick="UI.acaTab='${k}';render()">${l}</button>`)
    .join('')}</div>`;
  if (tab === 'aca') h += acaMainHTML();
  else if (tab === 'esp') h += acaEspHTML();
  else if (tab === 'alum') h += acaAlumniHTML();
  else h += acaYouthHTML();
  return h;
}
function acaMainHTML() {
  const rep = acaRep();
  const next = ESP_CAL.find(e => e.w >= S.week);
  const nStag = S.academy.filter(id => isStag(S.riders[id])).length;
  const stagOpen = S.week >= STAG_WEEK;
  let h = `<div class="card"><div class="row sb"><h2>Académie</h2>${autoBtn('academy', 'Académie auto')}</div>
  <div class="row sb small"><span>Réputation : <b>${acaRepLabel(rep)}</b> ${bar(rep)}</span><span>Stagiaires ${nStag}/${STAG_MAX}${stagOpen ? '' : ` (dès la semaine ${STAG_WEEK})`}</span></div>
  ${next ? `<p class="small">Prochaine course espoirs : <b>${esc(next.name)}</b> (semaine ${next.w}${next.st.length > 1 ? ', ' + next.st.length + ' étapes' : ''}).</p>` : ''}
  <details class="info"><summary>ℹ️ Explications</summary><p class="small mut">Vos espoirs courent le calendrier espoirs (simulé par le moteur de course), progressent selon leur maturité (précoce, normale, tardive) et peuvent devenir stagiaires chez les pros à partir d'août. Un mentor les fait progresser plus vite. Attention au surmenage : au-delà de la charge conseillée pour leur âge, leur potentiel peut s'éroder. Les équipes pros approchent ceux qui brillent : passez-les pros avant 23 ans, ou avant qu'on ne vous les prenne.</p></details>`;
  if (!S.academy.length) return h + '<p class="mut">Aucun espoir. Recrutez dans le vivier.</p></div>';
  const ments = mentorCands();
  for (const r of acaRiders().sort((a, b) => potEst(b) - potEst(a))) {
    const L = youthLoad(r),
      M = youthLoadMax(r),
      m = mentorOf(r);
    const badges = [
      r.ptest ? `<span class="badge">maturité ${DEV_LBL[r.ptest.dev] || '?'}</span>` : '',
      isStag(r) ? '<span class="badge">stagiaire</span>' : '',
      r.approach != null ? `<span class="badge r">courtisé par ${esc(teamShort(r.approach))}</span>` : '',
      r.injury > 0 ? `<span class="badge r">blessé ${r.injury} sem.</span>` : '',
      r.age >= 22 ? '<span class="badge r">dernière saison</span>' : '',
    ].join(' ');
    h += `<div class="acard"><div class="row sb"><span>${rlink(r)} <span class="mut small">${r.age} ans · ${ARCH[r.arch].lbl}</span></span><span><b>${svOv(r)}</b> <span class="small">${stars(potEst(r))}</span></span></div>
    ${badges.trim() ? `<div class="row small">${badges}</div>` : ''}
    <div class="kv"><span>Forme ${bar(r.forme)}</span><span>Moral ${bar(r.moral)}</span><span>Charge <b class="${L > M ? 'neg' : ''}">${L}/${M} j</b></span><span>Mentor <b>${m ? esc(riderName(m)) : '—'}</b></span><span>Potentiel connu à <b>${Math.round(potKnow(r))} %</b></span></div>
    <details class="manage"><summary>Gérer</summary><div class="mgrid">
      <span>Courses espoirs</span><select onchange="acaSet('prog',${r.id},this.value)">${Object.entries(ESP_PROG)
        .map(([k, l]) => `<option value="${k}" ${(r.espProg || 'complet') === k ? 'selected' : ''}>${l}</option>`)
        .join('')}</select>
      <span>Mentor</span><select onchange="acaSet('mentor',${r.id},this.value)"><option value="">—</option>${ments
        .map(
          M =>
            `<option value="${M.id}" ${m && m.id === M.id ? 'selected' : ''}>${esc(riderName(M))} (${M.age} ans)</option>`
        )
        .join('')}</select>
      <span>Entraînement</span><span>${trainSel(r)}</span></div>
      <div class="row"><button ${r.ptest && r.ptest.s === S.season ? 'disabled' : ''} onclick="acaSet('test',${r.id})">🧪 Tests (${fmtMoney(TEST_COST)})</button>${stagOpen && r.age >= 19 ? `<button onclick="acaSet('stag',${r.id},${isStag(r) ? 0 : 1})">${isStag(r) ? 'Fin de stage' : 'Stagiaire chez les pros'}</button>` : ''}${r.age >= 18 ? `<button class="pri" onclick="promote(${r.id})">Passer pro</button>` : ''}<button class="danger" onclick="acaRelease(${r.id})">Libérer</button></div>
    </details></div>`;
  }
  const tested = acaRiders().filter(r => r.ptest);
  if (tested.length)
    h += `<h3>Tests physiques</h3><div class="tw"><table class="t"><thead><tr><th>Coureur</th><th>Saison</th><th>5 s</th><th>1 min</th><th>5 min</th><th>20 min</th><th>VO2max</th><th>Maturité</th></tr></thead><tbody>${tested
      .map(
        r =>
          `<tr><td>${rlink(r)}</td><td>${r.ptest.s}</td><td>${fmtDec(r.ptest.p5, 1)}</td><td>${fmtDec(r.ptest.p60, 1)}</td><td>${fmtDec(r.ptest.p300, 2)}</td><td>${fmtDec(r.ptest.p1200, 2)}</td><td>${r.ptest.vo2}</td><td>${DEV_LBL[r.ptest.dev] || '—'}</td></tr>`
      )
      .join(
        ''
      )}</tbody></table></div><p class="small mut">Puissances en W/kg. Repères chez les pros : 20 min ≈ 5,8-6,4 W/kg pour un grimpeur de haut niveau, 5 s ≈ 19-22 W/kg pour un sprinteur.</p>`;
  return h + '</div>';
}
function acaEspHTML() {
  const hist = (S.espHist || []).filter(e => e.s === S.season);
  let h = `<div class="card"><h2>Calendrier juniors et espoirs ${S.season}</h2><div class="tw"><table class="t"><tbody>${ESP_CAL.map(
    e =>
      `<tr class="${e.w < S.week ? 'done' : ''}"><td>${e.w}</td><td><b>${esc(e.name)}</b> <span class="mut small">${{ club: 'espoirs · club', big: 'espoirs · course par étapes', nat: 'espoirs · championnats nationaux', tour: 'espoirs · sélections nationales', monde: 'espoirs · sélections nationales', jun: 'juniors', junmonde: 'juniors · sélections nationales' }[e.tier]}</span></td><td class="wr">${stageIcons(e.st)}</td></tr>`
  ).join(
    ''
  )}</tbody></table></div><details class="info"><summary>ℹ️ Explications</summary><p class="small mut">Les 17-18 ans courent chez les juniors, les 19-22 ans chez les espoirs. Les jeunes de l'académie courent sous vos couleurs, sauf aux championnats et sur les épreuves par sélections nationales, où seuls les meilleurs de chaque pays sont retenus. Les recruteurs observent les jeunes du vivier à chaque course.</p></details></div>`;
  h += `<div class="card"><h2>Résultats</h2>${
    hist.length
      ? hist
          .map(
            e =>
              `<div class="rcard"><div class="row sb"><b>${esc(e.name)}</b><span class="mut small">sem. ${e.w}</span></div><div class="small">Podium : ${esc(e.top)}</div><div class="small">Vos espoirs : ${esc(e.mine.join(', ') || '—')}</div>${e.notable.length ? `<div class="small">${esc(e.notable.join(' · '))}</div>` : ''}</div>`
          )
          .join('')
      : '<p class="mut">Aucune course espoirs disputée cette saison.</p>'
  }</div>`;
  return h;
}
function acaYouthHTML() {
  const ys = S.youth.map(id => S.riders[id]).filter(Boolean);
  return `<div class="card"><h2>Vivier des jeunes</h2><details class="info"><summary>ℹ️ Explications</summary><p class="small mut">Jeunes coureurs repérés (17-20 ans). Les valeurs sont des <b>estimations</b> dont la précision dépend de vos recruteurs (niveau ${S.staff.scout}), du temps passé à les observer (👁 suivi) et des courses espoirs. Les équipes pros signent les plus en vue en cours de saison ; les meilleurs talents peuvent refuser une académie peu réputée.</p></details>
  ${riderTable(ys, {
    cols: [
      ['Connaiss.', r => Math.round(knowOf(r)) + '%'],
      ['Espoirs', r => (r.espPts ? r.espPts + ' pts' : '—')],
      ['', r => badgesHTML(youthBadges(r))],
      [
        '',
        r =>
          r.preAI != null
            ? `<span class="badge r">pré-contrat ${esc(teamShort(r.preAI))}</span>`
            : `<button onclick="acaJoin(${r.id})">🎓</button> <button onclick="watch(${r.id});render()">${S.watch.includes(r.id) ? '👁✓' : '👁'}</button>`,
      ],
    ],
  })}</div>`;
}
function acaAlumniHTML() {
  const L = alumniList();
  return `<div class="card"><h2>Anciens de l'académie</h2>${
    L.length
      ? `<div class="tw"><table class="t"><thead><tr><th>Coureur</th><th>Passé pro</th><th>Équipe</th><th>Âge</th><th>Gl.</th><th>Victoires pros</th></tr></thead><tbody>${L.map(
          a =>
            `<tr><td>${rlink(a.r)}</td><td>${a.s}</td><td>${esc(a.r.retired ? 'retraité' : teamShort(a.r.team))}</td><td>${a.r.age}</td><td>${svOv(a.r)}</td><td>${a.wins}</td></tr>`
        ).join('')}</tbody></table></div>`
      : '<p class="mut">Aucun ancien pour l’instant : passez vos meilleurs espoirs professionnels.</p>'
  }<p class="small mut">Les victoires de vos anciens font la réputation de l'académie.</p></div>`;
}
function acaSet(k, id, v) {
  let e = null;
  const r = S.riders[id];
  if (k === 'prog') r.espProg = v;
  else if (k === 'mentor') e = setMentor(id, v ? +v : null);
  else if (k === 'test') e = physTest(id) || `Tests de ${riderName(r)} : profil de puissance établi.`;
  else if (k === 'stag') e = setStag(id, !!v);
  if (e) UI.flash = e;
  save();
  render();
}

// Demande d'augmentation en attente.
function raiseCard() {
  const q = S.raiseReq;
  if (!q || !S.riders[q.id]) return '';
  const r = S.riders[q.id];
  return `<div class="flash">💶 ${rlink(r)} demande ${fmtMoney(q.ask)}/an au lieu de ${fmtMoney(r.salary)}. <button onclick="doRaise(true)">Accepter</button> <button onclick="doRaise(false)">Refuser</button> ${autoBtn('contracts', "Laisser l'adjoint décider")}</div>`;
}
function doRaise(ok) {
  UI.flash = answerRaise(ok);
  save();
  render();
}
