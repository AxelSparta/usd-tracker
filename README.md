# 💸 DolarTracker / Portfolio Tracker

Aplicación web para registrar y analizar transacciones de dólares (USD/USDT) en Argentina.  
Permite cargar compras y ventas, consultar cotizaciones en vivo y ver métricas de rendimiento por tipo de dólar.

## 🚀 Tecnologías utilizadas

- ⚛️ [Next.js](https://nextjs.org/) (App Router) + [React](https://react.dev/)
- 🟦 [TypeScript](https://www.typescriptlang.org/)
- 🎨 [Tailwind CSS](https://tailwindcss.com/)
- 🧠 [Zustand](https://zustand-demo.pmnd.rs/) para estado global + persistencia en `localStorage`
- ✅ [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) para formularios y validaciones
- 🌗 [next-themes](https://github.com/pacocoursey/next-themes) para modo claro/oscuro/sistema
- 🔔 [Sonner](https://sonner.emilkowal.ski/) para notificaciones toast
- 💱 [DolarAPI](https://dolarapi.com) para cotizaciones sin API key

## 🧠 Funcionalidades del proyecto

- **Registro de transacciones**
  - Alta de transacciones de tipo **Compra** o **Venta**
  - Carga de monto en pesos (ARS), monto en dólares (USD) y fecha
  - Cálculo automático del tipo de cambio unitario (`usdPrice`)
  - Selección del tipo de dólar para cada transacción

- **Validaciones del formulario**
  - Validación con Zod para campos obligatorios y tipos correctos
  - Montos con formato local (AR) y conversión segura a número
  - Restricciones de fecha (sin fechas futuras)
  - Para ventas, protección contra saldo negativo por timeline

- **Cotizaciones en tiempo real**
  - Obtención de cotizaciones desde DolarAPI
  - Refresco automático de cotizaciones cada 5 minutos
  - Visualización destacada de: oficial, blue, bolsa y cripto
  - Soporte interno para más tipos: contado con liqui, tarjeta y mayorista

- **Métricas financieras por tipo de dólar**
  - Historial agrupado por `dolarOption`
  - Cálculo de:
    - Posición actual en USD
    - Costo promedio
    - Total invertido (ARS)
    - Valor de mercado actual (ARS)
    - Ganancia realizada
    - Ganancia no realizada (PnL)
  - Re-cálculo automático de métricas cuando cambia la cotización

- **Gestión de historial**
  - Tabla por grupo de dólar con orden cronológico y badges por operación
  - Eliminación de transacciones con confirmación
  - Estado vacío con CTA para crear la primera transacción

- **Experiencia de usuario**
  - Navegación entre listado y nueva transacción
  - Tema claro/oscuro/sistema
  - Interfaz responsive
  - Notificaciones de éxito/error al crear o eliminar
  - Página personalizada de error 404

- **Persistencia y arquitectura**
  - Persistencia local en `localStorage`:
    - `transactions-storage`
    - `dolar-storage`
  - Modo principal **local-first**
  - Estructura preparada para modo autenticado con endpoints `/api/transactions` (parcialmente cableado)

## 📍 Rutas principales

- `/` → tablero principal con cotizaciones + historial + métricas
- `/new-transaction` → formulario para cargar transacciones

## 🛠️ Comandos

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

