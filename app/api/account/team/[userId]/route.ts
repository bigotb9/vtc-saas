import { NextRequest, NextResponse } from "next/server"
import { requireAccountAdmin } from "@/lib/accountAuth"
import { getTenantAdmin } from "@/lib/supabaseTenant"

/**
 * PATCH /api/account/team/[userId]  → change le rôle
 * DELETE /api/account/team/[userId] → supprime le user (auth + profile cascade)
 *
 * Sécurité : impossible de supprimer le dernier directeur (sinon plus
 * personne ne peut administrer le tenant).
 */

const ALLOWED_ROLES = ["directeur", "dispatcher", "comptable", "lecture"] as const
type Role = (typeof ALLOWED_ROLES)[number]


export async function PATCH(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await requireAccountAdmin(req)
  if (!auth.ok) return auth.response

  const { userId } = await ctx.params

  let body: { role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const role = body.role as Role
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 })
  }

  const supabase = await getTenantAdmin()

  // Sécurité : si on retire le rôle directeur du dernier directeur, refuser.
  if (role !== "directeur") {
    const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle()
    if (target?.role === "directeur") {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "directeur")
      if ((count ?? 0) <= 1) {
        return NextResponse.json({
          error: "Impossible de retirer le rôle directeur — c'est le dernier administrateur du tenant.",
        }, { status: 400 })
      }
    }
  }

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, role })
}


export async function DELETE(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await requireAccountAdmin(req)
  if (!auth.ok) return auth.response

  const { userId } = await ctx.params

  // Pas d'auto-suppression
  if (userId === auth.user.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte." }, { status: 400 })
  }

  const supabase = await getTenantAdmin()

  // Vérif : pas le dernier directeur
  const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle()
  if (target?.role === "directeur") {
    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "directeur")
    if ((count ?? 0) <= 1) {
      return NextResponse.json({
        error: "Impossible de supprimer le dernier administrateur.",
      }, { status: 400 })
    }
  }

  // Supprime via auth.admin.deleteUser → cascade FK supprime profiles row
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
