import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { clesDuClub, lirePaiement } from "@/lib/helloasso";

/**
 * POST /api/paiement/confirmer { reference }
 * Vérifie l'état réel du paiement auprès de HelloAsso et, s'il est encaissé,
 * enregistre le paiement de l'élève. Le retour du navigateur ne suffit jamais :
 * c'est la lecture chez HelloAsso qui fait foi.
 */
export async function POST(req: Request) {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;
  const orgId = auth.orgId!;

  const { reference } = await req.json().catch(() => ({ reference: null }));
  if (!reference || typeof reference !== "string") {
    return NextResponse.json({ error: "Référence manquante" }, { status: 400 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serveur non configuré" }, { status: 500 });
  }

  const supabase = createServiceClient();
  const { data: paiement } = await supabase
    .from("paiements")
    .select("id, eleve_id, montant, statut, checkout_id")
    .eq("reference", reference)
    .eq("organisation_id", orgId)
    .maybeSingle();
  if (!paiement) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });

  if (paiement.statut === "paye") {
    return NextResponse.json({ statut: "paye", eleve_id: paiement.eleve_id });
  }
  if (!paiement.checkout_id) {
    return NextResponse.json({ statut: paiement.statut });
  }

  const cles = await clesDuClub(orgId);
  if (!cles) return NextResponse.json({ error: "Paiement en ligne non configuré" }, { status: 503 });

  let etat;
  try {
    etat = await lirePaiement(cles, paiement.checkout_id);
  } catch (e: any) {
    console.error("HelloAsso lecture:", e?.message);
    return NextResponse.json({ error: "Vérification impossible pour le moment. Réessayez dans quelques instants." }, { status: 502 });
  }

  if (!etat.paye) {
    return NextResponse.json({ statut: "en_attente" });
  }
  // La référence renvoyée par HelloAsso doit correspondre : sinon on ne valide rien.
  if (etat.reference && etat.reference !== reference) {
    return NextResponse.json({ error: "Paiement incohérent" }, { status: 409 });
  }

  await supabase
    .from("paiements")
    .update({ statut: "paye", paid_at: new Date().toISOString(), payeur_email: etat.payeurEmail ?? undefined })
    .eq("id", paiement.id);

  // Le dossier de l'élève passe en « payé » : le vol 1 devient réservable
  if (paiement.eleve_id) {
    await supabase
      .from("eleves")
      .update({
        paiement_effectue: true,
        paiement_mode: "HelloAsso",
        paiement_montant: paiement.montant,
        paiement_date: new Date().toISOString(),
      })
      .eq("id", paiement.eleve_id)
      .eq("organisation_id", orgId);
  }

  return NextResponse.json({ statut: "paye", eleve_id: paiement.eleve_id });
}
