"use client"

import { useState } from "react"
import { Loader2, AlertCircle, Smartphone, CreditCard } from "lucide-react"
import type { PaymentProvider } from "@/lib/payment"

/**
 * UI client : choix du moyen de paiement (Wave / Stripe).
 * Au clic, POST /api/payment/create-checkout puis redirige vers le provider.
 */

type Props = {
  tenantId:  string
  providers: PaymentProvider[]
}

const META: Record<PaymentProvider, { name: string; sub: string; icon: typeof Smartphone; color: string }> = {
  wave: {
    name:  "Wave",
    sub:   "Mobile Money — paiement instantané",
    icon:  Smartphone,
    color: "from-cyan-500 to-blue-600",
  },
  stripe: {
    name:  "Carte bancaire",
    sub:   "VISA, Mastercard via Stripe",
    icon:  CreditCard,
    color: "from-purple-600 to-indigo-700",
  },
}

export default function PaymentChoice({ tenantId, providers }: Props) {
  const [loading, setLoading] = useState<PaymentProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pay(provider: PaymentProvider) {
    setLoading(provider)
    setError(null)
    try {
      const res = await fetch("/api/payment/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, provider }),
      })
      const json = await res.json()
      if (!res.ok || !json.checkout_url) {
        setError(json.error || `HTTP ${res.status}`)
        setLoading(null)
        return
      }
      window.location.href = json.checkout_url
    } catch (e) {
      setError((e as Error).message)
      setLoading(null)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6 mb-6">
      <h2 className="font-semibold mb-4">Choisissez votre moyen de paiement</h2>

      <div className="space-y-3">
        {providers.map((id) => {
          const m = META[id]
          const isLoading = loading === id
          return (
            <button
              key={id}
              type="button"
              disabled={loading !== null}
              onClick={() => pay(id)}
              className={`w-full text-left rounded-xl border border-gray-200 dark:border-white/10 hover:border-indigo-400 dark:hover:border-indigo-500/60 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-4 p-4 bg-white dark:bg-white/[0.02]`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center text-white shrink-0`}>
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <m.icon size={20} />}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{m.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{m.sub}</div>
              </div>
              <div className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                {isLoading ? "Redirection…" : "Payer"}
              </div>
            </button>
          )
        })}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 p-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
