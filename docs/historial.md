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

## Fase 7 — Intercambios USDT (dólar cripto) ↔ cripto y resultados de trades ✅

**Objetivo:** dos operaciones nuevas que hoy no se pueden cargar sin "inventar" datos:

1. **Intercambiar los USDT del dólar cripto por cualquier cripto, y al revés (7a).** En el módulo Dólar,
   comprar o vender "dólar cripto" es en realidad comprar o vender **USDT**. Con esos USDT se tiene
   que poder hacer un swap a BTC, ETH, etc. (y volver de una cripto a USDT). Hoy hay que cargar una
   venta de dólar cripto y una compra cripto sueltas, sin enlace y sin validar que coincidan.
2. **Resultado de un trade acreditado en una moneda (7b)** (futuros, margin, bots: "+50 USDT",
   "−0,01 BTC"), sin compra ni venta de por medio. Cambia el saldo de la moneda y el PnL realizado.

Son dos entregas **independientes**: cada una tiene su subida de versión del storage, su migración y
se despliega por separado. Como los campos nuevos son opcionales, los datos viejos siguen siendo
válidos y cada `migrate` es trivial.

**Requisitos:** Fases 3 y 4, más los dos ítems "Antes de la Fase 7a" de la Fase 6.

> **Decisión (oct 2026): el grupo `cripto` del módulo Dólar *es* el saldo de USDT.** No se crea una
> moneda `tether` paralela en el módulo Cripto (habría dos saldos de USDT que no coinciden). Un
> intercambio USDT ↔ cripto mueve el grupo `cripto` del Dólar y una moneda del módulo Cripto.
> No se fusionan modelos ni stores: se agrega un **composer** nuevo, `src/features/usdt-swaps/`,
> igual que `features/auth` y `features/portfolio` (lee los dos stores; solo lo importa `app/`).

### 7a.1 Modelo — intercambio USDT ↔ cripto

Se guarda como **dos operaciones enlazadas por `usdtSwapId`** (mismo patrón que `swapId` de los
intercambios cripto ↔ cripto). Datos que carga el usuario: dirección, USDT, moneda, cantidad de la
moneda, fecha, comisión opcional y la cotización del dólar cripto en ARS (ver abajo).

| Dirección        | Pata Dólar (grupo `cripto`)                                 | Pata Cripto                         |
| ---------------- | ----------------------------------------------------------- | ----------------------------------- |
| USDT → cripto    | `SELL` de los USDT entregados, `pesosAmount` = USDT × cotización | `BUY` de `quantity` unidades   |
| cripto → USDT    | `BUY` de los USDT recibidos, `pesosAmount` = USDT × cotización   | `SELL` de `quantity` unidades  |

- **Precio de la pata cripto:** `priceUsd` = USDT de la pata dólar / `quantity` (1 USDT = 1 USD, como
  ya asume el módulo Cripto).
- **Comisión:** en USDT o en la moneda (no en "USD" suelto).
  - *En USDT:* se integra al monto de la pata dólar — USDT → cripto entrega `usdt + fee`; cripto → USDT
    recibe `usdt − fee` — y el `priceUsd` de la pata cripto usa ese monto, así el costo (o lo cobrado)
    ya incluye la comisión. Un `fee` en USD sobre la pata cripto **no** descontaría USDT del saldo del
    módulo Dólar y lo dejaría inflado para siempre.
  - *En la moneda:* `fee` con `currency: 'COIN'` en la pata cripto, como hoy.
  - El formulario muestra la comisión aparte y guarda la pata dólar con el monto neto que movió el saldo.
- **Pesos de la pata dólar:** el módulo Dólar mide en ARS, así que la pata necesita un monto en
  pesos. Se autocompleta con el **dólar cripto** de ese día (DolarAPI hoy; ArgentinaDatos para fechas
  pasadas, vía `/api/history/dolar`): `compra` si se entregan USDT, `venta` si se reciben. Editable.
  - *Por qué esa punta:* es la misma que usaría una operación normal del módulo Dólar ese día —
    entregar USDT equivale a venderlos (el mercado paga `compra`) y recibirlos, a comprarlos (cuesta
    `venta`). Así el PnL en ARS de un swap coincide con el de vender/comprar dólar cripto ese día.
  - *Sin cotización:* `/api/history/dolar` cubre el último año. Si ese día no hay dato se usa el último
    día anterior disponible (como `priceAt` en el gráfico) y se avisa; si la fecha es anterior al
    histórico, el campo queda vacío y es obligatorio (nunca se inventa una cotización).
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

Tareas (✅ oct 2026):

- [x] `Transaction.usdtSwapId?: string` y `CryptoTransaction.usdtSwapId?: string`.
- [x] `transactions-storage` v1 → **v2** y `crypto-storage` v2 → **v3**, cada uno con `migrate`
      (campos opcionales: los datos viejos ya son válidos) + test con snapshot.
- [x] Prisma: `usdtSwapId String? @db.Uuid` + `@@index([usdtSwapId])` en `DolarTransaction` y
      `CryptoTransaction` (migración `20261003222618_usdt_swaps`: solo agrega columnas e índices).
- [x] `src/features/usdt-swaps/operations.ts` (puro, store + server):
  - `buildUsdtSwapLegs(input, ids)` → `[Transaction, CryptoTransaction]` según la dirección, con la
    comisión en USDT integrada al monto de la pata dólar (`usdtMoved`).
  - `applyAddUsdtSwap({ dolar, crypto }, input, ids)`: valida el saldo de USDT del grupo `cripto`
    ("No tenés suficientes USDT el dd/MM/yyyy.") y el de la moneda (`assertCoinTimeline`, ahora
    exportada por `features/crypto/operations`); rechaza `tether` y cantidades o cotización inválidas.
  - `applyRemoveUsdtSwap({ dolar, crypto }, usdtSwapId)`: quita las dos patas y revalida las dos
    líneas temporales (los USDT o la cripto recibidos pueden haberse vendido después).
  - `assertUsdtSwapsComplete`: para la importación, una pata del dólar cripto y una del módulo cripto
    por intercambio.
- [x] Las funciones de cada módulo **rechazan** editar o borrar una pata sola
      (`applyUpdate/RemoveTransaction`, `applyUpdate/RemoveCryptoTransaction`) con
      `USDT_SWAP_LEG_UPDATE` / `USDT_SWAP_LEG_REMOVE` (`src/domain/transactions.ts`).
- [x] Tests en `src/features/usdt-swaps/__tests__/` (las dos direcciones, comisión en USDT y en la
      moneda, sin saldo de USDT, sin saldo de la moneda, borrado, patas sueltas en los dos módulos,
      cotización del día y esquema del formulario).

### 7a.2 API y sincronización

- [x] `POST /api/usdt-swaps` (`{ swap, ids }`) y `DELETE /api/usdt-swaps/:usdtSwapId`:
      `requireUserId` → Zod (`usdtSwapApiSchema`) → `src/server/usdt-swaps.ts`, que carga **los dos**
      estados del usuario, aplica `applyAddUsdtSwap` / `applyRemoveUsdtSwap` y escribe las dos tablas
      en una sola `withUserTransaction` (`Serializable`). 401/400/404/409/422 como el resto; logs
      `usdtSwap.created` / `usdtSwap.removed` sin montos.
- [x] `PATCH`/`DELETE` de `/api/{dolar,crypto}/transactions/:id` sobre una pata → 422 (lo hacen solas
      las funciones puras de 7a.1). El alta de cada módulo descarta `usdtSwapId` (Zod): una operación
      normal no se puede convertir en pata.
- [x] `importSchema` / `toImportPayload` llevan `usdtSwapId` (los ids viejos se remapean igual que
      `swapId`); al importar se validan ambas líneas temporales y que cada `usdtSwapId` tenga sus dos
      patas (422 "Hay un intercambio con USDT incompleto."). `localNotInCloud` no cambia (compara ids).
- [x] Tests de la API en `src/server/__tests__/` (alta y borrado atómicos, ownership, 422 por saldo,
      patas sueltas, import con intercambios USDT, mappers).

### 7a.3 Stores y UI

- [x] Cada store expone `applyExternal(next, remote)` (es `sync.commit`) para que
      `features/usdt-swaps` actualice los dos de forma optimista con **una** sola llamada a la API
      (`actions.ts` comparte el request entre los dos); si falla, cada uno revierte lo suyo.
- [x] `features/usdt-swaps/actions.ts`: `addUsdtSwap`, `removeUsdtSwap` (funciones, no hooks: leen el
      estado actual de los dos stores con `getState()`).
- [x] **Formulario de intercambio** único (`features/usdt-swaps/components/SwapForm.tsx`, reemplaza a
      `CryptoSwapForm`): en el selector de origen y de destino aparece primero **"Dólar cripto · USDT"**
      con su saldo (opción fija `pinned` de `CoinCombobox`); si un lado es USDT, pide la cotización ARS
      (autocompletada: DolarAPI hoy, histórico para fechas pasadas, sin pisar lo que escribe el usuario)
      y la comisión en USDT o en la moneda; si no, sigue siendo el intercambio cripto ↔ cripto. Muestra
      el precio implícito y los USDT que se mueven. `NewCryptoTransaction` lo recibe por la prop
      `swapForm` desde la página (el módulo cripto no importa el composer).
- [x] Atajo desde `/dolar`: en el grupo "cripto" con saldo, botón "Intercambiar USDT" →
      `/cripto/nueva?modo=intercambio&desde=usdt`.
- [x] Historiales: en las dos listas, el otro lado ("por 0,01 BTC" / "desde 600,60 USDT"), sin editar,
      y borrar elimina las dos patas (confirmación que lo aclara). En `/dolar`, el grupo "cripto" se
      rotula "Dólar cripto (USDT)". **Sin romper la regla de módulos:** las listas no importan
      `features/usdt-swaps`; usan el contexto `useUsdtSwapLinks` (`src/hooks/`), que provee
      `UsdtSwapLinksProvider` desde `app/providers.tsx`. *Cambio respecto del plan:* se pensó en props
      desde las páginas, pero son de servidor y no pueden pasar funciones.
- [x] Dashboard: sin cambios de cálculo; el E2E verifica que el total no se duplique ni pierda valor.
- [x] E2E: `e2e/usdt-swaps.spec.ts` (USDT → BTC con comisión → USDT, borrado bloqueado y completo desde
      cada lista, saldo insuficiente, cripto ↔ cripto con el form nuevo) y el mismo alta + borrado con
      sesión en `e2e/sync.cloud.spec.ts`.

**Criterio de salida 7a:** con los USDT comprados como dólar cripto se puede hacer swap a cualquier
cripto y volver, con saldos y PnL correctos en los dos módulos (comisiones incluidas), en local y en
la nube, sin poder dejar patas sueltas.

### 7b.1 Modelo — resultado de trade en una moneda

Nueva variante de operación con `kind: 'TRADE_RESULT'` (sin `kind` = compra/venta normal), usando el
`type` existente: `BUY` = ganancia (entran unidades), `SELL` = pérdida (salen unidades), más
`note?` (p. ej. "BTCUSDT long x10"). Sin comisión: se carga el resultado neto.

> **Decisión: reusar `BUY`/`SELL` en vez de tipos nuevos.** El motor, `sortTxs`, `findNegativeBalance`
> y `computeValueHistory` ya funcionan con entradas y salidas de unidades; tipos nuevos
> (`TRADE_GAIN`/`TRADE_LOSS`) obligarían a tocarlos todos, más el enum de Prisma. El costo es que
> cualquier código que lea `type === 'BUY'` como "compra" tratará una ganancia como compra: por eso
> hay una tarea de auditoría y un único lugar para el texto de cada operación.

Como USDT vive en el módulo Dólar (7a), el resultado puede caer en dos lugares:

- **En USDT** (el caso típico de futuros): operación del grupo `cripto` del módulo Dólar, con
  `dollarsAmount` = USDT y `pesosAmount` = USDT × dólar cripto del día (autocompletado, editable,
  mismas reglas "sin cotización" que 7a.1).
- **En otra moneda:** operación del módulo Cripto, con `quantity` y `priceUsd` del día
  (autocompletado; para fechas pasadas, el histórico de CoinGecko).

Contabilidad (igual en los dos módulos, cada uno en su unidad: ARS en Dólar, USD en Cripto):

- **Ganancia:** las unidades entran con costo = valor de mercado y ese mismo valor se suma al
  **PnL realizado**. Lo que cambie el precio después es PnL no realizado, como con cualquier compra.
- **Pérdida:** las unidades salen sin cobrar nada (`quoteAmount = 0`) → el motor ya realiza
  `−costo promedio × cantidad`. No necesita cambios.
- Motor: `PositionLot` suma `realizedProfit?: number` (ajuste directo al PnL realizado, por defecto
  0). Tests en `src/domain/__tests__/position.test.ts`.
- **"Invertido" pasa a ser "Costo".** El `invested` del motor es el costo base de la posición abierta
  (`quantity × averageCost`), no la plata aportada. Una ganancia de trade lo sube por el valor de
  mercado de lo recibido, y con el rótulo actual parecería que el usuario "invirtió" más. Se renombra
  en la UI ("Costo" en `TransactionList`, `CryptoPortfolio` y `CryptoCoinDetail`) sin cambiar el cálculo.
- La línea temporal (`findNegativeBalance`) ya funciona: una pérdida es una salida de unidades y no
  puede dejar el saldo negativo. `computeValueHistory` también (usa las cantidades).

Tareas (✅ oct 2026):

- [x] `kind?: 'TRADE_RESULT'` y `note?: string` en `Transaction` y `CryptoTransaction`;
      `transactions-storage` v2 → **v3** y `crypto-storage` v3 → **v4** con `migrate` + test con snapshot.
- [x] Prisma: `enum OperationKind { TRADE_RESULT }`, `kind OperationKind?` y `note String?` en las dos
      tablas (migración `trade_results`); `mappers.ts` ida y vuelta.
- [x] **Auditoría de `type`:** el motor, `sortTxs`, `findNegativeBalance` y `computeValueHistory` no
      cambian (mueven cantidades); el dashboard tampoco (su ganancia es realizado + no realizado). Cambian
      los lotes de cada módulo (`toDolarLot`, `toPositionLot`), los textos de las listas
      (`operationLabel` en `src/lib/operation-label.ts`) y los formularios (uno propio por módulo).
- [x] Motor: `PositionLot.realizedProfit?` (ajuste directo) y `trade?`; `Position.tradeProfit`.
      Dólar: `TransactionsData.tradeProfit` (ARS, también en el total). Cripto: `tradePnlUsd` en
      `CryptoPosition` y `CryptoPortfolioSummary`. Tests en `src/domain/__tests__/position.test.ts`,
      `metrics.test.ts` y `src/features/crypto/__tests__/metrics.test.ts`.
- [x] Zod (API de los dos módulos e importación): aceptan `kind`/`note` (nota hasta 200 caracteres). La
      forma la validan las funciones puras (`assertDolarShape`: solo en el dólar cripto;
      `assertCryptoShape`: sin comisión ni `swapId`/`usdtSwapId`) → 422 con el mismo mensaje.
- [x] Se edita (es una operación sola) con su propio formulario y la misma revalidación.
- [x] `importSchema` / `toImportPayload` llevan `kind` y `note` (pasan tal cual).
- *Decisión de implementación:* se guarda siempre el **valor de mercado** (pesos en el dólar,
  `priceUsd` del día en cripto), también en las pérdidas; es el lote del motor el que pone `0` como
  cobrado. Así la fila muestra cuánto valía lo perdido y el formulario es igual para los dos casos.

### 7b.2 UI

- [x] **Pestaña "Resultado de trade"** en `/cripto/nueva` (`?modo=resultado`, `NewTradeResult` en
      `features/usdt-swaps`): se elige la moneda, con "Dólar cripto · USDT" primero. En USDT abre
      `TradeResultForm` (módulo Dólar: cotización autocompletada con `useDolarCriptoRate`, venta si es
      ganancia y compra si es pérdida); en otra moneda, `CryptoTradeResultForm` (módulo Cripto: "Usar
      precio del día" con el precio actual o el histórico de CoinGecko). Ganancia/pérdida, nota y fecha.
- [x] Historiales: "Ganancia de trade" / "Pérdida de trade" con la nota debajo; la edición abre el form
      de trade.
- [x] Resúmenes (dólar, total, cripto y detalle por moneda): "El realizado incluye … de resultados de
      trades."; "Invertido" → "Costo".
- [x] E2E: `e2e/trade-results.spec.ts` (ganancia en USDT y edición, pérdida en BTC, pérdida sin saldo)
      y el alta con sesión en `e2e/sync.cloud.spec.ts`.

**Arreglo encontrado en el camino:** al recargar la página con sesión, los stores están `pending`
(Clerk sin resolver) o `loading` (sin los datos de la nube). Una escritura en ese momento iba a lo
local, o se validaba contra un estado vacío. Ahora cada acción espera `whenReady`
(`src/lib/synced-store.ts`), con tests en `transaction.store.cloud.test.ts`. Lo destapó el E2E con
sesión, que fallaba de forma intermitente.

**Criterio de salida 7b:** se pueden cargar ganancias o pérdidas de trades en USDT o en cualquier
moneda, con saldos y PnL correctos en los dos módulos, en local y en la nube.

---

## Fase 8 — Pesos y conversiones a dólar ✅

**Objetivo:** registrar los pesos del portafolio, ver el saldo (también en el dashboard) y
convertirlos a cualquier tipo de dólar y de vuelta. Se **fusiona a `main` sola**, apenas esté
verificada, sin esperar a CEDEARs.

> Plan y decisiones (D1–D3, D8, D9) en [`roadmap-cedears.md`](roadmap-cedears.md#decisiones). Las más
> relevantes acá: los pesos son un saldo sin PnL y pasan a USD con el **MEP venta** (D3); una
> conversión son dos patas del mismo rango enlazadas por `conversionId`, que no se editan y se borran
> juntas (D9); las patas guardan un id por tipo de enlace y `linkOf(tx)` centraliza la regla (D8).

**Modelo** (`features/pesos/types.ts`):

```ts
type PesosMovement = {
  id: string
  type: TransactionType          // BUY = ingreso, SELL = egreso (sortTxs: ingresos primero el mismo día)
  amount: number                 // ARS, > 0
  date: Date | string
  note?: string                  // "Sueldo", "Transferencia desde banco"
  conversionId?: string          // pata de una conversión pesos ↔ dólar (D9)
  // cedearId?: string           // pata de una operación de CEDEAR (D8); se agrega en la Fase 9
}

// Dólar (`types/transaction.types.ts`): `Transaction` suma `conversionId?: string`
```

### 8.1 Módulo Pesos

- [x] Funciones puras (`features/pesos/operations.ts`): `applyAdd/Update/RemovePesosMovement`,
      `validatePesosTimeline` (saldo nunca negativo con `findNegativeBalance`; mensaje "No tenés pesos
      suficientes el dd/MM/yyyy."), `computePesosBalance` y `assertPesosShape`. Editar o borrar una
      pata (`conversionId`) se rechaza (como `USDT_SWAP_LEG_UPDATE/REMOVE`). Tests en
      `features/pesos/__tests__/`.
- [x] Store `usePesosStore` (`pesos-storage`, `version: 1`, `partialize` con lo local), con
      `createSync`, `whenReady`/`untilReady` en cada acción y `applyExternal`.
- [x] Composers: conectarlo en `CloudSync` (lista `stores`), sumarlo a `useCloudStatus` (estado,
      `pendingWrites`, `retry`) y a la importación: `LocalData.pesos`, `countLocalData`,
      `localDataIds`, `excludeIds`, `toImportPayload` (remapea `conversionId`), `useLocalImport`
      (`refreshCloud` de los tres stores), `importSchema` y `server/import.ts` (validar la línea de
      pesos con lo existente + lo nuevo). `pesos` es opcional en el body (clientes viejos) y por ahora
      **sin** `conversionId`: lo suma la 8.2 junto con `assertConversionsComplete`.
- [x] Prisma: `PesosMovement` (`id` UUID del cliente, `userId`, `type`, `amount Decimal`, `date`,
      `note?`, `conversionId String? @db.Uuid`, índices `[userId, date]` y `[conversionId]`) y la
      relación en `User`; migración nueva (`20261005000000_pesos_movements`; la columna
      `conversionId` del Dólar va en otra, en la 8.2). `mappers.ts`: ida y vuelta.
- [x] API `/api/pesos/movements[/:id]` (GET/POST, PATCH/DELETE) con el patrón de siempre:
      `requireUserId` → Zod (sin `conversionId`: los endpoints no crean patas) → servicio
      `server/pesos-movements.ts` con ownership y validación de línea temporal → 401/400/404/409/422;
      logs `pesos.*` sin montos. Tests en `src/server/__tests__/`.
- [x] `operationLabel`: "Ingreso" / "Egreso" para Pesos con una función hermana,
      `pesosMovementLabel`. El texto de las conversiones ("Compra de USD Blue" / "Venta de USD Blue"
      vista desde Pesos) queda para la 8.2.
- [x] UI: sección **Pesos** en `sections.ts` (`/pesos`, `/pesos/nueva`, ícono `Banknote`): saldo ARS,
      equivalente USD (MEP venta), historial con edición/borrado y formulario ingreso/egreso con nota
      (`SyncGate` en las vistas de datos). E2E local en `e2e/pesos.spec.ts`.

### 8.2 Conversiones pesos ↔ dólar (D9)

- [x] Dólar: `conversionId?` en `Transaction`. `transactions-storage` v3 → **v4** con `migrate`
      (campo opcional: los datos viejos son válidos) + test con snapshot. Prisma: `conversionId
      String? @db.Uuid` + `@@index([conversionId])` en `DolarTransaction` (migración propia,
      `20261005120000_dolar_conversions`);
      `mappers.ts` ida y vuelta.
- [x] Reglas de forma con `linkOf(tx)` (D8): una operación del Dólar tiene como mucho un enlace
      (`usdtSwapId` o `conversionId`) y una pata de conversión no es un resultado de trade.
      `applyUpdateTransaction` / `applyRemoveTransaction` rechazan una pata de conversión ("Es una
      conversión de pesos: borrala completa."). La API del Dólar devuelve 422 sola. Tests en
      `src/domain/__tests__/`.
- [x] Funciones puras (`features/pesos/conversions.ts`, store + server): `buildConversionLegs(input,
      ids)` → `[pata pesos, pata dólar]` con el mismo monto en ARS; `applyAddConversion` (valida los
      pesos en Pesos → dólar y los USD del grupo en Dólar → pesos; montos > 0) y
      `applyRemoveConversion` (revalida las dos líneas); `assertConversionsComplete` para la
      importación (cada `conversionId`: una pata en cada módulo, de tipos opuestos y con el mismo monto
      en ARS; si no, 422, como `assertUsdtSwapsComplete`).
- [x] Llevar `commitBoth` y `once` de `features/usdt-swaps/actions.ts` a `lib/synced-store.ts` como
      `commitAcross([write(store, next), …], remote)`, para N stores. `usdt-swaps` lo usa sin cambiar de
      comportamiento. Test: si falla el request, cada store revierte lo suyo.
- [x] Server: `loadLinkedState` de `server/usdt-swaps.ts` pasa a un helper compartido que carga los
      módulos pedidos (`dolar`, `crypto`, `pesos`; `cedears` en la Fase 9) dentro de la misma
      `withUserTransaction`. `POST /api/pesos/conversions` (input + ids del cliente) y
      `DELETE /api/pesos/conversions/:conversionId` escriben las dos tablas en una transacción
      `Serializable` (`server/pesos-conversions.ts`); logs `pesosConversion.*`. Tests: atomicidad,
      ownership, 422 por saldo, pata editada o borrada desde `/api/dolar` o `/api/pesos` → 422.
- [x] Cotización de referencia: generalizar `fetchCriptoHistory` → `fetchDolarHistory(option)` y
      `useDolarCriptoRate` → `useDolarRate(option, side, date)` (el de cripto pasa a ser un caso).
- [x] UI: pestaña **Convertir** en `/pesos/nueva` (`?modo=conversion&dolar=<tipo>`): dirección,
      tipo de dólar, fecha, monto ARS, monto USD, cotización de referencia y cotización implícita, y
      el saldo disponible (pesos o USD de ese tipo). Atajo "Comprar con pesos" en `/dolar`. En `/dolar`
      la pata se ve con un distintivo "Pesos" y sin editar; borrarla borra la conversión completa por
      el contexto `use-pesos-conversion-links` (`hooks/`, provisto por `features/pesos` en
      `app/providers.tsx`). El atajo abre `/pesos/nueva?modo=conversion` (sin tipo preseleccionado;
      `&dolar=` funciona igual). Desde Pesos, la pata se ve como "Compra de USD Blue" con los USD y
      la cotización implícita.

### 8.3 Pesos en el dashboard (estaba en la Fase 10)

- [x] `overview.ts`: módulo `pesos` (activo `pesos:ars`, drill-down a `/pesos`): `valueArs` = saldo,
      `valueUsd` = saldo / MEP venta. Sin cotización MEP no entra a la composición y se avisa (como
      `missingPrices`). Sin PnL: `ModuleSummary.pnl` admite `null` y la tarjeta no lo muestra.
      La tarjeta "Pesos" del resumen aparece solo si hay movimientos (saldo + equivalente MEP).
- [x] `history.ts`: saldo de pesos por día; ARS = saldo, USD = saldo / MEP venta de ese día
      (`priceAt`). `useValueHistory` pide `bolsa` cuando hay pesos. Sin cotización → `null`.
- [x] `usePortfolioOverview`: estado combinado de los tres stores, `hasOperations` y `retry` con Pesos.
- [x] Verificar (test en `overview.test.ts`): una conversión no cambia el total en ARS si se hizo a la cotización de valuación, y en
      USD solo cambia por la diferencia entre la cotización usada y el MEP (ej. pesos a blue).

### 8.4 Cierre

- [x] E2E: ingreso; egreso sin saldo (error); borrado que dejaría saldo negativo (error); conversión
      pesos → blue (baja el saldo de pesos y aparece en `/dolar`); la pata no se edita desde `/dolar` y
      borrarla ahí borra las dos; dólar → pesos; conversión sin saldo (error). Con sesión en
      `e2e/sync.cloud.spec.ts`: alta, conversión e importación de lo local.
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (311 tests), E2E `local` (15) y `cloud`
      (7, contra la rama de desarrollo de Neon) y el flujo en `pnpm dev` con sesión: `/pesos`, pestaña
      Convertir, patas en `/dolar` sin editar y Pesos en el dashboard, sin errores en la consola.
- [x] Documentación: este detalle, `AGENTS.md` (módulo, storage `pesos-storage` y
      `transactions-storage` v4, la excepción de dependencias de D2), `README.md` y `docs/roadmap.md`.
- [x] PR a `main` (oct 2026).

**Criterio de salida:** se cargan ingresos y egresos de pesos y se convierten a cualquier dólar y de
vuelta, en local y en la nube; ningún saldo queda negativo; lo local se puede subir al iniciar sesión;
el dashboard suma los pesos.

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
