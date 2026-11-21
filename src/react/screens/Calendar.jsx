// Calendrier (prochaine action, courses de la saison et espoirs, atout de l'équipe, courses importantes) et
// planification de la saison (jours de course par coureur, coureurs prévus par course). Portage fidèle de
// viewCal et viewPlanner.
import { Card, Btn, Html, Bar, Badge, RiderLink, H2 } from '../ui.jsx';
import { NextAction } from './Home.jsx';
import { StageIcons } from './Bits.jsx';

function Tabs() {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-800 p-1">
      {[['cal', 'Calendrier'], ...(discoOpen('plan') ? [['plan', '📅 Planification']] : [])].map(([k, l]) => (
        <button
          key={k}
          type="button"
          onClick={() => ((UI.calTab = k), render())}
          className={
            'min-h-10 rounded-lg text-sm font-medium ' +
            ((UI.calTab || 'cal') === k ? 'bg-sky-500 text-slate-950' : 'text-slate-200')
          }
        >
          {l}
        </button>
      ))}
    </div>
  );
}
function RaceRow({ c, k, next }) {
  const w = c.winner ? S.riders[c.winner] : null;
  const fit = !c.done && !c.worlds && (!c.inv || c.inv.includes(0)) ? raceAsset(c) : null;
  const planned = S.plan && S.plan[c.key] ? S.plan[c.key].length : 0;
  return (
    <div
      className={
        'flex gap-3 border-t border-slate-800 py-2.5 ' +
        (k === next ? 'rounded-xl bg-sky-500/10 px-2 ring-1 ring-sky-400/40' : '') +
        (c.done ? ' opacity-60' : '')
      }
    >
      <span className="w-7 shrink-0 pt-0.5 text-center font-bold tabular-nums text-slate-400">{c.w}</span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="flex flex-wrap items-center gap-x-1">
          <b className="text-slate-50">{c.name}</b>
          {c.done ? null : (
            <button
              type="button"
              title="Course importante : l'adjoint s'arrête avant"
              onClick={() => (toggleStar(c.key), save(), render())}
              className="flex h-9 w-9 items-center justify-center text-lg text-amber-300"
            >
              {isKeyRace(c) ? '★' : '☆'}
            </button>
          )}
          {c.worlds ? (
            <Badge>🌈 sélections nationales</Badge>
          ) : c.inv && !c.inv.includes(0) ? (
            <Badge tone="red">non invité</Badge>
          ) : null}
          <span className="text-xs text-slate-400">
            {['Grand Tour', 'Cat. 1', 'Cat. 2'][c.cat]}
            {c.stagesSpec.length > 1 ? ' · ' + c.stagesSpec.length + ' ét.' : ''}
          </span>
        </div>
        <div className="mt-0.5">
          <StageIcons spec={c.stagesSpec} />
        </div>
        {fit ? (
          <div className="text-xs text-slate-400">
            Votre atout : <b className="text-slate-200">{riderName(fit.r)}</b> ({fit.v})
            {planned ? ` · ${planned} prévus` : ''}
          </div>
        ) : null}
        {w ? (
          <div className="text-xs">
            🏆 <RiderLink r={w} /> <span className="text-slate-400">{tshort(w)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
function Planner() {
  S.plan = S.plan || {};
  const pros = myRiders()
    .slice()
    .sort((a, b) => overall(b.s) - overall(a.s));
  const cap = daysTarget();
  const races = S.cal.filter(c => !c.done && !c.worlds);
  const Chip = ({ r, c, sel }) => {
    const on = sel.includes(r.id),
      cf = on && planConflict(r.id, c);
    const fit = Math.round(raceFit(r, c));
    return (
      <button
        type="button"
        title={`adéquation ${fit}${cf ? ' · déjà engagé ailleurs cette semaine' : ''}`}
        onClick={() => (planToggle(c.key, r.id), save(), render())}
        className={
          'min-h-10 rounded-full px-3 text-sm ' +
          (cf
            ? 'bg-rose-500/20 text-rose-100 ring-1 ring-rose-400'
            : on
              ? 'bg-sky-500 text-slate-950'
              : 'bg-slate-800 text-slate-200 ring-1 ring-slate-700')
        }
      >
        {riderName(r)} <span className="text-xs opacity-75">{fit}</span>
      </button>
    );
  };
  const RaceCard = ({ c }) => {
    const inv = !c.inv || c.inv.includes(0);
    const sel = S.plan[c.key] || [];
    const n = raceSize(c);
    const byFit = pros.slice().sort((a, b) => raceFit(b, c) - raceFit(a, c));
    const on = byFit.filter(r => sel.includes(r.id));
    const off = byFit.filter(r => !sel.includes(r.id));
    return (
      <Card>
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm">
            <b className="text-slate-50">
              S{c.w} · {c.name}
            </b>{' '}
            <StageIcons spec={c.stagesSpec} />
          </span>
          <span className={'shrink-0 text-xs ' + (sel.length === n ? 'text-slate-300' : 'text-amber-300')}>
            {inv ? `${sel.length}/${n}` : 'non invité'}
          </span>
        </div>
        {inv ? (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {on.map(r => (
                <Chip key={r.id} r={r} c={c} sel={sel} />
              ))}
            </div>
            {off.length ? (
              <>
                <div className="mt-2 text-xs text-slate-400">Les mieux adaptés au parcours :</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {off.slice(0, 6).map(r => (
                    <Chip key={r.id} r={r} c={c} sel={sel} />
                  ))}
                </div>
              </>
            ) : null}
            {off.length > 6 ? (
              <details className="mt-1">
                <summary className="cursor-pointer py-1 text-xs text-slate-400">Les {off.length - 6} autres</summary>
                <div className="flex flex-wrap gap-1.5">
                  {off.slice(6).map(r => (
                    <Chip key={r.id} r={r} c={c} sel={sel} />
                  ))}
                </div>
              </details>
            ) : null}
          </>
        ) : null}
      </Card>
    );
  };
  return (
    <div className="space-y-3">
      <Card>
        <H2>Programme de la saison</H2>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <Btn onClick={() => ((UI.flash = '🧑‍💼 ' + autoPlanSeason()), save(), render())}>🧑‍💼 Planifier auto</Btn>
          <Btn onClick={() => ((S.plan = {}), save(), render())}>Vider</Btn>
        </div>
        <details className="mb-2 text-xs text-slate-400">
          <summary className="cursor-pointer py-1">Explications</summary>
          Prévoyez qui court quoi : la sélection d'une course reprend ce programme. Objectif conseillé : environ {
            cap
          }{' '}
          jours de course par coureur (60 % du calendrier). Un coureur ne peut pas courir deux courses la même semaine.
        </details>
        {pros.map(r => {
          const d = plannedDays(r.id);
          return (
            <div key={r.id} className="flex items-center gap-2 border-t border-slate-800 py-1.5 text-sm">
              <span className="min-w-0 flex-1">
                <RiderLink r={r} /> <span className="text-xs text-slate-400">{ARCH[r.arch].lbl}</span>
              </span>
              <span className="w-10 text-right text-xs">{d} j.</span>
              <span className="w-24">
                <Bar v={d} max={cap * 1.25} tone={d > cap * 1.15 ? 'r' : d < cap * 0.6 ? 'y' : 'g'} />
              </span>
            </div>
          );
        })}
      </Card>
      {races.slice(0, 6).map(c => (
        <RaceCard key={c.key} c={c} />
      ))}
      {races.length > 6 ? (
        <details>
          <summary className="cursor-pointer rounded-xl bg-slate-900 px-3 py-3 text-sm text-slate-300 ring-1 ring-slate-700">
            Courses suivantes ({races.length - 6})
          </summary>
          <div className="mt-3 space-y-3">
            {races.slice(6).map(c => (
              <RaceCard key={c.key} c={c} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
// Mois d'une semaine de la saison (semaine 1 = début janvier).
const monthOf = w => Math.min(11, Math.floor(((Math.floor(w) - 1) * 7 + 3) / 30.44));
function months(rows) {
  const g = new Map();
  for (const r of rows) {
    const m = monthOf(r.w);
    if (!g.has(m)) g.set(m, []);
    g.get(m).push(r);
  }
  return [...g.entries()];
}
export function Calendar() {
  if (UI.calTab === 'plan' && discoOpen('plan'))
    return (
      <div className="space-y-3">
        <Tabs />
        <Planner />
      </div>
    );
  const i = nextRaceIdx();
  const nDone = S.cal.filter(c => c.done).length;
  const showPast = UI.calPast || !nDone;
  const rows = S.cal.map((c, k) => ({ w: c.w, past: c.done, el: <RaceRow key={'c' + k} c={c} k={k} next={i} /> }));
  for (const e of ESP_CAL)
    rows.push({
      w: e.w + 0.5,
      esp: true,
      past: e.w < S.week,
      el: (
        <div
          key={'e' + e.w + e.name}
          className={'flex gap-3 border-t border-slate-800 py-2 text-xs ' + (e.w < S.week ? 'opacity-50' : '')}
        >
          <span className="w-7 shrink-0 text-center tabular-nums text-slate-400">{e.w}</span>
          <span className="text-slate-300">
            🎓 {e.name} <span className="text-slate-400">({isJun(e) ? 'juniors' : 'espoirs'})</span>
          </span>
        </div>
      ),
    });
  rows.sort((a, b) => a.w - b.w);
  const nm = i >= 0 ? monthOf(S.cal[i].w) : 0; // mois de la prochaine course
  return (
    <div className="space-y-3">
      <Tabs />
      <Card className="border-sky-500/40">
        <NextAction />
      </Card>
      <Card>
        <H2
          right={
            nDone ? (
              <button
                type="button"
                className="min-h-10 text-xs text-sky-300 underline"
                onClick={() => ((UI.calPast = !showPast), render())}
              >
                {showPast ? 'Masquer' : 'Afficher'} les courses passées ({nDone})
              </button>
            ) : null
          }
        >
          Calendrier {S.season}
        </H2>
        {/* par mois : le mois en cours et le suivant ouverts, les autres repliés (nombre de courses en tête) */}
        {months(rows.filter(r => showPast || !r.past)).map(([m, list]) => {
          const nRace = list.filter(r => !r.esp).length;
          return (
            <details key={m} open={m === nm || m === nm + 1} className="group border-t border-slate-800 first:border-0">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 py-1">
                <b className="text-sm capitalize text-slate-100">{MONTHS[m]}</b>
                <span className="text-xs text-slate-400">
                  {nRace} course{nRace > 1 ? 's' : ''} <span className="inline-block group-open:rotate-90">›</span>
                </span>
              </summary>
              {list.map(r => r.el)}
            </details>
          );
        })}
        <p className="mt-2 text-xs text-slate-400">
          Chaque semaine : entraînement, forme, salaires, staff et sponsor ({fmtMoney(sponsorWeekly())}/sem.).
        </p>
      </Card>
      <Card>
        <p className="text-xs text-slate-400">
          Légende : ▬ plat · ∿ vallonné · ≋ classique ardennaise · ⌒ arrivée en côte · ▲ montagne · ⛰ arrivée au sommet
          · ▦ pavés · ⏱ contre-la-montre
        </p>
      </Card>
    </div>
  );
}
