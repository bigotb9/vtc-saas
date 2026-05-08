import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { requireSaasAdmin } from "@/lib/saasAuth"

/** PATCH → change le rôle d'un admin
 *  DELETE → retire un admin SaaS (garde le compte Auth) */

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const { id } = await ctx.params
  const { role } = await req.json().catch(() => ({}))
  if (!["superadmin", "admin", "support"].includes(role)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 })
  }
  // Empêche de downgrader le dernier superadmin
  if (role !== "superadmin") {
    const { count } = await supabaseMaster.from("saas_admins").select("*", { count:"exact", head:true }).eq("role", "superadmin")
    const { data: target } = await supabaseMaster.from("saas_admins").select("role").eq("id", id).maybeSingle()
    if (target?.role === "superadmin" && (count ?? 0) <= 1) {
      return NextResponse.json({ error: "Impossible de retirer le dernier superadmin" }, { status: 400 })
    }
  }

  const { error } = await supabaseMaster.from("saas_admins").update({ role }).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin
  if (admin.role !== "superadmin") {
    return NextResponse.json({ error: "Seul un superadmin peut supprimer des admins" }, { status: 403 })
  }

  const { id } = await ctx.params
  if (id === admin.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas vous supprimer vous-même" }, { status: 400 })
  }

  const { error } = await supabaseMaster.from("saas_admins").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
