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

/** Un PDF ou une image s'affiche directement dans l'application ; le reste se télécharge. */
export function sAfficheEnLigne(nom: string | null | undefined): boolean {
  const ext = extension(nom);
  return [".pdf", ".jpg", ".jpeg", ".png"].includes(ext);
}

export function extension(nom: string | null | undefined): string {
  const n = String(nom ?? "");
  const i = n.lastIndexOf(".");
  return i === -1 ? "" : n.slice(i).toLowerCase();
}

/** Libellé court du format, pour la pastille affichée à côté d'un document. */
export function formatLisible(nom: string | null | undefined): string {
  const ext = extension(nom).replace(".", "").toUpperCase();
  if (!ext) return "Fichier";
  if (ext === "JPEG") return "JPG";
  return ext;
}
