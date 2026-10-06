import { expect, test } from './fixtures'

// Pesos en modo local: ingresos y egresos con saldo validado (Fase 8.1).

test('pesos: ingreso, egreso sin saldo, edición y borrado que dejaría saldo negativo', async ({ page }) => {
  await page.goto('/pesos')
  await expect(page.getByText('Todavía no registraste movimientos de pesos.')).toBeVisible()

  // Ingreso
  await page.goto('/pesos/nueva')
  await page.getByLabel('Monto (ARS)').fill('1000000')
  await page.getByLabel('Nota (opcional)').fill('Sueldo')
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()

  await expect(page).toHaveURL(/\/pesos$/)
  await expect(page.getByText('Movimiento registrado.')).toBeVisible()
  const income = page.getByRole('row').filter({ hasText: 'Ingreso' })
  await expect(income).toContainText('Sueldo')
  await expect(income).toContainText('$1.000.000,00')
  // Saldo en USD con el MEP venta simulado (1.551,90)
  await expect(page.getByText('US$644,37')).toBeVisible()

  // Egreso mayor al saldo: el form queda abierto con el error
  await page.goto('/pesos/nueva')
  await page.getByRole('radio', { name: 'Egreso' }).click()
  await page.getByLabel('Monto (ARS)').fill('2000000')
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()
  await expect(page.getByText(/No tenés pesos suficientes el/)).toBeVisible()
  await expect(page).toHaveURL(/\/pesos\/nueva$/)

  // Egreso con saldo
  await page.getByLabel('Monto (ARS)').fill('400000')
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()
  await expect(page).toHaveURL(/\/pesos$/)
  await expect(page.getByRole('row').filter({ hasText: 'Egreso' })).toContainText('-$400.000,00')

  // Editar el ingreso por debajo de lo gastado: rechazado
  await income.getByRole('button', { name: 'Editar movimiento' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Monto (ARS)').fill('100000')
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText(/No tenés pesos suficientes para el egreso/)).toBeVisible()
  await page.keyboard.press('Escape')

  // Borrar el ingreso dejaría el egreso sin saldo
  await income.getByRole('button', { name: 'Eliminar movimiento' }).click()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText(/No se puede eliminar: el egreso del .* quedaría sin saldo/)).toBeVisible()

  // Después de recargar, sigue todo en localStorage
  await page.reload()
  await expect(page.getByRole('row').filter({ hasText: 'Ingreso' })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'Egreso' })).toBeVisible()
})

/** Ingreso de pesos desde el formulario */
const addIncome = async (page: import('@playwright/test').Page, amount: string) => {
  await page.goto('/pesos/nueva')
  await page.getByLabel('Monto (ARS)').fill(amount)
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()
  await expect(page).toHaveURL(/\/pesos$/)
}

test('conversiones: pesos → blue, la pata no se edita en /dolar y borrarla ahí borra las dos', async ({ page }) => {
  await addIncome(page, '3000000')

  // Atajo desde /dolar: abre la pestaña Convertir
  await page.goto('/dolar')
  await page.getByRole('link', { name: 'Comprar con pesos' }).click()
  await expect(page.getByRole('button', { name: 'Convertir', pressed: true })).toBeVisible()
  await expect(page.getByText('Disponible: $3.000.000,00')).toBeVisible()

  // Referencia: blue venta de hoy (simulado: $1.560); los USD se calculan desde los ARS
  await expect(page.getByText('Referencia: $1.560,00 · Dólar blue venta de hoy.')).toBeVisible()
  await page.getByLabel('Pesos que salen (ARS)').fill('1560000')
  await page.getByRole('button', { name: 'Calcular desde ARS' }).click()
  await expect(page.getByLabel('Dólares que recibís (USD)')).toHaveValue('1.000')
  await page.getByRole('button', { name: 'Guardar conversión' }).click()

  await expect(page).toHaveURL(/\/pesos$/)
  await expect(page.getByText('Conversión registrada.')).toBeVisible()
  const leg = page.getByRole('row').filter({ hasText: 'Compra de USD Blue' })
  await expect(leg).toContainText('-$1.560.000,00')
  await expect(leg.getByRole('button', { name: 'Editar movimiento' })).toHaveCount(0)
  await expect(page.getByText('$1.440.000,00').first()).toBeVisible()

  // En /dolar aparece la compra, con distintivo y sin editar
  await page.goto('/dolar')
  const dolarLeg = page.getByRole('row').filter({ hasText: 'con pesos' })
  await expect(dolarLeg).toContainText('1.560.000,00')
  await expect(dolarLeg).toContainText('1.000,00')
  await expect(dolarLeg.getByRole('button', { name: 'Editar transacción' })).toHaveCount(0)

  // Borrarla desde /dolar borra la conversión completa
  await dolarLeg.getByRole('button', { name: 'Eliminar transacción' }).click()
  await expect(page.getByText('¿Eliminar la conversión completa (pesos y dólares)?')).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText('Conversión eliminada.')).toBeVisible()
  await expect(page.getByText('Todavía no registraste transacciones.')).toBeVisible()
  await page.goto('/pesos')
  await expect(page.getByRole('row').filter({ hasText: 'Compra de USD' })).toHaveCount(0)
})

test('conversiones: dólar → pesos y conversión sin saldo', async ({ page }) => {
  // Sin USD MEP: rechazada, y el formulario queda abierto
  await page.goto('/pesos/nueva?modo=conversion&dolar=bolsa')
  await page.getByRole('radio', { name: 'Dólares → pesos' }).click()
  await page.getByLabel('Pesos que entran (ARS)').fill('155000')
  await page.getByLabel('Dólares que entregás (USD)').fill('100')
  await page.getByRole('button', { name: 'Guardar conversión' }).click()
  await expect(page.getByText(/No tenés suficientes USD MEP para convertir el/)).toBeVisible()
  await expect(page).toHaveURL(/\/pesos\/nueva/)

  // Con una compra de MEP previa, la venta entra como ingreso de pesos
  await page.goto('/dolar/nueva')
  await page.getByLabel('Cantidad pesos').fill('155000')
  await page.getByLabel('Cantidad dólares').fill('100')
  await page.getByRole('combobox').filter({ hasText: /Dolar blue/i }).click()
  await page.getByRole('option', { name: /bolsa/i }).click()
  await page.getByRole('button', { name: 'Guardar transacción' }).click()
  await expect(page).toHaveURL(/\/dolar$/)

  await page.goto('/pesos/nueva?modo=conversion&dolar=bolsa')
  await page.getByRole('radio', { name: 'Dólares → pesos' }).click()
  await expect(page.getByText('Disponible: US$100,00 MEP')).toBeVisible()
  await page.getByLabel('Dólares que entregás (USD)').fill('100')
  await page.getByRole('button', { name: 'Calcular desde USD' }).click()
  // MEP compra simulado: $1.543,60
  await expect(page.getByLabel('Pesos que entran (ARS)')).toHaveValue('154.360')
  await page.getByRole('button', { name: 'Guardar conversión' }).click()

  await expect(page).toHaveURL(/\/pesos$/)
  await expect(page.getByRole('row').filter({ hasText: 'Venta de USD MEP' })).toContainText('$154.360,00')
})
