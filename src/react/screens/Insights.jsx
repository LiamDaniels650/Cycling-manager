// Repères de saison partagés (portage de wtBriefHTML, wtTableHTML, uciObjectiveHTML, seasonWhyHTML et rivalsChart) :
// licence WorldTour, objectif UCI du sponsor, « pourquoi » des saisons passées, courbe des points des rivaux.
import { Card, Html, Info, Table, Tr, TeamDot } from '../ui.jsx';

const BRIEF = 'mt-2 rounded-xl bg-sky-500/10 px-3 py-2 text-sm text-slate-100 ring-1 ring-sky-400/30';

export function WtBrief() {
  if (!S.wt) return null;
  const rk = wtRanking();
  const k = rk.findIndex(e => e.T.player);
  const me = rk[k];
  const line = rk[WT_N - 1],
    out = rk[WT_N];
  const y = wtYear();
  const status = isWT(0) ? '🪪 Licence WorldTour' : '🪪 ProTeam';
  const end =
    y >= WT_CYCLE
      ? 'attribution des licences à la fin de cette saison'
      : `attribution dans ${WT_CYCLE - y + 1} saisons`;
  let inv = null;
  if (!isWT(0)) {
    const o = wtInviteOdds();
    const pc = v => Math.round(clamp(v, 0, 1) * 100);
    inv = wtTopPro().includes(0)
      ? 'Parmi les deux meilleures ProTeams : invitée d’office partout la saison prochaine.'
      : `Invitations (tirées au début de chaque saison) : Grand Tour ≈${pc(o.gt)} %, grande course ≈${pc(o.cat1)} % — elles montent avec la confiance du sponsor et la notoriété.`;
  }
  return (
    <div className={BRIEF}>
      <b>{status}</b> · cycle {y}/{WT_CYCLE} ({end})
      <br />
      {k < WT_N ? (
        <>
          {k + 1}e du classement sur trois saisons — {out ? `${me.pts - out.pts} pts d'avance sur le ${WT_N + 1}e` : ''}
          .
        </>
      ) : (
        <>
          {k + 1}e du classement sur trois saisons — il manque <b>{line.pts - me.pts} pts</b> pour la {WT_N}e place.
        </>
      )}
      {inv ? (
        <>
          <br />
          {inv}
        </>
      ) : null}
    </div>
  );
}
// Deuxième division : classement ProSeries de la saison (ProTeams), primes, ligne de licence du cycle, palmarès.
export function ProSeries() {
  if (!S.wt) return null;
  const rk = proSeriesRanking();
  const cyc = wtRanking();
  const line = cyc[WT_N - 1];
  const H = (S.proHist || []).slice(-5).reverse();
  return (
    <Card title={`🥈 Division 2 — ProSeries ${S.season}`}>
      <p className="mb-2 text-xs text-slate-400">
        Les équipes sans licence WorldTour courent la ProSeries : les courses de catégorie 2 sont leur terrain (les
        équipes WorldTour n'y viennent qu'une fois sur deux). Classement sur les points UCI de la saison ; primes de{' '}
        {PRO_PRIZE.map(v => fmtMoney(v)).join(', ')} aux trois premières (et +5 de confiance du sponsor pour le
        champion). Monter en WorldTour se joue sur trois saisons : il faut finir au-dessus de la ligne de licence.
      </p>
      <Table>
        {rk.map((e, i) => {
          const c = cyc.findIndex(x => x.T === e.T) + 1;
          return (
            <Tr key={e.T.id} mine={e.T.player}>
              <td>{i + 1}</td>
              <td>
                <TeamDot T={e.T} />
                {e.T.name}
              </td>
              <td className="whitespace-nowrap text-right tabular-nums">{e.pts} pts</td>
              <td className="whitespace-nowrap text-right text-xs text-slate-400">
                cycle : {c}e{line && c > WT_N ? ` (−${line.pts - cyc[c - 1].pts} pts)` : ' ✔'}
              </td>
            </Tr>
          );
        })}
      </Table>
      {H.length ? (
        <div className="mt-2 text-xs text-slate-400">Palmarès : {H.map(h => `${h.s} ${h.names[0]}`).join(' · ')}</div>
      ) : null}
    </Card>
  );
}
export function WtTable() {
  const rk = wtRanking();
  return (
    <Card title="Licences WorldTour">
      <WtBrief />
      <Info>
        Les {WT_N} premières équipes au classement UCI cumulé sur trois saisons obtiennent une licence WorldTour pour le
        cycle suivant : invitations d'office aux Grands Tours et aux grandes classiques. Les autres sont ProTeams et
        dépendent des invitations, sauf les deux meilleures de la saison passée. Une relégation coûte cher : clause du
        sponsor (−12 % d'apport, confiance −15), moral de l'effectif en baisse, leaders ambitieux qui font jouer leur
        clause de sortie, et coureurs cotés plus difficiles à recruter. Une promotion rapporte +8 % d'apport.
      </Info>
      <Table>
        {rk.map((e, i) => (
          <FragmentRow key={e.T.id} i={i} e={e} />
        ))}
      </Table>
    </Card>
  );
}
function FragmentRow({ i, e }) {
  return (
    <>
      {i === WT_N ? (
        <tr>
          <td colSpan={4} className="border-t-2 border-dashed border-sky-400 py-1 text-center text-xs text-slate-400">
            — ligne de licence —
          </td>
        </tr>
      ) : null}
      <Tr mine={e.T.player}>
        <td>{i + 1}</td>
        <td>
          <TeamDot T={e.T} />
          {e.T.name}
        </td>
        <td className="text-xs">{isWT(e.T.id) ? 'WT' : 'Pro'}</td>
        <td className="whitespace-nowrap text-right">{e.pts} pts</td>
      </Tr>
    </>
  );
}
export function UciObjective() {
  const o = (S.obj || []).find(o => o.k === 'uci');
  if (!o) return null;
  const rk = uciRanking();
  const me = S.teams[0];
  const pos = rk.indexOf(me) + 1;
  const target = rk[o.n - 1];
  const gap = target && target !== me ? (target.uci || 0) - (me.uci || 0) : 0;
  return (
    <div className={BRIEF + ' mb-2'}>
      🎯 Objectif du sponsor : top {o.n}. Vous êtes <b>{pos}e</b>
      {pos <= o.n ? (
        ' — objectif atteint pour l’instant.'
      ) : (
        <>
          {' '}
          — il manque <b>{gap} pts</b> pour rejoindre {target.name} ({o.n}e).
        </>
      )}
    </div>
  );
}
export function SeasonWhy() {
  const W = S.seasonWhy || {};
  const ks = Object.keys(W)
    .map(Number)
    .sort((a, b) => b - a);
  if (!ks.length) return null;
  return (
    <Card title={`🔎 Pourquoi la saison ${ks[0]}`}>
      {W[ks[0]].map((t, i) => (
        <Html key={i} as="div" className="border-t border-slate-800 py-1.5 text-sm first:border-0" html={t} />
      ))}
      {ks.slice(1, 5).map(k => (
        <Info key={k} label={`Saison ${k}`}>
          {W[k].map((t, i) => (
            <Html key={i} as="div" className="py-1" html={t} />
          ))}
        </Info>
      ))}
    </Card>
  );
}
// Courbe des points UCI des équipes voisines (SVG, échelle commune).
export function RivalsChart({ rows, U }) {
  if (!U || U.w.length < 2)
    return <p className="text-xs text-slate-400">La courbe apparaîtra après quelques semaines de course.</p>;
  const W = 360,
    H = 170,
    pl = 34,
    pb = 18;
  const series = rows.map(({ T }) => ({ T, v: U.t[T.id] || [] }));
  const max = Math.max(10, ...series.flatMap(s => s.v));
  const n = U.w.length;
  const x = i => pl + ((W - pl - 6) * i) / (n - 1);
  const y = v => H - pb - ((H - pb - 6) * v) / max;
  const ME = '#f472b6';
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        {[0, 1, 2, 3, 4].map(k => {
          const v = Math.round((max * k) / 4);
          return (
            <g key={k}>
              <line x1={pl} x2={W - 6} y1={y(v)} y2={y(v)} stroke="#2c3038" />
              <text x={pl - 4} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">
                {v}
              </text>
            </g>
          );
        })}
        <text x={pl} y={H - 3} fontSize="10" fill="#94a3b8">
          S{U.w[0]}
        </text>
        <text x={W - 6} y={H - 3} textAnchor="end" fontSize="10" fill="#94a3b8">
          S{U.w[n - 1]}
        </text>
        {series.map(s => (
          <polyline
            key={s.T.id}
            points={s.v.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
            fill="none"
            stroke={s.T.player ? ME : s.T.color}
            strokeWidth={s.T.player ? 3 : 1.6}
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-300">
        {series.map(s => (
          <span key={s.T.id} className="inline-flex items-center gap-1">
            <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.T.player ? ME : s.T.color }} />
            {s.T.short}
          </span>
        ))}
      </div>
    </>
  );
}
