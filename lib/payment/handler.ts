import "server-only"
import { after } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { supabaseManagement } from "@/lib/supabaseManagement"
import { enqueueProvisioningJob, pickAndProcessOne, makeWorkerId } from "@/lib/provisioning"
import { PLANS, type PlanId, type BillingCycle } from "@/lib/plans"
import { sendInvoicePaidEmail } from "@/lib/email"
import { activateSignupAddons } from "@/lib/subscriptionAddons"
import { getSignupTotalFcfa, ADDONS, type AddonId } from "@/lib/plans"
import type { PaymentEvent } from "./types"

/**
 * Logique commune appelée par les webhooks Wave/Stripe après vérification
 * de signature et parsing en PaymentEvent normalisé.
 *
 * Idempotent : si on reçoit deux fois le même provider_event_id (retry du
 * provider), on ne crée pas de doublon.
 *
 * Selon metadata.purpose :
 *   - 'signup'  → confirmation paiement initial → crée subscription +
 *                 projet Supabase + enqueue provisioning_job
 *   - 'renewal' → marque la facture comme payée + prolonge la période
 *                 d'abonnement
 *   - 'addon'   → active l'addon souscrit (à venir)
 *   - 'upgrade' → change le plan (à venir)
 */

function genDbPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let p = ""
  const arr = new Uint32Array(32)
  crypto.getRandomValues(arr)
  for (let i = 0; i < 32; i++) p += chars[arr[i] % chars.length]
  return p
}

async function logProvisioningStep(
  tenantId: string,
  step: string,
  status: "started" | "success" | "failed",
  message?: string,
) {
  try {
    await supabaseMaster.from("provisioning_logs").insert({
      tenant_id: tenantId, step, status, message: message ?? null,
    })
  } catch (e) {
    console.error("[provisioning_logs]", e)
  }
}


export async function handlePaymentEvent(event: PaymentEvent): Promise<{ ok: boolean; message: string }> {
  // Idempotence : vérifie qu'on n'a pas déjà traité ce provider_event_id
  const { data: existing } = await supabaseMaster
    .from("payment_attempts")
    .select("id")
    .eq("provider_reference", event.providerEventId)
    .eq("status", "success")
    .maybeSingle()

  if (existing) {
    return { ok: true, message: "Événement déjà traité (idempotence)" }
  }

  if (event.type === "payment.failed") {
    return await handlePaymentFailed(event)
  }
  if (event.type !== "payment.success") {
    return { ok: true, message: `Type ${event.type} ignoré` }
  }

  switch (event.metadata.purpose) {
    case "signup":  return handleSignupPayment(event)
    case "renewal": return handleRenewalPayment(event)
    default:        return { ok: false, message: `Purpose inconnu: ${event.metadata.purpose}` }
  }
}


// ────────── payment.success — signup initial ──────────

async function handleSignupPayment(event: PaymentEvent): Promise<{ ok: boolean; message: string }> {
  const tenantId = event.metadata.tenant_id
  if (!tenantId) return { ok: false, message: "tenant_id manquant dans metadata" }

  const { data: tenant } = await supabaseMaster
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .maybeSingle()
  if (!tenant) return { ok: false, message: `Tenant ${tenantId} introuvable` }

  // Si déjà passé en creating (double webhook), on skip mais on log le payment
  if (tenant.provisioning_status !== "awaiting_payment") {
    await logProvisioningStep(tenantId, "webhook_signup_paid", "success",
      `Reçu ${event.provider} payment.success — déjà en ${tenant.provisioning_status}`)
    return { ok: true, message: `Tenant déjà ${tenant.provisioning_status}` }
  }

  if (!tenant.signup_plan_id) {
    return { ok: false, message: "signup_plan_id manquant" }
  }
  const planId = tenant.signup_plan_id as PlanId
  const cycle = (tenant.signup_billing_cycle || "monthly") as BillingCycle
  const plan = PLANS[planId]
  if (!plan) return { ok: false, message: `Plan ${planId} inconnu` }

  // 1. Crée la subscription
  const now = new Date()
  const periodEnd = new Date(now)
  if (cycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  else                    periodEnd.setMonth(periodEnd.getMonth() + 1)

  // Récupère les addons signup pour calculer le bon montant
  const signupData = (tenant.signup_data as Record<string, unknown> | null) ?? {}
  const signupAddons = ((signupData.addons as string[] | undefined) ?? [])
    .filter((id): id is AddonId => !!ADDONS[id as AddonId])
  const totals = getSignupTotalFcfa(planId, cycle, signupAddons)
  const amount = totals.cycleTotal

  const { data: sub, error: subErr } = await supabaseMaster
    .from("subscriptions")
    .insert({
      tenant_id:             tenant.id,
      plan_id:               planId,
      status:                "active",
      billing_cycle:         cycle,
      amount_fcfa:           amount,
      started_at:            now.toISOString(),
      current_period_start:  now.toISOString(),
      current_period_end:    periodEnd.toISOString(),
      provider:              event.provider,
      provider_subscription_id: event.providerSessionId,
    })
    .select()
    .single()

  if (subErr || !sub) {
    return { ok: false, message: `Création subscription échouée: ${subErr?.message}` }
  }

  // 1bis. Active les addons cochés au signup
  const { activated: activatedAddons } = await activateSignupAddons({
    tenantId:       tenant.id,
    subscriptionId: sub.id,
  })

  // 2. Crée la facture initiale (payée) — détaille les lignes plan + addons
  const lineItems: { label: string; amount_fcfa: number }[] = [
    {
      label:       `Plan ${plan.name} ${cycle === "yearly" ? "annuel" : "mensuel"}`,
      amount_fcfa: cycle === "yearly" ? Math.round(plan.priceMonthlyFcfa * 12 * 0.85) : plan.priceMonthlyFcfa,
    },
    ...activatedAddons.map(id => {
      const a = ADDONS[id]
      const monthly = a.priceMonthlyFcfa ?? 0
      return {
        label:       `${a.name} (${cycle === "yearly" ? "annuel -15%" : "mensuel"})`,
        amount_fcfa: cycle === "yearly" ? Math.round(monthly * 12 * 0.85) : monthly,
      }
    }),
  ]

  const description = activatedAddons.length > 0
    ? `${plan.name} + ${activatedAddons.map(id => ADDONS[id].name).join(" + ")} (${cycle})`
    : `Souscription ${plan.name} ${cycle === "yearly" ? "annuel" : "mensuel"}`

  const { invoice } = await createPaidInvoice({
    subscriptionId:    sub.id,
    tenantId:          tenant.id,
    amountFcfa:        amount,
    description,
    lineItems,
    provider:          event.provider,
    providerInvoiceId: event.providerSessionId,
    paidAt:            event.paidAt || now.toISOString(),
  })

  // 3. Log le payment_attempt avec succès (pour idempotence future)
  await supabaseMaster.from("payment_attempts").insert({
    invoice_id:         invoice.id,
    amount_fcfa:        event.amountFcfa ?? amount,
    provider:           event.provider,
    status:             "success",
    provider_reference: event.providerEventId,
    raw_response:       event.rawPayload,
  })

  // 4. Crée le projet Supabase
  const dbPassword = genDbPassword()
  const region = (tenant.signup_data as Record<string, unknown> | null)?.region as string || "eu-central-1"

  await logProvisioningStep(tenant.id, "create_supabase_project", "started", `name=vtc-${tenant.slug}`)
  let project
  try {
    project = await supabaseManagement.createProject({
      name:            `vtc-${tenant.slug}`,
      organization_id: process.env.SUPABASE_ORG_ID!,
      region,
      plan:            "free",
      db_pass:         dbPassword,
    })
  } catch (e) {
    const msg = (e as Error).message
    await logProvisioningStep(tenant.id, "create_supabase_project", "failed", msg)
    return { ok: false, message: msg }
  }
  await logProvisioningStep(tenant.id, "create_supabase_project", "success", `ref=${project.id}`)

  // 5. Update tenant
  await supabaseMaster
    .from("tenants")
    .update({
      provisioning_status:     "creating",
      supabase_project_ref:    project.id,
      supabase_url:            `https://${project.id}.supabase.co`,
      current_subscription_id: sub.id,
      current_plan_id:         planId,
      signup_completed_at:     now.toISOString(),
    })
    .eq("id", tenant.id)

  // 6. Enqueue provisioning + kick worker en background
  await enqueueProvisioningJob(tenant.id, { region })
  after(async () => {
    try {
      await pickAndProcessOne(makeWorkerId())
    } catch (e) {
      console.error("[after][handleSignupPayment]", (e as Error).message)
    }
  })

  return { ok: true, message: `Signup confirmé pour ${tenant.slug}` }
}


// ────────── payment.success — renouvellement ──────────

async function handleRenewalPayment(event: PaymentEvent): Promise<{ ok: boolean; message: string }> {
  const invoiceId = event.metadata.invoice_id
  if (!invoiceId) return { ok: false, message: "invoice_id manquant pour renewal" }

  const { data: invoice } = await supabaseMaster
    .from("invoices")
    .select("*, subscription:subscriptions(*)")
    .eq("id", invoiceId)
    .maybeSingle()

  if (!invoice) return { ok: false, message: "Facture introuvable" }
  if (invoice.status === "paid") {
    return { ok: true, message: "Facture déjà payée (idempotence)" }
  }

  const now = new Date()

  // Marque la facture payée
  await supabaseMaster
    .from("invoices")
    .update({
      status:              "paid",
      paid_at:             now.toISOString(),
      provider:            event.provider,
      provider_invoice_id: event.providerSessionId,
    })
    .eq("id", invoiceId)

  // Log payment attempt
  await supabaseMaster.from("payment_attempts").insert({
    invoice_id:         invoiceId,
    amount_fcfa:        event.amountFcfa ?? invoice.amount_fcfa,
    provider:           event.provider,
    status:             "success",
    provider_reference: event.providerEventId,
    raw_response:       event.rawPayload,
  })

  // Prolonge la subscription
  const sub = invoice.subscription as { id: string; current_period_end: string; billing_cycle: string; status: string } | null
  if (sub) {
    const newPeriodStart = new Date(sub.current_period_end)
    const newPeriodEnd = new Date(newPeriodStart)
    if (sub.billing_cycle === "yearly") newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1)
    else                                newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)

    await supabaseMaster
      .from("subscriptions")
      .update({
        status:               "active",
        current_period_start: newPeriodStart.toISOString(),
        current_period_end:   newPeriodEnd.toISOString(),
      })
      .eq("id", sub.id)

    // Si le tenant était suspended pour non-paiement, on le réactive
    await supabaseMaster
      .from("tenants")
      .update({ statut: "active" })
      .eq("id", invoice.tenant_id)
      .eq("statut", "suspended")
  }

  // Email de confirmation paiement (idempotent par dedup_key invoice-paid-<id>)
  try {
    const { data: tenant } = await supabaseMaster
      .from("tenants")
      .select("id, nom, email_admin, slug")
      .eq("id", invoice.tenant_id)
      .maybeSingle()
    if (tenant) {
      const baseUrl = process.env.SITE_BASE_URL || "https://vtcdashboard.com"
      await sendInvoicePaidEmail({
        tenantId:      tenant.id,
        toEmail:       tenant.email_admin,
        toName:        tenant.nom,
        invoiceId:     invoice.id,
        tenantName:    tenant.nom,
        invoiceNumber: invoice.invoice_number,
        amountFcfa:    invoice.amount_fcfa,
        loginUrl:      `${baseUrl}/?t=${tenant.slug}`,
        pdfUrl:        `${baseUrl}/api/invoices/${invoice.id}/pdf`,
      })
    }
  } catch (e) {
    console.error("[invoice_paid_email]", (e as Error).message)
  }

  return { ok: true, message: `Facture ${invoice.invoice_number} payée` }
}


// ────────── payment.failed ──────────

async function handlePaymentFailed(event: PaymentEvent): Promise<{ ok: boolean; message: string }> {
  const invoiceId = event.metadata.invoice_id
  if (invoiceId) {
    await supabaseMaster.from("payment_attempts").insert({
      invoice_id:         invoiceId,
      amount_fcfa:        event.amountFcfa ?? 0,
      provider:           event.provider,
      status:             "failed",
      provider_reference: event.providerEventId,
      error_message:      event.errorMessage ?? null,
      raw_response:       event.rawPayload,
    })
  }
  return { ok: true, message: "Échec paiement enregistré" }
}


// ────────── Helpers facture ──────────

let invoiceCounter = 0  // cache simple — sera remplacé par une vraie séquence

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()

  // Stratégie simple : compte les factures de l'année en cours
  const startOfYear = new Date(year, 0, 1).toISOString()
  const { count } = await supabaseMaster
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .gte("issued_at", startOfYear)

  const nextSeq = (count ?? 0) + 1 + invoiceCounter
  invoiceCounter++   // évite les collisions sur appels concurrents
  return `INV-${year}-${String(nextSeq).padStart(5, "0")}`
}

async function createPaidInvoice(opts: {
  subscriptionId:    string
  tenantId:          string
  amountFcfa:        number
  description:       string
  lineItems?:        { label: string; amount_fcfa: number }[]
  provider:          string
  providerInvoiceId?: string
  paidAt:            string
}): Promise<{ invoice: { id: string; invoice_number: string } }> {
  const number = await nextInvoiceNumber()
  const now = new Date().toISOString()
  const lines = opts.lineItems && opts.lineItems.length > 0
    ? opts.lineItems
    : [{ label: opts.description, amount_fcfa: opts.amountFcfa }]
  const { data, error } = await supabaseMaster
    .from("invoices")
    .insert({
      subscription_id:     opts.subscriptionId,
      tenant_id:           opts.tenantId,
      invoice_number:      number,
      amount_fcfa:         opts.amountFcfa,
      currency:            "XOF",
      status:              "paid",
      line_items:          lines,
      issued_at:           now,
      due_at:              now,
      paid_at:             opts.paidAt,
      provider:            opts.provider,
      provider_invoice_id: opts.providerInvoiceId ?? null,
    })
    .select("id, invoice_number")
    .single()

  if (error || !data) throw new Error(`Création facture échouée: ${error?.message}`)
  return { invoice: data }
}
