import { NextRequest, NextResponse } from "next/server"
import { pickAndProcessOne, makeWorkerId } from "@/lib/provisioning"

/**
 * GET /api/cron/process-provisioning
 *
 * Cron Vercel qui pick et traite les jobs de provisioning. Appelé toutes
 * les minutes (voir vercel.json).
 *
 * Auth : Vercel Cron envoie automatiquement Authorization: Bearer <CRON_SECRET>.
 * On le vérifie ici pour empêcher les invocations externes.
 *
 * Limite : on traite jusqu'à 3 jobs par invocation pour ne pas dépasser le
 * timeout Vercel Hobby (10s) ou Pro (60s). Chaque processJob a un timeout
 * interne de 60s — sur Hobby, on bascule à 1 job max si nécessaire.
 */

export const maxDuration = 60     // Vercel Pro : jusqu'à 60s

const MAX_JOBS_PER_INVOCATION = 3

export async function GET(req: NextRequest) {
  // Auth Vercel Cron
  const auth = req.headers.get("authorization")
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET non configuré" }, { status: 500 })
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const workerId = makeWorkerId()
  const processed: string[] = []
  const startedAt = Date.now()

  for (let i = 0; i < MAX_JOBS_PER_INVOCATION; i++) {
    // Garde-fou : si on approche du timeout, on s'arrête
    if (Date.now() - startedAt > 50_000) break

    const did = await pickAndProcessOne(workerId)
    if (!did) break
    processed.push(workerId)
  }

  return NextResponse.json({
    worker_id:        workerId,
    jobs_processed:   processed.length,
    elapsed_ms:       Date.now() - startedAt,
  })
}
