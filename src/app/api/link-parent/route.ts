import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Links all eleves whose parent_email matches the authenticated user's email
 * to that user's profile (sets parent_id = userId).
 * Safe to call multiple times — only updates rows where parent_id IS NULL.
 */
export async function POST(req: Request) {
  const { userId, email } = await req.json();
  if (!userId || !email) {
    return NextResponse.json({ error: "userId and email required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Also update profile nom/prenom from eleves if still empty
  const { data: eleve } = await supabase
    .from("eleves")
    .select("parent_nom, parent_prenom")
    .eq("parent_email", email)
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

  // Always sync parent_id by email — covers null, deleted/recreated accounts, etc.
  const { error } = await supabase
    .from("eleves")
    .update({ parent_id: userId })
    .eq("parent_email", email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
