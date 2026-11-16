// Histoires : les décisions qui attendent (en premier), les histoires en cours avec leur fil, les histoires closes.
import { Card, Btn, Html, RiderLink, Badge } from '../ui.jsx';

function choose(id, k) {
  const res = storyChoose(id, k);
  save();
  UI.flash = res ? '📖 ' + esc(res.replace(/<[^>]+>/g, '')) : '📖 Décision prise.';
  render();
}
function Who({ t }) {
  const a = S.riders[t.a],
    b = t.b != null ? S.riders[t.b] : null;
  return (
    <div className="text-sm">
      <RiderLink r={a} />
      {b ? (
        <>
          {' '}
          <span className="text-slate-400">{t.k === 'rival' ? 'contre' : 'et'}</span> <RiderLink r={b} />
          {t.k === 'rival' && teamOf(b) ? (
            <span className="ml-1 text-xs text-slate-400">({teamOf(b).short})</span>
          ) : null}
        </>
      ) : null}
      {t.k === 'rival' && t.data ? (
        <span className="ml-2">
          <Badge tone={t.data.w >= t.data.l ? 'sky' : 'red'}>
            {t.data.w}-{t.data.l}
          </Badge>
        </span>
      ) : null}
    </div>
  );
}
function Thread({ t, open }) {
  const K = STORY_KINDS[t.k];
  return (
    <details open={open} className="border-t border-slate-800 py-1.5 first:border-0">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <span className="text-lg">{K.ic}</span>
        <span className="min-w-0 flex-1">
          <b className="text-slate-100">{K.lbl}</b>
          <span className="block text-xs text-slate-400">
            depuis {t.s0 !== S.season ? t.s0 + ', ' : ''}sem. {t.w0}
          </span>
        </span>
      </summary>
      <div className="pb-1 pl-8">
        <Who t={t} />
        <ol className="mt-1.5 space-y-1 border-l border-slate-700 pl-3">
          {t.log.map((l, i) => (
            <li key={i} className="text-[13px] text-slate-300">
              <span className="text-slate-500">
                {l.s !== S.season ? l.s + ' · ' : ''}sem. {l.w} ·{' '}
              </span>
              <Html html={l.txt} />
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}
export function Stories() {
  const all = storiesOn();
  const asks = all.filter(t => !t.done && t.ask);
  const live = all.filter(t => !t.done && !t.ask);
  const past = all
    .filter(t => t.done)
    .slice(-15)
    .reverse();
  return (
    <div className="space-y-3">
      <h2 className="px-1 text-lg font-bold text-slate-50">📖 Histoires de l'équipe</h2>
      {asks.map(t => {
        const K = STORY_KINDS[t.k];
        return (
          <Card key={t.id} className="border-amber-300/50" title={`${K.ic} ${K.lbl}`}>
            <Html as="p" className="text-sm text-slate-300" html={t.log[0].txt} />
            <div className="mt-1">
              <Who t={t} />
            </div>
            <p className="mt-2 text-sm font-semibold text-amber-100">{t.ask.txt}</p>
            <div className="mt-2 grid gap-2">
              {t.ask.opts.map(([k, l]) => (
                <Btn key={k} className="justify-start text-left" onClick={() => choose(t.id, k)}>
                  {l}
                </Btn>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Sans réponse avant la semaine {t.ask.exp + 1} : «{' '}
              {(t.ask.opts.find(o => o[0] === t.ask.def) || t.ask.opts[0])[1]} ».
            </p>
          </Card>
        );
      })}
      <Card title="En cours">
        {live.length ? (
          live.map(t => <Thread key={t.id} t={t} open />)
        ) : (
          <p className="text-sm text-slate-400">
            Aucune histoire en cours. Elles naissent du caractère de vos coureurs et des résultats : rivalités, conflits
            de leaders, jeunes qui éclosent, vétérans, équipiers frustrés, têtes brûlées.
          </p>
        )}
      </Card>
      {past.length ? (
        <Card title="Terminées">
          {past.map(t => (
            <Thread key={t.id} t={t} />
          ))}
        </Card>
      ) : null}
    </div>
  );
}
