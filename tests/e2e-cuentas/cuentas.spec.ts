import { expect, test, type Page } from '@playwright/test';
import { onboard, playLesson, shot } from '../e2e/helpers';

const password = 'clave-segura-123';

async function createAccount(page: Page, email: string, name?: string) {
  await page.goto('/cuenta');
  await page.getByRole('radio', { name: 'Crear cuenta' }).click();
  if (name) await page.getByLabel('Nombre').fill(name);
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).last().click();
}

async function signIn(page: Page, email: string, pass = password) {
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(pass);
  await page.getByRole('button', { name: 'Iniciar sesión' }).last().click();
}

test('cuenta: crear, sincronizar entre dispositivos, cerrar sesión y conflicto de dueño', async ({ browser }, info) => {
  test.setTimeout(300_000);
  const email = `camilo+${info.project.name}-${Date.now()}@example.com`;

  // --- dispositivo A: estudia sin cuenta y luego crea la cuenta ---
  const a = await browser.newContext({ ...info.project.use });
  const pageA = await a.newPage();
  await onboard(pageA, 'Chino');
  await pageA.goto('/leccion/zh-h1-u01-l1');
  await playLesson(pageA);
  await createAccount(pageA, email, 'Camilo');
  await expect(pageA).toHaveURL(/localhost:\d+\/$/, { timeout: 30_000 });
  await pageA.goto('/cuenta');
  await expect(pageA.getByText('Progreso guardado en tu cuenta')).toBeVisible();
  await expect(pageA.getByText('Nada pendiente.')).toBeVisible({ timeout: 20_000 });
  await shot(pageA, 'cuentas-01-cuenta');

  // --- dispositivo B: llega nuevo, inicia sesión y recibe todo ---
  const b = await browser.newContext({ ...info.project.use });
  const pageB = await b.newPage();
  await pageB.goto('/');
  await expect(pageB).toHaveURL(/bienvenida/);
  await pageB.getByRole('link', { name: /Ya tienes una cuenta/ }).click();
  await signIn(pageB, email, 'otra-clave-mala');
  await expect(pageB.getByRole('alert')).toContainText('no coinciden');
  await signIn(pageB, email);
  // baja el progreso y entra directo (sin pasar por la bienvenida)
  await expect(pageB).toHaveURL(/localhost:\d+\/$/, { timeout: 30_000 });
  await expect(pageB.getByRole('heading', { name: /Camilo/ })).toBeVisible();
  await pageB.goto('/ruta');
  await expect(pageB.getByText(/^1 de \d+ lecciones/)).toBeVisible();
  await shot(pageB, 'cuentas-02-ruta-b');

  // un cambio en B llega a A
  await pageB.goto('/leccion/zh-h1-u01-l2');
  await playLesson(pageB);
  await pageB.goto('/cuenta');
  await pageB.getByRole('button', { name: 'Sincronizar ahora' }).click();
  await expect(pageB.getByText('Nada pendiente.')).toBeVisible({ timeout: 20_000 });
  await pageA.goto('/cuenta');
  await pageA.getByRole('button', { name: 'Sincronizar ahora' }).click();
  await expect(pageA.getByText('Nada pendiente.')).toBeVisible({ timeout: 20_000 });
  await pageA.goto('/ruta');
  await expect(pageA.getByText(/^2 de \d+ lecciones/)).toBeVisible();

  // --- B cierra sesión borrando sus datos ---
  await pageB.goto('/cuenta');
  await pageB.getByRole('button', { name: /Cerrar sesión/ }).click();
  await pageB.getByRole('button', { name: 'Borrarlo de este dispositivo' }).click();
  await expect(pageB).toHaveURL(/bienvenida/, { timeout: 20_000 });

  // --- A cierra sesión dejando sus datos y entra otra cuenta: conflicto de dueño ---
  await pageA.goto('/cuenta');
  await pageA.getByRole('button', { name: /Cerrar sesión/ }).click();
  await pageA.getByRole('button', { name: 'Dejarlo en este dispositivo' }).click();
  await expect(pageA).toHaveURL(/ajustes/);
  await createAccount(pageA, `otra+${email}`, 'Otra persona');
  await expect(pageA.getByText('Este dispositivo tiene el progreso de otra cuenta')).toBeVisible({ timeout: 20_000 });
  await shot(pageA, 'cuentas-03-conflicto');
  await pageA.getByRole('button', { name: 'Borrar y usar esta cuenta' }).first().click();
  await expect(pageA).toHaveURL(/bienvenida/, { timeout: 20_000 });
  // la cuenta nueva no recibió nada del dueño anterior: sigue en la bienvenida
  await pageA.waitForTimeout(3000);
  await expect(pageA).toHaveURL(/bienvenida/);
  const rows = await pageA.evaluate(async () =>
    (await fetch('/api/rows?since=0', { headers: { 'x-device-id': 'comprobacion-0001' } })).json(),
  );
  expect(rows.rows).toEqual([]);

  await a.close();
  await b.close();
});
