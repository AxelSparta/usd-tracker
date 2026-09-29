# Roadmap de Implementación — de DolarTracker a Portfolio Tracker

Este roadmap define la evolución del producto en cuatro ejes:

1. **Login** para dejar de depender solo del `localStorage`.
2. **Persistencia en la nube** (Neon + Prisma) con sincronización local ↔ cloud.
3. **Convertir el módulo de dólar en *una parte*** de la app (arquitectura multi-asset).
4. **Transacciones de cripto + portfolio tracker de criptos.**

> Guía de uso: cada fase es un hito desplegable por sí mismo. La Fase 0 es
> prerrequisito de todo (sin desacoplamiento ni tests no se puede escalar limpio).
> Las Fases 1–3 son el camino de auth + nube; la Fase 4 (cripto) solo depende de la 0,
> y la 5 depende de la 4. Los checkboxes son pasos concretos.

---

## Estado actual (septiembre 2026)

### Lo que funciona hoy

- Alta de transacciones BUY/SELL en ARS/USD con tipo de dólar (`DolarOption`) y validación Zod.
- Historial agrupado por tipo de dólar con borrado confirmado.
- Métricas por grupo en `updateTransactionsData` (`src/store/transaction.store.ts`):
  posición USD, costo promedio, invertido ARS, valor de mercado,
  PnL realizado (costo promedio) y no realizado (marca a mercado con la cotización del mismo tipo de dólar).
- Cotizaciones DolarAPI (`src/services/dolarApi.ts`) con refresh cada 5 min en `providers.tsx`.
- Persistencia local: Zustand `persist` → `transactions-storage` y `dolar-storage`.
- Tema claro/oscuro/sistema, toasts (Sonner), UI en español.

### Hallazgos técnicos relevantes para la escala

| #   | Hallazgo | Impacto |
| --- | -------- | ------- |
| 1   | ~~El cálculo leía directamente `useDolarStore`~~ — resuelto: `src/domain/metrics.ts` recibe un `MarketPriceMap` | — |
| 2   | Todo el estado usa claves `Record<DolarOption, ...>` (`transactions`, `transactionsData`, `allDolarData`) | Las claves deben generalizarse a `AssetKey` (ej.: `dolar:blue`, `crypto:BTC`) |
| 3   | El dominio está implícito: unidad = USD, reporte = ARS (`pesosAmount` / `dollarsAmount`) | Para cripto hay que definir moneda base de reporte y conversión ARS↔USD |
| 4   | `persist` sin `version`/`migrate` | Cambiar el enum/schema rompería datos guardados de usuarios reales |
| 5   | Ramas API existentes (`isSignedIn`) son código muerto: los call sites hardcodean `false`, no existe `GET`, y los endpoints `POST`/`DELETE` no existen; los fallos son **silenciosos** | La fase de auth/cloud debe reconstruir este flujo con manejo real de errores |
| 6   | ~~No hay ningún test~~ — resuelto: Vitest cubre `src/domain` y `src/lib/locale-amount` | — |
| 7   | ~~`pnpm lint` roto (Next 16 eliminó `next lint`)~~ — resuelto: ESLint 9 CLI + `eslint-config-next` | — |
| 8   | ~~Ciclo de imports `types` ↔ `validations`~~ — resuelto: `Transaction` es un tipo de dominio explícito | — |
| 9   | ~~Fechas futuras solo bloqueadas en el `<Calendar>`~~ — resuelto: `refine` en el schema Zod | — |
| 10  | Deuda menor: `ui/dialog` y `ui/alert-dialog` sin consumidores; `metadata` sin `metadataBase` (las imágenes OG/Twitter se resuelven contra `localhost:3000` en el build) | Limpieza en Fase 0 |

### Rutas clave

- `src/store/transaction.store.ts` — estado + cálculos + persistencia.
- `src/store/dolar.store.ts` — cotizaciones.
- `src/types/{transaction,dolar}.types.ts`, `src/validations/transaction.ts`, `src/lib/locale-amount.ts`.
- `src/components/{TransactionList,NewTransactionForm,DolarPrice}.tsx`.
- `src/app/{page,providers,new-transaction/page}.tsx`.

---

## Visión de arquitectura objetivo

```
prisma/
└── schema.prisma                # Fase 2 (cliente generado en src/generated/prisma, ya ignorado)
proxy.ts                         # Fase 1: clerkMiddleware() (Next 16 renombró middleware → proxy)
src/
├── app/
│   ├── api/transactions/        # CRUD protegido (Prisma + Neon)
│   ├── (dashboard)/…            # rutas de UI
│   └── not-found.tsx
├── domain/                      # motor agnóstico de activo: TS puro, sin React ni stores
│   ├── asset.ts                 # AssetKey, AssetCategory, helpers dolar:* ↔ DolarOption
│   ├── transaction.ts           # tipo Transaction de dominio + schema Zod compartido cliente/server
│   ├── metrics.ts               # updateTransactionsData generalizado (recibe MarketPriceMap)
│   ├── timeline.ts              # validateTimeline + sortTxs
│   └── __tests__/
├── features/
│   ├── dolar/                   # lo que hoy es la app entera, encapsulado
│   │   ├── dolar.store.ts
│   │   ├── dolarApi.ts
│   │   └── components/ (DolarPrice, selectores de tipo de dólar)
│   ├── crypto/
│   │   ├── crypto.store.ts
│   │   ├── cryptoApi.ts         # CoinGecko / Binance
│   │   └── components/
│   ├── transactions/            # store + form + listado (multi-asset)
│   │   ├── transactions.store.ts
│   │   ├── repository.ts        # interfaz local | remote (ver Fase 3)
│   │   └── components/
│   └── auth/                    # estado de sesión, sync local → cloud
├── components/ui/               # primitivos shadcn (sin cambios)
├── lib/                         # utilidades genéricas (locale-amount, cn)
└── server/                      # solo server: prisma client, queries con ownership check
```

- **Un solo motor de cálculo** para dólar y cripto; cada feature aporta su fuente de precios detrás de una interfaz común: `MarketPriceMap = Record<AssetKey, { buy: number; sell: number }>`.
- **Transacción genérica**: `category` (`dolar` | `crypto`), `assetKey`, `quantity`, `quoteAmount` (ARS), `type`, `date`, `userId` (cloud).
- **Reglas de dependencias**: `domain` no importa nada de `features`, `app` ni `store`; `features/*` no se importan entre sí salvo vía `domain` (la composición de precios vive en un selector/hook de `app`). `server/` nunca se importa desde componentes cliente (usar `import 'server-only'`).
- **Repositorio de transacciones**: el store habla con una interfaz `TransactionRepository` (`list/create/update/remove`) con implementaciones `localRepository` y `apiRepository`; así la rama `isSignedIn` deja de estar dispersa en cada acción.

---

## Fase 0 — Fundación técnica y desacoplamiento (multi-asset ready)

**Objetivo:** que la matemática y los tipos no estén atados al dólar, con tests y lint que la blinden. *No cambia funcionalidad visible.*

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
- [ ] **Generalizar claves**: introducir `type AssetKey = string` (formato
  `dolar:blue`, `crypto:BTC`) y `AssetCategory = 'dolar' | 'crypto'`. Mantener
  compatibilidad con `DolarOption` vía helpers de conversión.
- [ ] **Migración de persistencia**: añadir `version: 1` + `migrate` al `persist` de
  `transactions-storage` que convierta el formato viejo (`Record<DolarOption, Transaction[]>`)
  al nuevo (lista plana con `category` + `assetKey`). *Decisión clave: pasar de
  mapa agrupado a lista única con agrupación en selectors.* Testear la migración con un
  snapshot real de `localStorage`.
- [ ] **Métricas derivadas, no persistidas**: `transactionsData` pasa a ser un selector
  memoizado (transacciones + precios → métricas) en lugar de estado que se sincroniza a mano.
- [ ] **Definir moneda base de reporte** (decisión de producto):
  - Opción A: todo reporta en ARS (coherente con el usuario argentino; cripto
    convierte vía cotización USD/ARS).
  - Opción B: reporta en USD/USDT con toggle ARS.
  - Recomendación: **ARS como base**, con valor alternativo en USD.
- [x] **Validación de fecha en el schema**: rechazar fechas futuras en Zod, no solo en el `<Calendar>`.
- [ ] **Métricas globales agregadas**: total del portfolio (todas las claves
  combinadas) además de las métricas por grupo.
- [ ] **Edición de transacciones** (hoy solo alta/borrado), revalidando la timeline.
- [ ] **Banner "Modo local"** en la UI (se oculta en la Fase 3).
- [x] Limpieza: `404.tsx` → `not-found.tsx`, eliminar `getDolar()` y `usdPrice`, errores
  de red de DolarAPI con toast (y chequeo de `response.ok`).
- [ ] `ui/dialog`/`ui/alert-dialog` sin uso: reutilizarlos en la edición de transacciones o eliminarlos.
- [ ] `metadataBase` en `src/app/layout.tsx` para que las imágenes OG apunten al dominio real.

**Criterio de salida:** `pnpm lint`, `pnpm typecheck` y `pnpm test` verdes, la app se
comporta idéntico para el usuario (datos viejos migrados) y el dominio no importa ningún store.

---

## Fase 1 — Autenticación (Clerk)

**Objetivo:** identificar al usuario. *Solo login; los datos siguen en local.*

- [ ] Crear proyecto en el Dashboard de **Clerk** (variables en `.env.local`, nunca
  commiteadas; documentar nombres en un `.env.example` con `!.env.example` en `.gitignore`).
- [ ] Instalar `@clerk/nextjs`; `<ClerkProvider>` en el layout raíz (o `ClientProviders`).
- [ ] `proxy.ts` en la raíz con `clerkMiddleware()` + `createRouteMatcher` para proteger
  `/api/*` (y `/new-transaction` solo si se abandona el modo anónimo; el modo local debe seguir funcionando sin login).
- [ ] `<UserButton />` / `<SignInButton />` en `Header.tsx` + estados signed-in/out.
- [ ] **Estado de sesión en el cliente**: derivar `isSignedIn` de Clerk (reemplazar los
  `isSignedIn: false` hardcodeados en `NewTransactionForm.tsx` y `TransactionList.tsx`).
- [ ] Server-side: `auth()` de `@clerk/nextjs/server` en route handlers / server components
  (sin necesidad de `GET /api/me`).

**Criterio de salida:** se puede registrarse/iniciar sesión en la app, sin cambios en
la persistencia todavía.

---

## Fase 2 — Persistencia cloud (Neon + Prisma)

**Objetivo:** las transacciones viven en Postgres para usuarios autenticados.

- [ ] Instancia en **Neon.tech** + `prisma` / `@prisma/client`; `prisma init`
  (output del cliente en `src/generated/prisma`, ya ignorado en git).
- [ ] **Schema** (versión inicial alineada al modelo generalizado de la Fase 0):

  ```prisma
  model User {
    id           String        @id          // clerkId
    transactions Transaction[]
  }

  model Transaction {
    id          String   @id @default(uuid())
    userId      String
    user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    category    String            // 'dolar' | 'crypto'
    assetKey    String            // 'dolar:blue' | 'crypto:BTC'
    type        String            // 'BUY' | 'SELL'
    quantity    Decimal           // USD o unidades de cripto
    quoteAmount Decimal           // monto pagado/recibido en ARS
    date        DateTime
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
    @@index([userId, category, assetKey, date])
  }
  ```

- [ ] **API CRUD** en `src/app/api/transactions/` (lógica en `src/server/`):
  - `GET /api/transactions?category=` — listar del usuario (auth por `clerkId`).
  - `POST /api/transactions` — crear (validar con el esquema Zod de `src/domain/`).
  - `PATCH /api/transactions/:id` — editar.
  - `DELETE /api/transactions/:id` — borrar.
  - Ownership check en cada operación (un usuario no toca datos de otro).
  - `Decimal` ↔ `number`: convertir en un único mapper server-side.
- [ ] **Reconstruir la rama remota del store** vía `apiRepository` (hoy falla silenciosamente):
  fetch inicial (`GET`), optimistic updates con rollback, toasts de error reales,
  estados de carga/offline.
- [ ] **Validación timeline en el server** (misma función del dominio que los tests
  ya cubren) para que no dependa del cliente.
- [ ] Paridad local/cloud: mismos cálculos, mismos errores.

**Criterio de salida:** con sesión iniciada, crear/editar/borrar sobrevive a un
refresco y a otro dispositivo; sin sesión, todo sigue funcionando en local.

---

## Fase 3 — Integración híbrida y sincronización

**Objetivo:** un solo flujo de verdad según la sesión.

- [ ] Selección de repositorio en el store: `isSignedIn` → `apiRepository`; caso contrario → `localRepository`.
- [ ] **Migración inicial**: al primer login, detectar transacciones locales y ofrecer
  (dialog) subirlas a la nube; idempotencia por `id` (los `crypto.randomUUID()`
  locales pueden conservarse como IDs).
- [ ] Logout: no borrar locales automáticamente (pensado en re-login / uso offline).
- [ ] Ocultar banner "Modo local" al autenticarse; reflejar estado de sync
  ("sincronizado / pendiente").
- [ ] Manejo de conflictos simples (la nube manda tras el primer sync; documentar la regla).

**Criterio de salida:** flujo continuo local → login → nube sin pérdida de datos.

---

## Fase 4 — Módulo de Cripto (transacciones)

**Objetivo:** que la app tenga dos clases de activo: dólar (lo actual) y cripto.

- [ ] **Fuente de precios**: elegir API (CoinGecko gratuita / Binance API);
  crear `src/features/crypto/cryptoApi.ts` (precio spot por símbolo, refresh
  configurable) y `crypto.store.ts` que exponga un `MarketPriceMap` con la misma forma que el de dólar.
- [ ] **Catálogo de activos**: const de símbolos soportados (`BTC`, `ETH`,
  `USDT`, `USDC`, …) con nombre y logo; extensible.
- [ ] **Tipos y validaciones**: schema Zod de transacción cripto — cantidad > 0,
  precio unitario o monto total, fecha sin futuras, y conversión a `quoteAmount` ARS
  usando la cotización USD/ARS vigente (`dolar:blue` o el tipo elegido).
- [ ] **Formulario unificado**: `NewTransactionForm` gana un selector de categoría
  (Dólar | Cripto) que muestra el campo de tipo de dólar o el de símbolo cripto;
  reutiliza el motor de cálculo y la validación de timeline (balance negativo por `assetKey`).
- [ ] **Historial**: `TransactionList` agrupa por `assetKey` con etiquetas por
  categoría (badges "Dólar"/"Cripto").
- [ ] **Métricas por símbolo**: costo promedio, PnL realizado/no realizado con el
  precio spot actual (mismo algoritmo ya testeado en la Fase 0).
- [ ] Suscripción: refresco de precios cripto → recálculo de métricas (con métricas
  derivadas por selector, esto sale gratis).

**Criterio de salida:** se puede comprar/vender BTC en ARS y ver posición, costo
promedio y PnL igual que con el dólar.

---

## Fase 5 — Portfolio Tracker

**Objetivo:** pasar de "listas de transacciones" a **vista de portfolio**.

- [ ] **Dashboard unificado**: valor total del portfolio (ARS y USD), desglose por
  categoría (dólar / cripto) y por activo, % de allocation, PnL total
  realizado + no realizado, costo total.
- [ ] **Gráficos** (sugerencia: `recharts`):
  - composición del portfolio (donut / barras de allocation),
  - evolución temporal del valor (snapshot diario: tabla `PortfolioSnapshot`
    en Prisma o cálculo desde transacciones + histórico de precios).
- [ ] **Detalle por activo**: drill-down desde el dashboard a la lista de
  transacciones filtrada (query param `?asset=crypto:BTC`).
- [ ] **Precios en vivo**: header con variación 24h para los activos en cartera; estados de
  carga y fallback si la API cae (retry + último valor cacheado).
- [ ] Cotizaciones dólar destacadas (hoy `DolarPrice`) como una tarjeta más dentro
  del dashboard, no como la pantalla principal.
- [ ] Extras (prioridad baja): export CSV/JSON, watchlist, refresh manual.

**Criterio de salida:** el usuario ve de un vistazo cuánto tiene, dónde, cuánto
ganó y cómo evolucionó.

---

## Fase 6 — Calidad, operación y despliegue

- [ ] CI (GitHub Actions): `pnpm lint` + `pnpm typecheck` + `pnpm test` + `pnpm build` en cada PR.
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

- La **Fase 4 (cripto)** solo requiere la Fase 0 para funcionar en local. Si se
  desarrolla en paralelo a las Fases 1–3, el riesgo de "refactor de sync dos veces"
  se mitiga porque ambas trabajan sobre el mismo modelo genérico (`assetKey`) y la
  interfaz `TransactionRepository`.
- La **Fase 6** es transversal: empezar con el pipeline de CI apenas hay tests (Fase 0).

---

*Actualizar este documento (y `AGENTS.md`) en el mismo PR de cada fase completada.*
