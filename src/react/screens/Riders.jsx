// Liste de coureurs triable : sur téléphone, une ligne compacte par coureur qui se déplie d'un toucher (détail :
// caractéristiques, forme, colonnes propres à l'écran) ; tableau complet sur grand écran. Filtres en pastilles
// (profil, contrat qui finit, fatigués, blessés). Sert à l'effectif, au marché et à l'académie.
import { Badge, Bar, Spark, Stars, RiderLink, Select, statColor } from '../ui.jsx';

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
// Filtres en pastilles (UI.riderFilter) : profil, puis états qui demandent une action.
const ARCH_CHIPS = [
  ['sprinteur', 'Sprinteurs'],
  ['grimpeur', 'Grimpeurs'],
  ['complet', 'Leaders GC'],
  ['puncheur', 'Puncheurs'],
  ['rouleur', 'Rouleurs'],
  ['flahute', 'Flandriens'],
  ['baroudeur', 'Baroudeurs'],
];
function filterOf(rs, state) {
  const chips = [['', 'Tous']];
  for (const [k, l] of ARCH_CHIPS) if (rs.some(r => r.arch === k)) chips.push([k, l]);
  if (state) {
    if (rs.some(r => r.team === 0 && r.contract <= 1 && r.nextTeam == null)) chips.push(['@contrat', '⏳ Contrat']);
    if (rs.some(r => r.fatigue > 50)) chips.push(['@fatigue', '😮‍💨 Fatigués']);
    if (rs.some(r => r.injury > 0)) chips.push(['@blesse', '🩹 Blessés']);
  }
  const f = chips.some(c => c[0] === UI.riderFilter) ? UI.riderFilter || '' : '';
  const keep = r =>
    !f ||
    (f === '@contrat'
      ? r.contract <= 1 && r.nextTeam == null
      : f === '@fatigue'
        ? r.fatigue > 50
        : f === '@blesse'
          ? r.injury > 0
          : r.arch === f);
  return { chips, f, keep };
}
// Pastille de forme du jour : verte, jaune ou rouge (forme, fraîcheur et moral réunis).
function StateDot({ r }) {
  const v = Math.min(r.forme, 100 - r.fatigue, r.moral);
  const c = v > 66 ? 'bg-emerald-400' : v > 40 ? 'bg-yellow-300' : 'bg-rose-500';
  return <span className={'inline-block h-2.5 w-2.5 shrink-0 rounded-full ' + c} title="Forme, fraîcheur, moral" />;
}
export function RiderList({ rs, state, cols = [], pre }) {
  const { chips, f, keep } = filterOf(rs, state);
  const list = sorted(rs.filter(keep));
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
      {chips.length > 2 ? (
        <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {chips.map(([k, l]) => (
            <button
              key={k || 'all'}
              type="button"
              onClick={() => ((UI.riderFilter = k), render())}
              className={
                'min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold ' +
                (f === k ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-200 ring-1 ring-slate-700')
              }
            >
              {l}
            </button>
          ))}
        </div>
      ) : null}
      {cards ? (
        <div className="divide-y divide-slate-800 overflow-hidden rounded-xl bg-slate-800/40">
          {list.map(r => {
            const keys = [...new Set([...(PRIMARY[r.arch] || []), 'end', 'rec'])].slice(0, 5);
            const open = UI.openRider === r.id;
            return (
              <div key={r.id} className={r.injury > 0 ? 'bg-rose-500/5' : ''}>
                {/* la ligne : touchez-la pour déplier le détail (le nom ouvre la fiche) */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => ((UI.openRider = open ? null : r.id), render())}
                  onKeyDown={e => e.key === 'Enter' && ((UI.openRider = open ? null : r.id), render())}
                  className="flex min-h-14 cursor-pointer items-center gap-2.5 px-2.5 py-2"
                >
                  {state ? <StateDot r={r} /> : null}
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="truncate" onClick={e => e.stopPropagation()}>
                      {pre ? pre(r) : null}
                      <RiderLink r={r} />
                      <Flags r={r} />
                    </div>
                    <div className="truncate text-xs text-slate-400">
                      {r.age} ans · {ARCH[r.arch].lbl}
                      {state && r.team === 0 && r.contract <= 1 && r.nextTeam == null ? (
                        <span className="text-amber-300"> · contrat à prolonger</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right leading-tight">
                    <b className="text-lg tabular-nums text-slate-50">{svOv(r)}</b>
                    <div className="text-xs">
                      <Stars v={potEst(r)} />
                    </div>
                  </div>
                  <span className={'shrink-0 text-slate-400 transition-transform ' + (open ? 'rotate-90' : '')}>›</span>
                </div>
                {open ? (
                  <div className="space-y-2 px-2.5 pb-3" style={{ animation: 'fadeIn .2s both' }}>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-300">
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
                    {state && r.fh && r.fh.length > 1 ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Spark pts={r.fh} label="Forme et fraîcheur, 16 dernières semaines" />
                        <span>
                          <span className="text-emerald-300">forme</span> ·{' '}
                          <span className="text-sky-300">fraîcheur</span>, {r.fh.length} sem.
                        </span>
                      </div>
                    ) : null}
                    {state ? (
                      <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
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
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-200">
                        {cols.map(([l, fn], i) => (
                          <span key={i} className="flex min-w-0 max-w-full items-center gap-1">
                            <span className="text-slate-400">{l}</span> {fn(r)}
                          </span>
                        ))}
                      </div>
                    ) : null}
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
                    <RiderLink r={r} /> <span className="text-slate-400">{r.age}a</span>
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
