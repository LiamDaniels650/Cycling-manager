// Marché des coureurs (portage fidèle de viewMarket et mercatoCard) : libres, fins de contrat, sous contrat,
// suivis, mercato ; filtre par profil, profils de l'effectif, demande, indemnité et aide à la décision.
import { Card, Btn, Badge, RiderLink, Select, Tabs, Pills } from '../ui.jsx';
import { RiderList } from './Riders.jsx';

function Mercato() {
  const all = S.merc || [];
  const L = all.filter(e => (UI.mercAll ? true : e.imp) && (!UI.mercMine || e.my)).slice(0, 80);
  return (
    <Card title="📰 Mercato">
      <details className="mb-2 text-xs text-slate-400">
        <summary className="cursor-pointer py-1">Explications</summary>
        Transferts, signatures, départs et retraites dans le peloton, et rumeurs de la presse (à prendre avec prudence).
        Par défaut, seuls les coureurs en vue (victoires, points UCI) et les mouvements de votre équipe sont listés.
      </details>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <Btn active={!!UI.mercAll} onClick={() => ((UI.mercAll = !UI.mercAll), render())}>
          Tous les mouvements
        </Btn>
        <Btn active={!!UI.mercMine} onClick={() => ((UI.mercMine = !UI.mercMine), render())}>
          Mon équipe seulement
        </Btn>
      </div>
      {L.length ? (
        L.map((e, k) => {
          const r = S.riders[e.id];
          return (
            <div key={k} className={'border-t border-slate-800 py-2 text-sm ' + (e.my ? 'bg-pink-500/10' : '')}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-xs text-slate-400">
                  {e.s} · S{e.w}
                </span>
                <span className="text-xs text-slate-300">{MERC_KIND[e.k] || e.k}</span>
                {r ? <RiderLink r={r} /> : <span>{e.n}</span>}
              </div>
              <div className="text-xs text-slate-300">
                {e.f} → <b className="text-slate-100">{e.t}</b>
              </div>
            </div>
          );
        })
      ) : (
        <p className="text-slate-400">Aucun mouvement pour l'instant : le gros du mercato a lieu en fin de saison.</p>
      )}
    </Card>
  );
}
function Profiles() {
  const prof = rosterProfile();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {Object.keys(ARCH).map(k => {
        const o = prof[k];
        return (
          <div
            key={k}
            className={
              'rounded-xl px-2.5 py-2 text-center ' + (o ? 'bg-slate-800/70' : 'bg-rose-500/10 ring-1 ring-rose-400/40')
            }
          >
            <b className="block text-lg text-slate-50">{o ? o.n : 0}</b>
            <span className="text-xs text-slate-300">{ARCH[k].lbl}</span>
            <i className="block text-xs not-italic text-slate-400">{o ? 'meilleur ' + o.best : 'aucun'}</i>
          </div>
        );
      })}
    </div>
  );
}
export function Market() {
  const tab = UI.mkt;
  const tabs = [
    ['free', 'Libres'],
    ['pre', 'Fin de contrat'],
    ['transfer', 'Sous contrat'],
    ['watch', `👁 Suivis (${S.watch.length})`],
    ['merc', '📰 Mercato'],
  ];
  const head = <Tabs items={tabs} value={tab} onChange={k => ((UI.mkt = k), render())} />;
  if (tab === 'merc')
    return (
      <div className="space-y-3">
        {head}
        <Mercato />
      </div>
    );
  let rs;
  if (tab === 'free') rs = S.free.map(id => S.riders[id]).filter(r => r && !r.retired);
  else if (tab === 'pre')
    rs = Object.values(S.riders).filter(r => !r.retired && r.team > 0 && r.contract <= 1 && r.nextTeam == null);
  else if (tab === 'transfer') rs = Object.values(S.riders).filter(r => !r.retired && r.team > 0 && r.contract > 1);
  else rs = S.watch.map(id => S.riders[id]).filter(Boolean);
  if (UI.mktFilter) rs = rs.filter(r => r.arch === UI.mktFilter);
  const prof = rosterProfile();
  const help = {
    free: 'Coureurs sans équipe : négociez directement.',
    pre: 'Coureurs dont le contrat se termine : un pré-contrat les fait arriver en fin de saison, sans indemnité.',
    transfer:
      'Coureurs sous contrat : il faut payer une indemnité de transfert ; les équipes refusent de céder leurs deux meilleurs.',
    watch: 'Votre liste de suivi : vos recruteurs affinent chaque semaine leurs estimations.',
  }[tab];
  return (
    <div className="space-y-3">
      {head}
      <Card>
        <Btn className="w-full" onClick={() => doAsst('recruit')}>
          🧑‍💼 Compléter l'effectif
        </Btn>
        <p className="mt-2 text-xs text-slate-400">
          {help} Budget : <b className="text-slate-100">{fmtMoney(S.budget)}</b> · effectif {P().riders.length}/
          {ROSTER.max} (au moins {ROSTER.minPlayer}). Les valeurs « ~ » sont des estimations.
        </p>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
          Profil{' '}
          <Select
            value={UI.mktFilter || ''}
            onChange={v => ((UI.mktFilter = v), render())}
            options={[['', 'Tous'], ...Object.entries(ARCH).map(([k, a]) => [k, a.lbl])]}
          />
        </label>
        <details className="mt-2">
          <summary className="cursor-pointer py-1 text-sm text-slate-300">Profils de votre effectif</summary>
          <Profiles />
        </details>
        <div className="mt-3">
          <RiderList
            rs={rs.slice(0, 300)}
            cols={[
              ['Équipe', r => tshort(r)],
              ['Demande', r => '~' + fmtMoney(contractDemand(r))],
              ...(tab === 'transfer' ? [['Indemnité', r => fmtMoney(transferFee(r))]] : []),
              ['', r => <Pills items={marketBadges(r, prof)} />],
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
