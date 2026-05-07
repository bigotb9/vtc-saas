import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Calculs AI Insights — version 100% algorithmique (pas d'IA externe).
 *
 * Charge les données du tenant courant et produit :
 *   - top chauffeurs (CA, régularité, score composite)
 *   - chauffeurs à risque (chute de CA, journées sans recette)
 *   - véhicules avec entretien proche
 *   - dépenses récurrentes par catégorie + détection anomalies
 *   - prévision trésorerie 7 jours
 *
 * Aucune dépendance externe : utilisable en self-hosted, performance OK
 * sur des flottes jusqu'à ~500 véhicules.
 */


// ────────── Types publics ──────────

export type DriverInsight = {
  id:            string | number
  nom:           string
  ca_total:      number
  ca_30d:        number
  jours_actifs_30d: number
  jours_total:   number
  regularite_pct: number   // 0-100
  trend_30d_pct: number    // tendance vs 30j précédents (-100 à +∞)
  score:         number    // 0-100 composite
  risk:          "ok" | "warn" | "critical"
  risk_reasons:  string[]
}

export type VehicleMaintenance = {
  id:               string | number
  immatriculation:  string
  marque:           string | null
  modele:           string | null
  last_entretien:   string | null   // ISO date
  next_entretien:   string | null   // ISO date — calculée si absente
  days_until_next:  number | null
  status:           "ok" | "soon" | "overdue" | "unknown"
}

export type ExpenseCategory = {
  category:           string
  total_30d:          number
  total_60d:          number
  trend_pct:          number       // évolution 30j vs 30j précédents
  avg_per_month:      number
  is_recurring:       boolean      // présent ≥3 mois sur les 6 derniers
  occurrences_6m:     number
}

export type RevenueRegularity = {
  ca_30d:             number
  ca_30d_prev:        number
  trend_pct:          number
  jours_sans_recette: number
  avg_daily:          number
  std_daily:          number
  cv_pct:             number       // coefficient de variation = std/avg × 100
}

export type CashflowForecast = {
  next_7d_estimated:  number
  based_on_avg:       number       // moyenne quotidienne 30j
  confidence:         "low" | "medium" | "high"
}

export type AiInsightsReport = {
  generated_at:    string
  drivers: {
    top:           DriverInsight[]
    at_risk:       DriverInsight[]
    all_count:     number
  }
  maintenance: {
    overdue:       VehicleMaintenance[]
    soon:          VehicleMaintenance[]
    all_count:     number
  }
  expenses: {
    by_category:   ExpenseCategory[]
    total_30d:     number
    anomalies:     ExpenseCategory[]   // catégories avec trend > +50%
  }
  revenue:         RevenueRegularity
  cashflow:        CashflowForecast
}


// ────────── Helpers stats ──────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length)
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}


// ────────── Compute principal ──────────

export async function computeAiInsights(client: SupabaseClient): Promise<AiInsightsReport> {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const start60d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const start180d = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)

  // Charge en parallèle toutes les sources
  const [chauffeursR, vehiculesR, recettesR, depensesR, entretiensR, affectationsR] = await Promise.all([
    client.from("chauffeurs").select("*"),
    client.from("vehicules").select("*"),
    client.from("recettes_wave")
      .select("Horodatage, \"Montant net\", \"Numéro de téléphone de contrepartie\", telephone_chauffeur")
      .gte("Horodatage", start180d.toISOString()),
    client.from("depenses_vehicules")
      .select("id_vehicule, montant, categorie, date")
      .gte("date", start180d.toISOString().slice(0, 10)),
    client.from("entretiens").select("id, id_vehicule, date_prochain, created_at"),
    client.from("affectation_chauffeurs_vehicules").select("id_chauffeur, id_vehicule"),
  ])

  const chauffeurs   = chauffeursR.data ?? []
  const vehicules    = vehiculesR.data ?? []
  const recettes     = recettesR.data ?? []
  const depenses     = depensesR.data ?? []
  const entretiens   = entretiensR.data ?? []
  const affectations = affectationsR.data ?? []

  return {
    generated_at: now.toISOString(),
    drivers:      computeDrivers(chauffeurs, recettes, affectations, now),
    maintenance:  computeMaintenance(vehicules, entretiens, now),
    expenses:     computeExpenses(depenses, now),
    revenue:      computeRevenueRegularity(recettes, now),
    cashflow:     computeCashflow(recettes, now),
  }
}


// ────────── Drivers ──────────

type Chauffeur = { id_chauffeur: number; nom: string; prenom?: string; telephone?: string; telephone_wave?: string; date_embauche?: string; actif?: boolean }
type Recette  = { Horodatage: string; "Montant net": number; "Numéro de téléphone de contrepartie"?: string; telephone_chauffeur?: string }
type Affectation = { id_chauffeur: number; id_vehicule: number }

function computeDrivers(
  chauffeurs: Chauffeur[],
  recettes: Recette[],
  _affectations: Affectation[],
  now: Date,
): AiInsightsReport["drivers"] {
  const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const start60d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  // Groupe les recettes par téléphone chauffeur
  const recettesByPhone = new Map<string, Recette[]>()
  for (const r of recettes) {
    const phone = r.telephone_chauffeur || r["Numéro de téléphone de contrepartie"]
    if (!phone) continue
    const norm = String(phone).replace(/\D/g, "").slice(-8)   // last 8 digits as key
    if (!norm) continue
    if (!recettesByPhone.has(norm)) recettesByPhone.set(norm, [])
    recettesByPhone.get(norm)!.push(r)
  }

  const insights: DriverInsight[] = chauffeurs.map(c => {
    const phone = (c.telephone_wave || c.telephone || "").replace(/\D/g, "").slice(-8)
    const myRecettes = phone ? (recettesByPhone.get(phone) ?? []) : []

    const recettes30d = myRecettes.filter(r => new Date(r.Horodatage) >= start30d)
    const recettes30dPrev = myRecettes.filter(r => {
      const d = new Date(r.Horodatage)
      return d >= start60d && d < start30d
    })

    const ca_total = myRecettes.reduce((s, r) => s + (Number(r["Montant net"]) || 0), 0)
    const ca_30d   = recettes30d.reduce((s, r) => s + (Number(r["Montant net"]) || 0), 0)
    const ca_30d_prev = recettes30dPrev.reduce((s, r) => s + (Number(r["Montant net"]) || 0), 0)

    const jours_actifs_30d = new Set(recettes30d.map(r => r.Horodatage.slice(0, 10))).size
    const trend = ca_30d_prev > 0 ? Math.round(((ca_30d - ca_30d_prev) / ca_30d_prev) * 100) : 0
    const regularite = Math.round((jours_actifs_30d / 30) * 100)

    // Score composite (0-100) :
    //   40% volume CA (normalisé sur le top du parc)
    //   40% régularité
    //   20% tendance (positive = bonus, négative = malus)
    const trendNormalized = Math.max(0, Math.min(100, 50 + trend / 2))
    const score = Math.round(
      0.40 * Math.min(100, ca_30d / 10000) +   // 1M FCFA → 100 pts
      0.40 * regularite +
      0.20 * trendNormalized
    )

    // Évaluation du risque
    const reasons: string[] = []
    let risk: "ok" | "warn" | "critical" = "ok"
    if (jours_actifs_30d === 0 && c.actif !== false) {
      risk = "critical"
      reasons.push("Aucune recette sur 30 jours")
    } else if (regularite < 40) {
      risk = "warn"
      reasons.push(`Régularité faible : ${regularite}% (${jours_actifs_30d}/30 jours)`)
    }
    if (trend < -30 && ca_30d_prev > 0) {
      risk = risk === "critical" ? "critical" : "warn"
      reasons.push(`CA en chute de ${Math.abs(trend)}% vs mois précédent`)
    }

    return {
      id: c.id_chauffeur,
      nom: `${c.prenom ?? ""} ${c.nom}`.trim() || `Chauffeur #${c.id_chauffeur}`,
      ca_total: Math.round(ca_total),
      ca_30d:   Math.round(ca_30d),
      jours_actifs_30d,
      jours_total: 30,
      regularite_pct: regularite,
      trend_30d_pct: trend,
      score,
      risk,
      risk_reasons: reasons,
    }
  })

  // Tri par score décroissant
  insights.sort((a, b) => b.score - a.score)
  const top = insights.slice(0, 5)
  const at_risk = insights.filter(i => i.risk !== "ok").slice(0, 10)

  return { top, at_risk, all_count: insights.length }
}


// ────────── Maintenance prédictive ──────────

type Vehicule = { id_vehicule: number; immatriculation: string; marque?: string | null; modele?: string | null }
type Entretien = { id: number | string; id_vehicule: number; date_prochain?: string | null; created_at: string }

function computeMaintenance(
  vehicules: Vehicule[],
  entretiens: Entretien[],
  now: Date,
): AiInsightsReport["maintenance"] {
  const entretiensByVehicule = new Map<number, Entretien[]>()
  for (const e of entretiens) {
    if (!entretiensByVehicule.has(e.id_vehicule)) entretiensByVehicule.set(e.id_vehicule, [])
    entretiensByVehicule.get(e.id_vehicule)!.push(e)
  }

  const items: VehicleMaintenance[] = vehicules.map(v => {
    const list = (entretiensByVehicule.get(v.id_vehicule) ?? [])
      .sort((a, b) => b.created_at.localeCompare(a.created_at))

    const last = list[0] ?? null
    const lastDate = last?.created_at ? last.created_at.slice(0, 10) : null

    // 1. Si date_prochain explicitement renseignée → on l'utilise
    let nextDate = list.find(e => e.date_prochain)?.date_prochain ?? null

    // 2. Sinon, prédit la prochaine échéance par périodicité moyenne entre
    //    les 2 derniers entretiens.
    if (!nextDate && list.length >= 2) {
      const dates = list.map(e => new Date(e.created_at).getTime()).sort((a, b) => a - b)
      const gaps: number[] = []
      for (let i = 1; i < dates.length; i++) gaps.push(dates[i] - dates[i - 1])
      const avgGap = mean(gaps)
      if (avgGap > 0 && last) {
        const predicted = new Date(new Date(last.created_at).getTime() + avgGap)
        nextDate = predicted.toISOString().slice(0, 10)
      }
    }

    let days_until: number | null = null
    let status: VehicleMaintenance["status"] = "unknown"
    if (nextDate) {
      days_until = daysBetween(now, new Date(nextDate))
      if (days_until < 0)        status = "overdue"
      else if (days_until <= 14) status = "soon"
      else                       status = "ok"
    }

    return {
      id: v.id_vehicule,
      immatriculation: v.immatriculation,
      marque: v.marque ?? null,
      modele: v.modele ?? null,
      last_entretien: lastDate,
      next_entretien: nextDate,
      days_until_next: days_until,
      status,
    }
  })

  return {
    overdue: items.filter(i => i.status === "overdue"),
    soon:    items.filter(i => i.status === "soon").sort((a, b) => (a.days_until_next ?? 0) - (b.days_until_next ?? 0)),
    all_count: items.length,
  }
}


// ────────── Dépenses récurrentes & anomalies ──────────

type Depense = { id_vehicule: number; montant: number; categorie: string | null; date: string }

function computeExpenses(depenses: Depense[], now: Date): AiInsightsReport["expenses"] {
  const start30d  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const start60d  = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const start180d = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)

  const byCategory = new Map<string, Depense[]>()
  for (const d of depenses) {
    const cat = d.categorie || "Non catégorisé"
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(d)
  }

  const result: ExpenseCategory[] = []
  let total_30d = 0

  for (const [cat, items] of byCategory) {
    const items30d  = items.filter(d => new Date(d.date) >= start30d)
    const items60d  = items.filter(d => {
      const dt = new Date(d.date)
      return dt >= start60d && dt < start30d
    })
    const items180d = items.filter(d => new Date(d.date) >= start180d)

    const sum30d = items30d.reduce((s, d) => s + (Number(d.montant) || 0), 0)
    const sum60d = items60d.reduce((s, d) => s + (Number(d.montant) || 0), 0)
    const sum180d = items180d.reduce((s, d) => s + (Number(d.montant) || 0), 0)

    total_30d += sum30d

    // Récurrent = présent dans ≥3 mois sur les 6 derniers
    const monthsPresent = new Set(items180d.map(d => d.date.slice(0, 7))).size
    const trend = sum60d > 0 ? Math.round(((sum30d - sum60d) / sum60d) * 100) : 0

    result.push({
      category:       cat,
      total_30d:      Math.round(sum30d),
      total_60d:      Math.round(sum60d),
      trend_pct:      trend,
      avg_per_month:  Math.round(sum180d / 6),
      is_recurring:   monthsPresent >= 3,
      occurrences_6m: monthsPresent,
    })
  }

  result.sort((a, b) => b.total_30d - a.total_30d)
  const anomalies = result.filter(c => c.trend_pct > 50 && c.total_30d > 10000)

  return { by_category: result, total_30d: Math.round(total_30d), anomalies }
}


// ────────── Régularité revenus ──────────

function computeRevenueRegularity(recettes: Recette[], now: Date): RevenueRegularity {
  const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const start60d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  const recettes30d = recettes.filter(r => new Date(r.Horodatage) >= start30d)
  const recettes60d = recettes.filter(r => {
    const d = new Date(r.Horodatage)
    return d >= start60d && d < start30d
  })

  const ca_30d   = recettes30d.reduce((s, r) => s + (Number(r["Montant net"]) || 0), 0)
  const ca_30d_prev = recettes60d.reduce((s, r) => s + (Number(r["Montant net"]) || 0), 0)

  // Recettes par jour sur 30j
  const byDay = new Map<string, number>()
  for (const r of recettes30d) {
    const d = r.Horodatage.slice(0, 10)
    byDay.set(d, (byDay.get(d) ?? 0) + (Number(r["Montant net"]) || 0))
  }
  const dailyAmounts: number[] = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    dailyAmounts.push(byDay.get(d) ?? 0)
  }

  const avg = mean(dailyAmounts)
  const sd  = stddev(dailyAmounts)
  const jours_sans = dailyAmounts.filter(x => x === 0).length

  return {
    ca_30d:             Math.round(ca_30d),
    ca_30d_prev:        Math.round(ca_30d_prev),
    trend_pct:          ca_30d_prev > 0 ? Math.round(((ca_30d - ca_30d_prev) / ca_30d_prev) * 100) : 0,
    jours_sans_recette: jours_sans,
    avg_daily:          Math.round(avg),
    std_daily:          Math.round(sd),
    cv_pct:             avg > 0 ? Math.round((sd / avg) * 100) : 0,
  }
}


// ────────── Prévision trésorerie ──────────

function computeCashflow(recettes: Recette[], now: Date): CashflowForecast {
  const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const recettes30d = recettes.filter(r => new Date(r.Horodatage) >= start30d)
  const total = recettes30d.reduce((s, r) => s + (Number(r["Montant net"]) || 0), 0)
  const avg_daily = total / 30

  // Confiance basée sur le nombre de jours actifs
  const jours_actifs = new Set(recettes30d.map(r => r.Horodatage.slice(0, 10))).size
  const confidence: CashflowForecast["confidence"] =
    jours_actifs >= 25 ? "high" :
    jours_actifs >= 15 ? "medium" : "low"

  return {
    next_7d_estimated: Math.round(avg_daily * 7),
    based_on_avg:      Math.round(avg_daily),
    confidence,
  }
}
