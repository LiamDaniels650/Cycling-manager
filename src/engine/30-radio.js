/* Radio vivante : les coureurs du joueur appellent la voiture et attendent une décision ; négociations et pactes
   dans l'échappée (« roule avec moi, je te laisse l'étape »). Une question à la fois ; sans réponse, le coureur
   décide seul ; avec le DS automatique, la voiture répond aussitôt. */

const ASK_TTL = 6; // 6 minutes de course pour répondre (sim.t est en minutes)
const ASK_GAP = 4; // au moins 4 minutes entre deux appels

// Groupe d'échappée (devant le peloton) où roule un coureur du joueur.
function breakGroupOf(sim, x) {
  const G = x.g,
    pel = sim.pel;
  if (!G || !pel || G === pel || G.pos <= pel.pos + 0.03) return null;
  if (G.riders.length < 2 || G.riders.length > 14) return null;
  return G;
}
// Capacité d'un coureur rapportée au meilleur autre coureur de son groupe.
function relStrength(x, G) {
  const [g, surf] = [G.g, G.surf];
  let best = 0;
  for (const y of G.riders) if (y !== x && !y.fin) best = Math.max(best, cap(y, g, surf));
  return cap(x, g, surf) / (best || 1);
}
// Qualité de finisseur sur l'arrivée du jour (sprint au plat, puissance en côte).
function finishPower(sim, x) {
  return sim.P.finishGrad < 3
    ? x.r.s.spr * (0.7 + 0.3 * Math.min(1, x.energy / 45))
    : cap(x, Math.max(4, sim.P.finishGrad), 0);
}
// Un coureur a-t-il un intérêt au général à faire l'effort (et donc à proposer l'étape contre de l'aide) ?
function gcAmbition(sim, x) {
  if (!sim.stageRace) return false;
  const rk = leaderGcRank(sim.rc, x.id);
  return rk > 0 && rk <= 30;
}
// Pose une question à la voiture (une seule à la fois).
function askOpen(sim, a) {
  if (sim.carId != null) return false; // mode carrière : pas d'appels du coureur au directeur sportif
  sim.askMem = sim.askMem || {};
  if (sim.askMem[a.key]) return false;
  sim.askMem[a.key] = sim.t;
  sim.ask = { ...a, exp: sim.t + ASK_TTL };
  sim.askT = sim.t;
  log(sim, a.txt, 'me');
  highlight(sim, a.txt, true);
  if (sim.autoDS) {
    const k = a.auto();
    const o = a.opts.find(o => o[0] === k);
    log(sim, `🤖 DS : « ${o ? o[1] : k} »`, 'me');
    askAnswer(sim, k, 'auto');
  } else if (sim.autoPause) sim.pauseReq = sim.pauseReq || a.txt.replace(/^📻 /, '');
  return true;
}
// Réponse (du joueur, du DS automatique, ou décision du coureur à l'expiration).
function askAnswer(sim, k, src) {
  const a = sim.ask;
  if (!a) return;
  sim.ask = null;
  a.act(k, src);
}

function radioTick(sim) {
  // fin des pactes dont un des deux a été lâché
  for (const pc of sim.pacts || []) {
    if (pc.done) continue;
    if (pc.p.fin && pc.a.fin) continue;
    if (pc.p.dnf || pc.a.dnf || (!pc.p.fin && !pc.a.fin && pc.p.g !== pc.a.g && sim.t - pc.t > 2)) {
      pc.done = true;
      if (!pc.ai)
        log(sim, `🤝 Pacte caduc : ${riderName(pc.p.r)} et ${riderName(pc.a.r)} ne sont plus ensemble.`, 'info');
    }
  }
  // coureurs qui ne relaient pas dans une échappée (compteur de pas)
  for (const x of sim.runners) if (!x.fin && !x.dnf) x.sitN = x.work > 0.5 ? 0 : (x.sitN || 0) + 1;
  aiPactTick(sim);
  const a = sim.ask;
  if (a && sim.t >= a.exp) {
    // sans réponse, le coureur juge lui-même la situation (comme le ferait un directeur sportif) ; seuls les
    // caractères marqués (tête brûlée, équipier modèle) suivent leur pente
    const x = a.xid != null ? sim.runners.find(y => y.id === a.xid) : null;
    const k = !x || ['tete', 'modele'].includes(x.r.trait) ? a.def : a.auto();
    const o = a.opts.find(o => o[0] === k);
    log(
      sim,
      `📻 Pas de réponse de la voiture : ${k === a.def ? a.self : `il choisit seul : « ${o ? o[1] : k} ».`}`,
      'info'
    );
    askAnswer(sim, k, 'self');
  }
  if (sim.ask || sim.t - (sim.askT ?? -99) < ASK_GAP) return;
  const mine = sim.runners.filter(x => x.player && !x.fin && !x.dnf && x.g);
  for (const x of mine) if (askPacteOffer(sim, x) || askRelais(sim, x) || askBloc(sim, x) || askJambes(sim, x)) return;
}

// 1. « Je suis à bloc » : un équipier qui roule depuis longtemps est dans le rouge.
function askBloc(sim, x) {
  const eo = effOrder(x),
    kmLeft = sim.dist - x.g.pos;
  if (x.work < 0.75 || x.energy > 22 || kmLeft < 25 || x.blocOK) return false;
  if (!['chase', 'tempo', 'protect', 'control', 'leadout', 'free'].includes(eo)) return false;
  const nm = riderName(x.r);
  return askOpen(sim, {
    key: 'bloc', // une fois par étape : la voiture tranche pour toute l'équipe
    xid: x.id,
    txt: `📻 ${nm} : « Je suis à bloc, je ne vais pas tenir longtemps à ce rythme. Je continue ? »`,
    opts: [
      ['go', 'Continue, on a besoin de toi'],
      ['stop', 'Relève-toi, garde des forces'],
    ],
    def: x.r.trait === 'modele' ? 'go' : 'stop',
    self: x.r.trait === 'modele' ? `${nm} continue de rouler.` : `${nm} se relève.`,
    auto: () => 'stop',
    act: (k, src) => {
      if (k === 'go') {
        x.blocOK = true;
        if (src !== 'self') log(sim, `📻 ${nm} : « ${radioReply(x, 'ok')} »`, 'me');
      } else {
        x.radio = 'stop';
        if (src !== 'self') log(sim, `📻 ${nm} se relève pour récupérer.`, 'me');
      }
    },
  });
}

// 2. « Il ne passe plus ses relais » : un coureur se fait tirer dans l'échappée.
function askRelais(sim, x) {
  const G = breakGroupOf(sim, x);
  if (!G || sim.brkState === 'fight' || sim.dist - G.pos < 8 || effOrder(x) === 'nopull' || effOrder(x) === 'stop')
    return false;
  const y = G.riders.find(
    y => !y.player && !y.fin && (y.sitN || 0) >= 8 && !(y.pact && !y.pact.done) && !(y.sulkUntil > sim.t)
  );
  if (!y) return false;
  const nm = riderName(x.r),
    ny = riderName(y.r);
  const faster = finishPower(sim, y) > finishPower(sim, x) * 1.02;
  return askOpen(sim, {
    key: 'relais' + x.id,
    xid: x.id,
    txt: `📻 ${nm} : « ${ny} (${y.team.short}) ne passe plus ses relais, il se fait tirer${faster ? ' et il est plus rapide que moi au final' : ''}. Je fais quoi ? »`,
    opts: [
      ['go', 'Continue à rouler, l’échappée avant tout'],
      ['nopull', 'Arrête de relayer toi aussi'],
      ['att', 'Attaque pour le lâcher'],
    ],
    def: 'go',
    self: `${nm} continue de rouler.`,
    auto: () => (faster ? (x.punch > 45 && x.energy > 35 ? 'att' : 'nopull') : 'go'),
    act: (k, src) => {
      if (k === 'nopull') {
        x.radio = 'nopull';
        log(sim, `📻 ${nm} ne relaie plus : « S'il ne roule pas, je ne roule pas. »`, 'me');
      } else if (k === 'att') {
        if (!doAttack(sim, x)) log(sim, `📻 ${nm} : « ${radioReply(x, 'legs')} »`, 'bad');
      } else if (src !== 'self') log(sim, `📻 ${nm} : « D'accord, je roule. »`, 'me');
    },
  });
}

// 3. « J'ai de bonnes jambes » : le leader se sent le plus fort dans le final et demande le feu vert.
function askJambes(sim, x) {
  if (effOrder(x) !== 'leader' || !x.player || sim.autoDS) return false;
  const t = sim.spec.type,
    G = x.g,
    kmLeft = sim.dist - G.pos;
  if (!['montagne', 'sommet', 'punch', 'vallonne', 'paves'].includes(t)) return false;
  if (kmLeft > 15 || kmLeft < 2 || G.riders.length < 3 || G.riders.length > 30 || G.g < 3) return false;
  if (sim.t - (x.lastAtt || -99) < 10 || x.energy < 40 || x.punch < 55) return false;
  if (!G.riders.some(y => y.team !== x.team && sim.favs.has(y.id))) return false;
  const rs = relStrength(x, G);
  if (rs < 1.0) return false;
  const nm = riderName(x.r);
  return askOpen(sim, {
    key: 'jambes' + x.id,
    xid: x.id,
    txt: `📻 ${nm} : « J'ai de très bonnes jambes, les autres sont à la limite. J'y vais ? »`,
    opts: [
      ['go', 'Vas-y, attaque !'],
      ['wait', 'Attends encore un peu'],
    ],
    def: x.r.trait === 'tete' ? 'go' : 'wait',
    self: x.r.trait === 'tete' ? `${nm} n'attend pas la réponse et attaque !` : `${nm} patiente.`,
    auto: () => (rs >= 1.02 || kmLeft < 6 ? 'go' : 'wait'),
    act: (k, src) => {
      if (k === 'go') {
        if (!doAttack(sim, x)) log(sim, `📻 ${nm} : « ${radioReply(x, 'legs')} »`, 'bad');
      } else {
        x.lastAtt = sim.t;
        if (src !== 'self') log(sim, `📻 ${nm} : « Reçu, j'attends ton signal. »`, 'me');
      }
    },
  });
}

// --- Pactes dans l'échappée ---
// type 'etape' : le coureur du joueur roule pour le général de l'autre, qui lui laisse la victoire d'étape ;
// type 'temps' : l'autre roule pour le général du coureur du joueur, qui lui laisse l'étape.
function pactYielder(pc) {
  return pc.type === 'etape' ? pc.a : pc.p;
}
function pactMake(sim, p, a, type) {
  const pc = { p, a, type, t: sim.t, done: false };
  (sim.pacts = sim.pacts || []).push(pc);
  p.pact = a.pact = pc;
  return pc;
}
function pactTxt(pc) {
  return pc.type === 'etape'
    ? `${riderName(pc.p.r)} roule pour le général de ${riderName(pc.a.r)}, qui lui laisse l'étape`
    : `${riderName(pc.a.r)} roule pour le général de ${riderName(pc.p.r)}, qui lui laisse l'étape`;
}
// Proposition d'un coureur adverse ambitieux au général.
function askPacteOffer(sim, x) {
  const G = breakGroupOf(sim, x);
  if (!G || !sim.stageRace || x.pact) return false;
  const kmLeft = sim.dist - G.pos;
  if (kmLeft > 70 || kmLeft < 12 || gapSec(G, sim.pel) < 60) return false;
  const a = G.riders.find(
    y =>
      !y.player &&
      !y.fin &&
      !y.pact &&
      gcAmbition(sim, y) &&
      sim.teamLeader[y.team.id] === y &&
      (!gcAmbition(sim, x) || leaderGcRank(sim.rc, y.id) < leaderGcRank(sim.rc, x.id))
  );
  if (!a) return false;
  const nm = riderName(x.r),
    na = riderName(a.r),
    rk = leaderGcRank(sim.rc, a.id);
  return askOpen(sim, {
    key: 'pacte' + x.id + '-' + a.id,
    xid: x.id,
    txt: `📻 ${nm} : « ${na} (${a.team.short}, ${rk}ᵉ du général) me propose un marché : je roule avec lui jusqu'à l'arrivée, il me laisse l'étape. On accepte ? »`,
    opts: [
      ['yes', 'Accepte le pacte'],
      ['no', 'Refuse'],
    ],
    def: 'no',
    self: `${nm} ne s'engage à rien.`,
    auto: () => 'yes',
    act: k => {
      if (k === 'yes') {
        const pc = pactMake(sim, x, a, 'etape');
        log(sim, `🤝 Pacte conclu : ${pactTxt(pc)}.`, 'me');
      } else {
        a.sulkUntil = sim.t + 20;
        addTeamRel(a.team.id, -0.5);
        log(sim, `🤝 ${na} est vexé : « Tant pis, je ne roule plus non plus. »`, 'bad');
      }
    },
  });
}
// Négociation demandée par le joueur : candidats (adversaires présents dans l'échappée d'un de ses coureurs).
function negoState(sim) {
  const x = sim.runners.find(x => x.player && !x.fin && !x.dnf && breakGroupOf(sim, x));
  if (!x) return null;
  const G = x.g;
  const others = G.riders.filter(y => !y.player && !y.fin);
  if (!others.length) return null;
  const mineGc = gcAmbition(sim, x);
  const cands = others
    .filter(y => !y.pact)
    .map(y => {
      // je veux du temps et il ne vise pas le général → il roule pour moi contre l'étape ; l'inverse sinon
      const type = sim.stageRace && mineGc && !gcAmbition(sim, y) ? 'temps' : gcAmbition(sim, y) ? 'etape' : null;
      return { y, type };
    })
    .filter(c => c.type)
    .slice(0, 3);
  return { x, G, others, cands };
}
function negoAsk(sim, k, yid) {
  const st = negoState(sim);
  if (!st) return 'Aucun de vos coureurs dans une échappée.';
  if (sim.t - (sim.negoT ?? -99) < 10) return 'Laissez passer quelques minutes avant de renégocier.';
  sim.negoT = sim.t;
  const { x, G, others } = st;
  const nm = riderName(x.r);
  if (k === 'coop') {
    const pel = sim.pel;
    const gap = gapSec(G, pel);
    const res = [];
    for (const y of others) {
      const spBehind = sim.teamSprinter[y.team.id] && sim.teamSprinter[y.team.id].g === pel && sim.P.finishGrad < 3;
      const ldBehind =
        sim.teamLeader[y.team.id] && sim.teamLeader[y.team.id].g === pel && sim.teamLeader[y.team.id] !== y;
      const p = clamp(
        0.45 +
          0.1 * teamRelOf(y.team.id) +
          (gap < 120 ? 0.2 : 0) -
          (spBehind || ldBehind ? 0.45 : 0) -
          (y.sulkUntil > sim.t ? 0.3 : 0),
        0.05,
        0.95
      );
      if (rnd() < p) {
        y.coopUntil = sim.t + 30;
        res.push(riderName(y.r));
      }
    }
    const no = others.length - res.length;
    log(
      sim,
      `🤝 ${nm} demande à tout le monde de rouler : ${res.length ? res.join(', ') + ' acceptent' : 'personne ne suit'}${res.length && no ? ` ; ${no} refuse${no > 1 ? 'nt' : ''} (« on a un leader derrière »)` : ''}.`,
      res.length ? 'me' : 'bad'
    );
    return res.length ? `${res.length} coureur(s) acceptent de rouler.` : 'Personne ne veut rouler.';
  }
  const c = st.cands.find(c => c.y.id === yid);
  if (!c) return 'Proposition impossible.';
  const { y, type } = c;
  const ny = riderName(y.r);
  let p = 0.3 + 0.12 * teamRelOf(y.team.id);
  if (type === 'etape') p += 0.35 + (x.energy > 50 ? 0.1 : 0);
  else p += finishPower(sim, x) > finishPower(sim, y) ? 0.3 : 0.1;
  if (y.sulkUntil > sim.t) p -= 0.25;
  if (rnd() < clamp(p, 0.05, 0.9)) {
    const pc = pactMake(sim, x, y, type);
    log(sim, `🤝 ${ny} accepte : ${pactTxt(pc)}.`, 'me');
    return `${ny} accepte le pacte.`;
  }
  log(sim, `🤝 ${ny} refuse : « Je joue ma carte, désolé. »`, 'bad');
  return `${ny} refuse.`;
}
// Le joueur rompt un pacte (il ne laissera pas l'étape) : réputation entachée auprès de l'équipe trahie.
function pactBreak(sim) {
  const pc = (sim.pacts || []).find(pc => !pc.done && !pc.ai);
  if (!pc) return;
  pc.done = true;
  pc.p.pact = pc.a.pact = null;
  addTeamRel(pc.a.team.id, -2);
  log(sim, `🤝 Vous rompez le pacte avec ${riderName(pc.a.r)}. ${pc.a.team.name} ne l'oubliera pas.`, 'bad');
}
// Comportement dans l'échappée : effet des pactes, des accords de relais et des bouderies.
function pactWork(sim, x, G, kmLeft) {
  const pc = x.pact;
  const partner = pc && !pc.done ? (pc.p === x ? pc.a : pc.p) : null;
  if (partner && partner.g === G && kmLeft > 1.2) x.work = Math.max(x.work, 0.88);
  if (x.coopUntil > sim.t && kmLeft > 1.2) x.work = Math.max(x.work, 0.85);
  if (x.sulkUntil > sim.t) x.work = Math.min(x.work, 0.3);
  // celui qui laisse l'étape n'attaque pas son partenaire
  return !!(partner && partner.g === G && pactYielder(pc) === x);
}
// À l'arrivée : celui qui s'est engagé laisse passer son partenaire (ou le trahit).
function pactFinish(sim, ord) {
  for (const pc of sim.pacts || []) {
    if (pc.done) continue;
    const win = !sim.finish.length;
    const yl = pactYielder(pc),
      bn = yl === pc.p ? pc.a : pc.p;
    const iy = ord.findIndex(o => o[0] === yl),
      ib = ord.findIndex(o => o[0] === bn);
    if (iy < 0 || ib < 0) continue;
    pc.done = true;
    const cls = pc.ai ? 'info' : 'me';
    if (iy > ib) {
      if (!pc.ai) {
        log(sim, `🤝 Pacte respecté : ${riderName(bn.r)} devance ${riderName(yl.r)}.`, cls);
        addTeamRel(pc.a.team.id, 0.5);
      }
      continue;
    }
    const betray =
      !yl.player &&
      rnd() <
        clamp(
          0.1 + (yl.r.trait === 'tete' || yl.r.trait === 'gagneur' ? 0.12 : 0) - 0.03 * teamRelOf(yl.team.id),
          0.02,
          0.35
        );
    if (betray) {
      if (!pc.ai) addTeamRel(yl.team.id, -2);
      log(
        sim,
        `🗡️ Trahison ! ${riderName(yl.r)} ne respecte pas le pacte et sprinte devant ${riderName(bn.r)}.`,
        pc.ai ? 'att' : 'bad'
      );
      highlight(sim, `🗡️ ${riderName(yl.r)} trahit le pacte !`, !pc.ai);
      continue;
    }
    const [e] = ord.splice(iy, 1);
    const jb = ord.findIndex(o => o[0] === bn);
    e[1] = Math.min(e[1], ord[jb][1] - 0.05); // un souffle derrière (arrivée en côte : quelques dixièmes)
    ord.splice(jb + 1, 0, e);
    if (!pc.ai) addTeamRel(pc.a.team.id, 0.5);
    const how = win ? `laisse la victoire à ${riderName(bn.r)}` : `laisse passer ${riderName(bn.r)}`;
    if (!pc.ai || win)
      log(sim, `🤝 ${pc.ai ? 'Entente respectée' : 'Pacte respecté'} : ${riderName(yl.r)} ${how}.`, cls);
  }
}

// Ententes entre coureurs IA : un leader ambitieux au général, échappé, achète l'aide d'un chasseur d'étapes
// d'une autre équipe en lui promettant la victoire (ou l'inverse se refuse : le chasseur garde ses forces).
function aiPactTick(sim) {
  if (!sim.stageRace || sim.brkState === 'fight' || !sim.pel) return;
  if (Math.round(sim.t * 2) % 4) return; // une négociation possible toutes les 2 minutes
  for (const G of sim.groups) {
    if (G === sim.pel || G.pos <= sim.pel.pos || G.riders.length < 2 || G.riders.length > 10) continue;
    const kmLeft = sim.dist - G.pos;
    if (kmLeft > 70 || kmLeft < 12 || gapSec(G, sim.pel) < 60) continue;
    const free = G.riders.filter(y => !y.player && !y.fin && !y.pact);
    const A = free.find(y => sim.teamLeader[y.team.id] === y && gcAmbition(sim, y));
    if (!A) continue;
    const fa = finishPower(sim, A);
    // le chasseur d'étapes accepte s'il n'est pas certain de battre le leader au final
    const B = free.find(
      y =>
        y.team !== A.team &&
        !gcAmbition(sim, y) &&
        sim.teamLeader[y.team.id] !== y &&
        !(sim.teamLeader[y.team.id] && sim.teamLeader[y.team.id].g === sim.pel && kmLeft < 40)
    );
    if (!B) continue;
    sim.aiPactAsk = sim.aiPactAsk || new Set();
    const key = A.id + '-' + B.id;
    if (sim.aiPactAsk.has(key)) continue;
    sim.aiPactAsk.add(key);
    if (rnd() >= (finishPower(sim, B) < fa * 1.03 ? 0.55 : 0.3)) continue;
    const pc = pactMake(sim, B, A, 'etape');
    pc.ai = true;
    if (sim.favs.has(A.id) || G === sim.groups[0])
      log(
        sim,
        `🤝 Entente dans l'échappée : ${riderName(B.r)} (${B.team.short}) roule pour ${riderName(A.r)} (${A.team.short}), qui lui laisse l'étape.`,
        'info'
      );
  }
}
