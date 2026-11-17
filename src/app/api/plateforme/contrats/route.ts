import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

const TYPES = ["sous_traitance", "abonnement"];
const STATUTS = ["brouillon", "envoye", "signe", "resilie"];

const TEXTES = [
  "reference",
  "club_raison_sociale",
  "club_adresse",
  "club_siret",
  "club_representant",
  "club_fonction",
  "club_email",
  "signe_par",
  "clauses_particulieres",
  "notes",
] as const;

const DATES = ["date_effet", "date_fin", "signe_le", "resilie_le"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** GET : tous les contrats, avec le nom du club auquel ils se rattachent. */
export async function GET() {
  const auth = await requireRole(["proprietaire"], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await createServiceClient()
    .from("contrats")
    .select("*, organisation:organisations(id, nom, slug, actif)")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ contrats: data ?? [] });
}

/**
 * POST : crée ou met à jour le contrat d'un club.
 * Un seul contrat par club et par type : l'unicité est tenue par la base, on
 * fait donc un upsert plutôt que de demander à l'écran s'il existe déjà.
 */
export async function POST(req: Request) {
  const auth = await requireRole(["proprietaire"], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const organisationId = String(body?.organisation_id ?? "").trim();
  const type = String(body?.type ?? "sous_traitance");
  if (!organisationId) return NextResponse.json({ error: "Aéroclub manquant" }, { status: 400 });
  if (!TYPES.includes(type)) return NextResponse.json({ error: "Type de contrat inconnu" }, { status: 400 });

  const statut = String(body?.statut ?? "brouillon");
  if (!STATUTS.includes(statut)) return NextResponse.json({ error: "Statut inconnu" }, { status: 400 });

  const db = createServiceClient();
  const { data: org } = await db.from("organisations").select("id").eq("id", organisationId).maybeSingle();
  if (!org) return NextResponse.json({ error: "Aéroclub introuvable" }, { status: 404 });

  const ligne: Record<string, any> = { organisation_id: organisationId, type, statut };
  for (const champ of TEXTES) {
    const valeur = String(body?.[champ] ?? "").trim();
    ligne[champ] = valeur ? valeur.slice(0, 5000) : null;
  }
  for (const champ of DATES) {
    const valeur = String(body?.[champ] ?? "").trim();
    if (valeur && !DATE_RE.test(valeur)) {
      return NextResponse.json({ error: `Date invalide : ${champ}` }, { status: 400 });
    }
    ligne[champ] = valeur || null;
  }
  const montant = body?.montant_annuel;
  if (montant === "" || montant == null) {
    ligne.montant_annuel = null;
  } else {
    const n = Number(montant);
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
    ligne.montant_annuel = n;
  }

  // Un contrat passé à « envoyé » garde la date de son premier envoi.
  if (statut === "envoye" && !body?.envoye_le) ligne.envoye_le = new Date().toISOString();
  else if (body?.envoye_le) ligne.envoye_le = body.envoye_le;
  if (statut !== "signe") ligne.signe_le = ligne.signe_le ?? null;

  const { data, error } = await db
    .from("contrats")
    .upsert(ligne, { onConflict: "organisation_id,type" })
    .select("*, organisation:organisations(id, nom, slug, actif)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ contrat: data });
}

/** DELETE : retire un contrat. Le club et ses données ne sont pas touchés. */
export async function DELETE(req: Request) {
  const auth = await requireRole(["proprietaire"], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Contrat manquant" }, { status: 400 });

  const { error } = await createServiceClient().from("contrats").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
