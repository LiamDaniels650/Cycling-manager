// Mode carrière : création du coureur, accueil, entraînement, courses, palmarès, génération, journal, options,
// et la course (introduction, consignes, direct, résultats d'étape). Passe 1 : cadets et juniors (16-18 ans).
import { useState } from 'react';
import { Card, Btn, Html, KV, Tabs, Select, Bar, RiderLink, Table, Tr, Info, Badge } from '../ui.jsx';
import { Icon } from '../icons.jsx';
import { StageProfile } from '../race/Broadcast.jsx';
import { LiveRace } from '../race/LiveRace.jsx';
import { StageIcons } from '../screens/Bits.jsx';
import { carNextWeek, carPending, carRace, carSkip, carNextStage, carEndRace, carAnswerUI } from './flow.js';

const IN = 'min-h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-800 px-3 text-base text-slate-100';
const TIER = {
  club: 'Course régionale',
  cup: 'Coupe',
  nat: 'Championnat national',
  intl: 'Internationale',
  avenir: 'Sélections nationales',
  monde: 'Championnat du monde',
  pro: 'Course professionnelle',
};
const KIND = {
  club: 'Club amateur',
  conti: 'Équipe formatrice',
  devo: "Réserve d'une équipe pro",
  pro: 'Professionnel',
};
const catLbl = a => (S.car && S.car.kind === 'pro' ? 'Pro' : a <= 16 ? 'Cadet' : a <= 18 ? 'Junior' : 'Espoir');

// ---------- Création ----------
export function CarCreate() {
  const [o, setO] = useState({
    fn: '',
    ln: '',
    nat: 'FRA',
    arch: 'complet',
    gab: 'moyen',
    trait: 'aucun',
    talent: 'prometteur',
    dreams: ['pro'],
    studies: 'sport',
  });
  const set = (k, v) => setO({ ...o, [k]: v });
  const toggleDream = k =>
    set(
      'dreams',
      o.dreams.includes(k) ? o.dreams.filter(x => x !== k) : o.dreams.length >= 3 ? o.dreams : [...o.dreams, k]
    );
  const go = () => {
    if (!o.fn.trim() || !o.ln.trim()) return alertBox('Donne un prénom et un nom à ton coureur.');
    carNewGame({ ...o, dreams: o.dreams.length ? o.dreams : ['pro'] });
    UI.view = 'home';
    UI.flash = '🚴 Ta carrière commence. Bonne route !';
    save();
    render();
  };
  return (
    <div className="space-y-3 pb-10">
      <Card>
        <h1 className="text-2xl font-bold text-slate-50">🚴 Mode carrière</h1>
        <p className="mt-1 text-sm text-slate-300">
          Tu as 16 ans et un vélo. Tu vis la carrière d'un seul coureur, des cadets jusqu'à la retraite, dans un monde
          du cyclisme qui tourne tout seul autour de toi. Ton potentiel est caché : à toi de le découvrir.
        </p>
      </Card>
      <Card title="Ton coureur">
        <div className="grid grid-cols-2 gap-2">
          <input
            className={IN}
            placeholder="Prénom"
            maxLength={24}
            value={o.fn}
            onChange={e => set('fn', e.target.value)}
          />
          <input
            className={IN}
            placeholder="Nom"
            maxLength={30}
            value={o.ln}
            onChange={e => set('ln', e.target.value)}
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-300">
          <label>
            Nation
            <Select
              className="mt-1 w-full"
              value={o.nat}
              onChange={v => set('nat', v)}
              options={Object.entries(NAT_NAME).map(([k, n]) => [k, n])}
            />
          </label>
          <label>
            Caractère
            <Select
              className="mt-1 w-full"
              value={o.trait}
              onChange={v => set('trait', v)}
              options={Object.entries(TRAITS).map(([k, t]) => [k, k === 'aucun' ? 'Équilibré' : t.lbl])}
            />
          </label>
        </div>
        <p className="mt-1 text-xs text-slate-400">{TRAITS[o.trait].d}</p>
      </Card>
      <Card title="Profil de coureur">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(ARCH).map(([k, A]) => (
            <Btn key={k} active={o.arch === k} onClick={() => set('arch', k)}>
              {A.lbl}
            </Btn>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Ce que tu crois être à 16 ans. Ton corps va changer : un petit grimpeur peut devenir rouleur.
        </p>
      </Card>
      <Card title="Talent (difficulté)">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(CAR_TALENT).map(([k, X]) => (
            <Btn key={k} active={o.talent === k} onClick={() => set('talent', k)}>
              {X.lbl}
            </Btn>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {CAR_TALENT[o.talent].d} Ton vrai potentiel reste caché : il peut décevoir ou surprendre.
        </p>
      </Card>
      <Card title="Gabarit">
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(CAR_GABARIT).map(([k, G]) => (
            <Btn key={k} active={o.gab === k} onClick={() => set('gab', k)}>
              {G.lbl}
            </Btn>
          ))}
        </div>
      </Card>
      <Card title="Tes rêves d'enfant (3 au plus)">
        <div className="grid gap-2">
          {Object.entries(CAR_DREAMS).map(([k, d]) => (
            <Btn key={k} active={o.dreams.includes(k)} className="justify-start" onClick={() => toggleDream(k)}>
              {d.ic} {d.lbl}
            </Btn>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">Ils te suivront toute ta carrière.</p>
      </Card>
      <Card title="Études">
        <div className="grid gap-2">
          {['lycee', 'sport', 'arret'].map(k => (
            <Btn
              key={k}
              active={o.studies === k}
              className="flex-col items-start text-left"
              onClick={() => set('studies', k)}
            >
              <b>{CAR_STUDIES[k].lbl}</b>
              <span className="text-xs font-normal opacity-80">{CAR_STUDIES[k].d}</span>
            </Btn>
          ))}
        </div>
      </Card>
      <Btn primary className="w-full text-base" onClick={go}>
        Commencer ma carrière
      </Btn>
      <Btn className="w-full" onClick={() => switchSlot('dir')}>
        ← Revenir au mode directeur sportif
      </Btn>
    </div>
  );
}

// ---------- Morceaux ----------
function Gauge({ label, v, tone }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 text-slate-400">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
        <span className={'block h-full rounded-full ' + tone} style={{ width: Math.max(0, Math.min(100, v)) + '%' }} />
      </span>
      <b className="w-8 text-right tabular-nums text-slate-100">{Math.round(v)}</b>
    </div>
  );
}
function Asks() {
  const A = S.car.asks;
  if (!A.length) return null;
  return A.map(a => (
    <Card key={a.key} title="🤔 Une décision" className="border-amber-300/50">
      <p className="text-sm text-slate-100">{a.txt}</p>
      <div className="mt-2 grid gap-2">
        {a.opts.map(([k, l]) => (
          <Btn key={k} className="justify-start text-left" onClick={() => carAnswerUI(a.key, k)}>
            {l}
          </Btn>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Sans réponse avant la semaine {a.exp + 1} : « {(a.opts.find(x => x[0] === a.def) || a.opts[0])[1]} ».
      </p>
    </Card>
  ));
}
function NextCard() {
  const me = carMe();
  const p = carPending();
  const next = carCalNow().find(
    x => x.w > S.week || (x.w === S.week && !S.car.raced[carRaceKey(x)] && !S.car.skip[carRaceKey(x)])
  );
  const end = S.week >= LAST_WEEK;
  return (
    <Card className="border-sky-500/40">
      {p ? (
        <>
          <div className="text-xs uppercase tracking-wide text-amber-300">
            Cette semaine{p.pro != null ? ` · avec ${S.car.club}` : ''}
          </div>
          <h2 className="text-lg font-bold text-slate-50">{p.name}</h2>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-slate-300">
            <StageIcons spec={p.st} /> {p.pro != null ? TIER.pro : TIER[p.def.tier]} ·{' '}
            {p.st.length > 1 ? `${p.st.length} étapes` : `${p.st[0][1]} km`}
          </div>
          <Btn primary className="mt-3 w-full" onClick={() => ((UI.view = 'race'), render())}>
            <Icon name="flag" size={18} /> Aller à la course
          </Btn>
        </>
      ) : (
        <>
          <div className="text-sm text-slate-300">
            {me.injury > 0 ? (
              `🤕 Blessé : encore ${me.injury} semaine(s).`
            ) : next ? (
              <>
                Prochaine course : <b className="text-slate-100">{next.name}</b>{' '}
                {next.w === S.week ? 'cette semaine' : `dans ${next.w - S.week} sem.`}
              </>
            ) : S.car.kind === 'pro' || S.car.stag != null ? (
              'Le directeur sportif annoncera tes prochaines sélections.'
            ) : (
              'Plus de course cette saison.'
            )}
          </div>
          <Btn primary className="mt-3 w-full" disabled={!!UI.carBusy || !!UI.busy} onClick={() => carNextWeek()}>
            {UI.carBusy ? 'Le monde du vélo avance…' : end ? '🎉 Passer à la saison suivante' : '▶ Semaine suivante'}
          </Btn>
        </>
      )}
    </Card>
  );
}
function MeCard() {
  const me = carMe();
  const ov = overall(me.s);
  const d = ov - S.car.ov0;
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-50">
            {me.fn} {me.ln}
          </h2>
          {S.car.rep && S.car.rep.nick ? <div className="text-sm text-amber-200">« {S.car.rep.nick} »</div> : null}
          <div className="text-sm text-slate-300">
            {me.age} ans · {NAT_NAME[me.nat] || me.nat} · {catLbl(me.age)} · {ARCH[me.arch].lbl}
          </div>
          <div className="text-sm text-slate-400">
            {S.car.club} ·{' '}
            {S.car.stag != null ? 'stagiaire chez ' + (teamById(S.car.stag) || {}).name : KIND[S.car.kind]}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black tabular-nums text-slate-50">{ov}</div>
          <div className={'text-xs ' + (d > 0 ? 'text-emerald-400' : d < 0 ? 'text-rose-400' : 'text-slate-400')}>
            niveau {d >= 0 ? '+' : ''}
            {d} cette saison
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Gauge label="Forme" v={me.forme} tone="bg-emerald-400" />
        <Gauge label="Fatigue" v={me.fatigue} tone={me.fatigue > 60 ? 'bg-rose-500' : 'bg-amber-400'} />
        <Gauge label="Moral" v={me.moral} tone="bg-sky-400" />
      </div>
      {S.car.kind === 'pro' ? (
        <div className="mt-2 text-sm text-slate-300">
          Contrat : {me.contract} an(s) · {fmtMoney(me.salary)}/an · épargne {fmtMoney(Math.round(S.car.money))}
          {S.car.lead && S.car.lead.tid === me.team ? (
            <div className="text-amber-200">
              Clause : {CAR_LEAD[S.car.lead.kind]} (jusqu'en {S.car.lead.until})
            </div>
          ) : null}
        </div>
      ) : null}
      {S.car.agent ? (
        <div className="text-sm text-slate-300">
          Agent : {S.car.agent.name} ({CAR_AGENTS[S.car.agent.kind].lbl.toLowerCase()})
        </div>
      ) : null}
      <div className="mt-2 text-xs text-slate-400">
        {Math.round(me.cm)} cm · {Math.round(me.kg)} kg · entraînement : {CAR_TRAIN[S.car.plan]} (
        {CAR_VOLUME[S.car.vol].lbl.toLowerCase()}) · {S.car.kind === 'pro' ? '' : CAR_STUDIES[S.car.studies].lbl}
      </div>
    </Card>
  );
}
function Dreams() {
  const me = carMe();
  const palm = me.palm || [];
  const done = k =>
    k === 'pro'
      ? me.team != null && me.team !== 0 && !me.youth
      : k === 'nat'
        ? palm.some(p => p.k === 1 && /Champion national/.test(p.e) && !/cadets|juniors|espoirs/.test(p.e))
        : k === 'monde'
          ? palm.some(p => p.k === 1 && /Champion du monde/.test(p.e) && !/cadets|juniors|espoirs/.test(p.e))
          : false;
  return (
    <Card title="Tes rêves">
      {S.car.dreams.map(k => (
        <div key={k} className="flex items-center gap-2 border-t border-slate-800 py-1.5 text-sm first:border-0">
          <span>{CAR_DREAMS[k].ic}</span>
          <span className="flex-1 text-slate-200">{CAR_DREAMS[k].lbl}</span>
          <span className="text-xs text-slate-400">{done(k) ? '✅ réalisé' : 'en route'}</span>
        </div>
      ))}
    </Card>
  );
}
function FeedList({ n }) {
  const F = S.car.feed.slice(0, n);
  return F.map((f, i) => (
    <div key={i} className="border-t border-slate-800 py-2 first:border-0">
      <div className="text-xs text-slate-400">
        {f.s !== S.season ? f.s + ' · ' : ''}sem. {f.w}
      </div>
      <b className="text-sm text-slate-100">{f.title}</b>
      <Html as="div" className="text-sm text-slate-300" html={f.body} />
    </div>
  ));
}

// ---------- Écrans ----------
function CarHome() {
  return (
    <div className="space-y-3">
      <NextCard />
      <Asks />
      <MeCard />
      <Card
        title="Dernières nouvelles"
        right={
          <Btn className="min-h-9" onClick={() => go('feed')}>
            Tout
          </Btn>
        }
      >
        <FeedList n={4} />
      </Card>
      <Dreams />
    </div>
  );
}
function CarInvest() {
  const C = S.car;
  const set = f => (f(), save(), render());
  return (
    <Card title="Investir dans ta carrière">
      <p className="mb-2 text-xs text-slate-400">Épargne : {fmtMoney(Math.round(C.money))}.</p>
      <div className="space-y-2">
        {Object.entries(CAR_STAFF).map(([k, X]) => (
          <Btn key={k} className="w-full" active={carHasStaff(k)} onClick={() => set(() => carToggleStaff(k))}>
            <span className="block text-left">
              <b>{X.lbl}</b> · {fmtMoney(X.cost)}/an {carHasStaff(k) ? '(engagé)' : ''}
              <span className="block text-xs text-slate-400">{X.d}</span>
            </span>
          </Btn>
        ))}
        {Object.entries(CAR_BUY).map(([k, X]) => {
          const why = carBuyWhy(k);
          return (
            <Btn key={k} className="w-full" disabled={!!why} onClick={() => set(() => carBuy(k))}>
              <span className="block text-left">
                <b>{X.lbl}</b> · {fmtMoney(X.cost)} {why ? `(${why})` : ''}
                <span className="block text-xs text-slate-400">{X.d}</span>
              </span>
            </Btn>
          );
        })}
      </div>
    </Card>
  );
}
function CarTrain() {
  const me = carMe();
  const pe = carPotEst();
  const young = me.age <= 18;
  const [tab, setTab] = useState(UI.trainTab || 'train');
  const pick = k => ((UI.trainTab = k), setTab(k));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Btn active={tab === 'train'} onClick={() => pick('train')}>
          Entraînement
        </Btn>
        <Btn active={tab === 'corps'} onClick={() => pick('corps')}>
          Corps et staff
        </Btn>
      </div>
      {tab === 'train' ? (
        <>
          <Card title="Entraînement de la semaine">
            <Select
              className="w-full"
              value={S.car.plan}
              onChange={v => ((S.car.plan = v), save(), render())}
              options={Object.entries(CAR_TRAIN)}
            />
            <div className="mt-2 grid grid-cols-3 gap-2">
              {Object.entries(CAR_VOLUME).map(([k, V]) => (
                <Btn key={k} active={S.car.vol === k} onClick={() => ((S.car.vol = k), save(), render())}>
                  {V.lbl}
                </Btn>
              ))}
            </div>
            <Info>
              Le plan oriente ta progression (montagne, sprint, chrono…). Le gros volume fait progresser plus vite, mais
              fatigue et expose aux blessures, surtout chez les jeunes. Trop de jours de course pour ton âge use aussi.
              La progression ralentit à mesure que tu approches de ton plafond.
            </Info>
          </Card>
          {young ? (
            <Card title="Études">
              <div className="text-sm text-slate-200">{CAR_STUDIES[S.car.studies].lbl}</div>
              <p className="text-xs text-slate-400">{CAR_STUDIES[S.car.studies].d}</p>
              {S.car.studies !== 'arret' ? (
                <Btn
                  className="mt-2"
                  onClick={() =>
                    confirmBox(
                      'Arrêter les études pour tout miser sur le vélo ? Ce choix est définitif.',
                      () => (
                        (S.car.studies = 'arret'),
                        carFeed('📕 Études arrêtées', 'Tout pour le vélo, désormais.'),
                        closeModal(),
                        save(),
                        render()
                      )
                    )
                  }
                >
                  Arrêter les études
                </Btn>
              ) : null}
            </Card>
          ) : null}
          {me.age >= 19 ? (
            <Card title="Changer de profil">
              <Select
                className="w-full"
                value={S.car.spec ? S.car.spec.to : ''}
                onChange={v => (carSpecStart(v), save(), render())}
                options={[
                  ['', `Rester ${ARCH[me.arch].lbl.toLowerCase()}`],
                  ...Object.entries(ARCH)
                    .filter(([k]) => k !== me.arch)
                    .map(([k, A]) => [k, `Devenir ${A.lbl.toLowerCase()}`]),
                ]}
              />
              {S.car.spec ? (
                <div className="mt-2 text-sm text-slate-200">
                  Progression : {Math.round(S.car.spec.prog)} %
                  <div className="text-xs text-slate-400">
                    Va plus vite avec un entraînement qui vise{' '}
                    {PRIMARY[S.car.spec.to].map(k => STAT_LBL[k].toLowerCase()).join(', ')}.
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  Un puncheur qui vise le général, un rouleur qui veut les classiques : environ deux saisons
                  d'entraînement ciblé.
                </p>
              )}
            </Card>
          ) : null}
          <Card title="Tes qualités">
            {STATS.map(k => {
              const d = me.s[k] - (S.car.s0[k] || me.s[k]);
              return (
                <div key={k} className="flex items-center gap-2 py-0.5 text-sm">
                  <span className="w-28 text-slate-300">{STAT_LBL[k]}</span>
                  <Bar v={me.s[k]} tone="b" />
                  <b className="w-7 text-right tabular-nums text-slate-100">{me.s[k]}</b>
                  <span
                    className={
                      'w-8 text-xs ' + (d > 0 ? 'text-emerald-400' : d < 0 ? 'text-rose-400' : 'text-slate-600')
                    }
                  >
                    {d ? (d > 0 ? '+' : '') + d : ''}
                  </span>
                </div>
              );
            })}
            <div className="mt-2 rounded-xl bg-slate-800/60 p-2.5 text-sm text-slate-200">
              Potentiel estimé :{' '}
              <b>
                {pe.lo}-{pe.hi}
              </b>{' '}
              — {carPotLabel((pe.lo + pe.hi) / 2)}
              <div className="text-xs text-slate-400">
                L'estimation s'affine avec les années et les courses ({Math.round(pe.k * 100)} % de certitude).
              </div>
            </div>
          </Card>
        </>
      ) : (
        <>
          <Card title="Hygiène de vie">
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(CAR_HYG).map(([k, H]) => (
                <Btn
                  key={k}
                  active={(S.car.hyg || 'normale') === k}
                  onClick={() => ((S.car.hyg = k), save(), render())}
                >
                  {H.lbl}
                </Btn>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400">{CAR_HYG[S.car.hyg || 'normale'].d}</p>
          </Card>
          {me.age >= 19 ? (
            <Card title="Poids">
              <Select
                className="w-full"
                value={S.car.wgoal || 'maintien'}
                onChange={v => ((S.car.wgoal = v), (S.car.kgBase = carMe().kg), save(), render())}
                options={Object.entries(CAR_WEIGHT).map(([k, W]) => [k, W.lbl])}
              />
              <p className="mt-1 text-xs text-slate-400">
                Chaque kilo en moins aide en montée et coûte un peu sur le plat, au sprint et sur les pavés (et
                l'inverse). Indice de masse corporelle : {fmtDec(carBmi(me), 1)}
                {carBmi(me) < 19.3 ? (
                  <b className="text-rose-300"> — trop maigre : blessures, maladies et fatigue guettent.</b>
                ) : null}
              </p>
            </Card>
          ) : null}
          <Card title="Ton corps">
            <KV
              rows={[
                ['Taille', `${Math.round(me.cm)} cm`],
                ['Poids', `${Math.round(me.kg)} kg`],
                ['Âge', `${me.age} ans`],
                ['Jours de course', `${me.espDays || 0} / ${youthLoadMax(me)} conseillés`],
              ]}
            />
            {me.age < 19 ? (
              <p className="mt-2 text-xs text-slate-400">
                Tu grandis encore : ta taille et ton poids d'adulte restent une inconnue, et chaque kilo pris change un
                peu ton profil.
              </p>
            ) : null}
          </Card>
          <CarInvest />
        </>
      )}
    </div>
  );
}
function ProProgram() {
  const T = carTeamOfMe();
  if (!T) return null;
  const L = S.cal.filter(c => !c.done && !c.worlds && (!c.inv || c.inv.includes(T.id)));
  return (
    <Card title={`Programme avec ${T.name}`}>
      <p className="mb-1 text-xs text-slate-400">
        Prévisions : le directeur sportif décide chaque semaine selon le parcours, ta forme et ta charge de course. Tu
        peux demander à souffler.
      </p>
      {L.slice(0, 14).map((c, j) => {
        const k = S.season + ':' + c.key;
        // une course par semaine : la première retenue de la semaine
        const sel = carProSelected(T, c) && !L.slice(0, j).some(o => o.w === c.w && carProSelected(T, o));
        return (
          <div key={c.key} className="flex items-center gap-2 border-t border-slate-800 py-2 first:border-0">
            <span className="w-9 text-xs text-slate-400">S{c.w}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-100">{c.name}</div>
              <div className="text-xs text-slate-400">
                <StageIcons spec={c.stagesSpec} /> {c.cat === 0 ? 'Grand Tour' : 'cat. ' + c.cat}
              </div>
            </div>
            {S.car.skip[k] ? (
              <button
                type="button"
                className="min-h-9 rounded-lg bg-slate-800 px-2 text-xs text-slate-300"
                onClick={() => (delete S.car.skip[k], save(), render())}
              >
                repos demandé
              </button>
            ) : sel ? (
              <button
                type="button"
                className="min-h-9 rounded-lg bg-emerald-500/20 px-2 text-xs text-emerald-200"
                onClick={() => ((S.car.skip[k] = true), save(), render())}
              >
                pressenti · souffler ?
              </button>
            ) : (
              <span className="text-xs text-slate-400">non retenu</span>
            )}
          </div>
        );
      })}
    </Card>
  );
}
function HourCard() {
  if (!carIsPro()) return null;
  const W = carHourRec();
  const H = S.car.hour || { best: 0, list: [] };
  const can = carHourCan();
  const tryIt = k => {
    const R = carHourTry(k);
    if (R) UI.flash = R.rec ? `Record battu : ${carKm(R.km)} !` : `${carKm(R.km)} : pas de record.`;
    save();
    render();
  };
  return (
    <Card title="⏱️ Record de l'heure">
      <p className="text-sm text-slate-200">
        Record : <b>{carKm(W.km)}</b> ({W.name}, {W.s}).
        {H.best ? ` Ton meilleur : ${carKm(H.best)}.` : ''}
      </p>
      {can ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {Object.entries(CAR_HOUR_PLACES).map(([k, X]) => (
            <Btn key={k} onClick={() => tryIt(k)}>
              {X.lbl} · ~{fmtDec(carHourKm(k), 1)} km
            </Btn>
          ))}
        </div>
      ) : null}
      <p className="mt-1 text-xs text-slate-400">
        {can
          ? `${CAR_HOUR_PLACES.alt.d} Ton chrono et ta forme du moment comptent ; la tentative fatigue beaucoup.`
          : 'Une tentative par saison, à partir de la semaine 30, en bonne santé. Ton niveau en chrono décide de tout.'}
      </p>
    </Card>
  );
}
function CarEnd() {
  const C = S.car;
  const t = carTotals();
  const [after, setAfter] = useState(C.end.after);
  const [sure, setSure] = useState(false);
  const pick = k => {
    C.end.after = k;
    setAfter(k);
    save();
  };
  const start = () => {
    let exists = false;
    try {
      exists = !!localStorage.getItem(SLOT_KEYS.dir);
    } catch (e) {}
    if (exists && !sure) return setSure(true);
    const G = carLegacy(after);
    save();
    switchSlot('dir', () => {
      newGameFromLegacy(G);
      save();
      UI.view = 'home';
    });
  };
  return (
    <div className="space-y-3">
      <Card title="🏁 Fin de carrière">
        <p className="mb-2 text-sm text-slate-300">
          {C.end.age} ans, saison {C.end.s}. Statut : {carStatusLbl()}.
        </p>
        <KV
          rows={[
            ['Saisons', t.seasons],
            ['Courses', t.races],
            ['Victoires', t.wins],
            ['Podiums', t.podiums],
            ['Légendes du peloton', t.legend ? carOrd(t.legend) : '—'],
            ['Argent', fmtMoney(t.money)],
          ]}
        />
      </Card>
      <Card title="Rêves d'enfant">
        {C.dreams.map(d => (
          <div key={d} className="flex justify-between py-0.5 text-sm">
            <span className="text-slate-200">
              {CAR_DREAMS[d].ic} {CAR_DREAMS[d].lbl}
            </span>
            {carDreamDone(d) ? (
              <b className="text-emerald-300">accompli</b>
            ) : (
              <span className="text-slate-400">non</span>
            )}
          </div>
        ))}
      </Card>
      <Card title="Biographie">
        <div className="space-y-2 text-sm leading-relaxed text-slate-200">
          {carBio().map((x, i) => (
            <p key={i}>{x}</p>
          ))}
        </div>
      </Card>
      <Card title="Et après ?">
        <div className="space-y-2">
          {Object.entries(CAR_AFTER).map(([k, X]) => (
            <Btn key={k} className="w-full" active={after === k} onClick={() => pick(k)}>
              <span className="block text-left">
                <b>{X.lbl}</b>
                <span className="block text-xs text-slate-400">{X.d}</span>
              </span>
            </Btn>
          ))}
        </div>
        {after ? (
          <>
            <Btn primary className="mt-3 w-full" onClick={start}>
              {sure ? 'Confirmer : remplacer ma partie de directeur' : 'Commencer ta vie de directeur sportif'}
            </Btn>
            <p className="mt-1 text-xs text-slate-400">
              {sure
                ? 'Une partie du mode directeur existe déjà : elle sera remplacée (pense à l’exporter depuis Options).'
                : after === 'fondateur'
                  ? `Ton équipe portera ton nom ; tes économies gonflent le budget. Ton palmarès entre dans l'histoire du nouveau monde.`
                  : "Ton palmarès entre dans l'histoire du nouveau monde. Ta carrière de coureur reste consultable ici."}
            </p>
          </>
        ) : null}
      </Card>
    </div>
  );
}
function CarRaces() {
  const L = carCalNow();
  return (
    <div className="space-y-3">
      <ProProgram />
      <HourCard />
      {L.length ? (
        <Card title={`Saison ${S.season} · ${catLbl(carMe().age).toLowerCase()}s`}>
          {L.map(d => {
            const k = carRaceKey(d);
            const r = S.car.res.find(x => x.s === S.season && x.key === d.key);
            const past = d.w < S.week || S.car.raced[k];
            return (
              <div key={d.key} className="flex items-center gap-2 border-t border-slate-800 py-2 first:border-0">
                <span className="w-9 text-xs text-slate-400">S{d.w}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-100">{d.name}</div>
                  <div className="text-xs text-slate-400">
                    <StageIcons spec={d.st} /> {TIER[d.tier]}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs">
                  {r ? (
                    <b className={r.rank && r.rank <= 3 ? 'text-amber-300' : 'text-slate-200'}>
                      {r.rank ? `${r.rank}e/${r.n}` : 'abandon'}
                    </b>
                  ) : S.car.skip[k] ? (
                    <span className="text-slate-400">impasse</span>
                  ) : past ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <button
                      type="button"
                      className="min-h-9 rounded-lg bg-slate-800 px-2 text-slate-200"
                      onClick={() => ((S.car.skip[k] = true), save(), render())}
                    >
                      Je saute
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      ) : null}
    </div>
  );
}
function TrustBar({ v }) {
  return (
    <div className="mt-1">
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
        <span
          className={
            'block h-full rounded-full ' + (v >= 62 ? 'bg-emerald-400' : v >= 40 ? 'bg-amber-400' : 'bg-rose-500')
          }
          style={{ width: v + '%' }}
        />
      </div>
      <div className="mt-0.5 text-xs text-slate-400">
        Confiance {Math.round(v)}/100 : {carTrustLbl(v)}
      </div>
    </div>
  );
}
function relTag(v) {
  return v >= 50
    ? ['ami', 'text-emerald-300']
    : v >= 20
      ? ['bonne entente', 'text-emerald-400/80']
      : v <= -30
        ? ['tendu', 'text-rose-300']
        : v <= -10
          ? ['froid', 'text-amber-300']
          : ['—', 'text-slate-400'];
}
function CarTeam() {
  const me = carMe();
  const T = carTeamOfMe();
  const C = S.car;
  if (!T)
    return (
      <Card title="Ton équipe">
        <div className="text-sm text-slate-200">
          {C.club} · {KIND[C.kind]}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          La vie d'équipe (directeur sportif, leader, coéquipiers) commence chez les pros, dès un stage.
        </p>
        {C.agent ? (
          <p className="mt-2 text-sm text-slate-300">
            Agent : {C.agent.name} ({CAR_AGENTS[C.agent.kind].lbl.toLowerCase()})
          </p>
        ) : null}
      </Card>
    );
  const D = carDsOf(T.id);
  const K = CAR_DS_KINDS[D.kind];
  const M = carMates();
  const riv = carInternalRival();
  const L = C.loyal != null ? S.riders[C.loyal] : null;
  return (
    <div className="space-y-3">
      <Card title={T.name}>
        <div className="text-sm text-slate-300">
          {C.stag != null ? 'Stagiaire' : `Contrat : ${me.contract} an(s) · ${fmtMoney(me.salary)}/an`}
          {C.lead && C.lead.tid === me.team ? (
            <div className="text-amber-200">
              Clause : {CAR_LEAD[C.lead.kind]} (jusqu'en {C.lead.until}). Tes équipiers roulent pour toi.
            </div>
          ) : null}
          {C.next ? (
            <div className="text-amber-200">Transfert signé : {teamById(C.next.tid).name} la saison prochaine</div>
          ) : null}
        </div>
        {C.agent ? (
          <div className="text-sm text-slate-300">
            Agent : {C.agent.name} ({CAR_AGENTS[C.agent.kind].lbl.toLowerCase()})
          </div>
        ) : null}
      </Card>
      <Card title="Ton directeur sportif">
        <div className="text-sm text-slate-100">
          <b>{D.name}</b> · {K.lbl}
        </div>
        <p className="text-xs text-slate-400">{K.d}</p>
        <TrustBar v={C.trust} />
        <Info label="Comment gagner sa confiance">
          Suis tes consignes (surtout quand tu dois aider le leader), obtiens des résultats quand on te laisse ta
          chance. Attaquer pour toi quand tu devais aider coûte cher, sauf si tu montes sur le podium. Une bonne
          confiance t'ouvre plus de courses, de plus grandes, et des cartes libres.
        </Info>
      </Card>
      <Card title="Coéquipiers">
        {M[0] ? (
          <p className="mb-1 text-sm text-slate-200">
            ⭐ Leader de l'équipe : <RiderLink r={M[0].r} />
            {overall(me.s) >= overall(M[0].r.s) ? ' — mais tu es à son niveau' : ''}
          </p>
        ) : null}
        {L ? (
          <p className="mb-1 text-sm text-emerald-200">
            🤝 Équipier fidèle : <RiderLink r={L} />
          </p>
        ) : null}
        {riv ? (
          <p className="mb-2 text-sm text-amber-200">
            ⚔️ Rival interne : <RiderLink r={riv.r} /> (même profil, même niveau)
          </p>
        ) : null}
        <Table head={['Coureur', 'Profil', 'Niv.', 'Relation']}>
          {M.map(({ r, rel }) => {
            const [t, c] = relTag(rel);
            return (
              <Tr key={r.id}>
                <td>
                  <RiderLink r={r} />
                  <div className="text-xs text-slate-400">{r.age} ans</div>
                </td>
                <td className="text-xs">{ARCH[r.arch].lbl}</td>
                <td>~{Math.round(overall(r.s) / 2) * 2}</td>
                <td className={'text-xs ' + c}>{t}</td>
              </Tr>
            );
          })}
        </Table>
      </Card>
    </div>
  );
}
function CarProfile() {
  const me = carMe();
  const palm = (me.palm || []).slice().sort((a, b) => b.s - a.s || a.k - b.k);
  return (
    <div className="space-y-3">
      <Card title="Palmarès">
        {palm.length ? (
          <Table>
            {palm.map((p, i) => (
              <Tr key={i}>
                <td>{p.s}</td>
                <td>{p.k === 1 ? '🥇' : p.k === 2 ? '🥈' : '🥉'}</td>
                <td>
                  {p.r}
                  <div className="text-xs text-slate-400">{p.e}</div>
                </td>
              </Tr>
            ))}
          </Table>
        ) : (
          <p className="text-sm text-slate-400">Pas encore de podium. Ça viendra.</p>
        )}
      </Card>
      <Card title="Saisons">
        {S.car.seasons.length ? (
          <Table head={['Saison', 'Âge', 'Niveau', 'Courses', 'Vict.', 'Meilleur résultat']}>
            {S.car.seasons
              .slice()
              .reverse()
              .map(x => (
                <Tr key={x.s}>
                  <td>{x.s}</td>
                  <td>{x.age}</td>
                  <td>
                    {x.ov}{' '}
                    <span className={x.dov >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      ({x.dov >= 0 ? '+' : ''}
                      {x.dov})
                    </span>
                  </td>
                  <td>{x.races}</td>
                  <td>{x.wins}</td>
                  <td className="text-xs">{x.best}</td>
                </Tr>
              ))}
          </Table>
        ) : (
          <p className="text-sm text-slate-400">Première saison en cours.</p>
        )}
      </Card>
      <Card title="Tous tes résultats">
        {S.car.res.length ? (
          S.car.res.slice(0, 40).map((x, i) => (
            <div key={i} className="flex justify-between gap-2 border-t border-slate-800 py-1.5 text-sm first:border-0">
              <span className="text-slate-200">
                <span className="text-xs text-slate-400">{x.s} · </span>
                {x.name}
              </span>
              <b className={x.rank && x.rank <= 3 ? 'text-amber-300' : 'text-slate-300'}>
                {x.rank ? `${x.rank}e/${x.n}` : 'ab.'}
              </b>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-400">Aucune course disputée.</p>
        )}
      </Card>
      <CarGen />
    </div>
  );
}
// ---------- Image et réputation ----------
function Meter({ label, v, hint }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <b className="tabular-nums text-slate-50">{Math.round(v)}/100</b>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-800">
        <span
          className={
            'block h-full rounded-full ' + (v >= 62 ? 'bg-emerald-400' : v >= 35 ? 'bg-amber-400' : 'bg-rose-500')
          }
          style={{ width: v + '%' }}
        />
      </div>
      {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}
function CarImage() {
  const P = carRep();
  const sty = carStyle();
  const L = carLegendRank();
  const st = P.style;
  const tot = Math.max(1, sum(Object.values(st)));
  const setSocial = k => ((P.social = k), save(), render());
  return (
    <div className="space-y-3">
      <Card>
        <div className="text-xs uppercase tracking-wide text-slate-400">Statut</div>
        <div className="text-xl font-bold text-slate-50">{carStatusLbl()}</div>
        {P.nick ? <div className="text-sm text-amber-200">Surnom : « {P.nick} »</div> : null}
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-slate-800/60 px-2.5 py-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">Abonnés</div>
            <b className="text-slate-100">{P.fans.toLocaleString('fr-FR')}</b>
          </div>
          <div className="rounded-xl bg-slate-800/60 px-2.5 py-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">Légendes du peloton</div>
            <b className="text-slate-100">{L ? carOrd(L) : 'pas encore'}</b>
          </div>
        </div>
      </Card>
      <Card title="Popularité et presse">
        <div className="space-y-3">
          <Meter
            label="Popularité"
            v={P.pub}
            hint="Victoires et attaques la font monter. Elle augmente tes salaires et attire les sponsors ; au-delà de 70, ton équipe tient à t'aligner."
          />
          <Meter
            label="Relations avec la presse"
            v={P.press}
            hint="Bonne presse : chaque exploit compte davantage. Mauvaise presse : les critiques pèsent sur le moral après un échec."
          />
        </div>
      </Card>
      <Card title="Ton style de course">
        <p className="text-sm text-slate-100">
          {sty ? <b>{CAR_STYLES[sty].lbl}</b> : 'Pas encore de style marqué.'} {sty ? CAR_STYLES[sty].d : ''}
        </p>
        <div className="mt-2 space-y-1">
          {Object.entries(CAR_STYLES).map(([k, X]) => (
            <div key={k} className="flex items-center justify-between gap-2 text-xs text-slate-300">
              <span>{X.lbl}</span>
              <Bar v={(st[k] / tot) * 100} tone="b" />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Il vient de ce que tu fais en course : attaques, victoires, places sans attaquer, travail pour le leader.
        </p>
      </Card>
      <Card title="Réseaux sociaux">
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(CAR_SOCIAL).map(([k, X]) => (
            <Btn key={k} active={P.social === k} onClick={() => setSocial(k)}>
              {X.lbl}
            </Btn>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">{(CAR_SOCIAL[P.social] || CAR_SOCIAL.discret).d}</p>
      </Card>
      <Card title="Sponsors personnels">
        {P.spons.length ? (
          <div className="space-y-1 text-sm">
            {P.spons.map(sp => (
              <div key={sp.brand} className="flex justify-between">
                <span className="text-slate-200">{sp.brand}</span>
                <span className="tabular-nums text-slate-300">
                  {fmtMoney(sp.k)}/an · jusqu'en {sp.until}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Aucun pour l'instant. Les marques viennent à toi quand le public te connaît.
          </p>
        )}
      </Card>
    </div>
  );
}
// ---------- Vie hors vélo ----------
function Choice({ table, value, onPick, cols = 3, disabled }) {
  return (
    <>
      <div className={'grid gap-2 ' + (cols === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
        {Object.entries(table).map(([k, X]) => (
          <Btn key={k} active={value === k} disabled={disabled && disabled(k)} onClick={() => onPick(k)}>
            {X.lbl}
          </Btn>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-400">{table[value].d}</p>
    </>
  );
}
function CarLife() {
  const L = carLife();
  const me = carMe();
  const C = S.car;
  const adult = carIsPro() || C.money > 0 || me.age >= 19 || L.home !== 'famille';
  const H = CAR_HOMES[L.home];
  const inc = carLifeIncome();
  const cost = carLifeCost();
  const set = f => (f(), save(), render());
  const homeFx = k => {
    const X = CAR_HOMES[k];
    const fx = [];
    if (X.train > 1) fx.push(`entraînement +${Math.round((X.train - 1) * 100)} %`);
    if (X.forme) fx.push(`forme +${X.forme}`);
    if (X.tax > 1) fx.push(`salaire net +${Math.round((X.tax - 1) * 100)} %`);
    if (X.moral > 0) fx.push('moral +');
    if (X.moral < 0) fx.push('moral −');
    fx.push(X.cost ? `loyer ${fmtMoney(X.cost)}/an` : 'gratuit');
    return fx.join(' · ');
  };
  return (
    <div className="space-y-3">
      <Card title="Argent">
        <KV
          rows={[
            ['Solde', <span className={C.money < 0 ? 'text-rose-300' : ''}>{fmtMoney(C.money)}</span>],
            ['Revenus nets / an', fmtMoney(inc)],
            ['Dépenses / an', fmtMoney(cost)],
            [
              'Reste / an',
              <span className={inc - cost < 0 ? 'text-rose-300' : 'text-emerald-300'}>{fmtMoney(inc - cost)}</span>,
            ],
          ]}
        />
        {C.money < 0 ? (
          <p className="mt-2 text-xs text-rose-300">Les dettes pèsent sur ton moral chaque semaine.</p>
        ) : null}
      </Card>
      <Card title="Lieu de vie">
        <Select
          className="w-full"
          value={L.home}
          onChange={k => set(() => carMove(k))}
          options={Object.entries(CAR_HOMES)
            .filter(([k, X]) => me.age >= X.min || k === L.home)
            .map(([k, X]) => [k, X.lbl])}
        />
        <p className="mt-1 text-xs text-slate-400">
          {H.d} Effets : {homeFx(L.home)}. Déménager coûte un quart du loyer annuel.
        </p>
      </Card>
      {adult ? (
        <>
          <Card title="Train de vie">
            <Choice table={CAR_LIFESTYLE} value={L.style} onPick={k => set(() => (L.style = k))} />
          </Card>
          <Card title="Ton épargne">
            <Choice table={CAR_INVEST} value={L.inv} cols={2} onPick={k => set(() => (L.inv = k))} />
            <p className="mt-1 text-xs text-slate-400">Le rendement tombe en fin de saison, sur ton solde positif.</p>
          </Card>
        </>
      ) : (
        <p className="px-1 text-sm text-slate-400">
          Tant que tu vis chez tes parents sans salaire, pas de budget à gérer : l'argent viendra avec ton premier
          contrat.
        </p>
      )}
      <Card title="Famille">
        <p className="text-sm text-slate-100">
          {L.partner ? `En couple avec ${L.partner.name} depuis ${L.partner.since}.` : 'Célibataire.'}
          {L.kids.length ? ` Enfant${L.kids.length > 1 ? 's' : ''} : ${L.kids.map(k => k.name).join(', ')}.` : ''}
          {L.due ? ' Un bébé est attendu cette saison.' : ''}
        </p>
        {carHasFamily() ? (
          <div className="mt-2">
            <Choice table={CAR_PRIO} value={L.prio} onPick={k => set(() => (L.prio = k))} />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
              <span>Tensions à la maison (absences)</span>
              <Bar v={L.tension} tone={L.tension >= 50 ? 'r' : 'y'} />
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
function CarGen() {
  const me = carMe();
  const L = carRivals(12);
  const est = r => Math.round(overall(r.s) / 3) * 3;
  return (
    <Card title={`Ta génération (nés en ${S.car.born})`}>
      <p className="mb-2 text-xs text-slate-400">
        Les coureurs de ton âge, classés selon leurs résultats de la saison. Tu les recroiseras toute ta carrière. Leur
        niveau est une estimation.
      </p>
      <Table head={['', 'Coureur', 'Niv.', 'Pts', 'Duels']}>
        {L.map((r, i) => {
          const h = S.car.h2h[r.id] || [0, 0];
          return (
            <Tr key={r.id}>
              <td className="text-slate-400">{i + 1}</td>
              <td>
                <RiderLink r={r} /> <span className="text-xs text-slate-400">{r.nat}</span>
                <div className="text-xs text-slate-400">
                  {ARCH[r.arch].lbl}
                  {r.team != null && teamById(r.team) ? ' · ' + teamById(r.team).short : ''}
                </div>
              </td>
              <td>~{est(r)}</td>
              <td>{Math.round(r.jPts || 0)}</td>
              <td className={h[0] > h[1] ? 'text-emerald-400' : h[0] < h[1] ? 'text-rose-400' : 'text-slate-400'}>
                {h[0]}-{h[1]}
              </td>
            </Tr>
          );
        })}
      </Table>
      <p className="mt-2 text-xs text-slate-400">
        Toi : niveau {overall(me.s)}. Duels = courses où vous avez fini tous les deux dans les 20 premiers (tes
        victoires-tes défaites).
      </p>
    </Card>
  );
}
function CarFeed() {
  return (
    <Card title="Journal">
      <FeedList n={80} />
    </Card>
  );
}
const CAR_GUIDE = [
  [
    'Ta semaine',
    "Choisis l'entraînement (plan et volume), puis passe à la semaine suivante. Les décisions à prendre s'affichent sur l'accueil ; sans réponse sous trois semaines, l'option par défaut s'applique.",
  ],
  [
    'Tes courses',
    "Chez les jeunes, le club t'inscrit ; chez les pros, le directeur sportif te sélectionne selon ta forme, ta fraîcheur, sa confiance et ta popularité. En direct, tu ne pilotes que ton coureur : respecte ta consigne ou tente ta chance.",
  ],
  [
    'Ton potentiel',
    "Il est caché : l'estimation s'affine avec les années. La progression vient de l'entraînement, de l'âge et des courses, puis ralentit au pic (26-31 ans selon le profil) avant le déclin.",
  ],
  [
    'Le directeur sportif',
    "Chaque directeur a son caractère. Obéir gagne sa confiance ; attaquer pour toi au lieu d'aider en coûte, sauf résultat. « Demander ma chance » dépend de sa confiance, de ta forme et de ton caractère.",
  ],
  [
    'Ton corps',
    'Hygiène de vie, poids visé (dès 19 ans), maladies, blessures et rééducation : chaque choix a un prix.',
  ],
  [
    'Ton image',
    'Popularité, presse, style de course, déclarations, réseaux sociaux et sponsors : ils pèsent sur tes salaires, ta sélection et ton argent.',
  ],
  [
    'Ta vie',
    "Lieu de vie, train de vie, épargne, couple et enfants : ils jouent sur l'entraînement, la forme, le moral et l'argent. Avec une famille, trop d'absences créent des tensions.",
  ],
  [
    'La fin',
    "Record de l'heure à tenter une fois par saison dès la semaine 30, retraite possible dès 33 ans (imposée à 39), puis bilan, biographie et reconversion vers le mode directeur.",
  ],
];
function CarGuide() {
  return (
    <Card title="📘 Comment ça marche">
      {CAR_GUIDE.map(([t, d]) => (
        <details key={t} className="border-t border-slate-800 py-1 first:border-0">
          <summary className="cursor-pointer py-1.5 text-sm font-semibold text-slate-100">{t}</summary>
          <p className="pb-2 text-sm text-slate-300">{d}</p>
        </details>
      ))}
    </Card>
  );
}
function CarOpt() {
  const [txt, setTxt] = useState('');
  return (
    <div className="space-y-3">
      <CarGuide />
      <Card title="Mode de jeu">
        <p className="text-sm text-slate-300">
          Ta carrière et ta partie de directeur sportif sont deux parties séparées : rien n'est perdu en passant de
          l'une à l'autre. Seule la reconversion, en fin de carrière, propose (avec confirmation) de remplacer la partie
          de directeur.
        </p>
        <Btn className="mt-2 w-full" onClick={() => switchSlot('dir')}>
          🧑‍💼 Passer au mode directeur sportif
        </Btn>
      </Card>
      <Card title="Sauvegarde">
        <p className="text-xs text-slate-400">
          La carrière est sauvegardée automatiquement dans ce navigateur. Pour la mettre à l'abri, télécharge un
          fichier.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Btn onClick={() => dlSave()}>💾 Télécharger</Btn>
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-slate-800 px-3 text-sm font-medium text-slate-100 ring-1 ring-slate-700">
            📂 Charger
            <input
              type="file"
              accept=".json,application/json,text/plain"
              className="hidden"
              onChange={e => importFile(e.target)}
            />
          </label>
        </div>
        <textarea
          rows={3}
          value={txt}
          onChange={e => setTxt(e.target.value)}
          placeholder="…ou colle une sauvegarde ici"
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-2 text-sm text-slate-100"
        />
        <Btn
          className="mt-2"
          disabled={!txt.trim()}
          onClick={() =>
            importSave(txt.trim()) ? (save(), (UI.view = 'home'), render()) : alertBox('Sauvegarde invalide.')
          }
        >
          Importer
        </Btn>
      </Card>
      <Card title="Danger">
        <Btn
          danger
          onClick={() =>
            confirmBox('Abandonner cette carrière et en commencer une nouvelle ?', () => {
              try {
                localStorage.removeItem(SAVE_KEY);
              } catch (e) {}
              idbClear();
              S = null;
              UI.sim = null;
              UI.carPre = null;
              stopTimer();
              closeModal();
              render();
            })
          }
        >
          Nouvelle carrière
        </Btn>
      </Card>
    </div>
  );
}

// ---------- Course ----------
function CarRaceIntro({ p }) {
  const pro = p.pro != null;
  const tier = pro ? 'pro' : p.def.tier;
  return (
    <div className="space-y-3">
      <Card>
        <div className="text-xs uppercase tracking-wide text-amber-300">
          {TIER[tier]}
          {pro ? ` · ${S.car.club}` : ''}
        </div>
        <h2 className="text-xl font-bold text-slate-50">{p.name}</h2>
        <div className="mt-2 space-y-1 text-sm text-slate-300">
          {p.st.map(([t, km], i) => (
            <div key={i} className="flex items-center gap-2">
              <StageIcons spec={[[t, km]]} />
              {p.st.length > 1 ? `Étape ${i + 1} : ` : ''}
              {typeLbl(t)}, {km} km
            </div>
          ))}
        </div>
        {tier === 'monde' || tier === 'avenir' ? (
          <p className="mt-2 text-sm text-slate-300">
            Sélections nationales : six coureurs par pays. Il faut être retenu.
          </p>
        ) : null}
        {pro ? (
          <p className="mt-2 text-sm text-slate-300">
            Le directeur sportif te donnera ta consigne avant chaque étape. En direct, tu pilotes ton coureur ; simulée,
            tu cours selon ta consigne.
          </p>
        ) : null}
      </Card>
      <Btn primary className="w-full text-base" onClick={() => carRace(true)}>
        <Icon name="flag" size={18} /> Courir en direct
      </Btn>
      <div className="grid grid-cols-2 gap-2">
        <Btn onClick={() => carRace(false)}>Simuler la course</Btn>
        <Btn onClick={() => carSkip()}>{pro ? 'Demander à souffler' : "Faire l'impasse"}</Btn>
      </div>
      <Btn className="w-full" onClick={() => go('home')}>
        ← Retour
      </Btn>
    </div>
  );
}
const ORDER_TXT = {
  leader: 'Tu es le leader : l’équipe roule pour toi.',
  sprint: 'Tu es le sprinteur : on te protège jusqu’au final.',
  protect: 'Tu protèges le leader : tu l’abrites et tu l’aides en cas de pépin.',
  leadout: 'Tu lances le sprint de ton sprinteur.',
  control: 'Tu contrôles la course pour l’équipe (tu roules en tête de peloton).',
  free: 'Carte libre : à toi de jouer.',
  break: 'Mission : prendre l’échappée.',
  save: 'Journée tranquille : économise-toi.',
  itt: 'Contre-la-montre : chacun pour soi.',
};
function CarStagePrep() {
  const rc = S.rc;
  const spec = rc.specs[rc.si];
  const Pf = buildProfile(spec);
  const tid = rc.carPro ? carMe().team : 0;
  // course pro : la consigne que le directeur sportif de l'équipe donnera au départ
  // (copie : l'aperçu ne modifie pas les consignes qui seront appliquées au départ)
  const ord = rc.carPro ? JSON.parse(JSON.stringify(carTeamOrders(rc))) : rc.orders;
  if (rc.carPro && S.car.wish === 'free' && ord[S.car.id] && !['leader', 'sprint', 'itt'].includes(ord[S.car.id].o))
    ord[S.car.id].o = 'free';
  const my = ord[S.car.id] || { o: 'free' };
  const ldrId = Object.keys(ord).find(id => rc.sel[tid].includes(+id) && ord[id].o === 'leader');
  const canAsk = !['leader', 'sprint', 'free', 'itt'].includes(my.o) && !S.car.wish;
  return (
    <div className="space-y-3">
      <Card>
        <h2 className="text-lg font-bold text-slate-50">
          {rc.name}
          {rc.specs.length > 1 ? ` · étape ${rc.si + 1}/${rc.specs.length}` : ''}
        </h2>
        <div className="text-sm text-slate-400">{spec.name}</div>
        <StageProfile spec={spec} Pf={Pf} />
      </Card>
      <Card title={rc.carPro ? 'Consigne du directeur sportif' : 'Consigne du club'}>
        {rc.carPro && carDs() ? (
          <p className="text-xs text-slate-400">
            {carDs().name} ({CAR_DS_KINDS[carDs().kind].lbl.toLowerCase()}) · {carTrustLbl(S.car.trust)}
          </p>
        ) : null}
        <p className="text-sm text-slate-100">{ORDER_TXT[my.o] || my.o}</p>
        {rc.carPro && CAR_HELPER_ORDERS.has(my.o) ? (
          <p className="mt-1 text-xs text-amber-200/90">
            Attaquer pour toi au lieu d'aider coûterait de la confiance, sauf si tu montes sur le podium.
          </p>
        ) : null}
        {ldrId && +ldrId !== S.car.id ? (
          <p className="mt-1 text-xs text-slate-400">
            Leader du jour : <RiderLink r={S.riders[ldrId]} />
          </p>
        ) : null}
        {canAsk ? (
          <Btn
            className="mt-2"
            onClick={() => {
              if (carAskChance(rc.carPro)) {
                if (!rc.carPro) carOrders(rc);
                UI.flash = 'Le directeur sportif te donne ta chance : carte libre.';
              } else {
                UI.flash = '« Pas aujourd’hui. Fais ton boulot, ton tour viendra. »';
              }
              render();
            }}
          >
            Demander ma chance
          </Btn>
        ) : null}
      </Card>
      <Btn primary className="w-full text-base" onClick={() => startStage()}>
        <Icon name="play" size={18} /> Départ
      </Btn>
    </div>
  );
}
function CarStageResult() {
  const rc = S.rc;
  const L = UI.lastStage;
  const st = rc.stageRes[L.idx];
  const me = S.car.id;
  const res = st ? st.res : [];
  const myRank = res.findIndex(e => e.id === me) + 1;
  const gc = rc.specs.length > 1 ? gcList(rc) : null;
  const myGc = gc ? gc.indexOf(me) + 1 : 0;
  const row = (e, i) => (
    <Tr key={e.id} mine={e.id === me}>
      <td className="w-7">{i + 1}</td>
      <td>
        <RiderLink r={S.riders[e.id]} />
        <span className="ml-1 text-xs text-slate-400">{(teamById(S.riders[e.id].team) || {}).short}</span>
      </td>
      <td className="text-right text-xs tabular-nums">{i ? fmtGap(e.gap) : fmtTime(0)}</td>
    </Tr>
  );
  return (
    <div className="space-y-3">
      <Card title={`${rc.name}${rc.specs.length > 1 ? ` · étape ${L.idx + 1}` : ''}`}>
        <div className="text-3xl font-black text-slate-50">{myRank ? `${myRank}e` : 'Abandon'}</div>
        {myRank ? (
          <div className="text-sm text-slate-400">
            sur {res.length} · {myRank > 1 ? fmtGap(res[myRank - 1].gap) : 'vainqueur !'}
          </div>
        ) : null}
        {gc ? (
          <div className="mt-1 text-sm text-slate-200">
            Général : {myGc ? `${myGc}e à ${fmtGap(rc.gc[me] - rc.gc[gc[0]])}` : '—'}
          </div>
        ) : null}
      </Card>
      <Card title="Classement de l'étape">
        <Table>
          {res.slice(0, 10).map(row)}
          {myRank > 10 ? row(res[myRank - 1], myRank - 1) : null}
        </Table>
      </Card>
      {rc.done ? (
        <Btn primary className="w-full text-base" onClick={() => carEndRace()}>
          Terminer la course
        </Btn>
      ) : (
        <Btn primary className="w-full text-base" onClick={() => carNextStage()}>
          Étape suivante
        </Btn>
      )}
    </div>
  );
}
function CarRaceView() {
  if (UI.sim) return <LiveRace />;
  if (S.rc && (S.rc.car || S.rc.carPro)) return UI.lastStage ? <CarStageResult /> : <CarStagePrep />;
  const p = carPending();
  if (p) return <CarRaceIntro p={p} />;
  return (
    <Card>
      <p className="text-sm text-slate-300">Pas de course pour toi cette semaine.</p>
      <Btn className="mt-2" onClick={() => go('home')}>
        ← Accueil
      </Btn>
    </Card>
  );
}

// ---------- Application ----------
const CAR_NAV = [
  ['home', 'home', 'Accueil'],
  ['train', 'zap', 'Entraînement'],
  ['races', 'calendar', 'Courses'],
  ['team', 'users', 'Équipe'],
  ['more', 'menu', 'Plus'],
];
export const CAR_MORE = [
  ['profile', '🏆', 'Palmarès et génération'],
  ['image', '🌟', 'Image'],
  ['life', '🏠', 'Vie et argent'],
  ['opt', '⚙️', 'Options et aide'],
];
export function CarNav() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CAR_MORE.map(([k, ic, l]) => (
        <button
          key={k}
          type="button"
          onClick={() => (closeModal(), go(k))}
          className={
            'flex min-h-14 items-center justify-center gap-2 rounded-md text-sm ' +
            (UI.view === k ? 'bg-sky-500 font-semibold text-slate-950' : 'bg-slate-800 text-slate-100')
          }
        >
          <Icon name={CAR_MORE_ICON[k] || 'menu'} size={18} />
          {l}
        </button>
      ))}
    </div>
  );
}
// Fiche d'un autre coureur vue par le joueur : âge, nation, profil, niveau estimé, palmarès, duels.
export function CarRiderSheet({ r }) {
  if (!r) return null;
  const me = r.id === S.car.id;
  const h = S.car.h2h[r.id];
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-bold text-slate-50">{riderName(r)}</h3>
        <button
          type="button"
          onClick={() => closeModal()}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-200"
        >
          ✕
        </button>
      </div>
      <div className="text-sm text-slate-300">
        {r.age} ans · {NAT_NAME[r.nat] || r.nat} · {ARCH[r.arch].lbl}
        {teamOf(r) && !r.gen ? ` · ${teamOf(r).name}` : ''}
      </div>
      <div className="mt-2 text-sm text-slate-200">
        Niveau : {me ? overall(r.s) : '~' + Math.round(overall(r.s) / 3) * 3}
      </div>
      {h ? (
        <div className="mt-1 text-sm text-slate-200">
          Vos duels : {h[0]}-{h[1]}
        </div>
      ) : null}
      {(r.palm || []).length ? (
        <div className="mt-2 text-sm">
          <b className="text-slate-100">Palmarès</b>
          {(r.palm || [])
            .slice(-8)
            .reverse()
            .map((p, i) => (
              <div key={i} className="text-xs text-slate-300">
                {p.s} · {p.k === 1 ? '🥇' : p.k === 2 ? '🥈' : '🥉'} {p.r} ({p.e})
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}
const VIEWS = {
  team: CarTeam,
  home: CarHome,
  train: CarTrain,
  races: CarRaces,
  profile: CarProfile,
  image: CarImage,
  life: CarLife,
  gen: CarGen,
  feed: CarFeed,
  opt: CarOpt,
  race: CarRaceView,
};
export function CareerApp() {
  const live = UI.view === 'race' && !!UI.sim;
  const inRace = UI.view === 'race';
  const ended = S.car.end && ['home', 'train', 'races', 'team'].includes(UI.view || 'home');
  const V = ended ? CarEnd : VIEWS[UI.view] || CarHome;
  const me = carMe();
  return { live, inRace, V, me };
}
const CAR_MORE_ICON = { profile: 'trophy', image: 'gauge', life: 'home', opt: 'sliders' };
// Rail de navigation du mode carrière (grand écran), comme celui du directeur sportif.
// Titre de l'écran courant du mode carrière.
export function carTitle() {
  const all = CAR_NAV.concat(CAR_MORE);
  const x = all.find(a => a[0] === (UI.view || 'home'));
  return x && x[0] !== 'more' ? x[2] : '';
}
export function CarRail() {
  const me = carMe();
  const n = S.car.asks.length + (carPending() ? 1 : 0);
  const item = (k, icon, l, cnt) => {
    const on = UI.view === k || (!UI.view && k === 'home');
    return (
      <button
        key={k}
        type="button"
        onClick={() => go(k)}
        className={
          'flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-[15px] font-medium ' +
          (on
            ? 'bg-slate-800 text-slate-50 shadow-[inset_3px_0_0_#f2c94c]'
            : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100')
        }
      >
        <Icon name={icon} size={19} />
        {l}
        {cnt ? (
          <i className="ml-auto rounded-full bg-rose-500 px-1.5 font-display text-xs font-semibold not-italic leading-[18px] text-white">
            {cnt}
          </i>
        ) : null}
      </button>
    );
  };
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col gap-1 border-r border-slate-800 bg-slate-950 px-2.5 py-4 md:flex">
      <div className="mb-3 px-3">
        <b className="block truncate font-display text-lg leading-tight text-slate-50">
          {me.fn} {me.ln}
        </b>
        <span className="text-xs text-slate-400">{me.age} ans</span>
      </div>
      {CAR_NAV.filter(x => x[0] !== 'more').map(([k, icon, l]) => item(k, icon, l, k === 'home' ? n : 0))}
      <div className="mx-3 my-2 h-px bg-slate-800" />
      {CAR_MORE.map(([k, , l]) => item(k, CAR_MORE_ICON[k] || 'menu', l, 0))}
      <div className="mt-auto px-3 text-xs text-slate-400">
        Saison {S.season}
        <b className="block font-display text-lg text-slate-50">Semaine {S.week}</b>
      </div>
    </aside>
  );
}
export function CarHeader() {
  const me = carMe();
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <b className="truncate font-display text-base text-slate-50">
          {me.fn} {me.ln}
        </b>
        <span className="shrink-0 font-display text-sm text-slate-300">
          {S.season} · s{S.week} · {me.age} ans
        </span>
      </div>
    </header>
  );
}
export function CarBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-3xl">
        {CAR_NAV.map(([k, icon, l]) => {
          const on = k === 'more' ? CAR_MORE.some(x => x[0] === UI.view) : UI.view === k;
          const n = k === 'home' ? S.car.asks.length + (carPending() ? 1 : 0) : 0;
          return (
            <button
              key={k}
              type="button"
              onClick={() => (k === 'more' ? ((UI.modal = { type: 'nav' }), render()) : go(k))}
              className={
                'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs ' +
                (on ? 'text-sky-400' : 'text-slate-400')
              }
            >
              <span className="relative">
                <Icon name={icon} size={22} />
                {n ? (
                  <i className="absolute -right-2 -top-1.5 rounded-full bg-rose-500 px-1.5 text-xs font-bold not-italic leading-4 text-white">
                    {n}
                  </i>
                ) : null}
              </span>
              {l}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
