-- ════════════════════════════════════════════════════════════════
-- BIA Manager — identité de l'éditeur et contrats par aéroclub
-- À exécuter dans Supabase > SQL Editor APRÈS tous les scripts précédents.
-- Idempotent : peut être relancé sans risque.
--
-- Deux choses, liées par la même information :
--   • l'identité de l'éditeur de la plateforme, qui alimente à la fois les
--     mentions légales du site et l'en-tête des contrats ;
--   • un contrat par aéroclub — d'abord le contrat de sous-traitance RGPD
--     (article 28), que tout club doit signer puisqu'il confie des données
--     de mineurs à la plateforme.
--
-- Ces deux tables sont au niveau de la plateforme, pas du club : elles ne
-- portent donc pas la politique d'isolation habituelle, mais sont réservées
-- au propriétaire.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Identité de l'éditeur ───────────────────────────────────
-- Une seule ligne : la contrainte sur la clé primaire l'impose.
CREATE TABLE IF NOT EXISTS public.plateforme_parametres (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  editeur_nom text,
  editeur_statut text,
  editeur_siret text,
  editeur_adresse text,
  editeur_email text,
  editeur_telephone text,
  editeur_directeur text,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.plateforme_parametres (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.plateforme_parametres ENABLE ROW LEVEL SECURITY;

-- Les mentions légales sont publiques : tout le monde doit pouvoir lire
-- l'identité de l'éditeur. Seul le propriétaire la modifie.
DROP POLICY IF EXISTS "plateforme_parametres_lecture" ON public.plateforme_parametres;
CREATE POLICY "plateforme_parametres_lecture" ON public.plateforme_parametres FOR SELECT TO authenticated, anon
  USING (true);
DROP POLICY IF EXISTS "plateforme_parametres_ecriture" ON public.plateforme_parametres;
CREATE POLICY "plateforme_parametres_ecriture" ON public.plateforme_parametres FOR UPDATE TO authenticated
  USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

REVOKE INSERT, DELETE ON public.plateforme_parametres FROM authenticated, anon;

-- ─── 2. Contrats ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contrats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  -- 'sous_traitance' : le contrat RGPD article 28, obligatoire.
  -- 'abonnement'     : les conditions commerciales, facultatives.
  type text NOT NULL DEFAULT 'sous_traitance' CHECK (type IN ('sous_traitance', 'abonnement')),
  reference text,

  -- Coordonnées juridiques du club, telles qu'elles figurent au contrat.
  -- Elles ne vivent pas dans `organisations` : le nom d'affichage d'un club
  -- (« ACBA ») n'est pas sa raison sociale.
  club_raison_sociale text,
  club_adresse text,
  club_siret text,
  club_representant text,
  club_fonction text,
  club_email text,

  date_effet date,
  date_fin date,
  montant_annuel numeric,

  statut text NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon', 'envoye', 'signe', 'resilie')),
  envoye_le timestamptz,
  signe_le date,
  signe_par text,
  resilie_le date,

  -- Clauses ajoutées pour ce club seulement, imprimées en fin de contrat.
  clauses_particulieres text,
  notes text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contrats_org ON public.contrats(organisation_id);
-- Un seul contrat de chaque type par club : on modifie, on ne duplique pas.
CREATE UNIQUE INDEX IF NOT EXISTS contrats_org_type_key ON public.contrats(organisation_id, type);

ALTER TABLE public.contrats ENABLE ROW LEVEL SECURITY;

-- Les contrats ne regardent que le propriétaire de la plateforme : ni les
-- clubs, ni leurs administrateurs n'y ont accès par l'application.
DROP POLICY IF EXISTS "contrats_proprietaire" ON public.contrats;
CREATE POLICY "contrats_proprietaire" ON public.contrats FOR ALL TO authenticated
  USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS contrats_touch ON public.contrats;
CREATE TRIGGER contrats_touch BEFORE UPDATE ON public.contrats
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS plateforme_parametres_touch ON public.plateforme_parametres;
CREATE TRIGGER plateforme_parametres_touch BEFORE UPDATE ON public.plateforme_parametres
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════
-- Fin du script.
-- ════════════════════════════════════════════════════════════════
