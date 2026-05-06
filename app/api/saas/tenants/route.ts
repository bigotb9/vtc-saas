import { NextRequest, NextResponse, after } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { supabaseManagement } from "@/lib/supabaseManagement"
import { requireSaasAdmin } from "@/lib/saasAuth"
import { enqueueProvisioningJob, pickAndProcessOne, makeWorkerId } from "@/lib/provisioning"

/**
 * Génère un mot de passe DB sécurisé (32 chars alphanumériques).
 * Pas de caractères spéciaux pour éviter les soucis d'encodage URL Postgres.
 */
function genDbPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let p = ""
  const arr = new Uint32Array(32)
  crypto.getRandomValues(arr)
  for (let i = 0; i < 32; i++) p += chars[arr[i] % chars.length]
  return p
}

/** Log une étape de provisioning dans master.provisioning_logs (best-effort, n'échoue pas). */
async function logStep(tenantId: string, step: string, status: "started"|"success"|"failed", message?: string, durationMs?: number) {
  try {
    await supabaseMaster.from("provisioning_logs").insert({
      tenant_id: tenantId, step, status,
      message: message ?? null,
      duration_ms: durationMs ?? null,
    })
  } catch (e) {
    console.error("[provisioning_logs]", e)
  }
}

// ────────── GET ──────────
export async function GET(req: NextRequest) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const { data, error } = await supabaseMaster
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tenants: data })
}

// ────────── POST ──────────
export async function POST(req: NextRequest) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const body = await req.json()
  const {
    nom, slug, email_admin, plan = "free", region = "eu-central-1",
    module_yango = false, module_wave = false, module_ai_insights = true,
  } = body || {}

  // Validation
  if (!nom || !slug || !email_admin) {
    return NextResponse.json({ error: "nom, slug, email_admin requis" }, { status: 400 })
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "slug invalide (a-z, 0-9, -)" }, { status: 400 })
  }

  // Slug doit être unique
  const { data: existing } = await supabaseMaster.from("tenants").select("id").eq("slug", slug).maybeSingle()
  if (existing) return NextResponse.json({ error: "slug déjà utilisé" }, { status: 409 })

  // 1. Insert tenant en pending (sans credentials encore)
  const { data: tenant, error: insErr } = await supabaseMaster
    .from("tenants")
    .insert({
      nom, slug, email_admin, plan,
      module_yango, module_wave, module_ai_insights,
      provisioning_status: "creating",
      // placeholders, mis à jour après création du projet
      supabase_project_ref: "pending",
      supabase_url: "pending",
      supabase_anon_key: "pending",
      supabase_service_key: "pending",
    })
    .select()
    .single()

  if (insErr || !tenant) {
    return NextResponse.json({ error: insErr?.message || "insert failed" }, { status: 500 })
  }

  await logStep(tenant.id, "create_tenant_row", "success")

  // 2. Crée le projet Supabase
  const dbPassword = genDbPassword()
  const projectName = `vtc-${slug}`
  const t0 = Date.now()
  await logStep(tenant.id, "create_supabase_project", "started", `name=${projectName}, region=${region}`)

  let project
  try {
    project = await supabaseManagement.createProject({
      name:            projectName,
      organization_id: process.env.SUPABASE_ORG_ID!,
      region,
      plan:            "free",   // on garde toujours free côté Supabase, le plan saas est dans master
      db_pass:         dbPassword,
    })
  } catch (e) {
    const msg = (e as Error).message
    await logStep(tenant.id, "create_supabase_project", "failed", msg, Date.now() - t0)
    await supabaseMaster.from("tenants")
      .update({ provisioning_status: "failed", provisioning_error: msg })
      .eq("id", tenant.id)
    return NextResponse.json({ error: msg, tenant }, { status: 502 })
  }

  await logStep(tenant.id, "create_supabase_project", "success", `ref=${project.id}`, Date.now() - t0)

  // 3. Update tenant avec les infos du projet (les keys viendront via /sync une fois prêt)
  const { data: updated } = await supabaseMaster
    .from("tenants")
    .update({
      supabase_project_ref: project.id,
      supabase_url:         `https://${project.id}.supabase.co`,
      // on garde les keys en "pending" jusqu'à ACTIVE_HEALTHY
    })
    .eq("id", tenant.id)
    .select()
    .single()

  // 4. Enqueue le job de provisioning (récupération keys + migration + admin user).
  //    Le job sera processé en background via after() ci-dessous OU par le cron
  //    /api/cron/process-provisioning si after() échoue.
  const job = await enqueueProvisioningJob(tenant.id, { region })

  // 5. Background processing : after() exécute le job APRÈS la réponse HTTP.
  //    Passe par pickAndProcessOne() pour bénéficier du lock atomique SQL —
  //    évite la race avec le cron qui pourrait pick le même job.
  //    Si l'instance Vercel se termine avant, le cron prendra le relais.
  after(async () => {
    try {
      await pickAndProcessOne(makeWorkerId())
    } catch (e) {
      console.error("[after][pickAndProcessOne]", (e as Error).message)
    }
  })

  return NextResponse.json(
    {
      tenant:     updated || tenant,
      job_id:     job.id,
      message:    "Tenant créé, provisioning lancé en arrière-plan. Polle /api/saas/tenants/[id] pour suivre l'avancement.",
      db_password_hint: "Password DB stocké côté Supabase, non récupérable. Reset via dashboard si besoin.",
    },
    { status: 202 },
  )
}
