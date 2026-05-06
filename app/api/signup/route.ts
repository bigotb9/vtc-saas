import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import {
  ADDONS, getAvailableAddonsForSignup, PLAN_ORDER,
  type AddonId, type BillingCycle, type PlanId,
} from "@/lib/plans"

/**
 * POST /api/signup
 *
 * Endpoint PUBLIC (pas d'auth) qui crée un tenant en mode 'awaiting_payment'.
 * Le projet Supabase n'est PAS provisionné à ce stade — il le sera quand le
 * webhook de paiement (Wave/Stripe) confirmera la transaction.
 *
 * Workflow :
 *   1. Valide les inputs
 *   2. Génère un slug unique depuis le nom entreprise
 *   3. INSERT tenant (status 'awaiting_payment' + signup_data + signup_plan_id)
 *   4. Renvoie { signup_id (= tenant.id) } pour rediriger vers /signup/payment
 */

const COUNTRY_CODES = ["CI", "SN", "ML", "BF", "TG", "BJ", "other"]

type SignupBody = {
  company_name?:     string
  email?:            string
  phone?:            string
  country?:          string
  expected_vehicles?: number | null
  plan_id?:          string
  billing_cycle?:    string
  addons?:           string[]
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50)
}

async function ensureUniqueSlug(base: string): Promise<string> {
  if (!base) base = "tenant"
  let candidate = base
  let suffix = 0
  while (true) {
    const { data } = await supabaseMaster
      .from("tenants")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle()
    if (!data) return candidate
    suffix++
    candidate = `${base}-${suffix}`
    if (suffix > 50) throw new Error("Impossible de générer un slug unique")
  }
}

export async function POST(req: NextRequest) {
  let body: SignupBody
  try {
    body = await req.json() as SignupBody
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  // ───── Validation ─────
  const companyName = (body.company_name || "").trim()
  const email       = (body.email || "").trim().toLowerCase()
  const phone       = (body.phone || "").trim()
  const country     = (body.country || "CI").trim()
  const expectedVehicles = typeof body.expected_vehicles === "number" ? body.expected_vehicles : null
  const planId      = body.plan_id
  const cycle       = body.billing_cycle

  if (!companyName || companyName.length < 2) {
    return NextResponse.json({ error: "Nom d'entreprise requis (2 caractères min)" }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 })
  }
  if (!phone || phone.length < 6) {
    return NextResponse.json({ error: "Téléphone requis" }, { status: 400 })
  }
  if (!COUNTRY_CODES.includes(country)) {
    return NextResponse.json({ error: "Pays non supporté" }, { status: 400 })
  }
  if (!planId || !(PLAN_ORDER as string[]).includes(planId)) {
    return NextResponse.json({ error: "Plan invalide" }, { status: 400 })
  }
  if (cycle !== "monthly" && cycle !== "yearly") {
    return NextResponse.json({ error: "Cycle de facturation invalide" }, { status: 400 })
  }

  // Validation addons : doivent être disponibles pour ce plan (ex: AI Insights
  // n'est pas un addon valide pour Platinum car déjà inclus).
  const requestedAddons = Array.isArray(body.addons) ? body.addons : []
  const validAddons = getAvailableAddonsForSignup(planId as PlanId).map(a => a.id as string)
  const addons: AddonId[] = []
  for (const id of requestedAddons) {
    if (typeof id !== "string") continue
    if (!ADDONS[id as AddonId]) {
      return NextResponse.json({ error: `Addon inconnu: ${id}` }, { status: 400 })
    }
    if (!validAddons.includes(id)) {
      return NextResponse.json({
        error: `L'addon ${id} n'est pas disponible pour le plan ${planId} (déjà inclus ou non compatible)`,
      }, { status: 400 })
    }
    addons.push(id as AddonId)
  }

  // ───── Vérifier qu'il n'existe pas déjà un tenant avec cet email en
  //       awaiting_payment depuis < 24h (anti-spam) ─────
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: existingPending } = await supabaseMaster
    .from("tenants")
    .select("id, slug, provisioning_status, created_at")
    .eq("email_admin", email)
    .eq("provisioning_status", "awaiting_payment")
    .gte("created_at", yesterday)
    .maybeSingle()

  if (existingPending) {
    // Réutilise le tenant existant — mais on met à jour ses choix (plan/cycle/addons)
    // au cas où l'utilisateur ait changé d'avis avant de payer.
    await supabaseMaster
      .from("tenants")
      .update({
        nom:                  companyName,
        signup_plan_id:       planId as PlanId,
        signup_billing_cycle: cycle as BillingCycle,
        signup_data: {
          phone, country, expected_vehicles: expectedVehicles, addons,
        },
      })
      .eq("id", existingPending.id)
    return NextResponse.json({
      signup_id: existingPending.id,
      slug:      existingPending.slug,
      reused:    true,
    })
  }

  // ───── Génère un slug unique ─────
  const baseSlug = slugify(companyName)
  const slug = await ensureUniqueSlug(baseSlug)

  // ───── Insert tenant en awaiting_payment ─────
  const { data: tenant, error } = await supabaseMaster
    .from("tenants")
    .insert({
      slug,
      nom:         companyName,
      email_admin: email,
      provisioning_status:  "awaiting_payment",
      signup_data: {
        phone,
        country,
        expected_vehicles: expectedVehicles,
        addons,
      },
      signup_plan_id:       planId as PlanId,
      signup_billing_cycle: cycle as BillingCycle,
    })
    .select()
    .single()

  if (error || !tenant) {
    return NextResponse.json(
      { error: error?.message || "Création tenant échouée" },
      { status: 500 },
    )
  }

  return NextResponse.json({
    signup_id: tenant.id,
    slug:      tenant.slug,
    reused:    false,
  })
}
