# Roadmap de Implementación - Portfolio Tracker

Este roadmap prioriza la entrega de valor inmediato mediante la mejora de la funcionalidad "local-first" antes de proceder con la infraestructura de nube y autenticación.

## Fase 1: Funcionalidad Core (Local-First)
Objetivo: Permitir que el usuario clasifique sus transacciones y vea métricas precisas sin necesidad de login.

- [ ] **Clasificación por Tipo de Dólar:**
    - Modificar `src/types/transaction.types.ts` para incluir `dolarOption: DolarOption`.
    - Actualizar el formulario `NewTransactionForm.tsx` para seleccionar el tipo de dólar (Blue, MEP, etc.) al registrar la compra/venta.
- [ ] **Cálculos Financieros Segmentados:**
    - Refactorizar `updateTransactionsData` en `src/store/transaction.store.ts`.
    - Calcular **Precio Promedio, Ganancias Realizadas y No Realizadas** de forma independiente para cada tipo de dólar.
- [ ] **UI de Resumen:**
    - Mostrar el estado del portfolio agrupado por moneda en el `TransactionList.tsx` o un nuevo componente de Dashboard.
- [ ] **Mensaje de Modo Local:**
    - Añadir un banner informativo: *"Estás usando el modo local. Tus datos se guardarán solo en este navegador. Registrate para sincronizar en la nube."* (Este mensaje servirá como placeholder para la Fase 2).

## Fase 2: Autenticación (Clerk)
Objetivo: Identificar a los usuarios para habilitar la persistencia en la nube.

- [ ] Configurar proyecto en el Dashboard de **Clerk**.
- [ ] Instalar `@clerk/nextjs` y configurar variables de entorno.
- [ ] Implementar `<ClerkProvider>` y el componente `<UserButton />` en el `Header.tsx`.
- [ ] Crear el Middleware de Clerk para manejar sesiones de usuario.

## Fase 3: Persistencia Cloud (Neon + Prisma)
Objetivo: Migrar y sincronizar datos para usuarios autenticados.

- [ ] **Base de Datos:** Configurar instancia en **Neon.tech** (PostgreSQL).
- [ ] **ORM:** Instalar y configurar **Prisma** (`schema.prisma`).
- [ ] **Modelo de Datos:** Definir el modelo `Transaction` incluyendo `userId` y `dolarType`.
- [ ] **API Endpoints:** Crear rutas en `src/app/api/transactions/` para operaciones CRUD en PostgreSQL.

## Fase 4: Integración Híbrida y Sincronización
Objetivo: Unificar el flujo entre el estado local y el estado en la nube.

- [ ] **Lógica de Store Condicional:**
    - Detectar estado `isSignedIn`.
    - Si es `true`, realizar peticiones a la API de Prisma.
    - Si es `false`, mantener persistencia en `localStorage`.
- [ ] **Sincronización Inicial:** Detectar si hay datos en `localStorage` al momento del primer login y ofrecer subirlos a la nube.
- [ ] **Refinamiento de UX:** Ocultar el mensaje de "Modo Local" una vez que el usuario esté autenticado.
