// Fiche d'un coureur (fenêtre) : identité, onglets Fiche / Carrière / Palmarès, caractéristiques, état, puissance,
// contrat et statistiques, actions (discussions, contrat, académie, suivi), négociation avec chance estimée,
// relations, courbe de progression, records de puissance. Portage fidèle de riderCard, negoForm, relCard,
// ovChart et pbTable.
import { Btn, Bar, Spark, Stars, RiderLink, KV, statColor } from '../ui.jsx';
import { Icon } from '../icons.jsx';
import { CompareBtn } from './Compare.jsx';
import { PeriStrip } from './Team.jsx';

function Tabs() {
  return (
    <div className="my-2 flex flex-wrap gap-x-5 border-b border-slate-800">
      {[
        ['fiche', 'Fiche'],
        ['car', 'Carrière'],
        ['palm', 'Palmarès'],
      ].map(([k, l]) => (
        <button
          key={k}
          type="button"
          onClick={() => ((UI.riderTab = k), renderModal())}
          className={
            'min-h-10 text-sm font-medium ' +
            (UI.riderTab === k ? 'text-slate-50 shadow-[inset_0_-3px_0_#f2c94c]' : 'text-slate-400 hover:text-slate-100')
          }
        >
          {l}
        </button>
      ))}
    </div>
  );
}
function Nego({ r }) {
  const kind = marketKind(r);
  const dem = contractDemand(r);
  if (r.nextTeam != null) return <p className="text-xs text-slate-400">S'est déjà engagé pour la saison prochaine.</p>;
  const n =
    UI.nego && UI.nego.id === r.id
      ? UI.nego
      : { id: r.id, sal: dem, years: 2, promise: false, cl: { bonus: 0, role: null, release: false } };
  UI.nego = n;
  n.cl = n.cl || { bonus: 0, role: null, release: false };
  const fee = kind === 'transfer' ? transferFee(r) : 0;
  const o = negoChance(r, n.sal, n.years, n.promise, demEst(r), n.cl);
  const ag = AGENTS[agentOf(r)];
  const su = suitorsOf(r);
  const C = S.negoC && S.negoC.id === r.id && S.negoC.s === S.season ? S.negoC : null;
  const setCl = (k, v) => ((UI.nego.cl[k] = v), renderModal());
  const pc = v => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`;
  return (
    <div className="mt-3 rounded-xl bg-slate-800/70 p-3">
      <b className="text-slate-50">
        {kind === 'free'
          ? 'Négocier un contrat'
          : kind === 'pre'
            ? 'Pré-contrat (arrivée en fin de saison)'
            : 'Transfert'}
      </b>
      <div className="mt-1 text-xs text-slate-400">
        Salaire demandé estimé : ~{fmtMoney(demEst(r))}/an{fee ? ` · indemnité de transfert : ${fmtMoney(fee)}` : ''} ·
        prime à la signature : 10 % du salaire
      </div>
      <div className="mt-1 text-xs text-slate-300">
        🧑‍💼 {ag.lbl} <span className="text-slate-400">— {ag.d}</span>
      </div>
      {su.length ? (
        <div className="mt-1 text-xs text-amber-200">
          👀 Courtisé aussi par {su.map(T => T.name).join(', ')} : il faudra le convaincre.
        </div>
      ) : null}
      {C ? (
        <div className="mt-2 rounded-lg bg-amber-400/10 p-2 text-sm ring-1 ring-amber-300/40">
          🗣️ {counterText(r, C)}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Btn primary onClick={() => doCounter(true)}>
              Accepter
            </Btn>
            <Btn onClick={() => doCounter(false)}>Refuser</Btn>
          </div>
          <div className="mt-1 text-xs text-slate-400">Ou modifiez votre offre ci-dessous et refaites-la.</div>
        </div>
      ) : null}
      {imageAffinity(r) >= 0.25 ? (
        <div className="mt-1 text-xs text-emerald-300">
          ✨ Attiré par l'image de votre équipe ({imageLabel().lbl.toLowerCase()}) : il signera plus volontiers.
        </div>
      ) : null}
      <label className="mt-3 block text-sm text-slate-200">
        Salaire <b className="float-right">{fmtMoney(n.sal)}</b>
        <input
          type="range"
          className="mt-2 h-8 w-full accent-sky-500"
          min={Math.round(dem * 0.6)}
          max={Math.round(dem * 1.6)}
          step="5"
          value={n.sal}
          onChange={e => ((UI.nego.sal = +e.target.value), renderModal())}
        />
      </label>
      <div className="mt-2 flex items-center gap-2 text-sm text-slate-200">
        Durée
        {[1, 2, 3].map(y => (
          <Btn
            key={y}
            active={n.years === y}
            className="min-h-10 flex-1"
            onClick={() => ((UI.nego.years = y), renderModal())}
          >
            {y} an{y > 1 ? 's' : ''}
          </Btn>
        ))}
      </div>
      <label className="mt-2 flex min-h-10 items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          className="h-5 w-5 accent-sky-500"
          checked={!!n.promise}
          onChange={e => ((UI.nego.promise = e.target.checked), renderModal())}
        />{' '}
        promettre un rôle de leader
      </label>
      <div className="mt-2 rounded-lg bg-slate-900/50 p-2 text-sm text-slate-200">
        <b>Clauses</b>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          Prime de victoire
          {[0, 5, 10, 20].map(v => (
            <Btn key={v} active={n.cl.bonus === v} className="min-h-9 px-2" onClick={() => setCl('bonus', v)}>
              {v ? fmtMoney(v) : 'aucune'}
            </Btn>
          ))}
        </div>
        {kind !== 'pre' ? (
          <label className="mt-1 block">
            Rôle de leader garanti à{' '}
            <select
              className="mt-1 min-h-9 rounded-lg bg-slate-800 px-2"
              value={n.cl.role || ''}
              onChange={e => setCl('role', e.target.value || null)}
            >
              <option value="">— aucune course —</option>
              {promRaces().map(c => (
                <option key={c.key} value={c.key}>
                  {c.name} (sem. {c.w})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="mt-1 flex min-h-9 items-center gap-2">
          <input
            type="checkbox"
            className="h-5 w-5 accent-sky-500"
            checked={!!n.cl.release}
            onChange={e => setCl('release', e.target.checked)}
          />
          clause libératoire ({fmtMoney(releaseAmount(r, n.sal))} : une équipe riche pourra le racheter)
        </label>
      </div>
      <div className="mt-2 text-sm">
        <b className={o.p >= 0.6 ? 'text-emerald-300' : o.p >= 0.3 ? 'text-slate-100' : 'text-rose-300'}>
          Chance estimée d'accord : ≈{Math.round(o.p * 100)} %
        </b>{' '}
        <span className="text-xs text-slate-400">(sur le salaire demandé estimé)</span>
        <div className="mt-1 text-xs text-slate-400">
          {o.parts.map(([l, v], i) => `${l} : ${i ? pc(v) + ' pts' : Math.round(v * 100) + ' %'}`).join(' · ')}
        </div>
      </div>
      <Btn primary className="mt-3 w-full" onClick={() => doNego(r.id)}>
        Faire l'offre
      </Btn>
    </div>
  );
}
// Grandes courses à venir où l'on peut promettre un rôle de leader.
function promRaces() {
  return S.cal.filter(c => !c.done && !c.worlds && c.cat <= 1 && (!c.inv || c.inv.includes(0)));
}
// Préparation physique : plan de saison, laboratoire, santé.
function PhysioRider({ r }) {
  const P = periOf(r);
  const L = S.cal.filter(c => !c.done && c.w > S.week && !c.worlds && (!c.inv || c.inv.includes(0)));
  const lab = r.lab || [];
  const d = (a, b) => (b == null ? '' : ` (${a - b >= 0 ? '+' : ''}${a - b})`);
  const inj = r.injury > 0 ? INJ[(r.inj && r.inj.k) || 'plaies'] : null;
  return (
    <div className="mt-3 rounded-xl bg-slate-800/60 p-2.5 text-sm">
      <h3 className="mb-1 font-semibold text-slate-100">Préparation physique</h3>
      <PeriStrip r={r} />
      <div className="mt-1 text-xs text-slate-300">
        {P && P.targets.length
          ? `Objectifs du plan : ${P.targets.map(k => (S.cal.find(c => c.key === k) || {}).name).join(', ')}`
          : 'Pas de plan : entraînement choisi semaine par semaine.'}
        {periBlockNow(r) ? ` · cette semaine : ${PERI[periBlockNow(r).k].lbl.toLowerCase()}` : ''}
        {r.heatAcc > 0 ? ' · 🥵 acclimaté à la chaleur' : ''}
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          className="min-h-11 rounded-xl bg-slate-800 px-2 text-sm"
          value=""
          onChange={e => e.target.value && doLocker(periBuild, r.id, e.target.value)}
        >
          <option value="">📅 Construire le plan vers…</option>
          {L.map(c => (
            <option key={c.key} value={c.key}>
              {c.name} (sem. {c.w})
            </option>
          ))}
        </select>
        {P ? <Btn onClick={() => doLocker(periClear, r.id)}>Effacer le plan</Btn> : null}
        <Btn disabled={!labReady(r) || r.injury > 0} onClick={() => doLocker(labTest, r.id)}>
          🔬 Test en laboratoire ({fmtMoney(LAB_COST)})
          {!labReady(r) && r.labW ? ` · possible semaine ${(r.labW % 100) + LAB_EVERY}` : ''}
        </Btn>
      </div>
      {lab.length ? (
        <table className="mt-2 w-full text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="text-left">Test</th>
              <th>Seuil</th>
              <th>W/kg</th>
              <th>VO2</th>
              <th>5 s</th>
              <th>1 min</th>
              <th>5 min</th>
            </tr>
          </thead>
          <tbody>
            {lab.slice(0, 4).map((m, i) => {
              const p = lab[i + 1];
              return (
                <tr key={i} className="text-center">
                  <td className="text-left">
                    {m.s} s{m.w}
                  </td>
                  <td>
                    {m.ftp}
                    <span className="text-slate-400">{d(m.ftp, p && p.ftp)}</span>
                  </td>
                  <td>{fmtDec(m.ftp / m.kg, 2)}</td>
                  <td>{fmtDec(m.vo2, 1)}</td>
                  <td>{m.p5s}</td>
                  <td>{m.p1}</td>
                  <td>{m.p5}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
      {inj ? (
        <div className="mt-2 text-xs text-rose-200">
          {inj.ic} {inj.lbl} : encore {r.injury} semaine{r.injury > 1 ? 's' : ''}
          {r.inj && r.inj.early ? ` (reprise avancée, rechute ≈ ${Math.round(relapseP(r) * 100)} %)` : ''}.
          {r.inj && !r.inj.early && r.injury >= 2 ? (
            <Btn className="ml-2 min-h-9" onClick={() => doLocker(earlyReturn, r.id)}>
              ⏩ Reprise anticipée
            </Btn>
          ) : null}
        </div>
      ) : null}
      {(r.injHist || []).length ? (
        <div className="mt-1 text-xs text-slate-400">
          Antécédents :{' '}
          {r.injHist
            .slice(0, 4)
            .map(e => `${(INJ[e.k] || INJ.plaies).ic} ${e.s} s${e.wk} (${e.w} sem.${e.relapse ? ', rechute' : ''})`)
            .join(' · ')}
        </div>
      ) : null}
    </div>
  );
}
// Vestiaire : caractère, leadership, capitaine, promesse de rôle, parrainage.
function LockerRider({ r }) {
  const ch = CHARS[charOf(r)];
  const isCap = S.captain === r.id;
  const pr = (S.proms || []).filter(p => p.id === r.id && p.s === S.season);
  const M = proMentorOf(r);
  const mentees = Object.entries(S.proMentors || {})
    .filter(([y, m]) => +m === r.id && S.riders[y] && S.riders[y].team === 0)
    .map(([y]) => S.riders[y]);
  const L = promRaces();
  return (
    <div className="mt-3 rounded-xl bg-slate-800/60 p-2.5 text-sm">
      <h3 className="mb-1 font-semibold text-slate-100">Dans le vestiaire</h3>
      <div>
        {ch.ic} <b>{ch.lbl}</b> <span className="text-xs text-slate-400">— {ch.d}</span>
      </div>
      <div className="text-xs text-slate-300">
        Leadership <b>{leadOf(r)}</b>
        {isCap ? ' · 🧭 capitaine de route' : ''} · {AGENTS[agentOf(r)].lbl.toLowerCase()}
        {r.cl && (r.cl.bonus || r.cl.release)
          ? ` · contrat : ${r.cl.bonus ? `prime ${fmtMoney(r.cl.bonus)}/victoire` : ''}${r.cl.bonus && r.cl.release ? ', ' : ''}${r.cl.release ? `clause libératoire ${fmtMoney(r.cl.release)}` : ''}`
          : ''}
      </div>
      {goalRaceTag(r) ? <div className="text-xs text-amber-200">🎯 Veut : {goalRaceTag(r)}</div> : null}
      {pr.map(p => {
        const c = S.cal.find(c => c.key === p.key);
        return (
          <div key={p.key} className="text-xs">
            🤞 Promis : leader à {c ? c.name : p.key}{' '}
            {p.done ? (p.ok ? '✅ tenue' : p.ok === false ? '💔 rompue' : '(blessé, excusé)') : '⏳'}
          </div>
        );
      })}
      {M ? <div className="text-xs">🎓 Parrain : {riderName(M)}</div> : null}
      {mentees.length ? <div className="text-xs">🎓 Parraine : {mentees.map(y => riderName(y)).join(', ')}</div> : null}
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {!isCap && r.age >= 25 ? (
          <Btn onClick={() => doLocker(setCaptain, r.id)}>🧭 Nommer capitaine de route</Btn>
        ) : null}
        {L.length ? (
          <select
            className="min-h-11 rounded-xl bg-slate-800 px-2 text-sm"
            value=""
            onChange={e => e.target.value && doLocker(promiseRole, r.id, e.target.value)}
          >
            <option value="">🤞 Lui promettre d'être leader à…</option>
            {L.map(c => (
              <option key={c.key} value={c.key}>
                {c.name} (sem. {c.w})
              </option>
            ))}
          </select>
        ) : null}
        {r.age <= 24 ? (
          <select
            className="min-h-11 rounded-xl bg-slate-800 px-2 text-sm"
            value={M ? M.id : ''}
            onChange={e => doLocker(setProMentor, r.id, e.target.value === '' ? null : +e.target.value)}
          >
            <option value="">🎓 Parrain : aucun</option>
            {proMentorCands(r).map(m => (
              <option key={m.id} value={m.id}>
                {riderName(m)} ({m.age} ans, leadership {leadOf(m)})
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}
// Histoires où le coureur apparaît (en cours d'abord).
function RiderStories({ r }) {
  const L = storiesOn()
    .filter(t => t.a === r.id || t.b === r.id)
    .sort((a, b) => a.done - b.done || b.id - a.id)
    .slice(0, 4);
  if (!L.length) return null;
  return (
    <div className="mt-3 text-sm">
      <h3 className="mb-1 font-semibold text-slate-100">Histoires</h3>
      {L.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => (closeModal(), go('stories'))}
          className="flex min-h-10 w-full items-center gap-2 border-t border-slate-800 text-left first:border-0"
        >
          <span>{STORY_KINDS[t.k].ic}</span>
          <span className="flex-1 text-slate-200">
            {STORY_KINDS[t.k].lbl}
            {t.b != null && S.riders[t.b] ? (
              <span className="text-slate-400"> · {riderName(S.riders[t.b === r.id ? t.a : t.b])}</span>
            ) : null}
            {t.k === 'rival' ? (
              <span className="text-slate-400">
                {' '}
                · {t.data.w}-{t.data.l}
              </span>
            ) : null}
          </span>
          <span className="text-xs text-slate-400">{t.done ? 'terminée' : t.ask ? 'décision' : 'en cours'}</span>
        </button>
      ))}
    </div>
  );
}
function Relations({ r }) {
  const rl = relationsOf(r.id);
  if (!rl.length)
    return <p className="mt-3 text-xs text-slate-400">Relations : rien de particulier avec ses coéquipiers.</p>;
  return (
    <div className="mt-3">
      <h3 className="mb-1 font-semibold text-slate-100">Relations</h3>
      {rl.map(([o, v]) => (
        <div
          key={o}
          className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 py-1.5 text-sm"
        >
          <span>
            {v > 0 ? '🤝' : '⚡'} <RiderLink r={S.riders[o]} />{' '}
            <span className="text-xs text-slate-400">
              {v >= 60 ? 'grande complicité' : v > 0 ? 'bonne entente' : v <= -60 ? 'conflit ouvert' : 'tensions'} (
              {v > 0 ? '+' : ''}
              {v})
            </span>
          </span>
          {v < 0 ? <Btn onClick={() => doMediate(r.id, o)}>Les réunir pour discuter</Btn> : null}
        </div>
      ))}
      <p className="mt-1 text-xs text-slate-400">
        Un équipier proche de son leader lui obéit mieux et l'attend plus volontiers ; un rival refuse de se sacrifier
        pour lui.
      </p>
    </div>
  );
}
function OvChart({ r }) {
  if (isEst(r))
    return (
      <p className="text-xs text-slate-400">
        Courbe de progression connue seulement pour vos coureurs (ou bien observés).
      </p>
    );
  const pts = (r.career || []).map(c => [c.s, c.ov]).concat([[S.season, overall(r.s)]]);
  if (pts.length < 2)
    return <p className="text-xs text-slate-400">La courbe de progression apparaîtra après une saison.</p>;
  const W = 300,
    H = 90,
    mn = Math.min(...pts.map(p => p[1])) - 2,
    mx = Math.max(...pts.map(p => p[1])) + 2;
  const X = i => 20 + (i / (pts.length - 1)) * (W - 30),
    Y = v => H - 15 - ((v - mn) / (mx - mn || 1)) * (H - 25);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <polyline
        points={pts.map((p, i) => X(i) + ',' + Y(p[1])).join(' ')}
        fill="none"
        stroke="#38bdf8"
        strokeWidth="2"
      />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={X(i)} cy={Y(p[1])} r="2.5" fill="#f8fafc" />
          <text x={X(i)} y={H - 2} fill="#94a3b8" fontSize="9" textAnchor="middle">
            {p[0]}
          </text>
          <text x={X(i)} y={Y(p[1]) - 5} fill="#e2e8f0" fontSize="10" fontWeight="700" textAnchor="middle">
            {p[1]}
          </text>
        </g>
      ))}
    </svg>
  );
}
function PowerRecords({ r }) {
  if (!r.pb || !Object.keys(r.pb).length) return null;
  return (
    <div className="mt-3 overflow-x-auto">
      <h3 className="mb-1 font-semibold text-slate-100">Records de puissance</h3>
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-400">
          <tr>
            <th className="text-left">Effort</th>
            <th>W/kg</th>
            <th>W</th>
            <th className="text-left">Montée</th>
          </tr>
        </thead>
        <tbody>
          {PW_BUCKETS.filter(B => r.pb[B[0]]).map(B => {
            const q = r.pb[B[0]];
            return (
              <tr key={B[0]} className="border-t border-slate-800">
                <td className="py-1.5">{B[1]}</td>
                <td className="text-center">
                  <b>{fmtDec(q.wkg, 2)}</b>
                </td>
                <td className="text-center">{q.w}</td>
                <td className="text-xs">
                  {q.climb} ({fmtTime(q.dur)}){' '}
                  <span className="text-slate-400">
                    {q.race} {q.season}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function Fiche({ r }) {
  const T = teamOf(r);
  const mine = r.team === 0;
  const kind = marketKind(r);
  const est = isEst(r);
  const cp = mine || !est ? riderCP(r) : 0;
  const ctr = r.retired
    ? ''
    : mine && !r.aca
      ? `${r.contract} an(s) · ${fmtMoney(r.salary)}/an`
      : r.aca
        ? `Académie · ${fmtMoney(r.salary)}/an`
        : kind === 'free'
          ? `Libre · demande ~${fmtMoney(contractDemand(r))}/an`
          : T
            ? `${r.contract} an(s) chez ${T.name}`
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
  return (
    <>
      {est ? (
        <p className="text-xs text-amber-300">
          Valeurs estimées (connaissance {Math.round(knowOf(r))}%). Observez-le en course ou ajoutez-le à votre liste de
          suivi pour affiner.
        </p>
      ) : null}
      {mine || !est ? (
        <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-slate-200">
          <Icon name="zap" size={15} className="text-yellow-300" /> Seuil en montée ≈ <b>{cp} W</b> (
          {fmtDec(cp / (r.kg || 68), 1)} W/kg) · réserve anaérobie (W') ≈ <b>{fmtDec(wPrime(r), 1)} kJ</b>
          {r.sick > 0 ? ' · 🤒 malade' : ''}
          {r.altBoost > 0 ? " · ⛰️ acclimaté à l'altitude" : ''}
        </p>
      ) : null}
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {STATS.map(k => {
          const v = shownStat(r, k);
          return (
            <div key={k} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-300">{STAT_LBL[k]}</span>
              <span className="flex items-center gap-1.5">
                <b className={'tabular-nums ' + statColor(v)}>
                  {est ? '~' : ''}
                  {v}
                </b>
                <Bar v={v} max={95} tone="b" />
              </span>
            </div>
          );
        })}
      </div>
      {mine || !est ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            {[
              ['Forme', Math.round(r.forme), r.forme],
              ['Fatigue', Math.round(r.fatigue), 100 - r.fatigue],
              ['Moral', Math.round(r.moral), r.moral],
              ['Discipline', r.dis, r.dis, 'b'],
              ['Ambition', r.amb, r.amb, 'b'],
            ].map(([l, v, b, t]) => (
              <div key={l} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-300">{l}</span>
                <span className="flex items-center gap-1.5">
                  <b className="tabular-nums">{v}</b>
                  <Bar v={b} tone={t} />
                </span>
              </div>
            ))}
          </div>
          {mine && r.fh && r.fh.length > 1 ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <Spark pts={r.fh} w={140} h={34} label="Forme et fraîcheur, 16 dernières semaines" />
              <span>
                <span className="text-emerald-300">forme</span> et <span className="text-sky-300">fraîcheur</span> sur{' '}
                {r.fh.length} semaines
              </span>
            </div>
          ) : null}
          {mine && r.fs && r.fs.s === S.season && r.fs.v.length > 4 ? (
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <Spark pts={r.fs.v.map(v => [v, v])} w={140} h={30} label={`Forme sur la saison ${S.season}`} />
              <span>
                saison {S.season} : moyenne <b className="text-slate-200">{formSeason(r).fm}</b>, pic{' '}
                <b className="text-emerald-300">{formSeason(r).fp}</b> (semaine {formSeason(r).fw})
              </span>
            </div>
          ) : null}
          <p className="mt-2 text-sm">
            <b>Caractère :</b> {r.trait === 'aucun' ? '' : TRAITS[r.trait].lbl + ' — '}
            <span className="text-slate-400">{TRAITS[r.trait].d}</span>
          </p>
          {mine && r.goal && r.goal.s === S.season ? (
            <p className="text-sm">
              <b>Objectif de la saison :</b> {GOALS[r.goal.k]} {r.goal.done ? '✅' : '⏳'}{' '}
              <span className="text-xs text-slate-400">
                (atteint : moral et fidélité ; manqué : un ambitieux peut le mal vivre)
              </span>
            </p>
          ) : null}
          {r.rainbow ? <p className="text-sm">🌈 Champion du monde {r.rainbow}</p> : null}
        </>
      ) : (
        <p className="mt-2 text-xs text-slate-400">
          Caractère et état de forme inconnus tant qu'il n'est pas dans votre équipe.
        </p>
      )}
      <div className="mt-2 rounded-xl bg-slate-800/70 px-2.5 py-2 text-sm text-slate-100 ring-1 ring-slate-700">
        🧭 <b>Terrains de prédilection :</b> {riderTerrains(r).join(', ')}
      </div>
      <div className="mt-3">
        <KV rows={kv} />
      </div>
      {r.retired ? null : mine && !r.aca ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Btn onClick={() => talk(r.id, 'feliciter')}>👏 Encourager</Btn>
            <Btn onClick={() => talk(r.id, 'recadrer')}>☝️ Recadrer</Btn>
            <Btn onClick={() => talk(r.id, 'promettre')}>🤝 Promettre un rôle (sans date)</Btn>
            <Btn onClick={() => extend(r.id, 1)}>✍️ Prolonger 1 an</Btn>
            <Btn onClick={() => extend(r.id, 2)}>✍️ Prolonger 2 ans</Btn>
            <Btn danger onClick={() => release(r.id)}>
              Libérer ({fmtMoney(Math.round(r.salary * 0.5 * r.contract))})
            </Btn>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Prolongation demandée : {fmtMoney(contractDemand(r))}/an.
            {r.promise ? ' Vous lui avez promis un rôle de leader.' : ''}
          </p>
          <LockerRider r={r} />
          <PhysioRider r={r} />
          <Relations r={r} />
          <RiderStories r={r} />
        </>
      ) : r.aca ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn primary onClick={() => promote(r.id)}>
            ⬆️ Passer pro (2 ans)
          </Btn>
          <Btn onClick={() => talk(r.id, 'feliciter')}>👏 Encourager</Btn>
          <Btn danger className="col-span-2" onClick={() => acaRelease(r.id)}>
            Libérer de l'académie
          </Btn>
        </div>
      ) : r.youth ? (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Btn primary onClick={() => acaJoin(r.id)}>
            🎓 Recruter à l'académie (10 k€ + 12 k€/an)
          </Btn>
          <Btn onClick={() => watch(r.id)}>{S.watch.includes(r.id) ? '👁 Ne plus suivre' : '👁 Suivre'}</Btn>
        </div>
      ) : (
        <>
          <Btn className="mt-3 w-full" onClick={() => watch(r.id)}>
            {S.watch.includes(r.id) ? '👁 Ne plus suivre' : '👁 Ajouter au suivi'}
          </Btn>
          <Nego r={r} />
        </>
      )}
    </>
  );
}
function Career({ r }) {
  const mine = r.team === 0,
    est = isEst(r);
  const rows = (r.career || []).slice().reverse();
  return (
    <>
      <OvChart r={r} />
      <PowerRecords r={r} />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-400">
            <tr>
              {['Saison', 'Équipe', 'Gl.', 'Jours', 'V.', 'Pod.', 'UCI', 'km avant', ...(mine ? ['Forme'] : [])].map(
                h => (
                  <th key={h} className="px-1 text-left">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-800">
              <td className="px-1 py-1.5">{S.season}*</td>
              <td className="px-1">{tshort(r)}</td>
              <td className="px-1">{svOv(r)}</td>
              <td className="px-1">{r.stats.days}</td>
              <td className="px-1">{r.stats.wins}</td>
              <td className="px-1">{r.stats.podiums}</td>
              <td className="px-1">{r.stats.pts}</td>
              <td className="px-1">{Math.round(r.stats.kf || 0)}</td>
              {mine ? (
                <td className="px-1 whitespace-nowrap">
                  {formSeason(r).fm != null ? `${formSeason(r).fm} · pic ${formSeason(r).fp}` : '—'}
                </td>
              ) : null}
            </tr>
            {rows.map((c, i) => (
              <tr key={i} className="border-t border-slate-800">
                <td className="px-1 py-1.5">{c.s}</td>
                <td className="px-1">{c.t}</td>
                <td className="px-1">{mine || !est ? c.ov : '?'}</td>
                <td className="px-1">{c.d}</td>
                <td className="px-1">{c.w}</td>
                <td className="px-1">{c.p}</td>
                <td className="px-1">{c.u}</td>
                <td className="px-1">{c.kf || 0}</td>
                {mine ? (
                  <td className="px-1 whitespace-nowrap">{c.fm != null ? `${c.fm} · pic ${c.fp}` : '—'}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-400">* saison en cours</p>
      </div>
    </>
  );
}
function Palmares({ r }) {
  const pl = (r.palm || []).slice().reverse();
  if (!pl.length) return <p className="text-slate-400">Palmarès vierge.</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {pl.map((p, i) => (
          <tr key={i} className="border-t border-slate-800">
            <td className="py-1.5 pr-2">{p.s}</td>
            <td className="pr-2">{p.k === 1 ? '🥇' : p.k === 2 ? '🥈' : '🥉'}</td>
            <td className="pr-2">{p.r}</td>
            <td className="pr-2 text-xs">{p.e}</td>
            <td className="text-xs text-slate-400">{p.t}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
export function RiderSheet({ r }) {
  const T = teamOf(r);
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xl font-bold text-slate-50">
          {r.fn} {r.ln}{' '}
          <span className="ml-1 rounded bg-slate-800 px-1.5 py-0.5 align-middle text-xs text-slate-300">{r.nat}</span>
        </h2>
        <button
          type="button"
          onClick={() => closeModal()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-200"
        >
          <Icon name="x" />
        </button>
      </div>
      <div className="mt-1 text-sm text-slate-400">
        {ARCH[r.arch].lbl} · {r.age} ans ·{' '}
        {r.retired ? 'Retraité' : r.aca ? 'Académie' : T ? T.name : r.youth ? 'Vivier des jeunes' : 'Libre'} ·{' '}
        {r.kg ? fmtDec(r.kg, 1) : '?'} kg
        {r.kgOpt != null && r.kg - r.kgOpt >= 0.5 ? (
          <span className="text-amber-300" title="Au-dessus de son poids de course : il perd en montée">
            {' '}
            (+{fmtDec(r.kg - r.kgOpt, 1)} kg sur son poids de forme)
          </span>
        ) : null}{' '}
        · Popularité {Math.round(r.pop || 0)} · Global <b className="text-slate-100">{svOv(r)}</b> · Potentiel{' '}
        <Stars v={potEst(r)} />
        {potKnow(r) < 70 ? <span className="text-xs"> (estimé)</span> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <CompareBtn r={r} />
        {(S.know[r.id] || 0) < 100 && (r.team === 0 || r.youth || r.age <= 23) && !r.retired ? (
          <button
            type="button"
            disabled={r.team !== 0 && effortLeft() <= 0}
            className="min-h-9 rounded-lg bg-slate-800 px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-slate-700 disabled:opacity-50"
            title={
              r.team === 0
                ? 'Révèle son vrai potentiel et son profil de puissance'
                : `Révèle ses vraies caractéristiques et son potentiel (${effortLeft()} test(s) de recrutement restant(s) cette saison)`
            }
            onClick={() => ((UI.flash = effortTest(r.id)), save(), renderModal(), render())}
          >
            🧪 Test d'effort ({effortCost(r)} k€{r.team !== 0 ? ` · ${effortLeft()}/${EFFORT_MAX}` : ''})
          </button>
        ) : null}
        {r.team === 0 && !r.aca ? (
          <button
            type="button"
            disabled={!!(r.fit && r.fit.s === S.season)}
            className="min-h-9 rounded-lg bg-slate-800 px-2.5 text-xs font-semibold text-slate-200 ring-1 ring-slate-700 disabled:opacity-50"
            title="Position affinée en soufflerie : chrono plus rapide cette saison et la suivante"
            onClick={() => ((UI.flash = windTunnel(r.id)), save(), renderModal(), render())}
          >
            🌬️ Soufflerie ({FIT_COST} k€){fitK(r) ? ` · −${Math.round(fitK(r) * 2880)} s / 40 km` : ''}
          </button>
        ) : null}
        {(S.know[r.id] || 0) >= 100 && r.team !== 0 ? (
          <span className="min-h-9 rounded-lg px-2.5 py-2 text-xs text-emerald-300">🧪 Testé : valeurs exactes</span>
        ) : null}
      </div>
      <Tabs />
      {UI.riderTab === 'fiche' ? <Fiche r={r} /> : UI.riderTab === 'car' ? <Career r={r} /> : <Palmares r={r} />}
    </div>
  );
}
