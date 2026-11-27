"""Casos difíciles de la lematización. Uso: python3 content-src/de/test_lemas.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lemas import term_forms, Lexicon


def T(term, pos, **x): return {'term': term, 'pos': pos, 'level': 'A1', 'extra': x}


CASES = [
    (T('gehen', 'verbo', present3='er geht', praeteritum='ging', perfekt='ist gegangen'), 'gehe gehst geht ging gingen gingst gegangen gehend'),
    (T('anrufen', 'verbo', present3='er ruft an', praeteritum='rief an', perfekt='hat angerufen', separable=True), 'rufe ruft an anruft anzurufen rief angerufen anrief'),
    (T('nehmen', 'verbo', present3='er nimmt', praeteritum='nahm', perfekt='hat genommen'), 'nimmst nimmt nimm nahmen genommen'),
    (T('aufstehen', 'verbo', present3='er steht auf', perfekt='ist aufgestanden', separable=True), 'stehe steht aufsteht aufgestanden aufzustehen'),
    (T('arbeiten', 'verbo', present3='er arbeitet', perfekt='hat gearbeitet'), 'arbeite arbeitest arbeitet arbeitete arbeiteten gearbeitet'),
    (T('bringen', 'verbo', present3='er bringt', perfekt='hat gebracht'), 'bringst brachte brachten gebracht'),
    (T('einkaufen', 'verbo', present3='er kauft ein', perfekt='hat eingekauft', separable=True), 'kaufe kaufst kaufte einkaufte eingekauft'),
    (T('studieren', 'verbo', present3='er studiert', perfekt='hat studiert'), 'studierst studierte studiert'),
    (T('lesen', 'verbo', present3='er liest', praeteritum='las', perfekt='hat gelesen'), 'lese liest lies las lasen last gelesen'),
    (T('fahren', 'verbo', present3='er fährt', praeteritum='fuhr', perfekt='ist gefahren'), 'fahre fährst fährt fuhr fuhren fahr'),
    (T('halten', 'verbo', present3='er hält', praeteritum='hielt', perfekt='hat gehalten'), 'hältst hält hielt hielten'),
    (T('können', 'verbo', present3='er kann', praeteritum='konnte', perfekt='hat gekonnt'), 'kann kannst können könnt konnte konnten konntest'),
    (T('müssen', 'verbo', present3='er muss', praeteritum='musste', perfekt='hat gemusst'), 'muss musst müssen musste'),
    (T('wissen', 'verbo', present3='er weiß', praeteritum='wusste', perfekt='hat gewusst'), 'weiß weißt wissen wusste'),
    (T('sich freuen', 'verbo', present3='er freut sich', perfekt='hat sich gefreut'), 'freue freust freut freute gefreut'),
    (T('gehören', 'verbo', present3='er gehört', perfekt='hat gehört'), 'gehört gehörte gehörst'),
    (T('sammeln', 'verbo', present3='er sammelt', perfekt='hat gesammelt'), 'sammle sammelst sammelt sammelte'),
    (T('Rad fahren', 'verbo', present3='er fährt Rad', perfekt='ist Rad gefahren'), 'rad fährt fahre gefahren'),
    (T('das Haus', 'sustantivo', gender='n', plural='die Häuser'), 'haus hauses häuser häusern'),
    (T('der Mann', 'sustantivo', gender='m', plural='die Männer'), 'mann mannes manns männer männern'),
    (T('der Kollege', 'sustantivo', gender='m', plural='die Kollegen'), 'kollege kollegen'),
    (T('der Patient', 'sustantivo', gender='m', plural='die Patienten'), 'patient patienten'),
    (T('die Frau', 'sustantivo', gender='f', plural='die Frauen'), 'frau frauen'),
    (T('gut', 'adjetivo'), 'gut gute guten guter gutem gutes'),
    (T('klein', 'adjetivo'), 'kleiner kleinen kleinste kleinsten kleineren'),
    (T('teuer', 'adjetivo'), 'teuer teure teuren teurer'),
    (T('dunkel', 'adjetivo'), 'dunkle dunklen dunkler'),
    (T('müde', 'adjetivo'), 'müde müden müder'),
    (T('guten Morgen', 'expresión'), 'guten morgen'),
]
# formas que NO deben aceptarse
NOT = [
    (T('nehmen', 'verbo', present3='er nimmt', perfekt='hat genommen'), 'nehmte'),
    (T('das Haus', 'sustantivo', gender='n', plural='die Häuser'), 'hausen'),
    (T('die Frau', 'sustantivo', gender='f', plural='die Frauen'), 'fraus'),
]
bad = 0
for t, expect in CASES:
    forms = term_forms(t)
    miss = [f for f in expect.split() if f not in forms]
    if miss: bad += 1; print('✗', t['term'], 'faltan:', miss)
for t, f in NOT:
    if f in term_forms(t): bad += 1; print('✗', t['term'], 'no debería aceptar', f)

# compuestos transparentes
lx = Lexicon(['A1', 'A2'])
for t in [T('der Zahn', 'sustantivo', gender='m', plural='die Zähne'), T('die Schmerzen', 'sustantivo', gender='pl', plural='die Schmerzen'),
          T('die Arbeit', 'sustantivo', gender='f', plural='die Arbeiten'), T('der Platz', 'sustantivo', gender='m', plural='die Plätze')]:
    lx.add_term(t)
for w, ok in [('Zahnschmerzen', True), ('Arbeitsplatz', True), ('Zahnarzt', False)]:
    r, comp = lx.rank_of(w)
    if (r is not None) != ok: bad += 1; print('✗ compuesto', w, r)

print('lematización:', 'bien' if not bad else f'{bad} fallos', f'({len(CASES) + len(NOT) + 3} casos)')
sys.exit(1 if bad else 0)
