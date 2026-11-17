-- ════════════════════════════════════════════════════════════════
-- BIA Manager — signature électronique des contrats (novembre 2026)
-- À exécuter dans Supabase > SQL Editor APRÈS supabase-contrats-2026-11.sql.
-- Idempotent : peut être relancé sans risque.
--
-- Le président d'un aéroclub n'a pas de compte sur la plateforme : il signe
-- depuis un lien reçu par email, après avoir saisi un code à usage unique
-- envoyé à cette même adresse.
--
-- Ce qui donne sa valeur à la signature, ce n'est pas le nom tapé mais le
-- faisceau d'indices conservé autour : adresse vérifiée par le code, moment
-- exact, adresse IP, et empreinte SHA-256 du document tel qu'il a été affiché.
-- Si le texte change d'un caractère, l'empreinte ne correspond plus.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Le lien de signature ────────────────────────────────────
-- Jeton tiré au hasard, à durée limitée, qui tient lieu d'adresse secrète.
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS signature_token text;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS token_expire_le timestamptz;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS signataire_email text;
CREATE UNIQUE INDEX IF NOT EXISTS contrats_signature_token_key
  ON public.contrats(signature_token) WHERE signature_token IS NOT NULL;

-- ─── 2. Le code à usage unique ──────────────────────────────────
-- Le code n'est jamais stocké en clair : seule son empreinte l'est, comme un
-- mot de passe. Le compteur de tentatives arrête la recherche à l'aveugle.
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS code_empreinte text;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS code_expire_le timestamptz;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS code_tentatives int NOT NULL DEFAULT 0;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS code_envoye_le timestamptz;

-- ─── 3. La preuve de signature ──────────────────────────────────
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS signature_id text;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS signature_nom text;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS signature_email text;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS signature_ip text;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS signature_agent text;
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS signature_horodatage timestamptz;
-- Empreinte SHA-256 du document affiché au signataire, au moment de signer.
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS document_empreinte text;
-- Chemin du document signé, archivé tel quel.
ALTER TABLE public.contrats ADD COLUMN IF NOT EXISTS document_path text;

-- ─── 4. Archive des documents signés ────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('contrats', 'contrats', false)
ON CONFLICT (id) DO NOTHING;

-- Seul le propriétaire de la plateforme lit cette archive depuis le
-- navigateur. Le signataire, lui, reçoit sa copie par email : il n'a pas de
-- compte et ne passe donc jamais par ici.
DROP POLICY IF EXISTS "contrats_archive_proprietaire" ON storage.objects;
CREATE POLICY "contrats_archive_proprietaire" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'contrats' AND public.is_platform_owner())
  WITH CHECK (bucket_id = 'contrats' AND public.is_platform_owner());

NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════
-- Fin du script.
-- ════════════════════════════════════════════════════════════════
