import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

// Identity comes from the session only: a caller must never link children by passing someone else's email.
export async function POST() {
  const auth = await requireRole([], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;
  const userId = auth.userId;
  const email = auth.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email du compte introuvable" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Parents invited before multi-club have no club yet: they join the club of their first unclaimed child.
  let orgId = auth.orgId;
  if (!orgId) {
    const { data: first } = await supabase
      .from("eleves")
      .select("organisation_id")
      .ilike("parent_email", email)
      .is("parent_id", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!first?.organisation_id) {
      return NextResponse.json({ success: true });
    }
    const { error: orgError } = await supabase
      .from("profiles")
      .update({ organisation_id: first.organisation_id })
      .eq("id", userId)
      .is("organisation_id", null);
    if (orgError) {
      return NextResponse.json({ error: orgError.message }, { status: 400 });
    }
    orgId = first.organisation_id as string;
  }

  // Also update profile nom/prenom from eleves if still empty
  const { data: eleve } = await supabase
    .from("eleves")
    .select("parent_nom, parent_prenom")
    .eq("organisation_id", orgId)
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
    .eq("organisation_id", orgId)
    .ilike("parent_email", email)
    .is("parent_id", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
