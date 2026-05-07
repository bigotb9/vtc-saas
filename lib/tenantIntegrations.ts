import "server-only"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { encryptJson, decryptJson } from "@/lib/encrypt"

/**
 * Helpers pour lire / écrire les credentials d'intégration d'un tenant.
 * Stockés chiffrés (AES-256-GCM) dans tenants.integrations_enc.
 */

export type YangoCredentials = {
  park_id:         string     // Partner ID (ID_DU_PARTENAIRE)
  client_id:       string     // X-Client-ID
  // Chaque endpoint Yango a sa propre clé API :
  api_key_drivers: string     // Clé → endpoint liste des prestataires
  api_key_cars:    string     // Clé → endpoint liste des véhicules
  api_key_orders:  string     // Clé → endpoint liste des commandes
  configured_at:   string
}

export type WaveCredentials = {
  mode:          "merchant" | "api"
  merchant_link?: string     // https://pay.wave.com/m/...
  api_key?:      string      // WAVE_API_KEY (si mode=api)
  webhook_secret?: string    // WAVE_WEBHOOK_SECRET (si mode=api)
  configured_at: string
}

export type TenantIntegrations = {
  yango?: YangoCredentials
  wave?:  WaveCredentials
}

/**
 * Charge les intégrations déchiffrées d'un tenant.
 * Renvoie null si aucune intégration configurée.
 */
export async function getTenantIntegrations(tenantId: string): Promise<TenantIntegrations | null> {
  const { data } = await supabaseMaster
    .from("tenants")
    .select("integrations_enc")
    .eq("id", tenantId)
    .maybeSingle()

  if (!data?.integrations_enc) return null
  try {
    return await decryptJson<TenantIntegrations>(data.integrations_enc)
  } catch (e) {
    console.error("[tenantIntegrations] decrypt failed:", (e as Error).message)
    return null
  }
}

/**
 * Sauvegarde les intégrations chiffrées d'un tenant.
 * Merge avec l'existant pour ne pas écraser une intégration non modifiée.
 */
export async function saveTenantIntegrations(
  tenantId: string,
  patch: Partial<TenantIntegrations>,
): Promise<void> {
  const existing = await getTenantIntegrations(tenantId) ?? {}
  const merged: TenantIntegrations = { ...existing, ...patch }
  const enc = await encryptJson(merged)
  await supabaseMaster
    .from("tenants")
    .update({ integrations_enc: enc })
    .eq("id", tenantId)
}

/**
 * Retourne une version "safe" (sans les clés secrètes) pour l'UI.
 * Les api_key et webhook_secret sont masqués.
 */
export function maskIntegrations(integ: TenantIntegrations): Record<string, unknown> {
  return {
    yango: integ.yango ? {
      park_id:         integ.yango.park_id,
      client_id:       integ.yango.client_id,
      api_key_drivers: integ.yango.api_key_drivers ? "••••••" + integ.yango.api_key_drivers.slice(-4) : null,
      api_key_cars:    integ.yango.api_key_cars    ? "••••••" + integ.yango.api_key_cars.slice(-4)    : null,
      api_key_orders:  integ.yango.api_key_orders  ? "••••••" + integ.yango.api_key_orders.slice(-4)  : null,
      configured:      true,
      configured_at:   integ.yango.configured_at,
    } : null,
    wave: integ.wave ? {
      mode:            integ.wave.mode,
      merchant_link:   integ.wave.merchant_link || null,
      api_key:         integ.wave.api_key ? "••••••" + integ.wave.api_key.slice(-4) : null,
      webhook_secret:  integ.wave.webhook_secret ? "••••" : null,
      configured:      true,
      configured_at:   integ.wave.configured_at,
    } : null,
  }
}
