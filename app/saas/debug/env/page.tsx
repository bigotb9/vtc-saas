"use client"

import { useEffect, useState } from "react"
import { supabaseMasterClient as sb } from "@/lib/supabaseMasterClient"
import { CheckCircle2, AlertCircle, Loader2, Server, ArrowLeft } from "lucide-react"
import Link from "next/link"

type Var = {
  key:         string
  description: string
  criticalFor: string | null
  present:     boolean
  length:      number
  preview:     string | null
}

type DebugResp = {
  runtime: {
    node_env:      string
    vercel_env:    string | null
    vercel_url:    string | null
    vercel_region: string | null
  }
  summary: { total: number; present: number; missing: string[] }
  vars:    Var[]
}

export default function DebugEnvPage() {
  const [data, setData] = useState<DebugResp | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: sess } = await sb.auth.getSession()
      if (!sess.session) { setError("Non authentifié"); return }
      const res = await fetch("/api/saas/debug/env", {
        headers: { Authorization: `Bearer ${sess.session.access_token}` },
      })
      if (!res.ok) { setError(`HTTP ${res.status}`); return }
      setData(await res.json())
    }
    load()
  }, [])

  if (error) return <div className="text-red-500 p-6">Erreur : {error}</div>
  if (!data) return <div className="p-6"><Loader2 className="animate-spin text-indigo-500" /></div>

  return (
    <div className="max-w-5xl space-y-5">
      <Link href="/saas" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-500">
        <ArrowLeft size={14} />Retour
      </Link>

      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Diagnostic env vars</h1>
        <p className="text-sm text-gray-500 mt-1">État des variables d&apos;environnement actives au runtime Vercel.</p>
      </div>

      {/* Runtime */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">NODE_ENV</div>
          <div className="font-mono">{data.runtime.node_env}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">VERCEL_ENV</div>
          <div className="font-mono">{data.runtime.vercel_env || "—"}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">REGION</div>
          <div className="font-mono">{data.runtime.vercel_region || "—"}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">URL</div>
          <div className="font-mono text-xs truncate" title={data.runtime.vercel_url || ""}>{data.runtime.vercel_url || "—"}</div>
        </div>
      </div>

      {/* Summary */}
      <div className={`rounded-2xl border p-4 flex items-center gap-3 text-sm ${
        data.summary.missing.length === 0
          ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30"
          : "border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30"
      }`}>
        {data.summary.missing.length === 0
          ? <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          : <AlertCircle  size={20} className="text-amber-600  dark:text-amber-400  shrink-0" />
        }
        <div>
          <strong>{data.summary.present}</strong> / {data.summary.total} env vars présentes.
          {data.summary.missing.length > 0 && (
            <> Manquantes : <span className="font-mono text-xs">{data.summary.missing.join(", ")}</span></>
          )}
        </div>
      </div>

      {/* Vars table */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/[0.03] text-[10px] uppercase tracking-wider text-gray-400">
            <tr>
              <th className="text-left px-4 py-2.5 font-bold">Clé</th>
              <th className="text-left px-4 py-2.5 font-bold">Description</th>
              <th className="text-center px-4 py-2.5 font-bold">État</th>
              <th className="text-left px-4 py-2.5 font-bold">Preview</th>
              <th className="text-right px-4 py-2.5 font-bold">Len</th>
            </tr>
          </thead>
          <tbody>
            {data.vars.map(v => (
              <tr key={v.key} className="border-t border-gray-100 dark:border-[#1A2235]">
                <td className="px-4 py-2 font-mono text-xs font-bold">
                  {v.key}
                  {v.criticalFor && <span className="ml-2 inline-block text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-sans uppercase tracking-wider">{v.criticalFor}</span>}
                </td>
                <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">{v.description}</td>
                <td className="px-4 py-2 text-center">
                  {v.present
                    ? <CheckCircle2 size={14} className="inline text-emerald-500" />
                    : <AlertCircle  size={14} className="inline text-red-500" />
                  }
                </td>
                <td className="px-4 py-2 font-mono text-[11px] text-gray-700 dark:text-gray-300 break-all">
                  {v.preview || "—"}
                </td>
                <td className="px-4 py-2 text-right text-xs text-gray-400">{v.length || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-400 flex items-center gap-1">
        <Server size={12} />Les valeurs sensibles sont masquées (4 premiers + 4 derniers caractères).
      </div>
    </div>
  )
}
