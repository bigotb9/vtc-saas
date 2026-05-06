import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { requireAccountAdmin } from "@/lib/accountAuth"
import { ADDONS, PLANS, type AddonId, type PlanId } from "@/lib/plans"

/**
 * GET /api/account/summary
 *
 * Renvoie le récap de l'abonnement courant pour le portail self-service :
 *   - plan + cycle
 *   - addons actifs
 *   - prochaine échéance / annulation
 *   - dernières factures (3)
 */

export async function GET(req: NextRequest) {
  const auth = await requireAccountAdmin(req)
  if (!auth.ok) return auth.response

  const tenantId = auth.tenant.id

  const { data: tenant } = await supabaseMaster
    .from("tenants")
    .select("nom, email_admin, current_subscription_id, current_plan_id")
    .eq("id", tenantId)
    .maybeSingle()

  if (!tenant) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 })

  let subscription = null
  let activeAddons: AddonId[] = []
  if (tenant.current_subscription_id) {
    const { data: sub } = await supabaseMaster
      .from("subscriptions")
      .select("*")
      .eq("id", tenant.current_subscription_id)
      .maybeSingle()
    subscription = sub

    const { data: addons } = await supabaseMaster
      .from("subscription_addons")
      .select("addon_id")
      .eq("subscription_id", tenant.current_subscription_id)
      .is("deactivated_at", null)
    activeAddons = (addons ?? []).map(a => a.addon_id as AddonId)
  }

  const { data: invoices } = await supabaseMaster
    .from("invoices")
    .select("id, invoice_number, amount_fcfa, status, issued_at, paid_at")
    .eq("tenant_id", tenantId)
    .order("issued_at", { ascending: false })
    .limit(3)

  return NextResponse.json({
    tenant: {
      nom:         tenant.nom,
      email_admin: tenant.email_admin,
    },
    subscription,
    plan:         tenant.current_plan_id ? PLANS[tenant.current_plan_id as PlanId] : null,
    active_addons: activeAddons.map(id => ADDONS[id]),
    recent_invoices: invoices ?? [],
  })
}
