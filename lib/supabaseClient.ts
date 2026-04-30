import { createClient } from '@supabase/supabase-js'

/**
 * Client tenant (anon key). En l'état actuel ce client pointe sur le projet
 * configuré dans NEXT_PUBLIC_SUPABASE_URL. Sera remplacé par un client résolu
 * dynamiquement par tenant (factory) une fois le multi-tenant routing en place.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  if (typeof window !== 'undefined') {
    console.warn('[supabaseClient] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY manquant. Les pages tenant ne fonctionneront pas tant que tu n\'as pas configuré un tenant à utiliser pour le dev.')
  }
}

export const supabase = createClient(supabaseUrl || 'http://placeholder.invalid', supabaseKey || 'placeholder')