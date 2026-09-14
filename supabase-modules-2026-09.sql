-- ════════════════════════════════════════════════════════════════
-- BIA Manager — modules activables club par club
-- À exécuter dans Supabase > SQL Editor. Idempotent.
-- ════════════════════════════════════════════════════════════════

-- Liste des modules optionnels activés pour chaque club (modifiable uniquement depuis la console propriétaire)
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS modules text[] NOT NULL DEFAULT '{}';

-- Module d'essai activé sur le club de test uniquement
UPDATE public.organisations
SET modules = array_append(modules, 'laboratoire')
WHERE slug = 'aeroclub-test' AND NOT ('laboratoire' = ANY (modules));

NOTIFY pgrst, 'reload schema';
