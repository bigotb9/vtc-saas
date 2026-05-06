-- ============================================================
-- Master DB — Migration 0003 : Queue de provisioning async
-- ============================================================
--
-- Le provisioning d'un tenant (création projet Supabase + migrations +
-- récupération keys + seed) prend 60-180 secondes — bien au-delà du timeout
-- HTTP standard. Cette migration introduit une queue persistante pour
-- découpler la création du tenant de son provisioning effectif.
--
-- Workflow :
--   1. POST /api/saas/tenants  → INSERT tenant + INSERT provisioning_job
--      (réponse 202 immédiate)
--   2. Background worker (after()) traite le job dans les ms suivantes
--   3. Cron Vercel /api/cron/process-provisioning retente les jobs
--      'failed_retryable' avec back-off exponentiel
--
-- Les détails pas-à-pas vont toujours dans provisioning_logs (table 0001).
-- provisioning_jobs = "ce qu'il reste à faire", logs = "ce qui a été fait".
-- ============================================================


-- ────────── provisioning_jobs ──────────

CREATE TABLE public.provisioning_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- État du job dans la queue.
  --   pending           : créé, en attente d'un worker
  --   processing        : worker en train de l'exécuter (locked)
  --   completed         : terminé avec succès, peut être archivé
  --   failed_retryable  : échec transitoire, sera retenté par le cron
  --   failed_permanent  : échec définitif, intervention humaine requise
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processing','completed','failed_retryable','failed_permanent')),

  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,

  -- Payload nécessaire pour exécuter le job (db_password, region, etc.).
  -- Le mot de passe DB est stocké chiffré côté code applicatif.
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,

  error_message   TEXT,

  -- Quand le job est éligible pour exécution. Sert au back-off : en cas
  -- d'échec, on repousse scheduled_at de 30s × 2^attempts.
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Locking (évite que 2 workers pickent le même job)
  locked_at       TIMESTAMPTZ,
  locked_by       TEXT,                                 -- worker id (random)

  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scan du cron : trouve rapidement les jobs à exécuter.
CREATE INDEX idx_prov_jobs_pickable
  ON public.provisioning_jobs(status, scheduled_at)
  WHERE status IN ('pending','failed_retryable');

CREATE INDEX idx_prov_jobs_tenant ON public.provisioning_jobs(tenant_id);

-- Un seul job actif par tenant à la fois (évite les doublons en cas de
-- retry mal ordonné côté API).
CREATE UNIQUE INDEX idx_prov_jobs_tenant_active
  ON public.provisioning_jobs(tenant_id)
  WHERE status IN ('pending','processing','failed_retryable');


-- ────────── trigger updated_at ──────────

CREATE TRIGGER provisioning_jobs_updated_at
  BEFORE UPDATE ON public.provisioning_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ────────── RLS ──────────

ALTER TABLE public.provisioning_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY prov_jobs_admin_all ON public.provisioning_jobs
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.saas_admins))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.saas_admins));


-- ────────── Helper SQL : pick_provisioning_job ──────────
-- Sélectionne UN job éligible et le verrouille atomiquement.
-- Utilisé par le worker pour éviter les races sur SELECT FOR UPDATE.
-- Renvoie la ligne complète du job sélectionné, ou aucune ligne si rien à faire.

CREATE OR REPLACE FUNCTION public.pick_provisioning_job(p_locked_by TEXT)
RETURNS public.provisioning_jobs
LANGUAGE plpgsql
AS $$
DECLARE
  job public.provisioning_jobs;
BEGIN
  SELECT *
  INTO   job
  FROM   public.provisioning_jobs
  WHERE  status IN ('pending','failed_retryable')
    AND  scheduled_at <= now()
    -- Reprend les jobs verrouillés depuis plus de 5 min (worker mort)
    AND  (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
  ORDER BY scheduled_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.provisioning_jobs
  SET    status     = 'processing',
         locked_at  = now(),
         locked_by  = p_locked_by,
         started_at = COALESCE(started_at, now()),
         attempts   = attempts + 1,
         updated_at = now()
  WHERE  id = job.id
  RETURNING * INTO job;

  RETURN job;
END;
$$;
