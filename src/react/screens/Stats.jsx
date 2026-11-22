// Statistiques (portage fidèle de viewStats) : saison en cours ou passée, historique des courses, records,
// classement UCI individuel, watts, palmarès, rivaux, légendes, bilan individuel et équipes.
import { useState } from 'react';
import { Card, Btn, Info, RiderLink, Table, Tr, TeamDot } from '../ui.jsx';
import { SprintReplay } from '../race/Finale.jsx';
import { RivalsTable } from './Home.jsx';
import { SeasonWhy, UciObjective, WtTable, RivalsChart, ProSeries } from './Insights.jsx';

const TABS = [
  ['season', 'Saison'],
  ['races', 'Courses'],
  ['records', 'Records'],
  ['uci', 'UCI coureurs'],
  ['watts', 'Watts'],
  ['palm', 'Mon palmarès'],
  ['rivals', 'Rivaux'],
  ['legends', 'Légendes'],
  ['legacy', 'Héritage'],
  ['monde', 'Le monde'],
  ['review', 'Bilan'],
  ['film', 'Film'],
  ['teams', 'Équipes'],
];
const Empty = ({ t = '—' }) => (
  <tr>
    <td className="py-1.5 text-slate-400">{t}</td>
  </tr>
);
// Top 10 d'un critère : [coureur, valeur affichée, équipe, est-ce mon coureur].
function Top({ title, rows, empty }) {
  return (
    <Card title={title}>
      <Table>
        {rows.length ? (
          rows.map(([r, v, team, mine], i) => (
            <Tr key={r.id} mine={mine}>
              <td className="w-6 text-slate-400">{i + 1}</td>
              <td>
                <RiderLink r={r} />
                {team === 'retired' ? <span className="ml-1 text-xs text-slate-400">retraité</span> : null}
              </td>
              {team && team !== 'retired' ? <td className="text-xs text-slate-400">{team}</td> : null}
              <td className="whitespace-nowrap text-right tabular-nums">{v}</td>
            </Tr>
          ))
        ) : (
          <Empty t={empty} />
        )}
      </Table>
    </Card>
  );
}
function SeasonPicker({ ss, past }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm text-slate-300">
      Saison :
      {[S.season, ...past].map(s => (
        <Btn key={s} active={ss === s} className="min-h-9 px-2.5" onClick={() => ((UI.statSeason = s), render())}>
          {s}
        </Btn>
      ))}
    </div>
  );
}
function SeasonTab() {
  const active = Object.values(S.riders).filter(r => !r.retired && r.team !== null && !r.aca);
  const past = Object.keys(S.seasonRank || {})
    .map(Number)
    .sort((a, b) => b - a);
  const ss = UI.statSeason && UI.statSeason !== S.season && past.includes(UI.statSeason) ? UI.statSeason : S.season;
  if (ss !== S.season) {
    const tr = S.seasonRank[ss];
    const pool = Object.values(S.riders)
      .map(r => [r, (r.career || []).find(c => c.s === ss)])
      .filter(a => a[1]);
    const lst2 = (title, fn, fmt) => {
      const rs = pool
        .slice()
        .sort((a, b) => fn(b[1]) - fn(a[1]))
        .filter(a => fn(a[1]) > 0)
        .slice(0, 10);
      return <Top title={title} rows={rs.map(([r, c]) => [r, fmt ? fmt(fn(c)) : fn(c), c.t, c.t === P().short])} />;
    };
    return (
      <>
        <SeasonPicker ss={ss} past={past} />
        <Card title={`Classement UCI ${ss} (final)`}>
          <Table>
            {tr.map((t, i) => (
              <Tr key={i} mine={t.p}>
                <td className="w-6">{i + 1}</td>
                <td>
                  <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: t.c }} />
                  {t.n}
                </td>
                <td className="whitespace-nowrap text-right">{t.u} pts</td>
                <td className="whitespace-nowrap text-right text-xs text-slate-400">{t.w} v.</td>
              </Tr>
            ))}
          </Table>
        </Card>
        {lst2('Points UCI', c => c.u)}
        {lst2('Victoires', c => c.w)}
        {lst2('Podiums', c => c.p)}
        {lst2(
          "Kilomètres à l'avant",
          c => c.kf || 0,
          v => v + ' km'
        )}
        {lst2('Jours de course', c => c.d)}
      </>
    );
  }
  const teams = uciRanking();
  const lead = (teams[0] && teams[0].uci) || 1;
  const lst = (title, fn, fmt) => {
    const rs = active
      .slice()
      .sort((a, b) => fn(b) - fn(a))
      .filter(r => fn(r) > 0)
      .slice(0, 10);
    return <Top title={title} rows={rs.map(r => [r, fmt ? fmt(fn(r)) : fn(r), tshort(r), r.team === 0])} />;
  };
  return (
    <>
      <SeasonPicker ss={ss} past={past} />
      <SeasonWhy />
      <Card title={`Classement UCI ${S.season}`}>
        <UciObjective />
        <Table>
          {teams.map((t, i) => (
            <Tr key={t.id} mine={t.player}>
              <td className="w-6">{i + 1}</td>
              <td>
                <TeamDot T={t} />
                {t.name}
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-800">
                  <i
                    className="block h-full rounded-full"
                    style={{ width: (((t.uci || 0) / lead) * 100).toFixed(0) + '%', background: t.color }}
                  />
                </div>
              </td>
              <td className="whitespace-nowrap text-right">{t.uci || 0} pts</td>
              <td className="whitespace-nowrap text-right text-xs text-slate-400">{seasonWins(t.id)} v.</td>
            </Tr>
          ))}
        </Table>
      </Card>
      <WtTable />
      <ProSeries />
      {lst('Points UCI', r => r.stats.pts)}
      {lst('Victoires', r => r.stats.wins)}
      {lst('Podiums', r => r.stats.podiums)}
      {lst(
        "Kilomètres à l'avant",
        r => Math.round(r.stats.kf || 0),
        v => v + ' km'
      )}
      {lst('Attaques', r => r.stats.att || 0)}
      {lst('Jours de course', r => r.stats.days)}
    </>
  );
}
function RacesTab() {
  return (
    <Card title="Historique des courses">
      {S.cal.map(c => {
        const hs = (S.raceHist[c.key] || []).slice().reverse();
        return (
          <details key={c.key} className={'border-t border-slate-800 py-1 ' + (hs.length ? '' : 'text-slate-400')}>
            <summary className="cursor-pointer py-1.5 text-sm">
              <b>{c.name}</b> <span className="text-xs text-slate-400">{hs.length} édition(s)</span>
            </summary>
            {hs.length ? (
              <Table>
                {hs.map((e, i) => (
                  <EditionRows key={i} e={e} />
                ))}
              </Table>
            ) : null}
          </details>
        );
      })}
    </Card>
  );
}
function EditionRows({ e }) {
  return (
    <>
      <Tr>
        <td className="align-top">{e.s}</td>
        <td>
          🥇 {e.pod[0] ? e.pod[0].n : ''} <span className="text-xs text-slate-400">{e.pod[0] ? e.pod[0].t : ''}</span>
        </td>
        <td className="text-xs">
          🥈 {e.pod[1] ? e.pod[1].n : ''} · 🥉 {e.pod[2] ? e.pod[2].n : ''}
        </td>
      </Tr>
      {e.pts ? (
        <tr>
          <td />
          <td colSpan={2} className="pb-1.5 text-xs text-slate-400">
            Points : {e.pts} · Montagne : {e.kom || '—'} · Jeune : {e.yg || '—'}
            {e.stages ? (
              <>
                <br />
                Étapes : {e.stages.map((s, i) => i + 1 + '. ' + s.n).join(' · ')}
              </>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
function RecordsTab() {
  const all = Object.values(S.riders).filter(r => (r.palm && r.palm.length) || (r.career && r.career.length));
  const wins = r =>
    (r.palm || []).filter(p => p.k === 1 && p.e !== 'Course espoirs' && !/Maillot|grimpeur|jeune/.test(p.e)).length;
  const gts = r =>
    (r.palm || []).filter(p => p.k === 1 && p.r === raceNameOf('gb') && p.e === 'Classement général').length;
  const pts = r => sum((r.career || []).map(c => c.u)) + r.stats.pts;
  const lst = (title, fn) => {
    const rs = all
      .slice()
      .sort((a, b) => fn(b) - fn(a))
      .filter(r => fn(r) > 0)
      .slice(0, 10);
    return (
      <Top
        title={title}
        empty="Pas encore de données."
        rows={rs.map(r => [r, fn(r), r.retired ? 'retired' : null, r.team === 0])}
      />
    );
  };
  return (
    <>
      {lst('Victoires en carrière (courses, étapes, généraux)', wins)}
      {lst(`Victoires sur la ${raceNameOf('gb')} (général)`, gts)}
      {lst('Points UCI en carrière', pts)}
    </>
  );
}
function RivalsTab() {
  const rows = rivalsWindow(2);
  const U = S.uciTrack && S.uciTrack.w.length >= 2 ? S.uciTrack : S.uciPrev;
  return (
    <Card title="🆚 Vos rivaux au classement UCI">
      <p className="mb-2 text-xs text-slate-400">
        Les deux équipes devant vous et les deux derrière. Touchez une équipe pour sa fiche : matériel, stratégie,
        effectif estimé.
      </p>
      <RivalsTable rows={rows} />
      <h4 className="mb-1 mt-3 text-sm font-semibold text-slate-100">
        Évolution des points
        {U && U.s !== S.season ? <span className="text-xs font-normal text-slate-400"> (saison {U.s})</span> : null}
      </h4>
      <RivalsChart rows={rows} U={U} />
    </Card>
  );
}
// Les directeurs adverses réunis : caractère, relation avec vous, objectifs de la saison, dernier souvenir, dernière
// pique dans la presse, offre en cours. Les plus fâchés et les plus amicaux en tête.
function Directors() {
  const [all, setAll] = useState(false);
  const Ts = S.teams
    .filter(T => !T.player)
    .map(T => ({ T, d: dsOf(T), rel: teamRelOf(T.id) }))
    .sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel) || (b.T.uci || 0) - (a.T.uci || 0));
  if (Ts.length && Ts[0].d.gs !== S.season) dsSeasonGoals();
  const relTxt = v => (v >= 2 ? 'excellente' : v >= 1 ? 'bonne' : v > -1 ? 'neutre' : v > -2 ? 'tendue' : 'hostile');
  const relCls = v => (v >= 1 ? 'text-emerald-300' : v <= -1 ? 'text-rose-300' : 'text-slate-300');
  const jab = T => (S.press || []).find(p => p.s === S.season && p.title === `${T.name} annonce la couleur`);
  const shown = all ? Ts : Ts.slice(0, 6);
  return (
    <Card title="🧑‍💼 Les directeurs adverses">
      <p className="mb-2 text-xs text-slate-400">
        Leur caractère, ce qu'ils pensent de vous et ce qu'ils visent cette saison. Les plus fâchés et les plus amicaux
        d'abord.
      </p>
      <div className="divide-y divide-slate-800">
        {shown.map(({ T, d, rel }) => {
          const goals = d.goals.map(k => S.cal.find(c => c.key === k)).filter(Boolean);
          const nx = goals.filter(c => !c.done).sort((a, b) => a.w - b.w)[0];
          const j = jab(T);
          const bid = S.bid && S.bid.t === T.id ? S.riders[S.bid.id] : null;
          return (
            <div key={T.id} className="py-2 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <button
                  type="button"
                  className="text-left font-semibold text-slate-100 underline decoration-dotted"
                  onClick={() => openTeam(T.id)}
                >
                  <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: T.color }} />
                  {d.fn} {d.ln} <span className="font-normal text-slate-400">· {T.name}</span>
                </button>
                <span className="text-xs">
                  {DS_TEMPER[d.temper].lbl} · relation <b className={relCls(rel)}>{relTxt(rel)}</b>
                </span>
              </div>
              <div className="mt-0.5 text-xs text-slate-300">
                🎯 {goals.map(c => c.name).join(' · ') || '—'}
                {nx ? <span className="text-slate-400"> (prochain : semaine {nx.w})</span> : null}
                {aiCampOn(T.id) ? <span className="text-amber-200"> · 🏔️ en stage en altitude</span> : null}
              </div>
              {d.mem.length ? (
                <div className="text-xs text-slate-400">
                  {d.mem[d.mem.length - 1].v > 0 ? '👍' : '👎'} {d.mem[d.mem.length - 1].txt}
                </div>
              ) : null}
              {j ? <div className="text-xs italic text-slate-400">🎙️ {j.body.replace(/^[^:]*: /, '')}</div> : null}
              {bid ? <div className="text-xs text-emerald-300">💰 Offre en cours pour {riderName(bid)}</div> : null}
            </div>
          );
        })}
      </div>
      {Ts.length > 6 ? (
        <Btn className="mt-1 min-h-9" onClick={() => setAll(!all)}>
          {all ? 'Moins' : `Les ${Ts.length} directeurs`}
        </Btn>
      ) : null}
    </Card>
  );
}
// La saison en chiffres (historique de l'équipe) : classement, victoires, budget, objectifs du sponsor, primes.
function SeasonSummary({ s }) {
  const h = (S.teamHist || []).find(e => e.s === s);
  if (!h) return null;
  const prev = (S.teamHist || []).find(e => e.s === s - 1);
  const kpi = (v, l, d) => (
    <div className="rounded-xl bg-slate-800/70 px-2 py-2.5 text-center">
      <div className="text-xl font-black tabular-nums text-slate-50">{v}</div>
      <div className="text-xs text-slate-400">{l}</div>
      {d ? <div className="text-xs">{d}</div> : null}
    </div>
  );
  const delta = (a, b, inv) =>
    b == null ? null : a === b ? (
      <span className="text-slate-400">=</span>
    ) : a > b !== !!inv ? (
      <span className="text-emerald-300">▲ {Math.abs(a - b)}</span>
    ) : (
      <span className="text-rose-300">▼ {Math.abs(a - b)}</span>
    );
  return (
    <Card title={`🏁 La saison ${s} en chiffres`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpi(h.rank + 'e', 'classement UCI', delta(h.rank, prev && prev.rank, true))}
        {kpi(h.wins, 'victoires', delta(h.wins, prev && prev.wins))}
        {kpi(fmtMoney(h.budget), 'budget', null)}
        {kpi(
          h.conf + '/100',
          'confiance du sponsor',
          h.dConf != null ? (
            h.dConf >= 0 ? (
              <span className="text-emerald-300">+{h.dConf}</span>
            ) : (
              <span className="text-rose-300">{h.dConf}</span>
            )
          ) : null
        )}
      </div>
      {h.objs && h.objs.length ? (
        <div className="mt-3 space-y-1 text-sm">
          {h.objs.map((o, k) => (
            <div key={k} className={o.ok ? 'text-emerald-200' : 'text-slate-300'}>
              {o.ok ? '✅' : '❌'} {o.t}
            </div>
          ))}
          {h.prime ? <div className="text-xs text-slate-400">Primes du sponsor : {fmtMoney(h.prime)}</div> : null}
        </div>
      ) : null}
      <button
        type="button"
        className="mt-3 min-h-10 text-sm text-sky-300 underline"
        onClick={() => ((UI.stats = 'film'), render())}
      >
        🎬 Voir le film de la saison
      </button>
    </Card>
  );
}
function ReviewTab() {
  const rv = S.review;
  const s = rv ? rv.s : (S.teamHist || []).length ? S.teamHist[S.teamHist.length - 1].s : null;
  return (
    <>
      {s != null ? <SeasonSummary s={s} /> : null}
      {s != null ? <Replays season={s} title={`🎬 Mes arrivées de ${s}`} /> : null}
      <Card title={`📋 Bilan individuel${rv ? ' ' + rv.s : ''}`}>
        <p className="mb-2 text-xs text-slate-400">
          Établi à la clôture de chaque saison : jours de course, résultats, évolution du niveau global et objectif
          personnel.
        </p>
        {rv && rv.rows.length ? (
          <Table head={['Coureur', 'Jours', 'Vict.', 'Pod.', 'UCI', 'Niveau', 'Objectif']}>
            {rv.rows.map(x => {
              const r = S.riders[x.id];
              if (!r) return null;
              return (
                <Tr key={x.id}>
                  <td>
                    <RiderLink r={r} />
                  </td>
                  <td>{x.d}</td>
                  <td>{x.w}</td>
                  <td>{x.p}</td>
                  <td>{x.u}</td>
                  <td className="whitespace-nowrap">
                    {x.ov}
                    {x.dov == null ? null : (
                      <span
                        className={
                          'ml-1 ' + (x.dov > 0 ? 'text-emerald-400' : x.dov < 0 ? 'text-rose-400' : 'text-slate-400')
                        }
                      >
                        {x.dov > 0 ? '+' : ''}
                        {x.dov}
                      </span>
                    )}
                  </td>
                  <td className="text-xs">{x.goal ? `${x.goal.ok ? '✅' : '❌'} ${GOAL_SHORT[x.goal.k]}` : '—'}</td>
                </Tr>
              );
            })}
          </Table>
        ) : (
          <p className="text-sm text-slate-400">Le premier bilan sera établi à la fin de la saison.</p>
        )}
      </Card>
    </>
  );
}
function LegendsTab() {
  const L = legends(25);
  return (
    <Card title="🏛️ Légendes du peloton">
      <Info>
        Toutes saisons confondues, retraités compris. Barème : Grand Tour 25 pts, monument ou Mondiaux 15, course par
        étapes majeure 8, classique majeure 6, étape de Grand Tour 3, podiums et maillots.
      </Info>
      {L.length ? (
        <Table head={['#', 'Coureur', 'Pts', 'GT', 'Monum.', '🌈', 'Vict.', '']}>
          {L.map((x, i) => (
            <Tr key={x.r.id} mine={x.r.team === 0}>
              <td>{i + 1}</td>
              <td>
                <RiderLink r={x.r} /> <span className="text-xs text-slate-400">{x.r.nat}</span>
              </td>
              <td>
                <b>{x.s}</b>
              </td>
              <td>{x.gt || ''}</td>
              <td>{x.mon || ''}</td>
              <td>{x.worlds || ''}</td>
              <td>{x.wins}</td>
              <td className="text-xs text-slate-400">
                {x.r.retired ? 'retraité' : teamOf(x.r) ? teamOf(x.r).short : 'libre'}
              </td>
            </Tr>
          ))}
        </Table>
      ) : (
        <p className="text-sm text-slate-400">Aucun palmarès pour l'instant.</p>
      )}
    </Card>
  );
}
function UciTab() {
  const all = Object.values(S.riders)
    .filter(r => !r.retired && r.team !== null && !r.aca && r.stats.pts > 0)
    .sort((a, b) => b.stats.pts - a.stats.pts);
  const rows = all.map((r, i) => [r, i + 1]).filter(([r, k]) => k <= 50 || r.team === 0);
  return (
    <Card title={`Classement UCI individuel ${S.season}`}>
      <Table>
        {rows.length ? (
          rows.map(([r, k]) => (
            <Tr key={r.id} mine={r.team === 0}>
              <td className="w-7">{k}</td>
              <td>
                <RiderLink r={r} />
                <div className="text-xs text-slate-400">
                  {tshort(r)} · {ARCH[r.arch].lbl}
                </div>
              </td>
              <td className="whitespace-nowrap text-right">{r.stats.pts} pts</td>
              <td className="whitespace-nowrap text-right text-xs text-slate-400">{r.stats.wins} v.</td>
            </Tr>
          ))
        ) : (
          <Empty t="Pas encore de points cette saison." />
        )}
      </Table>
    </Card>
  );
}
function WattsTab() {
  const L = S.pwRec || [];
  const pool = Object.values(S.riders).filter(r => !r.retired && r.pb && (r.pb.m || r.pb.l));
  const best = r => Math.max(r.pb.m ? r.pb.m.wkg : 0, r.pb.l ? r.pb.l.wkg : 0);
  const top = pool.sort((a, b) => best(b) - best(a)).slice(0, 15);
  return (
    <>
      <Card title="⚡ Meilleures performances en montée">
        <p className="mb-2 text-xs text-slate-400">
          Efforts de 20 minutes et plus, toutes saisons confondues, classés en watts par kilo.
        </p>
        {L.length ? (
          <Table head={['#', 'Coureur · montée', 'W/kg']}>
            {L.map((q, i) => {
              const r = S.riders[q.id];
              return (
                <Tr key={i} mine={r && r.team === 0}>
                  <td className="w-6 align-top">{i + 1}</td>
                  <td>
                    <RiderLink r={r} />
                    <div className="text-xs text-slate-300">
                      {q.climb} · {q.len} km à {fmtDec(q.avg, 1)} % · {fmtTime(q.dur)} · VAM {q.vam}
                    </div>
                    <div className="text-xs text-slate-400">
                      {q.race} {q.season}
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-right align-top">
                    <b>{fmtDec(q.wkg, 2)}</b>
                    <div className="text-xs text-slate-400">{q.w} W</div>
                  </td>
                </Tr>
              );
            })}
          </Table>
        ) : (
          <p className="text-sm text-slate-400">Aucune grande montée courue pour l'instant.</p>
        )}
      </Card>
      <Card title="Meilleurs grimpeurs en activité (record personnel, 15 min et plus)">
        <Table>
          {top.length ? (
            top.map((r, i) => (
              <Tr key={r.id} mine={r.team === 0}>
                <td className="w-6">{i + 1}</td>
                <td>
                  <RiderLink r={r} />
                  <div className="text-xs text-slate-400">
                    {tshort(r)} · {r.kg} kg
                  </div>
                </td>
                <td className="whitespace-nowrap text-right">
                  <b>{fmtDec(best(r), 2)}</b> W/kg
                </td>
              </Tr>
            ))
          ) : (
            <Empty />
          )}
        </Table>
      </Card>
    </>
  );
}
function PalmTab() {
  const items = [];
  for (const r of Object.values(S.riders)) for (const p of r.palm || []) if (p.my) items.push([p, r]);
  items.sort((a, b) => b[0].s - a[0].s || a[0].k - b[0].k);
  return (
    <Card title={`Palmarès de ${P().name}`}>
      {items.length ? (
        <Table>
          {items.map(([p, r], i) => (
            <Tr key={i}>
              <td>{p.s}</td>
              <td>{p.k === 1 ? '🥇' : p.k === 2 ? '🥈' : '🥉'}</td>
              <td>
                {p.r}
                <div className="text-xs text-slate-400">{p.e}</div>
              </td>
              <td>
                <RiderLink r={r} />
              </td>
            </Tr>
          ))}
        </Table>
      ) : (
        <p className="text-sm text-slate-400">Aucun résultat pour l'instant.</p>
      )}
    </Card>
  );
}
function TeamsTab() {
  return (
    <Card title="Équipes">
      {S.teams
        .filter(t => !t.player)
        .map(t => (
          <details key={t.id} className="border-t border-slate-800 py-1">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 py-1 text-sm">
              <span>
                <TeamDot T={t} />
                <b>{t.name}</b> <span className="text-xs text-slate-400">{STYLES[t.style] || ''}</span>
              </span>
              <Btn
                className="ml-auto min-h-9"
                onClick={e => {
                  e.preventDefault();
                  openTeam(t.id);
                }}
              >
                Fiche
              </Btn>
            </summary>
            <div className="flex flex-wrap gap-x-2 gap-y-1 pb-1 text-sm">
              {t.riders
                .map(id => S.riders[id])
                .sort((a, b) => shownOv(b) - shownOv(a))
                .map(r => (
                  <span key={r.id}>
                    <RiderLink r={r} />{' '}
                    <span className="text-xs text-slate-400">
                      {ARCH[r.arch].lbl} {svOv(r)}
                    </span>
                  </span>
                ))}
            </div>
          </details>
        ))}
    </Card>
  );
}
// Le film de la saison : récit des 5 dernières saisons (grandes victoires, coureur de l'année, révélations…).
// Mes plus belles arrivées : les rejeux conservés (mes podiums), à revoir.
function Replays({ season, title = '🎬 Mes plus belles arrivées' }) {
  const [open, setOpen] = useState(null);
  const L = (S.replays || []).filter(e => season == null || e.s === season).reverse();
  if (!L.length) return null;
  return (
    <Card title={title}>
      <div className="divide-y divide-slate-800">
        {L.map((e, k) => (
          <div key={k} className="py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <b className="text-slate-100">
                  {e.rk === 1 ? '🏆' : e.rk === 2 ? '🥈' : '🥉'} {e.who}
                </b>{' '}
                <span className="text-xs text-slate-400">
                  {e.race}
                  {e.stage ? ' · ' + e.stage : ''} · {e.s}
                </span>
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
function FilmTab() {
  const films = S.films || [];
  if (!films.length)
    return (
      <>
        <Replays />
        <Card title="🎬 Le film de la saison">
          <p className="text-sm text-slate-400">Le premier film sera tourné à la fin de la saison.</p>
        </Card>
      </>
    );
  return (
    <>
      <Replays />
      {films.map((f, k) => (
        <details key={f.s} open={k === 0} className="rounded-2xl border border-slate-700/70 bg-slate-900 p-3.5">
          <summary className="cursor-pointer text-base font-semibold text-slate-100">🎬 Saison {f.s}</summary>
          <div className="mt-2 space-y-3">
            {f.ch.map((c, j) => (
              <div key={j}>
                <h4 className="text-sm font-semibold text-slate-100">
                  {c.ic} {c.t}
                </h4>
                <ul className="mt-1 space-y-0.5 text-sm text-slate-300">
                  {c.l.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      ))}
    </>
  );
}

// Héritage du directeur sportif : score de dynastie (et sa courbe), grands succès, coureurs devenus légendes sous
// vos couleurs, distinctions, panthéon des directeurs (vous, ceux de l'ordinateur en poste et ceux partis).
function DynastyCurve({ hist }) {
  if (hist.length < 2)
    return <p className="mt-1 text-xs text-slate-400">La courbe de votre dynastie apparaîtra après deux saisons.</p>;
  const w = 320,
    h = 70,
    n = hist.length,
    hi = Math.max(10, ...hist.map(p => p.score));
  const X = i => 4 + (i / (n - 1)) * (w - 8),
    Y = v => h - 4 - (v / hi) * (h - 12);
  const d = hist.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.score).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-20 w-full max-w-md" role="img" aria-label="Score de dynastie au fil des saisons">
      <path d={`${d} L${X(n - 1)},${h - 4} L${X(0)},${h - 4} Z`} fill="#f59e0b" opacity="0.15" />
      <path d={d} fill="none" stroke="#f59e0b" strokeWidth="2" />
      {hist.map((p, i) => (
        <circle key={p.s} cx={X(i)} cy={Y(p.score)} r="2.5" fill="#fbbf24">
          <title>{`Saison ${p.s} : ${p.score} pts (${p.club})`}</title>
        </circle>
      ))}
      <text x="4" y="10" fontSize="9" fill="#94a3b8">
        {hist[0].s}
      </text>
      <text x={w - 4} y="10" fontSize="9" fill="#94a3b8" textAnchor="end">
        {hist[n - 1].s}
      </text>
    </svg>
  );
}
function LegacyTab() {
  const L = legacyInit();
  const hall = legacyHall();
  const myRank = hall.findIndex(x => x.me) + 1;
  const B = legacyBadges();
  const leg = legacyLegends();
  const [all, setAll] = useState(false);
  const shown = all ? hall : hall.filter((x, i) => i < 10 || x.me);
  return (
    <>
      <Card title="👔 Votre héritage">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-3xl font-bold tabular-nums text-amber-300">{Math.round(L.score)}</span>
          <span className="text-sm text-slate-300">
            points de dynastie · <b>{myRank}e</b> au panthéon des directeurs ({hall.length})
          </span>
        </div>
        <DynastyCurve hist={L.hist} />
        <Info>
          Barème : grand tour 100, grande classique 40, course par étapes WorldTour 30, étape ou maillot de grand tour
          10 à 15, autres courses 3 à 6 ; en fin de saison, podium UCI des équipes 25/15/10 et 5 par saison en
          WorldTour. Les directeurs de l'ordinateur marquent de la même façon.
        </Info>
        {L.log.length ? (
          <ul className="mt-2 space-y-0.5 text-sm">
            {L.log.slice(0, 12).map((e, i) => (
              <li key={i}>
                <span className="text-slate-400">{e.s}</span> · {e.txt} <span className="text-amber-300">+{e.pts}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-400">Pas encore de grand succès : il vous faut une première grande victoire.</p>
        )}
      </Card>
      <Card title="🎖️ Distinctions">
        <div className="grid gap-2 sm:grid-cols-3">
          {B.map(b => (
            <div
              key={b.n}
              className={'rounded-lg p-2 ring-1 ' + (b.ok ? 'bg-amber-500/10 ring-amber-500/40' : 'opacity-50 ring-slate-700')}
            >
              <div className="text-sm font-semibold">
                {b.ic} {b.n} {b.ok ? '✓' : ''}
              </div>
              <div className="text-xs text-slate-400">{b.d}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="⭐ Vos coureurs devenus légendes">
        {leg.length ? (
          <Table head={['Coureur', 'Victoires', 'Grands succès', '']}>
            {leg.map(e => {
              const r = S.riders[e.id];
              return (
                <Tr key={e.id} mine={r.team === 0}>
                  <td>
                    <RiderLink r={r} />
                    {isAlumnus(r) ? <span title="formé à votre académie"> 🌱</span> : null}
                  </td>
                  <td>{e.wins}</td>
                  <td className="text-xs">{e.big.join(' · ') || '—'}</td>
                  <td className="text-xs text-slate-400">{r.retired ? 'retraité' : teamOf(r) ? teamOf(r).short : 'libre'}</td>
                </Tr>
              );
            })}
          </Table>
        ) : (
          <p className="text-sm text-slate-400">Aucune victoire sous vos couleurs pour l'instant.</p>
        )}
      </Card>
      <Card title="🏛️ Panthéon des directeurs">
        <Table head={['#', 'Directeur', 'Équipe', 'Pts', '']}>
          {shown.map(x => {
            const i = hall.indexOf(x);
            return (
              <Tr key={x.n + x.team + i} mine={x.me}>
                <td>{i + 1}</td>
                <td className={x.me ? 'font-semibold' : ''}>{x.n}</td>
                <td className="text-xs">{x.team}</td>
                <td>
                  <b>{x.score}</b>
                </td>
                <td className="text-xs text-slate-400">
                  {x.active ? 'en poste' : `parti en ${x.to}${x.from ? ` (depuis ${x.from})` : ''}`}
                </td>
              </Tr>
            );
          })}
        </Table>
        {hall.length > 11 ? (
          <Btn onClick={() => setAll(!all)}>{all ? 'Réduire' : `Tout voir (${hall.length})`}</Btn>
        ) : null}
      </Card>
    </>
  );
}
// Le monde du cyclisme : courses, équipes et règlement qui ont changé depuis le début de la partie.
function WorldTab() {
  const W = S.world || { hist: [] };
  const added = (W.added || []).filter(d => S.cal.some(c => c.key === d.key));
  return (
    <>
      <Card title="Le monde du cyclisme">
        <p className="text-sm text-slate-300">
          D'une saison à l'autre, des courses disparaissent ou naissent, montent en WorldTour ou en redescendent ; des
          équipes changent de sponsor ou font faillite ; l'UCI annonce ses réformes un an à l'avance.
        </p>
        <div className="mt-3 grid gap-1 text-sm sm:grid-cols-3">
          <span>
            Licences WorldTour : <b>{wtN()}</b>
          </span>
          <span>
            Effectif maximal : <b>{ROSTER.max}</b> coureurs
          </span>
          <span>
            Salaire minimum : <b>{fmtMoney(minSalary(0))}</b>
          </span>
        </div>
        {W.pending ? (
          <p className="mt-2 text-sm text-amber-300">
            Réforme annoncée pour la saison {W.pending.from} : {W.pending.txt}.
          </p>
        ) : null}
      </Card>
      <Card title="Ce qui a changé">
        {(W.hist || []).length ? (
          W.hist.map((h, i) => (
            <p key={i} className="border-b border-slate-800 py-2 text-sm">
              <span className="font-display font-semibold text-slate-400">{h.s}</span> {h.t}
            </p>
          ))
        ) : (
          <p className="text-sm text-slate-400">Rien n'a encore changé : le premier bilan tombe en fin de saison.</p>
        )}
      </Card>
      {added.length ? (
        <Card title="Courses nées pendant la partie">
          {added.map(d => (
            <p key={d.key} className="text-sm">
              {d.name} <span className="text-slate-400">· semaine {d.w} · {REG_LBL[d.reg]} · depuis {d.born}</span>
            </p>
          ))}
        </Card>
      ) : null}
    </>
  );
}
const VIEWS = {
  season: SeasonTab,
  races: RacesTab,
  records: RecordsTab,
  rivals: () => (
    <>
      <RivalsTab />
      <Directors />
    </>
  ),
  review: ReviewTab,
  film: FilmTab,
  legends: LegendsTab,
  legacy: LegacyTab,
  monde: WorldTab,
  uci: UciTab,
  watts: WattsTab,
  palm: PalmTab,
  teams: TeamsTab,
};
export function Stats() {
  const tab = UI.stats;
  const V = VIEWS[tab] || TeamsTab;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-5 border-b border-slate-800">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => ((UI.stats = k), render())}
            className={
              'min-h-10 text-sm font-medium ' +
              (tab === k ? 'text-slate-50 shadow-[inset_0_-3px_0_#f2c94c]' : 'text-slate-400 hover:text-slate-100')
            }
          >
            {l}
          </button>
        ))}
      </div>
      <V />
    </div>
  );
}
