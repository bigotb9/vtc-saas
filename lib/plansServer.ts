import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { supabaseMaster } from "./supabaseMaster"
import { getCurrentTenant, getTenantAdmin } from "./supabaseTenant"
import {
  checkQuota,
  hasFeature,
  type AddonId,
  type FeatureKey,
  type PlanId,
  type QuotaCheck,
  type QuotaKey,
  type SubscriptionStatus,
  type TenantPlanContext,
} from "./plans"

/**
 * Helpers serveur pour le système de plans.
 *
 * Charge depuis la base MASTER : subscription active + addons + overrides.
 * Charge depuis la base TENANT : count des ressources (véhicules, users) pour
 * les vérifications de quota.
 *
 * server-only : ne JAMAIS importer depuis du code client (browser bundle).
 */


// ────────── Chargement du contexte plan ──────────

/**
 * Construit le TenantPlanContext d'un tenant donné depuis la base master.
 * Renvoie un contexte "vide" (planId null, statut null) si le tenant n'a
 * pas de subscription active — le code appelant doit alors traiter ça
 * comme "aucune feature, aucun quota".
 */
export async function loadTenantPlanContext(tenantId: string): Promise<TenantPlanContext> {
  const empty: TenantPlanContext = {
    planId: null,
    status: null,
    activeAddons: [],
    featureOverrides: {},
  }

  const { data: tenant } = await supabaseMaster
    .from("tenants")
    .select("current_subscription_id, feature_overrides")
    .eq("id", tenantId)
    .maybeSingle()

  if (!tenant) return empty

  const featureOverrides = (tenant.feature_overrides ?? {}) as Partial<Record<FeatureKey, boolean>>

  if (!tenant.current_subscription_id) {
    return { ...empty, featureOverrides }
  }

  const { data: sub } = await supabaseMaster
    .from("subscriptions")
    .select("plan_id, status")
    .eq("id", tenant.current_subscription_id)
    .maybeSingle()

  if (!sub) return { ...empty, featureOverrides }

  const { data: addons } = await supabaseMaster
    .from("subscription_addons")
    .select("addon_id")
    .eq("subscription_id", tenant.current_subscription_id)
    .is("deactivated_at", null)

  return {
    planId:           sub.plan_id as PlanId,
    status:           sub.status as SubscriptionStatus,
    activeAddons:     (addons ?? []).map((a) => a.addon_id as AddonId),
    featureOverrides,
  }
}

/**
 * Raccourci : récupère le plan context du tenant courant (résolu par
 * header x-tenant-slug du middleware). Throw si pas de tenant.
 */
export async function getCurrentTenantPlanContext(): Promise<TenantPlanContext> {
  const tenant = await getCurrentTenant()
  if (!tenant) throw new Error("Aucun tenant résolu pour cette requête")
  return loadTenantPlanContext(tenant.id)
}


// ────────── Comptage des ressources tenant ──────────

/**
 * Compte le nombre de ressources d'un type donné dans la DB du tenant.
 * Utilise un client Supabase fourni — le caller est responsable de passer
 * le bon client (généralement obtenu via getTenantAdmin()).
 */
export async function countTenantResource(
  client: SupabaseClient,
  kind: QuotaKey,
): Promise<number> {
  const table = kind === "vehicules" ? "vehicules" : "profiles"
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true })

  if (error) {
    console.error(`[plansServer] countTenantResource(${kind}) failed:`, error.message)
    return 0
  }
  return count ?? 0
}


// ────────── Vérifications haut niveau ──────────

/**
 * Vérifie le quota d'une ressource pour le tenant courant. Combine
 * loadContext + countResource en un seul appel.
 */
export async function checkCurrentTenantQuota(kind: QuotaKey): Promise<QuotaCheck & { ctx: TenantPlanContext }> {
  const [ctx, client] = await Promise.all([
    getCurrentTenantPlanContext(),
    getTenantAdmin(),
  ])
  const current = await countTenantResource(client, kind)
  return { ...checkQuota(ctx, kind, current), ctx }
}


// ────────── Erreurs typées ──────────

export class FeatureLockedError extends Error {
  readonly code = "FEATURE_LOCKED" as const
  readonly feature: FeatureKey
  constructor(feature: FeatureKey) {
    super(`Feature "${feature}" non incluse dans le plan actuel.`)
    this.feature = feature
  }
}

export class QuotaExceededError extends Error {
  readonly code = "QUOTA_EXCEEDED" as const
  readonly kind: QuotaKey
  readonly current: number
  readonly limit: number
  constructor(kind: QuotaKey, current: number, limit: number) {
    super(`Quota "${kind}" dépassé : ${current}/${limit}.`)
    this.kind = kind
    this.current = current
    this.limit = limit
  }
}


// ────────── Enforcers (à appeler en début d'API route) ──────────

/**
 * Throw FeatureLockedError si la feature n'est pas active pour le tenant
 * courant. À utiliser au début d'une API route qui sert une feature
 * payante (ex: /api/yango/sync, /api/ai-insights/generate).
 *
 * Usage :
 *   await enforceCurrentTenantFeature('yango')
 *   // ... le reste de la route ...
 */
export async function enforceCurrentTenantFeature(feature: FeatureKey): Promise<TenantPlanContext> {
  const ctx = await getCurrentTenantPlanContext()
  if (!hasFeature(ctx, feature)) throw new FeatureLockedError(feature)
  return ctx
}

/**
 * Throw QuotaExceededError si la création d'une nouvelle ressource
 * dépasserait le quota du plan. À appeler au début d'une route POST de
 * création (ex: /api/vehicules/create).
 *
 * Usage :
 *   await enforceCurrentTenantQuota('vehicules')
 *   // ... insert vehicule ...
 */
export async function enforceCurrentTenantQuota(kind: QuotaKey): Promise<QuotaCheck> {
  const result = await checkCurrentTenantQuota(kind)
  if (!result.ok && result.limit !== null) {
    throw new QuotaExceededError(kind, result.current, result.limit)
  }
  return result
}
