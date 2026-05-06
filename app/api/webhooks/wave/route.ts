import { NextRequest, NextResponse } from "next/server"
import { getProvider } from "@/lib/payment"
import { handlePaymentEvent } from "@/lib/payment/handler"

/**
 * POST /api/webhooks/wave
 *
 * Reçoit les notifications Wave après un paiement (succès / échec).
 *
 * Auth : signature HMAC dans le header (à vérifier dans wave.ts en mode prod).
 * En mode stub, accepte le payload tel quel — la page /dev/wave-checkout
 * envoie un payload prévisible.
 *
 * Le handler est idempotent : un retry du même provider_event_id ne crée
 * pas de doublon.
 */

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-wave-signature") || undefined
  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => { headers[k] = v })

  let event
  try {
    event = await getProvider("wave").verifyAndParseWebhook({ rawBody, signature, headers })
  } catch (e) {
    return NextResponse.json({ error: `webhook invalide: ${(e as Error).message}` }, { status: 400 })
  }

  if (!event) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const result = await handlePaymentEvent(event)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
