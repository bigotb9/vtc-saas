"use client"

import { useEffect, useState } from "react"
import { Loader2, AlertTriangle, Check, Sparkles, X } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import {
  ADDON_ORDER, ADDONS, formatFcfa, PLAN_ORDER, PLANS,
  type BillingCycle, type Plan, type PlanId,
} from "@/lib/plans"

type Summary = {
  subscription: {
    id: string
    plan_id: string
    billing_cycle: "monthly" | "yearly"
    cancel_at_period_end: boolean
  } | null
}

export default function PlanPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [cycle, setCycle] = useState<BillingCycle>("monthly")
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    try {
      const r = await authFetch("/api/account/summary")
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setSummary(j)
      if (j.subscription?.billing_cycle) setCycle(j.subscription.billing_cycle)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function changePlan(newPlan: PlanId) {
    setSaving(true)
    setError(null)
    try {
      const r = await authFetch("/api/account/change-plan", {
        method: "POST",
        body: JSON.stringify({ plan_id: newPlan, billing_cycle: cycle }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function cancelSubscription() {
    setSaving(true)
    setError(null)
    try {
      const r = await authFetch("/api/account/cancel", { method: "POST" })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setShowCancelConfirm(false)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function reactivateSubscription() {
    setSaving(true)
    setError(null)
    try {
      const r = await authFetch("/api/account/reactivate", { method: "POST" })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!summary) return <Loader2 className="animate-spin text-indigo-500" />

  const currentPlanId = summary.subscription?.plan_id as PlanId | undefined
  const isCanceling = summary.subscription?.cancel_at_period_end === true

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 p-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Toggle cycle */}
      <div className="flex justify-center">
        <div className="inline-flex p-1 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04]">
          <button
            onClick={() => setCycle("monthly")}
            className={`px-4 py-1.5 text-sm rounded-full transition ${cycle === "monthly" ? "bg-indigo-600 text-white" : "text-gray-600 dark:text-gray-300"}`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setCycle("yearly")}
            className={`px-4 py-1.5 text-sm rounded-full transition ${cycle === "yearly" ? "bg-indigo-600 text-white" : "text-gray-600 dark:text-gray-300"}`}
          >
            Annuel <span className="text-amber-500">-15%</span>
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-4">
        {PLAN_ORDER.map((id) => (
          <PlanCard
            key={id}
            plan={PLANS[id]}
            cycle={cycle}
            current={currentPlanId === id && summary.subscription?.billing_cycle === cycle}
            disabled={saving}
            onChoose={() => changePlan(id)}
          />
        ))}
      </div>

      {/* Addons */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6">
        <h2 className="font-semibold mb-1">Options supplémentaires</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Activez des fonctionnalités avancées en plus de votre plan.
        </p>
        <ul className="space-y-3 text-sm">
          {ADDON_ORDER.map((id) => {
            const a = ADDONS[id]
            return (
              <li key={a.id} className="flex items-start justify-between border-t border-gray-100 dark:border-white/5 pt-3 first:border-0 first:pt-0">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-500" />
                    {a.name}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{a.description}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {a.priceMonthlyFcfa ? `+ ${formatFcfa(a.priceMonthlyFcfa)} / mois` : "Sur devis"}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">À venir</div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Annulation */}
      <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50/40 dark:bg-red-500/5 p-6">
        <h2 className="font-semibold mb-1 text-red-800 dark:text-red-300">Zone à risque</h2>
        <p className="text-sm text-red-700 dark:text-red-400 mb-4">
          {isCanceling
            ? "Votre abonnement est programmé pour annulation à la fin de la période courante."
            : "Annule votre abonnement à la fin de la période en cours. Vous gardez l'accès jusqu'à expiration."}
        </p>
        {isCanceling ? (
          <button
            onClick={reactivateSubscription}
            disabled={saving}
            className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Réactiver mon abonnement
          </button>
        ) : showCancelConfirm ? (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={cancelSubscription}
              disabled={saving}
              className="rounded-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              Confirmer l&apos;annulation
            </button>
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 px-4 py-2 text-sm font-medium"
            >
              Garder mon abonnement
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="rounded-full bg-white dark:bg-white/5 border border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-300 px-4 py-2 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            Annuler mon abonnement
          </button>
        )}
      </div>
    </div>
  )
}


function PlanCard({ plan, cycle, current, disabled, onChoose }: {
  plan: Plan
  cycle: BillingCycle
  current: boolean
  disabled: boolean
  onChoose: () => void
}) {
  const monthly = cycle === "monthly" ? plan.priceMonthlyFcfa : Math.round(plan.priceYearlyFcfa / 12)
  return (
    <div className={`rounded-2xl border p-5 flex flex-col ${current ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-500/10" : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02]"}`}>
      <div className="font-semibold">{plan.name}</div>
      <div className="text-2xl font-bold mt-1">{formatFcfa(monthly)}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">/ mois</div>

      <ul className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300 mb-4">
        <li className="flex items-center gap-1.5">
          <Check size={12} className="text-emerald-500 shrink-0" />
          {plan.maxVehicules ? `${plan.maxVehicules} véhicules` : "Véhicules illimités"}
        </li>
        <li className="flex items-center gap-1.5">
          <Check size={12} className="text-emerald-500 shrink-0" />
          {plan.maxUsers ? `${plan.maxUsers} utilisateurs` : "Utilisateurs illimités"}
        </li>
        {plan.features.yango && <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500 shrink-0" />Partenariat Yango</li>}
        {plan.features.pdf_reports && <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500 shrink-0" />Rapports PDF</li>}
        {plan.features.ai_insights && <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500 shrink-0" />AI Insights</li>}
        {plan.features.ai_agent && <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500 shrink-0" />Agent IA VTC</li>}
      </ul>

      <button
        disabled={current || disabled}
        onClick={onChoose}
        className={`mt-auto w-full rounded-full px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${
          current
            ? "bg-emerald-600 text-white cursor-default"
            : "bg-indigo-600 hover:bg-indigo-700 text-white"
        }`}
      >
        {current ? "Plan actuel" : `Choisir ${plan.name}`}
      </button>
    </div>
  )
}
