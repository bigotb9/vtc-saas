import "server-only"
import { NextResponse } from "next/server"
import { enforceCurrentTenantFeature, FeatureLockedError } from "@/lib/plansServer"
import type { FeatureKey } from "@/lib/plans"

/**
 * Helper API : vérifie que la feature est active pour le tenant courant.
 * Renvoie une NextResponse 402 si non, sinon renvoie null (continue le handler).
 *
 * Usage :
 *   const blocked = await ensureFeature("yango")
 *   if (blocked) return blocked
 *   // ... reste du handler
 */
export async function ensureFeature(feature: FeatureKey): Promise<NextResponse | null> {
  try {
    await enforceCurrentTenantFeature(feature)
    return null
  } catch (e) {
    if (e instanceof FeatureLockedError) {
      return NextResponse.json({
        success: false,
        error:   `Fonctionnalité "${feature}" non incluse dans le plan actuel. Mettez à niveau votre abonnement.`,
        code:    "FEATURE_LOCKED",
        feature,
      }, { status: 402 })
    }
    throw e
  }
}
