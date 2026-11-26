# Plan: modo «Escribir a mano»

Estado: **en espera**. Este documento describe cómo implementarlo; todavía no hay código.

## Objetivo

Practicar a mano los caracteres de la lista oficial de escritura (书写字) del programa HSK 3.0:
100 en HSK 1–2, 150 en HSK 3 y 150 en HSK 4. Los 400 ya aparecen en el vocabulario del curso.

Dos razones: el examen en papel los pide, y escribir a mano mejora el reconocimiento al leer.

## Qué ve el usuario

1. **En Repasar**, una tarjeta «Escribir a mano» con el avance por nivel (por ejemplo «HSK 1–2: 34 de 100»).
2. **Sesión de 5 a 10 caracteres.** Cada carácter pasa por tres pasos, de más ayuda a menos:
   - **Ver:** animación del orden de los trazos, con el pinyin, el significado y una palabra de ejemplo.
   - **Calcar:** se traza encima del carácter en gris; la app corrige trazo por trazo.
   - **De memoria:** solo se muestran el pinyin y el significado. Si se falla un trazo dos veces, aparece una pista de ese trazo.
3. **Dictado** (al final de la sesión): suena una palabra y se escribe de memoria.
4. **Modo papel:** para quien prefiere lápiz. La app muestra pinyin y significado, el usuario escribe en papel,
   toca «Ver» y se califica solo (bien o mal).

## Cuándo aparece cada carácter

- Un carácter se desbloquea cuando el usuario ya completó la lección de la primera palabra que lo contiene.
  Así nunca se pide escribir algo que no se ha visto.
- Dentro de lo desbloqueado, primero los de menos trazos.
- Los caracteres entran al repaso espaciado como un tipo de tarjeta nuevo, `write`, con su propia programación.
  Un fallo en «de memoria» cuenta como «Otra vez».

## Datos

- `content-src/zh/escritura.json`: `{ "1-2": [...100], "3": [...150], "4": [...150] }`, copiado del programa oficial.
- El build genera `content/handwriting.json` con, por carácter: nivel, primera palabra del curso que lo contiene,
  lección en la que se desbloquea, pinyin y significado de esa palabra, y número de trazos.
- El validador comprueba que los 400 estén en alguna palabra del curso y que tengan datos de trazos.

## Técnica

- **Trazos:** la app ya usa `hanzi-writer` para mostrar el orden de los trazos. Su modo `quiz()` hace el calcado
  y la escritura de memoria, con tolerancia configurable (`leniency`) y pista tras N fallos (`showHintAfterMisses`).
- **Datos de trazos:** hoy se piden a un CDN. Para que funcione sin conexión, incluir en la app solo los 400
  caracteres (unos 400–500 KB) y cargarlos por nivel.
- **Tarjetas:** añadir `write` a `CardKind`. Id `zh:hz-<carácter>#write`, para no chocar con las tarjetas de palabras.
  La sincronización por filas no cambia: es una fila más de `cards`.
- **Sesión:** componente propio (`HandwritingSession`), no un ejercicio del reproductor de lecciones: necesita
  pantalla completa y gestos táctiles sin desplazamiento (`touch-action: none`).
- **Calificación:** 0 fallos = «Bien»; 1–2 fallos = «Difícil»; pista o 3+ fallos = «Otra vez».

## Fases

1. **Datos y validación** (medio día): lista oficial, build, pruebas.
2. **Sesión de trazos** (1–2 días): ver, calcar, de memoria; probar en iPhone y con ratón.
3. **Repaso espaciado y avance** (1 día): tarjetas `write`, tarjeta en Repasar, sincronización.
4. **Dictado y modo papel** (medio día).
5. **Sin conexión** (medio día): empaquetar los datos de trazos.

## Decisiones abiertas

- ¿Los caracteres de escritura cuentan en el cupo diario de repasos o van aparte? Propuesta: aparte, máximo 10 nuevos al día.
- ¿Exigir el orden de trazos exacto? Propuesta: sí al calcar, y al escribir de memoria aceptar el trazo correcto
  aunque el orden cambie, porque el examen solo mira el resultado.
- En pantallas pequeñas el cuadro de escritura debe medir al menos 280 px; por debajo, el reconocimiento falla más.
