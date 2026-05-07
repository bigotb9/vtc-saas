import "server-only"
import { getCurrentTenant } from "@/lib/supabaseTenant"
import { getTenantIntegrations } from "@/lib/tenantIntegrations"

/**
 * Retourne les credentials Yango à utiliser pour le tenant courant.
 *
 * Priorité :
 *   1. Credentials stockés dans tenant.integrations.yango (par tenant)
 *   2. Variables d'env globales (mode démo / tenant principal historique)
 *
 * Si aucun credential disponible → throw Error.
 */
export type YangoConfig = {
  park_id:   string    // ID_DU_PARTENAIRE
  client_id: string    // X-Client-ID
  api_key:   string    // X-API-Key
}

export async function getYangoConfig(): Promise<YangoConfig> {
  const tenant = await getCurrentTenant()
  if (tenant) {
    const integ = await getTenantIntegrations(tenant.id)
    if (integ?.yango?.park_id && integ.yango.client_id && integ.yango.api_key) {
      return {
        park_id:   integ.yango.park_id,
        client_id: integ.yango.client_id,
        api_key:   integ.yango.api_key,
      }
    }
  }

  // Fallback env vars globales (compatibilité ascendante)
  const park_id   = process.env.ID_DU_PARTENAIRE
  const client_id = process.env.CLID
  const api_key   = process.env.YANGO_ORDERS_API_KEY || process.env.YANGO_DRIVERS_API_KEY || process.env.YANGO_CARS_API_KEY

  if (!park_id || !client_id || !api_key) {
    throw new Error(
      "Credentials Yango non configurés. " +
      "Allez dans Mon Compte → Intégrations → Yango pour les saisir, " +
      "ou contactez votre administrateur."
    )
  }
  return { park_id, client_id, api_key }
}
