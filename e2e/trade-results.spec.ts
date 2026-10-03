import { expect, test } from './fixtures'
import { buyUsdt } from './usdt'

// Resultados de trades (Fase 7b) en modo local: en USDT (dólar cripto) y en otra moneda

const pickResultCoin = async (page: import('@playwright/test').Page, option: RegExp) => {
  await page.goto('/cripto/nueva?modo=resultado')
  await page.getByRole('combobox', { name: 'Moneda en la que se acreditó' }).click()
  await page.getByRole('option', { name: option }).click()
}

test('ganancia en USDT: suma al dólar cripto y al realizado, y se edita', async ({ page }) => {
  await buyUsdt(page)
  await pickResultCoin(page, /Dólar cripto/)

  await page.getByLabel('Cantidad de USDT').fill('50')
  // Entran USDT: dólar cripto venta de hoy (simulado: $1.520)
  await expect(page.getByLabel('Cotización del dólar cripto (ARS)')).toHaveValue('1.520')
  await page.getByLabel('Nota (opcional)').fill('BTCUSDT long x10')
  await page.getByRole('button', { name: 'Guardar resultado' }).click()

  await expect(page).toHaveURL(/\/dolar$/)
  await expect(page.getByText('Resultado registrado.')).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: 'Ganancia de trade' })
  await expect(row).toContainText('BTCUSDT long x10')
  await expect(row).toContainText('50,00')
  await expect(page.getByText('1.050,00').first()).toBeVisible()
  await expect(page.getByText('El realizado incluye $76.000,00 de resultados de trades.')).toBeVisible()

  // Se edita con su propio formulario
  await row.getByRole('button', { name: 'Editar transacción' }).click()
  await expect(page.getByRole('heading', { name: 'Editar resultado de trade' })).toBeVisible()
  await page.getByLabel('Cantidad de USDT').fill('60')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Transacción actualizada.')).toBeVisible()
  await expect(page.getByText('1.060,00').first()).toBeVisible()
  await expect(page.getByText('El realizado incluye $91.200,00 de resultados de trades.')).toBeVisible()
})

test('pérdida en BTC: salen unidades y se realiza su costo', async ({ page }) => {
  // 0,5 BTC a US$60.000
  await page.goto('/cripto/nueva')
  await page.getByRole('combobox').filter({ hasText: 'Buscar moneda' }).click()
  await page.getByRole('option', { name: /Bitcoin/ }).click()
  await expect(page.getByLabel('Precio unitario (USD)')).toHaveValue(/60\.000/)
  await page.getByLabel(/Cantidad de BTC/).fill('0,5')
  await page.getByRole('button', { name: 'Guardar operación' }).click()
  await expect(page.getByText('Operación registrada.')).toBeVisible()

  await pickResultCoin(page, /Bitcoin/)
  await page.getByRole('radio', { name: 'Pérdida' }).click()
  await page.getByLabel('Cantidad de BTC').fill('0,1')
  await page.getByRole('button', { name: 'Usar precio del día' }).click()
  await expect(page.getByLabel('Precio de BTC ese día (USD)')).toHaveValue('60.000')
  await page.getByRole('button', { name: 'Guardar resultado' }).click()

  await expect(page).toHaveURL(/\/cripto$/)
  await expect(page.getByRole('row').filter({ hasText: 'Pérdida de trade' })).toContainText('0,1')
  await expect(page.getByText(/El realizado incluye .*6\.000,00 de resultados de trades\./)).toBeVisible()
  const position = page.getByRole('row').filter({ hasText: 'BTC' }).first()
  await expect(position).toContainText('0,4')
})

test('una pérdida no puede superar el saldo', async ({ page }) => {
  await pickResultCoin(page, /Dólar cripto/)
  await page.getByRole('radio', { name: 'Pérdida' }).click()
  await page.getByLabel('Cantidad de USDT').fill('10')
  await expect(page.getByLabel('Cotización del dólar cripto (ARS)')).toHaveValue('1.500')
  await page.getByRole('button', { name: 'Guardar resultado' }).click()
  await expect(page.getByText(/El saldo de USD quedaría negativo/)).toBeVisible()
})
