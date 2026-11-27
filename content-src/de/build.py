#!/usr/bin/env python3
"""
Construye el curso de alemán a partir de las fuentes de esta carpeta:

  curso/{a1,a2,b1,b2}.txt   esqueleto del curso: unidades, lecciones de vocabulario y sus palabras
  manual/<leccion>.json     ejercicios escritos a mano de una lección (las del curso anterior)
  frases/{nivel}.txt        frases en contexto: Ich [rufe=anrufen] dich [an=anrufen]. | Te llamo.
  gramatica/{nivel}.txt     puntos gramaticales con explicación y frases
  escucha/{nivel}.txt       diálogos de escucha
  lecturas/{nivel}.txt      lecturas con preguntas
  base.txt                  palabras gramaticales y sus formas (no son tarjetas, pero se pueden usar)
  nombres.txt               nombres propios
  legacy-terms.json         ids antiguos de términos → id actual
  legacy-lecciones.json     ids antiguos de lecciones → id actual

Escribe src/languages/de/content/{vocab,units,grammar}/, legacy.json y legacy-lessons.json.

Uso: python3 content-src/de/build.py [--report] [--strict] [--cobertura]
  --report     muestra los avisos (palabras fuera de nivel, lecciones con pocas frases)
  --strict     además avisa si una frase usa una palabra que se enseña después de su lección
  --cobertura  compara el vocabulario con referencia/{nivel}.txt (un lema por línea), si existe

Formato de curso/*.txt:
  == <id unidad> | <nivel> | <título> | <descripción> | [sin-repaso]
  -- <id lección> | <título> | [intro=<guía>]
  der Tisch = la mesa            ← palabra nueva; debajo, con dos espacios, sus campos:
    id: de-a1-0101               (opcional; si falta es de-w-<palabra>)
    pos: sustantivo              (opcional en sustantivos con artículo)
    tags: casa, muebles
    g: m   pl: die Tische        sustantivos (cada campo en su línea)
    p3: er ruft an   pret: rief an   perf: hat angerufen   sep: sí      verbos
    formas: ...                  formas irregulares que el generador no deduce
    ej: Der Tisch ist neu. = La mesa es nueva.
    n: nota para la ficha
  + de-a1-0005                   ← palabra ya presentada que esta lección repasa
"""
import json, re, sys, os, glob, collections, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lemas import Lexicon, words, ARTICLES

OUT = os.path.join(HERE, '..', '..', 'src', 'languages', 'de', 'content')
REPORT, STRICT, COVERAGE = '--report' in sys.argv, '--strict' in sys.argv, '--cobertura' in sys.argv
LEVELS = ['A1', 'A2', 'B1', 'B2']
KEY = {'g': 'gender', 'pl': 'plural', 'p3': 'present3', 'pret': 'praeteritum', 'perf': 'perfekt', 'sep': 'separable', 'formas': 'formas'}
TIMED_FROM = 'B1'          # lecturas con límite de tiempo desde este nivel
SPANISH_QUESTIONS = {'A1'}  # niveles en que las preguntas de las lecturas van en español
errors, warnings, compounds = [], [], set()


def src(*p): return os.path.join(HERE, *p)


def slug(s):
    s = s.lower().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def bare(term):
    """la palabra sin artículo ni paréntesis, en minúscula: clave para buscarla"""
    t = re.sub(r'\([^)]*\)', '', term).strip()
    for a in ARTICLES:
        if t.startswith(a): t = t[len(a):]
    return t.strip().rstrip('?!.').lower()


POS_TAG = {'adj': 'adjetivo', 'adv': 'adverbio', 'num': 'número', 'prep': 'preposición', 'conj': 'conjunción', 'expr': 'expresión',
           'interj': 'interjección', 'pron': 'pronombre', 'art': 'artículo', 'v': 'verbo'}
NOUN_SHORT = re.compile(r'^(der|die|das) (\S+), (¨?-\w*|¨|\(Sg\.\)|\(Pl\.\))$')
VERB_SHORT = re.compile(r'^(.+?) \(([^()]*(?:hat|ist) [^()]*)\)$')


def umlaut(word):
    for i in range(len(word) - 1, -1, -1):
        c = word[i]
        if c in 'aouAOU':
            if c == 'u' and i and word[i - 1] in 'aA': i -= 1; c = word[i]      # au → äu
            return word[:i] + {'a': 'ä', 'o': 'ö', 'u': 'ü', 'A': 'Ä', 'O': 'Ö', 'U': 'Ü'}[c] + word[i + 1:]
    return word


def shorthand(de, es):
    """forma corta de una palabra nueva → (término, significado, pos, extra)
       der Mann, ¨-er = el hombre          an|rufen (ruft an, rief an, hat angerufen) = llamar          gut = bueno #adj"""
    pos, extra = None, {}
    m = re.search(r' #(\w+)$', es)
    if m and m.group(1) in POS_TAG: pos, es = POS_TAG[m.group(1)], es[:m.start()].strip()
    n, v = NOUN_SHORT.match(de), VERB_SHORT.match(de)
    if n:
        art, noun, spec = n.groups()
        de, pos = f'{art} {noun}', 'sustantivo'
        extra['gender'] = 'pl' if spec == '(Pl.)' else {'der': 'm', 'die': 'f', 'das': 'n'}[art]
        if spec == '(Sg.)': extra['plural'] = 'sin plural'
        elif spec == '(Pl.)': extra['plural'] = 'solo plural'
        else: extra['plural'] = 'die ' + (umlaut(noun) if spec.startswith('¨') else noun) + spec.lstrip('¨-')
    elif v:
        de, forms = v.group(1), [f.strip() for f in v.group(2).split(',')]
        pos = 'verbo'
        if '|' in de: extra['separable'] = True; de = de.replace('|', '')
        extra['present3'] = 'er ' + forms[0]
        if len(forms) == 3: extra['praeteritum'] = forms[1]
        extra['perfekt'] = forms[-1]
    return de, es, pos, extra


# ---------------------------------------------------------------- esqueleto: unidades, lecciones y palabras
units, terms = [], []
for lv in LEVELS:
    path = src('curso', f'{lv.lower()}.txt')
    if not os.path.exists(path): continue
    unit = lesson = term = None
    for ln, raw in enumerate(open(path, encoding='utf-8'), 1):
        raw = raw.rstrip('\n')
        where = f'curso/{lv.lower()}.txt:{ln}'
        if not raw.strip() or raw.startswith('#'): continue
        if raw.startswith('== '):
            p = [x.strip() for x in raw[3:].split('|')]
            if len(p) < 4: errors.append(f'{where}: la unidad necesita id | nivel | título | descripción'); continue
            unit = {'id': p[0], 'level': p[1], 'title': p[2], 'description': p[3], 'flags': set(p[4].split()) if len(p) > 4 else set(), 'lessons': []}
            if unit['level'] not in LEVELS: errors.append(f'{where}: nivel desconocido {unit["level"]}')
            units.append(unit); lesson = term = None
        elif raw.startswith('-- '):
            p = [x.strip() for x in raw[3:].split('|')]
            if unit is None or len(p) < 2: errors.append(f'{where}: lección sin unidad o sin título'); continue
            opts = dict(o.split('=', 1) for o in p[2].split()) if len(p) > 2 and p[2] else {}
            lesson = {'id': p[0], 'title': p[1], 'opts': opts, 'terms': []}
            unit['lessons'].append(lesson); term = None
        elif lesson is None:
            errors.append(f'{where}: palabra fuera de una lección')
        elif raw.startswith('+ '):
            lesson['terms'].append(raw[2:].strip()); term = None
        elif raw.startswith('  '):
            k, _, v = raw.strip().partition(':')
            v = v.strip()
            if term is None: errors.append(f'{where}: campo sin palabra'); continue
            if k == 'id': term['id'] = v
            elif k == 'pos': term['pos'] = v
            elif k == 'tags': term['tags'] = [x.strip() for x in v.split(',') if x.strip()]
            elif k == 'n': term['notes'] = v
            elif k == 'ej':
                de, sep, es = v.partition(' = ')
                if not sep: errors.append(f'{where}: el ejemplo necesita «alemán = español»'); continue
                term['examples'].append({'text': de.strip(), 'translation': es.strip()})
            elif k in KEY: term['extra'][KEY[k]] = True if (k == 'sep' and v in ('sí', 'si', 'true')) else v
            else: errors.append(f'{where}: campo desconocido «{k}»')
        else:
            de, sep, es = raw.partition(' = ')
            if not sep: errors.append(f'{where}: se esperaba «palabra = significado»'); continue
            de, es, pos, extra = shorthand(de.strip(), es.strip())
            term = {'id': None, 'term': de, 'meaning': {'es': es}, 'pos': pos, 'examples': [], 'tags': [],
                    'level': unit['level'], 'extra': extra, '_where': where}
            lesson['terms'].append(term); terms.append(term)

by_id, by_bare = {}, collections.defaultdict(list)
for t in terms:
    if not t['pos']:
        if t['term'].startswith(ARTICLES): t['pos'] = 'sustantivo'
        else: errors.append(f"{t['_where']}: «{t['term']}» necesita pos:"); t['pos'] = 'expresión'
    if t['pos'] == 'sustantivo' and t['term'].startswith(ARTICLES) and 'gender' not in t['extra']:
        t['extra']['gender'] = {'der': 'm', 'die': 'f', 'das': 'n'}[t['term'][:3]]
    t['id'] = t['id'] or 'de-w-' + slug(bare(t['term']))
    if t['id'] in by_id: errors.append(f"{t['_where']}: id repetido {t['id']} (ponle un id: propio)")
    by_id[t['id']] = t
    by_bare[bare(t['term'])].append(t)

for key, same in by_bare.items():
    if len(same) > 1 and len({t['pos'] for t in same}) < len(same) and any(t['id'].startswith('de-w-') for t in same):
        errors.append(f"«{key}» está dos veces en el curso ({', '.join(t['id'] for t in same)}): deja una y usa «+ id» en la otra lección")
lessons_flat = [(u, l) for u in units for l in u['lessons']]
lesson_order = {l['id']: i for i, (u, l) in enumerate(lessons_flat)}
if len(lesson_order) != len(lessons_flat): errors.append('hay ids de lección repetidos en curso/')
if len({u['id'] for u in units}) != len(units): errors.append('hay ids de unidad repetidos en curso/')
unit_index = {u['id']: i for i, u in enumerate(units)}
first_lesson = {}      # id de término → orden de la lección que lo presenta
for i, (u, l) in enumerate(lessons_flat):
    for k, t in enumerate(l['terms']):
        if isinstance(t, str):
            if t not in by_id: errors.append(f"{l['id']}: «+ {t}» no existe")
            continue
        first_lesson[t['id']] = i

lx = Lexicon(LEVELS)
for t in terms: lx.add_term(t, first_lesson[t['id']])
if os.path.exists(src('base.txt')): lx.load_base(src('base.txt'))
if os.path.exists(src('nombres.txt')): lx.names = set(open(src('nombres.txt'), encoding='utf-8').read().split())


def level_of_order(i): return lessons_flat[i][0]['level']


# ---------------------------------------------------------------- frases en contexto
FOCUS = re.compile(r'\[([^\]=]+)(?:=([^\]]+))?\]')


def find_term(surface, hint, where):
    if hint:
        cands = [by_id[hint]] if hint in by_id else by_bare.get(bare(hint), [])
        if not cands: errors.append(f'{where}: «{hint}» no es una palabra del curso'); return None
        return cands[0]
    cands = list({t['id']: t for w in words(surface) for t in lx.terms.get(w.lower(), [])}.values())
    exact = [t for t in cands if bare(t['term']) == surface.lower()]
    if len(exact) == 1: return exact[0]
    if len(cands) > 1:   # «nimmt» a secas es nehmen, no teilnehmen: un separable necesita [nimmt=teilnehmen]
        simple = [t for t in cands if not t['extra'].get('separable') and ' ' not in bare(t['term'])]
        if simple: cands = simple
    if len(cands) == 1: return cands[0]
    if not cands: errors.append(f'{where}: [{surface}] no corresponde a ninguna palabra del curso')
    else: errors.append(f"{where}: [{surface}] es ambigua ({', '.join(t['term'] for t in cands[:4])}): escribe [{surface}=palabra]")
    return None


def parse_sentence(line, where, resolve=True):
    """→ (texto con [foco], texto llano, traducción, términos foco) o None"""
    if '|' not in line: errors.append(f'{where}: falta la traducción: {line}'); return None
    de, es = [x.strip() for x in line.split('|', 1)]
    focus = []
    def mark(m):
        if resolve:
            t = find_term(m.group(1).strip(), (m.group(2) or '').strip(), where)
            if t: focus.append(t)
        return ' '.join(f'[{w}]' for w in m.group(1).split())
    text = FOCUS.sub(mark, de)
    if '[' not in text: errors.append(f'{where}: sin palabra foco: {de}'); return None
    for tok in text.split():
        if '[' in tok and not re.fullmatch(r'[^\[\]]*\[[^\[\]]+\][^\[\]]*', tok): errors.append(f'{where}: corchetes mal puestos en «{tok}»')
    return text, re.sub(r'[\[\]]', '', text), es, focus


def read_lines(kind, lv):
    path = src(kind, f'{lv.lower()}.txt')
    if not os.path.exists(path): return
    for ln, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.strip()
        if line and not line.startswith('#'): yield f'{kind}/{lv.lower()}.txt:{ln}', line


lesson_sentences = collections.defaultdict(list)    # id de lección → frases
term_example = {}
stats = collections.Counter()
for lv in LEVELS:
    for where, line in read_lines('frases', lv):
        parsed = parse_sentence(line, where)
        if not parsed or not parsed[3]: continue
        text, plain, es, focus = parsed
        target = max(first_lesson[t['id']] for t in focus)
        u, l = lessons_flat[target]
        lesson_sentences[l['id']].append({'text': text, 'tr': es})
        stats[f'frases {u["level"]}'] += 1
        for t in focus: term_example.setdefault(t['id'], {'text': plain, 'translation': es})
        lx.check(plain, u['level'], where, warnings, compounds, before=target if STRICT else None)


# ---------------------------------------------------------------- gramática, escucha y lecturas
def read_blocks(kind, lv):
    path = src(kind, f'{lv.lower()}.txt')
    blocks, cur = [], None
    if not os.path.exists(path): return blocks
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if line.startswith('== '):
            head = [x.strip() for x in line[3:].split('|')]
            cur = {'head': [h for h in head if not h.startswith('@')], 'at': next((h[1:] for h in head if h.startswith('@')), None), 'lines': []}
            blocks.append(cur)
        elif cur is not None: cur['lines'].append(line)
    return blocks


def anchor(b, where):
    """dónde va el bloque: una unidad o justo después de una lección de vocabulario"""
    at = b['at']
    if at and at not in unit_index and at not in lesson_order: errors.append(f'{where}: @{at} no es una unidad ni una lección'); return None
    return at


grammar, listening, readings = collections.defaultdict(list), collections.defaultdict(list), collections.defaultdict(list)
guides_out = {}
for lv in LEVELS:
    for gi, b in enumerate(read_blocks('gramatica', lv)):
        gid = b['head'][0]
        where = f'gramatica/{lv.lower()}.txt [{gid}]'
        keep = len(b['head']) > 1 and b['head'][1] == 'keep'      # la guía ya existe en content/grammar
        title = b['head'][1] if len(b['head']) > 1 else gid
        summary = b['head'][2] if len(b['head']) > 2 else ''
        body, sents, choices, lesson_title, order = [], [], [], None, None
        for line in b['lines']:
            if line.startswith('>'): body.append(line[2:] if line[1:2] == ' ' else line[1:])
            elif line.startswith('c:'): choices += line[2:].split()
            elif line.startswith('t:'): lesson_title = line[2:].strip()
            elif line.startswith('o:'): order = int(line[2:])
            elif line.strip() and not line.startswith('#'):
                parsed = parse_sentence(line.strip(), where, resolve=False)
                if not parsed: continue
                text, plain, es, _ = parsed
                lx.check(plain, lv, where, warnings, compounds)
                sents.append(({'text': text, 'tr': es}, plain))
        if len(sents) < 4: errors.append(f'{where}: una lección de gramática necesita al menos 4 frases')
        if not keep:
            if not summary or not body: errors.append(f'{where}: falta el resumen o la explicación')
            md = f'---\ntitle: {title}\nsummary: {summary}\nlevel: {lv}\norder: {order or (LEVELS.index(lv) + 1) * 100 + gi + 10}\n---\n\n'
            md += '\n'.join(body).strip() + '\n\n## Ejemplos\n\n```ejemplos\n' + '\n'.join(f"{plain} | {s['tr']}" for s, plain in sents) + '\n```\n'
            guides_out[gid] = md
        grammar[lv].append({'id': gid, 'title': lesson_title or (None if keep else title), 'sentences': [s for s, _ in sents],
                            'choices': list(dict.fromkeys(choices)), 'at': anchor(b, where)})

    for b in read_blocks('escucha', lv):
        title = b['head'][0]
        where = f'escucha/{lv.lower()}.txt [{title}]'
        exs, cur = [], None
        for line in b['lines'] + ['']:
            line = line.strip()
            if line.startswith('#'): continue
            if not line:
                if cur:
                    if cur.get('answer') is None or len(cur['options']) < 3 or not cur['question']: errors.append(f'{where}: diálogo incompleto: {cur["turns"][:1]}')
                    exs.append(cur); cur = None
                continue
            cur = cur or {'type': 'dialogue', 'turns': [], 'question': '', 'options': []}
            tag, _, rest = line.partition(' ')
            rest = rest.strip()
            german = None
            if tag in ('F:', 'M:', 'N:'): cur['turns'].append({'s': tag[0], 'text': rest}); german = rest
            elif tag == 'Q:': cur['question'] = german = rest
            elif tag == '+': cur['answer'] = len(cur['options']); cur['options'].append(rest); german = rest
            elif tag == '-': cur['options'].append(rest); german = rest
            elif tag == '=': cur['tr'] = rest
            elif tag == '~': cur['skill'] = rest
            else: errors.append(f'{where}: línea no reconocida: {line}')
            if german: lx.check(german, lv, where, warnings, compounds)
        if not exs: errors.append(f'{where}: sin diálogos')
        listening[lv].append({'id': f'de-{lv.lower()}-e-{slug(title)}', 'title': title, 'exercises': exs, 'at': anchor(b, where)})

    for b in read_blocks('lecturas', lv):
        title = b['head'][0]
        where = f'lecturas/{lv.lower()}.txt [{title}]'
        paras, tr, qs = [], '', []
        for line in b['lines']:
            line = line.strip()
            if not line or line.startswith('#'): continue
            tag, _, rest = line.partition(' ')
            rest = rest.strip()
            if tag == 'T:': paras.append(rest)
            elif tag == '=': tr = rest
            elif tag == 'Q:': qs.append({'question': rest, 'options': []})
            elif tag == '+' and qs: qs[-1]['answer'] = len(qs[-1]['options']); qs[-1]['options'].append(rest)
            elif tag == '-' and qs: qs[-1]['options'].append(rest)
            elif tag == 'W:': errors.append(f'{where}: la tarea de escritura (W:) aún no está disponible en alemán: falta el conteo por palabras en el núcleo')
            else: errors.append(f'{where}: línea no reconocida: {line}')
        if not paras or not tr or not qs: errors.append(f'{where}: falta texto, traducción o preguntas'); continue
        for p in paras: lx.check(p, lv, where, warnings, compounds)
        text = '\n'.join(' '.join(p.split()) for p in paras)
        n_words = len(words(text))
        exs = []
        for qi, q in enumerate(qs):
            if q.get('answer') is None or len(q['options']) < 3: errors.append(f'{where}: pregunta incompleta: {q["question"]}'); continue
            if lv not in SPANISH_QUESTIONS:
                for o in [q['question']] + q['options']: lx.check(o, lv, where, warnings, compounds)
            ex = {'type': 'reading', 'title': title, 'text': text, 'tr': tr, **q, 'part': [qi + 1, len(qs)]}
            if LEVELS.index(lv) >= LEVELS.index(TIMED_FROM): ex['seconds'] = int(round((25 + n_words * 0.75) / 5) * 5) if qi == 0 else 30
            exs.append(ex)
        orders = [lx.order[w.lower()] for w in words(text) if w.lower() in lx.order]
        readings[lv].append({'id': f'de-{lv.lower()}-r-{slug(title)}', 'title': f'Lectura: {title}', 'exercises': exs, 'orders': orders,
                             'at': anchor(b, where), 'n': len(set(words(text.lower())))})
        stats[f'lecturas {lv}'] += 1


# ---------------------------------------------------------------- escribir
def clean(t):
    d = {k: v for k, v in t.items() if not k.startswith('_')}
    if not d['examples'] and t['id'] in term_example: d['examples'] = [term_example[t['id']]]
    if not d['extra']: del d['extra']
    return d


def dump(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1); f.write('\n')


def spread(items, n):
    out = collections.defaultdict(list)
    for i, it in enumerate(items): out[min(n - 1, int((i + 0.5) * n / len(items)))].append(it)
    return out


if errors:
    for e in errors: print('✗', e)
    sys.exit(1)

for old in glob.glob(os.path.join(OUT, 'vocab', '*.json')) + glob.glob(os.path.join(OUT, 'units', '*.json')): os.remove(old)
for lv in LEVELS:
    own = [clean(t) for t in terms if t['level'] == lv]
    if own: dump(os.path.join(OUT, 'vocab', f'{lv.lower()}.json'), own)
for gid, md in guides_out.items(): open(os.path.join(OUT, 'grammar', f'{gid}.md'), 'w', encoding='utf-8').write(md)
guide_title = {}
for p in glob.glob(os.path.join(OUT, 'grammar', '*.md')):
    fm = re.search(r'^title:\s*(.+)$', open(p, encoding='utf-8').read(), re.M)
    guide_title[os.path.basename(p)[:-3]] = fm.group(1).strip() if fm else os.path.basename(p)[:-3]

n_lessons, all_ids = collections.Counter(), set()
for lv in LEVELS:
    us = [u for u in units if u['level'] == lv]
    if not us: continue
    placed = collections.defaultdict(list)        # id de unidad o de lección → [(tipo, dato)]
    for kind, items in (('grammar', grammar[lv]), ('listening', listening[lv])):
        free = [it for it in items if not it['at']]
        for it in items:
            if it['at']: placed[it['at']].append((kind, it))
        for ui, its in spread(free, len(us)).items():
            for it in its: placed[us[ui]['id']].append((kind, it))
    last_order = [lesson_order[u['lessons'][-1]['id']] if u['lessons'] else -1 for u in us]
    for r in readings[lv]:
        if r['at']: placed[r['at']].append(('reading', r)); continue
        # primera unidad (pasado el primer tercio del nivel) en la que casi todas sus palabras ya se enseñaron
        allow, need = max(3, round(r['n'] * 0.08)), len(us) // 3
        while need < len(us) - 1 and sum(1 for o in r['orders'] if o > last_order[need]) > allow: need += 1
        placed[us[need]['id']].append(('reading', r))
        if REPORT: print(f"  lectura {lv} «{r['title']}» → {us[need]['id']}")
    for u in us:
        out = []
        def add(lid, kind, title, **extra):
            if lid in all_ids: errors.append(f'id de lección repetido: {lid}')
            all_ids.add(lid)
            out.append({'id': lid, 'unit': u['id'], 'title': title, 'level': lv, 'kind': kind, **extra})
            n_lessons[f'{lv} {kind}'] += 1
        def add_extra(kind, it):
            if kind == 'grammar':
                if it['id'] not in guide_title: errors.append(f"la guía {it['id']} no existe"); return
                add(f"de-g-{it['id']}", 'grammar', it['title'] or guide_title[it['id']], intro=it['id'], skill=it['id'],
                    sentences=it['sentences'], **({'choices': it['choices']} if it['choices'] else {}))
            else: add(it['id'], kind, it['title'], exercises=it['exercises'])
        for l in u['lessons']:
            ids = [t if isinstance(t, str) else t['id'] for t in l['terms']]
            extra = {}
            if l['opts'].get('intro'):
                extra['intro'] = l['opts']['intro']
                if extra['intro'] not in guide_title: errors.append(f"{l['id']}: la guía {extra['intro']} no existe")
            extra['vocab'] = ids
            manual = src('manual', f"{l['id']}.json")
            sents = lesson_sentences.get(l['id'], [])
            if os.path.exists(manual): extra['exercises'] = json.load(open(manual, encoding='utf-8'))
            else:
                extra['drill'] = True
                if len(sents) < 2: warnings.append(f"{l['id']} ({l['title']}): solo {len(sents)} frase(s)")
            if sents:
                extra['sentences'] = sents
                # opciones para los huecos: formas tal como aparecen en las frases de la unidad (no los lemas)
                forms = [w for l2 in u['lessons'] for sn in lesson_sentences.get(l2['id'], []) for w in re.findall(r'\[([^\]]+)\]', sn['text'])]
                extra['choices'] = list(dict.fromkeys(forms))
            add(l['id'], 'vocab', l['title'], **extra)
            for kind, it in placed.get(l['id'], []): add_extra(kind, it)
        for want in ('grammar', 'listening', 'reading'):
            for kind, it in placed.get(u['id'], []):
                if kind == want: add_extra(kind, it)
        if 'sin-repaso' not in u['flags']: add(f"{u['id']}-rep", 'review', f"Repaso: {u['title']}")
        dump(os.path.join(OUT, 'units', f"{lv.lower()}-u{unit_index[u['id']] + 1:02d}.json"),
             {'id': u['id'], 'title': u['title'], 'description': u['description'], 'level': lv, 'lessons': out})

# ids del curso anterior → ids actuales (las tarjetas y el progreso guardados siguen valiendo)
def load_map(name, exists, what):
    path = src(name)
    data = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
    for old, new in data.items():
        if not exists(new): errors.append(f'{name}: {old} apunta a {new}, que no existe')
        if exists(old): errors.append(f'{name}: {old} sigue existiendo como {what}')
    return data
dump(os.path.join(OUT, 'legacy.json'), load_map('legacy-terms.json', lambda i: i in by_id, 'término'))
dump(os.path.join(OUT, 'legacy-lessons.json'), load_map('legacy-lecciones.json', lambda i: i in all_ids, 'lección'))

# ---------------------------------------------------------------- informes
print(f'{len(units)} unidades, {len(terms)} palabras;', dict(n_lessons), dict(stats))
no_example = collections.Counter(t['level'] for t in terms if not t['examples'] and t['id'] not in term_example)
if no_example: print('palabras sin frase de ejemplo por nivel:', dict(no_example))
if COVERAGE:
    known = set()
    for lv in LEVELS:
        known |= {bare(t['term']) for t in terms if t['level'] == lv}
        ref_path = src('referencia', f'{lv.lower()}.txt')
        if not os.path.exists(ref_path): print(f'cobertura {lv}: no hay referencia/{lv.lower()}.txt'); continue
        ref = {bare(l.strip()) for l in open(ref_path, encoding='utf-8') if l.strip() and not l.startswith('#')}
        missing = sorted(w for w in ref if w not in known and (lx.rank_of(w)[0] is None or lx.rank_of(w)[0] > LEVELS.index(lv)))
        own = {bare(t['term']) for t in terms if t['level'] == lv}
        print(f'cobertura {lv}: referencia {len(ref)}, faltan {len(missing)}, del curso fuera de la referencia {len(own - ref)}')
        open(src('referencia', f'faltan-{lv.lower()}.txt'), 'w', encoding='utf-8').write('\n'.join(missing) + '\n')
        open(src('referencia', f'sobran-{lv.lower()}.txt'), 'w', encoding='utf-8').write('\n'.join(sorted(own - ref)) + '\n')
if REPORT:
    for w in warnings: print('!', w)
    if compounds: print('compuestos aceptados por sus partes:', ' '.join(sorted(compounds)))
else: print(f'{len(warnings)} avisos (usa --report para verlos)')
for e in errors: print('✗', e)
sys.exit(1 if errors else 0)
