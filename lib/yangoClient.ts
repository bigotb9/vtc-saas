import "server-only"
import { getCurrentTenant } from "@/lib/supabaseTenant"
import { getTenantIntegrations } from "@/lib/tenantIntegrations"

/**
 * Retourne les credentials Yango du tenant courant.
 *
 * Chaque endpoint Yango a sa propre clé API :
 *   - api_key_drivers : Récupération liste des prestataires
 *   - api_key_cars    : Récupération liste des véhicules
 *   - api_key_orders  : Récupération liste des commandes/courses
 *
 * Priorité :
 *   1. Credentials dans tenant.integrations.yango (configurés par le client)
 *   2. Variables d'env globales (fallback / tenant historique Boyah)
 */
export type YangoConfig = {
  park_id:         string
  client_id:       string
  api_key_drivers: string
  api_key_cars:    string
  api_key_orders:  string
}

export async function getYangoConfig(): Promise<YangoConfig> {
  const tenant = await getCurrentTenant()
  if (tenant) {
    const integ = await getTenantIntegrations(tenant.id)
    const y = integ?.yango
    if (y?.park_id && y.client_id && y.api_key_drivers && y.api_key_cars && y.api_key_orders) {
      return {
        park_id:         y.park_id,
        client_id:       y.client_id,
        api_key_drivers: y.api_key_drivers,
        api_key_cars:    y.api_key_cars,
        api_key_orders:  y.api_key_orders,
      }
    }
  }

  // Fallback env vars globales (rétrocompatibilité tenant principal)
  const park_id         = process.env.ID_DU_PARTENAIRE
  const client_id       = process.env.CLID
  const api_key_drivers = process.env.YANGO_DRIVERS_API_KEY
  const api_key_cars    = process.env.YANGO_CARS_API_KEY
  const api_key_orders  = process.env.YANGO_ORDERS_API_KEY

  if (!park_id || !client_id || !api_key_drivers || !api_key_cars || !api_key_orders) {
    throw new Error(
      "Credentials Yango non configurés. " +
      "Allez dans Mon Compte → Intégrations → Yango pour saisir vos identifiants, " +
      "ou contactez votre administrateur."
    )
  }
  return { park_id, client_id, api_key_drivers, api_key_cars, api_key_orders }
}
