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
export function Todo() {
  const L = todoList();
  if (!L.length) return <p className="text-sm text-slate-400">Rien d'urgent. 👍</p>;
  return (
    <div className="divide-y divide-slate-800">
      {L.map(([ic, t, v, pre], k) => (
        <button
          key={k}
          type="button"
          onClick={() => {
            if (pre) new Function(pre)();
            go(v);
          }}
          className="flex min-h-12 w-full items-center gap-3 text-left text-sm text-slate-100"
        >
          <span className="text-lg">{ic}</span>
          <span className="flex-1">{t}</span>
          <span className="text-slate-500">›</span>
        </button>
      ))}
    </div>
  );
}
function Kpi({ v, label, onClick, neg }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl bg-slate-800/70 px-2 py-3 text-center active:scale-[.98]"
    >
      <b className={'block text-xl ' + (neg ? 'text-rose-400' : 'text-slate-50')}>{v}</b>
      <span className="text-xs text-slate-400">{label}</span>
    </button>
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
                      ? 'text-slate-500'
                      : d > 0
                        ? 'text-rose-400'
                        : d < 0
                          ? 'text-emerald-400'
                          : 'text-slate-500')
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
export function Home() {
  const P0 = S.teams[0];
  const rk = uciOrder().indexOf(P0) + 1;
  const objOk = S.obj ? S.obj.filter(o => objStatus(o).ok).length : 0;
  const i = nextRaceIdx();
  const c = i >= 0 ? S.cal[i] : null;
  const news = S.inbox.slice(0, 4);
  return (
    <div className="space-y-3">
      <Card className="border-sky-500/40">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-50">
            {c
              ? `${c.w > S.week ? `Dans ${c.w - S.week} sem.` : 'Cette semaine'} : ${c.name}`
              : `Saison ${S.season} terminée`}
          </h2>
          {c ? <StageIcons spec={c.stagesSpec} className="shrink-0" /> : null}
        </div>
        {c ? (
          <div className="mb-3 text-xs text-slate-400">Tendance météo de la semaine : {WX_REGIME[regimeAt(c.w)]}</div>
        ) : null}
        <NextAction />
      </Card>
      <Card title="À traiter">
        <Todo />
      </Card>
      <Card title="Situation">
        <div className="grid grid-cols-2 gap-2">
          <Kpi
            v={S.teams.some(t => t.uci) ? rk + 'e' : '—'}
            label={`UCI · ${P0.uci || 0} pts`}
            onClick={() => ((UI.stats = 'rivals'), go('stats'))}
          />
          <Kpi v={seasonWins(0)} label="victoires" onClick={() => ((UI.stats = 'season'), go('stats'))} />
          <Kpi v={fmtMoney(S.budget)} neg={S.budget < 0} label="budget" onClick={() => go('mgmt')} />
          <Kpi v={`${objOk}/${(S.obj || []).length}`} label="objectifs sponsor" onClick={() => go('mgmt')} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-1.5 text-sm text-slate-300 sm:grid-cols-2">
          <span className="flex items-center gap-2">
            Confiance du sponsor <Bar v={S.conf} />
          </span>
          <span className="flex items-center gap-2">
            Notoriété <Bar v={repOf()} /> <span className="text-slate-400">{repLabel(repOf())}</span>
          </span>
        </div>
        <div className="mt-2 text-sm text-slate-300">
          🪪 Image :{' '}
          <button type="button" className="underline decoration-dotted" onClick={() => go('mgmt')}>
            {imageLabel().lbl}
          </button>
        </div>
        <WtBrief />
      </Card>
      <Card
        title="🆚 Rivaux"
        right={
          <Btn onClick={() => ((UI.stats = 'rivals'), go('stats'))} className="min-h-9">
            Détail
          </Btn>
        }
      >
        <RivalsTable rows={rivalsWindow(1)} />
      </Card>
      {news.length ? (
        <Card
          title="Dernières nouvelles"
          right={
            <Btn onClick={() => go('inbox')} className="min-h-9">
              Messages
            </Btn>
          }
        >
          {news.map(m => (
            <div
              key={m.id}
              className={
                'border-t border-slate-800 py-1.5 text-sm first:border-0 ' +
                (m.read ? 'text-slate-400' : 'text-slate-100')
              }
            >
              <b className={m.read ? '' : 'text-sky-300'}>{m.title}</b> <span className="text-slate-500">S{m.w}</span>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
