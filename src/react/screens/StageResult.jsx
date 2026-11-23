// Après l'étape (portage fidèle de viewStageResult, stageDebriefHTML, standingsCard, summaryCard, energyChart,
// stagePowerCard et climbWattsCard) : bilan, arrivée, analyse de mes coureurs, désobéissances, classements,
// résumé à copier, puissances.
import { RaceSteps } from '../race/RaceBar.jsx';
import { useState } from 'react';
import { Card, Btn, RiderLink, Tabs } from '../ui.jsx';
import { GapChart } from '../race/Broadcast.jsx';
import { SprintReplay } from '../race/Finale.jsx';

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
// Revoir l'arrivée de l'étape qu'on vient de courir (sprint, côte ou solitaire).
function ReplayCard({ sim }) {
  const [on, setOn] = useState(false);
  const tr = sim ? stageReplay(sim) : null;
  if (!tr) return null;
  return (
    <Card>
      {on ? (
        <SprintReplay tr={tr} />
      ) : (
        <Btn className="w-full" onClick={() => setOn(true)}>
          🎬 Revoir l'arrivée
        </Btn>
      )}
    </Card>
  );
}
// Les moments décisifs de l'étape (sommets des grands cols, secteurs pavés), à revoir.
function MomentsCard({ sim }) {
  const [open, setOpen] = useState(null);
  const L = (sim && sim.momentTraces) || [];
  if (!L.length) return null;
  return (
    <Card title="⚡ Moments décisifs">
      <div className="divide-y divide-slate-800">
        {L.map((e, k) => (
          <div key={k} className="py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 text-slate-200">
                {e.kind === 'pave' ? '🧱' : e.kind === 'desc' ? '⤵️' : e.kind === 'bord' ? '🌬️' : '⛰️'} {e.name}{' '}
                <span className="text-xs text-slate-400">· km {e.km}</span>
              </span>
              <Btn className="min-h-9 shrink-0" onClick={() => setOpen(open === k ? null : k)}>
                {open === k ? 'Fermer' : '▶ Revoir'}
              </Btn>
            </div>
            {open === k ? <SprintReplay key={k} tr={e.tr} /> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
// Le résumé de l'étape, comme à la télévision (tvRecap, 52-commentary.js).
function Commentary({ rc, idx }) {
  const p = tvRecap(rc, idx);
  if (!p || !p.length) return null;
  return (
    <Card className="border-amber-400/30" title="🎙️ Le résumé du commentateur">
      <div className="space-y-2 text-[15px] leading-relaxed text-slate-100">
        {p.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </div>
    </Card>
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
  // pourquoi mes coureurs clés ont perdu le contact (leaders, sprinteurs, cartes libres, meilleur de l'équipe)
  if (st.stats) {
    const key = id => ['leader', 'sprint', 'free'].includes((rc.orders[id] || {}).o);
    const best = myRes.length ? myRes[0][0].id : null;
    const drops = myRes
      .filter(([e]) => e.gap > 0 && st.stats[e.id] && st.stats[e.id].drop && (key(e.id) || e.id === best))
      .slice(0, 3)
      .map(([e]) => dropExplain(S.riders[e.id], st.stats[e.id].drop, (rc.orders[e.id] || {}).o))
      .filter(Boolean);
    if (drops.length)
      items.push(
        <>
          🩺 Pourquoi ils ont lâché :
          {drops.map((d, k) => (
            <div key={k} className="mt-1 text-xs text-slate-300">
              <div>{d.txt}</div>
              <div className="text-slate-400">{d.why}</div>
              {d.tip && <div className="text-sky-300">💡 {d.tip}</div>}
            </div>
          ))}
        </>
      );
    // sprint : pourquoi mes sprinteurs ont gagné ou perdu
    const sprints = myRes
      .filter(([e]) => st.stats[e.id] && st.stats[e.id].sp && (rc.orders[e.id] || {}).o === 'sprint')
      .slice(0, 2)
      .map(([e, i]) => {
        // place dans le sprint de son groupe (le vainqueur a pu arriver seul devant)
        const grp = res.filter(y => Math.abs(y.time - e.time) < 1);
        const k = grp.findIndex(y => y.id === e.id) + 1;
        const lead = grp[0] === res[0];
        return sprintExplain(S.riders[e.id], st.stats[e.id].sp, lead ? i + 1 : k, S.riders[grp[0].id].s.spr, lead);
      })
      .filter(Boolean);
    if (sprints.length)
      items.push(
        <>
          🏁 Le sprint :
          {sprints.map((d, k) => (
            <div key={k} className="mt-1 text-xs text-slate-300">
              <div>{d.txt}</div>
              {d.tip && <div className="text-sky-300">💡 {d.tip}</div>}
            </div>
          ))}
        </>
      );
  }
  // l'échappée : reprise (où, par qui, à quelle vitesse) ou allée au bout
  const brk = breakExplain(st.brk);
  if (brk) items.push(<>{brk}</>);
  // les moments décisifs du final
  if (st.moments && st.moments.length)
    items.push(
      <>
        🎬 Moments décisifs :
        {st.moments.map((h, k) => (
          <div key={k} className={'text-xs ' + (h.mine ? 'text-pink-200' : 'text-slate-300')}>
            km {h.km} · <span dangerouslySetInnerHTML={{ __html: h.txt }} />
          </div>
        ))}
      </>
    );
  // ce que l'ordinateur a fait contre vous, vos consignes, où le général se joue (78-tactics-review.js)
  const tac = st.tac;
  if (tac && tac.ai && tac.ai.length)
    items.push(
      <>
        🤖 Les autres équipes :
        {tac.ai.map((l, k) => (
          <div key={k} className="text-xs text-slate-300">
            km {l.km} · {l.txt}
          </div>
        ))}
      </>
    );
  if (tac && (tac.work.length || tac.att.length || tac.refused.length))
    items.push(
      <>
        📋 Vos consignes :
        {tac.work.length ? (
          <div className="text-xs text-slate-300">
            En tête : {tac.work.map(w => `${riderName(S.riders[w.id])} ${w.km} km`).join(', ')}
          </div>
        ) : null}
        {tac.att.length ? (
          <div className="text-xs text-slate-300">
            Attaques : {tac.att.map(a => `${riderName(S.riders[a.id])}${a.n > 1 ? ` ×${a.n}` : ''}`).join(', ')}
          </div>
        ) : null}
        {tac.refused.length ? (
          <div className="text-xs text-amber-300">
            N'ont pas suivi la consigne : {tac.refused.map(id => riderName(S.riders[id])).join(', ')}
          </div>
        ) : null}
      </>
    );
  const gs = gcStory(rc);
  if (gs)
    items.push(
      <>
        🧭 Où le général se joue :
        <div className="text-xs text-slate-300">
          {gs.isLead
            ? `${riderName(S.riders[gs.me])} porte le maillot de leader.`
            : `${riderName(S.riders[gs.me])} est à ${fmtGap(gs.total)} de ${riderName(S.riders[gs.lead])}.`}
          {gs.loss.length
            ? ` Temps perdu surtout : ${gs.loss.map(l => `étape ${l.k} (${fmtGap(l.d)})`).join(', ')}.`
            : ''}
          {gs.gain.length ? ` Repris : étape ${gs.gain[0].k} (${fmtGap(-gs.gain[0].d)}).` : ''}
          {gs.made && !gs.isLead ? ` Le leader a fait la différence à l'étape ${gs.made.k} (${fmtGap(gs.made.d)} sur son dauphin).` : ''}
        </div>
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
                  {r.age <= 25 ? <span className="ml-1 text-xs text-slate-400">j</span> : null}
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
function Disob({ id, st }) {
  const [t, setT] = useState(null);
  const r = S.riders[id];
  const d = disobExplain(r, st && st.stats && st.stats[id] ? st.stats[id].why : null);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 py-2 text-sm">
      <span>
        <RiderLink r={r} /> n'a pas respecté les consignes.
        {d ? (
          <>
            <span className="block text-xs text-slate-400">{d.why}</span>
            {d.tip && <span className="block text-xs text-sky-300">💡 {d.tip}</span>}
          </>
        ) : null}
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
                  <RiderLink r={r} /> <span className="text-xs text-slate-400">{e.kg} kg</span>
                </td>
                <td className="px-1">
                  <b>{e.avg} W</b>
                </td>
                <td className="px-1">{fmtDec(e.wkg, 2)}</td>
                <td className="px-1">
                  {e.np} W<div className="text-xs text-slate-400">{fmtDec(e.npkg, 2)} W/kg</div>
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
                          <td colSpan="7" className="text-slate-400">
                            …
                          </td>
                        </tr>
                      ) : null,
                      <Row key={e.id} mine={mine.has(e.id)}>
                        <td className="px-1 py-1.5">{e.rk}</td>
                        <td className="px-1">
                          <RiderLink r={r} /> <span className="text-xs text-slate-400">{r.kg || '?'} kg</span>
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
// Abandons tactiques entre deux étapes : vos coureurs encore en course, avec les suggestions du staff.
function TacticalBox({ rc }) {
  const sug = tacticalSuggest(rc);
  const mine = (rc.sel[0] || []).filter(id => !rc.out[id]).map(id => S.riders[id]);
  const go = id => ((UI.flash = myTacticalAbandon(id)), save(), render());
  return (
    <details className="mt-2 rounded-lg bg-slate-800/60 p-2 text-sm" open={sug.length > 0}>
      <summary className="cursor-pointer">
        🏠 Abandon tactique{sug.length ? ` · le staff suggère : ${sug.map(r => riderName(r)).join(', ')}` : ''}
      </summary>
      <p className="mt-1 text-xs text-slate-400">
        Un coureur qui n'a plus rien à jouer peut rentrer préparer ses objectifs : fatigue épargnée, mais
        l'organisateur n'aime pas ça (un peu de réputation en moins sur un grand tour).
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {mine.map(r => (
          <button
            key={r.id}
            type="button"
            className={'rounded px-2 py-1 text-xs ' + (sug.includes(r) ? 'bg-amber-500/30' : 'bg-slate-700')}
            onClick={() => go(r.id)}
          >
            {riderName(r)}
          </button>
        ))}
      </div>
    </details>
  );
}
// Contre-la-montre : l'allure choisie, les temps intermédiaires et les défaillances de mes coureurs.
function TTSplits({ st }) {
  const ids = Object.keys(st.tt || {})
    .map(Number)
    .filter(id => S.riders[id] && S.riders[id].team === 0);
  if (!ids.length) return null;
  const fin = new Map(st.res.map((e, i) => [e.id, [i + 1, i ? e.gap : 0]]));
  const g = s => (s ? '+' + fmtGap(s).replace(/^\+/, '') : 'meilleur temps');
  return (
    <Card title="Le chrono de mes coureurs">
      <p className="mb-2 text-xs text-slate-400">
        Allure choisie, rang et retard au tiers et aux deux tiers du parcours, puis à l'arrivée. Un coureur parti trop vite
        pour sa limite du jour « explose » et finit loin de son allure.
      </p>
      {ids.map(id => {
        const e = st.tt[id];
        const f = fin.get(id) || [null, 0];
        const sp = e.sp || [];
        const trend = sp.length === 2 && f[0] ? sp[0].rk - f[0] : 0;
        return (
          <div key={id} className="border-t border-slate-800 py-2 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                <b className="text-pink-300">{riderName(S.riders[id])}</b>{' '}
                <span className="text-xs text-slate-400">{(TT_PACE[e.pace] || {}).lbl || e.pace}</span>
              </span>
              <span className="tabular-nums text-slate-100">
                {f[0] ? `${f[0]}e · ${g(f[1])}` : '—'}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-slate-300">
              {sp.map((p, j) => (
                <span key={j}>
                  {j ? '2/3' : '1/3'} : {p.rk}e ({g(p.gap)})
                </span>
              ))}
              {trend > 2 ? <span className="text-emerald-300">▲ finit fort (+{trend} places)</span> : null}
              {trend < -2 ? <span className="text-amber-300">▼ a faibli ({trend} places)</span> : null}
              {e.boom != null ? <span className="text-rose-300">💥 a explosé au km {fmtDec(e.boom, 1)}</span> : null}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
// Notes de mes coureurs : place obtenue contre place attendue (ou travail fourni pour un équipier), verdict.
function noteTone(n) {
  return n == null ? 'text-slate-400' : n >= 7.5 ? 'text-emerald-300' : n <= 4.5 ? 'text-rose-300' : 'text-slate-100';
}
function RiderNotes({ st, rc }) {
  const rev = st.rev || {};
  const ids = Object.keys(rev)
    .map(Number)
    .sort((a, b) => (rev[b].n == null ? -1 : rev[b].n) - (rev[a].n == null ? -1 : rev[a].n));
  if (!ids.length) return null;
  const R = rc.done && rc.specs.length > 1 ? raceReview(rc) : null;
  return (
    <Card title="Mes coureurs : qui a performé ?">
      <div>
        {ids.map(id => {
          const v = rev[id];
          return (
            <div key={id} className="flex items-baseline gap-3 border-b border-slate-800 py-2 text-sm">
              <b className={'w-10 shrink-0 text-right font-display text-xl ' + noteTone(v.n)}>
                {v.n == null ? '—' : String(v.n).replace('.', ',')}
              </b>
              <span className="min-w-0 flex-1">
                <RiderLink r={S.riders[id]} /> <span className="text-xs text-slate-400">{NOTE_ROLE[v.role] || v.role}</span>
                <span className="block text-xs text-slate-300">
                  <span className={noteTone(v.n)}>{noteVerdict(v.n)}</span> · {v.why}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Note sur 10 (6 : conforme). Pour un coureur qui joue sa carte : sa place comparée à celle qu'on pouvait attendre
        selon le terrain, sa forme et sa fatigue. Pour un équipier : le travail fourni et le résultat de son leader ou de
        son sprinteur.
      </p>
      {R && R.length ? (
        <div className="mt-3">
          <h4 className="font-display text-base font-semibold text-slate-200">Sur toute la course</h4>
          {R.map(x => (
            <div key={x.id} className="flex items-baseline gap-3 border-b border-slate-800 py-1.5 text-sm">
              <b className={'w-10 shrink-0 text-right font-display text-lg ' + noteTone(x.avg)}>{String(x.avg).replace('.', ',')}</b>
              <span className="min-w-0 flex-1">
                <RiderLink r={S.riders[x.id]} />{' '}
                <span className="text-xs text-slate-400">
                  {x.k} étape{x.k > 1 ? 's' : ''} · meilleure : {x.best.st.split(' — ')[0]} ({String(x.best.n).replace('.', ',')})
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
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
  // onglets : on revient sur « Résumé » à chaque nouvelle étape
  const tabKey = `${rc.key}|${L.idx}`;
  if (UI.resTabFor !== tabKey) {
    UI.resTabFor = tabKey;
    UI.resTab = 'resume';
  }
  const tabs = [
    ['resume', 'Résumé'],
    ['arrivee', 'Arrivée'],
    ...(st.stats || bad.length ? [['equipe', 'Équipe']] : []),
    ...(rc.specs.length > 1 ? [['general', 'Général']] : []),
    ['plus', 'Plus'],
  ];
  const tab = tabs.some(t => t[0] === UI.resTab) ? UI.resTab : 'resume';
  return (
    <div className="space-y-3">
      <RaceSteps step="bilan" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold leading-tight text-slate-50 md:text-3xl">{rc.name}</h2>
          <div className="text-sm text-slate-400">
            {st.name}
            {res[0] && S.riders[res[0].id] ? (
              <>
                {' '}
                · victoire de <b className="text-slate-100">{riderName(S.riders[res[0].id])}</b>
                {teamOf(S.riders[res[0].id]) ? ` (${teamOf(S.riders[res[0].id]).short})` : ''}
              </>
            ) : null}
          </div>
        </div>
        <div className="w-full sm:w-72">
          <NextBtn rc={rc} />
        </div>
      </div>
      <div className="sticky top-[3.6rem] z-10 -mx-1 bg-slate-950/95 px-1 py-1 backdrop-blur md:top-0">
        <Tabs items={tabs} value={tab} onChange={k => ((UI.resTab = k), render(), window.scrollTo(0, 0))} />
      </div>
      {tab === 'arrivee' && L.ttt && rc.tttLog ? (
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
                      {e.sat ? `${e.lost ? ' · ' : ''}${e.sat} sans relayer` : ''}
                      {e.ldrLost ? ' · leader lâché !' : ''}
                    </td>
                  </Row>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : null}
      {tab === 'resume' ? (
        <>
          <Commentary rc={rc} idx={L.idx} />
          <TTSplits st={st} />
          <RiderNotes st={st} rc={rc} />
          <ReplayCard sim={L.sim} />
          <MomentsCard sim={L.sim} />
          <Debrief rc={rc} L={L} st={st} mine={mine} />
        </>
      ) : null}
      {tab === 'arrivee' ? (
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
                      <td colSpan="4" className="text-slate-400">
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
          {st.tv != null ? (
            <p className="mt-2 text-sm">
              📺 Temps d'antenne de votre équipe : <b>{st.tv} min</b>
            </p>
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
          {st.cutInfo ? (
            <p className="mt-1 text-xs text-slate-400">
              ⏱ Délai : {fmtGap(st.cutInfo.lim)} ({fmtDec(st.cutInfo.pct, 1)} % du temps du vainqueur)
              {st.cutInfo.graced ? ` · ${st.cutInfo.n} coureurs hors délais repêchés par le jury (−20 points au classement par points)` : ''}
            </p>
          ) : null}
          {(rc.tacOut || []).filter(t => t.si === L.idx).length ? (
            <p className="mt-1 text-sm">
              🏠 Rentrent chez eux :{' '}
              {(rc.tacOut || [])
                .filter(t => t.si === L.idx)
                .map((t, k) => (
                  <span key={t.id}>
                    {k ? ', ' : ''}
                    <RiderLink r={S.riders[t.id]} /> <span className="text-xs text-slate-400">({t.why})</span>
                  </span>
                ))}
            </p>
          ) : null}
          {!rc.done && rc.specs.length > 1 && rc.si < rc.specs.length - 1 ? <TacticalBox rc={rc} /> : null}
        </Card>
      ) : null}
      {tab === 'equipe' && st.stats ? (
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
      {tab === 'equipe' && bad.length ? (
        <Card title="Désobéissances">
          {bad.map(id => (
            <Disob key={id} id={id} st={st} />
          ))}
        </Card>
      ) : null}
      {tab === 'general' && rc.specs.length > 1 ? <Standings rc={rc} /> : null}
      {tab === 'plus' ? <Summary rc={rc} idx={L.idx} sim={L.sim} /> : null}
      {tab === 'plus' && ((st.power && st.power.length) || (st.climbs && st.climbs.length)) ? (
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
