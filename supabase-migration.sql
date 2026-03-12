-- ══════════════════════════════════════════════════════════
-- BIA MANAGER — Aéro-Club du Bassin d'Arcachon
-- Script SQL complet pour Supabase
-- Exécuter dans l'éditeur SQL de Supabase
-- ══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════
-- 1. PARAMÈTRES GLOBAUX
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS parametres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cle TEXT NOT NULL UNIQUE,
  valeur TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO parametres (cle, valeur, description) VALUES
  ('prix_inscription', '80', 'Prix inscription élève (€) pour le premier vol'),
  ('subvention_federation', '50', 'Subvention fédération par BIA réussi (€)'),
  ('duree_cible_vols', '45', 'Durée cible totale des 2 vols (minutes)'),
  ('nom_aeroclub', 'Aéro-Club du Bassin d''Arcachon', 'Nom de l''aéroclub'),
  ('email_aeroclub', 'contact@acba.fr', 'Email de contact'),
  ('telephone_aeroclub', '', 'Téléphone de contact')
ON CONFLICT (cle) DO NOTHING;

-- ═══════════════════════════════════════════
-- 2. ANNÉES SCOLAIRES
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS annees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO annees (label, date_debut, date_fin, active) VALUES
  ('2026', '2025-09-01', '2026-08-31', true)
ON CONFLICT (label) DO NOTHING;

-- ═══════════════════════════════════════════
-- 3. ÉTABLISSEMENTS
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS etablissements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  adresse TEXT,
  ville TEXT,
  code_postal TEXT,
  telephone TEXT,
  email TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════
-- 4. PROFILS UTILISATEURS
-- Champ `roles` = tableau de rôles (multi-rôles)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT,
  roles TEXT[] NOT NULL DEFAULT ARRAY['parent'],
  etablissement_id UUID REFERENCES etablissements(id),
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger: auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom, roles)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'nom', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'prenom', ''),
    CASE
      WHEN NEW.raw_user_meta_data ->> 'role' IS NOT NULL
      THEN ARRAY[NEW.raw_user_meta_data ->> 'role']
      ELSE ARRAY['parent']
    END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════
-- 5. AÉRONEFS
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS aeronefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  immatriculation TEXT NOT NULL UNIQUE,
  type_aeronef TEXT NOT NULL,
  nb_places_eleves INTEGER NOT NULL DEFAULT 2,
  prix_heure DECIMAL(10,2) NOT NULL,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER aeronefs_updated_at
  BEFORE UPDATE ON aeronefs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════
-- 6. QUALIFICATIONS PILOTES
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pilote_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilote_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  aeronef_id UUID NOT NULL REFERENCES aeronefs(id) ON DELETE CASCADE,
  UNIQUE(pilote_id, aeronef_id)
);

-- ═══════════════════════════════════════════
-- 7. ÉLÈVES
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS eleves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  date_naissance DATE NOT NULL,
  lieu_naissance TEXT NOT NULL,
  etablissement_id UUID NOT NULL REFERENCES etablissements(id),
  classe TEXT DEFAULT 'Autre',
  annee_id UUID NOT NULL REFERENCES annees(id),
  parent_id UUID REFERENCES profiles(id),
  parent_nom TEXT NOT NULL,
  parent_prenom TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_telephone TEXT NOT NULL,
  paiement_effectue BOOLEAN DEFAULT false,
  paiement_mode TEXT,
  paiement_montant DECIMAL(10,2),
  paiement_date TIMESTAMPTZ,
  attestation_signee BOOLEAN DEFAULT false,
  attestation_url TEXT,
  attestation_date TIMESTAMPTZ,
  attestation_parent_signataire TEXT,
  bia_passe BOOLEAN DEFAULT false,
  bia_resultat TEXT,
  bia_date DATE,
  vol1_effectue BOOLEAN DEFAULT false,
  vol1_temps_minutes INTEGER,
  vol2_autorise BOOLEAN DEFAULT false,
  vol2_effectue BOOLEAN DEFAULT false,
  vol2_temps_minutes INTEGER,
  commentaires TEXT,
  archive BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER eleves_updated_at
  BEFORE UPDATE ON eleves
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════
-- 8. CRÉNEAUX DE VOL
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS creneaux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilote_id UUID NOT NULL REFERENCES profiles(id),
  aeronef_id UUID NOT NULL REFERENCES aeronefs(id),
  annee_id UUID NOT NULL REFERENCES annees(id),
  etablissement_id UUID REFERENCES etablissements(id),
  date_vol DATE NOT NULL,
  heure_debut TIME NOT NULL,
  heure_fin TIME NOT NULL,
  places_disponibles INTEGER NOT NULL,
  statut TEXT DEFAULT 'ouvert' CHECK (statut IN ('ouvert','complet','confirme','en_cours','termine','annule')),
  notes_pilote TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER creneaux_updated_at
  BEFORE UPDATE ON creneaux
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════
-- 9. RÉSERVATIONS
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creneau_id UUID NOT NULL REFERENCES creneaux(id) ON DELETE CASCADE,
  eleve_id UUID NOT NULL REFERENCES eleves(id),
  type_vol INTEGER NOT NULL DEFAULT 1,
  statut TEXT DEFAULT 'reserve' CHECK (statut IN ('reserve','confirme','effectue','annule')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(creneau_id, eleve_id)
);

CREATE TRIGGER reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════
-- 10. VOLS EFFECTUÉS
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vols_effectues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creneau_id UUID NOT NULL REFERENCES creneaux(id),
  numero_aerogest TEXT NOT NULL,
  temps_vol_minutes INTEGER NOT NULL,
  nb_eleves INTEGER NOT NULL,
  prix_total DECIMAL(10,2) NOT NULL,
  notes TEXT,
  valide_par UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vols_lignes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vol_effectue_id UUID NOT NULL REFERENCES vols_effectues(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT 'Vol découverte',
  temps_minutes INTEGER,
  prix DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════
-- 11. FINANCES
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS finances_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annee_id UUID NOT NULL REFERENCES annees(id),
  type TEXT NOT NULL,
  sens TEXT NOT NULL CHECK (sens IN ('recette', 'depense')),
  montant DECIMAL(10,2) NOT NULL,
  description TEXT,
  eleve_id UUID REFERENCES eleves(id),
  vol_effectue_id UUID REFERENCES vols_effectues(id),
  etablissement_id UUID REFERENCES etablissements(id),
  date_operation DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════
-- 12. NOTIFICATIONS
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinataire_email TEXT NOT NULL,
  destinataire_id UUID REFERENCES profiles(id),
  sujet TEXT NOT NULL,
  type TEXT NOT NULL,
  contenu TEXT,
  envoye BOOLEAN DEFAULT false,
  envoye_at TIMESTAMPTZ,
  erreur TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════
-- 13. INDEXES
-- ═══════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_eleves_annee ON eleves(annee_id);
CREATE INDEX IF NOT EXISTS idx_eleves_etablissement ON eleves(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_eleves_parent ON eleves(parent_id);
CREATE INDEX IF NOT EXISTS idx_eleves_archive ON eleves(archive);
CREATE INDEX IF NOT EXISTS idx_creneaux_date ON creneaux(date_vol);
CREATE INDEX IF NOT EXISTS idx_creneaux_pilote ON creneaux(pilote_id);
CREATE INDEX IF NOT EXISTS idx_creneaux_annee ON creneaux(annee_id);
CREATE INDEX IF NOT EXISTS idx_reservations_eleve ON reservations(eleve_id);
CREATE INDEX IF NOT EXISTS idx_finances_annee ON finances_operations(annee_id);

-- ═══════════════════════════════════════════
-- 14. ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════

-- Helper: check if user has role
CREATE OR REPLACE FUNCTION auth.has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND required_role = ANY(roles)
    AND actif = true
  );
$$;

-- Helper: check if user is superadmin
CREATE OR REPLACE FUNCTION auth.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND 'superadmin' = ANY(roles)
    AND actif = true
  );
$$;

-- Helper: get user's etablissement_id
CREATE OR REPLACE FUNCTION auth.user_etablissement_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT etablissement_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ─── Enable RLS ─────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE etablissements ENABLE ROW LEVEL SECURITY;
ALTER TABLE aeronefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilote_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE eleves ENABLE ROW LEVEL SECURITY;
ALTER TABLE creneaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vols_effectues ENABLE ROW LEVEL SECURITY;
ALTER TABLE vols_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE finances_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametres ENABLE ROW LEVEL SECURITY;
ALTER TABLE annees ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ─── PROFILES ───────────────────────────────────────────
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  auth.is_superadmin()
  OR id = auth.uid()
  OR auth.has_role('coordinateur')
  -- Pilotes can see profiles of students booked on their slots
  OR (auth.has_role('pilote') AND id IN (
    SELECT e.parent_id FROM eleves e
    JOIN reservations r ON r.eleve_id = e.id
    JOIN creneaux c ON c.id = r.creneau_id
    WHERE c.pilote_id = auth.uid()
  ))
);

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_superadmin_all" ON profiles FOR ALL USING (auth.is_superadmin());

-- ─── ÉTABLISSEMENTS ─────────────────────────────────────
CREATE POLICY "etab_select" ON etablissements FOR SELECT USING (true);
CREATE POLICY "etab_superadmin" ON etablissements FOR ALL USING (auth.is_superadmin());

-- ─── AÉRONEFS ───────────────────────────────────────────
CREATE POLICY "aeronefs_select" ON aeronefs FOR SELECT USING (true);
CREATE POLICY "aeronefs_superadmin" ON aeronefs FOR ALL USING (auth.is_superadmin());

-- ─── QUALIFICATIONS ─────────────────────────────────────
CREATE POLICY "qualif_select" ON pilote_qualifications FOR SELECT USING (true);
CREATE POLICY "qualif_superadmin" ON pilote_qualifications FOR ALL USING (auth.is_superadmin());

-- ─── ÉLÈVES ─────────────────────────────────────────────
CREATE POLICY "eleves_superadmin" ON eleves FOR ALL USING (auth.is_superadmin());
CREATE POLICY "eleves_coordinateur" ON eleves FOR SELECT USING (auth.has_role('coordinateur'));
CREATE POLICY "eleves_gerant" ON eleves FOR ALL USING (
  auth.has_role('gerant') AND etablissement_id = auth.user_etablissement_id()
);
CREATE POLICY "eleves_parent" ON eleves FOR SELECT USING (parent_id = auth.uid());
CREATE POLICY "eleves_pilote" ON eleves FOR SELECT USING (
  auth.has_role('pilote') AND id IN (
    SELECT r.eleve_id FROM reservations r
    JOIN creneaux c ON c.id = r.creneau_id
    WHERE c.pilote_id = auth.uid()
  )
);

-- ─── CRÉNEAUX ───────────────────────────────────────────
CREATE POLICY "creneaux_select" ON creneaux FOR SELECT USING (true);
CREATE POLICY "creneaux_superadmin" ON creneaux FOR ALL USING (auth.is_superadmin());
CREATE POLICY "creneaux_pilote" ON creneaux FOR ALL USING (
  auth.has_role('pilote') AND pilote_id = auth.uid()
);

-- ─── RÉSERVATIONS ───────────────────────────────────────
CREATE POLICY "reserv_select" ON reservations FOR SELECT USING (true);
CREATE POLICY "reserv_superadmin" ON reservations FOR ALL USING (auth.is_superadmin());
CREATE POLICY "reserv_parent" ON reservations FOR INSERT WITH CHECK (
  auth.has_role('parent') AND eleve_id IN (
    SELECT id FROM eleves WHERE parent_id = auth.uid()
  )
);
CREATE POLICY "reserv_pilote_update" ON reservations FOR UPDATE USING (
  auth.has_role('pilote') AND creneau_id IN (
    SELECT id FROM creneaux WHERE pilote_id = auth.uid()
  )
);

-- ─── VOLS EFFECTUÉS ─────────────────────────────────────
CREATE POLICY "vols_eff_select" ON vols_effectues FOR SELECT USING (
  auth.is_superadmin() OR auth.has_role('coordinateur')
  OR (auth.has_role('pilote') AND creneau_id IN (
    SELECT id FROM creneaux WHERE pilote_id = auth.uid()
  ))
);
CREATE POLICY "vols_eff_insert" ON vols_effectues FOR INSERT WITH CHECK (
  auth.is_superadmin() OR (auth.has_role('pilote') AND creneau_id IN (
    SELECT id FROM creneaux WHERE pilote_id = auth.uid()
  ))
);
CREATE POLICY "vols_eff_superadmin" ON vols_effectues FOR ALL USING (auth.is_superadmin());

CREATE POLICY "vols_lignes_select" ON vols_lignes FOR SELECT USING (true);
CREATE POLICY "vols_lignes_superadmin" ON vols_lignes FOR ALL USING (auth.is_superadmin());

-- ─── FINANCES ───────────────────────────────────────────
CREATE POLICY "finances_superadmin" ON finances_operations FOR ALL USING (auth.is_superadmin());

-- ─── PARAMÈTRES ─────────────────────────────────────────
CREATE POLICY "params_select" ON parametres FOR SELECT USING (true);
CREATE POLICY "params_superadmin" ON parametres FOR ALL USING (auth.is_superadmin());

-- ─── ANNÉES ─────────────────────────────────────────────
CREATE POLICY "annees_select" ON annees FOR SELECT USING (true);
CREATE POLICY "annees_superadmin" ON annees FOR ALL USING (auth.is_superadmin());

-- ─── NOTIFICATIONS ──────────────────────────────────────
CREATE POLICY "notif_superadmin" ON notifications FOR ALL USING (auth.is_superadmin());
CREATE POLICY "notif_own" ON notifications FOR SELECT USING (destinataire_id = auth.uid());

-- ═══════════════════════════════════════════
-- 15. REALTIME
-- ═══════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE eleves;
ALTER PUBLICATION supabase_realtime ADD TABLE creneaux;
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE vols_effectues;
ALTER PUBLICATION supabase_realtime ADD TABLE finances_operations;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ═══════════════════════════════════════════
-- 16. STORAGE (attestations)
-- ═══════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public) VALUES ('attestations', 'attestations', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "attestations_superadmin" ON storage.objects FOR ALL USING (
  bucket_id = 'attestations' AND auth.is_superadmin()
);
CREATE POLICY "attestations_parent_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'attestations' AND auth.has_role('parent')
);
CREATE POLICY "attestations_parent_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'attestations' AND (
    auth.is_superadmin()
    OR auth.has_role('parent')
    OR auth.has_role('coordinateur')
  )
);
