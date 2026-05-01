import "server-only"
import { supabaseMaster } from "./supabaseMaster"

/**
 * Lookup config tenant côté serveur, avec cache mémoire (TTL 60s).
 * Source : table public.tenants dans la base master.
 */

export type TenantConfig = {
  id:                   string
  slug:                 string
  nom:                  string
  email_admin:          string
  supabase_project_ref: string
  supabase_url:         string
  supabase_anon_key:    string
  supabase_service_key: string
  plan:                 string
  statut:               string
  module_yango:         boolean
  module_wave:          boolean
  module_ai_insights:   boolean
  provisioning_status:  string
  logo_url:             string | null
}

const CACHE = new Map<string, { config: TenantConfig; expiresAt: number }>()
const TTL_MS = 60 * 1000

export async function getTenantBySlug(slug: string): Promise<TenantConfig | null> {
  if (!slug) return null

  const cached = CACHE.get(slug)
  if (cached && cached.expiresAt > Date.now()) return cached.config

  const { data, error } = await supabaseMaster
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .eq("provisioning_status", "ready")
    .maybeSingle()

  if (error || !data) return null

  CACHE.set(slug, { config: data as TenantConfig, expiresAt: Date.now() + TTL_MS })
  return data as TenantConfig
}

/** À appeler après un PATCH/UPDATE d'un tenant pour invalider le cache. */
export function invalidateTenantCache(slug?: string) {
  if (slug) CACHE.delete(slug)
  else CACHE.clear()
}
