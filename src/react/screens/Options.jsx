// Options et écran de démarrage (portage fidèle de viewOpt, showBackups, copySave, startScreen, newGameUI,
// doImport, guideCard et tipCard) : sauvegardes, mode essentiel, nom de l'équipe, nouvelle partie, guide.
import { useEffect, useRef, useState } from 'react';
import { Card, Btn, Html } from '../ui.jsx';

const INPUT = 'min-h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-800 px-3 text-base text-slate-100';
const AREA = 'w-full min-w-0 rounded-xl border border-slate-700 bg-slate-800 p-2 text-sm text-slate-100';
const saveText = () => JSON.stringify({ S, sd: _sd, rid: _rid });

// Bulle « Premiers pas » d'un écran : une seule ligne repliée (la première phrase), qu'on déplie pour lire la suite.
export function TipCard({ view }) {
  S.tipsSeen = S.tipsSeen || {};
  if (S.tipsOff || S.tipsSeen[view] || !TIPS[view]) return null;
  const first = String(TIPS[view])
    .replace(/<[^>]+>/g, '')
    .split(/(?<=[.!?])\s/)[0];
  return (
    <details className="group mb-3 rounded-xl bg-amber-400/10 ring-1 ring-amber-300/40">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm text-amber-100">
        <span>💡</span>
        <span className="min-w-0 flex-1 truncate">{first}</span>
        <span className="shrink-0 text-xs text-amber-200/80 group-open:hidden">plus</span>
      </summary>
      <div className="px-3 pb-3">
        <Html as="div" className="text-sm text-slate-200" html={TIPS[view]} />
        <div className="mt-2 flex flex-wrap gap-2">
          <Btn className="min-h-9" onClick={() => tipDone(view)}>
            Compris
          </Btn>
          <Btn className="min-h-9" onClick={() => ((S.tipsOff = true), save(), render())}>
            Masquer toute l'aide
          </Btn>
        </div>
      </div>
    </details>
  );
}
// Banc d'essai du moteur sur l'appareil : six étapes d'une partie neuve (graine fixe) calculées dans un processus
// séparé (Web Worker), sans toucher à la partie en cours. Référence : 240 ms par étape dans Chrome sur le serveur de test.
const BENCH_REF = 240;
const BENCH_GLUE = `
onmessage = () => {
  try {
    newGame('Banc', 42);
    let st = 0;
    const ms = [];
    while (st < 6) {
      const i = advanceToNextRace();
      if (i < 0) break;
      const cal = S.cal[i];
      if (cal.worlds) { runWorlds(i); continue; }
      const rc = startRace(i, aiSelect(S.teams[0], cal, prepareRaceSpecs(cal)), {});
      while (!rc.done && st < 6) {
        Object.assign(rc.orders, autoOrders(0, rc.specs[rc.si], rc));
        const a = performance.now();
        runStageAuto(rc);
        ms.push(performance.now() - a);
        st++;
        postMessage({ k: st });
      }
    }
    postMessage({ done: true, ms });
  } catch (err) { postMessage({ error: String((err && err.message) || err) }); }
};`;
function EngineBench() {
  const [st, setSt] = useState(null); // null | {k} | {ms} | {error}
  const wref = useRef(null);
  useEffect(() => () => wref.current && wref.current.terminate(), []);
  const run = () => {
    const src = (document.getElementById('engine') || {}).textContent || '';
    if (!src || typeof Worker === 'undefined') return setSt({ error: 'Test impossible sur ce navigateur.' });
    const w = new Worker(URL.createObjectURL(new Blob([src, BENCH_GLUE], { type: 'text/javascript' })));
    wref.current = w;
    setSt({ k: 0 });
    w.onerror = e => {
      w.terminate();
      wref.current = null;
      setSt({ error: 'Le test a échoué : ' + (e.message || 'erreur inconnue') });
    };
    w.onmessage = e => {
      const d = e.data;
      if (d.done || d.error) {
        w.terminate();
        wref.current = null;
      }
      setSt(d.done ? { ms: d.ms } : d.error ? { error: d.error } : { k: d.k });
    };
    w.postMessage({});
  };
  let res = null;
  if (st && st.ms) {
    const avg = st.ms.reduce((a, b) => a + b, 0) / st.ms.length;
    const x = avg / BENCH_REF;
    const verdict =
      avg < 500
        ? ['bg-emerald-500/15 text-emerald-100', 'Rapide : le moteur ne te fera pas attendre.']
        : avg < 1200
          ? ['bg-amber-400/15 text-amber-100', 'Correct : quelques secondes sur les grandes courses déléguées.']
          : ['bg-rose-500/15 text-rose-100', 'Lent : l’optimisation du moteur vaut le coup sur cet appareil.'];
    res = (
      <div className={'mt-2 rounded-xl p-2.5 text-sm ' + verdict[0]}>
        <b>{Math.round(avg)} ms par étape</b> ({fmtDec(x, 1)} × le temps du serveur de test). Un Grand Tour simulé
        prendrait environ <b>{Math.round((avg * 21) / 1000)} s</b>.<div className="mt-1">{verdict[1]}</div>
      </div>
    );
  }
  return (
    <Card title="⚙️ Vitesse du moteur">
      <p className="text-xs text-slate-400">
        Calcule six étapes d'une partie d'essai, à part : ta partie n'est pas touchée. Donne la vitesse réelle de cet
        appareil.
      </p>
      <Btn className="mt-2" disabled={!!st && st.k != null} onClick={run}>
        {st && st.k != null ? `Mesure en cours… ${st.k}/6` : 'Mesurer la vitesse'}
      </Btn>
      {res}
      {st && st.error ? <p className="mt-2 text-sm text-rose-300">{st.error}</p> : null}
    </Card>
  );
}
function Guide() {
  return (
    <Card title="📘 Guide du directeur sportif">
      {GUIDE.map(([t, d]) => (
        <details key={t} className="border-t border-slate-800 py-1 first:border-0">
          <summary className="cursor-pointer py-1.5 text-sm font-semibold text-slate-100">{t}</summary>
          <Html as="p" className="pb-1 text-sm text-slate-300" html={d} />
        </details>
      ))}
      <Btn
        className="mt-2"
        onClick={() => (
          (S.tipsOff = false),
          (S.tipsSeen = {}),
          save(),
          (UI.flash = "Les bulles d'aide sont réactivées."),
          render()
        )}
      >
        Réafficher les premiers pas
      </Btn>
    </Card>
  );
}
// Copies de sécurité de fin de saison (lues dans IndexedDB après l'affichage).
function Backups() {
  const [keys, setKeys] = useState(null);
  useEffect(() => {
    let live = true;
    idbBackups().then(k => live && setKeys(k));
    return () => {
      live = false;
    };
  }, []);
  if (!keys) return null;
  if (!keys.length)
    return (
      <p className="text-xs text-slate-400">Une copie de sécurité est faite automatiquement à chaque fin de saison.</p>
    );
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      Copies de sécurité (avant chaque fin de saison) :
      {keys.map(k => (
        <Btn
          key={k}
          className="min-h-9"
          onClick={() =>
            confirmBox(
              `Revenir à la copie ${k.replace('saison-', 'de fin de saison ')} ? La partie actuelle sera remplacée.`,
              () =>
                idbRestore(k).then(ok => {
                  save();
                  UI.flash = ok ? 'Copie restaurée.' : 'Copie illisible.';
                  UI.view = 'home';
                  render();
                })
            )
          }
        >
          {k.replace('saison-', 'Fin ')}
        </Btn>
      ))}
    </div>
  );
}
function Import({ txt, setTxt, rows = 3, placeholder }) {
  const go = () => {
    if (importSave(txt.trim())) {
      save();
      UI.view = 'home';
      UI.sim = null;
      render();
    } else alertBox('Sauvegarde invalide.');
  };
  return (
    <>
      <textarea
        rows={rows}
        value={txt}
        onChange={e => setTxt(e.target.value)}
        placeholder={placeholder}
        className={AREA}
      />
      <Btn className="mt-2" onClick={go}>
        Importer
      </Btn>
    </>
  );
}
export function Options() {
  const [txt, setTxt] = useState('');
  const [copyLbl, setCopyLbl] = useState('📋 Copier la sauvegarde');
  const [name, setName] = useState(P().name);
  const copy = () => {
    const t = saveText();
    try {
      navigator.clipboard.writeText(t).then(
        () => setCopyLbl('✅ Copié'),
        () => {
          setTxt(t);
          setCopyLbl('Copie bloquée : texte affiché ci-dessous');
        }
      );
    } catch (e) {
      setTxt(t);
    }
  };
  const newGameConfirm = () =>
    confirmBox('Effacer la partie et recommencer ?', () => {
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch (e) {}
      idbClear();
      S = null;
      UI.sim = null;
      stopTimer();
      render();
    });
  return (
    <div className="space-y-3">
      <Card title="Sauvegarde">
        <p className="text-xs text-slate-400">
          La partie est sauvegardée automatiquement dans ce navigateur. Pour la mettre à l’abri, téléchargez
          régulièrement un fichier de sauvegarde.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {UI.idbOk
            ? `Copie compressée : ${Math.round((UI.idbSize || 0) / 1024)} Ko (partie brute : ${Math.round(JSON.stringify(S).length / 1024)} Ko).`
            : 'Copie compressée indisponible sur ce navigateur : sauvegarde locale simple.'}
        </p>
        <div className="my-2 grid grid-cols-2 gap-2">
          <Btn onClick={copy}>{copyLbl}</Btn>
          <Btn onClick={() => dlSave()}>💾 Télécharger</Btn>
        </div>
        <Backups />
        <p className="my-2 text-sm text-slate-200">
          {exportStatus()}
          {UI.persist ? ' · stockage protégé par le navigateur' : ''}
        </p>
        <label className="mb-2 inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-slate-800 px-3 text-sm font-medium text-slate-100 ring-1 ring-slate-700">
          📂 Charger un fichier
          <input
            type="file"
            accept=".json,application/json,text/plain"
            className="hidden"
            onChange={e => importFile(e.target)}
          />
        </label>
        <Import txt={txt} setTxt={setTxt} placeholder="…ou collez une sauvegarde ici pour l'importer" />
      </Card>
      <Card title="Jeu">
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-100">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={!!S.simple}
            onChange={e => (setSimple(e.target.checked), save(), render())}
          />{' '}
          Mode essentiel
        </label>
        <p className="text-xs text-slate-400">
          L'adjoint règle matériel, ravitaillement, plan de course, presse, staff et équipementiers ; les réglages
          restent accessibles (repliés).
        </p>
        {S.disco && DISCO.some(d => !discoOpen(d.k)) ? (
          <div className="mt-3 border-t border-slate-800 pt-3">
            <p className="text-sm text-slate-200">
              Découverte progressive : encore à débloquer —{' '}
              {DISCO.filter(d => !discoOpen(d.k))
                .map(d => d.lbl)
                .join(', ')}
              .
            </p>
            <Btn className="mt-2" onClick={() => (discoAll(), save(), render())}>
              🔓 Tout débloquer maintenant
            </Btn>
          </div>
        ) : null}
      </Card>
      <Card title="🚴 Mode carrière">
        <p className="text-xs text-slate-400">
          Vis la carrière d'un coureur, de 16 ans à la retraite. Partie séparée : ta partie de directeur reste intacte
          (seule la reconversion en fin de carrière propose, avec confirmation, de la remplacer).
        </p>
        <Btn className="mt-2 w-full" onClick={() => switchSlot('car')}>
          Passer au mode carrière
        </Btn>
      </Card>
      <Card title="✏️ Éditeur et base de données">
        <p className="text-xs text-slate-400">
          Renomme les équipes, les coureurs et les courses ; exporte ou importe toute la base (caractéristiques des
          coureurs comprises) ; importe des parcours réels au format GPX.
        </p>
        <Btn primary className="mt-2 w-full" onClick={() => go('names')}>
          Ouvrir l'éditeur
        </Btn>
      </Card>
      <Card title="Équipe">
        <div className="flex gap-2">
          <input value={name} maxLength={30} onChange={e => setName(e.target.value)} className={INPUT} />
          <Btn onClick={() => ((P().name = name || P().name), save(), render())}>Renommer</Btn>
        </div>
      </Card>
      <Card title="Danger">
        <Btn danger onClick={newGameConfirm}>
          Nouvelle partie
        </Btn>
        <p className="mt-2 text-xs text-slate-400">Version 5.0</p>
      </Card>
      <EngineBench />
      <Guide />
    </div>
  );
}
// Écran de démarrage : nom, difficulté, mode essentiel, import.
export function Start() {
  const [name, setName] = useState('Mon Équipe');
  const [diff, setDiff] = useState('normal');
  const [simple, setSimpleOn] = useState(true);
  const [disco, setDisco] = useState(true);
  const [txt, setTxt] = useState('');
  const start = () => {
    const n = (name || 'Mon Équipe').trim();
    newGame(n, Date.now(), diff || 'normal');
    if (simple) setSimple(true);
    if (disco) discoStart();
    save();
    UI.view = 'home';
    render();
  };
  return (
    <Card className="text-center">
      <h1 className="mb-2 text-2xl font-bold text-slate-50">🚴 Directeur Sportif</h1>
      <p className="text-sm text-slate-400">
        Jeu de gestion d'équipe cycliste. Vous ne pilotez pas les coureurs : vous les choisissez, vous les formez et
        vous leur donnez des consignes… qu'ils suivront ou non.
      </p>
      <div className="mx-auto mt-4 max-w-sm space-y-3 text-left">
        <input
          value={name}
          maxLength={30}
          placeholder="Nom de votre équipe"
          onChange={e => setName(e.target.value)}
          className={INPUT}
        />
        <label className="block text-sm text-slate-200">
          Difficulté :{' '}
          <select
            value={diff}
            onChange={e => setDiff(e.target.value)}
            className="min-h-11 rounded-xl border border-slate-700 bg-slate-800 px-2 text-slate-100"
          >
            {Object.entries(DIFF).map(([k, d]) => (
              <option key={k} value={k}>
                {d.lbl}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-400">
          Facile : sponsor plus généreux, frais réduits, objectifs abordables. Difficile : budget serré, sponsor
          exigeant, objectifs ambitieux.
        </p>
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-100">
          <input type="checkbox" className="h-5 w-5" checked={simple} onChange={e => setSimpleOn(e.target.checked)} />{' '}
          Mode essentiel (conseillé pour débuter)
        </label>
        <p className="text-xs text-slate-400">
          L'adjoint règle matériel, ravitaillement, plan de course, presse, staff et équipementiers ; vous gardez la
          sélection, les consignes, la radio, l'effectif et l'académie. Modifiable à tout moment dans ⚙ Options.
        </p>
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-100">
          <input type="checkbox" className="h-5 w-5" checked={disco} onChange={e => setDisco(e.target.checked)} />{' '}
          Découverte progressive
        </label>
        <p className="text-xs text-slate-400">
          Presse, planification, staff, équipementiers, histoires et académie se débloquent au fil de la première saison
          (l'adjoint s'en charge en attendant). Tout débloquer à tout moment dans ⚙ Options.
        </p>
        <Btn primary className="w-full" onClick={start}>
          Nouvelle partie
        </Btn>
        <Btn className="w-full" onClick={() => switchSlot('car')}>
          🚴 Mode carrière : vivre la carrière d'un coureur
        </Btn>
        <details className="text-sm text-slate-300">
          <summary className="cursor-pointer py-2">Importer une sauvegarde</summary>
          <Import txt={txt} setTxt={setTxt} rows={4} placeholder="Collez ici le texte de sauvegarde" />
        </details>
      </div>
    </Card>
  );
}
