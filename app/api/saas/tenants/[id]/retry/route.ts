import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { supabaseManagement } from "@/lib/supabaseManagement"
import { requireSaasAdmin } from "@/lib/saasAuth"

/**
 * POST /api/saas/tenants/[id]/retry
 *
 * Relance le provisioning d'un tenant en `failed`.
 * - Si le projet Supabase existe : drop le schéma public + reset status='creating'.
 *   Le polling côté frontend déclenchera /sync qui rejouera tout.
 * - Si pas de projet Supabase associé (échec à la création) : impossible de
 *   retry — le SaaS admin doit supprimer le tenant et le recréer.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const { id } = await ctx.params
  const { data: tenant } = await supabaseMaster.from("tenants").select("*").eq("id", id).maybeSingle()
  if (!tenant) return NextResponse.json({ error: "tenant introuvable" }, { status: 404 })

  if (!tenant.supabase_project_ref || tenant.supabase_project_ref === "pending") {
    return NextResponse.json({
      error: "Aucun projet Supabase n'existe pour ce tenant. Supprime-le et recrée-le.",
    }, { status: 400 })
  }

  // 1. Reset le schéma public sur le projet pour repartir propre
  try {
    await supabaseManagement.runSql(
      tenant.supabase_project_ref,
      `DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;`,
    )
  } catch (e) {
    return NextResponse.json({ error: `Reset schéma échoué: ${(e as Error).message}` }, { status: 502 })
  }

  // 2. Log + reset status
  await supabaseMaster.from("provisioning_logs").insert({
    tenant_id: tenant.id,
    step:      "retry_initiated",
    status:    "started",
    message:   `par ${admin.email} — schéma public droppé, polling va re-déclencher /sync`,
  })

  const { data: updated } = await supabaseMaster.from("tenants")
    .update({ provisioning_status: "creating", provisioning_error: null })
    .eq("id", id)
    .select()
    .single()

  return NextResponse.json({ ok: true, tenant: updated })
}
