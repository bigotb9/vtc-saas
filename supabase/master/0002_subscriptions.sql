-- ============================================================
-- Master DB — Migration 0002 : Plans, abonnements, factures
-- ============================================================
--
-- Cette migration ajoute la couche commerciale SaaS au schéma master :
--   - plans               : catalogue Silver / Gold / Platinum
--   - addons              : options activables (AI Insights, Agent IA, GPS)
--   - subscriptions       : un abonnement actif par tenant
--   - subscription_addons : liens abonnements ↔ addons activés
--   - invoices            : factures émises (1 par cycle)
--   - payment_attempts    : journal des tentatives de paiement (Wave/Stripe)
--
-- Modifie la table tenants existante pour pointer vers l'abonnement actif.
--
-- À exécuter sur le projet Supabase MASTER uniquement (pas sur les bases
-- clients).
-- ============================================================


-- ────────── plans ──────────
-- Catalogue des plans commerciaux. Seedé en bas de fichier.
-- L'id est un slug stable utilisé partout dans le code (ex: 'silver').

CREATE TABLE public.plans (
  id                    TEXT PRIMARY KEY,                -- 'silver' | 'gold' | 'platinum'
  name                  TEXT NOT NULL,                   -- 'Silver', 'Gold', 'Platinum'
  description           TEXT,

  -- Tarifs en FCFA (XOF). Source de vérité = mensuel ; annuel = -15% appliqué côté code.
  price_monthly_fcfa    INTEGER NOT NULL,
  price_yearly_fcfa     INTEGER NOT NULL,                -- snapshot du prix annuel (mensuel × 12 × 0.85)

  -- Quotas. NULL = illimité.
  max_vehicules         INTEGER,                         -- 15 / 40 / NULL
  max_users             INTEGER,                         -- 3 / 8 / NULL

  -- Features incluses (booléens). Voir lib/plans.ts pour la liste exhaustive.
  --   { dashboard, alertes, vehicules, chauffeurs, recettes, depenses, wave,
  --     yango, pdf_reports, fleet_clients, ai_insights, ai_agent, gps }
  features              JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Affichage
  display_order         INTEGER NOT NULL DEFAULT 0,
  is_public             BOOLEAN NOT NULL DEFAULT true,    -- false = plan legacy non listé sur /pricing

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ────────── addons ──────────
-- Options activables en plus du plan (Silver/Gold n'ont pas l'AI Insights par
-- défaut → addon payant). Platinum les inclut → pas de ligne addon créée.

CREATE TABLE public.addons (
  id                    TEXT PRIMARY KEY,                -- 'ai_insights' | 'ai_agent' | 'gps'
  name                  TEXT NOT NULL,
  description           TEXT,

  price_monthly_fcfa    INTEGER,                         -- NULL = sur devis (cas du GPS)
  feature_key           TEXT NOT NULL,                   -- clé de la feature débloquée (ex: 'ai_insights')

  display_order         INTEGER NOT NULL DEFAULT 0,
  is_public             BOOLEAN NOT NULL DEFAULT true,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ────────── subscriptions ──────────
-- Un abonnement actif par tenant. Un tenant peut avoir plusieurs lignes au
-- cours du temps (historique d'upgrade/downgrade), mais une seule active.

CREATE TABLE public.subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id                  TEXT NOT NULL REFERENCES public.plans(id),

  status                   TEXT NOT NULL DEFAULT 'trialing'
                           CHECK (status IN ('trialing','active','past_due','suspended','canceled','archived')),
  billing_cycle            TEXT NOT NULL DEFAULT 'monthly'
                           CHECK (billing_cycle IN ('monthly','yearly')),

  -- Snapshot du prix au moment de la souscription (grandfathering si on change
  -- les prix du catalogue ensuite).
  amount_fcfa              INTEGER NOT NULL,

  -- Période courante
  started_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_start     TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end       TIMESTAMPTZ NOT NULL,

  -- Annulation programmée (le client annule mais l'abo reste actif jusqu'à la
  -- fin de la période payée).
  cancel_at_period_end     BOOLEAN NOT NULL DEFAULT false,
  canceled_at              TIMESTAMPTZ,

  -- Provider externe (paiement)
  provider                 TEXT NOT NULL DEFAULT 'manual'
                           CHECK (provider IN ('wave','stripe','manual')),
  provider_subscription_id TEXT,                          -- ID externe (sub_xxx pour Stripe)

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subs_tenant   ON public.subscriptions(tenant_id);
CREATE INDEX idx_subs_status   ON public.subscriptions(status);
CREATE INDEX idx_subs_period   ON public.subscriptions(current_period_end);

-- Un seul abonnement non-archivé/non-canceled par tenant à la fois.
CREATE UNIQUE INDEX idx_subs_tenant_active
  ON public.subscriptions(tenant_id)
  WHERE status NOT IN ('canceled','archived');


-- ────────── subscription_addons ──────────
-- Lignes d'addons activés sur un abonnement. Historique conservé
-- (deactivated_at != NULL = addon désactivé).

CREATE TABLE public.subscription_addons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id     UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  addon_id            TEXT NOT NULL REFERENCES public.addons(id),

  amount_fcfa         INTEGER NOT NULL,                   -- snapshot du prix de l'addon

  activated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at      TIMESTAMPTZ,                        -- NULL = addon actif

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_addons_sub ON public.subscription_addons(subscription_id);

-- Un addon ne peut être actif (deactivated_at IS NULL) qu'une seule fois par
-- subscription.
CREATE UNIQUE INDEX idx_sub_addons_unique_active
  ON public.subscription_addons(subscription_id, addon_id)
  WHERE deactivated_at IS NULL;


-- ────────── invoices ──────────
-- Factures émises (1 par cycle de facturation). Le PDF est généré côté app
-- et stocké dans Supabase Storage du master.

CREATE TABLE public.invoices (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id      UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
  tenant_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,

  invoice_number       TEXT UNIQUE NOT NULL,              -- 'INV-2026-00001' (auto-généré côté code)

  amount_fcfa          INTEGER NOT NULL,
  currency             TEXT NOT NULL DEFAULT 'XOF',

  status               TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','open','paid','uncollectible','void')),

  -- Détail des lignes (plan + addons + remises éventuelles)
  -- Ex: [{label: 'Plan Silver mensuel', amount_fcfa: 50000}, {label: 'AI Insights', amount_fcfa: 15000}]
  line_items           JSONB NOT NULL DEFAULT '[]'::jsonb,

  issued_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at               TIMESTAMPTZ NOT NULL,
  paid_at              TIMESTAMPTZ,

  pdf_url              TEXT,                              -- Supabase Storage public URL

  -- Provider externe
  provider             TEXT NOT NULL DEFAULT 'manual'
                       CHECK (provider IN ('wave','stripe','manual')),
  provider_invoice_id  TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_tenant ON public.invoices(tenant_id, issued_at DESC);
CREATE INDEX idx_invoices_sub    ON public.invoices(subscription_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);


-- ────────── payment_attempts ──────────
-- Journal de toutes les tentatives de paiement (succès ET échecs). Sert à
-- diagnostiquer les paiements échoués et à ne pas spammer le client en cas
-- de retry.

CREATE TABLE public.payment_attempts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id           UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,

  attempted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount_fcfa          INTEGER NOT NULL,

  provider             TEXT NOT NULL CHECK (provider IN ('wave','stripe','manual')),
  status               TEXT NOT NULL CHECK (status IN ('success','failed','pending')),

  provider_reference   TEXT,                              -- ID externe de la transaction
  error_message        TEXT,
  raw_response         JSONB,                             -- payload brut du provider (debug)

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pay_attempts_invoice ON public.payment_attempts(invoice_id, attempted_at DESC);


-- ────────── modifications de tenants ──────────
-- L'ancien champ `plan` (TEXT free/starter/pro/enterprise) est obsolète : le
-- plan vient désormais de la subscription active. On le rend nullable et on
-- enlève la contrainte CHECK pour permettre la migration progressive.
-- Il sera DROP en migration 0003 une fois le code applicatif migré.

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_plan_check;

ALTER TABLE public.tenants
  ALTER COLUMN plan DROP NOT NULL,
  ALTER COLUMN plan DROP DEFAULT;

-- Pointeurs dénormalisés vers la subscription active (perf : évite un join
-- systématique à chaque lecture tenant).
ALTER TABLE public.tenants
  ADD COLUMN current_subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN current_plan_id         TEXT REFERENCES public.plans(id) ON DELETE SET NULL;

-- Overrides manuels par admin SaaS (gratuité, exception, support).
-- Ex: { "ai_agent": true } pour activer l'agent IA chez un tenant Silver.
ALTER TABLE public.tenants
  ADD COLUMN feature_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;


-- ────────── triggers updated_at ──────────
-- Réutilise la fonction set_updated_at() définie en migration 0001.

CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER addons_updated_at
  BEFORE UPDATE ON public.addons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ────────── RLS ──────────
-- Mêmes règles que migration 0001 : seuls les saas_admins peuvent lire/écrire
-- depuis l'app cliente. La service_role (côté API routes) bypasse RLS.

ALTER TABLE public.plans                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_addons  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts     ENABLE ROW LEVEL SECURITY;

-- Plans et addons : lecture publique (la landing /pricing les affiche en
-- anon — donc on autorise le SELECT pour anon ET authenticated, sur les
-- lignes is_public = true uniquement).
CREATE POLICY plans_public_read ON public.plans
  FOR SELECT TO anon, authenticated
  USING (is_public = true);

CREATE POLICY addons_public_read ON public.addons
  FOR SELECT TO anon, authenticated
  USING (is_public = true);

-- Plans et addons : écriture admins uniquement.
CREATE POLICY plans_admin_write ON public.plans
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.saas_admins))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.saas_admins));

CREATE POLICY addons_admin_write ON public.addons
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.saas_admins))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.saas_admins));

-- Subscriptions, addons activés, factures, payment_attempts : admins SaaS
-- only (le portail client passe par les API routes côté serveur avec service
-- role).
CREATE POLICY subs_admin_all ON public.subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.saas_admins))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.saas_admins));

CREATE POLICY sub_addons_admin_all ON public.subscription_addons
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.saas_admins))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.saas_admins));

CREATE POLICY invoices_admin_all ON public.invoices
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.saas_admins))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.saas_admins));

CREATE POLICY pay_attempts_admin_all ON public.payment_attempts
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.saas_admins))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.saas_admins));


-- ============================================================
-- SEED — Catalogue plans & addons
-- ============================================================
-- Contenu du document de cadrage (Mai 2026). Modifiable plus tard via le
-- portail admin SaaS.

INSERT INTO public.plans (id, name, description, price_monthly_fcfa, price_yearly_fcfa, max_vehicules, max_users, features, display_order, is_public) VALUES

('silver',
 'Silver',
 'Pour les petites flottes qui démarrent — gestion essentielle + Wave inclus.',
 50000,
 510000,                 -- 50000 × 12 × 0.85 = 510 000
 15,
 3,
 jsonb_build_object(
   'dashboard',     true,
   'alertes',       true,
   'vehicules',     true,
   'chauffeurs',    true,
   'recettes',      true,
   'depenses',      true,
   'wave',          true,
   'yango',         false,
   'pdf_reports',   false,
   'fleet_clients', false,
   'ai_insights',   false,
   'ai_agent',      false,
   'gps',           false
 ),
 1,
 true),

('gold',
 'Gold',
 'Pour les flottes en croissance — Yango, gestion clients tiers, rapports PDF.',
 100000,
 1020000,                -- 100000 × 12 × 0.85 = 1 020 000
 40,
 8,
 jsonb_build_object(
   'dashboard',     true,
   'alertes',       true,
   'vehicules',     true,
   'chauffeurs',    true,
   'recettes',      true,
   'depenses',      true,
   'wave',          true,
   'yango',         true,
   'pdf_reports',   true,
   'fleet_clients', true,
   'ai_insights',   false,
   'ai_agent',      false,
   'gps',           false
 ),
 2,
 true),

('platinum',
 'Platinum',
 'Pour les grandes flottes — tout inclus, IA et agent VTC personnalisé.',
 200000,
 2040000,                -- 200000 × 12 × 0.85 = 2 040 000
 NULL,                   -- illimité
 NULL,                   -- illimité
 jsonb_build_object(
   'dashboard',     true,
   'alertes',       true,
   'vehicules',     true,
   'chauffeurs',    true,
   'recettes',      true,
   'depenses',      true,
   'wave',          true,
   'yango',         true,
   'pdf_reports',   true,
   'fleet_clients', true,
   'ai_insights',   true,
   'ai_agent',      true,
   'gps',           false
 ),
 3,
 true);


INSERT INTO public.addons (id, name, description, price_monthly_fcfa, feature_key, display_order, is_public) VALUES

('ai_insights',
 'AI Insights',
 'Détection automatique des chauffeurs à risque et messages WhatsApp pré-rédigés.',
 15000,
 'ai_insights',
 1,
 true),

('ai_agent',
 'Agent IA VTC personnalisé',
 'Spécialiste VTC intégré — conseils stratégiques, automatisations, alertes intelligentes.',
 50000,
 'ai_agent',
 2,
 true),

('gps',
 'Intégration GPS',
 'Suivi temps réel des véhicules. Tarif sur devis selon le matériel choisi.',
 NULL,                   -- sur devis
 'gps',
 3,
 true);
