import { expect, test } from './fixtures'

// Los formularios arrancan con la fecha de hoy. El server (UTC en Vercel y en CI) puede estar en
// otro día que el navegador (de 21 a 24 h en Argentina): el HTML del server no debe traer su fecha,
// o React tira un error de hidratación y vuelve a montar el formulario.

// Los de resultado de trade (`?modo=resultado`) no se renderizan en el server: aparecen al elegir la moneda.
const FORMS = [
  '/pesos/nueva',
  '/pesos/nueva?modo=conversion',
  '/dolar/nueva',
  '/cripto/nueva',
  '/cripto/nueva?modo=intercambio',
]

for (const path of FORMS) {
  test(`${path}: la fecha por defecto es la del navegador, sin error de hidratación`, async ({
    page,
  }) => {
    // El navegador, dos días adelante del server: nunca coinciden, corra a la hora que corra
    const browserNow = new Date(Date.now() + 2 * 86_400_000)
    await page.clock.setFixedTime(browserNow)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })

    await page.goto(path)
    const today = new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(browserNow)
    await expect(page.getByRole('button').filter({ hasText: today })).toBeVisible()
    expect(errors.filter((error) => /hydrat/i.test(error))).toEqual([])
  })
}
