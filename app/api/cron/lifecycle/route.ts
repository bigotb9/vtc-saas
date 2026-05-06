import { NextRequest, NextResponse } from "next/server"
import { cleanupAbandonedSignups, scanSubscriptionLifecycle } from "@/lib/lifecycle"

/**
 * GET /api/cron/lifecycle
 *
 * Cron Vercel quotidien (voir vercel.json) qui exécute :
 *   1. scanSubscriptionLifecycle() — rappels J-7/J-3, expiration, suspension, archivage
 *   2. cleanupAbandonedSignups() — archive les signups jamais payés > 7 jours
 *
 * Auth : Vercel Cron envoie Authorization: Bearer <CRON_SECRET>.
 */

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET non configuré" }, { status: 500 })
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const startedAt = Date.now()

  const lifecycleResult = await scanSubscriptionLifecycle()
  const signupsResult = await cleanupAbandonedSignups()

  return NextResponse.json({
    elapsed_ms: Date.now() - startedAt,
    lifecycle:  lifecycleResult,
    signups:    signupsResult,
  })
}
