import { NextRequest, NextResponse } from "next/server"
import { getTenantBySlug } from "@/lib/tenantConfig"

/**
 * GET /api/public/tenant?slug=acme
 *
 * Endpoint PUBLIC (pas d'auth) qui retourne la config tenant nécessaire
 * au navigateur pour instancier son client Supabase. NE retourne JAMAIS
 * la service_role key — uniquement l'anon key qui est de toute façon
 * destinée à être exposée côté client.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")
  if (!slug) return NextResponse.json({ error: "slug requis" }, { status: 400 })

  const tenant = await getTenantBySlug(slug)
  if (!tenant) return NextResponse.json({ error: "tenant introuvable" }, { status: 404 })

  return NextResponse.json({
    nom:                tenant.nom,
    slug:               tenant.slug,
    supabase_url:       tenant.supabase_url,
    supabase_anon_key:  tenant.supabase_anon_key,
    module_yango:       tenant.module_yango,
    module_wave:        tenant.module_wave,
    module_ai_insights: tenant.module_ai_insights,
    plan:               tenant.plan,
    logo_url:           tenant.logo_url,
    feature_flags:      tenant.feature_flags || {},
    config:             tenant.config        || {},
    // notes : NE PAS exposer (admin only)
  })
}
