import "server-only"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { ADDONS, getSignupTotalFcfa, PLAN_ORDER, type AddonId, type BillingCycle, type PlanId } from "@/lib/plans"

/**
 * Calcul des métriques business SaaS pour le tableau de bord admin.
 *
 * MRR : somme des amount_fcfa des subscriptions actives, normalisé en mensuel
 *       (annual ÷ 12).
 * ARR : MRR × 12.
 * Customers actifs : count de subs où status IN ('active','trialing','past_due').
 * Churn (mensuel) : subs canceled dans les 30 derniers jours / customers
 *                   actifs il y a 30 jours × 100.
 * Revenus encaissés ce mois : sum invoices.amount_fcfa où paid_at >= début mois.
 */

export type PendingWaveValidation = {
  tenant_id:        string
  slug:             string
  nom:              string
  email_admin:      string
  plan_name:        string
  cycle:            "monthly" | "yearly"
  expected_amount_fcfa: number
  transaction_ref:  string
  payer_phone:      string | null
  claimed_at:       string
}

export type PastDueTenant = {
  tenant_id:            string
  slug:                 string
  nom:                  string
  email_admin:          string
  plan_id:              string
  amount_fcfa:          number
  current_period_end:   string
  days_overdue:         number
}

export type SaasMetrics = {
  // Revenu Mensuel Récurrent — normalisé, base du pilotage
  rmr_fcfa:                  number
  // Revenu Annuel Récurrent projeté = Σ(mensuel×12 + annuel au montant réel)
  rar_fcfa:                  number
  // Revenu Moyen Par Client
  arpu_fcfa:                 number
  // Croissance MoM revenues encaissés
  revenue_growth_pct:        number | null

  active_customers:          number
  customers_by_plan:         Record<PlanId, number>
  customers_in_arrears:      number   // past_due
  customers_suspended:       number
  customers_awaiting_payment: number

  // Taux de churn 30 jours (approximation cohort)
  churn_rate_30d:            number

  revenue_this_month_fcfa:   number
  revenue_last_month_fcfa:   number
  signups_this_month:        number

  // Abonnements en retard de paiement (détail pour la page /paiements)
  past_due_tenants:          PastDueTenant[]

  // Paiements Wave déclarés non encore validés
  pending_wave_validations:  PendingWaveValidation[]
}


export async function computeSaasMetrics(): Promise<SaasMetrics> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Subscriptions actives avec jointure tenant pour les détails past_due
  const { data: activeSubs } = await supabaseMaster
    .from("subscriptions")
    .select("id, tenant_id, plan_id, status, billing_cycle, amount_fcfa, current_period_end")
    .in("status", ["active", "trialing", "past_due"])

  const customers_by_plan: Record<PlanId, number> = {
    silver: 0, gold: 0, platinum: 0, platinum_plus: 0,
  }

  // RMR = Revenu Mensuel Récurrent
  // RAR = Revenu Annuel Récurrent = Σ(mensuel×12) + Σ(annuel au montant réel)
  let rmr_fcfa = 0
  let rar_fcfa = 0
  let customers_in_arrears = 0
  const pastDueTenantIds: string[] = []

  for (const s of activeSubs ?? []) {
    if ((PLAN_ORDER as string[]).includes(s.plan_id)) {
      customers_by_plan[s.plan_id as PlanId]++
    }
    const monthly = s.billing_cycle === "yearly" ? s.amount_fcfa / 12 : s.amount_fcfa
    rmr_fcfa += monthly
    // RAR : pour annuel on prend le montant contracté réel, pour mensuel on annualise
    rar_fcfa += s.billing_cycle === "yearly" ? s.amount_fcfa : s.amount_fcfa * 12
    if (s.status === "past_due") {
      customers_in_arrears++
      if (s.tenant_id) pastDueTenantIds.push(s.tenant_id)
    }
  }

  // Détail des tenants past_due pour la page /paiements
  const past_due_tenants: PastDueTenant[] = []
  if (pastDueTenantIds.length > 0) {
    const { data: pdTenants } = await supabaseMaster
      .from("tenants")
      .select("id, slug, nom, email_admin")
      .in("id", pastDueTenantIds)
    const pdTenantsMap = new Map((pdTenants ?? []).map(t => [t.id, t]))
    for (const s of (activeSubs ?? []).filter(s => s.status === "past_due")) {
      const t = pdTenantsMap.get(s.tenant_id)
      if (!t) continue
      const daysOverdue = Math.floor((now.getTime() - new Date(s.current_period_end).getTime()) / 86400000)
      past_due_tenants.push({
        tenant_id:          t.id,
        slug:               t.slug,
        nom:                t.nom,
        email_admin:        t.email_admin,
        plan_id:            s.plan_id,
        amount_fcfa:        s.amount_fcfa,
        current_period_end: s.current_period_end,
        days_overdue:       Math.max(0, daysOverdue),
      })
    }
    past_due_tenants.sort((a, b) => b.days_overdue - a.days_overdue)
  }

  const active_customers = activeSubs?.length ?? 0

  // Suspended (compté côté tenants car c'est tenants.statut qui drive)
  const { count: customers_suspended } = await supabaseMaster
    .from("tenants")
    .select("*", { count: "exact", head: true })
    .eq("statut", "suspended")

  const { count: customers_awaiting_payment } = await supabaseMaster
    .from("tenants")
    .select("*", { count: "exact", head: true })
    .eq("provisioning_status", "awaiting_payment")

  // Churn 30j : count des subs passées en 'canceled' OU 'archived' dans les
  // 30 derniers jours, divisé par les customers actifs il y a 30 jours.
  const { count: churnedCount } = await supabaseMaster
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .in("status", ["canceled", "archived"])
    .gte("canceled_at", thirtyDaysAgo.toISOString())

  // Approximation du dénominateur : actifs actuels + churned (a peu près
  // le total début de période). Suffisant pour un MVP.
  const churnDenominator = active_customers + (churnedCount ?? 0)
  const churn_rate_30d = churnDenominator > 0
    ? Math.round(((churnedCount ?? 0) / churnDenominator) * 1000) / 10
    : 0

  // Revenus du mois (paid invoices)
  const { data: thisMonthInvoices } = await supabaseMaster
    .from("invoices")
    .select("amount_fcfa")
    .eq("status", "paid")
    .gte("paid_at", startOfMonth.toISOString())

  const revenue_this_month_fcfa = (thisMonthInvoices ?? []).reduce((s, i) => s + i.amount_fcfa, 0)

  const { data: lastMonthInvoices } = await supabaseMaster
    .from("invoices")
    .select("amount_fcfa")
    .eq("status", "paid")
    .gte("paid_at", startOfLastMonth.toISOString())
    .lte("paid_at", endOfLastMonth.toISOString())

  const revenue_last_month_fcfa = (lastMonthInvoices ?? []).reduce((s, i) => s + i.amount_fcfa, 0)

  // Signups du mois (tenants créés)
  const { count: signups_this_month } = await supabaseMaster
    .from("tenants")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfMonth.toISOString())

  // ─── Paiements Wave déclarés mais non validés ───
  // Tenants en awaiting_payment qui ont une wave_claim dans signup_data.
  const { data: pendingTenants } = await supabaseMaster
    .from("tenants")
    .select("id, slug, nom, email_admin, signup_plan_id, signup_billing_cycle, signup_data")
    .eq("provisioning_status", "awaiting_payment")
    .not("signup_data", "is", null)

  const PLAN_NAMES: Record<string, string> = { silver: "Silver", gold: "Gold", platinum: "Platinum" }
  const pending_wave_validations: PendingWaveValidation[] = []
  for (const t of pendingTenants ?? []) {
    const data = (t.signup_data ?? {}) as Record<string, unknown>
    const claim = data.wave_claim as { transaction_ref?: string; payer_phone?: string | null; claimed_at?: string } | undefined
    if (!claim?.transaction_ref || !claim?.claimed_at) continue

    const planId = (t.signup_plan_id || "silver") as PlanId
    const cycle  = (t.signup_billing_cycle || "monthly") as BillingCycle
    const addons = ((data.addons as string[] | undefined) ?? [])
      .filter((id): id is AddonId => !!ADDONS[id as AddonId])
    const totals = getSignupTotalFcfa(planId, cycle, addons)

    pending_wave_validations.push({
      tenant_id:            t.id,
      slug:                 t.slug,
      nom:                  t.nom,
      email_admin:          t.email_admin,
      plan_name:            PLAN_NAMES[planId] || planId,
      cycle,
      expected_amount_fcfa: totals.cycleTotal,
      transaction_ref:      claim.transaction_ref,
      payer_phone:          claim.payer_phone ?? null,
      claimed_at:           claim.claimed_at,
    })
  }
  // Tri : plus ancien claim en premier (à traiter en priorité)
  pending_wave_validations.sort((a, b) => a.claimed_at.localeCompare(b.claimed_at))

  const active_customers_total = activeSubs?.length ?? 0
  const arpu_fcfa = active_customers_total > 0 ? Math.round(rmr_fcfa / active_customers_total) : 0
  const revenue_growth_pct = revenue_last_month_fcfa > 0
    ? Math.round(((revenue_this_month_fcfa - revenue_last_month_fcfa) / revenue_last_month_fcfa) * 1000) / 10
    : null

  return {
    rmr_fcfa:                   Math.round(rmr_fcfa),
    rar_fcfa:                   Math.round(rar_fcfa),
    arpu_fcfa,
    revenue_growth_pct,
    active_customers:           active_customers_total,
    customers_by_plan,
    customers_in_arrears,
    customers_suspended:        customers_suspended ?? 0,
    customers_awaiting_payment: customers_awaiting_payment ?? 0,
    churn_rate_30d,
    revenue_this_month_fcfa,
    revenue_last_month_fcfa,
    signups_this_month:         signups_this_month ?? 0,
    past_due_tenants,
    pending_wave_validations,
  }
}
