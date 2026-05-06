import DevCheckoutClient from "../DevCheckoutClient"

/**
 * Page de simulation Wave (mode dev/stub).
 * Servie quand PAYMENT_MODE=stub. À supprimer/désactiver en prod.
 */

type Props = {
  searchParams: Promise<{
    session?:    string
    amount?:     string
    tenant_id?:  string
    invoice_id?: string
    purpose?:    string
    success?:    string
    cancel?:     string
  }>
}

export default async function WaveCheckoutDev({ searchParams }: Props) {
  const sp = await searchParams
  return (
    <DevCheckoutClient
      provider="wave"
      sessionId={sp.session ?? ""}
      amount={Number(sp.amount ?? 0)}
      tenantId={sp.tenant_id ?? ""}
      invoiceId={sp.invoice_id}
      purpose={(sp.purpose as "signup" | "renewal") ?? "signup"}
      successUrl={sp.success ?? "/"}
      cancelUrl={sp.cancel ?? "/"}
    />
  )
}
