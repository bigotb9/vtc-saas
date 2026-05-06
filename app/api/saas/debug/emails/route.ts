import { NextRequest, NextResponse } from "next/server"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { requireSaasAdmin } from "@/lib/saasAuth"

/**
 * GET /api/saas/debug/emails
 *
 * Renvoie les 30 derniers emails enregistrés dans email_log.
 * Utile pour diagnostiquer "je n'ai pas reçu mon email" :
 *   - status='sent'    → Resend l'a accepté (vérifier spam/blackhole)
 *   - status='failed'  → erreur Resend (lire error_message)
 *   - status='skipped' → mode stub (RESEND_API_KEY manquante)
 *
 * Auth : saas_admin uniquement.
 */

export async function GET(req: NextRequest) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const { data, error } = await supabaseMaster
    .from("email_log")
    .select("id, tenant_id, to_email, to_name, template, subject, status, provider, provider_message_id, error_message, dedup_key, sent_at, created_at")
    .order("created_at", { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    emails: data ?? [],
    summary: {
      total:   data?.length ?? 0,
      sent:    data?.filter(e => e.status === "sent").length ?? 0,
      failed:  data?.filter(e => e.status === "failed").length ?? 0,
      skipped: data?.filter(e => e.status === "skipped").length ?? 0,
    },
  })
}
