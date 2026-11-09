import { createServiceClient } from "@/lib/supabase/server";
import { PARENT_COLUMNS, estParentDe } from "@/lib/parents";

// Contrôles partagés par les routes de consultation des cours.
// La progression appartient à l'élève : les deux parents alimentent la même.

export const EQUIPE = ["superadmin", "coordinateur", "pilote", "gerant"];
export const GESTIONNAIRES = ["superadmin", "coordinateur"];

type Auth = { userId: string; email: string | undefined; roles: string[]; orgId: string | null };

/**
 * Vérifie que l'élève visé est bien rattaché au compte appelant.
 * Renvoie l'identifiant à enregistrer, ou un message d'erreur.
 * `null` = consultation par l'équipe du club, sans progression d'élève.
 */
export async function eleveAutorise(auth: Auth, eleveId: unknown): Promise<{ eleveId: string | null } | { error: string }> {
  if (!eleveId) {
    // Sans élève précisé : seule l'équipe du club peut consulter
    if (auth.roles.some((r) => EQUIPE.includes(r))) return { eleveId: null };
    return { error: "Élève manquant" };
  }
  if (typeof eleveId !== "string") return { error: "Élève invalide" };

  const { data: eleve } = await createServiceClient()
    .from("eleves")
    .select(`id, ${PARENT_COLUMNS}`)
    .eq("id", eleveId)
    .eq("organisation_id", auth.orgId!)
    .maybeSingle();
  if (!eleve) return { error: "Élève introuvable" };

  if (auth.roles.some((r) => EQUIPE.includes(r)) || estParentDe(eleve, auth.email)) {
    return { eleveId };
  }
  return { error: "Cet élève n'est pas rattaché à votre compte" };
}

/** Le cours doit appartenir au club et être publié, sauf pour ceux qui le gèrent. */
export async function coursLisible(auth: Auth, coursId: string) {
  const { data } = await createServiceClient()
    .from("cours")
    .select("id, publie")
    .eq("id", coursId)
    .eq("organisation_id", auth.orgId!)
    .maybeSingle();
  if (!data) return null;
  if (!data.publie && !auth.roles.some((r) => GESTIONNAIRES.includes(r))) return null;
  return data;
}

/** Enregistre l'ouverture d'un document, et l'ouverture du cours qui le contient. */
export async function enregistrerConsultation(
  auth: Auth,
  ressource: { id: string; cours_id: string },
  eleveId: string | null,
) {
  const db = createServiceClient();
  const orgId = auth.orgId!;
  const maintenant = new Date().toISOString();

  // Pas d'upsert : les unicités sont partielles (selon que l'élève est renseigné ou non),
  // on fait donc une lecture puis une écriture explicite.
  const cle = (q: any) => (eleveId ? q.eq("eleve_id", eleveId) : q.is("eleve_id", null).eq("profile_id", auth.userId));

  const { data: dejaVue } = await cle(
    db.from("cours_ressources_vues").select("id").eq("ressource_id", ressource.id),
  ).maybeSingle();
  if (!dejaVue) {
    await db.from("cours_ressources_vues").insert({
      organisation_id: orgId,
      ressource_id: ressource.id,
      eleve_id: eleveId,
      profile_id: auth.userId,
      vu_at: maintenant,
    });
  }

  const { data: coursVu } = await cle(
    db.from("cours_vus").select("id").eq("cours_id", ressource.cours_id),
  ).maybeSingle();
  if (!coursVu) {
    await db.from("cours_vus").insert({
      organisation_id: orgId,
      cours_id: ressource.cours_id,
      eleve_id: eleveId,
      profile_id: auth.userId,
      vu_at: maintenant,
    });
  }
}
