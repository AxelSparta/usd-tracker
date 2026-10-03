import { defineConfig, devices } from '@playwright/test'

const PORT = 3100

/**
 * E2E (Playwright) en modo local: sin sesión, con las APIs externas simuladas
 * (`e2e/fixtures.ts`) para que los tests no dependan de DolarAPI ni de CoinGecko.
 * Puerto propio para no chocar con un `pnpm dev` abierto.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // En dev, Next compila cada ruta en su primera visita: más margen y menos workers en CI
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `next` directo (no `pnpm exec`): así Playwright cierra el servidor al terminar
    command: `next dev --turbopack --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
