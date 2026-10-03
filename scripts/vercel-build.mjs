// Build de Vercel (Vercel usa `vercel-build` en lugar de `build` si existe).
// Solo producción aplica las migraciones pendientes: las previews comparten la base,
// y una rama sin fusionar no debe cambiarle el schema. Si la migración falla, el build
// falla y Vercel sigue sirviendo la versión anterior (nunca código nuevo con base vieja).
import { execSync } from 'node:child_process'

const run = (command) => execSync(command, { stdio: 'inherit' })

if (process.env.VERCEL_ENV === 'production') {
  run('prisma migrate deploy')
} else {
  console.log(`VERCEL_ENV=${process.env.VERCEL_ENV ?? 'local'}: se omite prisma migrate deploy`)
}
run('next build')
