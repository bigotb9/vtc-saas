import { NextRequest, NextResponse } from "next/server"

/**
 * Proxy tenant : résout le slug du tenant à partir de l'URL et le
 * propage dans un header `x-tenant-slug` (lu côté serveur via headers())
 * + un cookie `tenant_slug` (lu côté client).
 *
 * (Anciennement middleware.ts — Next.js 16 a renommé middleware → proxy.)
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

const PUBLIC_PREFIXES = ["/saas", "/api/saas", "/api/public", "/api/signup", "/api/payment", "/api/webhooks", "/api/cron", "/dev", "/pay", "/_next", "/favicon", "/icon"]

/**
 * Routes accessibles SANS tenant — la landing publique vtcdashboard.com.
 * Sur ces paths on n'exige pas de slug et on rewrite vers /(marketing)/* pour
 * servir l'UI publique au lieu de l'app tenant.
 */
const MARKETING_PATHS = ["/", "/pricing", "/signup", "/landing"]

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + "/"))
}

function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATHS.includes(pathname)
}

/**
 * Hôtes qui sont l'app elle-même (pas un tenant). Le sous-domaine ne doit
 * PAS être interprété comme un slug pour ces hôtes — ils utilisent ?t= ou
 * le cookie pour identifier le tenant.
 *
 * Couvre :
 *   - les domaines vercel.app (deploy prod + previews)
 *   - localhost (dev)
 *   - tout domaine listé dans APP_DOMAINS (ex: "vtc-saas.com,app.vtc-saas.com")
 */
function isAppHost(hostname: string): boolean {
  if (hostname === "localhost") return true
  if (hostname.endsWith(".vercel.app")) return true
  const explicit = (process.env.APP_DOMAINS || "").split(",").map(d => d.trim()).filter(Boolean)
  if (explicit.includes(hostname)) return true
  return false
}

function resolveSlugFromHost(host: string): string | null {
  if (!host) return null
  const hostname = host.split(":")[0]
  // Si on est sur l'app elle-même (Vercel default, localhost, domaine principal),
  // pas d'extraction sous-domaine — le tenant vient de ?t= ou cookie.
  if (isAppHost(hostname)) return null
  const parts = hostname.split(".")
  if (parts.length < 2) return null
  if (parts[0] === "www") return null
  // Sous-domaine sur un domaine custom : acme.app.tondomaine.com → "acme"
  if (parts.length >= 3) return parts[0]
  return null
}

export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl
  if (isPublic(pathname)) return NextResponse.next()

  // 1. Custom domain : si l'hostname correspond à un tenant.custom_domain,
  //    on pose un header spécial que les routes server-side résoudront.
  //    (lookup async impossible dans le proxy edge — on délègue à l'app)
  const hostname = (req.headers.get("host") || "").split(":")[0]
  let slug: string | null = null
  if (hostname && !isAppHost(hostname)) {
    // Pourrait être un custom_domain OU un subdomain — on laisse le header
    // passer, et le serveur fera le lookup. Pour l'instant on tente le
    // subdomain extraction comme fallback.
    slug = resolveSlugFromHost(hostname)
  }

  // 2. Query string ?t= (override pour dev / tests)
  const qSlug = searchParams.get("t")
  if (qSlug) slug = qSlug

  // 3. Cookie déjà posé
  if (!slug) {
    const cookieSlug = req.cookies.get("tenant_slug")?.value
    if (cookieSlug) slug = cookieSlug
  }

  // 4. Fallback dev
  if (!slug) {
    slug = process.env.NEXT_PUBLIC_DEV_TENANT_SLUG || null
  }

  const requestHeaders = new Headers(req.headers)
  if (slug) requestHeaders.set("x-tenant-slug", slug)

  // Rewrite "/" vers "/landing" sur app host (vercel.app, localhost, domaine
  // racine), même si un cookie tenant_slug est posé — sinon un visiteur sur
  // vtcdashboard.com qui aurait visité un tenant auparavant atterrirait sur
  // la page de login dudit tenant au lieu de la landing publique.
  //
  // Pour accéder volontairement à un tenant via app host : utiliser ?t=<slug>
  // (override explicite, ce qui évite le rewrite).
  const isHostApp = isAppHost(hostname)
  if (pathname === "/" && !qSlug && (isHostApp || !slug)) {
    const url = req.nextUrl.clone()
    url.pathname = "/landing"
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  if (slug) {
    res.cookies.set("tenant_slug", slug, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    })
  }
  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png).*)"],
}
