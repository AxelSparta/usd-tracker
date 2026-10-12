import type { Page } from '@playwright/test'
import { expect, seedLocalData, test } from './fixtures'

// Múltiples portafolios en modo local: cada uno con sus datos; el dashboard puede sumarlos.

const switcher = (page: Page) => page.getByRole('button', { name: /^Portafolio/ })

test('crear un portafolio, operar en él, verlos sumados y volver al principal', async ({ page }) => {
  await seedLocalData(page)
  await page.goto('/')
  await expect(page.getByText('US$30.100,00').first()).toBeVisible()
  await expect(switcher(page)).toContainText('Principal')

  await switcher(page).click()
  await page.getByRole('menuitem', { name: 'Nuevo portafolio' }).click()
  await page.getByLabel('Nombre').fill('Trading')
  await page.getByRole('button', { name: 'Crear' }).click()

  // Recién creado: vacío, sin la presentación de la app
  await expect(switcher(page)).toContainText('Trading')
  await expect(page.getByRole('heading', { name: 'Trading' })).toBeVisible()
  await expect(page.getByText('Este portafolio todavía no tiene operaciones.')).toBeVisible()

  await page.goto('/dolar/nueva')
  await page.getByLabel('Cantidad pesos').fill('150000')
  await page.getByLabel('Cantidad dólares').fill('100')
  await page.getByRole('button', { name: 'Guardar transacción' }).click()
  await expect(page).toHaveURL(/\/dolar$/)
  await expect(page.getByRole('row').filter({ hasText: 'Compra' })).toHaveCount(1)

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Trading' })).toBeVisible()
  await expect(page.getByText('US$100,00').first()).toBeVisible()

  // Todos: 30.100 del principal + 100 de Trading
  await page.getByRole('radio', { name: 'Todos (2)' }).click()
  await expect(page.getByRole('heading', { name: 'Todos tus portafolios' })).toBeVisible()
  await expect(page.getByText('US$30.200,00').first()).toBeVisible()
  await page.getByRole('radio', { name: 'Trading' }).click()

  await switcher(page).click()
  await page.getByRole('menuitem', { name: 'Principal' }).click()
  await expect(page.getByRole('heading', { name: 'Principal' })).toBeVisible()
  await expect(page.getByText('US$30.100,00').first()).toBeVisible()

  // Después de recargar sigue el mismo portafolio activo, con sus datos
  await page.reload()
  await expect(switcher(page)).toContainText('Principal')
  await expect(page.getByText('US$30.100,00').first()).toBeVisible()
})

test('borrar un portafolio elimina sus operaciones y vuelve al que queda', async ({ page }) => {
  await seedLocalData(page)
  await page.goto('/')
  await switcher(page).click()
  await page.getByRole('menuitem', { name: 'Nuevo portafolio' }).click()
  await page.getByLabel('Nombre').fill('Temporal')
  await page.getByRole('button', { name: 'Crear' }).click()
  await expect(switcher(page)).toContainText('Temporal')

  await switcher(page).click()
  await page.getByRole('menuitem', { name: 'Borrar «Temporal»' }).click()
  await page.getByRole('button', { name: 'Borrar portafolio' }).click()

  await expect(switcher(page)).toContainText('Principal')
  // Con un solo portafolio el dashboard vuelve a ser "Tu portfolio" y no se puede borrar
  await expect(page.getByRole('heading', { name: 'Tu portfolio' })).toBeVisible()
  await switcher(page).click()
  await expect(page.getByRole('menuitem', { name: 'Borrar «Principal»' })).toBeDisabled()
})
