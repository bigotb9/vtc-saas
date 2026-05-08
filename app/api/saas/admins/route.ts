import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { requireSaasAdmin } from "@/lib/saasAuth"

/** GET  → liste les admins SaaS
 *  POST → crée un nouvel admin (invite via Supabase Auth) */

export async function GET(req: NextRequest) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const { data, error } = await supabaseMaster
    .from("saas_admins")
    .select("id, email, nom, role, created_at")
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ admins: data ?? [] })
}

export async function POST(req: NextRequest) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin
  if (admin.role !== "superadmin") {
    return NextResponse.json({ error: "Seul un superadmin peut créer des admins" }, { status: 403 })
  }

  const { email, nom, role } = await req.json().catch(() => ({}))
  if (!email || !role) return NextResponse.json({ error: "email et role requis" }, { status: 400 })
  if (!["superadmin", "admin", "support"].includes(role)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 })
  }

  // Invite le user dans le projet master
  const baseUrl = process.env.SITE_BASE_URL || "https://vtcdashboard.com"
  const { data: inv, error: invErr } = await supabaseMaster.auth.admin.inviteUserByEmail(email, {
    data: { nom },
    redirectTo: `${baseUrl}/saas/login`,
  })

  if (invErr || !inv?.user) {
    // User peut déjà exister — vérifier
    const { data: users } = await supabaseMaster.auth.admin.listUsers({ perPage: 1000 })
    const existing = users?.users?.find(u => u.email === email)
    if (!existing) {
      return NextResponse.json({ error: invErr?.message || "Invitation échouée" }, { status: 500 })
    }
    // Upsert dans saas_admins avec user existant
    const { error: upsErr } = await supabaseMaster
      .from("saas_admins")
      .upsert({ id: existing.id, email, nom: nom || null, role }, { onConflict: "id" })
    if (upsErr) return NextResponse.json({ error: upsErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, message: "Admin mis à jour" })
  }

  // Créer la ligne saas_admins
  const { error: insErr } = await supabaseMaster
    .from("saas_admins")
    .insert({ id: inv.user.id, email, nom: nom || null, role })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, message: `Invitation envoyée à ${email}` })
}
