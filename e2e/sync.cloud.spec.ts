import { clerk, clerkSetup } from '@clerk/testing/playwright'
import type { Page } from '@playwright/test'
import { E2E_EMAIL, ensureTestUser, hasCloudEnv, resetCloudData } from './cloud'
import { expect, seedLocalData, test } from './fixtures'
import { buyUsdt, settled, swapUsdtToBtc } from './usdt'

// Flujos con sesión: los datos viven en Neon. Comparten un usuario de prueba, así que van en serie.

test.describe.configure({ mode: 'serial' })
test.skip(!hasCloudEnv, 'Faltan CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY o DATABASE_URL')

let userId: string

test.beforeAll(async () => {
  // Testing token de Clerk (evita la protección anti-bots) + usuario de prueba
  await clerkSetup()
  userId = await ensureTestUser()
})

test.beforeEach(async () => {
  await resetCloudData(userId)
})

const signIn = async (page: Page) => {
  await page.goto('/')
  await clerk.signIn({ page, emailAddress: E2E_EMAIL })
}

const addDolarBuy = async (page: Page) => {
  await page.goto('/dolar/nueva')
  await expect(page.getByRole('button', { name: 'Sincronizado' })).toBeVisible()
  await page.getByLabel('Cantidad pesos').fill('150000')
  await page.getByLabel('Cantidad dólares').fill('100')
  await page.getByRole('button', { name: 'Guardar transacción' }).click()
  await expect(page).toHaveURL(/\/dolar$/)
  await expect(page.getByText('Transacción creada con éxito.')).toBeVisible()
  await settled(page)
}

const buyRow = (page: Page) => page.getByRole('row').filter({ hasText: 'Compra' })

test('con sesión, una compra se guarda en la nube y no en el navegador', async ({ page }) => {
  await signIn(page)
  await addDolarBuy(page)
  await expect(page.getByRole('button', { name: 'Sincronizado' })).toBeVisible()

  // Al recargar viene de la base
  await page.reload()
  await expect(buyRow(page)).toContainText('150.000,00')

  // localStorage solo guarda lo local, que sigue vacío
  const local = await page.evaluate(() => localStorage.getItem('transactions-storage'))
  expect(JSON.parse(local ?? '{}').state?.transactions ?? {}).toEqual({})
})

test('una escritura fallida en la nube se revierte', async ({ page }) => {
  await signIn(page)
  await addDolarBuy(page)

  await page.route('**/api/dolar/transactions/*', (route) =>
    route.request().method() === 'DELETE' ? route.abort('internetdisconnected') : route.fallback(),
  )
  await page.getByRole('button', { name: 'Eliminar transacción' }).click()
  await page.getByRole('button', { name: 'Confirmar' }).click()

  await expect(page.getByText('No hay conexión con el servidor.')).toBeVisible()
  await expect(buyRow(page)).toContainText('150.000,00')

  // Sigue en la base
  await page.unroute('**/api/dolar/transactions/*')
  await page.reload()
  await expect(buyRow(page)).toContainText('150.000,00')
})

test('al iniciar sesión se suben las operaciones locales', async ({ page }) => {
  await seedLocalData(page)
  await signIn(page)

  const dialog = page.getByRole('dialog', { name: 'Tenés operaciones en este navegador' })
  await expect(dialog).toContainText('2 operaciones (1 del dólar y 1 de cripto)')
  await dialog.getByRole('button', { name: 'Subir a mi cuenta' }).click()
  await expect(page.getByText('Subiste 2 operaciones a tu cuenta.')).toBeVisible()
  await expect(dialog).toBeHidden()

  await page.goto('/dolar')
  await expect(buyRow(page)).toContainText('150.000,00')
  await page.goto('/cripto')
  await expect(page.getByRole('row').filter({ hasText: 'BTC' }).first()).toContainText('0,5')

  // Ya están en la nube: no se vuelve a ofrecer
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sincronizado' })).toBeVisible()
  await expect(dialog).toBeHidden()
})

test('con sesión, un intercambio USDT → BTC se guarda en la nube y se borra completo', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('button', { name: 'Sincronizado' })).toBeVisible()
  await buyUsdt(page)
  await swapUsdtToBtc(page)

  // Al recargar, las dos patas vienen de la base
  await page.reload()
  await expect(page.getByRole('row').filter({ hasText: 'desde 600,60 USDT' })).toBeVisible()
  await page.goto('/dolar')
  const usdtLeg = page.getByRole('row').filter({ hasText: 'por 0,01 BTC' })
  await expect(usdtLeg).toContainText('600,60')

  await usdtLeg.getByRole('button', { name: 'Eliminar transacción' }).click()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText('Intercambio eliminado.')).toBeVisible()
  await settled(page)
  await page.reload()
  await expect(page.getByRole('row').filter({ hasText: 'Compra' })).toContainText('1.000,00')
  await expect(usdtLeg).toHaveCount(0)
})

test('con sesión, un resultado de trade en USDT se guarda en la nube con su nota', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('button', { name: 'Sincronizado' })).toBeVisible()
  await page.goto('/cripto/nueva?modo=resultado')
  await page.getByRole('combobox', { name: 'Moneda en la que se acreditó' }).click()
  await page.getByRole('option', { name: /Dólar cripto/ }).click()
  await page.getByLabel('Cantidad de USDT').fill('25')
  await expect(page.getByLabel('Cotización del dólar cripto (ARS)')).toHaveValue('1.520')
  await page.getByLabel('Nota (opcional)').fill('grid bot')
  await page.getByRole('button', { name: 'Guardar resultado' }).click()
  await expect(page.getByText('Resultado registrado.')).toBeVisible()
  await settled(page)

  await page.reload()
  await expect(page.getByRole('row').filter({ hasText: 'Ganancia de trade' })).toContainText('grid bot')
})

test('con sesión, los movimientos de pesos van a la nube y lo local se sube', async ({ page }) => {
  // Un ingreso local de antes de iniciar sesión
  await page.addInitScript(() => {
    if (localStorage.getItem('pesos-storage')) return
    localStorage.setItem(
      'pesos-storage',
      JSON.stringify({
        state: {
          movements: [
            {
              id: '00000000-0000-4000-8000-0000000000a1',
              type: 'BUY',
              amount: 500_000,
              date: new Date(Date.now() - 10 * 86_400_000).toISOString(),
              note: 'Ahorros',
            },
          ],
        },
        version: 1,
      }),
    )
  })
  await signIn(page)

  const dialog = page.getByRole('dialog', { name: 'Tenés operaciones en este navegador' })
  await expect(dialog).toContainText('1 operación (1 de pesos)')
  await dialog.getByRole('button', { name: 'Subir a mi cuenta' }).click()
  await expect(page.getByText('Subiste 1 operación a tu cuenta.')).toBeVisible()

  // Un egreso nuevo: se valida con el saldo de la nube y no se guarda en el navegador
  await page.goto('/pesos/nueva')
  await expect(page.getByRole('button', { name: 'Sincronizado' })).toBeVisible()
  await page.getByRole('radio', { name: 'Egreso' }).click()
  await page.getByLabel('Monto (ARS)').fill('200000')
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()
  await expect(page).toHaveURL(/\/pesos$/)
  await settled(page)

  await page.reload()
  await expect(page.getByRole('row').filter({ hasText: 'Ahorros' })).toContainText('$500.000,00')
  await expect(page.getByRole('row').filter({ hasText: 'Egreso' })).toContainText('-$200.000,00')
  const local = await page.evaluate(() => localStorage.getItem('pesos-storage'))
  expect(JSON.parse(local ?? '{}').state.movements).toHaveLength(1)
})
