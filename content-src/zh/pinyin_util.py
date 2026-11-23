"""Utilidades de pinyin para construir el curso: separar sílabas y sacar tonos."""
import re, unicodedata

FINALS = """a o e ai ei ao ou an en ang eng ong er i ia ie iao iu ian in iang ing iong
u ua uo uai ui uan un uang ueng ü üe üan ün ue""".split()
INITIALS = ['zh', 'ch', 'sh'] + list('bpmfdtnlgkhjqxrzcsyw')
VALID = set(FINALS) | {i + f for i in INITIALS for f in FINALS}

def toneless(s):
    out = unicodedata.normalize('NFD', s)
    out = re.sub('[̄́̌̀]', '', out)
    return unicodedata.normalize('NFC', out).lower()

TONE_MARK = {'̄': 1, '́': 2, '̌': 3, '̀': 4}
def tone_of(syl):
    for ch in unicodedata.normalize('NFD', syl):
        if ch in TONE_MARK: return TONE_MARK[ch]
    return 5

def splits(chunk, first=True):
    """todas las divisiones de `chunk` (con tonos) en sílabas válidas"""
    if not chunk: return [[]]
    out = []
    for n in range(1, min(7, len(chunk)) + 1):
        syl = chunk[:n]
        base = toneless(syl)
        ok = base in VALID or (base.endswith('r') and base[:-1] in VALID and base != 'er')
        if not ok: continue
        if not first and base[0] in 'aeo' : continue  # exigiría apóstrofo
        rest = chunk[n:]
        if rest and toneless(rest)[0] in 'aeiouü' and toneless(rest[0]) not in 'aeo':
            continue  # una sílaba no empieza por i/u/ü
        for tail in splits(rest, False):
            out.append([syl] + tail)
    return out

def syllables(pinyin, hanzi):
    """sílabas alineadas con los caracteres; None si no se puede alinear"""
    py = pinyin.split('/')[0].strip()
    chunks = [c for c in re.split(r"[\s'’\-]+", py) if c]
    n = len(hanzi)
    if len(chunks) == 1 and toneless(chunks[0]) in ('ng', 'n', 'm') and n == 1:
        return chunks  # interjecciones como 嗯
    options = [[]]
    for c in chunks:
        sp = splits(c)
        if not sp: return None
        options = [o + s for o in options for s in sp]
    exact = [o for o in options if len(o) == n]
    if exact:
        # preferir la división sin erhua pegado cuando hay varias
        exact.sort(key=lambda o: sum(1 for s in o if toneless(s).endswith('r') and toneless(s) != 'er'))
        return exact[0]
    # erhua: 儿 no tiene sílaba propia
    if '儿' in hanzi:
        k = hanzi.count('儿')
        er = [o for o in options if len(o) == n - k]
        if er: return er[0]
    return None
