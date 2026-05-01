export const dynamic = 'force-dynamic'

import { getTenantAdmin } from "@/lib/supabaseTenant"
import RecettesPageClient from "@/components/RecettesPageClient"

export default async function RecettesPage() {
  const supabase = await getTenantAdmin()
  const { data: recettes } = await supabase
    .from("vue_recettes_vehicules")
    .select("*")
    .order("Horodatage", { ascending: false })

  return <RecettesPageClient recettes={recettes || []} />
}
