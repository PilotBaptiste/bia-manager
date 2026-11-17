// Lecture de l'identité de l'éditeur en base. Séparé de legal.ts parce que ce
// fichier touche au client Supabase serveur : ne l'importez jamais depuis un
// composant « use client », sinon le build échoue sur les variables d'env
// réservées au serveur.
import { createServiceClient } from "@/lib/supabase/server";
import { assembler, editeurEnv, lire, type Editeur } from "@/lib/legal";

/**
 * Identité affichée sur les pages légales et les contrats : la console
 * propriétaire d'abord, les variables d'environnement ensuite, champ par champ.
 */
export async function editeur(): Promise<Editeur> {
  const env = editeurEnv();
  try {
    const { data } = await createServiceClient()
      .from("plateforme_parametres")
      .select("editeur_nom, editeur_statut, editeur_siret, editeur_adresse, editeur_email, editeur_directeur")
      .eq("id", true)
      .maybeSingle();
    if (!data) return env;
    return assembler({
      nom: lire(data.editeur_nom) || env.nom,
      statut: lire(data.editeur_statut) || env.statut,
      siret: lire(data.editeur_siret) || env.siret,
      adresse: lire(data.editeur_adresse) || env.adresse,
      email: lire(data.editeur_email) || env.email,
      directeur: lire(data.editeur_directeur) || env.directeur,
    });
  } catch {
    // Table absente (script SQL pas encore passé) : on ne casse pas la page.
    return env;
  }
}
