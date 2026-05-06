import PricingClient from "./PricingClient"
import { ADDON_ORDER, ADDONS, PLAN_ORDER, PLANS } from "@/lib/plans"

/**
 * Page pricing publique. Le toggle mensuel/annuel et les CTA sont gérés
 * en client (PricingClient). Le catalogue des plans/addons est passé en
 * props depuis lib/plans.ts (miroir du seed SQL).
 */

export default function PricingPage() {
  const plans = PLAN_ORDER.map((id) => PLANS[id])
  const addons = ADDON_ORDER.map((id) => ADDONS[id])
  return <PricingClient plans={plans} addons={addons} />
}
