import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { MODULE_KEYS } from "@/lib/modules";

// PATCH : renommer ou (dés)activer un club
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["proprietaire"], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const update: { nom?: string; actif?: boolean; modules?: string[] } = {};
  if (body.modules !== undefined) {
    if (!Array.isArray(body.modules) || body.modules.some((m: unknown) => typeof m !== "string" || !MODULE_KEYS.includes(m))) {
      return NextResponse.json({ error: "Module inconnu" }, { status: 400 });
    }
    update.modules = Array.from(new Set(body.modules as string[]));
  }
  if (body.nom !== undefined) {
    const nom = String(body.nom).trim();
    if (!nom) return NextResponse.json({ error: "Le nom de l'aéroclub ne peut pas être vide" }, { status: 400 });
    update.nom = nom;
  }
  if (body.actif !== undefined) {
    if (typeof body.actif !== "boolean") return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    update.actif = body.actif;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Aucune modification" }, { status: 400 });

  if (update.actif === false && id === auth.orgId) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas désactiver le club dans lequel vous travaillez. Entrez d'abord dans un autre club, puis désactivez celui-ci." },
      { status: 400 },
    );
  }

  const db = createServiceClient();
  const { data: organisation, error } = await db
    .from("organisations")
    .update(update)
    .eq("id", id)
    .select("id, slug, nom, actif, created_at")
    .maybeSingle();
  if (error?.message?.includes("modules")) {
    return NextResponse.json({ error: "Les modules ne sont pas encore installés : lancez le script supabase-modules-2026-09.sql dans Supabase." }, { status: 500 });
  }
  if (error) return NextResponse.json({ error: `Modification impossible : ${error.message}` }, { status: 500 });
  if (!organisation) return NextResponse.json({ error: "Aéroclub introuvable" }, { status: 404 });

  // Le nom affiché dans l'application vient des paramètres du club : on le garde aligné.
  if (update.nom) {
    await db.from("parametres").update({ valeur: update.nom }).eq("organisation_id", id).eq("cle", "nom_aeroclub");
  }

  return NextResponse.json({ organisation });
}
