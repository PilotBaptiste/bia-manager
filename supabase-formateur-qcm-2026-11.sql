-- ════════════════════════════════════════════════════════════════
-- BIA Manager — rôle formateur, QCM et devoirs (novembre 2026)
-- À exécuter dans Supabase > SQL Editor APRÈS tous les scripts précédents.
-- Idempotent : peut être relancé sans risque.
--
-- Le module Cours devient un vrai espace de formation :
--   • un rôle « formateur » qui n'a accès qu'aux cours, bornés à ses
--     établissements — il ne voit ni les vols, ni les paiements, ni les
--     familles des autres lycées ;
--   • des QCM qu'il crée, attribue, et dont il reçoit les copies corrigées
--     automatiquement ;
--   • des devoirs que les familles déposent en fichier, qu'il note et commente,
--     et qu'il rend visibles ou non à la famille.
--
-- Les élèves n'ont pas de compte : c'est le compte famille qui ouvre l'espace
-- et choisit l'enfant, comme pour le suivi des cours. Une copie appartient donc
-- à l'ÉLÈVE, et les deux parents voient la même.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Périmètre du formateur ──────────────────────────────────
-- Comme les pilotes, un formateur est rattaché à des établissements. Il voit
-- les élèves de ces établissements, et eux seuls.
CREATE OR REPLACE FUNCTION public.est_formateur_de(p_eleve_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN eleves e ON e.id = p_eleve_id
    WHERE p.id = auth.uid()
      AND COALESCE(p.actif, true)
      AND 'formateur' = ANY (COALESCE(p.roles, '{}'::text[]))
      AND p.organisation_id = e.organisation_id
      AND (
        -- Sans établissement coché, le formateur suit toute la promo du club.
        COALESCE(array_length(p.etablissement_ids, 1), 0) = 0
        OR e.etablissement_id = ANY (p.etablissement_ids)
      )
  );
$$;
GRANT EXECUTE ON FUNCTION public.est_formateur_de(uuid) TO authenticated;

/** Raccourci : l'équipe qui a le droit de créer et corriger. */
CREATE OR REPLACE FUNCTION public.peut_gerer_cours()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.is_superadmin() OR public.has_role('coordinateur') OR public.has_role('formateur');
$$;
GRANT EXECUTE ON FUNCTION public.peut_gerer_cours() TO authenticated;

-- ─── 2. QCM ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qcm (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) DEFAULT public.current_org_id(),
  annee_id uuid REFERENCES public.annees(id) ON DELETE SET NULL,
  cours_id uuid REFERENCES public.cours(id) ON DELETE SET NULL,
  titre text NOT NULL,
  description text,
  matiere text NOT NULL DEFAULT 'Général',
  -- Tant qu'il n'est pas publié, le QCM reste un brouillon invisible des familles.
  publie boolean NOT NULL DEFAULT false,
  -- La correction s'affiche-t-elle à la famille dès la copie rendue ?
  correction_immediate boolean NOT NULL DEFAULT true,
  cree_par uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qcm_org ON public.qcm(organisation_id);
CREATE INDEX IF NOT EXISTS idx_qcm_annee ON public.qcm(annee_id);

CREATE TABLE IF NOT EXISTS public.qcm_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) DEFAULT public.current_org_id(),
  qcm_id uuid NOT NULL REFERENCES public.qcm(id) ON DELETE CASCADE,
  enonce text NOT NULL,
  explication text,
  points numeric NOT NULL DEFAULT 1,
  ordre int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_qcm_questions_qcm ON public.qcm_questions(qcm_id);

CREATE TABLE IF NOT EXISTS public.qcm_choix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) DEFAULT public.current_org_id(),
  question_id uuid NOT NULL REFERENCES public.qcm_questions(id) ON DELETE CASCADE,
  texte text NOT NULL,
  correct boolean NOT NULL DEFAULT false,
  ordre int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_qcm_choix_question ON public.qcm_choix(question_id);

-- Une copie par élève et par QCM : attribution et résultat dans la même ligne.
CREATE TABLE IF NOT EXISTS public.qcm_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) DEFAULT public.current_org_id(),
  qcm_id uuid NOT NULL REFERENCES public.qcm(id) ON DELETE CASCADE,
  eleve_id uuid NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  attribue_le timestamptz DEFAULT now(),
  commence_le timestamptz,
  termine_le timestamptz,
  score numeric,
  total numeric,
  commentaire text,
  -- Le formateur peut garder un résultat pour lui avant de le rendre.
  resultat_visible boolean NOT NULL DEFAULT true,
  UNIQUE (qcm_id, eleve_id)
);
CREATE INDEX IF NOT EXISTS idx_qcm_copies_eleve ON public.qcm_copies(eleve_id);

CREATE TABLE IF NOT EXISTS public.qcm_reponses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) DEFAULT public.current_org_id(),
  copie_id uuid NOT NULL REFERENCES public.qcm_copies(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.qcm_questions(id) ON DELETE CASCADE,
  choix_id uuid REFERENCES public.qcm_choix(id) ON DELETE CASCADE,
  UNIQUE (copie_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_qcm_reponses_copie ON public.qcm_reponses(copie_id);

-- ─── 3. Devoirs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.devoirs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) DEFAULT public.current_org_id(),
  annee_id uuid REFERENCES public.annees(id) ON DELETE SET NULL,
  cours_id uuid REFERENCES public.cours(id) ON DELETE SET NULL,
  titre text NOT NULL,
  consigne text,
  matiere text NOT NULL DEFAULT 'Général',
  date_limite date,
  note_sur numeric NOT NULL DEFAULT 20,
  publie boolean NOT NULL DEFAULT false,
  cree_par uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_devoirs_org ON public.devoirs(organisation_id);

CREATE TABLE IF NOT EXISTS public.devoir_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) DEFAULT public.current_org_id(),
  devoir_id uuid NOT NULL REFERENCES public.devoirs(id) ON DELETE CASCADE,
  eleve_id uuid NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  attribue_le timestamptz DEFAULT now(),
  fichier_path text,
  fichier_nom text,
  fichier_taille bigint,
  rendu_le timestamptz,
  note numeric,
  commentaire text,
  corrige_le timestamptz,
  -- Le formateur décide s'il renvoie la correction à la famille.
  resultat_visible boolean NOT NULL DEFAULT false,
  UNIQUE (devoir_id, eleve_id)
);
CREATE INDEX IF NOT EXISTS idx_devoir_copies_eleve ON public.devoir_copies(eleve_id);

-- ─── 4. Droits ──────────────────────────────────────────────────
ALTER TABLE public.qcm ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qcm_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qcm_choix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qcm_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qcm_reponses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devoirs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devoir_copies ENABLE ROW LEVEL SECURITY;

-- Un QCM publié est lisible par tous ; un brouillon seulement par l'équipe.
DROP POLICY IF EXISTS "qcm_lecture" ON public.qcm;
CREATE POLICY "qcm_lecture" ON public.qcm FOR SELECT TO authenticated
  USING (publie OR public.peut_gerer_cours());
DROP POLICY IF EXISTS "qcm_gestion" ON public.qcm;
CREATE POLICY "qcm_gestion" ON public.qcm FOR ALL TO authenticated
  USING (public.peut_gerer_cours()) WITH CHECK (public.peut_gerer_cours());

DROP POLICY IF EXISTS "qcm_questions_lecture" ON public.qcm_questions;
CREATE POLICY "qcm_questions_lecture" ON public.qcm_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qcm q WHERE q.id = qcm_id AND (q.publie OR public.peut_gerer_cours())));
DROP POLICY IF EXISTS "qcm_questions_gestion" ON public.qcm_questions;
CREATE POLICY "qcm_questions_gestion" ON public.qcm_questions FOR ALL TO authenticated
  USING (public.peut_gerer_cours()) WITH CHECK (public.peut_gerer_cours());

-- Les bonnes réponses ne sortent JAMAIS vers une famille : le navigateur de
-- l'élève reçoit les choix par une route serveur, qui retire la colonne
-- « correct ». Sans cette restriction, le QCM se triche en lisant la base.
DROP POLICY IF EXISTS "qcm_choix_lecture" ON public.qcm_choix;
CREATE POLICY "qcm_choix_lecture" ON public.qcm_choix FOR SELECT TO authenticated
  USING (public.peut_gerer_cours());
DROP POLICY IF EXISTS "qcm_choix_gestion" ON public.qcm_choix;
CREATE POLICY "qcm_choix_gestion" ON public.qcm_choix FOR ALL TO authenticated
  USING (public.peut_gerer_cours()) WITH CHECK (public.peut_gerer_cours());

-- Une copie se lit par la famille de l'élève, par l'équipe, et par le
-- formateur des établissements concernés.
DROP POLICY IF EXISTS "qcm_copies_lecture" ON public.qcm_copies;
CREATE POLICY "qcm_copies_lecture" ON public.qcm_copies FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR public.has_role('coordinateur')
    OR public.est_formateur_de(eleve_id)
    OR public.est_parent_de(eleve_id)
  );
DROP POLICY IF EXISTS "qcm_copies_gestion" ON public.qcm_copies;
CREATE POLICY "qcm_copies_gestion" ON public.qcm_copies FOR ALL TO authenticated
  USING (public.is_superadmin() OR public.has_role('coordinateur') OR public.est_formateur_de(eleve_id))
  WITH CHECK (public.is_superadmin() OR public.has_role('coordinateur') OR public.est_formateur_de(eleve_id));

DROP POLICY IF EXISTS "qcm_reponses_lecture" ON public.qcm_reponses;
CREATE POLICY "qcm_reponses_lecture" ON public.qcm_reponses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.qcm_copies c
      WHERE c.id = copie_id
        AND (
          public.is_superadmin()
          OR public.has_role('coordinateur')
          OR public.est_formateur_de(c.eleve_id)
          OR public.est_parent_de(c.eleve_id)
        )
    )
  );

-- Les réponses sont écrites par la route serveur, qui corrige et calcule le
-- score : le navigateur ne doit pas pouvoir se mettre 20/20.
REVOKE INSERT, UPDATE, DELETE ON public.qcm_reponses FROM authenticated;

DROP POLICY IF EXISTS "devoirs_lecture" ON public.devoirs;
CREATE POLICY "devoirs_lecture" ON public.devoirs FOR SELECT TO authenticated
  USING (publie OR public.peut_gerer_cours());
DROP POLICY IF EXISTS "devoirs_gestion" ON public.devoirs;
CREATE POLICY "devoirs_gestion" ON public.devoirs FOR ALL TO authenticated
  USING (public.peut_gerer_cours()) WITH CHECK (public.peut_gerer_cours());

DROP POLICY IF EXISTS "devoir_copies_lecture" ON public.devoir_copies;
CREATE POLICY "devoir_copies_lecture" ON public.devoir_copies FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR public.has_role('coordinateur')
    OR public.est_formateur_de(eleve_id)
    OR public.est_parent_de(eleve_id)
  );
-- La famille dépose son fichier, le formateur note : les deux écrivent, mais
-- la note reste protégée par le déclencheur plus bas.
DROP POLICY IF EXISTS "devoir_copies_ecriture" ON public.devoir_copies;
CREATE POLICY "devoir_copies_ecriture" ON public.devoir_copies FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR public.has_role('coordinateur')
    OR public.est_formateur_de(eleve_id)
    OR public.est_parent_de(eleve_id)
  )
  WITH CHECK (
    public.is_superadmin()
    OR public.has_role('coordinateur')
    OR public.est_formateur_de(eleve_id)
    OR public.est_parent_de(eleve_id)
  );
DROP POLICY IF EXISTS "devoir_copies_gestion" ON public.devoir_copies;
CREATE POLICY "devoir_copies_gestion" ON public.devoir_copies AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin() OR public.has_role('coordinateur') OR public.est_formateur_de(eleve_id));
DROP POLICY IF EXISTS "devoir_copies_suppression" ON public.devoir_copies;
CREATE POLICY "devoir_copies_suppression" ON public.devoir_copies AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.is_superadmin() OR public.has_role('coordinateur') OR public.est_formateur_de(eleve_id));

-- Une famille peut déposer et remplacer son fichier, rien d'autre : la note,
-- le commentaire et la visibilité restent la main du formateur.
CREATE OR REPLACE FUNCTION public.devoir_copie_garde()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.is_superadmin() OR public.has_role('coordinateur') OR public.est_formateur_de(NEW.eleve_id) THEN
    RETURN NEW;
  END IF;
  IF NEW.note IS DISTINCT FROM OLD.note
     OR NEW.commentaire IS DISTINCT FROM OLD.commentaire
     OR NEW.corrige_le IS DISTINCT FROM OLD.corrige_le
     OR NEW.resultat_visible IS DISTINCT FROM OLD.resultat_visible
     OR NEW.eleve_id IS DISTINCT FROM OLD.eleve_id
     OR NEW.devoir_id IS DISTINCT FROM OLD.devoir_id THEN
    RAISE EXCEPTION 'Seul le formateur peut corriger ce devoir' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS devoir_copie_garde ON public.devoir_copies;
CREATE TRIGGER devoir_copie_garde BEFORE UPDATE ON public.devoir_copies
  FOR EACH ROW EXECUTE FUNCTION public.devoir_copie_garde();

-- ─── 5. Le formateur voit ses élèves, et eux seuls ──────────────
-- Il lui faut le nom des élèves de ses établissements pour attribuer et
-- corriger ; il n'a aucun droit d'écriture sur leur fiche.
DROP POLICY IF EXISTS "eleves_formateur_lecture" ON public.eleves;
CREATE POLICY "eleves_formateur_lecture" ON public.eleves FOR SELECT TO authenticated
  USING (public.est_formateur_de(id));

DROP POLICY IF EXISTS "etablissements_formateur_lecture" ON public.etablissements;
CREATE POLICY "etablissements_formateur_lecture" ON public.etablissements FOR SELECT TO authenticated
  USING (public.has_role('formateur'));

-- ─── 6. Dépôt des devoirs ───────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('devoirs', 'devoirs', false)
ON CONFLICT (id) DO NOTHING;

-- Le chemin d'un fichier commence par l'identifiant de l'élève : la famille
-- n'atteint que les dossiers de ses propres enfants. Cette fonction lit cet
-- identifiant sans jamais lever d'erreur : un chemin mal formé ne doit pas
-- faire échouer la règle, seulement ne correspondre à personne.
CREATE OR REPLACE FUNCTION public.eleve_du_chemin(p_nom text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(COALESCE(p_nom, ''), '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN split_part(p_nom, '/', 1)::uuid
  END;
$$;
GRANT EXECUTE ON FUNCTION public.eleve_du_chemin(text) TO authenticated;
DROP POLICY IF EXISTS "devoirs_depot" ON storage.objects;
CREATE POLICY "devoirs_depot" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'devoirs'
    AND (
      public.peut_gerer_cours()
      OR public.est_parent_de(public.eleve_du_chemin(name))
    )
  );

DROP POLICY IF EXISTS "devoirs_lecture_fichier" ON storage.objects;
CREATE POLICY "devoirs_lecture_fichier" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'devoirs'
    AND (
      public.is_superadmin()
      OR public.has_role('coordinateur')
      OR public.est_formateur_de(public.eleve_du_chemin(name))
      OR public.est_parent_de(public.eleve_du_chemin(name))
    )
  );

DROP POLICY IF EXISTS "devoirs_suppression_fichier" ON storage.objects;
CREATE POLICY "devoirs_suppression_fichier" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'devoirs'
    AND (
      public.peut_gerer_cours()
      OR public.est_parent_de(public.eleve_du_chemin(name))
    )
  );

-- ─── 7. Isolation entre clubs ───────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['qcm', 'qcm_questions', 'qcm_choix', 'qcm_copies', 'qcm_reponses', 'devoirs', 'devoir_copies'] LOOP
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

-- ════════════════════════════════════════════════════════════════
-- Fin du script.
-- ════════════════════════════════════════════════════════════════
