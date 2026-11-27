# Curso de alemán: investigación previa

Hecha el 26 de noviembre de 2026, antes de escribir contenido nuevo (paso 1 de `GUIA_CURSO_ALEMAN.md`).
Cada dato dice si se **verificó** en la fuente ese día o si queda **por verificar**. Lo que no se pudo
comprobar no se da por cierto.

Punto de partida acordado: los dos estudiantes empiezan desde cero. La meta es que hablen alemán con
soltura (B2) y, encima de eso, el alemán de su profesión: medicina y odontología.

## 0. Actualización del 26 de noviembre (segunda pasada)

- **La sección de salud queda en pausa** por decisión del dueño del proyecto: primero el alemán general
  de A1 a B2. Las secciones 3 y 3.5 se conservan como referencia para cuando se retome.
- **Ya están las listas del Goethe** (A1, A2 y B1) como referencia local en `referencia/`, extraídas de
  los PDF de forma automática (traen algo de ruido: alguna forma verbal suelta y las variantes femeninas).
- **Cobertura medida** con `build.py --cobertura` antes de escribir contenido nuevo:

  | Nivel | Entradas de la lista | Faltan en el curso | Del curso fuera de la lista |
  | --- | --- | --- | --- |
  | A1 | 634 | 421 | 77 |
  | A2 | 1090 | 717 | 75 |
  | B1 | 2703 | 2081 | 58 |

  A1 cubría un tercio de su lista. Faltaban, entre otras, *geben, schreiben, machen, gehen, Mann, Frau,
  Zug, Geld*. Las listas de palabras que faltan se regeneran en `referencia/faltan-*.txt`.
- **Forma del examen B2, verificada en el examen modelo para adultos** (Modellsatz): Lesen 65 minutos
  en 5 partes (18, 12, 12, 12 y 6 minutos sugeridos); Hören unos 40 minutos en 4 partes; Schreiben 75
  minutos en 2 partes (50 y 25); Sprechen unos 15 minutos en pareja (una exposición de unos 4 minutos
  por persona y una discusión de unos 5), con 15 minutos de preparación. Cada módulo vale 100 puntos y
  se aprueba con 60.
- **B2 sigue sin lista oficial.** Como segunda referencia hay listas de LanGeek (A2 912, B1 1692 y
  B2 2011 entradas). Sirven para revisar temas, no como fuente: tienen errores de artículo y de
  traducción, y prohíben redistribuir su contenido. La lista GCSE de OCR (examen escolar británico de
  2009) no sigue los niveles del MCER y no se usa.
- **Método para ampliar A1:** se conservan las unidades y palabras actuales (mismos ids) y a cada unidad
  se le añaden lecciones nuevas con las palabras que faltan, frases para todas sus lecciones, las
  lecciones de gramática de sus guías, una escucha, una lectura y el repaso. Hechas las unidades 1 y 2.

## 1. Decisiones que salen de esta investigación

1. **El vocabulario de A1 a B1 se rehace contra las listas del Goethe-Institut**, no se amplía el actual.
   El curso tiene 563 palabras para tres niveles; la lista de B1 sola tiene unas 2400 entradas.
2. **Las listas oficiales no se copian al repositorio.** Tienen derechos de autor y prohíben guardarlas en
   redes sin permiso. Se usan como referencia local (`content-src/de/referencia/`, fuera de git): el curso
   escribe su propio vocabulario y el generador informa de qué falta (`build.py --cobertura`).
3. **B2 no tiene lista oficial cerrada** (no se encontró ninguna). Se arma por los temas del examen
   Goethe-Zertifikat B2 y se contrasta con una lista de frecuencia. Queda por elegir cuál (ver 2.2).
4. **La meta lingüística de la sección de salud es la Fachsprachprüfung**: tres tareas de 20 minutos
   (entrevista con el paciente, documentación escrita, conversación con un colega). Es igual en forma para
   médicos y odontólogos, así que el tronco común y las dos ramas de la guía se confirman.
5. **B2 general es la puerta de entrada** para ejercer: sin el certificado B2 no se llega a la
   Fachsprachprüfung. Por eso el orden de trabajo es curso general primero y salud después, con un bloque
   de vocabulario de salud disponible antes para mantener la motivación.
6. **Las unidades se agrupan por situación, no por categoría.** Las lecciones no deben ser listas de
   palabras intercambiables (todos los colores, todos los días): ver 4.1.
7. **El género se practica produciendo**, no solo reconociendo: ver 4.2.

## 2. Referencia oficial por nivel

### 2.1 Vocabulario A1, A2 y B1 (Goethe-Institut)

| Nivel | Documento | Tamaño | Estado |
| --- | --- | --- | --- |
| A1 | Goethe-Zertifikat A1: Start Deutsch 1, Wortliste | unas 650 entradas; como vocabulario activo se espera cerca de la mitad | verificado |
| A2 | Goethe-Zertifikat A2, Wortliste (extracto de *Prüfungsziele, Testbeschreibung*, Hueber 2015) | unas 1100 entradas en la lista alfabética, más los grupos de palabras | verificado sobre el PDF |
| B1 | Goethe-Zertifikat B1 / ÖSD-Zertifikat B1, Wortliste (2016) | unas 2400 unidades léxicas | verificado |

- A1: <https://www.goethe.de/pro/relaunch/prf/ca/A1_SD1_Wortliste_02.pdf>
- B1: <https://www.goethe.de/pro/relaunch/prf/da/Goethe-Zertifikat_B1_Wortliste.pdf>
- Material de preparación de todos los niveles: <https://goethe.de/en/spr/prf/vor.html>

Lo que dicen las propias listas y cómo afecta al curso:

- **Son de referencia, no de estudio.** La de B1 dice que el candidato debe dominar ese vocabulario al
  menos de forma receptiva y que la lista sirve menos para practicar. El curso las usa igual: para decidir
  qué entra en cada nivel, no como orden de enseñanza.
- **No incluyen lo que se deduce.** Dejan fuera los compuestos transparentes (*Kinderbett*), los
  sustantivos derivados de verbos conocidos (*Zahlung*) y los verbos con prefijo deducible (*mitmachen*).
  El generador hace lo mismo: un compuesto cuyas dos partes ya se enseñaron cuenta como conocido y sale
  en el informe como «compuesto aceptado por sus partes».
- **Derechos.** La de B1 indica que la obra está protegida y que no se puede copiar, guardar ni poner en
  redes sin consentimiento escrito. De ahí la decisión 2.

**Pendiente práctico:** desde el entorno donde se genera el curso no hay acceso a goethe.de. Para hacer la
comparación automática hay que descargar los tres PDF a `content-src/de/referencia/` (ver sección 7).

### 2.2 Vocabulario B2

No se encontró una lista oficial del Goethe-Institut para B2 (la app de vocabulario del Goethe cubre A1,
A2 y B1). Opciones, por verificar antes de empezar B2:

- *Profile deutsch* (inventario del MCER para alemán): es la referencia más citada, pero es de pago.
- Vocabulario de un manual B2 reconocido (Aspekte neu, Sicher!): accesible, pero es de una editorial.
- Listas de frecuencia (DWDS, Wortschatz Leipzig): no se pudieron consultar desde aquí.

Propuesta: temas del examen B2 más contraste con una lista de frecuencia, y unas 1500 a 2000 palabras
nuevas sobre B1 (estimación, no dato).

### 2.3 Gramática por nivel

**No verificado todavía contra el inventario oficial.** Los documentos *Prüfungsziele, Testbeschreibung* de
cada examen traen el inventario gramatical (el de A1 Fit in Deutsch incluye una sección «Grammatik»). Hay
que leerlos antes de escribir guías: es el error del curso de chino que la guía pide no repetir.

Estado de las 33 guías actuales (nivel que les da el curso):

| Nivel | Guías |
| --- | --- |
| A1 (13) | alfabeto, saludos du/Sie, artículos y género, presente con sein y haben, verbos con cambio de vocal y möchten, números y hora, orden de la oración, acusativo con kein y nicht, posesivos, modales, separables, imperativo, Perfekt |
| A2 (10) | dativo, preposiciones con acusativo y dativo, preposiciones de dos casos, Präteritum de sein/haben/modales, reflexivos, comparativo, declinación del adjetivo, subordinadas (weil, dass, wenn, ob), futuro, cortesía (würde, hätte, könnte) |
| B1 (10) | Präteritum, Plusquamperfekt, genitivo, relativas, pasiva, Konjunktiv II, infinitivo con zu / um…zu / damit, conectores, verbos con preposición, repaso de casos y n-Deklination |

Sospechas a confirmar con el inventario (no son hallazgos):

- *war* y *hatte*, y el dativo con *mit* / *in* y con pronombres (*mir*, *dir*), suelen ser de A1; el curso
  los tiene en A2.
- No hay guía propia para: pronombres personales por caso, negación, preposiciones de tiempo (*am, um,
  im*) y de lugar, preguntas indirectas, subordinadas temporales (*als, während, bevor, seit*).
- Para B2 falta todo: Konjunktiv II en pasado, Konjunktiv I (estilo indirecto), pasiva con modales y sus
  alternativas, participios como adjetivo, nominalización, conectores de dos partes, relativas con
  preposición. Nominalización y pasiva son además la base del lenguaje médico escrito.

### 2.4 Formato de los exámenes

| Examen | Partes y tiempos | Aprobado | Estado |
| --- | --- | --- | --- |
| A1 Start Deutsch 1 | Lesen 25 min, Hören 20, Schreiben 20, Sprechen 15 (en grupo) | 60 de 100 puntos (75 escritos, 25 orales) | verificado |
| A2 | Lesen, Hören, Schreiben, Sprechen | 60 de 100 puntos | tiempos sin verificar |
| B1 | cuatro módulos que se presentan juntos o por separado | 60 % en cada módulo | tiempos sin verificar |
| B2 | Lesen 65 min, Hören unos 40, Schreiben 75, Sprechen 15 (en pareja); modular | 60 % en cada módulo | verificado |

En B2 la escritura son dos textos: una opinión en un foro y un mensaje formal de trabajo. La prueba de
nivel de la app (hoy con la forma del HSK: escucha, lectura, escritura) debe pasar a
Lesen, Hören, Schreiben para alemán. Fuentes: <https://www.goethe.de/de/spr/prf/pes.html> y las páginas
«Weitere Informationen» de cada examen en goethe.de.

## 3. Alemán para la salud

### 3.1 Alemania: médicos (verificado)

- Certificado de alemán general **B2** y, además, la **Fachsprachprüfung** ante el colegio médico del
  estado, que evalúa lenguaje médico orientado a **C1**.
- Formato común a los estados consultados (Berlín, Hesse, Baja Sajonia, Bremen, Renania del Norte,
  Baviera): examen individual de unos 60 minutos en tres partes de 20:
  1. **Arzt-Patienten-Gespräch**: anamnesis con un paciente simulado.
  2. **Dokumentation**: resumen escrito de la anamnesis para colegas, en frases completas.
  3. **Arzt-Arzt-Gespräch**: presentar el caso a un colega y responder sus preguntas.
- No evalúa conocimientos médicos, solo lengua. Hay diferencias por estado: en Brandeburgo la
  documentación dura 30 minutos; en Berlín se permite un diccionario médico en esa parte.
- Un reportaje de la prensa médica alemana cuenta que cerca de un tercio no la aprobaba al primer intento
  cuando se introdujo: el B2 general no basta para aprobarla.

### 3.2 Alemania: odontólogos (verificado, examen propio)

- Misma base (B2 general, lenguaje profesional orientado a C1), pero el examen lo hace la
  **Zahnärztekammer** de cada estado y su contenido es odontológico.
- Baja Sajonia (hoja informativa del 25.09.2025): tres partes de 20 minutos: **Zahnarzt-Patienten-Gespräch**
  (anamnesis, explicar hallazgos, diagnóstico y opciones de tratamiento con ventajas y desventajas),
  **Dokumentación** y **Zahnarzt-Zahnarzt-Gespräch**. Costo allí: 580 €.
- Aparte del idioma, un título de fuera de la UE pasa por reconocimiento de equivalencia o por un examen
  de conocimientos (*Kenntnisprüfung*). Eso es trámite profesional, no parte del curso.

### 3.3 Austria y Suiza

- Austria, médicos: prueba de B2 como requisito y **Sprachprüfung Deutsch** de la Österreichische
  Ärztekammer, oral y escrita, con contenido de la profesión (verificado en su reglamento).
- Austria, odontólogos: Sprachprüfung de la Österreichische Zahnärztekammer, de nivel C1 como mínimo
  (verificado en su descripción del examen).
- Suiza: **sin verificar**.

### 3.4 Exámenes de editorial

telc ofrece *Deutsch B2·C1 Medizin* y una *B2 Medizin Zugangsprüfung*; Baden-Württemberg cita el primero
entre los que puede aceptar como examen de lenguaje médico. Sirven de modelo de tareas. Para odontología
no se encontró un equivalente.

### 3.5 Qué significa para el curso

- Las tres tareas del examen son los tres tipos de práctica de la sección: diálogo de anamnesis
  (escucha y, más adelante, práctica oral), documentación (escritura con modelo) y presentación del caso.
- Dos registros en cada término: el que se usa con el paciente y el que se usa con colegas.
- Vocabulario y abreviaturas de salud: comprobar cada uno en dos fuentes antes de publicarlo. Fuentes de
  vocabulario aún por elegir y verificar (manuales de alemán para médicos, glosarios de colegios,
  numeración dental FDI).

## 4. Qué dice la investigación sobre cómo enseñar

### 4.1 Agrupar palabras (verificado en la literatura)

Tinkham (1993, 1997) y Waring (1997) encontraron que aprender a la vez palabras muy parecidas (conjuntos
semánticos: frutas, prendas) estorba, y Tinkham (1997) que agrupar por tema o situación (rana, verde,
estanque, saltar) ayuda. Estudios posteriores dan resultados mixtos (Ishii 2015 no halló diferencia) y uno
de 2019 en *Studies in Second Language Acquisition* propone que espaciar reduce la interferencia.

Decisión: unidades por situación; dentro de una lección, mezclar sustantivos, verbos y adjetivos de esa
situación en vez de siete palabras de la misma categoría. El repaso espaciado ya separa las parecidas.

### 4.2 Género (verificado)

- Keppenne, Hopman y Jackson (2021, *Applied Psycholinguistics*): con principiantes de alemán, practicar
  **produciendo** el género y la concordancia dio mejores resultados que practicar solo comprendiendo,
  tanto al producir como al comprender.
- Un estudio con universitarios irlandeses (*Teanga*, 2019): enseñar reglas de género y mnemotecnias mejoró
  la asignación de género, también al escribir.

Decisión: el sustantivo siempre se presenta con artículo y plural (el validador ya lo exige); el ejercicio
`de-article` se amplía a producir (escribir el artículo dentro de una frase, con adjetivo); y las reglas
por terminación (*-ung, -heit, -chen*) van como lección de gramática temprana.

### 4.3 Por revisar (no se buscó en esta pasada)

Enseñanza explícita de casos y declinación, orden de la frase y verbos separables, errores típicos de
hispanohablantes (falsos amigos, preposiciones, Perfekt frente a Präteritum) y las cuatro líneas de Nation,
que ya se aplicaron al curso de chino y se mantienen: lecturas, escucha y escritura desde A1.

## 5. El curso actual frente a la referencia

- **Tamaño:** 563 palabras (A1 209, A2 193, B1 161). La lista de A1 tiene unas 650 entradas y la de B1
  unas 2400.
- **Palabras usadas pero no enseñadas:** de las 2701 palabras de los ejercicios escritos a mano, 278
  apariciones (187 palabras distintas) no son tarjetas del curso. Entre ellas, palabras de primera semana:
  *gut, heute, jetzt, Frau, Herr, gehen, machen, Bus, Auto, schön, Stadt*. Es la prueba más clara de que
  hay que rehacer A1 desde la lista y no parchear.
- **Tipos de lección:** todas son de vocabulario con ejercicios fijos. No hay gramática como lección,
  escucha, lectura ni repaso.
- **Comparación palabra por palabra con las listas:** pendiente de tener los PDF (sección 7).

## 6. Decisiones técnicas ya implementadas

- **Generador** `content-src/de/build.py`. El esqueleto del curso (unidades, lecciones y palabras) se
  escribe a mano en `curso/*.txt`; así el orden pedagógico es explícito y los ids de unidades y lecciones
  son estables por definición. Gramática, escucha y lecturas se anclan a una unidad o lección con `@id`.
- **Migración sin cambios:** las 18 unidades y 563 palabras se convirtieron a las fuentes y el resultado
  generado es idéntico al anterior (comparado campo por campo). Los ids no cambiaron.
- **Lematización** `lemas.py`: las formas salen de las formas principales de cada término (plural, 3.ª
  persona, Präteritum, Perfekt) más `base.txt` para las palabras gramaticales. Sin librerías ni red.
  35 casos difíciles en `test_lemas.py`. Si falta el Präteritum de un verbo fuerte no se inventa: sale
  como aviso.
- **Verbos separables:** `Ich [rufe=anrufen] dich [an=anrufen].` marca las dos partes como una palabra foco.
- **Compuestos:** se aceptan si sus dos partes se conocen, con las letras de unión habituales.

## 7. Pendiente

1. **A1 está completo contra la lista** (27 nov): 12 unidades, 946 palabras en el curso, 491 frases, 12 lecciones
   de gramática, 12 escuchas, 12 lecturas y repaso por unidad. De las 634 entradas quedan 4, que son ruido de
   la extracción. Sigue A2 (faltan 426 entradas) y B1 (faltan 1713), con el mismo método.
2. Sección de salud: en pausa. Al retomarla, preguntar país y meta de cada estudiante.
3. Inventario gramatical oficial por nivel (2.3) antes de escribir guías.
4. Referencia de B2 (2.2), tiempos de los exámenes A2 y B1 (2.4), Suiza (3.3).
5. Cambios en el núcleo de la app que el contenido nuevo necesita: contar palabras en la escritura de
   textos, significado al tocar una palabra flexionada en las lecturas, opciones de hueco con formas
   flexionadas, prueba de nivel con la forma del Goethe, elección de rama en el perfil.
6. Pruebas de navegador: no se han corrido en esta etapa (ver README).
