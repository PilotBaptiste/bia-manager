// Contacts parentaux d'un élève : un ou deux responsables légaux (familles séparées).
// Les deux reçoivent les emails et peuvent réserver ou annuler un vol.

export type ParentContact = { email: string; prenom: string; nom: string; telephone: string; second: boolean };

/** Colonnes à sélectionner pour obtenir les deux parents. */
export const PARENT_COLUMNS =
  "parent_nom, parent_prenom, parent_email, parent_telephone, parent2_nom, parent2_prenom, parent2_email, parent2_telephone";

/** Les deux parents d'un élève, sans doublon d'adresse, dans l'ordre (principal puis second). */
export function parentsDe(eleve: any): ParentContact[] {
  const out: ParentContact[] = [];
  const push = (email: any, prenom: any, nom: any, telephone: any, second: boolean) => {
    const e = String(email ?? "").trim();
    if (!e) return;
    if (out.some((p) => p.email.toLowerCase() === e.toLowerCase())) return;
    out.push({
      email: e,
      prenom: String(prenom ?? "").trim(),
      nom: String(nom ?? "").trim(),
      telephone: String(telephone ?? "").trim(),
      second,
    });
  };
  push(eleve?.parent_email, eleve?.parent_prenom, eleve?.parent_nom, eleve?.parent_telephone, false);
  push(eleve?.parent2_email, eleve?.parent2_prenom, eleve?.parent2_nom, eleve?.parent2_telephone, true);
  return out;
}

/** Toutes les adresses parentales d'un élève. */
export function emailsParents(eleve: any): string[] {
  return parentsDe(eleve).map((p) => p.email);
}

/** Vrai si l'adresse est celle d'un des deux parents de l'élève. */
export function estParentDe(eleve: any, email: string | null | undefined): boolean {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return false;
  return emailsParents(eleve).some((x) => x.toLowerCase() === e);
}
