# Roadmap de Implementación — de DolarTracker a Portfolio Tracker

Este roadmap define la evolución del producto en cuatro ejes:

1. **Login** para dejar de depender solo del `localStorage`.
2. **Persistencia en la nube** (Neon + Prisma) con sincronización local ↔ cloud.
3. **Convertir el módulo de dólar en *una parte*** de la app (shell multi-sección).
4. **Módulo cripto independiente** (operaciones en USD, precios de CoinGecko) + portfolio tracker.

> **Decisión (sep 2026): dólar y cripto son módulos separados.** No comparten modelo de
> transacción, store ni formulario. Lo único en común para el usuario es la cotización
> del **dólar cripto** (DolarAPI), que el módulo cripto usa para mostrar valores en pesos.
> En código comparten solo piezas puras y genéricas: el motor de costo promedio
> (`src/domain/position.ts`), el orden/validación de la línea temporal
> (`src/domain/timeline.ts`) y los formateadores de `src/lib/locale-amount.ts`.

> Guía de uso: cada fase es un hito desplegable por sí mismo. La Fase 0 es
> prerrequisito de todo (sin desacoplamiento ni tests no se puede escalar limpio).
> Las Fases 1–3 son el camino de auth + nube; la Fase 4 (cripto) solo depende de la 0,
> y la 5 depende de la 4. Los checkboxes son pasos concretos.

---

## Estado actual (octubre 2026)

### Lo que funciona hoy

- Alta de transacciones BUY/SELL en ARS/USD con tipo de dólar (`DolarOption`) y validación Zod.
- Historial agrupado por tipo de dólar con edición (diálogo) y borrado confirmado.
- Métricas por grupo **derivadas** con `useTransactionsData` (`src/store/transaction.store.ts`):
  posición USD, costo promedio, invertido ARS, valor de mercado,
  PnL realizado (costo promedio) y no realizado (marca a mercado con la cotización del mismo tipo de dólar),
  más un total agregado (`summarizeTransactionsData`) cuando hay más de un tipo de dólar.
- Cotizaciones DolarAPI (`src/services/dolarApi.ts`) con refresh cada 5 min en `providers.tsx`.
- Persistencia local: Zustand `persist` → `transactions-storage`, `dolar-storage`,
  `crypto-storage` (`version: 2`) y `crypto-prices-storage`, todas versionadas con `migrate`.
- Aviso "Modo local" en la barra superior (`LocalModeBadge`).
- Tema claro/oscuro/sistema, toasts (Sonner), UI en español.
- Shell multi-sección: home (`/`), sidebar con Dólar (`/dolar`) y Cripto (`/cripto`); secciones en `src/lib/sections.ts`.
- Módulo cripto (Fase 4 ✅): operaciones BUY/SELL en USD de cualquier moneda de
  CoinGecko con comisiones, intercambios cripto ↔ cripto, detalle por moneda, posiciones con
  costo promedio y PnL, valor en pesos vía dólar cripto (`src/features/crypto/`, proxy `src/app/api/crypto/*`).

### Hallazgos técnicos relevantes para la escala

| #   | Hallazgo | Impacto |
| --- | -------- | ------- |
| 1   | ~~El cálculo leía directamente `useDolarStore`~~ — resuelto: `src/domain/metrics.ts` recibe un `MarketPriceMap` | — |
| 2   | ~~Todo el estado usa claves `Record<DolarOption, ...>`~~ — ya no aplica: cripto tiene su propio store y no comparte claves con dólar | — |
| 3   | ~~Dominio implícito USD/ARS~~ — resuelto: el motor genérico (`computePosition`) trabaja con `quantity`/`quoteAmount`; dólar reporta en ARS y cripto en USD | — |
| 4   | ~~`persist` sin `version`/`migrate`~~ — resuelto: todos los stores en `version: 1`; migración v0 → v1 de `transactions-storage` testeada con un snapshot real | — |
| 5   | ~~Ramas API (`isSignedIn`) como código muerto con fallos silenciosos~~ — eliminadas en la Fase 1; la Fase 2 construye el repositorio remoto con manejo real de errores | — |
| 6   | ~~No hay ningún test~~ — resuelto: Vitest cubre `src/domain` y `src/lib/locale-amount` | — |
| 7   | ~~`pnpm lint` roto (Next 16 eliminó `next lint`)~~ — resuelto: ESLint 9 CLI + `eslint-config-next` | — |
| 8   | ~~Ciclo de imports `types` ↔ `validations`~~ — resuelto: `Transaction` es un tipo de dominio explícito | — |
| 9   | ~~Fechas futuras solo bloqueadas en el `<Calendar>`~~ — resuelto: `refine` en el schema Zod | — |
| 10  | ~~Deuda menor: `ui/alert-dialog` sin uso, sin `metadataBase`~~ — resuelto: `alert-dialog` eliminado, `metadataBase` apunta al dominio real | — |

### Rutas clave

- `src/store/transaction.store.ts` — estado + cálculos + persistencia.
- `src/store/dolar.store.ts` — cotizaciones.
- `src/types/{transaction,dolar}.types.ts`, `src/validations/transaction.ts`, `src/lib/locale-amount.ts`.
- `src/components/{TransactionList,NewTransactionForm,DolarPrice}.tsx`.
- `src/app/{page,providers,dolar/page,dolar/nueva/page,cripto/page,cripto/nueva/page}.tsx`, `src/components/AppSidebar.tsx`, `src/lib/sections.ts`.
- `src/features/crypto/` — módulo cripto; `src/server/coingecko.ts` + `src/app/api/crypto/{prices,search}/route.ts`.

---

## Visión de arquitectura objetivo

```
prisma/
└── schema.prisma                # Fase 2 (cliente generado en src/generated/prisma, ya ignorado)
proxy.ts                         # Fase 1: clerkMiddleware() (Next 16 renombró middleware → proxy)
src/
├── app/
│   ├── api/
│   │   ├── crypto/{prices,search}/  # proxy a CoinGecko (hecho)
│   │   ├── dolar/transactions/      # Fase 2: CRUD protegido
│   │   └── crypto/transactions/     # Fase 2: CRUD protegido
│   ├── dolar/…, cripto/…        # rutas de UI por módulo
│   └── not-found.tsx
├── domain/                      # piezas puras y genéricas, sin React ni stores
│   ├── position.ts              # computePosition: costo promedio + PnL realizado (hecho)
│   ├── timeline.ts              # sortTxs, findNegativeBalance, validateTimeline (hecho)
│   └── __tests__/
├── features/
│   ├── dolar/                   # lo que hoy vive en store/, services/, components/ (mover)
│   │   ├── dolar.store.ts, transaction.store.ts, dolarApi.ts
│   │   └── components/ (DolarPrice, TransactionList, NewTransactionForm)
│   ├── crypto/                  # hecho (Fase 4)
│   │   ├── types.ts, metrics.ts, validations.ts, api.ts, hooks.ts
│   │   ├── crypto.store.ts      # operaciones + metadatos de monedas (persist v2)
│   │   ├── prices.store.ts      # último precio por moneda (persist v1, fallback offline)
│   │   └── components/
│   └── auth/                    # estado de sesión, sync local → cloud
├── components/ui/               # primitivos shadcn (sin cambios)
├── lib/                         # utilidades genéricas (locale-amount, cn, sections)
└── server/                      # solo server: CoinGecko (hecho), prisma client, queries con ownership
```

- **Dos módulos independientes.** Dólar: operaciones ARS ↔ USD por tipo de dólar, reporte en ARS.
  Cripto: operaciones en USD por moneda de CoinGecko, reporte en USD con equivalente en pesos
  usando el dólar cripto (cotización de compra).
- **Motor compartido, modelos separados.** Cada módulo adapta sus operaciones a
  `PositionLot` (`quantity`, `quoteAmount`) y redondea según su unidad; no hay un tipo
  `Transaction` genérico ni `AssetKey`.
- **Reglas de dependencias**: `domain` no importa nada de `features`, `app` ni `store`;
  `features/*` no se importan entre sí (la excepción acordada: cripto **lee** la cotización
  del dólar cripto de `useDolarStore`). `server/` nunca se importa desde componentes cliente.
- **APIs externas detrás de route handlers**: el navegador no llama a CoinGecko directo; los
  handlers validan parámetros, cachean con el Data Cache de Next (`next.revalidate`) y
  validan la respuesta con Zod. La API key opcional (`COINGECKO_API_KEY`) queda en el server.
- **Repositorio de transacciones** (Fases 2–3): cada store habla con una interfaz
  `list/create/update/remove` con implementación local y remota; así la rama `isSignedIn`
  deja de estar dispersa en cada acción.

---

## Fase 0 — Fundación técnica y desacoplamiento ✅

**Objetivo:** base técnica (tests, lint, dominio puro) para crecer sin romper. *No cambia funcionalidad visible.*

- [x] **Tooling**: reemplazar `next lint` por ESLint CLI (`eslint` + `eslint-config-next`, flat config `eslint.config.mjs`) y agregar `"typecheck": "tsc --noEmit"`.
- [x] **Tests del motor financiero** (instalar `vitest` + script `pnpm test`):
  cubrir `updateTransactionsData` (compras, ventas, venta total y parcial, venta
  excesiva, redondeos, sin cotización), `validateTimeline`/`sortTxs` y
  `parseLocaleAmount`/`formatAmountArInput`.
- [x] **Extraer el dominio**: mover `updateTransactionsData`, `validateTimeline` y
  `sortTxs` a `src/domain/`, sin importar stores.
- [x] **Inyectar precios**: el cálculo recibe un `MarketPriceMap` en vez de leer
  `useDolarStore` directamente. La suscripción cross-store queda en el store, no en el dominio.
- [x] **Separar modelo de dominio y formulario**: `Transaction` deja de derivar de
  `TransactionFormValues`; el form mapea a dominio. Rompe el ciclo `types` ↔ `validations`.
- [x] **Motor genérico de posición**: `src/domain/position.ts` (`computePosition`) con
  `dust` configurable por unidad; `computeGroupMetrics` del dólar lo usa sin cambiar resultados.
- [x] ~~Generalizar claves a `AssetKey`~~ — **descartado**: dólar y cripto son módulos separados.
- [x] **`version: 1` en `transactions-storage` y `dolar-storage`**: `migrate` v0 → v1 deja de
  persistir `transactionsData`; `dolar-storage` no cambia de forma. La migración a lista plana
  con `assetKey` queda **descartada**.
- [x] **Métricas derivadas, no persistidas** (dólar): `useTransactionsData` calcula con `useMemo`
  desde transacciones + cotizaciones; se eliminaron `transactionsData`, `updateTransactionsData`
  y la suscripción entre stores.
- [x] **Moneda base de reporte** — decidido: dólar reporta en ARS; cripto en USD con
  equivalente en ARS vía dólar cripto.
- [x] **Validación de fecha en el schema**: rechazar fechas futuras en Zod, no solo en el `<Calendar>`.
- [x] **Métricas globales agregadas del dólar**: `summarizeTransactionsData` (sin costo
  promedio, que mezclaría cotizaciones); se muestra con más de un tipo de dólar.
- [x] **Edición de transacciones**: `updateTransaction` revalida el grupo destino y, si cambió
  el tipo de dólar, también el de origen. Formulario compartido alta/edición (`TransactionForm`).
- [x] **Aviso "Modo local"** en la barra superior (se oculta en la Fase 3).
- [x] Limpieza: `404.tsx` → `not-found.tsx`, eliminar `getDolar()` y `usdPrice`, errores
  de red de DolarAPI con toast (y chequeo de `response.ok`).
- [x] `ui/alert-dialog` y `@radix-ui/react-alert-dialog` eliminados (la edición usa `ui/dialog`).
- [x] `metadataBase` en `src/app/layout.tsx`; metadatos OG/Twitter renombrados a Portfolio Tracker.

**Criterio de salida:** `pnpm lint`, `pnpm typecheck` y `pnpm test` verdes, la app se
comporta idéntico para el usuario y el dominio no importa ningún store.

---

## Fase 1 — Autenticación (Clerk) ✅

**Objetivo:** identificar al usuario. *Solo login; los datos siguen en local.*

- [x] Crear proyecto en el Dashboard de **Clerk** (claves de test en `.env`, nunca
  commiteadas; nombres documentados en `.env.example`; `.clerk/` ignorado por el keyless mode).
- [x] Instalar `@clerk/nextjs` (v7, Core 3) + `@clerk/localizations`; `<ClerkProvider>` en el layout raíz
  con `esUY` (voseo) y `appearance.variables` apuntando a las variables CSS de shadcn (claro/oscuro).
- [x] `src/proxy.ts` con `clerkMiddleware()` (sin `createRouteMatcher`, deprecado): las futuras rutas de datos chequean `auth()` en cada route handler
  (`/api/dolar/*`, `/api/crypto/transactions*`); páginas y precios siguen públicos (modo local sin login).
- [x] `<UserButton />` / `<SignInButton mode='modal' />` en el footer del sidebar (`UserMenu.tsx`), con
  `<Show when='signed-in' | 'signed-out'>` (Core 3 eliminó `SignedIn`/`SignedOut`) y skeleton mientras carga.
- [x] **Estado de sesión en el cliente**: `useAuth()` de Clerk. Los `isSignedIn: false` hardcodeados se
  **eliminaron** junto con la rama remota muerta del store del dólar: conectarla al `isSignedIn` real
  habría mandado las operaciones de usuarios logueados a endpoints inexistentes y las habría perdido en
  silencio. El store queda local y síncrono (como el de cripto); la Fase 2 suma el repositorio remoto.
  `LocalModeBadge` aclara que, aun con sesión, los datos siguen siendo locales.
- [x] Server-side: `auth()` de `@clerk/nextjs/server` en route handlers (`requireUserId` en
  `src/server/auth.ts`, usado por la API CRUD de la Fase 2).

**Criterio de salida:** se puede registrarse/iniciar sesión en la app, sin cambios en
la persistencia todavía.

---

## Fase 2 — Persistencia cloud (Neon + Prisma) ✅

**Objetivo:** las transacciones viven en Postgres para usuarios autenticados.

- [x] Instancia en **Neon.tech** (sa-east-1, base nueva) con la migración inicial aplicada (`pnpm db:deploy`).
  La API se probó contra la base real: CRUD de ambos módulos, decimales exactos, 422, ownership y dos
  ventas concurrentes (una 201, la otra 409).
- [x] **Prisma 7.10** (`prisma` + `@prisma/client` + `@prisma/adapter-neon`): generator `prisma-client`
  con output en `src/generated/prisma` (ignorado), `prisma.config.ts` (Prisma 7 ya no lee `.env` ni
  la URL del schema), `postinstall: prisma generate`, scripts `db:migrate` / `db:deploy` / `db:studio`.
  El cliente usa el driver serverless de Neon (WebSocket sobre 443) y se crea al primer uso.
- [x] **Schema** (`prisma/schema.prisma`, migración `20261002000000_init`), una tabla por módulo:
  - `User.id` = userId de Clerk; la fila se crea (upsert) en la primera escritura, sin webhook.
  - `DolarTransaction` y `CryptoTransaction` con `id` UUID **generado por el cliente** (updates
    optimistas sin reconciliar ids, subida idempotente en la Fase 3), `type` como enum
    `TransactionType`, montos `Decimal` e índices `(userId, dolarOption|coinId, date)`.
  - `CryptoTransaction` suma lo que agregó la Fase 4: `feeAmount` + `feeCurrency` (`USD | COIN`,
    juntos o ninguno) y `swapId` (indexado), más los metadatos de la moneda (`symbol`, `name`, `image`).
- [x] **API CRUD** por módulo (handlers en `src/app/api/`, lógica en `src/server/`):
  - `GET/POST /api/dolar/transactions`, `PATCH/DELETE /api/dolar/transactions/:id`.
  - `GET/POST /api/crypto/transactions` (`{ transactions, coins }` / `{ transaction, coin }`),
    `PATCH/DELETE /api/crypto/transactions/:id` (el DELETE devuelve `removedIds`: borra las dos patas
    de un intercambio) y `POST /api/crypto/swaps` (`{ swap, ids }`).
  - Errores con mensaje en español: 401 sin sesión, 400 body inválido (Zod), 404 operación inexistente
    o ajena (ownership: toda query filtra por `userId`), 409 id repetido o escritura concurrente
    (transacción `Serializable`), 422 línea temporal inválida.
  - `Decimal` ↔ `number`: un único mapper server-side (`src/server/mappers.ts`).
- [x] **Validación timeline en el server**: las reglas de alta/edición/borrado se extrajeron de los stores
  a funciones puras (`src/domain/transactions.ts`, `src/features/crypto/operations.ts`) que usan el
  store y el server, con los mismos mensajes de error.
- [x] Tests: funciones puras, mappers y los route handlers reales contra una base en memoria
  (`src/server/__tests__/`: 401/400/404/409/422, ownership entre usuarios, intercambios, comisiones).
- [x] **Origen de datos en los stores** (`src/lib/synced-store.ts`, mismo patrón para dólar y cripto):
  `source` local / nube según la sesión (`src/app/cloud-sync.tsx`), carga inicial con `GET`, escrituras
  optimistas que se confirman con la API y se revierten si fallan (toast con el mensaje del server),
  `status` con skeleton y "Reintentar" (`SyncGate`). Con sesión, lo local se conserva aparte y es lo
  único que se persiste en `localStorage`: no se pierde ni se mezcla (la Fase 3 ofrece subirlo).
  Mientras tanto, al iniciar sesión se ve solo lo de la nube.
- [x] Verificado en el navegador con sesión: alta desde el formulario, recarga (los datos vienen de Neon),
  borrado fallido simulado (toast "No hay conexión con el servidor." y la fila vuelve), borrado real,
  `/cripto` en la nube, `localStorage` intacto y sin errores en consola.

**Criterio de salida:** con sesión iniciada, crear/editar/borrar sobrevive a un
refresco y a otro dispositivo; sin sesión, todo sigue funcionando en local.

---

## Fase 3 — Integración híbrida y sincronización ✅

**Objetivo:** un solo flujo de verdad según la sesión.

- [x] ~~Selección de repositorio en el store~~ — hecho en la Fase 2 (`source` local / nube según la sesión).
- [x] **Migración inicial** (`src/features/auth/`): al iniciar sesión, `LocalImportDialog` detecta las
  operaciones locales que no están en la cuenta (por id) y ofrece subirlas con `POST /api/sync/import`
  (dólar + cripto en una transacción). Idempotente por `id`: los `crypto.randomUUID()` locales se
  conservan; datos viejos con ids no UUID reciben uno nuevo (`toImportPayload`, swaps incluidos).
  "Ahora no" recuerda esos ids por usuario (`sync-storage`) para no insistir; se pueden subir después
  desde el badge.
- [x] Logout: no borrar locales automáticamente — hecho en la Fase 2 (`disconnectCloud` restaura la copia local).
- [x] Estado de sync en el badge (`SyncBadge`): Modo local / Cargando… / Guardando… (escrituras en curso)
  / Sincronizado / Sin conexión (con "Reintentar"), y aviso de operaciones locales sin subir.
- [x] **Regla de conflictos: la nube manda.** Lo local solo *agrega* operaciones: un id que ya existe en la
  nube se saltea (gana la versión de la nube), igual que los metadatos de monedas ya conocidas; un id que
  choca con otro usuario se saltea sin revelarlo. El server valida la línea temporal combinada (422 si no
  cierra). Después de subir, lo local queda intacto en el navegador (se vuelve a ver al cerrar sesión) y
  no se vuelve a ofrecer.
- [x] Verificado: tests de la ruta (idempotencia, la nube manda, otro usuario, 422, swaps), importación contra
  Neon real con un usuario de prueba, y en el navegador el diálogo con el conteo correcto, "Ahora no" (no
  reaparece al recargar) y el popover del badge ofreciendo la subida manual. Falta: hacer clic en "Subir a
  mi cuenta" en el navegador con datos reales.

**Criterio de salida:** flujo continuo local → login → nube sin pérdida de datos.

---

## Fase 4 — Módulo Cripto (independiente del dólar) ✅

**Objetivo:** un tracker de cripto propio: operaciones en USD de cualquier moneda,
posiciones y PnL con precios de CoinGecko. Solo depende de la Fase 0.

**Modelo:** cada operación guarda `coinId` (id de CoinGecko), `type`, `quantity`,
`priceUsd` y `date`. Métricas en USD por moneda (costo promedio ponderado, PnL realizado
y no realizado); valor en pesos = valor USD × dólar cripto (compra).

- [x] **Proxy a CoinGecko** (`src/server/coingecko.ts`, respuestas validadas con Zod):
  - `GET /api/crypto/prices?ids=` → precio USD, variación 24 h, última actualización (cache 60 s).
  - `GET /api/crypto/search?q=` → búsqueda de monedas; sin `q`, top 10 por capitalización (cache 1 h).
  - `COINGECKO_API_KEY` opcional (clave Demo), documentada en `.env.example`.
- [x] **Store** `useCryptoStore` (`crypto-storage`, `version: 1`): lista plana de operaciones
  + metadatos de cada moneda usada; valida la línea temporal por moneda al agregar y borrar.
- [x] **Precios** `useCryptoPricesStore` (`crypto-prices-storage`, `version: 1`): último
  precio conocido (fallback si la API cae); refresco cada 60 s solo mientras se ve `/cripto`.
- [x] **Métricas derivadas** (`computeCryptoPositions`, `summarizePortfolio`) sobre el motor
  compartido `computePosition`, con tests.
- [x] **Formulario** `/cripto/nueva`: buscador de monedas (combobox shadcn `command`),
  compra/venta, cantidad, precio unitario USD (autocompletado con el precio actual), fecha.
- [x] **Vista** `/cripto`: resumen (valor USD y ARS, invertido, PnL), cotización del dólar
  cripto, tabla de posiciones abiertas e historial con borrado confirmado.
- [x] Probar el flujo completo en el navegador (alta, venta, edición, borrado, intercambio, API caída, migración v1 → v2).
- [x] **Comisiones** (`fee` opcional en USD o en la moneda, `toPositionLot`): en USD encarecen la compra /
  reducen lo cobrado; en la moneda la compra acredita menos unidades / la venta debita más (también en
  la línea temporal). `crypto-storage` pasa a `version: 2` con `migrate` (los datos v1 ya son válidos).
- [x] **Edición de operaciones** (diálogo en el historial): revalida la moneda destino y, si
  cambió la moneda, también la de origen.
- [x] Detalle por moneda (`/cripto/[coinId]`): operaciones filtradas y métricas de la moneda; se llega desde
  posiciones e historial.
- [x] Operaciones cripto ↔ cripto (swap BTC → ETH) como venta + compra enlazadas por `swapId`; el valor en
  USD define el precio de ambas patas. Se borran juntas (revalidando las dos monedas) y no se editan.
- [x] Manejo del rate limit en el cliente: tras un fallo de `/api/crypto/prices` (429 u otro), el refresco
  pasa de 60 s a backoff exponencial 2 → 4 → 8 min con tope en 10 min (`priceRefreshDelay`), con toast
  específico para el 429 y el último precio conocido como fallback.

**Criterio de salida:** se puede comprar/vender cualquier moneda en USD y ver posición,
costo promedio, PnL y su valor en pesos, con precios que se actualizan solos.

---

## Fase 5 — Portfolio Tracker ✅

**Objetivo:** pasar de "listas de transacciones" a **vista de portfolio**.

- [x] **Dashboard unificado** (en la home, `src/features/portfolio/`): valor total (ARS y USD) sumando los
  dos módulos, cada uno con sus propias métricas (dólar en ARS, cripto en USD, con su ganancia); la
  conversión usa el dólar cripto compra para cripto y la cotización de cada tipo de dólar para el módulo
  dólar. Desglose por activo con % de allocation **en USD** (no depende de cotizaciones en pesos).
- [x] **Composición**: barra apilada al 100 % (la skill dataviz desaconseja la dona para parte-de-un-todo)
  con tooltip por segmento, máximo 6 segmentos (el resto en "Otros"), más una tabla que hace de leyenda
  y vista accesible. Paleta categórica validada en claro y oscuro (`--chart-1…6`, `--chart-other`).
- [x] **Evolución temporal del valor** (`recharts`): **reconstruida** desde transacciones + histórico de
  precios, sin snapshots. Se descartó la tabla `PortfolioSnapshot`: la historia empezaría hoy, quedaría mal
  al editar operaciones viejas, necesitaría un cron y no serviría en modo local. Precios diarios del último
  año: ArgentinaDatos (dólar, todos los tipos) y CoinGecko `market_chart` (el plan público no da más de 365
  días → rangos 1M/3M/6M/1A). Hoy usa los precios en vivo (la serie cierra con el total del resumen).
  Días sin cotización usan la anterior; un activo sin precio deja el día en `null` y el gráfico arranca
  después, con aviso. Aclara que el valor incluye compras y ventas (no es solo rendimiento).
- [x] **Detalle por activo**: cada fila de la tabla lleva a `/dolar` o `/cripto/[coinId]`.
- [x] **Precios en vivo**: variación 24 h de las cripto en cartera (CoinGecko), refresco con backoff
  también en la home (`useCryptoPriceSync`), skeleton mientras carga y aviso de monedas sin precio
  (no suman al total).
- [x] Cotizaciones dólar (`DolarPrice`) como una tarjeta más dentro del dashboard; sin operaciones, la
  home sigue mostrando la presentación.
- [ ] Extras (prioridad baja): watchlist, refresh manual.
- [x] ~~Export CSV/JSON~~ — **descartado** (decisión del usuario, oct 2026).

**Criterio de salida:** el usuario ve de un vistazo cuánto tiene, dónde, cuánto
ganó y cómo evolucionó.

---

## Fase 6 — Calidad, operación y despliegue

- [x] CI (GitHub Actions, `.github/workflows/ci.yml`): `pnpm lint` + `pnpm typecheck` + `pnpm test` + `pnpm build` en cada PR y en cada push a `main`.
- [x] Tests E2E (Playwright, `e2e/`, job `e2e` en CI) en modo local con las APIs externas simuladas:
  home vacía, alta de dólar + venta sin saldo, compra cripto con buscador, dashboard (composición,
  evolución, drill-down) y DolarAPI caída.
- [x] Manejo robusto de errores de red: DolarAPI con timeout de 10 s, backoff 30 s → 4 min tras fallos,
  reintento al volver la conexión, toasts distintos para "sin conexión" / "DolarAPI no responde" y
  fallback a las últimas cotizaciones guardadas. Cripto ya tenía backoff (Fase 4); las escrituras a la
  nube se revierten con toast (Fase 2).
- [x] Observabilidad sin servicio externo: logs JSON en el server (`src/server/log.ts`, los guarda
  Vercel) con eventos de escritura OK (`dolar.*`, `crypto.*`, `sync.imported`), errores inesperados de
  la API (`api.unexpected`) y del resto del server (`request.error`, `src/instrumentation.ts`). Sin
  montos, headers ni cookies. Los logins se ven en el dashboard de Clerk. Sentry queda para cuando
  haya usuarios reales (se engancha en `log.ts` e `instrumentation.ts`).
- [x] `prisma migrate deploy` en el deploy: `pnpm vercel-build` migra solo en producción (las previews
  comparten la base); si la migración falla, el deploy falla y queda la versión anterior.
- [x] Política de migraciones y guía de operación (`docs/operacion.md`).
- [ ] **(manual)** Variables de entorno de producción en Vercel: verificar `DATABASE_URL` y pasar Clerk a
  una instancia de producción (hoy usa claves `pk_test_`, requiere dominio propio). Pasos en
  `docs/operacion.md` §1–2.
- [ ] **(manual)** Neon: subir la retención del historial (restore a un punto en el tiempo) y separar
  una rama para previews (hoy comparten la base de producción). Pasos en `docs/operacion.md` §3.
- [x] Actualizar `README.md` y `AGENTS.md` con la arquitectura final.

**Siguiente iteración** (no bloquean el cierre de la fase; cada una suma un servicio externo):

- [ ] E2E de login y sync (necesita `@clerk/testing` y un usuario de prueba en Clerk).
- [ ] Rate limits en `/api/*` (la validación con Zod y el ownership ya están, Fase 2). Un límite en memoria
  no sirve en serverless: hace falta un store compartido (p. ej. Upstash Redis). Hoy el riesgo es
  bajo: toda escritura exige sesión y solo toca datos propios; los proxies de precios cachean.

---

## Fase 7 — Intercambios USDT (dólar cripto) ↔ cripto y resultados de trades

**Objetivo:** dos operaciones nuevas que hoy no se pueden cargar sin "inventar" datos:

1. **Intercambiar los USDT del dólar cripto por cualquier cripto, y al revés.** En el módulo Dólar,
   comprar o vender "dólar cripto" es en realidad comprar o vender **USDT**. Con esos USDT se tiene
   que poder hacer un swap a BTC, ETH, etc. (y volver de una cripto a USDT). Hoy hay que cargar una
   venta de dólar cripto y una compra cripto sueltas, sin enlace y sin validar que coincidan.
2. **Resultado de un trade acreditado en una moneda** (futuros, margin, bots: "+50 USDT", "−0,01 BTC"),
   sin compra ni venta de por medio. Cambia el saldo de la moneda y el PnL realizado.

> **Decisión (oct 2026): el grupo `cripto` del módulo Dólar *es* el saldo de USDT.** No se crea una
> moneda `tether` paralela en el módulo Cripto (habría dos saldos de USDT que no coinciden). Un
> intercambio USDT ↔ cripto mueve el grupo `cripto` del Dólar y una moneda del módulo Cripto.
> No se fusionan modelos ni stores: se agrega un **composer** nuevo, `src/features/usdt-swaps/`,
> igual que `features/auth` y `features/portfolio` (lee los dos stores; ningún módulo lo importa
> salvo lo indicado en 7.4).

### 7.1 Modelo — intercambio USDT ↔ cripto

Se guarda como **dos operaciones enlazadas por `usdtSwapId`** (mismo patrón que `swapId` de los
intercambios cripto ↔ cripto). Datos que carga el usuario: dirección, USDT, moneda, cantidad de la
moneda, fecha, comisión opcional y la cotización del dólar cripto en ARS (ver abajo).

| Dirección        | Pata Dólar (grupo `cripto`)                            | Pata Cripto                         |
| ---------------- | ------------------------------------------------------ | ----------------------------------- |
| USDT → cripto    | `SELL` de `usdt` USD, `pesosAmount` = USDT × cotización | `BUY` de `quantity` unidades        |
| cripto → USDT    | `BUY` de `usdt` USD, `pesosAmount` = USDT × cotización  | `SELL` de `quantity` unidades       |

- **Precio de la pata cripto:** `priceUsd` = USDT / `quantity` (1 USDT = 1 USD, como ya asume el
  módulo Cripto). La comisión opcional va en la pata cripto (`fee` en USD o en la moneda, como hoy).
- **Pesos de la pata dólar:** el módulo Dólar mide en ARS, así que la pata necesita un monto en
  pesos. Se autocompleta con el **dólar cripto** de ese día (DolarAPI hoy; ArgentinaDatos para fechas
  pasadas, vía `/api/history/dolar`): `compra` si se entregan USDT, `venta` si se reciben. Editable.
  - USDT → cripto: la ganancia cambiaria de esos USDT hasta el día del swap queda **realizada en ARS**
    en el módulo Dólar; desde ahí, la cripto sigue en USD en su módulo.
  - cripto → USDT: los USDT entran al grupo `cripto` con ese costo en ARS (el costo promedio se
    pondera como cualquier compra). El PnL de la cripto se realiza en USD en su módulo.
  - No hace falta tocar el motor (`computePosition`): son una venta y una compra normales.
  - *Alternativa descartada:* sacar los USDT "a costo" sin realizar PnL en ARS. Obliga a recalcular la
    pata cada vez que se edita una compra anterior y esconde la ganancia cambiaria.
- Se borran juntas y no se editan (se borra y se vuelve a cargar), igual que los intercambios.
- Si el usuario ya tiene `tether` cargado en el módulo Cripto, el formulario avisa que los USDT del
  swap salen del dólar cripto (no de esa moneda). Migrar esos datos queda fuera de alcance.

Tareas:

- [ ] `Transaction.usdtSwapId?: string` y `CryptoTransaction.usdtSwapId?: string`.
- [ ] `transactions-storage` v1 → **v2** y `crypto-storage` v2 → **v3**, cada uno con `migrate`
      (campos opcionales: los datos viejos ya son válidos) + test con snapshot.
- [ ] Prisma: `usdtSwapId String? @db.Uuid` + `@@index([usdtSwapId])` en `DolarTransaction` y
      `CryptoTransaction`; migración nueva (`pnpm db:migrate`).
- [ ] `src/features/usdt-swaps/operations.ts` (puro, store + server):
  - `buildUsdtSwapLegs(input, ids)` → `[Transaction, CryptoTransaction]` según la dirección.
  - `applyAddUsdtSwap({ dolar, crypto }, input, ids)`: reutiliza `applyAddTransaction` (saldo de
    USDT del grupo `cripto`) y `applyAddCryptoTransaction` (saldo de la moneda); lanza con mensaje
    en español ("No tenés suficientes USDT el dd/MM/yyyy.").
  - `applyRemoveUsdtSwap({ dolar, crypto }, usdtSwapId)`: quita las dos patas y revalida las dos
    líneas temporales (los USDT o la cripto recibidos pueden haberse vendido después).
- [ ] Las funciones de cada módulo **rechazan** editar o borrar una pata sola
      (`applyUpdate/RemoveTransaction`, `applyUpdate/RemoveCryptoTransaction`):
      "Es un intercambio con USDT: borralo completo."
- [ ] Tests en `src/features/usdt-swaps/__tests__/` (las dos direcciones, sin saldo de USDT, sin saldo
      de la moneda, borrado, pata suelta) y en `src/domain/__tests__/` para el rechazo de patas sueltas.

### 7.2 Modelo — resultado de trade en una moneda

Nueva variante de operación con `kind: 'TRADE_RESULT'` (sin `kind` = compra/venta normal), usando el
`type` existente: `BUY` = ganancia (entran unidades), `SELL` = pérdida (salen unidades), más
`note?` (p. ej. "BTCUSDT long x10"). Sin comisión: se carga el resultado neto.

Como USDT vive en el módulo Dólar (7.1), el resultado puede caer en dos lugares:

- **En USDT** (el caso típico de futuros): operación del grupo `cripto` del módulo Dólar, con
  `dollarsAmount` = USDT y `pesosAmount` = USDT × dólar cripto del día (autocompletado, editable).
- **En otra moneda:** operación del módulo Cripto, con `quantity` y `priceUsd` del día
  (autocompletado; para fechas pasadas, el histórico de CoinGecko).

Contabilidad (igual en los dos módulos, cada uno en su unidad: ARS en Dólar, USD en Cripto):

- **Ganancia:** las unidades entran con costo = valor de mercado y ese mismo valor se suma al
  **PnL realizado**. Lo que cambie el precio después es PnL no realizado, como con cualquier compra.
- **Pérdida:** las unidades salen sin cobrar nada (`quoteAmount = 0`) → el motor ya realiza
  `−costo promedio × cantidad`. No necesita cambios.
- Motor: `PositionLot` suma `realizedProfit?: number` (ajuste directo al PnL realizado, por defecto
  0). Tests en `src/domain/__tests__/position.test.ts`.
- La línea temporal (`findNegativeBalance`) ya funciona: una pérdida es una salida de unidades y no
  puede dejar el saldo negativo. `computeValueHistory` también (usa las cantidades).

Tareas:

- [ ] `kind?: 'TRADE_RESULT'` y `note?: string` en `Transaction` y `CryptoTransaction` (entran en las
      mismas subidas de versión de 7.1).
- [ ] Prisma: `enum OperationKind { TRADE_RESULT }`, `kind OperationKind?` y `note String?` en las dos
      tablas (misma migración que 7.1); `mappers.ts` ida y vuelta.
- [ ] Dólar: `computeGroupMetrics` pasa el ajuste al motor; `TransactionsData` suma `tradeProfit` (ARS).
- [ ] Cripto: `toPositionLot` pasa el ajuste; `CryptoPosition` y `CryptoPortfolioSummary` suman
      `tradePnlUsd`. Tests en `src/features/crypto/__tests__/metrics.test.ts` y
      `src/domain/__tests__/metrics.test.ts`.
- [ ] Zod (form y API de los dos módulos): aceptan `kind`/`note`; un resultado de trade no lleva
      `fee` ni `swapId`/`usdtSwapId`.
- [ ] Se puede editar (es una operación sola) con la misma revalidación que una compra/venta.

### 7.3 API y sincronización

- [ ] `POST /api/usdt-swaps` (`{ swap, ids }`) y `DELETE /api/usdt-swaps/:usdtSwapId`:
      `requireUserId` → Zod → `src/server/usdt-swaps.ts`, que carga **los dos** estados del usuario,
      aplica `applyAddUsdtSwap` / `applyRemoveUsdtSwap` y escribe las dos tablas en una sola
      `withUserTransaction` (`Serializable`). 401/400/404/409/422 como el resto; logs
      `usdtSwap.created` / `usdtSwap.removed` sin montos.
- [ ] `PATCH`/`DELETE` de `/api/{dolar,crypto}/transactions/:id` sobre una pata → 422 (lo hacen solas
      las funciones puras de 7.1). Alta y edición aceptan `kind`/`note` (7.2).
- [ ] `importSchema` / `toImportPayload` / `localNotInCloud`: llevan `usdtSwapId`, `kind` y `note`; al
      importar se validan ambas líneas temporales (ya pasa) y que cada `usdtSwapId` tenga sus dos patas
      (una pata sin la otra no se sube).
- [ ] Tests de la API en `src/server/__tests__/` (alta y borrado atómicos, ownership, 422 por saldo,
      pata suelta, import con intercambios USDT).

### 7.4 Stores y UI

- [ ] Cada store expone una acción genérica `applyExternal(next, remote)` (envuelve `sync.commit`)
      para que `features/usdt-swaps` actualice los dos de forma optimista con **una** sola llamada a
      la API; si falla, cada uno revierte lo suyo (o recarga si hubo otra escritura).
- [ ] `features/usdt-swaps/hooks.ts`: `useAddUsdtSwap`, `useRemoveUsdtSwap` (validan con las funciones
      puras sobre el estado actual de los dos stores).
- [ ] **Formulario de intercambio** (`/cripto/nueva`, pestaña "Intercambio"): en el selector de
      moneda de origen y de destino aparece primero **"USDT · Dólar cripto"** con su saldo; si un lado es
      USDT, el form pide la cotización ARS (autocompletada) y guarda un intercambio USDT; si no, sigue
      siendo el intercambio cripto ↔ cripto de siempre. El valor en USD es la cantidad de USDT (no se
      pide aparte). Muestra el precio implícito por unidad.
- [ ] Atajo desde `/dolar`: en el grupo "cripto", botón "Intercambiar USDT" que abre el mismo form con
      USDT como origen.
- [ ] **Formulario "Resultado de trade"** (`/cripto/nueva`, pestaña nueva): ganancia/pérdida, moneda
      (con "USDT · Dólar cripto" primero), cantidad, precio o cotización autocompletados, fecha y nota.
- [ ] Historiales: badge "Intercambio USDT" en las dos listas con el otro lado
      ("→ 0,0012 BTC" / "← 100 USDT"), sin editar, y borrar elimina las dos patas (confirmación que lo
      aclara). Badge "Trade" con la nota. En `/dolar`, el grupo "cripto" se rotula "Dólar cripto (USDT)".
      **Excepción a la regla de módulos:** `TransactionList` y `CryptoTransactionList` importan solo
      `useRemoveUsdtSwap` de `features/usdt-swaps` para esas filas (documentarlo en `AGENTS.md`).
- [ ] Resúmenes (dólar, cripto y detalle por moneda): línea "Resultado de trades" dentro del PnL
      realizado.
- [ ] Dashboard: sin cambios de cálculo (los dos módulos ya reflejan el intercambio); verificar que el
      total no se duplique ni pierda valor el día del swap.
- [ ] E2E (`e2e/`): compra de dólar cripto → swap USDT → BTC → swap BTC → USDT, borrado desde cada
      lista; ganancia y pérdida de trade en USDT y en BTC con su efecto en saldo y PnL.

### Fuera de alcance (posibles siguientes pasos)

- Migrar `tether` cargado en el módulo Cripto al grupo `cripto` del Dólar.
- Otras stablecoins (USDC, DAI) como "dólar cripto": hoy siguen siendo monedas del módulo Cripto.
- Resultados de trade sin moneda (solo un monto en USD que no cambia ningún saldo).

**Criterio de salida:** con los USDT comprados como dólar cripto se puede hacer swap a cualquier cripto
y volver, y cargar ganancias o pérdidas de trades en USDT o en cualquier moneda, con saldos y PnL
correctos en los dos módulos, en local y en la nube, sin poder dejar patas sueltas.

---

## Orden y dependencias

```
Fase 0 (desacoplar + tests + lint)
   ├─> Fase 1 (Clerk)
   │     └─> Fase 2 (Neon + Prisma + API)
   │           └─> Fase 3 (sync híbrida)
   └─> Fase 4 (cripto, local)  ← puede avanzar en paralelo a 1–3
             └─> Fase 5 (portfolio tracker)  ← requiere 3 si se quiere en la nube
Fase 6 (calidad/operación): transversal, CI desde que existen tests (Fase 0)
Fase 7 (intercambios USDT ↔ cripto, resultados de trades): requiere 3 y 4
```

**Notas:**

- La **Fase 4 (cripto)** solo requiere la Fase 0 para funcionar en local. Como es un
  módulo con su propio store, las Fases 2–3 deben sumarle su tabla, su API y su
  repositorio remoto (mismo patrón que dólar, sin modelo compartido).
- La **Fase 6** es transversal: empezar con el pipeline de CI apenas hay tests (Fase 0).

---

*Actualizar este documento (y `AGENTS.md`) en el mismo PR de cada fase completada.*
