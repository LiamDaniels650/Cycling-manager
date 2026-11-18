"""Assemble le moteur pour les tests Node : dist/engine.js. Le jeu (interface React) est assemblé par
tools/build_react.mjs (dist/react.html, copié en dist/index.html par ./dev.sh build)."""
import glob, os
here=os.path.dirname(os.path.abspath(__file__))
def cat(pattern):
    parts=[]
    for f in sorted(glob.glob(os.path.join(here,pattern))):
        parts.append(f"// ---- {os.path.relpath(f,here)} ----\n"+open(f,encoding='utf-8').read())
    return "'use strict';\n"+"\n".join(parts)
engine=cat('src/engine/*.js')
os.makedirs(os.path.join(here,'dist'),exist_ok=True)
open(os.path.join(here,'dist/engine.js'),'w',encoding='utf-8').write(engine)
print('dist/engine.js', len(engine)//1024, 'Ko')
