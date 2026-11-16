// Empreinte exacte de la simulation : deux saisons complètes à graine fixe (courses, académie, adjoint,
// mercato, fins de saison), puis un hachage de tout l'état du jeu. Sert à vérifier qu'une optimisation ou un
// nettoyage ne change RIEN (même empreinte avant / après).
// Usage : node tests/fingerprint.js [graine=17]        (≈ 40 s)
const fs = require('fs');
const crypto = require('crypto');
require('vm').runInThisContext(fs.readFileSync(__dirname + '/../dist/engine.js', 'utf8').replace("'use strict';", ''));
const seed = +(process.argv[2] || 17);
newGame('Empreinte', seed);
// une académie et un adjoint actifs, pour couvrir aussi ces chemins
for (const k of ['train', 'contracts', 'recruit', 'academy', 'press', 'equip', 'staff']) setAuto(k, true);
const h = crypto.createHash('sha256');
for (let s = 0; s < 2; s++) {
  let n = 0;
  for (let i = advanceToNextRace(); i >= 0; i = advanceToNextRace()) {
    const c = S.cal[i];
    if (c.worlds) runWorlds(i);
    else if (c.inv && !c.inv.includes(0)) simulateRaceAuto(i);
    else runDelegatedRace(i);
    n++;
  }
  endSeason();
  h.update(JSON.stringify(S));
  console.log(`saison ${s + 1} : ${n} courses`);
}
h.update(String(_sd) + ':' + String(_rid));
console.log('empreinte', h.digest('hex').slice(0, 24));
