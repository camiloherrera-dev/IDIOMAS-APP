// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROFILE } from '../src/db/index';
import { emptySnapshot, generateSyncCode } from '../src/db/sync/merge';

// Neon simulado en memoria: reconoce las 4 consultas que usa api/sync.ts
const rows = new Map<string, { data: unknown; version: number }>();
vi.mock('@neondatabase/serverless', () => ({
  neon: () => {
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const q = strings.join('?').replace(/\s+/g, ' ').trim();
      if (q.startsWith('CREATE TABLE')) return Promise.resolve([]);
      if (q.startsWith('SELECT')) {
        const r = rows.get(values[0] as string);
        return Promise.resolve(r ? [structuredClone(r)] : []);
      }
      if (q.startsWith('INSERT')) {
        const [id, data] = values as [string, string];
        if (rows.has(id)) return Promise.resolve([]);
        rows.set(id, { data: JSON.parse(data), version: 1 });
        return Promise.resolve([{ version: 1 }]);
      }
      if (q.startsWith('UPDATE')) {
        const [data, id, version] = values as [string, string, number];
        const r = rows.get(id);
        if (!r || r.version !== version) return Promise.resolve([]);
        rows.set(id, { data: JSON.parse(data), version: version + 1 });
        return Promise.resolve([{ version: version + 1 }]);
      }
      if (q.startsWith('DELETE')) {
        rows.delete(values[0] as string);
        return Promise.resolve([]);
      }
      throw new Error(`consulta inesperada: ${q}`);
    };
    return sql;
  },
}));

const { POST, DELETE, OPTIONS } = await import('../api/sync');

const req = (method: string, body: unknown) =>
  new Request('https://lingo.test/api/sync', {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'https://camilo.github.io' },
    body: JSON.stringify(body),
  });

const withName = (name: string, updatedAt: number) => {
  const s = emptySnapshot();
  s.tables.profile = [{ ...DEFAULT_PROFILE, name, createdAt: 1, updatedAt }];
  return s;
};

describe('api/sync', () => {
  beforeEach(() => {
    rows.clear();
    process.env.DATABASE_URL = 'postgres://simulada';
  });

  it('crea, fusiona y devuelve el resultado', async () => {
    const code = generateSyncCode();
    let res = await POST(req('POST', { code, mode: 'create', snapshot: withName('iPhone', 10) }));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');

    res = await POST(req('POST', { code, mode: 'sync', snapshot: withName('PC', 5) }));
    const body = (await res.json()) as { snapshot: ReturnType<typeof emptySnapshot> };
    expect(body.snapshot.tables.profile[0].name).toBe('iPhone'); // el más reciente gana
    expect(rows.size).toBe(1);
    expect([...rows.keys()][0]).not.toContain(code); // el código no se guarda en claro
  });

  it('vincular con un código inexistente da 404', async () => {
    const res = await POST(req('POST', { code: generateSyncCode(), mode: 'link', snapshot: emptySnapshot() }));
    expect(res.status).toBe(404);
  });

  it('rechaza códigos y datos inválidos', async () => {
    expect((await POST(req('POST', { code: 'hola', snapshot: emptySnapshot() }))).status).toBe(400);
    expect((await POST(req('POST', { code: generateSyncCode(), snapshot: { nope: 1 } }))).status).toBe(400);
  });

  it('borra los datos y responde a OPTIONS', async () => {
    const code = generateSyncCode();
    await POST(req('POST', { code, mode: 'create', snapshot: emptySnapshot() }));
    expect((await DELETE(req('DELETE', { code }))).status).toBe(200);
    expect(rows.size).toBe(0);
    expect(OPTIONS(new Request('https://lingo.test/api/sync', { method: 'OPTIONS' })).status).toBe(204);
  });
});
