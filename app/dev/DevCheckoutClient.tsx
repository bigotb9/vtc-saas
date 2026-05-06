"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react"
import { formatFcfa } from "@/lib/plans"

/**
 * Composant partagé pour les pages /dev/wave-checkout et /dev/stripe-checkout.
 *
 * Simule l'écran de paiement d'un provider en mode dev/stub :
 *   - bouton "Confirmer le paiement" → POST sur /api/webhooks/<provider>
 *     puis redirect vers successUrl
 *   - bouton "Annuler" → redirect vers cancelUrl
 *
 * À supprimer/désactiver en prod (les vraies pages Wave/Stripe seront
 * utilisées à la place).
 */

type Props = {
  provider:   "wave" | "stripe"
  sessionId:  string
  amount:     number
  tenantId:   string
  invoiceId?: string
  purpose:    "signup" | "renewal"
  successUrl: string
  cancelUrl:  string
}

const LABELS = {
  wave:   { name: "Wave",   color: "from-cyan-500 to-blue-600" },
  stripe: { name: "Stripe", color: "from-purple-600 to-indigo-700" },
}

export default function DevCheckoutClient(props: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "failed">("idle")
  const [error, setError] = useState<string | null>(null)

  const label = LABELS[props.provider]

  async function confirmPayment() {
    setStatus("processing")
    setError(null)

    try {
      const res = await fetch(`/api/webhooks/${props.provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "payment.success",
          session_id: props.sessionId,
          amount:     props.amount,
          metadata: {
            tenant_id:  props.tenantId,
            invoice_id: props.invoiceId,
            purpose:    props.purpose,
          },
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setStatus("failed")
        setError(json.error || json.message || `HTTP ${res.status}`)
        return
      }
      setStatus("success")
      // Redirect après 1.5s pour montrer la confirmation
      setTimeout(() => {
        window.location.href = props.successUrl
      }, 1500)
    } catch (e) {
      setStatus("failed")
      setError((e as Error).message)
    }
  }

  function cancel() {
    window.location.href = props.cancelUrl
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080C14] flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">

        <div className="rounded-2xl border border-amber-300/50 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-3 mb-4 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>Mode développement — page de simulation. À remplacer par le vrai checkout {label.name} en production.</span>
        </div>

        <div className="rounded-2xl bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 overflow-hidden shadow-xl">
          <div className={`bg-gradient-to-r ${label.color} text-white p-6`}>
            <div className="text-sm opacity-80">Paiement {label.name}</div>
            <div className="text-3xl font-bold mt-1">{formatFcfa(props.amount)}</div>
            <div className="text-xs opacity-80 mt-2">Session : {props.sessionId.slice(0, 24)}…</div>
          </div>

          <div className="p-6 space-y-4">
            {status === "idle" && (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Confirmez le paiement de <strong>{formatFcfa(props.amount)}</strong> pour activer
                  votre espace VTC Dashboard.
                </p>
                <button
                  onClick={confirmPayment}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 transition shadow"
                >
                  <CheckCircle2 size={18} />
                  Confirmer le paiement
                </button>
                <button
                  onClick={cancel}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 font-medium px-6 py-2.5 transition"
                >
                  <XCircle size={16} />
                  Annuler
                </button>
              </>
            )}

            {status === "processing" && (
              <div className="text-center py-4">
                <Loader2 className="mx-auto animate-spin text-indigo-500" size={32} />
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Traitement du paiement…</p>
              </div>
            )}

            {status === "success" && (
              <div className="text-center py-4">
                <CheckCircle2 className="mx-auto text-emerald-500" size={36} />
                <p className="mt-3 font-semibold">Paiement confirmé</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Redirection en cours…</p>
              </div>
            )}

            {status === "failed" && (
              <div className="text-center py-4">
                <XCircle className="mx-auto text-red-500" size={36} />
                <p className="mt-3 font-semibold">Paiement échoué</p>
                {error && <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>}
                <button
                  onClick={() => setStatus("idle")}
                  className="mt-4 text-sm text-indigo-600 hover:underline"
                >
                  Réessayer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
