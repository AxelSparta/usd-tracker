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
  - Se declara educativa/hobby y **no es tiempo real** (`max-age=30`; en la revisión 2 se habían medido ~2 h). Va detrás de un
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

## Fase 8 — Pesos (con conversiones a dólar) ✅

Cerrada en oct 2026; el detalle (modelo, tareas 8.1–8.4 y verificación) está en
[`historial.md`](historial.md#fase-8--pesos-y-conversiones-a-dólar-). Lo que deja para CEDEARs:
`commitAcross` (commit optimista en N stores, `lib/synced-store.ts`), `loadLinkedState`
(`server/linked-state.ts`), `linkOf(tx)` (`domain/transactions.ts`) y `useDolarRate`.
`PesosMovement` todavía **no** tiene `cedearId`: lo suma la 9.0.

---

## Fases 9 y 10 — CEDEARs ✅

Cerradas en oct 2026; el detalle (9.0–9.4, Fase 10, hallazgos de data912 y verificación) está en
[`historial.md`](historial.md#fase-9--módulo-cedears-). En resumen:

- **9.1** precios de data912 (panel en vivo, buscador, histórico sin ajustar por ratio).
- **9.0** `cedearId` en las patas de Pesos y del Dólar CCL, que no se editan ni se borran solas.
- **9.2** `CedearTransaction` (moneda `ARS` | `CCL` + `fxRate`), posiciones en ARS y USD, funciones
  puras que escriben la operación y su pata.
- **9.3** API `/api/cedears/transactions`, importación, `cedears-storage` y acciones en tres stores.
- **9.4** UI (`/cedears`, `/cedears/nueva`, `/cedears/[ticker]`) y patas visibles en `/pesos` y `/dolar`.
- **10** CEDEARs en el dashboard: total, composición (ARS / CCL venta) y evolución.

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

- ~~P3~~ Resuelta (oct 2026, con los hallazgos de la 9.1): se sigue con **data912**, también para el
  histórico. Los CEDEARs sin histórico quedan sin precio en la evolución (`null`) y el gráfico avisa
  que el histórico no está ajustado por cambios de ratio. El route handler permite cambiar de fuente
  después sin tocar el cliente.
- ~~P1~~ Resuelta: los pesos pasan a USD con el **MEP venta** (D3), en `/pesos` y en el dashboard.
- ~~P2~~ Resuelta: los pesos se convierten a cualquier dólar con conversiones enlazadas (D9, Fase 8).
- ~~P4~~ Resuelta: Pesos se fusiona sola, apenas esté lista.

## Orden y dependencias

```
Fase 7 ✅ (usdtSwapId, applyExternal, whenReady)
   └─> Fase 8 ✅ (Pesos + conversiones + dashboard) ──> PR a main
          │                                     9.1 ✅ (precios data912)
          └─> 9.0 ✅ (patas con cedearId) ───────┘
                 └─> 9.2 ✅ (modelo y cálculos) ─> 9.3 ✅ (API, stores) ─> 9.4 ✅ (UI)
                        └─> Fase 10 ✅ (CEDEARs en el portfolio)
```

- La Fase 8 se fusiona sola: deja `commitAcross`, el loader compartido del server, `linkOf` y
  `useDolarRate`, que CEDEARs reutiliza.
- 9.1 conviene hacerla primero o en paralelo, para validar la fuente (variantes, ratios) antes de
  construir el modelo encima.
