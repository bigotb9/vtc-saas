-- ============================================================
-- Schéma initial VTC SaaS
-- Généré automatiquement depuis le projet de prod
-- Source: iixpsfsqyfnllggvsvfl.supabase.co (schéma public)
-- Date: 2026-04-30T13:47:53.707Z
--
-- À rejouer sur chaque nouvelle base client (vide).
-- ============================================================

-- ────────── Sequences ──────────

CREATE SEQUENCE IF NOT EXISTS public."activity_logs_id_seq" AS bigint
  START WITH 1 INCREMENT BY 1
  MINVALUE 1 MAXVALUE 9223372036854775807
  CACHE 1 NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public."affectation_chauffeurs_vehicules_id_affectation_seq" AS bigint
  START WITH 1 INCREMENT BY 1
  MINVALUE 1 MAXVALUE 9223372036854775807
  CACHE 1 NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public."alertes_envoyees_id_seq" AS bigint
  START WITH 1 INCREMENT BY 1
  MINVALUE 1 MAXVALUE 9223372036854775807
  CACHE 1 NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public."chauffeurs_id_chauffeur_seq" AS bigint
  START WITH 1 INCREMENT BY 1
  MINVALUE 1 MAXVALUE 9223372036854775807
  CACHE 1 NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public."clients_id_seq" AS integer
  START WITH 1 INCREMENT BY 1
  MINVALUE 1 MAXVALUE 2147483647
  CACHE 1 NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public."entretiens_vehicules_id_seq" AS bigint
  START WITH 1 INCREMENT BY 1
  MINVALUE 1 MAXVALUE 9223372036854775807
  CACHE 1 NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public."recettes_wave_id_seq" AS bigint
  START WITH 1 INCREMENT BY 1
  MINVALUE 1 MAXVALUE 9223372036854775807
  CACHE 1 NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public."role_permissions_id_seq" AS bigint
  START WITH 1 INCREMENT BY 1
  MINVALUE 1 MAXVALUE 9223372036854775807
  CACHE 1 NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public."vehicules_id_vehicule_seq" AS bigint
  START WITH 1 INCREMENT BY 1
  MINVALUE 1 MAXVALUE 9223372036854775807
  CACHE 1 NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public."versements_chauffeurs_id_seq" AS bigint
  START WITH 1 INCREMENT BY 1
  MINVALUE 1 MAXVALUE 9223372036854775807
  CACHE 1 NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public."versements_clients_id_seq" AS integer
  START WITH 1 INCREMENT BY 1
  MINVALUE 1 MAXVALUE 2147483647
  CACHE 1 NO CYCLE;

-- ────────── Tables ──────────

CREATE TABLE public."activity_logs" (
  "id" bigint DEFAULT nextval('activity_logs_id_seq'::regclass) NOT NULL,
  "user_id" uuid,
  "user_name" text,
  "user_role" text,
  "action" text NOT NULL,
  "entity" text,
  "details" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "activity_logs_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."affectation_chauffeurs_vehicules" (
  "id_affectation" integer DEFAULT nextval('affectation_chauffeurs_vehicules_id_affectation_seq'::regclass) NOT NULL,
  "id_chauffeur" integer,
  "id_vehicule" integer,
  "date_debut" date,
  "date_fin" date,
  "created_at" timestamp without time zone,
  CONSTRAINT "affectation_chauffeurs_vehicules_pkey" PRIMARY KEY (id_affectation)
);

CREATE TABLE public."agent_analyses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "type" text NOT NULL,
  "titre" text,
  "contenu" text NOT NULL,
  "donnees" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "agent_analyses_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."agent_conversations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "telegram_chat_id" text,
  "telegram_user_id" text,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "agent_conversations_pkey" PRIMARY KEY (id),
  CONSTRAINT "agent_conversations_role_check" CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);

CREATE TABLE public."agent_memory" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "categorie" text NOT NULL,
  "cle" text NOT NULL,
  "valeur" text NOT NULL,
  "importance" integer DEFAULT 5,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "agent_memory_pkey" PRIMARY KEY (id),
  CONSTRAINT "agent_memory_cle_key" UNIQUE (cle),
  CONSTRAINT "agent_memory_importance_check" CHECK (((importance >= 1) AND (importance <= 10)))
);

CREATE TABLE public."ai_insights" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "triggered_by" text DEFAULT 'auto'::text NOT NULL,
  "analysis" jsonb,
  "retard_vehicules" jsonb DEFAULT '[]'::jsonb,
  "is_after_noon" boolean DEFAULT false,
  "total_vehicules" integer DEFAULT 0,
  CONSTRAINT "ai_insights_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."alertes_envoyees" (
  "id" bigint DEFAULT nextval('alertes_envoyees_id_seq'::regclass) NOT NULL,
  "type_alerte" text NOT NULL,
  "gravite" text NOT NULL,
  "cible" text,
  "message_envoye" text,
  "data_snapshot" jsonb,
  "telegram_message_id" bigint,
  "statut" text DEFAULT 'envoyee'::text,
  "date_envoi" timestamp with time zone DEFAULT now(),
  "date_expiration" timestamp with time zone,
  "date_traitement" timestamp with time zone,
  "traitement_action" text,
  CONSTRAINT "alertes_envoyees_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."chauffeurs" (
  "id_chauffeur" integer DEFAULT nextval('chauffeurs_id_chauffeur_seq'::regclass) NOT NULL,
  "nom" text,
  "numero_wave" text,
  "actif" boolean,
  "commentaire" text,
  "photo" text,
  "photo_permis_recto" text,
  "photo_permis_verso" text,
  "numero_permis" text,
  "numero_cni" text,
  "situation_matrimoniale" text,
  "nombre_enfants" integer,
  "domicile" text,
  "numero_garant" text,
  CONSTRAINT "chauffeurs_pkey" PRIMARY KEY (id_chauffeur)
);

CREATE TABLE public."clients" (
  "id" integer DEFAULT nextval('clients_id_seq'::regclass) NOT NULL,
  "nom" text NOT NULL,
  "telephone" text,
  "email" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "clients_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."commandes_yango" (
  "id" text NOT NULL,
  "short_id" bigint,
  "status" text,
  "created_at" timestamp with time zone,
  "ended_at" timestamp with time zone,
  "raw" jsonb,
  CONSTRAINT "commandes_yango_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."depenses_vehicules" (
  "id_depense" uuid DEFAULT gen_random_uuid() NOT NULL,
  "date_depense" date,
  "montant" numeric,
  "type_depense" text,
  "description" text,
  "id_vehicule" integer,
  "immobilisation" boolean,
  "date_debut_immobilisation" date,
  "date_fin_immobilisation" date,
  "created_at" timestamp without time zone,
  CONSTRAINT "depenses_vehicules_pkey" PRIMARY KEY (id_depense)
);

CREATE TABLE public."entretiens" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "id_vehicule" integer,
  "immatriculation" text NOT NULL,
  "date_realise" date NOT NULL,
  "date_prochain" date GENERATED ALWAYS AS (date_realise + '21 days'::interval) STORED,
  "huile_moteur" boolean DEFAULT false,
  "filtre_huile" boolean DEFAULT false,
  "filtre_air" boolean DEFAULT false,
  "filtre_pollen" boolean DEFAULT false,
  "liquide_refroidissement" boolean DEFAULT false,
  "huile_frein" boolean DEFAULT false,
  "pneus" boolean DEFAULT false,
  "km_vidange" integer,
  "cout" numeric DEFAULT 0,
  "technicien" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "inspection" jsonb,
  CONSTRAINT "entretiens_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."jours_feries" (
  "date" date NOT NULL,
  "libelle" text NOT NULL,
  "montant" numeric DEFAULT 15000,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "jours_feries_pkey" PRIMARY KEY (date)
);

CREATE TABLE public."justifications_versement" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "id_vehicule" integer NOT NULL,
  "jour_exploitation" date NOT NULL,
  "type" text NOT NULL,
  "motif" text,
  "montant_attendu" numeric,
  "montant_recu" numeric,
  "auto_genere" boolean DEFAULT false,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "justifications_versement_pkey" PRIMARY KEY (id),
  CONSTRAINT "justifications_versement_id_vehicule_jour_exploitation_key" UNIQUE (id_vehicule, jour_exploitation)
);

CREATE TABLE public."profiles" (
  "id" uuid NOT NULL,
  "avatar_url" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "role" text DEFAULT 'dispatcher'::text,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."recettes_wave" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "id_recette" bigint,
  "Horodatage" timestamp without time zone,
  "Identifiant de transaction" text,
  "Type de transaction" text,
  "Montant net" numeric,
  "Montant brut" numeric,
  "Frais" numeric,
  "Solde" numeric,
  "Devise" text,
  "Nom de contrepartie" text,
  "Numéro de téléphone de contrepartie" text,
  "Nom d'utilisateur" text,
  "Numéro de téléphone d'utilisateur" text,
  "created_at" timestamp without time zone DEFAULT now(),
  "date_paiement" date,
  "telephone_chauffeur" text,
  "date_travail" date,
  CONSTRAINT "recettes_wave_pkey" PRIMARY KEY (id),
  CONSTRAINT "recettes_wave_Identifiant de transaction_key" UNIQUE ("Identifiant de transaction")
);

CREATE TABLE public."role_permissions" (
  "id" bigint DEFAULT nextval('role_permissions_id_seq'::regclass) NOT NULL,
  "role" text NOT NULL,
  "action" text NOT NULL,
  "allowed" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY (id),
  CONSTRAINT "role_permissions_role_action_key" UNIQUE (role, action),
  CONSTRAINT "role_permissions_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'dispatcher'::text])))
);

CREATE TABLE public."taches_suivi" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "id_vehicule" integer,
  "immatriculation" text NOT NULL,
  "description" text NOT NULL,
  "fait" boolean DEFAULT false,
  "id_entretien" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "fait_at" timestamp with time zone,
  CONSTRAINT "taches_suivi_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."vehicules" (
  "id_vehicule" integer DEFAULT nextval('vehicules_id_vehicule_seq'::regclass) NOT NULL,
  "immatriculation" text,
  "type_vehicule" text,
  "proprietaire" text,
  "statut" text,
  "montant de la recette" numeric,
  "km_actuel" integer,
  "km_derniere_vidange" integer,
  "date_derniers_pneus" date,
  "date_assurance" date,
  "date_expiration_assurance" date,
  "date_visite_technique" date,
  "date_expiration_visite" date,
  "photo" text,
  "carte_grise_recto" text,
  "carte_grise_verso" text,
  "sous_gestion" boolean DEFAULT false,
  "montant_mensuel_client" integer DEFAULT 0,
  "id_client" integer,
  "date_carte_stationnement" date,
  "date_expiration_carte_stationnement" date,
  "date_patente" date,
  "date_expiration_patente" date,
  "montant_recette_jour" numeric DEFAULT 0,
  CONSTRAINT "vehicules_pkey" PRIMARY KEY (id_vehicule)
);

CREATE TABLE public."versement_attribution" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "id_recette" bigint,
  "id_vehicule" integer,
  "jour_exploitation" date NOT NULL,
  "montant_attribue" numeric NOT NULL,
  "type_attribution" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "versement_attribution_pkey" PRIMARY KEY (id),
  CONSTRAINT "versement_attribution_type_attribution_check" CHECK ((type_attribution = ANY (ARRAY['normal'::text, 'jour_meme'::text, 'split_2j'::text, 'retard'::text])))
);

CREATE TABLE public."versements_chauffeurs" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "date_versement" date,
  "id_chauffeur" integer,
  "id_vehicule" integer,
  "montant" numeric,
  "created_at" timestamp without time zone DEFAULT now(),
  CONSTRAINT "versements_chauffeurs_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."versements_clients" (
  "id" integer DEFAULT nextval('versements_clients_id_seq'::regclass) NOT NULL,
  "id_client" integer NOT NULL,
  "mois" character varying(7) NOT NULL,
  "montant" numeric(12,0) NOT NULL,
  "date_versement" date DEFAULT CURRENT_DATE NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "versements_clients_pkey" PRIMARY KEY (id),
  CONSTRAINT "versements_clients_id_client_mois_key" UNIQUE (id_client, mois)
);

-- ────────── Sequence ownership ──────────

ALTER SEQUENCE public."activity_logs_id_seq" OWNED BY public."activity_logs"."id";
ALTER SEQUENCE public."alertes_envoyees_id_seq" OWNED BY public."alertes_envoyees"."id";
ALTER SEQUENCE public."clients_id_seq" OWNED BY public."clients"."id";
ALTER SEQUENCE public."role_permissions_id_seq" OWNED BY public."role_permissions"."id";
ALTER SEQUENCE public."versements_clients_id_seq" OWNED BY public."versements_clients"."id";

-- ────────── Foreign keys ──────────

ALTER TABLE public."activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE public."affectation_chauffeurs_vehicules" ADD CONSTRAINT "affectation_chauffeurs_vehicules_id_chauffeur_fkey" FOREIGN KEY (id_chauffeur) REFERENCES chauffeurs(id_chauffeur);
ALTER TABLE public."affectation_chauffeurs_vehicules" ADD CONSTRAINT "affectation_chauffeurs_vehicules_id_vehicule_fkey" FOREIGN KEY (id_vehicule) REFERENCES vehicules(id_vehicule);
ALTER TABLE public."depenses_vehicules" ADD CONSTRAINT "depenses_vehicules_id_vehicule_fkey" FOREIGN KEY (id_vehicule) REFERENCES vehicules(id_vehicule);
ALTER TABLE public."entretiens" ADD CONSTRAINT "entretiens_id_vehicule_fkey" FOREIGN KEY (id_vehicule) REFERENCES vehicules(id_vehicule) ON DELETE CASCADE;
ALTER TABLE public."justifications_versement" ADD CONSTRAINT "justifications_versement_id_vehicule_fkey" FOREIGN KEY (id_vehicule) REFERENCES vehicules(id_vehicule) ON DELETE CASCADE;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."taches_suivi" ADD CONSTRAINT "taches_suivi_id_entretien_fkey" FOREIGN KEY (id_entretien) REFERENCES entretiens(id) ON DELETE SET NULL;
ALTER TABLE public."taches_suivi" ADD CONSTRAINT "taches_suivi_id_vehicule_fkey" FOREIGN KEY (id_vehicule) REFERENCES vehicules(id_vehicule) ON DELETE CASCADE;
ALTER TABLE public."vehicules" ADD CONSTRAINT "vehicules_id_client_fkey" FOREIGN KEY (id_client) REFERENCES clients(id);
ALTER TABLE public."versement_attribution" ADD CONSTRAINT "versement_attribution_id_vehicule_fkey" FOREIGN KEY (id_vehicule) REFERENCES vehicules(id_vehicule) ON DELETE CASCADE;
ALTER TABLE public."versements_clients" ADD CONSTRAINT "versements_clients_id_client_fkey" FOREIGN KEY (id_client) REFERENCES clients(id) ON DELETE CASCADE;

-- ────────── Indexes ──────────

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);
CREATE INDEX idx_agent_conv_chat ON public.agent_conversations USING btree (telegram_chat_id, created_at DESC);
CREATE INDEX ai_insights_created_at_idx ON public.ai_insights USING btree (created_at DESC);
CREATE INDEX idx_alertes_expiration ON public.alertes_envoyees USING btree (date_expiration) WHERE (statut <> 'ignoree'::text);
CREATE INDEX idx_alertes_type_cible ON public.alertes_envoyees USING btree (type_alerte, cible, date_envoi DESC);
CREATE INDEX commandes_yango_created_at_idx ON public.commandes_yango USING btree (created_at DESC);
CREATE INDEX commandes_yango_ended_at_idx ON public.commandes_yango USING btree (ended_at DESC);
CREATE INDEX commandes_yango_status_idx ON public.commandes_yango USING btree (status);
CREATE INDEX idx_entretiens_prochain ON public.entretiens USING btree (date_prochain);
CREATE INDEX idx_entretiens_vehicule ON public.entretiens USING btree (id_vehicule);
CREATE INDEX idx_taches_fait ON public.taches_suivi USING btree (fait);
CREATE INDEX idx_taches_vehicule ON public.taches_suivi USING btree (id_vehicule);
CREATE INDEX idx_va_jour ON public.versement_attribution USING btree (jour_exploitation);
CREATE INDEX idx_va_vehicule_jour ON public.versement_attribution USING btree (id_vehicule, jour_exploitation);

-- ────────── Functions ──────────

CREATE OR REPLACE FUNCTION public.check_alerte_peut_envoyer(p_type_alerte text, p_cible text, p_gravite text)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
  derniere_envoi TIMESTAMPTZ;
  intervalle_min INTERVAL;
BEGIN
  -- Définir l'intervalle minimal selon la gravité
  intervalle_min := CASE p_gravite
    WHEN 'critique' THEN INTERVAL '6 hours'
    WHEN 'important' THEN INTERVAL '24 hours'
    WHEN 'opportunite' THEN INTERVAL '365 days'  -- jamais (1x seulement)
    ELSE INTERVAL '24 hours'
  END;

  -- Chercher la dernière alerte non ignorée du même type/cible
  SELECT MAX(date_envoi) INTO derniere_envoi
  FROM alertes_envoyees
  WHERE type_alerte = p_type_alerte
    AND (cible = p_cible OR (cible IS NULL AND p_cible IS NULL))
    AND statut != 'ignoree';

  -- Vérifier aussi les alertes récemment ignorées (blocage 24h)
  IF EXISTS (
    SELECT 1 FROM alertes_envoyees
    WHERE type_alerte = p_type_alerte
      AND (cible = p_cible OR (cible IS NULL AND p_cible IS NULL))
      AND statut = 'ignoree'
      AND date_traitement > NOW() - INTERVAL '24 hours'
  ) THEN
    RETURN FALSE;  -- Bloqué par ignorer
  END IF;

  -- Si jamais envoyée, autoriser
  IF derniere_envoi IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Si envoyée avant l'intervalle min, autoriser
  IF NOW() - derniere_envoi > intervalle_min THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
;

-- ────────── Views ──────────

CREATE OR REPLACE VIEW public."vue_recettes_chauffeurs" AS
 SELECT r.id,
    r."Horodatage",
    r."Identifiant de transaction",
    r."Montant net",
    r.telephone_chauffeur,
    c.id_chauffeur,
    c.nom
   FROM recettes_wave r
     LEFT JOIN chauffeurs c ON r.telephone_chauffeur = c.numero_wave;

CREATE OR REPLACE VIEW public."vue_voitures_payees" AS
 SELECT v.id_vehicule,
    v.immatriculation,
    count(vc.id) AS versements
   FROM vehicules v
     LEFT JOIN versements_chauffeurs vc ON vc.id_vehicule = v.id_vehicule AND vc.date_versement = CURRENT_DATE
  GROUP BY v.id_vehicule, v.immatriculation;

CREATE OR REPLACE VIEW public."vue_objectif_vehicules" AS
 SELECT id_vehicule,
    immatriculation,
    "montant de la recette" AS objectif_journalier
   FROM vehicules;

CREATE OR REPLACE VIEW public."chauffeurs_actifs" AS
 SELECT c.id_chauffeur,
    c.nom,
    count(r.id) AS nombre_transactions,
    sum(r."Montant net") AS chiffre_affaire
   FROM chauffeurs c
     LEFT JOIN recettes_wave r ON r."Numéro de téléphone de contrepartie" = c.numero_wave
  GROUP BY c.id_chauffeur, c.nom
 HAVING count(r.id) > 0;

CREATE OR REPLACE VIEW public."chauffeurs_inactifs" AS
 SELECT c.id_chauffeur,
    c.nom
   FROM chauffeurs c
     LEFT JOIN recettes_wave r ON r."Numéro de téléphone de contrepartie" = c.numero_wave
  GROUP BY c.id_chauffeur, c.nom
 HAVING count(r.id) = 0;

CREATE OR REPLACE VIEW public."vue_depenses_categories" AS
 SELECT type_depense,
    sum(montant) AS total_depenses
   FROM depenses_vehicules
  GROUP BY type_depense
  ORDER BY (sum(montant)) DESC;

CREATE OR REPLACE VIEW public."vue_depenses_mensuelles" AS
 SELECT date_trunc('month'::text, date_depense::timestamp with time zone) AS mois,
    sum(montant) AS total_depenses
   FROM depenses_vehicules
  GROUP BY (date_trunc('month'::text, date_depense::timestamp with time zone))
  ORDER BY (date_trunc('month'::text, date_depense::timestamp with time zone));

CREATE OR REPLACE VIEW public."depenses_recurrentes" AS
 SELECT type_depense,
    count(*) AS nombre_depenses,
    avg(montant) AS montant_moyen
   FROM depenses_vehicules
  GROUP BY type_depense
  ORDER BY (count(*)) DESC;

CREATE OR REPLACE VIEW public."prevision_depenses" AS
 SELECT avg(total_depenses) AS depense_moyenne_mensuelle
   FROM vue_depenses_mensuelles;

CREATE OR REPLACE VIEW public."depenses_anormales" AS
 SELECT id_depense,
    date_depense,
    montant,
    type_depense,
    description,
    id_vehicule,
    immobilisation,
    date_debut_immobilisation,
    date_fin_immobilisation,
    created_at
   FROM depenses_vehicules
  WHERE montant > (( SELECT avg(depenses_vehicules_1.montant) * 2::numeric
           FROM depenses_vehicules depenses_vehicules_1));

CREATE OR REPLACE VIEW public."alerte_vidange" AS
 SELECT id_vehicule,
    immatriculation,
    km_actuel,
    km_derniere_vidange,
    km_actuel - km_derniere_vidange AS km_depuis_vidange
   FROM vehicules
  WHERE (km_actuel - km_derniere_vidange) >= 8000;

CREATE OR REPLACE VIEW public."alerte_assurance" AS
 SELECT id_vehicule,
    immatriculation,
    date_expiration_assurance,
    date_expiration_assurance - CURRENT_DATE AS jours_restants
   FROM vehicules
  WHERE date_expiration_assurance <= (CURRENT_DATE + '30 days'::interval);

CREATE OR REPLACE VIEW public."alerte_visite_technique" AS
 SELECT id_vehicule,
    immatriculation,
    date_expiration_visite,
    date_expiration_visite - CURRENT_DATE AS jours_restants
   FROM vehicules
  WHERE date_expiration_visite <= (CURRENT_DATE + '7 days'::interval);

CREATE OR REPLACE VIEW public."alerte_pneus" AS
 SELECT id_vehicule,
    immatriculation,
    date_derniers_pneus,
    CURRENT_DATE - date_derniers_pneus AS jours_utilisation
   FROM vehicules
  WHERE (CURRENT_DATE - date_derniers_pneus) >= 90;

CREATE OR REPLACE VIEW public."alertes_vehicules" AS
 SELECT 'VIDANGE'::text AS type_alerte,
    alerte_vidange.immatriculation,
    CURRENT_DATE AS date_alerte,
    alerte_vidange.km_actuel - alerte_vidange.km_derniere_vidange AS valeur
   FROM alerte_vidange
UNION ALL
 SELECT 'PNEUS'::text AS type_alerte,
    alerte_pneus.immatriculation,
    CURRENT_DATE AS date_alerte,
    CURRENT_DATE - alerte_pneus.date_derniers_pneus AS valeur
   FROM alerte_pneus
UNION ALL
 SELECT 'ASSURANCE'::text AS type_alerte,
    alerte_assurance.immatriculation,
    alerte_assurance.date_expiration_assurance AS date_alerte,
    alerte_assurance.date_expiration_assurance - CURRENT_DATE AS valeur
   FROM alerte_assurance
UNION ALL
 SELECT 'VISITE_TECHNIQUE'::text AS type_alerte,
    alerte_visite_technique.immatriculation,
    alerte_visite_technique.date_expiration_visite AS date_alerte,
    alerte_visite_technique.date_expiration_visite - CURRENT_DATE AS valeur
   FROM alerte_visite_technique;

CREATE OR REPLACE VIEW public."vue_ca_mensuel" AS
 SELECT EXTRACT(year FROM "Horodatage")::integer AS annee,
    EXTRACT(month FROM "Horodatage")::integer AS mois,
    sum("Montant net") AS chiffre_affaire
   FROM recettes_wave
  GROUP BY (EXTRACT(year FROM "Horodatage")::integer), (EXTRACT(month FROM "Horodatage")::integer)
  ORDER BY (EXTRACT(year FROM "Horodatage")::integer), (EXTRACT(month FROM "Horodatage")::integer);

CREATE OR REPLACE VIEW public."prevision_ca_mensuel" AS
 SELECT annee,
    mois,
    chiffre_affaire,
    chiffre_affaire * 1.1 AS prevision
   FROM vue_ca_mensuel;

CREATE OR REPLACE VIEW public."classement_chauffeurs" AS
 SELECT c.id_chauffeur,
    c.nom,
    COALESCE(sum(r."Montant net"), 0::numeric) AS ca
   FROM chauffeurs c
     LEFT JOIN recettes_wave r ON lower(split_part(r."Nom de contrepartie", ' '::text, 1)) = lower(split_part(c.nom, ' '::text, 1))
  GROUP BY c.id_chauffeur, c.nom
  ORDER BY (COALESCE(sum(r."Montant net"), 0::numeric)) DESC;

CREATE OR REPLACE VIEW public."cout_reel_vehicule" AS
 SELECT id_vehicule,
    sum(montant) AS cout_total
   FROM depenses_vehicules
  GROUP BY id_vehicule;

CREATE OR REPLACE VIEW public."vue_chauffeurs_vehicules" AS
 SELECT c.id_chauffeur,
    c.nom,
    c.numero_wave,
    c.commentaire,
    c.actif,
    v.id_vehicule,
    v.immatriculation
   FROM chauffeurs c
     LEFT JOIN affectation_chauffeurs_vehicules a ON a.id_chauffeur = c.id_chauffeur AND a.date_fin IS NULL
     LEFT JOIN vehicules v ON v.id_vehicule = a.id_vehicule;

CREATE OR REPLACE VIEW public."vue_ca_chauffeur_jour" AS
 SELECT c.nom,
    date(r."Horodatage") AS date_recette,
    sum(r."Montant net") AS ca_jour
   FROM recettes_wave r
     LEFT JOIN chauffeurs c ON lower(split_part(r."Nom de contrepartie", ' '::text, 1)) = lower(split_part(c.nom, ' '::text, 1))
  GROUP BY c.nom, (date(r."Horodatage"))
  ORDER BY (date(r."Horodatage"));

CREATE OR REPLACE VIEW public."vue_dashboard_recettes" AS
 SELECT id,
    "Horodatage" AS date_recette,
    "Montant net" AS montant,
    "Nom de contrepartie" AS chauffeur
   FROM recettes_wave
  ORDER BY "Horodatage" DESC;

CREATE OR REPLACE VIEW public."vue_dashboard_depenses" AS
 SELECT d.id_depense,
    d.date_depense,
    d.montant,
    d.type_depense,
    d.description,
    v.immatriculation
   FROM depenses_vehicules d
     LEFT JOIN vehicules v ON v.id_vehicule = d.id_vehicule
  ORDER BY d.date_depense DESC;

CREATE OR REPLACE VIEW public."vue_depenses_par_vehicule" AS
 SELECT v.id_vehicule,
    v.immatriculation,
    COALESCE(sum(d.montant), 0::numeric) AS total_depenses
   FROM vehicules v
     LEFT JOIN depenses_vehicules d ON d.id_vehicule = v.id_vehicule
  GROUP BY v.id_vehicule, v.immatriculation
  ORDER BY (COALESCE(sum(d.montant), 0::numeric)) DESC;

CREATE OR REPLACE VIEW public."vue_depenses_par_categorie" AS
 SELECT type_depense,
    sum(montant) AS total_depenses
   FROM depenses_vehicules
  GROUP BY type_depense
  ORDER BY (sum(montant)) DESC;

CREATE OR REPLACE VIEW public."vue_depenses_journalieres" AS
 SELECT date_depense,
    sum(montant) AS total_depenses
   FROM depenses_vehicules
  GROUP BY date_depense
  ORDER BY date_depense;

CREATE OR REPLACE VIEW public."vue_top_vehicule_depenses" AS
 SELECT v.immatriculation,
    sum(d.montant) AS total_depenses
   FROM depenses_vehicules d
     LEFT JOIN vehicules v ON v.id_vehicule = d.id_vehicule
  GROUP BY v.immatriculation
  ORDER BY (sum(d.montant)) DESC
 LIMIT 1;

CREATE OR REPLACE VIEW public."vue_depenses_aujourdhui" AS
 SELECT sum(montant) AS total_depenses
   FROM depenses_vehicules
  WHERE date_depense = CURRENT_DATE;

CREATE OR REPLACE VIEW public."vue_depenses_mois" AS
 SELECT sum(montant) AS total_depenses
   FROM depenses_vehicules
  WHERE date_trunc('month'::text, date_depense::timestamp with time zone) = date_trunc('month'::text, CURRENT_DATE::timestamp with time zone);

CREATE OR REPLACE VIEW public."vue_ca_journalier" AS
 SELECT date("Horodatage") AS date_recette,
    sum("Montant net") AS chiffre_affaire
   FROM recettes_wave
  GROUP BY (date("Horodatage"))
  ORDER BY (date("Horodatage"));

CREATE OR REPLACE VIEW public."vue_profit_journalier" AS
 SELECT ca.date_recette,
    ca.chiffre_affaire - COALESCE(dep.total_depenses, 0::numeric) AS profit
   FROM ( SELECT date(recettes_wave."Horodatage") AS date_recette,
            sum(recettes_wave."Montant net") AS chiffre_affaire
           FROM recettes_wave
          GROUP BY (date(recettes_wave."Horodatage"))) ca
     LEFT JOIN ( SELECT depenses_vehicules.date_depense,
            sum(depenses_vehicules.montant) AS total_depenses
           FROM depenses_vehicules
          GROUP BY depenses_vehicules.date_depense) dep ON ca.date_recette = dep.date_depense
  ORDER BY ca.date_recette;

CREATE OR REPLACE VIEW public."vue_recettes_vehicules" AS
 SELECT r.id,
    r."Horodatage",
    r."Montant net",
    r."Identifiant de transaction",
    r."Type de transaction",
    r."Montant brut",
    r."Frais",
    r."Solde",
    r."Devise",
    r."Nom de contrepartie",
    r."Nom d'utilisateur",
    r."Numéro de téléphone de contrepartie",
    r."Numéro de téléphone d'utilisateur",
    COALESCE(c.nom, r."Nom de contrepartie") AS chauffeur,
    v.immatriculation,
    v.id_vehicule
   FROM recettes_wave r
     LEFT JOIN chauffeurs c ON regexp_replace(r."Numéro de téléphone de contrepartie", '[^0-9]'::text, ''::text, 'g'::text) = regexp_replace(c.numero_wave, '[^0-9]'::text, ''::text, 'g'::text)
     LEFT JOIN affectation_chauffeurs_vehicules a ON c.id_chauffeur = a.id_chauffeur AND a.date_fin IS NULL
     LEFT JOIN vehicules v ON a.id_vehicule = v.id_vehicule
  WHERE r."Montant net" IS NOT NULL;

CREATE OR REPLACE VIEW public."vue_ca_vehicule_aujourdhui" AS
 SELECT id_vehicule,
    immatriculation,
    sum("Montant net") AS ca_today
   FROM vue_recettes_vehicules
  WHERE date("Horodatage") = CURRENT_DATE
  GROUP BY id_vehicule, immatriculation;

CREATE OR REPLACE VIEW public."vue_ca_vehicule_jour" AS
 SELECT id_vehicule,
    immatriculation,
    date("Horodatage") AS date_recette,
    sum("Montant net") AS ca_jour
   FROM vue_recettes_vehicules
  GROUP BY id_vehicule, immatriculation, (date("Horodatage"))
  ORDER BY (date("Horodatage")) DESC;

CREATE OR REPLACE VIEW public."vue_ca_vehicule_mois" AS
 SELECT id_vehicule,
    immatriculation,
    date_trunc('month'::text, "Horodatage") AS mois,
    sum("Montant net") AS ca_mois
   FROM vue_recettes_vehicules
  GROUP BY id_vehicule, immatriculation, (date_trunc('month'::text, "Horodatage"))
  ORDER BY (date_trunc('month'::text, "Horodatage")) DESC;

CREATE OR REPLACE VIEW public."vue_ca_vehicules" AS
 SELECT v.immatriculation,
    sum(r."Montant net") AS ca_total
   FROM vue_recettes_vehicules r
     LEFT JOIN vehicules v ON r.id_vehicule = v.id_vehicule
  GROUP BY v.immatriculation
  ORDER BY (sum(r."Montant net")) DESC;

CREATE OR REPLACE VIEW public."vue_dashboard_vehicules" AS
 SELECT v.id_vehicule,
    v.immatriculation,
    v.type_vehicule,
    v.proprietaire,
    v.statut,
    COALESCE(j.ca_today, 0::numeric) AS ca_aujourdhui,
    COALESCE(m.ca_mois, 0::numeric) AS ca_mensuel,
    COALESCE(c.cout_total, 0::numeric) AS cout_total,
    COALESCE(m.ca_mois, 0::numeric) - COALESCE(c.cout_total, 0::numeric) AS profit
   FROM vehicules v
     LEFT JOIN vue_ca_vehicule_aujourdhui j ON v.id_vehicule = j.id_vehicule
     LEFT JOIN vue_ca_vehicule_mois m ON v.id_vehicule = m.id_vehicule AND m.mois = date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)
     LEFT JOIN cout_reel_vehicule c ON v.id_vehicule = c.id_vehicule;

-- ────────── Triggers ──────────

CREATE TRIGGER set_agent_memory_updated_at BEFORE UPDATE ON public.agent_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────── Row Level Security ──────────

ALTER TABLE public."activity_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ai_insights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."versements_clients" ENABLE ROW LEVEL SECURITY;

-- ────────── Policies ──────────

CREATE POLICY "logs_insert" ON public."activity_logs" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "logs_select" ON public."activity_logs" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insertion publique ai_insights" ON public."ai_insights" FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Lecture publique ai_insights" ON public."ai_insights" FOR SELECT TO public USING (true);
CREATE POLICY "authenticated_all_chauffeurs" ON public."chauffeurs" TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_clients" ON public."clients" TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Users can update their own profile" ON public."profiles" FOR UPDATE TO public USING ((auth.uid() = id));
CREATE POLICY "Users can view their profile" ON public."profiles" FOR SELECT TO public USING ((auth.uid() = id));
CREATE POLICY "profiles_insert" ON public."profiles" FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "profiles_select" ON public."profiles" FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update" ON public."profiles" FOR UPDATE TO service_role USING (true);
CREATE POLICY "perms_all" ON public."role_permissions" TO service_role USING (true);
CREATE POLICY "perms_select" ON public."role_permissions" FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_all_vehicules" ON public."vehicules" TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_versements" ON public."versements_clients" TO public USING ((auth.role() = 'authenticated'::text));

