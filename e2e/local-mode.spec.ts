import { expect, seedLocalData, test } from './fixtures'

// Flujos en modo local (sin sesión): los datos viven en localStorage.

test('home sin operaciones muestra la presentación', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Tus inversiones, en un solo lugar.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Modo local' })).toBeVisible()
})

test('dólar: alta de una compra y venta rechazada por falta de saldo', async ({ page }) => {
  await page.goto('/dolar/nueva')
  await page.getByLabel('Cantidad pesos').fill('150000')
  await page.getByLabel('Cantidad dólares').fill('100')
  await page.getByRole('button', { name: 'Guardar transacción' }).click()

  await expect(page).toHaveURL(/\/dolar$/)
  await expect(page.getByText('Transacción creada con éxito.')).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: 'Compra' })
  await expect(row).toContainText('150.000,00')
  await expect(row).toContainText('100,00')

  // Vender más de lo que se tiene: el form queda abierto con el error
  await page.goto('/dolar/nueva')
  await page.getByLabel('Cantidad pesos').fill('900000')
  await page.getByLabel('Cantidad dólares').fill('500')
  await page.getByRole('radio', { name: 'Venta' }).click()
  await page.getByRole('button', { name: 'Guardar transacción' }).click()
  await expect(page.getByText(/El saldo de USD quedaría negativo/)).toBeVisible()
  await expect(page).toHaveURL(/\/dolar\/nueva$/)
})

test('cripto: compra de BTC desde el buscador', async ({ page }) => {
  await page.goto('/cripto/nueva')
  await page.getByRole('combobox').filter({ hasText: 'Buscar moneda' }).click()
  await page.getByPlaceholder('Bitcoin, ETH, sol…').fill('bit')
  await page.getByRole('option', { name: /Bitcoin/ }).click()

  // El precio se autocompleta con el precio actual (simulado: US$60.000)
  await expect(page.getByLabel('Precio unitario (USD)')).toHaveValue(/60\.000/)
  await page.getByLabel(/Cantidad de BTC/).fill('0,5')
  await page.getByRole('button', { name: 'Guardar operación' }).click()

  await expect(page).toHaveURL(/\/cripto$/)
  await expect(page.getByText('Operación registrada.')).toBeVisible()
  const position = page.getByRole('row').filter({ hasText: 'BTC' }).first()
  await expect(position).toContainText('US$30.000,00')
})

test('home con operaciones: dashboard, composición y evolución', async ({ page }) => {
  await seedLocalData(page)
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Tu portfolio' })).toBeVisible()
  // 100 USD (blue) + 0,5 BTC × 60.000 = US$30.100
  await expect(page.getByText('US$30.100,00').first()).toBeVisible()

  const composition = page.getByRole('table').filter({ hasText: 'Parte' })
  await expect(composition.getByRole('row').filter({ hasText: 'BTC' })).toContainText('99,7')
  await expect(composition.getByRole('row').filter({ hasText: 'Dólar Blue' })).toContainText('0,3')

  await expect(page.getByRole('heading', { name: 'Evolución del valor' })).toBeVisible()
  await expect(page.getByRole('img', { name: /Evolución del valor en ARS/ })).toBeVisible()

  // Drill-down al detalle de la moneda
  await composition.getByRole('link', { name: /BTC/ }).click()
  await expect(page).toHaveURL(/\/cripto\/bitcoin$/)
})

test('DolarAPI caída: avisa sin romper la app', async ({ page }) => {
  await page.route('https://dolarapi.com/**', (route) => route.abort('internetdisconnected'))
  await page.goto('/dolar')
  await expect(page.getByText(/no se pudieron actualizar las cotizaciones/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dólar', exact: true })).toBeVisible()
})
