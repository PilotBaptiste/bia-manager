-- ════════════════════════════════════════════════════════════════
-- BIA Manager — Cours : plusieurs documents par cours, suivi par élève
-- À exécuter dans Supabase > SQL Editor APRÈS supabase-evolutions-2026-11.sql.
-- Idempotent : peut être relancé sans risque.
--
-- Ce que ça change :
--   • un cours devient un contenant : il peut réunir plusieurs documents et liens ;
--   • la progression appartient à l'ÉLÈVE, pas au compte qui consulte. Un parent de
--     deux enfants suit donc deux progressions distinctes, et les deux parents d'un
--     même enfant voient et alimentent la même ;
--   • chaque document ouvert est enregistré, et un cours peut être marqué terminé.
--
-- Les cours déjà créés sont conservés : leur fichier (ou lien) devient leur
-- premier document, et les consultations déjà enregistrées sont reprises.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Documents et liens d'un cours ───────────────────────────
CREATE TABLE IF NOT EXISTS public.cours_ressources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) DEFAULT public.current_org_id(),
  cours_id uuid NOT NULL REFERENCES public.cours(id) ON DELETE CASCADE,
  titre text NOT NULL,
  type text NOT NULL DEFAULT 'fichier' CHECK (type IN ('fichier', 'lien')),
  fichier_path text,
  fichier_nom text,
  fichier_taille bigint,
  url text,
  ordre int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CHECK ((type = 'fichier' AND fichier_path IS NOT NULL) OR (type = 'lien' AND url IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_cours_ressources_cours ON public.cours_ressources(cours_id);
CREATE INDEX IF NOT EXISTS idx_cours_ressources_org ON public.cours_ressources(organisation_id);

-- ─── 2. Le cours n'a plus besoin de porter lui-même un fichier ───
-- Sa contrainte d'origine exigeait un fichier ou un lien sur le cours : ce sont
-- maintenant ses documents qui les portent.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.cours'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%fichier_path%'
  LOOP
    EXECUTE format('ALTER TABLE public.cours DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- ─── 3. Reprise des cours existants ─────────────────────────────
INSERT INTO public.cours_ressources (organisation_id, cours_id, titre, type, fichier_path, fichier_nom, fichier_taille, url, ordre)
SELECT
  c.organisation_id,
  c.id,
  COALESCE(NULLIF(btrim(c.fichier_nom), ''), c.titre),
  c.type,
  c.fichier_path,
  c.fichier_nom,
  c.fichier_taille,
  c.url,
  0
FROM public.cours c
WHERE (c.fichier_path IS NOT NULL OR c.url IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.cours_ressources r WHERE r.cours_id = c.id);

-- ─── 4. Suivi par élève ─────────────────────────────────────────
-- eleve_id renseigné : progression de cet élève, partagée par ses deux parents.
-- eleve_id vide : consultation par un membre de l'équipe du club (pas une progression).
ALTER TABLE public.cours_vus ADD COLUMN IF NOT EXISTS eleve_id uuid REFERENCES public.eleves(id) ON DELETE CASCADE;
ALTER TABLE public.cours_vus ADD COLUMN IF NOT EXISTS termine_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_cours_vus_eleve ON public.cours_vus(eleve_id);

-- L'ancienne unicité portait sur (cours, compte) : elle empêcherait un parent
-- de deux enfants d'avoir deux progressions.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl
    FROM pg_constraint c
    WHERE c.contype = 'u'
      AND c.conrelid IN ('public.cours_vus'::regclass)
      AND pg_get_constraintdef(c.oid) = 'UNIQUE (cours_id, profile_id)'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS cours_vus_eleve_key
  ON public.cours_vus(cours_id, eleve_id) WHERE eleve_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cours_vus_staff_key
  ON public.cours_vus(cours_id, profile_id) WHERE eleve_id IS NULL;

CREATE TABLE IF NOT EXISTS public.cours_ressources_vues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) DEFAULT public.current_org_id(),
  ressource_id uuid NOT NULL REFERENCES public.cours_ressources(id) ON DELETE CASCADE,
  eleve_id uuid REFERENCES public.eleves(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vu_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cours_ressources_vues_org ON public.cours_ressources_vues(organisation_id);
CREATE INDEX IF NOT EXISTS idx_cours_ressources_vues_eleve ON public.cours_ressources_vues(eleve_id);
CREATE UNIQUE INDEX IF NOT EXISTS cours_ressources_vues_eleve_key
  ON public.cours_ressources_vues(ressource_id, eleve_id) WHERE eleve_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cours_ressources_vues_staff_key
  ON public.cours_ressources_vues(ressource_id, profile_id) WHERE eleve_id IS NULL;

-- Les consultations déjà enregistrées portent sur le document repris plus haut
INSERT INTO public.cours_ressources_vues (organisation_id, ressource_id, eleve_id, profile_id, vu_at)
SELECT v.organisation_id, r.id, v.eleve_id, v.profile_id, v.vu_at
FROM public.cours_vus v
JOIN public.cours_ressources r ON r.cours_id = v.cours_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.cours_ressources_vues x
  WHERE x.ressource_id = r.id
    AND x.eleve_id IS NOT DISTINCT FROM v.eleve_id
    AND x.profile_id = v.profile_id
);

-- ─── 5. Droits ──────────────────────────────────────────────────
ALTER TABLE public.cours_ressources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cours_ressources_vues ENABLE ROW LEVEL SECURITY;

-- Un document suit la visibilité de son cours
DROP POLICY IF EXISTS "cours_ressources_lecture" ON public.cours_ressources;
CREATE POLICY "cours_ressources_lecture" ON public.cours_ressources FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cours c
      WHERE c.id = cours_id
        AND (c.publie OR public.is_superadmin() OR public.has_role('coordinateur'))
    )
  );

DROP POLICY IF EXISTS "cours_ressources_gestion" ON public.cours_ressources;
CREATE POLICY "cours_ressources_gestion" ON public.cours_ressources FOR ALL TO authenticated
  USING (public.is_superadmin() OR public.has_role('coordinateur'))
  WITH CHECK (public.is_superadmin() OR public.has_role('coordinateur'));

-- Un parent voit la progression de ses enfants ; l'équipe du club voit tout le club.
DROP POLICY IF EXISTS "cours_vus_propre" ON public.cours_vus;
CREATE POLICY "cours_vus_propre" ON public.cours_vus FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR (eleve_id IS NOT NULL AND public.est_parent_de(eleve_id))
    OR public.is_superadmin() OR public.has_role('coordinateur')
  );

DROP POLICY IF EXISTS "cours_ressources_vues_propre" ON public.cours_ressources_vues;
CREATE POLICY "cours_ressources_vues_propre" ON public.cours_ressources_vues FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR (eleve_id IS NOT NULL AND public.est_parent_de(eleve_id))
    OR public.is_superadmin() OR public.has_role('coordinateur')
  );

-- Les enregistrements de consultation sont écrits par les routes serveur, qui
-- vérifient d'abord que l'élève est bien rattaché au compte : le navigateur
-- n'écrit jamais directement dans ces tables.
REVOKE INSERT, UPDATE, DELETE ON public.cours_vus FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.cours_ressources_vues FROM authenticated;

-- ─── 6. Isolation entre clubs ───────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cours_ressources', 'cours_ressources_vues'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "isolation_club" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "isolation_club" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING (organisation_id = public.current_org_id())
         WITH CHECK (organisation_id = public.current_org_id())', t);
    EXECUTE format('DROP TRIGGER IF EXISTS tenant_guard ON public.%I', t);
    EXECUTE format('CREATE TRIGGER tenant_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tenant_guard()', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
