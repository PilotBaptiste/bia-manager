import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const auth = await requireRole(["superadmin"]);
  if (auth instanceof NextResponse) return auth;
  const orgId = auth.orgId!;

  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "userId obligatoire" }, { status: 400 });
  }
  if (userId === auth.userId) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte." }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .eq("organisation_id", orgId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // ── Pre-flight checks ────────────────────────────────────────────
  // 1. Parent: check for linked students
  const { data: eleves } = await supabase
    .from("eleves")
    .select("id, prenom, nom")
    .eq("organisation_id", orgId)
    .eq("parent_id", userId);

  if (eleves && eleves.length > 0) {
    const names = eleves.map((e: any) => `${e.prenom} ${e.nom}`).join(", ");
    return NextResponse.json(
      {
        error: `Impossible de supprimer ce compte parent — ${eleves.length} élève${eleves.length > 1 ? "s sont liés" : " est lié"} : ${names}. Supprimez ou réassignez ${eleves.length > 1 ? "ces élèves" : "cet élève"} d'abord.`,
        code: "HAS_ELEVES",
      },
      { status: 409 },
    );
  }

  // 2. Pilote: check for active/open slots
  const { data: creneaux } = await supabase
    .from("creneaux")
    .select("id, date_vol, statut")
    .eq("organisation_id", orgId)
    .eq("pilote_id", userId)
    .in("statut", ["ouvert", "confirme"]);

  if (creneaux && creneaux.length > 0) {
    return NextResponse.json(
      {
        error: `Impossible de supprimer ce compte pilote — ${creneaux.length} créneau${creneaux.length > 1 ? "x sont encore ouverts" : " est encore ouvert"}. Clôturez ou supprimez ${creneaux.length > 1 ? "ces créneaux" : "ce créneau"} dans Planning des vols d'abord.`,
        code: "HAS_CRENEAUX",
      },
      { status: 409 },
    );
  }

  // ── All clear: delete ────────────────────────────────────────────
  // Delete related rows first to avoid FK constraint errors on auth.users
  await supabase.from("email_logs").delete().eq("organisation_id", orgId).eq("user_id", userId);
  await supabase.from("activity_logs").delete().eq("organisation_id", orgId).eq("user_id", userId);
  await supabase.from("notifications").delete().eq("organisation_id", orgId).eq("destinataire_id", userId);
  await supabase.from("pilote_etablissements").delete().eq("organisation_id", orgId).eq("pilote_id", userId);
  await supabase.from("pilote_qualifications").delete().eq("organisation_id", orgId).eq("pilote_id", userId);

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  await supabase.from("profiles").delete().eq("id", userId).eq("organisation_id", orgId);

  return NextResponse.json({ success: true });
}
