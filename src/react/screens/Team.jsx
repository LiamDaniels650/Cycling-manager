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
        {ending.length ? (
          <div className="mb-2 text-xs text-amber-300">
            ⚠️ Fin de contrat cette saison :{' '}
            {ending.map((r, k) => (
              <span key={r.id}>
                {k ? ', ' : ''}
                <RiderLink r={r} />
              </span>
            ))}{' '}
            — prolongez-les avant que d'autres équipes ne leur fassent signer un pré-contrat.
          </div>
        ) : null}
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
