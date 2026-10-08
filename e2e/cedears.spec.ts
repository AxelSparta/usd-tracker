import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// CEDEARs en modo local (Fase 9.4): cada operación mueve su pata en Pesos o en el Dólar CCL.
// Precios simulados: AAPL $26.000; CCL venta $1.600.

const addIncome = async (page: Page, amount: string) => {
  await page.goto('/pesos/nueva')
  await page.getByLabel('Monto (ARS)').fill(amount)
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()
  await expect(page).toHaveURL(/\/pesos$/)
}

/** Abre el alta y elige AAPL: el precio del día se completa solo */
const startAapl = async (page: Page) => {
  await page.goto('/cedears/nueva')
  await page.getByRole('combobox').filter({ hasText: 'Buscar CEDEAR' }).click()
  await page.getByRole('option', { name: /AAPL/ }).click()
  await expect(page.getByLabel('CCL (ARS por USD)')).toHaveValue('1.600')
}

test('CEDEARs con pesos: compra, venta, borrado bloqueado y la pata no se toca desde /pesos', async ({ page }) => {
  await page.goto('/cedears')
  await expect(page.getByText('Todavía no registraste operaciones de CEDEARs.')).toBeVisible()
  await addIncome(page, '1000000')

  // Compra de 10 AAPL con pesos, con comisión
  await startAapl(page)
  await expect(page.getByLabel(/^Precio por CEDEAR/)).toHaveValue('26.000')
  await page.getByLabel(/^Cantidad/).fill('10')
  await page.getByLabel(/^Comisión/).fill('1000')
  await expect(page.getByText('Sale $261.000,00 de tus pesos (con la comisión)')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar operación' }).click()

  await expect(page).toHaveURL(/\/cedears$/)
  await expect(page.getByText('Operación registrada.')).toBeVisible()
  // Valor: 10 × 26.000 / 1.600 = US$162,50
  const position = page.getByRole('table').first().getByRole('row').filter({ hasText: 'AAPL' })
  await expect(position).toContainText('US$162,50')
  await page.getByRole('button', { name: 'ARS' }).click()
  await expect(position).toContainText('$260.000,00')

  // En /pesos: la pata con link al CEDEAR, sin editar ni borrar
  await page.goto('/pesos')
  const leg = page.getByRole('row').filter({ hasText: 'CEDEAR · Compra de 10 AAPL' })
  await expect(leg).toContainText('-$261.000,00')
  await expect(leg.getByRole('button')).toHaveCount(0)
  await expect(page.getByText('$739.000,00').first()).toBeVisible()

  // Editar la compra (12 en vez de 10) reconstruye la pata con el monto nuevo
  await page.goto('/cedears')
  await page
    .getByRole('row')
    .filter({ hasText: 'Compra' })
    .getByRole('button', { name: 'Editar operación' })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/^Cantidad/).fill('12')
  await expect(dialog.getByLabel('CCL (ARS por USD)')).toHaveValue('1.600')
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Operación actualizada.')).toBeVisible()
  await page.goto('/pesos')
  await expect(
    page.getByRole('row').filter({ hasText: 'CEDEAR · Compra de 12 AAPL' }),
  ).toContainText('-$313.000,00')

  // Venta de 4 sin comisión: ingreso de pesos
  await startAapl(page)
  await page.getByRole('radio', { name: 'Venta' }).click()
  await page.getByLabel(/^Cantidad/).fill('4')
  await page.getByRole('button', { name: 'Guardar operación' }).click()
  await expect(page).toHaveURL(/\/cedears$/)

  // Borrar la compra dejaría la venta sin CEDEARs
  const buyRow = page.getByRole('row').filter({ hasText: 'Compra' }).filter({ hasText: 'AAPL' })
  await buyRow.getByRole('button', { name: 'Eliminar operación' }).click()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(
    page.getByText(/No se puede eliminar: la venta de AAPL del .* quedaría sin CEDEARs\./),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Borrando la venta y la compra, los pesos vuelven a ser 1.000.000
  const sellRow = page.getByRole('row').filter({ hasText: 'Venta' }).filter({ hasText: 'AAPL' })
  await sellRow.getByRole('button', { name: 'Eliminar operación' }).click()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText('Operación eliminada.')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await buyRow.getByRole('button', { name: 'Eliminar operación' }).click()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText('Todavía no registraste operaciones de CEDEARs.')).toBeVisible()

  await page.goto('/pesos')
  await expect(page.getByRole('row').filter({ hasText: 'CEDEAR' })).toHaveCount(0)
  await expect(page.getByText('$1.000.000,00').first()).toBeVisible()
})

test('CEDEARs con CCL: sin saldo se rechaza; con una conversión previa, la pata va al Dólar CCL', async ({ page }) => {
  // Sin dólares CCL
  await startAapl(page)
  await page.getByRole('radio', { name: /^Dólares CCL/ }).click()
  await page.getByLabel(/^Cantidad/).fill('10')
  await page.getByRole('button', { name: 'Usar precio del día' }).click()
  // 26.000 / 1.600
  await expect(page.getByLabel(/^Precio por CEDEAR/)).toHaveValue('16,25')
  await expect(page.getByRole('link', { name: 'Convertir pesos a CCL' })).toBeVisible()
  await page.getByRole('button', { name: 'Guardar operación' }).click()
  await expect(page.getByText(/No tenés suficientes USD CCL el/)).toBeVisible()
  await expect(page).toHaveURL(/\/cedears\/nueva$/)

  // Conversión de pesos a CCL
  await addIncome(page, '2000000')
  await page.goto('/pesos/nueva?modo=conversion&dolar=contadoconliqui')
  await page.getByLabel('Pesos que salen (ARS)').fill('1600000')
  await page.getByLabel('Dólares que recibís (USD)').fill('1000')
  await page.getByRole('button', { name: 'Guardar conversión' }).click()
  await expect(page).toHaveURL(/\/pesos$/)

  await startAapl(page)
  await page.getByRole('radio', { name: /^Dólares CCL/ }).click()
  await expect(page.getByRole('radio', { name: /^Dólares CCL/ })).toHaveAccessibleName(/US\$1\.000,00/)
  await page.getByLabel(/^Cantidad/).fill('10')
  await page.getByRole('button', { name: 'Usar precio del día' }).click()
  await expect(page.getByText('Sale US$162,50 de tus dólares CCL')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar operación' }).click()
  await expect(page).toHaveURL(/\/cedears$/)

  // En /dolar: venta de USD CCL con distintivo, sin editar ni borrar
  await page.goto('/dolar')
  const leg = page.getByRole('row').filter({ hasText: 'CEDEAR · Compra de 10 AAPL' })
  await expect(leg).toContainText('162,50')
  await expect(leg.getByRole('button')).toHaveCount(0)

  // El link lleva al detalle del CEDEAR
  await leg.getByRole('link', { name: /CEDEAR/ }).click()
  await expect(page).toHaveURL(/\/cedears\/AAPL$/)
  await expect(page.getByRole('heading', { name: 'Apple' })).toBeVisible()
})
