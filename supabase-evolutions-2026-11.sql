-- ════════════════════════════════════════════════════════════════
-- BIA Manager — lot de novembre 2026
-- À exécuter dans Supabase > SQL Editor APRÈS tous les scripts précédents
-- (sécurité, évolutions 2026-09, tarifs, subventions, multi-clubs, modules,
--  désabonnement des emails).
-- Idempotent : peut être relancé sans risque.
--
-- Contenu :
--   1. Deuxième parent par élève (familles séparées)
--   2. Vol 2 : refus de l'élève, et déblocage malgré un BIA non admis
--   3. Support : contact du club pour les familles
--   4. Cours (mini-LMS) : documents et liens par matière
--   5. Posés en campagne sur les vols instructeur
--   6. Paiement en ligne HelloAsso (clés par club)
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Deuxième parent ─────────────────────────────────────────
-- Cas des parents séparés : deux contacts, deux comptes, deux adresses email.
-- Les deux reçoivent les emails et peuvent réserver ou annuler un vol.
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS parent2_nom text;
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS parent2_prenom text;
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS parent2_email text;
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS parent2_telephone text;
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS parent2_id uuid REFERENCES public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_eleves_parent2 ON public.eleves(parent2_id);

-- Vrai si le compte connecté est l'un des deux parents de l'élève.
-- Rattache aussi un parent qui s'est inscrit avec la même adresse sans avoir été lié.
CREATE OR REPLACE FUNCTION public.est_parent_de(p_eleve_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM eleves e
    WHERE e.id = p_eleve_id
      AND (
        e.parent_id = auth.uid()
        OR e.parent2_id = auth.uid()
        OR lower(COALESCE(e.parent_email, '')) = (SELECT lower(email) FROM profiles WHERE id = auth.uid())
        OR lower(COALESCE(e.parent2_email, '')) = (SELECT lower(email) FROM profiles WHERE id = auth.uid())
      )
  );
$$;
GRANT EXECUTE ON FUNCTION public.est_parent_de(uuid) TO authenticated;

DROP POLICY IF EXISTS "eleves_parent" ON public.eleves;
CREATE POLICY "eleves_parent" ON public.eleves FOR SELECT TO authenticated
  USING (public.est_parent_de(id));

DROP POLICY IF EXISTS "reserv_parent" ON public.reservations;
CREATE POLICY "reserv_parent" ON public.reservations FOR INSERT TO authenticated
  WITH CHECK (public.has_role('parent') AND public.est_parent_de(eleve_id));

-- Les pilotes voient aussi le profil du SECOND parent des élèves de leurs créneaux.
-- Politique ajoutée à côté de « profiles_select » plutôt qu'à sa place : les politiques
-- permissives se cumulent (OU logique), donc rien de l'existant n'est modifié.
DROP POLICY IF EXISTS "profiles_select_parent2" ON public.profiles;
CREATE POLICY "profiles_select_parent2" ON public.profiles FOR SELECT TO authenticated
  USING (
    public.has_role('pilote') AND id IN (
      SELECT e.parent2_id FROM eleves e
      JOIN reservations r ON r.eleve_id = e.id
      JOIN creneaux c ON c.id = r.creneau_id
      WHERE c.pilote_id = auth.uid() AND e.parent2_id IS NOT NULL
    )
  );

-- ─── 2. Vol 2 ───────────────────────────────────────────────────
-- vol2_refuse : l'élève ne souhaite pas faire le vol 2 (il sort des listes « à programmer »)
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS vol2_refuse boolean NOT NULL DEFAULT false;

-- Réglage par club : autoriser le vol 2 même si le BIA n'est pas obtenu
INSERT INTO public.parametres (cle, valeur, description, organisation_id)
SELECT v.cle, v.valeur, v.description, o.id
FROM public.organisations o
CROSS JOIN (VALUES
  ('vol2_sans_bia', 'false', 'Autoriser le vol 2 même si le BIA n''est pas obtenu'),
  ('email_support', '', 'Adresse de contact affichée aux familles dans Support'),
  ('message_support', '', 'Message affiché aux familles dans Support')
) AS v(cle, valeur, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.parametres p WHERE p.cle = v.cle AND p.organisation_id = o.id
);

-- ─── 3. Transactions mises à jour (second parent + vol 2) ───────
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

  SELECT res.id, res.statut, res.eleve_id, c.date_vol, c.heure_debut INTO r
  FROM reservations res
  JOIN creneaux c ON c.id = res.creneau_id
  WHERE res.id = p_reservation_id
  FOR UPDATE OF res;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable';
  END IF;
  -- Les deux parents peuvent annuler : chacun est prévenu par email de l'annulation
  IF NOT v_staff AND NOT est_parent_de(r.eleve_id) THEN
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

-- ─── 4. Cours (mini-LMS) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) DEFAULT public.current_org_id(),
  titre text NOT NULL,
  description text,
  matiere text NOT NULL DEFAULT 'Général',
  type text NOT NULL DEFAULT 'fichier' CHECK (type IN ('fichier', 'lien')),
  fichier_path text,
  fichier_nom text,
  fichier_taille bigint,
  url text,
  ordre int NOT NULL DEFAULT 0,
  publie boolean NOT NULL DEFAULT true,
  cree_par uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK ((type = 'fichier' AND fichier_path IS NOT NULL) OR (type = 'lien' AND url IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_cours_org ON public.cours(organisation_id);

CREATE TABLE IF NOT EXISTS public.cours_vus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) DEFAULT public.current_org_id(),
  cours_id uuid NOT NULL REFERENCES public.cours(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vu_at timestamptz DEFAULT now(),
  UNIQUE (cours_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_cours_vus_org ON public.cours_vus(organisation_id);

ALTER TABLE public.cours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cours_vus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cours_lecture" ON public.cours;
CREATE POLICY "cours_lecture" ON public.cours FOR SELECT TO authenticated
  USING (publie OR public.is_superadmin() OR public.has_role('coordinateur'));

DROP POLICY IF EXISTS "cours_gestion" ON public.cours;
CREATE POLICY "cours_gestion" ON public.cours FOR ALL TO authenticated
  USING (public.is_superadmin() OR public.has_role('coordinateur'))
  WITH CHECK (public.is_superadmin() OR public.has_role('coordinateur'));

DROP POLICY IF EXISTS "cours_vus_propre" ON public.cours_vus;
CREATE POLICY "cours_vus_propre" ON public.cours_vus FOR ALL TO authenticated
  USING (profile_id = auth.uid() OR public.is_superadmin() OR public.has_role('coordinateur'))
  WITH CHECK (profile_id = auth.uid());

-- Isolation entre clubs : même modèle que les autres tables
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cours', 'cours_vus'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "isolation_club" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "isolation_club" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING (organisation_id = public.current_org_id())
         WITH CHECK (organisation_id = public.current_org_id())', t);
    EXECUTE format('DROP TRIGGER IF EXISTS tenant_guard ON public.%I', t);
    EXECUTE format('CREATE TRIGGER tenant_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tenant_guard()', t);
  END LOOP;
END $$;

-- Espace de stockage des cours : privé, lu par lien signé généré côté serveur
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('cours', 'cours', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

-- Les fichiers sont rangés dans un dossier par club : <organisation_id>/<fichier>.
-- La politique vérifie ce dossier, donc un club ne peut pas toucher aux fichiers d'un autre.
DROP POLICY IF EXISTS "cours_storage_gestion" ON storage.objects;
CREATE POLICY "cours_storage_gestion" ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'cours'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND roles && ARRAY['superadmin', 'coordinateur'])
  )
  WITH CHECK (
    bucket_id = 'cours'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND roles && ARRAY['superadmin', 'coordinateur'])
  );

-- ─── 5. Posés en campagne (vols instructeur) ────────────────────
-- [{"terrain": "LFCH", "touches": 2, "complets": 1}, …]
ALTER TABLE public.vols_effectues ADD COLUMN IF NOT EXISTS poses jsonb NOT NULL DEFAULT '[]'::jsonb;

-- La clôture d'un vol accepte désormais les posés effectués sur d'autres terrains.
-- L'ancienne signature est remplacée : les appels sans p_poses continuent de fonctionner.
DROP FUNCTION IF EXISTS public.cloturer_vol(uuid, int, numeric, text, jsonb, int, text, text);

CREATE OR REPLACE FUNCTION public.cloturer_vol(
  p_creneau_id uuid,
  p_temps_vol_minutes int,
  p_prix_total numeric,
  p_numero_aerogest text DEFAULT NULL,
  p_numeros_par_reservation jsonb DEFAULT NULL,
  p_nb_eleves int DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_pilote_nom text DEFAULT NULL,
  p_poses jsonb DEFAULT NULL
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
  v_poses jsonb := '[]'::jsonb;
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

  -- Posés en campagne : on ne garde que les lignes ayant un terrain renseigné
  IF p_poses IS NOT NULL AND jsonb_typeof(p_poses) = 'array' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'terrain', left(upper(btrim(e ->> 'terrain')), 8),
             'touches', CASE WHEN COALESCE(e ->> 'touches', '') ~ '^[0-9]{1,4}$' THEN (e ->> 'touches')::int ELSE 0 END,
             'complets', CASE WHEN COALESCE(e ->> 'complets', '') ~ '^[0-9]{1,4}$' THEN (e ->> 'complets')::int ELSE 0 END
           )), '[]'::jsonb)
      INTO v_poses
    FROM jsonb_array_elements(p_poses) AS e
    WHERE COALESCE(btrim(e ->> 'terrain'), '') <> '';
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

  INSERT INTO vols_effectues (creneau_id, numero_aerogest, numeros_aerogest, temps_vol_minutes, nb_eleves, prix_total, notes, valide_par, poses)
  VALUES (
    p_creneau_id,
    CASE WHEN v_multi THEN NULL ELSE btrim(p_numero_aerogest) END,
    v_numeros,
    p_temps_vol_minutes,
    COALESCE(NULLIF(p_nb_eleves, 0), v_nb),
    p_prix_total,
    NULLIF(btrim(p_notes), ''),
    v_uid,
    v_poses
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

REVOKE ALL ON FUNCTION public.cloturer_vol(uuid, int, numeric, text, jsonb, int, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cloturer_vol(uuid, int, numeric, text, jsonb, int, text, text, jsonb) TO authenticated;

-- ─── 6. Paiement en ligne HelloAsso ─────────────────────────────
-- Clés d'API propres à chaque club. Table jamais lisible par le navigateur :
-- seules les routes serveur (clé service) y accèdent.
CREATE TABLE IF NOT EXISTS public.organisation_secrets (
  organisation_id uuid PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  helloasso_client_id text,
  helloasso_client_secret text,
  helloasso_slug text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.organisation_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organisation_secrets FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.paiements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) DEFAULT public.current_org_id(),
  eleve_id uuid REFERENCES public.eleves(id) ON DELETE SET NULL,
  reference text NOT NULL UNIQUE,
  montant numeric NOT NULL CHECK (montant > 0),
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'paye', 'echoue', 'annule')),
  checkout_id text,
  payeur_email text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_paiements_org ON public.paiements(organisation_id);
CREATE INDEX IF NOT EXISTS idx_paiements_eleve ON public.paiements(eleve_id);
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paiements_lecture_club" ON public.paiements;
CREATE POLICY "paiements_lecture_club" ON public.paiements FOR SELECT TO authenticated
  USING (
    public.is_superadmin() OR public.has_role('coordinateur') OR public.has_role('gerant')
    OR (eleve_id IS NOT NULL AND public.est_parent_de(eleve_id))
  );

DROP POLICY IF EXISTS "isolation_club" ON public.paiements;
CREATE POLICY "isolation_club" ON public.paiements AS RESTRICTIVE FOR ALL TO authenticated
  USING (organisation_id = public.current_org_id())
  WITH CHECK (organisation_id = public.current_org_id());
DROP TRIGGER IF EXISTS tenant_guard ON public.paiements;
CREATE TRIGGER tenant_guard BEFORE INSERT OR UPDATE OR DELETE ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION public.tenant_guard();

NOTIFY pgrst, 'reload schema';
