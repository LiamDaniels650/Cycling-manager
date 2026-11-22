// Messages (portage fidèle de viewInbox) : importants ou tous, regroupés par semaine, avec icônes ; les messages
// affichés sont marqués lus après l'affichage, comme dans l'ancienne interface.
import { useEffect } from 'react';
import { Card, Tabs, Btn } from '../ui.jsx';

export function Inbox() {
  const all = UI.inboxAll;
  const imp = m => (m.imp != null ? m.imp : msgImportant(m.title, m.body));
  const L = groupMsgs(all ? S.inbox : S.inbox.filter(imp));
  const nImp = S.inbox.filter(m => imp(m) && !m.read).length;
  useEffect(() => {
    L.forEach(m => (m._src ? m._src.forEach(x => (x.read = true)) : (m.read = true)));
    save();
  });
  return (
    <div className="space-y-3">
      <Tabs
        items={[
          ['imp', `Importants${nImp ? ` (${nImp})` : ''}`],
          ['all', 'Tous'],
        ]}
        value={all ? 'all' : 'imp'}
        onChange={k => ((UI.inboxAll = k === 'all'), render())}
      />
      <Card title="Messages">
        {L.length ? (
          L.map((m, i) => (
            <div key={i}>
              {!i || L[i - 1].w !== m.w || L[i - 1].season !== m.season ? (
                <div className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400 first:mt-0">
                  Semaine {m.w}
                  {m.season !== S.season ? ' · ' + m.season : ''}
                </div>
              ) : null}
              <div className={'flex gap-3 rounded-xl px-2 py-2 ' + (m.read ? '' : 'bg-slate-800/70')}>
                <span className="text-lg">{msgIcon(m.title)}</span>
                <div className="min-w-0 flex-1">
                  <div className={'text-sm font-semibold ' + (m.read ? 'text-slate-200' : 'text-slate-100')}>
                    {m.title.replace(/^\p{Extended_Pictographic}️?\s*/u, '')}
                    {m.n > 1 ? <span className="ml-1 rounded bg-slate-700 px-1.5 text-xs">{m.n}</span> : null}
                  </div>
                  <div className="legacy text-sm text-slate-300" dangerouslySetInnerHTML={{ __html: m.body }} />
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-slate-400">{all ? 'Aucun message.' : 'Rien d’important : tout est dans « Tous ».'}</p>
        )}
      </Card>
      <Btn primary className="w-full" onClick={() => go('home')}>
        ← Retour au bureau
      </Btn>
    </div>
  );
}
