import "server-only"
import { supabaseMaster } from "@/lib/supabaseMaster"
import {
  expirationReminderTemplate, invoicePaidTemplate, suspensionTemplate, wavePendingTemplate, welcomeTemplate,
  type ExpirationReminderData, type InvoicePaidData, type SuspensionData, type WavePendingData, type WelcomeData,
} from "./templates"

/**
 * Service d'envoi d'emails transactionnels.
 *
 * Mode actuel : si RESEND_API_KEY est défini → envoie via Resend HTTP API.
 * Sinon → mode stub (log dans email_log avec status='skipped' + console.log).
 *
 * Idempotence : un dedup_key est passé pour chaque envoi. Si une ligne
 * email_log existe déjà avec ce dedup_key + status='sent', on ne ré-envoie
 * pas (utile en cas de retry du caller).
 */

const RESEND_API = "https://api.resend.com/emails"

type SendEmail = {
  to:        string
  toName?:   string
  subject:   string
  html:      string
  text:      string
  template:  string
  tenantId?: string
  dedupKey?: string
}


async function sendViaResend(email: SendEmail): Promise<{ messageId: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error("RESEND_API_KEY manquant")

  const fromEmail = process.env.RESEND_FROM_EMAIL || "VTC Dashboard <onboarding@resend.dev>"

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      from:    fromEmail,
      to:      [email.toName ? `${email.toName} <${email.to}>` : email.to],
      subject: email.subject,
      html:    email.html,
      text:    email.text,
    }),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => "")
    throw new Error(`Resend HTTP ${res.status}: ${txt.slice(0, 300)}`)
  }
  const json = await res.json() as { id: string }
  return { messageId: json.id }
}


async function logEmail(opts: {
  email:           SendEmail
  status:          "sent" | "failed" | "skipped"
  provider:        string
  providerMsgId?:  string
  errorMessage?:   string
}) {
  try {
    await supabaseMaster.from("email_log").upsert({
      tenant_id:           opts.email.tenantId ?? null,
      to_email:            opts.email.to,
      to_name:             opts.email.toName ?? null,
      template:            opts.email.template,
      subject:             opts.email.subject,
      html_body:           opts.email.html,
      text_body:           opts.email.text,
      status:              opts.status,
      provider:            opts.provider,
      provider_message_id: opts.providerMsgId ?? null,
      error_message:       opts.errorMessage ?? null,
      dedup_key:           opts.email.dedupKey ?? null,
      sent_at:             opts.status === "sent" ? new Date().toISOString() : null,
    }, {
      onConflict: "dedup_key",
    })
  } catch (e) {
    console.error("[email_log] insert failed:", (e as Error).message)
  }
}


/**
 * Envoie un email. Idempotent par dedup_key.
 * En mode stub (RESEND_API_KEY manquant) : log seulement, pas d'envoi.
 */
async function sendEmail(email: SendEmail): Promise<{ ok: boolean; provider: string; messageId?: string; error?: string }> {
  // Idempotence : check si déjà envoyé avec succès
  if (email.dedupKey) {
    const { data: existing } = await supabaseMaster
      .from("email_log")
      .select("id, status")
      .eq("dedup_key", email.dedupKey)
      .eq("status", "sent")
      .maybeSingle()
    if (existing) {
      return { ok: true, provider: "cache", messageId: existing.id }
    }
  }

  if (!process.env.RESEND_API_KEY) {
    // Mode stub : log seulement
    console.log(`[email/stub] → ${email.to}  (${email.template})  ${email.subject}`)
    await logEmail({ email, status: "skipped", provider: "stub" })
    return { ok: true, provider: "stub" }
  }

  try {
    const { messageId } = await sendViaResend(email)
    await logEmail({ email, status: "sent", provider: "resend", providerMsgId: messageId })
    return { ok: true, provider: "resend", messageId }
  } catch (e) {
    const msg = (e as Error).message
    await logEmail({ email, status: "failed", provider: "resend", errorMessage: msg })
    return { ok: false, provider: "resend", error: msg }
  }
}


// ────────── Public API ──────────

export async function sendWelcomeEmail(opts: { tenantId: string; toEmail: string; toName?: string } & WelcomeData) {
  const { subject, html, text } = welcomeTemplate(opts)
  return sendEmail({
    to:       opts.toEmail,
    toName:   opts.toName,
    subject, html, text,
    template: "welcome",
    tenantId: opts.tenantId,
    dedupKey: `welcome-${opts.tenantId}`,
  })
}

export async function sendInvoicePaidEmail(opts: { tenantId: string; toEmail: string; toName?: string; invoiceId: string } & InvoicePaidData) {
  const { subject, html, text } = invoicePaidTemplate(opts)
  return sendEmail({
    to:       opts.toEmail,
    toName:   opts.toName,
    subject, html, text,
    template: "invoice_paid",
    tenantId: opts.tenantId,
    dedupKey: `invoice-paid-${opts.invoiceId}`,
  })
}

export async function sendExpirationReminderEmail(opts: { tenantId: string; toEmail: string; toName?: string; subscriptionId: string } & ExpirationReminderData) {
  const { subject, html, text } = expirationReminderTemplate(opts)
  return sendEmail({
    to:       opts.toEmail,
    toName:   opts.toName,
    subject, html, text,
    template: "expiration_reminder",
    tenantId: opts.tenantId,
    dedupKey: `expiration-${opts.subscriptionId}-${opts.daysLeft}`,
  })
}

export async function sendWavePendingEmail(opts: { toEmail: string; toName?: string } & WavePendingData) {
  const { subject, html, text } = wavePendingTemplate(opts)
  return sendEmail({
    to:       opts.toEmail,
    toName:   opts.toName,
    subject, html, text,
    template: "wave_pending",
    tenantId: opts.tenantId,
    // dedup_key permet de re-notifier si le client soumet une nouvelle ref :
    // on inclut transactionRef pour distinguer.
    dedupKey: `wave-pending-${opts.tenantId}-${opts.transactionRef}`,
  })
}

export async function sendSuspensionEmail(opts: { tenantId: string; toEmail: string; toName?: string } & SuspensionData) {
  const { subject, html, text } = suspensionTemplate(opts)
  return sendEmail({
    to:       opts.toEmail,
    toName:   opts.toName,
    subject, html, text,
    template: "suspension",
    tenantId: opts.tenantId,
    dedupKey: `suspension-${opts.tenantId}-${new Date().toISOString().slice(0, 10)}`,
  })
}
