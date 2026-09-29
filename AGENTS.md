# Contexto del proyecto (agentes de código)

Este archivo orienta a **cualquier asistente de código** (Cursor, Claude, Gemini, Copilot, etc.) sobre el repositorio. No sustituye al README ni a `docs/roadmap.md`; complétalos si necesitas detalle de producto o planificación.

## Resumen

Aplicación web (**Portfolio Tracker**, antes DolarTracker) orientada al mercado argentino, con **dos módulos independientes**:

- **Dólar:** compras y ventas de USD en ARS por tipo de dólar (DolarAPI), métricas en ARS.
- **Cripto:** compras y ventas de cualquier moneda de CoinGecko en USD, métricas en USD y equivalente en ARS con el dólar cripto.

No comparten modelo, store ni formulario; solo piezas puras de `src/domain/` y `src/lib/`, y cripto lee la cotización del dólar cripto de `useDolarStore`. Modo **local-first** con persistencia en el navegador. El store tiene ramas para usuario autenticado + API, pero hoy son **código muerto** (ver "Modo remoto").

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
- Navegación con sidebar (shadcn `ui/sidebar`, colapsable a íconos, drawer en mobile): Inicio, Dólar (`/dolar`, `/dolar/nueva`) y Cripto (`/cripto`, `/cripto/nueva`). `/new-transaction` redirige a `/dolar/nueva` (`next.config.ts`).
- **Módulo cripto** (`src/features/crypto/`):
  - operación = `coinId` (id de CoinGecko), `type`, `quantity`, `priceUsd`, `date`; metadatos de cada moneda (`Coin`) guardados aparte en el store
  - buscador de monedas (`CoinCombobox`, shadcn `command` con `shouldFilter={false}`) contra `/api/crypto/search`
  - posiciones y resumen **derivados** con `useCryptoPortfolio` (no se persisten): costo promedio, PnL realizado/no realizado en USD; valor ARS = valor USD × dólar cripto **compra**
  - precios vía `/api/crypto/prices`, refresco cada 60 s solo mientras `/cripto` está montado (`useCryptoPriceSync`)
  - línea temporal validada por moneda al agregar y borrar (`findNegativeBalance`)
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
| Datos externos   | [DolarAPI](https://dolarapi.com) (`src/services/dolarApi.ts`) — sin API key; [CoinGecko](https://www.coingecko.com/en/api) vía `src/server/coingecko.ts` — key opcional |
| Combobox         | `cmdk` (shadcn `ui/command`)                                                |

**Gestor de paquetes:** `pnpm` (no mezclar con npm/yarn). `pnpm-workspace.yaml` solo habilita los build scripts de `sharp` y `unrs-resolver`.

## Estructura de carpetas

```
src/
├── app/
│   ├── layout.tsx              # server: metadata, fuente, SidebarProvider + AppSidebar, <Toaster>
│   ├── providers.tsx           # client: ThemeProvider + fetch/refresh de cotizaciones
│   ├── page.tsx                # "/" → home: intro + tarjetas de secciones + "cómo funciona"
│   ├── dolar/page.tsx          # "/dolar" → DolarPrice + TransactionList
│   ├── dolar/nueva/page.tsx    # "/dolar/nueva" → NewTransactionForm
│   ├── cripto/page.tsx         # "/cripto" → CryptoPortfolio (resumen, posiciones, historial)
│   ├── cripto/nueva/page.tsx   # "/cripto/nueva" → CryptoTransactionForm
│   ├── api/crypto/{prices,search}/route.ts  # proxy a CoinGecko (valida params, cachea)
│   ├── not-found.tsx           # 404
│   └── globals.css
├── components/                 # piezas de la app (AppSidebar, ThemeSwitch, Stat, DolarPrice,
│   │                           #   TransactionList, NewTransactionForm)
│   └── ui/                     # primitivos shadcn — no meter lógica de negocio aquí
├── hooks/                      # use-mobile (lo usa ui/sidebar), use-mounted (contenido de localStorage)
├── domain/                     # motor financiero puro (sin React ni stores) + __tests__/
│   ├── position.ts             # computePosition: costo promedio genérico (quantity/quoteAmount)
│   ├── metrics.ts              # dólar: computeGroupMetrics, computeTransactionsData, MarketPriceMap
│   └── timeline.ts             # sortTxs, findNegativeBalance, validateTimeline
├── features/crypto/            # módulo cripto completo + __tests__/
│   ├── types.ts, metrics.ts, validations.ts
│   ├── api.ts                  # fetch del navegador a /api/crypto/*
│   ├── crypto.store.ts         # operaciones + monedas (persist `crypto-storage`, v1)
│   ├── prices.store.ts         # último precio por moneda (persist `crypto-prices-storage`, v1)
│   ├── hooks.ts                # useCryptoPriceSync, useCryptoPortfolio
│   └── components/             # CryptoPortfolio, CryptoTransactionList, CryptoTransactionForm,
│                               #   CoinCombobox, CoinIcon
├── server/coingecko.ts         # solo server: cliente CoinGecko + schemas Zod de respuesta
├── lib/
│   ├── locale-amount.ts        # parse/format de montos AR (parseLocaleAmount, formatCurrency…)
│   ├── sections.ts             # secciones/trackers (sidebar + home); nueva sección = nueva entrada
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
- `features/crypto` puede usar `domain`, `lib`, `types`, `components/ui`, `hooks` y leer `useDolarStore` (solo el dólar cripto); el módulo dólar **no** importa nada de `features/crypto`. `server/` solo se importa desde route handlers.
- El navegador nunca llama a CoinGecko directo: siempre vía `/api/crypto/*` (key en el server, Data Cache con `next.revalidate`, respuestas validadas con Zod).
- Arquitectura objetivo (mover dólar a `src/features/dolar`, etc.): ver `docs/roadmap.md`. **No** crearla a medias fuera de la fase correspondiente.

## Comportamiento importante del estado

- **Persistencia:** Zustand `persist` con claves `transactions-storage` y `dolar-storage` (**sin `version`/`migrate`**), y `crypto-storage` / `crypto-prices-storage` (`version: 1`). Cualquier cambio de forma en `Transaction`, `CryptoTransaction`, `Coin`, `DolarOption` o el estado persistido rompe datos de usuarios existentes: añadir o subir `version` + `migrate` en el mismo cambio.
- **Forma de los datos:** `transactions: Partial<Record<DolarOption, Transaction[]>>`, cada grupo ordenado con `sortTxs`. Los montos se guardan como `number`; la fecha, como `Date` serializada a string por `persist` (usar `new Date(tx.date)` al leer).
- **Suscripción:** `useDolarStore.subscribe` (al final de `transaction.store.ts`) re-ejecuta `updateTransactionsData` en cada cambio del dolar store.
- **Cálculos:** el algoritmo vive en `src/domain/position.ts` (`computePosition`, con `dust` según la unidad: 0,0001 para USD, 1e-9 por defecto para cripto) y cada módulo lo adapta. Dólar (`src/domain/metrics.ts`): costo promedio ponderado con compras; cada venta suma `(precio venta − costo promedio) × USD` a la ganancia realizada y reduce la posición; la no realizada usa `MarketPrice.sell` **del mismo tipo de dólar del grupo**. Los precios se inyectan: `updateTransactionsData` arma el `MarketPriceMap` con `selectMarketPrices(useDolarStore.getState())`. Cualquier cambio en la matemática va acompañado de tests en `src/domain/__tests__/`.
- **Modo remoto (código muerto):** si `isSignedIn` es `true`, el store hace `POST /api/transactions` y `DELETE /api/transactions/:id`. Los call sites pasan `isSignedIn: false` hardcodeado, no existe `GET` ni esas rutas, y un `!res.ok` hace `return` sin error. No extender esta rama; se reconstruye en las Fases 1–3.

## Convenciones de desarrollo

- Componentes funcionales con tipos explícitos para props.
- Formularios: React Hook Form + esquemas Zod en `src/validations/`; los montos se validan como string y se convierten con `parseTransactionFormInput`.
- Formato de números en UI: `formatCurrency` (`es-AR`); no usar `toFixed` para mostrar.
- Errores de negocio: el store lanza `Error` con mensaje en español; el componente lo muestra con `toast.error`.
- Estilos: utilidades Tailwind + `cn()`; variantes `dark:` donde aplique. Estética minimalista: tokens de shadcn (`bg-card`, `border`, `text-muted-foreground`) en vez de `gray-*`/`slate-*`, sin sombras ni gradientes; color solo como señal (PnL, compra/venta).
- `shadcn add` puede reescribir el import de `cn` a un paquete npm `cn`: verificar que quede `@/lib/utils` y no agregar esa dependencia.
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

- La cotización del dólar **no** requiere variables: URL fija en `dolarApi.ts`.
- `COINGECKO_API_KEY` (opcional, clave Demo, header `x-cg-demo-api-key`): sin ella se usa la API pública con menor rate limit. Documentada en `.env.example` (excluido del ignore con `!.env.example`).
- Puede existir un `.env` local (ignorado por git vía `.env*`) con claves para **futuras** integraciones (auth, DB). **No commitear secretos** ni volcar valores reales en documentación o issues. Si se agrega un `.env.example`, hay que excluirlo en `.gitignore` con `!.env.example`.

## Documentación y skills adicionales

- Roadmap y fases (fundación, Clerk, Neon/Prisma, cripto, portfolio): `docs/roadmap.md`.
- Buenas prácticas Next.js: `.agents/skills/next-best-practices/SKILL.md` (instalado desde `vercel-labs/next-skills`, ver `skills-lock.json`).

---

*Mantén este archivo factual respecto al código; si cambian rutas, storage, estructura o integraciones, actualízalo en el mismo PR.*
*No compilar en cada cambio.*
