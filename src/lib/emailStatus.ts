// Statuses written by /api/email then updated by the Resend webhook (delivered, opened, bounced…).
export const EMAIL_STATUS: Record<string, { label: string; dot: string; groupe: "ok" | "attente" | "echec" | "demo" }> = {
  envoye:   { label: "Envoyé",   dot: "bg-blue-400",    groupe: "attente" },
  retarde:  { label: "Retardé",  dot: "bg-amber-400",   groupe: "attente" },
  delivre:  { label: "Délivré",  dot: "bg-emerald-400", groupe: "ok" },
  ouvert:   { label: "Ouvert",   dot: "bg-green-500",   groupe: "ok" },
  clique:   { label: "Cliqué",   dot: "bg-green-600",   groupe: "ok" },
  rebondi:  { label: "Rebondi",  dot: "bg-red-400",     groupe: "echec" },
  spam:     { label: "Spam",     dot: "bg-red-500",     groupe: "echec" },
  erreur:   { label: "Erreur",   dot: "bg-red-400",     groupe: "echec" },
  supprime: { label: "Supprimé", dot: "bg-gray-300",    groupe: "echec" },
  demo:      { label: "Démo (non envoyé)", dot: "bg-gray-300", groupe: "demo" },
  desabonne: { label: "Désabonné", dot: "bg-gray-400", groupe: "demo" },
};

export function emailStatus(statut: string) {
  return EMAIL_STATUS[statut] ?? { label: statut, dot: "bg-gray-300", groupe: "attente" as const };
}
