#!/usr/bin/env python3
"""
Construye el curso de chino (HSK 1-4, programa HSK 3.0) a partir de las fuentes de esta carpeta:

  listas-hsk.json     listas oficiales (hanzi, pinyin, inglés, categoría), niveles 1-5
  es/h{n}.txt         significado en español y tema de cada palabra, en el orden de la lista
  frases/h{n}.txt     frases en contexto: 汉字 con [palabras foco] | traducción
  gramatica/h{n}.txt  puntos gramaticales con explicación y frases
  escucha/h{n}.txt    diálogos de escucha
  extras.txt          palabras fuera de la lista que usan las frases

Escribe src/languages/zh/content/{vocab,units,grammar}/ y legacy.json.
Uso: python3 content-src/zh/build.py [--report]
"""
import json, re, sys, os, glob, math, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pinyin_util import syllables, tone_of, toneless
OUT = os.path.join(HERE, '..', '..', 'src', 'languages', 'zh', 'content')
REPORT = '--report' in sys.argv
LEVELS = [1, 2, 3, 4]
LESSON_SIZE = 8
UNIT_LESSONS = 4

POS = {'n.': 'sustantivo', 'v.': 'verbo', 'adj.': 'adjetivo', 'adv.': 'adverbio', 'pron.': 'pronombre', 'm.w.': 'clasificador',
       'conj.': 'conjunción', 'prep.': 'preposición', 'part.': 'partícula', 'num.': 'numeral', 'interj.': 'interjección',
       'suff.': 'sufijo', 'pref.': 'prefijo'}
TOPIC = {'pro': 'Pronombres y preguntas', 'rel': 'Saludos y trato social', 'per': 'Personas y familia',
         'can': 'Números, cantidades y medidas', 'tie': 'Tiempo y fechas', 'com': 'Comida y bebida', 'cas': 'Casa, ropa y objetos',
         'lug': 'Lugares y direcciones', 'est': 'Estudio y escuela', 'acc': 'Acciones cotidianas', 'mov': 'Movimiento y dirección',
         'des': 'Describir', 'gra': 'Palabras clave de la gramática', 'cue': 'Cuerpo y salud', 'nat': 'Naturaleza y clima',
         'via': 'Transporte y viajes', 'tec': 'Tecnología y medios', 'tra': 'Trabajo', 'oci': 'Ocio, deporte y cultura',
         'emo': 'Emociones y carácter', 'men': 'Pensar, decir y opinar', 'abs': 'Ideas, cambios y resultados', 'soc': 'Sociedad y vida pública'}
SHORT = {'pro': 'Pronombres', 'rel': 'Trato social', 'per': 'Personas', 'can': 'Cantidades', 'tie': 'Tiempo', 'com': 'Comida',
         'cas': 'Casa y objetos', 'lug': 'Lugares', 'est': 'Estudio', 'acc': 'Acciones', 'mov': 'Movimiento', 'des': 'Describir',
         'gra': 'Gramática', 'cue': 'Cuerpo y salud', 'nat': 'Naturaleza', 'via': 'Transporte', 'tec': 'Tecnología', 'tra': 'Trabajo',
         'oci': 'Ocio', 'emo': 'Emociones', 'men': 'Pensar y decir', 'abs': 'Ideas', 'soc': 'Sociedad'}
ORDER = ['pro', 'rel', 'per', 'can', 'tie', 'com', 'acc', 'lug', 'est', 'des', 'gra', 'cas', 'mov', 'cue', 'nat', 'via', 'tec', 'tra',
         'oci', 'emo', 'men', 'abs', 'soc']
MERGE = {'emo': 'men', 'men': 'emo', 'tec': 'tra', 'tra': 'tec', 'mov': 'acc', 'soc': 'abs', 'pro': 'gra', 'rel': 'per', 'oci': 'tec',
         'cas': 'com', 'cue': 'nat', 'nat': 'cue', 'via': 'lug'}
ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI']
errors, warnings = [], []

# ---------------------------------------------------------------- vocabulario
raw = json.load(open(os.path.join(HERE, 'listas-hsk.json'), encoding='utf-8'))
terms = []          # en orden de lista
for lv in LEVELS:
    rows = raw[str(lv)]
    lines = [l.rstrip('\n') for l in open(os.path.join(HERE, 'es', f'h{lv}.txt'), encoding='utf-8') if l.strip()]
    assert len(rows) == len(lines), f'h{lv}: {len(lines)} líneas para {len(rows)} palabras'
    for r, l in zip(rows, lines):
        hz, rest = l.split(' ', 1)
        es, topic = rest.rsplit(' #', 1)
        assert hz == r['hz'], f'h{lv}: {hz} != {r["hz"]}'
        assert topic in TOPIC, topic
        syl = syllables(r['py'], hz)
        assert syl, f'pinyin no alineable: {hz} {r["py"]}'
        aligned = len(syl) == len(hz)
        tones = [tone_of(s) for s in syl] + ([5] * (len(hz) - len(syl)))
        if not aligned:   # erhua: 儿 sin sílaba propia → tono neutro en su posición
            tones = []
            it = iter(syl)
            for ch in hz:
                tones.append(5 if ch == '儿' and len(tones) > 0 else tone_of(next(it)))
        terms.append({
            'id': f'zh-w-{r["n"]:04d}', 'term': hz, 'reading': ' '.join(syl), 'meaning': {'es': es.strip()},
            'pos': ' / '.join(POS[p] for p in r['pos'].split('/') if p in POS) or 'expresión',
            'examples': [], 'tags': [topic], 'level': f'HSK{lv}', 'extra': {'tones': tones},
            '_lv': lv, '_topic': topic, '_py': ''.join(syl),
        })
extras = []
for i, l in enumerate(l for l in open(os.path.join(HERE, 'extras.txt'), encoding='utf-8') if l.strip() and not l.startswith('#')):
    hz, py, es, level = [x.strip() for x in l.split('|')]
    syl = syllables(py, hz)
    extras.append({'id': f'zh-x-{i + 1:04d}', 'term': hz, 'reading': ' '.join(syl), 'meaning': {'es': es}, 'pos': 'expresión',
                   'examples': [], 'tags': ['extra'], 'level': level, 'extra': {'tones': [tone_of(s) for s in syl]}, '_py': ''.join(syl)})
NAMES = set(open(os.path.join(HERE, 'nombres.txt'), encoding='utf-8').read().split())

# ---------------------------------------------------------------- agrupar en lecciones y unidades
def chunk(items, size):
    k = max(1, math.ceil(len(items) / size))
    base, extra = divmod(len(items), k)
    out, i = [], 0
    for j in range(k):
        n = base + (1 if j < extra else 0)
        out.append(items[i:i + n]); i += n
    return out

course = []   # unidades: {id, level, title, topics, lessons:[{id,title,kind,vocab:[term],...}]}
for lv in LEVELS:
    buckets = collections.OrderedDict((t, []) for t in ORDER)
    for t in terms:
        if t['_lv'] == lv: buckets[t['_topic']].append(t)
    names = {t: [t] for t in ORDER}
    for _ in range(2):   # temas pequeños se unen a uno afín
        for t in ORDER:
            if 0 < len(buckets[t]) < 5:
                target = MERGE.get(t)
                if target and buckets[target] and target != t:
                    buckets[target] += buckets[t]; names[target] += names[t]; buckets[t] = []; names[t] = []
    for t in ORDER:      # lo que siga pequeño va a "acciones"
        if 0 < len(buckets[t]) < 5 and t != 'acc':
            buckets['acc'] += buckets[t]; names['acc'] += names[t]; buckets[t] = []
    parts = {}
    for t in ORDER:
        if not buckets[t]: continue
        lessons = chunk(buckets[t], LESSON_SIZE)
        parts[t] = chunk(lessons, UNIT_LESSONS)
    units = []
    for p in range(max(len(v) for v in parts.values())):
        for t in ORDER:
            if t in parts and p < len(parts[t]):
                title = TOPIC[t] if len(names[t]) == 1 else ' · '.join(SHORT[x] for x in dict.fromkeys(names[t]))
                units.append({'level': lv, 'topic': t, 'title': title + (ROMAN[p] if len(parts[t]) > 1 else ''),
                              'short': SHORT[t] if len(names[t]) == 1 else title, 'vocab_lessons': parts[t][p]})
    for i, u in enumerate(units):
        u['id'] = f'zh-h{lv}-u{i + 1:02d}'
    course += units

lesson_of_term = {}   # id de término → (orden global de lección, unidad, índice de lección de vocabulario)
order = 0
for u in course:
    for li, words in enumerate(u['vocab_lessons']):
        for t in words: lesson_of_term[t['id']] = (order, u, li)
        order += 1

if '--lessons' in sys.argv:
    for u in course:
        print(f"\n## {u['id']} {u['title']}")
        for li, words in enumerate(u['vocab_lessons']):
            print(f"  l{li + 1}: " + ' '.join(t['term'] for t in words))
    print('\nunidades', len(course), 'lecciones de vocabulario', order)
    sys.exit(0)

# ---------------------------------------------------------------- frases en contexto
by_hz = collections.defaultdict(list)
for t in terms: by_hz[t['term']].append(t)
LEX = {}
for lv in '12345':
    for r in raw[lv]: LEX.setdefault(r['hz'], int(lv))
for e in extras: LEX.setdefault(e['term'], int(e['level'][3:]))
for n_ in NAMES: LEX.setdefault(n_, 0)
for skip in ('个人', '天上', '再说'): LEX.pop(skip, None)   # «一个人» son tres palabras
PY_LEX = collections.defaultdict(set)
for lv in '12345':
    for r in raw[lv]: PY_LEX[r['hz']].add(''.join(syllables(r['py'], r['hz'])))
for e in extras: PY_LEX[e['term']].add(e['_py'])
PUNCT = '，。！？、；：“”‘’（）《》…—,.!?;: '
MAXLEN = max(len(k) for k in LEX)

def is_han(ch): return '一' <= ch <= '鿿' and ch not in PUNCT

def segment_run(run):
    """Segmenta un tramo de caracteres minimizando palabras, desconocidas y palabras de nivel 5."""
    n = len(run)
    best = [(0.0, None)] + [(1e9, None)] * n
    for i in range(n):
        if best[i][0] >= 1e9: continue
        for L in range(1, min(MAXLEN, n - i) + 1):
            w = run[i:i + L]
            if w in LEX: cost = 1.5 if LEX[w] >= 5 else 1.0
            elif L == 1: cost = 11.0
            else: continue
            c = best[i][0] + cost + LEX.get(w, 0) * 1e-3 - L * 1e-4
            if c < best[i + L][0]: best[i + L] = (c, i)
    out, j = [], n
    while j > 0:
        i = best[j][1]; out.append(run[i:j]); j = i
    return out[::-1]

def max_match(text):
    out, i = [], 0
    while i < len(text):
        j = i
        if not is_han(text[i]):
            while j < len(text) and not is_han(text[j]): j += 1
            out.append(('p', text[i:j]))
        else:
            while j < len(text) and is_han(text[j]): j += 1
            out += [('w', w) for w in segment_run(text[i:j])]
        i = j
    return out

def parse_sentence(src, where):
    """→ (tokens [(texto, palabra, término foco | None)], traducción)"""
    if '|' not in src: errors.append(f'{where}: falta la traducción: {src}'); return None
    zh, es = [x.strip() for x in src.split('|', 1)]
    toks = []
    for k, part in enumerate(re.split(r'\[([^\]]+)\]', zh)):
        if k % 2:   # foco
            word, _, idx = part.partition('#')
            cands = by_hz.get(word)
            if not cands: errors.append(f'{where}: [{word}] no está en las listas HSK 1-4: {zh}'); return None
            toks.append(('w', word, cands[int(idx) - 1 if idx else 0]))
        else:
            toks += [(kind, t, None) for kind, t in max_match(part)]
    out = []
    lead = ''
    for kind, t, term in toks:
        if kind == 'p':
            t = t.strip()
            if not t: continue
            if out and t[0] not in '“‘（《': out[-1][0] += t
            else: lead += t
        else:
            out.append([lead + t, t, term]); lead = ''
    return out, es

def toned_join(syls): return ''.join(syls)

def sentence_reading(tokens):
    """pinyin de una frase (solo niveles 1-2): léxico para las palabras y pypinyin para lo ambiguo"""
    from pypinyin import pinyin, Style
    plain = ''.join(t[0] for t in tokens)
    per_char = [p[0] for p in pinyin(plain, style=Style.TONE)]
    out, pos = [], 0
    for text, word, term in tokens:
        start = plain.index(word, pos); pos = start + len(word)
        if term: py = term['_py']
        elif len(PY_LEX.get(word, ())) == 1: py = next(iter(PY_LEX[word]))
        else: py = ''.join(per_char[start:start + len(word)])
        out.append([py, text[len(word):] if text.startswith(word) else '', word])
    # sandhi de 一 y 不 sueltos
    for i, (py, tail, word) in enumerate(out):
        nxt = out[i + 1][0] if i + 1 < len(out) else ''
        prev = out[i - 1][2] if i else ''
        if word == '不' and nxt: out[i][0] = 'bú' if tone_of(syllable_first(nxt)) == 4 else 'bù'
        if word == '一' and nxt and prev not in ('第', '十', '星期', '周') and not tail:
            out[i][0] = 'yí' if tone_of(syllable_first(nxt)) == 4 or out[i + 1][2] == '个' else 'yì'
    trans = str.maketrans({'，': ',', '。': '.', '！': '!', '？': '?', '、': ',', '；': ';', '：': ':', '“': '"', '”': '"'})
    s = ' '.join(py + tail.translate(trans) for py, tail, _ in out)
    s = re.sub(r'\s+([,.!?;:])', r'\1', s)
    return s[:1].upper() + s[1:]

def syllable_first(py):
    m = re.match(r"[^aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]*[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+(?:ng|n(?![aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ])|r(?![aeiouü]))?", py)
    return m.group(0) if m else py

def make_sentence(tokens, es, reading):
    text = ' '.join((f'[{w}]' + t[len(w):] if term and t.startswith(w) else t) for t, w, term in tokens)
    d = {'text': text, 'tr': es}
    if reading: d['reading'] = sentence_reading(tokens)
    return d

lesson_sentences = collections.defaultdict(list)   # orden global de lección → frases
term_example = {}
known_order = {}       # hanzi → primer orden de lección en que aparece
for t in terms: known_order.setdefault(t['term'], lesson_of_term[t['id']][0])
first_order_of_level = {}
for u in course:
    for words in u['vocab_lessons']:
        first_order_of_level.setdefault(u['level'], lesson_of_term[words[0]['id']][0])
stats = collections.Counter()
for lv in LEVELS:
    path = os.path.join(HERE, 'frases', f'h{lv}.txt')
    if not os.path.exists(path): continue
    for ln, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'): continue
        where = f'frases/h{lv}.txt:{ln}'
        parsed = parse_sentence(line, where)
        if not parsed: continue
        tokens, es = parsed
        focus = [t[2] for t in tokens if t[2]]
        if not focus: errors.append(f'{where}: sin palabra foco'); continue
        target = max(lesson_of_term[f['id']][0] for f in focus)
        unit = next(u for u in course if any(lesson_of_term[w['id']][0] == target for ws in u['vocab_lessons'] for w in ws))
        sent = make_sentence(tokens, es, unit['level'] <= 2)
        lesson_sentences[target].append(sent)
        stats[f'frases h{unit["level"]}'] += 1
        plain = ''.join(t[0] for t in tokens)
        for f in focus:
            term_example.setdefault(f['id'], {'text': plain, 'translation': es, **({'reading': sent['reading']} if 'reading' in sent else {})})
        for text, word, term in tokens:
            if term or word in NAMES: continue
            if word not in LEX: warnings.append(f'{where}: «{word}» no está en ninguna lista ({plain})')
            elif LEX[word] > unit['level']: warnings.append(f'{where}: «{word}» es de HSK {LEX[word]} ({plain})')

# ---------------------------------------------------------------- gramática y escucha
def read_blocks(path):
    blocks, cur = [], None
    if not os.path.exists(path): return blocks
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if line.startswith('== '):
            cur = {'head': [x.strip() for x in line[3:].split('|')], 'lines': []}; blocks.append(cur)
        elif cur is not None and not line.startswith('#!'):
            cur['lines'].append(line)
    return blocks

grammar = collections.defaultdict(list)    # nivel → puntos
guides_out = {}
for lv in LEVELS:
    for gi, b in enumerate(read_blocks(os.path.join(HERE, 'gramatica', f'h{lv}.txt'))):
        gid, title = b['head'][0], b['head'][1]
        keep = title == 'keep'
        summary = b['head'][2] if len(b['head']) > 2 else ''
        body, sents, choices, lesson_title = [], [], [], None
        for ln, line in enumerate(b['lines']):
            if line.startswith('>'): body.append(line[1:].lstrip(' ') if line[1:2] == ' ' else line[1:])
            elif line.startswith('c:'): choices += line[2:].split()
            elif line.startswith('t:'): lesson_title = line[2:].strip()
            elif line.strip():
                where = f'gramatica/h{lv}.txt [{gid}]'
                if '|' not in line: errors.append(f'{where}: {line}'); continue
                zh, es = [x.strip() for x in line.split('|', 1)]
                toks, lead = [], ''
                for k, part in enumerate(re.split(r'\[([^\]]+)\]', zh)):
                    if k % 2: toks.append(('w', part, True))
                    else: toks += [(kind, t, False) for kind, t in max_match(part)]
                out = []
                for kind, t, foc in toks:
                    if kind == 'p':
                        t = t.strip()
                        if not t: continue
                        if out and t[0] not in '“‘（《': out[-1][0] += t
                        else: lead += t
                    else: out.append([lead + t, t, {'_py': None} if foc else None]); lead = ''
                for t_, w, f in out:
                    if not f and w not in LEX and w not in NAMES: warnings.append(f'{where}: «{w}» no está en ninguna lista ({zh})')
                    elif not f and LEX.get(w, 0) > lv: warnings.append(f'{where}: «{w}» es de HSK {LEX[w]} ({zh})')
                text = ' '.join((f'[{w}]' + t_[len(w):] if f else t_) for t_, w, f in out)
                sent = {'text': text, 'tr': es}
                plain = ''.join(t_ for t_, _, _ in out)
                if lv <= 2:
                    toks2 = [(t_, w, None) for t_, w, f in out]
                    sent['reading'] = sentence_reading(toks2)
                sents.append((sent, plain))
        if not sents: errors.append(f'gramatica/h{lv}.txt [{gid}]: sin frases')
        if not keep:
            md = f'---\ntitle: {title}\nsummary: {summary}\nlevel: HSK{lv}\norder: {lv * 100 + gi + 10}\n---\n\n' + '\n'.join(body).strip() + '\n\n## Ejemplos\n\n```ejemplos\n'
            md += '\n'.join(f"{plain} | {s.get('reading', '')} | {s['tr']}" if 'reading' in s else f"{plain} | {s['tr']}" for s, plain in sents) + '\n```\n'
            guides_out[gid] = md
        grammar[lv].append({'id': gid, 'title': lesson_title or (title if not keep else gid), 'sentences': [s for s, _ in sents], 'choices': list(dict.fromkeys(choices)), 'keep': keep})

listening = collections.defaultdict(list)   # nivel → lecciones de escucha
for lv in LEVELS:
    for b in read_blocks(os.path.join(HERE, 'escucha', f'h{lv}.txt')):
        exs, cur = [], None
        for line in b['lines'] + ['']:
            line = line.strip()
            if not line:
                if cur:
                    if cur.get('answer') is None or len(cur['options']) < 3: errors.append(f'escucha/h{lv}.txt: diálogo incompleto: {cur}')
                    exs.append(cur); cur = None
                continue
            cur = cur or {'type': 'dialogue', 'turns': [], 'question': '', 'options': []}
            tag, _, rest = line.partition(' ')
            rest = rest.strip()
            if tag in ('F:', 'M:', 'N:'): cur['turns'].append({'s': tag[0], 'text': rest})
            elif tag == 'Q:': cur['question'] = rest
            elif tag == '+': cur['answer'] = len(cur['options']); cur['options'].append(rest)
            elif tag == '-': cur['options'].append(rest)
            elif tag == '=': cur['tr'] = rest
            elif tag == '~': cur['skill'] = rest
            else: errors.append(f'escucha/h{lv}.txt: línea no reconocida: {line}')
        listening[lv].append({'title': b['head'][0], 'exercises': exs, 'n': len(listening[lv]) + 1})

# ---------------------------------------------------------------- lecturas
def tokenize_text(text):
    """→ [(texto con puntuación pegada, palabra)] como en las frases"""
    out, lead = [], ''
    for kind, t in max_match(text):
        if kind == 'p':
            t = t.strip()
            if not t: continue
            if re.fullmatch(r'[0-9A-Za-z]+', t): out.append([lead + t, t]); lead = ''
            elif out and t[0] not in '“‘（《': out[-1][0] += t
            else: lead += t
        else: out.append([lead + t, t]); lead = ''
    return out

def check_level(tokens, lv, where, plain):
    for _, w in tokens:
        if not is_han(w[0]) or w in NAMES: continue
        if w not in LEX: warnings.append(f'{where}: «{w}» no está en ninguna lista ({plain[:30]})')
        elif LEX[w] > lv: warnings.append(f'{where}: «{w}» es de HSK {LEX[w]} ({plain[:30]})')

def token_pinyin(tokens):
    """pinyin por palabra, alineado con los tokens (niveles 1-2)"""
    from pypinyin import pinyin, Style
    plain = ''.join(w for _, w in tokens)
    per_char = [p[0] for p in pinyin(plain, style=Style.TONE)]
    out, pos = [], 0
    for text, word in tokens:
        start = plain.index(word, pos); pos = start + len(word)
        if not is_han(word[0]): out.append(word); continue
        out.append(next(iter(PY_LEX[word])) if len(PY_LEX.get(word, ())) == 1 else ''.join(per_char[start:start + len(word)]))
    for i, (text, word) in enumerate(tokens):
        nxt = out[i + 1] if i + 1 < len(out) else ''
        prev = tokens[i - 1][1] if i else ''
        if text != word: continue          # lleva puntuación: no hay sandhi con lo que sigue
        if word == '不' and nxt: out[i] = 'bú' if tone_of(syllable_first(nxt)) == 4 else 'bù'
        if word == '一' and nxt and prev not in ('第', '十', '星期', '周'):
            out[i] = 'yí' if tone_of(syllable_first(nxt)) == 4 or tokens[i + 1][1] == '个' else 'yì'
    return out

readings = collections.defaultdict(list)    # nivel → lecciones de lectura
for lv in LEVELS:
    for b in read_blocks(os.path.join(HERE, 'lecturas', f'h{lv}.txt')):
        title = b['head'][0]
        where = f'lecturas/h{lv}.txt [{title}]'
        paras, tr, qs, write = [], '', [], None
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
            elif tag == 'W:':
                parts = [x.strip() for x in rest.split('|')]
                if len(parts) != 5: errors.append(f'{where}: W: necesita 5 campos'); continue
                write = {'type': 'compose', 'prompt': parts[0], 'must': parts[1].split(), 'minChars': int(parts[2]), 'model': parts[3], 'modelTr': parts[4]}
            else: errors.append(f'{where}: línea no reconocida: {line}')
        if not paras or not tr or not qs: errors.append(f'{where}: falta texto, traducción o preguntas'); continue
        toks = [tokenize_text(p) for p in paras]
        for t in toks: check_level(t, lv, where, ''.join(x for x, _ in t))
        text = '\n'.join(' '.join(x for x, _ in t) for t in toks)
        chars = sum(1 for p in paras for ch in p if is_han(ch))
        base = {'type': 'reading', 'title': title, 'text': text, 'tr': tr}
        if lv <= 2: base['py'] = '\n'.join(' '.join(token_pinyin(t)) for t in toks)
        exs = []
        for qi, q in enumerate(qs):
            if q.get('answer') is None or len(q['options']) < 3: errors.append(f'{where}: pregunta incompleta: {q}'); continue
            for o in [q['question']] + q['options']:
                if any(is_han(ch) for ch in o): check_level(tokenize_text(o), lv, where, o)
            ex = {**base, **q, 'part': [qi + 1, len(qs)]}
            # desde HSK 3 la lectura va con límite de tiempo: leer el texto en la primera pregunta
            if lv >= 3: ex['seconds'] = int(round((25 + chars * 0.45) / 5) * 5) if qi == 0 else 30
            exs.append(ex)
        if write:
            check_level(tokenize_text(write['model']), lv, where, write['model'])
            for w in write['must']:
                if w not in write['model']: errors.append(f'{where}: el modelo no usa «{w}»')
            if sum(1 for ch in write['model'] if is_han(ch)) < write['minChars']: errors.append(f'{where}: el modelo es más corto que el mínimo')
            exs.append(write)
        words = {w for t in toks for _, w in t if is_han(w[0])}
        readings[lv].append({'title': f'Lectura: {title}', 'exercises': exs, 'n': len(readings[lv]) + 1, 'chars': chars, 'words': words})
        stats[f'lecturas h{lv}'] += 1

# ---------------------------------------------------------------- escribir
def clean(t): return {k: v for k, v in t.items() if not k.startswith('_')}
def dump(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(path, 'a').write('\n')

for t in terms:
    if t['id'] in term_example: t['examples'] = [term_example[t['id']]]
for old in glob.glob(os.path.join(OUT, 'vocab', '*.json')) + glob.glob(os.path.join(OUT, 'units', '*.json')): os.remove(old)
for lv in LEVELS: dump(os.path.join(OUT, 'vocab', f'hsk{lv}.json'), [clean(t) for t in terms if t['_lv'] == lv])
dump(os.path.join(OUT, 'vocab', 'extra.json'), [clean(e) for e in extras])
for gid, md in guides_out.items(): open(os.path.join(OUT, 'grammar', f'{gid}.md'), 'w', encoding='utf-8').write(md)
guide_ids = {os.path.basename(p)[:-3] for p in glob.glob(os.path.join(OUT, 'grammar', '*.md'))}

def spread(items, n_units):
    """reparte `items` entre las unidades de un nivel, de forma pareja y en orden"""
    out = collections.defaultdict(list)
    for i, it in enumerate(items):
        out[min(n_units - 1, int((i + 0.5) * n_units / len(items)))].append(it)
    return out

n_lessons = collections.Counter()
lesson_key = {}
for lv in LEVELS:
    units = [u for u in course if u['level'] == lv]
    g_at, l_at = spread(grammar[lv], len(units)), spread(listening[lv], len(units))
    # cada lectura va en la primera unidad (pasado el primer tercio del nivel) en la que casi todas
    # sus palabras ya se enseñaron; las pocas que falten se consultan tocándolas en el texto
    unit_of_word = {w['term']: ui for ui, u in enumerate(units) for ws in u['vocab_lessons'] for w in ws}
    r_at = collections.defaultdict(list)
    for r in readings[lv]:
        own = [unit_of_word[w] for w in r['words'] if w in unit_of_word]
        allow = max(3, round(len(r['words']) * 0.08))
        need = len(units) // 3
        while need < len(units) - 1 and sum(1 for o in own if o > need) > allow: need += 1
        r_at[need].append(r)
        if REPORT: print(f"  lectura h{lv} «{r['title']}» → unidad {need + 1}/{len(units)}")
    for ui, u in enumerate(units):
        lessons = []
        # ids estables: solo las de vocabulario se numeran dentro de la unidad; las demás llevan
        # su propia clave, así añadir o mover lecciones no desplaza el progreso guardado
        def add(kind, title, lid=None, **extra):
            lid = lid or f"{u['id']}-l{len(lessons) + 1}"
            lessons.append({'id': lid, 'unit': u['id'], 'title': title, 'level': f'HSK{lv}', 'kind': kind, **extra})
            n_lessons[f'h{lv} {kind}'] += 1
        for words in u['vocab_lessons']:
            o = lesson_of_term[words[0]['id']][0]
            sents = lesson_sentences.get(o, [])
            if len(sents) < 2: warnings.append(f"{u['id']} ({' '.join(w['term'] for w in words)}): solo {len(sents)} frase(s)")
            add('vocab', f"{u['short']}: " + ' · '.join(w['term'] for w in words[:3]), vocab=[w['id'] for w in words], drill=True, sentences=sents)
        gtitles = []
        for g in g_at.get(ui, []):
            if g['id'] not in guide_ids: errors.append(f"la guía {g['id']} no existe")
            title = g['title']
            if g['keep']:
                fm = re.search(r'^title:\s*(.+)$', open(os.path.join(OUT, 'grammar', g['id'] + '.md'), encoding='utf-8').read(), re.M)
                title = fm.group(1).strip() if fm else g['id']
            gtitles.append(title)
            add('grammar', title, lid=f"zh-g-{g['id']}", intro=g['id'], skill=g['id'], sentences=g['sentences'], choices=g['choices'])
            lesson_key['g:' + g['id']] = lessons[-1]['id']
        for l in l_at.get(ui, []):
            add('listening', l['title'], lid=f"zh-h{lv}-e{l['n']}", exercises=l['exercises'])
            lesson_key['e:' + l['title']] = lessons[-1]['id']
        for r in r_at.get(ui, []):
            add('reading', r['title'], lid=f"zh-h{lv}-r{r['n']}", exercises=r['exercises'])
        add('review', f"Repaso: {u['title']}", lid=f"{u['id']}-rep")
        lesson_key['rep:' + u['id']] = lessons[-1]['id']
        n_words = sum(len(w) for w in u['vocab_lessons'])
        desc = f'{n_words} palabras nuevas' + (f". Gramática: {'; '.join(gtitles)}" if gtitles else '') + '.'
        dump(os.path.join(OUT, 'units', f"h{lv}-u{ui + 1:02d}.json"), {'id': u['id'], 'title': u['title'], 'description': desc, 'level': f'HSK{lv}', 'lessons': lessons})

# ids del curso anterior → ids actuales
legacy_src = os.path.join(HERE, 'legacy-terms.json')
legacy = {}
if os.path.exists(legacy_src):
    for old_id, hz in json.load(open(legacy_src, encoding='utf-8')).items():
        new = (by_hz.get(hz) or [None])[0] or next((e for e in extras if e['term'] == hz), None)
        if new: legacy[old_id] = new['id']
        else: errors.append(f'legacy: {old_id} {hz} no tiene equivalente')
dump(os.path.join(OUT, 'legacy.json'), legacy)

# ids de lecciones del curso anterior → ids actuales (el progreso guardado sigue valiendo)
old_lessons = json.load(open(os.path.join(HERE, 'legacy-lecciones.json'), encoding='utf-8'))
legacy_lessons = {old: lesson_key[k] for old, k in old_lessons.items() if k in lesson_key and lesson_key[k] != old}
for old, k in old_lessons.items():
    if k not in lesson_key: warnings.append(f'legacy-lecciones: {old} ({k}) ya no existe')
dump(os.path.join(OUT, 'legacy-lessons.json'), legacy_lessons)

missing = [t['term'] for t in terms if t['id'] not in term_example]
by_level_missing = collections.Counter(t['_lv'] for t in terms if t['id'] not in term_example)
print(dict(stats), dict(n_lessons))
print('palabras sin frase de ejemplo por nivel:', dict(by_level_missing))
if REPORT:
    for w in warnings: print('!', w)
for a in sys.argv:
    if a.startswith('--missing='):
        lv = int(a.split('=')[1])
        print(f'sin ejemplo HSK{lv}:', ' '.join(t['term'] for t in terms if t['_lv'] == lv and t['id'] not in term_example))
else:
    print(f'{len(warnings)} avisos (usa --report para verlos)')
for e in errors: print('✗', e)
sys.exit(1 if errors else 0)
