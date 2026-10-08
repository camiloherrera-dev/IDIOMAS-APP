# 🌍 Planeación — App web para aprender idiomas (PWA)

> Nombre provisional: **Lingo Lab**
> Idiomas iniciales: **Portugués (pt-BR)** y **Chino mandarín (zh-CN)**
> Objetivo: una web app moderna, instalable en iPhone desde Safari ("Agregar a pantalla de inicio"), que sirva para **estudiar temas** y **practicar** a diario, y a la que se le puedan **agregar idiomas nuevos con código** sin reescribir la app.

---

## 1. Objetivos y principios

| Objetivo | Cómo se cumple |
|---|---|
| Aprender de verdad, no solo "jugar" | Repetición espaciada (algoritmo FSRS) + práctica activa (escribir, escuchar, hablar) |
| Fácil de usar | Una sola pantalla "Hoy" que dice qué hacer; sesiones de 5–15 min |
| Funciona como app en iOS | PWA: pantalla completa, icono propio, funciona offline |
| Escalable a largo plazo | Cada idioma es un **paquete** (carpeta con config + contenido + extensiones opcionales) |
| Sin depender de un servidor al inicio | Todo se guarda localmente (IndexedDB). Sincronización en la nube como fase posterior |

**Principios de diseño del código**

1. **Contenido ≠ código.** Lecciones, vocabulario y gramática viven en archivos JSON/Markdown validados con un esquema. Agregar contenido no requiere tocar componentes.
2. **El núcleo no conoce idiomas concretos.** El núcleo sabe de "tarjetas", "lecciones", "ejercicios". Lo específico (tonos del chino, conjugaciones del portugués) entra por *plugins* del paquete de idioma.
3. **Offline-first.** La app debe funcionar en el metro sin internet.
4. **Mobile-first.** Se diseña para el iPhone primero; el escritorio es una vista ampliada.

---

## 2. Stack tecnológico recomendado

| Capa | Tecnología | Por qué |
|---|---|---|
| Framework | **React 18 + TypeScript + Vite** | Rápido, tipado fuerte (clave para el sistema de plugins), mucho ecosistema |
| Estilos | **Tailwind CSS** + componentes de **shadcn/ui** (Radix) | Diseño moderno y consistente sin escribir CSS desde cero |
| Animaciones | **Framer Motion** | Transiciones fluidas tipo app nativa (tarjetas que giran, feedback de acierto/error) |
| Enrutamiento | **React Router** (o TanStack Router) | Navegación entre pantallas |
| Estado global | **Zustand** | Simple y liviano |
| Base de datos local | **Dexie.js** (sobre IndexedDB) | Guarda progreso, tarjetas y estadísticas offline |
| Repetición espaciada | **ts-fsrs** | Implementación del algoritmo FSRS (el más moderno, usado por Anki) |
| PWA | **vite-plugin-pwa** (Workbox) | Genera manifest + service worker, caché offline |
| Validación de contenido | **Zod** | Valida que cada paquete de idioma tenga el formato correcto |
| Voz (TTS) | **Web Speech API – speechSynthesis** | iOS trae voces de portugués y chino gratis |
| Reconocimiento de voz | **Web Speech API – SpeechRecognition** (cuando exista) | Soporte parcial en Safari; se trata como función opcional |
| Chino | **pinyin-pro** (hanzi → pinyin), **hanzi-writer** (orden de trazos) | Indispensables para estudiar caracteres |
| Gráficas | **Recharts** | Estadísticas de progreso |
| Tests | **Vitest** + **Testing Library** + **Playwright** (e2e) | Calidad y no romper cosas al crecer |
| Deploy | **Vercel / Netlify / GitHub Pages** | Gratis y con HTTPS (obligatorio para PWA) |
| Base de datos en la nube | **Neon** (Postgres serverless) | Guarda el progreso en la nube y lo sincroniza entre dispositivos; plan gratuito, escala a cero |
| Acceso a Neon | **@neondatabase/serverless** + **Drizzle ORM** en funciones serverless (`/api`) | El navegador nunca toca la base directamente; la cadena de conexión queda en el servidor |
| Autenticación | **Neon Auth** (alternativas: Better Auth o Clerk) | Login (email / Google) con usuarios guardados en la misma base de Neon |
| (Fase 4) IA | API de un LLM a través de una **función serverless** | Tutor conversacional y corrección de textos (la API key nunca va en el frontend) |

---

## 3. Requisitos específicos para iOS (PWA)

Checklist para que se sienta como app nativa en el iPhone:

- [ ] `manifest.webmanifest` con `display: "standalone"`, `name`, `short_name`, `theme_color`, `background_color`, `start_url`, iconos 192/512 y versión *maskable*.
- [ ] En `index.html`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Lingo Lab">
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">
  ```
- [ ] Respetar el notch y la barra inferior: `padding: env(safe-area-inset-top)` / `env(safe-area-inset-bottom)`.
- [ ] Evitar el zoom automático de Safari en inputs: `font-size` ≥ 16px.
- [ ] Desactivar rebote/selección no deseada: `overscroll-behavior: none`, `-webkit-tap-highlight-color: transparent`, `user-select: none` en botones.
- [ ] Splash screens (`apple-touch-startup-image`) — opcional, se pueden generar con `pwa-asset-generator`.
- [ ] Banner propio "Instala la app: Compartir → Agregar a pantalla de inicio" (iOS no muestra prompt automático).
- [ ] **Almacenamiento:** pedir `navigator.storage.persist()` y ofrecer **exportar/importar progreso (JSON)**. Safari puede borrar datos de sitios no usados; instalada como PWA el riesgo baja, pero el backup manual es el seguro.
- [ ] **Audio:** en iOS el audio/TTS solo arranca tras un toque del usuario → iniciar la voz siempre desde un botón.
- [ ] **Notificaciones push** (recordatorio diario): disponibles en iOS 16.4+ solo si la PWA está instalada. Fase posterior.
- [ ] Probar en Safari real del iPhone (no solo en el simulador de Chrome).

---

## 4. Funcionalidades

### 4.1 MVP (lo mínimo útil)

1. **Selector de idioma** — elegir Portugués o Chino; se puede estudiar ambos y cambiar con un toque.
2. **Pantalla "Hoy"** — tarjetas por repasar, lección siguiente, racha y meta diaria (p. ej. 20 XP / 10 min).
3. **Ruta de aprendizaje** — Unidades → Lecciones. Cada lección = mini explicación + vocabulario + ejercicios.
4. **Flashcards con repetición espaciada (FSRS)** — botones *Otra vez / Difícil / Bien / Fácil*; cada palabra aprendida entra automáticamente al mazo.
5. **Ejercicios básicos:**
   - Opción múltiple (significado ↔ palabra)
   - Escuchar y elegir (TTS)
   - Escribir la traducción (con tolerancia a tildes/errores menores)
   - Ordenar palabras para formar una frase
   - Emparejar parejas
6. **Guías de gramática** — páginas en Markdown con ejemplos que se pueden escuchar.
7. **Diccionario personal** — buscar, ver todas mis palabras, agregar palabras propias.
8. **Progreso** — racha, XP, palabras aprendidas, precisión, calendario de actividad.
9. **Ajustes** — tema claro/oscuro, velocidad de voz, meta diaria, exportar/importar datos.
10. **Funciona offline** e instalable en iOS.

### 4.2 Específico por idioma

**Portugués (pt-BR)**
- Tabla de conjugación interactiva (presente, pretérito perfeito/imperfeito, futuro, subjuntivo…).
- Ejercicio "conjuga el verbo" (persona + tiempo → forma correcta).
- Falsos amigos español–portugués (¡muy útil para hispanohablantes!: *exquisito, polvo, borracha, esquisito…*).
- Pronunciación: nasales (ão, ãe, õe), diferencias de *r*, *s*, *t/d* + i.
- Teclado: aceptar respuestas sin tilde como "casi correcto" y mostrar la forma correcta.

**Chino mandarín (zh-CN)**
- Cada palabra muestra **hanzi + pinyin con tonos + significado** (pinyin se puede ocultar a medida que se avanza).
- **Entrenador de tonos**: escuchar y elegir tono 1–4/neutro; pares mínimos (mā / má / mǎ / mà).
- **Orden de trazos** con hanzi-writer (animación + modo práctica dibujando con el dedo).
- **Radicales**: descomposición de caracteres para memorizar mejor.
- Entrada de respuestas en **pinyin con números** (`ni3 hao3` → `nǐ hǎo`) o con teclado chino de iOS.
- Niveles alineados con **HSK 1–6** (o HSK 3.0).
- Clasificadores (量词) como tipo de ejercicio.

### 4.3 Fases posteriores

- 🎙️ **Práctica de pronunciación** (reconocimiento de voz) con comparación del texto reconocido.
- 📖 **Lecturas graduadas** — textos cortos por nivel; tocar una palabra la muestra y permite agregarla al mazo.
- 🎧 **Modo escucha / dictado**.
- 🤖 **Tutor con IA** — conversación por escenarios (pedir comida, entrevista…), corrección de redacción, "explícame esta frase".
- ☁️ **Cuenta y sincronización** entre iPhone y PC.
- 🔔 **Recordatorios push** diarios.
- 📥 **Importar mazos** (CSV / Anki `.apkg`).
- 🏆 Logros, ligas personales, estadísticas avanzadas (retención, previsión de repasos).

---

## 5. Arquitectura

```
┌──────────────────────────── UI (React) ─────────────────────────────┐
│  Pantallas: Hoy · Ruta · Lección · Repaso · Guías · Diccionario ·   │
│             Progreso · Ajustes                                      │
│  Componentes de ejercicio genéricos + componentes aportados por     │
│  los paquetes de idioma                                             │
└───────────────▲───────────────────────────────▲─────────────────────┘
                │                               │
┌───────────────┴──────────┐     ┌──────────────┴────────────────────┐
│  NÚCLEO (core)           │     │  REGISTRO DE IDIOMAS              │
│  - Motor de lecciones    │◄────┤  - Descubre /languages/*          │
│  - Motor SRS (FSRS)      │     │  - Valida con Zod                 │
│  - Motor de ejercicios   │     │  - Expone config, contenido,      │
│  - XP / racha / metas    │     │    ejercicios y utilidades extra  │
│  - Servicio de audio     │     └───────────────────────────────────┘
└───────────────▲──────────┘
                │
┌───────────────┴──────────────────────────────────────────────────────┐
│  PERSISTENCIA LOCAL: Dexie (IndexedDB) — fuente de verdad offline     │
│  + cola de cambios pendientes (outbox)                                │
└───────────────▲──────────────────────────────────────────────────────┘
                │  sync (push/pull) cuando hay internet
┌───────────────┴──────────────────────────────────────────────────────┐
│  API serverless (/api, Vercel Functions) · Drizzle ORM · Neon Auth   │
└───────────────▲──────────────────────────────────────────────────────┘
                │  @neondatabase/serverless (HTTP)
┌───────────────┴──────────────────────────────────────────────────────┐
│  NEON — Postgres serverless (progreso, tarjetas, logs, estadísticas)  │
└──────────────────────────────────────────────────────────────────────┘
```

> **¿Por qué local + Neon y no solo Neon?** La app tiene que funcionar offline en el iPhone. IndexedDB responde al instante y sin red; Neon es el respaldo en la nube y lo que permite usar la app en el iPhone y en el PC con el mismo progreso.

### 5.1 Estructura de carpetas

```
lingo-lab/
├─ public/
│  ├─ icons/                     # iconos PWA + apple-touch-icon
│  └─ audio/                     # (opcional) audios grabados
├─ src/
│  ├─ app/                       # rutas, layout, providers
│  ├─ core/
│  │  ├─ srs/                    # wrapper de ts-fsrs, cola de repaso
│  │  ├─ exercises/              # tipos de ejercicio genéricos + registro
│  │  ├─ lessons/                # motor que arma una sesión de lección
│  │  ├─ gamification/           # XP, racha, metas, logros
│  │  ├─ audio/                  # TTS / STT con fallback
│  │  ├─ answer-check/           # normalización y comparación de respuestas
│  │  └─ types.ts                # tipos compartidos
│  ├─ languages/
│  │  ├─ index.ts                # registro automático (import.meta.glob)
│  │  ├─ _template/              # plantilla para crear un idioma nuevo
│  │  ├─ pt/
│  │  │  ├─ language.config.ts
│  │  │  ├─ content/
│  │  │  │  ├─ units/            # unit-01.json, unit-02.json…
│  │  │  │  ├─ vocab/            # vocab por tema
│  │  │  │  └─ grammar/          # guías .md
│  │  │  ├─ exercises/           # ConjugationExercise.tsx …
│  │  │  └─ utils/               # conjugador, normalizador de nasales…
│  │  └─ zh/
│  │     ├─ language.config.ts
│  │     ├─ content/ (hsk1/, hsk2/, grammar/)
│  │     ├─ exercises/           # ToneExercise, StrokeExercise…
│  │     └─ utils/               # pinyin, tonos, radicales
│  ├─ db/                        # esquema Dexie, migraciones, export/import
│  ├─ features/                  # pantallas: today/, path/, review/, dictionary/…
│  ├─ components/ui/             # botones, tarjetas, modales (shadcn)
│  ├─ hooks/
│  ├─ stores/                    # Zustand
│  └─ styles/
├─ scripts/
│  ├─ new-language.ts            # CLI: crea un idioma desde _template
│  └─ validate-content.ts        # valida todos los paquetes (se corre en CI)
├─ tests/
├─ vite.config.ts                # incluye vite-plugin-pwa
└─ package.json
```

---

## 6. Sistema de idiomas extensible (la parte "long term")

### 6.1 Contrato de un paquete de idioma

```ts
// src/core/types.ts
export interface LanguagePack {
  id: string;                      // "pt", "zh", "fr"…
  name: string;                    // "Portugués"
  nativeName: string;              // "Português"
  flag: string;                    // "🇧🇷"
  locale: string;                  // "pt-BR" → usado por TTS/STT
  direction: 'ltr' | 'rtl';
  script: 'latin' | 'hanzi' | 'cyrillic' | 'arabic' | 'other';
  features: {
    tones?: boolean;               // chino, vietnamita…
    characters?: boolean;          // escritura logográfica
    romanization?: 'pinyin' | 'romaji' | null;
    conjugation?: boolean;
    gender?: boolean;
  };
  levels: { id: string; name: string }[];    // A1…C2, HSK1…HSK6
  loadContent: () => Promise<LanguageContent>; // carga perezosa
  exercises?: ExercisePlugin[];               // ejercicios propios
  normalizeAnswer?: (s: string) => string;    // p. ej. quitar tildes, pinyin num→marcas
  renderTerm?: React.FC<{ term: Term }>;      // p. ej. hanzi con pinyin encima (ruby)
}
```

### 6.2 Contrato de un ejercicio (plugin)

```ts
export interface ExercisePlugin<TData = unknown> {
  type: string;                                   // "multiple-choice", "zh-tone", "pt-conjugate"
  schema: ZodSchema<TData>;                       // valida el JSON del ejercicio
  Component: React.FC<ExerciseProps<TData>>;      // UI
  check: (data: TData, answer: unknown) => {      // corrección
    correct: boolean; partial?: boolean; feedback?: string;
  };
}
```

El núcleo trae los ejercicios genéricos; cada idioma puede **registrar los suyos**. El motor de lecciones solo ve `type` y busca el plugin en el registro.

### 6.3 Registro automático

```ts
// src/languages/index.ts
const modules = import.meta.glob('./*/language.config.ts', { eager: true });
export const languages: LanguagePack[] = Object.values(modules)
  .map((m: any) => m.default)
  .filter(Boolean);
```

➡️ **Agregar un idioma nuevo = crear una carpeta.** No se toca el núcleo.

### 6.4 Pasos para agregar un idioma (ej. francés)

1. `npm run new-language fr "Francés" "fr-FR"` → copia `_template/` a `languages/fr/`.
2. Completar `language.config.ts` (bandera, niveles, features).
3. Escribir contenido en `content/` (units, vocab, grammar).
4. (Opcional) Añadir ejercicios propios en `exercises/`.
5. `npm run validate-content` → valida esquemas.
6. Deploy. El idioma aparece automáticamente en el selector.

---

## 7. Modelo de contenido (JSON)

### 7.1 Término de vocabulario

```json
{
  "id": "zh-hsk1-0001",
  "term": "你好",
  "reading": "nǐ hǎo",
  "meaning": { "es": "hola" },
  "pos": "interjección",
  "examples": [
    { "text": "你好，我叫卡米洛。", "reading": "Nǐ hǎo, wǒ jiào Kǎmǐluò.", "translation": "Hola, me llamo Camilo." }
  ],
  "tags": ["saludos", "hsk1"],
  "extra": { "tones": [3, 3], "radicals": ["亻", "尔", "女", "子"] }
}
```

```json
{
  "id": "pt-a1-0001",
  "term": "obrigado",
  "meaning": { "es": "gracias (dicho por hombre)" },
  "pos": "interjección",
  "examples": [{ "text": "Muito obrigado!", "translation": "¡Muchas gracias!" }],
  "notes": "Mujer: obrigada.",
  "tags": ["saludos", "a1"],
  "extra": { "falseFriend": false }
}
```

### 7.2 Lección

```json
{
  "id": "pt-u01-l01",
  "unit": "pt-u01",
  "title": "Saludos y presentaciones",
  "level": "A1",
  "intro": "grammar/saludos.md",
  "vocab": ["pt-a1-0001", "pt-a1-0002", "pt-a1-0003"],
  "exercises": [
    { "type": "multiple-choice", "prompt": "obrigado", "options": ["gracias", "perdón", "hola"], "answer": 0 },
    { "type": "listen-choose", "audioText": "Bom dia", "options": ["Buenos días", "Buenas noches"], "answer": 0 },
    { "type": "translate-write", "prompt": "Me llamo Camilo", "answers": ["Eu me chamo Camilo", "Meu nome é Camilo"] },
    { "type": "pt-conjugate", "verb": "ser", "person": "eu", "tense": "presente", "answer": "sou" }
  ]
}
```

---

## 8. Modelo de datos local (Dexie / IndexedDB)

| Tabla | Campos principales | Uso |
|---|---|---|
| `profile` | id, nombre, idiomaActivo, metaDiaria, tema, vozRate | Ajustes del usuario |
| `cards` | id, langId, termId, fsrsState (due, stability, difficulty, reps, lapses, state), createdAt | Mazo SRS |
| `reviewLogs` | id, cardId, rating, reviewedAt, elapsedMs | Historial para estadísticas y ajustar FSRS |
| `lessonProgress` | lessonId, langId, status, bestScore, completedAt | Avance en la ruta |
| `customTerms` | id, langId, term, reading, meaning, tags | Palabras que agrega el usuario |
| `dailyStats` | date, langId, xp, minutes, reviews, correct | Racha y gráficas |
| `achievements` | id, unlockedAt | Logros |

- Versionar el esquema con migraciones de Dexie (`db.version(n).stores(...)`).
- **Export/Import**: volcar todas las tablas a un `.json` descargable (backup + migrar a otro dispositivo antes de que exista sync).

---

## 9. Lógica de aprendizaje

### 9.1 Sesión diaria ("Hoy")
1. **Repasos pendientes** (FSRS, tarjetas con `due <= hoy`), con tope configurable (p. ej. 50).
2. **Nuevas palabras** (p. ej. 5–10/día) desde la siguiente lección.
3. **Mini práctica** mezclando ejercicios de lo aprendido recientemente.
4. Meta cumplida → animación + racha +1.

### 9.2 Corrección de respuestas
- Normalizar: minúsculas, quitar espacios extra y puntuación.
- Portugués: si solo falla una tilde → **"casi correcto"** (cuenta como bien, muestra la forma exacta). Distancia de Levenshtein ≤ 1 para errores tipográficos en palabras largas.
- Chino: aceptar pinyin con números o con marcas; hanzi exacto; mostrar tono equivocado resaltado.
- Varias respuestas válidas por ejercicio (`answers: []`).

### 9.3 Gamificación (suave, que motive sin distraer)
- XP por ejercicio, bonus por racha de aciertos.
- Racha diaria con 1 "congelador" semanal.
- Barra de meta diaria.
- Logros: 100 palabras, 7 días seguidos, primera unidad HSK1, etc.

---

## 10. Diseño UI/UX

### 10.1 Estilo visual
- **Moderno y limpio**: mucho espacio, tarjetas con bordes redondeados (16–24px), sombras suaves, tipografía grande.
- Tipografía: **Inter** o **Plus Jakarta Sans** para la interfaz; **Noto Sans SC** para hanzi (tamaño grande, 32–64px en tarjetas).
- **Color por idioma** (acento dinámico): Portugués → verde/amarillo; Chino → rojo/dorado. El resto de la UI neutra.
- Modo claro y oscuro (seguir el del sistema por defecto).
- Microinteracciones: vibración háptica no disponible en iOS web → compensar con animación + sonido corto de acierto/error.

### 10.2 Navegación (barra inferior tipo app)

```
[ 🏠 Hoy ]  [ 🗺️ Ruta ]  [ 🔁 Repasar ]  [ 📚 Guías ]  [ 👤 Perfil ]
```
Selector de idioma arriba (bandera) en todas las pantallas.

### 10.3 Pantallas

| Pantalla | Contenido |
|---|---|
| **Onboarding** | Elegir idiomas, nivel inicial (o test rápido), meta diaria, instrucciones para instalar en iOS |
| **Hoy** | Saludo, racha 🔥, anillo de meta diaria, botón grande "Empezar sesión", repasos pendientes, lección siguiente |
| **Ruta** | Unidades en forma de camino vertical; lecciones bloqueadas/desbloqueadas/completadas |
| **Lección** | Barra de progreso arriba, 1 ejercicio por pantalla, botón "Comprobar" fijo abajo, hoja inferior verde/roja con feedback |
| **Repasar** | Flashcards con flip; 4 botones de calificación; contador restante |
| **Guías** | Lista de temas de gramática con buscador; cada guía con ejemplos y botón 🔊 |
| **Diccionario** | Búsqueda, filtros por etiqueta/nivel, ficha de palabra (audio, ejemplos, trazos si es chino), botón "Agregar al mazo" |
| **Progreso** | Calendario tipo heatmap, palabras aprendidas, precisión, previsión de repasos |
| **Ajustes** | Tema, voz, meta, idiomas activos, exportar/importar, borrar datos |

### 10.4 Accesibilidad
- Contraste AA, áreas táctiles ≥ 44px, soporte para tamaño de texto del sistema, etiquetas ARIA en botones de icono.

---

## 11. Contenido inicial sugerido

**Portugués (A1 → A2)**
1. Saludos y presentaciones · 2. Números, horas y fechas · 3. Familia · 4. Comida y restaurante · 5. Ser vs. estar · 6. Verbos regulares -ar/-er/-ir · 7. Ciudad y direcciones · 8. Rutina diaria (verbos reflexivos) · 9. Pretérito perfeito · 10. Falsos amigos con el español

**Chino (HSK 1 → HSK 2)**
1. Pinyin y los 4 tonos · 2. Saludos (你好, 谢谢) · 3. Números y edad · 4. Familia · 5. Partícula 吗 y preguntas · 6. 是 / 有 · 7. Clasificadores básicos (个, 本…) · 8. Hora y fechas · 9. Comida · 10. 了 y 过 (aspecto)

> Fuentes útiles para armar contenido: listas oficiales HSK, CC-CEDICT (diccionario chino abierto, licencia CC BY-SA), listas de frecuencia de portugués. Revisar licencias antes de incluir datos.

---

## 12. Roadmap por fases

| Fase | Duración aprox. | Entregables |
|---|---|---|
| **0. Setup** | 2–3 días | Repo, Vite+React+TS, Tailwind, shadcn, ESLint/Prettier, PWA básica, deploy en Vercel, prueba de instalación en iPhone |
| **1. Núcleo** | 1–2 semanas | Tipos, registro de idiomas, Dexie, motor FSRS, servicio TTS, 5 ejercicios genéricos, motor de lecciones |
| **2. MVP Portugués** | 1 semana | Paquete `pt` con 3–5 unidades, conjugación, falsos amigos; pantallas Hoy / Ruta / Lección / Repasar |
| **3. MVP Chino** | 1–2 semanas | Paquete `zh` con HSK1, pinyin, entrenador de tonos, orden de trazos |
| **4. Pulido** | 1 semana | Progreso y gráficas, guías, diccionario, onboarding, modo oscuro, export/import, offline completo |
| **5. Extensibilidad** | 3–4 días | Plantilla `_template`, script `new-language`, `validate-content` en CI, documentación |
| **6. Avanzado** | continuo | Reconocimiento de voz, lecturas graduadas, sync con Supabase, tutor IA, push notifications |

---

## 13. Calidad, pruebas y deploy

- **Unit tests** (Vitest): corrección de respuestas, conversión de pinyin, conjugador, cola SRS.
- **Validación de contenido** en CI: todos los JSON pasan el esquema Zod; los IDs referenciados existen.
- **E2E** (Playwright, perfil iPhone/WebKit): completar una lección, hacer un repaso, funcionamiento offline.
- **Lighthouse**: PWA instalable, rendimiento > 90.
- **GitHub Actions**: lint + tests + validate → deploy automático a Vercel en `main`.

---

## 14. Riesgos y decisiones abiertas

| Tema | Riesgo / decisión | Mitigación |
|---|---|---|
| Voces TTS | La calidad depende del dispositivo; en iOS son buenas | Permitir audios pregrabados opcionales por término |
| Reconocimiento de voz en Safari | Soporte limitado/inestable | Tratarlo como función "beta", nunca obligatoria |
| Datos borrados por Safari | IndexedDB puede limpiarse | `storage.persist()` + export/import + sync en fase 6 |
| Crear contenido toma tiempo | Es el mayor esfuerzo real | Empezar pequeño; usar IA para generar borradores de lecciones y revisarlos |
| Variante del portugués | ¿Brasil o Portugal? | **Asumido pt-BR**; el sistema permite `pt-PT` como otro paquete |
| Chino simplificado vs tradicional | | **Asumido simplificado**; campo `traditional` opcional en cada término |
| API key de IA | Nunca exponerla en el frontend | Función serverless como proxy + límite de uso |

---

## 15. Primeros pasos concretos

```bash
npm create vite@latest lingo-lab -- --template react-ts
cd lingo-lab
npm i react-router-dom zustand dexie dexie-react-hooks ts-fsrs zod framer-motion recharts pinyin-pro hanzi-writer
npm i -D tailwindcss postcss autoprefixer vite-plugin-pwa vitest @testing-library/react
npx tailwindcss init -p
npx shadcn@latest init
```

1. Configurar `vite-plugin-pwa` (manifest + `registerType: 'autoUpdate'`).
2. Crear `src/core/types.ts` con `LanguagePack`, `ExercisePlugin`, `Term`, `Lesson`.
3. Crear `src/languages/index.ts` (registro automático).
4. Crear el esquema Dexie en `src/db/`.
5. Implementar el primer ejercicio (`multiple-choice`) y una lección de portugués de prueba de punta a punta.
6. Deploy y **probar en el iPhone desde el día 1**.

---

## ✅ Definición de "MVP terminado"

- [ ] Se instala en el iPhone y abre a pantalla completa con su icono.
- [ ] Funciona sin internet tras la primera carga.
- [ ] Puedo estudiar Portugués y Chino y cambiar entre ellos.
- [ ] Hay al menos 3 unidades por idioma con 5 tipos de ejercicio.
- [ ] Las palabras aprendidas aparecen en repasos con FSRS.
- [ ] Veo mi racha, XP y progreso.
- [ ] Puedo exportar e importar mi progreso.
- [ ] Agregar un tercer idioma solo requiere crear una carpeta nueva en `src/languages/`.
