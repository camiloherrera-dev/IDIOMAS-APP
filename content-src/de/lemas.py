"""
Formas flexionadas del alemán a partir de las formas principales declaradas en el curso.
Sin dependencias ni red: todo sale de `curso/*.txt` y `base.txt`.

Sirve para dos cosas:
  - comprobar que una frase, diálogo o lectura solo usa palabras ya enseñadas (formas incluidas:
    «ging» es gehen, «Häuser» es Haus, «ruft ... an» es anrufen);
  - encontrar el término de una palabra foco escrita en forma flexionada.

Genera de más a propósito (acepta alguna forma que no existe) y nunca de menos a sabiendas:
lo que no reconoce sale como aviso y se arregla declarando la forma con `formas:` en el término.
"""
import re

ADJ = ['', 'e', 'er', 'en', 'em', 'es']
WORD = re.compile(r"[A-Za-zÄÖÜäöüßÀ-ÿ]+(?:-[A-Za-zÄÖÜäöüßÀ-ÿ]+)*")
ARTICLES = ('der ', 'die ', 'das ')
WEAK_NOUN_END = ('e', 'ent', 'ant', 'ist', 'at', 'oge', 'graf')
WEAK_NOUNS = {'herr', 'mensch', 'nachbar', 'bauer', 'held', 'prinz', 'bär'}
SIBILANT = ('s', 'ß', 'z', 'x')
SEP_PREFIXES = sorted(['zurück', 'zusammen', 'heraus', 'herein', 'hinaus', 'hinein', 'vorbei', 'weiter', 'statt', 'teil', 'fest',
                       'fern', 'los', 'her', 'hin', 'weg', 'vor', 'mit', 'nach', 'auf', 'aus', 'ein', 'an', 'ab', 'zu', 'um', 'bei'],
                      key=len, reverse=True)


def words(text):
    """palabras de un texto, sin puntuación ni números"""
    return WORD.findall(text)


def with_endings(base):
    return {base + e for e in ADJ}


def adjective_forms(base):
    stems = {base[:-1] if base.endswith('e') else base}
    if base.endswith(('el', 'er')) and len(base) > 4:
        stems.add(base[:-2] + base[-1])            # dunkel → dunkl-e, teuer → teur-e
    out = {base}
    for s in stems:
        out |= with_endings(s)
        out |= with_endings(s + 'er')                                          # comparativo
        sup = s + ('est' if s.endswith(('d', 't', 'sch') + SIBILANT) else 'st')
        out |= with_endings(sup)                                               # superlativo
    return out


def noun_forms(term, gender=None, plural=None):
    out = set()
    for part in re.split(r'\s*/\s*', term):
        sing = part
        for a in ARTICLES:
            if sing.startswith(a): sing = sing[len(a):]
        sing = sing.strip()
        if not sing: continue
        out.add(sing)
        if gender in ('m', 'n'): out |= {sing + 's', sing + 'es'}
        if gender == 'pl' and not sing.endswith(('n', 's')): out.add(sing + 'n')       # dativo de un plural: Leuten
        low = sing.lower()
        if gender == 'm' and (low.endswith(WEAK_NOUN_END) or low in WEAK_NOUNS):
            out |= {sing + 'n', sing + 'en'}
    for part in re.split(r'\s*/\s*', plural or ''):
        pl = part[4:] if part.startswith('die ') else part
        pl = pl.strip()
        if pl and pl != '-':
            out.add(pl)
            if not pl.endswith(('n', 's')): out.add(pl + 'n')               # dativo plural
    return out


def _stem(inf):
    if inf.endswith(('eln', 'ern')): return inf[:-1]
    if inf.endswith('en'): return inf[:-2]
    return inf[:-1] if inf.endswith('n') else inf


def _needs_e(stem):
    return stem.endswith(('t', 'd')) or bool(re.search(r'[^aeiouäöülrhmn][mn]$', stem))


def _person(stem, ending):
    """stem + st/t con los ajustes de siempre (reist, arbeitest)"""
    if _needs_e(stem): return stem + 'e' + ending
    if ending == 'st' and stem.endswith(SIBILANT): return stem + 't'
    return stem + ending


def _finite(base, p3, pret, part):
    """formas personales de un verbo simple (sin prefijo separable)"""
    stem = _stem(base)
    out = {base, stem, stem + 'e', _person(stem, 'st'), _person(stem, 't')}
    if base.endswith('eln'): out.add(stem[:-2] + 'le')                        # ich sammle
    out |= with_endings(base + 'd')                                            # Partizip I
    if p3:
        out.add(p3)
        if p3.endswith('t') and p3 != _person(stem, 't') and p3 != 'weiß':
            s = p3[:-1]                                                        # nimmt → nimm (imperativo), nimmst
            out |= {s, s + 't' if s.endswith(SIBILANT) else s + 'st'}
            if p3.endswith(('lt', 'ät')): out.add(p3 + 'st')                   # hält → hältst
        elif not p3.endswith('t') or p3 == 'weiß':                             # modales: kann, will, muss
            out.add(p3 + 't' if p3.endswith(SIBILANT) else p3 + 'st')
    if not pret and part and part.endswith('t'):                               # débil o mixto: del participio
        p = part
        if p.startswith('ge') and not base.startswith('ge'): p = p[2:]
        pret = p + 'e'                                                         # gebracht → brachte
    if pret:
        if pret.endswith('e'):
            out |= {pret, pret + 'st', pret + 'n', pret + 't'}
        else:
            e = 'e' if pret.endswith(('t', 'd')) else ''
            out |= {pret, pret + 'en', pret + e + 't', pret + 'est',
                    pret + ('t' if pret.endswith(SIBILANT) else e + 'st')}
    return out


def verb_forms(term, p3=None, pret=None, perf=None, sep=False):
    """→ (formas, prefijo separable o '')"""
    t = re.sub(r'\([^)]*\)', '', term).replace('sich ', ' ').strip()
    parts = t.split()
    inf, rest = parts[-1], parts[:-1]                                          # «Rad fahren» → fahren + Rad
    fin = [w for w in (p3 or '').split()[1:] if w != 'sich' and w not in rest]
    part = perf.split()[-1] if perf else None
    prefix = ''
    if sep:
        prefix = fin[-1] if len(fin) > 1 else next((p for p in SEP_PREFIXES if inf.startswith(p)), '')
    f3 = fin[0] if fin else None
    base = inf[len(prefix):]
    bpart = part[len(prefix):] if part and prefix and part.startswith(prefix) else part
    bpret = pret.split()[0] if pret else None
    finite = _finite(base, f3, bpret, bpart)
    out = set(rest) | {inf} | finite
    if prefix:
        out |= {prefix + f for f in finite} | {prefix, prefix + 'zu' + base}
    if part: out |= with_endings(part)
    return out, prefix


def term_forms(t):
    """todas las formas (en minúscula) con las que puede aparecer un término del curso"""
    x = t.get('extra') or {}
    pos, term = t.get('pos', ''), t['term']
    if pos == 'sustantivo' or term.startswith(ARTICLES):
        forms = noun_forms(term, x.get('gender'), x.get('plural'))
    elif pos == 'verbo':
        forms, _ = verb_forms(term, x.get('present3'), x.get('praeteritum'), x.get('perfekt'), bool(x.get('separable')))
    elif pos == 'adjetivo' and ' ' not in term:
        forms = adjective_forms(term)
    else:
        forms = set()
        for w in words(re.sub(r'\([^)]*\)', '', term)):
            forms |= adjective_forms(w) if pos == 'adjetivo' else {w}
    forms |= set(str(x.get('formas') or '').split())
    return {f.lower() for f in forms if f}


class Lexicon:
    """forma → nivel más bajo en que se conoce, y forma → términos del curso"""

    def __init__(self, levels):
        self.levels = levels
        self.rank = {lv: i for i, lv in enumerate(levels)}
        self.level = {}          # forma → rango
        self.terms = {}          # forma → [término]
        self.order = {}          # forma → orden de la primera lección que la enseña
        self.names = set()
        self.free = set()        # formas de base.txt: se pueden usar desde el principio de su nivel

    def add(self, form, level, term=None, order=None):
        f = form.lower()
        r = self.rank[level]
        if r < self.level.get(f, 99): self.level[f] = r
        if term is not None: self.terms.setdefault(f, []).append(term)
        if order is not None and order < self.order.get(f, 10 ** 9): self.order[f] = order

    def add_term(self, t, order=None):
        for f in term_forms(t): self.add(f, t['level'], t, order)

    def load_base(self, path):
        """líneas `nivel | lema | formas`; una forma acabada en ~ se declina como adjetivo"""
        for line in open(path, encoding='utf-8'):
            line = line.split('#')[0].strip()
            if not line: continue
            lv, lemma, *rest = [p.strip() for p in line.split('|')]
            for f in [lemma] + ' '.join(rest).split():
                for g in (with_endings(f[:-1]) if f.endswith('~') else {f}):
                    self.add(g, lv)
                    self.free.add(g.lower())

    def split_compound(self, w):
        """compuesto transparente: sus dos partes se conocen → rango de la más tardía"""
        best = None
        for i in range(3, len(w) - 2):
            a, b = w[:i], w[i:]
            if b not in self.level: continue
            for cut in ('', 's', 'n', 'es', 'en', 'e'):
                if cut and not a.endswith(cut): continue
                head = a[:len(a) - len(cut)]
                if len(head) >= 3 and head in self.level:
                    r = max(self.level[head], self.level[b])
                    best = r if best is None else min(best, r)
        return best

    def rank_of(self, w):
        """→ (rango del nivel o None si no se conoce, True si se dedujo como compuesto)"""
        f = w.lower()
        if w in self.names: return 0, False
        if f in self.level: return self.level[f], False
        if '-' in f:
            rs = [self.rank_of(p)[0] for p in w.split('-')]
            if all(r is not None for r in rs): return max(rs), True
        r = self.split_compound(f)
        return (r, True) if r is not None else (None, False)

    def check(self, text, level, where, warnings, compounds=None, before=None):
        """avisa de palabras desconocidas, de un nivel superior a `level` o posteriores a la lección `before`"""
        max_rank = self.rank[level]
        for w in words(text):
            r, comp = self.rank_of(w)
            if r is None: warnings.append(f'{where}: «{w}» no está en el curso ({text[:50]})')
            elif r > max_rank: warnings.append(f'{where}: «{w}» es de {self.levels[r]} ({text[:50]})')
            elif before is not None and not comp and w not in self.names and w.lower() not in self.free and self.order.get(w.lower(), -1) > before:
                warnings.append(f'{where}: «{w}» se enseña después de esta lección ({text[:50]})')
            if comp and compounds is not None: compounds.add(w)
