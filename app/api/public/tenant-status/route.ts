import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"

/**
 * GET /api/public/tenant-status?id=<tenant_id>
 *
 * Endpoint PUBLIC consultable par le visiteur qui vient de payer pour
 * suivre l'avancement du provisioning de son tenant. Renvoie uniquement
 * les champs strictement nécessaires (pas les credentials Supabase).
 */

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 })

  const { data: tenant } = await supabaseMaster
    .from("tenants")
    .select("id, slug, provisioning_status, provisioning_error")
    .eq("id", id)
    .maybeSingle()

  if (!tenant) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 })

  return NextResponse.json({
    id:                  tenant.id,
    slug:                tenant.slug,
    provisioning_status: tenant.provisioning_status,
    provisioning_error:  tenant.provisioning_error,
  })
}
