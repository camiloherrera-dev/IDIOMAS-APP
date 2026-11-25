/**
 * Servidor local completo: la app compilada (dist/) + las funciones de /api + una base
 * Postgres en memoria (PGlite). Sirve para probar cuentas y sincronización sin Vercel ni Neon.
 *
 *   npm run build && npm run serve:full          → http://localhost:4174
 *
 * Variables opcionales: PORT, PGLITE_DIR (carpeta para que los datos persistan),
 * DATABASE_URL (para usar una base real en vez de PGlite).
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const PORT = Number(process.env.PORT ?? 4174);
const DIST = resolve(import.meta.dirname, '../dist');

if (!process.env.DATABASE_URL) {
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  const pg = await PGlite.create(process.env.PGLITE_DIR);
  const port = 54_000 + (PORT % 1000);
  const socket = new PGLiteSocketServer({ db: pg, port, host: '127.0.0.1' });
  await socket.start();
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
  process.env.PG_POOL_MAX = '1';
}
process.env.BETTER_AUTH_SECRET ??= 'solo-para-desarrollo-local-0123456789abcdef';
process.env.BETTER_AUTH_URL ??= `http://localhost:${PORT}`;

type Handler = (request: Request) => Response | Promise<Response>;
type Mod = Partial<Record<'GET' | 'POST' | 'DELETE' | 'OPTIONS', Handler>>;
const routes: Record<string, Mod> = {
  '/api/auth': await import('../api/auth.ts'),
  '/api/rows': await import('../api/rows.ts'),
  '/api/config': await import('../api/config.ts'),
  '/api/legacy-import': await import('../api/legacy-import.ts'),
  '/api/sync': await import('../api/sync.ts'),
};

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
};

async function toRequest(req: IncomingMessage, url: URL): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else if (v !== undefined) headers.set(k, v);
  }
  headers.set('x-real-ip', req.socket.remoteAddress ?? '127.0.0.1');
  const body = chunks.length && req.method !== 'GET' && req.method !== 'HEAD' ? Buffer.concat(chunks) : undefined;
  return new Request(url, { method: req.method, headers, body });
}

async function sendResponse(res: ServerResponse, response: Response) {
  const headers: Record<string, string | string[]> = {};
  response.headers.forEach((v, k) => {
    if (k !== 'set-cookie') headers[k] = v;
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) headers['set-cookie'] = cookies;
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

function serveStatic(res: ServerResponse, pathname: string) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, safe);
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    // igual que vercel.json: /api/auth/<ruta> → /api/auth?__auth=<ruta>
    if (url.pathname.startsWith('/api/auth/')) {
      url.searchParams.set('__auth', url.pathname.slice('/api/auth/'.length));
      url.pathname = '/api/auth';
    }
    const mod = routes[url.pathname];
    if (mod) {
      const handler = mod[(req.method ?? 'GET') as keyof Mod];
      if (!handler) return void res.writeHead(405).end();
      return void (await sendResponse(res, await handler(await toRequest(req, url))));
    }
    if (url.pathname.startsWith('/api/')) return void res.writeHead(404).end();
    serveStatic(res, url.pathname);
  } catch (err) {
    console.error(err);
    res.writeHead(500).end();
  }
}).listen(PORT, () => console.log(`Lingo Lab con cuentas en http://localhost:${PORT}`));
