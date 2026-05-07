import "server-only"
import { getCurrentTenant } from "@/lib/supabaseTenant"
import { getTenantIntegrations } from "@/lib/tenantIntegrations"

/**
 * Retourne les credentials Yango du tenant courant.
 *
 * Les URLs API Yango sont FIXES pour tous les partenaires (env vars globales
 * Vercel : YANGO_DRIVERS_URL, YANGO_CARS_URL, YANGO_ORDERS_URL, YANGO_WORK_RULES_URL).
 * Seuls les 5 credentials ci-dessous sont uniques par partenaire :
 *
 *   - park_id         : Partner ID
 *   - client_id       : X-Client-ID
 *   - api_key_drivers : Clé → /driver-profiles/list ET /work-rules
 *   - api_key_cars    : Clé → /cars/list
 *   - api_key_orders  : Clé → /orders/list
 *
 * Le client les saisit dans Mon Compte → Intégrations → Partenariat Yango.
 * Fallback : env vars globales (tenant principal historique).
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
