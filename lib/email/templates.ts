/**
 * Templates emails transactionnels.
 * Aucune dépendance externe (juste des template strings) — utilisable côté
 * serveur. Le rendu plus avancé (composants React, MJML, etc.) viendra
 * plus tard si besoin.
 */

import { formatFcfa } from "@/lib/plans"

export type WelcomeData = {
  tenantName:    string
  loginUrl:      string         // ex: https://acme.vtcdashboard.com
  helpUrl?:      string         // ex: https://docs.vtcdashboard.com
}

export type InvoicePaidData = {
  tenantName:    string
  invoiceNumber: string
  amountFcfa:    number
  pdfUrl?:       string
  loginUrl:      string
}

export type ExpirationReminderData = {
  tenantName:    string
  daysLeft:      number
  expiresAt:     string         // date FR
  renewUrl:      string         // URL pour renouveler
}

export type SuspensionData = {
  tenantName:    string
  expiredAt:     string
  reactivateUrl: string         // URL pour payer la facture en retard
}

export type WavePendingData = {
  tenantId:        string
  tenantName:      string
  tenantSlug:      string
  clientEmail:     string
  planName:        string
  cycle:           "monthly" | "yearly"
  expectedAmount:  number       // FCFA
  transactionRef:  string
  payerPhone:      string | null
  reviewUrl:       string       // /saas/tenants/<id>
}


// ────────── Layout HTML commun ──────────

function htmlLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
  <tr><td style="background:linear-gradient(135deg,#4f46e5,#f59e0b);padding:24px 32px;color:#ffffff;">
    <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;">VTC DASHBOARD</div>
    <div style="font-size:13px;opacity:0.85;margin-top:4px;">Plateforme de gestion VTC</div>
  </td></tr>
  <tr><td style="padding:32px;">${content}</td></tr>
  <tr><td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
    VTC Dashboard — Abidjan, Côte d'Ivoire — contact@vtcdashboard.com
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function ctaButton(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;"><tr><td style="border-radius:9999px;background:#4f46e5;">
    <a href="${href}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;border-radius:9999px;">${label}</a>
  </td></tr></table>`
}


// ────────── welcome ──────────

export function welcomeTemplate(data: WelcomeData) {
  const subject = `Bienvenue sur VTC Dashboard, ${data.tenantName} !`
  const text = `Bienvenue ${data.tenantName} !

Votre espace VTC Dashboard est prêt.

Connectez-vous : ${data.loginUrl}

Premiers pas :
1. Ajoutez votre premier véhicule
2. Créez le profil de vos chauffeurs
3. Enregistrez votre première recette

Une question ? contact@vtcdashboard.com
`
  const html = htmlLayout(`
    <h2 style="margin:0 0 8px 0;font-size:22px;color:#111827;">Bienvenue ${data.tenantName} !</h2>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#4b5563;">
      Votre espace VTC Dashboard est prêt. Connectez-vous pour commencer à gérer votre flotte.
    </p>
    ${ctaButton(data.loginUrl, "Accéder à mon espace")}
    <h3 style="margin:24px 0 12px 0;font-size:15px;color:#111827;">Premiers pas (5 minutes)</h3>
    <ol style="margin:0;padding-left:20px;font-size:14px;color:#4b5563;line-height:1.8;">
      <li>Ajoutez votre premier véhicule</li>
      <li>Créez le profil de vos chauffeurs</li>
      <li>Enregistrez votre première recette</li>
    </ol>
    <p style="margin:24px 0 0 0;font-size:13px;color:#6b7280;">
      Besoin d'aide ? Répondez à cet email — nous sommes là pour vous accompagner.
    </p>
  `)
  return { subject, html, text }
}


// ────────── invoice_paid ──────────

export function invoicePaidTemplate(data: InvoicePaidData) {
  const subject = `Paiement reçu — Facture ${data.invoiceNumber}`
  const text = `Bonjour ${data.tenantName},

Nous confirmons la réception de votre paiement de ${formatFcfa(data.amountFcfa)}.

Facture : ${data.invoiceNumber}
${data.pdfUrl ? `PDF : ${data.pdfUrl}` : ""}

Merci pour votre confiance.
`
  const html = htmlLayout(`
    <h2 style="margin:0 0 8px 0;font-size:22px;color:#111827;">Paiement reçu</h2>
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#4b5563;">
      Bonjour <strong>${data.tenantName}</strong>, nous confirmons la réception de votre paiement.
    </p>
    <table cellpadding="12" cellspacing="0" border="0" style="width:100%;background:#f9fafb;border-radius:8px;font-size:14px;color:#374151;margin:12px 0;">
      <tr><td><strong>Facture</strong></td><td style="text-align:right;">${data.invoiceNumber}</td></tr>
      <tr><td><strong>Montant</strong></td><td style="text-align:right;color:#059669;font-weight:600;">${formatFcfa(data.amountFcfa)}</td></tr>
    </table>
    ${data.pdfUrl ? ctaButton(data.pdfUrl, "Télécharger la facture") : ""}
    <p style="margin:16px 0 0 0;font-size:13px;color:#6b7280;">Merci pour votre confiance.</p>
  `)
  return { subject, html, text }
}


// ────────── expiration_reminder ──────────

export function expirationReminderTemplate(data: ExpirationReminderData) {
  const subject = `Votre abonnement expire dans ${data.daysLeft} jour${data.daysLeft > 1 ? "s" : ""}`
  const text = `Bonjour ${data.tenantName},

Votre abonnement VTC Dashboard expire le ${data.expiresAt} (dans ${data.daysLeft} jour${data.daysLeft > 1 ? "s" : ""}).

Renouvelez maintenant pour éviter toute interruption :
${data.renewUrl}
`
  const html = htmlLayout(`
    <h2 style="margin:0 0 8px 0;font-size:22px;color:#111827;">Votre abonnement expire bientôt</h2>
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#4b5563;">
      Bonjour <strong>${data.tenantName}</strong>, votre abonnement VTC Dashboard expire le
      <strong>${data.expiresAt}</strong> (dans ${data.daysLeft} jour${data.daysLeft > 1 ? "s" : ""}).
    </p>
    <p style="margin:0 0 12px 0;font-size:15px;color:#4b5563;">
      Renouvelez maintenant pour conserver l'accès à toutes les fonctionnalités.
    </p>
    ${ctaButton(data.renewUrl, "Renouveler mon abonnement")}
  `)
  return { subject, html, text }
}


// ────────── suspension ──────────

// ────────── wave_pending (admin notif) ──────────

export function wavePendingTemplate(data: WavePendingData) {
  const subject = `🔔 Paiement Wave à vérifier — ${data.tenantName}`
  const text = `Un nouveau client vient de déclarer un paiement Wave.

Client       : ${data.tenantName} (slug: ${data.tenantSlug})
Email        : ${data.clientEmail}
Plan         : ${data.planName} (${data.cycle === "yearly" ? "annuel" : "mensuel"})
Montant attendu : ${formatFcfa(data.expectedAmount)}
N° transaction Wave : ${data.transactionRef}
${data.payerPhone ? `Téléphone payeur : ${data.payerPhone}\n` : ""}
Vérifiez la transaction sur Wave Business, puis activez le compte ici :
${data.reviewUrl}
`
  const html = htmlLayout(`
    <h2 style="margin:0 0 8px 0;font-size:22px;color:#111827;">Paiement Wave à vérifier</h2>
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;color:#4b5563;">
      Un nouveau client vient de déclarer un paiement Wave. Vérifiez la transaction côté
      Wave Business, puis activez le compte depuis le tour de contrôle.
    </p>
    <table cellpadding="10" cellspacing="0" border="0" style="width:100%;background:#f9fafb;border-radius:8px;font-size:13px;color:#374151;margin:12px 0;">
      <tr><td style="width:140px;color:#6b7280;">Client</td><td><strong>${data.tenantName}</strong> (${data.tenantSlug})</td></tr>
      <tr><td style="color:#6b7280;">Email</td><td>${data.clientEmail}</td></tr>
      <tr><td style="color:#6b7280;">Plan</td><td>${data.planName} ${data.cycle === "yearly" ? "(annuel)" : "(mensuel)"}</td></tr>
      <tr><td style="color:#6b7280;">Montant attendu</td><td style="color:#059669;font-weight:600;">${formatFcfa(data.expectedAmount)}</td></tr>
      <tr><td style="color:#6b7280;">N° transaction Wave</td><td><code style="background:#fff;padding:2px 6px;border-radius:4px;border:1px solid #e5e7eb;">${data.transactionRef}</code></td></tr>
      ${data.payerPhone ? `<tr><td style="color:#6b7280;">Tél. payeur</td><td>${data.payerPhone}</td></tr>` : ""}
    </table>
    ${ctaButton(data.reviewUrl, "Vérifier et activer →")}
    <p style="margin:16px 0 0 0;font-size:12px;color:#9ca3af;">
      Le compte client sera créé automatiquement après votre confirmation.
    </p>
  `)
  return { subject, html, text }
}


export function suspensionTemplate(data: SuspensionData) {
  const subject = `Votre abonnement VTC Dashboard est suspendu`
  const text = `Bonjour ${data.tenantName},

Votre abonnement a expiré le ${data.expiredAt} sans être renouvelé. Votre espace est maintenant en mode lecture seule.

Réactivez en payant votre facture :
${data.reactivateUrl}

Toutes vos données sont conservées. Vous avez 30 jours pour réactiver avant archivage.
`
  const html = htmlLayout(`
    <h2 style="margin:0 0 8px 0;font-size:22px;color:#dc2626;">Votre abonnement est suspendu</h2>
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#4b5563;">
      Bonjour <strong>${data.tenantName}</strong>, votre abonnement a expiré le
      <strong>${data.expiredAt}</strong> sans renouvellement. Votre espace est en mode lecture seule.
    </p>
    <p style="margin:0 0 12px 0;font-size:15px;color:#4b5563;">
      Toutes vos données sont conservées. Réactivez votre compte avant 30 jours pour éviter l'archivage.
    </p>
    ${ctaButton(data.reactivateUrl, "Réactiver mon compte")}
  `)
  return { subject, html, text }
}
