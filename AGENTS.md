# Contexto del proyecto (agentes de código)

Este archivo orienta a **cualquier asistente de código** (Cursor, Claude, Gemini, Copilot, etc.) sobre el repositorio. No sustituye al README ni a `docs/roadmap.md`; complétalos si necesitas detalle de producto o planificación.

## Resumen

Aplicación web (**Portfolio Tracker**, antes DolarTracker) orientada al mercado argentino, con **dos módulos independientes**:

- **Dólar:** compras y ventas de USD en ARS por tipo de dólar (DolarAPI), métricas en ARS.
- **Cripto:** compras y ventas de cualquier moneda de CoinGecko en USD, métricas en USD y equivalente en ARS con el dólar cripto.

No comparten modelo, store ni formulario; solo piezas puras de `src/domain/` y `src/lib/`, y cripto lee la cotización del dólar cripto de `useDolarStore`. Modo **local-first** con persistencia en el navegador; el login (Clerk) existe pero todavía no sincroniza datos (ver "Modo remoto").

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
- Historial agrupado por tipo de dólar, con tabla (fecha, operación, montos, tipo de cambio), edición en diálogo (`EditTransactionDialog`) y borrado con confirmación.
- Edición de transacciones en ambos módulos (`updateTransaction`): conserva el `id`, revalida el grupo destino y, si cambió el tipo de dólar / la moneda, también el de origen. El formulario es compartido entre alta y edición (`TransactionForm`, `CryptoTransactionForm`); las páginas de alta los envuelven (`NewTransactionForm`, `NewCryptoTransaction`).
- Métricas **por tipo de dólar**, derivadas con `useTransactionsData()` (`TransactionsDataMap`, no se persisten):
  `totalUsd`, `investedPesos`, `averageCost`, `marketValuePesos`, `realizedProfit`, `unrealizedProfit`; más un total (`summarizeTransactionsData`) cuando hay más de un tipo de dólar.
- Cotizaciones DolarAPI: carga inicial y refresco cada 5 min en `providers.tsx`; recálculo automático de métricas al llegar nuevas cotizaciones.
- Tarjetas de cotizaciones destacadas (`DolarPrice`): oficial, blue, bolsa, cripto.
- Navegación con sidebar (shadcn `ui/sidebar`, colapsable a íconos, drawer en mobile): Inicio, Dólar (`/dolar`, `/dolar/nueva`) y Cripto (`/cripto`, `/cripto/nueva`). `/new-transaction` redirige a `/dolar/nueva` (`next.config.ts`).
- **Módulo cripto** (`src/features/crypto/`):
  - operación = `coinId` (id de CoinGecko), `type`, `quantity`, `priceUsd`, `date`, `fee?` (`{ amount, currency: 'USD' | 'COIN' }`) y `swapId?`; metadatos de cada moneda (`Coin`) guardados aparte en el store
  - comisiones: `toPositionLot` (`metrics.ts`) las aplica al lote del motor y al saldo de la línea temporal (en USD ajustan el monto; en la moneda, las unidades)
  - intercambios cripto ↔ cripto (`addSwap`): venta + compra enlazadas por `swapId`, precio de cada pata = valor USD / cantidad; se borran juntas y no se editan
  - detalle por moneda en `/cripto/[coinId]` (`CryptoCoinDetail`); `CryptoTransactionList` acepta `coinId` para filtrar
  - buscador de monedas (`CoinCombobox`, shadcn `command` con `shouldFilter={false}`) contra `/api/crypto/search`
  - posiciones y resumen **derivados** con `useCryptoPortfolio` (no se persisten): costo promedio, PnL realizado/no realizado en USD; valor ARS = valor USD × dólar cripto **compra**
  - precios vía `/api/crypto/prices`, refresco cada 60 s solo mientras `/cripto` está montado (`useCryptoPriceSync`); ante fallos (p. ej. 429) backoff exponencial hasta 10 min (`refresh.ts`)
  - línea temporal validada por moneda al agregar, editar y borrar (`findNegativeBalance`)
- Tema claro/oscuro/sistema (`next-themes`), toasts (Sonner), UI en español.
- Aviso "Modo local" en la barra superior (`LocalModeBadge`, con tooltip; con sesión aclara que todavía no hay sync).
- **Login con Clerk** (Fase 1): `<ClerkProvider>` en el layout (localización `esUY`, colores vía variables CSS de shadcn), `src/proxy.ts` con `clerkMiddleware` (protege solo las futuras rutas `/api/dolar/*` y `/api/crypto/transactions*`), `UserMenu` en el pie del sidebar. Clerk v7 (Core 3): usar `<Show when='signed-in'>`, no `SignedIn`/`SignedOut`. La sesión **no** cambia la persistencia: todo sigue en `localStorage`.

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
| Auth             | Clerk (`@clerk/nextjs` 7, `@clerk/localizations`)                           |

**Gestor de paquetes:** `pnpm` (no mezclar con npm/yarn). `pnpm-workspace.yaml` solo habilita los build scripts de `sharp` y `unrs-resolver`.

## Estructura de carpetas

```
src/
├── app/
│   ├── layout.tsx              # server: metadata, fuente, ClerkProvider, SidebarProvider + AppSidebar, <Toaster>
│   ├── providers.tsx           # client: ThemeProvider + fetch/refresh de cotizaciones
│   ├── page.tsx                # "/" → home: intro + tarjetas de secciones + "cómo funciona"
│   ├── dolar/page.tsx          # "/dolar" → DolarPrice + TransactionList
│   ├── dolar/nueva/page.tsx    # "/dolar/nueva" → NewTransactionForm
│   ├── cripto/page.tsx         # "/cripto" → CryptoPortfolio (resumen, posiciones, historial)
│   ├── cripto/nueva/page.tsx   # "/cripto/nueva" → NewCryptoTransaction (compra/venta o intercambio)
│   ├── cripto/[coinId]/page.tsx # "/cripto/:coinId" → CryptoCoinDetail
│   ├── api/crypto/{prices,search}/route.ts  # proxy a CoinGecko (valida params, cachea)
│   ├── not-found.tsx           # 404
│   └── globals.css
├── components/                 # piezas de la app (AppSidebar, UserMenu, ThemeSwitch, LocalModeBadge, Stat,
│   │                           #   DolarPrice, TransactionList, TransactionForm,
│   │                           #   NewTransactionForm, EditTransactionDialog)
│   └── ui/                     # primitivos shadcn — no meter lógica de negocio aquí
├── hooks/                      # use-mobile (lo usa ui/sidebar), use-mounted (contenido de localStorage)
├── domain/                     # motor financiero puro (sin React ni stores) + __tests__/
│   ├── position.ts             # computePosition: costo promedio genérico (quantity/quoteAmount)
│   ├── metrics.ts              # dólar: computeGroupMetrics, computeTransactionsData, MarketPriceMap
│   └── timeline.ts             # sortTxs, findNegativeBalance, validateTimeline
├── features/crypto/            # módulo cripto completo + __tests__/
│   ├── types.ts, metrics.ts, validations.ts, refresh.ts (backoff de precios)
│   ├── api.ts                  # fetch del navegador a /api/crypto/*
│   ├── crypto.store.ts         # operaciones + monedas + intercambios (persist `crypto-storage`, v2)
│   ├── prices.store.ts         # último precio por moneda (persist `crypto-prices-storage`, v1)
│   ├── hooks.ts                # useCryptoPriceSync, useCryptoPortfolio
│   └── components/             # CryptoPortfolio, CryptoCoinDetail, CryptoTransactionList,
│                               #   CryptoTransactionForm, CryptoSwapForm, NewCryptoTransaction,
│                               #   EditCryptoTransactionDialog, CoinCombobox, CoinIcon
├── proxy.ts                    # clerkMiddleware (Next 16: ex middleware.ts)
├── server/coingecko.ts         # solo server: cliente CoinGecko + schemas Zod de respuesta
├── lib/
│   ├── locale-amount.ts        # parse/format de montos AR (parseLocaleAmount, formatCurrency…)
│   ├── sections.ts             # secciones/trackers (sidebar + home); nueva sección = nueva entrada
│   └── utils.ts                # cn()
├── services/dolarApi.ts        # cliente HTTP DolarAPI
├── store/
│   ├── transaction.store.ts    # transacciones + persist v1 + useTransactionsData; cálculos en domain/
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

- **Persistencia:** Zustand `persist` con claves `transactions-storage`, `dolar-storage`, `crypto-storage` (v2: `fee`/`swapId` opcionales, `migrateCryptoStorage`) y `crypto-prices-storage`, el resto en `version: 1`, todas con `partialize` (solo datos, nunca métricas derivadas). Ojo: si se sube `version` sin `migrate`, Zustand **descarta** lo guardado. `migrateTransactionsStorage` (v0 → v1) tiene test con un snapshot real. Cualquier cambio de forma en `Transaction`, `CryptoTransaction`, `Coin`, `DolarOption` o el estado persistido rompe datos de usuarios existentes: añadir o subir `version` + `migrate` en el mismo cambio.
- **Forma de los datos:** `transactions: Partial<Record<DolarOption, Transaction[]>>`, cada grupo ordenado con `sortTxs`. Los montos se guardan como `number`; la fecha, como `Date` serializada a string por `persist` (usar `new Date(tx.date)` al leer).
- **Métricas derivadas:** no hay suscripción entre stores. `useTransactionsData` (dólar) y `useCryptoPortfolio` (cripto) recalculan con `useMemo` cuando cambian las transacciones o los precios. No volver a guardar métricas en el estado.
- **Cálculos:** el algoritmo vive en `src/domain/position.ts` (`computePosition`, con `dust` según la unidad: 0,0001 para USD, 1e-9 por defecto para cripto) y cada módulo lo adapta. Dólar (`src/domain/metrics.ts`): costo promedio ponderado con compras; cada venta suma `(precio venta − costo promedio) × USD` a la ganancia realizada y reduce la posición; la no realizada usa `MarketPrice.sell` **del mismo tipo de dólar del grupo**. Los precios se inyectan: `useTransactionsData` arma el `MarketPriceMap` con `selectMarketPrices({ allDolarData })`. Cualquier cambio en la matemática va acompañado de tests en `src/domain/__tests__/`.
- **Modo remoto:** todavía no existe. La vieja rama `isSignedIn` del store del dólar (fetch a endpoints inexistentes con fallos silenciosos) se eliminó en la Fase 1; los stores son locales y síncronos. La Fase 2 agrega un repositorio `list/create/update/remove` por módulo, sin volver a meter `fetch` dentro de cada acción.

## Convenciones de desarrollo

- Componentes funcionales con tipos explícitos para props.
- Formularios: React Hook Form + esquemas Zod en `src/validations/`; los montos se validan como string y se convierten con `parseTransactionFormInput`.
  - Con Radix `Select`, `<FormControl>` envuelve el `SelectTrigger`, no el `Select` (el root no renderiza DOM y el label quedaría sin asociar).
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

CI (`.github/workflows/ci.yml`) corre lint, typecheck, test y build en cada PR y push a `main` (pnpm 12, Node 24). Antes de dar un cambio por terminado: `pnpm lint && pnpm typecheck && pnpm test`; si toca UI, además probar el flujo en `pnpm dev`.

## Variables de entorno

- La cotización del dólar **no** requiere variables: URL fija en `dolarApi.ts`.
- `COINGECKO_API_KEY` (opcional, clave Demo, header `x-cg-demo-api-key`): sin ella se usa la API pública con menor rate limit. Documentada en `.env.example` (excluido del ignore con `!.env.example`).
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY` (claves de test de Clerk) en `.env`, documentadas en `.env.example`. Sin ellas, `next dev` usa el keyless mode de Clerk (carpeta `.clerk/`, ignorada) y `next build` igual compila (CI no tiene secretos).
- El `.env` local (ignorado por git vía `.env*`) puede tener claves para **futuras** integraciones (DB). **No commitear secretos** ni volcar valores reales en documentación o issues. Si se agrega un `.env.example`, hay que excluirlo en `.gitignore` con `!.env.example`.

## Documentación y skills adicionales

- Roadmap y fases (fundación, Clerk, Neon/Prisma, cripto, portfolio): `docs/roadmap.md`.
- Buenas prácticas Next.js: `.agents/skills/next-best-practices/SKILL.md` (instalado desde `vercel-labs/next-skills`, ver `skills-lock.json`).

---

*Mantén este archivo factual respecto al código; si cambian rutas, storage, estructura o integraciones, actualízalo en el mismo PR.*
*No compilar en cada cambio.*
