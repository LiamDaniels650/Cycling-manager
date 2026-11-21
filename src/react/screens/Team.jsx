// Effectif : demande d'augmentation, délégation à l'adjoint, fins de contrat, liste des coureurs avec liens,
// objectif, contrat et plan d'entraînement (portage de viewTeam, raiseCard et trainSel).
import { Card, Btn, H2, Info, RiderLink, Select } from '../ui.jsx';
import { RiderList } from './Riders.jsx';

function AutoBtn({ k, lbl }) {
  return <Btn onClick={() => doAsst(k)}>🧑‍💼 {lbl || 'Auto'}</Btn>;
}
function RaiseBanner() {
  const q = S.raiseReq;
  if (!q || !S.riders[q.id]) return null;
  const r = S.riders[q.id];
  return (
    <div className="mb-3 rounded-xl bg-amber-400/10 p-2.5 text-sm text-slate-100 ring-1 ring-amber-300/40">
      💶 <RiderLink r={r} /> demande {fmtMoney(q.ask)}/an au lieu de {fmtMoney(r.salary)}.
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Btn primary onClick={() => doRaise(true)}>
          Accepter
        </Btn>
        <Btn onClick={() => doRaise(false)}>Refuser</Btn>
        <AutoBtn k="contracts" lbl="Laisser l'adjoint décider" />
      </div>
    </div>
  );
}
// Offre de rachat d'un directeur adverse pour l'un de mes coureurs (dsBidWeekly).
function BidBanner() {
  const B = S.bid;
  const r = B && S.riders[B.id],
    T = B && teamById(B.t);
  if (!r || !T) return null;
  const go = k => ((UI.flash = dsBidAnswer(k)), save(), render());
  const d = dsOf(T);
  return (
    <div className="mb-3 rounded-xl bg-emerald-400/10 p-2.5 text-sm text-slate-100 ring-1 ring-emerald-300/40">
      💰 <b>{dsName(T)}</b> ({T.name}, {DS_TEMPER[d.temper].lbl.toLowerCase()}) propose <b>{fmtMoney(B.fee)}</b> pour{' '}
      <RiderLink r={r} />. Il lui offrirait {fmtMoney(B.sal)}/an (contre {fmtMoney(r.salary)} chez vous).
      <div className="mt-1 text-xs text-slate-400">
        Réponse avant la semaine {B.exp + 1}. Une contre-offre (+30 %) peut le faire renoncer.
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Btn primary onClick={() => go('oui')}>
          Vendre
        </Btn>
        <Btn onClick={() => go('contre')}>Contre-offre</Btn>
        <Btn onClick={() => go('non')}>Refuser</Btn>
      </div>
    </div>
  );
}
// Fins de contrat : un compteur, la liste à déplier avec la demande de chacun et un bouton pour prolonger.
function EndingBox({ ending }) {
  const ext = r => ((UI.flash = extendRider(r.id, 2) || `${riderName(r)} prolonge de 2 ans.`), save(), render());
  return (
    <details className="mb-2 rounded-xl bg-amber-400/10 text-sm text-amber-100 ring-1 ring-amber-300/50">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-2.5">
        <span>
          ⚠️ <b>{ending.length}</b> contrat{ending.length > 1 ? 's' : ''} à prolonger{' '}
          <span className="text-xs text-amber-200/80">(sinon pré-contrats ailleurs)</span>
        </span>
      </summary>
      <div className="divide-y divide-amber-300/20 px-2.5 pb-2">
        {ending
          .slice()
          .sort((a, b) => svOv(b) - svOv(a))
          .map(r => (
            <div key={r.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="min-w-0">
                <RiderLink r={r} />{' '}
                <span className="text-xs text-slate-300">
                  {r.age} ans · {svOv(r)} · demande {fmtMoney(contractDemand(r))}/an
                </span>
              </span>
              <Btn className="min-h-9 shrink-0" onClick={() => ext(r)}>
                +2 ans
              </Btn>
            </div>
          ))}
      </div>
    </details>
  );
}
export function TrainSelect({ r }) {
  return (
    <span className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
      <Select value={r.training} onChange={v => setTraining(r.id, v)} options={Object.entries(TRAINING)} />
      {r.training === 'pic' ? (
        <Select
          value={r.peakW || ''}
          onChange={v => (setPeak(r.id, v), render())}
          options={[
            ['', 'objectif ?'],
            ...S.cal.filter(c => !c.done && c.w > S.week).map(c => [c.w, `${c.name} (s${c.w})`]),
          ]}
        />
      ) : null}
    </span>
  );
}
export function Team() {
  const rs = myRiders();
  const sal = sum(rs.map(r => r.salary));
  const nxt = S.cal.find(c => !c.done);
  const ending = rs.filter(r => r.contract <= 1 && r.nextTeam == null);
  const links = r => {
    const rl = relationsOf(r.id);
    const f = rl.filter(a => a[1] > 0).length,
      x = rl.filter(a => a[1] < 0).length;
    return (f ? '🤝' + f + ' ' : '') + (x ? '⚡' + x : '');
  };
  return (
    <div className="space-y-3">
      <Card>
        <H2 right={<span className="text-xs text-slate-400">Salaires : {fmtMoney(sal)}/an</span>}>
          Effectif pro ({rs.length}/{ROSTER.max})
        </H2>
        <RaiseBanner />
        <BidBanner />
        <div className="mb-2 grid grid-cols-2 gap-2">
          <AutoBtn k="train" lbl="Entraînement auto" />
          <AutoBtn k="contracts" lbl="Prolongations auto" />
        </div>
        <div className="mb-2 text-xs text-slate-400">
          Prochaine course :{' '}
          {nxt ? (
            <>
              <b className="text-slate-200">{nxt.name}</b> (sem. {nxt.w})
            </>
          ) : (
            'fin de saison'
          )}
          . Touchez une ligne pour le détail et l'entraînement, le nom pour la fiche.
        </div>
        {ending.length ? <EndingBox ending={ending} /> : null}
        <RiderList
          rs={rs}
          state
          cols={[
            ['Liens', links],
            ['Objectif', r => goalTag(r)],
            ['Contrat', r => r.contract + ' an'],
            ['Entraînement', r => <TrainSelect r={r} />],
          ]}
        />
      </Card>
      <Info label="Comment marche l'entraînement ?">
        <p className="text-xs text-slate-300">
          <b className="text-slate-200">Entraînement</b> : « Repos » fait baisser la fatigue mais aussi la forme ; «
          Bloc intensif » monte la forme vite mais fatigue ; « Pic de forme » vise ~92 de forme la semaine de la course
          choisie, puis un creux ; « Stage en altitude » (10 k€/sem.) : forme, montagne et endurance. Les plans
          spécifiques font progresser une caractéristique, d'autant plus que le coureur est jeune, loin de son potentiel
          et que vos entraîneurs sont bons.
        </p>
      </Info>
    </div>
  );
}
