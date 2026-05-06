import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { requireSaasAdmin } from "@/lib/saasAuth"

/**
 * GET /api/saas/tenants/export
 *
 * Export CSV de la liste de tous les tenants (sans les credentials).
 * Renvoie un fichier CSV téléchargeable.
 */

export async function GET(req: NextRequest) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const { data: tenants } = await supabaseMaster
    .from("tenants")
    .select(`
      id, slug, nom, email_admin, statut, provisioning_status,
      current_plan_id, signup_billing_cycle, created_at, signup_completed_at
    `)
    .order("created_at", { ascending: false })

  const headers = [
    "id", "slug", "nom", "email_admin", "statut", "provisioning_status",
    "plan", "cycle", "created_at", "signup_completed_at",
  ]

  const rows = (tenants ?? []).map(t => [
    t.id, t.slug, t.nom, t.email_admin, t.statut, t.provisioning_status,
    t.current_plan_id ?? "", t.signup_billing_cycle ?? "",
    t.created_at, t.signup_completed_at ?? "",
  ])

  const csv = [headers.join(","), ...rows.map(r => r.map(escapeCsv).join(","))].join("\n")

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tenants-${date}.csv"`,
    },
  })
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ""
  const s = String(value)
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
