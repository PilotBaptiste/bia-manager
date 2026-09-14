-- ════════════════════════════════════════════════════════════════
-- BIA Manager — évolutions (septembre 2026)
-- À exécuter dans Supabase > SQL Editor APRÈS supabase-securite-2026-09.sql.
-- Idempotent : peut être relancé sans risque.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Clôture multi-Aérogest ──────────────────────────────────
-- En base, numero_aerogest était obligatoire : une clôture avec un numéro par élève
-- (obligatoire dès 2027) était refusée.
ALTER TABLE public.vols_effectues ALTER COLUMN numero_aerogest DROP NOT NULL;
ALTER TABLE public.vols_effectues ADD COLUMN IF NOT EXISTS numeros_aerogest text[];

-- ─── 2. Date de l'examen BIA par année scolaire ─────────────────
ALTER TABLE public.annees ADD COLUMN IF NOT EXISTS date_examen_bia date;

-- Reprise de l'ancien réglage global sur l'année active
DO $$
DECLARE
  v_date date;
BEGIN
  SELECT NULLIF(btrim(valeur), '')::date INTO v_date
  FROM public.parametres WHERE cle = 'date_examen_bia';
  IF v_date IS NOT NULL THEN
    UPDATE public.annees SET date_examen_bia = v_date
    WHERE active = true AND date_examen_bia IS NULL;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Ancienne date d''examen illisible, à saisir dans Paramètres';
END $$;

-- ─── 3. Informations du club (préalable au multi-clubs) ─────────
INSERT INTO public.parametres (cle, valeur, description)
SELECT v.cle, v.valeur, v.description
FROM (VALUES
  ('nom_aeroclub', 'Aéro-Club du Bassin d''Arcachon', 'Nom complet de l''aéroclub'),
  ('sigle_aeroclub', 'ACBA', 'Sigle affiché dans le menu et les emails'),
  ('lieu_vol', E'Aérodrome de Villemarie\n33260 La Teste de Buch', 'Lieu des vols (une information par ligne)'),
  ('whatsapp_support', '33756919167', 'Numéro WhatsApp du support, format international sans +'),
  ('telephone_support', '07 56 91 91 67', 'Numéro du support affiché')
) AS v(cle, valeur, description)
WHERE NOT EXISTS (SELECT 1 FROM public.parametres p WHERE p.cle = v.cle);

-- ─── 4. Transactions : réservation, annulation, clôture ─────────
-- Chaque opération s'exécute entièrement ou pas du tout : une coupure réseau
-- ne peut plus laisser un vol ou une réservation à moitié enregistré.

CREATE OR REPLACE FUNCTION public.reserver_vol(p_creneau_id uuid, p_eleve_id uuid, p_type_vol int)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_roles text[];
  v_staff boolean;
  v_today date := (now() AT TIME ZONE 'Europe/Paris')::date;
  c record;
  e record;
  v_exam date;
  v_occupees int;
  v_res_id uuid;
  v_res_statut text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT roles INTO v_roles FROM profiles WHERE id = v_uid AND COALESCE(actif, true);
  IF v_roles IS NULL THEN
    RAISE EXCEPTION 'Compte désactivé' USING ERRCODE = '42501';
  END IF;
  v_staff := v_roles && ARRAY['superadmin', 'pilote', 'coordinateur', 'gerant'];
  IF p_type_vol NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Type de vol invalide';
  END IF;

  -- Verrou sur le créneau : deux réservations simultanées passent l'une après l'autre
  SELECT cr.*, COALESCE(a.nb_places_eleves, 1) AS capacite INTO c
  FROM creneaux cr
  LEFT JOIN aeronefs a ON a.id = cr.aeronef_id
  WHERE cr.id = p_creneau_id
  FOR UPDATE OF cr;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Créneau introuvable';
  END IF;
  IF c.statut NOT IN ('ouvert', 'confirme') THEN
    RAISE EXCEPTION 'Ce créneau n''est plus ouvert aux réservations';
  END IF;
  IF c.date_vol < v_today THEN
    RAISE EXCEPTION 'Ce créneau est déjà passé';
  END IF;

  SELECT * INTO e FROM eleves WHERE id = p_eleve_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Élève introuvable';
  END IF;
  IF NOT v_staff AND e.parent_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Cet élève n''est pas rattaché à votre compte' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(e.abandonne, false) THEN
    RAISE EXCEPTION 'Cet élève est marqué comme abandonné';
  END IF;

  IF COALESCE(array_length(c.etablissement_ids, 1), 0) > 0 THEN
    IF NOT (e.etablissement_id::text = ANY (c.etablissement_ids)) THEN
      RAISE EXCEPTION 'Ce créneau n''est pas ouvert à l''établissement de l''élève';
    END IF;
  ELSIF c.etablissement_id IS NOT NULL AND c.etablissement_id <> e.etablissement_id THEN
    RAISE EXCEPTION 'Ce créneau n''est pas ouvert à l''établissement de l''élève';
  END IF;
  IF COALESCE(array_length(c.eleves_autorises, 1), 0) > 0 AND NOT (p_eleve_id = ANY (c.eleves_autorises)) THEN
    RAISE EXCEPTION 'Ce créneau est réservé à d''autres élèves';
  END IF;

  IF p_type_vol = 1 THEN
    IF NOT (COALESCE(e.paiement_effectue, false) AND COALESCE(e.attestation_signee, false)) THEN
      RAISE EXCEPTION 'Le paiement et l''attestation parentale sont requis avant le vol 1';
    END IF;
    IF COALESCE(e.vol1_effectue, false) OR COALESCE(e.vol1_skippe, false) THEN
      RAISE EXCEPTION 'Le vol 1 est déjà effectué';
    END IF;
    IF e.bia_resultat = 'Non admis' THEN
      RAISE EXCEPTION 'Vol 1 impossible : BIA non admis';
    END IF;
    SELECT date_examen_bia INTO v_exam FROM annees WHERE id = c.annee_id;
    IF v_exam IS NOT NULL AND v_exam < v_today THEN
      RAISE EXCEPTION 'Vol 1 impossible : la date de l''examen BIA est passée';
    END IF;
  ELSE
    IF NOT COALESCE(e.vol2_autorise, false) THEN
      RAISE EXCEPTION 'Le vol 2 n''est pas encore autorisé pour cet élève';
    END IF;
    IF NOT (COALESCE(e.vol1_effectue, false) OR COALESCE(e.vol1_skippe, false)) THEN
      RAISE EXCEPTION 'Le vol 1 doit être effectué avant le vol 2';
    END IF;
    IF COALESCE(e.vol2_effectue, false) THEN
      RAISE EXCEPTION 'Le vol 2 est déjà effectué';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM reservations r
    JOIN creneaux cc ON cc.id = r.creneau_id
    WHERE r.eleve_id = p_eleve_id AND r.type_vol = p_type_vol
      AND r.statut IN ('reserve', 'confirme') AND cc.statut <> 'annule'
      AND r.creneau_id <> p_creneau_id
  ) THEN
    RAISE EXCEPTION 'Une réservation est déjà active pour le vol %. Annulez-la d''abord.', p_type_vol;
  END IF;

  SELECT count(*) INTO v_occupees
  FROM reservations
  WHERE creneau_id = p_creneau_id AND statut <> 'annule' AND eleve_id <> p_eleve_id;
  IF v_occupees >= c.capacite THEN
    RAISE EXCEPTION 'Créneau complet';
  END IF;

  SELECT id, statut INTO v_res_id, v_res_statut
  FROM reservations WHERE creneau_id = p_creneau_id AND eleve_id = p_eleve_id;
  IF v_res_id IS NOT NULL THEN
    IF v_res_statut <> 'annule' THEN
      RAISE EXCEPTION 'Cet élève est déjà inscrit sur ce créneau';
    END IF;
    UPDATE reservations
    SET statut = 'reserve', type_vol = p_type_vol, motif_annulation = NULL, annule_par = NULL, annule_le = NULL
    WHERE id = v_res_id;
  ELSE
    INSERT INTO reservations (creneau_id, eleve_id, type_vol, statut)
    VALUES (p_creneau_id, p_eleve_id, p_type_vol, 'reserve')
    RETURNING id INTO v_res_id;
  END IF;
  RETURN v_res_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_reservation(p_reservation_id uuid, p_motif text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_roles text[];
  v_staff boolean;
  r record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT roles INTO v_roles FROM profiles WHERE id = v_uid AND COALESCE(actif, true);
  IF v_roles IS NULL THEN
    RAISE EXCEPTION 'Compte désactivé' USING ERRCODE = '42501';
  END IF;
  v_staff := v_roles && ARRAY['superadmin', 'pilote', 'coordinateur', 'gerant'];

  SELECT res.id, res.statut, e.parent_id, c.date_vol, c.heure_debut INTO r
  FROM reservations res
  JOIN eleves e ON e.id = res.eleve_id
  JOIN creneaux c ON c.id = res.creneau_id
  WHERE res.id = p_reservation_id
  FOR UPDATE OF res;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable';
  END IF;
  IF NOT v_staff AND r.parent_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Cette réservation ne concerne pas votre enfant' USING ERRCODE = '42501';
  END IF;
  IF r.statut = 'effectue' THEN
    RAISE EXCEPTION 'Ce vol a déjà été effectué';
  END IF;
  IF r.statut = 'annule' THEN
    RETURN;
  END IF;
  IF NOT v_staff AND ((r.date_vol + r.heure_debut) AT TIME ZONE 'Europe/Paris') - now() < interval '48 hours' THEN
    RAISE EXCEPTION 'Annulation impossible moins de 48 h avant le vol : contactez le pilote';
  END IF;

  UPDATE reservations
  SET statut = 'annule', motif_annulation = p_motif, annule_par = v_uid, annule_le = now()
  WHERE id = p_reservation_id;
END;
$$;

-- p_numeros_par_reservation : {"<reservation_id>": "<numéro Aérogest>"} quand chaque élève a son numéro
CREATE OR REPLACE FUNCTION public.cloturer_vol(
  p_creneau_id uuid,
  p_temps_vol_minutes int,
  p_prix_total numeric,
  p_numero_aerogest text DEFAULT NULL,
  p_numeros_par_reservation jsonb DEFAULT NULL,
  p_nb_eleves int DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_pilote_nom text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_roles text[];
  c record;
  v_nb int;
  v_multi boolean := p_numeros_par_reservation IS NOT NULL AND p_numeros_par_reservation <> '{}'::jsonb;
  v_annee_debut int;
  v_pilote text;
  v_prix_eleve numeric;
  v_numeros text[];
  v_vol_id uuid;
  r record;
  v_num text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT roles INTO v_roles FROM profiles WHERE id = v_uid AND COALESCE(actif, true);
  IF v_roles IS NULL THEN
    RAISE EXCEPTION 'Compte désactivé' USING ERRCODE = '42501';
  END IF;

  SELECT cr.*, btrim(COALESCE(p.prenom, '') || ' ' || COALESCE(p.nom, '')) AS pilote_nom_creneau INTO c
  FROM creneaux cr
  LEFT JOIN profiles p ON p.id = cr.pilote_id
  WHERE cr.id = p_creneau_id
  FOR UPDATE OF cr;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Créneau introuvable';
  END IF;
  IF NOT ('superadmin' = ANY (v_roles) OR c.pilote_id = v_uid) THEN
    RAISE EXCEPTION 'Seul le pilote du créneau ou un superadmin peut clôturer ce vol' USING ERRCODE = '42501';
  END IF;
  IF c.statut IN ('termine', 'annule') THEN
    RAISE EXCEPTION 'Ce créneau est déjà clôturé ou annulé';
  END IF;
  IF p_temps_vol_minutes IS NULL OR p_temps_vol_minutes <= 0 THEN
    RAISE EXCEPTION 'Temps de vol invalide';
  END IF;
  IF p_prix_total IS NULL OR p_prix_total < 0 THEN
    RAISE EXCEPTION 'Prix du vol invalide';
  END IF;

  SELECT count(*) INTO v_nb FROM reservations WHERE creneau_id = p_creneau_id AND statut <> 'annule';

  SELECT substring(label FROM '\d{4}')::int INTO v_annee_debut FROM annees WHERE id = c.annee_id;
  IF v_nb >= 2 AND COALESCE(v_annee_debut, 0) >= 2027 AND NOT v_multi THEN
    RAISE EXCEPTION 'À partir de 2027, un numéro Aérogest par élève est obligatoire';
  END IF;

  IF v_multi THEN
    IF EXISTS (
      SELECT 1 FROM reservations res
      WHERE res.creneau_id = p_creneau_id AND res.statut <> 'annule'
        AND COALESCE(btrim(p_numeros_par_reservation ->> res.id::text), '') = ''
    ) THEN
      RAISE EXCEPTION 'Un numéro Aérogest est requis pour chacun des % élèves', v_nb;
    END IF;
    SELECT array_agg(btrim(p_numeros_par_reservation ->> res.id::text) ORDER BY res.created_at, res.id) INTO v_numeros
    FROM reservations res
    WHERE res.creneau_id = p_creneau_id AND res.statut <> 'annule';
  ELSIF COALESCE(btrim(p_numero_aerogest), '') = '' THEN
    RAISE EXCEPTION 'Numéro Aérogest obligatoire';
  END IF;

  v_pilote := COALESCE(NULLIF(btrim(p_pilote_nom), ''), NULLIF(c.pilote_nom_creneau, ''));
  v_prix_eleve := p_prix_total / GREATEST(v_nb, 1);

  INSERT INTO vols_effectues (creneau_id, numero_aerogest, numeros_aerogest, temps_vol_minutes, nb_eleves, prix_total, notes, valide_par)
  VALUES (
    p_creneau_id,
    CASE WHEN v_multi THEN NULL ELSE btrim(p_numero_aerogest) END,
    v_numeros,
    p_temps_vol_minutes,
    COALESCE(NULLIF(p_nb_eleves, 0), v_nb),
    p_prix_total,
    NULLIF(btrim(p_notes), ''),
    v_uid
  )
  RETURNING id INTO v_vol_id;

  UPDATE creneaux SET statut = 'termine' WHERE id = p_creneau_id;

  FOR r IN
    SELECT id, eleve_id, type_vol FROM reservations
    WHERE creneau_id = p_creneau_id AND statut <> 'annule'
  LOOP
    v_num := CASE WHEN v_multi THEN btrim(p_numeros_par_reservation ->> r.id::text) ELSE btrim(p_numero_aerogest) END;
    UPDATE reservations SET statut = 'effectue' WHERE id = r.id;
    IF r.type_vol = 2 THEN
      UPDATE eleves SET
        vol2_effectue = true, vol2_temps_minutes = p_temps_vol_minutes, vol2_aeronef_id = c.aeronef_id,
        vol2_prix = v_prix_eleve, vol2_pilote_nom = v_pilote, vol2_numero_aerogest = v_num
      WHERE id = r.eleve_id;
    ELSE
      UPDATE eleves SET
        vol1_effectue = true, vol1_temps_minutes = p_temps_vol_minutes, vol1_aeronef_id = c.aeronef_id,
        vol1_prix = v_prix_eleve, vol1_pilote_nom = v_pilote, vol1_numero_aerogest = v_num
      WHERE id = r.eleve_id;
    END IF;
  END LOOP;

  RETURN v_vol_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserver_vol(uuid, uuid, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.annuler_reservation(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cloturer_vol(uuid, int, numeric, text, jsonb, int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserver_vol(uuid, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.annuler_reservation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cloturer_vol(uuid, int, numeric, text, jsonb, int, text, text) TO authenticated;

-- Recharge le cache de l'API pour exposer les nouvelles fonctions immédiatement
NOTIFY pgrst, 'reload schema';
