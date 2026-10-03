import type { Page } from '@playwright/test'
import { expect, seedLocalData, test } from './fixtures'
import { buyUsdt, pickCoin, swapUsdtToBtc } from './usdt'

// Intercambios USDT (dólar cripto) ↔ cripto en modo local (Fase 7a)

/** Bloque del grupo (cabecera, resumen y tabla) */
const usdtGroup = (page: Page) =>
  page.locator('div.space-y-4').filter({ has: page.getByRole('heading', { name: 'Dólar cripto (USDT)' }) })

test('USDT → BTC → USDT, con saldos en los dos módulos y borrado completo', async ({ page }) => {
  await buyUsdt(page)
  await swapUsdtToBtc(page)

  // Cripto: la compra de BTC enlazada, sin edición
  const btcLeg = page.getByRole('row').filter({ hasText: 'desde 600,60 USDT' })
  await expect(btcLeg).toContainText('0,01')
  await expect(btcLeg.getByRole('button', { name: 'Editar operación' })).toHaveCount(0)

  // Dashboard: el intercambio no duplica ni pierde valor (399,40 USD + 0,01 BTC × 60.000)
  await page.goto('/')
  await expect(page.getByText('US$999,40').first()).toBeVisible()

  // Dólar: salieron 600,60 USDT
  await page.goto('/dolar')
  await expect(usdtGroup(page)).toContainText('399,40')
  const usdtLeg = page.getByRole('row').filter({ hasText: 'por 0,01 BTC' })
  await expect(usdtLeg).toContainText('600,60')

  // Vuelta: BTC → USDT (cotización venta: $1.520)
  await page.goto('/cripto/nueva?modo=intercambio')
  await pickCoin(page, 'Entregás', /Bitcoin/)
  await page.getByLabel('Cantidad de BTC').fill('0,01')
  await pickCoin(page, 'Recibís', /Dólar cripto/)
  await page.getByLabel('Cantidad de USDT').fill('700')
  await expect(page.getByLabel('Cotización del dólar cripto (ARS)')).toHaveValue('1.520')
  await page.getByRole('button', { name: 'Guardar intercambio' }).click()
  await expect(page.getByText('Intercambio registrado.')).toBeVisible()

  await page.goto('/dolar')
  await expect(usdtGroup(page)).toContainText('1.099,40')

  // El primero no se puede borrar: el BTC que trajo ya se vendió
  await usdtLeg.getByRole('button', { name: 'Eliminar transacción' }).click()
  await expect(page.getByText('¿Eliminar el intercambio completo (USDT y cripto)?')).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText(/No se puede eliminar: la venta de BTC/)).toBeVisible()

  // Se borra la vuelta desde Cripto y después la ida desde Dólar
  await page.goto('/cripto')
  await page
    .getByRole('row')
    .filter({ hasText: 'por 700,00 USDT' })
    .getByRole('button', { name: 'Eliminar operación' })
    .click()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText('Intercambio eliminado.')).toBeVisible()

  await page.goto('/dolar')
  await page
    .getByRole('row')
    .filter({ hasText: 'por 0,01 BTC' })
    .getByRole('button', { name: 'Eliminar transacción' })
    .click()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText('Intercambio eliminado.')).toBeVisible()
  await expect(usdtGroup(page)).toContainText('1.000,00')
  await expect(page.getByRole('row').filter({ hasText: 'BTC' })).toHaveCount(0)
})

test('no deja intercambiar más USDT de los que hay', async ({ page }) => {
  await buyUsdt(page)
  await page.goto('/cripto/nueva?modo=intercambio&desde=usdt')
  await page.getByLabel('Cantidad de USDT').fill('5000')
  await pickCoin(page, 'Recibís', /Bitcoin/)
  await page.getByLabel('Cantidad de BTC').fill('0,1')
  await expect(page.getByLabel('Cotización del dólar cripto (ARS)')).toHaveValue('1.500')
  await page.getByRole('button', { name: 'Guardar intercambio' }).click()
  await expect(page.getByText(/No tenés suficientes USDT el/)).toBeVisible()
  await expect(page).toHaveURL(/\/cripto\/nueva/)
})

test('cripto ↔ cripto sigue igual: BTC → ETH con valor en USD', async ({ page }) => {
  await seedLocalData(page)
  await page.goto('/cripto/nueva?modo=intercambio')
  await pickCoin(page, 'Entregás', /Bitcoin/)
  await page.getByLabel('Cantidad de BTC').fill('0,1')
  await pickCoin(page, 'Recibís', /Ethereum/)
  await page.getByLabel('Cantidad de ETH').fill('2')
  // Sin USDT de por medio no pide cotización en pesos
  await expect(page.getByLabel('Cotización del dólar cripto (ARS)')).toHaveCount(0)
  await page.getByRole('button', { name: 'Usar precio actual' }).click()
  await expect(page.getByLabel('Valor del intercambio (USD)')).toHaveValue('6.000')
  await expect(page.getByText('compra de ETH a US$3.000')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar intercambio' }).click()

  await expect(page.getByText('Intercambio registrado.')).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'desde BTC' })).toContainText('2')
})
