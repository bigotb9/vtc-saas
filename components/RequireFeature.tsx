"use client"

import Link from "next/link"
import { Lock, Sparkles } from "lucide-react"
import { useFeature } from "./TenantProvider"
import type { FeatureKey } from "@/lib/plans"

/**
 * Gating UI : n'affiche children que si la feature est active pour le
 * tenant courant. Sinon, affiche un fallback (par défaut un CTA upgrade).
 *
 * Usage minimal :
 *   <RequireFeature feature="yango">
 *     <YangoDashboard />
 *   </RequireFeature>
 *
 * Avec fallback custom :
 *   <RequireFeature feature="yango" fallback={<MyCustomBlocker />}>
 *     <YangoDashboard />
 *   </RequireFeature>
 *
 * Pour cacher silencieusement (sans CTA) — ex: bouton dans une toolbar :
 *   <RequireFeature feature="pdf_reports" silent>
 *     <ExportPdfButton />
 *   </RequireFeature>
 */

type Props = {
  feature:   FeatureKey
  children:  React.ReactNode
  fallback?: React.ReactNode
  silent?:   boolean    // true = ne rend rien si feature absente (pas de CTA)
}

export default function RequireFeature({ feature, children, fallback, silent }: Props) {
  const allowed = useFeature(feature)
  if (allowed) return <>{children}</>
  if (silent) return null
  if (fallback !== undefined) return <>{fallback}</>
  return <UpgradePrompt feature={feature} />
}


// ────────── UpgradePrompt ──────────
// CTA réutilisable affiché par défaut quand RequireFeature bloque l'accès.

const FEATURE_LABELS: Record<FeatureKey, string> = {
  dashboard:     "Tableau de bord",
  alertes:       "Alertes",
  vehicules:     "Véhicules",
  chauffeurs:    "Chauffeurs",
  recettes:      "Recettes",
  depenses:      "Dépenses",
  wave:          "Intégration Wave",
  yango:         "Partenariat Yango",
  pdf_reports:   "Rapports PDF",
  fleet_clients: "Gestion flotte client",
  ai_insights:   "AI Insights",
  ai_agent:      "Agent IA VTC",
  gps:           "Intégration GPS",
}

export function UpgradePrompt({ feature }: { feature: FeatureKey }) {
  const label = FEATURE_LABELS[feature] ?? feature
  return (
    <div className="rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-50 to-white dark:from-amber-500/10 dark:to-transparent dark:border-amber-500/30 p-6 flex flex-col items-center text-center gap-3">
      <div className="rounded-full bg-amber-100 dark:bg-amber-500/20 p-3">
        <Lock className="text-amber-600 dark:text-amber-400" size={22} />
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white">
        {label} non inclus dans votre plan
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
        Cette fonctionnalité est disponible avec un plan supérieur ou en option.
        Passez à l&apos;offre adaptée pour la débloquer.
      </p>
      <Link
        href="/account/plan"
        className="inline-flex items-center gap-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 transition"
      >
        <Sparkles size={16} />
        Voir les offres
      </Link>
    </div>
  )
}
