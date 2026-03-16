import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "id obligatoire" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

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
  await supabase.from("profiles").update({ etablissement_id: null }).eq("etablissement_id", id);
  await supabase.from("creneaux").update({ etablissement_id: null }).eq("etablissement_id", id);
  await supabase.from("finances_operations").update({ etablissement_id: null }).eq("etablissement_id", id);

  // Now delete
  const { error } = await supabase.from("etablissements").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
