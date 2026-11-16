// Liste de coureurs triable : cartes sur téléphone, tableau complet sur grand écran (portage de riderTable et
// riderCards). Sert à l'effectif (et servira au marché et à l'académie).
import { Badge, Bar, Stars, RiderLink, Select, statColor } from '../ui.jsx';

function sortOptions(state) {
  return [
    ['ov', 'Global'],
    ['pot', 'Potentiel'],
    ...(state
      ? [
          ['forme', 'Forme'],
          ['fatigue', 'Fraîcheur'],
          ['moral', 'Moral'],
        ]
      : []),
    ['age', 'Âge'],
    ...STATS.map(k => [k, STAT_LBL[k]]),
  ];
}
function sorted(rs) {
  const sk = UI.sortKey;
  const key = r =>
    sk === 'ov'
      ? shownOv(r)
      : sk === 'pot'
        ? potEst(r)
        : sk === 'age'
          ? -r.age
          : sk === 'forme'
            ? r.forme
            : sk === 'moral'
              ? r.moral
              : sk === 'fatigue'
                ? -r.fatigue
                : shownStat(r, sk);
  return rs.slice().sort((a, b) => key(b) - key(a));
}
function Flags({ r }) {
  return (
    <>
      {r.injury > 0 ? <Badge tone="red">blessé {r.injury}s</Badge> : null}
      {r.wantsOut ? <Badge tone="red">veut partir</Badge> : null}
      {r.nextTeam != null && r.team === 0 ? <Badge tone="red">part</Badge> : null}
      {S.watch.includes(r.id) ? ' 👁' : ''}
    </>
  );
}
export function RiderList({ rs, state, cols = [], pre }) {
  const list = sorted(rs);
  const cards = narrowScreen();
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
        <label className="flex items-center gap-2">
          Trier par{' '}
          <Select value={UI.sortKey} onChange={v => ((UI.sortKey = v), render())} options={sortOptions(state)} />
        </label>
        <button
          type="button"
          className="min-h-10 rounded-lg px-2 text-xs text-sky-300 underline"
          onClick={() => ((UI.tableMode = cards ? 'table' : 'cards'), render())}
        >
          {cards ? 'Vue tableau complet' : 'Vue cartes'}
        </button>
      </div>
      {cards ? (
        <div className="space-y-2">
          {list.map(r => {
            const keys = [...new Set([...(PRIMARY[r.arch] || []), 'end', 'rec'])].slice(0, 5);
            return (
              <div
                key={r.id}
                className={'rounded-xl bg-slate-800/60 p-2.5 ' + (r.injury > 0 ? 'ring-1 ring-rose-500/50' : '')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-sm">
                    {pre ? pre(r) : null}
                    <RiderLink r={r} />{' '}
                    <span className="text-xs text-slate-400">
                      {r.age}a · {ARCH[r.arch].lbl}
                    </span>
                    <Flags r={r} />
                  </div>
                  <div className="shrink-0 text-right">
                    <b className="text-lg text-slate-50">{svOv(r)}</b>
                    <div className="text-xs">
                      <Stars v={potEst(r)} />
                    </div>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-300">
                  {keys.map(k => {
                    const v = shownStat(r, k);
                    return (
                      <span key={k}>
                        {STAT_LBL[k]}{' '}
                        <b className={statColor(v)}>
                          {isEst(r) ? '~' : ''}
                          {v}
                        </b>
                      </span>
                    );
                  })}
                </div>
                {state ? (
                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                    <span>
                      Forme <Bar v={r.forme} />
                    </span>
                    <span>
                      Fraîcheur <Bar v={100 - r.fatigue} />
                    </span>
                    <span>
                      Moral <Bar v={r.moral} />
                    </span>
                  </div>
                ) : null}
                {cols.length ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
                    {cols.map(([l, f], i) => (
                      <span key={i} className="flex min-w-0 max-w-full items-center gap-1">
                        <span className="text-slate-500">{l}</span> {f(r)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-400">
              <tr>
                {pre ? <th /> : null}
                <th className="text-left">Coureur</th>
                <th className="text-left">Type</th>
                <th>Gl.</th>
                <th>Pot.</th>
                {STATS.map(k => (
                  <th key={k} title={STAT_LBL[k]}>
                    {STAT_LBL[k].slice(0, 3)}
                  </th>
                ))}
                {state ? (
                  <>
                    <th>Forme</th>
                    <th>Fat.</th>
                    <th>Moral</th>
                  </>
                ) : null}
                {cols.map(([l], i) => (
                  <th key={i}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(r => (
                <tr key={r.id} className={'border-t border-slate-800 ' + (r.injury > 0 ? 'bg-rose-500/5' : '')}>
                  {pre ? <td>{pre(r)}</td> : null}
                  <td className="py-1.5">
                    <RiderLink r={r} /> <span className="text-slate-500">{r.age}a</span>
                    <Flags r={r} />
                  </td>
                  <td className="text-xs">{ARCH[r.arch].lbl}</td>
                  <td className="text-center">
                    <b>{svOv(r)}</b>
                  </td>
                  <td className="text-center text-xs">
                    <Stars v={potEst(r)} />
                  </td>
                  {STATS.map(k => {
                    const v = shownStat(r, k);
                    return (
                      <td key={k} className={'text-center tabular-nums ' + statColor(v)}>
                        {isEst(r) ? '~' : ''}
                        {v}
                      </td>
                    );
                  })}
                  {state ? (
                    <>
                      <td>
                        <Bar v={r.forme} />
                      </td>
                      <td>
                        <Bar v={100 - r.fatigue} />
                      </td>
                      <td>
                        <Bar v={r.moral} />
                      </td>
                    </>
                  ) : null}
                  {cols.map(([l, f], i) => (
                    <td key={i} className="text-xs">
                      {f(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
