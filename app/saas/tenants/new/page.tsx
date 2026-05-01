"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabaseMasterClient as sb } from "@/lib/supabaseMasterClient"
import { ArrowLeft, Plus, Loader2, Info, Upload, X } from "lucide-react"

export default function NewTenantPage() {
  const router = useRouter()
  const [nom, setNom]               = useState("")
  const [slug, setSlug]             = useState("")
  const [emailAdmin, setEmailAdmin] = useState("")
  const [plan, setPlan]             = useState<"free" | "starter" | "pro">("free")
  const [region, setRegion]         = useState("eu-central-1")
  const [moduleYango, setModuleYango] = useState(true)
  const [moduleWave, setModuleWave]   = useState(true)
  const [moduleAi, setModuleAi]       = useState(true)
  const [logoFile, setLogoFile]       = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { setError("Logo > 5 Mo"); return }
    setError(null)
    setLogoFile(f)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { data: sess } = await sb.auth.getSession()
    if (!sess.session) { setError("Session expirée"); setSubmitting(false); return }
    const token = sess.session.access_token

    // 1. Crée le tenant (le provisioning du projet Supabase démarre)
    const res = await fetch("/api/saas/tenants", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body:    JSON.stringify({
        nom, slug, email_admin: emailAdmin, plan, region,
        module_yango: moduleYango, module_wave: moduleWave, module_ai_insights: moduleAi,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || "Erreur inconnue")
      setSubmitting(false)
      return
    }

    // 2. Upload logo si fourni (en parallèle du provisioning, peu importe l'ordre)
    if (logoFile && json.tenant?.id) {
      const fd = new FormData()
      fd.append("file", logoFile)
      const upRes = await fetch(`/api/saas/tenants/${json.tenant.id}/logo`, {
        method:  "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body:    fd,
      })
      if (!upRes.ok) {
        const e = await upRes.json().catch(() => ({}))
        console.warn("Upload logo a échoué :", e.error)
        // Non-bloquant — l'admin peut re-uploader depuis la page détail
      }
    }

    router.push("/saas/tenants")
  }

  // auto-générer slug depuis nom
  const onNomChange = (v: string) => {
    setNom(v)
    if (!slug || slug === slugify(nom)) setSlug(slugify(v))
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Link href="/saas/tenants" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-500">
        <ArrowLeft size={14} />Retour à la liste
      </Link>
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Nouveau client</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Crée un projet Supabase, joue les migrations et l&apos;ajoute au registre</p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3 flex gap-2 text-xs text-amber-800 dark:text-amber-300">
        <Info size={14} className="flex-shrink-0 mt-0.5" />
        <p>Le provisioning prend ~2 minutes. La page se rafraîchira automatiquement et le client apparaîtra avec l&apos;état &quot;Création&quot; puis &quot;Migration&quot; puis &quot;Prêt&quot;.</p>
      </div>

      <form onSubmit={submit} className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 space-y-4">
        <Field label="Nom de l'entreprise" hint="Ce qu'on affichera dans l'app du client">
          <input required value={nom} onChange={e => onNomChange(e.target.value)} placeholder="Acme Transports" className={inputCls} />
        </Field>

        <Field label="Slug" hint="Utilisé pour l'URL et le sous-domaine — minuscules, tirets uniquement">
          <input required value={slug} onChange={e => setSlug(slugify(e.target.value))} placeholder="acme-transports" className={`${inputCls} font-mono`} pattern="^[a-z0-9-]+$" />
        </Field>

        <Field label="Email admin du client" hint="Recevra un email d'invitation pour définir son mot de passe">
          <input required type="email" value={emailAdmin} onChange={e => setEmailAdmin(e.target.value)} placeholder="patron@acme.com" className={inputCls} />
        </Field>

        <Field label="Logo (optionnel)" hint="PNG / JPG / WebP / SVG, max 5 Mo. Affiché dans la sidebar et sur la page de login du client.">
          <div className="flex items-center gap-3">
            <label className="relative flex items-center justify-center w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 dark:border-[#1E2D45] bg-gray-50 dark:bg-[#080F1E] cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition overflow-hidden">
              {logoPreview ? (
                <img src={logoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <Upload size={18} className="text-gray-400" />
              )}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onLogoChange} className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
            {logoFile && (
              <div className="flex-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 truncate">
                <span className="truncate">{logoFile.name} · {(logoFile.size / 1024).toFixed(0)} Ko</span>
                <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null) }}
                  className="ml-2 p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500">
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Plan">
            <select value={plan} onChange={e => setPlan(e.target.value as "free" | "starter" | "pro")} className={inputCls}>
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
            </select>
          </Field>
          <Field label="Région Supabase">
            <select value={region} onChange={e => setRegion(e.target.value)} className={inputCls}>
              <option value="eu-central-1">Frankfurt (eu-central-1)</option>
              <option value="eu-west-2">London (eu-west-2)</option>
              <option value="us-east-1">N. Virginia (us-east-1)</option>
              <option value="us-west-1">N. California (us-west-1)</option>
              <option value="ap-southeast-1">Singapore (ap-southeast-1)</option>
            </select>
          </Field>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Modules activés</p>
          <div className="space-y-2">
            <Toggle label="Yango (intégration flotte)"   value={moduleYango} onChange={setModuleYango} />
            <Toggle label="Wave (recettes paiement)"      value={moduleWave}  onChange={setModuleWave}  />
            <Toggle label="AI Insights"                   value={moduleAi}    onChange={setModuleAi}    />
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold shadow-md shadow-indigo-500/20 transition">
            {submitting ? <><Loader2 size={14} className="animate-spin" />Provisioning…</> : <><Plus size={14} />Créer le client</>}
          </button>
          <Link href="/saas/tenants"
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#1E2D45] text-sm font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 transition">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  )
}

const inputCls = "w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-[#1E2D45] bg-white dark:bg-[#080F1E] focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 outline-none"

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      {hint && <p className="text-[10px] text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition ${
        value ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "bg-gray-50 dark:bg-[#080F1E] text-gray-400"
      }`}>
      <span>{label}</span>
      <span className={`w-9 h-5 rounded-full p-0.5 transition ${value ? "bg-indigo-500" : "bg-gray-300 dark:bg-gray-700"}`}>
        <span className={`block w-4 h-4 rounded-full bg-white transition transform ${value ? "translate-x-4" : ""}`} />
      </span>
    </button>
  )
}

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
