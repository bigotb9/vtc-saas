import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getTenantAdmin, getCurrentTenant } from "./supabaseTenant"
import type { TenantConfig } from "./tenantConfig"

/**
 * Auth pour les API routes du portail self-service /api/account/*.
 *
 * Vérifie :
 *   1. Le tenant courant est résolu (header x-tenant-slug du proxy)
 *   2. Le Bearer token correspond à un utilisateur du tenant
 *   3. Cet utilisateur est admin (role = 'directeur') OU autorisé pour
 *      les actions billing
 *
 * Renvoie { user, profile, tenant } si OK, sinon NextResponse 401/403.
 */

type AccountAuthOk = {
  ok:      true
  user:    { id: string; email?: string }
  profile: { id: string; role: string }
  tenant:  TenantConfig
}
type AccountAuthFail = { ok: false; response: NextResponse }

export async function requireAccountAdmin(req: NextRequest): Promise<AccountAuthOk | AccountAuthFail> {
  const tenant = await getCurrentTenant()
  if (!tenant) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Aucun tenant résolu" }, { status: 400 }),
    }
  }

  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentification requise" }, { status: 401 }),
    }
  }

  const supabaseAdmin = await getTenantAdmin()
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Session invalide" }, { status: 401 }),
    }
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Profil introuvable" }, { status: 403 }),
    }
  }

  // Seul le directeur peut gérer la facturation côté tenant. Les autres
  // rôles peuvent voir les factures mais pas changer de plan / annuler.
  if (profile.role !== "directeur") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Accès réservé à l'administrateur" }, { status: 403 }),
    }
  }

  return { ok: true, user, profile, tenant }
}
