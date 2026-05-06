import { NextRequest, NextResponse } from "next/server"
import { requireSaasAdmin } from "@/lib/saasAuth"
import { computeSaasMetrics } from "@/lib/saasMetrics"

/**
 * GET /api/saas/metrics
 *
 * Renvoie les KPIs business pour le dashboard SaaS admin.
 */

export async function GET(req: NextRequest) {
  const admin = await requireSaasAdmin(req)
  if (admin instanceof NextResponse) return admin

  const metrics = await computeSaasMetrics()
  return NextResponse.json(metrics)
}
