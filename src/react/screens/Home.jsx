// Accueil (tableau de bord) : prochaine échéance et action, à traiter, situation, rivaux, dernières nouvelles.
// Portage fidèle de viewHome, nextActionHTML, todoHTML et rivalsTable.
import { WtBrief } from './Insights.jsx';
import { Card, Btn, Html, Bar, RiderLink } from '../ui.jsx';
import { StageIcons, WorldsCard } from './Bits.jsx';

export function NextAction() {
  const i = nextRaceIdx();
  if (S.rc && !S.rc.done)
    return (
      <Btn primary className="w-full" onClick={() => go('race')}>
        Reprendre la course en cours : {S.rc.name}
      </Btn>
    );
  if (i >= 0) {
    const c = S.cal[i];
    const nk = nextKeyRace(i);
    if (S.week < c.w)
      return (
        <div className="flex flex-col gap-2">
          <Btn primary onClick={() => advance()}>
            ⏩ Avancer jusqu'à la semaine {c.w} <span className="opacity-80">({c.w - S.week} sem.)</span>
          </Btn>
          {nk !== i && nk >= 0 ? (
            <Btn onClick={() => delegateUntilKey()}>
              ⏩ Confier à l'adjoint jusqu'à {S.cal[nk].name}{' '}
              <span className="text-slate-400">(sem. {S.cal[nk].w})</span>
            </Btn>
          ) : null}
        </div>
      );
    if (c.worlds) return <WorldsCard i={i} />;
    if (c.inv && !c.inv.includes(0))
      return (
        <div className="space-y-2">
          <p className="text-sm text-amber-300">Votre équipe n'est pas invitée à {c.name} (classement insuffisant).</p>
          <Btn primary className="w-full" onClick={() => skipRace(i)}>
            ⏩ Simuler la course sans nous
          </Btn>
        </div>
      );
    const same = S.cal.filter(x => x.w === c.w && !x.done && x !== c);
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Btn primary onClick={() => prepRace(i)}>
            📋 Diriger la course
          </Btn>
          <Btn onClick={() => delegateOne(i)}>🧑‍💼 Confier à l'adjoint</Btn>
        </div>
        {!isKeyRace(c) && nk >= 0 && nk !== i ? (
          <Btn className="w-full" onClick={() => delegateUntilKey()}>
            ⏩ Confier jusqu'à {S.cal[nk].name} <span className="text-slate-400">(sem. {S.cal[nk].w})</span>
          </Btn>
        ) : null}
        <button type="button" className="min-h-9 text-sm text-slate-400 underline" onClick={() => skipRace(i)}>
          Déclarer forfait
        </button>
        {same.length ? (
          <p className="text-xs text-amber-300">
            Même semaine : {same.map(x => x.name).join(', ')} — un coureur ne peut pas courir les deux.
          </p>
        ) : null}
        {c.cat === 0 ? (
          <p className="text-xs text-slate-400">Un forfait sur un Grand Tour déçoit fortement le sponsor.</p>
        ) : null}
      </div>
    );
  }
  const ending = myRiders().filter(r => r.contract <= 1 && r.nextTeam == null);
  return (
    <div className="space-y-2">
      <p>Saison terminée.</p>
      {ending.length ? (
        <p className="text-sm text-amber-300">
          ⚠️ {ending.length} coureur(s) en fin de contrat partiront :{' '}
          {ending.map((r, k) => (
            <span key={r.id}>
              {k ? ', ' : ''}
              <RiderLink r={r} />
            </span>
          ))}
          .
        </p>
      ) : null}
      {S.academy.some(id => S.riders[id].age >= 22) ? (
        <p className="text-sm text-amber-300">
          ⚠️ Des espoirs de 22 ans quitteront l'académie s'ils ne passent pas pros.
        </p>
      ) : null}
      <Btn primary className="w-full" onClick={() => doEndSeason()}>
        Passer à la saison {S.season + 1}
      </Btn>
    </div>
  );
}
// Gravité d'une chose à traiter (pastille) : alerte (rouge), décision (jaune), information (gris).
const SEV_RED = ['🚨', '🔴', '🩹', '✍️'];
const SEV_INFO = ['✉️', '💾', '😮‍💨', '💬', '🎓'];
export function Todo() {
  const L = todoList();
  if (!L.length) return <p className="py-2 text-sm text-slate-400">Rien à décider cette semaine.</p>;
  return (
    <div>
      {L.map(([ic, t, v, pre], k) => (
        <button
          key={k}
          type="button"
          onClick={() => {
            if (pre) new Function(pre)();
            go(v);
          }}
          className="flex min-h-12 w-full items-center gap-3 border-b border-slate-800 py-2.5 text-left text-[15px] text-slate-100 hover:bg-slate-900/60"
        >
          <i
            className={
              'h-2 w-2 shrink-0 rounded-full ' +
              (SEV_RED.includes(ic) ? 'bg-rose-500' : SEV_INFO.includes(ic) ? 'bg-slate-500' : 'bg-sky-500')
            }
          />
          <span className="flex-1">{t}</span>
          <span className="text-slate-500">›</span>
        </button>
      ))}
    </div>
  );
}
// Silhouette des étapes d'une course (une bosse par étape selon son type), motif de la prochaine course.
const SIL = {
  plat: k => 0.12 + 0.04 * Math.sin(k * 3),
  clm: k => 0.1,
  clmeq: k => 0.1,
  paves: k => 0.14 + 0.03 * Math.sin(k * 5),
  vallonne: k => 0.2 + 0.14 * Math.abs(Math.sin(k * 2.4)),
  punch: k => 0.18 + 0.12 * Math.abs(Math.sin(k * 2.2)) + 0.25 * Math.max(0, k - 0.8) * 5,
  montagne: k => 0.25 + 0.55 * Math.abs(Math.sin(k * 3.2)),
  sommet: k => 0.2 + 0.35 * Math.abs(Math.sin(k * 3)) + 0.45 * k * k,
};
export function RaceSilhouette({ spec, h = 70 }) {
  const n = spec.length;
  const W = 800,
    pts = [];
  spec.forEach(([t], i) => {
    const f = SIL[t] || SIL.vallonne;
    for (let q = 0; q <= 10; q++) {
      const k = q / 10;
      pts.push([((i + k) / n) * W, h - 4 - Math.min(1, f(k)) * (h - 10)]);
    }
  });
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" className="block w-full" style={{ height: h }} aria-hidden="true">
      <path d={`${d} L${W} ${h} L0 ${h} Z`} fill="#2f3847" />
      <path d={d} fill="none" stroke="#f2c94c" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {spec.slice(1).map((_, i) => (
        <line key={i} x1={((i + 1) / n) * W} x2={((i + 1) / n) * W} y1="0" y2={h} stroke="#171b22" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
export function RivalsTable({ rows }) {
  const me = S.teams[0].uci || 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-400">
          <tr>
            <th className="py-1 text-left">#</th>
            <th className="text-left">Équipe</th>
            <th className="text-right">Pts</th>
            <th className="text-right">Écart</th>
            <th className="text-right" title="points gagnés sur les 4 dernières semaines">
              4 sem.
            </th>
            <th className="text-right">Vict.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ T, rank }) => {
            const d = (T.uci || 0) - me;
            return (
              <tr key={T.id} className={'border-t border-slate-800 ' + (T.player ? 'bg-pink-500/10' : '')}>
                <td className="py-2">{rank}</td>
                <td>
                  {T.player ? (
                    <b>{T.name}</b>
                  ) : (
                    <button
                      type="button"
                      className="text-left underline decoration-dotted"
                      onClick={() => openTeam(T.id)}
                    >
                      <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: T.color }} />
                      {T.name}
                    </button>
                  )}
                </td>
                <td className="text-right tabular-nums">{T.uci || 0}</td>
                <td
                  className={
                    'text-right tabular-nums ' +
                    (T.player
                      ? 'text-slate-400'
                      : d > 0
                        ? 'text-rose-400'
                        : d < 0
                          ? 'text-emerald-400'
                          : 'text-slate-400')
                  }
                >
                  {T.player ? '—' : (d > 0 ? '+' : '') + d}
                </td>
                <td className="text-right tabular-nums">+{uciGain(T)}</td>
                <td className="text-right tabular-nums">{seasonWins(T.id)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function Kv({ k, v, onClick, neg }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-baseline justify-between gap-2 py-1 text-left text-sm">
      <span className="text-slate-400">{k}</span>
      <b className={'font-display text-lg ' + (neg ? 'text-rose-400' : 'text-slate-50')}>{v}</b>
    </button>
  );
}
function Gauge({ k, v, tone }) {
  return (
    <div className="mt-2 text-xs text-slate-400">
      {k} <span className="float-right text-slate-300">{Math.round(v)}</span>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <i className={'block h-full ' + tone} style={{ width: Math.max(0, Math.min(100, v)) + '%' }} />
      </div>
    </div>
  );
}
// Aujourd'hui : la prochaine course et ce qu'il faut faire, au centre ; la situation, les rivaux et les nouvelles à
// droite (en dessous sur téléphone).
export function Home() {
  const P0 = S.teams[0];
  const rk = uciOrder().indexOf(P0) + 1;
  const objOk = S.obj ? S.obj.filter(o => objStatus(o).ok).length : 0;
  const i = nextRaceIdx();
  const c = i >= 0 ? S.cal[i] : null;
  const news = S.inbox.slice(0, 4);
  const dn = discoNext();
  const L = todoList();
  const mood = lockerState().mood;
  const nStages = c ? c.stagesSpec.length : 0;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        <section className="rounded-lg bg-slate-900 p-4 md:p-5">
          {c ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-sm font-semibold text-sky-400">
                    {c.w > S.week ? `Dans ${c.w - S.week} semaine${c.w - S.week > 1 ? 's' : ''} · semaine ${c.w}` : `Cette semaine · semaine ${c.w}`}
                  </div>
                  <h2 className="font-display text-2xl font-bold leading-tight text-slate-50 md:text-3xl">{c.name}</h2>
                  <div className="text-sm text-slate-400">
                    {nStages > 1 ? `${nStages} étapes` : typeLbl(c.stagesSpec[0][0])} ·{' '}
                    {c.cat === 0 ? 'grand tour' : c.worlds ? 'sélections nationales' : `catégorie ${c.cat}`} · météo{' '}
                    {WX_REGIME[regimeAt(c.w)]}
                  </div>
                </div>
              </div>
              <div className="my-3">
                <RaceSilhouette spec={c.stagesSpec} />
                {nStages > 1 && nStages <= 10 ? (
                  <div className="mt-1 hidden text-center text-[11px] text-slate-400 md:grid" style={{ gridTemplateColumns: `repeat(${nStages}, minmax(0, 1fr))` }}>
                    {c.stagesSpec.map(([t], k) => (
                      <span key={k} className={['montagne', 'sommet'].includes(t) ? 'text-rose-300' : ''}>
                        {typeLbl(t).toLowerCase()}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <h2 className="mb-3 font-display text-2xl font-bold text-slate-50">Saison {S.season} terminée</h2>
          )}
          <NextAction />
        </section>
        <section>
          <h3 className="mb-1 font-display text-lg font-semibold text-slate-300">
            {L.length ? `À décider (${L.length})` : 'À décider'}
          </h3>
          <Todo />
        </section>
      </div>
      <aside className="min-w-0 space-y-6 lg:border-l lg:border-slate-800 lg:pl-5">
        <section>
          <h3 className="mb-1 font-display text-lg font-semibold text-slate-300">Situation</h3>
          <Kv k="Classement UCI" v={S.teams.some(t => t.uci) ? rk + 'e' : '—'} onClick={() => ((UI.stats = 'rivals'), go('stats'))} />
          <Kv k="Victoires" v={seasonWins(0)} onClick={() => ((UI.stats = 'season'), go('stats'))} />
          <Kv k="Objectifs du sponsor" v={`${objOk} / ${(S.obj || []).length}`} onClick={() => go('mgmt')} />
          <Kv k="Budget" v={fmtMoney(S.budget)} neg={S.budget < 0} onClick={() => go('fin')} />
          <Gauge k="Confiance du sponsor" v={S.conf} tone="bg-sky-500" />
          <Gauge k={`Notoriété (${repLabel(repOf()).toLowerCase()})`} v={repOf()} tone="bg-slate-300" />
          <Gauge k="Ambiance du vestiaire" v={mood} tone={mood >= 55 ? 'bg-emerald-400' : mood >= 40 ? 'bg-sky-500' : 'bg-rose-500'} />
          <div className="mt-3 text-sm text-slate-300">
            Image :{' '}
            <button type="button" className="underline decoration-dotted" onClick={() => go('mgmt')}>
              {imageLabel().lbl}
            </button>
          </div>
          <WtBrief />
        </section>
        <section>
          <div className="mb-1 flex items-baseline justify-between">
            <h3 className="font-display text-lg font-semibold text-slate-300">Rivaux</h3>
            <button type="button" className="text-sm text-slate-400 underline" onClick={() => ((UI.stats = 'rivals'), go('stats'))}>
              Détail
            </button>
          </div>
          <RivalsTable rows={rivalsWindow(1)} />
        </section>
        {news.length ? (
          <section>
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="font-display text-lg font-semibold text-slate-300">Nouvelles</h3>
              <button type="button" className="text-sm text-slate-400 underline" onClick={() => go('inbox')}>
                Messages
              </button>
            </div>
            {news.map(m => (
              <div key={m.id} className={'border-b border-slate-800 py-2 text-sm ' + (m.read ? 'text-slate-400' : 'text-slate-100')}>
                {m.title}
                <span className="block text-xs text-slate-500">Semaine {m.w}</span>
              </div>
            ))}
          </section>
        ) : null}
        {dn ? (
          <p className="text-xs text-slate-400">
            À découvrir : {dn[0]} {dn[1] ? `dans ${dn[1]} semaine${dn[1] > 1 ? 's' : ''}` : 'cette semaine'}.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
