# Contexto del proyecto (agentes de código)

Este archivo orienta a **cualquier asistente de código** (Cursor, Claude, Gemini, Copilot, etc.) sobre el repositorio. No sustituye al README ni a `docs/roadmap.md`; complétalos si necesitas detalle de producto o planificación.

## Resumen

Aplicación web (**DolarTracker**, evolucionando a Portfolio Tracker) para registrar **compras y ventas** de USD orientada al mercado argentino: cotizaciones vía API pública, métricas de costo promedio y ganancias realizadas / no realizadas. Modo **local-first** con persistencia en el navegador. El store tiene ramas para usuario autenticado + API, pero hoy son **código muerto** (ver "Modo remoto").

## Funcionalidades implementadas (estado actual)

- Alta de transacciones: tipo (`BUY` / `SELL`), monto en ARS, monto en USD, fecha y tipo de dólar (`dolarOption`).
- Validación con Zod (`src/validations/transaction.ts`):
  - campos obligatorios
  - montos como texto en formato AR (miles `.`, decimales `,`), parseados con `parseLocaleAmount`
  - pesos ≥ 0, dólares > 0
  - fecha requerida y no futura (en el schema y en el `<Calendar>`)
- Consistencia de la línea temporal (por tipo de dólar):
  - orden por fecha ascendente; mismo día: compras antes que ventas (`sortTxs`)
  - error si el balance USD queda negativo (`validateTimeline`), al vender **y** al borrar
- Historial agrupado por tipo de dólar, con tabla (fecha, operación, montos, tipo de cambio) y borrado con confirmación.
- Métricas **por tipo de dólar** (`transactionsData: Partial<Record<DolarOption, TransactionsData>>`):
  `totalUsd`, `investedPesos`, `averageCost`, `marketValuePesos`, `realizedProfit`, `unrealizedProfit`.
- Cotizaciones DolarAPI: carga inicial y refresco cada 5 min en `providers.tsx`; recálculo automático de métricas al llegar nuevas cotizaciones.
- Tarjetas de cotizaciones destacadas (`DolarPrice`): oficial, blue, bolsa, cripto.
- Tema claro/oscuro/sistema (`next-themes`), toasts (Sonner), UI en español.

## Stack (versiones según `package.json`)

| Área             | Elección                                                                    |
| ---------------- | --------------------------------------------------------------------------- |
| Framework        | Next.js 16 (App Router, Turbopack en dev)                                   |
| Lenguaje         | TypeScript 6.x                                                              |
| UI               | React 19                                                                    |
| Estilos          | Tailwind CSS 4 (`@tailwindcss/postcss`, `tw-animate-css`)                   |
| Estado           | Zustand 5 + `persist` → `localStorage`                                      |
| Formularios      | React Hook Form + Zod 4 + `@hookform/resolvers`                             |
| Componentes base | shadcn/ui (`components.json`) sobre Radix UI, `cva`, `tailwind-merge`       |
| Tema             | `next-themes` (claro / oscuro / sistema)                                    |
| Feedback         | Sonner (toasts)                                                             |
| Iconos           | `lucide-react`, `react-icons` si hace falta marca                           |
| Fechas           | `date-fns`, `dayjs`, `react-day-picker`                                     |
| Datos externos   | [DolarAPI](https://dolarapi.com) (`src/services/dolarApi.ts`) — sin API key |

**Gestor de paquetes:** `pnpm` (no mezclar con npm/yarn). `pnpm-workspace.yaml` solo habilita los build scripts de `sharp` y `unrs-resolver`.

## Estructura de carpetas

```
src/
├── app/
│   ├── layout.tsx              # server: metadata, fuente, Header/Footer, <Toaster>
│   ├── providers.tsx           # client: ThemeProvider + fetch/refresh de cotizaciones
│   ├── page.tsx                # "/" → DolarPrice + TransactionList
│   ├── new-transaction/page.tsx# "/new-transaction" → NewTransactionForm
│   ├── not-found.tsx           # 404
│   └── globals.css
├── components/                 # piezas de la app (Header, Footer, ThemeSwitch, DolarPrice,
│   │                           #   TransactionList, NewTransactionForm)
│   └── ui/                     # primitivos shadcn — no meter lógica de negocio aquí
├── domain/                     # motor financiero puro (sin React ni stores) + __tests__/
│   ├── metrics.ts              # computeGroupMetrics, computeTransactionsData, MarketPriceMap
│   └── timeline.ts             # sortTxs, validateTimeline
├── lib/
│   ├── locale-amount.ts        # parse/format de montos AR (parseLocaleAmount, formatCurrency…)
│   └── utils.ts                # cn()
├── services/dolarApi.ts        # cliente HTTP DolarAPI
├── store/
│   ├── transaction.store.ts    # transacciones + persist; delega cálculos a domain/
│   └── dolar.store.ts          # allDolarData + persist; selectMarketPrices → MarketPriceMap
├── types/                      # dolar.types.ts (DolarOption, DolarData), transaction.types.ts
└── validations/transaction.ts  # schema Zod del formulario + parseTransactionFormInput
```

- Alias: `@/*` → `src/*` (ver `tsconfig.json`).
- Dirección de dependencias: `components → store → (domain, services, lib, types)`; `domain → types` únicamente. `domain`, `validations` y `types` **nunca** importan stores ni React. `types/transaction.types.ts` define el modelo de dominio y no importa `validations`.
- Arquitectura objetivo (`src/features/*`, `server/`): ver `docs/roadmap.md`. **No** crearla a medias fuera de la fase correspondiente.

## Comportamiento importante del estado

- **Persistencia:** Zustand `persist` con claves `transactions-storage` y `dolar-storage`, **sin `version`/`migrate`**. Cualquier cambio de forma en `Transaction`, `DolarOption` o el estado persistido rompe datos de usuarios existentes: añadir `version` + `migrate` en el mismo cambio.
- **Forma de los datos:** `transactions: Partial<Record<DolarOption, Transaction[]>>`, cada grupo ordenado con `sortTxs`. Los montos se guardan como `number`; la fecha, como `Date` serializada a string por `persist` (usar `new Date(tx.date)` al leer).
- **Suscripción:** `useDolarStore.subscribe` (al final de `transaction.store.ts`) re-ejecuta `updateTransactionsData` en cada cambio del dolar store.
- **Cálculos (`src/domain/metrics.ts`):** costo promedio ponderado con compras; cada venta suma `(precio venta − costo promedio) × USD` a la ganancia realizada y reduce la posición; la no realizada usa `MarketPrice.sell` **del mismo tipo de dólar del grupo**. Los precios se inyectan: `updateTransactionsData` arma el `MarketPriceMap` con `selectMarketPrices(useDolarStore.getState())`. Cualquier cambio en la matemática va acompañado de tests en `src/domain/__tests__/`.
- **Modo remoto (código muerto):** si `isSignedIn` es `true`, el store hace `POST /api/transactions` y `DELETE /api/transactions/:id`. Los call sites pasan `isSignedIn: false` hardcodeado, no existe `GET` ni esas rutas, y un `!res.ok` hace `return` sin error. No extender esta rama; se reconstruye en las Fases 1–3.

## Convenciones de desarrollo

- Componentes funcionales con tipos explícitos para props.
- Formularios: React Hook Form + esquemas Zod en `src/validations/`; los montos se validan como string y se convierten con `parseTransactionFormInput`.
- Formato de números en UI: `formatCurrency` (`es-AR`); no usar `toFixed` para mostrar.
- Errores de negocio: el store lanza `Error` con mensaje en español; el componente lo muestra con `toast.error`.
- Estilos: utilidades Tailwind + `cn()`; variantes `dark:` donde aplique.
- Nuevos primitivos UI: vía shadcn (`components.json`) en `src/components/ui/`.
- Páginas: el layout raíz es servidor; los componentes interactivos llevan `'use client'`.
- Next 16: el antiguo `middleware.ts` ahora es `proxy.ts`; 404 con `not-found.tsx`. Ver `.agents/skills/next-best-practices/`.
- Idioma: `lang="es"`; textos de UI en español (rioplatense).

## Comandos

```bash
pnpm dev      # next dev --turbopack
pnpm build
pnpm start
pnpm lint       # ESLint 9 flat config (eslint.config.mjs, eslint-config-next)
pnpm typecheck  # tsc --noEmit
pnpm test       # Vitest (vitest.config.mts), tests en src/**/*.test.ts
pnpm test:watch
```

Antes de dar un cambio por terminado: `pnpm lint && pnpm typecheck && pnpm test`; si toca UI, además probar el flujo en `pnpm dev`.

## Variables de entorno

- La cotización **no** requiere variables: URL fija en `dolarApi.ts`.
- Puede existir un `.env` local (ignorado por git vía `.env*`) con claves para **futuras** integraciones (auth, DB). **No commitear secretos** ni volcar valores reales en documentación o issues. Si se agrega un `.env.example`, hay que excluirlo en `.gitignore` con `!.env.example`.

## Documentación y skills adicionales

- Roadmap y fases (fundación, Clerk, Neon/Prisma, cripto, portfolio): `docs/roadmap.md`.
- Buenas prácticas Next.js: `.agents/skills/next-best-practices/SKILL.md` (instalado desde `vercel-labs/next-skills`, ver `skills-lock.json`).

---

*Mantén este archivo factual respecto al código; si cambian rutas, storage, estructura o integraciones, actualízalo en el mismo PR.*
*No compilar en cada cambio.*
