"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, CheckCircle2, AlertTriangle, Save, Eye, EyeOff, Smartphone, Truck, ArrowRight, Info } from "lucide-react"
import Link from "next/link"
import { authFetch } from "@/lib/authFetch"

type Integrations = {
  yango: {
    park_id:         string
    client_id:       string
    api_key_drivers: string | null
    api_key_cars:    string | null
    api_key_orders:  string | null
    configured:      boolean
    configured_at?:  string
  } | null
  wave: {
    mode:            string
    merchant_link?:  string | null
    api_key?:        string | null
    webhook_secret?: string | null
    configured:      boolean
    configured_at?:  string
  } | null
}

export default function IntegrationsPage() {
  const params = useSearchParams()
  const isOnboarding = params.get("onboarding") === "1"
  const [integ, setInteg] = useState<Integrations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const r = await authFetch("/api/account/integrations")
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setInteg(j.integrations)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  if (loading) return <Loader2 className="animate-spin text-indigo-500" />
  if (error)   return <div className="text-red-500 text-sm">{error}</div>

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Bandeau onboarding */}
      {isOnboarding && (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/5 p-5 flex items-start gap-3">
          <Info className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-1">
              Dernière étape — configurez vos intégrations
            </h3>
            <p className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed">
              Connectez Wave et/ou Yango pour automatiser l&apos;import des recettes et
              synchroniser vos courses. Vous pouvez aussi le faire plus tard depuis
              Mon compte → Intégrations.
            </p>
            <Link href="/dashboard"
              className="inline-flex items-center gap-2 mt-3 text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
              Passer et aller au dashboard <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-1">Intégrations API</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Connectez vos outils tiers. Vos clés sont chiffrées et ne sont jamais exposées.
        </p>
      </div>

      <WaveForm  current={integ?.wave  ?? null} onSaved={refresh} />
      <YangoForm current={integ?.yango ?? null} onSaved={refresh} />

      {isOnboarding && (
        <div className="text-center pt-4">
          <Link href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 text-sm">
            Accéder à mon tableau de bord <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </div>
  )
}


/* ─── Wave ─────────────────────────────────────────────────────── */
function WaveForm({ current, onSaved }: { current: Integrations["wave"]; onSaved: () => void }) {
  const [mode,          setMode]         = useState<"merchant"|"api">(current?.mode as "merchant"|"api" || "merchant")
  const [merchantLink,  setMerchantLink] = useState(current?.merchant_link || "")
  const [apiKey,        setApiKey]       = useState("")
  const [webhookSecret, setWH]           = useState("")
  const [showKey,       setShowKey]      = useState(false)
  const [saving,        setSaving]       = useState(false)
  const [msg,           setMsg]          = useState<{ok:boolean;text:string}|null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg(null)
    const payload: Record<string,string> = { type:"wave", mode }
    if (merchantLink) payload.merchant_link = merchantLink
    if (apiKey)       payload.api_key = apiKey
    if (webhookSecret) payload.webhook_secret = webhookSecret
    try {
      const r = await authFetch("/api/account/integrations",{method:"POST",body:JSON.stringify(payload)})
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setMsg({ok:true,text:"Intégration Wave sauvegardée !"})
      setApiKey(""); setWH(""); onSaved()
    } catch(e) { setMsg({ok:false,text:(e as Error).message}) }
    finally { setSaving(false) }
  }

  return (
    <Card icon={Smartphone} title="Wave Business" configured={!!current?.configured}
      configuredAt={current?.configured_at}
      description="Activez l'import automatique de vos recettes Wave.">

      <Guide color="blue" title="Où trouver vos informations Wave ?">
        <GuideLine label="Mode lien marchand (recommandé)">
          Sur <strong>Wave Business App</strong> → <em>Recevoir → Mon lien de paiement</em>.
          Copiez le lien de type <code>https://pay.wave.com/m/M_...</code>
        </GuideLine>
        <GuideLine label="Mode API complète (Wave Premium uniquement)">
          <em>Paramètres → API → Générer une clé.</em><br />
          Webhook Secret : <em>Paramètres → Webhooks → Créer</em>, URL à renseigner :<br />
          <code className="text-[10px]">https://vtcdashboard.com/api/webhooks/wave</code>
        </GuideLine>
      </Guide>

      <form onSubmit={save} className="space-y-3 mt-4">
        <div className="flex gap-2">
          {(["merchant","api"] as const).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`px-4 py-1.5 text-xs rounded-full font-medium transition ${mode===m?"bg-indigo-600 text-white":"bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300"}`}>
              {m==="merchant" ? "🔗 Lien marchand" : "⚡ API complète"}
            </button>
          ))}
        </div>

        {mode==="merchant" && (
          <Field label="Lien de paiement Wave" required hint="Format : https://pay.wave.com/m/M_xxxxx/c/ci/">
            <input type="url" required value={merchantLink} onChange={e=>setMerchantLink(e.target.value)}
              placeholder="https://pay.wave.com/m/M_xxxxx/c/ci/" className={inp} />
          </Field>
        )}
        {mode==="api" && (
          <>
            <Field label={`Clé API Wave${current?.api_key?" — laisser vide pour conserver":""}`} required={!current?.configured}>
              <div className="relative">
                <input type={showKey?"text":"password"} value={apiKey} onChange={e=>setApiKey(e.target.value)}
                  placeholder={current?.api_key||"Votre clé API Wave Business"} className={inp+" pr-10"} />
                <button type="button" onClick={()=>setShowKey(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showKey?<EyeOff size={14}/>:<Eye size={14}/>}
                </button>
              </div>
            </Field>
            <Field label="Secret Webhook Wave (optionnel)" hint="Copié depuis Wave Dashboard → Webhooks → votre webhook">
              <input type="password" value={webhookSecret} onChange={e=>setWH(e.target.value)}
                placeholder="Secret Webhook Wave Business" className={inp} />
            </Field>
          </>
        )}
        <FormFooter msg={msg} saving={saving} label="Sauvegarder Wave" />
      </form>
    </Card>
  )
}


/* ─── Yango ─────────────────────────────────────────────────────── */
function YangoForm({ current, onSaved }: { current: Integrations["yango"]; onSaved: () => void }) {
  const [parkId,     setParkId]     = useState(current?.park_id||"")
  const [clientId,   setClientId]   = useState(current?.client_id||"")
  const [keyDrivers, setKeyDrivers] = useState("")
  const [keyCars,    setKeyCars]    = useState("")
  const [keyOrders,  setKeyOrders]  = useState("")
  const [show,       setShow]       = useState({d:false,c:false,o:false})
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState<{ok:boolean;text:string}|null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg(null)
    const body: Record<string,string> = {type:"yango",park_id:parkId,client_id:clientId}
    if (keyDrivers) body.api_key_drivers = keyDrivers
    if (keyCars)    body.api_key_cars    = keyCars
    if (keyOrders)  body.api_key_orders  = keyOrders
    try {
      const r = await authFetch("/api/account/integrations",{method:"POST",body:JSON.stringify(body)})
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setMsg({ok:true,text:"Intégration Yango sauvegardée !"})
      setKeyDrivers(""); setKeyCars(""); setKeyOrders(""); onSaved()
    } catch(e) { setMsg({ok:false,text:(e as Error).message}) }
    finally { setSaving(false) }
  }

  return (
    <Card icon={Truck} title="Partenariat Yango Business" configured={!!current?.configured}
      configuredAt={current?.configured_at}
      description="Pour les sociétés partenaires Yango — dashboard courses, suivi performances, commissions.">

      <Guide color="amber" title="Où trouver vos credentials Yango Business ?">
        <GuideLine label="Portail Yango Business Partner">
          Connectez-vous sur votre espace Yango Partner (URL fournie par Yango à l&apos;inscription du partenariat).
        </GuideLine>
        <GuideLine label="Partner ID (park_id)">
          <em>Mon parc → Identifiant du parc</em> — format : <code>park_CI_xxxxx</code>
        </GuideLine>
        <GuideLine label="Client ID (X-Client-ID)">
          <em>Paramètres → Intégrations → X-Client-ID</em>
        </GuideLine>
        <GuideLine label="Clés API (3 clés distinctes)">
          <em>Paramètres → API → Générer</em> — créez une clé par endpoint :<br />
          Prestataires (couvre aussi les règles de travail) · Véhicules · Commandes
        </GuideLine>
      </Guide>

      <form onSubmit={save} className="space-y-3 mt-4">
        <Field label="Partner ID (park_id)" required hint="Identifiant unique de votre parc — format park_CI_xxxxx">
          <input type="text" required value={parkId} onChange={e=>setParkId(e.target.value)}
            placeholder="park_CI_12345" className={inp} />
        </Field>
        <Field label="Client ID (X-Client-ID)" required hint="Identifiant de votre application partenaire">
          <input type="text" required value={clientId} onChange={e=>setClientId(e.target.value)}
            placeholder="ci_abcdef" className={inp} />
        </Field>

        <div className="pt-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Clés API — laisser vide pour conserver les clés existantes
        </div>

        {([
          {label:"Clé API — Prestataires & règles de travail",val:keyDrivers,set:setKeyDrivers,vis:show.d,tgl:()=>setShow(s=>({...s,d:!s.d})),prev:current?.api_key_drivers},
          {label:"Clé API — Véhicules",                       val:keyCars,   set:setKeyCars,   vis:show.c,tgl:()=>setShow(s=>({...s,c:!s.c})),prev:current?.api_key_cars},
          {label:"Clé API — Commandes & courses",             val:keyOrders, set:setKeyOrders, vis:show.o,tgl:()=>setShow(s=>({...s,o:!s.o})),prev:current?.api_key_orders},
        ] as const).map(({label,val,set,vis,tgl,prev}) => (
          <Field key={label} label={label} required={!current?.configured && !prev}>
            <div className="relative">
              <input type={vis?"text":"password"} value={val} onChange={e=>set(e.target.value)}
                placeholder={prev||"Clé API Yango"} required={!current?.configured&&!prev}
                className={inp+" pr-10"} />
              <button type="button" onClick={tgl} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {vis?<EyeOff size={14}/>:<Eye size={14}/>}
              </button>
            </div>
          </Field>
        ))}

        <p className="text-[10px] text-gray-400">Chiffrées AES-256 — jamais exposées en clair.</p>
        <FormFooter msg={msg} saving={saving} label="Sauvegarder Yango" />
      </form>
    </Card>
  )
}


/* ─── Composants partagés ─────────────────────────────────────── */

function Card({ icon:Icon, title, configured, configuredAt, description, children }: {
  icon:React.ElementType; title:string; configured:boolean; configuredAt?:string
  description:string; children:React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Icon size={18} />
          </div>
          <div>
            <div className="font-semibold flex items-center gap-2">
              {title} {configured && <CheckCircle2 size={14} className="text-emerald-500" />}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
          </div>
        </div>
        {configured && configuredAt && (
          <span className="text-[10px] text-gray-400 shrink-0 hidden md:block">
            Configuré le {new Date(configuredAt).toLocaleDateString("fr-FR")}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function Guide({ color, title, children }: { color:"blue"|"amber"; title:string; children:React.ReactNode }) {
  const cls = color==="blue"
    ? "border-blue-100 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5 text-blue-900 dark:text-blue-200"
    : "border-amber-100 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 text-amber-900 dark:text-amber-200"
  const subCls = color==="blue" ? "text-blue-800 dark:text-blue-300" : "text-amber-800 dark:text-amber-300"
  return (
    <div className={`rounded-xl border p-4 mb-4 ${cls}`}>
      <div className={`font-semibold text-sm mb-2 flex items-center gap-2`}>
        <Info size={14} /> {title}
      </div>
      <div className={`text-xs space-y-2 ${subCls}`}>{children}</div>
    </div>
  )
}

function GuideLine({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div>
      <strong>{label} : </strong>
      {children}
    </div>
  )
}

function Field({ label, required, hint, children }: {
  label:string; required?:boolean; hint?:string; children:React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[10px] text-gray-400 mt-1">{hint}</span>}
    </label>
  )
}

function FormFooter({ msg, saving, label }: { msg:{ok:boolean;text:string}|null; saving:boolean; label:string }) {
  return (
    <>
      {msg && (
        <div className={`text-xs flex items-center gap-1 ${msg.ok?"text-emerald-600":"text-red-500"}`}>
          {msg.ok ? <CheckCircle2 size={13}/> : <AlertTriangle size={13}/>}
          {msg.text}
        </div>
      )}
      <button type="submit" disabled={saving}
        className="inline-flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2">
        {saving ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}
        {label}
      </button>
    </>
  )
}

const inp = "w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
