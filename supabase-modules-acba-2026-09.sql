-- Active tous les modules existants pour l'ACBA (le club pour lequel ils ont été construits).
-- Les autres clubs gardent leur sélection : leurs modules se cochent dans la console propriétaire.
UPDATE public.organisations
SET modules = ARRAY(SELECT DISTINCT unnest(modules || ARRAY[
  'finances', 'subventions', 'releve_compte', 'roulage', 'statistiques', 'messagerie',
  'attestation_en_ligne', 'reservation_en_ligne', 'import_csv', 'archives', 'reglementation', 'export_ffa'
]))
WHERE slug = 'acba';

SELECT slug, modules FROM public.organisations ORDER BY slug;
