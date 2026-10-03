# 💸 Portfolio Tracker

Aplicación web para seguir tus ahorros en Argentina: dólares y criptomonedas en un solo lugar,
con cotizaciones del mercado argentino. Producción: <https://usd-tracker.vercel.app>.

- **Dólar:** compras y ventas de USD en pesos, por tipo de dólar (oficial, blue, MEP, CCL, cripto…).
- **Cripto:** compras, ventas e intercambios de cualquier moneda de CoinGecko, en USD, con su valor en pesos.
- **Portfolio:** valor total en ARS y USD, composición por activo y evolución del valor en el tiempo.

Funciona **sin cuenta** (todo queda en tu navegador) o **con sesión** (los datos se guardan en tu
cuenta y los ves en cualquier dispositivo).

## 🧠 Funcionalidades

- **Dashboard** (`/`)
  - Valor total en ARS y USD, resumen por módulo con su ganancia
  - Composición por activo (barra al 100 % + tabla con variación 24 h y acceso al detalle)
  - Evolución del valor (1M / 3M / 6M / 1A, en ARS o USD), reconstruida desde tus operaciones y los precios históricos
- **Dólar** (`/dolar`)
  - Cotizaciones en vivo (DolarAPI), con reintentos si la API o la red fallan
  - Por tipo de dólar: posición en USD, costo promedio, invertido, valor de mercado y ganancia realizada / no realizada
  - Validación de la línea temporal: nunca se puede vender (ni borrar o editar) dejando saldo negativo
- **Cripto** (`/cripto`)
  - Buscador de monedas, precio autocompletado, comisiones en USD o en la moneda
  - Intercambios cripto ↔ cripto (venta + compra enlazadas) y de los USDT del dólar cripto por cualquier cripto (y al revés)
  - Resultados de trades (futuros, margin, bots) en USDT o en cualquier moneda, dentro del PnL realizado
  - Posiciones con costo promedio y PnL en USD y su valor en pesos con el dólar cripto
  - Detalle por moneda (`/cripto/[coinId]`)
- **Cuenta** (Clerk)
  - Sin sesión: modo local (`localStorage`)
  - Con sesión: datos en la nube (Neon + Prisma), cambios instantáneos que se revierten si el servidor los rechaza
  - Al iniciar sesión, la app ofrece subir lo que cargaste sin cuenta (sin duplicar; la nube manda)
- Tema claro / oscuro / sistema, interfaz en español, responsive

## 🚀 Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Zustand ·
React Hook Form + Zod · Clerk · Prisma 7 + Neon · recharts · Vitest · Playwright.

Datos externos: [DolarAPI](https://dolarapi.com) (cotizaciones), [ArgentinaDatos](https://argentinadatos.com)
(histórico del dólar) y [CoinGecko](https://www.coingecko.com/en/api) (precios cripto). El navegador
solo llama directo a DolarAPI; el resto pasa por las rutas `/api/*` del server, que validan y cachean.

## 🛠️ Desarrollo

```bash
pnpm install       # también genera el cliente de Prisma (postinstall)
cp .env.example .env
pnpm dev           # http://localhost:3000
```

Sin variables de entorno la app funciona en modo local: Clerk arranca en *keyless mode* y las rutas
de datos en la nube responden error hasta que haya una base.

| Comando | Qué hace |
| --- | --- |
| `pnpm lint` / `pnpm typecheck` | ESLint 9 / `tsc --noEmit` |
| `pnpm test` | Unit tests (Vitest, `src/**/*.test.ts`) |
| `pnpm test:e2e` | E2E (Playwright, `e2e/`) con las APIs externas simuladas: `--project=local` sin sesión, `--project=cloud` con sesión (Clerk de desarrollo + base de Neon de desarrollo, ver `AGENTS.md`). La primera vez: `pnpm exec playwright install chromium` |
| `pnpm db:migrate` | Crea y aplica una migración en desarrollo |
| `pnpm db:deploy` | Aplica las migraciones pendientes |
| `pnpm db:studio` | Prisma Studio |

CI (GitHub Actions) corre lint, typecheck, unit tests, build y E2E en cada PR y push a `main`.

## 🔑 Variables de entorno

| Variable | Para qué | Obligatoria |
| --- | --- | --- |
| `DATABASE_URL` | Neon, conexión **con pooler** (la usa la app) | Para la nube |
| `DIRECT_URL` | Neon, conexión directa (la usa `prisma migrate`; si falta, usa `DATABASE_URL`) | No |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Login (Clerk) | En producción |
| `COINGECKO_API_KEY` | Clave Demo de CoinGecko: más consultas por minuto | No |

## 🚢 Deploy (Vercel)

Vercel despliega `main` automáticamente y usa `pnpm vercel-build` (`scripts/vercel-build.mjs`):

- **Producción:** `prisma migrate deploy` y después `next build`. Si la migración falla, el deploy falla
  y sigue publicada la versión anterior (nunca código nuevo con una base sin migrar).
- **Previews:** solo `next build` (comparten la base: una rama sin fusionar no cambia el schema).

Las variables de la tabla se cargan en *Project → Settings → Environment Variables*. Pasos de
producción (Clerk, backups, logs): [`docs/operacion.md`](docs/operacion.md).

## 📚 Más documentación

- [`AGENTS.md`](AGENTS.md): arquitectura, convenciones y comportamiento del estado.
- [`docs/roadmap.md`](docs/roadmap.md): lo pendiente, deuda técnica y próximas fases.
- [`docs/historial.md`](docs/historial.md): fases cerradas y sus decisiones.
- [`docs/operacion.md`](docs/operacion.md): producción (variables, Clerk, backups de Neon, logs, migraciones).
