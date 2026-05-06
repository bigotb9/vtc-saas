import "server-only"
import { stripeProvider } from "./stripe"
import { waveProvider } from "./wave"
import type { PaymentProvider, PaymentProviderImpl } from "./types"

export type { PaymentProvider, PaymentProviderImpl, CheckoutSession, CheckoutSessionRequest, PaymentEvent } from "./types"

/**
 * Factory simple : renvoie l'implémentation pour un provider donné.
 */
export function getProvider(id: PaymentProvider): PaymentProviderImpl {
  switch (id) {
    case "wave":   return waveProvider
    case "stripe": return stripeProvider
  }
}

/**
 * Renvoie la liste des providers disponibles côté UI (pour afficher les
 * boutons "Payer avec Wave" / "Payer avec carte").
 *
 * Pour limiter à un seul provider en prod (ex: désactiver Stripe le temps
 * d'avoir le compte), définir env PAYMENT_PROVIDERS="wave" (csv).
 */
export function getAvailableProviders(): PaymentProvider[] {
  const env = process.env.PAYMENT_PROVIDERS
  if (!env) return ["wave", "stripe"]
  return env.split(",").map(s => s.trim()).filter(s => s === "wave" || s === "stripe") as PaymentProvider[]
}
