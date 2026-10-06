# Roadmap — Pesos y CEDEARs

Extiende `docs/roadmap.md` (Fases 0–7, cerradas en `docs/historial.md`) con dos secciones nuevas, al
mismo nivel que **Dólar** y **Cripto**:

1. **Pesos:** saldo en ARS del portafolio (ingresos y egresos) y **conversiones** de esos pesos a
   cualquier tipo de dólar del módulo Dólar (y de vuelta a pesos).
2. **CEDEARs:** compras y ventas de CEDEARs pagadas con **pesos** (del saldo de Pesos) o con
   **dólares CCL** (del grupo `contadoconliqui` del módulo Dólar). El dólar de referencia de todo el
   módulo es el **contado con liquidación (CCL)**.

> Guía de uso: igual que el roadmap principal, cada fase es un hito desplegable por sí mismo y los
> checkboxes son pasos concretos. Actualizar este documento (y `AGENTS.md`) en el mismo PR de cada fase.

> **Revisión 1 (oct 2026), después de cerrar la Fase 7.** Se descartó reemplazar `usdtSwapId` por un
> `link` genérico (D8), Pesos dejó de depender de los enlaces y se corrigió la fuente de precios.
>
> **Revisión 2 (oct 2026), contra el código y data912 en vivo.** Cambios:
> - **CCL venta en todo CEDEARs** (D4, D5): el plan valuaba en USD con CCL *compra*, la punta
>   equivocada para pasar pesos a dólares e inconsistente con el `fxRate` de cada operación.
> - **Pesos se fusiona sola** apenas esté lista (era P4) y suma **conversiones pesos ↔ cualquier
>   dólar** (era P2, ahora D9). Por eso entran a la Fase 8 el dashboard con Pesos (estaba en la 10),
>   el commit en varios stores y el loader compartido del server (estaban en la 9.0).
> - **data912:** la regla para separar las variantes `C`/`D` fallaba con datos reales (`BAC` es
>   Boeing en CCL, no Bank of America; hay símbolos con punto; precios en 0 o viejos). Nueva regla en
>   9.1, y no se usan los precios de las variantes.
> - Correcciones menores: la importación **rechaza** (422) los enlaces incompletos, no los saltea;
>   el histórico del dólar del cliente hoy solo pide el dólar cripto; subir versión de los storages
>   con `migrate` aunque el campo nuevo sea opcional (convención de `AGENTS.md`).

---

## Punto de partida (qué se reutiliza)

| Pieza existente | Uso en Pesos / CEDEARs |
| --- | --- |
| `domain/position.ts` (`computePosition`) | Costo promedio y PnL de CEDEARs (dos corridas: en ARS y en USD CCL) |
| `domain/timeline.ts` (`sortTxs`, `findNegativeBalance`, genéricos sobre `type` + `date`) | Orden y saldo nunca negativo (pesos, unidades de CEDEAR, USD). `validateTimeline` está atado a `dollarsAmount` y a un mensaje de USD: Pesos necesita el suyo |
| `lib/synced-store.ts` (`createSync`, `whenReady`/`untilReady`) | Local-first + nube para los stores nuevos; esperar a que estén listos antes de validar |
| `applyExternal(next, remote)` en `transaction.store.ts` y `crypto.store.ts` (Fase 7a) | Aplicar en el store del Dólar la pata de una conversión o de un CEDEAR. Pesos lo trae desde el día uno |
| `features/usdt-swaps/actions.ts` (`commitBoth`, `once`) | Commit optimista en dos stores con **un** request. Se generaliza a N stores en la Fase 8 (conversiones) |
| `hooks/use-usdt-swap-links` + `UsdtSwapLinksProvider` | Cómo una lista muestra y borra una pata ajena **sin importar** al módulo dueño. Se repite para conversiones (Fase 8) y patas de CEDEARs (Fase 9) |
| `server/usdt-swaps.ts` (`loadLinkedState` + `withUserTransaction`) | Cargar varios módulos del usuario y escribir la operación y su pata en una transacción `Serializable`. Pasa a un helper compartido en la Fase 8 |
| `services/dolarHistory.ts` (`rateOn`) + `/api/history/dolar?casas=` | La ruta ya acepta cualquier tipo de dólar (ArgentinaDatos tiene los 7, incluidos `bolsa` y `contadoconliqui`), pero el cliente solo pide el cripto (`fetchCriptoHistory`, `useDolarCriptoRate`): hay que generalizarlo. Cubre el **último año**; antes, la cotización se carga a mano |
| `store/dolar.store.ts` | Cotización en vivo de los 7 tipos (DolarAPI), incluidos CCL (`contadoconliqui`) y MEP (`bolsa`) |
| `lib/operation-label.ts` | Un texto por fila; suma "Ingreso" / "Egreso", las conversiones y las patas de CEDEAR |
| `lib/sections.ts` | Sidebar y home: una entrada nueva por sección |
| `features/portfolio/` | Dashboard: Pesos en la Fase 8, CEDEARs en la 10 |
| `features/auth/` (`CloudSync`, `useCloudStatus`, `local-import.ts`) + `server/import.ts` | Cada store nuevo se conecta a la nube, entra en el estado del badge y en la importación |
| Schemas Zod de la API (`createTransactionApiSchema`) | Descartan campos que no declaran: los endpoints de cada módulo **no** pueden crear patas (`usdtSwapId` hoy, `conversionId` y `cedearId` después). Solo los crean los endpoints de la operación enlazada |

**Lo que no existe y hace falta:**

- **Una fuente de precios de CEDEARs.** Propuesta: [data912](https://data912.com) (pública, sin key).
  Verificado en oct 2026 (detalle en 9.1):
  - `GET /live/arg_cedears`: un panel de ~1020 filas con `symbol`, `c` (último), `px_bid`/`px_ask`,
    `q_bid`/`q_ask`, `v` (volumen), `q_op` (operaciones) y `pct_change`; **sin fecha**. ~420 son
    CEDEARs en ARS (`AAPL`) y ~600 sus variantes en USD CCL (`AAPLC`) y USD MEP (`AAPLD`), con poco
    volumen y a veces con precio 0 o de días atrás.
  - `GET /historical/cedears/{ticker}`: OHLC diario (`date`, `o`, `h`, `l`, `c`, `v`, más `dr` y
    `sa`) desde 2012 (AAPL: 3374 ruedas), sin el tope de 365 días de CoinGecko.
  - Se declara educativa/hobby y **no es tiempo real** (cache de ~2 h en Cloudflare). Va detrás de un
    route handler, como CoinGecko, para poder cambiarla (IOL, BYMA) sin tocar el cliente.
- **Un commit optimista en más de dos stores** (Pesos + Dólar en la Fase 8; CEDEARs + Pesos + Dólar
  en la 9) y una forma de rechazar cambios a una pata desde su propio módulo.

---

## Decisiones

> **D1 — Dos módulos nuevos e independientes**, `src/features/pesos/` y `src/features/cedears/`,
> con la misma estructura que `features/crypto` (no se repite el layout viejo de `store/` +
> `components/` del dólar). Cada uno con su modelo, store, tabla, API y formulario.

> **D2 — Dirección de dependencias en capas:** `dólar ← pesos ← cedears` (y `cedears → dólar`).
> Pesos importa funciones puras y el store del Dólar (conversiones, D9); CEDEARs importa los de Pesos
> y Dólar. **Nunca al revés:** el Dólar no importa Pesos ni CEDEARs, y Pesos no importa CEDEARs. Un
> módulo de abajo solo sabe que una operación suya es una pata (`conversionId`, `cedearId`, D8) y la
> muestra con lo que recibe por un contexto de `hooks/` (como `use-usdt-swap-links` en la Fase 7):
> "Pesos · $ 1.000.000" en el Dólar, "CEDEAR · compra 10 AAPL" en Pesos o Dólar, con link al módulo
> dueño. Ninguna pata se edita ni se borra sola. `AGENTS.md` suma esta excepción a "los módulos no se
> importan entre sí" en el PR de la Fase 8.

> **D3 — Pesos es un saldo, no un activo con precio.** Ingresos (`BUY`) y egresos (`SELL`) en ARS;
> sin PnL (inflación y rendimientos de FCI/caución quedan fuera). Para el dashboard en USD se valúa
> con el **dólar MEP venta**, que es lo que cuesta pasarlos a dólares en el mercado (P1, confirmado).

> **D4 — Cada operación de CEDEAR guarda su moneda y el CCL del día.**
> `currency: 'ARS' | 'CCL'` + `fxRate` (ARS por USD CCL). Se autocompleta con el **CCL venta** del día
> (DolarAPI si es hoy; `/api/history/dolar?casas=contadoconliqui` si es una fecha pasada del último
> año; si no, a mano) y se puede editar. Con eso cada operación tiene monto en ARS **y** en USD, sin
> importar cómo se pagó, y la posición se calcula en las dos monedas con el mismo motor:
> - ARS: `quoteAmount` = monto ARS (si se pagó en CCL, USD × `fxRate`).
> - USD: `quoteAmount` = monto USD (si se pagó en pesos, ARS / `fxRate`).
>
> El PnL que importa en un CEDEAR (activo dolarizado) es el de USD; el de ARS se muestra al lado.

> **D5 — Valuación en vivo:** cantidad × último precio ARS del ticker base (el más líquido). En USD:
> valor ARS / **CCL venta** (DolarAPI). Es la misma punta que D4: comprar y valuar el mismo día da PnL
> en USD = 0 (con compra, la diferencia de punta aparecería como ganancia), y la misma convención que el
> resto de la app (el Dólar valúa a `venta`, Pesos pasa a USD con MEP venta). No se usan los precios de
> las variantes `C`/`D` (poco volumen, a veces 0 o de días atrás). Sin precio (o `c = 0`) → `null`,
> nunca inventado (como cripto).

> **D6 — Las patas de un CEDEAR se crean, editan y borran juntas** desde CEDEARs. A diferencia de los
> swaps y las conversiones, una compra de CEDEAR sí se puede **editar**: la función pura reconstruye la
> pata y revalida todas las líneas temporales afectadas (CEDEAR, y pesos y/o USD CCL si se cambió cómo
> se pagó).

> **D7 — Saldo obligatorio:** comprar con pesos exige saldo en Pesos a esa fecha; con CCL, saldo en el
> grupo `contadoconliqui` del Dólar. Si falta, el error lo dice y el formulario ofrece "Registrar un
> ingreso de pesos" o "Convertir pesos a CCL" (D9) sin perder lo cargado.

> **D8 — Las patas guardan un id concreto por tipo de enlace, no un `link` genérico.** Con las
> conversiones (D9) hay tres casos, y se reevaluó:
> - `usdtSwapId` (Fase 7a, en producción) y `conversionId` (Fase 8): **dos patas del mismo rango**
>   (ninguna es "la operación"), así que comparten un id propio del enlace.
> - `cedearId` (Fase 9): la operación tiene **una dueña** (`CedearTransaction`) y **una pata** (pesos
>   o dólar CCL): alcanza con que la pata guarde el id de la operación.
> - Un `link?: { id, kind }` obligaría a migrar `usdtSwapId` (filas reales y dos storages) y a que la
>   importación acepte las dos formas, sin funcionalidad nueva. Lo que sí se centraliza es la regla: un
>   helper puro (`linkOf(tx)`, en `domain/`) dice si una operación del Dólar es pata y de qué, y de ahí
>   salen el rechazo al editar/borrar y la regla "como mucho un enlace por operación".

> **D9 (nueva) — Conversiones pesos ↔ dólar.** Una conversión son dos operaciones enlazadas por
> `conversionId`, como un intercambio USDT:
> - **Pesos → dólar:** egreso de Pesos (`SELL`, `amount` = ARS) + compra en el Dólar (`BUY`) en el
>   grupo elegido, con `pesosAmount` = los mismos ARS y `dollarsAmount` = los USD recibidos.
> - **Dólar → pesos:** venta en el Dólar (`SELL`) + ingreso de Pesos (`BUY`) por los ARS cobrados.
> - **Cualquier tipo de dólar** de `DolarOption` (oficial, blue, MEP, CCL, cripto = USDT, mayorista,
>   tarjeta): el mismo selector que el formulario del Dólar.
> - Se cargan **los dos montos** (ARS y USD), como en el formulario del Dólar: incluyen impuestos y
>   comisiones del banco o exchange. La cotización del día (venta si se compran dólares, compra si se
>   venden; DolarAPI o el histórico) se muestra como referencia y sirve para completar un monto desde
>   el otro.
> - **No se editan** (como los intercambios USDT): se borran juntas y se cargan de nuevo. Al borrar se
>   revalidan las dos líneas (los USD comprados pueden haberse vendido; los pesos cobrados, gastado).
> - Viven en `features/pesos` (el dueño del flujo); el Dólar ve sus patas por un contexto (D2).
> - Para la pata del Dólar, la conversión **es** una compra o venta normal: entra al costo promedio y,
>   si es una venta, realiza ganancia en ARS, igual que hoy.

---

## Fase 8 — Pesos (con conversiones a dólar)

**Objetivo:** registrar los pesos del portafolio, ver el saldo (también en el dashboard) y
convertirlos a cualquier tipo de dólar y de vuelta. Se **fusiona a `main` sola**, apenas esté
verificada, sin esperar a CEDEARs.

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

- [ ] Dólar: `conversionId?` en `Transaction`. `transactions-storage` v3 → **v4** con `migrate`
      (campo opcional: los datos viejos son válidos) + test con snapshot. Prisma: `conversionId
      String? @db.Uuid` + `@@index([conversionId])` en `DolarTransaction` (misma migración que 8.1);
      `mappers.ts` ida y vuelta.
- [ ] Reglas de forma con `linkOf(tx)` (D8): una operación del Dólar tiene como mucho un enlace
      (`usdtSwapId` o `conversionId`) y una pata de conversión no es un resultado de trade.
      `applyUpdateTransaction` / `applyRemoveTransaction` rechazan una pata de conversión ("Es una
      conversión de pesos: borrala completa."). La API del Dólar devuelve 422 sola. Tests en
      `src/domain/__tests__/`.
- [ ] Funciones puras (`features/pesos/conversions.ts`, store + server): `buildConversionLegs(input,
      ids)` → `[pata pesos, pata dólar]` con el mismo monto en ARS; `applyAddConversion` (valida los
      pesos en Pesos → dólar y los USD del grupo en Dólar → pesos; montos > 0) y
      `applyRemoveConversion` (revalida las dos líneas); `assertConversionsComplete` para la
      importación (cada `conversionId`: una pata en cada módulo, de tipos opuestos y con el mismo monto
      en ARS; si no, 422, como `assertUsdtSwapsComplete`).
- [ ] Llevar `commitBoth` y `once` de `features/usdt-swaps/actions.ts` a `lib/synced-store.ts` como
      `commitAcross([{ store, next }], remote)`, para N stores. `usdt-swaps` lo usa sin cambiar de
      comportamiento. Test: si falla el request, cada store revierte lo suyo.
- [ ] Server: `loadLinkedState` de `server/usdt-swaps.ts` pasa a un helper compartido que carga los
      módulos pedidos (`dolar`, `crypto`, `pesos`; `cedears` en la Fase 9) dentro de la misma
      `withUserTransaction`. `POST /api/pesos/conversions` (input + ids del cliente) y
      `DELETE /api/pesos/conversions/:conversionId` escriben las dos tablas en una transacción
      `Serializable` (`server/pesos-conversions.ts`); logs `pesosConversion.*`. Tests: atomicidad,
      ownership, 422 por saldo, pata editada o borrada desde `/api/dolar` o `/api/pesos` → 422.
- [ ] Cotización de referencia: generalizar `fetchCriptoHistory` → `fetchDolarHistory(option)` y
      `useDolarCriptoRate` → `useDolarRate(option, side, date)` (el de cripto pasa a ser un caso).
- [ ] UI: pestaña **Convertir** en `/pesos/nueva` (`?modo=conversion&dolar=<tipo>`): dirección,
      tipo de dólar, fecha, monto ARS, monto USD, cotización de referencia y cotización implícita, y
      el saldo disponible (pesos o USD de ese tipo). Atajo "Comprar con pesos" en `/dolar`. En `/dolar`
      la pata se ve con un distintivo "Pesos" y sin editar; borrarla borra la conversión completa por
      el contexto `use-pesos-conversion-links` (`hooks/`, provisto por `features/pesos` en
      `app/providers.tsx`).

### 8.3 Pesos en el dashboard (estaba en la Fase 10)

- [ ] `overview.ts`: módulo `pesos` (activo `pesos:ars`, drill-down a `/pesos`): `valueArs` = saldo,
      `valueUsd` = saldo / MEP venta. Sin cotización MEP no entra a la composición y se avisa (como
      `missingPrices`). Sin PnL: `ModuleSummary.pnl` admite `null` y la tarjeta no lo muestra.
- [ ] `history.ts`: saldo de pesos por día; ARS = saldo, USD = saldo / MEP venta de ese día
      (`priceAt`). `useValueHistory` pide `bolsa` cuando hay pesos. Sin cotización → `null`.
- [ ] `usePortfolioOverview`: estado combinado de los tres stores, `hasOperations` y `retry` con Pesos.
- [ ] Verificar: una conversión no cambia el total en ARS si se hizo a la cotización de valuación, y en
      USD solo cambia por la diferencia entre la cotización usada y el MEP (ej. pesos a blue).

### 8.4 Cierre

- [ ] E2E: ingreso; egreso sin saldo (error); borrado que dejaría saldo negativo (error); conversión
      pesos → blue (baja el saldo de pesos y aparece en `/dolar`); la pata no se edita desde `/dolar` y
      borrarla ahí borra las dos; dólar → pesos; conversión sin saldo (error). Con sesión en
      `e2e/sync.cloud.spec.ts`: alta, conversión e importación de lo local.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, E2E y el flujo en `pnpm dev`.
- [ ] Documentación: detalle a `docs/historial.md`, `AGENTS.md` (módulo, storage `pesos-storage` y
      `transactions-storage` v4, la excepción de dependencias de D2), `README.md` y `docs/roadmap.md`.
- [ ] PR a `main`.

**Criterio de salida:** se cargan ingresos y egresos de pesos y se convierten a cualquier dólar y de
vuelta, en local y en la nube; ningún saldo queda negativo; lo local se puede subir al iniciar sesión;
el dashboard suma los pesos.

---

## Fase 9 — Módulo CEDEARs

**Objetivo:** comprar y vender CEDEARs con pesos o dólares CCL, ver posiciones y PnL en ARS y USD
(con CCL venta como tipo de cambio, D4 y D5).

### 9.1 Precios (server) — se puede hacer en paralelo a la Fase 8

- [ ] `src/server/cedears.ts`: cliente de data912 con schemas Zod de respuesta.
  - `getCedearPanel()` → `{ ticker, priceArs, change24h, volume }[]` desde `/live/arg_cedears`,
    `next.revalidate` 5 min. Solo tickers base y su precio en ARS (`c`; `0` = sin precio). El panel no
    trae fecha: la API informa cuándo se obtuvo.
  - **Separar variantes** (verificado con el panel real, oct 2026). Lo que no sirve:
    - "termina en `C`/`D`": hay tickers base así (`C` Citigroup, `ELPC` Copel, `BA.C` Bank of America).
    - "existe el símbolo sin la última letra": `BAC` es Boeing (`BA`) en CCL, y Bank of America es
      `BA.C`, con variantes `BA.CC` y `BA.CD`. Hay variantes con punto (`C.D`, `B.C`, `CAR.D`).
    - "precio base / variante ≈ CCL ± 30 %": las variantes tienen precios en 0 (`BMYC`, `PSXC`) o
      viejos (`ELPCD` +40 %, `NGC` y `YELPD` −31 %).

    Regla: una fila es variante si termina en `C`/`D` (o `.C`/`.D`), existe su base (el símbolo sin ese
    sufijo) y `base.c / fila.c > 100` o `fila.c = 0`. Con el panel de oct 2026 deja ~12 huérfanas en
    USD cuyo base tiene otro ticker (`GOGLC`, `PETRC`/`PETRD`, `VAL3C`/`VAL3D`, `ALAC`/`ALAD`, `AKOBD`
    de `AKO.B`): lista de exclusión en `features/cedears/catalog.ts`. Test con un snapshot del panel
    real (`AAPL`, `AAPLC`, `BA`, `BAC`, `BA.C`, `BA.CC`, `C`, `C.D`, `BB`, `BBD`, `ELPC`, `BMYC`).
  - `getCedearHistory(ticker, from)` desde `/historical/cedears/{ticker}` (cierre `c`), revalidate 6 h.
  - Tickers con punto (`BA.C`): validación `^[A-Z0-9]+(\.[A-Z0-9]+)?$` y probar el path en la URL.
- [ ] `GET /api/cedears/prices?tickers=` (precio ARS, variación, cuándo se obtuvo),
      `GET /api/cedears/search?q=` (solo tickers base; sin `q`, los más operados por volumen) y
      `GET /api/history/cedears?ticker=` (último año, como el resto del gráfico).
- [ ] Nombres: el panel solo trae tickers. Catálogo estático `features/cedears/catalog.ts` con el nombre
      del subyacente para los más comunes (AAPL → Apple) y la lista de exclusión; el resto se muestra
      solo con el ticker.
- [ ] **Cambios de ratio:** en el histórico de AAPL (3374 ruedas) no hay saltos diarios > 40 %, lo que
      sugiere que viene ajustado. Confirmarlo con un CEDEAR con cambio de ratio conocido. Si no viene
      ajustado, el gráfico lo muestra tal cual con una nota; ajustar posiciones por cambio de ratio
      queda fuera de alcance.
- [ ] Tests de los schemas con respuestas guardadas; simular data912 en `e2e/fixtures.ts`.

### 9.0 Patas de CEDEARs en Pesos y Dólar (prerrequisito de 9.2)

- [ ] `cedearId?: string` en `Transaction` (Dólar) y `PesosMovement`. `transactions-storage` v4 → **v5**
      y `pesos-storage` v1 → **v2**, con `migrate` (campo opcional: los datos viejos son válidos) +
      tests con snapshot.
- [ ] Prisma: `cedearId String? @db.Uuid` + `@@index([cedearId])` en `DolarTransaction` y
      `PesosMovement`; migración nueva. `mappers.ts` ida y vuelta.
- [ ] Reglas de forma (`linkOf`, `assertDolarShape`, `assertPesosShape`): como mucho un enlace por
      operación; en el Dólar, una pata de CEDEAR solo va en `contadoconliqui` y no es un resultado de trade.
- [ ] Las funciones puras de Dólar y Pesos rechazan editar o borrar una pata con `cedearId`:
      "Es parte de una operación de CEDEAR: modificala desde CEDEARs." Tests en `src/domain/__tests__/`
      y `features/pesos/__tests__/`. Las APIs devuelven 422 solas.
- [ ] `commitAcross` (Fase 8) con tres stores; el loader compartido del server suma `cedears`.
- [ ] Importación: `assertCedearLegsComplete`. Cada operación tiene exactamente una pata en el módulo
      que corresponde (ARS → Pesos; CCL → Dólar `contadoconliqui`), y cada `cedearId` apunta a una
      operación. Si no, se rechaza (422), como los intercambios USDT y las conversiones.

### 9.2 Modelo y cálculos

```ts
type CedearTransaction = {
  id: string                     // las patas lo guardan como `cedearId` (D8)
  ticker: string                 // ticker base en BYMA, ej. "AAPL", "BA.C"
  type: TransactionType
  quantity: number               // CEDEARs enteros, > 0
  price: number                  // por CEDEAR, en `currency` (ARS, o USD CCL)
  currency: 'ARS' | 'CCL'        // ARS → pata en Pesos; CCL → pata en Dólar `contadoconliqui`
  fxRate: number                 // ARS por USD CCL ese día, CCL venta por defecto (D4)
  fee?: number                   // comisión + derechos, en `currency`
  date: Date | string
}
```

- [ ] `features/cedears/metrics.ts`: `toArsLot`, `toUsdLot` (con la comisión: encarece la compra,
      reduce lo cobrado en la venta) y `computeCedearPositions(txs, prices, cclSell)` → por ticker:
      cantidad, costo promedio ARS y USD, costo, valor de mercado ARS/USD (D5), PnL realizado y no
      realizado en las dos monedas. Rótulo "Costo", no "Invertido" (mismo criterio que la Fase 7b).
      Tests en `features/cedears/__tests__/` (incluido: comprar y valuar el mismo día con el mismo CCL
      da PnL 0 en las dos monedas).
- [ ] `features/cedears/operations.ts` (puro, store + server):
  - `buildFundingLeg(tx, legId)` → con ARS: egreso de Pesos por `price × quantity + fee` en la compra,
    o ingreso por `price × quantity − fee` en la venta. Con CCL: venta (compra de CEDEAR) o compra
    (venta de CEDEAR) en el grupo `contadoconliqui` del Dólar por el monto USD, con `pesosAmount` =
    USD × `fxRate`. La pata lleva `id` propio (del cliente) y `cedearId` = `tx.id`.
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
      del usuario (loader compartido), aplica la función pura y escribe la operación **y su pata** en
      la misma `withUserTransaction` (`Serializable`). Mismos códigos (401/400/404/409/422); ids del
      cliente (operación y pata). Logs `cedear.*` sin montos.
- [ ] Import: `importSchema` con CEDEARs (y la regla de patas de 9.0).
- [ ] Tests en `src/server/__tests__/` (atomicidad, ownership, 422 por saldo de pesos / CCL / unidades,
      edición que cambia de ARS a CCL, borrado, pata editada desde `/api/dolar` o `/api/pesos` → 422).

### 9.4 UI

- [ ] Sección **CEDEARs** en `sections.ts` (`/cedears`, `/cedears/nueva`, `/cedears/[ticker]`, ícono
      `ChartLine`; `LineChart` es el alias viejo de lucide).
- [ ] Formulario: buscador de ticker (combobox como `CoinCombobox`), compra/venta, cantidad,
      **pagado con** Pesos / Dólares CCL (con el saldo disponible de cada uno), CCL del día
      (`useDolarRate('contadoconliqui', 'sell', date)`, editable), precio autocompletado (en ARS, el
      último del ticker base o su cierre de ese día; en CCL, ese precio / CCL del formulario), comisión
      y fecha. Muestra el total que sale o entra de Pesos / CCL. Acciones con `await` y `whenReady`,
      como el resto.
- [ ] Vista `/cedears`: resumen (valor ARS y USD, costo, PnL realizado y no realizado en las dos
      monedas con selector ARS/USD), posiciones e historial con edición y borrado; aviso "precios con
      demora" (D5) y cuándo se obtuvo el último precio.
- [ ] Detalle `/cedears/[ticker]`: operaciones filtradas y métricas del CEDEAR.
- [ ] Refresco de precios cada 5 min solo con la sección montada, con backoff ante fallos
      (`lib/backoff.ts`), como cripto.
- [ ] En `/pesos` y `/dolar`, las patas se ven como "CEDEAR · compra 10 AAPL" con link al detalle y sin
      editar ni borrar: contexto `use-cedear-legs` en `hooks/` (como `use-usdt-swap-links`), provisto
      por `features/cedears`.
- [ ] E2E: ingreso de pesos → compra de CEDEAR con pesos → venta; conversión de pesos a CCL → compra con
      CCL; error por falta de saldo; borrar la compra devuelve el saldo; la pata no se puede borrar desde
      `/pesos` ni desde `/dolar`.

**Criterio de salida:** se puede comprar y vender cualquier CEDEAR con pesos o dólares CCL, y los
saldos de Pesos y Dólar CCL, las posiciones y el PnL (ARS y USD) quedan consistentes en local y en la nube.

---

## Fase 10 — CEDEARs en el portfolio

- [ ] `features/portfolio/overview.ts`: módulo `cedears`. Composición en USD: valor ARS / CCL venta
      (D5). Resumen por módulo con su ganancia (CEDEARs en USD).
- [ ] `history.ts`: CEDEARs por día × cierre histórico ARS / CCL venta histórico (`contadoconliqui`).
      Sin precio → `null`, como hoy.
- [ ] Verificar que una compra de CEDEAR no cambie el total el día de la compra (sale de Pesos o CCL y
      entra en CEDEARs al mismo CCL), como se verificó con los intercambios USDT.
- [ ] Colores: la paleta categórica sigue al activo (no hace falta otra); la tabla de composición hace
      drill-down a `/cedears/[ticker]`.
- [ ] Home: tarjeta de la sección nueva (sale sola de `sections.ts`).
- [ ] Mover el detalle de las Fases 9–10 a `docs/historial.md` y actualizar `AGENTS.md`, `README.md` y
      `docs/roadmap.md`.

**Criterio de salida:** el dashboard suma CEDEARs al valor total, la composición y la evolución.

---

## Fuera de alcance (posibles siguientes pasos)

- Editar conversiones pesos ↔ dólar (hoy se borran y se cargan de nuevo, como los intercambios USDT).
  Con la edición de CEDEARs (D6) ya hecha, es el mismo patrón.
- Que una compra normal del módulo Dólar debite Pesos sin pasar por "Convertir": las conversiones
  (D9) cubren el caso sin invalidar historiales ya cargados sin pesos.
- CEDEARs operados en **MEP** (ticker `D`): misma forma que CCL con el grupo `bolsa` del Dólar
  (`currency: 'MEP'`). Hoy el módulo usa solo CCL.
- Dividendos de CEDEARs (en USD CCL o pesos): encaja con los resultados de trade de la Fase 7b.
- Cambios de ratio de conversión y valuación contra el subyacente en NYSE (CCL implícito).
- Rendimiento de los pesos (plazo fijo, FCI, caución) e inflación.

## Preguntas abiertas

- **P3:** ¿data912 alcanza como fuente (demora, sin SLA) o preferís una con cuenta (IOL)? El route
  handler permite cambiarla después.
- ~~P1~~ Resuelta: los pesos pasan a USD con el **MEP venta** (D3), en `/pesos` y en el dashboard.
- ~~P2~~ Resuelta: los pesos se convierten a cualquier dólar con conversiones enlazadas (D9, Fase 8).
- ~~P4~~ Resuelta: Pesos se fusiona sola, apenas esté lista.

## Orden y dependencias

```
Fase 7 ✅ (usdtSwapId, applyExternal, whenReady)
   └─> Fase 8 (Pesos + conversiones + dashboard) ──> PR a main
          │                                     9.1 (precios data912) ← en paralelo, no depende de nada
          └─> 9.0 (patas con cedearId) ──────────┘
                 └─> 9.2–9.4 (CEDEARs)
                        └─> Fase 10 (CEDEARs en el portfolio)
```

- La Fase 8 se fusiona sola: deja `commitAcross`, el loader compartido del server, `linkOf` y
  `useDolarRate`, que CEDEARs reutiliza.
- 9.1 conviene hacerla primero o en paralelo, para validar la fuente (variantes, ratios) antes de
  construir el modelo encima.
