import "server-only"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { PLANS, type PlanId, type BillingCycle } from "@/lib/plans"

/**
 * Helpers de gestion des factures :
 *   - getNextInvoiceNumber() : génère 'INV-YYYY-NNNNN' incrémental
 *   - createRenewalInvoice() : crée une facture 'open' pour le prochain
 *     cycle d'une subscription (utilisée par le cron lifecycle à J-7).
 *   - getOpenRenewalInvoice() : retourne la facture renewal déjà créée
 *     pour un cycle donné (idempotence du cron).
 */


export async function getNextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const startOfYear = new Date(year, 0, 1).toISOString()
  const { count } = await supabaseMaster
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .gte("issued_at", startOfYear)
  const seq = (count ?? 0) + 1
  return `INV-${year}-${String(seq).padStart(5, "0")}`
}


/**
 * Renvoie une facture renewal déjà créée pour le cycle suivant la
 * current_period_end de la subscription. Permet au cron de ne pas en créer
 * une seconde si elle existe déjà.
 */
export async function getOpenRenewalInvoice(subscriptionId: string, periodEnd: string): Promise<{ id: string; status: string; amount_fcfa: number } | null> {
  // On considère "facture du cycle suivant" = facture issued_at >= periodEnd - 8j ET status non-paid.
  const cutoff = new Date(new Date(periodEnd).getTime() - 8 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabaseMaster
    .from("invoices")
    .select("id, status, amount_fcfa")
    .eq("subscription_id", subscriptionId)
    .gte("issued_at", cutoff)
    .in("status", ["open", "draft", "uncollectible"])
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}


export type RenewalInvoiceInput = {
  subscriptionId: string
  tenantId:       string
  planId:         PlanId
  billingCycle:   BillingCycle
  periodEnd:      string         // current_period_end de la sub — sert de date d'échéance
}


/**
 * Crée une facture 'open' pour le prochain cycle d'une subscription.
 * Idempotent : si une facture existe déjà pour ce cycle, la retourne
 * sans en créer une seconde.
 */
export async function createRenewalInvoice(input: RenewalInvoiceInput): Promise<{ id: string; invoice_number: string; amount_fcfa: number; reused: boolean }> {
  const existing = await getOpenRenewalInvoice(input.subscriptionId, input.periodEnd)
  if (existing) {
    const { data: full } = await supabaseMaster
      .from("invoices")
      .select("id, invoice_number, amount_fcfa")
      .eq("id", existing.id)
      .single()
    return { ...full!, reused: true }
  }

  const plan = PLANS[input.planId]
  const amount = input.billingCycle === "yearly" ? plan.priceYearlyFcfa : plan.priceMonthlyFcfa
  const cycleLabel = input.billingCycle === "yearly" ? "annuel" : "mensuel"

  const number = await getNextInvoiceNumber()
  const dueAt = input.periodEnd     // due le jour de l'expiration

  const { data, error } = await supabaseMaster
    .from("invoices")
    .insert({
      subscription_id: input.subscriptionId,
      tenant_id:       input.tenantId,
      invoice_number:  number,
      amount_fcfa:     amount,
      currency:        "XOF",
      status:          "open",
      line_items:      [{ label: `Renouvellement ${plan.name} ${cycleLabel}`, amount_fcfa: amount }],
      issued_at:       new Date().toISOString(),
      due_at:          dueAt,
      provider:        "manual",
    })
    .select("id, invoice_number, amount_fcfa")
    .single()

  if (error || !data) throw new Error(`Création facture renewal échouée: ${error?.message}`)
  return { ...data, reused: false }
}
