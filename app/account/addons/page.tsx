"use client"

import { Sparkles } from "lucide-react"
import { ADDONS, ADDON_ORDER, formatFcfa } from "@/lib/plans"

export default function AddonsPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Activez des options supplémentaires pour étendre votre plan.
        L&apos;activation et le paiement à la demande seront disponibles
        prochainement — contactez-nous en attendant.
      </p>

      <div className="grid md:grid-cols-3 gap-4">
        {ADDON_ORDER.map((id) => {
          const a = ADDONS[id]
          return (
            <div key={a.id} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-5">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 mb-3">
                <Sparkles className="text-indigo-600 dark:text-indigo-400" size={18} />
              </div>
              <h3 className="font-semibold mb-1">{a.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{a.description}</p>
              <div className="text-sm font-medium mb-3">
                {a.priceMonthlyFcfa ? `+ ${formatFcfa(a.priceMonthlyFcfa)} / mois` : "Sur devis"}
              </div>
              <a
                href="mailto:contact@vtcdashboard.com?subject=Activation%20option"
                className="inline-flex w-full justify-center rounded-full border border-gray-200 dark:border-white/10 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                Demander l&apos;activation
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}
