// Fiche d'un coureur (fenêtre) : identité, onglets Fiche / Carrière / Palmarès, caractéristiques, état, puissance,
// contrat et statistiques, actions (discussions, contrat, académie, suivi), négociation avec chance estimée,
// relations, courbe de progression, records de puissance. Portage fidèle de riderCard, negoForm, relCard,
// ovChart et pbTable.
import { Btn, Bar, Spark, Stars, RiderLink, KV, statColor } from '../ui.jsx';
import { Icon } from '../icons.jsx';

function Tabs() {
  return (
    <div className="my-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-800 p-1">
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
            'min-h-10 rounded-lg text-sm font-medium ' +
            (UI.riderTab === k ? 'bg-sky-500 text-slate-950' : 'text-slate-200')
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
  const n = UI.nego && UI.nego.id === r.id ? UI.nego : { id: r.id, sal: dem, years: 2, promise: false };
  UI.nego = n;
  const fee = kind === 'transfer' ? transferFee(r) : 0;
  const o = negoChance(r, n.sal, n.years, n.promise, demEst(r));
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
      <div className="mt-2 rounded-xl bg-sky-500/10 px-2.5 py-2 text-sm text-sky-100 ring-1 ring-sky-400/30">
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
            <Btn onClick={() => talk(r.id, 'promettre')}>🤝 Promettre un rôle de leader</Btn>
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
              {['Saison', 'Équipe', 'Gl.', 'Jours', 'V.', 'Pod.', 'UCI', 'km avant'].map(h => (
                <th key={h} className="px-1 text-left">
                  {h}
                </th>
              ))}
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
      <Tabs />
      {UI.riderTab === 'fiche' ? <Fiche r={r} /> : UI.riderTab === 'car' ? <Career r={r} /> : <Palmares r={r} />}
    </div>
  );
}
