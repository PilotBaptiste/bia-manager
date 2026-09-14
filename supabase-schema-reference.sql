-- ════════════════════════════════════════════════════════════════
-- BIA Manager — schéma de référence généré depuis la base réelle
-- Généré le 2026-09-14 par scripts/generate-schema-reference.mjs
-- Ne pas modifier à la main : relancer « npm run db:schema ».
-- Contient tables, colonnes, types, NOT NULL, valeurs par défaut, clés primaires et étrangères.
-- Politiques RLS, fonctions et triggers : voir supabase-introspection.sql.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

CREATE TABLE public.aeronefs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  immatriculation text NOT NULL,
  type_aeronef text NOT NULL,
  nb_places_eleves integer NOT NULL DEFAULT 2,
  prix_heure numeric NOT NULL,
  actif boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  prix_heure_historique jsonb,
  PRIMARY KEY (id)
);

CREATE TABLE public.annees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  label text NOT NULL,
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.creneaux (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pilote_id uuid NOT NULL,
  aeronef_id uuid NOT NULL,
  annee_id uuid NOT NULL,
  etablissement_id uuid,
  date_vol date NOT NULL,
  heure_debut time without time zone NOT NULL,
  heure_fin time without time zone NOT NULL,
  places_disponibles integer NOT NULL,
  statut text DEFAULT 'ouvert',
  notes_pilote text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  eleves_autorises uuid[],
  etablissement_ids text[],
  motif_annulation text,
  PRIMARY KEY (id),
  FOREIGN KEY (pilote_id) REFERENCES profiles(id),
  FOREIGN KEY (aeronef_id) REFERENCES aeronefs(id),
  FOREIGN KEY (annee_id) REFERENCES annees(id),
  FOREIGN KEY (etablissement_id) REFERENCES etablissements(id)
);

CREATE TABLE public.eleves (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  prenom text NOT NULL,
  date_naissance date NOT NULL,
  lieu_naissance text NOT NULL,
  etablissement_id uuid NOT NULL,
  classe text DEFAULT 'Autre',
  annee_id uuid NOT NULL,
  parent_id uuid,
  parent_nom text NOT NULL,
  parent_prenom text NOT NULL,
  parent_email text NOT NULL,
  parent_telephone text NOT NULL,
  paiement_effectue boolean DEFAULT false,
  paiement_mode text,
  paiement_montant numeric,
  paiement_date timestamp with time zone,
  attestation_signee boolean DEFAULT false,
  attestation_url text,
  attestation_date timestamp with time zone,
  attestation_parent_signataire text,
  bia_passe boolean DEFAULT false,
  bia_resultat text,
  bia_date date,
  vol1_effectue boolean DEFAULT false,
  vol1_temps_minutes integer,
  vol2_autorise boolean DEFAULT false,
  vol2_effectue boolean DEFAULT false,
  vol2_temps_minutes integer,
  commentaires text,
  archive boolean DEFAULT false,
  archived_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  vol1_aeronef_id uuid,
  vol1_prix numeric,
  vol1_pilote_nom text,
  vol2_aeronef_id uuid,
  vol2_prix numeric,
  vol2_pilote_nom text,
  adresse text,
  vol1_numero_aerogest text,
  vol2_numero_aerogest text,
  abandonne boolean DEFAULT false,
  adresse_rue text,
  adresse_cp text,
  adresse_ville text,
  desiderata jsonb,
  vol_fi_mode boolean DEFAULT false,
  vol1_skippe boolean NOT NULL DEFAULT false,
  bia_mention text,
  PRIMARY KEY (id),
  FOREIGN KEY (etablissement_id) REFERENCES etablissements(id),
  FOREIGN KEY (annee_id) REFERENCES annees(id),
  FOREIGN KEY (parent_id) REFERENCES profiles(id),
  FOREIGN KEY (vol1_aeronef_id) REFERENCES aeronefs(id),
  FOREIGN KEY (vol2_aeronef_id) REFERENCES aeronefs(id)
);

CREATE TABLE public.email_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  type text NOT NULL,
  to_email text NOT NULL,
  subject text,
  eleve_id uuid,
  resend_id text,
  statut text NOT NULL DEFAULT 'envoye',
  creneau_id uuid,
  PRIMARY KEY (id),
  FOREIGN KEY (eleve_id) REFERENCES eleves(id),
  FOREIGN KEY (creneau_id) REFERENCES creneaux(id)
);

CREATE TABLE public.etablissements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  adresse text,
  ville text,
  code_postal text,
  telephone text,
  email text,
  actif boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  contact_nom text,
  contact_prenom text,
  code_inscription text,
  nb_eleves_attendus integer DEFAULT 0,
  PRIMARY KEY (id)
);

CREATE TABLE public.finances_operations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  annee_id uuid NOT NULL,
  type text NOT NULL,
  sens text NOT NULL,
  montant numeric NOT NULL,
  description text,
  eleve_id uuid,
  vol_effectue_id uuid,
  etablissement_id uuid,
  date_operation date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (annee_id) REFERENCES annees(id),
  FOREIGN KEY (eleve_id) REFERENCES eleves(id),
  FOREIGN KEY (vol_effectue_id) REFERENCES vols_effectues(id),
  FOREIGN KEY (etablissement_id) REFERENCES etablissements(id)
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  destinataire_email text NOT NULL,
  destinataire_id uuid,
  sujet text NOT NULL,
  type text NOT NULL,
  contenu text,
  envoye boolean DEFAULT false,
  envoye_at timestamp with time zone,
  erreur text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (destinataire_id) REFERENCES profiles(id)
);

CREATE TABLE public.operations_manuelles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  date date NOT NULL,
  type text NOT NULL,
  sens text NOT NULL,
  montant numeric NOT NULL,
  description text,
  etablissement text,
  mode text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.parametres (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cle text NOT NULL,
  valeur text NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.pilote_etablissements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pilote_id uuid NOT NULL,
  etablissement_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (pilote_id) REFERENCES profiles(id),
  FOREIGN KEY (etablissement_id) REFERENCES etablissements(id)
);

CREATE TABLE public.pilote_qualifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pilote_id uuid NOT NULL,
  aeronef_id uuid NOT NULL,
  date_expiration date,
  qualification_type text DEFAULT 'VFR',
  notes text,
  PRIMARY KEY (id),
  FOREIGN KEY (pilote_id) REFERENCES profiles(id),
  FOREIGN KEY (aeronef_id) REFERENCES aeronefs(id)
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  nom text NOT NULL,
  prenom text NOT NULL,
  telephone text,
  roles text[] NOT NULL,
  etablissement_id uuid,
  actif boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  etablissement_ids uuid[],
  qualification_fi boolean DEFAULT false,
  PRIMARY KEY (id),
  FOREIGN KEY (etablissement_id) REFERENCES etablissements(id)
);

CREATE TABLE public.reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  creneau_id uuid NOT NULL,
  eleve_id uuid NOT NULL,
  type_vol integer NOT NULL DEFAULT 1,
  statut text DEFAULT 'reserve',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  motif_annulation text,
  annule_par uuid,
  annule_le timestamp with time zone,
  PRIMARY KEY (id),
  FOREIGN KEY (creneau_id) REFERENCES creneaux(id),
  FOREIGN KEY (eleve_id) REFERENCES eleves(id),
  FOREIGN KEY (annule_par) REFERENCES profiles(id)
);

CREATE TABLE public.vols_effectues (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  creneau_id uuid NOT NULL,
  numero_aerogest text NOT NULL,
  temps_vol_minutes integer NOT NULL,
  nb_eleves integer NOT NULL,
  prix_total numeric NOT NULL,
  notes text,
  valide_par uuid,
  created_at timestamp with time zone DEFAULT now(),
  numeros_aerogest text[],
  PRIMARY KEY (id),
  FOREIGN KEY (creneau_id) REFERENCES creneaux(id),
  FOREIGN KEY (valide_par) REFERENCES profiles(id)
);

CREATE TABLE public.vols_lignes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  vol_effectue_id uuid NOT NULL,
  description text NOT NULL DEFAULT 'Vol découverte',
  temps_minutes integer,
  prix numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (vol_effectue_id) REFERENCES vols_effectues(id)
);

-- Fonctions RPC exposées : has_role, is_superadmin, user_etablissement_id
