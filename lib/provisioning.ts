import "server-only"
import { supabaseMaster } from "./supabaseMaster"

/**
 * Helpers pour la queue de provisioning de tenants (table provisioning_jobs).
 *
 * Workflow :
 *   1. POST /api/saas/tenants  → enqueueProvisioningJob()
 *   2. after() lance kickProcessing() en background (non bloquant)
 *   3. Cron /api/cron/process-provisioning  → pickAndProcess() en boucle
 *      pour les jobs orphelins
 *
 * Le job lui-même délègue à /api/saas/tenants/[id]/sync qui contient la
 * logique idempotente de provisioning. Cette indirection permet de garder
 * compatibilité avec le polling frontend existant.
 */


// ────────── Types ──────────

export type ProvisioningJob = {
  id:              string
  tenant_id:       string
  status:          'pending' | 'processing' | 'completed' | 'failed_retryable' | 'failed_permanent'
  attempts:        number
  max_attempts:    number
  payload:         Record<string, unknown>
  error_message:   string | null
  scheduled_at:    string
  locked_at:       string | null
  locked_by:       string | null
  started_at:      string | null
  completed_at:    string | null
  created_at:      string
  updated_at:      string
}


// ────────── Enqueue ──────────

/**
 * Crée un job de provisioning pour un tenant. Idempotent : si un job
 * actif existe déjà pour ce tenant, le retourne sans rien créer.
 */
export async function enqueueProvisioningJob(
  tenantId: string,
  payload: Record<string, unknown> = {},
): Promise<ProvisioningJob> {
  // Vérifie si un job actif existe déjà
  const { data: existing } = await supabaseMaster
    .from("provisioning_jobs")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("status", ["pending", "processing", "failed_retryable"])
    .maybeSingle()

  if (existing) return existing as ProvisioningJob

  const { data, error } = await supabaseMaster
    .from("provisioning_jobs")
    .insert({
      tenant_id: tenantId,
      payload,
      status: "pending",
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Enqueue provisioning_job échoué: ${error?.message ?? "unknown"}`)
  }
  return data as ProvisioningJob
}


// ────────── Worker ──────────

/**
 * Pick un job éligible (pending ou failed_retryable dont scheduled_at est
 * dépassé) et le verrouille atomiquement. Renvoie null si rien à faire.
 *
 * Utilise la fonction SQL pick_provisioning_job() pour éviter les races.
 */
export async function pickJob(workerId: string): Promise<ProvisioningJob | null> {
  const { data, error } = await supabaseMaster.rpc("pick_provisioning_job", {
    p_locked_by: workerId,
  })

  if (error) {
    console.error("[provisioning] pickJob failed:", error.message)
    return null
  }
  if (!data) return null
  // pick_provisioning_job renvoie une seule row ou aucune
  return Array.isArray(data) ? (data[0] ?? null) : (data as ProvisioningJob)
}

/**
 * Marque un job comme complété avec succès.
 */
export async function markJobCompleted(jobId: string): Promise<void> {
  await supabaseMaster
    .from("provisioning_jobs")
    .update({
      status:       "completed",
      completed_at: new Date().toISOString(),
      locked_at:    null,
      locked_by:    null,
      error_message: null,
    })
    .eq("id", jobId)
}

/**
 * Marque un job comme échoué et calcule la prochaine tentative avec
 * back-off exponentiel : 30s × 2^attempts.
 *   attempts=1 → +30s
 *   attempts=2 → +1min
 *   attempts=3 → +2min
 *   attempts=4 → +4min
 *   attempts=5 → +8min
 *
 * Si attempts >= max_attempts, le job passe en failed_permanent (intervention
 * humaine requise).
 */
export async function markJobFailed(
  jobId: string,
  attempts: number,
  maxAttempts: number,
  errorMessage: string,
): Promise<void> {
  const isPermanent = attempts >= maxAttempts

  if (isPermanent) {
    await supabaseMaster
      .from("provisioning_jobs")
      .update({
        status:        "failed_permanent",
        error_message: errorMessage,
        locked_at:     null,
        locked_by:     null,
      })
      .eq("id", jobId)
    return
  }

  const backoffSec = 30 * Math.pow(2, attempts - 1)
  const nextAt = new Date(Date.now() + backoffSec * 1000).toISOString()

  await supabaseMaster
    .from("provisioning_jobs")
    .update({
      status:        "failed_retryable",
      error_message: errorMessage,
      scheduled_at:  nextAt,
      locked_at:     null,
      locked_by:     null,
    })
    .eq("id", jobId)
}


// ────────── Job processor (appelle /sync en interne) ──────────

/**
 * Exécute UNE itération de provisioning pour un tenant en appelant
 * l'endpoint /api/saas/tenants/[id]/sync. Renvoie { done } indiquant si
 * le tenant est en état terminal (ready ou failed) ou s'il faut retenter.
 *
 * Cette indirection HTTP a deux avantages :
 *   - réutilise toute la logique idempotente déjà testée de /sync
 *   - permet au frontend de faire le même appel sans dupliquer le code
 */
async function callSyncEndpoint(tenantId: string): Promise<{ done: boolean; error?: string }> {
  const baseUrl = process.env.SITE_BASE_URL || process.env.VERCEL_URL || "http://localhost:3000"
  const url = baseUrl.startsWith("http") ? `${baseUrl}/api/saas/tenants/${tenantId}/sync` : `https://${baseUrl}/api/saas/tenants/${tenantId}/sync`

  const internalToken = process.env.INTERNAL_WORKER_TOKEN
  if (!internalToken) {
    throw new Error("INTERNAL_WORKER_TOKEN manquant — impossible d'appeler /sync depuis le worker")
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${internalToken}`,
      "x-internal-worker": "1",
    },
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => "")
    throw new Error(`Sync HTTP ${res.status}: ${txt.slice(0, 300)}`)
  }
  const json = await res.json() as { done?: boolean; error?: string; message?: string }
  return { done: json.done === true, error: json.error || (json.done ? undefined : json.message) }
}

/**
 * Traite UN job complet : appelle /sync en boucle (interval 6s) jusqu'à
 * done=true ou jusqu'au timeout interne du job (60s).
 *
 * Si done=true sans erreur → markJobCompleted
 * Si done=true avec erreur → markJobFailed (le tenant est en 'failed')
 * Si timeout → markJobFailed retryable (le cron retentera)
 */
export async function processJob(job: ProvisioningJob): Promise<void> {
  const TIMEOUT_MS  = 60_000
  const INTERVAL_MS = 6_000
  const startedAt = Date.now()

  try {
    while (Date.now() - startedAt < TIMEOUT_MS) {
      const result = await callSyncEndpoint(job.tenant_id)

      if (result.done) {
        if (result.error) {
          await markJobFailed(job.id, job.attempts, job.max_attempts, result.error)
        } else {
          await markJobCompleted(job.id)
        }
        return
      }

      await new Promise(r => setTimeout(r, INTERVAL_MS))
    }

    // Timeout — relâche pour que le cron retente
    await markJobFailed(
      job.id,
      job.attempts,
      job.max_attempts,
      `Worker timeout après ${TIMEOUT_MS}ms — projet Supabase pas encore prêt`,
    )
  } catch (e) {
    await markJobFailed(job.id, job.attempts, job.max_attempts, (e as Error).message)
  }
}

/**
 * Pick & process un seul job. Renvoie true si un job a été traité,
 * false si rien à faire. Utilisé par le cron en boucle (jusqu'à N jobs
 * par invocation pour ne pas dépasser le timeout Vercel).
 */
export async function pickAndProcessOne(workerId: string): Promise<boolean> {
  const job = await pickJob(workerId)
  if (!job) return false
  await processJob(job)
  return true
}


// ────────── Worker ID ──────────

/** Génère un identifiant unique pour cette instance de worker. */
export function makeWorkerId(): string {
  return `worker-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`
}
