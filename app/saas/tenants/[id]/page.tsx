"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabaseMasterClient as sb } from "@/lib/supabaseMasterClient"
import {
  ArrowLeft, ExternalLink, Loader2, CheckCircle2, AlertCircle, Clock,
  RefreshCw, Trash2, Mail, Globe, Hash, Calendar, Package, Boxes,
  Settings, Save, Plus, X as XIcon, Code, Smartphone, CircleDollarSign,
} from "lucide-react"
import { ADDONS, PLANS, formatFcfa, getSignupTotalFcfa, type AddonId, type BillingCycle, type PlanId } from "@/lib/plans"

type Tenant = {
  id:                   string
  slug:                 string
  nom:                  string
  email_admin:          string
  supabase_project_ref: string
  supabase_url:         string
  plan:                 string | null
  statut:               string
  provisioning_status:  string
  provisioning_error:   string | null
  module_yango:         boolean
  module_wave:          boolean
  module_ai_insights:   boolean
  logo_url:             string | null
  feature_flags:        Record<string, boolean>
  config:               Record<string, unknown>
  custom_domain:        string | null
  notes:                string | null
  created_at:           string
  updated_at:           string

  // Champs signup (cf. migration 0004)
  signup_plan_id:       string | null
  signup_billing_cycle: "monthly" | "yearly" | null
  signup_data:          {
    phone?:           string
    country?:         string
    expected_vehicles?: number | null
    addons?:          string[]
    wave_claim?: {
      transaction_ref: string
      payer_phone:     string | null
      session_id:      string | null
      claimed_at:      string
    }
  } | null
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
  const [acting, setActing]     = useState<"retry" | "delete" | "confirm-payment" | null>(null)

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

  const onConfirmPayment = async () => {
    if (!tenant) return
    if (!confirm(
      `Confirmer le paiement Wave et activer le compte de "${tenant.nom}" ?\n\n` +
      `Cela va créer la subscription, activer les addons cochés, créer le projet Supabase et envoyer l'email de bienvenue.`
    )) return
    setActing("confirm-payment")
    const { data: sess } = await sb.auth.getSession()
    if (!sess.session) { setActing(null); return }
    const res = await fetch(`/api/signup/${id}/confirm-payment`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sess.session.access_token}` },
    })
    const j = await res.json()
    setActing(null)
    if (!res.ok) { alert(j.error || "Erreur"); return }
    alert("✓ Paiement confirmé. Provisioning lancé — la page va se rafraîchir.")
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

      {/* Paiement Wave en attente de validation */}
      {tenant.provisioning_status === "awaiting_payment" && (
        <WavePendingCard tenant={tenant} acting={acting} onConfirm={onConfirmPayment} />
      )}

      {/* Infos */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Informations</h2>
          <Row icon={Mail}     label="Email admin" value={tenant.email_admin} />
          <Row icon={Hash}     label="Slug"        value={tenant.slug}        mono />
          <Row icon={Package}  label="Plan"        value={(tenant.signup_plan_id || tenant.plan || "—").toUpperCase()} />
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

      {/* Configuration éditable */}
      <ConfigEditor tenant={tenant} onSaved={load} />

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

/**
 * Éditeur de la configuration spécifique à ce tenant.
 * Modules natifs (Yango, Wave, AI), feature_flags custom, config JSON,
 * domaine custom, notes admin. Tous patchés via PATCH /api/saas/tenants/[id].
 */
function ConfigEditor({ tenant, onSaved }: { tenant: Tenant; onSaved: () => void }) {
  const [moduleYango, setModuleYango] = useState(tenant.module_yango)
  const [moduleWave, setModuleWave]   = useState(tenant.module_wave)
  const [moduleAi, setModuleAi]       = useState(tenant.module_ai_insights)
  const [flags, setFlags]             = useState<Record<string, boolean>>(tenant.feature_flags || {})
  const [configText, setConfigText]   = useState(JSON.stringify(tenant.config || {}, null, 2))
  const [customDomain, setCustomDomain] = useState(tenant.custom_domain || "")
  const [notes, setNotes]             = useState(tenant.notes || "")
  const [newFlagName, setNewFlagName] = useState("")
  const [saving, setSaving]           = useState(false)
  const [err, setErr]                 = useState<string | null>(null)
  const [ok, setOk]                   = useState(false)

  // Reset si le tenant change (auto-refresh)
  useEffect(() => {
    setModuleYango(tenant.module_yango)
    setModuleWave(tenant.module_wave)
    setModuleAi(tenant.module_ai_insights)
    setFlags(tenant.feature_flags || {})
    setConfigText(JSON.stringify(tenant.config || {}, null, 2))
    setCustomDomain(tenant.custom_domain || "")
    setNotes(tenant.notes || "")
  }, [tenant.id])

  const save = async () => {
    setErr(null); setOk(false); setSaving(true)
    let parsedConfig: Record<string, unknown>
    try {
      parsedConfig = JSON.parse(configText || "{}")
      if (typeof parsedConfig !== "object" || Array.isArray(parsedConfig)) throw new Error("Config doit être un objet JSON")
    } catch (e) {
      setErr(`JSON invalide: ${(e as Error).message}`)
      setSaving(false)
      return
    }
    const { data: sess } = await sb.auth.getSession()
    if (!sess.session) { setErr("Session expirée"); setSaving(false); return }
    const res = await fetch(`/api/saas/tenants/${tenant.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sess.session.access_token}` },
      body:    JSON.stringify({
        module_yango:       moduleYango,
        module_wave:        moduleWave,
        module_ai_insights: moduleAi,
        feature_flags:      flags,
        config:             parsedConfig,
        custom_domain:      customDomain.trim() || null,
        notes:              notes.trim() || null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr(j.error || "Erreur sauvegarde")
      return
    }
    setOk(true)
    setTimeout(() => setOk(false), 2500)
    onSaved()
  }

  const addFlag = () => {
    const name = newFlagName.trim().replace(/[^a-z0-9_]/gi, "_").toLowerCase()
    if (!name) return
    setFlags({ ...flags, [name]: true })
    setNewFlagName("")
  }
  const removeFlag = (k: string) => {
    const next = { ...flags }
    delete next[k]
    setFlags(next)
  }

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
          <Settings size={12} />Configuration & Modules
        </h2>
        <div className="flex items-center gap-2">
          {ok && <span className="text-xs text-emerald-500">✓ Sauvegardé</span>}
          {err && <span className="text-xs text-red-500 max-w-xs truncate" title={err}>{err}</span>}
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}Sauvegarder
          </button>
        </div>
      </div>

      {/* Modules natifs */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Modules natifs</p>
        <div className="grid grid-cols-3 gap-2">
          <ConfigToggle label="Yango"        value={moduleYango} onChange={setModuleYango} />
          <ConfigToggle label="Wave"         value={moduleWave}  onChange={setModuleWave} />
          <ConfigToggle label="AI Insights"  value={moduleAi}    onChange={setModuleAi} />
        </div>
      </div>

      {/* Feature flags custom */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Feature flags custom</p>
        <p className="text-[10px] text-gray-400 mb-2">Toggles pour activer du code spécifique à ce client. Lus côté app via <code className="font-mono bg-gray-100 dark:bg-white/5 px-1 rounded">tenant.feature_flags.X</code></p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {Object.entries(flags).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1">
              <ConfigToggle label={k} value={v} onChange={(nv) => setFlags({ ...flags, [k]: nv })} />
              <button type="button" onClick={() => removeFlag(k)}
                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-red-400 shrink-0" title="Supprimer">
                <XIcon size={12} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input value={newFlagName} onChange={e => setNewFlagName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFlag() } }}
            placeholder="nouveau_flag" className={`${inputCls} font-mono text-xs`} />
          <button type="button" onClick={addFlag}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-medium shrink-0">
            <Plus size={12} />Ajouter
          </button>
        </div>
      </div>

      {/* Config JSON */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
          <Code size={11} />Config (JSON)
        </p>
        <p className="text-[10px] text-gray-400 mb-2">Valeurs arbitraires. Ex: <code className="font-mono bg-gray-100 dark:bg-white/5 px-1 rounded">{`{"theme_color": "#FF4500", "seuil_alerte": 80}`}</code></p>
        <textarea value={configText} onChange={e => setConfigText(e.target.value)}
          rows={5} spellCheck={false}
          className={`${inputCls} font-mono text-xs leading-relaxed`} />
      </div>

      {/* Custom domain */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
          <Globe size={11} />Domaine custom
        </p>
        <p className="text-[10px] text-gray-400 mb-2">Ex: <code className="font-mono">flotte.acme.ci</code> — à ajouter aussi côté Vercel (Settings → Domains).</p>
        <input value={customDomain} onChange={e => setCustomDomain(e.target.value)}
          placeholder="(aucun)" className={`${inputCls} font-mono text-xs`} />
      </div>

      {/* Notes admin */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Notes internes (non visibles côté client)</p>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="Spécificités du client, accords commerciaux, dates clés…"
          className={inputCls} />
      </div>
    </div>
  )
}

const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-[#1E2D45] bg-white dark:bg-[#080F1E] focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 outline-none"

function WavePendingCard({ tenant, acting, onConfirm }: {
  tenant:    Tenant
  acting:    "retry" | "delete" | "confirm-payment" | null
  onConfirm: () => void
}) {
  // Lecture défensive : signup_data peut être null, ou un objet partiel,
  // ou même contenir des champs inattendus selon les versions de tenant.
  const sd = (tenant.signup_data ?? {}) as NonNullable<Tenant["signup_data"]>
  const claim = sd.wave_claim
  const planId = (tenant.signup_plan_id || null) as PlanId | null
  const cycle  = (tenant.signup_billing_cycle || "monthly") as BillingCycle

  const rawAddons = sd.addons
  const addons: AddonId[] = Array.isArray(rawAddons)
    ? rawAddons.filter((id): id is AddonId => typeof id === "string" && !!ADDONS[id as AddonId])
    : []

  const totals = getSignupTotalFcfa(planId, cycle, addons)
  const expectedAmount = totals.cycleTotal
  const planName = planId && PLANS[planId] ? PLANS[planId].name : (planId || "—")

  return (
    <div className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-500/10 dark:to-transparent border border-amber-300 dark:border-amber-500/30 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300">
            <CircleDollarSign size={20} />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">
              {claim ? "Paiement Wave déclaré — à vérifier" : "En attente de paiement"}
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {claim
                ? "Le client a déclaré son paiement. Vérifiez sur Wave Business avant d'activer."
                : "Le client n'a pas encore payé. Le compte sera activé après confirmation du paiement."}
            </p>
          </div>
        </div>

        {claim && (
          <button
            onClick={onConfirm}
            disabled={!!acting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 shrink-0"
          >
            {acting === "confirm-payment" ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Confirmer & activer
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-amber-200/50 dark:border-amber-500/20 p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">Récap commande</p>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <dt className="text-gray-500">Plan</dt>
              <dd className="font-medium">{planName} ({cycle === "yearly" ? "annuel" : "mensuel"})</dd>
            </div>
            {addons.map(id => (
              <div key={id} className="flex justify-between">
                <dt className="text-gray-500">+ {ADDONS[id].name}</dt>
                <dd>+{formatFcfa(ADDONS[id].priceMonthlyFcfa ?? 0)} / mois</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-amber-200/50 dark:border-amber-500/20 pt-1.5 mt-1.5 font-bold">
              <dt>Montant attendu</dt>
              <dd className="text-emerald-700 dark:text-emerald-400">{formatFcfa(expectedAmount)}</dd>
            </div>
          </dl>
        </div>

        {claim ? (
          <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-amber-200/50 dark:border-amber-500/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">Déclaration client</p>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-gray-500 inline-flex items-center gap-1"><Smartphone size={11} /> N° transaction</dt>
                <dd className="font-mono font-medium">{claim.transaction_ref}</dd>
              </div>
              {claim.payer_phone && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Tél. payeur</dt>
                  <dd>{claim.payer_phone}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Déclaré le</dt>
                <dd>{new Date(claim.claimed_at).toLocaleString("fr-FR")}</dd>
              </div>
            </dl>
            <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-2 leading-snug">
              ℹ️ Vérifie la transaction <strong>{claim.transaction_ref}</strong> dans Wave Business avant de confirmer. Le compte sera créé automatiquement.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-white/[0.02] rounded-xl border border-amber-200/50 dark:border-amber-500/20 p-3 flex items-center justify-center text-xs text-gray-400">
            Aucune déclaration de paiement reçue à ce jour.
          </div>
        )}
      </div>
    </div>
  )
}

function ConfigToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
        value ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
              : "bg-gray-50 dark:bg-[#080F1E] text-gray-400"
      }`}>
      <span className="truncate">{label}</span>
      <span className={`w-7 h-4 rounded-full p-0.5 transition shrink-0 ${value ? "bg-indigo-500" : "bg-gray-300 dark:bg-gray-700"}`}>
        <span className={`block w-3 h-3 rounded-full bg-white transition transform ${value ? "translate-x-3" : ""}`} />
      </span>
    </button>
  )
}
