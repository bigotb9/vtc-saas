/**
 * Système de plans SaaS — types, constantes, helpers purs.
 *
 * Ce fichier ne fait AUCUN appel DB. Il est utilisable côté client (pour
 * afficher/cacher des UI) ET côté serveur (pour bloquer des API). Toute
 * fonction qui charge depuis la base est dans lib/plansServer.ts.
 *
 * Source de vérité du catalogue : la table public.plans en base master
 * (seedée par supabase/master/0002_subscriptions.sql). Les constantes
 * ci-dessous sont un MIROIR utilisé par le code applicatif (ex: page
 * /pricing publique, UI de comparaison) — elles doivent rester en sync
 * avec le SQL de seed.
 */


// ────────── Types ──────────

export type PlanId = 'silver' | 'gold' | 'platinum'

export type FeatureKey =
  | 'dashboard'
  | 'alertes'
  | 'vehicules'
  | 'chauffeurs'
  | 'recettes'
  | 'depenses'
  | 'wave'
  | 'yango'
  | 'pdf_reports'
  | 'fleet_clients'
  | 'ai_insights'
  | 'ai_agent'
  | 'gps'

export type AddonId = 'ai_insights' | 'ai_agent' | 'gps'

export type QuotaKey = 'vehicules' | 'users'

export type BillingCycle = 'monthly' | 'yearly'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'canceled'
  | 'archived'

export type PaymentProvider = 'wave' | 'stripe' | 'manual'


export type PlanFeatures = Record<FeatureKey, boolean>

export type Plan = {
  id:                  PlanId
  name:                string
  description:         string
  priceMonthlyFcfa:    number
  priceYearlyFcfa:     number
  maxVehicules:        number | null      // null = illimité
  maxUsers:            number | null      // null = illimité
  features:            PlanFeatures
  displayOrder:        number
  isPublic:            boolean
}

export type Addon = {
  id:                  AddonId
  name:                string
  description:         string
  priceMonthlyFcfa:    number | null      // null = sur devis
  featureKey:          FeatureKey
  displayOrder:        number
}

export type ActiveSubscription = {
  id:                  string
  planId:              PlanId
  status:              SubscriptionStatus
  billingCycle:        BillingCycle
  amountFcfa:          number
  currentPeriodStart:  string             // ISO
  currentPeriodEnd:    string             // ISO
  cancelAtPeriodEnd:   boolean
}


// ────────── Catalogue (miroir du seed SQL) ──────────

/**
 * Construit la map de features. Les clés non listées passent à false.
 * Garantit l'exhaustivité au compile-time.
 */
function makeFeatures(enabled: FeatureKey[]): PlanFeatures {
  const all: FeatureKey[] = [
    'dashboard', 'alertes', 'vehicules', 'chauffeurs', 'recettes', 'depenses',
    'wave', 'yango', 'pdf_reports', 'fleet_clients',
    'ai_insights', 'ai_agent', 'gps',
  ]
  return all.reduce((acc, key) => {
    acc[key] = enabled.includes(key)
    return acc
  }, {} as PlanFeatures)
}

export const PLANS: Record<PlanId, Plan> = {
  silver: {
    id:               'silver',
    name:             'Silver',
    description:      'Pour les petites flottes qui démarrent — gestion essentielle + Wave inclus.',
    priceMonthlyFcfa: 50_000,
    priceYearlyFcfa:  510_000,
    maxVehicules:     15,
    maxUsers:         3,
    features: makeFeatures([
      'dashboard', 'alertes', 'vehicules', 'chauffeurs',
      'recettes', 'depenses', 'wave',
    ]),
    displayOrder: 1,
    isPublic:     true,
  },

  gold: {
    id:               'gold',
    name:             'Gold',
    description:      'Pour les flottes en croissance — Yango, gestion clients tiers, rapports PDF.',
    priceMonthlyFcfa: 100_000,
    priceYearlyFcfa:  1_020_000,
    maxVehicules:     40,
    maxUsers:         8,
    features: makeFeatures([
      'dashboard', 'alertes', 'vehicules', 'chauffeurs',
      'recettes', 'depenses', 'wave',
      'yango', 'pdf_reports', 'fleet_clients',
    ]),
    displayOrder: 2,
    isPublic:     true,
  },

  platinum: {
    id:               'platinum',
    name:             'Platinum',
    description:      'Pour les grandes flottes — tout inclus, IA et agent VTC personnalisé.',
    priceMonthlyFcfa: 200_000,
    priceYearlyFcfa:  2_040_000,
    maxVehicules:     null,
    maxUsers:         null,
    features: makeFeatures([
      'dashboard', 'alertes', 'vehicules', 'chauffeurs',
      'recettes', 'depenses', 'wave',
      'yango', 'pdf_reports', 'fleet_clients',
      'ai_insights', 'ai_agent',
    ]),
    displayOrder: 3,
    isPublic:     true,
  },
}

export const ADDONS: Record<AddonId, Addon> = {
  ai_insights: {
    id:               'ai_insights',
    name:             'AI Insights',
    description:      'Détection automatique des chauffeurs à risque et messages WhatsApp pré-rédigés.',
    priceMonthlyFcfa: 15_000,
    featureKey:       'ai_insights',
    displayOrder:     1,
  },
  ai_agent: {
    id:               'ai_agent',
    name:             'Agent IA VTC personnalisé',
    description:      'Spécialiste VTC intégré — conseils stratégiques, automatisations, alertes intelligentes.',
    priceMonthlyFcfa: 50_000,
    featureKey:       'ai_agent',
    displayOrder:     2,
  },
  gps: {
    id:               'gps',
    name:             'Intégration GPS',
    description:      'Suivi temps réel des véhicules. Tarif sur devis selon le matériel choisi.',
    priceMonthlyFcfa: null,
    featureKey:       'gps',
    displayOrder:     3,
  },
}

export const PLAN_ORDER: PlanId[] = ['silver', 'gold', 'platinum']
export const ADDON_ORDER: AddonId[] = ['ai_insights', 'ai_agent', 'gps']


// ────────── Modèle d'évaluation ──────────

/**
 * Contexte minimal nécessaire pour évaluer les features et quotas d'un
 * tenant. Construit côté serveur via lib/plansServer.ts puis passé tel quel
 * aux helpers ci-dessous.
 */
export type TenantPlanContext = {
  planId:             PlanId | null
  status:             SubscriptionStatus | null
  activeAddons:       AddonId[]
  // Overrides manuels par admin SaaS (gratuité, exception, support).
  // Ex: { ai_agent: true } force l'activation chez un Silver.
  featureOverrides:   Partial<Record<FeatureKey, boolean>>
}


// ────────── Helpers purs ──────────

export function getPlan(planId: PlanId | null | undefined): Plan | null {
  if (!planId) return null
  return PLANS[planId] ?? null
}

export function getAddon(addonId: AddonId | null | undefined): Addon | null {
  if (!addonId) return null
  return ADDONS[addonId] ?? null
}

/**
 * Calcule la map effective des features d'un tenant en combinant :
 *   1. les features du plan
 *   2. les addons actifs (override true sur leur featureKey)
 *   3. les overrides manuels (true OU false — peut désactiver une feature
 *      même si le plan l'inclut, utile pour suspension partielle)
 *
 * Les statuts non-actifs (canceled, archived, suspended) coupent toutes
 * les features sauf si overrides force à true.
 */
export function getEffectiveFeatures(ctx: TenantPlanContext): PlanFeatures {
  const isActiveStatus =
    ctx.status === 'active' ||
    ctx.status === 'trialing' ||
    ctx.status === 'past_due'    // grace period — on laisse l'accès en lecture/écriture jusqu'à suspension

  const plan = getPlan(ctx.planId)
  const base: PlanFeatures = plan && isActiveStatus
    ? { ...plan.features }
    : makeFeatures([])             // tout à false si pas de plan ou statut non-actif

  for (const addonId of ctx.activeAddons) {
    const addon = getAddon(addonId)
    if (addon && isActiveStatus) base[addon.featureKey] = true
  }

  for (const [key, value] of Object.entries(ctx.featureOverrides) as [FeatureKey, boolean][]) {
    base[key] = value
  }

  return base
}

export function hasFeature(ctx: TenantPlanContext, feature: FeatureKey): boolean {
  return getEffectiveFeatures(ctx)[feature] === true
}

/**
 * Limite numérique du plan pour une ressource. NULL = illimité.
 * Les overrides ne s'appliquent PAS aux quotas (par design : si un admin
 * veut accorder plus, il change le plan ou utilise un addon dédié).
 */
export function getPlanLimit(ctx: TenantPlanContext, kind: QuotaKey): number | null {
  const plan = getPlan(ctx.planId)
  if (!plan) return 0   // pas de plan = aucun quota
  switch (kind) {
    case 'vehicules': return plan.maxVehicules
    case 'users':     return plan.maxUsers
  }
}

export type QuotaCheck = {
  ok:        boolean       // peut-on créer une nouvelle ressource ?
  current:   number
  limit:     number | null // null = illimité
  remaining: number | null
}

/**
 * Vérifie si une nouvelle ressource peut être ajoutée.
 * `current` = nombre actuel (à charger côté serveur depuis la DB tenant).
 */
export function checkQuota(ctx: TenantPlanContext, kind: QuotaKey, current: number): QuotaCheck {
  const limit = getPlanLimit(ctx, kind)
  if (limit === null) {
    return { ok: true, current, limit: null, remaining: null }
  }
  const remaining = Math.max(0, limit - current)
  return { ok: current < limit, current, limit, remaining }
}


// ────────── Pricing helpers ──────────

/**
 * Total mensualisé d'un abonnement (plan + addons actifs). Utile pour
 * afficher "Vous payez actuellement X FCFA/mois".
 */
export function getMonthlyTotal(ctx: TenantPlanContext): number {
  const plan = getPlan(ctx.planId)
  const planAmount = plan?.priceMonthlyFcfa ?? 0
  const addonsAmount = ctx.activeAddons.reduce((sum, id) => {
    const addon = getAddon(id)
    return sum + (addon?.priceMonthlyFcfa ?? 0)
  }, 0)
  return planAmount + addonsAmount
}

/**
 * Économie réalisée en passant au cycle annuel pour un plan donné.
 * (15% de remise appliquée au seed SQL — calcul cohérent.)
 */
export function getYearlySavingsFcfa(planId: PlanId): number {
  const plan = PLANS[planId]
  return plan.priceMonthlyFcfa * 12 - plan.priceYearlyFcfa
}

/**
 * Total à payer pour un signup ou un changement de plan, plan + addons compris.
 * - cycle 'monthly' : (plan + sum addons) mensuel
 * - cycle 'yearly'  : (plan + sum addons) × 12 × 0.85
 *
 * Les addons sans prix (ex: GPS sur devis) sont ignorés du calcul.
 *
 * Tolérant : si planId n'est pas dans le catalogue (legacy, valeur invalide),
 * renvoie des zéros au lieu de crasher. Les callers doivent eux-mêmes
 * gérer ce cas pour afficher un message si pertinent.
 */
export function getSignupTotalFcfa(
  planId: PlanId | null | undefined,
  cycle: BillingCycle,
  addonIds: AddonId[],
): { monthlyTotal: number; cycleTotal: number; planMonthly: number; addonsMonthly: number } {
  const plan = planId ? PLANS[planId] : undefined
  if (!plan) {
    return { monthlyTotal: 0, cycleTotal: 0, planMonthly: 0, addonsMonthly: 0 }
  }
  const planMonthly = plan.priceMonthlyFcfa
  const addonsMonthly = addonIds.reduce((sum, id) => {
    const a = ADDONS[id]
    return sum + (a?.priceMonthlyFcfa ?? 0)
  }, 0)
  const monthlyTotal = planMonthly + addonsMonthly
  const cycleTotal = cycle === "yearly"
    ? Math.round(monthlyTotal * 12 * 0.85)
    : monthlyTotal
  return { monthlyTotal, cycleTotal, planMonthly, addonsMonthly }
}

/**
 * Renvoie les addons disponibles à la souscription pour un plan donné.
 * - Platinum : aucun (tout est inclus)
 * - Silver / Gold : ai_insights + ai_agent (GPS exclu — sur devis)
 */
export function getAvailableAddonsForSignup(planId: PlanId): Addon[] {
  const plan = PLANS[planId]
  if (!plan) return []
  return ADDON_ORDER
    .map(id => ADDONS[id])
    .filter(a =>
      a.priceMonthlyFcfa !== null     // exclu GPS (sur devis)
      && !plan.features[a.featureKey] // exclu si déjà inclus dans le plan
    )
}

/** Format FCFA lisible : 50000 → "50 000 FCFA" */
export function formatFcfa(amount: number): string {
  return amount.toLocaleString('fr-FR').replace(/,/g, ' ') + ' FCFA'
}
