-- ============================================================
-- Master DB — Migration 0004 : Champs signup self-service
-- ============================================================
--
-- Permet de créer un tenant DÈS l'inscription (avant paiement) en mode
-- 'awaiting_payment'. Quand le paiement est confirmé (Phase 2), le tenant
-- bascule en 'creating' et le provisioning Supabase démarre.
--
-- Workflow signup :
--   1. POST /api/signup → INSERT tenant (provisioning_status='awaiting_payment')
--      + signup_data (jsonb : phone, country, expected_vehicles, ...)
--      + signup_plan_id, signup_billing_cycle
--   2. Redirect /signup/payment → checkout Wave ou Stripe
--   3. Webhook paiement → UPDATE tenant ('creating') + INSERT subscription
--      + INSERT provisioning_job
--
-- Un cron archive les tenants en 'awaiting_payment' depuis > 24h pour
-- libérer le slug s'il n'a pas été payé.
-- ============================================================


-- ────────── Étend le CHECK provisioning_status ──────────

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_provisioning_status_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_provisioning_status_check
  CHECK (provisioning_status IN (
    'awaiting_payment',     -- nouveau : inscrit mais pas encore payé
    'pending',
    'creating',
    'migrating',
    'seeding',
    'ready',
    'failed'
  ));


-- ────────── Colonnes signup ──────────

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS signup_data         JSONB,             -- phone, country, expected_vehicles, etc.
  ADD COLUMN IF NOT EXISTS signup_plan_id      TEXT REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS signup_billing_cycle TEXT
    CHECK (signup_billing_cycle IS NULL OR signup_billing_cycle IN ('monthly','yearly')),
  ADD COLUMN IF NOT EXISTS signup_completed_at TIMESTAMPTZ;       -- timestamp paiement confirmé


-- ────────── Les credentials Supabase deviennent NULL-able ──────────
-- Avant cette migration, tous les champs supabase_* étaient NOT NULL avec
-- des placeholders 'pending'. Pour un tenant en awaiting_payment, le projet
-- Supabase n'existe pas encore — donc on relâche la contrainte.

ALTER TABLE public.tenants
  ALTER COLUMN supabase_project_ref DROP NOT NULL,
  ALTER COLUMN supabase_url         DROP NOT NULL,
  ALTER COLUMN supabase_anon_key    DROP NOT NULL,
  ALTER COLUMN supabase_service_key DROP NOT NULL;
