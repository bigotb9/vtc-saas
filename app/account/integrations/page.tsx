"use client"

import { useEffect, useState } from "react"
import { Loader2, CheckCircle2, AlertTriangle, Save, Eye, EyeOff, Smartphone, Truck } from "lucide-react"
import { authFetch } from "@/lib/authFetch"

/**
 * Page de configuration des intégrations tierces du tenant.
 *
 * Yango Business :
 *   Le client doit fournir ses 3 credentials API Yango afin d'activer
 *   le dashboard courses, le classement chauffeurs, etc.
 *   Il obtient ces credentials depuis le portail Yango Business Partner.
 *
 * Wave Business :
 *   Deux modes :
 *   - Lien marchand (mode simple) : juste l'URL https://pay.wave.com/m/...
 *   - API complète : api_key + webhook_secret (pour les rapports détaillés)
 */

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
  wave: { mode: string; merchant_link?: string | null; api_key?: string | null; webhook_secret?: string | null; configured: boolean; configured_at?: string } | null
}

export default function IntegrationsPage() {
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
  if (error) return <div className="text-red-500 text-sm">{error}</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Intégrations API</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Connectez vos outils tiers pour activer les fonctionnalités avancées.
          Vos clés API sont chiffrées et stockées de façon sécurisée.
        </p>
      </div>

      <YangoForm current={integ?.yango ?? null} onSaved={refresh} />
      <WaveForm  current={integ?.wave  ?? null} onSaved={refresh} />
    </div>
  )
}


// ─── Yango ───

function YangoForm({ current, onSaved }: {
  current: Integrations["yango"]
  onSaved: () => void
}) {
  const [parkId,         setParkId]         = useState(current?.park_id   || "")
  const [clientId,       setClientId]       = useState(current?.client_id || "")
  const [keyDrivers,     setKeyDrivers]     = useState("")
  const [keyCars,        setKeyCars]        = useState("")
  const [keyOrders,      setKeyOrders]      = useState("")
  const [showDrivers,    setShowDrivers]    = useState(false)
  const [showCars,       setShowCars]       = useState(false)
  const [showOrders,     setShowOrders]     = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [msg,            setMsg]            = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setMsg(null)
    try {
      const body: Record<string, string> = { type: "yango", park_id: parkId, client_id: clientId }
      if (keyDrivers) body.api_key_drivers = keyDrivers
      if (keyCars)    body.api_key_cars    = keyCars
      if (keyOrders)  body.api_key_orders  = keyOrders
      const r = await authFetch("/api/account/integrations", {
        method: "POST",
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setMsg({ ok: true, text: "Intégration Yango sauvegardée !" })
      setKeyDrivers(""); setKeyCars(""); setKeyOrders("")
      onSaved()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      icon={Truck}
      title="Partenariat Yango Business"
      configured={!!current?.configured}
      configuredAt={current?.configured_at}
      description="Activez le dashboard courses, le classement chauffeurs et la synchronisation des commandes Yango."
    >
      <InfoBox>
        <p className="font-semibold mb-2">Où trouver ces identifiants ?</p>
        <p>Connectez-vous sur votre portail <strong>Yango Business Partner</strong> puis allez dans :</p>
        <ul className="mt-1.5 space-y-1 list-disc list-inside text-[11px]">
          <li><strong>Park ID</strong> : section <em>Mon parc → Identifiant du parc</em></li>
          <li><strong>Client ID</strong> : section <em>Paramètres → Intégrations → X-Client-ID</em></li>
          <li><strong>Clé API</strong> : section <em>Paramètres → API → Générer une clé</em><br/>
            <span className="text-[10px] ml-4">Une seule clé couvre les endpoints Chauffeurs, Véhicules et Commandes.</span></li>
        </ul>
        <p className="mt-1.5 text-[11px]">Besoin d&apos;aide ? Contactez votre gestionnaire de compte Yango ou écrivez-nous.</p>
      </InfoBox>

      <form onSubmit={save} className="space-y-3 mt-4">
        <Field label="Partner ID (park_id)" required>
          <input type="text" value={parkId} onChange={e => setParkId(e.target.value)}
            placeholder="Ex: park_CI_xxxxx" required
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
        </Field>
        <Field label="Client ID (X-Client-ID)" required>
          <input type="text" value={clientId} onChange={e => setClientId(e.target.value)}
            placeholder="Ex: ci_xxxxxx" required
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
        </Field>
        {[
          { label: "Clé API — Liste des prestataires (drivers)",  key: keyDrivers,  setKey: setKeyDrivers, show: showDrivers, setShow: setShowDrivers, prev: current?.api_key_drivers },
          { label: "Clé API — Liste des véhicules (cars)",        key: keyCars,     setKey: setKeyCars,    show: showCars,    setShow: setShowCars,    prev: current?.api_key_cars    },
          { label: "Clé API — Liste des commandes (orders)",      key: keyOrders,   setKey: setKeyOrders,  show: showOrders,  setShow: setShowOrders,  prev: current?.api_key_orders  },
        ].map(({ label, key, setKey, show, setShow, prev }) => (
          <Field key={label} label={`${label}${prev ? " — laisser vide pour conserver" : ""}`} required={!current?.configured && !prev}>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder={prev ? prev : "Votre clé API Yango"}
                required={!current?.configured && !prev}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 pr-10"
              />
              <button type="button" onClick={() => setShow((p: boolean) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>
        ))}
        <p className="text-[11px] text-gray-500">
          Chaque clé est chiffrée AES-256 avant stockage — jamais exposée en clair.
        </p>

        {msg && (
          <div className={`text-xs flex items-center gap-1 ${msg.ok ? "text-emerald-600" : "text-red-500"}`}>
            {msg.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
            {msg.text}
          </div>
        )}

        <button type="submit" disabled={saving || !parkId || !clientId}
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Sauvegarder les credentials Yango
        </button>
      </form>
    </Card>
  )
}


// ─── Wave ───

function WaveForm({ current, onSaved }: {
  current: Integrations["wave"]
  onSaved: () => void
}) {
  const [mode,           setMode]          = useState<"merchant" | "api">(current?.mode as "merchant" | "api" || "merchant")
  const [merchantLink,   setMerchantLink]  = useState(current?.merchant_link || "")
  const [apiKey,         setApiKey]        = useState("")
  const [webhookSecret,  setWebhookSecret] = useState("")
  const [showKey,        setShowKey]       = useState(false)
  const [saving,         setSaving]        = useState(false)
  const [msg,            setMsg]           = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setMsg(null)
    const payload: Record<string, string> = { type: "wave", mode }
    if (merchantLink) payload.merchant_link = merchantLink
    if (apiKey)       payload.api_key = apiKey
    if (webhookSecret) payload.webhook_secret = webhookSecret
    try {
      const r = await authFetch("/api/account/integrations", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setMsg({ ok: true, text: "Intégration Wave sauvegardée !" })
      setApiKey(""); setWebhookSecret("")
      onSaved()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      icon={Smartphone}
      title="Wave Business"
      configured={!!current?.configured}
      configuredAt={current?.configured_at}
      description="Activez l'import automatique des recettes Wave et les paiements clients."
    >
      <InfoBox>
        Deux modes disponibles selon votre accès Wave Business :
        <ul className="mt-1 space-y-1 text-[11px]">
          <li><strong>Lien marchand</strong> : copiez votre lien Wave depuis <em>Wave Business → Recevoir</em>.</li>
          <li><strong>API complète</strong> : contactez Wave Business pour activer l'accès API et obtenir vos clés.</li>
        </ul>
      </InfoBox>

      <form onSubmit={save} className="space-y-3 mt-4">
        <div className="flex gap-2">
          {(["merchant", "api"] as const).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                mode === m ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300"
              }`}>
              {m === "merchant" ? "Lien marchand" : "API complète"}
            </button>
          ))}
        </div>

        {mode === "merchant" && (
          <Field label="Lien de paiement Wave" required>
            <input type="url" value={merchantLink} onChange={e => setMerchantLink(e.target.value)}
              placeholder="https://pay.wave.com/m/..." required className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
          </Field>
        )}

        {mode === "api" && (
          <>
            <Field label={`Clé API Wave${current?.api_key ? " — laisser vide pour conserver" : ""}`} required={!current?.configured}>
              <div className="relative">
                <input type={showKey ? "text" : "password"} value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={current?.api_key || "Votre clé API Wave Business"}
                  required={!current?.configured && mode === "api"}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 pr-10" />
                <button type="button" onClick={() => setShowKey(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
            <Field label="Secret webhook Wave (optionnel)">
              <input type="password" value={webhookSecret}
                onChange={e => setWebhookSecret(e.target.value)}
                placeholder={current?.webhook_secret || "Pour valider la signature des webhooks"}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
              <p className="text-[11px] text-gray-500 mt-1">
                Configurez dans Wave Dashboard → Webhooks l'URL :
                <code className="ml-1 bg-gray-100 dark:bg-white/5 px-1 rounded text-[10px]">
                  https://vtcdashboard.com/api/webhooks/wave
                </code>
              </p>
            </Field>
          </>
        )}

        {msg && (
          <div className={`text-xs flex items-center gap-1 ${msg.ok ? "text-emerald-600" : "text-red-500"}`}>
            {msg.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
            {msg.text}
          </div>
        )}

        <button type="submit" disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Sauvegarder les credentials Wave
        </button>
      </form>
    </Card>
  )
}


// ─── Sub-components ───

function Card({ icon: Icon, title, configured, configuredAt, description, children }: {
  icon: React.ElementType
  title: string
  configured: boolean
  configuredAt?: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Icon size={18} />
          </div>
          <div>
            <div className="font-semibold flex items-center gap-2">
              {title}
              {configured && <CheckCircle2 size={14} className="text-emerald-500" />}
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 p-3 text-xs text-blue-800 dark:text-blue-200">
      {children}
    </div>
  )
}

