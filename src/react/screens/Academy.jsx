// Académie (portage fidèle de viewAcademy, acaMainHTML, acaEspHTML, acaYouthHTML et acaAlumniHTML) : espoirs,
// charge, mentors, tests physiques, stagiaires, calendrier et résultats espoirs, vivier, anciens.
import { Card, Btn, Badge, Bar, Stars, RiderLink, Select, Tabs, Pills, Html, H2 } from '../ui.jsx';
import { RiderList } from './Riders.jsx';
import { TrainSelect } from './Team.jsx';
import { StageIcons } from './Bits.jsx';

function Espoir({ r, ments, stagOpen }) {
  const L = youthLoad(r),
    M = youthLoadMax(r),
    m = mentorOf(r);
  return (
    <div className="rounded-xl bg-slate-800/60 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm">
          <RiderLink r={r} />{' '}
          <span className="text-xs text-slate-400">
            {r.age} ans · {ARCH[r.arch].lbl}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <b className="text-slate-50">{svOv(r)}</b>{' '}
          <span className="text-xs">
            <Stars v={potEst(r)} />
          </span>
        </span>
      </div>
      <div className="mt-1 flex flex-wrap">
        {r.ptest ? <Badge>maturité {DEV_LBL[r.ptest.dev] || '?'}</Badge> : null}
        {isStag(r) ? <Badge tone="sky">stagiaire</Badge> : null}
        {r.approach != null ? <Badge tone="red">courtisé par {teamShort(r.approach)}</Badge> : null}
        {r.injury > 0 ? <Badge tone="red">blessé {r.injury} sem.</Badge> : null}
        {r.age >= 22 ? <Badge tone="red">dernière saison</Badge> : null}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-300">
        <span>
          Forme <Bar v={r.forme} />
        </span>
        <span>
          Moral <Bar v={r.moral} />
        </span>
        <span>
          Charge{' '}
          <b className={L > M ? 'text-rose-400' : 'text-slate-100'}>
            {L}/{M} j
          </b>
        </span>
        <span>
          Mentor <b className="text-slate-100">{m ? riderName(m) : '—'}</b>
        </span>
        <span className="col-span-2">
          Potentiel connu à <b className="text-slate-100">{Math.round(potKnow(r))} %</b>
        </span>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer py-1 text-sm text-sky-300">Gérer</summary>
        <div className="mt-1 space-y-2 text-sm text-slate-200">
          <label className="flex items-center justify-between gap-2">
            Courses espoirs{' '}
            <Select
              value={r.espProg || 'complet'}
              onChange={v => acaSet('prog', r.id, v)}
              options={Object.entries(ESP_PROG)}
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            Mentor{' '}
            <Select
              value={m ? m.id : ''}
              onChange={v => acaSet('mentor', r.id, v)}
              options={[['', '—'], ...ments.map(Mt => [Mt.id, `${riderName(Mt)} (${Mt.age} ans)`])]}
            />
          </label>
          <div className="flex items-center justify-between gap-2">
            Entraînement <TrainSelect r={r} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Btn disabled={!!(r.ptest && r.ptest.s === S.season)} onClick={() => acaSet('test', r.id)}>
              🧪 Tests ({fmtMoney(TEST_COST)})
            </Btn>
            {stagOpen && r.age >= 19 ? (
              <Btn onClick={() => acaSet('stag', r.id, isStag(r) ? 0 : 1)}>
                {isStag(r) ? 'Fin de stage' : 'Stagiaire chez les pros'}
              </Btn>
            ) : null}
            {r.age >= 18 ? (
              <Btn primary onClick={() => promote(r.id)}>
                Passer pro
              </Btn>
            ) : null}
            <Btn danger onClick={() => acaRelease(r.id)}>
              Libérer
            </Btn>
          </div>
        </div>
      </details>
    </div>
  );
}
function Main() {
  const rep = acaRep();
  const next = ESP_CAL.find(e => e.w >= S.week);
  const nStag = S.academy.filter(id => isStag(S.riders[id])).length;
  const stagOpen = S.week >= STAG_WEEK;
  const ments = mentorCands();
  const tested = acaRiders().filter(r => r.ptest);
  return (
    <Card>
      <H2>Académie</H2>
      <Btn className="mb-2 w-full" onClick={() => doAsst('academy')}>
        🧑‍💼 Académie auto
      </Btn>
      <div className="flex flex-wrap justify-between gap-2 text-sm text-slate-300">
        <span>
          Réputation : <b className="text-slate-100">{acaRepLabel(rep)}</b> <Bar v={rep} />
        </span>
        <span>
          Stagiaires {nStag}/{STAG_MAX}
          {stagOpen ? '' : ` (dès la semaine ${STAG_WEEK})`}
        </span>
      </div>
      {next ? (
        <p className="mt-1 text-sm text-slate-300">
          Prochaine course espoirs : <b className="text-slate-100">{next.name}</b> (semaine {next.w}
          {next.st.length > 1 ? ', ' + next.st.length + ' étapes' : ''}).
        </p>
      ) : null}
      <details className="mt-1 text-xs text-slate-400">
        <summary className="cursor-pointer py-1">Explications</summary>
        Vos espoirs courent le calendrier espoirs (simulé par le moteur de course), progressent selon leur maturité
        (précoce, normale, tardive) et peuvent devenir stagiaires chez les pros à partir d'août. Un mentor les fait
        progresser plus vite. Attention au surmenage : au-delà de la charge conseillée pour leur âge, leur potentiel
        peut s'éroder. Les équipes pros approchent ceux qui brillent : passez-les pros avant 23 ans, ou avant qu'on ne
        vous les prenne.
      </details>
      {!S.academy.length ? (
        <p className="mt-2 text-slate-400">Aucun espoir. Recrutez dans le vivier.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {acaRiders()
            .sort((a, b) => potEst(b) - potEst(a))
            .map(r => (
              <Espoir key={r.id} r={r} ments={ments} stagOpen={stagOpen} />
            ))}
        </div>
      )}
      {tested.length ? (
        <div className="mt-3 overflow-x-auto">
          <h3 className="mb-1 font-semibold text-slate-100">Tests physiques</h3>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-400">
              <tr>
                {['Coureur', 'Saison', '5 s', '1 min', '5 min', '20 min', 'VO2max', 'Maturité'].map(h => (
                  <th key={h} className="px-1 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tested.map(r => (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="px-1 py-1.5">
                    <RiderLink r={r} />
                  </td>
                  <td className="px-1">{r.ptest.s}</td>
                  <td className="px-1">{fmtDec(r.ptest.p5, 1)}</td>
                  <td className="px-1">{fmtDec(r.ptest.p60, 1)}</td>
                  <td className="px-1">{fmtDec(r.ptest.p300, 2)}</td>
                  <td className="px-1">{fmtDec(r.ptest.p1200, 2)}</td>
                  <td className="px-1">{r.ptest.vo2}</td>
                  <td className="px-1">{DEV_LBL[r.ptest.dev] || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-slate-400">
            Puissances en W/kg. Repères chez les pros : 20 min ≈ 5,8-6,4 W/kg pour un grimpeur de haut niveau, 5 s ≈
            19-22 W/kg pour un sprinteur.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
const TIER = {
  club: 'espoirs · club',
  big: 'espoirs · course par étapes',
  nat: 'espoirs · championnats nationaux',
  tour: 'espoirs · sélections nationales',
  monde: 'espoirs · sélections nationales',
  jun: 'juniors',
  junmonde: 'juniors · sélections nationales',
};
function Esp() {
  const hist = (S.espHist || []).filter(e => e.s === S.season);
  return (
    <>
      <Card title={`Calendrier juniors et espoirs ${S.season}`}>
        {ESP_CAL.map(e => (
          <div
            key={e.w + e.name}
            className={'flex gap-3 border-t border-slate-800 py-2 text-sm ' + (e.w < S.week ? 'opacity-50' : '')}
          >
            <span className="w-6 shrink-0 tabular-nums text-slate-400">{e.w}</span>
            <div className="min-w-0">
              <b className="text-slate-100">{e.name}</b> <span className="text-xs text-slate-400">{TIER[e.tier]}</span>
              <div>
                <StageIcons spec={e.st} />
              </div>
            </div>
          </div>
        ))}
        <details className="mt-1 text-xs text-slate-400">
          <summary className="cursor-pointer py-1">Explications</summary>
          Les 17-18 ans courent chez les juniors, les 19-22 ans chez les espoirs. Les jeunes de l'académie courent sous
          vos couleurs, sauf aux championnats et sur les épreuves par sélections nationales, où seuls les meilleurs de
          chaque pays sont retenus. Les recruteurs observent les jeunes du vivier à chaque course.
        </details>
      </Card>
      <Card title="Résultats">
        {hist.length ? (
          <div className="space-y-2">
            {hist.map((e, k) => (
              <div key={k} className="rounded-xl bg-slate-800/60 p-2.5 text-sm">
                <div className="flex justify-between gap-2">
                  <b className="text-slate-100">{e.name}</b>
                  <span className="text-xs text-slate-400">sem. {e.w}</span>
                </div>
                <div className="text-xs text-slate-300">Podium : {e.top}</div>
                <div className="text-xs text-slate-300">Vos espoirs : {e.mine.join(', ') || '—'}</div>
                {e.notable.length ? <div className="text-xs text-slate-400">{e.notable.join(' · ')}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400">Aucune course espoirs disputée cette saison.</p>
        )}
      </Card>
    </>
  );
}
function Youth() {
  const ys = S.youth.map(id => S.riders[id]).filter(Boolean);
  return (
    <Card title="Vivier des jeunes">
      <details className="mb-2 text-xs text-slate-400">
        <summary className="cursor-pointer py-1">Explications</summary>
        Jeunes coureurs repérés (17-20 ans). Les valeurs sont des <b>estimations</b> dont la précision dépend de vos
        recruteurs (niveau {S.staff.scout}), du temps passé à les observer (👁 suivi) et des courses espoirs. Les
        équipes pros signent les plus en vue en cours de saison ; les meilleurs talents peuvent refuser une académie peu
        réputée.
      </details>
      <RiderList
        rs={ys}
        cols={[
          ['Connaiss.', r => Math.round(knowOf(r)) + '%'],
          ['Espoirs', r => (r.espPts ? r.espPts + ' pts' : '—')],
          ['', r => <Pills items={youthBadges(r)} />],
          [
            '',
            r =>
              r.preAI != null ? (
                <Badge tone="red">pré-contrat {teamShort(r.preAI)}</Badge>
              ) : (
                <span className="flex gap-1">
                  <Btn className="min-h-10" title="Recruter à l'académie" onClick={() => acaJoin(r.id)}>
                    🎓
                  </Btn>
                  <Btn className="min-h-10" title="Suivre" onClick={() => (watch(r.id), render())}>
                    {S.watch.includes(r.id) ? '👁✓' : '👁'}
                  </Btn>
                </span>
              ),
          ],
        ]}
      />
    </Card>
  );
}
function Alumni() {
  const L = alumniList();
  return (
    <Card title="Anciens de l'académie">
      {L.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-400">
              <tr>
                {['Coureur', 'Passé pro', 'Équipe', 'Âge', 'Gl.', 'Victoires pros'].map(h => (
                  <th key={h} className="px-1 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {L.map(a => (
                <tr key={a.r.id} className="border-t border-slate-800">
                  <td className="px-1 py-1.5">
                    <RiderLink r={a.r} />
                  </td>
                  <td className="px-1">{a.s}</td>
                  <td className="px-1">{a.r.retired ? 'retraité' : teamShort(a.r.team)}</td>
                  <td className="px-1">{a.r.age}</td>
                  <td className="px-1">{svOv(a.r)}</td>
                  <td className="px-1">{a.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-slate-400">Aucun ancien pour l’instant : passez vos meilleurs espoirs professionnels.</p>
      )}
      <p className="mt-1 text-xs text-slate-400">Les victoires de vos anciens font la réputation de l'académie.</p>
    </Card>
  );
}
export function Academy() {
  const tab = UI.acaTab;
  return (
    <div className="space-y-3">
      <Tabs
        items={[
          ['aca', `Mon académie (${S.academy.length}/${ACA_MAX})`],
          ['esp', 'Courses espoirs'],
          ['youth', `Vivier (${S.youth.length})`],
          ['alum', 'Anciens'],
        ]}
        value={tab}
        onChange={k => ((UI.acaTab = k), render())}
      />
      {tab === 'aca' ? <Main /> : tab === 'esp' ? <Esp /> : tab === 'alum' ? <Alumni /> : <Youth />}
    </div>
  );
}
