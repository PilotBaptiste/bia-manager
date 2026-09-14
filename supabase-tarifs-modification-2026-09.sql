-- ════════════════════════════════════════════════════════════════
-- BIA Manager — modifier ou supprimer un tarif horaire déjà saisi
-- À exécuter dans Supabase > SQL Editor APRÈS supabase-tarifs-2026-09.sql.
-- Idempotent : peut être relancé sans risque.
-- ════════════════════════════════════════════════════════════════

-- ─── Recalcul commun des vols d'un avion sur une période ────────
-- Vols clôturés datés dans [p_debut, p_fin) : prix = temps × tarif en vigueur à la date du vol.
-- Vols saisis à la main (sans date) : années scolaires qui chevauchent la période,
-- au tarif en vigueur au début de ce chevauchement. Inclus seulement si p_inclure_sans_date.
CREATE OR REPLACE FUNCTION public.recalculer_vols_aeronef(
  p_aeronef_id uuid,
  p_debut date,
  p_fin date,
  p_inclure_sans_date boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_impacts jsonb := '[]'::jsonb;
  v_avant numeric := 0;
  v_apres numeric := 0;
  v_sans_date int := 0;
  f record;
  v_nouveau numeric;
  v_nb int;
BEGIN
  FOR f IN
    SELECT v.id, v.creneau_id, v.temps_vol_minutes, v.prix_total, v.nb_eleves, c.date_vol
    FROM vols_effectues v
    JOIN creneaux c ON c.id = v.creneau_id
    WHERE c.aeronef_id = p_aeronef_id
      AND c.date_vol >= p_debut
      AND (p_fin IS NULL OR c.date_vol < p_fin)
    ORDER BY c.date_vol
  LOOP
    v_nouveau := round(f.temps_vol_minutes / 60.0 * tarif_aeronef(p_aeronef_id, f.date_vol), 2);
    CONTINUE WHEN v_nouveau = f.prix_total;

    UPDATE vols_effectues SET prix_total = v_nouveau WHERE id = f.id;
    SELECT count(*) INTO v_nb FROM reservations WHERE creneau_id = f.creneau_id AND statut = 'effectue';
    v_nb := GREATEST(COALESCE(NULLIF(v_nb, 0), f.nb_eleves, 1), 1);
    UPDATE eleves e SET vol1_prix = v_nouveau / v_nb
    FROM reservations r
    WHERE r.creneau_id = f.creneau_id AND r.statut = 'effectue' AND r.type_vol <> 2 AND e.id = r.eleve_id;
    UPDATE eleves e SET vol2_prix = v_nouveau / v_nb
    FROM reservations r
    WHERE r.creneau_id = f.creneau_id AND r.statut = 'effectue' AND r.type_vol = 2 AND e.id = r.eleve_id;

    v_avant := v_avant + f.prix_total;
    v_apres := v_apres + v_nouveau;
    v_impacts := v_impacts || jsonb_build_array(jsonb_build_object(
      'source', 'cloture',
      'id', f.id,
      'date', f.date_vol,
      'temps', f.temps_vol_minutes,
      'avant', f.prix_total,
      'apres', v_nouveau,
      'eleves', (SELECT string_agg(e.prenom || ' ' || e.nom, ', ') FROM reservations r JOIN eleves e ON e.id = r.eleve_id
                 WHERE r.creneau_id = f.creneau_id AND r.statut = 'effectue')
    ));
  END LOOP;

  FOR f IN
    SELECT e.id, e.prenom, e.nom, n.num AS type_vol, an.date_debut,
           CASE WHEN n.num = 1 THEN e.vol1_temps_minutes ELSE e.vol2_temps_minutes END AS temps,
           CASE WHEN n.num = 1 THEN e.vol1_prix ELSE e.vol2_prix END AS prix
    FROM eleves e
    JOIN annees an ON an.id = e.annee_id
    CROSS JOIN (VALUES (1), (2)) AS n(num)
    WHERE (CASE WHEN n.num = 1 THEN e.vol1_effectue AND e.vol1_aeronef_id = p_aeronef_id
                ELSE e.vol2_effectue AND e.vol2_aeronef_id = p_aeronef_id END)
      AND (CASE WHEN n.num = 1 THEN e.vol1_temps_minutes ELSE e.vol2_temps_minutes END) > 0
      AND an.date_fin >= p_debut
      AND (p_fin IS NULL OR an.date_debut < p_fin)
      AND NOT EXISTS (
        SELECT 1 FROM reservations r JOIN vols_effectues v ON v.creneau_id = r.creneau_id
        WHERE r.eleve_id = e.id AND r.type_vol = n.num AND r.statut = 'effectue'
      )
  LOOP
    v_nouveau := round(f.temps / 60.0 * tarif_aeronef(p_aeronef_id, GREATEST(f.date_debut, p_debut)), 2);
    CONTINUE WHEN v_nouveau = COALESCE(f.prix, -1);
    v_sans_date := v_sans_date + 1;
    CONTINUE WHEN NOT p_inclure_sans_date;

    IF f.type_vol = 1 THEN
      UPDATE eleves SET vol1_prix = v_nouveau WHERE id = f.id;
    ELSE
      UPDATE eleves SET vol2_prix = v_nouveau WHERE id = f.id;
    END IF;
    v_avant := v_avant + COALESCE(f.prix, 0);
    v_apres := v_apres + v_nouveau;
    v_impacts := v_impacts || jsonb_build_array(jsonb_build_object(
      'source', 'manuel',
      'id', f.id::text || '_vol' || f.type_vol::text,
      'date', NULL,
      'temps', f.temps,
      'avant', f.prix,
      'apres', v_nouveau,
      'eleves', f.prenom || ' ' || f.nom || ' — Vol ' || f.type_vol::text
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'impacts', v_impacts,
    'nb_vols', jsonb_array_length(v_impacts),
    'total_avant', v_avant,
    'total_apres', v_apres,
    'sans_date_disponibles', v_sans_date
  );
END;
$$;

-- Fonction interne : jamais appelée directement depuis l'application
REVOKE ALL ON FUNCTION public.recalculer_vols_aeronef(uuid, date, date, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.exiger_superadmin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND 'superadmin' = ANY (roles) AND COALESCE(actif, true)
  ) THEN
    RAISE EXCEPTION 'Réservé au superadmin' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.exiger_superadmin() FROM PUBLIC, anon, authenticated;

-- ─── Ajouter un tarif (remplace la version précédente, même comportement) ──
CREATE OR REPLACE FUNCTION public.changer_tarif_aeronef(
  p_aeronef_id uuid,
  p_prix_heure numeric,
  p_date_effet date,
  p_note text DEFAULT NULL,
  p_inclure_sans_date boolean DEFAULT false,
  p_simulation boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_fin date;
  v_result jsonb;
BEGIN
  PERFORM exiger_superadmin();
  IF p_prix_heure IS NULL OR p_prix_heure < 0 THEN
    RAISE EXCEPTION 'Prix horaire invalide';
  END IF;
  IF p_date_effet IS NULL THEN
    RAISE EXCEPTION 'Date d''effet obligatoire';
  END IF;
  PERFORM 1 FROM aeronefs WHERE id = p_aeronef_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aéronef introuvable';
  END IF;

  BEGIN
    INSERT INTO aeronef_tarifs (aeronef_id, prix_heure, date_effet, note, cree_par)
    VALUES (p_aeronef_id, round(p_prix_heure, 2), p_date_effet, NULLIF(btrim(p_note), ''), auth.uid())
    ON CONFLICT (aeronef_id, date_effet)
    DO UPDATE SET prix_heure = EXCLUDED.prix_heure, note = COALESCE(EXCLUDED.note, aeronef_tarifs.note), cree_par = EXCLUDED.cree_par;
    UPDATE aeronefs SET prix_heure = tarif_aeronef(p_aeronef_id, (now() AT TIME ZONE 'Europe/Paris')::date) WHERE id = p_aeronef_id;

    SELECT min(date_effet) INTO v_fin FROM aeronef_tarifs WHERE aeronef_id = p_aeronef_id AND date_effet > p_date_effet;
    v_result := recalculer_vols_aeronef(p_aeronef_id, p_date_effet, v_fin, p_inclure_sans_date);

    IF p_simulation THEN
      RAISE EXCEPTION 'simulation' USING ERRCODE = 'P0B01';
    END IF;
  EXCEPTION WHEN SQLSTATE 'P0B01' THEN
    NULL; -- aperçu : écritures annulées, résultat conservé
  END;

  RETURN v_result || jsonb_build_object('simulation', p_simulation, 'debut_periode', p_date_effet, 'fin_periode', v_fin);
END;
$$;

-- ─── Modifier un tarif existant (prix, date d'effet, note) ──────
-- Période recalculée : de la plus ancienne des deux dates jusqu'au tarif suivant la plus récente.
CREATE OR REPLACE FUNCTION public.modifier_tarif_aeronef(
  p_tarif_id uuid,
  p_prix_heure numeric,
  p_date_effet date,
  p_note text DEFAULT NULL,
  p_inclure_sans_date boolean DEFAULT false,
  p_simulation boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t record;
  v_initial boolean;
  v_debut date;
  v_fin date;
  v_result jsonb;
BEGIN
  PERFORM exiger_superadmin();
  IF p_prix_heure IS NULL OR p_prix_heure < 0 THEN
    RAISE EXCEPTION 'Prix horaire invalide';
  END IF;
  IF p_date_effet IS NULL THEN
    RAISE EXCEPTION 'Date d''effet obligatoire';
  END IF;

  SELECT * INTO t FROM aeronef_tarifs WHERE id = p_tarif_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarif introuvable';
  END IF;
  PERFORM 1 FROM aeronefs WHERE id = t.aeronef_id FOR UPDATE;

  v_initial := NOT EXISTS (SELECT 1 FROM aeronef_tarifs WHERE aeronef_id = t.aeronef_id AND date_effet < t.date_effet);
  IF v_initial AND p_date_effet <> t.date_effet THEN
    RAISE EXCEPTION 'La date du tarif initial ne peut pas être modifiée : ajoutez plutôt un nouveau tarif';
  END IF;
  IF EXISTS (SELECT 1 FROM aeronef_tarifs WHERE aeronef_id = t.aeronef_id AND date_effet = p_date_effet AND id <> p_tarif_id) THEN
    RAISE EXCEPTION 'Un autre tarif commence déjà le %', to_char(p_date_effet, 'DD/MM/YYYY');
  END IF;
  IF NOT v_initial AND p_date_effet <= (SELECT min(date_effet) FROM aeronef_tarifs WHERE aeronef_id = t.aeronef_id) THEN
    RAISE EXCEPTION 'La date doit être postérieure au tarif initial';
  END IF;

  BEGIN
    UPDATE aeronef_tarifs
    SET prix_heure = round(p_prix_heure, 2), date_effet = p_date_effet, note = NULLIF(btrim(p_note), ''), cree_par = auth.uid()
    WHERE id = p_tarif_id;
    UPDATE aeronefs SET prix_heure = tarif_aeronef(t.aeronef_id, (now() AT TIME ZONE 'Europe/Paris')::date) WHERE id = t.aeronef_id;

    v_debut := LEAST(t.date_effet, p_date_effet);
    SELECT min(date_effet) INTO v_fin FROM aeronef_tarifs
    WHERE aeronef_id = t.aeronef_id AND date_effet > GREATEST(t.date_effet, p_date_effet);
    v_result := recalculer_vols_aeronef(t.aeronef_id, v_debut, v_fin, p_inclure_sans_date);

    IF p_simulation THEN
      RAISE EXCEPTION 'simulation' USING ERRCODE = 'P0B01';
    END IF;
  EXCEPTION WHEN SQLSTATE 'P0B01' THEN
    NULL;
  END;

  RETURN v_result || jsonb_build_object('simulation', p_simulation, 'debut_periode', v_debut, 'fin_periode', v_fin);
END;
$$;

-- ─── Supprimer un tarif (les vols reprennent le tarif précédent) ──
CREATE OR REPLACE FUNCTION public.supprimer_tarif_aeronef(
  p_tarif_id uuid,
  p_inclure_sans_date boolean DEFAULT false,
  p_simulation boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t record;
  v_fin date;
  v_result jsonb;
BEGIN
  PERFORM exiger_superadmin();
  SELECT * INTO t FROM aeronef_tarifs WHERE id = p_tarif_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarif introuvable';
  END IF;
  PERFORM 1 FROM aeronefs WHERE id = t.aeronef_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM aeronef_tarifs WHERE aeronef_id = t.aeronef_id AND date_effet < t.date_effet) THEN
    RAISE EXCEPTION 'Le tarif initial ne peut pas être supprimé';
  END IF;

  BEGIN
    DELETE FROM aeronef_tarifs WHERE id = p_tarif_id;
    UPDATE aeronefs SET prix_heure = tarif_aeronef(t.aeronef_id, (now() AT TIME ZONE 'Europe/Paris')::date) WHERE id = t.aeronef_id;

    SELECT min(date_effet) INTO v_fin FROM aeronef_tarifs WHERE aeronef_id = t.aeronef_id AND date_effet > t.date_effet;
    v_result := recalculer_vols_aeronef(t.aeronef_id, t.date_effet, v_fin, p_inclure_sans_date);

    IF p_simulation THEN
      RAISE EXCEPTION 'simulation' USING ERRCODE = 'P0B01';
    END IF;
  EXCEPTION WHEN SQLSTATE 'P0B01' THEN
    NULL;
  END;

  RETURN v_result || jsonb_build_object('simulation', p_simulation, 'debut_periode', t.date_effet, 'fin_periode', v_fin);
END;
$$;

REVOKE ALL ON FUNCTION public.modifier_tarif_aeronef(uuid, numeric, date, text, boolean, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.supprimer_tarif_aeronef(uuid, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.changer_tarif_aeronef(uuid, numeric, date, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.modifier_tarif_aeronef(uuid, numeric, date, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supprimer_tarif_aeronef(uuid, boolean, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
