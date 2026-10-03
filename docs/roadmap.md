# Roadmap — Portfolio Tracker

Qué falta hacer y en qué orden. Lo ya hecho, con sus decisiones, está en
[`historial.md`](historial.md); el estado del código, en `AGENTS.md`.

> Guía de uso: cada fase (o subfase) es un hito desplegable por sí mismo. Los checkboxes son
> pasos concretos. Cuando una fase cierra, su detalle se mueve a `historial.md` y acá queda una
> línea en "Fases cerradas".

> **Decisión (sep 2026): dólar y cripto son módulos separados.** No comparten modelo de
> transacción, store ni formulario. Lo único en común para el usuario es la cotización
> del **dólar cripto** (DolarAPI), que el módulo cripto usa para mostrar valores en pesos.
> En código comparten solo piezas puras y genéricas: el motor de costo promedio
> (`src/domain/position.ts`), el orden/validación de la línea temporal
> (`src/domain/timeline.ts`) y los formateadores de `src/lib/locale-amount.ts`.

---

## Estado actual (octubre 2026)

La app está en producción (Vercel) con los dos módulos, login, nube y dashboard:

- **Dólar:** compras y ventas de USD en ARS por tipo de dólar, métricas en ARS, cotizaciones de
  DolarAPI con backoff y fallback.
- **Cripto:** compras, ventas, comisiones e intercambios cripto ↔ cripto de cualquier moneda de
  CoinGecko, métricas en USD y equivalente en ARS con el dólar cripto.
- **Cuenta:** login con Clerk; con sesión, los datos viven en Neon (API CRUD con ownership y la
  misma validación que los stores); sin sesión, local-first. Al iniciar sesión se ofrece subir lo local.
- **Portfolio:** dashboard en la home con valor total, composición por activo y evolución
  reconstruida desde transacciones + precios históricos.
- **Intercambios USDT ↔ cripto** (Fase 7a): los USDT del dólar cripto se cambian por cualquier cripto
  y al revés, con las dos patas enlazadas y validadas en local y en la nube.
- **Calidad:** Vitest, Playwright (sin sesión y con sesión), CI en cada PR, migraciones en el deploy,
  logs JSON.

### Fases cerradas

| Fase | Contenido | Detalle |
| ---- | --------- | ------- |
| 0 ✅ | Fundación: tests, lint, dominio puro, métricas derivadas | [historial](historial.md#fase-0--fundación-técnica-y-desacoplamiento-) |
| 1 ✅ | Login con Clerk | [historial](historial.md#fase-1--autenticación-clerk-) |
| 2 ✅ | Neon + Prisma + API CRUD | [historial](historial.md#fase-2--persistencia-cloud-neon--prisma-) |
| 3 ✅ | Sincronización local ↔ nube (la nube manda) | [historial](historial.md#fase-3--integración-híbrida-y-sincronización-) |
| 4 ✅ | Módulo cripto | [historial](historial.md#fase-4--módulo-cripto-independiente-del-dólar-) |
| 5 ✅ | Dashboard del portfolio | [historial](historial.md#fase-5--portfolio-tracker-) |

### Deuda técnica y riesgos vigentes

| Tema | Impacto | Dónde se resuelve |
| ---- | ------- | ----------------- |
| Los E2E con sesión no corren en CI | Pasan en local; en CI se saltean hasta que se carguen los secretos `E2E_*` | Fase 6 (opcional) |
| Clerk en instancia de desarrollo (`pk_test_`) | Límite de usuarios y aviso de "development mode": no sirve para usuarios reales | Fase 6 (manual) |
| Sin rate limits en `/api/*` | Bajo: toda escritura exige sesión y solo toca datos propios; los proxies de precios cachean | Fase 6, siguiente iteración |
| El módulo dólar vive en `store/`, `services/` y `components/`, no en `features/dolar/` | Solo de orden: no bloquea nada | **Sin fase asignada.** No moverlo a medias; si se decide, se planifica como fase propia |

---

## Reglas de arquitectura

- **Dos módulos independientes.** Dólar: operaciones ARS ↔ USD por tipo de dólar, reporte en ARS.
  Cripto: operaciones en USD por moneda de CoinGecko, reporte en USD con equivalente en pesos
  usando el dólar cripto (cotización de compra).
- **Motor compartido, modelos separados.** Cada módulo adapta sus operaciones a
  `PositionLot` (`quantity`, `quoteAmount`) y redondea según su unidad; no hay un tipo
  `Transaction` genérico ni `AssetKey`.
- **Dependencias:** `domain` no importa nada de `features`, `app` ni `store`; los módulos no se
  importan entre sí (excepción acordada: cripto **lee** la cotización del dólar cripto de
  `useDolarStore`). Los *composers* (`features/auth`, `features/portfolio` y, desde la Fase 7,
  `features/usdt-swaps`) leen los dos módulos y solo los importa `app/`. `server/` nunca se importa
  desde componentes cliente.
- **APIs externas detrás de route handlers**: el navegador no llama a CoinGecko ni a ArgentinaDatos
  directo; los handlers validan parámetros, cachean con el Data Cache de Next (`next.revalidate`) y
  validan la respuesta con Zod.
- **Reglas de negocio en funciones puras** (`domain/transactions.ts`, `features/crypto/operations.ts`)
  que usan tanto los stores como el server; el origen local/nube de cada store lo resuelve
  `src/lib/synced-store.ts`.

---

## Fase 6 — Calidad, operación y despliegue (lo pendiente)

Lo hecho (CI, E2E en modo local, errores de red, logs, migraciones en el deploy, guía de operación)
está en [`historial.md`](historial.md#fase-6--calidad-operación-y-despliegue-parte-hecha).

**Antes de la Fase 7a:**

- [x] **(manual)** Neon: el `.env` local apunta a una rama de desarrollo, no a producción (oct 2026).
- [x] **(manual)** Vercel: `DATABASE_URL` de *Preview* apunta a una rama de Neon, no a producción
  (oct 2026).
- [ ] **(manual)** Neon: subir la retención del historial (restore a un punto en el tiempo). Pasos en
  `docs/operacion.md` §3.
- [x] E2E de login y sincronización (`e2e/sync.cloud.spec.ts`, `@clerk/testing`, proyecto `cloud`):
  alta con sesión que sobrevive a la recarga y no toca `localStorage`, escritura fallida que se
  revierte, importación de lo local con "Subir a mi cuenta" (cierra lo que la Fase 3 dejó sin probar).
  Pasan en local contra Clerk de desarrollo (con "Email address" habilitado) y la rama de desarrollo.
- [ ] *(opcional)* CI: cargar los secretos `E2E_CLERK_SECRET_KEY`, `E2E_CLERK_PUBLISHABLE_KEY` y
  `E2E_DATABASE_URL` (rama de Neon propia para tests) para que el paso "E2E con sesión" corra
  (`docs/operacion.md` §3).

**Cuando haya usuarios reales:**

- [ ] **(manual)** Variables de entorno de producción en Vercel: verificar `DATABASE_URL` y pasar Clerk a
  una instancia de producción (requiere dominio propio). Pasos en `docs/operacion.md` §1–2.
- [ ] Rate limits en `/api/*` con un store compartido (p. ej. Upstash Redis): un límite en memoria no
  sirve en serverless.
- [ ] Sentry (se engancha en `src/server/log.ts` e `src/instrumentation.ts`).

**Backlog (prioridad baja):** watchlist, refresh manual de cotizaciones (extras de la Fase 5).

---

## Fase 7 — Intercambios USDT (dólar cripto) ↔ cripto y resultados de trades (7a ✅)

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

Tareas:

- [ ] `kind?: 'TRADE_RESULT'` y `note?: string` en `Transaction` y `CryptoTransaction`;
      `transactions-storage` v2 → **v3** y `crypto-storage` v3 → **v4** con `migrate` + test con snapshot.
- [ ] Prisma: `enum OperationKind { TRADE_RESULT }`, `kind OperationKind?` y `note String?` en las dos
      tablas (migración propia); `mappers.ts` ida y vuelta.
- [ ] **Auditoría de `type`:** revisar cada uso de `TransactionType.BUY`/`SELL` fuera del motor y la
      línea temporal (historiales, formularios, resúmenes, dashboard, importación) y decidir si un
      resultado de trade entra; el texto de cada fila sale de una sola función (`operationLabel(tx)`:
      "Compra", "Venta", "Ganancia de trade", "Pérdida de trade", "Intercambio USDT").
- [ ] Dólar: `computeGroupMetrics` pasa el ajuste al motor; `TransactionsData` suma `tradeProfit` (ARS).
- [ ] Cripto: `toPositionLot` pasa el ajuste; `CryptoPosition` y `CryptoPortfolioSummary` suman
      `tradePnlUsd`. Tests en `src/features/crypto/__tests__/metrics.test.ts` y
      `src/domain/__tests__/metrics.test.ts`.
- [ ] Zod (form y API de los dos módulos): aceptan `kind`/`note`; un resultado de trade no lleva
      `fee` ni `swapId`/`usdtSwapId`.
- [ ] Se puede editar (es una operación sola) con la misma revalidación que una compra/venta.
- [ ] `importSchema` / `toImportPayload` / `localNotInCloud` llevan `kind` y `note`.

### 7b.2 UI

- [ ] **Formulario "Resultado de trade"** (`/cripto/nueva`, pestaña nueva): ganancia/pérdida, moneda
      (con "USDT · Dólar cripto" primero), cantidad, precio o cotización autocompletados, fecha y nota.
- [ ] Historiales: badge "Trade" con la nota.
- [ ] Resúmenes (dólar, cripto y detalle por moneda): línea "Resultado de trades" dentro del PnL
      realizado; "Invertido" → "Costo".
- [ ] E2E: ganancia y pérdida de trade en USDT y en BTC con su efecto en saldo y PnL.

**Criterio de salida 7b:** se pueden cargar ganancias o pérdidas de trades en USDT o en cualquier
moneda, con saldos y PnL correctos en los dos módulos, en local y en la nube.

### Fuera de alcance (posibles siguientes pasos)

- Migrar `tether` cargado en el módulo Cripto al grupo `cripto` del Dólar.
- Otras stablecoins (USDC, DAI) como "dólar cripto": hoy siguen siendo monedas del módulo Cripto.
- Resultados de trade sin moneda (solo un monto en USD que no cambia ningún saldo).

---

## Orden y dependencias

```
Fases 0–5 ✅
Fase 6 (pendiente: retención de Neon, secretos E2E en CI, lo de "usuarios reales")
Fase 7a ✅ (intercambios USDT ↔ cripto)
   └─> Fase 7b (resultados de trades)  ← siguiente
```

- La **7b** va después de la 7a porque los resultados en USDT usan el grupo `cripto` como saldo de
  USDT y la opción "Dólar cripto · USDT" del selector de la 7a (`CoinCombobox` `pinned`). Si hiciera falta, la parte en
  otras monedas (solo módulo Cripto) podría adelantarse.

---

*Actualizar este documento, `historial.md` y `AGENTS.md` en el mismo PR de cada fase completada.*
