import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Score de santé d'un tenant (0–100).
 *
 * 5 dimensions × 20 points chacune :
 *   - Activité  : des ressources (véhicules + chauffeurs) ont été créées
 *   - Usage     : des recettes ont été importées ce mois
 *   - Complétude: l'équipe est configurée (> 1 user)
 *   - Paiement  : abonnement actif et non en retard
 *   - Intégrations: au moins une intégration configurée (Wave ou Yango)
 *
 * Renvoie { score, label, color, breakdown } pour affichage.
 */

export type HealthScore = {
  score:      number                   // 0-100
  label:      "Critique" | "Faible" | "Moyen" | "Bon" | "Excellent"
  color:      string                   // hex
  breakdown:  Record<string, number>   // dimension → points obtenus
}

export async function computeHealthScore(
  tenantClient:     SupabaseClient,
  tenantConfig: {
    provisioning_status:  string
    statut:               string
    current_plan_id:      string | null
    integrations_enc:     string | null
  },
  subscriptionStatus: string | null,
): Promise<HealthScore> {
  // Tenant pas encore actif
  if (tenantConfig.provisioning_status !== "ready") {
    return makeScore(0)
  }

  const [
    { count: nbVehicules },
    { count: nbChauffeurs },
    { count: nbUsersProfiles },
    { count: recettesMois },
    { count: nbUsers },
  ] = await Promise.all([
    tenantClient.from("vehicules").select("*", { count:"exact", head:true }),
    tenantClient.from("chauffeurs").select("*", { count:"exact", head:true }).eq("actif", true),
    tenantClient.from("profiles").select("*", { count:"exact", head:true }),
    tenantClient.from("recettes_wave").select("*", { count:"exact", head:true })
      .gte("Horodatage", new Date(Date.now() - 30*24*60*60*1000).toISOString()),
    tenantClient.from("profiles").select("*", { count:"exact", head:true }),
  ])

  const breakdown: Record<string, number> = {}

  // 1. Activité (20 pts)
  if ((nbVehicules ?? 0) > 0 && (nbChauffeurs ?? 0) > 0) breakdown.activite = 20
  else if ((nbVehicules ?? 0) > 0 || (nbChauffeurs ?? 0) > 0) breakdown.activite = 10
  else breakdown.activite = 0

  // 2. Usage recettes (20 pts)
  if ((recettesMois ?? 0) >= 10) breakdown.usage = 20
  else if ((recettesMois ?? 0) > 0) breakdown.usage = 10
  else breakdown.usage = 0

  // 3. Équipe (20 pts)
  if ((nbUsers ?? 0) >= 2) breakdown.equipe = 20
  else if ((nbUsers ?? 0) === 1) breakdown.equipe = 10
  else breakdown.equipe = 0

  // 4. Paiement (20 pts)
  if (subscriptionStatus === "active") breakdown.paiement = 20
  else if (subscriptionStatus === "trialing") breakdown.paiement = 15
  else if (subscriptionStatus === "past_due") breakdown.paiement = 5
  else breakdown.paiement = 0

  // 5. Intégrations (20 pts)
  const hasInteg = !!tenantConfig.integrations_enc
  breakdown.integrations = hasInteg ? 20 : 0

  const score = Math.round(Object.values(breakdown).reduce((s, v) => s + v, 0))
  return makeScore(score, breakdown)
}

function makeScore(score: number, breakdown?: Record<string, number>): HealthScore {
  let label: HealthScore["label"]
  let color: string
  if (score >= 90)      { label = "Excellent"; color = "#22c55e" }
  else if (score >= 70) { label = "Bon";       color = "#4ade80" }
  else if (score >= 50) { label = "Moyen";     color = "#fbbf24" }
  else if (score >= 25) { label = "Faible";    color = "#fb923c" }
  else                  { label = "Critique";  color = "#f87171" }
  return { score, label, color, breakdown: breakdown ?? {} }
}
