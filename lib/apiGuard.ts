import "server-only"
import { NextResponse } from "next/server"
import { FeatureLockedError, QuotaExceededError } from "./plansServer"

/**
 * Helpers serveur pour transformer les erreurs typées du système de plans
 * en réponses HTTP cohérentes. À utiliser dans les API routes pour éviter
 * de répéter la gestion d'erreur partout.
 *
 * Codes HTTP choisis :
 *   - 402 Payment Required : quota dépassé ou feature non payée
 *   - 403 Forbidden        : feature désactivée par override admin
 *
 * Le frontend peut switcher sur le champ `error.code` (FEATURE_LOCKED,
 * QUOTA_EXCEEDED) pour afficher le bon CTA.
 */

export type ApiErrorPayload = {
  error:    string
  code?:    string
  feature?: string
  kind?:    string
  current?: number
  limit?:   number
}

/**
 * Renvoie une NextResponse adaptée si l'erreur est une erreur de plan,
 * sinon renvoie null (au caller de gérer).
 */
export function planErrorResponse(err: unknown): NextResponse<ApiErrorPayload> | null {
  if (err instanceof FeatureLockedError) {
    return NextResponse.json(
      { error: err.message, code: err.code, feature: err.feature },
      { status: 402 },
    )
  }
  if (err instanceof QuotaExceededError) {
    return NextResponse.json(
      {
        error:   err.message,
        code:    err.code,
        kind:    err.kind,
        current: err.current,
        limit:   err.limit,
      },
      { status: 402 },
    )
  }
  return null
}

/**
 * Wrap un handler d'API route Next.js pour catcher les erreurs de plan
 * automatiquement. Les autres erreurs sont rejetées (le handler par défaut
 * de Next renverra 500).
 *
 * Usage :
 *   export const POST = withPlanGuard(async (req) => {
 *     await enforceCurrentTenantQuota('vehicules')
 *     // ... insert
 *     return NextResponse.json({ ok: true })
 *   })
 */
export function withPlanGuard<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse> | NextResponse,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (err) {
      const planResp = planErrorResponse(err)
      if (planResp) return planResp
      throw err
    }
  }
}
