"use client"

import { useEffect, useState } from "react"
import { supabaseMasterClient as sb } from "@/lib/supabaseMasterClient"
import { Building2, CheckCircle2, AlertCircle, Loader2, Banknote, TrendingDown, Calendar, Wallet, Smartphone, ArrowRight } from "lucide-react"
import Link from "next/link"
import { formatFcfa } from "@/lib/plans"

type Stats = {
  total:      number
  active:     number
  pending:    number
  failed:     number
}

type PendingWaveValidation = {
  tenant_id:            string
  slug:                 string
  nom:                  string
  email_admin:          string
  plan_name:            string
  cycle:                "monthly" | "yearly"
  expected_amount_fcfa: number
  transaction_ref:      string
  payer_phone:          string | null
  claimed_at:           string
}

type Metrics = {
  mrr_fcfa:                  number
  arr_fcfa:                  number
  active_customers:          number
  customers_by_plan:         { silver: number; gold: number; platinum: number }
  customers_in_arrears:      number
  customers_suspended:       number
  customers_awaiting_payment: number
  churn_rate_30d:            number
  revenue_this_month_fcfa:   number
  revenue_last_month_fcfa:   number
  signups_this_month:        number
  pending_wave_validations:  PendingWaveValidation[]
}

export default function SaasDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: sess } = await sb.auth.getSession()
      if (!sess.session) return
      const headers = { Authorization: `Bearer ${sess.session.access_token}` }

      const [tenantsRes, metricsRes] = await Promise.all([
        fetch("/api/saas/tenants",  { headers }),
        fetch("/api/saas/metrics",  { headers }),
      ])

      if (tenantsRes.ok) {
        const { tenants } = await tenantsRes.json()
        const s: Stats = { total: 0, active: 0, pending: 0, failed: 0 }
        for (const t of tenants || []) {
          s.total++
          if (t.statut === "active" && t.provisioning_status === "ready") s.active++
          else if (t.provisioning_status === "failed")                     s.failed++
          else if (t.provisioning_status !== "ready")                      s.pending++
        }
        setStats(s)
      } else {
        setStats({ total: 0, active: 0, pending: 0, failed: 0 })
      }

      if (metricsRes.ok) {
        setMetrics(await metricsRes.json() as Metrics)
      }
    }
    load()
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

      {/* Paiements Wave à vérifier — priorité absolue, en haut du dashboard */}
      {metrics && metrics.pending_wave_validations.length > 0 && (
        <PendingWavePayments items={metrics.pending_wave_validations} />
      )}

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

      {/* KPIs business */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Business</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <BusinessCard label="MRR"             value={metrics ? formatFcfa(metrics.mrr_fcfa) : "—"}    icon={Banknote}  grad="from-emerald-500 to-teal-600" />
          <BusinessCard label="ARR (estimé)"    value={metrics ? formatFcfa(metrics.arr_fcfa) : "—"}    icon={TrendingDown} grad="from-amber-500 to-orange-600" />
          <BusinessCard label="Revenus du mois" value={metrics ? formatFcfa(metrics.revenue_this_month_fcfa) : "—"} icon={Wallet} grad="from-fuchsia-500 to-pink-600" />
          <BusinessCard label="Churn (30j)"     value={metrics ? `${metrics.churn_rate_30d}%` : "—"}    icon={TrendingDown} grad="from-red-500 to-rose-600" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <SubCard label="Silver"             value={metrics?.customers_by_plan.silver ?? "—"} />
          <SubCard label="Gold"               value={metrics?.customers_by_plan.gold   ?? "—"} />
          <SubCard label="Platinum"           value={metrics?.customers_by_plan.platinum ?? "—"} />
          <SubCard label="Inscrits ce mois"   value={metrics?.signups_this_month ?? "—"} icon={Calendar} />
        </div>

        {metrics && (metrics.customers_in_arrears > 0 || metrics.customers_suspended > 0) && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-3 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <strong>Attention :</strong> {metrics.customers_in_arrears} client{metrics.customers_in_arrears > 1 ? "s" : ""} en retard de paiement,
              {" "}{metrics.customers_suspended} suspendu{metrics.customers_suspended > 1 ? "s" : ""}.
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5">
        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Actions rapides</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/saas/tenants/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-500/20">
            + Nouveau client
          </Link>
          <a href="/api/saas/tenants/export"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 text-sm font-medium">
            Exporter CSV
          </a>
        </div>
      </div>
    </div>
  )
}


function BusinessCard({ label, value, icon: Icon, grad }: { label: string; value: string | number; icon: React.ElementType; grad: string }) {
  return (
    <div className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-4 overflow-hidden">
      <div className={`absolute -top-5 -right-5 w-20 h-20 rounded-full bg-gradient-to-br ${grad} opacity-10 blur-2xl`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center shadow-md`}>
          <Icon size={15} className="text-white" />
        </div>
      </div>
    </div>
  )
}

function SubCard({ label, value, icon: Icon }: { label: string; value: string | number; icon?: React.ElementType }) {
  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-xl border border-gray-100 dark:border-[#1E2D45] p-3 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold mt-0.5 text-gray-900 dark:text-white">{value}</p>
      </div>
      {Icon && <Icon size={14} className="text-gray-400" />}
    </div>
  )
}


function PendingWavePayments({ items }: { items: PendingWaveValidation[] }) {
  return (
    <div className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-500/10 dark:to-transparent border-2 border-amber-300 dark:border-amber-500/40 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
            <Smartphone size={20} />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-lg">
              {items.length} paiement{items.length > 1 ? "s" : ""} Wave à vérifier
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Vérifie chaque transaction sur Wave Business, puis active le compte du client.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-sm font-bold w-8 h-8 shadow-md">
          {items.length}
        </span>
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <Link
            key={item.tenant_id}
            href={`/saas/tenants/${item.tenant_id}`}
            className="block bg-white dark:bg-white/[0.02] rounded-xl border border-amber-200/60 dark:border-amber-500/20 hover:border-amber-400 dark:hover:border-amber-500/50 transition p-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{item.nom}</span>
                  <span className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 rounded">
                    {item.plan_name} {item.cycle === "yearly" ? "annuel" : "mensuel"}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-3 flex-wrap">
                  <span className="font-mono"><strong>Tx :</strong> {item.transaction_ref}</span>
                  {item.payer_phone && <span><strong>Tél :</strong> {item.payer_phone}</span>}
                  <span className="text-gray-400">{relativeTime(item.claimed_at)}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-emerald-700 dark:text-emerald-400">{formatFcfa(item.expected_amount_fcfa)}</div>
                <div className="text-xs text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1 mt-0.5">
                  Vérifier <ArrowRight size={12} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}


function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.round(ms / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.round(h / 24)
  return `il y a ${d} j`
}
