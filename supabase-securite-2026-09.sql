-- ════════════════════════════════════════════════════════════════
-- BIA Manager — correctifs de sécurité (septembre 2026)
-- À exécuter une fois dans Supabase > SQL Editor. Idempotent.
-- ════════════════════════════════════════════════════════════════

-- 1. Création de compte : le rôle ne vient plus des métadonnées envoyées par le navigateur.
--    Avant : signUp({ data: { role: "superadmin" } }) créait un superadmin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom, roles)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'nom', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'prenom', ''),
    ARRAY['parent']
  );
  RETURN NEW;
END;
$$;

-- 2. Un utilisateur ne peut plus modifier lui-même ses rôles, son statut actif,
--    ses établissements ou ses qualifications (seul un superadmin ou le serveur le peut).
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  col TEXT;
BEGIN
  -- Appels serveur (service role) : pas d'utilisateur connecté
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND 'superadmin' = ANY(roles)) THEN
    RETURN NEW;
  END IF;
  FOREACH col IN ARRAY ARRAY['roles', 'actif', 'email', 'etablissement_id', 'etablissement_ids', 'qualification_fi'] LOOP
    IF (to_jsonb(NEW) -> col) IS DISTINCT FROM (to_jsonb(OLD) -> col) THEN
      RAISE EXCEPTION 'Modification du champ % réservée au superadmin', col USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- 3. Attestations : les fichiers ne sont plus lisibles directement par tous les parents.
--    Les téléchargements passent par /api/attestation/download, qui vérifie que le parent
--    est bien celui de l'élève.
DROP POLICY IF EXISTS "attestations_parent_read" ON storage.objects;
CREATE POLICY "attestations_parent_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'attestations'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND 'superadmin' = ANY(roles))
);

-- 4. Établissements : plus lisibles sans être connecté (les codes d'inscription fuitaient).
--    La page publique d'inscription passe par /api/inscription, qui n'est pas concernée.
DROP POLICY IF EXISTS "etab_select" ON public.etablissements;
CREATE POLICY "etab_select" ON public.etablissements FOR SELECT TO authenticated USING (true);

-- 5. Réservations : impossible de dépasser le nombre de places élèves de l'avion,
--    même si deux parents réservent la dernière place à la même seconde.
CREATE OR REPLACE FUNCTION public.check_reservation_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  capacite INT;
  occupees INT;
BEGIN
  IF NEW.statut = 'annule' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.statut <> 'annule' AND OLD.creneau_id = NEW.creneau_id THEN
    RETURN NEW;
  END IF;
  -- Le verrou sur le créneau sérialise les réservations concurrentes
  SELECT COALESCE(a.nb_places_eleves, 1) INTO capacite
  FROM public.creneaux c
  LEFT JOIN public.aeronefs a ON a.id = c.aeronef_id
  WHERE c.id = NEW.creneau_id
  FOR UPDATE OF c;
  SELECT count(*) INTO occupees
  FROM public.reservations
  WHERE creneau_id = NEW.creneau_id AND statut <> 'annule' AND id <> NEW.id;
  IF occupees >= capacite THEN
    RAISE EXCEPTION 'Créneau complet' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_reservation_capacity ON public.reservations;
CREATE TRIGGER check_reservation_capacity
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.check_reservation_capacity();

-- 6. Colonnes ajoutées lors des évolutions précédentes (sans effet si déjà présentes)
ALTER TABLE public.vols_effectues ADD COLUMN IF NOT EXISTS numeros_aerogest text[];
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS creneau_id uuid REFERENCES public.creneaux(id) ON DELETE SET NULL;
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS vol1_skippe boolean DEFAULT false NOT NULL;
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS bia_mention text;
