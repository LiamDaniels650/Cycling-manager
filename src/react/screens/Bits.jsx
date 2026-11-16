// Derniers morceaux de l'ancienne interface, portés fidèlement en composants : pictos d'étapes (stageIcons),
// difficultés de l'étape (climbsTable), « Ce qui va décider l'étape » (stageKeysHTML), Mondiaux (worldsCard)
// et fiche d'une équipe (teamCard).
import { Card, Btn, Info, KV, RiderLink, Select, Table, Tr, TeamDot } from '../ui.jsx';

const TY = {
  plat: ['▬', 'text-lime-300'],
  vallonne: ['∿', 'text-amber-300'],
  punch: ['⌒', 'text-amber-300'],
  montagne: ['▲', 'text-orange-300'],
  sommet: ['⛰', 'text-orange-300'],
  paves: ['▦', 'text-stone-300'],
  clm: ['⏱', 'text-sky-300'],
  clmeq: ['⏱⏱', 'text-slate-200'],
};
function tyGlyph(t, v) {
  if (t === 'vallonne') return v === 'dur' ? '≋' : v === 'longue' ? '〰' : '∿';
  if (t === 'paves') return v === 'monts' ? '⛰▦' : '▦';
  return (TY[t] || ['?'])[0];
}
export function StageIcons({ spec, className = '' }) {
  return (
    <span className={'inline-flex flex-wrap gap-px align-middle ' + className}>
      {spec.map(([t, d, v], i) => (
        <span
          key={i}
          title={`${typeLbl(t)} ${d} km`}
          className={
            'inline-block min-w-[18px] rounded-sm bg-slate-800 px-0.5 text-center text-[13px] leading-5 ' +
            ((TY[t] || [])[1] || 'text-slate-200')
          }
        >
          {tyGlyph(t, v)}
        </span>
      ))}
    </span>
  );
}
const CHIP = 'rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200 ring-1 ring-slate-700';
export function Climbs({ Pf }) {
  const parts = Pf.climbs.map((c, i) => (
    <span key={'c' + i} className={CHIP}>
      {c.name} · cat. {c.cat} · {c.len} km à {c.avg}% · sommet km {c.end.toFixed(0)}
    </span>
  ));
  const nN = Pf.narrow ? Pf.narrow.reduce((a, v, i) => a + (v && !Pf.narrow[i - 1] ? 1 : 0), 0) : 0;
  if (nN)
    parts.push(
      <span key="n" className={CHIP}>
        🛣️ {nN} passage(s) en route étroite : soyez placés
      </span>
    );
  if (Pf.sectors.length)
    parts.push(
      <span key="s" className={CHIP}>
        {Pf.sectors.length} secteurs pavés ({Pf.sectors.reduce((a, b) => a + b.end - b.start, 0).toFixed(1)} km)
      </span>
    );
  if (Pf.wind && Pf.expoKm > 3)
    parts.push(
      <span key="w" className="rounded-lg bg-sky-500/15 px-2 py-1 text-xs text-sky-100 ring-1 ring-sky-400/40">
        🌬️ vent {['', 'modéré', 'fort', 'violent'][Pf.wind]} · {Pf.expoKm.toFixed(0)} km exposés (bordures possibles)
      </span>
    );
  if (Pf.spec && Pf.spec.wx && Pf.spec.wx !== 'sec')
    parts.push(
      <span key="x" className={CHIP}>
        {WX[Pf.spec.wx]}
      </span>
    );
  return parts.length ? (
    <div className="mt-2 flex flex-wrap gap-1.5">{parts}</div>
  ) : (
    <p className="mt-2 text-xs text-slate-400">Aucune difficulté répertoriée.</p>
  );
}
export function StageKeys({ rc, spec, Pf }) {
  const L = [];
  const dist = spec.dist;
  const last = Pf.climbs[Pf.climbs.length - 1];
  const summit = last && last.end >= dist - 0.5;
  if (spec.type === 'clm' || spec.type === 'clmeq')
    L.push(<>⏱ Contre-la-montre de {dist} km : tout se joue sur le chrono et la gestion de l'effort</>);
  else if (summit)
    L.push(
      <>
        ⛰ Arrivée au sommet : <b>{last.name}</b>, {last.len} km à {last.avg} % (cat. {last.cat})
      </>
    );
  else if (last && dist - last.end < 40)
    L.push(
      <>
        ⛰ Dernière difficulté : <b>{last.name}</b> ({last.len} km à {last.avg} %), sommet à{' '}
        {Math.round(dist - last.end)} km de l'arrivée
      </>
    );
  else if (Pf.finishGrad >= 3) L.push(<>↗️ Arrivée en côte ({Pf.finishGrad.toFixed(1)} %) : terrain de puncheurs</>);
  else L.push(<>🏁 Arrivée plate : sprint massif probable si l’échappée est reprise</>);
  const big = Pf.climbs.filter(c => c.cat === 'HC' || c.cat === '1').length;
  if (big > 1)
    L.push(<>📈 {big} grands cols (HC ou 1re cat.) : journée d'usure, l'endurance et la récupération comptent</>);
  if (Pf.sectors && Pf.sectors.length) {
    const inFinal = Pf.sectors.filter(s => s.start > dist * 0.55).length;
    L.push(
      <>
        ▦ {Pf.sectors.length} secteurs pavés{inFinal ? `, dont ${inFinal} dans le final` : ''} : placement et crevaisons
      </>
    );
  }
  if (spec.wind && spec.wind >= 6 && Pf.expoKm > 10)
    L.push(
      <>
        🌬️ Vent {Math.round(spec.wind)} m/s sur {Math.round(Pf.expoKm)} km exposés : risque de bordures, il faut être
        devant
      </>
    );
  if (spec.wx && spec.wx !== 'sec') L.push(<>{WX[spec.wx]}</>);
  const key = TERRAIN_KEY[spec.type] || 'pla';
  const rivals = S.teams
    .filter(T => !T.player)
    .flatMap(T => (rc.sel[T.id] || []).filter(id => !rc.out[id]))
    .map(id => S.riders[id]);
  let watch;
  if (rc.specs.length > 1 && rc.si > 0 && (key === 'mon' || key === 'clm')) {
    const g = gcList(rc)
      .filter(id => S.riders[id].team !== 0)
      .slice(0, 5);
    watch = g.map(id => `${riderName(S.riders[id])} (${tshort(S.riders[id])}, ${leaderGcRank(rc, id)}e au général)`);
  } else
    watch = rivals
      .sort((a, b) => shownStat(b, key) - shownStat(a, key))
      .slice(0, 5)
      .map(
        r => `${riderName(r)} (${tshort(r)}, ${STAT_LBL[key].toLowerCase()} ${isEst(r) ? '~' : ''}${shownStat(r, key)})`
      );
  return (
    <Card title="Ce qui va décider l'étape">
      {L.map((t, i) => (
        <div key={i} className="border-t border-slate-800 py-1.5 text-sm text-slate-100 first:border-0">
          {t}
        </div>
      ))}
      <div className="mt-2 text-sm text-slate-300">
        <b className="text-slate-100">À surveiller :</b> {watch.join(', ')}
      </div>
    </Card>
  );
}
export function WorldsCard({ i }) {
  const pv = worldsPreview(i);
  const wish = S.worldsWish && S.worldsWish.s === S.season ? S.worldsWish.w : {};
  return (
    <div>
      <Info>
        Les Mondiaux se courent par sélections nationales : chaque sélectionneur retient ses meilleurs coureurs pour ce
        parcours. Vous pouvez demander un rôle pour vos coureurs retenus ; le rôle de leader n'est accordé qu'aux deux
        meilleurs de leur sélection.
      </Info>
      {pv.length ? (
        <div className="mt-1 space-y-2">
          {pv.map(x => (
            <div
              key={x.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-800/60 px-2.5 py-2"
            >
              <span className="text-sm">
                <RiderLink r={S.riders[x.id]} /> <span className="text-xs text-slate-400">{x.nat}</span>
                <span className="block text-xs text-slate-400">{x.rank}e de sa sélection</span>
              </span>
              <Select
                value={wish[x.id] || 'auto'}
                options={Object.entries(WORLDS_WISH)}
                onChange={v => (setWorldsWish(x.id, v), save(), render())}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-300">Aucun de vos coureurs n'est retenu cette année.</p>
      )}
      <Btn primary className="mt-3 w-full" onClick={() => runWorldsUI(i)}>
        🌈 Lancer les Championnats du monde
      </Btn>
    </div>
  );
}
function H3({ children }) {
  return <h4 className="mb-1.5 mt-3 text-sm font-semibold text-slate-100">{children}</h4>;
}
export function TeamCard({ T }) {
  if (!T) return <p>Équipe introuvable.</p>;
  const ord = uciOrder();
  const rk = ord.indexOf(T) + 1;
  const last = S.lastRanks
    ? S.teams
        .slice()
        .sort((a, b) => (S.lastRanks[b.id] || 0) - (S.lastRanks[a.id] || 0))
        .indexOf(T) + 1
    : 0;
  const rs = T.riders.map(id => S.riders[id]).filter(Boolean);
  const est = r => (T.player ? overall(r.s) : shownOv(r));
  rs.sort((a, b) => est(b) - est(a));
  const best = k => {
    const b = rs.slice().sort((a, c) => shownStat(c, k) - shownStat(a, k))[0];
    return b ? (
      <>
        <RiderLink r={b} /> <span className="text-xs text-slate-400">{T.player ? b.s[k] : '~' + shownStat(b, k)}</span>
      </>
    ) : (
      '—'
    );
  };
  const gt = T.goals && T.goals.gt ? S.cal.find(c => c.key === T.goals.gt) : null;
  const moves = (S.merc || []).filter(e => e.k !== 'rumeur' && (e.f === T.short || e.t === T.short)).slice(0, 6);
  const r50 = v => fmtMoney(Math.round(v / 50) * 50);
  const pay = payrollOf(T);
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-50">
          <TeamDot T={T} />
          {T.name} <span className="text-sm font-normal text-slate-400">{T.short}</span>
        </h2>
        <button
          type="button"
          aria-label="Fermer"
          onClick={() => closeModal()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-200"
        >
          ✕
        </button>
      </div>
      <div className="mt-2">
        <KV
          rows={[
            ['Classement UCI', `${rk}e · ${T.uci || 0} pts`],
            ['Victoires', seasonWins(T.id)],
            ...(last ? [['Saison passée', `${last}e`]] : []),
          ]}
        />
      </div>
      {!T.player ? (
        <>
          <H3>Moyens</H3>
          <KV
            rows={[
              ['Budget salarial (estimé)', r50(T.budget)],
              ['Masse salariale', r50(pay)],
              [
                'Marge',
                <span className={pay > T.budget ? 'text-rose-400' : 'text-emerald-400'}>
                  {pay > T.budget ? 'au-dessus de ses moyens' : r50(T.budget - pay)}
                </span>,
              ],
            ]}
          />
          <H3>Stratégie</H3>
          <KV
            rows={[
              ['Priorité', FOCUS_LBL[(T.goals || {}).focus] || '—'],
              ['Grand Tour visé', gt ? gt.name : '—'],
              ['Style de course', STYLES[T.style] || '—'],
            ]}
          />
        </>
      ) : null}
      <H3>Matériel</H3>
      <KV
        rows={Object.keys(EQ_CATS).map(c => {
          const b = eqUsed(T, c);
          return [
            EQ_CATS[c].lbl,
            <>
              {b.name}
              <div className="text-xs font-normal text-slate-400">{eqTraits(c, b)}</div>
            </>,
          ];
        })}
      />
      <H3>Leaders{T.player ? '' : ' (estimés)'}</H3>
      <div className="space-y-1 text-sm">
        {[
          ['Montagne', 'mon'],
          ['Sprint', 'spr'],
          ['Classiques', 'col'],
          ['Pavés', 'pav'],
          ['Chrono', 'clm'],
        ].map(([l, k]) => (
          <div key={k} className="flex justify-between gap-2 border-t border-slate-800 py-1 first:border-0">
            <span className="text-slate-400">{l}</span>
            <span>{best(k)}</span>
          </div>
        ))}
      </div>
      <H3>Effectif ({rs.length})</H3>
      <Table>
        {rs.map(r => (
          <Tr key={r.id}>
            <td>
              <RiderLink r={r} />
              <div className="text-xs text-slate-400">
                {ARCH[r.arch].lbl} · {r.age} ans
              </div>
            </td>
            <td className="text-right">{T.player ? overall(r.s) : svOv(r)}</td>
            <td className="text-right text-xs">
              {r.contract <= 1 && r.nextTeam == null ? <span className="text-amber-300">fin de contrat</span> : ''}
            </td>
          </Tr>
        ))}
      </Table>
      {moves.length ? (
        <>
          <H3>Mercato récent</H3>
          <div className="space-y-0.5 text-xs text-slate-300">
            {moves.map((e, i) => (
              <div key={i}>
                {e.s} · {MERC_KIND[e.k]} {e.n} ({e.f} → {e.t})
              </div>
            ))}
          </div>
        </>
      ) : null}
      <Btn primary className="mt-4 w-full" onClick={() => closeModal()}>
        Fermer
      </Btn>
    </div>
  );
}
