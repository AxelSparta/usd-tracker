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

La app está en producción (Vercel) con los módulos Dólar, Cripto, Pesos y CEDEARs, login, nube y dashboard:

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
- **Resultados de trades** (Fase 7b): ganancias y pérdidas de futuros, margin o bots en USDT o en
  cualquier moneda, dentro del PnL realizado.
- **Pesos** (Fase 8): saldo en ARS (ingresos y egresos) con su equivalente al MEP venta, y
  conversiones enlazadas pesos ↔ cualquier tipo de dólar. El dashboard suma el saldo.
- **CEDEARs** (Fases 9–10): compras y ventas pagadas con pesos o dólares CCL (la pata mueve el saldo
  de Pesos o del Dólar CCL), posiciones y PnL en ARS y USD al CCL venta, precios de data912 y
  CEDEARs en el dashboard.
- **Portafolios** (Fase 11): varios portafolios separados (cada uno con sus cuatro módulos y saldos),
  en local y en la nube; el dashboard muestra el activo o todos sumados.
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
| 7 ✅ | Intercambios USDT ↔ cripto (7a) y resultados de trades (7b) | [historial](historial.md#fase-7--intercambios-usdt-dólar-cripto--cripto-y-resultados-de-trades-) |
| 8 ✅ | Pesos: saldo en ARS, conversiones pesos ↔ dólar y Pesos en el dashboard | [historial](historial.md#fase-8--pesos-y-conversiones-a-dólar-) |
| 9 ✅ | CEDEARs: precios (data912), patas en Pesos / Dólar CCL, modelo, API, stores y UI | [historial](historial.md#fase-9--módulo-cedears-) |
| 10 ✅ | CEDEARs en el dashboard (total, composición y evolución) | [historial](historial.md#fase-10--cedears-en-el-portfolio-) |
| 11 ✅ | Múltiples portafolios (local y nube) y vista "Todos" en el dashboard | [historial](historial.md#fase-11--múltiples-portafolios-) |

### Deuda técnica y riesgos vigentes

| Tema | Impacto | Dónde se resuelve |
| ---- | ------- | ----------------- |
| Los E2E con sesión no corren en CI | Pasan en local; en CI se saltean hasta que se cargue `E2E_DATABASE_URL` | Fase 6 (opcional) |
| Clerk en instancia de desarrollo (`pk_test_`) | Límite de usuarios y aviso de "development mode": no sirve para usuarios reales | Fase 6 (manual) |
| Sin rate limits en `/api/*` | Bajo: toda escritura exige sesión y solo toca datos propios; los proxies de precios cachean | Fase 6, siguiente iteración |
| El módulo dólar vive en `store/`, `services/` y `components/`, no en `features/dolar/` | Solo de orden: no bloquea nada | **Sin fase asignada.** No moverlo a medias; si se decide, se planifica como fase propia |

---

## Reglas de arquitectura

- **Cuatro módulos independientes.** Dólar: operaciones ARS ↔ USD por tipo de dólar, reporte en ARS.
  Cripto: operaciones en USD por moneda de CoinGecko, reporte en USD con equivalente en pesos
  usando el dólar cripto (cotización de compra). Pesos: saldo en ARS, en USD al MEP venta. CEDEARs:
  operaciones pagadas con pesos o dólares CCL, reporte en ARS y en USD al CCL venta.
- **Motor compartido, modelos separados.** Cada módulo adapta sus operaciones a
  `PositionLot` (`quantity`, `quoteAmount`) y redondea según su unidad; no hay un tipo
  `Transaction` genérico ni `AssetKey`.
- **Dependencias:** `domain` no importa nada de `features`, `app` ni `store`; los módulos no se
  importan entre sí, salvo las excepciones acordadas: cripto **lee** la cotización del dólar cripto
  de `useDolarStore`, y en capas `dólar ← pesos ← cedears` (Pesos importa el store y las funciones
  puras del Dólar para las conversiones; CEDEARs, los de Pesos y Dólar para sus patas). Nunca al
  revés: los módulos de abajo ven sus patas por contextos de `hooks/`. Los *composers*
  (`features/auth`, `features/portfolio` y `features/usdt-swaps`) leen los módulos y solo los
  importa `app/`. `server/` nunca se importa desde componentes cliente.
- **APIs externas detrás de route handlers**: el navegador no llama a CoinGecko, ArgentinaDatos ni
  data912 directo; los handlers validan parámetros, cachean con el Data Cache de Next
  (`next.revalidate`) y validan la respuesta con Zod.
- **Reglas de negocio en funciones puras** (`domain/transactions.ts`, `features/*/operations.ts`,
  `features/pesos/conversions.ts`) que usan tanto los stores como el server; el origen local/nube
  de cada store lo resuelve `src/lib/synced-store.ts`.

---

## Fase 6 — Calidad, operación y despliegue (lo pendiente)

Lo hecho (CI, E2E en modo local, errores de red, logs, migraciones en el deploy, guía de operación)
está en [`historial.md`](historial.md#fase-6--calidad-operación-y-despliegue-parte-hecha).

**Entorno y CI:**

- [x] **(manual)** Neon: el `.env` local apunta a una rama de desarrollo, no a producción (oct 2026).
- [x] **(manual)** Vercel: `DATABASE_URL` de *Preview* apunta a una rama de Neon, no a producción
  (oct 2026).
- [ ] **(manual)** Neon: subir la retención del historial (restore a un punto en el tiempo). Pasos en
  `docs/operacion.md` §3.
- [x] E2E de login y sincronización (`e2e/sync.cloud.spec.ts`, `@clerk/testing`, proyecto `cloud`):
  alta con sesión que sobrevive a la recarga y no toca `localStorage`, escritura fallida que se
  revierte, importación de lo local con "Subir a mi cuenta" (cierra lo que la Fase 3 dejó sin probar).
  Pasan en local contra Clerk de desarrollo (con "Email address" habilitado) y la rama de desarrollo.
- [x] CI: secretos `E2E_CLERK_PUBLISHABLE_KEY` y `E2E_CLERK_SECRET_KEY` (oct 2026). Sin ellos el job
  `e2e` nunca pasó: Clerk apaga el keyless mode en CI y `next dev` no arrancaba.
- [ ] *(opcional)* CI: cargar `E2E_DATABASE_URL` (rama de Neon propia para tests) para que el paso
  "E2E con sesión" corra
  (`docs/operacion.md` §3).

**Cuando haya usuarios reales:**

- [ ] **(manual)** Variables de entorno de producción en Vercel: verificar `DATABASE_URL` y pasar Clerk a
  una instancia de producción (requiere dominio propio). Pasos en `docs/operacion.md` §1–2.
- [ ] Rate limits en `/api/*` con un store compartido (p. ej. Upstash Redis): un límite en memoria no
  sirve en serverless.
- [ ] Sentry (se engancha en `src/server/log.ts` e `src/instrumentation.ts`).

## Backlog

Sin fase asignada; se planifica cuando haga falta.

- Watchlist y refresh manual de cotizaciones (extras de la Fase 5).
- Migrar `tether` cargado en el módulo Cripto al grupo `cripto` del Dólar.
- Otras stablecoins (USDC, DAI) como "dólar cripto": hoy siguen siendo monedas del módulo Cripto.
- Resultados de trade sin moneda (solo un monto en USD que no cambia ningún saldo).
- Portafolios: subir de una vez todos los portafolios locales al iniciar sesión (hoy se sube el
  portafolio local activo al portafolio activo de la nube) y mover operaciones entre portafolios.

---

## Orden y dependencias

```
Fases 0–5 ✅
Fase 6 (pendiente: retención de Neon, base de E2E en CI, lo de "usuarios reales")
Fase 7 ✅ (7a: intercambios USDT ↔ cripto · 7b: resultados de trades)
Fase 8 ✅ (Pesos + conversiones a dólar)
Fases 9–10 ✅ (CEDEARs; plan y decisiones en docs/roadmap-cedears.md)
Fase 11 ✅ (múltiples portafolios)
```

- Lo que sigue: lo pendiente de la Fase 6, el backlog y los "posibles siguientes pasos" de
  `docs/roadmap-cedears.md` (CEDEARs en MEP, dividendos, cambios de ratio, editar conversiones).

---

*Actualizar este documento, `historial.md` y `AGENTS.md` en el mismo PR de cada fase completada.*
