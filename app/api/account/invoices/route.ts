import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { requireAccountAdmin } from "@/lib/accountAuth"

/**
 * GET /api/account/invoices
 *
 * Liste toutes les factures du tenant courant (paginées par défaut à 50).
 */

export async function GET(req: NextRequest) {
  const auth = await requireAccountAdmin(req)
  if (!auth.ok) return auth.response

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 200)

  const { data, error } = await supabaseMaster
    .from("invoices")
    .select("id, invoice_number, amount_fcfa, currency, status, issued_at, due_at, paid_at, line_items")
    .eq("tenant_id", auth.tenant.id)
    .order("issued_at", { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ invoices: data ?? [] })
}
