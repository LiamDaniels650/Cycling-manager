"""Assemble les sources en un seul fichier jouable : dist/index.html (+ dist/engine.js pour les tests Node)."""
import glob, os
here=os.path.dirname(os.path.abspath(__file__))
def cat(pattern):
    parts=[]
    for f in sorted(glob.glob(os.path.join(here,pattern))):
        parts.append(f"// ---- {os.path.relpath(f,here)} ----\n"+open(f,encoding='utf-8').read())
    return "'use strict';\n"+"\n".join(parts)
engine=cat('src/engine/*.js'); ui=cat('src/ui/*.js')
os.makedirs(os.path.join(here,'dist'),exist_ok=True)
open(os.path.join(here,'dist/engine.js'),'w',encoding='utf-8').write(engine)
shell=open(os.path.join(here,'src/shell.html'),encoding='utf-8').read()
html=shell.replace('/*ENGINE*/',engine).replace('/*UI*/',ui)
open(os.path.join(here,'dist/index.html'),'w',encoding='utf-8').write(html)
print('dist/index.html', len(html)//1024, 'Ko')
