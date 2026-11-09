import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { coursLisible, eleveAutorise, enregistrerConsultation } from "@/lib/coursServeur";

/**
 * GET /api/cours/fichier?id=<ressource>&eleve=<eleve>&mode=view|download
 *
 * L'espace de stockage des cours est privé : le lien est signé côté serveur, après
 * vérification que le document appartient au club du demandeur, que son cours est
 * publié, et que l'élève visé est bien rattaché au compte.
 * `mode=view` renvoie le fichier tel quel pour l'afficher dans l'application ;
 * `mode=download` force le téléchargement.
 */
export async function GET(req: Request) {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;

  const params = new URL(req.url).searchParams;
  const id = params.get("id");
  const mode = params.get("mode") === "download" ? "download" : "view";
  if (!id) return NextResponse.json({ error: "Document manquant" }, { status: 400 });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serveur non configuré" }, { status: 500 });
  }
  const supabase = createServiceClient();

  const { data: ressource } = await supabase
    .from("cours_ressources")
    .select("id, cours_id, type, fichier_path, fichier_nom")
    .eq("id", id)
    .eq("organisation_id", auth.orgId!)
    .maybeSingle();
  if (!ressource || ressource.type !== "fichier" || !ressource.fichier_path) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }
  if (!(await coursLisible(auth, ressource.cours_id))) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  const eleve = await eleveAutorise(auth, params.get("eleve"));
  if ("error" in eleve) return NextResponse.json({ error: eleve.error }, { status: 403 });

  const { data: signed, error } = await supabase.storage
    .from("cours")
    .createSignedUrl(
      ressource.fichier_path,
      300,
      mode === "download" ? { download: ressource.fichier_nom ?? undefined } : {},
    );
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: "Fichier indisponible" }, { status: 404 });
  }

  // La consultation ne doit jamais empêcher la lecture du document
  await enregistrerConsultation(auth, ressource, eleve.eleveId).catch(() => undefined);

  return NextResponse.redirect(signed.signedUrl);
}
