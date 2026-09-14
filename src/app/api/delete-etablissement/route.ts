import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const auth = await requireRole(["superadmin"]);
  if (auth instanceof NextResponse) return auth;
  const orgId = auth.orgId!;

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "id obligatoire" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: etab } = await supabase
    .from("etablissements")
    .select("id")
    .eq("id", id)
    .eq("organisation_id", orgId)
    .maybeSingle();
  if (!etab) {
    return NextResponse.json({ error: "Établissement introuvable" }, { status: 404 });
  }

  // Check for eleves (NOT NULL FK — cannot nullify, must block)
  const { data: eleves } = await supabase
    .from("eleves")
    .select("id")
    .eq("etablissement_id", id)
    .limit(1);

  if (eleves && eleves.length > 0) {
    return NextResponse.json(
      { error: "Des élèves sont encore liés à cet établissement. Réassignez-les d'abord." },
      { status: 409 },
    );
  }

  // Nullify nullable FK references
  for (const table of ["profiles", "creneaux", "finances_operations"]) {
    const { error: nullErr } = await supabase
      .from(table)
      .update({ etablissement_id: null })
      .eq("organisation_id", orgId)
      .eq("etablissement_id", id);
    if (nullErr) {
      return NextResponse.json({ error: `${table} : ${nullErr.message}` }, { status: 400 });
    }
  }

  // Now delete
  const { error } = await supabase.from("etablissements").delete().eq("id", id).eq("organisation_id", orgId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
