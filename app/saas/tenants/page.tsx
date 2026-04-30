"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabaseMasterClient as sb } from "@/lib/supabaseMasterClient"
import { Plus, ExternalLink, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react"

type Tenant = {
  id:                   string
  slug:                 string
  nom:                  string
  email_admin:          string
  supabase_project_ref: string
  supabase_url:         string
  plan:                 string
  statut:               string
  provisioning_status:  string
  provisioning_error:   string | null
  created_at:           string
}

const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  ready:     { label: "Prêt",      cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", Icon: CheckCircle2 },
  pending:   { label: "En attente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",        Icon: Clock },
  creating:  { label: "Création",   cls: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",                 Icon: Loader2 },
  migrating: { label: "Migration",  cls: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",                 Icon: Loader2 },
  seeding:   { label: "Init data",  cls: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",                 Icon: Loader2 },
  failed:    { label: "Échec",      cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",                 Icon: AlertCircle },
}

export default function TenantsListPage() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null)

  const load = async () => {
    const { data: sess } = await sb.auth.getSession()
    if (!sess.session) return
    const res = await fetch("/api/saas/tenants", {
      headers: { Authorization: `Bearer ${sess.session.access_token}` },
    })
    if (!res.ok) { setTenants([]); return }
    const { tenants } = await res.json()
    setTenants(tenants || [])
  }
  useEffect(() => { load() }, [])

  // Polling : pour tout tenant non-ready/non-failed, appelle /sync toutes les 6s.
  // /sync vérifie l'état du projet Supabase et lance la migration si prêt.
  useEffect(() => {
    if (!tenants) return
    const inProgress = tenants.filter(t => !["ready", "failed"].includes(t.provisioning_status))
    if (inProgress.length === 0) return

    const tick = async () => {
      const { data: sess } = await sb.auth.getSession()
      if (!sess.session) return
      await Promise.all(inProgress.map(t =>
        fetch(`/api/saas/tenants/${t.id}/sync`, {
          method: "POST",
          headers: { Authorization: `Bearer ${sess.session.access_token}` },
        }).catch(() => null)
      ))
      load()
    }
    const id = setInterval(tick, 6000)
    return () => clearInterval(id)
  }, [tenants])

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Clients</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tenants?.length ?? "…"} tenant(s) provisionné(s)</p>
        </div>
        <Link href="/saas/tenants/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-500/20">
          <Plus size={14} />Nouveau client
        </Link>
      </div>

      {tenants === null ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-indigo-500" /></div>
      ) : tenants.length === 0 ? (
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-dashed border-gray-200 dark:border-[#1E2D45] p-12 text-center">
          <p className="text-sm font-semibold text-gray-500">Aucun client pour le moment</p>
          <p className="text-xs text-gray-400 mt-1">Crée le premier en cliquant sur &quot;Nouveau client&quot;</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[#080F1E] border-b border-gray-100 dark:border-[#1E2D45]">
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Email admin</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">État</th>
                <th className="px-4 py-3">Projet</th>
                <th className="px-4 py-3">Créé</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => {
                const meta = STATUS_BADGE[t.provisioning_status] || STATUS_BADGE.pending
                const Icon = meta.Icon
                const animatedIcon = ["creating","migrating","seeding"].includes(t.provisioning_status)
                return (
                  <tr key={t.id} className="border-b border-gray-50 dark:border-[#1A2235] hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{t.nom}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.slug}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{t.email_admin}</td>
                    <td className="px-4 py-3"><span className="text-[10px] font-mono uppercase bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded">{t.plan}</span></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${meta.cls}`}>
                        <Icon size={10} className={animatedIcon ? "animate-spin" : ""} />{meta.label}
                      </span>
                      {t.provisioning_error && (
                        <p className="text-[10px] text-red-500 mt-1 max-w-[180px] truncate" title={t.provisioning_error}>{t.provisioning_error}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <a href={`https://supabase.com/dashboard/project/${t.supabase_project_ref}`}
                         target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 text-xs font-mono text-indigo-600 dark:text-indigo-400 hover:underline">
                        {t.supabase_project_ref.slice(0,12)}…<ExternalLink size={10} />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString("fr-FR")}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
