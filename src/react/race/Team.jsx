// Mes coureurs en course et le panneau d'actions tactiques : jauges, consignes, radio, négociations dans
// l'échappée, alliances de poursuite, ordres d'équipe (portage de liveHTML, negoHTML, allyHTML).
import { Card, Btn, Meter, Badge, Effort, RiderLink, Jersey } from '../ui.jsx';
import { Icon } from '../icons.jsx';
import { RADIO_HELP, doingNow, orderInfo } from './orders.js';

function RiderLive({ sim, x, front }) {
  const gi = x.g ? sim.groups.indexOf(x.g) : -1;
  const out = x.fin || x.dnf;
  let st = null;
  if (x.dnf) st = <Badge tone="red">abandon</Badge>;
  else if (x.fin) st = <Badge>arrivé {sim.finish.indexOf(x) + 1}e</Badge>;
  else if (gi >= 0)
    st = (
      <span>
        {grpLabel(sim, x.g, gi)}
        {gi ? <b className="ml-1 tabular-nums">{boardGapTxt(sim, front, x.g)}</b> : null}
        {x.g.riders.length >= 8 ? ` · ${posLbl(x.pos)}` : ''}
      </span>
    );
  const avg = x.st && x.st.pn ? Math.round(x.st.pw / x.st.pn) : null;
  const oi = orderInfo(x);
  const R = x.radio && RADIO_HELP[x.radio];
  return (
    <div className={'rounded-xl bg-slate-800/60 p-2.5 ' + (out ? 'opacity-60' : '')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-sm">
          <RiderLink r={x.r} />
          <Jersey id={x.id} />
          <div className="mt-0.5 truncate text-xs text-slate-300" title={oi.d}>
            Consigne : <b className="text-slate-100">{oi.lbl}</b>
            {x.rebel ? <span className="text-rose-300"> · n'en fait qu'à sa tête</span> : null}
            {x.bonk ? <span className="text-rose-300"> · fringale</span> : null}
            {x.aim ? <span className="text-sky-300"> · 🎯 {x.aim === 'kom' ? 'montagne' : 'points'}</span> : null}
            {x.conds && x.conds.some(c => !c.done) ? <span> · ordre conditionnel</span> : null}
          </div>
          <div className="min-h-5 text-xs">
            {R && !out ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-800/70 px-1.5 text-slate-100">
                📻 {R.ic} {R.short}
                <button
                  type="button"
                  title="Annuler l'ordre radio"
                  onClick={() => sendRadio(x.id, 'reset')}
                  className="ml-0.5 px-1 text-sky-300"
                >
                  ✕
                </button>
              </span>
            ) : null}
          </div>
        </div>
        {out ? null : (
          <button
            type="button"
            title="Radio"
            onClick={() => openRadio(x.id)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800/70 text-slate-100 ring-1 ring-slate-700 active:scale-95"
          >
            <Icon name="radio" size={20} />
          </button>
        )}
      </div>
      <div className="mt-1 truncate text-sm text-slate-100">
        <Effort I={out ? null : x.I} />
        {doingNow(sim, x)}
      </div>
      <div className="truncate text-xs text-slate-400">{st}</div>
      {out ? (
        avg != null ? (
          <div className="mt-1 text-xs text-slate-400">⚡ moy. {avg} W</div>
        ) : null
      ) : (
        <>
          <div className="mt-2 space-y-1">
            <Meter icon="battery" label="Fond" v={x.energy} color="bg-emerald-400" />
            <Meter icon="zap" label="Jus" v={x.punch} color="bg-cyan-400" />
            <Meter icon="food" label="Alim." v={x.food} color="bg-amber-400" />
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {avg != null ? (
              <>
                <Icon name="zap" size={12} className="text-yellow-300" />{' '}
                <b className="text-slate-100">{Math.round(x.pw || 0)} W</b> · {fmtDec((x.pw || 0) / (x.r.kg || 68), 1)}{' '}
                W/kg (moy. {avg})
              </>
            ) : null}
            {x.pocket ? ` · 🍫 ${x.pocket} barre${x.pocket > 1 ? 's' : ''}` : ''}
          </div>
        </>
      )}
    </div>
  );
}
export function Nego({ sim }) {
  const pc = (sim.pacts || []).find(p => !p.done && !p.ai);
  const st = negoState(sim);
  const wait = sim.t - (sim.negoT ?? -99) < 10;
  return (
    <>
      {pc ? (
        <div className="rounded-xl bg-violet-500/15 p-2.5 text-sm text-violet-100 ring-1 ring-violet-400/40">
          🤝 Pacte : {pactTxt(pc)}.
          {pactYielder(pc) === pc.p ? (
            <Btn className="ml-2 mt-1" onClick={() => negoUI('break')}>
              Rompre le pacte
            </Btn>
          ) : null}
        </div>
      ) : null}
      {st ? (
        <div className="rounded-xl bg-violet-500/10 p-2.5 text-sm text-slate-100 ring-1 ring-violet-400/30">
          <b>🗣️ Dans l'échappée</b> ({riderName(st.x.r)} avec {st.others.length} adversaire
          {st.others.length > 1 ? 's' : ''})
          <div className="mt-2 flex flex-col gap-2">
            <Btn disabled={wait} onClick={() => negoUI('coop')}>
              Demander à tous de rouler
            </Btn>
            {st.cands.map(c => (
              <Btn key={c.y.id} disabled={wait || !!pc} onClick={() => negoUI('pact', c.y.id)}>
                Pacte avec {riderName(c.y.r)} :{' '}
                {c.type === 'etape' ? 'je roule, tu me laisses l’étape' : 'tu roules, je te laisse l’étape'}
              </Btn>
            ))}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Un refus vexe ; un pacte rompu se paie dans les relations entre équipes.
          </div>
        </div>
      ) : null}
    </>
  );
}
export function Ally({ sim, mode }) {
  if (mode === 'offer') return sim.allyOffer ? <AllyOffer sim={sim} /> : null;
  if (sim.allyOffer) return null;
  return <AllyStatus sim={sim} />;
}
function AllyOffer({ sim }) {
  if (sim.allyOffer)
    return (
      <div className="rounded-xl bg-emerald-500/10 p-2.5 text-sm text-slate-100 ring-1 ring-emerald-400/40">
        <b>🤝 {sim.allyOffer.T.name}</b> vous propose de rouler ensemble derrière l'échappée.
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Btn primary onClick={() => allyUI(true)}>
            Accepter
          </Btn>
          <Btn onClick={() => allyUI(false)}>Refuser</Btn>
        </div>
        <div className="mt-1 text-xs text-slate-400">
          Accepter améliore vos relations avec eux ; refuser les froisse. Sans réponse dans{' '}
          {Math.max(0, Math.round((sim.allyOffer.exp - sim.t) * 60))} s, {adjName()} tranchera selon l'intérêt de l'équipe.
        </div>
      </div>
    );
  return null;
}
// Alliance en cours, ou proposition d'alliance quand l'échappée file sans aucun de mes coureurs.
function AllyStatus({ sim }) {
  if (sim.ally)
    return (
      <div className="rounded-xl bg-emerald-500/10 p-2.5 text-sm text-slate-100 ring-1 ring-emerald-400/30">
        🤝 Alliance avec <b>{sim.ally.T.name}</b> : vos équipiers prennent leurs relais.{' '}
        <Btn className="mt-1" onClick={() => allyUI('break')}>
          Rompre
        </Btn>
      </div>
    );
  if (breakAheadNoMine(sim) && sim.pel && sim.pel.riders.some(x => x.player))
    return <Btn onClick={() => allyUI('ask')}>🤝 Proposer une alliance de poursuite</Btn>;
  return null;
}
// Ordres d'équipe : rouler, arrêter, se placer, bordure, retour aux consignes.
function TeamOrders({ sim }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Ordres à toute l'équipe</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Btn onClick={() => teamRadio('chase')}>Rouler</Btn>
        <Btn onClick={() => teamRadio('stop')}>Arrêter</Btn>
        <Btn onClick={() => teamRadio('front')}>Se placer devant</Btn>
        {sim.P.wind ? (
          <Btn onClick={() => teamRadio('echelon')}>
            <Icon name="wind" size={16} /> Bordure !
          </Btn>
        ) : null}
        <Btn onClick={() => teamRadio('reset')}>Consignes</Btn>
      </div>
    </div>
  );
}
export function MyTeam({ sim }) {
  const front = sim.groups[0];
  // ordre fixe pour l'étape (sélection) : les cartes ne changent pas de place quand les groupes bougent
  const mine = sim.runners.filter(x => (S.car ? x.id === S.car.id : x.player));
  return (
    <Card
      title={S.car ? 'Ta course' : 'Mes coureurs'}
      right={
        <span
          className="flex items-center gap-1 text-xs text-slate-400"
          title="Ordre des voitures derrière le peloton : selon le général (ou le classement UCI). Plus la voiture est loin, plus un dépannage coûte cher."
        >
          <Icon name="car" size={15} /> voiture {carRank(sim, S.teams[0])}e dans la file
        </span>
      }
    >
      <div className="space-y-2">
        {mine.map(x => (
          <RiderLive key={x.id} sim={sim} x={x} front={front} />
        ))}
        {/* négociation dans l'échappée et pacte : dans la page (ils durent des dizaines de km), pas en surimpression */}
        <Nego sim={sim} />
        {S.car ? null : <TeamOrders sim={sim} />}
        {S.car ? null : (
          <div className="min-h-11">
            <Ally sim={sim} />
          </div>
        )}
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer py-1">Explications</summary>
          Fond = réserves de la journée ; Jus = explosivité (attaques, relances), se recharge à l'abri. Alimentation :
          sous 30 %, risque de fringale ; musette à mi-course, soigneurs en plus avec le ravitaillement renforcé, 🍫 =
          barres en poche (radio « Mange maintenant »), ou bidons apportés par un équipier.
        </details>
      </div>
    </Card>
  );
}
