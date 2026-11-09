import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { coursLisible, eleveAutorise } from "@/lib/coursServeur";

/**
 * POST /api/cours/termine { cours_id, eleve_id, termine }
 * Marque un cours comme terminé pour un élève, ou revient en arrière.
 * La progression appartient à l'élève : les deux parents agissent sur la même.
 */
export async function POST(req: Request) {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const coursId = body?.cours_id;
  const termine = body?.termine !== false;
  if (!coursId || typeof coursId !== "string") {
    return NextResponse.json({ error: "Cours manquant" }, { status: 400 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serveur non configuré" }, { status: 500 });
  }

  if (!(await coursLisible(auth, coursId))) {
    return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });
  }
  const eleve = await eleveAutorise(auth, body?.eleve_id);
  if ("error" in eleve) return NextResponse.json({ error: eleve.error }, { status: 403 });
  if (!eleve.eleveId) {
    return NextResponse.json({ error: "Un cours se termine pour un élève" }, { status: 400 });
  }

  const db = createServiceClient();
  const maintenant = new Date().toISOString();
  const { data: existante } = await db
    .from("cours_vus")
    .select("id")
    .eq("cours_id", coursId)
    .eq("eleve_id", eleve.eleveId)
    .maybeSingle();

  if (existante) {
    const { error } = await db
      .from("cours_vus")
      .update({ termine_at: termine ? maintenant : null, profile_id: auth.userId })
      .eq("id", existante.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await db.from("cours_vus").insert({
      organisation_id: auth.orgId!,
      cours_id: coursId,
      eleve_id: eleve.eleveId,
      profile_id: auth.userId,
      vu_at: maintenant,
      termine_at: termine ? maintenant : null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, termine });
}
