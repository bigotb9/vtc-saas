import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import type {
  CheckoutSession,
  CheckoutSessionRequest,
  PaymentEvent,
  PaymentProviderImpl,
} from "./types"

/**
 * Provider Wave CI.
 *
 * Deux modes de production possibles selon WAVE_MODE :
 *
 * 1. 'merchant' (par défaut) — pour Wave Business sans API/webhook
 *    Le marchand a juste un lien de paiement statique
 *    (ex: https://pay.wave.com/m/<merchant_id>/c/ci/). On y appose le
 *    montant en query string. Le client paie, revient sur notre app et
 *    déclare son paiement via l'UI "J'ai payé" en saisissant son n°
 *    de transaction. L'admin SaaS valide depuis le backoffice.
 *
 * 2. 'api' — pour Wave Business avec accès API/webhook complet
 *    createCheckoutSession appelle POST checkout/sessions, webhook signé
 *    automatique. (Code conservé pour le jour où Wave activera l'API.)
 *
 * Variables env :
 *   - WAVE_MODE             : 'merchant' ou 'api' (défaut 'merchant')
 *   - WAVE_MERCHANT_LINK    : URL du lien marchand (mode merchant)
 *   - WAVE_API_KEY          : clé Bearer (mode api)
 *   - WAVE_WEBHOOK_SECRET   : secret signature webhook (mode api)
 *
 * Mode 'stub' : renvoie une URL de simulation /dev/wave-checkout (tests).
 */

const PAYMENT_MODE  = process.env.PAYMENT_MODE || "stub"
const WAVE_MODE     = process.env.WAVE_MODE     || "merchant"
const WAVE_API_BASE = process.env.WAVE_API_BASE || "https://api.wave.com/v1"


type WaveCheckoutResponse = {
  id:                string
  amount:            string
  currency:          string
  business_name?:    string
  client_reference?: string
  payment_status:    "processing" | "cancelled" | "succeeded"
  wave_launch_url:   string
  when_completed?:   string | null
  when_created:      string
  when_expires:      string
}


export const waveProvider: PaymentProviderImpl = {
  id: "wave",

  async createCheckoutSession(req: CheckoutSessionRequest): Promise<CheckoutSession> {
    if (PAYMENT_MODE === "stub") {
      const sessionId = `wave_stub_${crypto.randomUUID()}`
      const baseUrl = process.env.SITE_BASE_URL || "http://localhost:3000"
      const checkoutUrl = `${baseUrl}/dev/wave-checkout?session=${encodeURIComponent(sessionId)}` +
        `&amount=${req.amountFcfa}` +
        `&tenant_id=${encodeURIComponent(req.metadata.tenant_id)}` +
        (req.metadata.invoice_id ? `&invoice_id=${encodeURIComponent(req.metadata.invoice_id)}` : "") +
        `&purpose=${encodeURIComponent(req.metadata.purpose)}` +
        `&success=${encodeURIComponent(req.successUrl)}` +
        `&cancel=${encodeURIComponent(req.cancelUrl)}`
      return {
        provider:    "wave",
        sessionId,
        checkoutUrl,
        expiresAt:   new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }
    }

    // ─── PRODUCTION mode 'merchant' (lien Wave statique avec ?amount=) ───
    if (WAVE_MODE === "merchant") {
      const merchantLink = process.env.WAVE_MERCHANT_LINK
      if (!merchantLink) throw new Error("WAVE_MERCHANT_LINK manquant")

      // sessionId interne — Wave n'en attribue pas en mode lien statique.
      const sessionId = `wave_merchant_${crypto.randomUUID()}`

      // Lien Wave + ?amount=. La devise est XOF (FCFA), pas besoin de
      // currency en query — Wave la déduit du compte marchand.
      const sep = merchantLink.includes("?") ? "&" : "?"
      const checkoutUrl = `${merchantLink}${sep}amount=${req.amountFcfa}`

      return {
        provider:    "wave",
        sessionId,
        checkoutUrl,
        manualClaim: true,    // pas de webhook → le client doit déclarer
        expiresAt:   new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }
    }

    // ─── PRODUCTION mode 'api' (Wave Business avec API/webhook) ───
    const apiKey = process.env.WAVE_API_KEY
    if (!apiKey) throw new Error("WAVE_API_KEY manquant (mode 'api')")

    const ref = `${req.metadata.purpose}:${req.metadata.tenant_id}:${req.metadata.invoice_id ?? ""}`

    const res = await fetch(`${WAVE_API_BASE}/checkout/sessions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
        "Idempotency-Key": req.metadata.invoice_id || `${req.metadata.tenant_id}:${Date.now()}`,
      },
      body: JSON.stringify({
        amount:           String(req.amountFcfa),
        currency:         "XOF",
        error_url:        req.cancelUrl,
        success_url:      req.successUrl,
        client_reference: ref,
      }),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => "")
      throw new Error(`Wave API ${res.status}: ${txt.slice(0, 300)}`)
    }

    const data = await res.json() as WaveCheckoutResponse

    return {
      provider:    "wave",
      sessionId:   data.id,
      checkoutUrl: data.wave_launch_url,
      expiresAt:   data.when_expires,
    }
  },


  async verifyAndParseWebhook(req): Promise<PaymentEvent | null> {
    if (PAYMENT_MODE === "stub") {
      const data = JSON.parse(req.rawBody) as {
        event_type:   "payment.success" | "payment.failed"
        session_id:   string
        amount:       number
        metadata: { tenant_id: string; invoice_id?: string; purpose: string }
      }
      return {
        provider:          "wave",
        type:              data.event_type,
        providerEventId:   `wave_stub_evt_${data.session_id}`,
        providerSessionId: data.session_id,
        amountFcfa:        data.amount,
        paidAt:            new Date().toISOString(),
        metadata:          data.metadata,
        rawPayload:        data,
      }
    }

    // PRODUCTION : vérification signature HMAC + parsing event Wave.
    const secret = process.env.WAVE_WEBHOOK_SECRET
    if (!secret) throw new Error("WAVE_WEBHOOK_SECRET manquant")
    if (!req.signature) throw new Error("Header X-Wave-Signature manquant")

    if (!verifyWaveSignature(req.rawBody, req.signature, secret)) {
      throw new Error("Signature Wave invalide")
    }

    // Format event Wave (à confirmer avec doc Business) :
    //   {
    //     "type": "checkout.session.completed" | "checkout.session.payment_failed",
    //     "id": "EV-xxx",
    //     "data": {
    //       "id": "cos-xxx",
    //       "amount": "50000",
    //       "currency": "XOF",
    //       "client_reference": "signup:tenant_uuid:invoice_uuid",
    //       "payment_status": "succeeded" | "cancelled" | "processing",
    //       "when_completed": "2026-01-15T..."
    //     }
    //   }
    const evt = JSON.parse(req.rawBody) as {
      type: string
      id?: string
      data: {
        id:               string
        amount:           string
        currency?:        string
        client_reference?: string
        payment_status:   string
        when_completed?:  string | null
      }
    }

    const ref = evt.data.client_reference ?? ""
    const [purpose, tenantId, invoiceId] = ref.split(":")
    const metadata = {
      tenant_id:  tenantId || undefined as unknown as string,
      invoice_id: invoiceId || undefined,
      purpose:    purpose || "signup",
    }

    if (evt.type === "checkout.session.completed" || evt.data.payment_status === "succeeded") {
      return {
        provider:          "wave",
        type:              "payment.success",
        providerEventId:   evt.id ?? `wave_evt_${evt.data.id}`,
        providerSessionId: evt.data.id,
        amountFcfa:        Number(evt.data.amount),
        paidAt:            evt.data.when_completed ?? new Date().toISOString(),
        metadata,
        rawPayload:        evt,
      }
    }
    if (evt.type === "checkout.session.payment_failed" || evt.data.payment_status === "cancelled") {
      return {
        provider:          "wave",
        type:              "payment.failed",
        providerEventId:   evt.id ?? `wave_evt_${evt.data.id}`,
        providerSessionId: evt.data.id,
        amountFcfa:        Number(evt.data.amount),
        metadata,
        rawPayload:        evt,
      }
    }

    // Event reçu mais non actionnable (ex: payment_status: "processing")
    return null
  },
}


/**
 * Vérifie la signature HMAC SHA256 du payload Wave.
 * Le header X-Wave-Signature est attendu au format `t=<timestamp>,v1=<hex>`.
 * Si le format est juste `<hex>` (variante simple), on tolère aussi.
 *
 * À ajuster selon la doc Wave Business officielle si le format diffère.
 */
function verifyWaveSignature(rawBody: string, header: string, secret: string): boolean {
  // Cas 1 : format Stripe-like `t=<ts>,v1=<hex>`
  const match = header.match(/v1=([a-f0-9]+)/i)
  const timestampMatch = header.match(/t=(\d+)/)

  let providedHex: string
  let signedPayload: string
  if (match) {
    providedHex = match[1]
    const ts = timestampMatch ? timestampMatch[1] : ""
    signedPayload = ts ? `${ts}.${rawBody}` : rawBody
  } else {
    // Cas 2 : header = juste hex
    providedHex = header.trim()
    signedPayload = rawBody
  }

  const expectedHex = createHmac("sha256", secret).update(signedPayload).digest("hex")

  // timing-safe compare
  if (providedHex.length !== expectedHex.length) return false
  return timingSafeEqual(Buffer.from(providedHex, "hex"), Buffer.from(expectedHex, "hex"))
}
