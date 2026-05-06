/**
 * /api/ai-insights/latest
 * Lit le dernier résultat d'analyse depuis Supabase (écrit par n8n).
 * Appelé au chargement de la page pour afficher la dernière analyse automatique.
 */
import { NextResponse } from "next/server"
import { getTenantAdmin } from "@/lib/supabaseTenant"
import { ensureFeature } from "@/lib/featureGuard"

export async function GET() {
  const blocked = await ensureFeature("ai_insights")
  if (blocked) return blocked
  try {
    const sb = await getTenantAdmin()
    // Dernière analyse (auto ou manuelle)
    const { data: latest, error } = await sb
      .from("ai_insights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found (table vide, pas une erreur fatale)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    if (!latest) {
      return NextResponse.json({ ok: true, data: null })
    }

    return NextResponse.json({
      ok:         true,
      data:       latest,
      analysis:   latest.analysis,
      retardVehicules: latest.retard_vehicules || [],
      isAfterNoon:     latest.is_after_noon   ?? false,
      totalVehicules:  latest.total_vehicules  ?? 0,
      triggeredBy:     latest.triggered_by,
      generatedAt:     latest.created_at,
    })

  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
