import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { ensureFeature } from "@/lib/featureGuard"
import { getYangoConfig } from "@/lib/yangoClient"

export async function POST(req: NextRequest) {
  const blocked = await ensureFeature("yango")
  if (blocked) return blocked
  try {
    const url = process.env.YANGO_CREATE_DRIVER_URL
    if (!url) return NextResponse.json({ success: false, error: "YANGO_CREATE_DRIVER_URL manquante" }, { status: 500 })
    const { api_key: apiKey, client_id: clid, park_id: parkId } = await getYangoConfig()

    const body = await req.json()

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type":        "application/json",
        "X-API-Key":           apiKey,
        "X-Client-ID":         clid,
        "X-Park-ID":           parkId,
        "X-Idempotency-Token": randomUUID(),
      },
      body: JSON.stringify(body),
    })

    let data: Record<string, unknown>
    try {
      data = await response.json()
    } catch {
      return NextResponse.json(
        { success: false, error: `Réponse invalide de l'API Yango (HTTP ${response.status})` },
        { status: response.status }
      )
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: (data?.message as string) || JSON.stringify(data) },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true, driver_id: data.id ?? data.driver_profile_id })
  } catch (error) {
    console.error("[create-driver]", error)
    return NextResponse.json(
      { success: false, error: `Erreur serveur : ${(error as Error).message}` },
      { status: 500 }
    )
  }
}
