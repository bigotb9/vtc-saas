import { getCurrentTenant } from "@/lib/supabaseTenant"
import { loadTenantPlanContext } from "@/lib/plansServer"
import { hasFeature } from "@/lib/plans"
import { UpgradePrompt } from "@/components/RequireFeature"

/**
 * Garde feature "yango" pour toutes les pages /boyah-transport/*.
 * Si le tenant n'a pas la feature dans son plan, on affiche un CTA upgrade
 * au lieu de la page (qui appellerait des API yango refusées en 402).
 */

export default async function BoyahTransportLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant()
  // Si pas de tenant résolu, on laisse passer — les sous-pages géreront
  // leur propre erreur. Le cas standard a un tenant via le proxy.
  if (!tenant) return <>{children}</>

  const ctx = await loadTenantPlanContext(tenant.id)
  if (!hasFeature(ctx, "yango")) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <UpgradePrompt feature="yango" />
      </div>
    )
  }

  return <>{children}</>
}
