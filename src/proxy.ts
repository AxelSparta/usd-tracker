import { clerkMiddleware } from '@clerk/nextjs/server'

// Solo deja disponible la sesión (`auth()`) para el resto de la app. No protege nada
// por ruta: las futuras rutas de datos (Fase 2) chequean `auth()` en cada route handler,
// como recomienda Clerk (el matching por path puede divergir del routing de Next).
export default clerkMiddleware()

export const config = {
  matcher: [
    // Todo menos internos de Next y archivos estáticos
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
