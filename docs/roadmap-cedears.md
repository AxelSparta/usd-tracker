# Roadmap — Pesos y CEDEARs

Extiende `docs/roadmap.md` (Fases 0–7, cerradas en `docs/historial.md`) con dos secciones nuevas, al
mismo nivel que **Dólar** y **Cripto**:

1. **Pesos:** saldo en ARS del portafolio (ingresos y egresos).
2. **CEDEARs:** compras y ventas de CEDEARs pagadas con **pesos** (del saldo de Pesos) o con
   **dólares CCL** (del grupo `contadoconliqui` del módulo Dólar).

> Guía de uso: igual que el roadmap principal, cada fase es un hito desplegable por sí mismo y los
> checkboxes son pasos concretos. Actualizar este documento (y `AGENTS.md`) en el mismo PR de cada fase.

> **Revisión (oct 2026), después de cerrar la Fase 7.** La primera versión de este plan se escribió
> antes de que la Fase 7 estuviera en `main` y proponía reemplazar `usdtSwapId` por un `link` genérico.
> Con la Fase 7 ya en producción, eso obliga a migrar datos reales sin ganar nada (ver D8). Esta versión
> parte de lo que la Fase 7 dejó construido, reordena las fases (Pesos no depende de los enlaces) y
> corrige la fuente de precios con lo que devuelve data912 de verdad.

---

## Punto de partida (qué se reutiliza)

| Pieza existente | Uso en Pesos / CEDEARs |
| --- | --- |
| `domain/position.ts` (`computePosition`) | Costo promedio y PnL de CEDEARs (dos corridas: en ARS y en USD CCL) |
| `domain/timeline.ts` (`sortTxs`, `findNegativeBalance`, genéricos sobre `DatedTx`) | Orden y saldo nunca negativo (pesos, unidades de CEDEAR, USD CCL) |
| `lib/synced-store.ts` (`createSync`, `whenReady`/`untilReady`) | Local-first + nube para los dos stores nuevos; esperar a que estén listos antes de validar |
| `applyExternal(next, remote)` en `transaction.store.ts` y `crypto.store.ts` (Fase 7a) | Aplicar en el store del Dólar la pata de una operación de CEDEAR. Pesos la suma desde el día uno |
| `features/usdt-swaps/actions.ts` (`commitBoth`, `once`) | Commit optimista en dos stores con **un** request. Se generaliza a N stores en 9.0 |
| `hooks/use-usdt-swap-links` + `UsdtSwapLinksProvider` | Cómo una lista muestra y borra una pata ajena **sin importar** al módulo dueño. Se repite para las patas de CEDEARs |
| `server/usdt-swaps.ts` (`loadLinkedState` + `withUserTransaction`) | Cargar varios módulos del usuario y escribir la operación y su pata en una transacción `Serializable` |
| `services/dolarHistory.ts` (`rateOn`) + `/api/history/dolar` | CCL y MEP de un día pasado (autocompletar `fxRate`, gráfico) |
| `store/dolar.store.ts` | CCL en vivo (DolarAPI `contadoconliqui`) y MEP (`bolsa`) |
| `lib/operation-label.ts` | Un texto por fila; suma "Ingreso" / "Egreso" y las patas de CEDEAR |
| `lib/sections.ts` | Sidebar y home: una entrada nueva por sección |
| `features/portfolio/` | Dashboard: sumar dos módulos más a la composición y a la evolución |
| `features/auth/` (`CloudSync`, `useCloudStatus`, `local-import.ts`) + `server/import.ts` | Cada store nuevo se conecta a la nube, entra en el estado del badge y en la importación |

**Lo que no existe y hace falta:**

- **Una fuente de precios de CEDEARs.** Propuesta: [data912](https://data912.com) (pública, sin key).
  Probado en oct 2026:
  - `GET /live/arg_cedears`: un panel con `symbol`, `c` (último), `px_bid`/`px_ask`, `v` (volumen),
    `q_op` (operaciones) y `pct_change`. Trae **tres filas por CEDEAR**: `AAPL` (en ARS), `AAPLC` (en
    USD CCL) y `AAPLD` (en USD MEP). Las variantes `C`/`D` suelen tener poco volumen.
  - `GET /historical/cedears/{ticker}`: OHLC diario (`date`, `o`, `h`, `l`, `c`, `v`) desde 2012, sin
    el tope de 365 días de CoinGecko.
  - Se declara educativa/hobby y **no es tiempo real** (cache de ~2 h en Cloudflare). Va detrás de un
    route handler, como CoinGecko, para poder cambiarla (IOL, BYMA) sin tocar el cliente.
- **Un commit optimista en más de dos stores** (Dólar o Pesos + CEDEARs) y una forma de rechazar
  cambios a una pata desde su propio módulo. Ver 9.0.

---

## Decisiones

> **D1 — Dos módulos nuevos e independientes**, `src/features/pesos/` y `src/features/cedears/`,
> con la misma estructura que `features/crypto` (no se repite el layout viejo de `store/` +
> `components/` del dólar). Cada uno con su modelo, store, tabla, API y formulario.

> **D2 — Dirección de dependencias:** `cedears → pesos` y `cedears → dólar` (funciones puras y
> stores), **nunca al revés**. Pesos y Dólar solo saben que una operación suya es la pata de un CEDEAR
> (`cedearId`, D8). En sus listas la muestran como "CEDEAR · compra 10 AAPL" con un link a
> `/cedears/[ticker]`, y no se edita ni se borra desde ahí. El texto llega por un contexto de `hooks/`,
> como en la Fase 7 (`use-usdt-swap-links`), así ningún módulo base importa a CEDEARs.

> **D3 — Pesos es un saldo, no un activo con precio.** Ingresos (`BUY`) y egresos (`SELL`) en ARS;
> sin PnL (inflación y rendimientos de FCI/caución quedan fuera). Para el dashboard en USD se valúa
> con el **dólar MEP venta**, que es lo que cuesta pasarlos a dólares en el mercado. *Pregunta abierta P1.*

> **D4 — Cada operación de CEDEAR guarda su moneda y el CCL del día.**
> `currency: 'ARS' | 'CCL'` + `fxRate` (ARS por USD CCL; se autocompleta con el CCL del día y se puede
> editar). Con eso cada operación tiene monto en ARS **y** en USD, sin importar cómo se pagó, y la
> posición se calcula en las dos monedas con el mismo motor:
> - ARS: `quoteAmount` = monto ARS (si se pagó en CCL, USD × `fxRate`).
> - USD: `quoteAmount` = monto USD (si se pagó en pesos, ARS / `fxRate`).
>
> El PnL que importa en un CEDEAR (activo dolarizado) es el de USD; el de ARS se muestra al lado.

> **D5 — Valuación en vivo:** cantidad × último precio ARS del ticker base (el más líquido). En USD:
> valor ARS / **CCL compra** (DolarAPI). No se usa el precio del ticker `C`: con poco volumen, su
> último precio puede tener días de atraso. Sin precio → `null`, nunca inventado (como cripto).

> **D6 — Las patas se crean, editan y borran juntas** desde CEDEARs. A diferencia de los swaps, una
> compra de CEDEAR sí se puede **editar**: la función pura reconstruye la pata y revalida todas las
> líneas temporales afectadas (CEDEAR, y pesos y/o USD CCL si se cambió cómo se pagó).

> **D7 — Saldo obligatorio:** comprar con pesos exige saldo en Pesos a esa fecha; con CCL, saldo en el
> grupo `contadoconliqui` del Dólar. Si falta, el error lo dice y el formulario ofrece "Registrar un
> ingreso de pesos" (o ir a cargar dólares CCL) sin perder lo cargado.

> **D8 (nueva) — Las patas apuntan a su operación: `cedearId`, no un `link` genérico.** La primera
> versión pedía reemplazar `usdtSwapId` por `link?: { id, kind }`. Se descarta:
> - `usdtSwapId` ya está en producción (migración `usdt_swaps`, `transactions-storage` v3,
>   `crypto-storage` v4). Cambiarlo obliga a migrar filas reales y dos storages, y a que la importación
>   acepte las dos formas, sin ninguna funcionalidad nueva.
> - Un intercambio USDT tiene dos patas del mismo rango, y por eso necesita un id propio. Una operación
>   de CEDEAR tiene **una dueña** (la operación) y **una pata** (pesos o dólar CCL): alcanza con que la
>   pata guarde el id de la operación. No hace falta otro id ni campo en `CedearTransaction`.
> - Con dos casos concretos, un tipo genérico es abstracción prematura. Si aparece un tercero
>   (dividendos, MEP), se evalúa ahí.

---

## Fase 8 — Módulo Pesos

**Objetivo:** registrar los pesos del portafolio y ver el saldo. No depende de nada nuevo: es un
módulo más, como Cripto, sin operaciones enlazadas todavía.

**Modelo** (`features/pesos/types.ts`):

```ts
type PesosMovement = {
  id: string
  type: TransactionType          // BUY = ingreso, SELL = egreso (sortTxs: ingresos primero el mismo día)
  amount: number                 // ARS, > 0
  date: Date | string
  note?: string                  // "Sueldo", "Transferencia desde banco"
  cedearId?: string              // pata de una operación de CEDEAR (D8); se agrega en la Fase 9
}
```

- [ ] Funciones puras (`features/pesos/operations.ts`): `applyAdd/Update/RemovePesosMovement`,
      `validatePesosTimeline` (saldo nunca negativo, con `findNegativeBalance`), `computePesosBalance`.
      Tests en `features/pesos/__tests__/`.
- [ ] Store `usePesosStore` (`pesos-storage`, `version: 1`, `partialize` con lo local), con
      `createSync`, `whenReady`/`untilReady` en cada acción y `applyExternal` (lo usa la Fase 9).
- [ ] Composers: conectarlo en `CloudSync`, sumarlo al estado del badge (`useCloudStatus`) y a
      `localNotInCloud` / `toImportPayload` / `importSchema` / `server/import.ts`.
- [ ] Prisma: `PesosMovement` (`id` UUID del cliente, `userId`, `type`, `amount Decimal`, `date`,
      `note?`, índice `[userId, date]`) y relación en `User`; migración nueva. `cedearId` se suma en
      la Fase 9 (una columna nullable no rompe nada).
- [ ] `mappers.ts`: ida y vuelta de `PesosMovement`.
- [ ] API `/api/pesos/movements[/:id]` (GET/POST, PATCH/DELETE) con el patrón de siempre:
      `requireUserId` → Zod → servicio `server/pesos-movements.ts` con ownership y validación de línea
      temporal → 401/400/404/409/422; logs `pesos.*` sin montos. Tests en `src/server/__tests__/`.
- [ ] `operationLabel`: "Ingreso" / "Egreso" para Pesos (o una función hermana si mezclar los dos
      vocabularios la complica).
- [ ] UI: sección **Pesos** en `sections.ts` (`/pesos`, `/pesos/nueva`, ícono `Banknote`): saldo ARS,
      equivalente USD (MEP venta), historial con edición/borrado y formulario ingreso/egreso con nota
      (`SyncGate` en las vistas de datos).
- [ ] E2E: ingreso, egreso sin saldo (error), borrado que dejaría saldo negativo (error); alta con
      sesión en `e2e/sync.cloud.spec.ts`.

**Criterio de salida:** se cargan ingresos y egresos de pesos, en local y en la nube, el saldo nunca
queda negativo y lo local se puede subir al iniciar sesión.

---

## Fase 9 — Módulo CEDEARs

**Objetivo:** comprar y vender CEDEARs con pesos o dólares CCL, ver posiciones y PnL en ARS y USD.

### 9.1 Precios (server) — se puede hacer en paralelo a la Fase 8

- [ ] `src/server/cedears.ts`: cliente de data912 con schemas Zod de respuesta.
  - `getCedearPanel()` → `{ ticker, priceArs, priceCcl?, change24h, volume }[]` desde
    `/live/arg_cedears`, `next.revalidate` 5 min. Agrupa las tres filas de cada CEDEAR: `priceArs` =
    `c` del ticker base, `priceCcl` = `c` de `{ticker}C` si existe.
  - **Separar variantes con cuidado:** un símbolo terminado en `C` o `D` no siempre es una variante
    (`AMD` es un ticker base). Es variante si existe el símbolo sin la última letra **y** su precio es
    del orden de USD (precio base / precio variante parecido al CCL, ±30 %). Test con casos reales
    (`AMD`, `AAPLC`, `AAPLD`).
  - `getCedearHistory(ticker, from)` desde `/historical/cedears/{ticker}` (cierre `c`), revalidate 6 h.
- [ ] `GET /api/cedears/prices?tickers=` (precio ARS y CCL, variación, fecha), `GET /api/cedears/search?q=`
      (solo tickers base; sin `q`, los más operados por volumen) y `GET /api/history/cedears?ticker=`
      (último año, como el resto del gráfico).
- [ ] Nombres: el panel solo trae tickers. Catálogo estático `features/cedears/catalog.ts` con el nombre
      del subyacente para los más comunes (AAPL → Apple); el resto se muestra solo con el ticker.
- [ ] **Verificar cambios de ratio:** cuando BYMA cambia el ratio de un CEDEAR, el precio salta.
      Revisar si el histórico de data912 viene ajustado (comparar un caso conocido). Si no, el gráfico
      lo muestra tal cual con una nota; ajustar posiciones por cambio de ratio queda fuera de alcance.
- [ ] Tests de los schemas con respuestas guardadas; simular data912 en `e2e/fixtures.ts`.

### 9.0 Patas de CEDEARs en Pesos y Dólar (prerrequisito de 9.2)

- [ ] `cedearId?: string` en `Transaction` (Dólar) y `PesosMovement`. `transactions-storage` v3 → **v4**
      con `migrate` (campo opcional: los datos viejos son válidos) + test con snapshot. `pesos-storage`
      no sube de versión si la Fase 8 ya lo dejó con el campo opcional en el tipo.
- [ ] Prisma: `cedearId String? @db.Uuid` + `@@index([cedearId])` en `DolarTransaction` y
      `PesosMovement`; migración nueva. `mappers.ts` ida y vuelta.
- [ ] Reglas de forma (`assertDolarShape` y su par en Pesos): una pata con `cedearId` no es un resultado
      de trade ni lleva `usdtSwapId`; en Dólar, solo va en `contadoconliqui`.
- [ ] Las funciones puras de Dólar y Pesos rechazan editar o borrar una pata con `cedearId`:
      "Es parte de una operación de CEDEAR: modificala desde CEDEARs." (como `USDT_SWAP_LEG_REMOVE`).
      Tests en `src/domain/__tests__/` y `features/pesos/__tests__/`. La API devuelve 422 sola.
- [ ] Llevar `commitBoth` y `once` de `features/usdt-swaps/actions.ts` a `lib/synced-store.ts` como
      `commitAcross([{ store, next }], remote)`, para N stores. `usdt-swaps` lo usa sin cambiar de
      comportamiento. Test: si falla el request, cada store revierte lo suyo.
- [ ] Server: `loadLinkedState` de `server/usdt-swaps.ts` pasa a un helper compartido que carga los
      módulos pedidos (`dolar`, `crypto`, `pesos`, `cedears`) dentro de la misma `withUserTransaction`.
- [ ] Importación: una pata con `cedearId` sin su operación (o al revés) no se sube, igual que las
      patas sueltas de un intercambio USDT.

### 9.2 Modelo y cálculos

```ts
type CedearTransaction = {
  id: string                     // las patas lo guardan como `cedearId` (D8)
  ticker: string                 // ticker base en BYMA, ej. "AAPL"
  type: TransactionType
  quantity: number               // CEDEARs enteros, > 0
  price: number                  // por CEDEAR, en `currency`
  currency: 'ARS' | 'CCL'        // ARS → pata en Pesos; CCL → pata en Dólar `contadoconliqui`
  fxRate: number                 // ARS por USD CCL ese día (D4)
  fee?: number                   // comisión + derechos, en `currency`
  date: Date | string
}
```

- [ ] `features/cedears/metrics.ts`: `toArsLot`, `toUsdLot` (con la comisión: encarece la compra,
      reduce lo cobrado en la venta) y `computeCedearPositions(txs, prices, ccl)` → por ticker:
      cantidad, costo promedio ARS y USD, costo, valor de mercado ARS/USD, PnL realizado y no
      realizado en las dos monedas. Rótulo "Costo", no "Invertido" (mismo criterio que la Fase 7b).
      Tests en `features/cedears/__tests__/`.
- [ ] `features/cedears/operations.ts` (puro, store + server):
  - `buildFundingLeg(tx)` → con ARS: egreso de Pesos por `price × quantity + fee` en la compra, o
    ingreso por `price × quantity − fee` en la venta. Con CCL: venta (compra de CEDEAR) o compra (venta
    de CEDEAR) en el grupo `contadoconliqui` del Dólar por el monto USD, con `pesosAmount` = USD ×
    `fxRate`. La pata lleva `id` propio (del cliente) y `cedearId` = `tx.id`.
  - `applyAdd/Update/RemoveCedearTransaction({ cedears, pesos, dolar }, …)`: valida las unidades del
    CEDEAR (sin vender más de lo que hay), el saldo de pesos o de USD CCL, y devuelve los tres estados.
    Al editar con cambio de `currency`, la pata se mueve de módulo y se revalidan los dos. Mensajes en
    español ("No tenés pesos suficientes el dd/MM/yyyy.").
  - Cantidad entera: validación en Zod y en las funciones puras.
- [ ] **Efecto en el módulo Dólar:** pagar un CEDEAR con CCL es una **venta** de USD CCL, así que
      realiza en ARS la ganancia cambiaria de esos dólares (igual que USDT → cripto en la Fase 7a). La
      UI del Dólar lo explica en la fila de la pata.
- [ ] Persistencia: `cedears-storage` (`version: 1`) y `cedears-prices-storage` (`version: 1`, último
      precio como fallback).
- [ ] Prisma: `CedearTransaction` (`ticker`, `type`, `quantity Decimal`, `price Decimal`,
      `currency` enum `ARS | CCL`, `fxRate Decimal`, `fee Decimal?`, `date`, índice
      `[userId, ticker, date]`); migración.

### 9.3 API

- [ ] `/api/cedears/transactions[/:id]`: cada escritura carga los estados de CEDEARs + Pesos + Dólar
      del usuario (helper de 9.0), aplica la función pura y escribe la operación **y su pata** en la
      misma `withUserTransaction` (`Serializable`). Mismos códigos (401/400/404/409/422); ids del
      cliente (operación y pata). Logs `cedear.*` sin montos.
- [ ] Import: `importSchema` con CEDEARs (y la regla de patas de 9.0).
- [ ] Tests en `src/server/__tests__/` (atomicidad, ownership, 422 por saldo de pesos / CCL / unidades,
      edición que cambia de ARS a CCL, borrado, pata editada desde `/api/dolar` → 422).

### 9.4 UI

- [ ] Sección **CEDEARs** en `sections.ts` (`/cedears`, `/cedears/nueva`, `/cedears/[ticker]`, ícono
      `LineChart`).
- [ ] Formulario: buscador de ticker (combobox como `CoinCombobox`), compra/venta, cantidad,
      **pagado con** Pesos / Dólares CCL (con el saldo disponible de cada uno), precio autocompletado
      (en ARS, el del ticker base; en CCL, el del ticker `C` si tiene precio del día, si no ARS / CCL),
      CCL del día (`rateOn` para fechas pasadas, editable), comisión y fecha. Muestra el total que sale
      o entra de Pesos / CCL. Acciones con `await` y `whenReady`, como el resto.
- [ ] Vista `/cedears`: resumen (valor ARS y USD, costo, PnL realizado y no realizado en las dos
      monedas con selector ARS/USD), posiciones e historial con edición y borrado; aviso "precios con
      demora" (D5) y fecha del último precio.
- [ ] Detalle `/cedears/[ticker]`: operaciones filtradas y métricas del CEDEAR.
- [ ] Refresco de precios cada 5 min solo con la sección montada, con backoff ante fallos
      (`lib/backoff.ts`), como cripto.
- [ ] En `/pesos` y `/dolar`, las patas se ven como "CEDEAR · compra 10 AAPL" con link al detalle y sin
      editar ni borrar: contexto `use-cedear-legs` en `hooks/` (como `use-usdt-swap-links`), provisto
      por `features/cedears`.
- [ ] E2E: ingreso de pesos → compra de CEDEAR con pesos → venta; compra con CCL desde el dólar;
      error por falta de saldo; borrar la compra devuelve el saldo; la pata no se puede borrar desde
      `/pesos`.

**Criterio de salida:** se puede comprar y vender cualquier CEDEAR con pesos o dólares CCL, y los
saldos de Pesos y Dólar CCL, las posiciones y el PnL (ARS y USD) quedan consistentes en local y en la nube.

---

## Fase 10 — Portfolio con Pesos y CEDEARs

- [ ] `features/portfolio/overview.ts`: módulos `pesos` y `cedears`. Composición en USD: pesos / MEP
      venta (D3), CEDEARs / CCL compra (D5). Resumen por módulo con su ganancia (CEDEARs en USD).
- [ ] `history.ts`: saldo de pesos por día / MEP histórico; CEDEARs por día × cierre histórico ARS /
      CCL histórico. Sin precio → `null`, como hoy.
- [ ] Verificar que una compra de CEDEAR no cambie el total el día de la compra (sale de Pesos o CCL y
      entra en CEDEARs), como se verificó con los intercambios USDT.
- [ ] Colores: la paleta categórica sigue al activo (no hace falta otra); la tabla de composición hace
      drill-down a `/pesos` y `/cedears/[ticker]`.
- [ ] Home: tarjetas de las secciones nuevas (salen solas de `sections.ts`).
- [ ] Mover el detalle de las Fases 8–10 a `docs/historial.md` y actualizar `AGENTS.md`, `README.md` y
      `docs/roadmap.md`.

**Criterio de salida:** el dashboard suma Pesos y CEDEARs al valor total, la composición y la evolución.

---

## Fuera de alcance (posibles siguientes pasos)

- Que las compras/ventas del módulo Dólar debiten/acrediten Pesos (*pregunta abierta P2*).
- CEDEARs operados en **MEP** (ticker `D`): misma forma que CCL con el grupo `bolsa` del Dólar
  (`currency: 'MEP'`). data912 ya trae esos precios, así que el costo es sobre todo de UI.
- Dividendos de CEDEARs (en USD CCL o pesos): encaja con los resultados de trade de la Fase 7b.
- Cambios de ratio de conversión y valuación contra el subyacente en NYSE (CCL implícito).
- Rendimiento de los pesos (plazo fijo, FCI, caución) e inflación.

## Preguntas abiertas

- **P1:** ¿con qué dólar se pasan los pesos a USD en el dashboard? Propuesta: MEP venta.
- **P2:** ¿comprar dólares en el módulo Dólar debería descontar del saldo de Pesos? Propuesta: más
  adelante y opcional por operación ("pagado con mi saldo de pesos"), para no invalidar historiales ya
  cargados sin pesos. Sería otro uso de `cedearId`… o el tercer caso que justifique un enlace genérico (D8).
- **P3:** ¿data912 alcanza como fuente (demora, sin SLA) o preferís una con cuenta (IOL)? El route
  handler permite cambiarla después.
- **P4 (nueva):** ¿Pesos y CEDEARs salen juntos o Pesos se publica solo primero? La Fase 8 es útil por
  sí sola (saldo en pesos en el dashboard) y es de bajo riesgo; CEDEARs depende de la fuente externa.

## Orden y dependencias

```
Fase 7 ✅ (usdtSwapId, applyExternal, whenReady)
   └─> Fase 8 (Pesos)                    9.1 (precios data912) ← en paralelo, no depende de nada
          └─> 9.0 (patas con cedearId) ──┘
                 └─> 9.2–9.4 (CEDEARs)
                        └─> Fase 10 (portfolio)
```

- La Fase 8 ya no espera a los enlaces: Pesos es un módulo suelto hasta que llega CEDEARs.
- 9.1 conviene hacerla primero o en paralelo, para validar la fuente (variantes `C`/`D`, ratios) antes
  de construir el modelo encima.
