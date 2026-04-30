import { createClient } from "@supabase/supabase-js"

// Client avec service_role key — bypass RLS — à utiliser UNIQUEMENT côté serveur (API routes)
// Sera remplacé par un factory par tenant quand on aura le routing multi-tenant.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://placeholder.invalid",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
)
