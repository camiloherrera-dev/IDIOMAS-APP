# Lingo Lab · Curso de chino HSK 1 a 4 y plan para un HSK 3 sólido

> Estado al 23 de noviembre de 2026. Este documento reemplaza el plan anterior: lo que antes era una lista de cosas por construir ahora describe lo que ya está en el código, cómo usarlo para la meta y lo que queda pendiente.
>
> Meta: 75 % o más en un simulacro HSK 3 (formato 3.0) entre finales de diciembre de 2026 y mediados de enero de 2027. Después, HSK 4 durante 2027.
> Punto de partida: diagnóstico 01 del 22-nov-2026, HSK 3 justo (60 %). Escucha 65 %, lectura 75 %, escritura 60 %.

---

## 1. Qué cambió en el planteamiento

El plan anterior proponía escribir a mano cada lección con sus 9 a 12 ejercicios, como en portugués. Con 2.000 palabras eso son unas 4.000 preguntas fijas que se memorizan a la segunda vuelta. El planteamiento nuevo es otro:

| Antes | Ahora | Por qué ayuda a aprender |
| --- | --- | --- |
| Ejercicios escritos a mano por lección | La lección solo declara **palabras y frases**; los ejercicios se generan al abrirla | Cada repetición es distinta: no se memoriza la posición de la respuesta, se reconoce la palabra |
| Palabras sueltas con una traducción | Cada palabra aparece en **frases en contexto** hechas solo con vocabulario de su nivel o inferior | El HSK pregunta con frases; una palabra se fija cuando se ve usada |
| Gramática como guía para leer | Cada punto es una **lección**: explicación, huecos, ordenar, dictado | Los cuatro temas débiles del diagnóstico son gramática y escucha, no vocabulario |
| Escuchar una palabra y elegir | **Diálogos a dos voces** con la pregunta al final, sin texto | Es el formato real de la parte de escucha |
| Una ruta lineal desde HSK 1 | **Niveles con pestañas** y prueba para saltarlos | No se pierden semanas repasando lo que ya se sabe |
| Seguimiento de errores para un tutor futuro | **Puntos débiles** en la app: 3 fallos en un tema lo ponen en Hoy | El refuerzo llega solo, sin depender de otra herramienta |
| Tutor con API y servidor | Prompt en un Proyecto de Claude + botón **Copiar contexto para el tutor** | Funciona hoy, sin claves ni costo, y el tutor parte de datos reales |
| Lista de palabras escrita a mano | Contenido generado desde las **listas oficiales HSK 3.0** | Cobertura exacta: lo que entra al examen es lo que se estudia |

---

## 2. Lo que hay en la app

### 2.1 El curso

| Nivel | Palabras del nivel | Unidades | Lecciones | Vocabulario | Gramática | Escucha | Repaso | Frases |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HSK 1 | 300 | 19 | 82 | 45 | 16 | 2 | 19 | 274 |
| HSK 2 | 200 | 16 | 63 | 31 | 12 | 4 | 16 | 194 |
| HSK 3 | 500 | 26 | 126 | 71 | 21 | 8 | 26 | 350 |
| HSK 4 | 1.000 | 45 | 205 | 137 | 15 | 8 | 45 | 775 |
| **Total** | **2.000** | **106** | **476** | 284 | 64 | 22 | 106 | **1.593** |

Además: 64 guías de gramática (las 6 que ya existían y 58 nuevas) y 110 diálogos de escucha.

Las palabras de cada nivel se agrupan por tema (personas, tiempo, comida, lugares, estudio, trabajo, emociones, palabras gramaticales…) en lecciones de unas 8 palabras. Cada unidad tiene hasta 4 lecciones de vocabulario, la gramática y la escucha que le tocan, y cierra con un repaso.

### 2.2 Los cuatro tipos de lección

1. **Vocabulario**: presenta las palabras de 4 en 4 y cada grupo se practica enseguida (reconocer el significado). Después sube la exigencia: escuchar y elegir, del español al chino, tonos, escribir el pinyin, parejas, y por último las frases (completar el hueco, ordenar, dictado). El pinyin se muestra en HSK 1 y 2 y se retira en las frases desde HSK 3.
2. **Gramática**: abre con la explicación de la guía y sigue con unos 14 ejercicios sobre sus frases: elegir el conector o la partícula que falta, ordenar las palabras (la tarea de escritura del HSK 3), entender la frase y dictado.
3. **Escucha**: 5 diálogos. Suena el diálogo con dos voces y la pregunta al final; el texto y la traducción aparecen solo después de responder.
4. **Repaso de unidad**: mezcla palabras y frases de toda la unidad.

Las lecciones fallan con gracia: los ejercicios que se responden mal se repiten una vez al final.

### 2.3 Los cuatro temas débiles del diagnóstico, dentro del curso

| Tema del diagnóstico | Lección de gramática (HSK 3) | Escucha asociada |
| --- | --- | --- |
| Conectores | «如果, 只要, 只有» (unidad 1) · «本来, 只好, 其实» (unidad 2) · «以为/认为 y 一直/一共» (unidad 4) · «而且, 又…又, 先…然后» (unidad 18) | «El plan cambió» · «Primero y después» |
| 把, 让 y 告诉 | «把» (unidad 5) · «让, 叫 y 被» (unidad 6) · «告诉, 给, 送, 借, 还» (unidad 7) | «把 y 被» |
| Detalles al oído | «Hora, dinero y cuentas» (unidad 9) | «La hora al oído» · «Precios y cuentas» · herramienta **Números al oído** |
| Cortesía | «Fórmulas de cortesía» (unidad 10) | «Cortesía» |

No hace falta esperar a llegar a esas unidades: cada guía tiene **Practicar este punto** (10 ejercicios) y **Me cuesta** (lo pone en Hoy).

### 2.4 Navegación y ritmo

- **Ruta** tiene una pestaña por nivel. La primera lección de cada nivel está siempre abierta.
- **Ya lo sé: hacer la prueba**: 25 preguntas de todo el nivel. Con 85 % o más al primer intento, el nivel queda completo y sus palabras entran al repaso como sabidas, repartidas en las tres semanas siguientes para comprobarlas sin inundar la cola.
- **Meta con fecha** (Ajustes): se elige un nivel y un día, y Hoy muestra cuántas lecciones diarias hacen falta para llegar.
- **Puntos débiles**: 3 fallos en un tema lo muestran en Hoy como «Refuerza: …»; 5 aciertos seguidos lo retiran.

### 2.5 Flashcards

El repaso ya usaba FSRS, el algoritmo que Anki incorporó en sus versiones recientes. Lo nuevo:

| Función | Cómo funciona |
| --- | --- |
| Tres tarjetas por palabra | **Reconocer** (carácter → significado, sin pinyin en el frente), **Escuchar** (solo audio → significado) y **Escribir** (español → chino, tecleando hanzi o pinyin). Las dos últimas nacen cuando «reconocer» alcanza un intervalo de 2 días o más. Se activan o desactivan en Ajustes |
| Hermanas enterradas | Nunca salen dos tarjetas de la misma palabra el mismo día |
| Respuesta escrita | En «Escribir», la app compara lo tecleado y sugiere la nota |
| Frase en el reverso | La tarjeta muestra una frase del curso con audio |
| Deshacer | Botón o tecla `z`: restaura la tarjeta, el registro y el XP |
| Apartar | Saca una tarjeta de la cola sin borrarla |
| Sanguijuelas | Una tarjeta fallada 6 veces se aparta sola y queda en «Palabras difíciles» con un campo para escribir un truco |
| Retención objetivo | 85, 90 o 93 %: menos repasos o más seguridad |
| Cupos separados | Palabras nuevas por día (5 a 20) y tope de repasos (50 a 300) |
| Cobertura | Por nivel: cuántas palabras están en el mazo y cuántas consolidadas (estabilidad de 21 días o más) |
| Historial para FSRS | Cada repaso guarda estado, estabilidad y dificultad previos, para poder optimizar parámetros más adelante |

Diferencias con Anki que conviene saber: no hay editor de mazos ni de plantillas (las tarjetas salen del curso y del diccionario personal), y los parámetros de FSRS son los de fábrica.

### 2.6 Tutor

El prompt está en [`TUTOR_CHINO.md`](./TUTOR_CHINO.md), en español y con la meta de HSK 3. Se pega una vez en las instrucciones de un Proyecto de Claude. Antes de cada sesión, **Perfil → Copiar contexto para el tutor** genera un resumen con la lección actual, la cobertura por nivel, las palabras recientes, las que se resisten, los puntos débiles y la actividad de la semana.

---

## 3. Cómo usarlo hasta la meta

### 3.1 El primer día

1. Ruta → HSK 1 → **Ya lo sé: hacer la prueba**. Lo mismo con HSK 2. Si alguna no pasa del 85 %, conviene hacer los repasos de unidad de ese nivel y repetirla.
2. Ajustes → meta **HSK 3**, con fecha entre el 27 de diciembre y el 17 de enero. Palabras nuevas por día: 15.
3. Guías → abrir los cuatro temas débiles y tocar **Me cuesta** en cada uno.

### 3.2 El ritmo

HSK 3 son 126 lecciones y 500 palabras.

| Fecha objetivo | Lecciones por día | Palabras nuevas por día |
| --- | --- | --- |
| 27 de diciembre (34 días) | 4 | 15 |
| 17 de enero (55 días) | 2 o 3 | 10 |

Recomendación: 3 lecciones diarias entre semana y 4 el fin de semana. Así el contenido nuevo termina en la primera semana de enero y queda más de una semana de solo repaso y simulacros.

### 3.3 Un día de 90 minutos

| Bloque | Tiempo | Qué |
| --- | --- | --- |
| Repaso | 20 min | La cola de flashcards completa. Va primero porque es lo que no se puede recuperar después |
| Lecciones | 35 min | 3 lecciones de la ruta |
| Punto débil | 10 min | La fila «Refuerza» de Hoy, o 10 minutos de **Números al oído** |
| Tutor | 20 min | Sesión con Claude con el contexto pegado: rol, escritura o conversación |
| Lectura de errores | 5 min | Releer las frases falladas del día |

Día corto (45 min): repaso completo, una lección y el punto débil.

### 3.4 Controles

- **27 o 28 de diciembre**: simulacro 02 (el artifact «Simulacro HSK»). Si da 75 % o más, la meta está cumplida y se abre HSK 4. Si da entre 65 y 74 %, se sigue hasta el simulacro 03.
- **Mediados de enero**: simulacro 03.
- Después de cada simulacro: marcar **Me cuesta** en las guías de los temas fallados.

---

## 4. Lo que no está hecho

| Pendiente | Detalle |
| --- | --- |
| HSK 5 | Las 1.600 palabras están en `content-src/zh/listas-hsk.json`, con pinyin e inglés, pero sin traducir al español, sin frases y sin lecciones. La meta de 2027 es HSK 4, así que se dejó para después |
| Frases para todas las palabras | 103 palabras de HSK 3 y 209 de HSK 4 no tienen todavía una frase propia. Se enseñan y se practican igual, pero sin ejemplo en contexto. `python3 content-src/zh/build.py --missing=4` las lista |
| Audio | La voz es la del dispositivo (Web Speech), así que la calidad depende de la voz china que tenga instalada. Las dos voces del diálogo se distinguen solo por el tono. No hay audio grabado como en el simulacro |
| Escritura a mano | No hay ejercicio de escribir caracteres con el dedo dentro de las lecciones (sí la herramienta de trazos). En el HSK por computador se escribe con teclado pinyin, que es lo que entrena la tarjeta «Escribir» |
| Tutor dentro de la app | No hay chat con IA en la app. Se optó por el Proyecto de Claude más el botón de contexto |
| Puntos débiles en la nube | La tabla de puntos débiles es local: no entra en la sincronización con Neon ni en la copia de seguridad. Las tarjetas y el progreso sí |
| Optimizar FSRS | Se guarda el historial necesario, pero no hay optimizador de parámetros |
| Revisión por un hablante nativo | Las frases, explicaciones y diálogos los escribió Claude y pasaron comprobaciones automáticas de vocabulario por nivel, no una revisión humana. Si una frase suena rara, se corrige en `content-src/zh/frases/` |

---

## 5. Mantenimiento del contenido

El contenido de chino no se edita en `src/languages/zh/content/`: se genera.

```bash
pip install pypinyin
python3 content-src/zh/build.py            # regenera vocab, unidades, guías y legacy.json
python3 content-src/zh/build.py --report   # avisos: palabras de nivel superior, lecciones con pocas frases
python3 content-src/zh/build.py --lessons  # cómo quedaron agrupadas las palabras
npm run validate-content
```

| Para… | Editar |
| --- | --- |
| Corregir un significado o cambiar una palabra de tema | `content-src/zh/es/h{N}.txt` |
| Añadir o corregir una frase | `content-src/zh/frases/h{N}.txt` (`我[本来]想去。\| traducción`; con homógrafos, `[得#2]`) |
| Añadir un punto de gramática | `content-src/zh/gramatica/h{N}.txt` (un bloque `== id \| Título \| resumen`) |
| Añadir diálogos | `content-src/zh/escucha/h{N}.txt` |
| Permitir un nombre propio o una palabra fuera de lista | `content-src/zh/nombres.txt` |

Los ids de las palabras salen del número oficial de la lista (`zh-w-0531`), así que no cambian al reagrupar lecciones y el progreso se conserva. Las 87 palabras del curso anterior se resuelven con `legacy.json`.

---

## 6. Verificación

- `npm run build`: compila sin errores de tipos.
- `npm test`: 75 pruebas. Incluyen: las 476 lecciones generan una sesión válida con al menos 4 ejercicios; todas las palabras de las listas se enseñan en alguna lección; tarjetas hermanas, enterrado, deshacer, sanguijuelas y niveles saltados; puntos débiles.
- `npm run validate-content`: 2.007 términos, 476 lecciones y 64 guías válidos.
- `npm run test:e2e`: el flujo existente y uno nuevo de chino (ruta por niveles, lección generada, gramática, prueba de nivel, refuerzo, repaso con deshacer, guía, números, perfil). Se ejecutaron en Chromium de escritorio; en WebKit con perfil de iPhone no se pudieron correr en este entorno.
