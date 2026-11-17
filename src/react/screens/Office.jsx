// Gestion (portage fidèle de viewMgmt, assistantCard, equipCard, careerCard et imageCard) : sponsor et objectifs,
// finances et projection, staff, historique, adjoint, équipementiers, carrière, image de l'équipe.
import { Card, Btn, Bar, Badge, Select, H2 } from '../ui.jsx';

function Sponsor() {
  return (
    <Card>
      <H2>Sponsor{S.spons ? ' : ' + S.spons.name : ''}</H2>
      {S.spons ? (
        <div className="text-xs text-slate-400">
          Contrat : encore {S.spons.years} saison(s) · difficulté {diffOf().lbl}
        </div>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-200">
        Confiance : <b>{S.conf}/100</b> <Bar v={S.conf} /> · versement {fmtMoney(sponsorWeekly())}/sem.
      </div>
      <h3 className="mt-3 font-semibold text-slate-100">Objectifs {S.season}</h3>
      {(S.obj || []).map((o, k) => {
        const st = objStatus(o);
        return (
          <div key={k} className="flex gap-2 border-t border-slate-800 py-2 text-sm">
            <span>{st.ok ? '✅' : '⬜'}</span>
            <div className="min-w-0 flex-1">
              <div className="text-slate-100">{o.txt}</div>
              <div className="text-xs text-slate-400">{st.prog}</div>
            </div>
            <span className="shrink-0 text-xs text-slate-300">{fmtMoney(o.rew)}</span>
          </div>
        );
      })}
      <p className="mt-1 text-xs text-slate-400">
        Chaque objectif atteint rapporte une prime et de la confiance ; chaque échec en coûte. La confiance fixe le
        versement hebdomadaire du sponsor.
      </p>
    </Card>
  );
}
function Finances() {
  const f = (S.fin || {})[S.season] || {};
  const L = {
    spons: 'Sponsor',
    equip: 'Équipementiers',
    prize: 'Primes de course',
    sal: 'Salaires pros',
    aca: 'Académie',
    staff: 'Staff',
    transf: 'Transferts & indemnités',
    other: 'Frais de course & stages',
  };
  const pj = budgetProjection();
  const tot = Math.round(sum(Object.values(f)));
  return (
    <Card title={`Finances ${S.season}`}>
      {Object.keys(L).map(k => (
        <div key={k} className="flex justify-between border-t border-slate-800 py-1.5 text-sm">
          <span className="text-slate-300">{L[k]}</span>
          <span className={'tabular-nums ' + ((f[k] || 0) < 0 ? 'text-rose-300' : 'text-slate-100')}>
            {fmtMoney(Math.round(f[k] || 0))}
          </span>
        </div>
      ))}
      <div className="flex justify-between border-t border-slate-600 py-1.5 text-sm font-bold">
        <span>Solde de la saison</span>
        <span className={tot < 0 ? 'text-rose-300' : 'text-emerald-300'}>{fmtMoney(tot)}</span>
      </div>
      {pj.wk ? (
        <div className="mt-2 rounded-xl bg-sky-500/10 px-2.5 py-2 text-sm text-sky-100 ring-1 ring-sky-400/30">
          📈 Flux réguliers (sponsor, équipementiers, salaires, staff) :{' '}
          <b>
            {pj.weekly >= 0 ? '+' : ''}
            {fmtMoney(Math.round(pj.weekly))}/sem.
          </b>{' '}
          → budget estimé en fin de saison : <b>{fmtMoney(Math.round(pj.end))}</b>{' '}
          <span className="text-xs text-slate-400">
            (hors primes de course, frais de course, transferts et primes d'objectifs)
          </span>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-slate-300">
        Masse salariale annuelle : pros {fmtMoney(sum(myRiders().map(r => r.salary)))}, académie{' '}
        {fmtMoney(sum(acaRiders().map(r => r.salary)))}, staff{' '}
        {fmtMoney(sum(Object.values(S.staff).map(l => STAFF_COST[l])))}.
      </p>
    </Card>
  );
}
function Staff() {
  return (
    <Card title="Staff" right={<Btn onClick={() => doAsst('staff')}>🧑‍💼 Auto</Btn>}>
      {Object.keys(STAFF_LBL).map(k => (
        <div key={k} className="flex items-center gap-2 border-t border-slate-800 py-2">
          <div className="min-w-0 flex-1">
            <b className="text-sm text-slate-100">{STAFF_LBL[k]}</b>
            <div className="text-xs text-slate-400">{STAFF_DESC[k]}</div>
            <div className="mt-0.5 text-sm text-amber-300">
              {'●'.repeat(S.staff[k])}
              <span className="text-slate-600">{'○'.repeat(5 - S.staff[k])}</span>{' '}
              <span className="text-xs text-slate-400">{fmtMoney(STAFF_COST[S.staff[k]])}/an</span>
            </div>
          </div>
          <Btn disabled={S.staff[k] >= 5} className="w-11 px-0" onClick={() => staff(k, 1)}>
            +
          </Btn>
          <Btn disabled={S.staff[k] <= 1} className="w-11 px-0" onClick={() => staff(k, -1)}>
            −
          </Btn>
        </div>
      ))}
      <p className="mt-1 text-xs text-slate-400">
        Monter d'un niveau coûte une prime d'embauche (50 % de la différence de salaire annuel).
      </p>
    </Card>
  );
}
function History() {
  if (!S.teamHist.length) return null;
  return (
    <Card title="Historique">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-400">
            <tr>
              {['Saison', 'Club', 'Rang UCI', 'Points', 'Victoires', 'Budget', 'Confiance', 'Notoriété'].map(h => (
                <th key={h} className="px-1 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {S.teamHist
              .slice()
              .reverse()
              .map(t => (
                <tr key={t.s} className="border-t border-slate-800">
                  <td className="px-1 py-1.5">{t.s}</td>
                  <td className="px-1 text-xs">{t.club || P().name}</td>
                  <td className="px-1">{t.rank}e</td>
                  <td className="px-1">{t.uci}</td>
                  <td className="px-1">{t.wins}</td>
                  <td className="px-1">{fmtMoney(t.budget)}</td>
                  <td className="px-1">{t.conf}</td>
                  <td className="px-1">{t.rep != null ? t.rep : '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
function Assistant() {
  const A = S.auto || {};
  const on = Object.keys(AUTO_LBL).filter(k => A[k]).length;
  return (
    <Card
      title="🧑‍💼 Adjoint"
      right={
        <span className="text-xs text-slate-400">
          {on}/{Object.keys(AUTO_LBL).length} domaines délégués
        </span>
      }
    >
      <details className="mb-1 text-xs text-slate-400">
        <summary className="cursor-pointer py-1">Explications</summary>
        Cochez ce que votre adjoint gère chaque semaine à votre place. Il vous envoie un rapport quand il prend une
        décision importante. Chaque écran a aussi son bouton « Auto » pour une décision ponctuelle.
      </details>
      {Object.entries(AUTO_LBL).map(([k, [l, d]]) => (
        <div key={k} className="flex items-center gap-2 border-t border-slate-800 py-2">
          <label className="flex min-w-0 flex-1 gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-sky-500"
              checked={!!A[k]}
              onChange={e => (setAuto(k, e.target.checked), save(), render())}
            />
            <span>
              <b className="text-slate-100">{l}</b>
              <span className="block text-xs text-slate-400">{d}</span>
            </span>
          </label>
          <Btn className="shrink-0" onClick={() => doAsst(k)}>
            Auto maintenant
          </Btn>
        </div>
      ))}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Btn onClick={() => (Object.keys(AUTO_LBL).forEach(k => setAuto(k, true)), save(), render())}>
          Tout déléguer
        </Btn>
        <Btn onClick={() => (Object.keys(AUTO_LBL).forEach(k => setAuto(k, false)), save(), render())}>
          Tout reprendre en main
        </Btn>
      </div>
    </Card>
  );
}
function Equipment() {
  const T = P();
  return (
    <Card
      title="🚲 Équipementiers"
      right={S.eqOffers ? <Btn onClick={() => doAsst('equip')}>🧑‍💼 Choix auto</Btn> : null}
    >
      {Object.keys(EQ_CATS).map(cat => {
        const b = eqUsed(T, cat),
          d = S.eqDeal[cat];
        return (
          <div key={cat} className="border-t border-slate-800 py-2 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <b className="text-slate-100">{EQ_CATS[cat].lbl}</b>
              <span>
                <b>{b.name}</b>
                {d.proto ? <Badge>🧪 prototypes</Badge> : null}
              </span>
            </div>
            <div className="text-xs text-slate-400">{eqTraits(cat, b)}</div>
            <div className="text-xs text-slate-400">
              {fmtMoney(d.pay)}/saison{d.perf ? ` + ${fmtMoney(d.perf)} par victoire` : ''} · {d.years} an(s) restant(s)
            </div>
          </div>
        );
      })}
      <details className="mt-1 text-xs text-slate-400">
        <summary className="cursor-pointer py-1">Explications</summary>
        Aéro : vitesse sur le plat et en vallonné · légèreté : montées · confort : pavés (vitesse et crevaisons) ·
        robustesse : crevaisons · chrono : contre-la-montre. Écart entre le meilleur et le moins bon matériel : environ
        1 % de vitesse, 2 % en chrono. Les meilleures marques paient moins mais exigent de la notoriété.
      </details>
      {S.eqOffers && Object.keys(S.eqOffers).length ? (
        <>
          <h3 className="mt-3 font-semibold text-slate-100">Offres pour la saison {S.season + 1}</h3>
          {Object.keys(S.eqOffers).map(cat => (
            <div key={cat} className="mt-2">
              <div className="text-sm font-semibold text-slate-200">{EQ_CATS[cat].lbl}</div>
              {S.eqOffers[cat].map((o, k) => {
                const b = eqBrand(cat, o.id),
                  on = S.eqChoice[cat] === k;
                if (o.gone)
                  return (
                    <div key={k} className="border-t border-slate-800 py-2 text-sm text-slate-500">
                      <s>{b.name}</s> · offre retirée
                    </div>
                  );
                return (
                  <div
                    key={k}
                    className={
                      'mt-1 rounded-xl p-2.5 text-sm ' + (on ? 'bg-sky-500/15 ring-1 ring-sky-400' : 'bg-slate-800/60')
                    }
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>
                        <b className="text-slate-100">{b.name}</b>
                        {o.proto ? <Badge>🧪 prototypes</Badge> : null}
                      </span>
                      <span className="text-slate-100">
                        {fmtMoney(o.pay)}/saison{o.perf ? ` + ${fmtMoney(o.perf)}/victoire` : ''} · {o.years} an(s)
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">{eqTraits(cat, o.proto ? protoBrand(cat, b) : b)}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {on ? (
                        <span className="flex items-center text-sm text-emerald-300">✅ choisi</span>
                      ) : (
                        <Btn onClick={() => doEq(cat, k)}>Choisir</Btn>
                      )}
                      {o.neg ? null : (
                        <Select
                          value=""
                          onChange={v => doEqNego(cat, k, v)}
                          options={[['', 'Négocier…'], ...Object.entries(EQ_NEGO)]}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <details className="mt-1 text-xs text-slate-400">
            <summary className="cursor-pointer py-1">Explications</summary>
            Une seule négociation par offre. Plus d'argent : la marque peut refuser, voire retirer son offre si votre
            notoriété est juste. Prototypes : moins d'argent, matériel plus aéro et plus léger mais un peu plus fragile
            (notoriété requise). Prime à la victoire : moins de fixe, un bonus par succès versé en fin de saison. Sans
            choix de votre part, la meilleure offre financière sera retenue.
          </details>
        </>
      ) : S.week < EQ_OFFER_WEEK ? (
        <p className="mt-1 text-xs text-slate-400">
          Les offres pour la saison prochaine arrivent en semaine {EQ_OFFER_WEEK}.
        </p>
      ) : null}
    </Card>
  );
}
function Career() {
  const C = S.career || { rep: 45, clubs: [] };
  return (
    <Card title="👔 Carrière du directeur sportif">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
        Réputation : <b>{Math.round(C.rep)}/100</b> — {careerLabel(C.rep)} <Bar v={C.rep} />
      </div>
      {S.fired ? (
        <p className="mt-2 text-sm text-rose-300">
          <b>Vous avez été licencié.</b> Acceptez l'une des offres ci-dessous avant la première course.
        </p>
      ) : S.conf < 25 ? (
        <p className="mt-2 text-xs text-amber-300">
          Confiance du sponsor très basse ({S.conf}/100) : en dessous de 15 en fin de saison, c'est le licenciement.
        </p>
      ) : null}
      {S.jobOffers && S.jobOffers.length ? (
        <>
          <h3 className="mt-3 font-semibold text-slate-100">Offres d'emploi</h3>
          {S.jobOffers.map(o => {
            const T = teamById(o.tid);
            const best = T.riders
              .map(id => S.riders[id])
              .sort((a, b) => shownOv(b) - shownOv(a))
              .slice(0, 3);
            return (
              <div key={o.tid} className="mt-2 rounded-xl bg-slate-800/60 p-2.5 text-sm">
                <b className="text-slate-100">
                  <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: T.color }} />
                  {o.name}
                </b>
                <div className="text-xs text-slate-400">
                  {o.rank}e au classement · budget {fmtMoney(o.budget)} · leaders :{' '}
                  {best.map(r => riderName(r) + ' ' + svOv(r)).join(', ')}
                </div>
                <Btn primary className="mt-2 w-full" onClick={() => doJob(o.tid)}>
                  Accepter
                </Btn>
              </div>
            );
          })}
          {S.fired ? null : (
            <Btn className="mt-2 w-full" onClick={() => doDecline()}>
              Refuser et rester
            </Btn>
          )}
          <p className="mt-1 text-xs text-slate-400">
            Changer d'équipe : vous reprenez son effectif, son matériel, son budget et ses objectifs. Votre académie
            reste à votre ancien club.
          </p>
        </>
      ) : null}
      {C.clubs && C.clubs.length ? (
        <>
          <h3 className="mt-3 font-semibold text-slate-100">Clubs dirigés</h3>
          {C.clubs.map((c, k) => (
            <div key={k} className="flex justify-between border-t border-slate-800 py-1.5 text-sm">
              <span>{c.name}</span>
              <span className="text-xs text-slate-400">
                {c.from}–{c.to || "aujourd'hui"}
              </span>
            </div>
          ))}
        </>
      ) : null}
      <p className="mt-2 text-xs text-slate-400">
        La réputation monte quand l'équipe fait mieux que son rang attendu ({S.expRank || '?'}e cette saison) et atteint
        ses objectifs. Elle attire les offres des meilleures équipes.
      </p>
    </Card>
  );
}
function Image() {
  const L = imageLabel();
  const rows = Object.keys(IMAGE_AXES)
    .map(k => ({ k, lbl: IMAGE_AXES[k].lbl, v: Math.round(S.image[k]) }))
    .sort((a, b) => b.v - a.v);
  return (
    <Card title={`🪪 Image de l'équipe : ${L.lbl}`}>
      <details className="mb-1 text-xs text-slate-400">
        <summary className="cursor-pointer py-1">Explications</summary>
        Elle se construit avec vos résultats (victoires, classements, maillots, échappées, jeunes lancés) et s'estompe
        en partie chaque hiver. Les coureurs du même profil signent plus volontiers et demandent un peu moins ; une
        identité forte rapporte jusqu'à 8 % de plus à la renégociation du sponsor.
      </details>
      {rows.map(x => (
        <div
          key={x.k}
          className={
            'flex items-center gap-2 border-t border-slate-800 py-1.5 text-sm ' + (x.k === L.k ? 'bg-pink-500/10' : '')
          }
        >
          <span className="flex-1">{x.lbl}</span>
          <Bar v={x.v} tone="b" />
          <span className="w-8 text-right tabular-nums">{x.v}</span>
        </div>
      ))}
    </Card>
  );
}
export function Office() {
  return (
    <div className="space-y-3">
      <Sponsor />
      <Finances />
      {discoOpen('staff') ? <Staff /> : null}
      <History />
      <Assistant />
      {discoOpen('equip') ? <Equipment /> : null}
      <Career />
      <Image />
    </div>
  );
}
