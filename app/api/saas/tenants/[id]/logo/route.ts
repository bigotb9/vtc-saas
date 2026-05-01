import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { requireSaasAdmin } from "@/lib/saasAuth"
import { invalidateTenantCache } from "@/lib/tenantConfig"

/**
 * POST /api/saas/tenants/[id]/logo
 * multipart/form-data avec un champ "file"
 *
 * Upload le logo dans le bucket public master.tenant-logos, met à jour
 * tenants.logo_url. Bucket : 5 Mo max, formats image classiques.
 */
const MAX = 5 * 1024 * 1024
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"])

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const { id } = await ctx.params
  const { data: tenant } = await supabaseMaster.from("tenants").select("slug, logo_url").eq("id", id).maybeSingle()
  if (!tenant) return NextResponse.json({ error: "tenant introuvable" }, { status: 404 })

  const fd = await req.formData()
  const file = fd.get("file") as File | null
  if (!file) return NextResponse.json({ error: "fichier manquant" }, { status: 400 })
  if (file.size > MAX) return NextResponse.json({ error: "fichier > 5 Mo" }, { status: 400 })
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: `type ${file.type} non autorisé` }, { status: 400 })

  const ext = file.name.split(".").pop()?.toLowerCase() || "png"
  const path = `${tenant.slug}/${randomUUID()}.${ext}`
  const buf  = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabaseMaster.storage.from("tenant-logos").upload(path, buf, {
    contentType: file.type, upsert: false,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: pub } = supabaseMaster.storage.from("tenant-logos").getPublicUrl(path)
  const url = pub.publicUrl

  const { error: updErr } = await supabaseMaster.from("tenants").update({ logo_url: url }).eq("id", id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  invalidateTenantCache(tenant.slug)
  return NextResponse.json({ ok: true, logo_url: url })
}
