import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { clubUrl } from "@/lib/tenant";

// POST : le propriétaire bascule son profil dans un autre club
export async function POST(req: NextRequest) {
  const auth = await requireRole(["proprietaire"], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const organisationId = String(body.organisationId ?? "").trim();
  if (!organisationId) return NextResponse.json({ error: "Club manquant" }, { status: 400 });

  const db = createServiceClient();
  const { data: org } = await db.from("organisations").select("id, slug").eq("id", organisationId).maybeSingle();
  if (!org) return NextResponse.json({ error: "Aéroclub introuvable" }, { status: 404 });

  const { error } = await db.from("profiles").update({ organisation_id: org.id }).eq("id", auth.userId);
  if (error) return NextResponse.json({ error: `Impossible d'entrer dans ce club : ${error.message}` }, { status: 500 });

  return NextResponse.json({ url: clubUrl(org.slug, "/dashboard", req.nextUrl.origin) });
}
