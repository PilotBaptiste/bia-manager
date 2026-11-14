import { cookies } from "next/headers";

/**
 * Année à afficher dans un composant rendu côté serveur.
 *
 * Le sélecteur du menu vit dans le navigateur (YearContext), qui recopie le
 * choix dans le cookie `bia_annee`. Sans cette lecture, un coordinateur placé
 * sur 2027 verrait les chiffres de l'année en cours du club : c'est le défaut
 * que cette fonction corrige.
 *
 * Repli, dans l'ordre : cookie valide → année en cours (★) → année la plus
 * récente → aucune (le club n'a pas encore créé d'année).
 */
export const COOKIE_ANNEE = "bia_annee";

export type AnneeAffichee = { id: string; label: string; active: boolean } | null;

export async function anneeAffichee(supabase: any): Promise<AnneeAffichee> {
  // La RLS restreint déjà la table au club du compte connecté : un id de cookie
  // venant d'un autre club ne ressort pas de cette liste.
  const { data } = await supabase
    .from("annees")
    .select("id, label, active")
    .order("date_debut", { ascending: false });
  const annees: { id: string; label: string; active: boolean }[] = data || [];
  if (annees.length === 0) return null;

  let choisi = "";
  try {
    choisi = (await cookies()).get(COOKIE_ANNEE)?.value ?? "";
  } catch {
    choisi = "";
  }

  return (
    annees.find((a) => a.id === choisi) ??
    annees.find((a) => a.active) ??
    annees[0]
  );
}
