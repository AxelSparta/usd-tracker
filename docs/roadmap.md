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

## Fase 1 — Autenticación (Clerk)

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

## Fase 2 — Persistencia cloud (Neon + Prisma)

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

## Fase 3 — Integración híbrida y sincronización

**Objetivo:** un solo flujo de verdad según la sesión.

- [x] ~~Selección de repositorio en el store~~ — hecho en la Fase 2 (`source` local / nube según la sesión).
- [ ] **Migración inicial**: al primer login, detectar transacciones locales y ofrecer
  (dialog) subirlas a la nube; idempotencia por `id` (los `crypto.randomUUID()`
  locales pueden conservarse como IDs).
- [x] Logout: no borrar locales automáticamente — hecho en la Fase 2 (`disconnectCloud` restaura la copia local).
- [ ] Reflejar el estado de sync en el badge ("sincronizado / pendiente"); con sesión ya dice "En la nube" (Fase 2).
- [ ] Manejo de conflictos simples (la nube manda tras el primer sync; documentar la regla).

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

## Fase 5 — Portfolio Tracker

**Objetivo:** pasar de "listas de transacciones" a **vista de portfolio**.

- [ ] **Dashboard unificado** (en la home): valor total (ARS y USD) sumando los dos módulos,
  cada uno con sus propias métricas; la conversión USD ↔ ARS usa el dólar cripto para cripto
  y la cotización de cada tipo de dólar para el módulo dólar. Desglose por módulo y por activo,
  % de allocation.
- [ ] **Gráficos** (sugerencia: `recharts`):
  - composición del portfolio (donut / barras de allocation),
  - evolución temporal del valor (snapshot diario: tabla `PortfolioSnapshot`
    en Prisma o cálculo desde transacciones + histórico de precios).
- [ ] **Detalle por activo**: drill-down desde el dashboard a `/dolar` o `/cripto/[coinId]`.
- [ ] **Precios en vivo**: variación 24 h de los activos en cartera (cripto ya la trae de
  CoinGecko); estados de carga y fallback si la API cae.
- [ ] Cotizaciones dólar destacadas (hoy `DolarPrice`) como una tarjeta más dentro
  del dashboard, no como la pantalla principal.
- [ ] Extras (prioridad baja): export CSV/JSON, watchlist, refresh manual.

**Criterio de salida:** el usuario ve de un vistazo cuánto tiene, dónde, cuánto
ganó y cómo evolucionó.

---

## Fase 6 — Calidad, operación y despliegue

- [x] CI (GitHub Actions, `.github/workflows/ci.yml`): `pnpm lint` + `pnpm typecheck` + `pnpm test` + `pnpm build` en cada PR y en cada push a `main`.
- [ ] Tests E2E mínimos (Playwright): alta de transacción, login, sync.
- [ ] Manejo robusto de errores de red: retries/backoff para DolarAPI y la API de
  cripto, estados de fallback, toasts diferenciados.
- [ ] Rate limits y validación en `/api/*` (Zod en el server, ownership checks).
- [ ] Observabilidad: logging de errores (Sentry u opcional), eventos clave
  (alta, venta, login, sync).
- [ ] Deploy en Vercel + variables de entorno por ambiente; `prisma migrate deploy` en el deploy.
- [ ] Backups de Neon (point-in-time restore) y política de migraciones.
- [ ] Actualizar `README.md` y `AGENTS.md` con la arquitectura final.

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
```

**Notas:**

- La **Fase 4 (cripto)** solo requiere la Fase 0 para funcionar en local. Como es un
  módulo con su propio store, las Fases 2–3 deben sumarle su tabla, su API y su
  repositorio remoto (mismo patrón que dólar, sin modelo compartido).
- La **Fase 6** es transversal: empezar con el pipeline de CI apenas hay tests (Fase 0).

---

*Actualizar este documento (y `AGENTS.md`) en el mismo PR de cada fase completada.*
