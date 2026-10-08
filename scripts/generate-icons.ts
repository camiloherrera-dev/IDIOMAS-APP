/**
 * Genera los PNG de la PWA a partir de una marca simple:
 * dos círculos que se cruzan (un idioma y otro) sobre fondo grafito.
 * Uso: npm run icons
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const out = resolve(import.meta.dirname, '../public/icons');
mkdirSync(out, { recursive: true });

function svg(size: number, { maskable = false, rounded = true } = {}) {
  // en maskable el contenido cabe en la zona segura (80 %)
  const scale = maskable ? 0.72 : 1;
  const c = size / 2;
  const r = size * 0.23 * scale;
  const dx = size * 0.098 * scale;
  const rx = rounded ? size * 0.22 : 0;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#1d2027"/>
  <circle cx="${c - dx}" cy="${c}" r="${r}" fill="#1f9a6b"/>
  <circle cx="${c + dx}" cy="${c}" r="${r}" fill="#d8452e" fill-opacity="0.9"/>
</svg>`);
}

const jobs: [string, Buffer][] = [
  ['icon-192.png', svg(192)],
  ['icon-512.png', svg(512)],
  ['icon-maskable-512.png', svg(512, { maskable: true, rounded: false })],
  // iOS aplica su propia máscara: fondo completo sin esquinas
  ['apple-touch-icon-180.png', svg(180, { rounded: false })],
];

for (const [name, buf] of jobs) {
  await sharp(buf).png().toFile(resolve(out, name));
  console.log('✓', name);
}
