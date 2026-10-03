import { defineConfig } from 'prisma/config'

// Prisma 7 no carga `.env` solo. En CI no hay `.env` (ni hace falta: `prisma generate`
// no se conecta a la base), por eso el `try`.
try {
  process.loadEnvFile()
} catch {}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Las migraciones usan la conexión directa (Neon: host sin `-pooler`); la app usa
  // `DATABASE_URL` (pooler) vía el adapter en `src/server/db.ts`.
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
})
