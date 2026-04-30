-- ============================================================
-- Master DB schema — Tour de contrôle vtc-saas
-- ============================================================
--
-- Cette base est SÉPARÉE des bases clients. Elle stocke :
--   - le registre des tenants (clients)
--   - les credentials Supabase de chaque base client
--   - les logs de provisioning
--   - la liste des admins SaaS (toi + futurs collègues)
--
-- À exécuter UNE SEULE FOIS sur le projet Supabase master (pas sur les
-- bases clients).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ────────── tenants ──────────
-- Un tenant = un client qui utilise la plateforme avec sa propre base.

CREATE TABLE public.tenants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  slug                  TEXT UNIQUE NOT NULL,        -- e.g. "boyah-group", utilisé pour le sous-domaine
  nom                   TEXT NOT NULL,                -- nom affiché
  email_admin           TEXT NOT NULL,                -- email du contact principal côté client

  -- Coordonnées du projet Supabase de ce tenant
  supabase_project_ref  TEXT NOT NULL,                -- ref du projet (ex: "iixpsfsqyfnllggvsvfl")
  supabase_url          TEXT NOT NULL,
  supabase_anon_key     TEXT NOT NULL,
  supabase_service_key  TEXT NOT NULL,                -- ⚠ stocké chiffré ou via Vault — voir lib/secrets

  -- Plan / facturation
  plan                  TEXT NOT NULL DEFAULT 'free'
                        CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  statut                TEXT NOT NULL DEFAULT 'active'
                        CHECK (statut IN ('active', 'suspended', 'archived')),

  -- Personnalisation (white-label)
  logo_url              TEXT,
  couleur_principale    TEXT,                          -- hex, e.g. "#6366f1"
  domaine_perso         TEXT,                          -- domaine custom, e.g. "fleet.acme.com"

  -- Modules activables par tenant
  module_yango          BOOLEAN NOT NULL DEFAULT false,
  module_wave           BOOLEAN NOT NULL DEFAULT false,
  module_ai_insights    BOOLEAN NOT NULL DEFAULT true,

  -- État du provisioning (mis à jour par le job de création)
  provisioning_status   TEXT NOT NULL DEFAULT 'pending'
                        CHECK (provisioning_status IN ('pending','creating','migrating','seeding','ready','failed')),
  provisioning_error    TEXT,

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_slug    ON public.tenants(slug);
CREATE INDEX idx_tenants_statut  ON public.tenants(statut);
CREATE INDEX idx_tenants_email   ON public.tenants(email_admin);


-- ────────── provisioning_logs ──────────
-- Trace pas-à-pas de chaque tentative de provisioning.

CREATE TABLE public.provisioning_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  step        TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('started','success','failed')),
  message     TEXT,
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prov_logs_tenant ON public.provisioning_logs(tenant_id, created_at DESC);


-- ────────── saas_admins ──────────
-- Les admins de la tour de contrôle (toi). Login via Supabase Auth de
-- la base master, puis on vérifie l'appartenance à cette table.

CREATE TABLE public.saas_admins (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  nom         TEXT,
  role        TEXT NOT NULL DEFAULT 'admin'
              CHECK (role IN ('superadmin','admin','support')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ────────── trigger updated_at ──────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ────────── RLS ──────────
-- La base master ne doit JAMAIS être accessible aux clients : seuls les
-- admins SaaS peuvent lire/écrire. La service_role key bypasse RLS donc
-- les API routes côté serveur peuvent tout faire.

ALTER TABLE public.tenants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provisioning_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_admins        ENABLE ROW LEVEL SECURITY;

-- Les admins authentifiés peuvent tout faire sur tenants et logs.
CREATE POLICY admins_all_tenants ON public.tenants
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.saas_admins))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.saas_admins));

CREATE POLICY admins_read_logs ON public.provisioning_logs
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.saas_admins));

CREATE POLICY admins_self ON public.saas_admins
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY superadmin_all ON public.saas_admins
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.saas_admins WHERE role = 'superadmin'))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.saas_admins WHERE role = 'superadmin'));
