// Lecture de la course en clair, en haut de l'écran : où en est l'étape, ce qui se passe devant, où sont mes coureurs,
// la prochaine difficulté et, si besoin, un conseil d'action (avec le nom du bouton à utiliser). Et le moment décisif
// en cours : la course s'arrête, son rejeu reste affiché avec ce qu'il faut en retenir jusqu'à ce qu'on reprenne.
import { useState } from 'react';
import { Card, Btn } from '../ui.jsx';
import { SprintReplay } from './Finale.jsx';

const KIND = {
  col: [
    '⛰️',
    'Les 2 derniers kilomètres du col sont rejoués au détail : allure de chacun, réserves, attaques. Les écarts au sommet font éclater le groupe.',
  ],
  desc: [
    '⤵️',
    "La descente est rejouée au détail : l'adresse fait les écarts, ceux qui plongent prennent des risques (chutes possibles).",
  ],
  pave: ['🧱', 'Le secteur pavé est rejoué au détail : placement, puissance sur les pavés, attaques.'],
  bord: [
    '🌬️',
    "La bordure est simulée seconde par seconde : hors de l'éventail, chacun prend le vent de côté ; la course se casse là où un trou s'ouvre.",
  ],
};
const kmTxt = v => (v >= 10 ? Math.round(v) : v.toFixed(1).replace('.', ',')) + ' km';
const gapTxt = s => (s < 60 ? `${Math.round(s)} s` : fmtGap(s).replace(/^\+/, ''));

// Ce qui vient : prochain col, secteur pavé, sprint intermédiaire (depuis la tête de course).
function nextUp(sim, pos) {
  const L = [];
  const c = (sim.klimbs || []).find(c => c.start > pos - 0.05 && c.end < sim.dist + 0.5);
  if (c)
    L.push([
      c.start,
      `⛰️ ${c.name} dans ${kmTxt(c.start - pos)} (${c.len.toFixed(1).replace('.', ',')} km à ${c.avg.toFixed(1).replace('.', ',')} %${c.cat ? ', cat. ' + c.cat : ''})`,
    ]);
  const sc = (sim.P.sectors || []).find(s => s.start > pos);
  if (sc) L.push([sc.start, `🧱 Secteur pavé ${'★'.repeat(sc.stars || 3)} dans ${kmTxt(sc.start - pos)}`]);
  if (sim.isp && !sim.isp.done && sim.isp.at > pos)
    L.push([sim.isp.at, `🟢 Sprint intermédiaire dans ${kmTxt(sim.isp.at - pos)}`]);
  L.sort((a, b) => a[0] - b[0]);
  return L[0] ? L[0][1] : null;
}
// Un conseil d'action, seulement quand la situation l'appelle.
function advice(sim, head, pel, mine) {
  const t = sim.spec.type;
  const kmL = sim.dist - (pel ? pel.pos : 0);
  const ldr = sim.teamLeader[S.teams[0].id];
  const spr = sim.teamSprinter[S.teams[0].id];
  if (ldr && !ldr.fin && !ldr.dnf && pel && ldr.g !== pel && ldr.g.pos < pel.pos - 0.02)
    return `Votre leader ${riderName(ldr.r)} est distancé : faites-le attendre par des équipiers (bouton radio 📻 d'un équipier → « Attendre le leader »).`;
  if (pel && pel.expo && (sim.P.wind || 0) >= 2 && kmL > 3)
    return 'Vent de côté : une bordure peut se former. « Se placer devant » (ordres à toute l’équipe) pour ne pas être piégé.';
  if (head && pel && head !== pel && spr && spr.g === pel && (t === 'plat' || t === 'vallonne')) {
    const gap = gapSec(head, pel);
    if (gap > 150 && kmL < 90 && !head.riders.some(x => x.player))
      return `L'échappée a ${gapTxt(gap)} : si personne ne roule, votre sprinteur ${riderName(spr.r)} ne jouera pas la victoire. « Rouler » (ordres à toute l’équipe) pour la reprendre.`;
  }
  const lowE = mine.filter(x => x.energy < 25 && ['leader', 'sprint'].includes(effOrder(x)));
  if (lowE.length)
    return `${riderName(lowE[0].r)} est dans le dur (énergie ${Math.round(lowE[0].energy)}) : qu'il s'abrite et mange.`;
  return null;
}
export function Situation({ sim }) {
  const live = sim.groups.filter(G => G.riders.some(x => !x.fin && !x.dnf));
  if (!live.length) return null;
  const head = live.slice().sort((a, b) => b.pos - a.pos)[0];
  const pel = sim.pel && live.includes(sim.pel) ? sim.pel : head;
  const mine = sim.runners.filter(x => x.player && !x.fin && !x.dnf);
  const kmL = sim.dist - head.pos;
  // devant
  let front;
  if (head === pel) front = `Tout le monde est groupé : peloton de ${pel.riders.length} coureurs.`;
  else {
    const n = head.riders.length;
    const mh = head.riders.filter(x => x.player);
    const workT = [
      ...new Set(pel.riders.filter(x => x.work > 0).map(x => (x.team.player ? 'votre équipe' : x.team.short))),
    ].slice(0, 3);
    front = `${n === 1 ? riderName(head.riders[0].r) + ' seul' : 'Échappée de ' + n} en tête avec ${gapTxt(gapSec(head, pel))} d'avance${mh.length ? ` (dont ${mh.map(x => riderName(x.r)).join(', ')})` : ''}. ${workT.length ? 'Le peloton est mené par ' + workT.join(', ') + '.' : 'Personne ne roule vraiment dans le peloton.'}`;
  }
  // mes coureurs
  const byG = new Map();
  for (const x of mine) byG.set(x.g, [...(byG.get(x.g) || []), x]);
  const parts = [...byG.entries()]
    .sort((a, b) => b[0].pos - a[0].pos)
    .map(([G, xs]) => {
      const where = G === head && G !== pel ? 'devant' : G === pel ? 'dans le peloton' : `à ${gapTxt(gapSec(head, G))}`;
      return `${xs.length > 2 ? xs.length + ' coureurs' : xs.map(x => riderName(x.r)).join(' et ')} ${where}`;
    });
  const nx = nextUp(sim, head.pos);
  const adv = advice(sim, head, pel, mine);
  const mts = sim.momentTraces || [];
  return (
    <Card className="border-emerald-500/30">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-50">🧭 La course en clair</h3>
        <span className="shrink-0 text-xs tabular-nums text-slate-300">reste {kmTxt(kmL)}</span>
      </div>
      <ul className="mt-1 space-y-1 text-[14px] leading-snug text-slate-100">
        <li>🏁 {front}</li>
        <li>👥 Vos coureurs : {parts.length ? parts.join(' · ') : 'plus personne en course'}.</li>
        {nx ? <li className="text-slate-300">{nx}</li> : null}
      </ul>
      {adv ? (
        <div className="mt-2 rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-sm text-amber-100 ring-1 ring-amber-300/40">
          💡 {adv}
        </div>
      ) : null}
      {mts.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {mts.map((m, i) => (
            <button
              key={i}
              type="button"
              onClick={() => ((UI.momOpen = i), (UI.momPaused = null), renderLive())}
              className="min-h-8 rounded-full bg-slate-800 px-2.5 text-xs text-slate-200 ring-1 ring-slate-700"
            >
              {(KIND[m.kind] || ['⚡'])[0]} Revoir : {m.name}
            </button>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
// Le moment décisif : la course est arrêtée, le rejeu et son explication restent jusqu'à « Reprendre la course ».
export function MomentPanel({ sim }) {
  const [k, setK] = useState(0);
  const i = UI.momOpen;
  const e = i != null && sim.momentTraces ? sim.momentTraces[i] : null;
  if (!e) return null;
  const [ico, why] = KIND[e.kind] || ['⚡', ''];
  const tr = e.tr;
  const mineR = tr.riders.filter(r => r.me);
  const paused = UI.momPaused != null;
  const close = () => {
    const sp = UI.momPaused;
    UI.momOpen = null;
    UI.momPaused = null;
    if (sp) setSpeed(sp);
    else renderLive();
  };
  return (
    <Card tone="action" className="ring-2 ring-amber-300/60">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold text-slate-50">
          {ico} Moment décisif — {e.name} <span className="text-sm font-normal text-slate-300">(km {e.km})</span>
        </h3>
        {paused ? (
          <span className="shrink-0 rounded-full bg-amber-300 px-2 py-0.5 text-xs font-bold text-slate-950">
            ⏸ course en pause
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-slate-300">{why}</p>
      <div className="mt-2">
        <SprintReplay key={i + '-' + k} tr={tr} />
      </div>
      <div className="mt-2 rounded-lg bg-slate-800/70 px-2.5 py-2 text-sm text-slate-100">
        <div dangerouslySetInnerHTML={{ __html: tr.win || '' }} />
        {mineR.length ? (
          <div className="mt-1 text-pink-200">
            Vos coureurs : {mineR.map(r => `${r.n} ${r.gap > 1 ? `à ${Math.round(r.gap)} m` : 'devant'}`).join(' · ')}
          </div>
        ) : (
          <div className="mt-1 text-slate-400">Aucun de vos coureurs dans ce groupe.</div>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Btn onClick={() => setK(k + 1)}>↺ Revoir</Btn>
        <Btn primary onClick={close}>
          {paused ? '▶ Reprendre la course' : 'Fermer'}
        </Btn>
      </div>
    </Card>
  );
}
