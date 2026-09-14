-- ════════════════════════════════════════════════════════════════
-- BIA Manager — tarifs horaires datés et recalcul des vols
-- À exécuter dans Supabase > SQL Editor APRÈS supabase-evolutions-2026-09.sql.
-- Idempotent : peut être relancé sans risque.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Tarifs avec date d'effet ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.aeronef_tarifs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aeronef_id uuid NOT NULL REFERENCES public.aeronefs(id) ON DELETE CASCADE,
  prix_heure numeric(10, 2) NOT NULL CHECK (prix_heure >= 0),
  date_effet date NOT NULL,
  note text,
  cree_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (aeronef_id, date_effet)
);

ALTER TABLE public.aeronef_tarifs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aeronef_tarifs_lecture" ON public.aeronef_tarifs;
CREATE POLICY "aeronef_tarifs_lecture" ON public.aeronef_tarifs FOR SELECT TO authenticated USING (true);
-- Aucune écriture directe : tout passe par changer_tarif_aeronef (superadmin).

-- ─── 2. Reprise de l'historique existant ────────────────────────
-- L'ancien historique stockait « ancien prix + date du changement » :
-- chaque ancien prix valait jusqu'à sa date, le prix actuel depuis le dernier changement.
DO $$
DECLARE
  a record;
  h record;
  v_debut date;
  v_note text;
BEGIN
  FOR a IN SELECT * FROM public.aeronefs t WHERE NOT EXISTS (SELECT 1 FROM public.aeronef_tarifs x WHERE x.aeronef_id = t.id) LOOP
    v_debut := DATE '2000-01-01';
    v_note := 'Tarif initial';
    FOR h IN
      SELECT (value ->> 'prix')::numeric AS prix, (value ->> 'date')::date AS date_changement, value ->> 'note' AS note
      FROM jsonb_array_elements(COALESCE(a.prix_heure_historique, '[]'::jsonb))
      ORDER BY (value ->> 'date')::date
    LOOP
      INSERT INTO public.aeronef_tarifs (aeronef_id, prix_heure, date_effet, note)
      VALUES (a.id, h.prix, v_debut, v_note)
      ON CONFLICT (aeronef_id, date_effet) DO UPDATE SET prix_heure = EXCLUDED.prix_heure;
      v_debut := h.date_changement;
      v_note := h.note;
    END LOOP;
    INSERT INTO public.aeronef_tarifs (aeronef_id, prix_heure, date_effet, note)
    VALUES (a.id, a.prix_heure, v_debut, v_note)
    ON CONFLICT (aeronef_id, date_effet) DO UPDATE SET prix_heure = EXCLUDED.prix_heure;
  END LOOP;
END $$;

-- Un nouvel avion reçoit automatiquement son tarif initial
CREATE OR REPLACE FUNCTION public.aeronef_tarif_initial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO aeronef_tarifs (aeronef_id, prix_heure, date_effet, note, cree_par)
  VALUES (NEW.id, NEW.prix_heure, DATE '2000-01-01', 'Tarif initial', auth.uid())
  ON CONFLICT (aeronef_id, date_effet) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aeronef_tarif_initial ON public.aeronefs;
CREATE TRIGGER aeronef_tarif_initial
  AFTER INSERT ON public.aeronefs
  FOR EACH ROW EXECUTE FUNCTION public.aeronef_tarif_initial();

-- ─── 3. Tarif applicable à une date ─────────────────────────────
CREATE OR REPLACE FUNCTION public.tarif_aeronef(p_aeronef_id uuid, p_date date)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT prix_heure FROM aeronef_tarifs WHERE aeronef_id = p_aeronef_id AND date_effet <= p_date ORDER BY date_effet DESC LIMIT 1),
    (SELECT prix_heure FROM aeronef_tarifs WHERE aeronef_id = p_aeronef_id ORDER BY date_effet ASC LIMIT 1),
    (SELECT prix_heure FROM aeronefs WHERE id = p_aeronef_id)
  );
$$;

-- ─── 4. Changer un tarif (antidaté ou non) et recalculer les vols ──
-- p_simulation = true : calcule l'impact sans rien enregistrer (aperçu).
-- Vols recalculés : ceux de cet avion entre la date d'effet et le tarif suivant.
-- p_inclure_sans_date : inclut les vols saisis à la main sur la fiche élève (sans date de vol),
-- pour les années scolaires qui chevauchent la période du nouveau tarif.
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
  v_uid uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_fin date;
  v_impacts jsonb := '[]'::jsonb;
  v_avant numeric := 0;
  v_apres numeric := 0;
  v_sans_date int := 0;
  f record;
  v_tarif numeric;
  v_nouveau numeric;
  v_nb int;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_uid AND 'superadmin' = ANY (roles) AND COALESCE(actif, true)) THEN
    RAISE EXCEPTION 'Réservé au superadmin' USING ERRCODE = '42501';
  END IF;
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
    VALUES (p_aeronef_id, round(p_prix_heure, 2), p_date_effet, NULLIF(btrim(p_note), ''), v_uid)
    ON CONFLICT (aeronef_id, date_effet)
    DO UPDATE SET prix_heure = EXCLUDED.prix_heure, note = COALESCE(EXCLUDED.note, aeronef_tarifs.note), cree_par = EXCLUDED.cree_par;

    UPDATE aeronefs SET prix_heure = tarif_aeronef(p_aeronef_id, v_today) WHERE id = p_aeronef_id;

    SELECT min(date_effet) INTO v_fin FROM aeronef_tarifs WHERE aeronef_id = p_aeronef_id AND date_effet > p_date_effet;

    -- Vols clôturés (datés par leur créneau)
    FOR f IN
      SELECT v.id, v.creneau_id, v.temps_vol_minutes, v.prix_total, v.nb_eleves, c.date_vol
      FROM vols_effectues v
      JOIN creneaux c ON c.id = v.creneau_id
      WHERE c.aeronef_id = p_aeronef_id
        AND c.date_vol >= p_date_effet
        AND (v_fin IS NULL OR c.date_vol < v_fin)
      ORDER BY c.date_vol
    LOOP
      v_tarif := tarif_aeronef(p_aeronef_id, f.date_vol);
      v_nouveau := round(f.temps_vol_minutes / 60.0 * v_tarif, 2);
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

    -- Vols saisis à la main sur la fiche élève (prix du vol complet, sans date de vol)
    FOR f IN
      SELECT e.id, e.prenom, e.nom, n.num AS type_vol,
             CASE WHEN n.num = 1 THEN e.vol1_temps_minutes ELSE e.vol2_temps_minutes END AS temps,
             CASE WHEN n.num = 1 THEN e.vol1_prix ELSE e.vol2_prix END AS prix
      FROM eleves e
      JOIN annees an ON an.id = e.annee_id
      CROSS JOIN (VALUES (1), (2)) AS n(num)
      WHERE (CASE WHEN n.num = 1 THEN e.vol1_effectue AND e.vol1_aeronef_id = p_aeronef_id
                  ELSE e.vol2_effectue AND e.vol2_aeronef_id = p_aeronef_id END)
        AND (CASE WHEN n.num = 1 THEN e.vol1_temps_minutes ELSE e.vol2_temps_minutes END) > 0
        AND an.date_fin >= p_date_effet
        AND (v_fin IS NULL OR an.date_debut < v_fin)
        AND NOT EXISTS (
          SELECT 1 FROM reservations r JOIN vols_effectues v ON v.creneau_id = r.creneau_id
          WHERE r.eleve_id = e.id AND r.type_vol = n.num AND r.statut = 'effectue'
        )
    LOOP
      v_nouveau := round(f.temps / 60.0 * round(p_prix_heure, 2), 2);
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

    IF p_simulation THEN
      RAISE EXCEPTION 'simulation' USING ERRCODE = 'P0B01';
    END IF;
  EXCEPTION WHEN SQLSTATE 'P0B01' THEN
    NULL; -- aperçu : toutes les écritures ci-dessus sont annulées, les totaux calculés sont conservés
  END;

  RETURN jsonb_build_object(
    'simulation', p_simulation,
    'impacts', v_impacts,
    'nb_vols', jsonb_array_length(v_impacts),
    'total_avant', v_avant,
    'total_apres', v_apres,
    'sans_date_disponibles', v_sans_date,
    'fin_periode', v_fin
  );
END;
$$;

REVOKE ALL ON FUNCTION public.changer_tarif_aeronef(uuid, numeric, date, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.changer_tarif_aeronef(uuid, numeric, date, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tarif_aeronef(uuid, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
