import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { requireSaasAdmin } from "@/lib/saasAuth"

/**
 * GET /api/saas/paiements/echecs
 *
 * Renvoie les tentatives de paiement échouées des 60 derniers jours,
 * avec les informations du tenant pour affichage côté admin.
 */
export async function GET(req: NextRequest) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const { data: attempts, error } = await supabaseMaster
    .from("payment_attempts")
    .select("id, invoice_id, attempted_at, amount_fcfa, provider, status, error_message")
    .eq("status", "failed")
    .gte("attempted_at", since)
    .order("attempted_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrichir avec les infos tenant via invoice → subscription → tenant
  const enriched = await Promise.all((attempts ?? []).map(async a => {
    try {
      const { data: inv } = await supabaseMaster
        .from("invoices")
        .select("tenant_id, tenant:tenants(nom)")
        .eq("id", a.invoice_id)
        .maybeSingle()
      const tenant = inv?.tenant as { nom?: string } | null
      return { ...a, tenant_id: inv?.tenant_id ?? null, tenant_nom: tenant?.nom ?? null }
    } catch {
      return { ...a, tenant_id: null, tenant_nom: null }
    }
  }))

  return NextResponse.json({ attempts: enriched })
}
