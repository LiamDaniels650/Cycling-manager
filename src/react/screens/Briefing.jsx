// Briefing d'avant-étape (portage fidèle de viewBriefing et gearCard) : profil et difficultés, ce qui va décider
// l'étape, météo, matériel et ravitaillement, consignes et plans d'attaque, chrono par équipes, plan de course,
// ordres conditionnels, options du direct, départ, classement général.
import { Card, Btn, Html, Bar, RiderLink, Select } from '../ui.jsx';
import { StageProfile } from '../race/Broadcast.jsx';
import { Standings } from './StageResult.jsx';
import { Climbs, StageKeys } from './Bits.jsx';

function Gear({ rc, spec }) {
  const cur = gearFor({ player: true }, rc, spec);
  const rec = autoGear(spec);
  const opts = (set, k) => Object.entries(set).map(([v, g]) => [v, g.lbl + (rec[k] === v ? ' ★' : '')]);
  const wind = spec.wind >= 3 ? '💨 vent fort' : spec.wind >= 2 ? '🌬️ vent modéré' : 'vent faible';
  const itt = isITT(spec) || isTTT(spec);
  const fp = feedPlanFor(rc, spec),
    frec = autoFeed(spec);
  return (
    <Card title="🌦️ Météo, matériel et ravitaillement" right={<Btn onClick={() => gearAuto()}>🧑‍💼 Auto</Btn>}>
      <div className="text-sm text-slate-300">
        {WX[spec.wx || 'sec']} · {wind} · régime {WX_REGIME[regimeAt(S.cal[rc.calIdx].w)]}
        {reconDone(rc) ? ' · 🗺️ parcours reconnu' : ''}
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select
          value={cur.wheels}
          onChange={v => (setGear('wheels', v), render())}
          options={opts(GEAR.wheels, 'wheels')}
        />
        <Select value={cur.tyres} onChange={v => (setGear('tyres', v), render())} options={opts(GEAR.tyres, 'tyres')} />
      </div>
      <div className="mt-1 text-xs text-slate-400">
        {GEAR.wheels[cur.wheels].d} · {GEAR.tyres[cur.tyres].d}
      </div>
      <div className="mt-1 text-xs text-slate-400">
        ★ conseil du staff : {GEAR.wheels[rec.wheels].lbl.toLowerCase()}, {GEAR.tyres[rec.tyres].lbl.toLowerCase()}
        {itt ? '' : `, ravitaillement ${FEED_PLANS[frec].lbl.toLowerCase()}`}.
      </div>
      {itt ? null : (
        <>
          <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-200">
            🍌 Ravitaillement
            <Select
              value={fp}
              onChange={v => (setFeed(v), save(), render())}
              options={Object.entries(FEED_PLANS).map(([v, f]) => [v, f.lbl + (frec === v ? ' ★' : '')])}
            />
          </label>
          <div className="mt-1 text-xs text-slate-400">
            {FEED_PLANS[fp].d}. Chaque coureur a aussi deux barres en poche (radio « Mange maintenant »).
          </div>
        </>
      )}
    </Card>
  );
}
function obeyPct(r) {
  return Math.round(
    clamp(
      0.62 +
        (r.dis / 100) * 0.4 +
        (r.moral - 55) / 300 -
        (r.amb / 100) * 0.18 +
        (r.trait === 'modele' ? 0.3 : 0) -
        (r.trait === 'leaderne' ? 0.12 : 0),
      0.3,
      0.99
    ) * 100
  );
}
function Orders({ rc, spec, ids }) {
  const ttt = isTTT(spec);
  const itt = isITT(spec) || ttt;
  if (ttt && (!rc.tttLeader || !ids.includes(rc.tttLeader)))
    rc.tttLeader = ids
      .slice()
      .sort(
        (a, b) => (rc.specs.length > 1 ? rc.gc[a] - rc.gc[b] : 0) || overall(S.riders[b].s) - overall(S.riders[a].s)
      )[0];
  const lead = ids.filter(id => (rc.orders[id] || {}).o === 'leader').length,
    spr = ids.filter(id => (rc.orders[id] || {}).o === 'sprint').length;
  return (
    <Card title="Consignes d'avant-course" right={<Btn onClick={() => autoMine()}>🧑‍💼 Auto</Btn>}>
      <div className="space-y-2">
        {ids.map(id => {
          const r = S.riders[id];
          const o = rc.orders[id] || { o: 'protect' };
          const ob = obeyPct(r);
          return (
            <div key={id} className="rounded-xl bg-slate-800/60 p-2.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <RiderLink r={r} /> <span className="text-xs text-slate-400">{ARCH[r.arch].lbl}</span>
                </span>
                <span
                  className={
                    'shrink-0 text-xs font-semibold ' +
                    (ob > 85 ? 'text-emerald-300' : ob > 70 ? 'text-sky-300' : 'text-rose-300')
                  }
                  title="Probabilité estimée de respecter une consigne d'équipier"
                >
                  obéit {ob} %
                </span>
              </div>
              <div className="mt-1 flex gap-3 text-[11px] text-slate-400">
                <span>
                  Énergie <Bar v={rc.energy[id]} />
                </span>
                <span>
                  Forme <Bar v={r.forme} />
                </span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ttt ? (
                  <span className="text-xs text-slate-400">
                    {rc.tttLeader === id ? '⭐ leader du chrono' : 'rouleur'}
                  </span>
                ) : itt ? (
                  <Select
                    value={o.itt === 'fond' ? 'fond' : 'gerer'}
                    onChange={v => (setOrd(id, 'itt', v), render())}
                    options={[
                      ['fond', 'À bloc'],
                      ['gerer', 'Gérer (économiser)'],
                    ]}
                  />
                ) : (
                  <>
                    <Select
                      value={o.o}
                      onChange={v => setOrd(id, 'o', v)}
                      options={Object.entries(ORDERS).map(([k, v]) => [k, v.lbl])}
                    />
                    {o.o === 'leader' || o.o === 'free' ? (
                      <Select
                        value={o.att || 'final'}
                        onChange={v => (setOrd(id, 'att', v), render())}
                        options={Object.entries(ATT)}
                      />
                    ) : null}
                    {o.o === 'sprint' ? (
                      <>
                        <Select
                          value={(rc.sprintPlan || {})[id] || 'auto'}
                          onChange={v => (
                            ((S.rc.sprintPlan = S.rc.sprintPlan || {})[id] = v === 'auto' ? null : v),
                            save(),
                            render()
                          )}
                          options={[
                            ['auto', 'Lancement : à son idée'],
                            ['long', 'Lancement long (≈ 300 m)'],
                            ['court', 'Lancement court (≈ 150 m, dans les roues)'],
                          ]}
                        />
                        <Select
                          value={String((rc.sprintWheel || {})[id] || '')}
                          onChange={v => (
                            ((S.rc.sprintWheel = S.rc.sprintWheel || {})[id] = v ? +v : null),
                            save(),
                            render()
                          )}
                          options={[
                            ['', 'Roue : aucune en particulier'],
                            ...rivalSprinters(rc, id).map(y => [
                              String(y.id),
                              `Dans la roue de ${riderName(y)} (${y.s.spr})`,
                            ]),
                          ]}
                        />
                      </>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {ttt ? (
        <div className="mt-3 space-y-2">
          <h3 className="font-semibold text-slate-100">Contre-la-montre par équipes</h3>
          <p className="text-xs text-slate-400">
            Le temps de l'équipe est celui du 4e coureur. Les coureurs trop faibles pour le rythme sont lâchés et
            finissent seuls.
          </p>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            Allure
            <Select
              value={rc.tttMode === 'leader' ? 'leader' : 'bloc'}
              onChange={v => ((S.rc.tttMode = v), save(), render())}
              options={[
                ['bloc', 'À bloc (le plus vite possible)'],
                ['leader', 'Adaptée au leader (ne jamais le lâcher)'],
              ]}
            />
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            Leader{' '}
            <Select
              value={rc.tttLeader}
              onChange={v => ((S.rc.tttLeader = +v), save(), render())}
              options={ids.map(id => [id, riderName(S.riders[id])])}
            />
          </label>
        </div>
      ) : null}
      {!itt ? (
        <>
          {lead > 1 || spr > 1 ? (
            <p className="mt-2 text-sm text-amber-300">
              Attention : {lead > 1 ? lead + ' leaders' : ''} {spr > 1 ? spr + ' sprinteurs' : ''} désignés — un seul
              sera réellement protégé.
            </p>
          ) : null}
          <details className="mt-2 text-xs text-slate-400">
            <summary className="cursor-pointer py-1">Rappel des consignes</summary>
            {Object.values(ORDERS).map(v => (
              <div key={v.lbl}>
                <b className="text-slate-200">{v.lbl}</b> : {v.d}
              </div>
            ))}
            <div>
              <b className="text-slate-200">Placement</b> : leaders et sprinteurs escortés par leurs équipiers restent
              mieux placés à moindre coût — crucial avant les secteurs pavés, dans le vent et au sprint.
            </div>
          </details>
        </>
      ) : null}
    </Card>
  );
}
function Plan({ rc, ids }) {
  const pl = (rc.plan && rc.plan[0]) || { debut: 'neutre', milieu: 'neutre', final: 'neutre' };
  const f = UI.condForm || { id: ids[0], c: 'km', p: 10, a: 'attack' };
  if (!ids.includes(f.id)) f.id = ids[0];
  UI.condForm = f;
  const body = (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-100">Plan de course de l'équipe</h3>
        <Btn onClick={() => ((UI.flash = '🧑‍💼 Plan : ' + autoPlan(S.rc)), save(), render())}>🧑‍💼 Auto</Btn>
      </div>
      <div className="space-y-2">
        {[
          ['debut', 'Début (0-40 %)'],
          ['milieu', 'Milieu (40-80 %)'],
          ['final', 'Final (80-100 %)'],
        ].map(([k, l]) => (
          <label key={k} className="flex items-center justify-between gap-2 text-sm text-slate-200">
            {l}
            <Select value={pl[k]} onChange={v => (setPlan(k, v), render())} options={Object.entries(PLAN_MODES)} />
          </label>
        ))}
      </div>
      <h3 className="mt-4 font-semibold text-slate-100">Ordres conditionnels</h3>
      <p className="text-xs text-slate-400">
        Déclenchés automatiquement pendant l'étape (une fois chacun), sous réserve d'obéissance.
      </p>
      {ids.map(id => {
        const cs = (rc.conds && rc.conds[id]) || [];
        if (!cs.length) return null;
        return (
          <div key={id} className="mt-1 flex flex-wrap items-center gap-1 text-sm">
            <RiderLink r={S.riders[id]} /> :
            {cs.map((c, k) => (
              <span
                key={k}
                className="inline-flex items-center gap-1 rounded-full bg-slate-800 py-0.5 pl-2.5 text-xs text-slate-200"
              >
                {condTxt(c)}
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center text-rose-300"
                  onClick={() => delCond(id, k)}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        );
      })}
      <div className="mt-2 space-y-2 rounded-xl bg-slate-800/60 p-2.5 text-sm text-slate-200">
        <label className="flex items-center justify-between gap-2">
          Coureur{' '}
          <Select
            value={f.id}
            onChange={v => ((UI.condForm.id = +v), render())}
            options={ids.map(id => [id, riderName(S.riders[id])])}
          />
        </label>
        <label className="flex flex-wrap items-center justify-between gap-2">
          Si
          <span className="flex items-center gap-2">
            <Select
              value={f.c}
              onChange={v => ((UI.condForm.c = v), render())}
              options={Object.entries(COND).map(([k, v]) => [k, v.lbl])}
            />
            {COND[f.c].p ? (
              <>
                <input
                  type="number"
                  inputMode="numeric"
                  className="min-h-10 w-20 rounded-lg border border-slate-700 bg-slate-800 px-2"
                  value={f.p}
                  onChange={e => ((UI.condForm.p = +e.target.value), render())}
                />{' '}
                {COND[f.c].u}
              </>
            ) : null}
          </span>
        </label>
        <label className="flex items-center justify-between gap-2">
          alors{' '}
          <Select
            value={f.a}
            onChange={v => ((UI.condForm.a = v), render())}
            options={COND_ACT.map(a => [a, RADIO[a].lbl])}
          />
        </label>
        <Btn className="w-full" onClick={() => addCond()}>
          + Ajouter
        </Btn>
      </div>
    </>
  );
  return (
    <Card>
      {S.simple ? (
        <details>
          <summary className="cursor-pointer py-1 text-sm text-slate-300">
            ⚙️ Plan de course et ordres conditionnels — plan réglé par l'adjoint
          </summary>
          {body}
        </details>
      ) : (
        body
      )}
    </Card>
  );
}
export function Briefing() {
  const rc = S.rc;
  const spec = rc.specs[rc.si];
  const Pf = buildProfile(spec);
  Pf.spec = spec;
  const ids = rc.sel[0].filter(id => !rc.out[id]);
  const itt = isITT(spec) || isTTT(spec);
  return (
    <div className="space-y-3">
      <Card>
        <h2 className="text-lg font-bold text-slate-50">{rc.name}</h2>
        <div className="text-sm text-slate-400">{spec.name}</div>
        <StageProfile spec={spec} Pf={Pf} />
        <Climbs Pf={Pf} />
      </Card>
      <StageKeys rc={rc} spec={spec} Pf={Pf} />
      <Card>
        <p className="text-sm text-slate-300">
          Pressé ? L'adjoint règle tout pour cette étape : consignes, plan de course, matériel et ravitaillement.
        </p>
        <Btn className="mt-2 w-full" onClick={() => briefAuto()}>
          🧑‍💼 Tout régler en auto
        </Btn>
      </Card>
      {S.simple ? (
        <details>
          <summary className="cursor-pointer rounded-xl bg-slate-900 px-3 py-3 text-sm text-slate-300 ring-1 ring-slate-700">
            ⚙️ Météo, matériel et ravitaillement — réglés par l'adjoint
          </summary>
          <div className="mt-3">
            <Gear rc={rc} spec={spec} />
          </div>
        </details>
      ) : (
        <Gear rc={rc} spec={spec} />
      )}
      <Orders rc={rc} spec={spec} ids={ids} />
      {!itt ? <Plan rc={rc} ids={ids} /> : null}
      <Card>
        <label className="flex min-h-10 items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            className="h-5 w-5 accent-sky-500"
            checked={!!UI.autoPause}
            onChange={e => ((UI.autoPause = e.target.checked), render())}
          />{' '}
          Pause auto sur les événements de mon équipe
        </label>
        <label className="flex min-h-10 items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            className="h-5 w-5 accent-sky-500"
            checked={!!UI.autoDS}
            onChange={e => ((UI.autoDS = e.target.checked), render())}
          />{' '}
          🤖 DS automatique (il répond aux appels de vos coureurs à votre place)
        </label>
        <p className="mt-1 text-xs text-slate-400">
          Avec ou sans lui, vos coureurs courent d'eux-mêmes selon leur consigne. Vos ordres radio priment jusqu'à ce
          que vous les leviez (« retour à la consigne »).
        </p>
        <Btn primary className="mt-2 min-h-14 w-full text-base" onClick={() => startStage()}>
          {itt ? '⏱ Lancer le chrono' : '🏁 Départ !'}
        </Btn>
      </Card>
      {rc.si > 0 ? <Standings rc={rc} brief /> : null}
    </div>
  );
}
