// Appel radio en attente, journal Radio-course, barre de commandes (vitesse, moments clés, fin, DS auto, pauses)
// et fenêtre radio d'un coureur (portage de askHTML, du journal de liveHTML, dockHTML et radioCard).
import { useState } from 'react';
import { RADIO_GROUPS, RADIO_HELP, doingNow, orderInfo } from './orders.js';
import { Ally } from './Team.jsx';
import { Card, Btn, Html, Effort } from '../ui.jsx';
import { Icon } from '../icons.jsx';

// Décision à prendre maintenant, en surimpression au-dessus des commandes : seulement ce qui demande une réponse
// rapide (appel radio d'un coureur, proposition d'alliance). La négociation dans l'échappée et le pacte, qui durent,
// sont dans la page (Mes coureurs).
function Decisions({ sim }) {
  const wrap = 'rounded-xl bg-slate-950 shadow-2xl';
  if (sim.ask)
    return (
      <div className="mx-auto max-h-[35vh] max-w-3xl overflow-y-auto px-2">
        <div className={wrap}>
          <AskPanel sim={sim} />
        </div>
      </div>
    );
  if (!S.car && sim.allyOffer)
    return (
      <div className="mx-auto max-h-[35vh] max-w-3xl overflow-y-auto px-2">
        <div className={wrap}>
          <Ally sim={sim} mode="offer" />
        </div>
      </div>
    );
  return null;
}
export function AskPanel({ sim }) {
  const a = sim.ask;
  if (!a) return null;
  const left = Math.max(0, Math.round((a.exp - sim.t) * 60));
  return (
    <div className="rounded-xl bg-amber-400/15 p-2.5 ring-1 ring-amber-300/60">
      <div className="flex items-start gap-2 text-sm font-semibold text-amber-50">
        <Icon name="alert" size={18} className="mt-0.5 text-amber-300" />
        <span>{a.txt}</span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {a.opts.map(([k, l], i) => (
          <Btn key={k} primary={!i} onClick={() => askUI(k)}>
            {l}
          </Btn>
        ))}
      </div>
      <div className="mt-1 text-xs text-slate-300">
        Sans réponse dans {Math.floor(left / 60)} min {String(left % 60).padStart(2, '0')} s : {a.self}
      </div>
    </div>
  );
}
const CLS = { me: 'text-pink-200', bad: 'text-rose-300', att: 'text-amber-200', info: 'text-slate-100' };
function FeedRow({ l }) {
  return (
    <div className="flex gap-2 border-b border-slate-800 py-1.5 text-[13px] last:border-0">
      <span className="w-12 shrink-0 tabular-nums text-slate-400">km {l.km.toFixed(0)}</span>
      <Html className={CLS[l.cls] || 'text-slate-200'} html={l.txt} />
    </div>
  );
}
// Filtre du journal : mes coureurs, l'essentiel (moi + faits marquants), tout. Les messages consécutifs d'un même
// moment (même kilomètre, même sujet) sont regroupés sur une ligne qu'on déplie.
const KEY_RX = /^(⛰️|🧱|⤵️|🌬️|💥|🏆|🟢|🤝|⚡|🗡️|🃏|🌧️|🌤️|🔝)/u;
const FEED_F = [
  ['cles', 'L’essentiel'],
  ['mine', 'Mes coureurs'],
  ['tout', 'Tout'],
];
function feedKeep(l, f) {
  if (f === 'tout') return true;
  const mine = l.cls === 'me' || l.cls === 'bad';
  if (f === 'mine') return mine;
  return mine || l.cls === 'att' || KEY_RX.test(l.txt);
}
function feedGroups(lg) {
  const out = [];
  for (const l of lg) {
    const p = out[out.length - 1];
    const head = t => Array.from(t.replace(/<[^>]+>/g, ''))[0];
    if (p && Math.round(p[0].km) === Math.round(l.km) && head(p[0].txt) === head(l.txt) && p[0].cls === l.cls)
      p.push(l);
    else out.push([l]);
  }
  return out;
}
function FeedGroup({ g }) {
  const [open, setOpen] = useState(false);
  if (g.length === 1) return <FeedRow l={g[0]} />;
  return (
    <div className="border-b border-slate-800 last:border-0">
      <FeedRow l={g[0]} />
      {open ? g.slice(1).map((l, i) => <FeedRow key={i} l={l} />) : null}
      <button type="button" className="mb-1 ml-14 text-xs text-slate-400 underline" onClick={() => setOpen(!open)}>
        {open ? 'replier' : `+ ${g.length - 1} message${g.length > 2 ? 's' : ''} du même moment`}
      </button>
    </div>
  );
}
export function RadioFeed({ sim }) {
  const f = UI.feedF || 'cles';
  const all = sim.log.slice().reverse();
  const lg = all.filter(l => feedKeep(l, f));
  const groups = feedGroups(lg);
  return (
    <Card
      title={
        <span className="flex items-center gap-1.5">
          <Icon name="radio" size={16} className="text-sky-300" /> Radio-course
        </span>
      }
    >
      <div className="mb-1.5 flex gap-1.5" role="tablist">
        {FEED_F.map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={f === k}
            onClick={() => ((UI.feedF = k), renderLive())}
            className={
              'min-h-8 rounded-full px-2.5 text-xs font-semibold ring-1 ' +
              (f === k ? 'bg-sky-500 text-slate-950 ring-sky-400' : 'bg-slate-800 text-slate-300 ring-slate-700')
            }
          >
            {l}
            {k !== 'tout' ? null : <span className="ml-1 opacity-70">{all.length}</span>}
          </button>
        ))}
      </div>
      <div className="h-72 overflow-y-auto overscroll-contain pr-1">
        {groups.slice(0, 14).map((g, i) => (
          <FeedGroup key={lg.length - lg.indexOf(g[0])} g={g} />
        ))}
        {!groups.length ? <p className="py-2 text-xs text-slate-400">Rien pour l’instant dans ce filtre.</p> : null}
      </div>
      {groups.length > 14 ? (
        <details className="mt-1">
          <summary className="cursor-pointer py-1 text-xs text-slate-400">
            Plus ancien ({Math.min(30, groups.length - 14)})
          </summary>
          {groups.slice(14, 44).map((g, i) => (
            <FeedGroup key={i} g={g} />
          ))}
        </details>
      ) : null}
    </Card>
  );
}
// Moment fort de la course : bandeau d'une ligne au-dessus des commandes (vibration brève quand il concerne votre
// équipe). Ceux des autres équipes sont espacés (au plus un toutes les 12 s) pour ne pas encombrer l'écran.
const SEEN = new WeakSet();
let LAST_OTHER = 0;
function toastOn() {
  const B = UI.banner;
  if (!B || Date.now() >= B.until) return null;
  if (!SEEN.has(B)) {
    SEEN.add(B);
    if (!B.mine) {
      if (Date.now() - LAST_OTHER < 12000) {
        UI.banner = null;
        return null;
      }
      LAST_OTHER = Date.now();
    }
    B.until = Math.min(B.until, Date.now() + (B.mine ? 7000 : 4000));
    if (B.mine && navigator.vibrate)
      try {
        navigator.vibrate(60);
      } catch (e) {}
  }
  return B;
}
function Toast({ B }) {
  return (
    <div className="flex justify-center px-3">
      <button
        type="button"
        onClick={() => ((UI.banner = null), renderLive())}
        className={
          'line-clamp-2 max-w-xl rounded-xl px-3 py-1.5 text-center text-sm font-semibold shadow-2xl ' +
          (B.mine ? 'bg-pink-600 text-white' : 'bg-amber-300 text-slate-950')
        }
        style={{ animation: 'fadeIn .25s both' }}
        dangerouslySetInnerHTML={{ __html: B.txt }}
      />
    </div>
  );
}
// Message de course (avance rapide, final, pause…) : il s'efface seul après 4 s pour ne pas cacher le final.
let FLASH = { txt: null, t: 0 };
function flashOn() {
  if (UI.flashRace !== FLASH.txt) FLASH = { txt: UI.flashRace, t: Date.now() };
  if (UI.flashRace && Date.now() - FLASH.t > 4000) UI.flashRace = null;
  return !!UI.flashRace;
}
const PACE_LBL = {
  calm: '⏩ rien ne se passe : accéléré',
  fight: '⏩ bagarre pour l’échappée',
  mod: '▶▶ course animée',
  live: '▶ en direct',
};
const SPEED_ICON = [['pause'], ['play', 'lent'], ['play'], ['ff'], ['ff', '×3'], ['ff', 'max']];
export function Dock({ sim }) {
  const mult = k => '×' + fmtDec(SPEEDS[k] * 30, SPEEDS[k] * 30 < 10 ? 1 : 0);
  const btn = (on, onClick, title, children) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={
        'flex h-11 min-w-0 items-center justify-center rounded-xl text-xs font-semibold active:scale-95 ' +
        (on ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-100 ring-1 ring-slate-700')
      }
    >
      {children}
    </button>
  );
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-700 bg-slate-950/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur">
      {/* au-dessus des commandes : moment fort et décisions à prendre (appel radio, échappée, alliance) ; ils
          flottent au lieu de pousser la page, pour que l'écran ne bouge pas quand ils apparaissent */}
      {/* au-dessus des commandes, UN SEUL message à la fois, par priorité : décision à prendre, message de course,
          moment fort. Il flotte au lieu de pousser la page, et se ferme d'un toucher. */}
      <div className="absolute inset-x-0 bottom-full mb-2">
        {sim.ask || (!S.car && sim.allyOffer) ? (
          <Decisions sim={sim} />
        ) : flashOn() ? (
          <div className="mx-auto flex max-w-3xl px-2">
            <button
              type="button"
              onClick={() => ((UI.flashRace = null), renderLive())}
              className="line-clamp-2 w-full rounded-xl bg-slate-900 px-3 py-1.5 text-left text-sm text-slate-100 shadow-2xl ring-1 ring-slate-700"
              dangerouslySetInnerHTML={{ __html: UI.flashRace }}
            />
          </div>
        ) : (
          (B => (B ? <Toast B={B} /> : null))(toastOn())
        )}
      </div>
      <div className="mx-auto max-w-3xl">
        <div className="grid grid-cols-8 gap-1">
          {SPEED_ICON.map(([ic, sub], k) =>
            btn(
              UI.speed === k,
              () => {
                UI.keyMode = false;
                setSpeed(k);
              },
              k ? mult(k) : 'pause',
              <span key={k} className="flex flex-col items-center leading-none">
                <Icon name={ic} size={17} />
                {sub ? <span className="mt-0.5 text-[9px] opacity-80">{sub}</span> : null}
              </span>
            )
          )}
          {btn(
            UI.keyMode,
            () => keyMoments(),
            "Moments clés : avance rapide jusqu'au final ou jusqu'à un événement pour votre équipe",
            <Icon name="clapper" size={17} />
          )}
          {btn(false, () => toEnd(), "Aller à l'arrivée", <Icon name="skip" size={17} />)}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-300">
          <span>
            {UI.speed ? mult(UI.speed) + ' temps réel' : 'en pause'}
            {UI.autoPace !== false && UI.speed && UI.paceState ? (
              <span className="text-slate-400"> · {PACE_LBL[UI.paceState]}</span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => ((UI.dockOpts = !UI.dockOpts), renderLive())}
            className={
              'flex min-h-8 items-center gap-1 rounded-lg px-2 ' +
              (UI.dockOpts ? 'bg-slate-600 text-slate-50' : 'bg-slate-800 text-slate-200')
            }
            title="Rythme auto, pauses automatiques, directeur sportif automatique"
          >
            ⚙ Réglages{' '}
            <span className="text-slate-400">
              {[UI.autoPace !== false ? 'rythme' : '', sim.autoPause ? 'pauses' : '', sim.autoDS ? 'DS auto' : '']
                .filter(Boolean)
                .join(' · ')}
            </span>
          </button>
          {/* réglages repliés : le bandeau du bas reste bas, l'écran de course garde la place */}
          {UI.dockOpts ? (
            <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                title="Rythme auto : accélère quand il ne se passe rien, revient au direct dès que la course bouge"
                onClick={() => {
                  UI.autoPace = UI.autoPace === false;
                  if (UI.autoPace === false && UI.speed > (UI.baseSpeed || 2)) UI.speed = UI.baseSpeed || 2;
                  renderLive();
                }}
                className={
                  'flex min-h-8 items-center gap-1 rounded-lg px-2 ' +
                  (UI.autoPace !== false ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-100')
                }
              >
                Rythme auto {UI.autoPace !== false ? 'ON' : 'OFF'}
              </button>
              <label className="flex min-h-8 items-center gap-1.5">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-sky-500"
                  checked={!!sim.autoPause}
                  onChange={e => ((UI.sim.autoPause = e.target.checked), renderLive())}
                />{' '}
                pause mes coureurs
              </label>
              <label className="flex min-h-8 items-center gap-1.5">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-sky-500"
                  checked={!!UI.pauseHl}
                  onChange={e => ((UI.pauseHl = e.target.checked), renderLive())}
                />{' '}
                pause moments forts
              </label>
              <label className="flex min-h-8 items-center gap-1.5">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-sky-500"
                  checked={UI.pauseMoments !== false}
                  onChange={e => ((UI.pauseMoments = e.target.checked), renderLive())}
                />{' '}
                pause aux moments décisifs
              </label>
              <label className="flex min-h-8 items-center gap-1.5" title="Sans radio-course : écarts exacts et immédiats">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-sky-500"
                  checked={!!S.exactGaps}
                  onChange={e => ((S.exactGaps = e.target.checked), save(), renderLive())}
                />{' '}
                écarts exacts
              </label>
              {S.car ? null : (
                <button
                  type="button"
                  onClick={() => {
                    UI.sim.autoDS = !UI.sim.autoDS;
                    UI.autoDS = UI.sim.autoDS;
                    log(
                      UI.sim,
                      UI.sim.autoDS
                        ? '🤖 DS automatique : il répond aux appels de vos coureurs à votre place.'
                        : '🤖 DS automatique désactivé : les appels de vos coureurs vous reviennent.',
                      'info'
                    );
                    renderLive();
                  }}
                  className={
                    'flex min-h-8 items-center gap-1 rounded-lg px-2 ' +
                    (sim.autoDS ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-100')
                  }
                >
                  <Icon name="bot" size={15} /> DS auto {sim.autoDS ? 'ON' : 'OFF'}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
// Ordres radio pour un coureur (fenêtre) : ce qu'il fait maintenant, sa consigne, puis les ordres groupés,
// chacun avec ce qu'il fait et ce qu'il coûte.
export function RadioPanel({ id }) {
  const sim = UI.sim;
  if (!sim) return null;
  const x = sim.runners.find(y => y.id === id);
  if (!x) return null;
  const r = x.r;
  const oi = orderInfo(x);
  const me = S.car && x.id === S.car.id;
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-50">
          <Icon name="radio" size={20} className="text-sky-300" /> {riderName(r)}
        </h3>
        <button
          type="button"
          onClick={() => closeModal()}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-200"
        >
          <Icon name="x" />
        </button>
      </div>
      <div className="mt-1 rounded-xl bg-slate-800/70 p-2.5 text-sm">
        <div className="text-slate-100">
          En ce moment : <b>{doingNow(sim, x)}</b>
        </div>
        <div className="mt-1 text-slate-300">
          Consigne : <b className="text-slate-100">{oi.lbl}</b>
          {x.rebel ? <span className="text-rose-300"> (il n'en fait qu'à sa tête)</span> : null}
          <div className="text-xs text-slate-400">{oi.d}</div>
        </div>
        {x.radio && RADIO_HELP[x.radio] ? (
          <div className="mt-1 text-slate-300">
            Ordre radio en cours :{' '}
            <b className="text-slate-100">
              {RADIO_HELP[x.radio].ic} {RADIO_HELP[x.radio].short}
            </b>
          </div>
        ) : null}
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
          Fond {Math.round(x.energy)} % · Jus {Math.round(x.punch)} % · Alim. {Math.round(x.food)} % ·{' '}
          <Effort I={x.I} />
        </div>
      </div>
      {RADIO_GROUPS.map(([g, ks]) => (
        <div key={g} className="mt-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{g}</div>
          <div className="grid gap-1.5">
            {ks
              .filter(k => RADIO[k])
              .map(k => {
                const H = RADIO_HELP[k];
                const on = x.radio === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => sendRadio(id, k)}
                    className={
                      'flex min-h-12 items-start gap-2.5 rounded-xl px-3 py-2 text-left active:scale-[.98] ' +
                      (on ? 'bg-slate-800/70 ring-1 ring-sky-400' : 'bg-slate-800 ring-1 ring-slate-700')
                    }
                  >
                    <span className="text-lg leading-6">{H.ic}</span>
                    <span>
                      <b className="text-sm text-slate-100">{H.short}</b>
                      {on ? <span className="ml-1 text-xs text-sky-300">en cours</span> : null}
                      <span className="block text-xs text-slate-400">{H.d}</span>
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      ))}
      {UI.markPick === id ? (
        <>
          <div className="mt-3 text-sm font-semibold text-slate-100">Qui marquer ?</div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {sim.runners
              .filter(y => !y.player && !y.fin && !y.dnf && sim.favs.has(y.id))
              .map(y => (
                <Btn key={y.id} onClick={() => setMark(id, y.id)}>
                  {riderName(y.r)} <span className="text-slate-400">{y.team.short}</span>
                </Btn>
              ))}
          </div>
        </>
      ) : null}
      <p className="mt-3 text-xs text-slate-400">
        {me
          ? 'C’est toi : tes ordres s’appliquent toujours. Sans jus, une attaque reste impossible.'
          : 'Le coureur peut refuser selon sa discipline, son moral, son ambition et la situation. Sans jus, une attaque est impossible.'}
      </p>
    </div>
  );
}
