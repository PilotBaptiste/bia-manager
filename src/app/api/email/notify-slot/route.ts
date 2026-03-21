import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * POST /api/email/notify-slot
 * Called when a new créneau is created. Notifies eligible parents that a slot is available.
 *
 * Eligibility: paiement_effectue + attestation_signee + no active vol1 reservation + not archived
 *
 * Anti-spam: Only sends if there were NO other open slots for the same scope before this one.
 * This prevents spamming parents every time a slot is added when slots already exist.
 * Exception: eleves_autorises slots always notify (they are targeted to specific students).
 *
 * Scoping:
 *   - eleves_autorises (array of eleve IDs) → only those specific students' parents (always notifies)
 *   - else etablissement_id → only parents of students in that etablissement
 *   - else → all eligible parents
 *
 * Body: { creneau_id, etablissement_id?, eleves_autorises?, date_vol, heure_debut, heure_fin, pilote_nom, aeronef }
 */
export async function POST(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ skipped: true });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const body = await req.json();
  const { creneau_id, etablissement_id, eleves_autorises, date_vol, heure_debut, heure_fin, pilote_nom, aeronef } = body;

  // Anti-spam: skip if slots already existed for this scope (unless targeting specific students)
  const isTargeted = eleves_autorises && eleves_autorises.length > 0;
  if (!isTargeted) {
    let countQuery = supabase
      .from("creneaux")
      .select("id", { count: "exact", head: true })
      .eq("statut", "ouvert");
    if (creneau_id) countQuery = countQuery.neq("id", creneau_id);
    if (etablissement_id) {
      countQuery = countQuery.eq("etablissement_id", etablissement_id);
    } else {
      countQuery = countQuery.is("etablissement_id", null);
    }
    const { count: existingCount } = await countQuery;
    if (existingCount && existingCount > 0) {
      return NextResponse.json({ sent: 0, reason: "slots_already_available" });
    }
  }

  // Build eligible eleves query
  let query = supabase
    .from("eleves")
    .select("id, prenom, nom, parent_email, parent_prenom, etablissement_id, reservations(id, statut, type_vol)")
    .eq("archive", false)
    .eq("paiement_effectue", true)
    .eq("attestation_signee", true)
    .eq("vol1_effectue", false)
    .not("parent_email", "is", null);

  if (isTargeted) {
    query = query.in("id", eleves_autorises);
  } else if (etablissement_id) {
    query = query.eq("etablissement_id", etablissement_id);
  }

  const { data: eleves } = await query;

  // Filter out those who already have an active vol1 reservation
  const eligible = (eleves ?? []).filter((e: any) => {
    const activeVol1 = (e.reservations ?? []).some(
      (r: any) => r.type_vol === 1 && r.statut !== "annule",
    );
    return !activeVol1 && e.parent_email;
  });

  // Deduplicate by email
  const seen = new Set<string>();
  const parents = eligible
    .filter((e: any) => {
      if (seen.has(e.parent_email)) return false;
      seen.add(e.parent_email);
      return true;
    })
    .map((e: any) => ({
      email: e.parent_email,
      prenom: e.parent_prenom || "",
      eleve_prenom: e.prenom,
      eleve_nom: e.nom,
      eleve_id: e.id,
    }));

  if (parents.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Format date nicely
  const dateFormatted = new Date(date_vol).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const heureFormatted = heure_debut?.slice(0, 5) || "";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bia-manager-acba.vercel.app";

  const res = await fetch(`${appUrl}/api/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "slot_available",
      parents,
      date_vol: dateFormatted,
      heure_debut: heureFormatted,
      heure_fin: heure_fin?.slice(0, 5) || "",
      pilote_nom,
      aeronef,
      creneau_id,
    }),
  }).catch(() => null);

  return NextResponse.json({ sent: parents.length, ok: res?.ok });
}
