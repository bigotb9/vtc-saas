import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { sendWavePendingEmail } from "@/lib/email"
import { PLANS, ADDONS, getSignupTotalFcfa, type AddonId, type PlanId, type BillingCycle } from "@/lib/plans"

/**
 * POST /api/signup/[id]/wave-claim
 *
 * Public — appelée quand le client a payé sur Wave (lien marchand) et
 * revient sur notre app pour déclarer son paiement avec son n° de
 * transaction.
 *
 * Effets :
 *   1. Stocke le n° de transaction + tél dans tenants.signup_data.wave_claim
 *   2. Envoie un email à l'admin SaaS (ADMIN_NOTIFY_EMAIL) avec lien direct
 *      vers /saas/tenants/[id] pour vérifier et activer
 *
 * L'admin SaaS valide ensuite manuellement via le bouton "Confirmer le
 * paiement" qui trigger /api/signup/[id]/confirm-payment.
 *
 * Idempotent : si la même transaction_ref est resoumise, on update sans
 * spammer l'admin.
 */

type Body = {
  transaction_ref?: string
  payer_phone?:     string | null
  amount_fcfa?:     number
  session_id?:      string
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  let body: Body
  try {
    body = await req.json() as Body
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const transactionRef = (body.transaction_ref || "").trim()
  if (!transactionRef || transactionRef.length < 3) {
    return NextResponse.json({ error: "Numéro de transaction requis (3 caractères min)" }, { status: 400 })
  }

  // Charge le tenant en awaiting_payment
  const { data: tenant } = await supabaseMaster
    .from("tenants")
    .select("id, slug, nom, email_admin, signup_plan_id, signup_billing_cycle, signup_data, provisioning_status")
    .eq("id", id)
    .maybeSingle()

  if (!tenant) {
    return NextResponse.json({ error: "Inscription introuvable" }, { status: 404 })
  }
  if (tenant.provisioning_status !== "awaiting_payment") {
    return NextResponse.json({
      error: `Cette inscription n'attend plus de paiement (statut ${tenant.provisioning_status})`,
    }, { status: 409 })
  }

  // Stocke la déclaration sur le tenant + idempotence
  const existingData = (tenant.signup_data as Record<string, unknown> | null) ?? {}
  const existingClaim = existingData.wave_claim as Record<string, unknown> | undefined
  const isFirstClaim = !existingClaim?.transaction_ref

  const newData = {
    ...existingData,
    wave_claim: {
      transaction_ref: transactionRef,
      payer_phone:     body.payer_phone ?? null,
      session_id:      body.session_id ?? null,
      claimed_at:      new Date().toISOString(),
    },
  }

  await supabaseMaster
    .from("tenants")
    .update({ signup_data: newData })
    .eq("id", id)

  // Calcule le montant attendu
  const planId = tenant.signup_plan_id as PlanId | null
  const cycle  = (tenant.signup_billing_cycle || "monthly") as BillingCycle
  const addons = ((existingData.addons as string[] | undefined) ?? [])
    .filter((id): id is AddonId => !!ADDONS[id as AddonId])
  const expectedAmount = planId
    ? getSignupTotalFcfa(planId, cycle, addons).cycleTotal
    : (body.amount_fcfa ?? 0)

  // Envoi notif admin (uniquement à la 1ʳᵉ déclaration ou si la ref change)
  if (isFirstClaim || existingClaim?.transaction_ref !== transactionRef) {
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || "support@vtcdashboard.com"
    const baseUrl = process.env.SITE_BASE_URL || "https://vtcdashboard.com"
    const reviewUrl = `${baseUrl}/saas/tenants/${tenant.id}`

    try {
      await sendWavePendingEmail({
        toEmail:         adminEmail,
        toName:          "Admin VTC Dashboard",
        tenantId:        tenant.id,
        tenantName:      tenant.nom,
        tenantSlug:      tenant.slug,
        clientEmail:     tenant.email_admin,
        planName:        planId ? PLANS[planId]?.name ?? planId : "—",
        cycle,
        expectedAmount,
        transactionRef,
        payerPhone:      body.payer_phone ?? null,
        reviewUrl,
      })
    } catch (e) {
      console.error("[wave-claim] notif admin failed:", (e as Error).message)
      // On ne bloque pas le client pour autant
    }
  }

  return NextResponse.json({
    ok: true,
    message: "Paiement enregistré, notre équipe vérifie sous 1h en jours ouvrés.",
  })
}
