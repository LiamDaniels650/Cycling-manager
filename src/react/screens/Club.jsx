// Gestion à long terme : réseau de recrutement (Marché › Recrutement), installations et direction (Gestion),
// monde du vélo (Aujourd'hui › Le monde : fil d'actualité, rivalité, classement des directeurs), caractère caché
// d'un coureur (fiche coureur).
import { Card, Btn, Badge, RiderLink, Select, Stars } from '../ui.jsx';

const act = f => ((UI.flash = f()), save(), render());

function Gauge({ v, max = 100, tone = 'bg-sky-400' }) {
  return (
    <span className="inline-block h-2 w-full overflow-hidden rounded-full bg-slate-800 align-middle">
      <span className={'block h-full ' + tone} style={{ width: Math.max(0, Math.min(100, (v / max) * 100)) + '%' }} />
    </span>
  );
}
const REC_CLS = {
  signer: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/40',
  suivre: 'bg-amber-500/15 text-amber-200 ring-amber-500/40',
  non: 'bg-slate-800 text-slate-400 ring-slate-700',
};
const KIND_LBL = { free: 'libre', pre: 'fin de contrat', transfer: 'sous contrat' };

// --- Recrutement ---
export function Scouting() {
  scmInit();
  const F = (UI.scmF = UI.scmF || { zone: 'monde', arch: '', age: 'tous', sal: '0' });
  const set = (k, v) => ((F[k] = v), render());
  const C = S.scm;
  const open = UI.scmOpen != null ? UI.scmOpen : C.rep[0] && C.rep[0].id;
  const R0 = C.rep.find(r => r.id === open);
  if (R0 && !R0.read) R0.read = true;
  return (
    <div className="space-y-3">
      <Card title="Envoyer un recruteur">
        <p className="mb-3 text-sm text-slate-300">
          Décrivez le coureur cherché : vos recruteurs parcourent la zone pendant {scmWeeks()} semaines et reviennent avec
          les cinq meilleurs profils, une recommandation pour chacun et des estimations plus justes. {scmMax()} mission
          {scmMax() > 1 ? 's' : ''} à la fois avec votre chef recruteur (niveau {S.staff.scout}) ; frais {fmtMoney(SCM_COST)}.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs text-slate-400">
            Zone
            <Select className="mt-1 w-full" value={F.zone} onChange={v => set('zone', v)} options={Object.entries(SCM_ZONES).map(([k, z]) => [k, z.lbl])} />
          </label>
          <label className="text-xs text-slate-400">
            Profil
            <Select className="mt-1 w-full" value={F.arch} onChange={v => set('arch', v)} options={[['', 'Tous profils'], ...Object.entries(ARCH).map(([k, a]) => [k, a.lbl])]} />
          </label>
          <label className="text-xs text-slate-400">
            Âge
            <Select className="mt-1 w-full" value={F.age} onChange={v => set('age', v)} options={Object.entries(SCM_AGES).map(([k, a]) => [k, a.lbl])} />
          </label>
          <label className="text-xs text-slate-400">
            Salaire maximal
            <Select
              className="mt-1 w-full"
              value={F.sal}
              onChange={v => set('sal', v)}
              options={[['0', 'Sans limite'], ...[60, 100, 150, 250, 400].map(v => [String(v), `${fmtMoney(v)}/an`])]}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Btn primary disabled={C.m.length >= scmMax() || S.budget < SCM_COST} onClick={() => act(() => scmStart(F.zone, F.arch, F.age, +F.sal))}>
            Lancer la mission
          </Btn>
          {C.m.map(m => (
            <span key={m.id} className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300">
              🔭 {scmLabel(m)} · encore {m.left} sem.
              <button type="button" className="text-slate-500 underline" onClick={() => act(() => scmCancel(m.id))}>
                annuler
              </button>
            </span>
          ))}
        </div>
      </Card>
      {C.rep.length ? (
        <Card title="Rapports">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {C.rep.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => ((UI.scmOpen = r.id), render())}
                className={
                  'min-h-9 rounded-md px-2.5 text-left text-xs ring-1 ' +
                  (r.id === open ? 'bg-slate-700 text-slate-50 ring-sky-400' : 'bg-slate-800 text-slate-300 ring-slate-700')
                }
              >
                {!r.read ? <span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-400" /> : null}
                {r.s} · S{r.w} — {r.lbl.split(' · ').slice(0, 2).join(' · ')}
              </button>
            ))}
          </div>
          {R0 ? <Report R0={R0} /> : null}
        </Card>
      ) : null}
    </div>
  );
}
function Report({ R0 }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-300">
          {R0.lbl} · {R0.n} coureur{R0.n > 1 ? 's' : ''} observé{R0.n > 1 ? 's' : ''}
        </div>
        <Btn onClick={() => act(() => scmWatchAll(R0.id))}>👁 Suivre les recommandés</Btn>
      </div>
      {R0.items.length ? null : <p className="text-sm text-slate-400">Personne ne correspond à la demande : élargissez la recherche.</p>}
      <div className="space-y-2">
        {R0.items.map(x => {
          const r = S.riders[x.id];
          if (!r) return null;
          const T = teamOf(r);
          const w = S.watch.includes(r.id);
          return (
            <div key={x.id} className="rounded-md bg-slate-800/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className={'mr-2 rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ' + REC_CLS[x.rec]}>{SCM_REC[x.rec].lbl}</span>
                  <RiderLink r={r} /> <span className="text-xs text-slate-400">
                    {r.age} ans · {ARCH[r.arch].lbl} · {T ? T.short : 'libre'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="tabular-nums text-slate-100">~{shownOv(r)}</span>
                  <Stars v={potEst(r)} />
                </div>
              </div>
              <div className="mt-1 text-xs text-slate-300">
                Points forts : {x.fort.join(', ')} · point faible : {x.faible}
                {x.mental ? <> · <b className="text-sky-200">{x.mental}</b></> : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span>
                  {KIND_LBL[x.kind] || x.kind} · demande ≈ {fmtMoney(x.dem)}/an{x.fee ? ` · indemnité ≈ ${fmtMoney(x.fee)}` : ''}
                  {x.cher ? <span className="text-amber-300"> · cher pour votre budget</span> : null}
                </span>
                <span className="flex gap-1.5">
                  <Btn className="!min-h-8 !px-2.5 !text-xs" active={w} onClick={() => act(() => toggleWatch(r.id) || (w ? 'Retiré du suivi.' : 'Ajouté au suivi.'))}>
                    {w ? '👁 Suivi' : '👁 Suivre'}
                  </Btn>
                  <Btn className="!min-h-8 !px-2.5 !text-xs" onClick={() => ((UI.modal = { type: 'rider', id: r.id }), renderModal())}>
                    Fiche
                  </Btn>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Installations ---
export function Facilities() {
  facInit();
  const b = S.fac.b;
  return (
    <Card title="Installations" right={<span className="text-sm text-slate-400">entretien {fmtMoney(facUpkeep())}/saison</span>}>
      <p className="mb-2 text-sm text-slate-300">
        Des chantiers qui coûtent cher et prennent des mois, pour un avantage durable. Un seul à la fois ; chaque niveau se
        paie ensuite en entretien à la fin de chaque saison. La direction peut en financer la moitié (Gestion › Direction).
      </p>
      {b ? (
        <div className="mb-3 rounded-md bg-slate-800/60 p-3 text-sm">
          🏗️ En travaux : <b>{FAC[b.k].lbl}</b> ({FAC_LVL[b.l].toLowerCase()}) · encore {b.wk - b.n} semaine{b.wk - b.n > 1 ? 's' : ''}
          <div className="mt-2">
            <Gauge v={facProgress() * 100} tone="bg-amber-400" />
          </div>
        </div>
      ) : null}
      {Object.keys(FAC).map(k => {
        const F = FAC[k];
        const l = facL(k);
        const c = facCost(k);
        return (
          <div key={k} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 py-3">
            <div className="min-w-0 flex-1">
              <b className="font-display text-lg text-slate-50">
                {F.ic} {F.lbl}
              </b>{' '}
              <span className="font-display tracking-wider text-sky-400">
                {'●'.repeat(l)}
                <span className="text-slate-700">{'●'.repeat(3 - l)}</span>
              </span>
              <div className="text-xs text-slate-400">{F.d}</div>
            </div>
            {c ? (
              <Btn disabled={!!b || S.budget < c.cost} onClick={() => act(() => facBuild(k))}>
                {l ? 'Agrandir' : 'Construire'} · {fmtMoney(c.cost)}
                {c.help ? ` (½ payée)` : ''} · {c.wk} sem.
              </Btn>
            ) : (
              <Badge>niveau maximal</Badge>
            )}
          </div>
        );
      })}
    </Card>
  );
}

// --- Direction ---
export function Board() {
  const B = boardInit();
  const st = boardStatus();
  const can = boardCanAsk();
  const [fk, setFk] = [UI.boardFac || 'perf', v => ((UI.boardFac = v), render())];
  return (
    <div className="space-y-3">
      <Card title="La direction">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs text-slate-400">Président</div>
            <b className="font-display text-xl text-slate-50">{boardName()}</b>{' '}
            <span className="text-sm text-slate-400">· {BOARD_CHAR[B.ch].lbl.toLowerCase()}</span>
            <div className="text-xs text-slate-400">{BOARD_CHAR[B.ch].d}</div>
          </div>
          <div className="w-48">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Confiance</span>
              <b className="text-slate-100">{B.t}/100</b>
            </div>
            <Gauge v={B.t} tone={B.t >= 60 ? 'bg-emerald-400' : B.t >= 35 ? 'bg-amber-300' : 'bg-rose-500'} />
          </div>
        </div>
      </Card>
      {B.v ? (
        <Card title={`Projet : ${VISIONS[B.v].lbl}`} right={<span className="text-sm text-slate-400">saison {B.cyc.res.length + 1}/3</span>}>
          <p className="text-sm text-slate-300">{VISIONS[B.v].d}</p>
          {st ? (
            <div className="mt-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Cette saison : {st.txt}</span>
                <b className={st.ok ? 'text-emerald-300' : 'text-amber-300'}>{st.ok ? 'atteint' : 'en cours'}</b>
              </div>
              <div className="mt-1">
                <Gauge v={st.pct * 100} tone={st.ok ? 'bg-emerald-400' : 'bg-amber-300'} />
              </div>
            </div>
          ) : null}
          <div className="mt-3 flex gap-1.5 text-xs">
            {[0, 1, 2].map(i => {
              const r = B.cyc.res[i];
              return (
                <span key={i} className={'rounded px-2 py-1 ring-1 ' + (r === true ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/40' : r === false ? 'bg-rose-500/15 text-rose-200 ring-rose-500/40' : 'bg-slate-800 text-slate-400 ring-slate-700')}>
                  {B.cyc.s0 + i} {r === true ? '✓' : r === false ? '✗' : '…'}
                </span>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Projet réussi : la confiance du président monte. Fin de cycle avec deux saisons réussies ou plus : une prime de
            150 à 300 k€. Une confiance très basse inquiète le sponsor.
          </p>
        </Card>
      ) : (
        <Card title="Choisir le projet des trois prochaines saisons" tone="action">
          <div className="space-y-2">
            {(B.prop || Object.keys(VISIONS).slice(0, 3)).map(k => (
              <div key={k} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-800/60 p-3">
                <div className="min-w-0 flex-1">
                  <b className="text-slate-50">{VISIONS[k].lbl}</b>
                  <div className="text-xs text-slate-400">{VISIONS[k].d}</div>
                </div>
                <Btn primary onClick={() => act(() => boardChoose(k))}>
                  Proposer ce projet
                </Btn>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card title="Demander une réunion">
        {can ? null : <p className="mb-2 text-sm text-amber-300">Le président vous a reçu il y a peu : une réunion toutes les {BOARD_ASK_GAP} semaines.</p>}
        {Object.entries(BOARD_ASKS).map(([k, A]) => {
          const p = boardChance(k);
          return (
            <div key={k} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 py-3">
              <div className="min-w-0 flex-1">
                <b className="text-slate-50">{A.lbl}</b>
                <div className="text-xs text-slate-400">
                  {A.d}
                  {k === 'mercato' ? ` Environ ${fmtMoney(boardAmount())}.` : ''} {k !== 'vision' ? `Chance d'accord : ${Math.round(p * 100)} %. ` : ''}Coût en
                  confiance si accord : {A.cost}.
                </div>
                {k === 'fac' ? (
                  <Select className="mt-1" value={fk} onChange={setFk} options={Object.entries(FAC).filter(([kk]) => facL(kk) < 3).map(([kk, F]) => [kk, F.lbl])} />
                ) : null}
                {k === 'fac' && B.fund && B.fund.s === S.season ? (
                  <div className="mt-1 text-xs text-emerald-300">Accord en cours : la moitié de « {FAC[B.fund.k].lbl} » si le chantier est lancé cette saison.</div>
                ) : null}
              </div>
              <Btn disabled={!can || (k === 'vision' && !B.v)} onClick={() => act(() => boardAsk(k, fk))}>
                Demander
              </Btn>
            </div>
          );
        })}
      </Card>
      {B.hist.length ? (
        <Card title="Bilans passés">
          {B.hist.map((h, i) => (
            <div key={i} className="border-t border-slate-800 py-1.5 text-sm text-slate-300">
              {h.s} · {VISIONS[h.v] ? VISIONS[h.v].lbl : h.v} : {h.ok ? '✅' : '❌'} {h.txt}
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}

// --- Le monde du vélo ---
export function World() {
  const cat = UI.newsCat || null;
  const L = newsFeed(80, cat);
  return (
    <div className="space-y-3 xl:grid xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start xl:gap-3 xl:space-y-0">
      <Card title="Le monde du vélo">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {[[null, 'Tout'], ...Object.entries(NEWS_CAT).map(([k, c]) => [k, c.lbl])].map(([k, l]) => (
            <button
              key={l}
              type="button"
              onClick={() => ((UI.newsCat = k), render())}
              className={'min-h-8 rounded-full px-3 text-xs font-semibold ring-1 ' + (cat === k ? 'bg-sky-500 text-slate-950 ring-sky-400' : 'bg-slate-800 text-slate-300 ring-slate-700')}
            >
              {l}
            </button>
          ))}
        </div>
        {L.length ? (
          L.map((e, i) => (
            <div key={i} className={'flex gap-3 border-t border-slate-800 py-2 text-sm ' + (e.my ? 'bg-pink-500/10' : '')}>
              <span className="w-14 shrink-0 text-xs text-slate-500">
                {e.s}
                <br />S{e.w}
              </span>
              <span className="text-slate-200">
                <span className="mr-1">{(NEWS_CAT[e.c] || {}).ic}</span>
                {e.txt}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-400">Rien pour l'instant : l'actualité arrive avec les premières courses.</p>
        )}
      </Card>
      <div className="space-y-3">
        <RivalCard />
        <DsRanking />
      </div>
    </div>
  );
}
export function RivalCard({ compact }) {
  const V = S.rival;
  const T = V && rivalTeam();
  if (!T) return null;
  const P = S.teams[0];
  return (
    <Card title="Rivalité de la saison">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          <b className="text-slate-50">{P.name}</b> <span className="text-slate-500">contre</span> <b className="text-slate-50">{T.name}</b>
          {dsName(T) ? <div className="text-xs text-slate-400">dirigée par {dsName(T)}</div> : null}
        </div>
        <span className="font-display text-3xl font-bold tabular-nums text-slate-50">
          <span className={V.me > V.them ? 'text-emerald-300' : ''}>{V.me}</span>
          <span className="text-slate-600">–</span>
          <span className={V.them > V.me ? 'text-rose-300' : ''}>{V.them}</span>
        </span>
      </div>
      {V.last ? (
        <div className="mt-1 text-xs text-slate-400">
          Dernier duel : {V.last.race}, {V.last.won ? 'gagné' : 'perdu'}.
        </div>
      ) : null}
      {compact ? null : (
        <p className="mt-2 text-xs text-slate-400">
          Un duel chaque fois que vos deux équipes ont un coureur dans les dix premiers. Les duels gagnés soudent le groupe ; le
          bilan de la saison compte pour votre notoriété.
          {(S.rivalHist || []).length ? ` Saisons passées : ${S.rivalHist.slice(0, 4).map(h => `${h.s} ${h.me}-${h.them} (${h.t})`).join(' · ')}.` : ''}
        </p>
      )}
    </Card>
  );
}
function DsRanking() {
  const L = dsRanking();
  return (
    <Card title="Classement des directeurs sportifs">
      {L.length ? (
        <>
          <p className="mb-2 text-xs text-slate-400">
            Ce que chacun tire de son équipe par rapport à ce qu'on en attendait, ses victoires, sa constance. Mis à jour à chaque
            fin de saison.
          </p>
          {L.slice(0, 20).map((x, i) => {
            const d = x.prev ? x.prev - (i + 1) : 0;
            return (
              <div key={x.k} className={'flex items-center gap-2 border-t border-slate-800 py-1.5 text-sm ' + (x.me ? 'bg-pink-500/10 font-semibold' : '')}>
                <span className="w-6 text-right tabular-nums text-slate-400">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-slate-100">
                  {x.me ? 'Vous' : x.k} <span className="text-xs font-normal text-slate-400">· {x.T.short}</span>
                </span>
                <span className={'w-8 text-right text-xs ' + (d > 0 ? 'text-emerald-300' : d < 0 ? 'text-rose-300' : 'text-slate-500')}>
                  {d > 0 ? '▲' + d : d < 0 ? '▼' + -d : '='}
                </span>
                <span className="w-12 text-right tabular-nums text-slate-300">{fmtDec(x.sc, 1)}</span>
              </div>
            );
          })}
        </>
      ) : (
        <p className="text-sm text-slate-400">Premier classement à la fin de la saison.</p>
      )}
    </Card>
  );
}
// --- Caractère caché (fiche coureur) ---
export function MentalRider({ r }) {
  const t = mentalTxt(r);
  return (
    <div className="rounded-md bg-slate-800/60 p-3 text-sm">
      <div className="mb-1 text-xs text-slate-400">Mental</div>
      {t ? (
        <div className="space-y-0.5 text-slate-200">
          <div>🎯 Grands rendez-vous : <b>{t.pres}</b></div>
          <div>📋 Professionnalisme : <b>{t.prof}</b></div>
          {mentalKnown(r) < 2 ? <div className="text-xs text-slate-400">Une première idée seulement : il faudra le voir de plus près.</div> : null}
        </div>
      ) : (
        <div className="text-slate-400">
          Inconnu.{' '}
          {r.team === 0
            ? 'Vous le découvrirez après quelques courses ensemble.'
            : 'Une mission de recrutement ou la liste de suivi vous en apprendra plus.'}
        </div>
      )}
    </div>
  );
}
