-- ════════════════════════════════════════════════════════════════
-- BIA Manager — invitations des parents (novembre 2026)
-- À exécuter dans Supabase > SQL Editor APRÈS tous les scripts précédents
-- (sécurité, évolutions 2026-09 et 2026-11, tarifs, subventions,
--  multi-clubs, modules, désabonnement des emails).
-- Idempotent : peut être relancé sans risque.
--
-- Contenu :
--   1. Statut d'accès des parents (qui n'a jamais activé son compte)
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Statut d'accès des parents ──────────────────────────────
-- Le bouton « Invitation parent » de la page Élèves doit pouvoir cibler les
-- familles qui n'ont pas encore de compte utilisable. Deux cas distincts :
--   • aucun compte : l'adresse n'existe pas dans auth.users ;
--   • compte jamais activé : créé par l'import FFA, mot de passe jamais défini,
--     donc jamais de connexion.
-- auth.users n'est pas lisible depuis le navigateur : cette fonction fait le
-- pont, en SECURITY DEFINER.
--
-- Garde-fous contre l'énumération d'adresses :
--   • réservée à l'équipe du club (superadmin, coordinateur, gérant) ;
--   • ne répond que pour des adresses déjà connues du club — parent d'un élève
--     de ce club, ou compte rattaché à ce club. Une adresse inconnue est
--     absente du résultat, sans distinction entre « inconnue » et « pas de
--     compte ».
CREATE OR REPLACE FUNCTION public.statut_acces_parents(p_emails text[])
RETURNS TABLE (email text, a_compte boolean, deja_connecte boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  WITH moi AS (
    SELECT organisation_id, COALESCE(roles, '{}'::text[]) AS roles
    FROM profiles
    WHERE id = auth.uid() AND COALESCE(actif, true)
  ),
  demandes AS (
    SELECT DISTINCT lower(trim(e)) AS email
    FROM unnest(COALESCE(p_emails, '{}'::text[])) AS e
    WHERE trim(COALESCE(e, '')) <> ''
  ),
  connues AS (
    SELECT d.email
    FROM demandes d
    CROSS JOIN moi m
    WHERE m.organisation_id IS NOT NULL
      AND m.roles && ARRAY['superadmin', 'coordinateur', 'gerant']::text[]
      AND (
        EXISTS (
          SELECT 1 FROM eleves el
          WHERE el.organisation_id = m.organisation_id
            AND (lower(el.parent_email) = d.email OR lower(el.parent2_email) = d.email)
        )
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.organisation_id = m.organisation_id
            AND lower(p.email) = d.email
        )
      )
  )
  SELECT c.email,
         (u.id IS NOT NULL) AS a_compte,
         (u.last_sign_in_at IS NOT NULL) AS deja_connecte
  FROM connues c
  LEFT JOIN auth.users u ON lower(u.email) = c.email;
$$;

GRANT EXECUTE ON FUNCTION public.statut_acces_parents(text[]) TO authenticated;

-- ════════════════════════════════════════════════════════════════
-- Fin du script.
-- ════════════════════════════════════════════════════════════════
