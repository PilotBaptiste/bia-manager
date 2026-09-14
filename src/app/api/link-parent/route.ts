import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

// Identity comes from the session only: a caller must never link children by passing someone else's email.
export async function POST() {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;
  const userId = auth.userId;
  const email = auth.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email du compte introuvable" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Also update profile nom/prenom from eleves if still empty
  const { data: eleve } = await supabase
    .from("eleves")
    .select("parent_nom, parent_prenom")
    .ilike("parent_email", email)
    .limit(1)
    .maybeSingle();

  if (eleve?.parent_nom || eleve?.parent_prenom) {
    await supabase
      .from("profiles")
      .update({
        nom: eleve.parent_nom || "",
        prenom: eleve.parent_prenom || "",
      })
      .eq("id", userId)
      .eq("nom", "") // only update if still empty
      .eq("prenom", "");
  }

  // Only unclaimed children: an existing parent link is never reassigned.
  const { error } = await supabase
    .from("eleves")
    .update({ parent_id: userId })
    .ilike("parent_email", email)
    .is("parent_id", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
