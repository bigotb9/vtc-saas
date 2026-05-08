-- ============================================================
-- Master DB — Migration 0007 : Plans v2 (4 plans, quotas chauffeurs)
-- ============================================================
--
-- Mise à jour du catalogue des plans :
--   - Silver   : 10 véhicules, 25 chauffeurs, 3 users   — 50 000 F
--   - Gold     : 30 véhicules, 70 chauffeurs, 5 users   — 100 000 F
--   - Platinum : 150 véhicules, 350 chauffeurs, 8 users — 250 000 F  (prix revu)
--   - Platinum+: 300 véhicules, 700 chauffeurs, 10 users— 500 000 F  (nouveau)
--   >300 véhicules : sur devis
--
-- Ajout de la colonne max_chauffeurs sur la table plans.
-- ============================================================


-- ────────── Ajoute max_chauffeurs ──────────

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS max_chauffeurs INTEGER;   -- NULL = illimité


-- ────────── Mise à jour Silver ──────────

UPDATE public.plans SET
  price_monthly_fcfa = 50000,
  price_yearly_fcfa  = 510000,
  max_vehicules      = 10,
  max_chauffeurs     = 25,
  max_users          = 3,
  description        = 'Pour démarrer et gérer votre activité de transport — essentiels + Wave inclus.'
WHERE id = 'silver';


-- ────────── Mise à jour Gold ──────────

UPDATE public.plans SET
  price_monthly_fcfa = 100000,
  price_yearly_fcfa  = 1020000,
  max_vehicules      = 30,
  max_chauffeurs     = 70,
  max_users          = 5,
  description        = 'Pour les flottes en croissance avec partenariat Yango et gestion clients tiers.'
WHERE id = 'gold';


-- ────────── Mise à jour Platinum (prix + limites) ──────────

UPDATE public.plans SET
  price_monthly_fcfa = 250000,
  price_yearly_fcfa  = 2550000,
  max_vehicules      = 150,
  max_chauffeurs     = 350,
  max_users          = 8,
  description        = 'Pour les grandes flottes — IA, Agent VTC et toutes les intégrations incluses.'
WHERE id = 'platinum';


-- ────────── Insertion Platinum+ ──────────

INSERT INTO public.plans (id, name, description,
  price_monthly_fcfa, price_yearly_fcfa,
  max_vehicules, max_users, max_chauffeurs, features, display_order, is_public)
VALUES (
  'platinum_plus',
  'Platinum+',
  'Pour les très grandes flottes — limites maximales, tout inclus, support prioritaire.',
  500000,
  5100000,
  300,
  10,
  700,
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
  4,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name               = EXCLUDED.name,
  description        = EXCLUDED.description,
  price_monthly_fcfa = EXCLUDED.price_monthly_fcfa,
  price_yearly_fcfa  = EXCLUDED.price_yearly_fcfa,
  max_vehicules      = EXCLUDED.max_vehicules,
  max_users          = EXCLUDED.max_users,
  max_chauffeurs     = EXCLUDED.max_chauffeurs,
  features           = EXCLUDED.features,
  display_order      = EXCLUDED.display_order;
