import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.E2E_SHOTS;
const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png`, fullPage: false });
};

async function onboard(page: Page, langName: string) {
  await page.goto('/');
  await expect(page).toHaveURL(/bienvenida/);
  await shot(page, '01-bienvenida');
  await page.getByLabel(/cómo te llamas/i).fill('Camilo');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: new RegExp(langName) }).click();
  await shot(page, '02-idiomas');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('radio', { name: /Normal/ }).click();
  // en iPhone hay un paso extra con instrucciones de instalación
  for (let i = 0; i < 2; i++) {
    const btn = page.getByRole('button', { name: /^(Continuar|Empezar)$/ });
    const label = await btn.textContent();
    await btn.click();
    if (label === 'Empezar') break;
  }
  await expect(page.getByRole('heading', { name: /Camilo/ })).toBeVisible();
}

/** responde cualquier ejercicio (no necesariamente bien) para avanzar */
async function answerCurrent(page: Page) {
  const main = page.locator('main');

  const pairs = main.getByRole('group', { name: 'Español' });
  if (await pairs.count()) {
    const left = main.getByRole('group').first().getByRole('button');
    const right = pairs.getByRole('button');
    const n = await left.count();
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (await left.nth(i).isDisabled()) break;
        if (await right.nth(j).isDisabled()) continue;
        await left.nth(i).click();
        await right.nth(j).click();
        await page.waitForTimeout(520);
      }
    }
    return;
  }

  const options = main.getByRole('group', { name: 'Opciones' }).getByRole('button');
  if (await options.count()) return options.first().click();

  const bank = main.getByRole('group', { name: 'Palabras disponibles' }).getByRole('button');
  if (await bank.count()) {
    const n = await bank.count();
    for (let i = 0; i < Math.min(n, 3); i++) await bank.first().click();
    return;
  }

  const tones = main.getByRole('button', { name: /tono 1/ });
  if (await tones.count()) {
    for (let i = 0; i < (await tones.count()); i++) await tones.nth(i).click();
    return;
  }

  const input = main.locator('textarea, input').first();
  if (await input.count()) await input.fill('resposta');
}

async function playLesson(page: Page) {
  for (let step = 0; step < 80; step++) {
    if (await page.getByRole('heading', { name: /Lección (perfecta|completada)/ }).isVisible()) return;
    const footer = page.locator('footer');
    const entendido = footer.getByRole('button', { name: 'Entendido' });
    const continuar = footer.getByRole('button', { name: 'Continuar' });
    const comprobar = footer.getByRole('button', { name: 'Comprobar' });

    if (await entendido.isVisible()) {
      if (step === 0) await shot(page, '05-palabra-nueva');
      await entendido.click();
    } else if (await continuar.isVisible()) {
      await continuar.click();
    } else {
      await answerCurrent(page);
      if (await comprobar.isVisible()) {
        if (await comprobar.isEnabled()) {
          await comprobar.click();
          if (step < 12) await shot(page, `06-feedback-${step}`);
        }
      }
    }
    await page.waitForTimeout(320);
  }
  throw new Error('La lección no terminó');
}

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
  await page.getByRole('button', { name: 'Empezar repaso' }).click();
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

  const relevant = errors.filter((e) => !/speechSynthesis|hanzi-writer-data|Failed to load resource/i.test(e));
  expect(relevant, relevant.join('\n')).toEqual([]);
});
