import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Client Supabase TENANT côté navigateur.
 *
 * Le client effectif est résolu dynamiquement par TenantProvider qui
 * appelle `setSupabaseClient(c)` après avoir chargé la config tenant
 * depuis /api/public/tenant. D'ici là, tout accès à `supabase.X` throw.
 *
 * Fallback dev : si NEXT_PUBLIC_SUPABASE_URL est défini en env, on l'utilise
 * comme client par défaut (utile pour tester sans le multi-tenant routing).
 */

let _client: SupabaseClient | null = null

// Fallback : si env var dispo, instancie immédiatement (compat single-tenant)
const fallbackUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
const fallbackAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (fallbackUrl && fallbackAnon) {
  _client = createClient(fallbackUrl, fallbackAnon)
}

/** Appelé par TenantProvider une fois la config tenant chargée. */
export function setSupabaseClient(c: SupabaseClient) {
  _client = c
}

/** Renvoie le client courant ou null si pas encore init. */
export function getSupabaseClient(): SupabaseClient | null {
  return _client
}

/**
 * Proxy qui forwarde tout vers le client courant. Permet aux call sites
 * existants de garder `import { supabase } from '@/lib/supabaseClient'`
 * et `supabase.from('vehicules')` sans changement.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!_client) {
      throw new Error(
        `[supabase] Client tenant non initialisé. ` +
        `Vérifie que TenantProvider est bien monté au-dessus du composant qui appelle "${String(prop)}".`,
      )
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (_client as any)[prop]
    return typeof v === 'function' ? v.bind(_client) : v
  },
})
