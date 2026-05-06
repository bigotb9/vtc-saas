import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { getProvider, getAvailableProviders, type PaymentProvider } from "@/lib/payment"
import { PLANS, type PlanId, type BillingCycle } from "@/lib/plans"

/**
 * POST /api/payment/create-checkout
 *
 * Endpoint PUBLIC qui crée une session de paiement Wave ou Stripe.
 *
 * Body : { tenant_id, provider, invoice_id? }
 *
 * Cas d'usage :
 *   - signup initial : tenant_id du tenant en awaiting_payment, sans invoice_id
 *     → calcule le montant depuis signup_plan_id + signup_billing_cycle
 *   - renouvellement : tenant_id + invoice_id → utilise le montant de la facture
 *
 * Renvoie { checkout_url } à utiliser pour rediriger l'utilisateur.
 */

type Body = {
  tenant_id?:  string
  provider?:   PaymentProvider
  invoice_id?: string
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json() as Body
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const tenantId = body.tenant_id
  const provider = body.provider
  const invoiceId = body.invoice_id

  if (!tenantId) {
    return NextResponse.json({ error: "tenant_id requis" }, { status: 400 })
  }
  if (!provider || !["wave", "stripe"].includes(provider)) {
    return NextResponse.json({ error: "provider invalide (wave|stripe)" }, { status: 400 })
  }
  if (!getAvailableProviders().includes(provider)) {
    return NextResponse.json({ error: `provider ${provider} non activé` }, { status: 400 })
  }

  // Charge le tenant
  const { data: tenant } = await supabaseMaster
    .from("tenants")
    .select("id, slug, nom, email_admin, signup_plan_id, signup_billing_cycle, signup_data, provisioning_status")
    .eq("id", tenantId)
    .maybeSingle()

  if (!tenant) {
    return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 })
  }

  let amountFcfa: number
  let description: string
  let purpose: "signup" | "renewal" = "signup"

  if (invoiceId) {
    // Mode renouvellement
    const { data: invoice } = await supabaseMaster
      .from("invoices")
      .select("id, amount_fcfa, status, invoice_number, line_items")
      .eq("id", invoiceId)
      .eq("tenant_id", tenantId)
      .maybeSingle()
    if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 })
    if (invoice.status === "paid") return NextResponse.json({ error: "Facture déjà payée" }, { status: 409 })
    amountFcfa = invoice.amount_fcfa
    description = `Facture ${invoice.invoice_number}`
    purpose = "renewal"
  } else {
    // Mode signup initial
    if (tenant.provisioning_status !== "awaiting_payment") {
      return NextResponse.json({
        error: `Le tenant n'est pas en attente de paiement (status=${tenant.provisioning_status})`,
      }, { status: 409 })
    }
    if (!tenant.signup_plan_id) {
      return NextResponse.json({ error: "Plan de signup manquant" }, { status: 400 })
    }
    const plan = PLANS[tenant.signup_plan_id as PlanId]
    if (!plan) return NextResponse.json({ error: "Plan inconnu" }, { status: 400 })
    const cycle = (tenant.signup_billing_cycle || "monthly") as BillingCycle
    amountFcfa = cycle === "yearly" ? plan.priceYearlyFcfa : plan.priceMonthlyFcfa
    description = `${plan.name} ${cycle === "yearly" ? "annuel" : "mensuel"}`
  }

  const baseUrl = process.env.SITE_BASE_URL || new URL(req.url).origin
  const successUrl = `${baseUrl}/signup/payment?id=${tenantId}&payment=success`
  const cancelUrl  = `${baseUrl}/signup/payment?id=${tenantId}&payment=cancel`

  const phone = (tenant.signup_data as Record<string, unknown> | null)?.phone as string | undefined

  const session = await getProvider(provider).createCheckoutSession({
    tenantId,
    invoiceId,
    amountFcfa,
    description,
    customerEmail: tenant.email_admin,
    customerPhone: phone,
    successUrl,
    cancelUrl,
    metadata: {
      tenant_id:  tenantId,
      invoice_id: invoiceId,
      purpose,
    },
  })

  return NextResponse.json({
    checkout_url: session.checkoutUrl,
    session_id:   session.sessionId,
    provider:     session.provider,
    expires_at:   session.expiresAt,
  })
}
