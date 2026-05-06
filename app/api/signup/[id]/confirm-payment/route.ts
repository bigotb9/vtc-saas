import { NextRequest, NextResponse, after } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { supabaseManagement } from "@/lib/supabaseManagement"
import { requireSaasAdmin } from "@/lib/saasAuth"
import { enqueueProvisioningJob, pickAndProcessOne, makeWorkerId } from "@/lib/provisioning"
import { ADDONS, getSignupTotalFcfa, PLANS, type AddonId, type PlanId, type BillingCycle } from "@/lib/plans"
import { activateSignupAddons } from "@/lib/subscriptionAddons"

/**
 * POST /api/signup/[id]/confirm-payment
 *
 * Confirme le paiement d'un signup et déclenche le provisioning du tenant.
 *
 * Auth (Phase 1) : saas_admin uniquement — sert à activer manuellement
 * un client en attendant Wave/Stripe.
 * Auth (Phase 2) : sera étendu pour accepter les webhooks Wave/Stripe via
 * vérification de signature.
 *
 * Effet :
 *   1. Crée la subscription (status='active', period start/end)
 *   2. Crée les addons souscrits (à venir : aujourd'hui pas d'addon au signup)
 *   3. Crée le projet Supabase (Management API)
 *   4. Update tenant : provisioning_status='creating',
 *      current_subscription_id, current_plan_id, signup_completed_at
 *   5. Enqueue provisioning_job + lance le worker via after()
 */

function genDbPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let p = ""
  const arr = new Uint32Array(32)
  crypto.getRandomValues(arr)
  for (let i = 0; i < 32; i++) p += chars[arr[i] % chars.length]
  return p
}

async function logStep(tenantId: string, step: string, status: "started"|"success"|"failed", message?: string) {
  try {
    await supabaseMaster.from("provisioning_logs").insert({
      tenant_id: tenantId, step, status, message: message ?? null,
    })
  } catch (e) {
    console.error("[provisioning_logs]", e)
  }
}


export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Auth Phase 1 : admin SaaS uniquement.
  // Phase 2 : accepter aussi les webhooks Wave/Stripe (via signature).
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const { id } = await ctx.params

  // 1. Charger le tenant en awaiting_payment
  const { data: tenant, error: fetchErr } = await supabaseMaster
    .from("tenants")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (fetchErr || !tenant) {
    return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 })
  }
  if (tenant.provisioning_status !== "awaiting_payment") {
    return NextResponse.json({
      error: `Le tenant n'est pas en attente de paiement (status=${tenant.provisioning_status})`,
    }, { status: 409 })
  }
  if (!tenant.signup_plan_id) {
    return NextResponse.json({ error: "signup_plan_id manquant sur le tenant" }, { status: 400 })
  }

  const planId = tenant.signup_plan_id as PlanId
  const cycle  = (tenant.signup_billing_cycle || "monthly") as BillingCycle
  const plan = PLANS[planId]
  if (!plan) {
    return NextResponse.json({ error: `Plan inconnu: ${planId}` }, { status: 400 })
  }

  // 2. Calcule la période courante
  const now = new Date()
  const periodEnd = new Date(now)
  if (cycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  else                    periodEnd.setMonth(periodEnd.getMonth() + 1)

  // Récupère les addons signup pour le calcul du montant
  const signupData = (tenant.signup_data as Record<string, unknown> | null) ?? {}
  const signupAddons = ((signupData.addons as string[] | undefined) ?? [])
    .filter((id): id is AddonId => !!ADDONS[id as AddonId])
  const totals = getSignupTotalFcfa(planId, cycle, signupAddons)
  const amount = totals.cycleTotal

  // 3. Crée la subscription
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
      provider:              "manual",   // Phase 2 : 'wave' ou 'stripe'
    })
    .select()
    .single()

  if (subErr || !sub) {
    return NextResponse.json({ error: `Création subscription échouée: ${subErr?.message}` }, { status: 500 })
  }

  await logStep(tenant.id, "create_subscription", "success",
    `plan=${planId} cycle=${cycle}${signupAddons.length ? ` addons=${signupAddons.join(",")}` : ""}`)

  // 3bis. Active les addons cochés au signup
  const { activated: activatedAddons } = await activateSignupAddons({
    tenantId:       tenant.id,
    subscriptionId: sub.id,
  })
  if (activatedAddons.length > 0) {
    await logStep(tenant.id, "activate_addons", "success", activatedAddons.join(","))
  }

  // 4. Crée le projet Supabase
  const dbPassword = genDbPassword()
  const projectName = `vtc-${tenant.slug}`
  const region = (tenant.signup_data as Record<string, unknown>)?.region as string || "eu-central-1"

  await logStep(tenant.id, "create_supabase_project", "started", `name=${projectName}`)

  let project
  try {
    project = await supabaseManagement.createProject({
      name:            projectName,
      organization_id: process.env.SUPABASE_ORG_ID!,
      region,
      plan:            "free",
      db_pass:         dbPassword,
    })
  } catch (e) {
    const msg = (e as Error).message
    await logStep(tenant.id, "create_supabase_project", "failed", msg)
    // Rollback subscription pour permettre un retry
    await supabaseMaster.from("subscriptions").delete().eq("id", sub.id)
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  await logStep(tenant.id, "create_supabase_project", "success", `ref=${project.id}`)

  // 5. Update tenant : passe en creating + lie subscription + complete signup
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

  // 6. Enqueue le job de provisioning + kick worker en background
  const job = await enqueueProvisioningJob(tenant.id, { region })

  after(async () => {
    try {
      await pickAndProcessOne(makeWorkerId())
    } catch (e) {
      console.error("[after][confirm-payment]", (e as Error).message)
    }
  })

  return NextResponse.json({
    ok:          true,
    tenant_id:   tenant.id,
    slug:        tenant.slug,
    job_id:      job.id,
    subscription_id: sub.id,
  })
}
