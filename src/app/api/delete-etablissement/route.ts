import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

export async function POST(req: Request) {
  const auth = await requireRole(["superadmin"]);
  if (auth instanceof NextResponse) return auth;

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
  for (const table of ["profiles", "creneaux", "finances_operations"]) {
    const { error: nullErr } = await supabase.from(table).update({ etablissement_id: null }).eq("etablissement_id", id);
    if (nullErr) {
      return NextResponse.json({ error: `${table} : ${nullErr.message}` }, { status: 400 });
    }
  }

  // Now delete
  const { error } = await supabase.from("etablissements").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
