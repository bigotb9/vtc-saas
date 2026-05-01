import { NextResponse } from "next/server"
import { getTenantAdmin } from "@/lib/supabaseTenant"

export async function GET() {
  const supabase = await getTenantAdmin()
  const { data, error } = await supabase
    .from("vehicules")
    .select("id_vehicule, immatriculation, type_vehicule, statut, photo")
    .order("immatriculation")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vehicules: data || [] })
}
