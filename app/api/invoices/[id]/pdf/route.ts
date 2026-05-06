import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { requireSaasAdmin } from "@/lib/saasAuth"
import { generateInvoicePdf } from "@/lib/invoicePdf"

/**
 * GET /api/invoices/[id]/pdf
 *
 * Renvoie le PDF d'une facture. Auth admin SaaS uniquement pour l'instant.
 * Phase 3 : permettra aussi à l'utilisateur du tenant concerné de télécharger
 * sa propre facture.
 */

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const { id } = await ctx.params

  const { data: invoice } = await supabaseMaster
    .from("invoices")
    .select(`
      id, invoice_number, amount_fcfa, currency, status, line_items,
      issued_at, due_at, paid_at,
      tenant:tenants ( nom, email_admin, signup_data )
    `)
    .eq("id", id)
    .maybeSingle()

  if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })

  const tenant = (invoice.tenant as unknown as { nom: string; email_admin: string; signup_data: Record<string, unknown> | null }) || null
  if (!tenant) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 })

  const lines = (invoice.line_items as { label: string; amount_fcfa: number }[]) || []

  const pdf = generateInvoicePdf({
    invoiceNumber: invoice.invoice_number,
    issuedAt:      invoice.issued_at,
    dueAt:         invoice.due_at,
    paidAt:        invoice.paid_at,
    status:        invoice.status as "paid",
    seller: {
      name:    "VTC Dashboard",
      email:   "contact@vtcdashboard.com",
      address: "Abidjan, Côte d'Ivoire",
    },
    customer: {
      name:    tenant.nom,
      email:   tenant.email_admin,
      phone:   (tenant.signup_data?.phone as string) || undefined,
      country: (tenant.signup_data?.country as string) || undefined,
    },
    lines:     lines.length > 0 ? lines : [{ label: "Abonnement", amount_fcfa: invoice.amount_fcfa }],
    totalFcfa: invoice.amount_fcfa,
    currency:  invoice.currency,
  })

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoice_number}.pdf"`,
      "Cache-Control":       "private, max-age=300",
    },
  })
}
