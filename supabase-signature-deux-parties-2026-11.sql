-- ════════════════════════════════════════════════════════════════
-- BIA Manager — signature tracée des deux parties, et PDF
-- À exécuter APRÈS supabase-signature-contrats-2026-11.sql.
-- Idempotent : peut être relancé sans risque.
--
-- Un contrat se signe à deux. Jusqu'ici seul l'aéroclub signait, et le nom
-- était tapé. Désormais chaque partie trace sa signature, et le contrat n'est
-- réputé signé que lorsque les deux l'ont fait.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Le paraphe de l'éditeur ─────────────────────────────────
-- Tracé une fois, réutilisé pour chaque contrat : c'est la signature de la
-- personne, pas celle d'un document. Elle reste modifiable à tout moment.
ALTER TABLE public.plateforme_parametres ADD COLUMN IF NOT EXISTS signature_image text;

-- ─── 2. Les deux signatures du contrat ──────────────────────────
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS signature_club_image text;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS signature_club_le timestamptz;

ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS signature_editeur_image text;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS signature_editeur_nom text;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS signature_editeur_le timestamptz;

-- ─── 3. Un statut intermédiaire ─────────────────────────────────
-- « partiel » : une seule des deux parties a signé. Sans lui, un contrat à
-- moitié signé s'afficherait comme simplement « envoyé ».
ALTER TABLE public.contrats DROP CONSTRAINT IF EXISTS contrats_statut_check;
ALTER TABLE public.contrats ADD CONSTRAINT contrats_statut_check
  CHECK (statut IN ('brouillon', 'envoye', 'partiel', 'signe', 'resilie'));

-- Les signatures déjà enregistrées l'ont été par l'aéroclub seul.
UPDATE public.contrats
SET signature_club_le = COALESCE(signature_club_le, signature_horodatage)
WHERE signature_horodatage IS NOT NULL AND signature_club_le IS NULL;

NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════
-- Fin du script.
-- ════════════════════════════════════════════════════════════════
