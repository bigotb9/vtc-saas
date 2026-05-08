import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { requireSaasAdmin } from "@/lib/saasAuth"

/** POST → envoie un email de réinitialisation de mot de passe à un admin SaaS */

export async function POST(req: NextRequest) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const { email } = await req.json().catch(() => ({}))
  if (!email) return NextResponse.json({ error: "email requis" }, { status: 400 })

  // Vérifie que l'email correspond bien à un admin SaaS
  const { data: target } = await supabaseMaster
    .from("saas_admins")
    .select("id, email")
    .eq("email", email)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: "Cet email n'est pas un admin SaaS" }, { status: 404 })
  }

  const baseUrl = process.env.SITE_BASE_URL || "https://vtcdashboard.com"

  // Génère le lien de recovery — Supabase l'envoie via SMTP configuré (Resend)
  const { data: link, error } = await supabaseMaster.auth.admin.generateLink({
    type:    "recovery",
    email,
    options: { redirectTo: `${baseUrl}/saas/login` },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const recoveryUrl = link?.properties?.action_link ?? null

  return NextResponse.json({
    ok:           true,
    message:      `Lien de réinitialisation généré pour ${email}.`,
    // Lien retourné pour partage manuel si SMTP non configuré
    recovery_url: recoveryUrl,
  })
}
