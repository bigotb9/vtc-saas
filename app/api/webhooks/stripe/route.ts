import { NextRequest, NextResponse } from "next/server"
import { getProvider } from "@/lib/payment"
import { handlePaymentEvent } from "@/lib/payment/handler"

/**
 * POST /api/webhooks/stripe
 *
 * Reçoit les events Stripe (checkout.session.completed, invoice.paid,
 * invoice.payment_failed, customer.subscription.deleted, etc.).
 *
 * Auth : Stripe-Signature header (vérifié en mode production via
 * stripe.webhooks.constructEvent).
 */

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get("stripe-signature") || undefined
  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => { headers[k] = v })

  let event
  try {
    event = await getProvider("stripe").verifyAndParseWebhook({ rawBody, signature, headers })
  } catch (e) {
    return NextResponse.json({ error: `webhook invalide: ${(e as Error).message}` }, { status: 400 })
  }

  // Event reçu mais non actionnable (customer.created, etc.) → ack 200
  if (!event) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const result = await handlePaymentEvent(event)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
