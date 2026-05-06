"use client"

import Link from "next/link"
import { useState } from "react"
import { Check, X, Sparkles } from "lucide-react"
import {
  formatFcfa,
  type Addon,
  type BillingCycle,
  type FeatureKey,
  type Plan,
} from "@/lib/plans"

/**
 * UI client du pricing : toggle mensuel/annuel + tableau comparatif.
 */

type Props = {
  plans:  Plan[]
  addons: Addon[]
}

const FEATURE_ROWS: { key: FeatureKey; label: string }[] = [
  { key: "dashboard",     label: "Tableau de bord complet" },
  { key: "alertes",       label: "Alertes paiements & documents" },
  { key: "vehicules",     label: "Module véhicules" },
  { key: "chauffeurs",    label: "Module chauffeurs" },
  { key: "recettes",      label: "Module recettes" },
  { key: "depenses",      label: "Module dépenses" },
  { key: "wave",          label: "Intégration Wave" },
  { key: "yango",         label: "Partenariat Yango" },
  { key: "fleet_clients", label: "Gestion flotte client (tiers)" },
  { key: "pdf_reports",   label: "Rapports PDF" },
  { key: "ai_insights",   label: "AI Insights" },
  { key: "ai_agent",      label: "Agent IA VTC personnalisé" },
]

export default function PricingClient({ plans, addons }: Props) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly")

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Tarification claire et sans surprise</h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
          Choisissez le plan adapté à votre flotte. Changez à tout moment.
        </p>

        <div className="mt-8 inline-flex p-1 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04]">
          <button
            type="button"
            onClick={() => setCycle("monthly")}
            className={`px-5 py-2 text-sm rounded-full transition font-medium ${
              cycle === "monthly"
                ? "bg-indigo-600 text-white shadow"
                : "text-gray-600 dark:text-gray-300"
            }`}
          >
            Mensuel
          </button>
          <button
            type="button"
            onClick={() => setCycle("yearly")}
            className={`px-5 py-2 text-sm rounded-full transition font-medium ${
              cycle === "yearly"
                ? "bg-indigo-600 text-white shadow"
                : "text-gray-600 dark:text-gray-300"
            }`}
          >
            Annuel
            <span className="ml-2 inline-block text-[10px] font-bold bg-amber-400/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
              -15%
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} cycle={cycle} highlighted={plan.id === "gold"} />
        ))}
      </div>

      <Comparison plans={plans} />

      <Addons addons={addons} />

      <div className="mt-16 text-center text-sm text-gray-500 dark:text-gray-400">
        Tarifs en FCFA · TTC · Activation immédiate après paiement confirmé · Sans engagement.
      </div>
    </div>
  )
}


function PlanCard({ plan, cycle, highlighted }: { plan: Plan; cycle: BillingCycle; highlighted?: boolean }) {
  const monthlyDisplay =
    cycle === "monthly"
      ? plan.priceMonthlyFcfa
      : Math.round(plan.priceYearlyFcfa / 12)

  const totalLabel =
    cycle === "monthly"
      ? `${formatFcfa(plan.priceMonthlyFcfa)} / mois`
      : `${formatFcfa(plan.priceYearlyFcfa)} / an facturé annuellement`

  return (
    <div
      className={`relative rounded-2xl border p-6 flex flex-col ${
        highlighted
          ? "border-indigo-500 dark:border-indigo-400 bg-gradient-to-b from-indigo-50/60 to-white dark:from-indigo-500/10 dark:to-transparent shadow-xl"
          : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02]"
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-indigo-600 text-white text-xs font-medium px-3 py-1 shadow">
          <Sparkles size={12} />
          Le plus populaire
        </span>
      )}

      <h3 className="font-semibold text-lg">{plan.name}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 min-h-[3rem]">{plan.description}</p>

      <div className="mt-6 mb-2">
        <span className="text-4xl font-bold">{formatFcfa(monthlyDisplay)}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400"> / mois</span>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-6">{totalLabel}</div>

      <ul className="space-y-2 text-sm mb-6">
        <li className="flex items-center gap-2">
          <Check size={16} className="text-emerald-500" />
          {plan.maxVehicules ? `Jusqu'à ${plan.maxVehicules} véhicules` : "Véhicules illimités"}
        </li>
        <li className="flex items-center gap-2">
          <Check size={16} className="text-emerald-500" />
          {plan.maxUsers ? `${plan.maxUsers} utilisateurs` : "Utilisateurs illimités"}
        </li>
        {plan.features.yango && (
          <li className="flex items-center gap-2">
            <Check size={16} className="text-emerald-500" />
            Partenariat Yango inclus
          </li>
        )}
        {plan.features.pdf_reports && (
          <li className="flex items-center gap-2">
            <Check size={16} className="text-emerald-500" />
            Rapports PDF
          </li>
        )}
        {plan.features.ai_insights && (
          <li className="flex items-center gap-2">
            <Check size={16} className="text-emerald-500" />
            AI Insights
          </li>
        )}
        {plan.features.ai_agent && (
          <li className="flex items-center gap-2">
            <Check size={16} className="text-emerald-500" />
            Agent IA VTC
          </li>
        )}
      </ul>

      <Link
        href={`/signup?plan=${plan.id}&cycle=${cycle}`}
        className={`mt-auto inline-flex justify-center rounded-full font-medium px-4 py-2.5 transition ${
          highlighted
            ? "bg-indigo-600 hover:bg-indigo-700 text-white"
            : "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100"
        }`}
      >
        Choisir {plan.name}
      </Link>
    </div>
  )
}


function Comparison({ plans }: { plans: Plan[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden mb-12">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-white/5">
        <h3 className="font-semibold">Comparaison détaillée</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/[0.03]">
            <tr>
              <th className="text-left font-medium px-6 py-3 text-gray-600 dark:text-gray-300">Fonctionnalité</th>
              {plans.map((p) => (
                <th key={p.id} className="font-medium px-6 py-3 text-gray-900 dark:text-white">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100 dark:border-white/5">
              <td className="px-6 py-3 text-gray-700 dark:text-gray-300">Véhicules</td>
              {plans.map((p) => (
                <td key={p.id} className="text-center px-6 py-3 font-medium">
                  {p.maxVehicules ?? "Illimité"}
                </td>
              ))}
            </tr>
            <tr className="border-t border-gray-100 dark:border-white/5">
              <td className="px-6 py-3 text-gray-700 dark:text-gray-300">Utilisateurs</td>
              {plans.map((p) => (
                <td key={p.id} className="text-center px-6 py-3 font-medium">
                  {p.maxUsers ?? "Illimité"}
                </td>
              ))}
            </tr>
            {FEATURE_ROWS.map((row) => (
              <tr key={row.key} className="border-t border-gray-100 dark:border-white/5">
                <td className="px-6 py-3 text-gray-700 dark:text-gray-300">{row.label}</td>
                {plans.map((p) => (
                  <td key={p.id} className="text-center px-6 py-3">
                    {p.features[row.key] ? (
                      <Check size={16} className="inline text-emerald-500" />
                    ) : (
                      <X size={16} className="inline text-gray-300 dark:text-gray-600" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


function Addons({ addons }: { addons: Addon[] }) {
  return (
    <div>
      <h3 className="font-semibold text-xl mb-4">Options & extensions</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {addons.map((a) => (
          <div key={a.id} className="rounded-xl border border-gray-200 dark:border-white/10 p-5 bg-white dark:bg-white/[0.02]">
            <h4 className="font-semibold mb-1">{a.name}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{a.description}</p>
            <div className="text-sm font-medium">
              {a.priceMonthlyFcfa
                ? `+ ${formatFcfa(a.priceMonthlyFcfa)} / mois`
                : "Sur devis"}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
