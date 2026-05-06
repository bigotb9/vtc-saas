import SignupClient from "./SignupClient"
import { PLAN_ORDER, PLANS } from "@/lib/plans"

/**
 * Page d'inscription publique self-service.
 * - Lit ?plan= et ?cycle= depuis l'URL (préselectionnés depuis /pricing)
 * - Affiche un formulaire qui POST /api/signup
 * - Redirige ensuite vers /signup/payment (Phase 2 : Wave/Stripe)
 */

type Props = {
  searchParams: Promise<{ plan?: string; cycle?: string }>
}

export default async function SignupPage({ searchParams }: Props) {
  const sp = await searchParams
  const requestedPlan = (sp.plan && (PLAN_ORDER as string[]).includes(sp.plan))
    ? sp.plan
    : "silver"
  const requestedCycle = sp.cycle === "yearly" ? "yearly" : "monthly"

  const plans = PLAN_ORDER.map((id) => PLANS[id])
  return (
    <SignupClient
      plans={plans}
      defaultPlan={requestedPlan as keyof typeof PLANS}
      defaultCycle={requestedCycle}
    />
  )
}
