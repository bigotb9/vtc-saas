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
