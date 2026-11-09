// Matières du BIA (arrêté du 16 juillet 2018) + un fourre-tout pour le reste.
export const MATIERES = [
  "Météorologie et aérologie",
  "Aérodynamique, aérostatique et principes du vol",
  "Étude des aéronefs et des engins spatiaux",
  "Navigation, réglementation, sécurité des vols",
  "Histoire de l'aéronautique et de l'espace",
  "Anglais aéronautique",
  "Général",
] as const;

export const TAILLE_MAX_MO = 50;
export const TAILLE_MAX = TAILLE_MAX_MO * 1024 * 1024;

export const EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".odt", ".odp", ".jpg", ".jpeg", ".png", ".mp4", ".zip"];

export function tailleLisible(octets: number | null | undefined): string {
  if (!octets || octets <= 0) return "";
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(octets < 10 * 1024 * 1024 ? 1 : 0)} Mo`;
}

/** Nom de fichier sûr pour le stockage : pas d'accent, pas d'espace, pas de chemin. */
export function nomFichierSur(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
}
