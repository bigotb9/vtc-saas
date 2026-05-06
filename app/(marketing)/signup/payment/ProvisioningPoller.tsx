"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react"

/**
 * Affiche l'état du provisioning et poll /api/public/tenant-status
 * jusqu'à ce que le tenant passe en 'ready' ou 'failed'.
 */

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "En attente de paiement",
  pending:          "En file d'attente",
  creating:         "Création du projet",
  migrating:        "Création de la base de données",
  seeding:          "Initialisation des données",
  ready:            "Espace prêt",
  failed:           "Échec",
}

const STATUS_PROGRESS: Record<string, number> = {
  awaiting_payment: 5,
  pending:          15,
  creating:         35,
  migrating:        65,
  seeding:          85,
  ready:            100,
  failed:           0,
}

type Props = {
  tenantId:      string
  slug:          string
  initialStatus: string
}

export default function ProvisioningPoller({ tenantId, slug, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "ready" || status === "failed") return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/public/tenant-status?id=${encodeURIComponent(tenantId)}`)
        const json = await res.json()
        if (!res.ok) {
          setError(json.error || `HTTP ${res.status}`)
          return
        }
        setStatus(json.provisioning_status)
        if (json.provisioning_error) setError(json.provisioning_error)
      } catch (e) {
        setError((e as Error).message)
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [tenantId, status])

  const progress = STATUS_PROGRESS[status] ?? 0
  const label = STATUS_LABEL[status] ?? status

  if (status === "ready") {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 mb-4">
          <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={28} />
        </div>
        <h1 className="text-3xl font-bold mb-3">Votre espace est prêt !</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Connectez-vous à votre tableau de bord. Un email d&apos;invitation a été envoyé à votre adresse.
        </p>
        <Link
          href={`/?t=${slug}`}
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 font-medium shadow-lg"
        >
          Accéder à mon espace
        </Link>
      </div>
    )
  }

  if (status === "failed") {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-100 dark:bg-red-500/20 mb-4">
          <AlertTriangle className="text-red-600 dark:text-red-400" size={28} />
        </div>
        <h1 className="text-3xl font-bold mb-3">Activation en attente</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-3">
          Une erreur est survenue lors de la création de votre espace. Notre équipe a été notifiée.
        </p>
        {error && <p className="text-sm text-red-500 mb-6">{error}</p>}
        <p className="text-sm text-gray-500">
          Nous vous contacterons sous 24h. Pour toute urgence : <a href="mailto:contact@vtcdashboard.com" className="text-indigo-600 hover:underline">contact@vtcdashboard.com</a>
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      <div className="text-center mb-8">
        <Loader2 className="mx-auto animate-spin text-indigo-500 mb-4" size={36} />
        <h1 className="text-2xl font-bold mb-2">Activation en cours…</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Création de votre espace dédié. Cela prend généralement 1 à 3 minutes.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6">
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="font-medium">{label}</span>
          <span className="text-gray-500">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-amber-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Cette page se rafraîchit automatiquement. Vous pouvez la fermer — un email vous préviendra quand ce sera prêt.
        </div>
      </div>
    </div>
  )
}
