import { NextRequest, NextResponse } from "next/server"
import { requireSaasAdmin } from "@/lib/saasAuth"

/**
 * GET /api/saas/debug/env
 *
 * Endpoint diagnostic admin : liste les env vars critiques et leur statut
 * (présentes / manquantes) avec un preview tronqué pour les valeurs sensibles.
 *
 * Auth : saas_admin uniquement.
 */

const KEYS_TO_CHECK: { key: string; description: string; criticalFor?: string }[] = [
  // ── Master Supabase (provisioning + auth admin) ──
  { key: "MASTER_SUPABASE_URL",                description: "URL projet Supabase master" },
  { key: "MASTER_SUPABASE_ANON_KEY",           description: "Anon key master (login admin)" },
  { key: "MASTER_SUPABASE_SERVICE_ROLE_KEY",   description: "Service role master (writes serveur)" },
  { key: "NEXT_PUBLIC_MASTER_SUPABASE_URL",    description: "URL master côté client" },
  { key: "NEXT_PUBLIC_MASTER_SUPABASE_ANON_KEY", description: "Anon master côté client" },

  // ── Supabase Management API (création projets clients) ──
  { key: "SUPABASE_ACCESS_TOKEN", description: "Token Management API",  criticalFor: "Provisioning" },
  { key: "SUPABASE_ORG_ID",       description: "Org Supabase",          criticalFor: "Provisioning" },

  // ── App URL ──
  { key: "SITE_BASE_URL", description: "URL publique de l'app" },
  { key: "APP_DOMAINS",   description: "Domaines à reconnaître comme app host (csv)" },

  // ── Sécurité ──
  { key: "INTERNAL_WORKER_TOKEN", description: "Auth worker → /sync",   criticalFor: "Provisioning" },
  { key: "CRON_SECRET",           description: "Auth cron Vercel" },

  // ── Email ──
  { key: "RESEND_API_KEY",     description: "Resend (emails transactionnels)", criticalFor: "Emails" },
  { key: "RESEND_FROM_EMAIL",  description: "Expéditeur (optionnel, défaut onboarding@resend.dev)" },

  // ── Paiement ──
  { key: "PAYMENT_MODE",          description: "stub|production",                criticalFor: "Paiement" },
  { key: "PAYMENT_PROVIDERS",     description: "Filtre providers UI (csv)" },
  { key: "WAVE_MODE",             description: "merchant|api",                   criticalFor: "Paiement Wave" },
  { key: "WAVE_MERCHANT_LINK",    description: "Lien marchand Wave",             criticalFor: "Paiement Wave" },
  { key: "WAVE_API_KEY",          description: "Wave API (mode 'api' uniquement)" },
  { key: "WAVE_WEBHOOK_SECRET",   description: "Wave webhook (mode 'api' uniquement)" },
  { key: "STRIPE_SECRET_KEY",     description: "Stripe (si activé)" },
  { key: "STRIPE_WEBHOOK_SECRET", description: "Stripe webhook (si activé)" },

  // ── Admin ──
  { key: "ADMIN_NOTIFY_EMAIL",    description: "Email destinataire des alertes Wave",
    criticalFor: "Paiement Wave" },
]

// Vars dont la valeur peut être affichée en clair (non-secrets)
const SAFE_TO_SHOW = new Set([
  "MASTER_SUPABASE_URL",
  "NEXT_PUBLIC_MASTER_SUPABASE_URL",
  "SITE_BASE_URL",
  "APP_DOMAINS",
  "PAYMENT_MODE",
  "PAYMENT_PROVIDERS",
  "WAVE_MODE",
  "WAVE_MERCHANT_LINK",
  "RESEND_FROM_EMAIL",
  "ADMIN_NOTIFY_EMAIL",
  "SUPABASE_ORG_ID",
])


export async function GET(req: NextRequest) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const vars = KEYS_TO_CHECK.map(({ key, description, criticalFor }) => {
    const value = process.env[key]
    const present = !!value && value.length > 0
    let preview: string | undefined
    if (present) {
      if (SAFE_TO_SHOW.has(key)) {
        preview = value!.length > 80 ? value!.slice(0, 80) + "…" : value!
      } else {
        preview = value!.length > 8
          ? `${value!.slice(0, 4)}…${value!.slice(-4)}`
          : "***"
      }
    }
    return {
      key,
      description,
      criticalFor: criticalFor ?? null,
      present,
      length: present ? value!.length : 0,
      preview: preview ?? null,
    }
  })

  return NextResponse.json({
    runtime: {
      node_env:    process.env.NODE_ENV,
      vercel_env:  process.env.VERCEL_ENV ?? null,
      vercel_url:  process.env.VERCEL_URL ?? null,
      vercel_region: process.env.VERCEL_REGION ?? null,
    },
    summary: {
      total:   vars.length,
      present: vars.filter(v => v.present).length,
      missing: vars.filter(v => !v.present).map(v => v.key),
    },
    vars,
  })
}
