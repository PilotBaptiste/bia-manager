import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchCheckout, getSumupConfig } from "@/lib/sumup";

// Rappel envoyé par SumUp. Le contenu du message n'est jamais cru sur parole :
// le paiement est reconfirmé auprès de l'API SumUp avec la clé du club concerné.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const checkoutId = body?.id || body?.checkout_id || body?.data?.id || body?.payload?.id;
  const reference = body?.checkout_reference || body?.data?.checkout_reference || body?.payload?.checkout_reference;
  if (!checkoutId && !reference) return NextResponse.json({ ignored: true });

  const db = createServiceClient();
  let query = db.from("paiements").select("id, organisation_id, eleve_id, montant, statut, sumup_checkout_id").limit(1);
  query = checkoutId ? query.eq("sumup_checkout_id", checkoutId) : query.eq("reference", reference);
  const { data: rows } = await query;
  const paiement = rows?.[0];
  if (!paiement) return NextResponse.json({ ignored: true });
  if (paiement.statut === "paye") return NextResponse.json({ ok: true });

  const config = await getSumupConfig(paiement.organisation_id);
  if (!config) return NextResponse.json({ error: "Club sans configuration SumUp" }, { status: 409 });

  let checkout;
  try {
    checkout = await fetchCheckout(config, paiement.sumup_checkout_id || String(checkoutId));
  } catch {
    return NextResponse.json({ error: "Vérification SumUp impossible" }, { status: 502 });
  }
  if (checkout.status !== "PAID") {
    if (checkout.status === "FAILED") await db.from("paiements").update({ statut: "echoue" }).eq("id", paiement.id);
    return NextResponse.json({ ok: true, statut: checkout.status });
  }

  await db.from("paiements").update({ statut: "paye", paid_at: new Date().toISOString() }).eq("id", paiement.id);
  await db.from("eleves").update({
    paiement_effectue: true,
    paiement_montant: paiement.montant,
    paiement_mode: "CB (SumUp)",
    paiement_date: new Date().toISOString(),
  }).eq("id", paiement.eleve_id).eq("organisation_id", paiement.organisation_id);
  return NextResponse.json({ ok: true });
}
