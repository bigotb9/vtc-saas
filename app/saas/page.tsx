"use client"

import { useEffect, useState } from "react"
import { supabaseMasterClient as sb } from "@/lib/supabaseMasterClient"
import { Building2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import Link from "next/link"

type Stats = {
  total:      number
  active:     number
  pending:    number
  failed:     number
}

export default function SaasDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    sb.from("tenants").select("provisioning_status, statut")
      .then(({ data }) => {
        const s: Stats = { total: 0, active: 0, pending: 0, failed: 0 }
        for (const t of data || []) {
          s.total++
          if (t.statut === "active" && t.provisioning_status === "ready") s.active++
          else if (t.provisioning_status === "failed")                     s.failed++
          else if (t.provisioning_status !== "ready")                      s.pending++
        }
        setStats(s)
      })
  }, [])

  const cards = [
    { label: "Clients total",         value: stats?.total   ?? 0, icon: Building2,    grad: "from-indigo-500 to-violet-600" },
    { label: "Actifs",                value: stats?.active  ?? 0, icon: CheckCircle2, grad: "from-emerald-500 to-teal-600" },
    { label: "Provisioning en cours", value: stats?.pending ?? 0, icon: Loader2,      grad: "from-sky-500 to-cyan-600" },
    { label: "Échecs",                value: stats?.failed  ?? 0, icon: AlertCircle,  grad: "from-red-500 to-rose-600" },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Tour de contrôle</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Vue d&apos;ensemble des clients et de leur état</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon
          return (
            <div key={c.label}
              className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-4 overflow-hidden">
              <div className={`absolute -top-5 -right-5 w-20 h-20 rounded-full bg-gradient-to-br ${c.grad} opacity-10 blur-2xl`} />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{c.label}</p>
                  <p className="text-3xl font-black font-numeric mt-1 text-gray-900 dark:text-white">
                    {stats === null ? "—" : c.value}
                  </p>
                </div>
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${c.grad} flex items-center justify-center shadow-md`}>
                  <Icon size={15} className="text-white" />
                </div>
              </div>
              {i === 0 && stats?.total === 0 && (
                <Link href="/saas/tenants/new" className="block mt-3 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline">
                  → Créer ton premier client
                </Link>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5">
        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Onboarder un nouveau client</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Le provisioning crée automatiquement un projet Supabase pour le client (~2 min), exécute le schéma initial,
          crée son compte admin et l&apos;ajoute à la liste des tenants.
        </p>
        <Link href="/saas/tenants/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-500/20">
          + Nouveau client
        </Link>
      </div>
    </div>
  )
}
