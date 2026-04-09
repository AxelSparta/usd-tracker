# Contexto del proyecto (agentes de código)

Este archivo orienta a **cualquier asistente de código** (Cursor, Claude, Gemini, Copilot, etc.) sobre el repositorio. No sustituye al README ni a `docs/roadmap.md`; complétalos si necesitas detalle de producto o planificación.

## Resumen

Aplicación web para registrar **compras y ventas** de USD/USDT orientada al mercado argentino: cotizaciones vía API pública, métricas de costo promedio y ganancias realizadas / no realizadas. Modo principal **local-first** con persistencia en el navegador; el store ya contempla ramas para usuario autenticado y API (aún por cablear por completo).

## Stack (versiones según `package.json`)

| Área | Elección |
|------|----------|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript 6.x |
| UI | React 19 |
| Estilos | Tailwind CSS 4 (`@tailwindcss/postcss`) |
| Estado | Zustand 5 + `persist` → `localStorage` |
| Formularios | React Hook Form + Zod 4 + `@hookform/resolvers` |
| Componentes base | Radix UI, `class-variance-authority`, `tailwind-merge` |
| Tema | `next-themes` (claro / oscuro / sistema) |
| Feedback | Sonner (toasts) |
| Iconos | `lucide-react`, `react-icons` si hace falta marca |
| Fechas | `date-fns`, `dayjs`, `react-day-picker` |
| Datos externos | [DolarAPI](https://dolarapi.com) (`src/services/dolarApi.ts`) — sin API key |

**Gestor de paquetes:** `pnpm` (usar `pnpm`, no mezclar con npm/yarn en este repo).

## Alias y rutas

- Importaciones: alias `@/*` → `src/*` (ver `tsconfig.json`).
- Rutas App Router relevantes:
  - `/` — lista de transacciones (`TransactionList`).
  - `/new-transaction` — formulario alta (`NewTransactionForm`).

## Estructura de carpetas (`src/`)

- `app/` — layouts, páginas, `providers.tsx` (cliente: `ThemeProvider`), estilos globales.
- `components/` — piezas de UI; `ui/` para primitivos reutilizables.
- `store/` — `transaction.store.ts` (transacciones, cálculos, persistencia), `dolar.store.ts` (tipo de dólar y datos de cotización).
- `services/` — cliente HTTP hacia DolarAPI.
- `types/` — tipos e enums compartidos (`transaction`, `dolar`, etc.).
- `validations/` — esquemas Zod (p. ej. `transaction.ts`) usados por formularios y tipos.

## Comportamiento importante del estado

- **Persistencia:** Zustand `persist` con nombre de storage **`transactions-storage`** (no `transaction-storage`).
- **Suscripción:** En `transaction.store.ts`, suscripción a `useDolarStore`: al cambiar la cotización se vuelve a ejecutar `updateTransactionsData` sobre las transacciones actuales.
- **Cálculos:** Costo promedio acumulado con compras; ventas ajustan posición y suman a ganancia realizada; ganancia no realizada usa el precio de venta del dólar **actualmente seleccionado** en `dolar.store` (`dolarData?.venta`). Cada transacción puede guardar su propio `dolarOption`; un desglose de métricas por tipo de dólar sigue pendiente (ver `docs/roadmap.md`).
- **Modo remoto (preparado):** Si `isSignedIn` es verdadero, el store intenta `GET/POST /api/transactions` y `DELETE /api/transactions/:id`. Esas rutas pueden no existir aún; el flujo por defecto es local.

## Convenciones de desarrollo

- Componentes funcionales con tipos explícitos para props.
- Formularios: React Hook Form + esquemas Zod en `src/validations/`.
- Estilos: utilidades Tailwind; variantes `dark:` donde aplique.
- Páginas: el layout raíz es servidor; componentes interactivos llevan `'use client'` cuando corresponda.
- Idioma de la app: `lang="es"` en el HTML; textos de UI en español salvo que el producto pida lo contrario.

## Comandos

```bash
pnpm dev      # next dev --turbopack
pnpm build
pnpm start
pnpm lint     # next lint
```

No hay script de tests en `package.json` por ahora.

## Variables de entorno

- La cotización **no** requiere variables: URL fija en `dolarApi.ts`.
- Puede existir un `.env` en el repo con claves pensadas para **futuras** integraciones (auth, DB, webhooks). **No commitear secretos** ni volcar valores reales en documentación o issues. Para trabajo local, usar placeholders y rotar credenciales si se expusieron.

## Documentación y skills adicionales

- Roadmap y fases (local-first, Clerk, Neon/Prisma, etc.): `docs/roadmap.md`.
- Buenas prácticas Next.js del propio repo: `.agents/skills/next-best-practices/SKILL.md` y archivos enlazados desde ahí.

## Líneas futuras / TODO de producto

- Endpoints reales bajo `app/api/transactions` alineados con el store.
- Gráficos y evolución temporal del portfolio.
- Autenticación y persistencia en nube según `docs/roadmap.md`.

---

*Mantén este archivo factual respecto al código; si cambian rutas, storage o integraciones, actualízalo en el mismo PR.*
