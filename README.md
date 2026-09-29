# 💸 DolarTracker / Portfolio Tracker

Aplicación web para seguir tus ahorros en Argentina, con dos módulos independientes:

- **Dólar:** compras y ventas de USD en pesos, con métricas por tipo de dólar.
- **Cripto:** compras y ventas de cualquier criptomoneda en USD, con precios de CoinGecko y valor en pesos según el dólar cripto.

## 🚀 Tecnologías utilizadas

- ⚛️ [Next.js](https://nextjs.org/) (App Router) + [React](https://react.dev/)
- 🟦 [TypeScript](https://www.typescriptlang.org/)
- 🎨 [Tailwind CSS](https://tailwindcss.com/)
- 🧠 [Zustand](https://zustand-demo.pmnd.rs/) para estado global + persistencia en `localStorage`
- ✅ [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) para formularios y validaciones
- 🌗 [next-themes](https://github.com/pacocoursey/next-themes) para modo claro/oscuro/sistema
- 🔔 [Sonner](https://sonner.emilkowal.ski/) para notificaciones toast
- 💱 [DolarAPI](https://dolarapi.com) para cotizaciones sin API key
- 🪙 [CoinGecko](https://www.coingecko.com/en/api) para precios cripto (API key opcional)

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

- **Módulo cripto**
  - Buscador de cualquier moneda de CoinGecko (populares por defecto)
  - Operaciones de compra/venta con cantidad, precio unitario en USD (autocompletable con el precio actual) y fecha
  - Posiciones por moneda: cantidad, costo promedio, valor de mercado, PnL realizado y no realizado (USD y %)
  - Resumen del portfolio en USD y su equivalente en pesos con el dólar cripto
  - Precios con variación 24 h, refrescados cada minuto; el último precio queda guardado si la API falla

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
    - `crypto-storage`
    - `crypto-prices-storage`
  - Modo principal **local-first**
  - Estructura preparada para modo autenticado con endpoints `/api/transactions` (parcialmente cableado)

## 📍 Rutas principales

- `/` → inicio con las secciones disponibles
- `/dolar` → cotizaciones e historial de transacciones en USD
- `/dolar/nueva` → formulario para cargar transacciones (`/new-transaction` redirige acá)
- `/cripto` → portfolio cripto: resumen, posiciones e historial
- `/cripto/nueva` → formulario para cargar operaciones cripto
- `/api/crypto/prices?ids=` y `/api/crypto/search?q=` → proxy a CoinGecko

## 🔑 Variables de entorno

Ninguna es obligatoria. Opcionalmente, copiá `.env.example` a `.env.local` y cargá una
clave Demo gratuita de CoinGecko en `COINGECKO_API_KEY` para tener un rate limit más alto.

## 🛠️ Comandos

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

