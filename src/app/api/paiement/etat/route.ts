import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchCheckout, getSumupConfig } from "@/lib/sumup";

// Consulté par la page de retour : si le rappel SumUp n'est pas encore arrivé, on vérifie nous-mêmes.
export async function GET(req: Request) {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;
  const reference = new URL(req.url).searchParams.get("ref");
  if (!reference) return NextResponse.json({ error: "Référence manquante" }, { status: 400 });

  const db = createServiceClient();
  const { data: paiement } = await db
    .from("paiements")
    .select("id, organisation_id, eleve_id, montant, statut, sumup_checkout_id, eleve:eleves(prenom, nom, parent_id)")
    .eq("reference", reference)
    .eq("organisation_id", auth.orgId!)
    .maybeSingle();
  if (!paiement) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  const eleve: any = paiement.eleve;
  const staff = auth.roles.some((r) => ["superadmin", "coordinateur", "gerant"].includes(r));
  if (!staff && eleve?.parent_id !== auth.userId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  if (paiement.statut === "en_attente" && paiement.sumup_checkout_id) {
    const config = await getSumupConfig(paiement.organisation_id);
    if (config) {
      try {
        const checkout = await fetchCheckout(config, paiement.sumup_checkout_id);
        if (checkout.status === "PAID") {
          await db.from("paiements").update({ statut: "paye", paid_at: new Date().toISOString() }).eq("id", paiement.id);
          await db.from("eleves").update({
            paiement_effectue: true, paiement_montant: paiement.montant, paiement_mode: "CB (SumUp)", paiement_date: new Date().toISOString(),
          }).eq("id", paiement.eleve_id).eq("organisation_id", paiement.organisation_id);
          return NextResponse.json({ statut: "paye", montant: paiement.montant, eleve: `${eleve?.prenom} ${eleve?.nom}` });
        }
        if (checkout.status === "FAILED") {
          await db.from("paiements").update({ statut: "echoue" }).eq("id", paiement.id);
          return NextResponse.json({ statut: "echoue", montant: paiement.montant, eleve: `${eleve?.prenom} ${eleve?.nom}` });
        }
      } catch { /* on renvoie simplement l'état connu */ }
    }
  }
  return NextResponse.json({ statut: paiement.statut, montant: paiement.montant, eleve: `${eleve?.prenom} ${eleve?.nom}` });
}
