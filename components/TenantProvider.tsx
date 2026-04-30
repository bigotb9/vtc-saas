"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { Loader2, AlertTriangle } from "lucide-react"
import { setSupabaseClient } from "@/lib/supabaseClient"

export type TenantInfo = {
  nom:                string
  slug:               string
  supabase_url:       string
  supabase_anon_key:  string
  module_yango:       boolean
  module_wave:        boolean
  module_ai_insights: boolean
  plan:               string
}

type TenantState = {
  tenant: TenantInfo | null
  client: SupabaseClient | null
}

const TenantContext = createContext<TenantState>({ tenant: null, client: null })

/** Hook pour accéder au tenant courant et son client Supabase. */
export function useTenant() {
  return useContext(TenantContext)
}

/** Lit le cookie tenant_slug posé par le middleware. */
function readSlugFromCookie(): string | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(/(?:^|;\s*)tenant_slug=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

/**
 * Charge la config tenant depuis /api/public/tenant et la rend disponible
 * via useTenant(). En attendant, affiche un loader.
 *
 * Si pas de slug en cookie, redirige vers une page d'aide (à créer).
 */
export default function TenantProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TenantState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const slug = readSlugFromCookie()
    if (!slug) {
      setError("Aucun tenant détecté. Ajoute `?t=<slug>` à l'URL.")
      return
    }

    fetch(`/api/public/tenant?slug=${encodeURIComponent(slug)}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`)
        return r.json() as Promise<TenantInfo>
      })
      .then(tenant => {
        const client = createClient(tenant.supabase_url, tenant.supabase_anon_key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            // storageKey distinct par tenant pour éviter qu'un user d'un tenant A
            // hérite de la session d'un tenant B en cas de switch.
            storageKey: `sb-tenant-${tenant.slug}`,
          },
        })
        // Met à jour le singleton importé via `import { supabase } from '@/lib/supabaseClient'`
        setSupabaseClient(client)
        setState({ tenant, client })
      })
      .catch(e => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#080C14] px-4">
        <div className="max-w-md text-center space-y-3">
          <AlertTriangle className="mx-auto text-amber-500" size={36} />
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200">Tenant introuvable</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
          <p className="text-xs text-gray-400">
            Si tu es admin SaaS, va sur <a href="/saas/login" className="text-indigo-500 hover:underline">/saas/login</a>.
          </p>
        </div>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#080C14]">
        <Loader2 className="animate-spin text-indigo-500" size={28} />
      </div>
    )
  }

  return <TenantContext.Provider value={state}>{children}</TenantContext.Provider>
}
