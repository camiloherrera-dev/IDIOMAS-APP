import { expect, test } from '@playwright/test';
import { IGNORED_ERRORS, onboard, playLesson, shot } from './helpers';

test('chino: niveles, lección generada, gramática, prueba de nivel, refuerzo y repaso', async ({ page }) => {
  test.setTimeout(360_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await onboard(page, 'Chino');

  // la ruta tiene los cuatro niveles y se puede entrar directo a HSK 3
  await page.goto('/ruta');
  await expect(page.getByRole('heading', { name: 'Ruta' })).toBeVisible();
  for (const lv of ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4']) await expect(page.getByRole('radio', { name: lv })).toBeVisible();
  await page.getByRole('radio', { name: 'HSK 3' }).click();
  await expect(page.getByText('Ya lo sé: hacer la prueba')).toBeVisible();
  await shot(page, 'zh-01-ruta-hsk3');

  // lección de vocabulario generada (palabras nuevas + ejercicios + frases)
  await page.goto('/leccion/zh-h3-u01-l1');
  await page.locator('footer').getByRole('button', { name: 'Entendido' }).waitFor();
  await shot(page, 'zh-02-palabra');
  await playLesson(page);
  await expect(page.getByText(/palabras nuevas entraron/)).toBeVisible();
  await shot(page, 'zh-03-resumen');

  // lección de gramática: explicación y frases con hueco
  await page.goto('/leccion/zh-g-ba-oracion');
  await shot(page, 'zh-04-gramatica');
  await playLesson(page);

  // lección de escucha (diálogos)
  await page.goto('/ruta');
  await page.getByRole('radio', { name: 'HSK 3' }).click();
  await shot(page, 'zh-05-ruta-progreso');

  // prueba de nivel
  await page.goto('/prueba/HSK1');
  await expect(page.getByRole('heading', { name: 'Prueba de HSK 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Empezar la prueba' }).click();
  await shot(page, 'zh-06-prueba');
  await playLesson(page, /HSK 1 superado|Todavía no/);
  await shot(page, 'zh-07-prueba-resultado');

  // refuerzo de un punto débil
  await page.goto('/refuerzo/ba-oracion');
  await shot(page, 'zh-08-refuerzo');
  await playLesson(page, /Refuerzo terminado/);

  // repaso con tarjetas
  await page.goto('/repasar');
  await shot(page, 'zh-09-repasar');
  // las palabras de hoy se repasan desde mañana: hoy se practican con el repaso libre
  await page.getByRole('button', { name: /^Repasar \d+ tarjetas?/ }).click();
  await page.getByRole('button', { name: 'Mostrar respuesta' }).click();
  await page.waitForTimeout(400);
  await shot(page, 'zh-10-tarjeta');
  await page.getByRole('button', { name: /^Bien/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Mostrar respuesta' }).click();
  await page.getByRole('button', { name: /^Fácil/ }).click();

  // guías, herramienta de números, perfil y ajustes
  await page.goto('/guias/ba-oracion');
  await expect(page.locator('.prose-guide')).toBeVisible();
  await expect(page.getByRole('button', { name: /Practicar este punto/ })).toBeVisible();
  await shot(page, 'zh-11-guia');

  await page.goto('/herramientas/numeros');
  await expect(page.getByRole('heading', { name: 'Números al oído' })).toBeVisible();
  await shot(page, 'zh-12-numeros');

  await page.goto('/perfil');
  await expect(page.getByRole('button', { name: /Copiar contexto para el tutor/ })).toBeVisible();
  await shot(page, 'zh-13-perfil');

  await page.goto('/ajustes');
  await shot(page, 'zh-14-ajustes');

  await page.goto('/');
  await shot(page, 'zh-15-hoy');

  const relevant = errors.filter((e) => !IGNORED_ERRORS.test(e));
  expect(relevant, relevant.join('\n')).toEqual([]);
});
