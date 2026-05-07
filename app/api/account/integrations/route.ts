import { NextRequest, NextResponse } from "next/server"
import { requireAccountAdmin } from "@/lib/accountAuth"
import { getTenantIntegrations, maskIntegrations, saveTenantIntegrations } from "@/lib/tenantIntegrations"

/**
 * GET  /api/account/integrations  → Renvoie les intégrations (clés masquées)
 * POST /api/account/integrations  → Sauvegarde Yango ou Wave credentials
 *
 * Body POST :
 *   {
 *     type: "yango" | "wave",
 *     // Yango :
 *     park_id?, client_id?, api_key?,
 *     // Wave :
 *     mode?, merchant_link?, api_key?, webhook_secret?
 *   }
 */

export async function GET(req: NextRequest) {
  const auth = await requireAccountAdmin(req)
  if (!auth.ok) return auth.response

  const integ = await getTenantIntegrations(auth.tenant.id)
  if (!integ) return NextResponse.json({ integrations: { yango: null, wave: null } })

  return NextResponse.json({ integrations: maskIntegrations(integ) })
}

export async function POST(req: NextRequest) {
  const auth = await requireAccountAdmin(req)
  if (!auth.ok) return auth.response

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const { type, ...rest } = body

  if (type === "yango") {
    const { park_id, client_id, api_key } = rest
    if (!park_id || !client_id || !api_key) {
      return NextResponse.json({ error: "park_id, client_id et api_key requis" }, { status: 400 })
    }
    await saveTenantIntegrations(auth.tenant.id, {
      yango: { park_id, client_id, api_key, configured_at: new Date().toISOString() },
    })
    return NextResponse.json({ ok: true, message: "Intégration Yango sauvegardée" })
  }

  if (type === "wave") {
    const { mode, merchant_link, api_key, webhook_secret } = rest
    if (!mode || !["merchant", "api"].includes(mode)) {
      return NextResponse.json({ error: "mode requis (merchant|api)" }, { status: 400 })
    }
    if (mode === "merchant" && !merchant_link) {
      return NextResponse.json({ error: "merchant_link requis en mode merchant" }, { status: 400 })
    }
    if (mode === "api" && !api_key) {
      return NextResponse.json({ error: "api_key requis en mode api" }, { status: 400 })
    }
    await saveTenantIntegrations(auth.tenant.id, {
      wave: { mode: mode as "merchant" | "api", merchant_link, api_key, webhook_secret, configured_at: new Date().toISOString() },
    })
    return NextResponse.json({ ok: true, message: "Intégration Wave sauvegardée" })
  }

  return NextResponse.json({ error: "type invalide (yango|wave)" }, { status: 400 })
}
