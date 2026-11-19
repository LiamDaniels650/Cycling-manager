// Le final au pouce : mes coureurs encore en jeu (les mieux placés d'abord), deux jauges et 2 ou 3 ordres radio
// choisis selon la situation (dans le groupe de tête, derrière, en montée, sprint plat), plus la radio complète.
// Les boutons envoient exactement les ordres radio habituels (sendRadio, teamRadio) : rien de nouveau côté moteur.
import { Card, Btn, Html, Effort, RiderLink } from '../ui.jsx';
import { Icon } from '../icons.jsx';
import { RADIO_HELP, doingNow, orderInfo } from './orders.js';

function Gauge({ v, color, label }) {
  const p = Math.max(0, Math.min(100, v));
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
      <span className="w-7">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-700">
        <span className={'block h-full rounded-full ' + (p < 25 ? 'bg-rose-500' : color)} style={{ width: p + '%' }} />
      </span>
      <b className="w-8 text-right tabular-nums text-slate-200">{Math.round(p)}</b>
    </div>
  );
}
// Ordres utiles maintenant pour ce coureur (au plus trois).
function actionsFor(sim, x, head) {
  const G = x.g;
  const n = G.riders.filter(y => !y.fin).length;
  const P = sim.P;
  const climb = P.climbs.some(c => c.end > G.pos && c.start < sim.dist && c.end >= sim.dist - FINALE_KM);
  const flat = !climb && P.finishGrad < 3;
  const A = [];
  // sprint à venir : les ordres qui comptent sont le moment de lancer et la roue à prendre
  const kmL = sim.dist - G.pos;
  if (flat && G === head && n > 3 && kmL <= 4 && (x.order === 'sprint' || x.r.s.spr >= 75)) {
    const rv = fastestRival(x);
    const adv = sprintAdvice(x, sim.finWind);
    A.push([
      'sp:long',
      'Lance long',
      x.launchPlan === 'long'
        ? 'ordre donné : ≈ 280 m'
        : sim.finWind === 'face'
          ? 'vent de face : risqué'
          : adv === 'long'
            ? '≈ 280 m : bon choix pour lui'
            : '≈ 280 m, pour un endurant',
    ]);
    A.push([
      'sp:court',
      'Attends',
      x.launchPlan === 'court' && !x.wheelId
        ? 'ordre donné : ≈ 170 m'
        : adv === 'court'
          ? sim.finWind === 'face'
            ? 'vent de face : bon choix'
            : 'explosif : bon choix pour lui'
          : 'sort à 170 m, dans les roues',
    ]);
    if (rv)
      A.push([
        'sp:wheel',
        `Roue de ${riderName(rv.r)}`,
        x.wheelId === rv.id ? 'ordre donné' : `le plus rapide du groupe (${rv.r.s.spr})`,
      ]);
    A.push(['au:sprint', 'Auto', "l'adjoint choisit selon le coureur et le vent"]);
    return A;
  }
  // arrivée en côte ou au sommet : attaquer (ordre radio habituel), attendre la fin, ou suivre le meilleur grimpeur
  const upFin = P.finishGrad >= 3 || P.climbs.some(c => c.end >= sim.dist - 0.5);
  // seulement pour un coureur qui joue la gagne : leader, carte libre, ou parmi les 10 meilleurs grimpeurs du groupe
  const fg = Math.max(P.finishGrad, 4);
  const contender =
    ['leader', 'free'].includes(x.order) ||
    G.riders.filter(y => !y.fin && y !== x && cap(y, fg, 0) > cap(x, fg, 0)).length < 10;
  if (upFin && G === head && n > 1 && kmL <= 3 && contender) {
    const rv = bestClimberRival(sim, x);
    A.push([
      'attack',
      'Attaque maintenant',
      x.punch < 30 ? 'jus trop bas : risque d’échec' : `à ${kmL.toFixed(1).replace('.', ',')} km, coûte du jus`,
    ]);
    A.push([
      'cl:last',
      'Attends la fin',
      x.climbPlan === 'last'
        ? 'ordre donné : tout à 300 m'
        : x.r.s.col - x.r.s.mon >= 3
          ? 'puncheur : effort au bon moment'
          : 'discipline à 300 m, peu à gagner',
    ]);
    if (rv)
      A.push([
        'cl:follow',
        `Suis ${riderName(rv.r)}`,
        x.followId === rv.id
          ? 'ordre donné'
          : cap(rv, fg, 0) > cap(x, fg, 0) + 3
            ? 'plus fort : risque d’exploser'
            : 'à ta portée : roue à prendre',
      ]);
    A.push(['au:climb', 'Auto', "l'adjoint choisit selon le coureur et ses rivaux"]);
    return A;
  }
  if (G !== head) {
    A.push(['bridge', 'Rejoindre devant', 'effort court pour boucher le trou']);
    if (n > 3) A.push(['chase', 'Chasser', 'mène à fond, vide le fond']);
  } else if (n > 1)
    A.push(['attack', 'Attaquer', x.punch < 30 ? 'jus trop bas : risque d’échec' : 'part seul, coûte du jus']);
  if (climb) A.push(['pace', 'À ton rythme', 'lâche prise pour ne pas exploser']);
  else if (flat && n > 6) A.push(['front', 'Se placer devant', 'remonte pour le sprint']);
  if (G === head && n > 1 && n <= 12) A.push(['nopull', 'Ne plus relayer', 'garde des forces pour le final']);
  return A.slice(0, 3);
}
// Dans un même groupe, les cartes à jouer d'abord : leader, sprinteur, carte libre, puis les équipiers.
const ROLE_RANK = { leader: 0, sprint: 1, free: 2, leadout: 3, break: 4 };
// Les cartes du final sont choisies une fois (à l'entrée dans le final) et restent à leur place jusqu'à
// l'arrivée : l'écran ne se réorganise pas à chaque mouvement de course.
function finalPick(sim) {
  if (sim._finalPick) return sim._finalPick;
  const all = sim.runners
    .filter(x => (S.car ? x.id === S.car.id : x.player) && !x.fin && !x.dnf && x.g)
    .sort((a, b) => b.g.pos - a.g.pos || (ROLE_RANK[a.order] ?? 5) - (ROLE_RANK[b.order] ?? 5) || b.energy - a.energy);
  // la meilleure carte de chaque groupe d'abord (un coureur dans un groupe de contre compte), puis les suivantes
  const firsts = all.filter((x, i) => all.findIndex(y => y.g === x.g) === i);
  sim._finalPick = [...firsts, ...all.filter(x => !firsts.includes(x))]
    .slice(0, 3)
    .sort((a, b) => all.indexOf(a) - all.indexOf(b));
  return sim._finalPick;
}
export function FinalActions({ sim }) {
  const live = sim.groups.filter(G => G.riders.some(y => !y.fin));
  const head = live[0];
  if (!head) return null;
  const mine = finalPick(sim);
  const last = sim.log
    .slice(-6)
    .reverse()
    .find(l => /^📻/.test(l.txt));
  return (
    <Card
      className="border-pink-400/40"
      title={
        <span className="flex items-center gap-1.5">
          <Icon name="radio" size={16} className="text-pink-300" /> {S.car ? 'Ton final' : 'Mes cartes pour le final'}
        </span>
      }
    >
      {/* dernière réponse radio : place toujours réservée */}
      <div
        className={
          'mb-2 min-h-[2.75rem] rounded-lg px-2.5 py-1.5 text-sm ' +
          (last && last.cls === 'bad' ? 'bg-rose-500/15 text-rose-100' : 'bg-pink-500/10 text-pink-100')
        }
      >
        {last ? (
          <Html html={last.txt} />
        ) : (
          <span className="text-slate-400">Les réponses à tes ordres radio s'afficheront ici.</span>
        )}
      </div>
      {mine.length ? (
        <div className="space-y-2">
          {mine.map(x => {
            const out = x.fin || x.dnf || !x.g;
            const acts = out ? [] : actionsFor(sim, x, head);
            const gap = out ? doingNow(sim, x) : x.g === head ? 'en tête' : fmtGap(gapSec(head, x.g));
            const R = x.radio && RADIO_HELP[x.radio];
            return (
              <div key={x.id} className={'rounded-xl bg-slate-800/70 p-2.5 ' + (out ? 'opacity-60' : '')}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-sm">
                    <Effort I={out ? null : x.I} />
                    <RiderLink r={x.r} /> <span className="text-xs text-slate-400">{orderInfo(x).lbl}</span>
                  </span>
                  <b className={'shrink-0 tabular-nums ' + (x.g === head ? 'text-amber-200' : 'text-slate-100')}>
                    {gap}
                  </b>
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-300">
                  {out ? '\u00a0' : doingNow(sim, x)}
                  {R && !out ? <span className="text-sky-300"> · 📻 {R.short}</span> : null}
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-3">
                  <Gauge label="Fond" v={x.energy} color="bg-emerald-400" />
                  <Gauge label="Jus" v={x.punch} color="bg-sky-400" />
                </div>
                {/* toujours quatre cases (2 × 2) : les boutons ne bougent pas quand la situation change */}
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {(acts.length > 3 ? [0, 1, 2, 3] : [0, 1, 2]).map(j => {
                    const a = acts[j];
                    if (!a) return <div key={j} className="min-h-14 rounded-xl bg-slate-800/40" />;
                    const cl = a[0].startsWith('cl:');
                    const au = a[0].startsWith('au:');
                    const sp = a[0].startsWith('sp:') || cl || au;
                    const H = sp
                      ? {
                          ic: au
                            ? '🤖'
                            : a[0] === 'sp:long'
                              ? '🚀'
                              : a[0] === 'sp:court' || a[0] === 'cl:last'
                                ? '⏳'
                                : '🎯',
                        }
                      : RADIO_HELP[a[0]];
                    return (
                      <button
                        key={j}
                        type="button"
                        onClick={() =>
                          au
                            ? (finalAuto(sim, x.id, a[0].slice(3)), render())
                            : cl
                              ? (climbOrder(sim, x.id, a[0].slice(3)), render())
                              : sp
                                ? (sprintOrder(sim, x.id, a[0].slice(3)), render())
                                : sendRadio(x.id, a[0])
                        }
                        className={
                          'flex min-h-14 flex-col items-start justify-center rounded-xl px-2.5 py-1.5 text-left active:scale-[.97] ' +
                          (au
                            ? 'bg-emerald-400 text-slate-950'
                            : a[0] === 'attack' || a[0] === 'bridge' || sp
                              ? 'bg-sky-500 text-slate-950'
                              : 'bg-slate-800 text-slate-100 ring-1 ring-slate-700')
                        }
                      >
                        <b className="text-[13px] leading-tight">
                          {H.ic} {a[1]}
                        </b>
                        <span
                          className={
                            'text-[11px] leading-tight ' +
                            (a[0] === 'attack' || a[0] === 'bridge' || sp ? 'text-slate-900' : 'text-slate-400')
                          }
                        >
                          {a[2]}
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={out}
                    onClick={() => openRadio(x.id)}
                    className={
                      (acts.length > 3 ? 'col-span-2 min-h-10 ' : 'min-h-14 ') +
                      'flex flex-col items-start justify-center rounded-xl bg-slate-800 px-2.5 py-1.5 text-left text-slate-100 ring-1 ring-slate-700 active:scale-[.97] disabled:opacity-40'
                    }
                  >
                    <b className="flex items-center gap-1 text-[13px]">
                      <Icon name="radio" size={15} /> Tous les ordres
                    </b>
                    <span className="text-[11px] leading-tight text-slate-400">expliqués un par un</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Plus aucun de vos coureurs en course.</p>
      )}
      {S.car ? null : (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <Btn className="px-1 text-[13px]" onClick={() => teamRadio('chase')}>
            Équipe : rouler
          </Btn>
          <Btn className="px-1 text-[13px]" onClick={() => teamRadio('front')}>
            Équipe : devant
          </Btn>
          <Btn className="px-1 text-[13px]" onClick={() => teamRadio('stop')}>
            Équipe : arrêter
          </Btn>
        </div>
      )}
    </Card>
  );
}
