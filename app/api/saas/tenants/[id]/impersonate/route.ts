import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { requireSaasAdmin } from "@/lib/saasAuth"

/**
 * POST /api/saas/tenants/[id]/impersonate
 *
 * Génère un magic link de connexion pour l'admin du tenant ciblé. Permet au
 * support / SaaS admin de se connecter dans la peau du client pour debug.
 *
 * Auth : saas_admin uniquement. Une trace est laissée dans provisioning_logs
 * pour audit.
 *
 * Le lien retourné est à usage unique et expire rapidement (10 min côté
 * Supabase Auth).
 */

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const { id } = await ctx.params

  const { data: tenant } = await supabaseMaster
    .from("tenants")
    .select("id, slug, nom, email_admin, supabase_url, supabase_service_key, provisioning_status")
    .eq("id", id)
    .maybeSingle()

  if (!tenant) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 })
  if (tenant.provisioning_status !== "ready") {
    return NextResponse.json({ error: `Tenant en ${tenant.provisioning_status} — pas encore actif` }, { status: 400 })
  }
  if (!tenant.supabase_service_key || tenant.supabase_service_key === "pending") {
    return NextResponse.json({ error: "Service key tenant manquante" }, { status: 500 })
  }

  // Crée un client tenant avec le service_role
  const tenantClient = createClient(tenant.supabase_url!, tenant.supabase_service_key!, {
    auth: { persistSession: false },
  })

  // Génère un magic link pour l'email admin du tenant
  const baseUrl = process.env.SITE_BASE_URL || "https://vtcdashboard.com"
  const { data: link, error } = await tenantClient.auth.admin.generateLink({
    type:  "magiclink",
    email: tenant.email_admin,
    options: {
      redirectTo: `${baseUrl}/?t=${tenant.slug}`,
    },
  })

  if (error) {
    return NextResponse.json({ error: `generateLink failed: ${error.message}` }, { status: 500 })
  }

  // Audit : log dans provisioning_logs
  await supabaseMaster.from("provisioning_logs").insert({
    tenant_id: tenant.id,
    step:      "impersonate",
    status:    "success",
    message:   `${admin.email} (${admin.id}) a généré un magic link pour ${tenant.email_admin}`,
  })

  return NextResponse.json({
    ok:       true,
    link:     link.properties?.action_link || link.properties?.email_otp || null,
    target_email: tenant.email_admin,
    tenant:   { id: tenant.id, slug: tenant.slug, nom: tenant.nom },
    note:     "Le lien expire dans environ 10 minutes. Ne le partagez pas.",
  })
}
