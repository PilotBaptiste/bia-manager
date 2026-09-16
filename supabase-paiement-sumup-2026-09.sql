-- ════════════════════════════════════════════════════════════════
-- BIA Manager — encaissement en ligne SumUp, un compte par aéroclub
-- À exécuter dans Supabase > SQL Editor. Idempotent.
-- ════════════════════════════════════════════════════════════════

-- Clés SumUp de chaque club. Aucune politique d'accès : la table est invisible depuis le navigateur,
-- même pour un admin de club. Seules les routes serveur (clé service) la lisent.
CREATE TABLE IF NOT EXISTS public.organisation_secrets (
  organisation_id uuid PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  sumup_api_key text,
  sumup_merchant_code text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.organisation_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organisation_secrets FROM anon, authenticated;

-- Suivi des encaissements : sert à retrouver le club et l'élève quand SumUp confirme un paiement.
CREATE TABLE IF NOT EXISTS public.paiements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  eleve_id uuid NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  reference text NOT NULL UNIQUE,
  montant numeric(10, 2) NOT NULL CHECK (montant > 0),
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'paye', 'echoue')),
  sumup_checkout_id text,
  cree_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_paiements_org ON public.paiements(organisation_id);
CREATE INDEX IF NOT EXISTS idx_paiements_checkout ON public.paiements(sumup_checkout_id);
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

-- Lecture réservée au club concerné (admin, coordinateur, gérant) ; écriture par le serveur uniquement.
DROP POLICY IF EXISTS "paiements_lecture_club" ON public.paiements;
CREATE POLICY "paiements_lecture_club" ON public.paiements FOR SELECT TO authenticated
  USING (organisation_id = public.current_org_id());

NOTIFY pgrst, 'reload schema';
