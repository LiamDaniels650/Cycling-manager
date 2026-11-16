// Presse (portage fidèle de viewPress) : notoriété, question d'un journaliste, popularité de vos coureurs,
// chouchous du public et revue de presse.
import { Card, Btn, Html, Info, RiderLink, Table, Tr, Bar } from '../ui.jsx';

function PopRow({ r }) {
  return (
    <Tr>
      <td>
        <RiderLink r={r} />
      </td>
      <td className="text-right tabular-nums">{Math.round(r.pop || 0)}</td>
      <td className="w-[45%]">
        <Bar v={r.pop || 0} />
      </td>
    </Tr>
  );
}
export function Press() {
  const rep = Math.round(repOf());
  const Q = S.pressQ;
  const my = myRiders()
    .slice()
    .sort((a, b) => (b.pop || 0) - (a.pop || 0));
  const stars = Object.values(S.riders)
    .filter(r => !r.retired && r.team !== null && !r.aca)
    .sort((a, b) => (b.pop || 0) - (a.pop || 0))
    .slice(0, 10);
  const A = (S.press || []).slice(0, 40);
  return (
    <div className="space-y-3">
      <Card title="📰 Presse et notoriété">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Notoriété de l'équipe : <b>{rep}/100</b> — {repLabel(rep)} <Bar v={rep} />
        </div>
        <Info>
          La notoriété rassure le sponsor (confiance en fin de saison), augmente vos chances d'invitation aux Grands
          Tours, attire les coureurs en négociation et rapporte des produits dérivés. Elle monte avec les victoires et
          les bonnes réponses aux journalistes, baisse avec les déceptions et les polémiques.
        </Info>
      </Card>
      {Q ? (
        <Card title="🎤 Question d'un journaliste" right={<Btn onClick={() => doAsst('press')}>🧑‍💼 Réponse auto</Btn>}>
          <p className="mb-2 text-sm italic text-slate-100">« {Q.q} »</p>
          <div className="grid gap-2">
            {Q.opts.map((o, k) => (
              <Btn key={k} className="justify-start text-left" onClick={() => doAnswer(k)}>
                {o.t}
              </Btn>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Sans réponse avant la semaine {Q.exp}, la presse vous jugera distant.
          </p>
        </Card>
      ) : null}
      <Card title="Popularité de mes coureurs">
        <Table>
          {my.slice(0, 8).map(r => (
            <PopRow key={r.id} r={r} />
          ))}
        </Table>
        {my.length > 8 ? (
          <details className="mt-1 text-sm">
            <summary className="cursor-pointer py-1.5 text-slate-300">Les {my.length - 8} autres</summary>
            <Table>
              {my.slice(8).map(r => (
                <PopRow key={r.id} r={r} />
              ))}
            </Table>
          </details>
        ) : null}
        <p className="mt-1 text-xs text-slate-400">
          Un coureur populaire rapporte en produits dérivés, mais il demande un meilleur salaire.
        </p>
      </Card>
      <Card title="Les chouchous du public">
        <Table>
          {stars.map((r, i) => (
            <Tr key={r.id} mine={r.team === 0}>
              <td className="w-6">{i + 1}</td>
              <td>
                <RiderLink r={r} />
              </td>
              <td className="text-xs text-slate-400">{tshort(r)}</td>
              <td className="text-right tabular-nums">{Math.round(r.pop || 0)}</td>
            </Tr>
          ))}
        </Table>
      </Card>
      <Card title="Revue de presse">
        {A.length ? (
          A.map((a, i) => (
            <article key={i} className="border-t border-slate-800 py-2 first:border-0">
              <div className="text-xs text-slate-400">
                {a.j} · {a.s}, sem. {a.w}
                {a.tone > 0.4 ? (
                  <span className="text-emerald-400"> · 👍</span>
                ) : a.tone < -0.4 ? (
                  <span className="text-rose-400"> · 👎</span>
                ) : null}
              </div>
              <b className="text-sm text-slate-50">{a.title}</b>
              <Html as="div" className="text-sm text-slate-300" html={a.body} />
            </article>
          ))
        ) : (
          <p className="text-sm text-slate-400">Aucun article pour l'instant.</p>
        )}
      </Card>
    </div>
  );
}
