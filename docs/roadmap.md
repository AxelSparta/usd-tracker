# Roadmap de Implementación — de DolarTracker a Portfolio Tracker

Este roadmap define la evolución del producto en cuatro ejes:

1. **Login** para dejar de depender solo del `localStorage`.
2. **Persistencia en la nube** (Neon + Prisma) con sincronización local ↔ cloud.
3. **Convertir el módulo de dólar en *una parte*** de la app (arquitectura multi-asset).
4. **Transacciones de cripto + portfolio tracker de criptos.**

> Guía de uso: cada fase es un hito desplegable por sí mismo. Las fases 0–2 son el
> camino crítico (sin desacoplamiento ni auth no se puede escalar limpio); la fase 3
> (cripto) depende de la 0, y la 4 depende de la 3. Los checkboxes son pasos concretos.

---



## Estado actual (septiembre 2026)



### Lo que funciona hoy

- Alta de transacciones BUY/SELL en ARS/USD con tipo de dólar (`DolarOption`) y validación Zod.
- Historial agrupado por tipo de dólar con borrado confirmado.
- Métricas por grupo en `updateTransactionsData` (`src/store/transaction.store.ts`):
posición USD, costo promedio, invertido ARS, valor de mercado,
PnL realizado (costo promedio) y no realizado (marca a mercado).
- Cotizaciones DolarAPI (`src/services/dolarApi.ts`) con refresh cada 5 min en `providers.tsx`.
- Persistencia local: Zustand `persist` → `transactions-storage` y `dolar-storage`.
- Tema claro/oscuro/sistema, toasts (Sonner), UI en español.



### Hallazgos técnicos relevantes para la escala


| #   | Hallazgo                                                                                                                                                                                                                   | Impacto                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | `updateTransactionsData` lee **directamente** `useDolarStore` (líneas ~148 y ~188): es la única dependencia del cálculo a una fuente concreta                                                                              | Hay que inyectar un "precio actual por grupo" para poder sumar cripto sin tocar la matemática |
| 2   | Todo el estado usa claves `Record<DolarOption, ...>` (`transactions`, `transactionsData`, `allDolarData`)                                                                                                                  | Las claves deben generalizarse a `AssetKey` (ej.: `dolar:blue`, `crypto:BTC`)                 |
| 3   | El dominio está implícito: unidad = USD, reporte = ARS (`pesosAmount` / `dollarsAmount`)                                                                                                                                   | Para cripto hay que definir moneda base de reporte y conversión ARS↔USD                       |
| 4   | `persist` sin `version`/`migrate`                                                                                                                                                                                          | Cambiar el enum/schema rompería datos guardados de usuarios reales                            |
| 5   | Ramas API existentes (`isSignedIn`) son código muerto: los call sites hardcodean `false`, no existe `GET`, y los endpoints `POST`/`DELETE` no existen; los fallos son **silenciosos**                                      | La fase de auth/cloud debe reconstruir este flujo con manejo real de errores                  |
| 6   | No hay ningún test; `pnpm` no tiene script de tests                                                                                                                                                                        | El cálculo financiero debe blindarse antes de refactorizar                                    |
| 7   | Deuda menor: `src/app/404.tsx` no aplica en App Router (debe ser `not-found.tsx`), `getDolar()` y `Transaction.usdPrice` sin uso, `ui/dialog` y `ui/alert-dialog` sin consumidores, `AGENTS.md` con líneas desactualizadas | Limpieza en fase 0                                                                            |




### Rutas clave

- `src/store/transaction.store.ts` — estado + cálculos + persistencia.
- `src/store/dolar.store.ts` — cotizaciones.
- `src/types/{transaction,dolar}.types.ts`, `src/validations/transaction.ts`.
- `src/components/{TransactionList,NewTransactionForm,DolarPrice}.tsx`.
- `src/app/{page,providers,new-transaction/page}.tsx`.

---



## Visión de arquitectura objetivo

```
src/
├── domain/                      # motor agnóstico de activo (sin dependencias de store)
│   ├── metrics.ts               # updateTransactionsData generalizado (inyecta precios)
│   └── timeline.ts              # validateTimeline + sortTxs
├── features/
│   ├── dolar/                   # lo que hoy es la app entera, encapsulado
│   │   ├── dolar.store.ts
│   │   ├── dolarApi.ts
│   │   └── components/ (DolarPrice, selectores de tipo de dólar)
│   ├── crypto/
│   │   ├── crypto.store.ts
│   │   ├── cryptoApi.ts         # CoinGecko / Binance
│   │   └── components/
│   ├── transactions/            # alta/listado/editar (multi-asset)
│   └── auth/                    # estado de sesión, sync local→cloud
├── app/api/transactions/        # CRUD protegido (Prisma + Neon)
└── prisma/schema.prisma
```

- **Un solo motor de cálculo** para dólar y cripto; cada feature aporta su fuente de precios detrás de una interfaz común: `Record<AssetKey, { buy: number; sell: number }>`.
- **Transacción genérica**: `category` (`dolar` | `crypto`), `assetKey`/`symbol`, `quantity`, `quoteAmount` (ARS), `type`, `date`, `userId` (cloud).

---



## Fase 0 — Fundación técnica y desacoplamiento (multi-asset ready)

**Objetivo:** que la matemática y los tipos no estén atados al dólar, con tests que la blinden. *No cambia funcionalidad visible.*

- [ ] **Tests del motor financiero** (instalar `vitest` + script `pnpm test`):
  ```
  cubrir `updateTransactionsData` (compras, ventas, venta total parcial, venta
  excesiva, redondeos, sin cotización) y `validateTimeline`/`sortTxs`.
  ```
- [ ] **Extraer el dominio**: mover `updateTransactionsData`, `validateTimeline` y
  ```
  `sortTxs` a `src/domain/` (o `src/lib/portfolio/`), sin importar stores.
  ```
- [ ] **Inyectar precios**: el cálculo recibe un `getMarketPrice(assetKey)` o
  ```
  `MarketPriceMap` en vez de leer `useDolarStore` directamente. La suscripción
  cross-store queda en el store, no en el dominio.
  ```
- [ ] **Generalizar claves**: introducir `type AssetKey = string` (formato
  ```
  `dolar:blue`, `crypto:BTC`) y `AssetCategory = 'dolar' | 'crypto'`. Mantener
  compatibilidad con `DolarOption` vía helpers de conversión.
  ```
- [ ] **Migración de persistencia**: añadir `version: 1` + `migrate` al `persist` de
  ```
  `transactions-storage` que convierta el formato viejo (`Record<DolarOption, Transaction[]>`)
  al nuevo (lista plana con `category` + `assetKey`). *Decisión clave: pasar de
  mapa agrupado a lista única con agrupación en selectors.*
  ```
- [ ] **Definir moneda base de reporte** (decisión de producto):
  ```
  - Opción A: todo reporta en ARS (coherente con el usuario argentino; cripto
    convierte vía cotización USD/ARS).
  - Opción B: reporta en USD/USDT con toggle ARS.
  - Recomendación: **ARS como base**, con valor alternativo en USD.
  ```
- [ ] **Métricas globales agregadas**: total del portfolio (todas las claves
  ```
  combinadas) además de las métricas por grupo.
  ```
- [ ] **Edición de transacciones** (hoy solo alta/borrado), revalidando la timeline.
- [ ] **Banner "Modo local"** en la UI (preparado para la fase 4).
- [ ] Limpieza: `404.tsx` → `not-found.tsx`, eliminar `getDolar()` y `usdPrice`
  ```
  muertos, errores de red con toast (hoy `console.error`), actualizar `AGENTS.md`.
  ```

**Criterio de salida:** tests verdes, la app se comporta idéntico al usuario, y el
dominio no importa ningún store de cotizaciones.

---



## Fase 1 — Autenticación (Clerk)

**Objetivo:** identificar al usuario. *Solo login; los datos siguen en local.*

- [ ] Crear proyecto en el Dashboard de **Clerk** (variables de entorno en `.env.local`,
  ```
  nunca commiteadas).
  ```
- [ ] Instalar `@clerk/nextjs`; `<ClkProvider>` en `ClientProviders`.
- [ ] `middleware.ts` con `clerkMiddleware()` + `createRouteMatcher` para proteger
  ```
  `/new-transaction` y `/api/*` (dejar `/` pública si se desea).
  ```
- [ ] `<UserButton />` en `Header.tsx` + estados signed-in/out.
- [ ] **Estado de sesión en el cliente**: derivar `isSignedIn` de Clerk en la UI y en
  ```
  el store (reemplazar los `isSignedIn: false` hardcodeados en
  `NewTransactionForm.tsx` y `TransactionList.tsx`).
  ```
- [ ] Ruta `GET /api/me` (o uso directo de `auth()` en server components) para el
  ```
  server-side.
  ```

**Criterio de salida:** se puede registrarse/iniciar sesión en la app, sin cambios en
la persistencia todavía.

---



## Fase 2 — Persistencia cloud (Neon + Prisma)

**Objetivo:** las transacciones viven en Postgres para usuarios autenticados.

- [ ] Instancia en **Neon.tech** + `prisma` / `@prisma/client`; `prisma init`.
- [ ] **Schema** (versión inicial alineada al modelo generalizado de la fase 0):
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
    @@index([userId, category, assetKey, date])
  }
  ```

- [ ] **API CRUD** en `src/app/api/transactions/`:
  - `GET /api/transactions?category=` — listar del usuario (auth por `clerkId`).
  - `POST /api/transactions` — crear (validar con el esquema Zod del dominio).
  - `PATCH /api/transactions/:id` — editar.
  - `DELETE /api/transactions/:id` — borrar.
  - Ownership check en cada operación (un usuario no toca datos de otro).
- [ ] **Reconstruir la rama remota del store** (hoy falla silenciosamente):
  ```
  fetch inicial (`GET`), optimistic updates con rollback, toasts de error reales,
  estados de carga/offline.
  ```
- [ ] **Validación timeline en el server** (misma función del dominio que los tests
  ```
  ya cubren) para que no dependa del cliente.
  ```
- [ ] Paridad local/cloud: mismos cálculos, mismos errores.

**Criterio de salida:** con sesión iniciada, crear/editar/borrar sobrevive a un
refresco y a otro dispositivo; sin sesión, todo sigue funcionando en local.

---



## Fase 3 — Integración híbrida y sincronización

**Objetivo:** un solo flujo de verdad según la sesión.

- [ ] Lógica en el store: `isSignedIn` → API; caso contrario → `localStorage`.
- [ ] **Migración inicial**: al primer login, detectar transacciones locales y ofrecer
  ```
  (dialog) subirlas a la nube; idempotencia por `id` (los `crypto.randomUUID()`
  locales pueden conservarse como IDs).
  ```
- [ ] Logout: no borrar locales automáticamente (pensado en re-login / uso offline).
- [ ] Ocultar banner "Modo local" al autenticarse; reflejar estado de sync
  ```
  ("sincronizado / pendiente").
  ```
- [ ] Manejo de conflictos simples (la nube manda tras el primer sync; documentar la
  ```
  regla).
  ```

**Criterio de salida:** flujo continuo local → login → nube sin pérdida de datos.

---



## Fase 4 — Módulo de Cripto (transacciones)

**Objetivo:** que la app tenga dos clases de activo: dólar (lo actual) y cripto.

- [ ] **Fuente de precios**: elegir API ( CoinGecko gratuita / Binance API );
  ```
  crear `src/features/crypto/cryptoApi.ts` (precio spot por símbolo, refresh
  configurable) y `crypto.store.ts` con la misma forma que el de dólar
  (`Record<AssetKey, { buy, sell }>`).
  ```
- [ ] **Catálogo de activos**: enum/const de símbolos soportados (`BTC`, `ETH`,
  ```
  `USDT`, `USDC`, …) con nombre y logo; extensible.
  ```
- [ ] **Tipos y validaciones**: schema Zod de transacción cripto — cantidad > 0,
  ```
  precio unitario o monto total, fecha sin futuras (a nivel de schema, no solo en
  el `<Calendar>`), y conversión a `quoteAmount` ARS usando la cotización
  USD/ARS vigente (`dolar:blue` o el tipo elegido).
  ```
- [ ] **Formulario unificado**: `NewTransactionForm` gana un selector de categoría
  ```
  (Dólar | Cripto) que muestra el campo de tipo de dólar o el de símbolo cripto;
  reutiliza el motor de cálculo y la validación de timeline (balance negativo por
  `assetKey`).
  ```
- [ ] **Historial**: `TransactionList` agrupa por `assetKey` con etiquetas por
  ```
  categoría (badges "Dólar"/"Cripto").
  ```
- [ ] **Métricas por símbolo**: costo promedio, PnL realizado/no realizado con el
  ```
  precio spot actual (mismo algoritmo ya testeado en fase 0).
  ```
- [ ] Suscripción: refresco de precios cripto → recálculo de métricas (patrón ya
  ```
  existente con `dolar.store`).
  ```

**Criterio de salida:** se puede comprar/vender BTC en ARS y ver posición, costo
promedio y PnL igual que con el dólar.

---



## Fase 5 — Portfolio Tracker

**Objetivo:** pasar de "listas de transacciones" a **vista de portfolio**.

- [ ] **Dashboard unificado**: valor total del portfolio (ARS y USD), desglose por
  ```
  categoría (dólar / cripto) y por activo, % de allocation, PnL total
  realizado + no realizado, costo total.
  ```
- [ ] **Gráficos** (sugerencia: `recharts`):
  ```
  - composición del portfolio (donut / barras de allocation),
  - evolución temporal del valor (snapshot diario: tabla `PortfolioSnapshot`
    en Prisma o cálculo desde transacciones + histórico de precios).
  ```
- [ ] **Detalle por activo**: drill-down desde el dashboard a la lista de
  ```
  transacciones filtrada (query param `?asset=crypto:BTC`).
  ```
- [ ] **Precios en vivo**: header con variación 24h para los activos en cartera; estados de
  ```
  carga y fallback si la API cae (retry + último valor cacheado).
  ```
- [ ] Cotizaciones dólar destacadas (hoy `DolarPrice`) como una tarjeta más dentro
  ```
  del dashboard, no como la pantalla principal.
  ```
- [ ] Extras (prioridad baja): export CSV/JSON, watchlist, refresh manual.

**Criterio de salida:** el usuario ve de un vistazo cuánto tiene, dónde, cuánto
ganó y cómo evolucionó.

---



## Fase 6 — Calidad, operación y despliegue

- [ ] CI (GitHub Actions): `pnpm lint` + `pnpm test` + `pnpm build` en cada PR.
- [ ] Tests E2E mínimos (Playwright): alta de transacción, login, sync.
- [ ] Manejo robusto de errores de red: retries/backoff para DolarAPI y la API de
  ```
  cripto, estados de fallback, toasts diferenciados.
  ```
- [ ] Rate limits y validación en `/api/*` (Zod en el server, ownership checks).
- [ ] Observabilidad: logging de errores (Sentry u opcional), eventos clave
  ```
  (alta, venta, login, sync).
  ```
- [ ] Deploy en Vercel + variables de entorno por ambiente; migraciones Prisma en
  ```
  el deploy.
  ```
- [ ] Backups de Neon (point-in-time restore) y política de migraciones.
- [ ] Actualizar `README.md` y `AGENTS.md` con la arquitectura final.

---



## Orden y dependencias

```
Fase 0 (desacoplar + tests)
   └─> Fase 1 (Clerk)
         └─> Fase 2 (Neon + Prisma + API)
               └─> Fase 3 (sync híbrida)
                     └─> Fase 4 (cripto)  ← puede iniciar el servicio de precios en paralelo a la Fase 2
                           └─> Fase 5 (portfolio tracker)
                                 └─> Fase 6 (calidad/operación, continuo)
```

**Notas:**

- La **Fase 4 (cripto)** solo requiere la Fase 0 para funcionar en local; si se
quiere llegar antes al mercado, puede desarrollarse en paralelo a las fases 1–3
(riesgo: refactor de sync dos veces).
- La **Fase 6** es transversal: empezar con el pipeline de CI apenas hay tests
(fase 0).

---

*Actualizar este documento (y* `AGENTS.md`*) en el mismo PR de cada fase completada.*