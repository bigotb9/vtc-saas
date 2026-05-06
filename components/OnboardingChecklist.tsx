"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Circle, X, Sparkles, Car, Users, Wallet } from "lucide-react"
import { useTenant } from "./TenantProvider"

/**
 * Bandeau d'onboarding affiché en haut du dashboard pour les nouveaux
 * tenants. Étapes :
 *   1. Ajouter votre premier véhicule
 *   2. Créer un chauffeur
 *   3. Enregistrer une première recette
 *
 * Auto-detect : compte les ressources via le client tenant Supabase. Une
 * fois les 3 étapes faites, le bandeau disparaît tout seul.
 *
 * "Masquer" pose un flag dans localStorage pour ne plus afficher.
 */

const DISMISS_KEY_PREFIX = "vtc-onboarding-dismissed-"

type Counts = {
  vehicules:  number
  chauffeurs: number
  recettes:   number
}

export default function OnboardingChecklist() {
  const { tenant, client } = useTenant()
  const [counts, setCounts] = useState<Counts | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!tenant || !client) return

    const dismissKey = `${DISMISS_KEY_PREFIX}${tenant.slug}`
    if (typeof window !== "undefined" && localStorage.getItem(dismissKey)) {
      setDismissed(true)
      return
    }

    Promise.all([
      client.from("vehicules").select("*", { count: "exact", head: true }),
      client.from("chauffeurs").select("*", { count: "exact", head: true }),
      client.from("versements_chauffeurs").select("*", { count: "exact", head: true }),
    ]).then(([v, c, r]) => {
      setCounts({
        vehicules:  v.count ?? 0,
        chauffeurs: c.count ?? 0,
        recettes:   r.count ?? 0,
      })
    })
  }, [tenant, client])

  if (!tenant || dismissed) return null
  if (!counts) return null

  const steps = [
    { key: "vehicules",  label: "Ajouter votre premier véhicule",   icon: Car,    href: "/vehicules",  done: counts.vehicules > 0 },
    { key: "chauffeurs", label: "Créer un profil chauffeur",        icon: Users,  href: "/chauffeurs", done: counts.chauffeurs > 0 },
    { key: "recettes",   label: "Enregistrer votre première recette", icon: Wallet, href: "/recettes",  done: counts.recettes > 0 },
  ]
  const doneCount = steps.filter(s => s.done).length

  if (doneCount === steps.length) return null   // Tout fait → on masque

  function dismiss() {
    if (!tenant) return
    localStorage.setItem(`${DISMISS_KEY_PREFIX}${tenant.slug}`, "1")
    setDismissed(true)
  }

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-50 via-white to-amber-50 dark:from-indigo-950/30 dark:via-[#0A0F1A] dark:to-amber-950/20 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-500" />
            Bienvenue ! Démarrons votre flotte
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            {doneCount} sur {steps.length} étapes terminées · 5 minutes pour démarrer.
          </p>
        </div>
        <button
          onClick={dismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          aria-label="Masquer la checklist"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid gap-2">
        {steps.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
              s.done
                ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-500/10"
                : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:border-indigo-400 dark:hover:border-indigo-500/40"
            }`}
          >
            {s.done
              ? <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
              : <Circle size={20} className="text-gray-300 dark:text-gray-600 shrink-0" />
            }
            <s.icon size={16} className={s.done ? "text-emerald-600" : "text-indigo-500"} />
            <span className={`flex-1 text-sm ${s.done ? "text-gray-500 line-through" : "font-medium"}`}>
              {s.label}
            </span>
            {!s.done && <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Aller →</span>}
          </Link>
        ))}
      </div>
    </div>
  )
}
