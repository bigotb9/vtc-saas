import { NextRequest, NextResponse } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requirePermission } from "@/lib/requirePermission"
import { getTenantAdmin } from "@/lib/supabaseTenant"
import { enforceCurrentTenantQuota, QuotaExceededError } from "@/lib/plansServer"

export async function POST(req: NextRequest) {
  const supabase = await getTenantAdmin()
  try {
    const auth = await requirePermission(req, "create_vehicle")
    if (!auth.ok) return auth.response

    // Quota véhicules : refuse si le plan est dépassé.
    try {
      await enforceCurrentTenantQuota("vehicules")
    } catch (e) {
      if (e instanceof QuotaExceededError) {
        return NextResponse.json({
          success: false,
          error:   `Quota véhicules atteint : ${e.current}/${e.limit}. Passez à un plan supérieur pour ajouter plus de véhicules.`,
          code:    "QUOTA_EXCEEDED",
          kind:    "vehicules",
          current: e.current,
          limit:   e.limit,
        }, { status: 402 })
      }
      throw e
    }

    const body = await req.json()

    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Corps de requête invalide" }, { status: 400 })
    }

    const { error } = await supabase
      .from("vehicules")
      .insert([body])

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }

    const token = req.headers.get("authorization")?.replace("Bearer ", "") || ""
    await logActivity({ token, action: "create_vehicule", entity: body.immatriculation || null, details: { immatriculation: body.immatriculation, type: body.type_vehicule } })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
