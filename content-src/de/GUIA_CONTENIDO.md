# Guía para escribir contenido del curso de alemán

Para quien escriba una tanda de contenido (una persona o un agente). El curso es para hispanohablantes
de Colombia que estudian solos y empezaron desde cero. La meta es que hablen alemán con soltura.

## 1. Qué es una tanda

Una carpeta (por ejemplo `content-src/de/_b1/tanda1/`) con:

- `palabras.txt`: las palabras que hay que enseñar (ya viene dada; son entradas de la lista del Goethe).
- `curso.txt`: unidades y lecciones de vocabulario nuevas.
- `frases.txt`: frases en contexto para **todas** las lecciones de la tanda.
- `escucha.txt`: una escucha por unidad, con 4 diálogos.
- `lecturas.txt`: una lectura por unidad, con 3 preguntas y una tarea de escritura.
- `gramatica.txt`: solo si la tanda lo pide.
- `base.txt` y `nombres.txt` (opcionales): palabras gramaticales o nombres propios que hagan falta.

**No se toca ningún otro archivo del repositorio.** La integración la hace otra persona.

Se prueba con:

    python3 content-src/de/herramientas/probar_tanda.py b1 content-src/de/_b1/tanda1

La tanda está terminada cuando esa orden no imprime ninguna línea que empiece por `✗` (error) ni por `!`
(aviso). Un aviso significa casi siempre que una frase usa una palabra que todavía no se ha enseñado.

## 2. Qué hacer con `palabras.txt`

- Es una extracción automática y trae ruido. **Descarta** lo que no sea una palabra para enseñar: formas
  sueltas (`geliefert`), fragmentos (`all-`, `einig-`), nombres propios. Las formas femeninas (`die
  Lehrerin` junto a `der Lehrer`) no llevan ficha propia salvo que sean muy usadas; van en `base.txt`.
- Si una palabra ya está en el curso, la herramienta la quita sola y lo dice. No pasa nada.
- Puedes **añadir** palabras muy frecuentes del mismo campo que falten para que una lección tenga sentido,
  con moderación. Anota al final de tu informe cuáles descartaste y cuáles añadiste.
- Verifica artículo, plural y formas verbales de memoria con cuidado; si dudas de una, déjala fuera y dilo.

## 3. `curso.txt`

    @@ NEW
    == de-b1-t1-trabajo | B1 | Título de la unidad | Qué se aprende, en una frase.

    -- de-b1-t1-trabajo-l1 | Título de la lección
    der Vertrag, ¨-e = el contrato
    an|bieten (bietet an, bot an, hat angeboten) = ofrecer
    zuverlässig = confiable #adj

Reglas:

- Ids: unidad `de-<nivel>-t<tanda>-<tema>` y lección `<unidad>-l<n>`. Solo minúsculas, números y guiones.
- **Unas 8 palabras por lección** (entre 6 y 9) y **entre 5 y 8 lecciones por unidad**.
- Agrupa por **situación**, no por categoría: una lección mezcla sustantivos, verbos y adjetivos de la
  misma escena. No hagas lecciones de siete palabras intercambiables (siete animales, siete adjetivos de
  carácter): se confunden entre sí.
- Sustantivos: `artículo Palabra, plural = significado`. El plural va abreviado: `-e`, `-en`, `-n`, `-s`,
  `-` (no cambia), `¨` (solo diéresis), `¨-e`, `¨-er`, `(Sg.)` sin plural, `(Pl.)` solo plural. Si el
  plural es irregular (das Thema → Themen), usa la ficha larga:

      das Thema = el tema
        g: n
        pl: die Themen

- Verbos: `infinitivo (3.ª persona, [Präteritum,] Perfekt) = significado`. Pon siempre el Präteritum en
  los verbos fuertes o mixtos. Separables con `|`: `an|rufen (ruft an, rief an, hat angerufen)`.
  Reflexivos: `sich erinnern (erinnert sich, hat sich erinnert)`.
- Lo demás lleva la clase al final: `#adj`, `#adv`, `#prep`, `#conj`, `#expr`, `#pron`, `#num`.
- Si una palabra y otra de distinta clase se escriben igual (leben / das Leben), dale id propio a una:

      das Leben, - = la vida
        id: de-w-das-leben

- Formas que el generador no deduce (comparativos irregulares, Konjunktiv): línea `  formas: ...` bajo
  la palabra.
- Significados en español de Colombia, cortos: carro, celular, plata, arriendo, trastearse, tiquete.

## 4. `frases.txt`

    Ich [rufe=anrufen] dich morgen [an=anrufen]. | Te llamo mañana.
    Der [Vertrag] ist gültig. | El contrato está vigente.

- **Entre 4 y 6 frases por lección, y cada palabra de la lección debe ser foco de al menos una frase.**
- La palabra foco va entre corchetes tal como aparece en la frase. Si la forma es ambigua o es un verbo
  separable, se indica la palabra: `[forma=palabra]`. Las dos partes de un separable van marcadas.
- Una frase solo puede usar palabras **ya enseñadas**: todo A1 y A2, las unidades de B1 anteriores a la
  tanda y las lecciones anteriores de la propia tanda. La herramienta lo comprueba.
- Frases naturales, de entre 4 y 10 palabras, que alguien diría de verdad. Varía sujetos y tiempos. En B1
  usa también Präteritum, subordinadas, pasiva y Konjunktiv II cuando salga natural.
- Traducción al español de Colombia, natural, no palabra por palabra.
- Nada de guiones largos (— o –).

## 5. `escucha.txt`

    == Escucha: en la oficina | @de-b1-t1-trabajo
    F: Haben Sie den Vertrag schon unterschrieben?
    M: Nein, ich möchte ihn zuerst lesen.
    Q: Was möchte der Mann zuerst machen?
    + den Vertrag lesen
    - den Vertrag unterschreiben
    - kündigen
    = Dos colegas hablan de un contrato.

- Una escucha por unidad, anclada con `@<id de unidad>`, con **4 diálogos** separados por una línea vacía.
- `F:` y `M:` son dos voces; `N:` es un aviso o un mensaje grabado. `Q:` pregunta en alemán, `+` respuesta
  correcta, `-` dos distractores verosímiles, `=` de qué trata, en español.
- El título debe ser único en todo el curso.

## 6. `lecturas.txt`

    == Der neue Vertrag | @de-b1-t1-trabajo
    T: Primer párrafo.
    T: Segundo párrafo.
    = Traducción completa al español.
    Q: Pregunta en alemán
    + correcta
    - falsa
    - falsa
    W: Consigna en español | Palabra1 Palabra2 Palabra3 | 40 | Texto modelo en alemán. | Traducción del modelo.

- Una lectura por unidad: en B1, entre 90 y 130 palabras en 2 o 3 párrafos; 3 preguntas en alemán.
- `W:` es la tarea de escritura: consigna, tres palabras del curso que hay que usar (una sola palabra cada
  una, tal como están en el curso, sin artículo), mínimo de palabras (B1: 35 a 50), un texto modelo que
  cumpla todo eso y su traducción. Todo en una sola línea.
- El título debe ser único en todo el curso.

## 7. `gramatica.txt`

    == pasiva | keep | @de-b1-t1-trabajo-l2
    c: wird werden wurde wurden
    Das Haus [wird] gebaut. | Están construyendo la casa.

- `keep` significa que la guía ya existe en `src/languages/de/content/grammar/<id>.md`. Léela antes.
- Entre 6 y 8 frases con la forma que se practica entre corchetes; `c:` son las opciones del hueco.

## 8. Calidad

- El alemán tiene que ser correcto: caso, género, orden de la frase, verbo al final en subordinadas.
  Relee cada frase antes de darla por buena. Es mejor una frase sencilla y segura que una vistosa y dudosa.
- No inventes datos. Los textos son casos claramente ficticios.
- Di en tu informe final qué probaste, qué no y de qué frases o palabras no estás seguro.
