import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.E2E_SHOTS;
export const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png`, fullPage: false });
};

export async function onboard(page: Page, langName: string) {
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
export async function answerCurrent(page: Page) {
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

export async function playLesson(page: Page, done = /Lección (perfecta|completada)/, maxSteps = 220) {
  for (let step = 0; step < maxSteps; step++) {
    if (await page.getByRole('heading', { name: done }).isVisible()) return;
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
