import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { requireSaasAdmin } from "@/lib/saasAuth"
import { computeHealthScore } from "@/lib/tenantHealthScore"

/**
 * GET /api/saas/tenants/[id]/health
 *
 * Calcule le score de santé d'un tenant.
 * Charge les données du projet Supabase du tenant + informations master.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const { id } = await ctx.params

  const { data: tenant } = await supabaseMaster
    .from("tenants")
    .select("id, provisioning_status, statut, current_plan_id, current_subscription_id, integrations_enc, supabase_url, supabase_service_key")
    .eq("id", id)
    .maybeSingle()

  if (!tenant || tenant.provisioning_status !== "ready" || !tenant.supabase_service_key) {
    return NextResponse.json({ score: 0, label: "Critique", color: "#f87171", breakdown: {} })
  }

  // Récupère le statut de l'abonnement
  let subStatus: string | null = null
  if (tenant.current_subscription_id) {
    const { data: sub } = await supabaseMaster
      .from("subscriptions")
      .select("status")
      .eq("id", tenant.current_subscription_id)
      .maybeSingle()
    subStatus = sub?.status ?? null
  }

  const tenantClient = createClient(tenant.supabase_url!, tenant.supabase_service_key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const health = await computeHealthScore(tenantClient, {
    provisioning_status: tenant.provisioning_status,
    statut:              tenant.statut,
    current_plan_id:     tenant.current_plan_id,
    integrations_enc:    tenant.integrations_enc,
  }, subStatus)

  return NextResponse.json(health)
}
