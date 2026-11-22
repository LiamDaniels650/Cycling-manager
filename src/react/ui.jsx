// Briques d'interface partagées : cartes, boutons tactiles, jauges, pastilles d'équipe, liens vers les fiches.
import { Icon } from './icons.jsx';

// Émoji de tête d'un titre ou d'un bouton : retiré (la navigation et les titres n'ont plus d'émojis ; ils restent
// dans les textes de la radio et des commentaires, où ils racontent quelque chose).
const LEAD_EMOJI = /^(?:[\u{1F1E6}-\u{1F1FF}]{2}|\p{Extended_Pictographic}[\u{FE0F}\u{200D}\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}]*)\s+/u;
export function noLead(c) {
  if (typeof c === 'string') return c.replace(LEAD_EMOJI, '');
  if (Array.isArray(c) && c.length > 1 && typeof c[0] === 'string') {
    const f = c[0].replace(LEAD_EMOJI, '');
    if (f !== c[0]) return f.trim() === '' ? c.slice(1) : [f, ...c.slice(1)];
  }
  return c;
}
// Panneau : fond légèrement relevé, coins peu arrondis, sans bordure. tone « action » : une décision vous attend
// (liseré jaune à gauche).
export function Card({ title, right, children, className = '', tone }) {
  const t = tone === 'action' ? 'bg-slate-900 shadow-[inset_3px_0_0_#f2c94c]' : 'bg-slate-900';
  return (
    <section className={'rounded-lg p-4 ' + t + ' ' + className}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="font-display text-lg font-semibold leading-tight text-slate-50">{noLead(title)}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
// Bouton tactile (44 px de haut au minimum, comme le recommandent les guides mobiles).
export function Btn({ children, onClick, primary, active, danger, disabled, title, className = '' }) {
  const base =
    'inline-flex min-h-11 flex-wrap items-center justify-center gap-x-1.5 rounded-md px-3.5 py-2 text-center text-sm font-semibold leading-snug transition active:scale-[.98] disabled:opacity-40 ';
  const tone = danger
    ? 'bg-rose-600 text-white hover:bg-rose-500'
    : primary
      ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
      : active
        ? 'bg-slate-800 text-slate-50 shadow-[inset_0_-3px_0_#f2c94c]'
        : 'bg-slate-800 text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700';
  // bouton de l'adjoint (🧑‍💼 en tête) : son icône, et un repère pour les tests
  const first = typeof children === 'string' ? children : Array.isArray(children) && typeof children[0] === 'string' ? children[0] : '';
  const asst = first.startsWith('🧑');
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      data-auto={asst ? '1' : undefined}
      className={base + tone + ' ' + className}
    >
      {asst ? <Icon name="bot" size={16} /> : null}
      {noLead(children)}
    </button>
  );
}
// Texte riche venu du moteur (messages et radio contiennent parfois du gras).
export function Html({ html, className = '', as: Tag = 'span' }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
export function TeamDot({ T }) {
  return <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: T.color }} />;
}
// Maillot distinctif porté au départ de l'étape (🟡 🟢 🔴 ⚪), lu dans l'ancienne interface (jersey).
export function Jersey({ id }) {
  const j = jersey(id)
    .replace(/<[^>]+>/g, '')
    .trim();
  return j ? (
    <span className="ml-0.5" title="maillot distinctif">
      {j}
    </span>
  ) : null;
}
// Pastille aux couleurs de l'équipe d'un coureur (rien pour un coureur libre).
export function RiderDot({ r }) {
  const T = r && r.team != null ? teamById(r.team) : null;
  if (!T) return null;
  return (
    <span
      aria-hidden="true"
      className="mr-1 inline-block h-2 w-2 shrink-0 rounded-full align-middle ring-1 ring-black/40"
      style={{ background: T.color }}
    />
  );
}
export function RiderLink({ r, className = '', dot = true }) {
  if (!r) return <span>?</span>;
  return (
    <button
      type="button"
      onClick={() => openRider(r.id)}
      className={
        'text-left font-medium underline decoration-dotted underline-offset-2 ' +
        (r.team === 0 ? 'text-pink-300' : 'text-slate-100') +
        ' ' +
        className
      }
    >
      {dot ? <RiderDot r={r} /> : null}
      {riderName(r)}
      {wearsRainbow(r) ? (
        <span className="ml-1 no-underline" title="Champion du monde">
          🌈
        </span>
      ) : wearsNatChamp(r) ? (
        <span className="ml-1 no-underline" title={'Champion ' + natAdj(r.nat)}>
          🏅
        </span>
      ) : null}
    </button>
  );
}
// Explications repliables (portage de <details class="info">).
export function Info({ children, label = 'Explications' }) {
  return (
    <details className="mt-1 text-xs text-slate-400">
      <summary className="cursor-pointer py-1 underline decoration-dotted underline-offset-2">{label}</summary>
      <div className="pb-1">{children}</div>
    </details>
  );
}
// Tableau compact sans défilement de page : défile à l'intérieur de sa carte si besoin.
export function Table({ head, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {head ? (
          <thead className="text-xs text-slate-400">
            <tr>
              {head.map((h, i) => (
                <th key={i} className="px-1 py-1 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
// Ligne de tableau, surlignée pour votre équipe.
export function Tr({ mine, children, className = '' }) {
  return (
    <tr
      className={'border-t border-slate-800 [&>td]:px-1 [&>td]:py-1.5 ' + (mine ? 'bg-pink-500/10 ' : '') + className}
    >
      {children}
    </tr>
  );
}
// Jauge (fond, jus, alimentation) : rouge sous 25 %.
export function Meter({ icon, label, v, color }) {
  const p = Math.max(0, Math.min(100, v));
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Icon name={icon} size={14} className="text-slate-400" />
      <span className="w-9 text-slate-400">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className={'h-full rounded-full ' + (v < 25 ? 'bg-rose-500' : color)}
          style={{ width: p.toFixed(0) + '%' }}
        />
      </div>
      <b className="w-7 text-right tabular-nums text-slate-100">{Math.round(v)}</b>
    </div>
  );
}
export function Badge({ children, tone = 'slate' }) {
  const t = {
    slate: 'bg-slate-800 text-slate-200 ring-slate-700',
    red: 'bg-rose-500/15 text-rose-200 ring-rose-500/40',
    sky: 'bg-slate-800/70 text-slate-100 ring-sky-500/40',
  }[tone];
  return <span className={'ml-1 inline-block rounded-md px-1.5 py-0.5 text-xs ring-1 ' + t}>{children}</span>;
}
// Effort du moment : facile, régulier, dur, à bloc.
export function Effort({ I }) {
  if (I == null) return null;
  const [c, t] =
    I < 0.6
      ? ['bg-emerald-400', 'facile']
      : I < 0.8
        ? ['bg-yellow-300', 'régulier']
        : I < 0.95
          ? ['bg-orange-400', 'dur']
          : ['bg-rose-500', 'à bloc'];
  return <span title={t} className={'mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle ' + c} />;
}
// Barre de niveau (portage de bar()) : vert / jaune / rouge, ou bleu pour une caractéristique.
export function Bar({ v, max = 100, tone }) {
  const p = Math.max(0, Math.min(100, (v / max) * 100));
  const T = { b: 'bg-slate-300', g: 'bg-emerald-400', y: 'bg-amber-300', r: 'bg-rose-500' };
  const c = T[tone] || (p > 66 ? 'bg-emerald-400' : p > 33 ? 'bg-yellow-300' : 'bg-rose-500');
  return (
    <span className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-slate-800 align-middle">
      <span className={'block h-full rounded-full ' + c} style={{ width: p + '%' }} />
    </span>
  );
}
// Petite courbe (16 dernières semaines) : forme (vert) et fraîcheur (bleu). Rien sous deux semaines d'historique.
export function Spark({ pts, w = 96, h = 26, label }) {
  if (!pts || pts.length < 2) return null;
  const n = pts.length;
  const X = i => (i / (n - 1)) * (w - 4) + 2;
  // échelle ajustée aux valeurs du coureur (au moins 20 points d'amplitude) : les variations se voient
  const all = pts.flatMap(p => [p[0], p[1]]);
  let lo = Math.min(...all) - 4,
    hi = Math.max(...all) + 4;
  if (hi - lo < 20) {
    const m = (hi + lo) / 2;
    lo = m - 10;
    hi = m + 10;
  }
  const Y = v => h - 2 - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (h - 4);
  const line = k => pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p[k]).toFixed(1)}`).join(' ');
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className="inline-block align-middle"
      role="img"
      aria-label={label}
    >
      <path d={line(1)} fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.8" />
      <path d={line(0)} fill="none" stroke="#34d399" strokeWidth="2" />
      <circle cx={X(n - 1)} cy={Y(pts[n - 1][0])} r="2.2" fill="#34d399" />
    </svg>
  );
}
// Étoiles de potentiel (même échelle que stars() : de ½ à 5).
export function Stars({ v }) {
  const s = Math.max(0.5, Math.min(5, (v - 58) / 6));
  const f = Math.floor(s),
    h = s - f >= 0.5;
  return (
    <span className="whitespace-nowrap text-amber-300">
      {'★'.repeat(f)}
      {h ? '½' : ''}
      <span className="text-slate-600">{'☆'.repeat(5 - f - (h ? 1 : 0))}</span>
    </span>
  );
}
// Couleur d'une valeur de caractéristique (mêmes seuils que statCls).
export function statColor(v) {
  return v >= 80
    ? 'text-fuchsia-300'
    : v >= 74
      ? 'text-emerald-300'
      : v >= 68
        ? 'text-sky-300'
        : v >= 60
          ? 'text-slate-200'
          : 'text-slate-400';
}
export function H2({ children, right }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="font-display text-xl font-semibold leading-tight text-slate-50">{noLead(children)}</h2>
      {right}
    </div>
  );
}
// Liste déroulante tactile.
export function Select({ value, onChange, options, className = '' }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={
        'min-h-10 max-w-full min-w-0 rounded-lg border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100 ' +
        className
      }
    >
      {options.map(([k, l]) => (
        <option key={k} value={k}>
          {l}
        </option>
      ))}
    </select>
  );
}
// Tableau clé / valeur en deux colonnes.
export function KV({ rows }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map(([k, v], i) => (
        <div key={i} className="rounded-xl bg-slate-800/60 px-2.5 py-2">
          <div className="text-xs uppercase tracking-wide text-slate-400">{k}</div>
          <div className="font-semibold text-slate-100">{v}</div>
        </div>
      ))}
    </div>
  );
}
// Onglets tactiles (passent à la ligne sur un écran étroit, jamais de défilement horizontal).
export function Tabs({ items, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-x-5 border-b border-slate-800">
      {items.map(([k, l]) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={
            'min-h-10 text-sm font-medium ' +
            (value === k ? 'text-slate-50 shadow-[inset_0_-3px_0_#f2c94c]' : 'text-slate-400 hover:text-slate-100')
          }
        >
          {l}
        </button>
      ))}
    </div>
  );
}
// Pastilles d'aide à la décision (marché, vivier) : besoin, bonne affaire, risque, information.
export function Pills({ items }) {
  const T = {
    need: 'bg-slate-800/70 text-slate-100 ring-slate-700',
    good: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/40',
    warn: 'bg-amber-400/15 text-amber-100 ring-amber-300/40',
    bad: 'bg-rose-500/15 text-rose-200 ring-rose-400/40',
    info: 'bg-slate-700 text-slate-200 ring-slate-600',
  };
  return (
    <span className="flex flex-wrap gap-1">
      {items.map(([k, t], i) => (
        <span key={i} className={'rounded-md px-1.5 py-0.5 text-xs ring-1 ' + (T[k] || T.info)}>
          {t}
        </span>
      ))}
    </span>
  );
}
