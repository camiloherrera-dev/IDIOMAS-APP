# Lingo Lab · Plan de implementación: cuentas con sesión y versión de escritorio

> Fecha: 24 de noviembre de 2026. Estado del código revisado: `main` en `a15e1cc`.
> Objetivo: que el progreso quede guardado en una cuenta (correo o Google) en lugar de depender de un código, y que la app sea cómoda en el computador, con teclado y pantalla ancha, sin empeorar la experiencia en el iPhone.

## Estado (25 de noviembre de 2026)

El **bloque B (cuentas y sincronización) está implementado** en la rama `feat/cuentas-y-sync`; falta configurarlo en Vercel siguiendo [`CONFIGURAR_CUENTAS.md`](./CONFIGURAR_CUENTAS.md). El bloque A (escritorio) sigue pendiente.

Cambios respecto a lo planeado:

| Plan | Implementado | Por qué |
| --- | --- | --- |
| Tabla `outbox` llenada por hooks | Marca `_ts` dentro de cada fila, puesta por hooks de Dexie | Se guarda en la misma escritura que el cambio: no se puede perder un cambio entre dos transacciones |
| Tabla `sync_rows` | `lingo_rows`, con `device_id` del último que escribió | Un dispositivo no vuelve a bajar lo que acaba de subir |
| Candado de sesión para migrar | Migración sin candado, con un reintento | Con el pooler de Neon un candado de sesión puede quedar tomado en otra conexión |
| Recuperar contraseña y verificar correo | Pendiente | Necesita un proveedor de correo; por ahora se puede cambiar la contraseña con la sesión iniciada |
| Lista de dispositivos con sesión | Pendiente | Cambiar la contraseña cierra las otras sesiones |
| Pruebas de API contra una rama de Neon | Contra PGlite (Postgres en WebAssembly) | Corre en CI sin credenciales; el mismo SQL |

---

## 1. Resumen

| Tema | Decisión |
| --- | --- |
| Cuentas | **Better Auth** dentro del mismo despliegue de Vercel, con usuarios y sesiones en la misma base de Neon. Inicio de sesión con correo y contraseña, y con Google |
| Dónde vive la app | **Vercel pasa a ser la URL principal** (app y API en el mismo dominio). GitHub Pages queda como redirección |
| Sincronización | Se reemplaza la «foto completa» por **sincronización incremental por filas**: cada dispositivo sube solo lo que cambió y baja solo lo nuevo |
| Sin cuenta | La app sigue funcionando sin cuenta y sin internet. La cuenta es opcional y se puede crear después sin perder nada |
| Código de sincronización actual | Se puede importar una vez a la cuenta; luego el sistema de códigos se retira |
| Escritorio | Desde 1.024 px de ancho: barra lateral en vez de pestañas abajo, contenido más ancho por pantalla, diálogos centrados y **atajos de teclado en todos los ejercicios** |
| Orden | Primero escritorio (no necesita infraestructura y se usa enseguida), luego cuentas y sincronización |
| Costo | Planes gratuitos de Vercel, Neon y del proveedor de correo |

Duración estimada: unos 13 días de trabajo, en 8 fases que se pueden entregar por separado.

---

## 2. Situación actual (revisada en el código)

### 2.1 Persistencia

| Hoy | Problema |
| --- | --- |
| Todo vive en IndexedDB (Dexie) en el dispositivo | Si se borran los datos del navegador o se pierde el teléfono, se pierde el progreso, salvo que esté sincronizado |
| La nube se activa con un **código de 20 caracteres** (`src/db/sync`, `api/sync.ts`); el servidor guarda una sola fila JSON por código | No hay forma de recuperar el código si se pierde. Quien lo tenga ve el progreso |
| Cada sincronización **sube y baja todo**: tarjetas, historial completo de repasos, estadísticas. Pasa al abrir la app y cada 5 minutos | El historial crece con cada repaso. Con unos 150 repasos al día de chino (≈30 KB) más ~6.000 tarjetas (≈1,5 MB), se llega al **límite de 4 MB por envío en pocos meses** (según el ritmo, entre 3 y 6). Además, gasta datos móviles |
| El build de GitHub Pages **no pasa ninguna URL de sincronización** (`pages.yml` solo define `BASE_PATH`) | En la URL de Pages la sincronización no puede funcionar: `/api/sync` no existe ahí. El README pide crear una variable `SYNC_URL`, pero el workflow no la usa |
| La tabla de puntos débiles (`skills`) no entra ni en la sincronización ni en la copia de seguridad | Se pierde al cambiar de dispositivo |
| Los borrados se guardan como «lápidas» en `localStorage` | Si se limpia `localStorage`, un borrado puede «resucitar» desde otro dispositivo |
| La base local no sabe de quién es | No hay forma segura de iniciar sesión con otra persona en el mismo dispositivo |

Lo que funciona bien y se conserva: la app es **offline primero**, y la fusión de `merge.ts` es conmutativa e idempotente (gana el repaso más reciente de cada tarjeta, se suma el historial, se guarda el mejor puntaje de cada lección). Esa lógica se reutiliza fila por fila.

### 2.2 Escritorio

| Hoy | Problema en el computador |
| --- | --- |
| Todo el contenido está en una columna de 512 px (`max-w-lg`) centrada | En una pantalla de 1.440 px queda dos tercios vacío, y las guías y el diccionario se sienten apretados |
| Navegación con 5 pestañas abajo | Natural en el teléfono, rara con mouse. Diccionario, Herramientas y Ajustes quedan escondidos |
| Las hojas (`Sheet`) suben desde abajo | En escritorio se esperan diálogos centrados |
| Atajos: Enter en las lecciones; espacio, 1-4 y `z` en el repaso | Las opciones muestran los números 1-4 pero **no responden al teclado**. Ordenar palabras y emparejar solo funcionan con clic |
| El Enter de las lecciones no distingue la escritura con IME | Si escribes chino con el teclado pinyin de Windows o macOS, el Enter que confirma el carácter puede **comprobar la respuesta antes de tiempo** |
| La voz es la que el navegador elija | En Windows, Edge suele ofrecer voces neuronales chinas mucho mejores que la predeterminada, pero no hay forma de elegirla |

---

## 3. Objetivos y lo que queda fuera

**Objetivos**

1. Crear cuenta e iniciar sesión con correo y contraseña o con Google, en el iPhone (app instalada) y en el computador.
2. Que el progreso de todos los idiomas, incluidos los puntos débiles, quede en la cuenta y llegue a cada dispositivo en segundos.
3. Seguir estudiando sin internet; los cambios se suben al reconectar.
4. Una versión de escritorio que se use cómodamente solo con teclado.
5. Pasar de los códigos a la cuenta sin perder nada.

**Fuera de este plan**

- Varias personas compartiendo una cuenta, clases o roles de profesor.
- App nativa de escritorio (Electron o Tauri): la PWA ya se instala en Chrome y Edge.
- Pagos o planes.
- Chat con IA dentro de la app (sigue el tutor en un Proyecto de Claude).

---

## 4. Cuentas: arquitectura

### 4.1 Opciones consideradas

| Opción | A favor | En contra | Veredicto |
| --- | --- | --- | --- |
| **Better Auth en Vercel (autogestionado)** | Código abierto, en TypeScript, usuarios y sesiones en la misma base de Neon. Corre en las funciones de Vercel que ya existen. **Cookie en el mismo dominio que la app** | Hay que configurarlo y mantener la dependencia | **Elegida** |
| Neon Managed Better Auth | Neon lo opera y es gratis en el plan Free | El servicio vive en un dominio de Neon: la sesión pasa a ser una cookie de otro sitio o un JWT, y Safari bloquea por defecto las cookies de terceros. Hay que probar con cuidado que funcione en la PWA del iPhone | Plan B |
| Clerk | Muy fácil de integrar | Los usuarios quedan fuera de tu base, y es un proveedor más | Descartada |
| Supabase Auth | Completo | Obligaría a mover también los datos fuera de Neon | Descartada |

El factor decisivo es el **iPhone**: una PWA instalada guarda sus cookies aparte de Safari, y las cookies de primera parte (mismo dominio) son las que se comportan de forma predecible. Por eso la app y `/api/auth` deben servirse desde el mismo dominio.

### 4.2 Despliegue

```
https://lingo-lab.vercel.app        ← app (SPA + PWA)
  /api/auth/*                       ← Better Auth (registro, login, Google, sesión, cierre)
  /api/sync/push   /api/sync/pull   ← sincronización incremental (requiere sesión)
  /api/account                      ← exportar o borrar la cuenta
  /api/sync (antiguo)               ← solo para importar un código, se retira después

Neon (Postgres)
  user, session, account, verification   ← tablas de Better Auth
  sync_rows                               ← datos de estudio, una fila por registro
  lingo_sync (antigua)                    ← se vacía al migrar y luego se borra
```

- **GitHub Pages:** se reemplaza por una página mínima que redirige a la URL de Vercel. Así el ícono que ya está instalado en el iPhone lleva a la versión nueva. La app de Pages y la de Vercel tienen bases de datos locales separadas (son dominios distintos), así que el paso de una a otra se hace con la cuenta o con el código actual (ver 6.4).
- Si más adelante compras un dominio, se apunta a Vercel y se agrega a `trustedOrigins`.

### 4.3 Métodos de inicio de sesión

| Método | Fase | Necesita |
| --- | --- | --- |
| Correo y contraseña | 3 | Nada externo |
| Google | 3 | Un cliente OAuth en Google Cloud (gratis) con la URL de retorno `/api/auth/callback/google` |
| Recuperar contraseña por correo | 5 | Un proveedor de correo con plan gratuito (por ejemplo Resend) y su clave |
| Verificar el correo | 5 | El mismo proveedor; al principio no se exige |

En la PWA del iPhone, el inicio con Google abre una página de Google y vuelve a la app. Hay que comprobar en el teléfono que regrese a la app instalada y no a Safari; si no, se usa la ventana emergente de Google o se deja Google solo para el computador.

### 4.4 Sesión

- Cookie `httpOnly`, `Secure` y `SameSite=Lax`, que JavaScript no puede leer.
- Dura 60 días y se renueva sola mientras la uses.
- La app guarda en IndexedDB solo lo mínimo para mostrar tu nombre sin internet (id, nombre y correo), nunca la cookie.
- **Sin internet:** la app no necesita la sesión para funcionar. Solo la sincronización espera a que haya conexión.
- **Sesión vencida:** aparece un aviso discreto («Inicia sesión de nuevo para sincronizar»). Los datos locales no se tocan y los cambios pendientes se suben al volver a entrar.

---

## 5. Sincronización incremental

### 5.1 Datos en el servidor

```sql
CREATE TABLE sync_rows (
  user_id    text        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tbl        text        NOT NULL,          -- profile | cards | reviewLogs | lessonProgress | customTerms | dailyStats | achievements | skills
  row_id     text        NOT NULL,          -- clave de la fila (para reviewLogs, reviewLogKey)
  data       jsonb,                         -- NULL si está borrada
  deleted    boolean     NOT NULL DEFAULT false,
  seq        bigint      NOT NULL,          -- de una secuencia global: sirve de cursor
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tbl, row_id)
);
CREATE SEQUENCE sync_seq;
CREATE INDEX sync_rows_pull ON sync_rows (user_id, seq);
```

- Cada escritura asigna `seq = nextval('sync_seq')`. Un dispositivo pide «todo lo de mi usuario con `seq` mayor que el último que vi». Así no hace falta comparar relojes entre dispositivos.
- Los borrados son filas con `deleted = true`, que reemplazan las lápidas de `localStorage`.
- El `user_id` siempre sale de la sesión, nunca del cuerpo de la petición.

### 5.2 Datos en el dispositivo (Dexie versión 3)

| Tabla nueva | Para qué |
| --- | --- |
| `outbox` (`[tbl+rowId]`, `changedAt`) | Lo que cambió y falta subir. La llenan *hooks* de Dexie en cada `put`, `add`, `update` y `delete` de las tablas sincronizadas |
| `meta` (`key`) | `ownerUserId` (de quién son estos datos), `pullCursor` (último `seq` recibido), `deviceId` y una copia del usuario para mostrar sin internet |

Al aplicar lo que llega del servidor se desactivan los *hooks*, para que no vuelva a subir.

### 5.3 Protocolo

```
POST /api/sync/push   { changes: [{ tbl, id, data | deleted }] }        (lotes de hasta 500)
  → para cada fila: lee la del servidor, fusiona con la regla de merge.ts, guarda con seq nuevo
  → { applied: n, rows: [filas que quedaron distintas a lo enviado] }

GET  /api/sync/pull?since=<seq>&limit=1000
  → { rows: [...], next: <seq>, more: true | false }
```

Un ciclo de sincronización:

1. **Push:** envía el `outbox` en lotes. Lo que el servidor confirma se quita del `outbox`.
2. **Pull:** pide desde `pullCursor` hasta que `more` sea `false`. Cada fila se fusiona con la local usando la misma regla y se guarda. Después se actualiza el cursor.
3. Si el servidor responde `401`, se para y se muestra el aviso de sesión. Nada se pierde: el `outbox` sigue ahí.

Cuándo se sincroniza: al abrir la app, al volver a ella, al recuperar internet, **3 segundos después de terminar una lección o un repaso**, y cada 5 minutos con la app visible. Un envío normal pasa de megabytes a unos pocos kilobytes.

### 5.4 Cambios en `merge.ts`

Hoy fusiona listas completas. Se separa en reglas **por fila** (`mergeRow(tbl, a, b)`): `pickCard`, la de `lessonProgress` (mejor puntaje), la de `dailyStats` (máximo por campo), la de `profile` (más reciente), etc. La fusión de listas completas se queda solo para importar copias de seguridad y códigos antiguos. Los tests actuales de `sync.test.ts` se conservan y se agregan los de fila.

### 5.5 Límites

| Límite | Valor inicial |
| --- | --- |
| Tamaño por petición | 1 MB |
| Filas por push | 500 |
| Filas por usuario | 500.000 (≈10 años de uso intenso) |
| Peticiones por minuto por usuario | 60 |

---

## 6. Flujos de usuario

### 6.1 Primera vez

1. Bienvenida → nombre e idiomas (como hoy).
2. Paso nuevo, saltable: **«Guarda tu progreso»**, con los botones «Continuar con Google», «Crear cuenta con correo» y «Ahora no».
3. Con «Ahora no», la app funciona igual que hoy. En Perfil queda una tarjeta «Crea una cuenta para no perder tu progreso».

### 6.2 Iniciar sesión en un dispositivo que ya tiene datos

| Situación | Qué pasa |
| --- | --- |
| Los datos locales no tienen dueño (los usaste sin cuenta) | Se suben y se fusionan con la cuenta. Se avisa: «Tu progreso de este dispositivo se combinó con tu cuenta» |
| Los datos locales son de esta misma cuenta | Solo se sincroniza |
| Los datos locales son de **otra** cuenta | No se mezclan. Se pide elegir entre volver a la otra cuenta o borrar los datos de este dispositivo y seguir, con una advertencia si hay cambios sin subir |

### 6.3 Cerrar sesión

Una hoja con dos opciones:

- **Cerrar sesión y dejar mis datos en este dispositivo** (opción por defecto en un dispositivo propio). La app sigue funcionando y, al volver a entrar con la misma cuenta, continúa donde iba.
- **Cerrar sesión y borrar los datos de este dispositivo** (para un computador prestado). Antes intenta subir lo pendiente; si no hay internet, avisa cuántos cambios se perderían.

### 6.4 Migrar desde el código de sincronización

En Ajustes → Nube, con la sesión iniciada: **«Tengo un código de sincronización»**. El servidor busca la fila antigua por el hash del código, convierte su foto en filas de `sync_rows` del usuario (fusionando si ya hay datos) y borra la fila antigua. La opción se mantiene unos dos meses y luego se quitan el endpoint `/api/sync` y la tabla `lingo_sync`.

Para quien hoy solo usa la app en Pages sin nube: crea la cuenta en la app de Pages (ver 8, fase 6) o exporta el JSON en Ajustes y lo importa en la de Vercel.

### 6.5 Cuenta

En Perfil → Cuenta: nombre, correo, método de inicio, dispositivos con sesión abierta (cerrar uno a uno), cambiar contraseña, **descargar todos mis datos** (el JSON de siempre) y **borrar mi cuenta**, que borra usuario, sesiones y `sync_rows` con confirmación escrita.

---

## 7. Escritorio: diseño

### 7.1 Tamaños de pantalla

| Ancho | Navegación | Contenido |
| --- | --- | --- |
| Menos de 768 px (teléfono) | Pestañas abajo, como hoy | Una columna, como hoy |
| 768 a 1.023 px (tableta) | Pestañas abajo | Columna hasta 720 px; algunas pantallas a dos columnas |
| 1.024 px o más (computador) | **Barra lateral fija** de 248 px | Ancho según la pantalla (tabla 7.2) |

La barra lateral lleva el logo, el selector de idioma, la racha y la meta del día en pequeño, y la navegación: Hoy, Ruta, Repasar (con el contador), Guías, Palabras, Herramientas, Perfil y Ajustes, más el estado de la sincronización abajo. Se puede contraer a solo íconos.

Se implementa con un `AppShell` que elige entre `MobileShell` y `DesktopShell` con una media query (`useMediaQuery('(min-width: 1024px)')`) y clases de Tailwind `lg:`. Ninguna pantalla duplica su lógica: solo cambia el contenedor.

### 7.2 Pantalla por pantalla

| Pantalla | En el computador |
| --- | --- |
| **Hoy** | Dos columnas: a la izquierda el anillo de la meta y las acciones; a la derecha la cobertura por nivel, la semana y la previsión de repasos |
| **Ruta** | El camino al centro (máx. 640 px) y, a la derecha, un panel fijo con la unidad seleccionada: palabras, guía y botón de empezar. Las pestañas de nivel quedan arriba y fijas |
| **Lección y repaso** | Tarjeta centrada de 640 px, opciones en cuadrícula de 2×2 cuando caben y una línea de atajos al pie («1-4 elegir · Enter comprobar · Espacio escuchar · Esc salir») |
| **Guías** | Lista a la izquierda y lectura a la derecha (ancho de lectura de unos 70 caracteres) desde 1.280 px; por debajo, como hoy |
| **Palabras** | Vista de **tabla** con columnas (palabra, pinyin, significado, nivel, estado de la tarjeta), orden por columna, filtros a la izquierda y la ficha a la derecha al seleccionar |
| **Perfil** | Cuadrícula de tarjetas: actividad anual ancha, estadísticas y logros |
| **Ajustes** | Índice de secciones a la izquierda y contenido a la derecha |
| **Herramientas** | Más espacio para los trazos y la tabla de números |

Las **hojas** (`Sheet`) se convierten en **diálogos centrados** desde 768 px. El componente decide solo; quien lo usa no cambia nada.

### 7.3 Teclado

**En toda la app**

| Tecla | Acción |
| --- | --- |
| `G` y luego `H`, `R`, `P`, `U`, `D` | Ir a Hoy, Ruta, Repasar, Guías, Palabras |
| `/` | Buscar en Palabras o en Guías |
| `?` | Ver todos los atajos |
| `Esc` | Cerrar el diálogo o salir de la sesión (con confirmación) |

**En lecciones y pruebas**

| Ejercicio | Teclas |
| --- | --- |
| Opción múltiple, escuchar y elegir, diálogo | `1`–`4` elige · `Enter` comprueba y continúa |
| Ordenar palabras | `1`–`9` toma la ficha con ese número · `Retroceso` quita la última · `Enter` comprueba |
| Emparejar | `1`–`5` elige a la izquierda y `Q`–`T` a la derecha (las letras se muestran en cada ficha) |
| Tonos | `1`–`4` (y `5` para el neutro) por sílaba, avanzando sola |
| Escribir | Campo con foco automático · `Enter` comprueba |
| Cualquiera con audio | `Espacio` (fuera de un campo de texto) repite el audio · `Shift+Espacio` lo pone lento |

**En el repaso** se mantienen espacio, `1`–`4` y `z`, y se agregan `A` para apartar y `E` para editar la nota de una palabra difícil.

**Escritura en chino:** todos los manejadores de `Enter` ignoran el evento si `e.isComposing` es verdadero, para no comprobar mientras el teclado pinyin está componiendo. Se sigue aceptando pinyin con números (`ni3 hao3`) y se muestra, mientras escribes, cómo queda con tildes (`nǐ hǎo`).

### 7.4 Detalles de escritorio

- **Hover y foco:** estados de hover en tarjetas, opciones y filas; anillo de foco visible en todo lo navegable con Tab; `cursor-pointer` donde corresponde.
- **Voz:** en Ajustes, un selector de voz por idioma con botón de prueba. Se elige sola la mejor disponible (prioridad a las voces «Natural» u «Online» en Edge y a las de Google en Chrome) y se guarda la preferencia por dispositivo.
- **PWA instalable en Chrome y Edge:** el manifiesto agrega `shortcuts` (Repasar y Seguir la ruta) y un tamaño de ventana inicial razonable. El aviso de instalación de iOS no se muestra en escritorio.
- **Tipografía:** el carácter chino de las tarjetas crece en escritorio (de 72 a 96 px) y los ejemplos usan un tamaño de lectura mayor.
- **Mouse en trazos:** la herramienta de trazos ya acepta mouse; se comprueba el tamaño del lienzo en escritorio.

---

## 8. Plan de desarrollo por fases

Cada fase termina con la app funcionando, sus pruebas pasando y un despliegue. Las estimaciones son días de trabajo con Claude, contando la revisión.

### Bloque A · Escritorio (no necesita infraestructura)

**Fase 1 · Estructura responsive (2 días)**

- `DesktopShell` con barra lateral, `MobileShell` (el actual) y `useMediaQuery`.
- `Sheet` → diálogo centrado desde 768 px.
- Anchos por pantalla: Hoy, Ruta, Guías y Perfil (tabla 7.2), sin cambiar la lógica.
- Hover, foco y `cursor-pointer` en los componentes base (`Button`, `ChoiceButton`, tarjetas, filas).
- Listo cuando: a 1.440 px no queda contenido en una columna estrecha, la barra lateral lleva a todas las secciones y a 390 px la app se ve igual que hoy (comparando capturas).

**Fase 2 · Teclado y entrada (1,5 días)**

- Hook común `useExerciseKeys` y atajos de la tabla 7.3 en todos los ejercicios del núcleo y en el de tonos.
- Atajos globales, diálogo de ayuda (`?`) y la línea de atajos al pie de las sesiones (solo en escritorio).
- Arreglo del `Enter` con IME (`isComposing`) en `SessionPlayer`, `TranslateWrite` y `ReviewSession`.
- Vista previa de pinyin con tildes en los campos de escritura.
- Listo cuando: una prueba E2E completa una lección de vocabulario, una de gramática, una de escucha y un repaso **sin usar el mouse**, y escribir con IME no comprueba antes de tiempo.

**Fase 3 · Pantallas anchas y voz (2 días)**

- Palabras como tabla con filtros y ficha lateral; Ajustes con índice; Ruta con panel de unidad; Guías en dos paneles.
- Selector de voz con prueba.
- Manifiesto con `shortcuts`; ocultar el aviso de iOS en escritorio.
- Listo cuando: las capturas a 1.280 y 1.440 px de todas las pantallas pasan una revisión visual, y la voz elegida se usa en lecciones, repaso y guías.

### Bloque B · Cuentas y sincronización

**Fase 4 · Preparación (0,5 días; la haces tú con una guía paso a paso)**

- Proyecto en Vercel conectado al repositorio, con la base Neon desde la pestaña **Storage**.
- Variables: `DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ caracteres aleatorios), `BETTER_AUTH_URL` y, para Google, `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
- Una rama de Neon para pruebas, con su propia `DATABASE_URL` en *Preview*.
- Listo cuando: la URL de Vercel sirve la app actual y el `/api/sync` de hoy responde.

**Fase 5 · Cuentas (2 días)**

- `api/auth/[...all].ts` con Better Auth (correo y contraseña, Google), su migración de tablas y `trustedOrigins`.
- Cliente `src/core/auth` con `useSession`, `signIn`, `signUp`, `signOut` y la copia del usuario en `meta`.
- Pantallas: paso «Guarda tu progreso» en la bienvenida, iniciar sesión, crear cuenta y la sección Cuenta en Perfil.
- Límite de intentos de inicio de sesión (incluido en Better Auth, guardado en la base porque las funciones no tienen memoria entre llamadas).
- Listo cuando: puedes crear cuenta, cerrar la app, volver a abrirla y seguir con la sesión, tanto en Chrome de escritorio como **en la PWA instalada del iPhone**.

**Fase 6 · Sincronización incremental (3 días)**

- Tabla `sync_rows`, secuencia e índice; `api/sync/push.ts` y `api/sync/pull.ts` con validación Zod y los límites de 5.5.
- `merge.ts` con reglas por fila y sus pruebas.
- Dexie versión 3 (`outbox`, `meta`), *hooks* en las 8 tablas sincronizadas (incluida `skills`) y el nuevo `syncNow` (push y luego pull).
- Reglas de dueño de 6.2 y cierre de sesión de 6.3.
- `skills` también en la copia de seguridad JSON.
- Listo cuando: dos navegadores con la misma cuenta ven en menos de 10 segundos (al volver a la app) un repaso hecho en el otro; un repaso sin internet se sube al reconectar; una palabra borrada no reaparece; y en una prueba con 100.000 filas de historial un ciclo normal sube y baja menos de 50 KB.

**Fase 7 · Migración y gestión de cuenta (1 día)**

- Importar un código antiguo (6.4); recuperar contraseña y verificar correo con el proveedor de correo; lista de dispositivos; descargar datos; borrar cuenta.
- Página de redirección en GitHub Pages hacia Vercel.
- Listo cuando: el progreso que tienes hoy en Pages aparece completo en la cuenta, y borrar la cuenta no deja filas en la base.

**Fase 8 · Pruebas finales y lanzamiento (1 día)**

- E2E nuevos: registro, inicio, sincronización entre dos contextos de navegador, cierre de sesión con borrado; todos en WebKit con perfil de iPhone y en Chromium de escritorio.
- Lista manual en el iPhone (sección 9.3).
- README y `PLANEACION_APP_IDIOMAS.md` actualizados.

| Fase | Días | Acumulado |
| --- | --- | --- |
| 1 · Estructura responsive | 2 | 2 |
| 2 · Teclado y entrada | 1,5 | 3,5 |
| 3 · Pantallas anchas y voz | 2 | 5,5 |
| 4 · Preparación | 0,5 | 6 |
| 5 · Cuentas | 2 | 8 |
| 6 · Sincronización incremental | 3 | 11 |
| 7 · Migración y cuenta | 1 | 12 |
| 8 · Pruebas y lanzamiento | 1 | 13 |

**Por qué empezar por escritorio:** se usa desde el primer día, no depende de cuentas ni servicios externos, y deja lista la barra lateral donde vivirá el estado de la cuenta. El límite de 4 MB de la sincronización actual no llega antes de que termine el bloque B, aunque no conviene dejar la fase 6 para después de febrero.

---

## 9. Pruebas

### 9.1 Unitarias (Vitest)

- Reglas de fusión por fila: conmutativas, idempotentes y que coinciden con la fusión de listas actual.
- *Hooks* del `outbox`: un `put` crea la entrada, aplicar un pull no la crea, un borrado deja la lápida.
- Ciclo de sincronización contra un servidor simulado: lotes, paginación, `401` a mitad de camino, reintento.
- Reglas de dueño (6.2) y cierre de sesión (6.3).
- Atajos de teclado por ejercicio y el caso de IME.

### 9.2 API

- Pruebas de `push` y `pull` contra una **rama de Neon** creada para CI: aislamiento entre usuarios (el usuario A nunca ve filas de B), límites, validación y la concurrencia de dos pushes de la misma fila.

### 9.3 E2E y manuales

- Playwright: proyecto nuevo `desktop-1440` además de los de iPhone y Chromium; capturas de todas las pantallas a 390, 1.280 y 1.440 px.
- En el iPhone, a mano: instalar la PWA, crear cuenta, cerrar la app del todo, abrirla al día siguiente con la sesión activa, estudiar en modo avión, volver a conectar y ver los cambios en el computador. Probar también el inicio con Google desde la PWA.

---

## 10. Seguridad y privacidad

- Contraseñas con el hash de Better Auth; mínimo 8 caracteres; límite de intentos.
- Cookies `httpOnly`, `Secure`, `SameSite=Lax`, más la comprobación de origen de Better Auth contra `trustedOrigins` (protege de CSRF).
- Toda la API valida con Zod y saca el usuario de la sesión. Ningún endpoint acepta un `userId` del cliente.
- Los registros de error no incluyen datos de estudio ni correos.
- Secretos solo en variables de entorno de Vercel; `.env.local` en `.gitignore` (ya está).
- Borrar la cuenta borra todo en cascada. Descargar los datos sigue disponible.
- `ALLOWED_ORIGINS` deja de usar `*`: con la app en el mismo dominio no hace falta CORS para la API nueva.

---

## 11. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La PWA del iPhone pierde la sesión o no vuelve tras el inicio con Google | Mismo dominio y cookie de primera parte; probarlo en la fase 5 antes de seguir. Si Google falla en la PWA, se deja correo y contraseña en el teléfono y Google en el computador |
| iOS borra los datos de una PWA que lleva semanas sin abrirse | Con cuenta ya no se pierde nada: al entrar se baja todo. Se mantiene «Proteger el almacenamiento» |
| Un *hook* de Dexie se salta un cambio | Cada tanto (una vez al día) un ciclo de verificación compara conteos por tabla con el servidor y repara la diferencia |
| Migración incompleta desde el código | La fila antigua solo se borra cuando la importación termina bien; el JSON exportado sirve de respaldo |
| Los planes gratuitos cambian | El volumen es de una sola persona, muy lejos de cualquier límite; Better Auth no depende de un proveedor y se puede mover a otro servidor |
| Cambios de escritorio rompen el móvil | Capturas comparadas a 390 px en cada fase del bloque A |

---

## 12. Decisiones que te tocan

1. **URL:** ¿basta con `*.vercel.app` o quieres un dominio propio? (Se puede cambiar después.)
2. **Google:** ¿lo incluimos desde la fase 5? Requiere crear el cliente OAuth en Google Cloud (te dejo los pasos).
3. **Correo:** para recuperar la contraseña hace falta un proveedor de correo. ¿Lo configuramos en la fase 7 o arrancamos sin recuperación?
4. **Pages:** ¿redirigir a Vercel (recomendado) o mantener las dos versiones un tiempo?
5. **Orden:** ¿escritorio primero (recomendado) o cuentas primero?
