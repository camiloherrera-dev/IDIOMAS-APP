import { expect, test } from '@playwright/test';
import { IGNORED_ERRORS, onboard, shot } from './helpers';

test('lecturas, escritura, subtítulo de audio y ajuste de pinyin', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await onboard(page, 'Chino');

  // lista de lecturas, desde Repasar
  await page.goto('/repasar');
  await page.getByRole('link', { name: /Lecturas/ }).click();
  await expect(page.getByRole('heading', { name: 'Lecturas', level: 1 })).toBeVisible();
  await expect(page.getByText('con tiempo')).toHaveCount(2);
  await shot(page, 'lec-01-lista');

  // lectura de HSK 1: pinyin a la vista, palabra con significado al tocarla, sin límite de tiempo
  await page.getByRole('link', { name: /Mi familia/ }).click();
  const main = page.locator('main');
  await expect(main.getByText('pregunta 1 de 2')).toBeVisible();
  await expect(main.locator('rt').first()).toBeVisible();
  await expect(main.getByRole('timer')).toHaveCount(0);
  await main.getByRole('button', { name: /医生/ }).first().click();
  await expect(main.getByText(/médico/)).toBeVisible();
  await shot(page, 'lec-02-lectura-hsk1');
  const footer = page.locator('footer');
  for (const answer of ['在医院', '四个']) {
    await main.getByRole('group', { name: 'Opciones' }).getByRole('button', { name: answer }).click();
    await footer.getByRole('button', { name: 'Comprobar' }).click();
    await expect(page.getByText('¡Bien hecho!')).toBeVisible();
    await footer.getByRole('button', { name: 'Continuar' }).click();
  }

  // escritura: la app comprueba palabras y longitud, y muestra el modelo
  await expect(main.getByText('Escritura')).toBeVisible();
  await expect(main.getByText('0 / 20 caracteres')).toBeVisible();
  await main.getByRole('textbox', { name: 'Tu texto' }).fill('我家有五口人。爸爸在医院工作，妈妈在学校工作，我是学生。');
  await expect(main.getByText('24 / 20 caracteres')).toBeVisible();
  await shot(page, 'lec-03-escritura');
  await footer.getByRole('button', { name: 'Comprobar' }).click();
  await expect(main.getByText('Texto modelo')).toBeVisible();
  await expect(page.getByText('Cumple lo pedido')).toBeVisible();
  await shot(page, 'lec-04-escritura-modelo');
  await footer.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Lectura terminada' })).toBeVisible();

  // lectura de HSK 3: con límite de tiempo y sin pinyin
  await page.goto('/lecturas/zh-h3-r1');
  await expect(main.getByRole('timer')).toBeVisible();
  await expect(main.locator('rt')).toHaveCount(0);
  await shot(page, 'lec-05-lectura-hsk3');

  // ajuste de pinyin apagado: la lectura de HSK 1 sale sin pinyin, con un botón para verlo
  await page.goto('/ajustes');
  await page.getByText('Mostrar pinyin en frases y lecturas').click();
  await expect(page.getByRole('switch', { name: /Mostrar pinyin/ })).not.toBeChecked();
  await page.goto('/lecturas/zh-h1-r1');
  await expect(main.getByText('pregunta 1 de 2')).toBeVisible();
  await expect(main.locator('rt')).toHaveCount(0);
  await main.getByRole('button', { name: 'Ver pinyin' }).click();
  await expect(main.locator('rt').first()).toBeVisible();

  // prueba de nivel con forma de examen: empieza por la escucha; a la tercera escucha sale el texto
  await page.goto('/prueba/HSK1');
  await expect(page.getByText(/tres partes, como el examen/)).toBeVisible();
  await page.getByRole('button', { name: 'Empezar la prueba' }).click();
  await expect(main.getByRole('heading', { name: 'Escucha' })).toBeVisible();
  await shot(page, 'lec-06-prueba-parte');
  await footer.getByRole('button', { name: 'Entendido' }).click();
  await expect(main.getByTestId('subtitulo')).toHaveCount(0);
  await main.getByRole('button', { name: 'Escuchar de nuevo' }).click();
  await expect(main.getByText('Si lo escuchas una vez más, aparece el texto.')).toBeVisible();
  await main.getByRole('button', { name: 'Escuchar de nuevo' }).click();
  await expect(main.getByTestId('subtitulo')).toBeVisible();
  await shot(page, 'lec-07-subtitulo');

  expect(errors.filter((e) => !IGNORED_ERRORS.test(e))).toEqual([]);
});
