/**
 * Valida todos los paquetes de idioma: esquemas Zod, ids únicos, referencias
 * cruzadas (vocabulario y guías) y coherencia de cada ejercicio.
 * Uso: npm run validate-content   (sale con código 1 si hay errores; se corre en CI)
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ZodType } from 'zod';
import { idFromPath, parseFrontmatter } from '../src/core/content/frontmatter';
import { coreExerciseSchemas, guideFrontmatterSchema, termSchema, unitSchema } from '../src/core/schema';

const ROOT = resolve(import.meta.dirname, '../src/languages');
const errors: string[] = [];
const warnings: string[] = [];
const err = (where: string, msg: string) => errors.push(`✗ ${where}: ${msg}`);
const warn = (where: string, msg: string) => warnings.push(`! ${where}: ${msg}`);

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const files = (dir: string, ext: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(ext))
        .sort()
        .map((f) => join(dir, f))
    : [];

const DASHES = /[–—]/;

async function validateLanguage(id: string) {
  const dir = join(ROOT, id);
  const content = join(dir, 'content');
  const rel = (p: string) => p.slice(ROOT.length + 1).replace(/\\/g, '/');

  const schemas: Record<string, ZodType> = { ...coreExerciseSchemas };
  const extra = join(dir, 'exercises', 'schemas.ts');
  if (existsSync(extra)) {
    const mod = (await import(pathToFileURL(extra).href)) as { exerciseSchemas?: Record<string, ZodType> };
    Object.assign(schemas, mod.exerciseSchemas ?? {});
  }

  // vocabulario
  const terms = new Map<string, unknown>();
  for (const file of files(join(content, 'vocab'), '.json')) {
    const raw = readFileSync(file, 'utf8');
    if (DASHES.test(raw)) warn(rel(file), 'contiene guiones largos (— o –)');
    const parsed = termSchema.array().safeParse(JSON.parse(raw));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) err(rel(file), `${issue.path.join('.')} ${issue.message}`);
      continue;
    }
    for (const t of parsed.data) {
      if (!t.id.startsWith(`${id}-`)) err(rel(file), `el id ${t.id} debe empezar por "${id}-"`);
      if (terms.has(t.id)) err(rel(file), `id de término duplicado: ${t.id}`);
      terms.set(t.id, t);
      const tones = (t.extra as { tones?: unknown[] } | undefined)?.tones;
      if (Array.isArray(tones) && tones.length !== [...t.term].length)
        err(rel(file), `${t.id}: extra.tones no coincide con el número de caracteres`);
    }
  }

  // guías
  const guides = new Set<string>();
  for (const file of files(join(content, 'grammar'), '.md')) {
    const raw = readFileSync(file, 'utf8');
    if (DASHES.test(raw)) warn(rel(file), 'contiene guiones largos (— o –)');
    const { data, body } = parseFrontmatter(raw);
    const fm = guideFrontmatterSchema.safeParse(data);
    if (!fm.success) err(rel(file), `frontmatter inválido (${fm.error.issues.map((i) => i.path.join('.')).join(', ')})`);
    if (!body.trim()) err(rel(file), 'la guía está vacía');
    guides.add(idFromPath(file));
  }

  // unidades y lecciones
  const lessonIds = new Set<string>();
  const unitFiles = files(join(content, 'units'), '.json');
  if (unitFiles.length === 0) err(id, 'no hay unidades en content/units');
  for (const file of unitFiles) {
    const raw = readFileSync(file, 'utf8');
    if (DASHES.test(raw)) warn(rel(file), 'contiene guiones largos (— o –)');
    const parsed = unitSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) err(rel(file), `${issue.path.join('.')} ${issue.message}`);
      continue;
    }
    const unit = parsed.data;
    for (const lesson of unit.lessons) {
      const where = `${rel(file)} › ${lesson.id}`;
      if (lessonIds.has(lesson.id)) err(where, 'id de lección duplicado');
      lessonIds.add(lesson.id);
      if (!lesson.id.startsWith(`${id}-`)) err(where, `el id debe empezar por "${id}-" (la app deduce el idioma del id)`);
      if (lesson.unit !== unit.id) err(where, `"unit" es ${lesson.unit} pero la lección está en ${unit.id}`);
      if (lesson.intro && !guides.has(lesson.intro)) err(where, `la guía "${lesson.intro}" no existe`);
      for (const v of lesson.vocab) if (!terms.has(v)) err(where, `el término ${v} no existe en vocab/`);

      lesson.exercises.forEach((ex, i) => {
        const at = `${where} › ejercicio ${i + 1} (${ex.type})`;
        const schema = schemas[ex.type];
        if (!schema) return err(at, `tipo de ejercicio desconocido para ${id}`);
        const r = schema.safeParse(ex);
        if (!r.success) return err(at, r.error.issues.map((x) => `${x.path.join('.')} ${x.message}`).join('; '));
        const d = r.data as Record<string, unknown>;
        if (Array.isArray(d.options) && typeof d.answer === 'number') {
          if (d.answer >= d.options.length) err(at, 'answer fuera de rango');
          if (new Set(d.options).size !== d.options.length) err(at, 'opciones duplicadas');
        }
        if (ex.type === 'match-pairs') {
          const pairs = d.pairs as [string, string][];
          if (new Set(pairs.map((p) => p[0])).size !== pairs.length || new Set(pairs.map((p) => p[1])).size !== pairs.length)
            err(at, 'valores repetidos en las parejas');
        }
        if (ex.type === 'word-order') {
          const words = d.words as string[];
          for (const x of (d.distractors as string[]) ?? [])
            if (words.includes(x)) err(at, `el distractor "${x}" también está en la frase`);
        }
      });
    }
  }

  return { terms: terms.size, lessons: lessonIds.size, guides: guides.size };
}

const langs = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name);

for (const id of langs) {
  if (!existsSync(join(ROOT, id, 'language.config.ts'))) {
    err(id, 'falta language.config.ts');
    continue;
  }
  const s = await validateLanguage(id);
  console.log(`${id}: ${s.terms} términos, ${s.lessons} lecciones, ${s.guides} guías`);
}

for (const w of warnings) console.warn(w);
if (errors.length) {
  for (const e of errors) console.error(e);
  console.error(`\n${errors.length} error(es) de contenido.`);
  process.exit(1);
}
console.log('\nContenido válido.');
