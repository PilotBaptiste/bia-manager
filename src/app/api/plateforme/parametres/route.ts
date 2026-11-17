import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

const CHAMPS = [
  "editeur_nom",
  "editeur_statut",
  "editeur_siret",
  "editeur_adresse",
  "editeur_email",
  "editeur_telephone",
  "editeur_directeur",
] as const;

/** GET : l'identité de l'éditeur, pour la console propriétaire. */
export async function GET() {
  const auth = await requireRole(["proprietaire"], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await createServiceClient()
    .from("plateforme_parametres")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ parametres: data ?? {} });
}

/** PUT : enregistre l'identité. Elle alimente les mentions légales et les contrats. */
export async function PUT(req: Request) {
  const auth = await requireRole(["proprietaire"], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const maj: Record<string, string | null> = {};
  for (const champ of CHAMPS) {
    const brut = body?.[champ];
    if (brut === undefined) continue;
    const valeur = String(brut ?? "").trim().slice(0, 300);
    maj[champ] = valeur || null;
  }
  if (Object.keys(maj).length === 0) {
    return NextResponse.json({ error: "Rien à enregistrer" }, { status: 400 });
  }

  const db = createServiceClient();
  // La ligne est créée par le script SQL ; on la remet en place si elle manque,
  // pour qu'une installation incomplète ne bloque pas l'enregistrement.
  await db.from("plateforme_parametres").upsert({ id: true, ...maj }, { onConflict: "id" });

  const { data, error } = await db.from("plateforme_parametres").select("*").eq("id", true).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ parametres: data ?? {} });
}
