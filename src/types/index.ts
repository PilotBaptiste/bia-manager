export type UserRole = "superadmin" | "coordinateur" | "pilote" | "gerant" | "parent";

export interface Profile {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  roles: UserRole[];
  etablissement_id: string | null;
  etablissement_ids: string[];
  actif: boolean;
  created_at: string;
  updated_at: string;
  etablissement?: Etablissement;
}

export interface Etablissement {
  id: string;
  nom: string;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
  telephone: string | null;
  email: string | null;
  contact_nom: string | null;
  contact_prenom: string | null;
  actif: boolean;
  created_at: string;
  code_inscription: string | null;
  nb_eleves_attendus: number | null;
}

export interface Annee {
  id: string;
  label: string;
  date_debut: string;
  date_fin: string;
  active: boolean;
}

export interface PrixHeureLigne {
  prix: number;
  date: string; // ISO date
  note?: string;
}

export interface Aeronef {
  id: string;
  immatriculation: string;
  type_aeronef: string;
  nb_places_eleves: number;
  prix_heure: number;
  actif: boolean;
  prix_heure_historique?: PrixHeureLigne[];
}

export interface Eleve {
  id: string;
  nom: string;
  prenom: string;
  date_naissance: string;
  lieu_naissance: string;
  etablissement_id: string;
  classe: string;
  annee_id: string;
  parent_id: string | null;
  parent_nom: string;
  parent_prenom: string;
  parent_email: string;
  parent_telephone: string;
  paiement_effectue: boolean;
  paiement_mode: string | null;
  paiement_montant: number | null;
  paiement_date: string | null;
  attestation_signee: boolean;
  attestation_url: string | null;
  attestation_date: string | null;
  attestation_parent_signataire: string | null;
  bia_passe: boolean;
  bia_resultat: string | null;
  bia_mention: string | null;
  bia_date: string | null;
  vol1_effectue: boolean;
  vol1_skippe: boolean;
  vol1_temps_minutes: number | null;
  vol2_autorise: boolean;
  vol2_effectue: boolean;
  vol2_temps_minutes: number | null;
  adresse: string | null;
  vol1_numero_aerogest: string | null;
  vol2_numero_aerogest: string | null;
  commentaires: string | null;
  archive: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  etablissement?: Etablissement;
}

export interface Creneau {
  id: string;
  pilote_id: string;
  aeronef_id: string;
  annee_id: string;
  etablissement_id: string | null;
  date_vol: string;
  heure_debut: string;
  heure_fin: string;
  places_disponibles: number;
  statut: string;
  notes_pilote: string | null;
  created_at: string;
  updated_at: string;
  pilote?: Profile;
  aeronef?: Aeronef;
  etablissement?: Etablissement;
  reservations?: Reservation[];
}

export interface Reservation {
  id: string;
  creneau_id: string;
  eleve_id: string;
  type_vol: 1 | 2;
  statut: string;
  eleve?: Eleve;
  creneau?: Creneau;
}

export interface VolEffectue {
  id: string;
  creneau_id: string;
  numero_aerogest: string;
  temps_vol_minutes: number;
  nb_eleves: number;
  prix_total: number;
  notes: string | null;
}

export interface Parametre {
  id: string;
  cle: string;
  valeur: string;
  description: string | null;
}
