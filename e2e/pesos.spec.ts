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
