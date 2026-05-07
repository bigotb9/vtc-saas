import { NextResponse } from "next/server"
import { getTenantAdmin } from "@/lib/supabaseTenant"
import { ensureFeature } from "@/lib/featureGuard"
import { computeAiInsights } from "@/lib/aiInsightsCompute"

/**
 * GET /api/ai-insights
 *
 * Calcule à la volée les KPIs AI Insights du tenant courant à partir de
 * ses données (chauffeurs, véhicules, recettes Wave, dépenses, entretiens).
 *
 * 100% algorithmique : aucune dépendance externe (Claude, n8n, etc.).
 * Performance : OK jusqu'à ~500 véhicules / 50k recettes en cache 6 mois.
 *
 * Cached 60s côté Next pour ne pas recalculer à chaque navigation.
 */

export const revalidate = 60

export async function GET() {
  const blocked = await ensureFeature("ai_insights")
  if (blocked) return blocked

  try {
    const sb = await getTenantAdmin()
    const report = await computeAiInsights(sb)
    return NextResponse.json(report)
  } catch (e) {
    return NextResponse.json(
      { error: `Calcul AI Insights échoué : ${(e as Error).message}` },
      { status: 500 },
    )
  }
}
