/** parser mínimo de frontmatter `key: value` (sin dependencias, usable en Node) */
export function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { data: {}, body: text };
  const data: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key) data[key] = value;
  }
  return { data, body: text.slice(match[0].length) };
}

export function idFromPath(path: string): string {
  return path
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]+$/, '');
}
