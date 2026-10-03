# Operación en producción

Pasos que **no** viven en el código: se hacen a mano en los dashboards de Vercel, Clerk y Neon.
Complementa la sección "Deploy" del `README.md`. Nunca copiar valores reales de claves o URLs a
este archivo, issues o commits.

## 1. Variables de entorno en Vercel

Vercel → proyecto → *Settings → Environment Variables*. Cada variable se carga por entorno
(*Production*, *Preview*, *Development*).

| Variable                            | Production                       | Preview                                      |
| ----------------------------------- | -------------------------------- | -------------------------------------------- |
| `DATABASE_URL`                      | Neon, rama principal, con pooler | Neon, **rama de previews** (ver §3), pooler  |
| `DIRECT_URL`                        | Neon, rama principal, directa    | No hace falta (las previews no migran)       |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Instancia de producción (`pk_live_…`) | Instancia de desarrollo (`pk_test_…`)   |
| `CLERK_SECRET_KEY`                  | Instancia de producción (`sk_live_…`) | Instancia de desarrollo (`sk_test_…`)   |
| `COINGECKO_API_KEY`                 | Opcional                         | Opcional                                     |

Verificación después de cambiarlas (las variables se leen en el build: hay que **redeployar**):

1. El último deploy de producción muestra `prisma migrate deploy` sin errores en el log de build.
2. En la app publicada: iniciar sesión, cargar una compra de dólar, recargar la página y verla
   todavía (viene de la base, no del navegador).
3. En los logs de Vercel aparece `"event":"dolar.created"` (ver §4).

## 2. Clerk: instancia de producción

Hoy la app usa la instancia de desarrollo (`pk_test_`): tiene límites de usuarios, muestra el
aviso de "development mode" y no sirve para usuarios reales.

1. Clerk Dashboard → selector de instancia → *Create production instance* (se puede clonar la
   configuración de desarrollo: métodos de login, apariencia).
2. Requiere un **dominio propio** (no sirve `*.vercel.app`): cargar los registros DNS que pide
   Clerk en *Domains* y esperar a que queden verificados.
3. Si se usa login social (Google, etc.), producción necesita **credenciales OAuth propias**; las
   compartidas de Clerk son solo para desarrollo.
4. Copiar las claves `pk_live_` / `sk_live_` a las variables de *Production* en Vercel y redeployar.

Ojo: los usuarios de desarrollo **no** pasan a producción. Sus filas en la base quedan
huérfanas (`User.id` es el id de Clerk); si la base de producción ya tiene datos de prueba,
conviene arrancar con una base/rama limpia.

## 3. Neon: backups y ramas

**Restauración a un punto en el tiempo.** Neon guarda el historial de cambios de cada rama durante
la *history retention* del plan (Project settings → *Storage*; en el plan gratuito es corta). Para
restaurar: *Branches* → la rama → *Restore* a una fecha/hora, o crear una rama nueva desde ese
instante para inspeccionarla antes de pisar nada. Recomendado: subir la retención a lo máximo que
permita el plan y, antes de una migración riesgosa, crear una rama de respaldo a mano
(*Branches → New branch* desde la principal).

**Rama para previews.** `scripts/vercel-build.mjs` no migra en previews, pero si las previews usan
la misma `DATABASE_URL` que producción, escriben en los datos reales. Crear una rama `preview`
desde la principal y usar su URL en las variables de *Preview* (§1). Si una migración nueva hace
falta en la preview, aplicarla a mano contra esa rama (`DIRECT_URL=… pnpm db:deploy`) y
recrearla desde la principal cuando se fusione.

## 4. Logs

El server escribe una línea JSON por evento (`src/server/log.ts`); Vercel las guarda en
*Logs* (la retención depende del plan). Filtrar por texto, p. ej. `"level":"error"`.

| Evento                | Cuándo                                                        |
| --------------------- | ------------------------------------------------------------- |
| `dolar.created/updated/removed`  | Escritura OK en `/api/dolar/transactions*`         |
| `crypto.created/updated/removed` | Escritura OK en `/api/crypto/transactions*`        |
| `crypto.swapped`      | Intercambio creado                                            |
| `sync.imported`       | Subida de datos locales a la cuenta (creadas / salteadas)     |
| `api.unexpected`      | Error no previsto en `/api/*` (el usuario ve un 500 genérico) |
| `request.error`       | Error del server fuera de `/api/*` (render, proxy), vía `src/instrumentation.ts` |

Los rechazos esperables (400, 401, 404, 409, 422) **no** se loguean: son validación normal y el
usuario ya ve el mensaje. Los inicios de sesión se ven en Clerk Dashboard → *Users* / *Logs*.
Nunca se registran montos, headers ni cookies: solo ids opacos (usuario, operación, moneda) y el
tipo de operación.

## 5. Política de migraciones

- Toda modificación de `prisma/schema.prisma` va con su migración (`pnpm db:migrate`) en el mismo PR;
  nunca editar una migración ya aplicada.
- Producción migra sola al deployar `main` (`prisma migrate deploy`); si falla, el deploy falla y
  queda la versión anterior.
- Migraciones **compatibles hacia atrás**: mientras corre el deploy, la versión vieja de la app sigue
  atendiendo con la base ya migrada. Agregar columnas opcionales o tablas es seguro; para renombrar o
  borrar, hacerlo en dos deploys (primero el código deja de usar la columna, después se borra).
- Antes de una migración que borra o transforma datos: rama de respaldo en Neon (§3).
- Si una migración quedó a medias en producción: `prisma migrate resolve` (ver docs de Prisma) contra
  `DIRECT_URL`, nunca borrar filas de `_prisma_migrations` a mano.
