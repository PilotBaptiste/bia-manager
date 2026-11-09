import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { clesDuClub, lirePaiement } from "@/lib/helloasso";

// Clés HelloAsso d'un club : saisies par le propriétaire de la plateforme uniquement.
// La clé secrète n'est jamais renvoyée au navigateur, seulement l'information « renseignée ou non ».

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["proprietaire"], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const { data, error } = await createServiceClient()
    .from("organisation_secrets")
    .select("helloasso_client_id, helloasso_client_secret, helloasso_slug, updated_at")
    .eq("organisation_id", id)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: "La table des clés n'existe pas encore : lancez supabase-evolutions-2026-11.sql dans Supabase." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    helloasso: {
      client_id: data?.helloasso_client_id ?? "",
      slug: data?.helloasso_slug ?? "",
      secret_renseigne: Boolean((data?.helloasso_client_secret ?? "").trim()),
      updated_at: data?.updated_at ?? null,
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["proprietaire"], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const clientId = clip(body.client_id, 200);
  const slug = clip(body.slug, 200);
  const secret = clip(body.client_secret, 400);
  const db = createServiceClient();

  // Effacer la configuration : le club repasse en paiement hors ligne
  if (!clientId && !slug && !secret && body.effacer === true) {
    const { error } = await db.from("organisation_secrets").delete().eq("organisation_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, efface: true });
  }

  if (!clientId || !slug) {
    return NextResponse.json({ error: "L'identifiant client et le nom de l'organisation HelloAsso sont obligatoires." }, { status: 400 });
  }

  const update: Record<string, any> = {
    organisation_id: id,
    helloasso_client_id: clientId,
    helloasso_slug: slug,
    updated_at: new Date().toISOString(),
  };
  // Un champ secret laissé vide conserve la clé déjà enregistrée
  if (secret) update.helloasso_client_secret = secret;

  const { error } = await db.from("organisation_secrets").upsert(update, { onConflict: "organisation_id" });
  if (error) {
    return NextResponse.json({ error: `Enregistrement impossible : ${error.message}` }, { status: 500 });
  }

  // Vérification immédiate : on tente une authentification auprès de HelloAsso
  const cles = await clesDuClub(id);
  if (!cles) {
    return NextResponse.json({ ok: true, verifie: false, message: "Clé secrète manquante : le paiement reste inactif." });
  }
  try {
    // Un identifiant volontairement inexistant : HelloAsso répond 404 si les clés sont bonnes,
    // et 401 si elles ne le sont pas. C'est notre test d'authentification sans rien créer.
    await lirePaiement(cles, "0");
    return NextResponse.json({ ok: true, verifie: true });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg.includes("(404)")) return NextResponse.json({ ok: true, verifie: true });
    if (msg.includes("Authentification")) {
      return NextResponse.json({ ok: true, verifie: false, message: "HelloAsso refuse ces clés : vérifiez l'identifiant et la clé secrète." });
    }
    return NextResponse.json({ ok: true, verifie: false, message: msg.slice(0, 200) });
  }
}
