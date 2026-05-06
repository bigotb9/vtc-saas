import "server-only"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { sendExpirationReminderEmail, sendSuspensionEmail } from "@/lib/email"
import { createRenewalInvoice } from "@/lib/invoiceService"
import type { PlanId, BillingCycle } from "@/lib/plans"

/**
 * Logique de lifecycle d'abonnement, exécutée chaque jour par le cron
 * /api/cron/lifecycle.
 *
 * Points clés (selon doc de cadrage) :
 *   - J-7 et J-3 avant échéance : email de rappel
 *   - À l'échéance :
 *       · si cancel_at_period_end=true → status='canceled' (tenant reste accessible
 *         en lecture seule jusqu'à archivage J+30)
 *       · sinon → status='past_due' (grace period 7 jours)
 *   - Past_due depuis > 7 jours → tenant.statut='suspended' + email
 *   - Suspended depuis > 30 jours → tenant.statut='archived'
 *
 * Tout est idempotent : un cron qui retourne 2x ne fait pas le travail 2x
 * (les emails sont dédupliqués, les transitions de status sont conditionnelles).
 */


export type LifecycleScanResult = {
  scanned:                number
  remindersSent:          number
  renewalInvoicesCreated: number
  expirationsHandled:     number
  suspensions:            number
  archivals:              number
  errors:                 { tenantId: string; message: string }[]
}


// ────────── Scan principal ──────────

export async function scanSubscriptionLifecycle(): Promise<LifecycleScanResult> {
  const result: LifecycleScanResult = {
    scanned: 0, remindersSent: 0, renewalInvoicesCreated: 0,
    expirationsHandled: 0, suspensions: 0, archivals: 0, errors: [],
  }

  // 1. Charge toutes les subs actives + past_due (non terminales)
  const { data: subs, error } = await supabaseMaster
    .from("subscriptions")
    .select(`
      id, tenant_id, plan_id, status, billing_cycle, amount_fcfa, provider,
      current_period_start, current_period_end, cancel_at_period_end, canceled_at,
      tenant:tenants ( id, slug, nom, email_admin, statut )
    `)
    .in("status", ["active", "trialing", "past_due", "suspended"])

  if (error) {
    console.error("[lifecycle] scan subs failed:", error.message)
    return result
  }

  result.scanned = subs?.length ?? 0

  for (const row of subs ?? []) {
    const tenant = row.tenant as unknown as { id: string; slug: string; nom: string; email_admin: string; statut: string } | null
    if (!tenant) continue

    try {
      await handleOneSubscription(row as SubRow, tenant, result)
    } catch (e) {
      result.errors.push({ tenantId: tenant.id, message: (e as Error).message })
    }
  }

  return result
}


type SubRow = {
  id:                   string
  tenant_id:            string
  plan_id:              string
  status:               "active" | "trialing" | "past_due" | "suspended" | "canceled"
  billing_cycle:        "monthly" | "yearly"
  amount_fcfa:          number
  provider:             "wave" | "stripe" | "manual"
  current_period_start: string
  current_period_end:   string
  cancel_at_period_end: boolean
  canceled_at:          string | null
}


async function handleOneSubscription(
  sub: SubRow,
  tenant: { id: string; slug: string; nom: string; email_admin: string; statut: string },
  result: LifecycleScanResult,
) {
  const now = Date.now()
  const periodEnd = new Date(sub.current_period_end).getTime()
  const daysUntilEnd = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24))

  const baseUrl = process.env.SITE_BASE_URL || "https://vtcdashboard.com"
  let renewUrl = `${baseUrl}/account/billing`

  // ─── À J-7 et J-3 : crée la facture renewal (idempotent) puis email ───
  // L'URL "Renouveler" pointe vers /pay/[invoice_id] qui propose les
  // moyens de paiement. Si la sub est en mode 'stripe' (auto-renew),
  // on n'envoie pas de rappel ni de facture — Stripe gère.
  if (sub.status === "active" && (daysUntilEnd === 7 || daysUntilEnd === 3)) {

    // Pour wave/manual : crée la facture open + lien direct vers /pay
    if (sub.provider === "wave" || sub.provider === "manual") {
      try {
        const invoice = await createRenewalInvoice({
          subscriptionId: sub.id,
          tenantId:       tenant.id,
          planId:         sub.plan_id as PlanId,
          billingCycle:   sub.billing_cycle as BillingCycle,
          periodEnd:      sub.current_period_end,
        })
        if (!invoice.reused) result.renewalInvoicesCreated++
        renewUrl = `${baseUrl}/pay/${invoice.id}`
      } catch (e) {
        result.errors.push({ tenantId: tenant.id, message: `renewal invoice: ${(e as Error).message}` })
      }
    }

    if (sub.provider !== "stripe") {
      await sendExpirationReminderEmail({
        tenantId:        tenant.id,
        toEmail:         tenant.email_admin,
        toName:          tenant.nom,
        subscriptionId:  sub.id,
        tenantName:      tenant.nom,
        daysLeft:        daysUntilEnd,
        expiresAt:       formatDate(sub.current_period_end),
        renewUrl,
      })
      result.remindersSent++
    }
  }

  // ─── Échéance dépassée ───
  if (daysUntilEnd <= 0 && sub.status === "active") {
    if (sub.cancel_at_period_end) {
      // Annulation programmée → on bascule en canceled
      await supabaseMaster
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("id", sub.id)
    } else {
      // Pas de paiement reçu → past_due (grace period)
      await supabaseMaster
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("id", sub.id)
    }
    result.expirationsHandled++
  }

  // ─── Past_due > 7 jours → suspension du tenant ───
  if (sub.status === "past_due" && daysUntilEnd <= -7 && tenant.statut !== "suspended") {
    await supabaseMaster
      .from("subscriptions")
      .update({ status: "suspended" })
      .eq("id", sub.id)

    await supabaseMaster
      .from("tenants")
      .update({ statut: "suspended" })
      .eq("id", tenant.id)

    await sendSuspensionEmail({
      tenantId:      tenant.id,
      toEmail:       tenant.email_admin,
      toName:        tenant.nom,
      tenantName:    tenant.nom,
      expiredAt:     formatDate(sub.current_period_end),
      reactivateUrl: renewUrl,
    })
    result.suspensions++
  }

  // ─── Suspended > 30 jours → archivage ───
  if (sub.status === "suspended" && daysUntilEnd <= -37 && tenant.statut !== "archived") {
    await supabaseMaster
      .from("subscriptions")
      .update({ status: "archived" })
      .eq("id", sub.id)

    await supabaseMaster
      .from("tenants")
      .update({ statut: "archived" })
      .eq("id", tenant.id)

    result.archivals++
  }

  // ─── Cleanup signups jamais payés (awaiting_payment > 7 jours) ───
  // (géré séparément dans cleanupAbandonedSignups ci-dessous)
}


// ────────── Cleanup des signups abandonnés ──────────

/**
 * Archive les tenants en 'awaiting_payment' qui n'ont jamais été payés
 * depuis plus de 7 jours. Libère les slugs.
 */
export async function cleanupAbandonedSignups(): Promise<{ archived: number }> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseMaster
    .from("tenants")
    .update({
      provisioning_status: "failed",
      provisioning_error:  "Signup abandonné (jamais payé)",
      statut:              "archived",
    })
    .eq("provisioning_status", "awaiting_payment")
    .lt("created_at", cutoff)
    .select("id")

  if (error) {
    console.error("[lifecycle] cleanup signups failed:", error.message)
    return { archived: 0 }
  }
  return { archived: data?.length ?? 0 }
}


function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  })
}
