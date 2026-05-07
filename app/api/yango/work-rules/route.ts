import { NextResponse } from "next/server"
import { ensureFeature } from "@/lib/featureGuard"
import { getYangoConfig } from "@/lib/yangoClient"

export async function GET() {
  const blocked = await ensureFeature("yango")
  if (blocked) return blocked
  try {
    const url = process.env.YANGO_WORK_RULES_URL
    if (!url) return NextResponse.json({ error: "YANGO_WORK_RULES_URL manquante" }, { status: 500 })
    const { api_key: apiKey, client_id: clid, park_id: parkId } = await getYangoConfig()

    const response = await fetch(`${url}?park_id=${parkId}`, {
      method: "GET",
      headers: {
        "X-API-Key":   apiKey,
        "X-Client-ID": clid,
        "X-Park-ID":   parkId,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data }, { status: response.status })
    }

    const rules =
      data?.rules ||
      data?.work_rules ||
      data?.items ||
      data?.result ||
      []

    return NextResponse.json(rules)
  } catch (error) {
    console.error("[work-rules]", error)
    return NextResponse.json(
      { error: `Erreur récupération work rules: ${(error as Error).message}` },
      { status: 500 }
    )
  }
}
