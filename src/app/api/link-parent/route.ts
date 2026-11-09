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
  // L'adresse peut être celle du premier ou du second responsable légal.
  let orgId = auth.orgId;
  if (!orgId) {
    const premier = (col: string, lien: string) =>
      supabase
        .from("eleves")
        .select("organisation_id")
        .ilike(col, email)
        .is(lien, null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
    const [p1, p2] = await Promise.all([premier("parent_email", "parent_id"), premier("parent2_email", "parent2_id")]);
    const first = p1.data ?? p2.data;
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
  const [e1, e2] = await Promise.all([
    supabase.from("eleves").select("parent_nom, parent_prenom").eq("organisation_id", orgId).ilike("parent_email", email).limit(1).maybeSingle(),
    supabase.from("eleves").select("parent2_nom, parent2_prenom").eq("organisation_id", orgId).ilike("parent2_email", email).limit(1).maybeSingle(),
  ]);
  const nom = e1.data?.parent_nom || e2.data?.parent2_nom || "";
  const prenom = e1.data?.parent_prenom || e2.data?.parent2_prenom || "";

  if (nom || prenom) {
    await supabase
      .from("profiles")
      .update({ nom, prenom })
      .eq("id", userId)
      .eq("nom", "") // only update if still empty
      .eq("prenom", "");
  }

  // Only unclaimed children: an existing parent link is never reassigned.
  // Les deux rôles sont couverts : le compte peut être le premier ou le second responsable légal.
  const [r1, r2] = await Promise.all([
    supabase.from("eleves").update({ parent_id: userId }).eq("organisation_id", orgId).ilike("parent_email", email).is("parent_id", null),
    supabase.from("eleves").update({ parent2_id: userId }).eq("organisation_id", orgId).ilike("parent2_email", email).is("parent2_id", null),
  ]);

  const error = r1.error ?? r2.error;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
