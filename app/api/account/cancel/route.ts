import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { requireAccountAdmin } from "@/lib/accountAuth"

/**
 * POST /api/account/cancel
 *
 * Annule l'abonnement à la fin de la période courante. Le tenant continue
 * à fonctionner jusqu'à current_period_end, puis bascule en 'canceled'.
 *
 * Le cron de lifecycle (Phase 5) fait le passage automatique au moment de
 * l'expiration.
 *
 * POST /api/account/reactivate (séparé) annule l'annulation tant que la
 * période courante n'est pas expirée.
 */

export async function POST(req: NextRequest) {
  const auth = await requireAccountAdmin(req)
  if (!auth.ok) return auth.response

  const { data: tenant } = await supabaseMaster
    .from("tenants")
    .select("current_subscription_id")
    .eq("id", auth.tenant.id)
    .maybeSingle()

  if (!tenant?.current_subscription_id) {
    return NextResponse.json({ error: "Aucun abonnement actif" }, { status: 404 })
  }

  const { error } = await supabaseMaster
    .from("subscriptions")
    .update({
      cancel_at_period_end: true,
      canceled_at:          new Date().toISOString(),
    })
    .eq("id", tenant.current_subscription_id)
    .neq("status", "canceled")
    .neq("status", "archived")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    message: "Abonnement programmé pour annulation à la fin de la période en cours.",
  })
}
