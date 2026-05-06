"use client"

import { useState } from "react"
import { Loader2, AlertCircle, Smartphone, CreditCard, ExternalLink, CheckCircle2, ArrowRight } from "lucide-react"
import type { PaymentProvider } from "@/lib/payment"
import { formatFcfa } from "@/lib/plans"

/**
 * UI client : choix du moyen de paiement.
 *
 * Deux modes de redirection selon le provider :
 *
 * 1. Mode classique (Stripe Checkout, Wave avec API) → redirect direct
 *    sur l'URL de checkout. Le webhook confirmera le paiement.
 *
 * 2. Mode "manualClaim" (Wave merchant link) → ouvre le lien dans un
 *    nouvel onglet et bascule l'UI dans un mode "saisir n° transaction"
 *    pour que le client déclare son paiement. L'admin SaaS validera.
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

type ClaimState = {
  provider:    PaymentProvider
  amountFcfa:  number
  checkoutUrl: string
  sessionId:   string
}

export default function PaymentChoice({ tenantId, providers }: Props) {
  const [loading, setLoading] = useState<PaymentProvider | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [claim, setClaim] = useState<ClaimState | null>(null)
  const [claimed, setClaimed] = useState(false)

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

      if (json.manual_claim) {
        // Wave merchant link : ouvre le lien dans un nouvel onglet et
        // bascule l'UI en mode "saisir n° transaction".
        window.open(json.checkout_url, "_blank", "noopener,noreferrer")
        setClaim({
          provider,
          amountFcfa:  json.amount_fcfa,
          checkoutUrl: json.checkout_url,
          sessionId:   json.session_id,
        })
        setLoading(null)
      } else {
        // Stripe ou Wave avec API : redirect classique
        window.location.href = json.checkout_url
      }
    } catch (e) {
      setError((e as Error).message)
      setLoading(null)
    }
  }

  // ─── Mode "Merci, en cours de vérification" ───
  if (claimed) {
    return (
      <div className="rounded-2xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-6 mb-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" size={22} />
          <div>
            <h3 className="font-semibold mb-1">Merci ! Votre paiement est en cours de vérification.</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              Nous avons reçu votre déclaration de paiement. Notre équipe vérifie la transaction
              côté Wave (généralement sous 1 heure en jours ouvrés) et active votre espace
              automatiquement. Vous recevrez un email dès l&apos;activation à l&apos;adresse fournie
              au signup.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              Pour toute urgence : <a href="mailto:support@vtcdashboard.com" className="text-indigo-600 hover:underline">support@vtcdashboard.com</a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ─── Mode "Saisir n° transaction après paiement Wave" ───
  if (claim) {
    return <ClaimForm tenantId={tenantId} state={claim} onCancel={() => setClaim(null)} onSubmitted={() => setClaimed(true)} />
  }

  // ─── Mode "Choix du moyen de paiement" (par défaut) ───
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
              className="w-full text-left rounded-xl border border-gray-200 dark:border-white/10 hover:border-indigo-400 dark:hover:border-indigo-500/60 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-4 p-4 bg-white dark:bg-white/[0.02]"
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


// ────────── ClaimForm ──────────
// Affiché après que le client a cliqué "Payer avec Wave" et que le lien
// marchand s'est ouvert dans un nouvel onglet. Le client paie sur Wave,
// note son n° de transaction, revient ici et le saisit.

function ClaimForm({ tenantId, state, onCancel, onSubmitted }: {
  tenantId:    string
  state:       ClaimState
  onCancel:    () => void
  onSubmitted: () => void
}) {
  const [transactionRef, setTransactionRef] = useState("")
  const [phone, setPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/signup/${tenantId}/wave-claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_ref: transactionRef.trim(),
          payer_phone:     phone.trim() || null,
          amount_fcfa:     state.amountFcfa,
          session_id:      state.sessionId,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`)
        setSubmitting(false)
        return
      }
      onSubmitted()
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/5 p-6 mb-6">

      <div className="flex items-start gap-3 mb-4">
        <ExternalLink className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
        <div>
          <h3 className="font-semibold mb-1">Wave est ouvert dans un nouvel onglet</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            Effectuez le paiement de <strong>{formatFcfa(state.amountFcfa)}</strong> sur Wave,
            puis revenez ici pour confirmer votre paiement avec son numéro de transaction.
          </p>
          <a
            href={state.checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Rouvrir Wave <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Numéro de transaction Wave <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
            placeholder="Ex : T_abcd1234"
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Visible dans l&apos;app Wave dans l&apos;historique de la transaction.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Numéro Wave utilisé pour le paiement
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+225 07 00 00 00 00"
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Optionnel — aide notre équipe à retrouver votre transaction.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 p-2 flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-gray-200 dark:border-white/10 px-4 py-2 text-sm"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting || !transactionRef.trim()}
            className="flex-1 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium inline-flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            J&apos;ai payé · Confirmer
          </button>
        </div>
      </form>
    </div>
  )
}
