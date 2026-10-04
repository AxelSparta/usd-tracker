# Roadmap — Pesos y CEDEARs

Extiende `docs/roadmap.md` (Fases 0–7) con dos secciones nuevas, al mismo nivel que **Dólar** y
**Cripto**:

1. **Pesos:** saldo en ARS del portafolio (ingresos y egresos).
2. **CEDEARs:** compras y ventas de CEDEARs pagadas con **pesos** (del saldo de Pesos) o con
   **dólares CCL** (del grupo `contadoconliqui` del módulo Dólar).

> Guía de uso: igual que el roadmap principal, cada fase es un hito desplegable por sí mismo y los
> checkboxes son pasos concretos. Actualizar este documento (y `AGENTS.md`) en el mismo PR de cada fase.

---

## Punto de partida (qué se reutiliza)

| Pieza existente                          | Uso en Pesos / CEDEARs                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `domain/position.ts` (`computePosition`) | Costo promedio y PnL de CEDEARs (dos corridas: en ARS y en USD CCL)            |
| `domain/timeline.ts`                     | Orden y saldo nunca negativo (pesos, unidades de CEDEAR, USD CCL)              |
| `lib/synced-store.ts` (`createSync`)     | Local-first + nube para los dos stores nuevos                                  |
| `server/db.ts` (`withUserTransaction`)   | Escribir una operación de CEDEAR y su pata de pesos/dólar en una transacción   |
| `server/argentinadatos.ts`               | Histórico del CCL (cotización por día para autocompletar y para el gráfico)    |
| `store/dolar.store.ts`                   | CCL en vivo (DolarAPI `contadoconliqui`) y MEP (`bolsa`)                      |
| `lib/sections.ts`                        | Sidebar y home: una entrada nueva por sección                                  |
| `features/portfolio/`                    | Dashboard: sumar dos módulos más a la composición y a la evolución             |
| Patrón de patas enlazadas (`swapId`, Fase 7 `usdtSwapId`) | Una compra de CEDEAR = operación CEDEAR + egreso de pesos o venta de USD CCL |

**Lo que no existe y hace falta:**

- Una fuente de precios de CEDEARs. Propuesta: [data912](https://data912.com) (pública, sin key):
  `GET /live/arg_cedears` (panel con `symbol`, `c` = último, `px_bid`/`px_ask`, `pct_change`) y
  `GET /historical/cedears/{ticker}` (OHLC diario). Se declara educativa/hobby y **no es tiempo real**
  (cache ~2 h en Cloudflare). Va detrás de un route handler, como CoinGecko, para poder cambiarla
  (IOL, BYMA) sin tocar el cliente.
- Un mecanismo genérico para operaciones que tocan **más de un módulo** (Fase 8.0).

---

## Decisiones

> **D1 — Dos módulos nuevos e independientes**, `src/features/pesos/` y `src/features/cedears/`,
> directamente con la estructura de `features/crypto` (no se repite el layout viejo de `store/` +
> `components/` del dólar). Cada uno con su modelo, store, tabla, API y formulario.

> **D2 — Dirección de dependencias:** `cedears → pesos` y `cedears → dólar` (funciones puras y
> stores), **nunca al revés**. Pesos y Dólar solo conocen que una operación suya está enlazada
> (`link`) y, en sus listas, la muestran como "Operación de CEDEAR" con un link a `/cedears`: no se
> edita ni se borra desde ahí. Así no hace falta que un módulo base importe a CEDEARs.

> **D3 — Pesos es un saldo, no un activo con precio.** Ingresos (`BUY`) y egresos (`SELL`) en ARS;
> sin PnL (inflación y rendimientos de FCI/caución quedan fuera). Para el dashboard en USD se valúa
> con el **dólar MEP venta** (lo que cuesta pasarlos a dólares en el mercado). *Pregunta abierta P1.*

> **D4 — Cada operación de CEDEAR guarda su moneda y el CCL del día.**
> `currency: 'ARS' | 'CCL'` + `fxRate` (ARS por USD CCL, autocompletado con el CCL del día, editable).
> Con eso cada operación tiene monto en ARS **y** en USD, sin importar cómo se pagó, y la posición se
> calcula en las dos monedas con el mismo motor:
> - ARS: `quoteAmount` = monto ARS (si se pagó en CCL, USD × `fxRate`).
> - USD: `quoteAmount` = monto USD (si se pagó en pesos, ARS / `fxRate`).
> El PnL en USD es el que importa para un CEDEAR (activo dolarizado); el de ARS se muestra al lado.

> **D5 — Valuación en vivo:** cantidad × último precio ARS (data912). En USD: valor ARS / **CCL
> compra** (DolarAPI). Sin precio → `null`, nunca inventado (como cripto).

> **D6 — Las patas se crean, editan y borran juntas** desde CEDEARs. A diferencia de los swaps, una
> compra de CEDEAR sí se puede **editar**: la función pura reconstruye las dos patas y revalida las tres
> líneas temporales (CEDEAR, pesos o USD CCL).

> **D7 — Saldo obligatorio:** comprar con pesos exige saldo en Pesos a esa fecha; con CCL, saldo en el
> grupo `contadoconliqui` del Dólar. Si falta, el error lo dice y el formulario ofrece "Registrar un
> ingreso de pesos" (o ir a cargar dólares CCL) sin perder lo cargado.

---

## Fase 8.0 — Operaciones enlazadas entre módulos (prerrequisito)

**Objetivo:** que Fase 7 (USDT ↔ cripto) y CEDEARs usen **un solo** mecanismo de patas entre módulos.

- [ ] Reemplazar el `usdtSwapId` planeado en la Fase 7 por un campo genérico en **todas** las
      operaciones: `link?: { id: string; kind: 'USDT_SWAP' | 'CEDEAR' }` (en Prisma: `linkId` UUID
      indexado + `linkKind` enum). Si la Fase 7 ya se implementó, migración `usdtSwapId → linkId`.
- [ ] `lib/synced-store.ts`: acción `applyExternal(next, remote)` en cada store (envuelve
      `sync.commit`) y un helper `commitAcross([{ store, next }], remote)` que aplica en varios stores
      de forma optimista con **una** llamada a la API y revierte cada uno si falla.
- [ ] Las funciones puras de Dólar (y de Pesos, Fase 8) rechazan editar/borrar una operación con
      `link`: "Es parte de una operación de CEDEAR: modificala desde CEDEARs." (lo mismo con
      `USDT_SWAP`). Tests.
- [ ] Server: helper para cargar varios estados del usuario dentro de la misma
      `withUserTransaction` (dólar, cripto, pesos, cedears).
- [ ] Revisar con este enfoque la excepción de módulos que planteaba la Fase 7 (7.4): las listas
      muestran el enlace y mandan al módulo dueño en vez de importar su hook.

**Criterio de salida:** la Fase 7 y las fases siguientes crean patas enlazadas sin código específico
por par de módulos.

---

## Fase 8 — Módulo Pesos

**Objetivo:** registrar los pesos del portafolio y ver el saldo.

**Modelo** (`features/pesos/types.ts`):

```ts
type PesosMovement = {
  id: string
  type: TransactionType          // BUY = ingreso, SELL = egreso (reusa sortTxs: ingresos primero)
  amount: number                 // ARS, > 0
  date: Date | string
  note?: string                  // "Sueldo", "Transferencia desde banco"
  link?: OperationLink           // pata de una operación de CEDEAR (D2)
}
```

- [ ] Funciones puras (`features/pesos/operations.ts`): `applyAdd/Update/RemovePesosMovement`,
      `validatePesosTimeline` (saldo nunca negativo, con `findNegativeBalance`), `computePesosBalance`.
      Tests.
- [ ] Store `usePesosStore` (`pesos-storage`, `version: 1`, `partialize`, `createSync`); sumarlo a
      `CloudSync`.
- [ ] Prisma: `PesosMovement` (`id` UUID del cliente, `userId`, `type`, `amount Decimal`, `date`,
      `note?`, `linkId?`, `linkKind?`, índice `[userId, date]`); migración.
- [ ] API `/api/pesos/movements[/:id]` (GET/POST, PATCH/DELETE) con el patrón de siempre:
      `requireUserId` → Zod → servicio con ownership y validación de línea temporal → 401/400/404/409/422;
      logs `pesos.*` sin montos.
- [ ] Sincronización: `importSchema`, `toImportPayload` y `localNotInCloud` incluyen pesos.
- [ ] UI: sección **Pesos** en `sections.ts` (`/pesos`, `/pesos/nueva`, ícono `Banknote`): saldo ARS,
      equivalente USD (MEP venta), historial con edición/borrado (bloqueado en patas enlazadas) y
      formulario ingreso/egreso con nota.
- [ ] E2E: ingreso, egreso sin saldo (error), borrado que dejaría saldo negativo (error).

**Criterio de salida:** se cargan ingresos y egresos de pesos, en local y en la nube, y el saldo nunca
queda negativo.

---

## Fase 9 — Módulo CEDEARs

**Objetivo:** comprar y vender CEDEARs con pesos o dólares CCL, ver posiciones y PnL en ARS y USD.

### 9.1 Precios (server)

- [ ] `src/server/cedears.ts`: cliente de data912 con schemas Zod de respuesta.
  - `getCedearPanel()` → `{ ticker, priceArs, change24h }[]` desde `/live/arg_cedears` (`c`,
    `pct_change`), `next.revalidate` 5 min.
  - `getCedearHistory(ticker, from)` desde `/historical/cedears/{ticker}` (cierre `c`), revalidate 6 h.
- [ ] `GET /api/cedears/prices?tickers=` (precio ARS, variación, fecha), `GET /api/cedears/search?q=`
      (filtra el panel por ticker; sin `q`, los más operados por volumen) y
      `GET /api/history/cedears?ticker=` (último año).
- [ ] Nombres: el panel solo trae tickers. Catálogo estático `features/cedears/catalog.ts` con nombre
      del subyacente para los más comunes (AAPL → Apple); el resto se muestra solo con el ticker.
- [ ] Tests de los schemas con respuestas guardadas; simular data912 en `e2e/fixtures.ts`.

### 9.2 Modelo y cálculos

```ts
type CedearTransaction = {
  id: string
  ticker: string                 // ticker base en BYMA, ej. "AAPL"
  type: TransactionType
  quantity: number               // CEDEARs enteros, > 0
  price: number                  // por CEDEAR, en `currency`
  currency: 'ARS' | 'CCL'
  fxRate: number                 // ARS por USD CCL ese día (D4)
  fee?: number                   // comisión + derechos, en `currency`
  date: Date | string
  link: OperationLink            // siempre enlazada a su pata (pesos o dólar CCL)
}
```

- [ ] `features/cedears/metrics.ts`: `toArsLot`, `toUsdLot` (con la comisión: encarece la compra,
      reduce lo cobrado en la venta) y `computeCedearPositions(txs, prices, ccl)` → por ticker:
      cantidad, costo promedio ARS y USD, invertido, valor de mercado ARS/USD, PnL realizado y no
      realizado en las dos monedas. Tests en `features/cedears/__tests__/`.
- [ ] `features/cedears/operations.ts` (puro, store + server):
  - `buildFundingLeg(tx)` → compra con ARS: egreso de Pesos por `price × quantity + fee`; venta con
    ARS: ingreso por `price × quantity − fee`. Con CCL: venta/compra en el grupo `contadoconliqui` del
    Dólar por el monto USD, con `pesosAmount` = USD × `fxRate`.
  - `applyAdd/Update/RemoveCedearTransaction({ cedears, pesos, dolar }, …)`: valida las unidades del
    CEDEAR (sin vender más de lo que hay), el saldo de pesos o de USD CCL, y devuelve los tres estados.
    Mensajes en español ("No tenés pesos suficientes el dd/MM/yyyy.").
  - Cantidad entera: validación en Zod y en las funciones puras.
- [ ] Persistencia: `cedears-storage` (`version: 1`) y `cedears-prices-storage` (`version: 1`, último
      precio como fallback).
- [ ] Prisma: `CedearTransaction` (`ticker`, `type`, `quantity Decimal`, `price Decimal`,
      `currency` enum `ARS | CCL`, `fxRate Decimal`, `fee Decimal?`, `date`, `linkId`, `linkKind`,
      índice `[userId, ticker, date]`); migración.

### 9.3 API

- [ ] `/api/cedears/transactions[/:id]`: cada escritura carga los estados de CEDEARs + Pesos + Dólar
      del usuario, aplica la función pura y escribe la operación **y su pata** en la misma
      `withUserTransaction` (`Serializable`). Mismos códigos (401/400/404/409/422); ids del cliente
      (operación y pata). Logs `cedear.*` sin montos.
- [ ] Import: `importSchema` con CEDEARs; una operación sin su pata (o al revés) no se sube.
- [ ] Tests en `src/server/__tests__/` (atomicidad, ownership, 422 por saldo de pesos / CCL / unidades,
      edición que cambia de ARS a CCL, borrado).

### 9.4 UI

- [ ] Sección **CEDEARs** en `sections.ts` (`/cedears`, `/cedears/nueva`, `/cedears/[ticker]`, ícono
      `LineChart`).
- [ ] Formulario: buscador de ticker (combobox como `CoinCombobox`), compra/venta, cantidad,
      **pagado con** Pesos / Dólares CCL (muestra el saldo disponible de cada uno), precio (autocompletado:
      ARS del panel; en CCL, precio ARS / CCL del día), CCL del día (autocompletado, editable), comisión
      y fecha. Muestra el total que sale o entra de Pesos / CCL.
- [ ] Vista `/cedears`: resumen (valor ARS y USD, invertido, PnL realizado y no realizado en las dos
      monedas con selector ARS/USD), posiciones e historial con edición y borrado; aviso "precios con
      demora" (D5) y fecha del último precio.
- [ ] Detalle `/cedears/[ticker]`: operaciones filtradas y métricas del CEDEAR.
- [ ] Refresco de precios cada 5 min solo con la sección montada, con backoff ante fallos
      (`lib/backoff.ts`), como cripto.
- [ ] En `/pesos` y `/dolar`, las patas se ven como "CEDEAR · compra 10 AAPL" con link al detalle.
- [ ] E2E: ingreso de pesos → compra de CEDEAR con pesos → venta; compra con CCL desde el dólar;
      error por falta de saldo; borrar la compra devuelve el saldo.

**Criterio de salida:** se puede comprar y vender cualquier CEDEAR con pesos o dólares CCL, y los
saldos de Pesos y Dólar CCL, las posiciones y el PnL (ARS y USD) quedan consistentes en local y en la nube.

---

## Fase 10 — Portfolio con Pesos y CEDEARs

- [ ] `features/portfolio/overview.ts`: módulos `pesos` y `cedears`. Composición en USD: pesos / MEP
      venta (D3), CEDEARs / CCL compra (D5). Resumen por módulo con su ganancia (CEDEARs en USD).
- [ ] `history.ts`: saldo de pesos por día / MEP histórico; CEDEARs por día × cierre histórico ARS /
      CCL histórico. Sin precio → `null`, como hoy.
- [ ] Colores: la paleta categórica sigue al activo (no hace falta otra); la tabla de composición hace
      drill-down a `/pesos` y `/cedears/[ticker]`.
- [ ] Home: tarjetas de las secciones nuevas (salen solas de `sections.ts`).
- [ ] Actualizar `AGENTS.md`, `README.md` y `docs/roadmap.md` (estado actual y arquitectura).

**Criterio de salida:** el dashboard suma Pesos y CEDEARs al valor total, la composición y la evolución.

---

## Fuera de alcance (posibles siguientes pasos)

- Que las compras/ventas del módulo Dólar debiten/acrediten Pesos (*pregunta abierta P2*).
- CEDEARs operados en **MEP** (ticker D): misma forma que CCL con el grupo `bolsa` del Dólar
  (`currency: 'MEP'`).
- Dividendos de CEDEARs (en USD CCL o pesos): encaja con los "resultados" de la Fase 7.
- Ratios de conversión y valuación contra el subyacente en NYSE (CCL implícito).
- Rendimiento de los pesos (plazo fijo, FCI, caución) e inflación.

## Preguntas abiertas

- **P1:** ¿con qué dólar se pasan los pesos a USD en el dashboard? Propuesta: MEP venta.
- **P2:** ¿comprar dólares en el módulo Dólar debería descontar del saldo de Pesos? Propuesta: más
  adelante y opcional por operación ("pagado con mi saldo de pesos"), para no invalidar historiales ya
  cargados sin pesos.
- **P3:** ¿data912 alcanza como fuente (demora, sin SLA) o preferís una con cuenta (IOL)? El route
  handler permite cambiarla después.

## Orden y dependencias

```
Fase 7 (USDT ↔ cripto)  ┐
                        ├─> Fase 8.0 (operaciones enlazadas)
                        │      └─> Fase 8 (Pesos)
                        │             └─> Fase 9 (CEDEARs: 9.1 precios puede ir en paralelo a 8)
                        │                    └─> Fase 10 (portfolio)
```

- 8.0 conviene hacerla **antes** de implementar la Fase 7, para que USDT ↔ cripto nazca con `link`.
- 9.1 (fuente de precios) no depende de nada: se puede validar primero para descartar riesgos de la API.
