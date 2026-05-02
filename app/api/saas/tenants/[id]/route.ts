import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { supabaseManagement } from "@/lib/supabaseManagement"
import { requireSaasAdmin } from "@/lib/saasAuth"
import { invalidateTenantCache } from "@/lib/tenantConfig"

/**
 * GET /api/saas/tenants/[id]
 *   → Détail d'un tenant + ses provisioning_logs
 *
 * DELETE /api/saas/tenants/[id]?delete_project=true
 *   → Supprime le tenant en master. Si delete_project=true, supprime aussi
 *     le projet Supabase associé (irréversible). À utiliser avec prudence.
 */

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const { id } = await ctx.params

  const [tenantRes, logsRes] = await Promise.all([
    supabaseMaster.from("tenants").select("*").eq("id", id).maybeSingle(),
    supabaseMaster.from("provisioning_logs").select("*").eq("tenant_id", id).order("created_at", { ascending: false }).limit(100),
  ])

  if (tenantRes.error || !tenantRes.data) {
    return NextResponse.json({ error: "tenant introuvable" }, { status: 404 })
  }
  return NextResponse.json({ tenant: tenantRes.data, logs: logsRes.data || [] })
}

/**
 * PATCH /api/saas/tenants/[id]
 *
 * Met à jour les champs configurables d'un tenant (par l'admin SaaS).
 * Champs whitelist autorisés à la modification :
 *   - nom, plan, statut
 *   - module_yango, module_wave, module_ai_insights
 *   - feature_flags, config, custom_domain, notes
 *
 * Tout autre champ (slug, supabase_*, provisioning_*) est ignoré.
 */
const PATCHABLE = new Set([
  "nom", "plan", "statut",
  "module_yango", "module_wave", "module_ai_insights",
  "feature_flags", "config", "custom_domain", "notes",
])

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  // Filtre : on ne garde que les champs autorisés
  const update: Record<string, unknown> = {}
  for (const k of Object.keys(body)) {
    if (PATCHABLE.has(k)) update[k] = body[k]
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "aucun champ valide" }, { status: 400 })
  }

  const { data: existing } = await supabaseMaster.from("tenants").select("slug").eq("id", id).maybeSingle()
  if (!existing) return NextResponse.json({ error: "tenant introuvable" }, { status: 404 })

  const { data, error } = await supabaseMaster.from("tenants").update(update).eq("id", id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Invalide le cache pour que les prochaines requêtes voient la nouvelle config
  invalidateTenantCache(existing.slug)
  return NextResponse.json({ tenant: data })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const { id } = await ctx.params
  const deleteProject = req.nextUrl.searchParams.get("delete_project") === "true"

  const { data: tenant } = await supabaseMaster.from("tenants").select("*").eq("id", id).maybeSingle()
  if (!tenant) return NextResponse.json({ error: "tenant introuvable" }, { status: 404 })

  // 1. Optionnellement supprimer le projet Supabase (irréversible côté Supabase)
  let projectDeleted: { ok: boolean; message?: string } | null = null
  if (deleteProject && tenant.supabase_project_ref && tenant.supabase_project_ref !== "pending") {
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${tenant.supabase_project_ref}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
      })
      if (res.ok || res.status === 404) {
        projectDeleted = { ok: true }
      } else {
        const txt = await res.text().catch(() => "")
        projectDeleted = { ok: false, message: `HTTP ${res.status}: ${txt.slice(0, 200)}` }
      }
    } catch (e) {
      projectDeleted = { ok: false, message: (e as Error).message }
    }
  }

  // 2. Supprimer la ligne master (cascade sur provisioning_logs)
  const { error: delErr } = await supabaseMaster.from("tenants").delete().eq("id", id)
  if (delErr) return NextResponse.json({ error: delErr.message, project_deleted: projectDeleted }, { status: 500 })

  invalidateTenantCache(tenant.slug)
  return NextResponse.json({ ok: true, project_deleted: projectDeleted })
}
