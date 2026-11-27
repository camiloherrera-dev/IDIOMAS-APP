#!/usr/bin/env python3
"""
Prueba o integra una tanda de contenido del curso de alemán.

Una tanda es una carpeta con archivos en el formato de las fuentes:
  curso.txt       unidades y lecciones nuevas. Secciones: «@@ NEW» (unidades nuevas, al final del nivel)
                  o «@@ <id de unidad>» (lecciones que se añaden a una unidad existente)
  frases.txt, gramatica.txt, escucha.txt, lecturas.txt    se añaden al final del archivo del nivel
  base.txt, nombres.txt                                    líneas extra para esos archivos (opcional)

Uso:
  python3 content-src/de/herramientas/probar_tanda.py b1 content-src/de/_b1/tanda1            prueba
  python3 content-src/de/herramientas/probar_tanda.py b1 content-src/de/_b1/tanda1 --aplicar  integra

Sin --aplicar copia las fuentes a una carpeta temporal, integra allí la tanda y corre
build.py --report --strict: el repositorio no se toca. La tanda está bien cuando no sale
ninguna línea con «✗» ni con «!».

Palabras repetidas: una palabra nueva que ya existe en el mismo nivel o en uno inferior se quita de la
tanda (se avisa); si existe en un nivel superior, su ficha se trae a esta lección con su mismo id.
"""
import os, re, shutil, subprocess, sys, tempfile

LEVELS = ['a1', 'a2', 'b1', 'b2']
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))


def bare(t):
    t = re.sub(r'\([^)]*\)', '', t).strip()
    for a in ('der ', 'die ', 'das '):
        if t.startswith(a): t = t[len(a):]
    return t.strip().rstrip('?!.').lower()


def entry(line):
    """→ (clave, clase) de una línea «palabra = significado»"""
    de = line.split(' = ')[0]
    kind = 'n' if de.startswith(('der ', 'die ', 'das ')) else 'v' if re.search(r' \([^()]*(hat|ist) [^()]*\)$', de) else 'x'
    de = re.sub(r', (¨?-\w*|¨|\(Sg\.\)|\(Pl\.\))$', '', de)
    de = re.sub(r' \([^()]*(hat|ist) [^()]*\)$', '', de).replace('|', '')
    return bare(de), kind


def blocks(lines):
    """fichas de un archivo de curso: clave → [(inicio, fin, tiene id, clase)]"""
    out, i = {}, 0
    while i < len(lines):
        l = lines[i]
        if l and not l.startswith(('==', '--', '+', '#', ' ', '@@')) and ' = ' in l:
            j = i + 1
            while j < len(lines) and lines[j].startswith('  '): j += 1
            body = lines[i + 1:j]
            key, kind = entry(l)
            pos = next((x.split(': ', 1)[1] for x in body if x.startswith('  pos:')), None)
            if pos: kind = 'n' if pos == 'sustantivo' else 'v' if pos == 'verbo' else 'x'
            out.setdefault(key, []).append((i, j, any(x.startswith('  id:') for x in body), kind))
            i = j
        else: i += 1
    return out


def merge(root, level, tanda):
    src = os.path.join(root, 'content-src', 'de')
    read = lambda p: open(p, encoding='utf-8').read()
    add = read(os.path.join(tanda, 'curso.txt')) if os.path.exists(os.path.join(tanda, 'curso.txt')) else ''
    path = os.path.join(src, 'curso', f'{level}.txt')
    s = (read(path).rstrip('\n') + '\n') if os.path.exists(path) else ''
    parts = re.split(r'^@@ (\S+)\n', add, flags=re.M)[1:]
    for uid, body in zip(parts[::2], parts[1::2]):
        body = body.strip('\n') + '\n'
        if uid == 'NEW': s = s + '\n' + body; continue
        if '== ' + uid + ' ' not in s: sys.exit(f'✗ curso.txt: la unidad {uid} no existe en {level}')
        i = s.index('== ' + uid + ' '); j = s.find('\n== ', i + 1)
        s = s[:j].rstrip('\n') + '\n\n' + body + s[j:] if j > 0 else s.rstrip('\n') + '\n\n' + body
    files = {lv: read(os.path.join(src, 'curso', f'{lv}.txt')).split('\n')
             for lv in LEVELS if os.path.exists(os.path.join(src, 'curso', f'{lv}.txt'))}
    files[level] = s.split('\n')
    lower = LEVELS[:LEVELS.index(level)]
    higher = LEVELS[LEVELS.index(level) + 1:]
    dropped, moved = [], []
    while True:
        B = {lv: blocks(L) for lv, L in files.items()}
        changed = False
        for key, lst in B[level].items():
            new = [b for b in lst if not b[2]]
            if not new: continue
            ni, nj, _, kind = new[0]
            same = lambda b: b[3] == kind
            exists = any(same(b) for lv in lower for b in B.get(lv, {}).get(key, [])) or any(b[2] and same(b) for b in lst) \
                or len([b for b in new if same(b)]) > 1
            if exists:
                del files[level][ni:nj]; dropped.append(key); changed = True; break
            for lv in higher:
                old = [b for b in B.get(lv, {}).get(key, []) if b[2] and same(b)]
                if old:
                    oi, oj = old[0][0], old[0][1]
                    block = files[lv][oi:oj]
                    tid = next(x.split(': ', 1)[1] for x in block if x.startswith('  id:'))
                    files[lv][oi:oj] = ['+ ' + tid]; files[level][ni:nj] = block
                    moved.append(key); changed = True; break
            if changed: break
        if not changed: break
    for lv, L in files.items():
        open(os.path.join(src, 'curso', f'{lv}.txt'), 'w', encoding='utf-8').write('\n'.join(L).rstrip('\n') + '\n')
    for kind in ('frases', 'gramatica', 'escucha', 'lecturas'):
        p = os.path.join(tanda, f'{kind}.txt')
        if os.path.exists(p):
            os.makedirs(os.path.join(src, kind), exist_ok=True)
            open(os.path.join(src, kind, f'{level}.txt'), 'a', encoding='utf-8').write('\n' + read(p).strip('\n') + '\n')
    for name in ('base.txt', 'nombres.txt'):
        p = os.path.join(tanda, name)
        if os.path.exists(p): open(os.path.join(src, name), 'a', encoding='utf-8').write('\n' + read(p).strip('\n') + '\n')
    if dropped: print('quitadas de la tanda porque ya están en el curso:', ' '.join(dropped))
    if moved: print('traídas de un nivel superior con su id:', ' '.join(moved))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 2 or args[0] not in LEVELS: sys.exit(__doc__)
    level, tanda = args[0], os.path.abspath(args[1])
    if '--aplicar' in sys.argv:
        merge(REPO, level, tanda)
        sys.exit(subprocess.call([sys.executable, os.path.join(REPO, 'content-src', 'de', 'build.py'), '--report', '--strict']))
    tmp = tempfile.mkdtemp(prefix='tanda-')
    try:
        shutil.copytree(os.path.join(REPO, 'content-src', 'de'), os.path.join(tmp, 'content-src', 'de'),
                        ignore=shutil.ignore_patterns('_b1', '_b2', '_tmp', 'referencia', '__pycache__'))
        shutil.copytree(os.path.join(REPO, 'src', 'languages', 'de', 'content', 'grammar'),
                        os.path.join(tmp, 'src', 'languages', 'de', 'content', 'grammar'))
        merge(tmp, level, tanda)
        code = subprocess.call([sys.executable, os.path.join(tmp, 'content-src', 'de', 'build.py'), '--report', '--strict'])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    sys.exit(code)


if __name__ == '__main__':
    main()
