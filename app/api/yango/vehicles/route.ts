import { NextResponse } from "next/server"
import { ensureFeature } from "@/lib/featureGuard"
import { getYangoConfig } from "@/lib/yangoClient"

export async function GET() {
  const blocked = await ensureFeature("yango")
  if (blocked) return blocked
  try {
    const url = process.env.YANGO_CARS_URL
    if (!url) return NextResponse.json({ error: "YANGO_CARS_URL manquante" }, { status: 500 })
    const { api_key_cars: apiKey, client_id: clid, park_id: parkId } = await getYangoConfig()

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key":    apiKey,
        "X-Client-ID":  clid,
        "X-Park-ID":    parkId,
      },
      body: JSON.stringify({
        limit: 500,
        offset: 0,
        query: { park: { id: parkId } },
        fields: { car: ["id", "brand", "model", "number", "status", "year"] },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data }, { status: response.status })
    }

    // Normalise la réponse Yango : chaque item peut être { car: {...} } ou plat
    type CarItem = { car?: Record<string, unknown> } & Record<string, unknown>
    const cars = (data.cars || []).map((item: CarItem) => {
      const c = (item.car as Record<string, unknown>) || item
      return {
        id:     c.id,
        brand:  c.brand,
        model:  c.model,
        number: c.number,
        status: c.status,
        year:   c.year,
      }
    })

    return NextResponse.json({ cars })
  } catch (error) {
    console.error("[vehicles]", error)
    return NextResponse.json({ error: `Erreur API Yango vehicles: ${(error as Error).message}` }, { status: 500 })
  }
}
