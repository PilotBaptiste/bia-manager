import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { editeur } from "@/lib/legalServeur";
import { finaliserSiComplet } from "@/lib/contratFinalisation";
import { nouvelIdSignature } from "@/lib/signatureContrat";

/**
 * POST /api/plateforme/contrats/signer { id, signature? }
 * Signature du contrat par l'éditeur. Pas de code à usage unique ici : la
 * session propriétaire est déjà l'authentification, et c'est lui qui a envoyé
 * la demande.
 *
 * Sans `signature`, on reprend le paraphe enregistré dans les paramètres de la
 * plateforme : on ne redessine pas sa signature à chaque contrat.
 */
export async function POST(req: Request) {
  const auth = await requireRole(["proprietaire"], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Contrat manquant" }, { status: 400 });

  const db = createServiceClient();
  const { data: contrat } = await db.from("contrats").select("*").eq("id", id).maybeSingle();
  if (!contrat) return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  if (contrat.signature_editeur_le) {
    return NextResponse.json({ error: "Vous avez déjà signé ce contrat" }, { status: 409 });
  }

  const { data: params } = await db
    .from("plateforme_parametres")
    .select("signature_image")
    .eq("id", true)
    .maybeSingle();

  const fournie = String(body?.signature ?? "");
  const trace = fournie || String(params?.signature_image ?? "");
  if (!trace.startsWith("data:image/png;base64,") || trace.length < 200) {
    return NextResponse.json(
      { error: "Tracez d'abord votre signature : elle sera réutilisée pour les contrats suivants." },
      { status: 400 },
    );
  }
  if (trace.length > 400_000) return NextResponse.json({ error: "Signature trop lourde" }, { status: 400 });

  // Un nouveau tracé devient le paraphe par défaut.
  if (fournie && fournie !== params?.signature_image) {
    await db.from("plateforme_parametres").upsert({ id: true, signature_image: fournie }, { onConflict: "id" });
  }

  const e = await editeur();
  const horodatage = new Date().toISOString();
  const { error: majErr } = await db
    .from("contrats")
    .update({
      signature_id: contrat.signature_id || nouvelIdSignature(),
      signature_editeur_image: trace,
      signature_editeur_nom: e.directeur || e.nom || "Éditeur",
      signature_editeur_le: horodatage,
      statut: contrat.signature_club_le ? "signe" : "partiel",
    })
    .eq("id", id);
  if (majErr) return NextResponse.json({ error: majErr.message }, { status: 400 });

  try {
    const finalise = await finaliserSiComplet(id);
    return NextResponse.json({ ok: true, complet: !!finalise, reference: finalise?.reference ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Finalisation impossible" }, { status: 500 });
  }
}
