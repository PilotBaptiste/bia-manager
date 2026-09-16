// Optional features switched on club by club from the owner console (organisations.modules).
// A disabled module is invisible for the club: no menu entry, pages redirect to the dashboard, in-page parts hidden.
// Core features (élèves, planning, établissements, pilotes, aéronefs, utilisateurs, paramètres) are always on.
export type ModuleDef = {
  key: string;
  label: string;
  description: string;
  categorie: "Gestion" | "Finances" | "Familles" | "Documents" | "Essais";
  /** Existing sidebar entry (Sidebar getNav key) hidden when the module is off. */
  navKey?: string;
  /** Sidebar entry added only by this module. */
  nav?: { href: string; icon: string; roles: string[] };
};

export const MODULES: ModuleDef[] = [
  { key: "finances", label: "Finances", categorie: "Finances", navKey: "finances",
    description: "Recettes, dépenses, coût des vols, opérations et suivi des paiements." },
  { key: "subventions", label: "Subventions par établissement", categorie: "Finances",
    description: "Subventions réparties entre les élèves d'un ou plusieurs établissements (onglet Finances)." },
  { key: "releve_compte", label: "Relevé de compte", categorie: "Finances",
    description: "Export Débit / Crédit avec solde cumulé (bouton dans Finances)." },
  { key: "roulage", label: "Suivi du roulage", categorie: "Finances",
    description: "Économies de roulage sur les vols à plusieurs élèves (onglet Finances)." },
  { key: "statistiques", label: "Statistiques", categorie: "Gestion", navKey: "statistiques",
    description: "Coût moyen par élève, biplace / quadriplace, suivi par établissement." },
  { key: "messagerie", label: "Messagerie", categorie: "Familles", navKey: "messagerie",
    description: "Emails groupés aux familles, par établissement ou par critère." },
  { key: "attestation_en_ligne", label: "Attestation parentale en ligne", categorie: "Familles", navKey: "attestation",
    description: "Les parents signent l'autorisation de vol depuis leur espace." },
  { key: "reservation_en_ligne", label: "Réservation des vols par les parents", categorie: "Familles", navKey: "reservation",
    description: "Les parents choisissent eux-mêmes un créneau de vol." },
  { key: "import_csv", label: "Import CSV", categorie: "Gestion", navKey: "import",
    description: "Import des élèves depuis un fichier Excel ou CSV." },
  { key: "archives", label: "Archives", categorie: "Gestion", navKey: "archives",
    description: "Consultation des années scolaires passées." },
  { key: "reglementation", label: "Réglementation et mémo BIA", categorie: "Documents", navKey: "reglementation",
    description: "Réglementation des vols BIA et mémo PDF pour les pilotes." },
  { key: "export_ffa", label: "Export FFA des résultats BIA", categorie: "Documents",
    description: "Liste imprimable des résultats BIA (bouton dans Élèves)." },
  { key: "paiement_en_ligne", label: "Paiement de l'inscription par carte", categorie: "Familles",
    description: "Les familles règlent l'inscription en ligne sur le compte SumUp du club. Les clés se saisissent dans « Encaissement »." },
  { key: "laboratoire", label: "Laboratoire", categorie: "Essais",
    nav: { href: "/dashboard/laboratoire", icon: "FlaskConical", roles: ["superadmin", "coordinateur", "pilote", "gerant"] },
    description: "Onglet d'essai pour tester une nouveauté sur un seul aéroclub." },
];

export const MODULE_KEYS = MODULES.map((m) => m.key);
export const MODULE_CATEGORIES = Array.from(new Set(MODULES.map((m) => m.categorie)));
export const MODULE_BY_NAV_KEY = Object.fromEntries(MODULES.filter((m) => m.navKey).map((m) => [m.navKey!, m.key]));
