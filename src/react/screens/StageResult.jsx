// Après l'étape (portage fidèle de viewStageResult, stageDebriefHTML, standingsCard, summaryCard, energyChart,
// stagePowerCard et climbWattsCard) : bilan, arrivée, analyse de mes coureurs, désobéissances, classements,
// résumé à copier, puissances.
import { useState } from 'react';
import { Card, Btn, RiderLink } from '../ui.jsx';
import { GapChart } from '../race/Broadcast.jsx';

const Row = ({ mine, children }) => (
  <tr className={'border-t border-slate-800 ' + (mine ? 'bg-pink-500/10' : '')}>{children}</tr>
);
function NextBtn({ rc, big }) {
  return rc.done ? (
    <Btn primary className={'w-full ' + (big ? 'min-h-14 text-base' : '')} onClick={() => closeRace()}>
      Terminer : retour
    </Btn>
  ) : (
    <Btn primary className={'w-full ' + (big ? 'min-h-14 text-base' : '')} onClick={() => nextStage()}>
      {big ? `Étape suivante : ${rc.specs[rc.si].name}` : "Préparer l'étape suivante"}
    </Btn>
  );
}
function Debrief({ rc, L, st, mine }) {
  const res = st.res;
  const myRes = res.map((e, i) => [e, i]).filter(([e]) => mine.has(e.id));
  const items = [];
  if (myRes.length) {
    const [e, i] = myRes[0];
    items.push(
      <>
        🏁 Meilleur de l'équipe : <b>{riderName(S.riders[e.id])}</b>, {i + 1}e
        {i ? ` (${fmtGap(e.gap)})` : ' — victoire ! 🎉'}
      </>
    );
  }
  if (rc.specs.length > 1) {
    const g = gcList(rc);
    const k = g.findIndex(id => S.riders[id].team === 0);
    if (k >= 0)
      items.push(
        <>
          🟡 Au général : <b>{riderName(S.riders[g[k]])}</b>, {k + 1}e
          {k ? ` à ${fmtGap(rc.gc[g[k]] - rc.gc[g[0]])}` : ' — maillot de leader !'}
        </>
      );
  }
  if (st.stats) {
    const tired = Object.keys(st.stats)
      .map(Number)
      .filter(id => st.stats[id].e < 15 && !rc.out[id]);
    if (tired.length && !rc.done)
      items.push(
        <>⚠️ Vidés (fond &lt; 15 %) : {tired.map(id => riderName(S.riders[id])).join(', ')} — à ménager demain</>
      );
  }
  const out = rc.sel[0].filter(id => rc.out[id]);
  if (out.length) items.push(<>🚑 Hors course : {out.map(id => riderName(S.riders[id])).join(', ')}</>);
  const why = ((L.sim && L.sim.log) || [])
    .filter(l => l.cls === 'bad' && /^(🔧|💥|👮|⚠️ La chute)/.test(l.txt))
    .slice(-4);
  if (why.length)
    items.push(
      <>
        🔎 Ce qui a pesé :
        {why.map((l, k) => (
          <div key={k} className="text-xs text-slate-300">
            km {Math.round(l.km)} · <span dangerouslySetInnerHTML={{ __html: l.txt }} />
          </div>
        ))}
      </>
    );
  if (!rc.done) {
    const nx = rc.specs[rc.si];
    items.push(
      <>
        ➡️ Demain : <b>{nx.name}</b>
        {nx.rest ? ' (après une journée de repos)' : ''}
      </>
    );
  }
  return (
    <Card title="Bilan de l'étape" className="border-sky-500/40">
      <div className="space-y-1.5">
        {items.map((t, k) => (
          <div key={k} className="rounded-lg bg-slate-800/60 px-2.5 py-1.5 text-sm text-slate-100">
            {t}
          </div>
        ))}
      </div>
      <div className="mt-3">
        <NextBtn rc={rc} />
      </div>
    </Card>
  );
}
export function Standings({ rc, brief }) {
  const g = gcList(rc);
  const mine = new Set(rc.sel[0]);
  const t0 = rc.gc[g[0]];
  const rows = g.map((id, i) => [id, i]).filter(([id, i]) => i < 10 || mine.has(id));
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
    .map(id => `${teamById(id).short}${id === tl[0] ? '' : ' ' + fmtGap(rc.teamGc[id] - rc.teamGc[tl[0]])}`)
    .join(', ');
  return (
    <Card title={`Classement général${brief ? " (avant l'étape)" : ''}`}>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([id, i]) => {
            const r = S.riders[id];
            return (
              <Row key={id} mine={mine.has(id)}>
                <td className="w-8 py-1.5">{i + 1}</td>
                <td>
                  <RiderLink r={r} />
                  {r.age <= 25 ? <span className="ml-1 text-xs text-slate-500">j</span> : null}
                </td>
                <td className="text-xs text-slate-400">{tshort(r)}</td>
                <td className="text-right tabular-nums">{i === 0 ? fmtTime(t0) : fmtGap(rc.gc[id] - t0)}</td>
              </Row>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs leading-relaxed text-slate-300">
        🟢 Points : {top(rc.pts)}
        <br />
        🔴 Montagne : {top(rc.kom)}
        <br />⚪ Jeunes : {yg || '—'}
        {tg ? (
          <>
            <br />
            👥 Équipes : {tg}
          </>
        ) : null}
      </p>
    </Card>
  );
}
function EnergyChart({ stats, ids }) {
  const cols = ['#ff6fa5', '#4fc3f7', '#ffd54f', '#81c784', '#ba68c8', '#ff8a65', '#90a4ae', '#e57373'];
  const lines = ids.filter(id => stats[id] && stats[id].cv && stats[id].cv.length > 1);
  if (!lines.length) return null;
  const W = 320,
    H = 110,
    maxN = Math.max(...lines.map(id => stats[id].cv.length));
  const X = i => 22 + (i / (maxN - 1)) * (W - 28),
    Y = v => H - 14 - (v / 100) * (H - 22);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 50, 100].map(v => (
          <g key={v}>
            <line x1="22" x2={W - 6} y1={Y(v)} y2={Y(v)} stroke="#334155" />
            <text x="2" y={Y(v) + 3} fill="#94a3b8" fontSize="9">
              {v}
            </text>
          </g>
        ))}
        {lines.map((id, k) => (
          <polyline
            key={id}
            points={stats[id].cv.map((v, i) => X(i) + ',' + Y(v)).join(' ')}
            fill="none"
            stroke={cols[k % cols.length]}
            strokeWidth="1.6"
          />
        ))}
        <text x={W - 6} y={H - 2} fill="#94a3b8" fontSize="9" textAnchor="end">
          km →
        </text>
      </svg>
      <div className="flex flex-wrap gap-x-3 text-xs">
        {lines.map((id, k) => (
          <span key={id}>
            <span style={{ color: cols[k % cols.length] }}>■</span> {riderName(S.riders[id])}
          </span>
        ))}
      </div>
    </>
  );
}
function Disob({ id }) {
  const [t, setT] = useState(null);
  const r = S.riders[id];
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 py-2 text-sm">
      <span>
        <RiderLink r={r} /> n'a pas respecté les consignes.
      </span>
      {t ? (
        <i className="text-xs text-slate-400">{t}</i>
      ) : (
        <span className="flex gap-2">
          <Btn
            onClick={() => {
              const x = talkRider(id, 'recadrer');
              save();
              setT(x);
            }}
          >
            Recadrer
          </Btn>
          <Btn onClick={() => setT('ignoré')}>Ignorer</Btn>
        </span>
      )}
    </div>
  );
}
function Summary({ rc, idx, sim }) {
  const [copied, setCopied] = useState(false);
  const L = stageSummary(rc, idx, sim);
  if (!L) return null;
  UI.sumTxt = L.join('\n');
  const [title, ...rest] = L;
  return (
    <Card
      title="📝 Résumé"
      right={
        <Btn
          onClick={() => {
            const t = UI.sumTxt || '';
            try {
              navigator.clipboard.writeText(t).then(
                () => setCopied(true),
                () => alertBox(t.replace(/\n/g, '<br>'))
              );
            } catch (e) {
              alertBox(t.replace(/\n/g, '<br>'));
            }
          }}
        >
          {copied ? '✅ Copié' : '📋 Copier'}
        </Btn>
      }
    >
      <div className="text-sm font-semibold text-slate-100">{title}</div>
      {sim ? <GapChart sim={sim} /> : null}
      <div className="mt-1 space-y-0.5 text-sm">
        {rest.map((l, k) =>
          l.startsWith('  • ') ? (
            <div key={k} className="text-xs text-slate-400">
              {l.trim()}
            </div>
          ) : (
            <div key={k} className="text-slate-200">
              {l}
            </div>
          )
        )}
      </div>
    </Card>
  );
}
function Power({ power }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <h3 className="mb-1 font-semibold text-slate-100">⚡ Puissance sur l'étape</h3>
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-400">
          <tr>
            {['#', 'Coureur', 'Moy.', 'W/kg', 'NP', 'Pic 5 min', 'Énergie'].map(h => (
              <th key={h} className="px-1 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {power.map(e => {
            const r = S.riders[e.id];
            return (
              <Row key={e.id} mine={r.team === 0}>
                <td className="px-1 py-1.5">{e.rk || 'ab.'}</td>
                <td className="px-1">
                  <RiderLink r={r} /> <span className="text-xs text-slate-500">{e.kg} kg</span>
                </td>
                <td className="px-1">
                  <b>{e.avg} W</b>
                </td>
                <td className="px-1">{fmtDec(e.wkg, 2)}</td>
                <td className="px-1">
                  {e.np} W<div className="text-xs text-slate-500">{fmtDec(e.npkg, 2)} W/kg</div>
                </td>
                <td className="px-1">{e.p5} W</td>
                <td className="px-1">{e.kj} kJ</td>
              </Row>
            );
          })}
        </tbody>
      </table>
      <details className="mt-1 text-xs text-slate-400">
        <summary className="cursor-pointer py-1">Explications</summary>
        Moy. = puissance moyenne. NP = puissance normalisée : elle tient compte des accélérations et reflète mieux le
        coût réel de l'effort. Pic 5 min = meilleure moyenne sur 5 minutes. Énergie = travail mécanique total (≈ kcal
        dépensées). Un coureur abrité dans le peloton pousse bien moins fort qu'un équipier qui roule en tête ou qu'un
        échappé.
      </details>
    </div>
  );
}
function ClimbWatts({ climbs, mine }) {
  return (
    <div className="mt-3">
      <h3 className="font-semibold text-slate-100">⚡ Watts des montées</h3>
      <p className="text-xs text-slate-400">
        Puissance estimée d'après le temps d'ascension, la pente et le poids du coureur (vélo compris). VAM = mètres de
        dénivelé gravis par heure.
      </p>
      {climbs.map((c, k) => {
        let prev = 0;
        return (
          <details key={k} open={k === climbs.length - 1} className="mt-2">
            <summary className="cursor-pointer py-1 text-sm">
              <b>{c.name}</b>{' '}
              <span className="text-xs text-slate-400">
                cat. {c.cat} · {c.len} km à {fmtDec(c.avg, 1)} %
              </span>
            </summary>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-400">
                  <tr>
                    {['#', 'Coureur', 'Temps', 'km/h', 'VAM', 'W', 'W/kg'].map(h => (
                      <th key={h} className="px-1 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.top.map(e => {
                    const gap = e.rk !== prev + 1;
                    prev = e.rk;
                    const r = S.riders[e.id];
                    return [
                      gap ? (
                        <tr key={'g' + e.id}>
                          <td colSpan="7" className="text-slate-500">
                            …
                          </td>
                        </tr>
                      ) : null,
                      <Row key={e.id} mine={mine.has(e.id)}>
                        <td className="px-1 py-1.5">{e.rk}</td>
                        <td className="px-1">
                          <RiderLink r={r} /> <span className="text-xs text-slate-500">{r.kg || '?'} kg</span>
                        </td>
                        <td className="px-1">{fmtTime(e.dur)}</td>
                        <td className="px-1">{fmtDec(e.kmh, 1)}</td>
                        <td className="px-1">{e.vam}</td>
                        <td className="px-1">{e.w}</td>
                        <td className="px-1">
                          <b>{fmtDec(e.wkg, 2)}</b>
                        </td>
                      </Row>,
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </div>
  );
}
export function StageResult() {
  const rc = S.rc;
  const L = UI.lastStage;
  const st = rc.stageRes[L.idx];
  const res = st.res;
  const mine = new Set(rc.sel[0]);
  const show = res.map((e, i) => [e, i]).filter(([e, i]) => i < 15 || mine.has(e.id));
  let prev = -1;
  const sim = L.sim;
  const bad = sim ? [...new Set([...(sim.disob || []), ...(sim.refusals ? [...sim.refusals] : [])])] : [];
  const ids = st.stats ? Object.keys(st.stats).map(Number) : [];
  return (
    <div className="space-y-3">
      {L.ttt && rc.tttLog ? (
        <Card title={rc.name}>
          <div className="text-sm text-slate-400">{st.name} — Classement des équipes</div>
          <table className="mt-1 w-full text-sm">
            <tbody>
              {rc.tttLog.map((e, i) => {
                const T = teamById(e.team);
                return (
                  <Row key={e.team} mine={T.player}>
                    <td className="py-1.5">{i + 1}</td>
                    <td>
                      <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: T.color }} />
                      {T.name}
                    </td>
                    <td className="tabular-nums">{i ? fmtGap(e.time - rc.tttLog[0].time) : fmtTime(e.time)}</td>
                    <td className="text-xs text-slate-400">
                      {e.lost ? e.lost + ' lâché(s)' : ''}
                      {e.ldrLost ? ' · leader lâché !' : ''}
                    </td>
                  </Row>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : null}
      <Debrief rc={rc} L={L} st={st} mine={mine} />
      <Card title={rc.name}>
        <div className="text-sm text-slate-400">{st.name} — Arrivée</div>
        <table className="mt-1 w-full text-sm">
          <tbody>
            {show.map(([e, i]) => {
              const gap = i !== prev + 1;
              prev = i;
              const r = S.riders[e.id];
              return [
                gap ? (
                  <tr key={'g' + i}>
                    <td colSpan="4" className="text-slate-500">
                      …
                    </td>
                  </tr>
                ) : null,
                <Row key={e.id} mine={mine.has(e.id)}>
                  <td className="w-8 py-1.5">{i + 1}</td>
                  <td>
                    <RiderLink r={r} />
                  </td>
                  <td className="text-xs text-slate-400">{tshort(r)}</td>
                  <td className="text-right tabular-nums">{i === 0 ? fmtTime(e.time) : fmtGap(e.gap)}</td>
                </Row>,
              ];
            })}
          </tbody>
        </table>
        {rc.specs[L.idx] && rc.specs[L.idx].rest && !rc.done ? (
          <p className="mt-2 text-sm">🛌 Journée de repos : récupération accrue avant l'étape suivante.</p>
        ) : null}
        {st.komb ? (
          <p className="mt-2 text-sm">
            🔥 Prix de la combativité : <RiderLink r={S.riders[st.komb]} />
          </p>
        ) : null}
        {st.cut && st.cut.length ? (
          <p className="mt-2 text-sm text-amber-300">
            ⏱ Hors délais (éliminés) :{' '}
            {st.cut.map((id, k) => (
              <span key={id}>
                {k ? ', ' : ''}
                <RiderLink r={S.riders[id]} />
              </span>
            ))}
          </p>
        ) : null}
      </Card>
      {st.stats ? (
        <Card title="Analyse de mes coureurs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-400">
                <tr>
                  {['Coureur', 'Place', "km à l'avant", 'km de relais', 'Attaques', 'Effort moy.', 'Fond final'].map(
                    h => (
                      <th key={h} className="px-1 text-left">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {ids.map(id => {
                  const s = st.stats[id];
                  const rk = res.findIndex(e => e.id === id) + 1;
                  return (
                    <Row key={id}>
                      <td className="px-1 py-1.5">
                        <RiderLink r={S.riders[id]} />
                      </td>
                      <td className="px-1">{rk || 'ab.'}</td>
                      <td className="px-1">{s.kf}</td>
                      <td className="px-1">{s.kw}</td>
                      <td className="px-1">{s.att}</td>
                      <td className="px-1">{Math.round(s.I * 100)}%</td>
                      <td className="px-1">{s.e}%</td>
                    </Row>
                  );
                })}
              </tbody>
            </table>
          </div>
          <h3 className="mt-3 font-semibold text-slate-100">Évolution des réserves (fond)</h3>
          <EnergyChart stats={st.stats} ids={ids} />
        </Card>
      ) : null}
      {bad.length ? (
        <Card title="Désobéissances">
          {bad.map(id => (
            <Disob key={id} id={id} />
          ))}
        </Card>
      ) : null}
      {rc.specs.length > 1 ? <Standings rc={rc} /> : null}
      <Summary rc={rc} idx={L.idx} sim={L.sim} />
      {(st.power && st.power.length) || (st.climbs && st.climbs.length) ? (
        <details className="rounded-2xl border border-slate-700/70 bg-slate-900 p-3.5">
          <summary className="cursor-pointer text-sm font-semibold text-slate-100">
            ⚡ Puissances : étape et montées
          </summary>
          {st.power && st.power.length ? <Power power={st.power} /> : null}
          {st.climbs && st.climbs.length ? <ClimbWatts climbs={st.climbs} mine={mine} /> : null}
        </details>
      ) : null}
      <NextBtn rc={rc} big />
    </div>
  );
}
