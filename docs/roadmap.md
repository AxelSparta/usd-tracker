# Roadmap de Implementación - Portfolio Tracker

Este roadmap prioriza la entrega de valor inmediato con enfoque **local-first** y luego evoluciona hacia autenticación + persistencia cloud.

## Estado actual (abril 2026)

Ya está implementado en producción local:

- Registro de compras/ventas con selección de tipo de dólar.
- Historial agrupado por tipo de dólar.
- Cálculos por grupo: posición USD, costo promedio, invertido ARS, valor actual, PnL realizado y no realizado.
- Cotizaciones desde DolarAPI + refresco automático cada 5 minutos.
- Persistencia local con Zustand (`transactions-storage`, `dolar-storage`).
- Tema claro/oscuro/sistema y feedback con toasts.
- Estructura de store preparada para flujo remoto (`isSignedIn`) con endpoints de API todavía parciales.

## Fase 1: Funcionalidad Core (Local-First)
Objetivo: Permitir que el usuario clasifique sus transacciones y vea métricas precisas sin necesidad de login.

- [x] **Clasificación por Tipo de Dólar:**
    - Modificar `src/types/transaction.types.ts` para incluir `dolarOption: DolarOption`.
    - Actualizar el formulario `NewTransactionForm.tsx` para seleccionar el tipo de dólar (Blue, MEP, etc.) al registrar la compra/venta.
- [x] **Cálculos Financieros Segmentados:**
    - Refactorizar `updateTransactionsData` en `src/store/transaction.store.ts`.
    - Calcular **Precio Promedio, Ganancias Realizadas y No Realizadas** de forma independiente para cada tipo de dólar.
- [x] **UI de Resumen:**
    - Mostrar el estado del portfolio agrupado por moneda en el `TransactionList.tsx` o un nuevo componente de Dashboard.
- [ ] **Mensaje de Modo Local:**
    - Añadir banner informativo: *"Estás usando el modo local. Tus datos se guardan solo en este navegador. Registrate para sincronizar en la nube."*

### Pendientes de consolidación local (pre-Fase 2)

- [ ] Agregar edición de transacciones (actualmente solo alta y borrado).
- [ ] Incorporar tests para cálculos del store (`updateTransactionsData`, `validateTimeline`).
- [ ] Mejorar visualización temporal (gráficos por evolución de portfolio).
- [ ] Definir métricas agregadas globales (todos los tipos de dólar combinados).

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
- [ ] **Paridad funcional local/cloud:** Garantizar que validaciones y cálculos sean consistentes en ambos modos.

## Fase 4: Integración Híbrida y Sincronización
Objetivo: Unificar el flujo entre el estado local y el estado en la nube.

- [ ] **Lógica de Store Condicional:**
    - Detectar estado `isSignedIn`.
    - Si es `true`, realizar peticiones a la API de Prisma.
    - Si es `false`, mantener persistencia en `localStorage`.
- [ ] **Sincronización Inicial:** Detectar si hay datos en `localStorage` al momento del primer login y ofrecer subirlos a la nube.
- [ ] **Refinamiento de UX:** Ocultar el mensaje de "Modo Local" una vez que el usuario esté autenticado.

## Fase 5: Calidad y Operación
Objetivo: Asegurar mantenibilidad, observabilidad y despliegue estable.

- [ ] Pipeline CI (lint, typecheck, build y tests).
- [ ] Manejo robusto de errores de red para DolarAPI (retries, estados de fallback).
- [ ] Instrumentación de analytics/eventos clave (alta, venta, borrado, sincronización).
- [ ] Definir política de backups y migraciones para entorno cloud.
