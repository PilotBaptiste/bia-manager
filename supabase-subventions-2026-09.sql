-- ════════════════════════════════════════════════════════════════
-- BIA Manager — subventions par établissement(s)
-- À exécuter dans Supabase > SQL Editor. Idempotent.
-- Une subvention a un montant total, rattaché à une année et à un ou plusieurs établissements.
-- L'application la répartit entre les élèves de ces établissements (montant ÷ nombre d'élèves).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.subventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annee_id uuid NOT NULL REFERENCES public.annees(id) ON DELETE CASCADE,
  libelle text NOT NULL,
  financeur text,
  montant_total numeric(10, 2) NOT NULL CHECK (montant_total >= 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  etablissement_ids uuid[] NOT NULL CHECK (cardinality(etablissement_ids) > 0),
  note text,
  cree_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subventions_annee ON public.subventions(annee_id);

ALTER TABLE public.subventions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subventions_superadmin" ON public.subventions;
CREATE POLICY "subventions_superadmin" ON public.subventions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND 'superadmin' = ANY (roles)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND 'superadmin' = ANY (roles)));

NOTIFY pgrst, 'reload schema';
