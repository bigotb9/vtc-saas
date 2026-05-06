import "server-only"
import { supabaseMaster } from "@/lib/supabaseMaster"
import { ADDONS, type AddonId } from "@/lib/plans"

/**
 * Active les addons cochés au signup sur une subscription qui vient d'être
 * créée. Idempotent : si une ligne subscription_addons (id+addon, active)
 * existe déjà, le UNIQUE index empêche le doublon (on ignore l'erreur).
 *
 * Lit signup_data.addons sur le tenant et insère une ligne par addon.
 */

export async function activateSignupAddons(opts: {
  tenantId:       string
  subscriptionId: string
}): Promise<{ activated: AddonId[]; skipped: string[] }> {
  const { data: tenant } = await supabaseMaster
    .from("tenants")
    .select("signup_data")
    .eq("id", opts.tenantId)
    .maybeSingle()

  const signupData = (tenant?.signup_data as Record<string, unknown> | null) ?? {}
  const requested = (signupData.addons as string[] | undefined) ?? []

  const activated: AddonId[] = []
  const skipped: string[] = []

  for (const id of requested) {
    const addon = ADDONS[id as AddonId]
    if (!addon || addon.priceMonthlyFcfa === null) {
      skipped.push(id)
      continue
    }

    const { error } = await supabaseMaster
      .from("subscription_addons")
      .insert({
        subscription_id: opts.subscriptionId,
        addon_id:        id,
        amount_fcfa:     addon.priceMonthlyFcfa,
      })

    if (error) {
      // Tolère "duplicate key" (idempotence — déjà actif sur cette sub)
      if (/duplicate|already exists|unique/i.test(error.message)) {
        skipped.push(id)
        continue
      }
      console.error(`[subscriptionAddons] insert ${id} failed:`, error.message)
      skipped.push(id)
      continue
    }
    activated.push(id as AddonId)
  }

  return { activated, skipped }
}
