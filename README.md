# Lingo Lab

Web app instalable (PWA) para estudiar **portugués (pt-BR)**, **chino mandarín (zh-CN)** y **alemán (de-DE, A1 a B1)** a diario, pensada primero para iPhone. Funciona sin internet, guarda todo en el dispositivo y, si quieres, lo sincroniza en la nube (Neon) entre tus dispositivos. Agregar un idioma nuevo consiste en crear una carpeta.

La planeación original está en [`PLANEACION_APP_IDIOMAS.md`](./PLANEACION_APP_IDIOMAS.md) y el plan del curso de chino en [`PLAN_CHINO_HSK3_LINGOLAB.md`](./PLAN_CHINO_HSK3_LINGOLAB.md).

## Qué incluye

- **Hoy**: la meta diaria con su anillo de XP, la racha (con un congelador por semana) y un botón que decide qué toca: repasar, seguir la ruta o practicar.
- **Ruta**: organizada por niveles, con una pestaña por nivel. Se puede entrar a cualquier nivel o saltarlo con una **prueba de nivel** (25 preguntas, 85 % para pasar).
  - Chino: **HSK 1 a HSK 4 completo (HSK 3.0)**: 106 unidades, 476 lecciones y las 2.000 palabras de las listas oficiales, con 1.593 frases de ejemplo, 64 guías de gramática y 110 diálogos de escucha.
  - Alemán: 18 unidades y 54 lecciones (A1, A2 y B1), unas 560 palabras y 33 guías.
  - Portugués: 4 unidades y 12 lecciones.
- **Lecciones generadas**: en chino cada lección indica solo sus palabras y frases; los ejercicios se arman al abrirla (reconocer, escuchar, significado → palabra, tonos, escribir el pinyin, parejas, completar la frase, ordenar, dictado). Hay cuatro tipos de lección: vocabulario, gramática (abre con la explicación), escucha (diálogos a dos voces con la pregunta al final, como en el HSK) y repaso de unidad.
- **Puntos débiles**: cada ejercicio de gramática o escucha cuenta para su tema. Con 3 fallos el tema aparece en Hoy como «Refuerza: …» y se limpia con 5 aciertos seguidos. Cada guía tiene «Practicar este punto».
- **Ejercicios**:
  - Del núcleo: opción múltiple (también como hueco en una frase), escuchar y elegir, traducir escribiendo, ordenar palabras (también de oído), emparejar y diálogo de escucha.
  - Del portugués: conjugar verbos.
  - Del chino: identificar tonos.
  - Del alemán: elegir der/die/das y completar huecos (casos, terminaciones, conjugación).
- **Repaso con FSRS** (`ts-fsrs`), al estilo Anki:
  - Tres tarjetas por palabra: reconocer (sin pinyin en el frente), **escuchar** (solo audio) y **escribir** (del español al chino, con la nota sugerida según lo que escribas). Las dos últimas nacen cuando reconocer ya aguanta unos días, y nunca salen dos de la misma palabra el mismo día.
  - Deshacer la última nota (botón o tecla `z`), apartar una tarjeta, y **sanguijuelas**: una tarjeta fallada 6 veces se aparta sola y queda en «Palabras difíciles» con espacio para un truco.
  - Retención objetivo configurable (85, 90 o 93 %), cupos separados de palabras nuevas y de repasos, intervalos previstos en cada botón.
  - **Cobertura por nivel** (palabras vistas y consolidadas de HSK 1 a 4) y meta con fecha: Hoy calcula cuántas lecciones al día hacen falta.
- **Corrección tolerante**:
  - Portugués: una tilde faltante cuenta como "casi correcto", y se acepta una errata en palabras largas.
  - Chino: se acepta hanzi o pinyin con números (`ni3 hao3`), y si fallas el tono te lo dice.
- **Guías de gramática** en Markdown, con ejemplos que se pueden escuchar.
- **Herramientas**:
  - Portugués: tabla de conjugación y falsos amigos.
  - Chino: números al oído (hora con 差 y 刻, precios, descuentos, cifras), entrenador de tonos, orden de trazos (hanzi-writer) y radicales.
  - Alemán: tabla de casos, verbos irregulares y preposiciones con su caso.
- **Diccionario personal**: búsqueda, filtros, ficha de cada palabra (en chino, con sus trazos) y palabras propias.
- **Progreso**: estadísticas, mapa de actividad, previsión de repasos, cobertura por nivel y logros. El botón **Copiar contexto para el tutor** resume tu estado (lección, cobertura, palabras recientes y difíciles, puntos débiles) para pegarlo en una conversación con Claude; el prompt del tutor está en [`TUTOR_CHINO.md`](./TUTOR_CHINO.md).
- **Ajustes**: tema claro, oscuro o del sistema; velocidad de voz; meta; límites diarios; exportar o importar el progreso en JSON; proteger el almacenamiento.
- **Nube (opcional)**: sincronización con Neon mediante un código de 20 caracteres; ver más abajo.
- **PWA**: funciona offline, se instala en iOS (con instrucciones dentro de la app) y respeta las zonas seguras de la pantalla.

## Stack

React 19, TypeScript 7, Vite 8, Tailwind CSS 4, Motion, React Router 8, Zustand, Dexie (IndexedDB), ts-fsrs, Zod 4, hanzi-writer, Phosphor Icons, Sonner y vite-plugin-pwa. La sincronización usa una función serverless de Vercel (`api/sync.ts`) con `@neondatabase/serverless`. Las pruebas usan Vitest y Playwright (WebKit con perfil de iPhone y Chromium).

## Comandos

```bash
npm install
npm run dev               # servidor de desarrollo
npm run build             # typecheck + build de producción (dist/)
npm run preview           # sirve dist/ en local
npm test                  # tests unitarios (Vitest)
npm run test:e2e          # flujo completo en iPhone/WebKit y Chromium (requiere build)
npm run validate-content  # valida todos los paquetes de idioma (también corre en CI)
npm run new-language fr "Francés" fr-FR Français   # crea un idioma desde la plantilla
npm run icons             # regenera los iconos PWA
npm run lint              # revisa el formato con Prettier
```

## Probar en el iPhone

La app se publica sola en **GitHub Pages** con cada push a `main` (workflow `.github/workflows/pages.yml`):

**https://camiloherrera-dev.github.io/IDIOMAS-APP/**

Ábrela en Safari, toca **Compartir** y elige **Agregar a inicio**. Para compilar con la misma subruta en local: `BASE_PATH=/IDIOMAS-APP/ npm run build`. Sin `BASE_PATH` la app se sirve en la raíz (útil para Vercel; `vercel.json` ya está listo).

## Sincronización en la nube (Neon)

Sin configurar nada, la app guarda todo en el dispositivo (IndexedDB). Para tener el mismo progreso en el iPhone y en el computador:

1. **Base de datos gratis en Neon.** Crea una cuenta en [neon.tech](https://neon.tech) (plan Free) y un proyecto `lingo-lab` en la región **AWS US East 1**. En **Connect** copia la cadena de conexión *pooled* (`postgresql://…-pooler…/neondb?sslmode=require`). Es la única "clave" que hace falta; no se necesita MCP ni API key.
2. **Desplegar en Vercel (gratis).** En [vercel.com](https://vercel.com) importa el repositorio `IDIOMAS-APP` (detecta Vite solo). En **Settings → Environment Variables** agrega `DATABASE_URL` con la cadena de Neon y vuelve a desplegar. Atajo: en la pestaña **Storage** de Vercel puedes crear la base Neon desde ahí y la variable se agrega sola.
3. **Activar.** Abre la URL de Vercel en el iPhone, instálala (Compartir → Agregar a inicio) y ve a **Ajustes → Nube → Activar**. Copia el código que aparece.
4. **Otro dispositivo.** En **Ajustes → Nube → Ya tengo un código**, pega el código. Los progresos se combinan.

La tabla `lingo_sync` se crea sola en el primer uso. El código nunca se guarda en claro (solo su SHA-256) y quien lo tenga puede ver tu progreso, así que no lo compartas.

**¿Y GitHub Pages?** Pages solo sirve archivos estáticos, así que la API vive en Vercel. Si quieres seguir usando la URL de Pages, crea en GitHub la variable de repositorio `SYNC_URL` (Settings → Secrets and variables → Actions → Variables) con `https://<tu-proyecto>.vercel.app/api/sync` y vuelve a desplegar.

**En local:** `npm run dev` no sirve `/api`. Para probar la sincronización usa `npx vercel dev` con un `.env.local` (copia `.env.example`).

Cómo funciona: cada dispositivo envía una foto de sus datos a `/api/sync`; el servidor la fusiona con la guardada (gana el repaso más reciente de cada tarjeta, se suma el historial, se conserva el mejor puntaje de cada lección) y devuelve el resultado. La fusión está en `src/db/sync/merge.ts` y es la misma en la app y en el servidor. Se sincroniza al abrir la app, al volver a ella, al recuperar internet y cada 5 minutos.

## Arquitectura

```
src/
├─ app/            rutas, shell con barra de pestañas, banner de instalación
├─ core/           núcleo sin idiomas concretos
│  ├─ schema.ts    esquemas Zod del contenido y de los ejercicios genéricos
│  ├─ types.ts     contratos LanguagePack y ExercisePlugin
│  ├─ exercises/   los 6 ejercicios genéricos y su registro
│  ├─ lessons/     arma sesiones de lección, genera ejercicios, pruebas de nivel y refuerzos
│  ├─ skills/      seguimiento de puntos débiles
│  ├─ srs/         FSRS: mazo, tarjetas hermanas, cola de repaso, deshacer, cobertura
│  ├─ gamification XP, racha con congelador, logros
│  ├─ answer-check normalización y comparación de respuestas
│  └─ audio/       TTS (Web Speech) y sonidos de feedback sintetizados
├─ languages/
│  ├─ index.ts     registro automático (import.meta.glob)
│  ├─ _template/   plantilla para un idioma nuevo
│  ├─ pt/          config, contenido, conjugador, ejercicio de conjugar, herramientas
│  ├─ zh/          config, contenido, pinyin, ejercicio de tonos, trazos, radicales
│  └─ de/          config, contenido A1 a B1, ejercicios der/die/das y huecos, tablas
├─ db/             esquema Dexie, export/import
│  └─ sync/        sincronización con la nube (fusión, cliente)
├─ features/       pantallas
└─ components/     UI base
api/
└─ sync.ts         función serverless: guarda y fusiona el progreso en Neon
content-src/
└─ zh/             fuentes del curso de chino y su generador (build.py)
```

**Agregar un idioma**: ejecuta `npm run new-language <id> "<Nombre>" <locale>`, escribe el contenido en `content/` y corre `npm run validate-content`. El idioma aparece solo en el selector y el núcleo no se toca. Si el idioma necesita ejercicios propios, regístralos en `exercises` del `language.config.ts` y declara su esquema en `exercises/schemas.ts`.

### Formato del contenido

- `content/vocab/*.json`: lista de términos con `id`, `term`, `reading`, `meaning.es`, `level`, `examples` y `extra`.
- `content/units/*.json`: una unidad con sus lecciones. Una lección puede traer ejercicios escritos a mano (`exercises`) o pedir que se generen (`drill: true` con `vocab`, y `sentences` con frases en contexto). `kind` es `vocab`, `grammar`, `listening` o `review`; `skill` enlaza los fallos con una guía.
- Una frase es `{ "text": "我 [本来] 想 去。", "tr": "…" }`: palabras separadas por espacios y la palabra que se practica entre corchetes.
- `content/grammar/*.md`: una guía con frontmatter (`title`, `summary`, `level`, `order`). Los ejemplos con audio van en un bloque `ejemplos` con una línea por ejemplo: `texto | traducción` o, en chino, `hanzi | pinyin | traducción`.
- `content/legacy.json` (opcional): ids de términos antiguos → ids actuales, para conservar el progreso al regenerar un curso.

### El curso de chino se genera

`src/languages/zh/content/` no se edita a mano: sale de `content-src/zh/` con `python3 content-src/zh/build.py` (necesita `pip install pypinyin`).

| Fuente | Contenido |
| --- | --- |
| `listas-hsk.json` | las listas oficiales HSK 3.0, niveles 1 a 5 (3.600 palabras) |
| `es/h1.txt`…`h4.txt` | significado en español y tema de cada palabra: `汉字 significado #tema` |
| `frases/h1.txt`…`h4.txt` | frases en contexto: `我[本来]想去。\| traducción` |
| `gramatica/h1.txt`…`h4.txt` | puntos gramaticales: explicación en Markdown, opciones de hueco y frases |
| `escucha/h1.txt`…`h4.txt` | diálogos con pregunta, respuesta correcta y distractores |

El generador agrupa las palabras por tema en lecciones de unas 8, coloca cada frase en la lección de su palabra más tardía, reparte la gramática y la escucha entre las unidades y avisa si una frase usa palabras de un nivel superior (`--report`). `--lessons` muestra la agrupación y `--missing=4` las palabras que aún no tienen frase. Para llegar a HSK 5 falta traducir sus 1.600 palabras en `es/h5.txt` y añadir `5` a `LEVELS`.

## Diseño

- **Color**: neutros fríos y un acento por idioma (verde para el portugués, bermellón para el chino, azul para el alemán), definidos como tokens OKLCH en `src/styles/index.css`. Hay modo claro y oscuro.
- **Forma**: las tarjetas tienen esquinas de 22 px, los controles de 16 px y los chips son píldoras.
- **Tipografía**: Plus Jakarta Sans. Para el chino se usa Noto Sans SC, que solo se descarga si estudias chino.
- **Movimiento**: animaciones cortas que solo usan `transform` y `opacity`, y que respetan `prefers-reduced-motion`.
