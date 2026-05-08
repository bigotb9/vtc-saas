"use client"

import { useEffect, useState } from "react"
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Wrench,
  Clock, Banknote, Activity, RefreshCw, Loader2, Trophy, Sparkles, Download,
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts"
import { authFetch } from "@/lib/authFetch"
import { formatFcfa } from "@/lib/plans"
import { exportInsightsPdf } from "@/lib/exportPdf"
import { useLang } from "@/lib/i18n/context"
import posthog from "posthog-js"

type DriverInsight = {
  id:               string | number
  nom:              string
  ca_total:         number
  ca_30d:           number
  jours_actifs_30d: number
  jours_total:      number
  regularite_pct:   number
  trend_30d_pct:    number
  score:            number
  risk:             "ok" | "warn" | "critical"
  risk_reasons:     string[]
}

type VehicleMaintenance = {
  id:              string | number
  immatriculation: string
  marque:          string | null
  modele:          string | null
  last_entretien:  string | null
  next_entretien:  string | null
  days_until_next: number | null
  status:          "ok" | "soon" | "overdue" | "unknown"
}

type ExpenseCategory = {
  category:       string
  total_30d:      number
  total_60d:      number
  trend_pct:      number
  avg_per_month:  number
  is_recurring:   boolean
  occurrences_6m: number
}

type Report = {
  generated_at: string
  drivers: { top: DriverInsight[]; at_risk: DriverInsight[]; all_count: number }
  maintenance: { overdue: VehicleMaintenance[]; soon: VehicleMaintenance[]; all_count: number }
  expenses: { by_category: ExpenseCategory[]; total_30d: number; anomalies: ExpenseCategory[] }
  revenue: {
    ca_30d: number; ca_30d_prev: number; trend_pct: number
    jours_sans_recette: number; avg_daily: number; std_daily: number; cv_pct: number
    daily: { date: string; total: number }[]
  }
  cashflow: { next_7d_estimated: number; based_on_avg: number; confidence: "low"|"medium"|"high" }
}

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#f97316"]

export default function AiInsightsPage() {
  const [data, setData]       = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const { lang }              = useLang()

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await authFetch("/api/ai-insights")
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setData(j)
      posthog.capture("ai_insights_viewed")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  if (loading && !data) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="animate-spin text-indigo-500" size={28} />
    </div>
  )
  if (error) return (
    <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300 max-w-2xl">
      <AlertTriangle size={16} className="inline mr-2" /> {error}
    </div>
  )
  if (!data) return null

  const handleExportPdf = () => exportInsightsPdf({
    score:          0,
    generatedAt:    data.generated_at,
    resumeExecutif: `CA 30j : ${formatFcfa(data.revenue.ca_30d)} | Tendance : ${data.revenue.trend_pct > 0 ? "+" : ""}${data.revenue.trend_pct}%`,
    caTotal:        data.revenue.ca_30d,
    depensesTotal:  data.expenses.total_30d,
  })

  const confidenceLabel = data.cashflow.confidence === "high"
    ? (lang === "en" ? "high" : "élevée")
    : data.cashflow.confidence === "medium"
      ? (lang === "en" ? "medium" : "moyenne")
      : (lang === "en" ? "low" : "faible")

  return (
    <div className="space-y-6 max-w-6xl">

      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Brain className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">AI Insights</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {lang === "en" ? "Automatic fleet analysis · " : "Analyse automatique de votre flotte · "}
              {new Date(data.generated_at).toLocaleString(lang === "en" ? "en-GB" : "fr-FR")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPdf}
            className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-2 text-sm hover:border-indigo-400">
            <Download size={14} />
            PDF
          </button>
          <button onClick={load} disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-2 text-sm hover:border-indigo-400 disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            {lang === "en" ? "Refresh" : "Actualiser"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label={lang === "en" ? "Revenue 30d" : "CA 30 jours"}
          value={formatFcfa(data.revenue.ca_30d)} trend={data.revenue.trend_pct} icon={Banknote} accent="emerald" />
        <KpiCard label={lang === "en" ? "Days without revenue" : "Jours sans recette"}
          value={`${data.revenue.jours_sans_recette}/30`} icon={Activity}
          accent={data.revenue.jours_sans_recette > 7 ? "amber" : "indigo"} />
        <KpiCard label={lang === "en" ? "7-day forecast" : "Prévision 7j"}
          value={formatFcfa(data.cashflow.next_7d_estimated)} icon={TrendingUp} accent="indigo"
          subtitle={`${lang === "en" ? "Confidence" : "Confiance"} ${confidenceLabel}`} />
        <KpiCard label={lang === "en" ? "Regularity (CV)" : "Régularité (CV)"}
          value={`${data.revenue.cv_pct}%`} icon={Sparkles}
          accent={data.revenue.cv_pct < 50 ? "emerald" : data.revenue.cv_pct < 100 ? "amber" : "red"}
          subtitle={lang === "en" ? "Lower = more stable" : "Plus bas = plus stable"} />
      </div>

      {/* REVENUE TREND CHART */}
      {data.revenue.daily.length > 0 && (
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/15">
              <TrendingUp size={14} />
            </div>
            <h2 className="font-bold text-gray-900 dark:text-white">
              {lang === "en" ? "Revenue trend — last 30 days" : "Tendance recettes — 30 derniers jours"}
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.revenue.daily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
              <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 10, fill: "rgba(150,150,180,.7)" }} interval={4} />
              <YAxis tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 10, fill: "rgba(150,150,180,.7)" }} width={36} />
              <Tooltip
                contentStyle={{ background: "#0D1424", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: "rgba(200,200,230,.7)" }}
                formatter={(v) => [formatFcfa(Number(v ?? 0)), lang === "en" ? "Revenue" : "Recettes"]}
              />
              <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} fill="url(#grad-revenue)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* GRID 2 COLS */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* TOP DRIVERS */}
        <Section title={lang === "en" ? "Top drivers (30d)" : "Top chauffeurs (30j)"} icon={Trophy} accent="emerald">
          {data.drivers.top.length === 0 ? (
            <Empty>{lang === "en" ? "No active drivers in 30 days." : "Aucun chauffeur actif sur 30 jours."}</Empty>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {data.drivers.top.map((d, i) => (
                  <DriverRow key={d.id} driver={d} rank={i + 1} variant="top" lang={lang} />
                ))}
              </div>
              {/* Driver score bar chart */}
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">
                  {lang === "en" ? "Score comparison" : "Comparaison scores"}
                </p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={data.drivers.top} margin={{ top: 0, right: 4, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                    <XAxis dataKey="nom" tick={{ fontSize: 9, fill: "rgba(150,150,180,.7)" }}
                      angle={-20} textAnchor="end" interval={0} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "rgba(150,150,180,.7)" }} width={24} />
                    <Tooltip
                      contentStyle={{ background: "#0D1424", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, fontSize: 11 }}
                      formatter={(v) => [Number(v ?? 0), "Score"]}
                    />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {data.drivers.top.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Section>

        {/* AT RISK DRIVERS */}
        <Section title={lang === "en" ? "Drivers to monitor" : "Chauffeurs à surveiller"} icon={AlertTriangle}
          accent={data.drivers.at_risk.length > 0 ? "red" : "emerald"}>
          {data.drivers.at_risk.length === 0 ? (
            <Empty positive>{lang === "en" ? "No driver in alert. Great consistency!" : "Aucun chauffeur en alerte. Belle régularité !"}</Empty>
          ) : (
            <div className="space-y-2">
              {data.drivers.at_risk.map(d => (
                <DriverRow key={d.id} driver={d} variant="risk" lang={lang} />
              ))}
            </div>
          )}
        </Section>

        {/* MAINTENANCE */}
        <Section title={lang === "en" ? "Maintenance to schedule" : "Maintenance à prévoir"} icon={Wrench}
          accent={data.maintenance.overdue.length > 0 ? "red" : "indigo"}>
          {data.maintenance.overdue.length === 0 && data.maintenance.soon.length === 0 ? (
            <Empty positive>{lang === "en" ? "No vehicle pending maintenance." : "Aucun véhicule en attente d'entretien."}</Empty>
          ) : (
            <div className="space-y-2">
              {data.maintenance.overdue.map(v => <VehicleRow key={v.id} v={v} lang={lang} />)}
              {data.maintenance.soon.map(v => <VehicleRow key={v.id} v={v} lang={lang} />)}
            </div>
          )}
        </Section>

        {/* EXPENSES */}
        <Section title={lang === "en" ? "Recurring expenses (30d)" : "Dépenses récurrentes (30j)"} icon={Banknote} accent="indigo">
          {data.expenses.by_category.length === 0 ? (
            <Empty>{lang === "en" ? "No expenses recorded." : "Aucune dépense enregistrée."}</Empty>
          ) : (
            <>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {lang === "en" ? "Total:" : "Total :"} <strong>{formatFcfa(data.expenses.total_30d)}</strong>
                {data.expenses.anomalies.length > 0 && (
                  <span className="ml-2 text-red-600 dark:text-red-400">
                    · {data.expenses.anomalies.length} {lang === "en" ? "anomaly detected" : `anomalie${data.expenses.anomalies.length > 1 ? "s" : ""} détectée${data.expenses.anomalies.length > 1 ? "s" : ""}`}
                  </span>
                )}
              </div>

              {/* Expense breakdown bar chart */}
              <div className="mb-3">
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart
                    data={data.expenses.by_category.slice(0, 6)}
                    layout="vertical"
                    margin={{ top: 0, right: 8, left: 64, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => `${Math.round(v / 1000)}k`}
                      tick={{ fontSize: 9, fill: "rgba(150,150,180,.7)" }} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 9, fill: "rgba(150,150,180,.7)" }} width={60} />
                    <Tooltip
                      contentStyle={{ background: "#0D1424", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, fontSize: 11 }}
                      formatter={(v) => [formatFcfa(Number(v ?? 0)), lang === "en" ? "Amount" : "Montant"]}
                    />
                    <Bar dataKey="total_30d" radius={[0, 4, 4, 0]}>
                      {data.expenses.by_category.slice(0, 6).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1">
                {data.expenses.by_category.slice(0, 6).map(c => (
                  <ExpenseRow key={c.category} cat={c} />
                ))}
              </div>
            </>
          )}
        </Section>

      </div>

      {/* SYSCOHADA EXPORT */}
      <SyscohadaExportCard lang={lang} />

      {/* FOOTER */}
      <div className="text-xs text-gray-400 text-center pt-4 pb-2">
        {lang === "en"
          ? "Algorithmic calculations generated from your data. Auto-updated every minute."
          : "Calculs algorithmiques générés à partir de vos données. Mise à jour automatique toutes les minutes."}
      </div>
    </div>
  )
}


// ────────── SYSCOHADA export card ──────────

function SyscohadaExportCard({ lang }: { lang: string }) {
  const [from, setFrom]   = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo]       = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to, lang })
      const res = await fetch(`/api/syscohada/export?${params}`, { credentials: "include" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url
      a.download = `syscohada_${from}_${to}.csv`
      a.click()
      URL.revokeObjectURL(url)
      posthog.capture("syscohada_exported", { from, to })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/15">
          <Download size={14} />
        </div>
        <h2 className="font-bold text-gray-900 dark:text-white">
          {lang === "en" ? "SYSCOHADA Export (OHADA)" : "Export SYSCOHADA (OHADA)"}
        </h2>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        {lang === "en"
          ? "Generate a double-entry accounting CSV compatible with SYSCOHADA/OHADA software (SAGE, EBP…)"
          : "Génère un CSV comptable double-entrée compatible avec les logiciels SYSCOHADA/OHADA (SAGE, EBP…)"}
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {lang === "en" ? "From" : "Du"}
          </label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="text-xs rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-2 py-1.5 text-gray-900 dark:text-white" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {lang === "en" ? "To" : "au"}
          </label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="text-xs rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-2 py-1.5 text-gray-900 dark:text-white" />
        </div>
        <button onClick={handleExport} disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition disabled:opacity-60">
          {loading ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />}
          {lang === "en" ? "Download CSV" : "Télécharger CSV"}
        </button>
      </div>
    </div>
  )
}


// ────────── Sub-components ──────────

function Section({ title, icon: Icon, accent, children }: {
  title: string
  icon: React.ElementType
  accent: "emerald" | "red" | "amber" | "indigo"
  children: React.ReactNode
}) {
  const accentClasses = {
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/15",
    red:     "text-red-600     dark:text-red-400     bg-red-100     dark:bg-red-500/15",
    amber:   "text-amber-600   dark:text-amber-400   bg-amber-100   dark:bg-amber-500/15",
    indigo:  "text-indigo-600  dark:text-indigo-400  bg-indigo-100  dark:bg-indigo-500/15",
  }[accent]
  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentClasses}`}>
          <Icon size={14} />
        </div>
        <h2 className="font-bold text-gray-900 dark:text-white">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function KpiCard({ label, value, trend, icon: Icon, accent, subtitle }: {
  label:    string
  value:    string
  trend?:   number
  icon:     React.ElementType
  accent:   "emerald" | "red" | "amber" | "indigo"
  subtitle?: string
}) {
  const grad = {
    emerald: "from-emerald-500 to-teal-600",
    red:     "from-red-500     to-rose-600",
    amber:   "from-amber-500   to-orange-600",
    indigo:  "from-indigo-500  to-violet-600",
  }[accent]
  return (
    <div className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-4 overflow-hidden">
      <div className={`absolute -top-5 -right-5 w-20 h-20 rounded-full bg-gradient-to-br ${grad} opacity-10 blur-2xl`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
          {trend !== undefined && (
            <div className={`text-xs font-semibold mt-1 inline-flex items-center gap-1 ${
              trend > 0 ? "text-emerald-600 dark:text-emerald-400" : trend < 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"
            }`}>
              {trend > 0 ? <TrendingUp size={11} /> : trend < 0 ? <TrendingDown size={11} /> : null}
              {trend > 0 ? "+" : ""}{trend}%
            </div>
          )}
        </div>
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center shadow-md`}>
          <Icon size={15} className="text-white" />
        </div>
      </div>
    </div>
  )
}

function DriverRow({ driver, rank, variant, lang }: { driver: DriverInsight; rank?: number; variant: "top" | "risk"; lang: string }) {
  const riskColor =
    driver.risk === "critical" ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/30" :
    driver.risk === "warn"     ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30" :
                                 "border-gray-100 dark:border-white/5"
  const cls = variant === "risk" ? riskColor : "border-gray-100 dark:border-white/5"

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${cls}`}>
      {variant === "top" && rank && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-black text-sm shrink-0">
          #{rank}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{driver.nom}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap mt-0.5">
          <span><Clock size={10} className="inline mr-0.5" /> {driver.jours_actifs_30d}/30 {lang === "en" ? "d" : "j"}</span>
          <span>· {lang === "en" ? "Regularity" : "Régularité"} {driver.regularite_pct}%</span>
          {driver.trend_30d_pct !== 0 && (
            <span className={driver.trend_30d_pct > 0 ? "text-emerald-600" : "text-red-600"}>
              · {driver.trend_30d_pct > 0 ? "+" : ""}{driver.trend_30d_pct}%
            </span>
          )}
        </div>
        {variant === "risk" && driver.risk_reasons.length > 0 && (
          <div className="text-[10px] text-red-700 dark:text-red-400 mt-1">
            {driver.risk_reasons.join(" · ")}
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="font-bold text-sm">{formatFcfa(driver.ca_30d)}</div>
        <div className="text-[10px] text-gray-400 mt-0.5">Score {driver.score}/100</div>
      </div>
    </div>
  )
}

function VehicleRow({ v, lang }: { v: VehicleMaintenance; lang: string }) {
  const cls =
    v.status === "overdue" ? "border-red-300 dark:border-red-500/30 bg-red-50/40 dark:bg-red-500/10" :
    v.status === "soon"    ? "border-amber-300 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/10" :
                             "border-gray-100 dark:border-white/5"
  const label =
    v.days_until_next === null ? (lang === "en" ? "Unknown date" : "Date inconnue") :
    v.days_until_next < 0      ? (lang === "en" ? `${Math.abs(v.days_until_next)}d late` : `Retard ${Math.abs(v.days_until_next)} j`) :
    v.days_until_next === 0    ? (lang === "en" ? "Today" : "Aujourd'hui") :
                                 (lang === "en" ? `In ${v.days_until_next}d` : `Dans ${v.days_until_next} j`)

  return (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${cls}`}>
      <div className="flex-1 min-w-0">
        <div className="font-mono font-bold text-sm">{v.immatriculation}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {v.marque} {v.modele}
          {v.last_entretien && (
            <span className="ml-2">
              · {lang === "en" ? "last" : "dernier"} {new Date(v.last_entretien).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR")}
            </span>
          )}
        </div>
      </div>
      <div className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
        v.status === "overdue" ? "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-500/20" :
        v.status === "soon"    ? "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/20" :
                                 "text-gray-500 bg-gray-100 dark:bg-white/5"
      }`}>
        {label}
      </div>
    </div>
  )
}

function ExpenseRow({ cat }: { cat: ExpenseCategory }) {
  const isAnomaly = cat.trend_pct > 50 && cat.total_30d > 10000
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-t border-gray-100 dark:border-white/5 first:border-0">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-xs flex items-center gap-1.5 flex-wrap">
          {cat.category}
          {cat.is_recurring && <span className="text-[9px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/15 px-1.5 py-0.5 rounded">Récurrent</span>}
          {isAnomaly && <span className="text-[9px] uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/15 px-1.5 py-0.5 rounded">⚠ Anomalie</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-bold text-sm">{formatFcfa(cat.total_30d)}</div>
        {cat.trend_pct !== 0 && (
          <div className={`text-[10px] ${cat.trend_pct > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {cat.trend_pct > 0 ? "+" : ""}{cat.trend_pct}%
          </div>
        )}
      </div>
    </div>
  )
}

function Empty({ children, positive }: { children: React.ReactNode; positive?: boolean }) {
  return (
    <div className={`text-center py-6 text-sm ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>
      {positive && <CheckCircle2 size={20} className="mx-auto mb-2" />}
      {children}
    </div>
  )
}
