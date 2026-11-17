-- ════════════════════════════════════════════════════════════════
-- BIA Manager — module « Vol 3 / ULM » (novembre 2026)
-- À exécuter dans Supabase > SQL Editor APRÈS tous les scripts précédents.
-- Idempotent : peut être relancé sans risque.
--
-- Certains aéroclubs ajoutent, après les vols BIA classiques, un vol en ULM
-- subventionné par la FFPLUM. Ce vol a sa propre prime, son propre aéronef et
-- ses propres compteurs : il ne se confond pas avec le vol 2.
--
-- Contenu :
--   1. Aéronefs : lesquels sont des ULM
--   2. Élèves : colonnes du vol 3
--   3. Réglage du club : montant de la prime FFPLUM
--   4. reserver_vol : accepte le vol 3, sur un ULM uniquement
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Aéronefs ────────────────────────────────────────────────
-- Un créneau de vol 3 doit se faire sur un ULM : sans ce drapeau, rien ne
-- distingue un ULM d'un avion dans la liste des aéronefs.
ALTER TABLE public.aeronefs ADD COLUMN IF NOT EXISTS est_ulm boolean NOT NULL DEFAULT false;

-- ─── 2. Élèves ──────────────────────────────────────────────────
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS vol3_autorise boolean NOT NULL DEFAULT false;
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS vol3_effectue boolean NOT NULL DEFAULT false;
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS vol3_refuse boolean NOT NULL DEFAULT false;
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS vol3_temps_minutes integer;
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS vol3_aeronef_id uuid;
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS vol3_prix numeric;
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS vol3_pilote_nom text;
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS vol3_numero_aerogest text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'eleves_vol3_aeronef_id_fkey' AND table_name = 'eleves'
  ) THEN
    ALTER TABLE public.eleves
      ADD CONSTRAINT eleves_vol3_aeronef_id_fkey
      FOREIGN KEY (vol3_aeronef_id) REFERENCES public.aeronefs(id);
  END IF;
END $$;

-- ─── 3. Réglage du club ─────────────────────────────────────────
-- Montant versé par la FFPLUM, par élève ayant fait son vol ULM. Modifiable
-- par club : le barème peut changer d'une saison à l'autre.
INSERT INTO public.parametres (cle, valeur, description, organisation_id)
SELECT v.cle, v.valeur, v.description, o.id
FROM public.organisations o
CROSS JOIN (VALUES
  ('prime_ffplum', '40', 'Montant de la prime FFPLUM par vol ULM effectué (en euros)')
) AS v(cle, valeur, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.parametres p WHERE p.cle = v.cle AND p.organisation_id = o.id
);

-- ─── 4. Réservation du vol 3 ────────────────────────────────────
-- Reprend reserver_vol à l'identique, avec le vol 3 en plus :
--   • p_type_vol accepte désormais 3 ;
--   • un vol 3 exige un créneau sur un aéronef marqué ULM ;
--   • il demande vol3_autorise, et le vol 1 fait ou sauté — l'ULM vient après
--     le vol de découverte, jamais à sa place.
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
  IF p_type_vol NOT IN (1, 2, 3) THEN
    RAISE EXCEPTION 'Type de vol invalide';
  END IF;

  -- Verrou sur le créneau : deux réservations simultanées passent l'une après l'autre
  SELECT cr.*, COALESCE(a.nb_places_eleves, 1) AS capacite, COALESCE(a.est_ulm, false) AS est_ulm INTO c
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
  -- Les deux parents de l'élève peuvent réserver
  IF NOT v_staff AND NOT est_parent_de(p_eleve_id) THEN
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
  -- Multi-année : un élève inscrit sur 2026 ne réserve pas un créneau de 2027.
  IF c.annee_id IS NOT NULL AND e.annee_id IS NOT NULL AND c.annee_id <> e.annee_id THEN
    RAISE EXCEPTION 'Ce créneau appartient à une autre année scolaire que celle de l''élève';
  END IF;
  -- Un vol ULM se fait sur un ULM, et un vol BIA sur un avion.
  IF p_type_vol = 3 AND NOT c.est_ulm THEN
    RAISE EXCEPTION 'Le vol ULM demande un créneau sur un aéronef déclaré ULM';
  END IF;
  IF p_type_vol <> 3 AND c.est_ulm THEN
    RAISE EXCEPTION 'Ce créneau est en ULM : il ne peut accueillir qu''un vol ULM';
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
  ELSIF p_type_vol = 2 THEN
    IF COALESCE(e.vol2_refuse, false) THEN
      RAISE EXCEPTION 'Cet élève a indiqué ne pas souhaiter faire le vol 2';
    END IF;
    IF NOT COALESCE(e.vol2_autorise, false) THEN
      RAISE EXCEPTION 'Le vol 2 n''est pas encore autorisé pour cet élève';
    END IF;
    IF NOT (COALESCE(e.vol1_effectue, false) OR COALESCE(e.vol1_skippe, false)) THEN
      RAISE EXCEPTION 'Le vol 1 doit être effectué avant le vol 2';
    END IF;
    IF COALESCE(e.vol2_effectue, false) THEN
      RAISE EXCEPTION 'Le vol 2 est déjà effectué';
    END IF;
  ELSE
    IF COALESCE(e.vol3_refuse, false) THEN
      RAISE EXCEPTION 'Cet élève a indiqué ne pas souhaiter faire le vol ULM';
    END IF;
    IF NOT COALESCE(e.vol3_autorise, false) THEN
      RAISE EXCEPTION 'Le vol ULM n''est pas encore autorisé pour cet élève';
    END IF;
    IF NOT (COALESCE(e.vol1_effectue, false) OR COALESCE(e.vol1_skippe, false)) THEN
      RAISE EXCEPTION 'Le vol 1 doit être effectué avant le vol ULM';
    END IF;
    IF COALESCE(e.vol3_effectue, false) THEN
      RAISE EXCEPTION 'Le vol ULM est déjà effectué';
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

-- ════════════════════════════════════════════════════════════════
-- Fin du script.
-- ════════════════════════════════════════════════════════════════
