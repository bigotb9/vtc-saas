import "server-only"
import Stripe from "stripe"
import type {
  CheckoutSession,
  CheckoutSessionRequest,
  PaymentEvent,
  PaymentProviderImpl,
} from "./types"

/**
 * Provider Stripe Billing.
 *
 * Mode 'stub' : renvoie une URL de simulation /dev/stripe-checkout.
 * Mode 'production' : utilise le SDK Stripe pour créer des Checkout Sessions
 * en mode 'subscription' (renouvellement automatique mensuel/annuel).
 *
 * Variables env requises en prod :
 *   - STRIPE_SECRET_KEY      (sk_live_... ou sk_test_...)
 *   - STRIPE_WEBHOOK_SECRET  (whsec_...)
 *
 * Stripe gère le cycle de paiement complet : on reçoit invoice.paid à chaque
 * renouvellement et invoice.payment_failed en cas d'échec → handler met à
 * jour la subscription côté master.
 *
 * Disponibilité Stripe en CI : couvre les paiements carte VISA/Mastercard
 * internationaux. Le compte Stripe Business doit être configuré pour la
 * devise XOF (ou USD avec conversion côté Stripe).
 */

const PAYMENT_MODE = process.env.PAYMENT_MODE || "stub"


// Cache du client Stripe (lazy-init pour ne pas crasher au boot si la clé manque)
let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY manquant")
  // apiVersion : pinné à la version exposée par le SDK (évite les surprises
  // si on bump le package). Pour pinner manuellement, voir docs Stripe.
  _stripe = new Stripe(key)
  return _stripe
}


export const stripeProvider: PaymentProviderImpl = {
  id: "stripe",

  async createCheckoutSession(req: CheckoutSessionRequest): Promise<CheckoutSession> {
    if (PAYMENT_MODE === "stub") {
      const sessionId = `cs_stub_${crypto.randomUUID()}`
      const baseUrl = process.env.SITE_BASE_URL || "http://localhost:3000"
      const checkoutUrl = `${baseUrl}/dev/stripe-checkout?session=${encodeURIComponent(sessionId)}` +
        `&amount=${req.amountFcfa}` +
        `&tenant_id=${encodeURIComponent(req.metadata.tenant_id)}` +
        (req.metadata.invoice_id ? `&invoice_id=${encodeURIComponent(req.metadata.invoice_id)}` : "") +
        `&purpose=${encodeURIComponent(req.metadata.purpose)}` +
        `&success=${encodeURIComponent(req.successUrl)}` +
        `&cancel=${encodeURIComponent(req.cancelUrl)}`
      return {
        provider:    "stripe",
        sessionId,
        checkoutUrl,
        expiresAt:   new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }
    }

    // PRODUCTION : Stripe Checkout Session en mode subscription pour
    // renouvellement automatique. Le price est créé inline via price_data —
    // pas besoin de Products pré-configurés côté Stripe.
    const stripe = getStripe()

    // Le mode dépend du purpose : signup/upgrade = subscription (récurrent),
    // renewal payé via Stripe = invoice payment (one-shot — Stripe se renouvellera
    // automatiquement la prochaine fois). Mais comme on supporte aussi des
    // factures Wave-style (renewal explicit) en parallèle, on accepte les deux.
    const isRenewal = req.metadata.purpose === "renewal"

    const session = await stripe.checkout.sessions.create({
      mode:                  isRenewal ? "payment" : "subscription",
      payment_method_types:  ["card"],
      customer_email:        req.customerEmail,
      success_url:           req.successUrl,
      cancel_url:            req.cancelUrl,
      client_reference_id:   req.metadata.tenant_id,
      metadata: {
        tenant_id:  req.metadata.tenant_id,
        invoice_id: req.metadata.invoice_id ?? "",
        purpose:    req.metadata.purpose,
      },
      line_items: [
        {
          quantity: 1,
          price_data: isRenewal
            ? {
                currency:     "xof",
                unit_amount:  req.amountFcfa,
                product_data: { name: req.description },
              }
            : {
                currency:     "xof",
                unit_amount:  req.amountFcfa,
                product_data: { name: req.description },
                recurring:    { interval: "month" },
              },
        },
      ],
      // Pour les subs : on attache aussi metadata sur la subscription
      ...(isRenewal ? {} : {
        subscription_data: {
          metadata: {
            tenant_id:  req.metadata.tenant_id,
            invoice_id: req.metadata.invoice_id ?? "",
            purpose:    req.metadata.purpose,
          },
        },
      }),
    })

    return {
      provider:    "stripe",
      sessionId:   session.id,
      checkoutUrl: session.url!,
      expiresAt:   new Date((session.expires_at ?? Date.now() / 1000 + 3600) * 1000).toISOString(),
    }
  },


  async verifyAndParseWebhook(req): Promise<PaymentEvent | null> {
    if (PAYMENT_MODE === "stub") {
      const data = JSON.parse(req.rawBody) as {
        event_type:    "payment.success" | "payment.failed"
        session_id:    string
        amount:        number
        metadata: { tenant_id: string; invoice_id?: string; purpose: string }
      }
      return {
        provider:          "stripe",
        type:              data.event_type,
        providerEventId:   `stripe_stub_evt_${data.session_id}`,
        providerSessionId: data.session_id,
        amountFcfa:        data.amount,
        paidAt:            new Date().toISOString(),
        metadata:          data.metadata,
        rawPayload:        data,
      }
    }

    // PRODUCTION : vérification signature + parsing.
    const stripe = getStripe()
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET manquant")
    if (!req.signature) throw new Error("Stripe-Signature header manquant")

    const event = stripe.webhooks.constructEvent(req.rawBody, req.signature, secret)

    // On ne traite que les événements de paiement intéressants. Les autres
    // sont ack (return true) mais pas mappés.
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const metadata = (session.metadata ?? {}) as Record<string, string>
        return {
          provider:          "stripe",
          type:              "payment.success",
          providerEventId:   event.id,
          providerSessionId: typeof session.subscription === "string" ? session.subscription : session.id,
          amountFcfa:        session.amount_total ?? 0,
          paidAt:            new Date(event.created * 1000).toISOString(),
          metadata: {
            tenant_id:  metadata.tenant_id,
            invoice_id: metadata.invoice_id || undefined,
            purpose:    metadata.purpose,
          },
          rawPayload:        event,
        }
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice
        const metadata = ((invoice as unknown as { subscription_details?: { metadata?: Record<string, string> } }).subscription_details?.metadata
                          ?? invoice.metadata ?? {}) as Record<string, string>
        return {
          provider:          "stripe",
          type:              "payment.success",
          providerEventId:   event.id,
          providerSessionId: typeof (invoice as unknown as { subscription?: string }).subscription === "string"
            ? (invoice as unknown as { subscription: string }).subscription
            : invoice.id ?? event.id,
          amountFcfa:        invoice.amount_paid,
          paidAt:            new Date(event.created * 1000).toISOString(),
          metadata: {
            tenant_id:  metadata.tenant_id,
            invoice_id: metadata.invoice_id || undefined,
            purpose:    metadata.purpose || "renewal",
          },
          rawPayload:        event,
        }
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const metadata = ((invoice as unknown as { subscription_details?: { metadata?: Record<string, string> } }).subscription_details?.metadata
                          ?? invoice.metadata ?? {}) as Record<string, string>
        return {
          provider:          "stripe",
          type:              "payment.failed",
          providerEventId:   event.id,
          providerSessionId: invoice.id ?? event.id,
          amountFcfa:        invoice.amount_due,
          errorMessage:      ((invoice.last_finalization_error as unknown as { message?: string })?.message)
                              ?? "Échec de paiement",
          metadata: {
            tenant_id:  metadata.tenant_id,
            invoice_id: metadata.invoice_id || undefined,
            purpose:    metadata.purpose || "renewal",
          },
          rawPayload:        event,
        }
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        const metadata = (sub.metadata ?? {}) as Record<string, string>
        return {
          provider:          "stripe",
          type:              "subscription.canceled",
          providerEventId:   event.id,
          providerSessionId: sub.id,
          metadata: {
            tenant_id:  metadata.tenant_id,
            invoice_id: undefined,
            purpose:    "cancellation",
          },
          rawPayload:        event,
        }
      }
      default:
        // Event reçu mais non actionnable par notre handler (ex: customer.created,
        // invoice.created, etc.). On renvoie null → le webhook route ack 200.
        return null
    }
  },


  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    if (PAYMENT_MODE === "stub") return
    const stripe = getStripe()
    await stripe.subscriptions.cancel(providerSubscriptionId)
  },
}
