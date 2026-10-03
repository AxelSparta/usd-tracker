import { defineConfig, devices } from '@playwright/test'

// `E2E_PORT=3000` reusa un `pnpm dev` abierto (Next 16 no deja levantar dos en la misma carpeta)
const PORT = Number(process.env.E2E_PORT ?? 3100)

// Next lee `.env` solo; los tests con sesión también necesitan las claves (Clerk, Neon)
try {
  process.loadEnvFile('.env')
} catch {
  // Sin `.env` (CI): los specs `*.cloud.spec.ts` se saltean salvo que el entorno traiga las claves
}

/**
 * E2E (Playwright) con las APIs externas simuladas (`e2e/fixtures.ts`) para que los tests
 * no dependan de DolarAPI ni de CoinGecko. Proyecto `local`: sin sesión. Proyecto `cloud`:
 * con sesión de Clerk contra una base de Neon de desarrollo (ver `e2e/cloud.ts`).
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
  projects: [
    { name: 'local', testIgnore: /\.cloud\.spec\.ts$/, use: { ...devices['Desktop Chrome'] } },
    { name: 'cloud', testMatch: /\.cloud\.spec\.ts$/, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // `next` directo (no `pnpm exec`): así Playwright cierra el servidor al terminar
    command: `next dev --turbopack --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
