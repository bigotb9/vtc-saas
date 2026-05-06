-- ============================================================
-- Master DB — Migration 0005 : Email log
-- ============================================================
--
-- Trace tous les emails envoyés par la plateforme (transactionnels via
-- Resend). Permet de :
--   - vérifier qu'un email a bien été envoyé (debug client support)
--   - éviter les doublons (idempotence par dedup_key)
--   - retrier les envois échoués (status='failed')
--
-- En mode stub (pas de Resend configuré), les emails sont juste loggés
-- ici sans envoi effectif, ce qui permet de tester tout le flow sans clé
-- API.
-- ============================================================

CREATE TABLE public.email_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE SET NULL,

  -- Destinataire
  to_email        TEXT NOT NULL,
  to_name         TEXT,

  -- Template
  template        TEXT NOT NULL,                -- 'welcome', 'invoice_paid', 'expiration_reminder', etc.
  subject         TEXT NOT NULL,
  html_body       TEXT,
  text_body       TEXT,

  -- État envoi
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','failed','skipped')),
  provider        TEXT,                          -- 'resend', 'stub'
  provider_message_id TEXT,                      -- ID retourné par Resend
  error_message   TEXT,

  -- Idempotence : si on retente d'envoyer un email avec le même dedup_key,
  -- on retourne le résultat existant au lieu de doublonner.
  -- Ex: dedup_key = 'welcome-<tenant_id>' pour le welcome email.
  dedup_key       TEXT UNIQUE,

  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_log_tenant   ON public.email_log(tenant_id, created_at DESC);
CREATE INDEX idx_email_log_status   ON public.email_log(status);


CREATE TRIGGER email_log_updated_at
  BEFORE UPDATE ON public.email_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ────────── RLS ──────────

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_log_admin_all ON public.email_log
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.saas_admins))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.saas_admins));
