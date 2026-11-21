// Sélection des coureurs pour une course (portage fidèle de viewPrep) : effectif disponible, caractéristiques
// utiles pour le parcours, état du jour, reconnaissance du parcours.
import { Card, Btn, Html, Bar, Badge, RiderLink, statColor } from '../ui.jsx';
import { StageIcons } from './Bits.jsx';

export function Prep() {
  const pr = UI.prep;
  const c = S.cal[pr.i];
  const n = raceSize(c);
  const used = (S.weekUsed && S.weekUsed[c.w]) || [];
  const rs = myRiders()
    .concat(acaRiders().filter(r => isStag(r)))
    .filter(r => !used.includes(r.id));
  const keys = [
    ...new Set(
      c.stagesSpec.map(([t]) =>
        t === 'plat'
          ? 'spr'
          : t === 'paves'
            ? 'pav'
            : t === 'clm'
              ? 'clm'
              : t === 'punch' || t === 'vallonne'
                ? 'col'
                : 'mon'
      )
    ),
  ];
  const avail = rs.filter(r => r.injury <= 0).length;
  const okN = !(pr.sel.length > n || pr.sel.length < Math.min(n, Math.max(4, avail)));
  const done = reconUseful(c) && S.recon && S.recon[c.key] === S.season;
  return (
    <div className="space-y-3 pb-24">
      <Card>
        <h2 className="text-lg font-bold text-slate-50">{c.name}</h2>
        <div className="text-sm">
          <StageIcons spec={c.stagesSpec} />{' '}
          <span className="text-xs text-slate-400">
            {c.stagesSpec.map(([t, d]) => typeLbl(t) + ' ' + d + 'km').join(' · ')}
          </span>
        </div>
        {avail < n ? (
          <p className="mt-1 text-xs text-amber-300">
            Effectif disponible insuffisant cette semaine : vous pouvez partir à {Math.max(4, avail)} minimum.
          </p>
        ) : null}
        <p className="mt-2 text-slate-200">
          Sélectionnez <b>{n}</b> coureurs ({pr.sel.length}/{n}).
        </p>
      </Card>
      <div className="space-y-2">
        {rs
          .sort((a, b) => overall(b.s) - overall(a.s))
          .map(r => {
            const on = pr.sel.includes(r.id);
            const dis = r.injury > 0;
            return (
              <label
                key={r.id}
                className={
                  'block rounded-xl p-2.5 ring-1 ' +
                  (on ? 'bg-sky-500/15 ring-sky-400' : 'bg-slate-900 ring-slate-700') +
                  (dis ? ' opacity-50' : '')
                }
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-6 w-6 shrink-0 accent-sky-500"
                    checked={on}
                    disabled={dis}
                    onChange={() => togSel(r.id)}
                  />
                  <div className="min-w-0 flex-1 text-sm">
                    <RiderLink r={r} />
                    {r.aca ? <Badge>ACA</Badge> : null}{' '}
                    <span className="text-xs text-slate-400">{ARCH[r.arch].lbl}</span>
                    {dis ? <Badge tone="red">blessé</Badge> : null}
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">amb. {r.amb}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 pl-9 text-xs text-slate-300">
                  {[...keys, 'plc', 'end'].map(k => (
                    <span key={k}>
                      {STAT_LBL[k]} <b className={statColor(r.s[k])}>{r.s[k]}</b>
                    </span>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-3 gap-2 pl-9 text-xs text-slate-400">
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
              </label>
            );
          })}
      </div>
      {reconUseful(c) ? (
        <Card>
          <div className="text-sm text-slate-200">
            🗺️ Reconnaissance du parcours :{' '}
            {done ? <b>effectuée</b> : `${fmtMoney(reconCost(c))}, +3 de fatigue pour les coureurs sélectionnés`}
          </div>
          <div className="text-xs text-slate-400">
            Les coureurs reconnaissent les pièges (pavés, routes étroites, descentes) : moins de chutes et de cassures.
          </div>
          {done ? null : (
            <Btn className="mt-2 w-full" onClick={() => reconPrep()}>
              Reconnaître
            </Btn>
          )}
        </Card>
      ) : null}
      <p className="text-xs text-slate-400">
        Un coureur ambitieux non retenu pour une grande course peut perdre du moral.
      </p>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-700 bg-slate-950/95 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2">
          <Btn onClick={() => go('cal')}>Retour</Btn>
          <Btn onClick={() => autoSel()}>🧑‍💼 Auto</Btn>
          <Btn primary disabled={!okN} onClick={() => confirmSel()}>
            Valider ({pr.sel.length}/{n})
          </Btn>
        </div>
      </div>
    </div>
  );
}
