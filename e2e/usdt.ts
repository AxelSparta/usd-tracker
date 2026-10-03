import { expect, type Page } from '@playwright/test'

// Pasos de los intercambios USDT ↔ cripto, compartidos entre los E2E local y con sesión

/** 1.000 USDT comprados como dólar cripto */
export const buyUsdt = async (page: Page) => {
  await page.goto('/dolar/nueva')
  await page.getByLabel('Cantidad pesos').fill('1450000')
  await page.getByLabel('Cantidad dólares').fill('1000')
  await page.getByLabel('Tipo de dólar').click()
  await page.getByRole('option', { name: 'Dolar cripto' }).click()
  await page.getByRole('button', { name: 'Guardar transacción' }).click()
  await expect(page.getByText('Transacción creada con éxito.')).toBeVisible()
}

export const pickCoin = async (page: Page, field: 'Entregás' | 'Recibís', option: RegExp) => {
  await page.getByRole('combobox', { name: field }).click()
  await page.getByRole('option', { name: option }).click()
}

/** USDT → BTC desde el atajo de `/dolar` */
export const swapUsdtToBtc = async (page: Page) => {
  await page.goto('/dolar')
  await page.getByRole('link', { name: 'Intercambiar USDT' }).click()
  await expect(page).toHaveURL(/modo=intercambio&desde=usdt/)
  await expect(page.getByRole('combobox', { name: 'Entregás' })).toContainText('USDT')

  await page.getByLabel('Cantidad de USDT').fill('600')
  await pickCoin(page, 'Recibís', /Bitcoin/)
  await page.getByLabel('Cantidad de BTC').fill('0,01')
  // Autocompletada con el dólar cripto compra de hoy (simulado: $1.500)
  await expect(page.getByLabel('Cotización del dólar cripto (ARS)')).toHaveValue('1.500')
  await page.getByLabel('Comisión (opcional)').fill('0,6')
  await expect(page.getByText('Salen 600,60 USDT del dólar cripto')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar intercambio' }).click()

  await expect(page).toHaveURL(/\/cripto$/)
  await expect(page.getByText('Intercambio registrado.')).toBeVisible()
}
