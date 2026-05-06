import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { requireAccountAdmin } from "@/lib/accountAuth"
import { PLANS, PLAN_ORDER, type BillingCycle, type PlanId } from "@/lib/plans"

/**
 * POST /api/account/change-plan
 * Body: { plan_id, billing_cycle }
 *
 * Change le plan de l'abonnement actif. Pour Phase 3, l'effet est immédiat
 * et le nouveau prix s'applique au cycle suivant (pas de proration ici).
 *
 * Cas d'upgrade : différence facturée immédiatement (à brancher en Phase 2
 * production avec proration Stripe).
 * Cas de downgrade : effectif à la fin de la période courante.
 *
 * Pour l'instant : on UPDATE simplement la subscription. La logique de
 * facturation différentielle sera ajoutée quand on aura des comptes de
 * paiement réels.
 */

type Body = { plan_id?: string; billing_cycle?: string }

export async function POST(req: NextRequest) {
  const auth = await requireAccountAdmin(req)
  if (!auth.ok) return auth.response

  let body: Body
  try {
    body = await req.json() as Body
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const newPlanId = body.plan_id
  const newCycle  = body.billing_cycle

  if (!newPlanId || !(PLAN_ORDER as string[]).includes(newPlanId)) {
    return NextResponse.json({ error: "plan_id invalide" }, { status: 400 })
  }
  if (newCycle !== "monthly" && newCycle !== "yearly") {
    return NextResponse.json({ error: "billing_cycle invalide" }, { status: 400 })
  }

  // Charge subscription actuelle
  const { data: tenant } = await supabaseMaster
    .from("tenants")
    .select("current_subscription_id, current_plan_id")
    .eq("id", auth.tenant.id)
    .maybeSingle()

  if (!tenant?.current_subscription_id) {
    return NextResponse.json({ error: "Aucun abonnement actif" }, { status: 404 })
  }

  const { data: currentSub } = await supabaseMaster
    .from("subscriptions")
    .select("*")
    .eq("id", tenant.current_subscription_id)
    .maybeSingle()

  if (!currentSub) {
    return NextResponse.json({ error: "Subscription introuvable" }, { status: 404 })
  }

  if (currentSub.plan_id === newPlanId && currentSub.billing_cycle === newCycle) {
    return NextResponse.json({ error: "Aucun changement détecté" }, { status: 400 })
  }

  const newPlan = PLANS[newPlanId as PlanId]
  const newAmount = newCycle === "yearly" ? newPlan.priceYearlyFcfa : newPlan.priceMonthlyFcfa

  // Update la subscription. La période courante reste inchangée — le
  // nouveau prix s'applique au prochain cycle (renouvellement automatique).
  const { error: updErr } = await supabaseMaster
    .from("subscriptions")
    .update({
      plan_id:       newPlanId,
      billing_cycle: newCycle as BillingCycle,
      amount_fcfa:   newAmount,
    })
    .eq("id", currentSub.id)

  if (updErr) {
    return NextResponse.json({ error: `Update échoué: ${updErr.message}` }, { status: 500 })
  }

  // Sync le cache dénormalisé sur tenants
  await supabaseMaster
    .from("tenants")
    .update({ current_plan_id: newPlanId })
    .eq("id", auth.tenant.id)

  return NextResponse.json({
    ok: true,
    message: `Plan changé à ${newPlan.name} (${newCycle})`,
    new_plan: newPlanId,
    new_cycle: newCycle,
    new_amount_fcfa: newAmount,
    effective: "next_period",
  })
}
