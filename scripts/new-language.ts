/**
 * Crea un idioma nuevo copiando src/languages/_template.
 * Uso: npm run new-language fr "Francés" fr-FR [Français]
 */
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [id, name, locale, native] = process.argv.slice(2);
if (!id || !name || !locale || !/^[a-z]{2,3}$/.test(id)) {
  console.error('Uso: npm run new-language <id de 2-3 letras> "<Nombre en español>" <locale> [nombre nativo]');
  console.error('Ejemplo: npm run new-language fr "Francés" fr-FR Français');
  process.exit(1);
}

const root = resolve(import.meta.dirname, '../src/languages');
const target = join(root, id);
if (existsSync(target)) {
  console.error(`Ya existe src/languages/${id}`);
  process.exit(1);
}

cpSync(join(root, '_template'), target, { recursive: true });

const glyph = id.charAt(0).toUpperCase() + id.slice(1, 2);
const replacements: [RegExp, string][] = [
  [/__ID__/g, id],
  [/__NAME__/g, name],
  [/__NATIVE__/g, native ?? name],
  [/__LOCALE__/g, locale],
  [/__GLYPH__/g, glyph],
];

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else {
      let text = readFileSync(path, 'utf8');
      for (const [re, value] of replacements) text = text.replace(re, value);
      text = text.replace(/\n \* Plantilla de idioma[\s\S]*?\*\/\n/, `\n * Paquete de idioma: ${name}.\n */\n`);
      writeFileSync(path, text);
    }
  }
}
walk(target);

console.log(`✓ Creado src/languages/${id}`);
console.log('Siguientes pasos:');
console.log(`  1. Ajusta src/languages/${id}/language.config.ts (acento, niveles, script)`);
console.log(`  2. Escribe el contenido en src/languages/${id}/content/`);
console.log('  3. npm run validate-content');
console.log('  4. npm run dev: el idioma aparece solo en el selector');
