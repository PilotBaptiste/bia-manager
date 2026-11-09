import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { coursLisible, eleveAutorise, enregistrerConsultation } from "@/lib/coursServeur";

/**
 * POST /api/cours/ressource-vue { id, eleve_id }
 * Enregistre l'ouverture d'un document. Utilisé pour les liens, qui s'ouvrent
 * directement dans un nouvel onglet sans passer par le serveur.
 */
export async function POST(req: Request) {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  if (!body?.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "Document manquant" }, { status: 400 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: true });
  }

  const { data: ressource } = await createServiceClient()
    .from("cours_ressources")
    .select("id, cours_id")
    .eq("id", body.id)
    .eq("organisation_id", auth.orgId!)
    .maybeSingle();
  if (!ressource) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  if (!(await coursLisible(auth, ressource.cours_id))) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  const eleve = await eleveAutorise(auth, body.eleve_id);
  if ("error" in eleve) return NextResponse.json({ error: eleve.error }, { status: 403 });

  await enregistrerConsultation(auth, ressource, eleve.eleveId);
  return NextResponse.json({ ok: true });
}
