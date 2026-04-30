import { createClient } from "@supabase/supabase-js"

/**
 * Client pour la base MASTER (tour de contrôle).
 * Stocke le registre des tenants et leurs credentials Supabase.
 *
 * À utiliser UNIQUEMENT côté serveur (API routes, server components).
 * Les routes /admin/* utilisent ce client.
 *
 * NE JAMAIS exposer ce client côté navigateur ni à un tenant — il a
 * accès aux service_role keys de TOUS les clients.
 */

const url = process.env.MASTER_SUPABASE_URL
const serviceKey = process.env.MASTER_SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  // Throw une seule fois au boot du serveur — évite les erreurs silencieuses
  // si on oublie de configurer les env vars sur Vercel.
  console.warn("[supabaseMaster] MASTER_SUPABASE_URL ou MASTER_SUPABASE_SERVICE_ROLE_KEY manquant — la tour de contrôle ne fonctionnera pas")
}

export const supabaseMaster = createClient(
  url || "",
  serviceKey || "",
  { auth: { persistSession: false, autoRefreshToken: false } }
)
