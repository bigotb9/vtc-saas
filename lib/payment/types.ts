/**
 * Types communs pour la couche paiement.
 *
 * Deux providers supportés :
 *   - Wave CI (mobile money — paiement one-shot, pas d'abonnement récurrent)
 *   - Stripe Billing (carte bancaire — abonnement récurrent automatique)
 *
 * En Wave CI, on facture mensuellement via cron : à chaque échéance, on
 * crée une nouvelle invoice + on déclenche un nouveau paiement (le client
 * doit cliquer "Payer" via WhatsApp/email).
 *
 * En Stripe, l'abonnement se renouvelle automatiquement.
 */

export type PaymentProvider = "wave" | "stripe"

export type CheckoutSessionRequest = {
  tenantId:           string         // tenant en awaiting_payment ou pour renouvellement
  invoiceId?:         string         // facture à payer (renouvellement) — undefined pour signup initial
  amountFcfa:         number
  description:        string         // ex: "Plan Silver - Janvier 2026"
  customerEmail:      string
  customerPhone?:     string
  successUrl:         string         // URL de redirect après paiement réussi
  cancelUrl:          string         // URL de redirect si annulation

  // Métadonnées : seront remontées dans le webhook pour identifier la transaction
  metadata: {
    tenant_id:    string
    invoice_id?:  string
    purpose:      "signup" | "renewal" | "addon" | "upgrade"
  }
}

export type CheckoutSession = {
  provider:     PaymentProvider
  sessionId:    string         // ID externe (chez Wave/Stripe) — ou interne si lien marchand
  checkoutUrl:  string         // URL où rediriger l'utilisateur

  /**
   * Si true, on n'a pas de webhook automatique — le client paie sur la
   * plateforme externe (Wave merchant link), revient sur notre app et
   * doit déclarer manuellement le paiement avec son n° de transaction.
   * L'admin SaaS valide ensuite côté backoffice.
   *
   * Si false (Stripe checkout, Wave Business avec webhook) : le webhook
   * confirmera automatiquement.
   */
  manualClaim?: boolean
  expiresAt:    string         // ISO
}

/**
 * Événement reçu via webhook après vérification de signature. Le provider
 * concret normalise sa réponse vers ce format pour que le code applicatif
 * soit indépendant du provider.
 */
export type PaymentEvent = {
  provider:           PaymentProvider
  type:               "payment.success" | "payment.failed" | "payment.refunded" | "subscription.canceled"
  providerEventId:    string         // ID unique de l'événement (déduplication)
  providerSessionId:  string         // ID de session/payment
  amountFcfa?:        number
  paidAt?:            string
  errorMessage?:      string
  metadata: {
    tenant_id?:   string
    invoice_id?:  string
    purpose?:     string
  }
  rawPayload:         unknown        // JSON brut du provider (pour audit)
}


/**
 * Interface que tout provider doit implémenter. Permet de switcher entre
 * Wave / Stripe / mock sans changer le code applicatif.
 */
export interface PaymentProviderImpl {
  readonly id: PaymentProvider

  /** Crée une session de checkout. Renvoie l'URL où rediriger. */
  createCheckoutSession(req: CheckoutSessionRequest): Promise<CheckoutSession>

  /**
   * Vérifie la signature du webhook + parse l'event. Throw si signature
   * invalide. Renvoie null pour les events reçus mais non actionnables
   * (ex: customer.created côté Stripe) — le caller doit ack 200.
   */
  verifyAndParseWebhook(req: {
    rawBody:    string
    signature?: string
    headers:    Record<string, string>
  }): Promise<PaymentEvent | null>

  /** Annule un abonnement actif (Stripe surtout). */
  cancelSubscription?(providerSubscriptionId: string): Promise<void>
}
