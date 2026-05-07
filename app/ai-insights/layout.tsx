import type { Metadata } from "next"
import { getCurrentTenant } from "@/lib/supabaseTenant"
import { loadTenantPlanContext } from "@/lib/plansServer"
import { hasFeature } from "@/lib/plans"
import { UpgradePrompt } from "@/components/RequireFeature"

export const metadata: Metadata = { title: "AI Insights" }

/**
 * Garde feature "ai_insights" pour /ai-insights.
 * Inclus dans Platinum, addon pour Silver/Gold.
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant()
  if (!tenant) return <>{children}</>

  const ctx = await loadTenantPlanContext(tenant.id)
  if (!hasFeature(ctx, "ai_insights")) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <UpgradePrompt feature="ai_insights" />
      </div>
    )
  }

  return <>{children}</>
}
