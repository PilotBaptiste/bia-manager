import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/cours/download?id=<cours_id>
 * L'espace de stockage des cours est privé : le lien de téléchargement est
 * signé côté serveur après vérification que le cours appartient bien au club
 * du demandeur et qu'il est publié.
 */
export async function GET(req: Request) {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Cours manquant" }, { status: 400 });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serveur non configuré" }, { status: 500 });
  }
  const supabase = createServiceClient();

  const { data: cours } = await supabase
    .from("cours")
    .select("id, titre, type, fichier_path, fichier_nom, publie")
    .eq("id", id)
    .eq("organisation_id", auth.orgId!)
    .maybeSingle();

  if (!cours || cours.type !== "fichier" || !cours.fichier_path) {
    return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });
  }

  // Un cours non publié reste visible de l'équipe du club uniquement
  const equipe = ["superadmin", "coordinateur"];
  if (!cours.publie && !auth.roles.some((r) => equipe.includes(r))) {
    return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from("cours")
    .createSignedUrl(cours.fichier_path, 120, { download: cours.fichier_nom ?? undefined });

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: "Fichier indisponible" }, { status: 404 });
  }

  // Marque le cours comme consulté (sans bloquer le téléchargement en cas d'échec)
  await supabase
    .from("cours_vus")
    .upsert(
      { cours_id: cours.id, profile_id: auth.userId, organisation_id: auth.orgId!, vu_at: new Date().toISOString() },
      { onConflict: "cours_id,profile_id" },
    )
    .then(() => undefined, () => undefined);

  return NextResponse.redirect(signed.signedUrl);
}
