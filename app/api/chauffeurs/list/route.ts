import { NextResponse } from "next/server"
import { getTenantAdmin } from "@/lib/supabaseTenant"

export async function GET() {
  const supabase = await getTenantAdmin()
  const { data, error } = await supabase
    .from("chauffeurs")
    .select("id_chauffeur, nom, actif, photo")
    .order("nom")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ chauffeurs: data || [] })
}
