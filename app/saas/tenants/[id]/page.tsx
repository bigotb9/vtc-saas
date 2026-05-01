"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabaseMasterClient as sb } from "@/lib/supabaseMasterClient"
import {
  ArrowLeft, ExternalLink, Loader2, CheckCircle2, AlertCircle, Clock,
  RefreshCw, Trash2, Mail, Globe, Hash, Calendar, Package, Boxes,
} from "lucide-react"

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
  module_yango:         boolean
  module_wave:          boolean
  module_ai_insights:   boolean
  logo_url:             string | null
  created_at:           string
  updated_at:           string
}

type ProvisioningLog = {
  id:           number
  step:         string
  status:       string
  message:      string | null
  duration_ms:  number | null
  created_at:   string
}

const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  ready:     { label: "Prêt",       cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", Icon: CheckCircle2 },
  pending:   { label: "En attente",  cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",        Icon: Clock },
  creating:  { label: "Création",    cls: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",                 Icon: Loader2 },
  migrating: { label: "Migration",   cls: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",                 Icon: Loader2 },
  failed:    { label: "Échec",       cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",                 Icon: AlertCircle },
}

const LOG_STATUS_CLS: Record<string, string> = {
  started:  "text-sky-600 dark:text-sky-400",
  success:  "text-emerald-600 dark:text-emerald-400",
  failed:   "text-red-600 dark:text-red-400",
}

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [tenant, setTenant]     = useState<Tenant | null>(null)
  const [logs, setLogs]         = useState<ProvisioningLog[]>([])
  const [loading, setLoading]   = useState(true)
  const [acting, setActing]     = useState<"retry" | "delete" | null>(null)

  const load = async () => {
    const { data: sess } = await sb.auth.getSession()
    if (!sess.session) return
    const res = await fetch(`/api/saas/tenants/${id}`, {
      headers: { Authorization: `Bearer ${sess.session.access_token}` },
    })
    if (!res.ok) { setLoading(false); return }
    const { tenant, logs } = await res.json()
    setTenant(tenant)
    setLogs(logs)
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  // Auto-refresh si en cours
  useEffect(() => {
    if (!tenant) return
    if (["ready", "failed"].includes(tenant.provisioning_status)) return
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [tenant])

  const onRetry = async () => {
    if (!confirm("Relancer le provisioning ? Le schéma sera redéployé from scratch sur le projet.")) return
    setActing("retry")
    const { data: sess } = await sb.auth.getSession()
    if (!sess.session) { setActing(null); return }
    const res = await fetch(`/api/saas/tenants/${id}/retry`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sess.session.access_token}` },
    })
    const j = await res.json()
    if (!res.ok) alert(j.error || "Erreur")
    setActing(null)
    load()
  }

  const onDelete = async () => {
    if (!tenant) return
    const deleteProject = confirm(
      `⚠️ Supprimer le tenant "${tenant.nom}" ?\n\n` +
      `OK = supprimer aussi le projet Supabase (irréversible — données du client perdues).\n` +
      `Annuler ici puis confirmer le suivant = supprimer la ligne master uniquement (le projet Supabase reste actif).`,
    )
    if (!deleteProject) {
      const onlyMaster = confirm(`Confirmer suppression du tenant "${tenant.nom}" SANS supprimer le projet Supabase ?`)
      if (!onlyMaster) return
    }
    setActing("delete")
    const { data: sess } = await sb.auth.getSession()
    if (!sess.session) { setActing(null); return }
    const url = `/api/saas/tenants/${id}${deleteProject ? "?delete_project=true" : ""}`
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${sess.session.access_token}` },
    })
    const j = await res.json()
    if (!res.ok) {
      alert(j.error || "Erreur")
      setActing(null)
      return
    }
    if (deleteProject && j.project_deleted && !j.project_deleted.ok) {
      alert(`Tenant supprimé en master mais la suppression du projet Supabase a échoué : ${j.project_deleted.message}\n\nÀ supprimer manuellement sur dashboard.supabase.com`)
    }
    router.push("/saas/tenants")
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-indigo-500" /></div>
  if (!tenant) return <div className="text-center py-16 text-gray-500">Tenant introuvable</div>

  const meta = STATUS_BADGE[tenant.provisioning_status] || STATUS_BADGE.pending
  const StatusIcon = meta.Icon
  const animatedIcon = ["creating", "migrating"].includes(tenant.provisioning_status)

  return (
    <div className="max-w-5xl space-y-5">
      <Link href="/saas/tenants" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-500">
        <ArrowLeft size={14} />Retour
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 flex items-start gap-4">
        <label className="relative w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 dark:border-[#1E2D45] bg-gray-50 dark:bg-[#080F1E] cursor-pointer hover:border-indigo-400 transition overflow-hidden flex-shrink-0 flex items-center justify-center">
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.nom} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-black text-gray-300 dark:text-gray-700">{tenant.nom.charAt(0).toUpperCase()}</span>
          )}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              if (f.size > 5 * 1024 * 1024) { alert("Logo > 5 Mo"); return }
              const { data: sess } = await sb.auth.getSession()
              if (!sess.session) return
              const fd = new FormData()
              fd.append("file", f)
              const res = await fetch(`/api/saas/tenants/${tenant.id}/logo`, {
                method:  "POST",
                headers: { "Authorization": `Bearer ${sess.session.access_token}` },
                body:    fd,
              })
              if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || "Upload échoué"); return }
              load()
            }}
            className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">{tenant.nom}</h1>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${meta.cls}`}>
              <StatusIcon size={10} className={animatedIcon ? "animate-spin" : ""} />{meta.label}
            </span>
          </div>
          <p className="text-sm font-mono text-gray-500">{tenant.slug}</p>
          {tenant.provisioning_error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg p-2 break-all">
              {tenant.provisioning_error}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {tenant.provisioning_status === "failed" && (
            <button onClick={onRetry} disabled={!!acting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold disabled:opacity-50">
              {acting === "retry" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Retry
            </button>
          )}
          <button onClick={onDelete} disabled={!!acting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold disabled:opacity-50">
            {acting === "delete" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Supprimer
          </button>
        </div>
      </div>

      {/* Infos */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Informations</h2>
          <Row icon={Mail}     label="Email admin" value={tenant.email_admin} />
          <Row icon={Hash}     label="Slug"        value={tenant.slug}        mono />
          <Row icon={Package}  label="Plan"        value={tenant.plan.toUpperCase()} />
          <Row icon={Calendar} label="Créé"        value={new Date(tenant.created_at).toLocaleString("fr-FR")} />
          <Row icon={Calendar} label="MAJ"         value={new Date(tenant.updated_at).toLocaleString("fr-FR")} />
        </div>
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Projet Supabase</h2>
          <Row icon={Hash}  label="Ref" value={tenant.supabase_project_ref} mono />
          <Row icon={Globe} label="URL"
            value={
              <a href={tenant.supabase_url} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline break-all">
                {tenant.supabase_url}
              </a>
            }
          />
          <a href={`https://supabase.com/dashboard/project/${tenant.supabase_project_ref}`}
             target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1">
            Ouvrir dans Supabase Dashboard <ExternalLink size={10} />
          </a>
          <div className="pt-3 mt-3 border-t border-gray-100 dark:border-[#1A2235]">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Modules activés</h3>
            <div className="flex flex-wrap gap-2">
              <ModuleBadge label="Yango"    on={tenant.module_yango} />
              <ModuleBadge label="Wave"     on={tenant.module_wave} />
              <ModuleBadge label="AI"       on={tenant.module_ai_insights} />
            </div>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
            <Boxes size={12} />Logs de provisioning
          </h2>
          <button onClick={load} className="text-xs text-gray-500 hover:text-indigo-500">Actualiser</button>
        </div>
        {logs.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Aucun log</p>
        ) : (
          <div className="space-y-1.5 text-xs font-mono">
            {logs.map(l => (
              <div key={l.id} className="grid grid-cols-12 gap-2 py-1 border-b border-gray-50 dark:border-[#1A2235] last:border-0">
                <span className="col-span-2 text-gray-400">{new Date(l.created_at).toLocaleTimeString("fr-FR")}</span>
                <span className="col-span-3 text-gray-700 dark:text-gray-300 font-bold">{l.step}</span>
                <span className={`col-span-1 ${LOG_STATUS_CLS[l.status] || "text-gray-500"}`}>{l.status}</span>
                <span className="col-span-5 text-gray-500 dark:text-gray-400 truncate" title={l.message || ""}>{l.message || "—"}</span>
                <span className="col-span-1 text-right text-gray-400">{l.duration_ms ? `${l.duration_ms}ms` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ icon: Icon, label, value, mono }: { icon: typeof Hash; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon size={13} className="text-gray-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{label}</p>
        <div className={`text-gray-700 dark:text-gray-300 ${mono ? "font-mono text-xs" : ""} break-all`}>{value}</div>
      </div>
    </div>
  )
}

function ModuleBadge({ label, on }: { label: string; on: boolean }) {
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${on
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
      : "bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-600"
    }`}>{label}</span>
  )
}
