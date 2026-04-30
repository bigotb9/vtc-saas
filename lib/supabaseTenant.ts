import "server-only"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { headers } from "next/headers"
import { getTenantBySlug, type TenantConfig } from "./tenantConfig"

/**
 * Fabrique un client Supabase service_role pour le tenant courant.
 *
 * Le slug est lu depuis le header `x-tenant-slug` posé par le middleware.
 * Cache en mémoire des clients par slug pour éviter de recréer un client
 * à chaque requête.
 */

const CLIENT_CACHE = new Map<string, SupabaseClient>()

export async function getCurrentTenantSlug(): Promise<string | null> {
  const h = await headers()
  return h.get("x-tenant-slug") || null
}

export async function getCurrentTenant(): Promise<TenantConfig | null> {
  const slug = await getCurrentTenantSlug()
  if (!slug) return null
  return getTenantBySlug(slug)
}

/**
 * Renvoie un client Supabase admin (service_role) pour le tenant de la requête courante.
 * Throw si pas de tenant résolu — l'API doit l'attraper et renvoyer 400.
 */
export async function getTenantAdmin(): Promise<SupabaseClient> {
  const tenant = await getCurrentTenant()
  if (!tenant) throw new Error("Aucun tenant résolu pour cette requête (header x-tenant-slug manquant)")

  const cached = CLIENT_CACHE.get(tenant.slug)
  if (cached) return cached

  const client = createClient(tenant.supabase_url, tenant.supabase_service_key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  CLIENT_CACHE.set(tenant.slug, client)
  return client
}

/** Idem mais explicite par slug — utile pour des jobs qui ne sont pas dans une requête HTTP */
export async function getTenantAdminBySlug(slug: string): Promise<SupabaseClient | null> {
  const tenant = await getTenantBySlug(slug)
  if (!tenant) return null
  const cached = CLIENT_CACHE.get(slug)
  if (cached) return cached
  const client = createClient(tenant.supabase_url, tenant.supabase_service_key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  CLIENT_CACHE.set(slug, client)
  return client
}
