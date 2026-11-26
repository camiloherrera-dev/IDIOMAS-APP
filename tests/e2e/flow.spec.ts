import { expect, test } from '@playwright/test';
import { IGNORED_ERRORS, onboard, playLesson, shot } from './helpers';

test('flujo completo: onboarding, lección, repaso y pantallas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await onboard(page, 'Portugués');
  await shot(page, '03-hoy');

  await page.getByRole('button', { name: 'Empezar la primera lección' }).click();
  await playLesson(page);
  await shot(page, '07-resumen');
  await expect(page.getByText(/palabras nuevas entraron/)).toBeVisible();

  await page.getByRole('button', { name: 'Ir a Hoy' }).click();
  await expect(page.getByText(/por repasar|Repasos al día/).first()).toBeVisible();
  await shot(page, '08-hoy-despues');

  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: /Repasar/ })
    .click();
  // las palabras de hoy se repasan desde mañana: hoy se practican con el repaso libre
  await page.getByRole('button', { name: /^Repasar \d+ tarjetas?/ }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Mostrar respuesta' }).click();
    await page.waitForTimeout(500);
    if (i === 0) await shot(page, '09-tarjeta');
    await page.getByRole('button', { name: /^Bien/ }).click();
    await page.waitForTimeout(300);
  }
  await page.getByRole('button', { name: 'Terminar repaso' }).click();

  await page.goto('/ruta');
  await expect(page.getByRole('heading', { name: 'Ruta' })).toBeVisible();
  await shot(page, '10-ruta');

  await page.goto('/guias');
  await shot(page, '11-guias');
  await page
    .getByRole('link', { name: /Ser, estar|Saludos/ })
    .first()
    .click();
  await expect(page.locator('.prose-guide')).toBeVisible();
  await shot(page, '12-guia');

  await page.goto('/herramientas/conjugacion');
  await expect(page.getByRole('heading', { name: 'ser', exact: true })).toBeVisible();
  await shot(page, '13-conjugacion');

  await page.goto('/palabras');
  await page.getByPlaceholder('Palabra o significado').fill('obrigado');
  await shot(page, '14-diccionario');

  await page.goto('/perfil');
  await expect(page.getByRole('heading', { name: 'Actividad' })).toBeVisible();
  await shot(page, '15-perfil');

  await page.goto('/ajustes');
  await page.getByRole('radio', { name: 'Oscuro' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await shot(page, '16-ajustes-oscuro');
  await page.goto('/');
  await shot(page, '17-hoy-oscuro');

  // cambiar a chino desde el selector
  await page.getByRole('button', { name: /Portugués/ }).click();
  await page.getByRole('button', { name: /Chino mandarín/ }).click();
  await expect(page.getByRole('button', { name: /Chino mandarín/ })).toBeVisible();
  await page.getByRole('button', { name: 'Empezar la primera lección' }).click();
  await page.locator('footer').getByRole('button', { name: 'Entendido' }).waitFor();
  await shot(page, '18-zh-palabra');

  const relevant = errors.filter((e) => !IGNORED_ERRORS.test(e));
  expect(relevant, relevant.join('\n')).toEqual([]);
});
