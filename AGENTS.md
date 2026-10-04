# Contexto del proyecto (agentes de código)

Este archivo orienta a **cualquier asistente de código** (Cursor, Claude, Gemini, Copilot, etc.) sobre el repositorio. No sustituye al README ni a `docs/roadmap.md` / `docs/historial.md`; complétalos si necesitas detalle de producto o planificación.

## Resumen

Aplicación web (**Portfolio Tracker**, antes DolarTracker) orientada al mercado argentino, con **dos módulos independientes**:

- **Dólar:** compras y ventas de USD en ARS por tipo de dólar (DolarAPI), métricas en ARS.
- **Cripto:** compras y ventas de cualquier moneda de CoinGecko en USD, métricas en USD y equivalente en ARS con el dólar cripto.

No comparten modelo, store ni formulario; solo piezas puras de `src/domain/` y `src/lib/`, y cripto lee la cotización del dólar cripto de `useDolarStore`. Sin sesión, modo **local-first** con persistencia en el navegador; con sesión (Clerk), los datos activos vienen de la nube (Neon + Prisma vía API) y lo local queda guardado aparte; al iniciar sesión se ofrece subirlo (ver "Modo remoto" y "Sincronización").

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
- Cotizaciones DolarAPI: carga inicial y refresco cada 5 min en `providers.tsx`; si falla (timeout de 10 s, red caída, API caída) reintenta con backoff 30 s → 1 → 2 → 4 min (`dolarRefreshDelay`) y enseguida al volver la conexión (`online`), con toast distinto para "sin conexión" y "DolarAPI no responde" y las últimas cotizaciones guardadas como fallback. Recálculo automático de métricas al llegar nuevas cotizaciones.
- Tarjetas de cotizaciones destacadas (`DolarPrice`): oficial, blue, bolsa, cripto.
- **Dashboard del portfolio** (Fase 5, `src/features/portfolio/`): la home (`/`) muestra, si hay operaciones, valor total (ARS y USD), resumen por módulo (dólar en ARS, cripto en USD, cada uno con su ganancia), composición por activo (barra apilada al 100 % + tabla con 24 h y drill-down a `/dolar` o `/cripto/[coinId]`) y las cotizaciones; sin operaciones, la presentación. La composición se mide en **USD** (no depende de cotizaciones en pesos); los valores en ARS usan la cotización de cada tipo de dólar y el dólar cripto compra. Cálculo puro en `overview.ts` (`computePortfolioOverview`, `toAllocationSegments`). **Evolución del valor** (`ValueChart`, recharts): reconstruida, no guardada — por día, lo que se tenía según las transacciones × el precio de ese día (`history.ts`, `computeValueHistory`; sin precio → `null`, nunca inventado); hoy se valúa con los precios en vivo para que la serie cierre con el total. Rangos 1M/3M/6M/1A (CoinGecko público no da más de 365 días), ARS o USD (un solo eje).
- Navegación con sidebar (shadcn `ui/sidebar`, colapsable a íconos, drawer en mobile): Inicio, Dólar (`/dolar`, `/dolar/nueva`) y Cripto (`/cripto`, `/cripto/nueva`). `/new-transaction` redirige a `/dolar/nueva` (`next.config.ts`).
- **Módulo cripto** (`src/features/crypto/`):
  - operación = `coinId` (id de CoinGecko), `type`, `quantity`, `priceUsd`, `date`, `fee?` (`{ amount, currency: 'USD' | 'COIN' }`) y `swapId?`; metadatos de cada moneda (`Coin`) guardados aparte en el store
  - comisiones: `toPositionLot` (`metrics.ts`) las aplica al lote del motor y al saldo de la línea temporal (en USD ajustan el monto; en la moneda, las unidades)
  - intercambios cripto ↔ cripto (`addSwap`): venta + compra enlazadas por `swapId`, precio de cada pata = valor USD / cantidad; se borran juntas y no se editan
- **Intercambios USDT ↔ cripto** (Fase 7a, `src/features/usdt-swaps/`): el grupo `cripto` del módulo Dólar **es** el saldo de USDT (no se usa `tether` del módulo Cripto, que se rechaza). Un intercambio son dos operaciones enlazadas por `usdtSwapId`: una del dólar (grupo `cripto`, pesos = USDT × cotización del dólar cripto: compra si se entregan, venta si se reciben, autocompletada con DolarAPI o `/api/history/dolar`) y una del módulo cripto (precio = USDT / cantidad). Comisión en USDT (se integra al monto de la pata dólar) o en la moneda. Se borran juntas (`applyRemoveUsdtSwap` revalida las dos líneas) y ninguna pata se edita ni se borra sola (las funciones de cada módulo lo rechazan). Formulario único `SwapForm` (cripto ↔ cripto o con "USDT · Dólar cripto", opción fija del `CoinCombobox`) en la pestaña Intercambio de `/cripto/nueva`; atajo "Intercambiar USDT" en `/dolar` (`?modo=intercambio&desde=usdt`).
- **Resultados de trades** (Fase 7b): operación con `kind: 'TRADE_RESULT'` y `note?` (futuros, margin, bots) que reusa `type` (`BUY` = ganancia, `SELL` = pérdida). En USDT va al grupo `cripto` del dólar (`TradeResultForm`, pesos = USDT × dólar cripto del día); en otra moneda, al módulo cripto (`CryptoTradeResultForm`, precio del día). Se guarda el valor de mercado; el lote del motor (`toDolarLot`, `toPositionLot`) hace que la ganancia entre a ese costo y lo **realice** (`PositionLot.realizedProfit`) y que la pérdida salga por 0 (realiza `−costo promedio × cantidad`). `tradeProfit` / `tradePnlUsd` informan esa parte del realizado. Sin comisión ni enlaces de intercambio (`assertDolarShape`, `assertCryptoShape`); se editan con su propio form. Alta en la pestaña "Resultado de trade" de `/cripto/nueva` (`?modo=resultado`, `NewTradeResult`). El texto de cada fila sale de `operationLabel` (`src/lib/operation-label.ts`). En la UI, el `invested` del motor se rotula **"Costo"** (es el costo base de la posición, no lo aportado).
  - detalle por moneda en `/cripto/[coinId]` (`CryptoCoinDetail`); `CryptoTransactionList` acepta `coinId` para filtrar
  - buscador de monedas (`CoinCombobox`, shadcn `command` con `shouldFilter={false}`) contra `/api/crypto/search`
  - posiciones y resumen **derivados** con `useCryptoPortfolio` (no se persisten): costo promedio, PnL realizado/no realizado en USD; valor ARS = valor USD × dólar cripto **compra**
  - precios vía `/api/crypto/prices`, refresco cada 60 s solo mientras `/cripto` está montado (`useCryptoPriceSync`); ante fallos (p. ej. 429) backoff exponencial hasta 10 min (`refresh.ts`)
  - línea temporal validada por moneda al agregar, editar y borrar (`findNegativeBalance`)
- **API de datos** (Fase 2): CRUD protegido por módulo en `/api/dolar/transactions[/:id]`, `/api/crypto/transactions[/:id]` y `/api/crypto/swaps`, más `POST /api/usdt-swaps` y `DELETE /api/usdt-swaps/:usdtSwapId` (escriben las dos tablas en una sola transacción). Cada handler: `requireUserId()` (401 sin sesión) → body validado con Zod (400) → servicio en `src/server/` que filtra por `userId` (operación ajena = 404), valida la línea temporal con las **mismas funciones puras que los stores** (422 con el mismo mensaje) y escribe en una transacción `Serializable` (conflicto = 409). Los ids los genera el cliente (`crypto.randomUUID()`); id repetido = 409.
- Tema claro/oscuro/sistema (`next-themes`), toasts (Sonner), UI en español.
- **Logs del server** (`src/server/log.ts`): una línea JSON por evento (`logEvent`, `logError`), sin servicio externo. Los route handlers registran las escrituras OK (`dolar.*`, `crypto.*`, `usdtSwap.*`, `sync.imported`); `errorResponse` registra los 500 (`api.unexpected`) y `src/instrumentation.ts` (`onRequestError`) el resto (`request.error`). Nunca loguear montos, headers ni cookies. Operación en producción: `docs/operacion.md`.
- **Sincronización** (Fase 3, `src/features/auth/`): `SyncBadge` en la barra superior (Modo local / Cargando… / Guardando… / Sincronizado / Sin conexión, con popover para reintentar o subir lo local); `LocalImportDialog` ofrece subir las operaciones locales que no están en la cuenta al iniciar sesión (`POST /api/sync/import`, idempotente por id, **la nube manda**: un id existente se saltea). "Ahora no" guarda esos ids por usuario en `sync-storage` para no volver a preguntar; igual se pueden subir desde el badge.
- **Login con Clerk** (Fase 1): `<ClerkProvider>` en el layout (localización `esUY`, colores vía variables CSS de shadcn), `src/proxy.ts` con `clerkMiddleware()` sin protección por ruta (las futuras rutas de datos chequean `auth()` en cada handler; `createRouteMatcher` está deprecado), `UserMenu` en el pie del sidebar. Clerk v7 (Core 3): usar `<Show when='signed-in'>`, no `SignedIn`/`SignedOut`. La sesión elige el origen de datos de los stores (`src/features/auth/CloudSync.tsx`).

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
| Datos externos   | [DolarAPI](https://dolarapi.com) (`src/services/dolarApi.ts`) — sin API key; [CoinGecko](https://www.coingecko.com/en/api) vía `src/server/coingecko.ts` — key opcional; [ArgentinaDatos](https://argentinadatos.com) (histórico del dólar) vía `src/server/argentinadatos.ts` — sin key |
| Combobox         | `cmdk` (shadcn `ui/command`)                                                |
| Gráficos         | `recharts` 3 (+ `react-is` 19, que pide con React 19)                        |
| Tests            | Vitest (unit, `src/**/*.test.ts`) + Playwright (E2E, `e2e/`)                 |
| Auth             | Clerk (`@clerk/nextjs` 7, `@clerk/localizations`; `@clerk/testing` en los E2E) |
| Base de datos    | Neon (Postgres) + Prisma 7 (`prisma-client`, `@prisma/adapter-neon`, `prisma.config.ts`) |

**Gestor de paquetes:** `pnpm` (no mezclar con npm/yarn). `pnpm-workspace.yaml` habilita los build scripts de `sharp`, `unrs-resolver`, `prisma` y `@prisma/engines`. `postinstall` corre `prisma generate` (el cliente en `src/generated/prisma` está ignorado por git y por ESLint).

## Estructura de carpetas

```
prisma/
├── schema.prisma               # User, DolarTransaction, CryptoTransaction (montos Decimal, ids UUID del cliente)
└── migrations/                 # SQL versionado; aplicar con `pnpm db:deploy`
prisma.config.ts                # Prisma 7: schema, migraciones y URL (DIRECT_URL ?? DATABASE_URL) para el CLI
scripts/vercel-build.mjs        # build de Vercel: `prisma migrate deploy` solo en producción + `next build`
e2e/                            # Playwright: fixtures.ts (APIs externas simuladas, datos sembrados), cloud.ts
                                #   (usuario de prueba de Clerk, limpieza en Neon) + specs (`*.cloud.spec.ts` = con sesión)
playwright.config.ts            # puerto 3100 (`E2E_PORT` para reusar un server abierto), `next dev` directo;
                                #   proyectos `local` y `cloud`; carga `.env`
src/
├── app/
│   ├── layout.tsx              # server: metadata, fuente, ClerkProvider, SidebarProvider + AppSidebar, <Toaster>
│   ├── providers.tsx           # client: ThemeProvider + CloudSync + fetch/refresh de cotizaciones
│   ├── page.tsx                # "/" → home: PortfolioDashboard (o presentación sin datos) + trackers
│   ├── dolar/page.tsx          # "/dolar" → DolarPrice + TransactionList
│   ├── dolar/nueva/page.tsx    # "/dolar/nueva" → NewTransactionForm
│   ├── cripto/page.tsx         # "/cripto" → CryptoPortfolio (resumen, posiciones, historial)
│   ├── cripto/nueva/page.tsx   # "/cripto/nueva" → NewCryptoTransaction (compra/venta o intercambio)
│   ├── cripto/[coinId]/page.tsx # "/cripto/:coinId" → CryptoCoinDetail
│   ├── api/crypto/{prices,search}/route.ts  # proxy a CoinGecko (valida params, cachea)
│   ├── api/dolar/transactions/[id]/         # CRUD del dólar (GET/POST, PATCH/DELETE)
│   ├── api/crypto/{transactions/[id],swaps}/ # CRUD cripto + alta de intercambios
│   ├── api/usdt-swaps/[id]/    # intercambios USDT ↔ cripto (POST, DELETE): las dos tablas a la vez
│   ├── api/sync/import/route.ts # subida de datos locales (dólar + cripto) a la cuenta
│   ├── api/history/{dolar,crypto}/route.ts # precios diarios del último año (ArgentinaDatos / CoinGecko, cache 6 h)
│   ├── not-found.tsx           # 404
│   └── globals.css
├── components/                 # piezas de la app (AppSidebar, UserMenu, ThemeSwitch, Stat, SyncGate,
│   │                           #   DolarPrice, TransactionList, TransactionForm, TradeResultForm (USDT),
│   │                           #   NewTransactionForm, EditTransactionDialog)
│   └── ui/                     # primitivos shadcn — no meter lógica de negocio aquí
├── hooks/                      # use-mobile (lo usa ui/sidebar), use-mounted (contenido de localStorage),
│                               #   use-usdt-swap-links (contexto: las listas borran/describen intercambios USDT),
│                               #   use-dolar-cripto-rate (cotización del dólar cripto de un día)
├── domain/                     # motor financiero puro (sin React ni stores) + __tests__/
│   ├── position.ts             # computePosition: costo promedio genérico (quantity/quoteAmount)
│   ├── metrics.ts              # dólar: computeGroupMetrics, computeTransactionsData, MarketPriceMap
│   ├── timeline.ts             # sortTxs, findNegativeBalance, validateTimeline
│   └── transactions.ts         # dólar: applyAdd/Update/RemoveTransaction, groupTransactions (store + server)
├── features/auth/              # sincronización local ↔ nube (Fase 3) + __tests__/
│   ├── CloudSync.tsx           # sesión de Clerk → connectCloud/disconnectCloud de los stores
│   ├── local-import.ts         # puro: localNotInCloud, excludeIds, toImportPayload (ids no UUID → UUID)
│   ├── sync.store.ts           # ids ya ofrecidos por usuario (persist `sync-storage`, v1)
│   ├── api.ts, hooks.ts        # importLocalData; useCloudStatus, useLocalImport
│   └── components/             # SyncBadge, LocalImportDialog, describe (textos)
├── features/portfolio/         # dashboard unificado (Fase 5) + __tests__/
│   ├── overview.ts             # puro: computePortfolioOverview, toAllocationSegments
│   ├── history.ts              # puro: computeValueHistory, priceAt (relleno), trimLeadingGaps
│   ├── history.store.ts        # cache de sesión de los precios históricos (sin persist)
│   ├── hooks.ts                # usePortfolioOverview, useValueHistory
│   └── components/             # PortfolioDashboard, ValueChart, AllocationBar, AssetTable, colors
├── features/usdt-swaps/        # USDT del dólar cripto ↔ cripto: intercambios (7a) y alta de resultados de trades (7b)
│   ├── operations.ts           # puro (store + server): buildUsdtSwapLegs, applyAdd/RemoveUsdtSwap, assertUsdtSwapsComplete
│   ├── validations.ts          # usdtSwapApiSchema (API) y swapFormSchema (form)
│   ├── usdt-option.ts          # USDT_COIN y useUsdtPinned (opción fija "Dólar cripto · USDT" del CoinCombobox)
│   ├── actions.ts, api.ts      # addUsdtSwap/removeUsdtSwap: los dos stores (`applyExternal`) con un solo request
│   └── components/             # SwapForm (cripto ↔ cripto y USDT ↔ cripto), NewTradeResult, UsdtSwapLinksProvider
├── features/crypto/            # módulo cripto completo + __tests__/
│   ├── types.ts, metrics.ts, validations.ts, refresh.ts (backoff de precios)
│   ├── api.ts                  # fetch del navegador a /api/crypto/* (precios, búsqueda, cryptoApi CRUD)
│   ├── operations.ts           # applyAdd/Update/RemoveCryptoTransaction, applyAddSwap (store + server)
│   ├── crypto.store.ts         # operaciones + monedas + intercambios (persist `crypto-storage`, v3)
│   ├── prices.store.ts         # último precio por moneda (persist `crypto-prices-storage`, v1)
│   ├── hooks.ts                # useCryptoPriceSync, useCryptoPortfolio
│   └── components/             # CryptoPortfolio, CryptoCoinDetail, CryptoTransactionList,
│                               #   CryptoTransactionForm, CryptoTradeResultForm,
│                               #   NewCryptoTransaction (recibe `swapForm` y `tradeResultForm`),
│                               #   EditCryptoTransactionDialog, CoinCombobox, CoinIcon
├── instrumentation.ts          # onRequestError → logError (errores del server fuera de /api/*)
├── proxy.ts                    # clerkMiddleware (Next 16: ex middleware.ts)
├── server/                     # solo server (route handlers) + __tests__/ (API con base en memoria)
│   ├── coingecko.ts            # cliente CoinGecko + schemas Zod de respuesta (incluye getCoinHistory)
│   ├── argentinadatos.ts       # cotizaciones históricas del dólar (sin API key)
│   ├── db.ts                   # getDb (PrismaClient + PrismaNeon, lazy), withUserTransaction
│   ├── auth.ts, errors.ts      # requireUserId; ApiError, parseBody, parseIdParam, errorResponse
│   ├── log.ts                  # logEvent / logError (JSON a stdout, lo guarda Vercel)
│   ├── import.ts               # importSchema + importLocalData (la nube manda, skipDuplicates)
│   ├── mappers.ts              # única conversión fila Prisma (Decimal) ↔ modelo de dominio (number)
│   └── {dolar,crypto}-transactions.ts  # servicios con ownership + validación de línea temporal
├── lib/
│   ├── locale-amount.ts        # parse/format de montos AR (parseLocaleAmount, formatCurrency…)
│   ├── sections.ts             # secciones/trackers (sidebar + home); nueva sección = nueva entrada
│   ├── http.ts                 # requestJson + ApiRequestError (fetch a /api/* con el mensaje del server)
│   ├── synced-store.ts         # origen local/nube de un store: createSync (commit optimista), localData
│   ├── backoff.ts              # exponentialBackoff (lo usan dólar y cripto)
│   ├── operation-label.ts      # texto de cada fila: Compra / Venta / Ganancia o Pérdida de trade
│   └── utils.ts                # cn()
├── services/                   # dolarApi.ts (DolarAPI), transactionsApi.ts (/api/dolar/transactions),
│                               #   dolarHistory.ts (rateOn: cotización del día o la anterior, fetchCriptoHistory)
├── store/
│   ├── transaction.store.ts    # transacciones + persist v1 + useTransactionsData; cálculos en domain/
│   ├── dolar.store.ts          # allDolarData + persist; selectMarketPrices → MarketPriceMap
│   └── dolar-refresh.ts        # dolarRefreshDelay (5 min; backoff tras fallos)
├── types/                      # dolar.types.ts (DolarOption, DolarData), transaction.types.ts
└── validations/transaction.ts  # schema Zod del formulario + parseTransactionFormInput + schemas de la API
```

- Alias: `@/*` → `src/*` (ver `tsconfig.json`).
- Dirección de dependencias: `components → store → (domain, services, lib, types)`; `domain → types` únicamente. `domain`, `validations` y `types` **nunca** importan stores ni React. `types/transaction.types.ts` define el modelo de dominio y no importa `validations`.
- `features/crypto` puede usar `domain`, `lib`, `types`, `components/ui`, `hooks` y leer `useDolarStore` (solo el dólar cripto); el módulo dólar **no** importa nada de `features/crypto`. `features/auth` (sincronización), `features/portfolio` (dashboard) y `features/usdt-swaps` (intercambios USDT) componen los dos módulos: pueden leer sus stores, hooks y componentes, y ningún módulo los importa (solo `app/`). Cuando un módulo necesita algo de un composer, lo recibe por un contexto neutro de `src/hooks/` (ej. `useUsdtSwapLinks`, provisto en `app/providers.tsx`) o por props desde `app/` (ej. `swapForm`). `server/` solo se importa desde route handlers (y puede usar `domain`, `types`, `validations` y las piezas puras de `features/crypto` — `operations`, `metrics`, `types` — y de `features/usdt-swaps` — `operations`, `validations`).
- El navegador nunca llama a CoinGecko directo: siempre vía `/api/crypto/*` (key en el server, Data Cache con `next.revalidate`, respuestas validadas con Zod).
- Mover el dólar a `src/features/dolar` no tiene fase asignada (deuda técnica en `docs/roadmap.md`): **no** hacerlo a medias; si se decide, se planifica como fase propia.

## Comportamiento importante del estado

- **Persistencia:** Zustand `persist` con claves `dolar-storage`, `transactions-storage` (v3: `usdtSwapId`, `kind`, `note` opcionales), `crypto-storage` (v4: `fee`/`swapId`/`usdtSwapId`/`kind`/`note` opcionales, `migrateCryptoStorage`), `crypto-prices-storage` y `sync-storage`, el resto en `version: 1`, todas con `partialize` (solo datos, nunca métricas derivadas). Ojo: si se sube `version` sin `migrate`, Zustand **descarta** lo guardado. `migrateTransactionsStorage` y `migrateCryptoStorage` tienen tests con snapshots reales de cada versión. Cualquier cambio de forma en `Transaction`, `CryptoTransaction`, `Coin`, `DolarOption` o el estado persistido rompe datos de usuarios existentes: añadir o subir `version` + `migrate` en el mismo cambio.
- **Forma de los datos:** `transactions: Partial<Record<DolarOption, Transaction[]>>`, cada grupo ordenado con `sortTxs`. Los montos se guardan como `number`; la fecha, como `Date` serializada a string por `persist` (usar `new Date(tx.date)` al leer).
- **Métricas derivadas:** no hay suscripción entre stores. `useTransactionsData` (dólar) y `useCryptoPortfolio` (cripto) recalculan con `useMemo` cuando cambian las transacciones o los precios. No volver a guardar métricas en el estado.
- **Cálculos:** el algoritmo vive en `src/domain/position.ts` (`computePosition`, con `dust` según la unidad: 0,0001 para USD, 1e-9 por defecto para cripto) y cada módulo lo adapta. Dólar (`src/domain/metrics.ts`): costo promedio ponderado con compras; cada venta suma `(precio venta − costo promedio) × USD` a la ganancia realizada y reduce la posición; la no realizada usa `MarketPrice.sell` **del mismo tipo de dólar del grupo**. Los precios se inyectan: `useTransactionsData` arma el `MarketPriceMap` con `selectMarketPrices({ allDolarData })`. Cualquier cambio en la matemática va acompañado de tests en `src/domain/__tests__/`.
- **Modo remoto** (`src/lib/synced-store.ts`): cada store tiene `source` (`local` | `cloud`), `status`, `pendingWrites` (escrituras en curso, para "Guardando…") (`pending` hasta que se resuelve la sesión, `loading`, `ready`, `error`). `CloudSync` llama a `connectCloud()` con sesión (guarda lo local en `localSnapshot` y carga `GET /api/...`) y a `disconnectCloud()` sin sesión (vuelve lo local); si Clerk no carga en 4 s, pasa a local. `partialize` (`persistedTransactions`, `persistedCrypto`) **siempre** persiste lo local: la nube nunca se escribe en `localStorage`. Las acciones son `async`: validan con las funciones puras, aplican el estado al instante y, en la nube, confirman con la API; si falla, revierten (o recargan si hubo otra escritura en el medio) y relanzan el error para el toast. Los componentes **deben** hacer `await` de las acciones. Antes de validar, cada acción espera `whenReady` (`untilReady`): mientras el store está `pending` (sin saber si hay sesión) o `loading` (sin los datos de la nube) no se escribe, para que una operación cargada apenas recargada la página no vaya a lo local ni se valide contra un estado vacío. Las vistas de datos se muestran con `SyncGate` (skeleton mientras `pending`/`loading`, reintentar si `error`), que además evita el mismatch de hidratación. `refreshCloud()` recarga sin pasar por `loading` (lo usa la importación). Las reglas de negocio (alta/edición/borrado) viven en funciones puras (`domain/transactions.ts`, `features/crypto/operations.ts`, `features/usdt-swaps/operations.ts`) que comparten store y server: cambiarlas en un solo lugar. Para escribir en los dos stores a la vez, cada uno expone `applyExternal(next, remote)` (un `commit` con el estado ya validado); `features/usdt-swaps/actions.ts` comparte un único request entre los dos.
- **Base de datos:** cambios de forma en `prisma/schema.prisma` van con una migración nueva (`pnpm db:migrate`) en el mismo PR; nunca editar migraciones ya aplicadas.

## Convenciones de desarrollo

- Componentes funcionales con tipos explícitos para props.
- Formularios: React Hook Form + esquemas Zod en `src/validations/`; los montos se validan como string y se convierten con `parseTransactionFormInput`.
  - Con Radix `Select`, `<FormControl>` envuelve el `SelectTrigger`, no el `Select` (el root no renderiza DOM y el label quedaría sin asociar).
- Formato de números en UI: `formatCurrency` (`es-AR`); no usar `toFixed` para mostrar.
- Errores de negocio: el store lanza `Error` con mensaje en español; el componente lo muestra con `toast.error`.
- Gráficos: colores categóricos `bg-chart-1…6` (paleta validada con la skill dataviz, claro y oscuro en `globals.css`) y `bg-chart-other` para "Otros"; el color sigue al activo, no a su puesto; siempre con leyenda/tabla visible (en claro, 3–5 quedan < 3:1 sobre la card).
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
pnpm test:e2e   # Playwright (e2e/), APIs simuladas; 1ª vez: pnpm exec playwright install chromium
                # --project=local: sin sesión; --project=cloud: con sesión (Clerk dev + base de Neon que NO sea producción)
pnpm db:migrate  # prisma migrate dev (crea y aplica una migración en dev)
pnpm db:deploy   # prisma migrate deploy (aplica las pendientes; deploy)
pnpm db:studio
```

CI (`.github/workflows/ci.yml`) corre lint, typecheck, test y build (job `check`) y los E2E (job `e2e`: `local` siempre; `cloud` solo si el repo tiene los secretos `E2E_CLERK_SECRET_KEY`, `E2E_CLERK_PUBLISHABLE_KEY` y `E2E_DATABASE_URL`) en cada PR y push a `main` (pnpm 12, Node 24). Antes de dar un cambio por terminado: `pnpm lint && pnpm typecheck && pnpm test`; si toca UI, además `pnpm test:e2e` y probar el flujo en `pnpm dev`.

Deploy: Vercel despliega `main` solo y usa `pnpm vercel-build` (`scripts/vercel-build.mjs`): en producción aplica `prisma migrate deploy` antes del build (si falla, el deploy falla y queda la versión anterior); en previews no migra.

## Variables de entorno

- La cotización del dólar **no** requiere variables: URL fija en `dolarApi.ts`.
- `COINGECKO_API_KEY` (opcional, clave Demo, header `x-cg-demo-api-key`): sin ella se usa la API pública con menor rate limit. Documentada en `.env.example` (excluido del ignore con `!.env.example`).
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY` (claves de test de Clerk) en `.env`, documentadas en `.env.example`. Sin ellas, `next dev` usa el keyless mode de Clerk (carpeta `.clerk/`, ignorada) y `next build` igual compila (CI no tiene secretos).
- E2E con sesión (`e2e/cloud.ts`): usan `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `DATABASE_URL` del `.env` (o del entorno en CI) y `E2E_CLERK_USER_EMAIL` opcional (por defecto `e2e+clerk_test@example.com`). Crean ese usuario en Clerk si no existe y **borran sus datos** de la base antes de cada test: nunca apuntarlos a producción. La instancia de Clerk necesita "Email address" habilitado (ya lo está en la de desarrollo).
- `DATABASE_URL` (Neon con pooler, la usa la app vía `@prisma/adapter-neon` sobre WebSocket/443) y `DIRECT_URL` (sin `-pooler`, la usa `prisma migrate`; opcional, cae en `DATABASE_URL`). Sin ellas, la app y `next build` funcionan, pero `/api/{dolar,crypto}/transactions*` responde 500 al primer acceso a la base.
- El `.env` local (ignorado por git vía `.env*`) puede tener claves de integraciones viejas (NextAuth, Google): no se usan. **No commitear secretos** ni volcar valores reales en documentación o issues. Si se agrega un `.env.example`, hay que excluirlo en `.gitignore` con `!.env.example`.

## Documentación y skills adicionales

- Roadmap (lo pendiente, deuda técnica): `docs/roadmap.md`; fases cerradas y sus decisiones: `docs/historial.md`; Pesos y CEDEARs (Fases 8–10, planificadas): `docs/roadmap-cedears.md`.
- Operación en producción (variables, Clerk prod, backups de Neon, logs, migraciones): `docs/operacion.md`.
- Buenas prácticas Next.js: `.agents/skills/next-best-practices/SKILL.md` (instalado desde `vercel-labs/next-skills`, ver `skills-lock.json`).

---

*Mantén este archivo factual respecto al código; si cambian rutas, storage, estructura o integraciones, actualízalo en el mismo PR.*
*No compilar en cada cambio.*
