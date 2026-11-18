// Éditeur de noms (roadmap, étape 5) : équipes (nom, abréviation, couleur), coureurs (prénom, nom), courses,
// et fichier de noms à exporter, modifier sur ordinateur puis réimporter. Les renommages passent par le moteur
// (39-names.js), qui met aussi à jour l'historique.
import { useState } from 'react';
import { Card, Btn, Tabs, Select, TeamDot } from '../ui.jsx';

const IN = 'min-h-11 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-800 px-2.5 text-[15px] text-slate-100';
function done(err, ok) {
  UI.flash = err ? '⚠️ ' + err : ok;
  save();
  render();
}
function TeamRow({ T }) {
  const [nm, setNm] = useState(T.name);
  const [sh, setSh] = useState(T.short);
  const [col, setCol] = useState(T.color);
  const dirty = nm !== T.name || sh !== T.short || col !== T.color;
  return (
    <div className="rounded-xl bg-slate-800/50 p-2.5">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={col}
          onChange={e => setCol(e.target.value)}
          className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-slate-700 bg-slate-800"
          aria-label="Couleur"
        />
        <input
          value={nm}
          maxLength={30}
          onChange={e => setNm(e.target.value)}
          className={IN}
          aria-label="Nom de l'équipe"
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={sh}
          maxLength={4}
          placeholder="ABR"
          onChange={e => setSh(e.target.value.toUpperCase())}
          className="min-h-11 w-20 shrink-0 rounded-xl border border-slate-700 bg-slate-800 px-2 text-center text-[15px] font-semibold uppercase text-slate-100"
          aria-label="Abréviation"
        />
        <span className="min-w-0 flex-1 text-xs text-slate-400">{T.player ? 'votre équipe' : 'abréviation'}</span>
        <Btn
          primary
          disabled={!dirty}
          className="shrink-0"
          onClick={() => done(renameTeam(T.id, nm, sh, col), `✏️ Équipe renommée : ${esc(nm)}.`)}
        >
          Enregistrer
        </Btn>
      </div>
    </div>
  );
}
function Teams() {
  return (
    <Card title="Équipes">
      <div className="space-y-2">
        {S.teams.map(T => (
          <TeamRow key={T.id + T.name + T.short + T.color} T={T} />
        ))}
      </div>
    </Card>
  );
}
function RiderRow({ r }) {
  const [fn, setFn] = useState(r.fn);
  const [ln, setLn] = useState(r.ln);
  const dirty = fn !== r.fn || ln !== r.ln;
  const T = teamOf(r);
  return (
    <div className="rounded-xl bg-slate-800/50 p-2.5">
      <div className="mb-1.5 text-xs text-slate-400">
        {T ? <TeamDot T={T} /> : null}
        {r.aca ? 'Académie' : T ? T.short : 'libre'} · {ARCH[r.arch].lbl} · {r.age} ans · {r.nat}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={fn} maxLength={24} placeholder="Prénom" onChange={e => setFn(e.target.value)} className={IN} />
        <input value={ln} maxLength={30} placeholder="Nom" onChange={e => setLn(e.target.value)} className={IN} />
      </div>
      {dirty ? (
        <Btn
          primary
          className="mt-2 w-full"
          onClick={() => done(renameRider(r.id, fn, ln), `✏️ Coureur renommé : ${esc(fn)} ${esc(ln)}.`)}
        >
          Enregistrer
        </Btn>
      ) : null}
    </div>
  );
}
function Riders() {
  const [q, setQ] = useState('');
  const [tid, setTid] = useState('0');
  const [page, setPage] = useState(0);
  const norm = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const nq = norm(q.trim());
  const all = Object.values(S.riders).filter(r => !r.retired);
  const L = all
    .filter(r =>
      nq
        ? norm(r.fn + ' ' + r.ln).includes(nq)
        : tid === 'aca'
          ? r.aca
          : tid === 'libre'
            ? r.team == null && !r.aca
            : !r.aca && String(r.team) === tid
    )
    .sort((a, b) => a.ln.localeCompare(b.ln, 'fr'));
  const PER = 25;
  const shown = L.slice(page * PER, page * PER + PER);
  return (
    <Card title="Coureurs">
      <input
        value={q}
        onChange={e => (setQ(e.target.value), setPage(0))}
        placeholder="Rechercher un coureur (toutes équipes)…"
        className={IN}
      />
      {nq ? null : (
        <div className="mt-2">
          <Select
            value={tid}
            onChange={v => (setTid(v), setPage(0))}
            className="w-full"
            options={[...S.teams.map(T => [String(T.id), T.name]), ['aca', 'Académie'], ['libre', 'Sans équipe']]}
          />
        </div>
      )}
      <div className="mt-2 text-xs text-slate-400">{L.length} coureur(s)</div>
      <div className="mt-2 space-y-2">
        {shown.map(r => (
          <RiderRow key={r.id + r.fn + r.ln} r={r} />
        ))}
      </div>
      {L.length > PER ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <Btn disabled={!page} onClick={() => setPage(page - 1)}>
            ← Précédents
          </Btn>
          <span className="text-xs text-slate-400">
            {page + 1}/{Math.ceil(L.length / PER)}
          </span>
          <Btn disabled={(page + 1) * PER >= L.length} onClick={() => setPage(page + 1)}>
            Suivants →
          </Btn>
        </div>
      ) : null}
    </Card>
  );
}
function RaceRow({ d }) {
  const cur = raceNameOf(d.key);
  const [nm, setNm] = useState(cur);
  return (
    <div className="rounded-xl bg-slate-800/50 p-2.5">
      <div className="mb-1.5 text-xs text-slate-400">
        Semaine {d.w} · {d.cat === 0 ? 'Grand Tour' : d.worlds ? 'Mondiaux' : 'cat. ' + d.cat}
        {d.stages.length > 1 ? ` · ${d.stages.length} étapes` : ''}
        {cur !== d.name ? ` · à l'origine : ${d.name}` : ''}
      </div>
      <input value={nm} maxLength={40} onChange={e => setNm(e.target.value)} className={IN} />
      <div className="mt-2 flex gap-2">
        {nm !== cur ? (
          <Btn
            primary
            className="flex-1"
            onClick={() => done(renameRace(d.key, nm), `✏️ Course renommée : ${esc(nm)}.`)}
          >
            Enregistrer
          </Btn>
        ) : null}
        {cur !== d.name ? (
          <Btn
            className="flex-1"
            onClick={() => done(renameRace(d.key, d.name), `↩️ Nom d'origine rétabli : ${esc(d.name)}.`)}
          >
            Nom d'origine
          </Btn>
        ) : null}
      </div>
    </div>
  );
}
function Races() {
  return (
    <Card title="Courses">
      <p className="mb-2 text-xs text-slate-400">Le palmarès, les records et les légendes suivent le nouveau nom.</p>
      <div className="space-y-2">
        {RACE_DEFS.slice()
          .sort((a, b) => a.w - b.w)
          .map(d => (
            <RaceRow key={d.key + raceNameOf(d.key)} d={d} />
          ))}
      </div>
    </Card>
  );
}
function NamesFile() {
  const [txt, setTxt] = useState('');
  const apply = t => {
    let o = null;
    try {
      o = JSON.parse(t);
    } catch (e) {}
    const res = importNames(o);
    if (res.ok) done(null, '✏️ ' + res.txt);
    else alertBox(res.txt);
  };
  const exportFile = async () => {
    const data = JSON.stringify(exportNames(), null, 1);
    try {
      const cl = /** @type {any} */ (window).claude;
      const dl = cl && cl.use ? await cl.use('downloads') : null;
      if (!dl) throw new Error('indisponible');
      await dl.save({ filename: `noms-directeur-sportif-${S.season}.json`, data });
      UI.flash = '💾 Fichier de noms proposé au téléchargement.';
      render();
    } catch (e) {
      setTxt(data);
      UI.flash = 'Téléchargement impossible ici : le fichier est affiché ci-dessous, copiez-le.';
      render();
    }
  };
  return (
    <Card title="Fichier de noms">
      <p className="text-sm text-slate-300">
        Exporte toutes les courses, équipes et coureurs dans un fichier. Modifie-le tranquillement sur ordinateur
        (n'importe quel éditeur de texte), puis réimporte-le : seuls les noms qui ont changé sont appliqués.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Btn onClick={exportFile}>💾 Exporter</Btn>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-slate-800 px-3 text-sm font-medium text-slate-100 ring-1 ring-slate-700">
          📂 Importer
          <input
            type="file"
            accept=".json,application/json,text/plain"
            className="hidden"
            onChange={e => {
              const f = e.target.files && e.target.files[0];
              if (f) f.text().then(apply);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <textarea
        rows={4}
        value={txt}
        onChange={e => setTxt(e.target.value)}
        placeholder="…ou colle ici le contenu d'un fichier de noms"
        className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-800 p-2 text-xs text-slate-100"
      />
      <Btn className="mt-2" disabled={!txt.trim()} onClick={() => apply(txt)}>
        Appliquer le texte collé
      </Btn>
      <p className="mt-2 text-xs text-slate-400">
        Les coureurs sont reconnus par leur numéro (id) : un fichier d'une autre partie renomme les équipes et les
        courses, pas les coureurs.
      </p>
    </Card>
  );
}
// Base complète : noms, attributs des coureurs, parcours (fichier à partager entre joueurs).
function DbFile() {
  const [txt, setTxt] = useState('');
  const apply = t => {
    let o = null;
    try {
      o = JSON.parse(t);
    } catch (e) {}
    const res = importDb(o);
    if (res.ok) done(null, '🗃️ ' + res.txt);
    else alertBox(res.txt);
  };
  const exportFile = async () => {
    const data = JSON.stringify(exportDb(), null, 1);
    try {
      const cl = /** @type {any} */ (window).claude;
      const dl = cl && cl.use ? await cl.use('downloads') : null;
      if (!dl) throw new Error('indisponible');
      await dl.save({ filename: `base-directeur-sportif-${S.season}.json`, data });
      UI.flash = '💾 Base proposée au téléchargement.';
      render();
    } catch (e) {
      setTxt(data);
      UI.flash = 'Téléchargement impossible ici : la base est affichée ci-dessous, copiez-la.';
      render();
    }
  };
  return (
    <Card title="🗃️ Base de données">
      <p className="text-sm text-slate-300">
        Toute la base dans un fichier : équipes, coureurs avec leurs caractéristiques (plat, montagne, collines, sprint,
        chrono, pavés, descente, placement, endurance, récupération, attaque), âge, nationalité, profil, poids,
        caractère, plafond, et les parcours importés. Modifiez-la, partagez-la, réimportez-la.
      </p>
      <ul className="mt-2 list-disc pl-5 text-xs text-slate-400">
        <li>Un coureur est reconnu par son numéro (id) ; les valeurs sont bornées (caractéristiques 30 à 95).</li>
        <li>
          Un coureur sans numéro (avec au moins nom et profil) est créé et rejoint les coureurs libres : c'est ainsi
          qu'on ajoute des coureurs réels.
        </li>
        <li>Un fichier de noms (onglet Fichier) s'importe aussi ici.</li>
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Btn onClick={exportFile}>💾 Exporter la base</Btn>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-slate-800 px-3 text-sm font-medium text-slate-100 ring-1 ring-slate-700">
          📂 Importer
          <input
            type="file"
            accept=".json,application/json,text/plain"
            className="hidden"
            onChange={e => {
              const f = e.target.files && e.target.files[0];
              if (f) f.text().then(apply);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <textarea
        rows={4}
        value={txt}
        onChange={e => setTxt(e.target.value)}
        placeholder="…ou collez ici le contenu d'une base"
        className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-800 p-2 text-xs text-slate-100"
      />
      <Btn className="mt-2" disabled={!txt.trim()} onClick={() => apply(txt)}>
        Appliquer le texte collé
      </Btn>
    </Card>
  );
}
// Parcours réels : une trace GPX devient le profil d'une étape du calendrier.
function Gpx() {
  const races = RACE_DEFS.filter(d => !d.worlds).sort((a, b) => a.w - b.w);
  const [key, setKey] = useState(races[0].key);
  const [si, setSi] = useState(0);
  const [prev, setPrev] = useState(null);
  const d = RACE_DEFS.find(x => x.key === key);
  const stages = d.stages
    .map((st, i) => [i, st])
    .filter(([, st]) => st[2] !== 'R' && !['clm', 'clmeq'].includes(st[0]));
  const k = `${key}:${si}`;
  const cur = (S.customProf || {})[k];
  const read = f =>
    f.text().then(t => {
      const p = parseGpx(t);
      if (p.err) alertBox(p.err);
      else setPrev({ ...p, nom: f.name.replace(/\.gpx$/i, '') });
    });
  return (
    <Card title="🗺️ Parcours GPX">
      <p className="text-sm text-slate-300">
        Importez la trace GPX d'une vraie étape (avec altitudes) : elle devient le parcours de l'étape choisie, saison
        après saison. Le type d'étape (plat, vallonné, bosse, montagne, arrivée au sommet) est déduit du profil.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select
          value={key}
          onChange={v => (setKey(v), setSi(0), setPrev(null))}
          options={races.map(r => [r.key, raceNameOf(r.key)])}
        />
        <Select
          value={String(si)}
          onChange={v => (setSi(+v), setPrev(null))}
          options={stages.map(([i, st]) => [
            String(i),
            `${d.stages.length > 1 ? `Étape ${i + 1} — ` : ''}${typeLbl(st[0])}, ${st[1]} km`,
          ])}
        />
      </div>
      {cur ? (
        <div className="mt-2 rounded-xl bg-slate-800/60 p-2.5 text-sm">
          Parcours actuel : <b>{cur.nom || 'importé'}</b> — {typeLbl(cur.type)}, {cur.dist} km
          <Btn className="ml-2" onClick={() => (clearCustomProfile(k), done(null, '🗺️ Parcours d’origine rétabli.'))}>
            Rétablir l'original
          </Btn>
        </div>
      ) : null}
      <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-slate-800 px-3 text-sm font-medium text-slate-100 ring-1 ring-slate-700">
        📂 Choisir un fichier GPX
        <input
          type="file"
          accept=".gpx,application/gpx+xml,application/xml,text/xml"
          className="hidden"
          onChange={e => {
            const f = e.target.files && e.target.files[0];
            if (f) read(f);
            e.target.value = '';
          }}
        />
      </label>
      {prev ? (
        <div className="mt-3 rounded-xl border border-sky-500/40 p-2.5 text-sm">
          <b>{prev.nom}</b> : {fmtDec(prev.dist)} km, {prev.gain} m de dénivelé positif, départ à {prev.startAlt} m —
          type déduit : <b>{typeLbl(prev.type)}</b>
          <div className="mt-2">
            <Btn
              primary
              onClick={() => {
                const ok = setCustomProfile(k, prev);
                setPrev(null);
                if (ok) done(null, `🗺️ Parcours appliqué à ${raceNameOf(key)}.`);
                else alertBox('Cette étape ne peut pas recevoir de parcours (contre-la-montre ou repos).');
              }}
            >
              Appliquer à cette étape
            </Btn>
          </div>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-slate-400">
        La course en cours n'est pas modifiée ; la prochaine édition prend le nouveau parcours. Les contre-la-montre
        gardent leur parcours.
      </p>
    </Card>
  );
}
const TABS = [
  ['teams', 'Équipes'],
  ['riders', 'Coureurs'],
  ['races', 'Courses'],
  ['file', 'Fichier'],
  ['base', '🗃️ Base'],
  ['gpx', '🗺️ GPX'],
];
export function Names() {
  const tab = UI.namesTab || 'teams';
  const V = { teams: Teams, riders: Riders, races: Races, file: NamesFile, base: DbFile, gpx: Gpx }[tab];
  return (
    <div className="space-y-3">
      <h2 className="px-1 text-lg font-bold text-slate-50">✏️ Éditeur : noms, base, parcours</h2>
      <Tabs items={TABS} value={tab} onChange={k => ((UI.namesTab = k), render())} />
      <V />
    </div>
  );
}
