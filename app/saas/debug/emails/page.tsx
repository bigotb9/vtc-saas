"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabaseMasterClient as sb } from "@/lib/supabaseMasterClient"
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2, Inbox, Skull, Cloud } from "lucide-react"

type Email = {
  id:                  string
  tenant_id:           string | null
  to_email:            string
  to_name:             string | null
  template:            string
  subject:             string
  status:              "pending" | "sent" | "failed" | "skipped"
  provider:            string | null
  provider_message_id: string | null
  error_message:       string | null
  dedup_key:           string | null
  sent_at:             string | null
  created_at:          string
}

type Resp = {
  emails:  Email[]
  summary: { total: number; sent: number; failed: number; skipped: number }
}

const STATUS_META: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  sent:    { label: "Envoyé",  cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",  Icon: CheckCircle2 },
  failed:  { label: "Échec",   cls: "text-red-600     dark:text-red-400     bg-red-50     dark:bg-red-500/10",      Icon: AlertCircle },
  skipped: { label: "Stub",    cls: "text-gray-500    dark:text-gray-400    bg-gray-100   dark:bg-white/5",          Icon: Skull },
  pending: { label: "Pending", cls: "text-amber-600   dark:text-amber-400   bg-amber-50   dark:bg-amber-500/10",     Icon: Loader2 },
}

export default function EmailLogPage() {
  const [data, setData] = useState<Resp | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    const { data: sess } = await sb.auth.getSession()
    if (!sess.session) { setError("Non authentifié"); return }
    const res = await fetch("/api/saas/debug/emails", {
      headers: { Authorization: `Bearer ${sess.session.access_token}` },
    })
    const j = await res.json()
    if (!res.ok) { setError(j.error || `HTTP ${res.status}`); return }
    setData(j)
  }
  useEffect(() => { load() }, [])

  if (error) return <div className="text-red-500 p-6">Erreur : {error}</div>
  if (!data) return <div className="p-6"><Loader2 className="animate-spin text-indigo-500" /></div>

  return (
    <div className="max-w-5xl space-y-5">
      <Link href="/saas" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-500">
        <ArrowLeft size={14} />Retour
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Email log</h1>
          <p className="text-sm text-gray-500 mt-1">30 derniers emails tentés via Resend.</p>
        </div>
        <button onClick={load} className="text-xs text-indigo-500 hover:underline">Actualiser</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard label="Total"    value={data.summary.total}    Icon={Inbox}        cls="text-gray-700 dark:text-gray-300" />
        <SummaryCard label="Envoyés"  value={data.summary.sent}     Icon={CheckCircle2} cls="text-emerald-600 dark:text-emerald-400" />
        <SummaryCard label="Échecs"   value={data.summary.failed}   Icon={AlertCircle}  cls="text-red-600 dark:text-red-400" />
        <SummaryCard label="Stub"     value={data.summary.skipped}  Icon={Cloud}        cls="text-gray-500 dark:text-gray-400" />
      </div>

      {data.emails.length === 0 && (
        <div className="rounded-2xl border border-gray-100 dark:border-[#1E2D45] bg-white dark:bg-[#0D1424] p-10 text-center text-sm text-gray-500">
          Aucun email envoyé pour le moment.
        </div>
      )}

      <div className="space-y-2">
        {data.emails.map(e => {
          const meta = STATUS_META[e.status] || STATUS_META.pending
          const Icon = meta.Icon
          return (
            <div key={e.id} className="bg-white dark:bg-[#0D1424] rounded-xl border border-gray-100 dark:border-[#1E2D45] p-4">
              <div className="flex items-start gap-3">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${meta.cls} shrink-0`}>
                  <Icon size={10} />{meta.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium truncate">{e.subject}</span>
                    <span className="text-xs text-gray-400 shrink-0">{new Date(e.created_at).toLocaleString("fr-FR")}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap gap-x-3">
                    <span><strong>To:</strong> {e.to_email}</span>
                    <span><strong>Template:</strong> {e.template}</span>
                    {e.provider && <span><strong>Provider:</strong> {e.provider}</span>}
                    {e.provider_message_id && <span title={e.provider_message_id}><strong>ID:</strong> {e.provider_message_id.slice(0, 18)}…</span>}
                  </div>
                  {e.error_message && (
                    <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded px-2 py-1 break-all">
                      {e.error_message}
                    </div>
                  )}
                  {e.dedup_key && (
                    <div className="mt-1 text-[10px] text-gray-400 font-mono">dedup_key: {e.dedup_key}</div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, Icon, cls }: { label: string; value: number; Icon: typeof CheckCircle2; cls: string }) {
  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-xl border border-gray-100 dark:border-[#1E2D45] p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{label}</span>
        <Icon size={12} className={cls} />
      </div>
      <div className={`text-2xl font-black ${cls}`}>{value}</div>
    </div>
  )
}
