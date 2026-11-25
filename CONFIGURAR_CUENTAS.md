# Configurar las cuentas en Vercel + Neon

Guía paso a paso para activar las cuentas y la sincronización de Lingo Lab. Toma unos 10 minutos. Todo cabe en los planes gratuitos.

> Lo que ya hace el código: crea las tablas solo, guarda usuarios y sesiones en Neon, y la app muestra "Crear cuenta" en cuanto el servidor tiene la base y la clave configuradas.

---

## 1. Desplegar la rama en Vercel

1. Sube la rama `feat/cuentas-y-sync` a GitHub (`git push -u origin feat/cuentas-y-sync`).
2. En Vercel, abre tu proyecto. Vercel crea un despliegue de vista previa de la rama automáticamente. Para probar antes de tocar producción, usa ese despliegue en los pasos siguientes; cuando todo funcione, fusiona la rama a `main`.

Si todavía no tienes proyecto en Vercel: **Add New → Project**, importa `IDIOMAS-APP`. Vercel detecta Vite solo; no cambies nada.

## 2. Crear la base de datos Neon desde Vercel

1. En el proyecto de Vercel, pestaña **Storage → Create Database → Neon** (puede aparecer como "Neon Serverless Postgres").
2. Elige la región más cercana a la de tus funciones de Vercel (por defecto Washington, `iad1`; en Neon, **AWS US East 1**) y el plan **Free**.
3. En **Connect Project**, conéctala al proyecto Lingo Lab para **Production** y **Preview**.

Vercel agrega solo la variable `DATABASE_URL` (y otras de Neon que no hacen falta).

**Si ya tienes una base Neon** (la del sistema de códigos): usa esa misma. En **Settings → Environment Variables** comprueba que exista `DATABASE_URL` con la cadena *pooled* (`…-pooler…`). Así el código antiguo se puede importar a la cuenta.

## 3. Agregar la clave de las sesiones

En **Settings → Environment Variables**, agrega:

| Nombre | Valor | Entornos |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | 32 caracteres aleatorios o más | Production y Preview |

Para generarla, en una terminal: `openssl rand -base64 32` (en macOS funciona tal cual; en Windows, desde Git Bash). También sirve una contraseña de 40 caracteres de un gestor de contraseñas. Guárdala solo en Vercel: si cambia, todas las sesiones se cierran.

## 4. Volver a desplegar

Las variables solo se aplican en despliegues nuevos: **Deployments →** el último **→ ⋯ → Redeploy**.

Comprueba que quedó bien abriendo `https://<tu-app>.vercel.app/api/config`. Debe decir:

```json
{ "accounts": true, "google": false }
```

## 5. Probar

1. Abre la app de Vercel → **Ajustes → Cuenta y nube → Crea una cuenta**.
2. Crea la cuenta con tu correo. Tu progreso de ese dispositivo se sube.
3. En otro dispositivo (o en una ventana privada), abre la misma URL y, en la bienvenida, toca **¿Ya tienes una cuenta?**. Al entrar, baja todo y te deja en Hoy.
4. En el iPhone, instala la versión de Vercel (Safari → Compartir → **Agregar a inicio**), inicia sesión dentro de la app instalada, ciérrala del todo y vuelve a abrirla: la sesión debe seguir.

Si usabas el código de sincronización: **Cuenta → Importar un código de sincronización**.

## 6. Opcional: "Continuar con Google"

1. En [Google Cloud Console](https://console.cloud.google.com/), crea un proyecto (o usa uno).
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo *Externo*, nombre "Lingo Lab", tu correo. Publica la app o agrégate como usuario de prueba.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**:
   - Orígenes autorizados de JavaScript: `https://<tu-app>.vercel.app`
   - URI de redireccionamiento autorizados: `https://<tu-app>.vercel.app/api/auth/callback/google`
4. Copia el ID y el secreto a Vercel como `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` y vuelve a desplegar. `/api/config` debe decir `"google": true`.

En la app instalada del iPhone, Google abre su página y debería volver a la app. Si vuelve a Safari en vez de a la app instalada, usa correo y contraseña en el teléfono.

## 7. Opcional: dominio propio

Si apuntas un dominio a Vercel, agrega `BETTER_AUTH_URL=https://tu-dominio` (y, para Google, el dominio nuevo en los orígenes y la URI de retorno).

## 8. GitHub Pages

Pages solo sirve archivos estáticos: ahí la app funciona sin cuentas. Para que su pantalla de cuenta enlace a la versión de Vercel, en GitHub → **Settings → Secrets and variables → Actions → Variables**, crea `APP_URL` con la URL de Vercel.

---

## Si algo falla

| Síntoma | Causa probable |
| --- | --- |
| `/api/config` devuelve `"accounts": false` | Falta `DATABASE_URL` o `BETTER_AUTH_SECRET`, o no se volvió a desplegar |
| `/api/config` devuelve la página de la app (HTML) | Estás en GitHub Pages, no en Vercel |
| "Error del servidor" al crear la cuenta | Revisa **Vercel → Logs** de la función `api/auth`; casi siempre es la cadena de conexión |
| La sesión se pierde al cerrar la app del iPhone | Instalaste la versión de Pages; instala la de Vercel |
| "Demasiados intentos" | Límite de seguridad: espera un minuto |

## Probar en local sin Vercel

```bash
npm run build
npm run serve:full     # http://localhost:4174 con API y una base Postgres en memoria
```

Los datos se borran al cerrar el servidor; para conservarlos: `PGLITE_DIR=.pgdata npm run serve:full`.
