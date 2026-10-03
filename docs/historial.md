# Historial del roadmap — fases cerradas

Detalle de lo que se hizo en cada fase terminada y de las decisiones tomadas en el camino.
Lo pendiente vive en [`roadmap.md`](roadmap.md); el estado del código, en `AGENTS.md`.
Este archivo no se reescribe: cuando una fase cierra, su sección pasa de `roadmap.md` acá.

> Las rutas y nombres reflejan el momento en que se escribió cada fase. Lo que cambió después
> se aclara entre corchetes.

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
- [x] **Aviso "Modo local"** en la barra superior (`LocalModeBadge`) [reemplazado por `SyncBadge` en la Fase 3].
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
  `LocalModeBadge` aclara que, aun con sesión, los datos siguen siendo locales [reemplazado por `SyncBadge` en la Fase 3].
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
  `source` local / nube según la sesión (`src/features/auth/CloudSync.tsx`), carga inicial con `GET`, escrituras
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
  reaparece al recargar) y el popover del badge ofreciendo la subida manual. [Pendiente al cerrar: hacer
  clic en "Subir a mi cuenta" en el navegador con datos reales — pasó a `roadmap.md`, Fase 6.]

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

## Fase 6 — Calidad, operación y despliegue (parte hecha)

Lo que quedó pendiente de esta fase sigue en `roadmap.md`.

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
- [x] Actualizar `README.md` y `AGENTS.md` con la arquitectura final.


---

## Hallazgos técnicos resueltos (auditoría inicial, sep 2026)

| #   | Hallazgo | Resolución |
| --- | -------- | ---------- |
| 1   | El cálculo leía directamente `useDolarStore` | `src/domain/metrics.ts` recibe un `MarketPriceMap` |
| 2   | Todo el estado usaba claves `Record<DolarOption, ...>` | Ya no aplica: cripto tiene su propio store |
| 3   | Dominio implícito USD/ARS | Motor genérico `computePosition` con `quantity`/`quoteAmount` |
| 4   | `persist` sin `version`/`migrate` | Todos los stores versionados; v0 → v1 de `transactions-storage` testeada con un snapshot real |
| 5   | Ramas API (`isSignedIn`) como código muerto con fallos silenciosos | Eliminadas en la Fase 1; la Fase 2 hizo el origen remoto con manejo real de errores |
| 6   | No había ningún test | Vitest (unit) + Playwright (E2E) |
| 7   | `pnpm lint` roto (Next 16 eliminó `next lint`) | ESLint 9 CLI + `eslint-config-next` |
| 8   | Ciclo de imports `types` ↔ `validations` | `Transaction` es un tipo de dominio explícito |
| 9   | Fechas futuras solo bloqueadas en el `<Calendar>` | `refine` en el schema Zod |
| 10  | `ui/alert-dialog` sin uso, sin `metadataBase` | Eliminado; `metadataBase` apunta al dominio real |
