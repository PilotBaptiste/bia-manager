import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { clesDuClub, creerPaiement } from "@/lib/helloasso";
import { getOrgById } from "@/lib/org";
import { getClubInfo } from "@/lib/club";
import { clubUrl } from "@/lib/tenant";
import { PARENT_COLUMNS, estParentDe } from "@/lib/parents";

/**
 * POST /api/paiement/checkout { eleve_id }
 * Démarre un paiement de la cotisation BIA pour un élève et renvoie
 * l'adresse de la page de paiement HelloAsso.
 */
export async function POST(req: Request) {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;
  const orgId = auth.orgId!;

  const { eleve_id } = await req.json().catch(() => ({ eleve_id: null }));
  if (!eleve_id || typeof eleve_id !== "string") {
    return NextResponse.json({ error: "Élève manquant" }, { status: 400 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serveur non configuré" }, { status: 500 });
  }

  const supabase = createServiceClient();

  // Le module doit être activé pour ce club
  const { data: org } = await supabase.from("organisations").select("modules").eq("id", orgId).maybeSingle();
  if (!Array.isArray(org?.modules) || !org.modules.includes("paiement_en_ligne")) {
    return NextResponse.json({ error: "Le paiement en ligne n'est pas activé pour cet aéroclub" }, { status: 403 });
  }

  const { data: eleve } = await supabase
    .from("eleves")
    .select(`id, nom, prenom, paiement_effectue, archive, abandonne, ${PARENT_COLUMNS}`)
    .eq("id", eleve_id)
    .eq("organisation_id", orgId)
    .maybeSingle();
  if (!eleve) return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });

  // Seuls les responsables légaux de l'élève, ou l'équipe du club, peuvent lancer le paiement
  const equipe = ["superadmin", "coordinateur", "gerant"];
  const autorise = auth.roles.some((r) => equipe.includes(r)) || estParentDe(eleve, auth.email);
  if (!autorise) {
    return NextResponse.json({ error: "Cet élève n'est pas rattaché à votre compte" }, { status: 403 });
  }
  if (eleve.paiement_effectue) {
    return NextResponse.json({ error: "Le paiement de cet élève est déjà enregistré" }, { status: 409 });
  }
  if (eleve.archive || eleve.abandonne) {
    return NextResponse.json({ error: "Ce dossier n'est plus actif" }, { status: 409 });
  }

  const cles = await clesDuClub(orgId);
  if (!cles) {
    return NextResponse.json(
      { error: "Le paiement en ligne n'est pas encore configuré pour cet aéroclub. Contactez-le directement." },
      { status: 503 },
    );
  }

  // Montant : le prix d'inscription du club
  const { data: prix } = await supabase
    .from("parametres").select("valeur").eq("organisation_id", orgId).eq("cle", "prix_inscription").maybeSingle();
  const montant = parseFloat(String(prix?.valeur ?? "")) || 0;
  if (montant <= 0) {
    return NextResponse.json({ error: "Le prix d'inscription n'est pas renseigné par l'aéroclub" }, { status: 503 });
  }

  // Un paiement déjà en attente pour cet élève est réutilisé plutôt que dupliqué
  const { data: dejaEnAttente } = await supabase
    .from("paiements")
    .select("reference")
    .eq("organisation_id", orgId)
    .eq("eleve_id", eleve_id)
    .eq("statut", "en_attente")
    .limit(1)
    .maybeSingle();

  const reference = dejaEnAttente?.reference ?? randomUUID();
  const [orgInfo, club] = await Promise.all([getOrgById(orgId), getClubInfo(orgId)]);
  const origine = new URL(req.url).origin;
  const base = orgInfo ? clubUrl(orgInfo.slug, "", origine) : origine;
  const retour = `${base}/dashboard/paiement/retour?ref=${encodeURIComponent(reference)}`;

  let intention;
  try {
    intention = await creerPaiement(cles, {
      montantCentimes: Math.round(montant * 100),
      libelle: `Cotisation BIA — ${eleve.prenom} ${eleve.nom} (${club.nom})`,
      reference,
      urlRetour: retour,
      urlErreur: `${retour}&etat=erreur`,
      urlAnnulation: `${retour}&etat=annule`,
      payeur: { email: auth.email ?? undefined, prenom: auth.profile?.prenom, nom: auth.profile?.nom },
    });
  } catch (e: any) {
    console.error("HelloAsso checkout:", e?.message);
    return NextResponse.json({ error: e?.message ?? "Paiement indisponible" }, { status: 502 });
  }

  const { error: insertError } = await supabase.from("paiements").upsert(
    {
      organisation_id: orgId,
      eleve_id,
      reference,
      montant,
      statut: "en_attente",
      checkout_id: String(intention.id),
      payeur_email: auth.email ?? null,
    },
    { onConflict: "reference" },
  );
  if (insertError) {
    return NextResponse.json({ error: `Enregistrement du paiement impossible : ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ url: intention.url, reference });
}
