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

La app está en producción (Vercel) con los módulos Dólar, Cripto y Pesos, login, nube y dashboard:

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
  `useDolarStore`; desde la Fase 8, Pesos importa el store y las funciones puras del Dólar para las
  conversiones, nunca al revés: `dólar ← pesos`). Los *composers* (`features/auth`, `features/portfolio` y, desde la Fase 7,
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

## Backlog

Sin fase asignada; se planifica cuando haga falta.

- Watchlist y refresh manual de cotizaciones (extras de la Fase 5).
- Migrar `tether` cargado en el módulo Cripto al grupo `cripto` del Dólar.
- Otras stablecoins (USDC, DAI) como "dólar cripto": hoy siguen siendo monedas del módulo Cripto.
- Resultados de trade sin moneda (solo un monto en USD que no cambia ningún saldo).

---

## Orden y dependencias

```
Fases 0–5 ✅
Fase 6 (pendiente: retención de Neon, secretos E2E en CI, lo de "usuarios reales")
Fase 7 ✅ (7a: intercambios USDT ↔ cripto · 7b: resultados de trades)
Fase 8 ✅ (Pesos + conversiones a dólar)
Fases 9–10 (CEDEARs): ver docs/roadmap-cedears.md
```

- Lo que sigue: CEDEARs (Fases 9–10, en CCL), empezando por la 9.1 (precios de data912). Detalle en
  `docs/roadmap-cedears.md`. Más lo pendiente de la Fase 6 y el backlog.

---

*Actualizar este documento, `historial.md` y `AGENTS.md` en el mismo PR de cada fase completada.*
