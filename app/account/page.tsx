"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, AlertTriangle, ArrowRight, CheckCircle2, XCircle } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import { formatFcfa, type Plan, type Addon } from "@/lib/plans"

type Summary = {
  tenant: { nom: string; email_admin: string }
  subscription: {
    id: string
    plan_id: string
    status: string
    billing_cycle: "monthly" | "yearly"
    amount_fcfa: number
    current_period_start: string
    current_period_end: string
    cancel_at_period_end: boolean
    canceled_at: string | null
    provider: string
  } | null
  plan: Plan | null
  active_addons: Addon[]
  recent_invoices: {
    id: string
    invoice_number: string
    amount_fcfa: number
    status: string
    issued_at: string
    paid_at: string | null
  }[]
}

export default function AccountOverview() {
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    authFetch("/api/account/summary")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`)
        return r.json() as Promise<Summary>
      })
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    )
  }
  if (!data) {
    return <Loader2 className="animate-spin text-indigo-500" />
  }

  const sub = data.subscription
  const plan = data.plan
  const isCanceling = sub?.cancel_at_period_end === true

  return (
    <div className="space-y-6">
      {/* Statut abo */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Plan actuel</div>
            <div className="text-2xl font-bold">
              {plan?.name ?? "Aucun"}
              {sub && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  · {sub.billing_cycle === "yearly" ? "Annuel" : "Mensuel"}
                </span>
              )}
            </div>
            {sub && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {formatFcfa(sub.amount_fcfa)} {sub.billing_cycle === "yearly" ? "/ an" : "/ mois"}
              </div>
            )}
          </div>
          <Link
            href="/account/plan"
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
          >
            Changer <ArrowRight size={14} />
          </Link>
        </div>

        {sub && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Statut</div>
              <StatusBadge status={sub.status} canceling={isCanceling} />
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">{isCanceling ? "Fin de période" : "Prochain renouvellement"}</div>
              <div className="font-medium">{formatDate(sub.current_period_end)}</div>
            </div>
          </div>
        )}

        {isCanceling && (
          <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 p-3 text-sm">
            <div className="font-medium text-amber-800 dark:text-amber-200">Annulation programmée</div>
            <div className="text-amber-700 dark:text-amber-300">
              Votre abonnement sera annulé le {formatDate(sub.current_period_end)}.
            </div>
          </div>
        )}
      </Card>

      {/* Addons actifs */}
      {data.active_addons.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-3">Options activées</h2>
          <ul className="space-y-2 text-sm">
            {data.active_addons.map((a) => (
              <li key={a.id} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  {a.name}
                </span>
                <span className="text-gray-500">
                  {a.priceMonthlyFcfa ? `${formatFcfa(a.priceMonthlyFcfa)} / mois` : "Sur devis"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Dernières factures */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Dernières factures</h2>
          <Link href="/account/billing" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            Tout voir
          </Link>
        </div>
        {data.recent_invoices.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune facture pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/5">
            {data.recent_invoices.map((inv) => (
              <li key={inv.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{inv.invoice_number}</div>
                  <div className="text-xs text-gray-500">{formatDate(inv.issued_at)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span>{formatFcfa(inv.amount_fcfa)}</span>
                  <InvoiceStatusBadge status={inv.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}


function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6">
      {children}
    </div>
  )
}

function StatusBadge({ status, canceling }: { status: string; canceling: boolean }) {
  const map: Record<string, { label: string; classes: string }> = {
    active:    { label: "Actif", classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300" },
    trialing:  { label: "Période d'essai", classes: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300" },
    past_due:  { label: "En retard", classes: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300" },
    suspended: { label: "Suspendu", classes: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300" },
    canceled:  { label: "Annulé", classes: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300" },
    archived:  { label: "Archivé", classes: "bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-300" },
  }
  const m = map[status] || map.active
  const label = canceling ? "Annulation programmée" : m.label
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${m.classes}`}>
      {label}
    </span>
  )
}

function InvoiceStatusBadge({ status }: { status: string }) {
  if (status === "paid") return <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 text-xs"><CheckCircle2 size={14} /> Payée</span>
  if (status === "open") return <span className="text-amber-600 dark:text-amber-400 text-xs">À payer</span>
  if (status === "uncollectible") return <span className="text-red-600 dark:text-red-400 inline-flex items-center gap-1 text-xs"><XCircle size={14} /> Échec</span>
  return <span className="text-gray-500 text-xs">{status}</span>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}
