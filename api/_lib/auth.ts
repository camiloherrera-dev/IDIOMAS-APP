/**
 * Cuentas con Better Auth. Usuarios y sesiones viven en la misma base de Neon que el progreso.
 *
 * Variables de entorno:
 *   DATABASE_URL          cadena de conexión de Neon (la pone Vercel al crear la base en Storage)
 *   BETTER_AUTH_SECRET    32 caracteres aleatorios o más (firma las sesiones)
 *   BETTER_AUTH_URL       opcional: URL pública de la app (por defecto, la de producción de Vercel)
 *   GOOGLE_CLIENT_ID      opcional: activa "Continuar con Google"
 *   GOOGLE_CLIENT_SECRET  opcional
 *   ALLOWED_ORIGINS       opcional: otros orígenes permitidos, separados por coma
 */
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { getPool } from './db.js';

const env = (name: string) => process.env[name]?.trim() || undefined;

export const googleEnabled = () => Boolean(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET'));
export const accountsEnabled = () => Boolean(env('DATABASE_URL') && env('BETTER_AUTH_SECRET'));

/** hosts de Vercel que llegan como variables de sistema (producción, rama y despliegue) */
function vercelHosts(): string[] {
  return [env('VERCEL_PROJECT_PRODUCTION_URL'), env('VERCEL_BRANCH_URL'), env('VERCEL_URL')].filter((h): h is string =>
    Boolean(h),
  );
}

export function authOptions(): BetterAuthOptions {
  const explicit = env('BETTER_AUTH_URL');
  const hosts = vercelHosts();
  const extraOrigins = (env('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '*');
  const dev = process.env.NODE_ENV !== 'production' && !env('VERCEL_ENV');

  return {
    appName: 'Lingo Lab',
    database: getPool(),
    secret: env('BETTER_AUTH_SECRET'),
    basePath: '/api/auth',
    baseURL: explicit ?? {
      allowedHosts: [...hosts, ...(dev ? ['localhost:*', '127.0.0.1:*'] : [])],
      fallback: hosts[0] ? `https://${hosts[0]}` : undefined,
      protocol: dev ? 'auto' : 'https',
    },
    trustedOrigins: [
      ...(explicit ? [explicit] : []),
      ...hosts.map((h) => `https://${h}`),
      ...extraOrigins,
      ...(dev ? ['http://localhost:*', 'http://127.0.0.1:*'] : []),
    ],
    emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true },
    socialProviders: googleEnabled()
      ? { google: { clientId: env('GOOGLE_CLIENT_ID')!, clientSecret: env('GOOGLE_CLIENT_SECRET')!, prompt: 'select_account' } }
      : {},
    session: { expiresIn: 60 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
    user: { deleteUser: { enabled: true } },
    rateLimit: {
      enabled: !dev,
      storage: 'database',
      window: 60,
      max: 120,
      customRules: {
        '/sign-in/email': { window: 60, max: 6 },
        '/sign-up/email': { window: 60, max: 4 },
        '/change-password': { window: 60, max: 5 },
        '/delete-user': { window: 60, max: 5 },
      },
    },
    advanced: { ipAddress: { ipAddressHeaders: ['x-real-ip', 'x-forwarded-for'] } },
    telemetry: { enabled: false },
  };
}

let instance: ReturnType<typeof betterAuth> | null = null;
export function getAuth() {
  instance ??= betterAuth(authOptions());
  return instance;
}

/** usuario de la sesión de la petición, o null */
export async function sessionUser(request: Request): Promise<{ id: string; email: string; name: string } | null> {
  const s = await getAuth().api.getSession({ headers: request.headers });
  return s?.user ? { id: s.user.id, email: s.user.email, name: s.user.name } : null;
}
