import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { requireAccountAdmin } from "@/lib/accountAuth"

/**
 * POST /api/account/reactivate
 *
 * Annule l'annulation programmée tant que la période courante n'est pas
 * encore expirée. La subscription reste active.
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
      cancel_at_period_end: false,
      canceled_at:          null,
    })
    .eq("id", tenant.current_subscription_id)
    .eq("cancel_at_period_end", true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, message: "Annulation annulée. Votre abonnement continue normalement." })
}
