import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { supabaseMaster } from "./supabaseMaster"

/**
 * Vérifie qu'une requête API entrante provient d'un saas_admin authentifié
 * sur la base master. Renvoie l'admin row, ou null si non autorisé.
 *
 * Utilisé en haut de chaque route /api/saas/* :
 *   const admin = await requireSaasAdmin(req)
 *   if (admin instanceof NextResponse) return admin   // 401
 */
export async function requireSaasAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (!auth || !auth.startsWith("Bearer ")) {
    return NextResponse.json({ error: "missing_token" }, { status: 401 })
  }
  const jwt = auth.slice(7)

  // Crée un client temporaire avec le JWT du user pour valider la session
  const masterUrl = process.env.MASTER_SUPABASE_URL!
  const masterAnon = process.env.MASTER_SUPABASE_ANON_KEY!
  const userClient = createClient(masterUrl, masterAnon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth:   { persistSession: false },
  })

  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 })
  }

  // Vérifie l'appartenance à saas_admins (avec le service_role pour bypass RLS)
  const { data: admin } = await supabaseMaster
    .from("saas_admins")
    .select("id, email, nom, role")
    .eq("id", user.id)
    .single()

  if (!admin) {
    return NextResponse.json({ error: "not_saas_admin" }, { status: 403 })
  }

  return admin as { id: string; email: string; nom: string | null; role: string }
}


/**
 * Variante qui accepte AUSSI les appels internes du worker de provisioning
 * (cron, after()). Le worker s'authentifie avec un Bearer = INTERNAL_WORKER_TOKEN
 * + header x-internal-worker = "1".
 *
 * Pour les API routes que le worker appelle (ex: /sync), utiliser celle-ci
 * à la place de requireSaasAdmin.
 */
export async function requireSaasAdminOrInternal(req: NextRequest) {
  const internalHeader = req.headers.get("x-internal-worker")
  const auth = req.headers.get("authorization")

  if (internalHeader === "1" && auth?.startsWith("Bearer ")) {
    const expected = process.env.INTERNAL_WORKER_TOKEN
    if (expected && auth.slice(7) === expected) {
      return { id: "internal-worker", email: "worker@internal", nom: "Worker", role: "internal" } as const
    }
    return NextResponse.json({ error: "invalid_internal_token" }, { status: 401 })
  }

  return requireSaasAdmin(req)
}
