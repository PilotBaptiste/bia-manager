import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

/** POST /api/cours/vu — marque un cours (généralement un lien) comme consulté. */
export async function POST(req: Request) {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;

  const { id } = await req.json().catch(() => ({ id: null }));
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Cours manquant" }, { status: 400 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceClient();
  const { data: cours } = await supabase
    .from("cours")
    .select("id")
    .eq("id", id)
    .eq("organisation_id", auth.orgId!)
    .maybeSingle();
  if (!cours) return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });

  await supabase.from("cours_vus").upsert(
    { cours_id: cours.id, profile_id: auth.userId, organisation_id: auth.orgId!, vu_at: new Date().toISOString() },
    { onConflict: "cours_id,profile_id" },
  );
  return NextResponse.json({ ok: true });
}
