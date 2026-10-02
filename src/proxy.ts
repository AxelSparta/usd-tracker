import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Datos de cada usuario (Fase 2). Los precios (`/api/crypto/{prices,search}`) siguen
// públicos y las páginas no se protegen: el modo local funciona sin login.
const isProtectedRoute = createRouteMatcher([
  '/api/dolar/(.*)',
  '/api/crypto/transactions(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect()
})

export const config = {
  matcher: [
    // Todo menos internos de Next y archivos estáticos
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
