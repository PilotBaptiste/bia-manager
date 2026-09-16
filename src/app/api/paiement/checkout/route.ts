import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getOrgById } from "@/lib/org";
import { clubUrl } from "@/lib/tenant";
import { createCheckout, getSumupConfig } from "@/lib/sumup";
import { randomBytes } from "crypto";

const STAFF = ["superadmin", "coordinateur", "gerant"];

export async function POST(req: Request) {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;
  const orgId = auth.orgId!;
  const db = createServiceClient();

  const { data: org } = await db.from("organisations").select("id, slug, modules").eq("id", orgId).maybeSingle();
  if (!Array.isArray((org as any)?.modules) || !(org as any).modules.includes("paiement_en_ligne")) {
    return NextResponse.json({ error: "Le paiement en ligne n'est pas activé pour cet aéroclub." }, { status: 403 });
  }

  const { eleveId } = await req.json().catch(() => ({}));
  if (!eleveId) return NextResponse.json({ error: "Élève manquant" }, { status: 400 });

  const { data: eleve } = await db
    .from("eleves")
    .select("id, prenom, nom, parent_id, paiement_effectue, paiement_montant, organisation_id")
    .eq("id", eleveId)
    .eq("organisation_id", orgId)
    .maybeSingle();
  if (!eleve) return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
  if (eleve.parent_id !== auth.userId && !auth.roles.some((r) => STAFF.includes(r))) {
    return NextResponse.json({ error: "Cet élève n'est pas rattaché à votre compte" }, { status: 403 });
  }
  if (eleve.paiement_effectue) return NextResponse.json({ error: "L'inscription est déjà payée." }, { status: 409 });

  const { data: prix } = await db.from("parametres").select("valeur").eq("organisation_id", orgId).eq("cle", "prix_inscription").maybeSingle();
  const montant = eleve.paiement_montant != null ? Number(eleve.paiement_montant) : parseFloat(prix?.valeur ?? "");
  if (!Number.isFinite(montant) || montant <= 0) {
    return NextResponse.json({ error: "Le prix de l'inscription n'est pas renseigné dans les paramètres du club." }, { status: 400 });
  }

  const config = await getSumupConfig(orgId);
  if (!config) return NextResponse.json({ error: "Le compte SumUp de cet aéroclub n'est pas encore configuré." }, { status: 503 });

  const reference = `BIA-${randomBytes(6).toString("hex").toUpperCase()}`;
  const { data: paiement, error: insErr } = await db.from("paiements").insert({
    organisation_id: orgId, eleve_id: eleve.id, reference, montant, cree_par: auth.userId,
  }).select("id").single();
  if (insErr) return NextResponse.json({ error: `Enregistrement impossible : ${insErr.message}` }, { status: 500 });

  try {
    const retour = clubUrl(org!.slug, `/dashboard/paiement?ref=${reference}`, new URL(req.url).origin);
    const checkout = await createCheckout(config, {
      reference,
      amount: montant,
      description: `Inscription BIA — ${eleve.prenom} ${eleve.nom}`,
      returnUrl: retour,
    });
    await db.from("paiements").update({ sumup_checkout_id: checkout.id }).eq("id", paiement.id);
    return NextResponse.json({ url: checkout.url, reference });
  } catch (e: any) {
    await db.from("paiements").update({ statut: "echoue" }).eq("id", paiement.id);
    return NextResponse.json({ error: e?.message ?? "Le paiement n'a pas pu être lancé." }, { status: 502 });
  }
}
