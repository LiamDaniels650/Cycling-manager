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
        Réponse avant la semaine {B.exp + 1}. Une contre-offre (+15 %) peut le faire renoncer.
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
// Deux coureurs veulent être leader à la même course : à trancher.
function RivalsAsk() {
  const q = S.lockAsk;
  const a = q && S.riders[q.a],
    b = q && S.riders[q.b],
    c = q && S.cal.find(c => c.key === q.key);
  if (!a || !b || !c) return null;
  return (
    <div className="mb-3 rounded-xl bg-rose-400/10 p-2.5 text-sm text-slate-100 ring-1 ring-rose-300/40">
      ⚔️ <RiderLink r={a} /> et <RiderLink r={b} /> veulent tous deux être leader à <b>{c.name}</b> (semaine {c.w}).
      <div className="mt-1 text-xs text-slate-400">
        Sans réponse avant la semaine {q.exp + 1}, l'adjoint annonce une co-direction.
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Btn onClick={() => doLocker(lockerAnswer, 'a')}>{riderName(a)}</Btn>
        <Btn onClick={() => doLocker(lockerAnswer, 'b')}>{riderName(b)}</Btn>
        <Btn onClick={() => doLocker(lockerAnswer, 'co')}>Co-leaders</Btn>
        <Btn onClick={() => doLocker(lockerAnswer, 'route')}>La route décidera</Btn>
      </div>
    </div>
  );
}
// Le vestiaire : ambiance, confiance, capitaine, réunions, promesses, tensions, parrainages.
export function Locker() {
  const L = lockerState();
  const ready = meetReady();
  const tone = v => (v >= 65 ? 'text-emerald-300' : v >= 45 ? 'text-slate-100' : 'text-rose-300');
  const nm = r => <RiderLink r={r} />;
  return (
    <Card title="🚿 Le vestiaire">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-800/70 p-2">
          <div className={'text-2xl font-bold tabular-nums ' + tone(L.mood)}>{L.mood}</div>
          <div className="text-xs text-slate-400">ambiance (moral moyen)</div>
        </div>
        <div className="rounded-lg bg-slate-800/70 p-2">
          <div className={'text-2xl font-bold tabular-nums ' + tone(L.trust)}>{L.trust}</div>
          <div className="text-xs text-slate-400">confiance en votre parole</div>
        </div>
        <div className="rounded-lg bg-slate-800/70 p-2">
          <div className="truncate text-sm font-semibold">{L.captain ? riderName(L.captain) : '—'}</div>
          <div className="text-xs text-slate-400">
            🧭 capitaine{L.captain ? ` (leadership ${leadOf(L.captain)})` : ''}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <b className="text-sm">Réunion d'équipe</b>{' '}
        <span className="text-xs text-slate-400">
          {ready ? '(une toutes les quatre semaines)' : '(déjà réunis récemment)'}
        </span>
        <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {Object.entries(MEETS).map(([k, m]) => (
            <Btn key={k} disabled={!ready} title={m.d} onClick={() => doLocker(teamMeeting, k)}>
              {m.lbl}
            </Btn>
          ))}
        </div>
        <ul className="mt-1 text-xs text-slate-400">
          {Object.values(MEETS).map(m => (
            <li key={m.lbl}>
              <b className="text-slate-300">{m.lbl}</b> : {m.d}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <b>🤞 Promesses de la saison</b>
          {L.proms.length ? (
            L.proms.map((p, i) => {
              const c = S.cal.find(c => c.key === p.key);
              const r = S.riders[p.id];
              return r ? (
                <div key={i} className="text-xs">
                  {nm(r)} leader à {c ? c.name : p.key}{' '}
                  {p.done ? (p.ok ? '✅' : p.ok === false ? '💔' : '🩹') : `⏳ sem. ${c ? c.w : '?'}`}
                </div>
              ) : null;
            })
          ) : (
            <div className="text-xs text-slate-400">Aucune (fiche d'un coureur → lui promettre une course).</div>
          )}
        </div>
        <div>
          <b>😟 Frustrés</b>
          {L.frustrated.length ? (
            L.frustrated.slice(0, 6).map(r => (
              <div key={r.id} className="text-xs">
                {nm(r)} <span className="text-rose-300">{Math.round(r.moral)}</span>{' '}
                <span className="text-slate-400">{lockerWhy(r)}</span>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-400">Personne.</div>
          )}
        </div>
        <div>
          <b>⚡ Tensions</b>
          {L.tensions.length ? (
            L.tensions.slice(0, 5).map(([a, b, v]) => (
              <div key={a.id + '-' + b.id} className="flex items-center gap-1 text-xs">
                <span className="flex-1">
                  {nm(a)} ↔ {nm(b)} <span className="text-rose-300">{v}</span>
                </span>
                <button
                  type="button"
                  className="rounded bg-slate-800 px-2 py-1 text-xs"
                  onClick={() => doMediate(a.id, b.id)}
                >
                  Réunir
                </button>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-400">Aucune tension forte.</div>
          )}
        </div>
        <div>
          <b>🤝 Complicités et 🎓 parrainages</b>
          {L.friends.slice(0, 4).map(([a, b, v]) => (
            <div key={a.id + '-' + b.id} className="text-xs">
              {nm(a)} & {nm(b)} <span className="text-emerald-300">+{v}</span>
            </div>
          ))}
          {L.mentors.map(([y, m]) => (
            <div key={y.id} className="text-xs">
              🎓 {nm(m)} → {nm(y)}
            </div>
          ))}
          {!L.friends.length && !L.mentors.length ? (
            <div className="text-xs text-slate-400">Parrainage : fiche d'un coureur de 24 ans et moins.</div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
// Antidopage : contrôles de la saison, manquements à la localisation, suspensions, cellule antidopage.
export function DopeCard() {
  const D = dopeState();
  return (
    <Card title="Antidopage">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-slate-300">
          {D.tests} contrôle{D.tests > 1 ? 's' : ''} inopiné{D.tests > 1 ? 's' : ''} cette saison, tous négatifs.
        </span>
        <Btn onClick={() => doLocker(setWhOfficer, !S.whOff)}>
          {S.whOff
            ? 'Supprimer la cellule antidopage'
            : `Créer une cellule antidopage (${fmtMoney(WH_COST)} par saison)`}
        </Btn>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Chaque coureur déclare où il se trouve chaque jour. Trois contrôles manqués en douze mois valent six mois de
        suspension. La cellule suit les déclarations au jour le jour (trois fois moins de manquements) et défend le
        coureur en cas de contamination. Aucune triche n'est possible dans le jeu.
      </p>
      {D.watch.length ? (
        <div className="mt-2">
          {D.watch.map(({ r, n }) => (
            <div key={r.id} className="flex justify-between border-b border-slate-800 py-1.5 text-sm">
              <RiderLink r={r} />
              <span className={n >= 2 ? 'text-rose-300' : 'text-slate-300'}>
                {n} contrôle{n > 1 ? 's' : ''} manqué{n > 1 ? 's' : ''} en douze mois
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {D.susp.map(r => (
        <div key={r.id} className="mt-1 text-sm text-rose-300">
          <RiderLink r={r} /> suspendu encore {r.injury} semaine{r.injury > 1 ? 's' : ''} ({r.inj.why})
        </div>
      ))}
    </Card>
  );
}
// Périodisation de l'effectif et infirmerie.
export function PrepCard() {
  const rs = myRiders().filter(r => !r.aca);
  const hurt = rs.filter(r => r.injury > 0);
  return (
    <Card title="📅 Préparation physique">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Btn onClick={() => doLocker(periAutoAll)}>📅 Plans auto vers les objectifs</Btn>
        <span className="text-xs text-slate-400">
          {Object.entries(PERI).map(([k, p]) => (
            <span key={k} className="mr-2 whitespace-nowrap">
              <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: p.col }} />
              {p.lbl}
            </span>
          ))}
          <span className="whitespace-nowrap">
            <i className="mr-1 inline-block h-2.5 w-0.5 bg-yellow-300 align-middle" />
            objectif
          </span>
        </span>
      </div>
      <div className="space-y-1">
        {rs.map(r => (
          <div key={r.id} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 truncate">
              <RiderLink r={r} />
            </span>
            <PeriStrip r={r} h={10} />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Foncier puis intensité avant l'affûtage : le pic de forme est plus haut le jour J (jusqu'à +5). Plans à
        construire depuis la fiche d'un coureur, ou automatiquement vers leurs objectifs.
      </p>
      <h3 className="mt-3 text-sm font-semibold">🏥 Infirmerie</h3>
      {hurt.length ? (
        hurt.map(r => (
          <div key={r.id} className="flex items-center gap-2 text-xs">
            <span className="flex-1">
              {(INJ[r.inj && r.inj.k] || INJ.plaies).ic} <RiderLink r={r} /> ·{' '}
              {(INJ[r.inj && r.inj.k] || { lbl: 'indisponible' }).lbl} · encore {r.injury} sem.
              {r.inj && r.inj.early ? ' (reprise avancée)' : ''}
            </span>
            {r.inj && !r.inj.early && r.injury >= 2 ? (
              <button
                type="button"
                className="rounded bg-slate-800 px-2 py-1"
                onClick={() => doLocker(earlyReturn, r.id)}
              >
                ⏩ Reprise anticipée
              </button>
            ) : null}
          </div>
        ))
      ) : (
        <p className="text-xs text-slate-400">Personne à l'infirmerie.</p>
      )}
    </Card>
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
// Bande de la saison d'un coureur : blocs du plan, courses objectifs, semaine en cours.
export function PeriStrip({ r, h = 14 }) {
  const P = periOf(r);
  const W = Math.max(...S.cal.map(c => c.w + Math.ceil(c.stagesSpec.length / 7)), 42);
  const x = w => ((w - 1) / W) * 100;
  return (
    <div className="relative w-full overflow-hidden rounded bg-slate-800" style={{ height: h }}>
      {(P ? P.blocks : []).map((b, i) => (
        <div
          key={i}
          title={`${PERI[b.k].lbl} · semaines ${b.w0} à ${b.w1}`}
          className="absolute top-0 h-full"
          style={{
            left: x(b.w0) + '%',
            width: ((b.w1 - b.w0 + 1) / W) * 100 + '%',
            background: PERI[b.k].col,
            opacity: 0.85,
          }}
        />
      ))}
      {(P ? P.targets : []).map(k => {
        const c = S.cal.find(c => c.key === k);
        return c ? (
          <div
            key={k}
            title={c.name}
            className="absolute top-0 h-full w-0.5 bg-yellow-300"
            style={{ left: x(c.w) + '%' }}
          />
        ) : null;
      })}
      <div className="absolute top-0 h-full w-0.5 bg-white" style={{ left: x(S.week) + '%' }} title="cette semaine" />
    </div>
  );
}
export function TrainSelect({ r }) {
  const b = periBlockNow(r);
  if (b)
    return (
      <span className="text-xs text-slate-300" title="Plan de saison : voir la fiche du coureur">
        📅 {PERI[b.k].lbl}
      </span>
    );
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
        <RivalsAsk />
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
            [
              'Vestiaire',
              r =>
                CHARS[charOf(r)].ic +
                (S.captain === r.id ? ' 🧭' : '') +
                (promsOn().some(p => p.id === r.id) ? ' 🤞' : ''),
            ],
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
