// Comparer deux coureurs côte à côte (fiche coureur → « Comparer », puis « Comparer avec … » sur une autre fiche) :
// âge, note, potentiel, salaire et contrat, puis chaque caractéristique avec la meilleure mise en évidence.
import { Bar, Stars, RiderLink, statColor } from '../ui.jsx';
import { Icon } from '../icons.jsx';

// Bouton de la fiche : met le coureur de côté, ou lance la comparaison avec celui mis de côté.
export function CompareBtn({ r }) {
  const a = UI.cmpId != null ? S.riders[UI.cmpId] : null;
  const cls = 'min-h-9 rounded-lg px-2.5 text-xs font-semibold ring-1 ';
  if (a && a.id !== r.id)
    return (
      <span className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={cls + 'bg-sky-500 text-slate-950 ring-sky-400'}
          onClick={() => ((UI.modal = { type: 'cmp', a: a.id, b: r.id }), renderModal())}
        >
          ⚖️ Comparer avec {riderName(a)}
        </button>
        <button
          type="button"
          className={cls + 'bg-slate-800 text-slate-300 ring-slate-700'}
          onClick={() => ((UI.cmpId = r.id), renderModal())}
        >
          Mettre de côté
        </button>
      </span>
    );
  return (
    <button
      type="button"
      className={
        cls + (a ? 'bg-sky-500/15 text-sky-200 ring-sky-400/50' : 'bg-slate-800 text-slate-200 ring-slate-700')
      }
      onClick={() => ((UI.cmpId = a ? null : r.id), renderModal())}
      title="Ouvrez ensuite la fiche d'un autre coureur pour les comparer"
    >
      {a ? '⚖️ Mis de côté pour comparer (annuler)' : '⚖️ Comparer'}
    </button>
  );
}

export function Compare({ a, b }) {
  const A = S.riders[a],
    B = S.riders[b];
  if (!A || !B) return null;
  const mine = r => r.team === 0;
  const row = (lbl, va, vb, fmt = v => v, better = 1) => {
    const d = va == null || vb == null ? 0 : (va - vb) * better;
    const cl = (x, w) =>
      d === 0 ? 'text-slate-100' : (w ? d > 0 : d < 0) ? 'font-bold text-emerald-300' : 'text-slate-300';
    return (
      <tr key={lbl} className="border-t border-slate-800">
        <td className={'py-1.5 text-right tabular-nums ' + cl(va, true)}>{va == null ? '?' : fmt(va)}</td>
        <td className="px-2 text-center text-xs text-slate-400">{lbl}</td>
        <td className={'py-1.5 tabular-nums ' + cl(vb, false)}>{vb == null ? '?' : fmt(vb)}</td>
      </tr>
    );
  };
  const stat = (r, k) => shownStat(r, k);
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-50">⚖️ Comparaison</h2>
        <button
          type="button"
          onClick={() => closeModal()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-200"
        >
          <Icon name="x" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        {[A, B].map(r => (
          <div key={r.id} className={'rounded-xl bg-slate-800/60 p-2.5 ' + (r === B ? 'text-left' : 'text-right')}>
            <RiderLink r={r} />
            <div className="text-xs text-slate-400">
              {ARCH[r.arch].lbl} · {r.age} ans
            </div>
            <div className="text-xs">
              <Stars v={potEst(r)} />
            </div>
          </div>
        ))}
      </div>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {row('Global', svOv(A), svOv(B))}
          {row('Âge', A.age, B.age, v => v + ' ans', -1)}
          {row('Salaire', A.salary, B.salary, v => fmtMoney(v), -1)}
          {row('Contrat', A.team != null ? A.contract : null, B.team != null ? B.contract : null, v => v + ' an')}
          {mine(A) && mine(B) ? row('Forme', Math.round(A.forme), Math.round(B.forme)) : null}
          {mine(A) && mine(B) ? row('Fraîcheur', Math.round(100 - A.fatigue), Math.round(100 - B.fatigue)) : null}
          {STATS.map(k => row(STAT_LBL[k], stat(A, k), stat(B, k)))}
        </tbody>
      </table>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
        {[A, B].map(r => (
          <span key={r.id} className={r === B ? 'text-left' : 'text-right'}>
            {(PRIMARY[r.arch] || []).map(k => (
              <span key={k} className="mr-1.5 inline-block">
                {STAT_LBL[k]} <b className={statColor(stat(r, k))}>{stat(r, k)}</b>{' '}
                <Bar v={stat(r, k)} max={95} tone="b" />
              </span>
            ))}
          </span>
        ))}
      </div>
      {isEst(A) || isEst(B) ? (
        <p className="mt-2 text-xs text-slate-400">
          Les caractéristiques des coureurs d'autres équipes sont estimées (vos recruteurs les affinent).
        </p>
      ) : null}
    </div>
  );
}
