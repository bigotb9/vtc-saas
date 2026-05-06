import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { createClient } from "@supabase/supabase-js"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { supabaseManagement } from "@/lib/supabaseManagement"
import { requireSaasAdminOrInternal } from "@/lib/saasAuth"
import { sendWelcomeEmail } from "@/lib/email"

/**
 * POST /api/saas/tenants/[id]/sync
 *
 * Polled par le frontend pendant le provisioning. Vérifie l'état du
 * projet Supabase, et quand il devient ACTIVE_HEALTHY, exécute la
 * migration initiale puis passe le tenant à 'ready'.
 */

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

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireSaasAdminOrInternal(req)
  if (admin instanceof NextResponse) return admin

  const { id } = await ctx.params

  const { data: tenant } = await supabaseMaster.from("tenants").select("*").eq("id", id).single()
  if (!tenant) return NextResponse.json({ error: "tenant introuvable" }, { status: 404 })

  // Si déjà ready, rien à faire
  if (tenant.provisioning_status === "ready") {
    return NextResponse.json({ tenant, done: true })
  }
  if (tenant.provisioning_status === "failed") {
    return NextResponse.json({ tenant, done: true, error: tenant.provisioning_error })
  }
  if (tenant.supabase_project_ref === "pending") {
    return NextResponse.json({ tenant, done: false, message: "projet pas encore créé" })
  }

  // 1. Check status du projet
  const project = await supabaseManagement.getProject(tenant.supabase_project_ref).catch(e => {
    return { _err: (e as Error).message }
  })
  if ("_err" in project) {
    return NextResponse.json({ tenant, done: false, message: project._err })
  }
  if (project.status !== "ACTIVE_HEALTHY") {
    return NextResponse.json({ tenant, done: false, message: `status=${project.status}` })
  }

  // ────── Lock optimiste : claim atomique du tenant pour cette exécution ──────
  // Le polling appelle /sync toutes les 6s. Sans verrou, plusieurs invocations
  // concurrentes ré-exécutent la migration et échouent ("relation already exists").
  // On bascule status='creating'→'migrating' UNIQUEMENT si le row matche encore
  // 'creating' (atomique côté Postgres). Si quelqu'un a déjà claim, on early-return.
  const { data: claimed, error: claimErr } = await supabaseMaster
    .from("tenants")
    .update({ provisioning_status: "migrating" })
    .eq("id", id)
    .eq("provisioning_status", "creating")
    .select()
    .maybeSingle()

  if (claimErr) {
    return NextResponse.json({ tenant, done: false, message: claimErr.message })
  }
  if (!claimed) {
    // Quelqu'un d'autre est déjà sur le coup OU on est déjà passé à un état avancé.
    // Re-fetch pour informer l'appelant.
    const { data: latest } = await supabaseMaster.from("tenants").select("*").eq("id", id).single()
    return NextResponse.json({
      tenant: latest || tenant,
      done: latest?.provisioning_status === "ready" || latest?.provisioning_status === "failed",
      message: `claim échoué (status=${latest?.provisioning_status})`,
    })
  }

  // 2. Projet ACTIVE_HEALTHY → on récupère les keys
  const t0 = Date.now()
  await logStep(tenant.id, "fetch_api_keys", "started")
  let keys: { name: string; api_key: string }[]
  try {
    keys = await supabaseManagement.getApiKeys(tenant.supabase_project_ref)
  } catch (e) {
    const msg = (e as Error).message
    await logStep(tenant.id, "fetch_api_keys", "failed", msg, Date.now() - t0)
    return NextResponse.json({ tenant, done: false, message: msg })
  }

  const anon    = keys.find(k => k.name === "anon")?.api_key
  const service = keys.find(k => k.name === "service_role")?.api_key
  if (!anon || !service) {
    const msg = `Keys manquantes (got: ${keys.map(k=>k.name).join(",")})`
    await logStep(tenant.id, "fetch_api_keys", "failed", msg, Date.now() - t0)
    return NextResponse.json({ tenant, done: false, message: msg })
  }
  await logStep(tenant.id, "fetch_api_keys", "success", undefined, Date.now() - t0)

  // 3. Update tenant avec keys + status='migrating'
  await supabaseMaster.from("tenants").update({
    supabase_anon_key:    anon,
    supabase_service_key: service,
    provisioning_status:  "migrating",
  }).eq("id", tenant.id)

  // 4. Exécute la migration initiale
  const migPath = path.join(process.cwd(), "supabase", "migrations", "0001_initial.sql")
  let migSql: string
  try {
    migSql = await fs.readFile(migPath, "utf-8")
  } catch (e) {
    const msg = `Migration file introuvable: ${(e as Error).message}`
    await logStep(tenant.id, "read_migration", "failed", msg)
    await supabaseMaster.from("tenants").update({
      provisioning_status: "failed", provisioning_error: msg,
    }).eq("id", tenant.id)
    return NextResponse.json({ tenant, done: true, error: msg })
  }

  const tMig = Date.now()
  await logStep(tenant.id, "run_migration", "started", `${migSql.length} chars`)
  try {
    await supabaseManagement.runSql(tenant.supabase_project_ref, migSql)
  } catch (e) {
    const msg = (e as Error).message
    await logStep(tenant.id, "run_migration", "failed", msg, Date.now() - tMig)
    await supabaseMaster.from("tenants").update({
      provisioning_status: "failed", provisioning_error: msg,
    }).eq("id", tenant.id)
    return NextResponse.json({ tenant, done: true, error: msg })
  }
  await logStep(tenant.id, "run_migration", "success", undefined, Date.now() - tMig)

  // 4bis. Configurer le site_url pour que les liens d'invitation/recovery
  //       redirigent vers la bonne URL avec le slug du tenant.
  //       Configurer aussi le SMTP custom si RESEND_API_KEY est défini.
  const tCfg = Date.now()
  await logStep(tenant.id, "update_auth_config", "started")
  try {
    const baseUrl = process.env.SITE_BASE_URL || "http://localhost:3000"
    const siteUrl = `${baseUrl}?t=${tenant.slug}`
    const config: Record<string, unknown> = {
      site_url: siteUrl,
      uri_allow_list: `${baseUrl},${baseUrl}/*`,
    }
    if (process.env.RESEND_API_KEY) {
      config.smtp_host        = "smtp.resend.com"
      config.smtp_port        = "465"
      config.smtp_user        = "resend"
      config.smtp_pass        = process.env.RESEND_API_KEY
      config.smtp_admin_email = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
      config.smtp_sender_name = "VTC SaaS"
    }
    await supabaseManagement.updateAuthConfig(tenant.supabase_project_ref, config)
    await logStep(tenant.id, "update_auth_config", "success", `site_url=${siteUrl}, smtp=${process.env.RESEND_API_KEY ? "Resend" : "default"}`, Date.now() - tCfg)
  } catch (e) {
    await logStep(tenant.id, "update_auth_config", "failed", (e as Error).message, Date.now() - tCfg)
    // Non-bloquant — l'admin peut configurer manuellement
  }

  // 5. Création du compte admin du client + invitation
  //    On utilise le service_role du PROJET CLIENT (pas le master) pour invoke
  //    auth.admin.inviteUserByEmail. L'utilisateur recevra un email avec un lien
  //    pour définir son mot de passe et se connecter.
  const tInv = Date.now()
  await logStep(tenant.id, "create_admin_user", "started", `email=${tenant.email_admin}`)
  let adminUserId: string | null = null
  try {
    const tenantClient = createClient(
      `https://${tenant.supabase_project_ref}.supabase.co`,
      service,
      { auth: { persistSession: false } },
    )
    const { data: inv, error: invErr } = await tenantClient.auth.admin.inviteUserByEmail(
      tenant.email_admin,
      {
        data: { invited_as: "tenant_admin", tenant_slug: tenant.slug },
      },
    )
    if (invErr || !inv?.user) {
      // Fallback : créer le user avec un mot de passe temporaire pour ne pas bloquer
      const tempPassword = crypto.randomUUID()
      const { data: created, error: cErr } = await tenantClient.auth.admin.createUser({
        email:           tenant.email_admin,
        password:        tempPassword,
        email_confirm:   true,
        user_metadata:   { invited_as: "tenant_admin", tenant_slug: tenant.slug },
      })
      if (cErr || !created?.user) throw new Error(`Invite + create user échoué: ${invErr?.message || cErr?.message}`)
      adminUserId = created.user.id
      await logStep(tenant.id, "create_admin_user", "success", `fallback createUser (invite a échoué: ${invErr?.message || "raison inconnue"}). Mot de passe temporaire généré, l'admin doit faire 'Mot de passe oublié' à la 1ère connexion.`, Date.now() - tInv)
    } else {
      adminUserId = inv.user.id
      await logStep(tenant.id, "create_admin_user", "success", `invitation envoyée à ${tenant.email_admin}`, Date.now() - tInv)
    }
  } catch (e) {
    const msg = (e as Error).message
    await logStep(tenant.id, "create_admin_user", "failed", msg, Date.now() - tInv)
    // On ne bloque pas tout le provisioning pour ça — le tenant peut ajouter un user manuellement
    // dans l'admin Supabase, et le SaaS admin peut retry plus tard.
  }

  // 6. Insère la ligne profiles avec role=directeur (accès total)
  if (adminUserId) {
    const tProf = Date.now()
    await logStep(tenant.id, "create_admin_profile", "started", `user=${adminUserId}`)
    try {
      await supabaseManagement.runSql(
        tenant.supabase_project_ref,
        `INSERT INTO public.profiles (id, role) VALUES ('${adminUserId}', 'directeur') ON CONFLICT (id) DO UPDATE SET role='directeur'`,
      )
      await logStep(tenant.id, "create_admin_profile", "success", undefined, Date.now() - tProf)
    } catch (e) {
      const msg = (e as Error).message
      await logStep(tenant.id, "create_admin_profile", "failed", msg, Date.now() - tProf)
    }
  }

  // 7. Final → ready
  const { data: finalTenant } = await supabaseMaster.from("tenants")
    .update({ provisioning_status: "ready", provisioning_error: null })
    .eq("id", tenant.id)
    .select()
    .single()

  // 8. Email de bienvenue (best-effort, n'échoue pas le provisioning).
  //    Idempotent par dedup_key 'welcome-<tenant_id>' : si /sync est rappelé
  //    (race condition) on n'envoie pas un 2e mail.
  try {
    const baseUrl = process.env.SITE_BASE_URL || "https://vtcdashboard.com"
    const loginUrl = `${baseUrl}/?t=${tenant.slug}`
    await sendWelcomeEmail({
      tenantId:    tenant.id,
      toEmail:     tenant.email_admin,
      toName:      tenant.nom,
      tenantName:  tenant.nom,
      loginUrl,
    })
  } catch (e) {
    console.error("[welcome_email]", (e as Error).message)
  }

  return NextResponse.json({ tenant: finalTenant, done: true })
}
