// Prime FFA de 50 € : conditions d'âge de l'élève.
//
// La FFA réserve la prime aux élèves de 21 ans au plus l'année de la session.
// Elle l'exprime par une année de naissance plancher : pour la session 2026,
// « né après le 01/01/2005 », soit 2026 − 21. Les clubs qui ouvrent le BIA aux
// adultes ont donc des élèves inscrits et formés, mais hors prime.

/** Âge maximum, atteint dans l'année de la session, pour ouvrir droit à la prime. */
export const AGE_MAX_PRIME_FFA = 21;

/** Montant de la prime versée à l'aéroclub, par élève éligible. */
export const MONTANT_PRIME_FFA = 50;

export type AnneeSession = {
  date_examen_bia?: string | null;
  date_fin?: string | null;
  label?: string | null;
} | null | undefined;

/**
 * Année civile de la session d'examen. La date d'examen fait foi ; à défaut on
 * prend la fin de l'année scolaire, l'examen tombant en mai/juin de cette
 * année-là. En dernier recours, l'année à quatre chiffres lue dans le libellé
 * (« 2026-2027 » → 2027).
 */
export function anneeSession(annee: AnneeSession): number | null {
  const parse = (d?: string | null) => {
    if (!d) return null;
    const an = new Date(d).getFullYear();
    return Number.isFinite(an) ? an : null;
  };
  const depuisExamen = parse(annee?.date_examen_bia);
  if (depuisExamen) return depuisExamen;
  const depuisFin = parse(annee?.date_fin);
  if (depuisFin) return depuisFin;
  const annees = String(annee?.label ?? "").match(/\d{4}/g);
  if (annees && annees.length > 0) return Number(annees[annees.length - 1]);
  return null;
}

/** Première année de naissance encore éligible pour cette session. */
export function anneeNaissanceMin(anneeExamen: number): number {
  return anneeExamen - AGE_MAX_PRIME_FFA;
}

/** Date plancher au format ISO, pour filtrer la base directement. */
export function dateNaissanceMin(anneeExamen: number): string {
  return `${anneeNaissanceMin(anneeExamen)}-01-01`;
}

/** Âge que l'élève atteint dans l'année de la session. */
export function ageALaSession(dateNaissance: string | null | undefined, anneeExamen: number | null): number | null {
  if (!dateNaissance || !anneeExamen) return null;
  const naissance = new Date(dateNaissance).getFullYear();
  if (!Number.isFinite(naissance)) return null;
  return anneeExamen - naissance;
}

/**
 * `null` quand on ne peut pas trancher : date de naissance absente, ou année
 * de session inconnue. L'écran dit alors « à vérifier » plutôt que « non ».
 */
export function eligiblePrimeFfa(
  dateNaissance: string | null | undefined,
  anneeExamen: number | null,
): boolean | null {
  const age = ageALaSession(dateNaissance, anneeExamen);
  if (age === null) return null;
  return age <= AGE_MAX_PRIME_FFA;
}

/** Phrase courte affichée à côté de l'élève. */
export function libellePrimeFfa(
  dateNaissance: string | null | undefined,
  anneeExamen: number | null,
): { eligible: boolean | null; texte: string } {
  const eligible = eligiblePrimeFfa(dateNaissance, anneeExamen);
  if (eligible === null) return { eligible, texte: "À vérifier" };
  const age = ageALaSession(dateNaissance, anneeExamen)!;
  if (eligible) return { eligible, texte: `Éligible — ${age} ans en ${anneeExamen}` };
  return { eligible, texte: `Non éligible — ${age} ans en ${anneeExamen}` };
}
