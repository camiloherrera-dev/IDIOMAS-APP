# Lingo Lab

Web app instalable (PWA) para estudiar **portugués (pt-BR)** y **chino mandarín (zh-CN)** a diario, pensada primero para iPhone. Funciona sin internet y guarda todo en el dispositivo. Agregar un idioma nuevo consiste en crear una carpeta.

La planeación original está en [`PLANEACION_APP_IDIOMAS.md`](./PLANEACION_APP_IDIOMAS.md).

## Qué incluye

- **Hoy**: la meta diaria con su anillo de XP, la racha (con un congelador por semana) y un botón que decide qué toca: repasar, seguir la ruta o practicar.
- **Ruta**: 4 unidades y 12 lecciones por idioma. Cada lección presenta las palabras nuevas y luego tiene de 9 a 12 ejercicios. Los que fallas se repiten al final.
- **Ejercicios**:
  - Del núcleo: opción múltiple, escuchar y elegir, traducir escribiendo, ordenar palabras y emparejar.
  - Del portugués: conjugar verbos.
  - Del chino: identificar tonos.
- **Repaso con FSRS** (`ts-fsrs`): tarjetas que se voltean, con 4 calificaciones y el intervalo previsto para cada una.
- **Corrección tolerante**:
  - Portugués: una tilde faltante cuenta como "casi correcto", y se acepta una errata en palabras largas.
  - Chino: se acepta hanzi o pinyin con números (`ni3 hao3`), y si fallas el tono te lo dice.
- **Guías de gramática** en Markdown, con ejemplos que se pueden escuchar.
- **Herramientas**:
  - Portugués: tabla de conjugación y falsos amigos.
  - Chino: entrenador de tonos, orden de trazos (hanzi-writer) y radicales.
- **Diccionario personal**: búsqueda, filtros, ficha de cada palabra (en chino, con sus trazos) y palabras propias.
- **Progreso**: estadísticas, mapa de actividad, previsión de repasos y logros.
- **Ajustes**: tema claro, oscuro o del sistema; velocidad de voz; meta; límites diarios; exportar o importar el progreso en JSON; proteger el almacenamiento.
- **PWA**: funciona offline, se instala en iOS (con instrucciones dentro de la app) y respeta las zonas seguras de la pantalla.

## Stack

React 19, TypeScript 7, Vite 8, Tailwind CSS 4, Motion, React Router 8, Zustand, Dexie (IndexedDB), ts-fsrs, Zod 4, hanzi-writer, Phosphor Icons, Sonner y vite-plugin-pwa. Las pruebas usan Vitest y Playwright (WebKit con perfil de iPhone y Chromium).

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

La PWA necesita HTTPS. La forma más simple es hacer deploy en Vercel: importa el repo y no hace falta configurar nada, porque `vercel.json` ya incluye las reescrituras de la SPA y los encabezados de caché. Luego abre la URL en Safari, toca **Compartir** y elige **Agregar a inicio**.

## Arquitectura

```
src/
├─ app/            rutas, shell con barra de pestañas, banner de instalación
├─ core/           núcleo sin idiomas concretos
│  ├─ schema.ts    esquemas Zod del contenido y de los ejercicios genéricos
│  ├─ types.ts     contratos LanguagePack y ExercisePlugin
│  ├─ exercises/   los 5 ejercicios genéricos y su registro
│  ├─ lessons/     arma sesiones de lección y genera práctica
│  ├─ srs/         FSRS: mazo, cola de repaso, previsión
│  ├─ gamification XP, racha con congelador, logros
│  ├─ answer-check normalización y comparación de respuestas
│  └─ audio/       TTS (Web Speech) y sonidos de feedback sintetizados
├─ languages/
│  ├─ index.ts     registro automático (import.meta.glob)
│  ├─ _template/   plantilla para un idioma nuevo
│  ├─ pt/          config, contenido, conjugador, ejercicio de conjugar, herramientas
│  └─ zh/          config, contenido, pinyin, ejercicio de tonos, trazos, radicales
├─ db/             esquema Dexie, export/import
├─ features/       pantallas
└─ components/     UI base
```

**Agregar un idioma**: ejecuta `npm run new-language <id> "<Nombre>" <locale>`, escribe el contenido en `content/` y corre `npm run validate-content`. El idioma aparece solo en el selector y el núcleo no se toca. Si el idioma necesita ejercicios propios, regístralos en `exercises` del `language.config.ts` y declara su esquema en `exercises/schemas.ts`.

### Formato del contenido

- `content/vocab/*.json`: lista de términos con `id`, `term`, `reading`, `meaning.es`, `examples` y `extra`.
- `content/units/*.json`: una unidad con sus lecciones. Cada lección tiene `vocab` (ids) y `exercises`.
- `content/grammar/*.md`: una guía con frontmatter (`title`, `summary`, `level`, `order`). Los ejemplos con audio van en un bloque `ejemplos` con una línea por ejemplo: `texto | traducción` o, en chino, `hanzi | pinyin | traducción`.

## Diseño

- **Color**: neutros fríos y un acento por idioma (verde para el portugués, bermellón para el chino), definidos como tokens OKLCH en `src/styles/index.css`. Hay modo claro y oscuro.
- **Forma**: las tarjetas tienen esquinas de 22 px, los controles de 16 px y los chips son píldoras.
- **Tipografía**: Plus Jakarta Sans. Para el chino se usa Noto Sans SC, que solo se descarga si estudias chino.
- **Movimiento**: animaciones cortas que solo usan `transform` y `opacity`, y que respetan `prefers-reduced-motion`.
