-- ════════════════════════════════════════════════════════════════
-- BIA Manager — désabonnement des emails
-- À exécuter dans Supabase > SQL Editor. Idempotent.
-- ════════════════════════════════════════════════════════════════

-- Une ligne par adresse et par club : l'adresse qui refuse ne reçoit plus aucun email de ce club.
CREATE TABLE IF NOT EXISTS public.preferences_email (
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  email text NOT NULL,
  accepte boolean NOT NULL DEFAULT true,
  source text,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (organisation_id, email)
);
ALTER TABLE public.preferences_email ENABLE ROW LEVEL SECURITY;

-- Lecture par le club (pour afficher « désabonné » dans l'historique) ; écriture par le serveur uniquement.
DROP POLICY IF EXISTS "preferences_email_lecture_club" ON public.preferences_email;
CREATE POLICY "preferences_email_lecture_club" ON public.preferences_email FOR SELECT TO authenticated
  USING (organisation_id = public.current_org_id());

NOTIFY pgrst, 'reload schema';
