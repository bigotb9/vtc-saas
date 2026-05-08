import { NextRequest, NextResponse } from "next/server"
import { getTenantAdmin, getCurrentTenant } from "@/lib/supabaseTenant"
import { buildSyscohadaLines, exportSyscohadaCsv } from "@/lib/syscohada"

/**
 * GET /api/syscohada/export?from=YYYY-MM-DD&to=YYYY-MM-DD&lang=fr|en
 *
 * Génère un export CSV SYSCOHADA (OHADA) pour la période spécifiée.
 * Charge les recettes Wave et dépenses du tenant pour construire
 * le journal comptable double-entrée.
 */
export async function GET(req: NextRequest) {
  const tenant = await getCurrentTenant()
  if (!tenant) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const now  = new Date()
  const from = searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to   = searchParams.get("to")   ?? now.toISOString().slice(0, 10)
  const lang = (searchParams.get("lang") ?? "fr") as "fr" | "en"

  try {
    const sb = await getTenantAdmin()

    const [recettesR, depensesR] = await Promise.all([
      sb.from("recettes_wave")
        .select("Horodatage, \"Montant net\", telephone_chauffeur")
        .gte("Horodatage", from)
        .lte("Horodatage", to + "T23:59:59"),
      sb.from("depenses_vehicules")
        .select("categorie, montant, description, date")
        .gte("date", from)
        .lte("date", to),
    ])

    const recettes = (recettesR.data ?? []).map((r, i) => ({
      date:      (r.Horodatage as string).slice(0, 10),
      chauffeur: r.telephone_chauffeur as string | undefined,
      montant:   Number(r["Montant net"]) || 0,
      piece:     `R${String(i + 1).padStart(4, "0")}`,
    }))

    const depenses = (depensesR.data ?? []).map((d, i) => ({
      date:        d.date as string,
      type:        d.categorie as string | null,
      description: d.description as string | undefined,
      montant:     Number(d.montant) || 0,
      piece:       `D${String(i + 1).padStart(4, "0")}`,
    }))

    const lines = buildSyscohadaLines({ recettes, depenses })
    const csv   = exportSyscohadaCsv(lines, tenant.nom, { from, to }, lang)

    const filename = `syscohada_${tenant.slug}_${from}_${to}.csv`
    return new NextResponse(csv, {
      headers: {
        "Content-Type":        "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: `Export SYSCOHADA échoué : ${(e as Error).message}` },
      { status: 500 },
    )
  }
}
