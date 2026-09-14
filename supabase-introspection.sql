-- ════════════════════════════════════════════════════════════════
-- BIA Manager — audit des droits de la base réelle
-- À coller dans Supabase > SQL Editor. Lecture seule, ne modifie rien.
-- Donne ce que l'API ne montre pas : politiques RLS, fonctions, triggers, contraintes.
-- ════════════════════════════════════════════════════════════════

-- 1. Tables sans RLS activé (doit être vide)
SELECT n.nspname AS schema, c.relname AS table_sans_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname = 'public' AND NOT c.relrowsecurity;

-- 2. Politiques RLS (public + storage)
SELECT schemaname, tablename, policyname, cmd, roles, qual AS condition_lecture, with_check AS condition_ecriture
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

-- 3. Fonctions (dont SECURITY DEFINER)
SELECT n.nspname AS schema, p.proname AS fonction, pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'auth') AND p.prokind = 'f'
  AND NOT (n.nspname = 'auth' AND p.proname NOT IN ('has_role', 'is_superadmin', 'user_etablissement_id'))
ORDER BY 1, 2;

-- 4. Triggers
SELECT event_object_schema AS schema, event_object_table AS table, trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema IN ('public', 'auth')
ORDER BY 2, 3;

-- 5. Contraintes CHECK et UNIQUE
SELECT conrelid::regclass AS table, conname AS contrainte, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace AND contype IN ('c', 'u')
ORDER BY 1, 2;
