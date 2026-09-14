-- ════════════════════════════════════════════════════════════════
-- BIA Manager — passage multi-clubs
-- À exécuter dans Supabase > SQL Editor APRÈS tous les scripts 2026-09 précédents.
-- ⚠️ Faire une sauvegarde juste avant (Database > Backups).
-- Idempotent : peut être relancé sans risque.
--
-- Principe :
--  • chaque ligne appartient à un club (organisation_id) ;
--  • la colonne est remplie automatiquement avec le club de l'utilisateur connecté ;
--  • une politique RLS restrictive masque les données des autres clubs ;
--  • un déclencheur refuse toute écriture vers un autre club, y compris depuis
--    les fonctions (réservation, clôture, tarifs) qui contournent la RLS.
--  • Les appels serveur (clé service) doivent préciser le club explicitement.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Clubs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,40}[a-z0-9])?$'),
  nom text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- Club pilote (ACBA) : toutes les données existantes lui sont rattachées
INSERT INTO public.organisations (slug, nom)
SELECT 'acba', COALESCE((SELECT valeur FROM public.parametres WHERE cle = 'nom_aeroclub' LIMIT 1), 'Aéro-Club du Bassin d''Arcachon')
WHERE NOT EXISTS (SELECT 1 FROM public.organisations WHERE slug = 'acba');

-- ─── 2. Club de l'utilisateur connecté ──────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT organisation_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND 'proprietaire' = ANY (roles) AND COALESCE(actif, true));
$$;

GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_owner() TO authenticated;

DROP POLICY IF EXISTS "organisations_lecture_club" ON public.organisations;
CREATE POLICY "organisations_lecture_club" ON public.organisations FOR SELECT TO authenticated
  USING (id = public.current_org_id() OR public.is_platform_owner());

UPDATE public.profiles SET organisation_id = (SELECT id FROM public.organisations WHERE slug = 'acba')
WHERE organisation_id IS NULL;

-- ─── 3. Colonne club sur toutes les tables ──────────────────────
DO $$
DECLARE
  t text;
  v_acba uuid := (SELECT id FROM public.organisations WHERE slug = 'acba');
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'annees', 'etablissements', 'aeronefs', 'aeronef_tarifs', 'creneaux', 'reservations', 'eleves',
    'vols_effectues', 'vols_lignes', 'finances_operations', 'operations_manuelles', 'subventions',
    'email_logs', 'activity_logs', 'notifications', 'pilote_etablissements', 'pilote_qualifications', 'parametres'
  ] LOOP
    CONTINUE WHEN to_regclass('public.' || t) IS NULL;
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id)', t);
    EXECUTE format('UPDATE public.%I SET organisation_id = %L WHERE organisation_id IS NULL', t, v_acba);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organisation_id SET DEFAULT public.current_org_id()', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organisation_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(organisation_id)', 'idx_' || t || '_org', t);
  END LOOP;
END $$;

-- ─── 4. Unicités par club ───────────────────────────────────────
-- Deux clubs doivent pouvoir avoir chacun leur année « 2026-2027 » et leurs propres réglages.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, c.conname
    FROM pg_constraint c
    WHERE c.contype = 'u'
      AND c.conrelid IN ('public.annees'::regclass, 'public.parametres'::regclass)
      AND array_length(c.conkey, 1) = 1
      AND (SELECT attname FROM pg_attribute WHERE attrelid = c.conrelid AND attnum = c.conkey[1]) IN ('label', 'cle')
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS annees_org_label_key ON public.annees(organisation_id, label);
CREATE UNIQUE INDEX IF NOT EXISTS parametres_org_cle_key ON public.parametres(organisation_id, cle);
-- Les codes d'inscription publique identifient l'établissement ET le club : ils restent uniques sur la plateforme
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.etablissements WHERE code_inscription IS NOT NULL
    GROUP BY upper(code_inscription) HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'Codes d''inscription en double : régénérez-les dans Établissements, puis relancez ce script';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS etablissements_code_inscription_key ON public.etablissements (upper(code_inscription)) WHERE code_inscription IS NOT NULL;
  END IF;
END $$;
-- Une seule année active par club
CREATE UNIQUE INDEX IF NOT EXISTS annees_org_active_key ON public.annees(organisation_id) WHERE active;

-- ─── 5. Isolation en lecture : politiques restrictives ──────────
-- Elles s'ajoutent (ET logique) aux politiques existantes sans les modifier.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'annees', 'etablissements', 'aeronefs', 'aeronef_tarifs', 'creneaux', 'reservations', 'eleves',
    'vols_effectues', 'vols_lignes', 'finances_operations', 'operations_manuelles', 'subventions',
    'email_logs', 'activity_logs', 'notifications', 'pilote_etablissements', 'pilote_qualifications', 'parametres'
  ] LOOP
    CONTINUE WHEN to_regclass('public.' || t) IS NULL;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "isolation_club" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "isolation_club" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING (organisation_id = public.current_org_id())
         WITH CHECK (organisation_id = public.current_org_id())', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "isolation_club" ON public.profiles;
CREATE POLICY "isolation_club" ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
  USING (id = auth.uid() OR organisation_id = public.current_org_id())
  WITH CHECK (id = auth.uid() OR organisation_id = public.current_org_id());

-- ─── 6. Isolation en écriture : déclencheur ─────────────────────
-- Couvre aussi les fonctions SECURITY DEFINER (réserver, clôturer, tarifs) qui ignorent la RLS.
CREATE OR REPLACE FUNCTION public.tenant_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);  -- appels serveur (clé service) : le club est fourni explicitement
  END IF;
  v_org := current_org_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Compte non rattaché à un club' USING ERRCODE = '42501';
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.organisation_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Donnée d''un autre club' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  -- Les lignes rattachées à un parent héritent de son club
  IF TG_TABLE_NAME IN ('reservations', 'vols_effectues') THEN
    SELECT organisation_id INTO NEW.organisation_id FROM creneaux WHERE id = NEW.creneau_id;
  ELSIF TG_TABLE_NAME = 'vols_lignes' THEN
    SELECT organisation_id INTO NEW.organisation_id FROM vols_effectues WHERE id = NEW.vol_effectue_id;
  ELSIF TG_TABLE_NAME = 'aeronef_tarifs' THEN
    SELECT organisation_id INTO NEW.organisation_id FROM aeronefs WHERE id = NEW.aeronef_id;
  ELSIF NEW.organisation_id IS NULL THEN
    NEW.organisation_id := v_org;
  END IF;

  IF NEW.organisation_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Donnée d''un autre club' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'annees', 'etablissements', 'aeronefs', 'aeronef_tarifs', 'creneaux', 'reservations', 'eleves',
    'vols_effectues', 'vols_lignes', 'finances_operations', 'operations_manuelles', 'subventions',
    'email_logs', 'activity_logs', 'notifications', 'pilote_etablissements', 'pilote_qualifications', 'parametres'
  ] LOOP
    CONTINUE WHEN to_regclass('public.' || t) IS NULL;
    EXECUTE format('DROP TRIGGER IF EXISTS tenant_guard ON public.%I', t);
    EXECUTE format('CREATE TRIGGER tenant_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tenant_guard()', t);
  END LOOP;
END $$;

-- Le tarif initial d'un avion est créé par un déclencheur : il doit porter le club de l'avion
CREATE OR REPLACE FUNCTION public.aeronef_tarif_initial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO aeronef_tarifs (aeronef_id, prix_heure, date_effet, note, cree_par, organisation_id)
  VALUES (NEW.id, NEW.prix_heure, DATE '2000-01-01', 'Tarif initial', auth.uid(), NEW.organisation_id)
  ON CONFLICT (aeronef_id, date_effet) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─── 7. Profils : rôles et club protégés ────────────────────────
-- • Seul le propriétaire de la plateforme peut changer le club d'un compte ou donner le rôle propriétaire.
-- • L'admin d'un club (rôle superadmin) garde la main sur les autres rôles de SON club.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  col text;
  v_owner boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  v_owner := is_platform_owner();

  IF NOT v_owner THEN
    IF NEW.organisation_id IS DISTINCT FROM OLD.organisation_id THEN
      RAISE EXCEPTION 'Changement de club réservé au propriétaire de la plateforme' USING ERRCODE = '42501';
    END IF;
    IF ('proprietaire' = ANY (COALESCE(NEW.roles, '{}'))) IS DISTINCT FROM ('proprietaire' = ANY (COALESCE(OLD.roles, '{}'))) THEN
      RAISE EXCEPTION 'Rôle propriétaire réservé au propriétaire de la plateforme' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_owner OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND 'superadmin' = ANY (roles)) THEN
    RETURN NEW;
  END IF;
  FOREACH col IN ARRAY ARRAY['roles', 'actif', 'email', 'etablissement_id', 'etablissement_ids', 'qualification_fi'] LOOP
    IF (to_jsonb(NEW) -> col) IS DISTINCT FROM (to_jsonb(OLD) -> col) THEN
      RAISE EXCEPTION 'Modification du champ % réservée à l''admin du club', col USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- Les fonctions « superadmin » (tarifs) vérifient maintenant aussi le club, via le déclencheur ci-dessus.

-- ─── 8. Propriétaire de la plateforme ───────────────────────────
-- Remplacez l'adresse puis décommentez pour vous donner le rôle propriétaire :
-- UPDATE public.profiles SET roles = array_append(roles, 'proprietaire')
-- WHERE lower(email) = lower('votre-adresse@exemple.fr') AND NOT ('proprietaire' = ANY (roles));

NOTIFY pgrst, 'reload schema';
