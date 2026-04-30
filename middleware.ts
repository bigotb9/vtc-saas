import { NextRequest, NextResponse } from "next/server"

/**
 * Middleware tenant : résout le slug du tenant à partir de l'URL et le
 * propage dans un header `x-tenant-slug` (lu côté serveur via headers())
 * + un cookie `tenant_slug` (lu côté client).
 *
 * Ordre de résolution :
 *   1. Sous-domaine — `acme.tondomaine.com` → slug=`acme`
 *   2. Query string — `?t=acme` (utile en dev)
 *   3. Cookie déjà posé — persistance entre requêtes
 *   4. Fallback dev — env `NEXT_PUBLIC_DEV_TENANT_SLUG`
 *
 * Routes exclues (pas de tenant requis) :
 *   - `/saas/*`         tour de contrôle
 *   - `/api/saas/*`     API admin SaaS
 *   - `/api/public/*`   endpoints publics (notamment tenant config)
 *   - `/_next/*`, statiques
 */

const PUBLIC_PREFIXES = ["/saas", "/api/saas", "/api/public", "/_next", "/favicon", "/icon"]

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + "/"))
}

function resolveSlugFromHost(host: string): string | null {
  // Production: acme.app.exemple.com → "acme"
  // Dev:       acme.localhost:3000  → "acme"
  if (!host) return null
  const hostname = host.split(":")[0]
  const parts = hostname.split(".")
  // Si c'est juste "localhost" ou "exemple.com" sans subdomain → null
  if (parts.length < 2) return null
  if (parts[0] === "www") return null
  if (parts[0] === "localhost") return null
  // En dev, on a souvent acme.localhost
  if (parts.length === 2 && parts[1] === "localhost") return parts[0]
  // En prod, on prend le 1er segment
  if (parts.length >= 3) return parts[0]
  return null
}

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl
  if (isPublic(pathname)) return NextResponse.next()

  // 1. Sous-domaine
  let slug = resolveSlugFromHost(req.headers.get("host") || "")

  // 2. Query string (priorité supérieure pour overrider en dev)
  const qSlug = searchParams.get("t")
  if (qSlug) slug = qSlug

  // 3. Cookie déjà posé
  if (!slug) {
    const cookieSlug = req.cookies.get("tenant_slug")?.value
    if (cookieSlug) slug = cookieSlug
  }

  // 4. Fallback env dev
  if (!slug) {
    slug = process.env.NEXT_PUBLIC_DEV_TENANT_SLUG || null
  }

  // Forward le header sur la REQUEST (lisible côté server via headers())
  const requestHeaders = new Headers(req.headers)
  if (slug) requestHeaders.set("x-tenant-slug", slug)

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  if (slug) {
    // Cookie 1 an (non httpOnly pour que le client puisse aussi le lire)
    res.cookies.set("tenant_slug", slug, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    })
  }
  return res
}

// Limiter le matcher aux routes pertinentes (exclut explicitement les statiques)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png).*)"],
}
