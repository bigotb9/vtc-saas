"use client"

import { useEffect, useState } from "react"
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Wrench,
  Clock, Banknote, Activity, RefreshCw, Loader2, Trophy, Sparkles,
} from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import { formatFcfa } from "@/lib/plans"

/**
 * AI Insights — page tenant.
 * Affiche le rapport généré par /api/ai-insights (calculs purs côté serveur).
 *
 * Sections :
 *   1. Vue d'ensemble — CA, tendance, cashflow, alertes
 *   2. Top chauffeurs + chauffeurs à risque
 *   3. Maintenance prédictive
 *   4. Dépenses : récurrentes + anomalies
 */

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
  }
  cashflow: { next_7d_estimated: number; based_on_avg: number; confidence: "low"|"medium"|"high" }
}


export default function AiInsightsPage() {
  const [data, setData]       = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await authFetch("/api/ai-insights")
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setData(j)
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
              Analyse automatique de votre flotte · {new Date(data.generated_at).toLocaleString("fr-FR")}
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-2 text-sm hover:border-indigo-400 disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
          Actualiser
        </button>
      </div>

      {/* OVERVIEW KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="CA 30 jours"
          value={formatFcfa(data.revenue.ca_30d)}
          trend={data.revenue.trend_pct}
          icon={Banknote}
          accent="emerald"
        />
        <KpiCard
          label="Jours sans recette"
          value={`${data.revenue.jours_sans_recette}/30`}
          icon={Activity}
          accent={data.revenue.jours_sans_recette > 7 ? "amber" : "indigo"}
        />
        <KpiCard
          label="Prévision 7j"
          value={formatFcfa(data.cashflow.next_7d_estimated)}
          icon={TrendingUp}
          accent="indigo"
          subtitle={`Confiance ${data.cashflow.confidence === "high" ? "élevée" : data.cashflow.confidence === "medium" ? "moyenne" : "faible"}`}
        />
        <KpiCard
          label="Régularité (CV)"
          value={`${data.revenue.cv_pct}%`}
          icon={Sparkles}
          accent={data.revenue.cv_pct < 50 ? "emerald" : data.revenue.cv_pct < 100 ? "amber" : "red"}
          subtitle="Plus bas = plus stable"
        />
      </div>

      {/* GRID 2 COLS */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* TOP DRIVERS */}
        <Section title="Top chauffeurs (30j)" icon={Trophy} accent="emerald">
          {data.drivers.top.length === 0 ? (
            <Empty>Aucun chauffeur actif sur 30 jours.</Empty>
          ) : (
            <div className="space-y-2">
              {data.drivers.top.map((d, i) => (
                <DriverRow key={d.id} driver={d} rank={i + 1} variant="top" />
              ))}
            </div>
          )}
        </Section>

        {/* AT RISK DRIVERS */}
        <Section title="Chauffeurs à surveiller" icon={AlertTriangle} accent={data.drivers.at_risk.length > 0 ? "red" : "emerald"}>
          {data.drivers.at_risk.length === 0 ? (
            <Empty positive>Aucun chauffeur en alerte. Belle régularité !</Empty>
          ) : (
            <div className="space-y-2">
              {data.drivers.at_risk.map(d => (
                <DriverRow key={d.id} driver={d} variant="risk" />
              ))}
            </div>
          )}
        </Section>

        {/* MAINTENANCE */}
        <Section title="Maintenance à prévoir" icon={Wrench} accent={data.maintenance.overdue.length > 0 ? "red" : "indigo"}>
          {data.maintenance.overdue.length === 0 && data.maintenance.soon.length === 0 ? (
            <Empty positive>Aucun véhicule en attente d&apos;entretien.</Empty>
          ) : (
            <div className="space-y-2">
              {data.maintenance.overdue.map(v => <VehicleRow key={v.id} v={v} />)}
              {data.maintenance.soon.map(v => <VehicleRow key={v.id} v={v} />)}
            </div>
          )}
        </Section>

        {/* EXPENSES */}
        <Section title="Dépenses récurrentes (30j)" icon={Banknote} accent="indigo">
          {data.expenses.by_category.length === 0 ? (
            <Empty>Aucune dépense enregistrée.</Empty>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Total : <strong>{formatFcfa(data.expenses.total_30d)}</strong>
                {data.expenses.anomalies.length > 0 && (
                  <span className="ml-2 text-red-600 dark:text-red-400">
                    · {data.expenses.anomalies.length} anomalie{data.expenses.anomalies.length > 1 ? "s" : ""} détectée{data.expenses.anomalies.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {data.expenses.by_category.slice(0, 8).map(c => (
                <ExpenseRow key={c.category} cat={c} />
              ))}
            </div>
          )}
        </Section>

      </div>

      {/* FOOTER */}
      <div className="text-xs text-gray-400 text-center pt-4 pb-2">
        Calculs algorithmiques générés à partir de vos données.
        Mise à jour automatique toutes les minutes.
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

function DriverRow({ driver, rank, variant }: { driver: DriverInsight; rank?: number; variant: "top" | "risk" }) {
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
          <span><Clock size={10} className="inline mr-0.5" /> {driver.jours_actifs_30d}/30 j</span>
          <span>· Régularité {driver.regularite_pct}%</span>
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

function VehicleRow({ v }: { v: VehicleMaintenance }) {
  const cls =
    v.status === "overdue" ? "border-red-300 dark:border-red-500/30 bg-red-50/40 dark:bg-red-500/10" :
    v.status === "soon"    ? "border-amber-300 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/10" :
                             "border-gray-100 dark:border-white/5"
  const label =
    v.days_until_next === null ? "Date inconnue" :
    v.days_until_next < 0      ? `Retard ${Math.abs(v.days_until_next)} j` :
    v.days_until_next === 0    ? "Aujourd'hui" :
                                 `Dans ${v.days_until_next} j`

  return (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${cls}`}>
      <div className="flex-1 min-w-0">
        <div className="font-mono font-bold text-sm">{v.immatriculation}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {v.marque} {v.modele}
          {v.last_entretien && <span className="ml-2">· dernier {new Date(v.last_entretien).toLocaleDateString("fr-FR")}</span>}
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
    <div className="flex items-center justify-between gap-3 py-2 border-t border-gray-100 dark:border-white/5 first:border-0">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm flex items-center gap-2">
          {cat.category}
          {cat.is_recurring && <span className="text-[9px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/15 px-1.5 py-0.5 rounded">Récurrent</span>}
          {isAnomaly && <span className="text-[9px] uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/15 px-1.5 py-0.5 rounded">⚠ Anomalie</span>}
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5">
          Moy. {formatFcfa(cat.avg_per_month)} / mois
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
