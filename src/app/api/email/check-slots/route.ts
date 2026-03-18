import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * POST /api/email/check-slots
 * Called after a booking is made. Checks server-side if any slots remain open.
 * If not, sends a "no_slots_available" notification to all eligible waiting parents.
 * Eligible parents: payment done + attestation signed + no active reservation + vol not yet done.
 */
export async function POST() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ skipped: true });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // 1. Check if any open slots remain with available capacity
  const { data: creneaux } = await supabase
    .from("creneaux")
    .select("id, places_disponibles, statut, aeronef:aeronef_id(nb_places_eleves), reservations(statut)")
    .in("statut", ["ouvert", "confirme"]);

  const hasOpenSlots = (creneaux ?? []).some((c: any) => {
    const cap = c.aeronef?.nb_places_eleves ?? c.places_disponibles ?? 1;
    const active = (c.reservations ?? []).filter((r: any) => r.statut !== "annule").length;
    return active < cap;
  });

  if (hasOpenSlots) {
    return NextResponse.json({ hasSlots: true, emailsSent: 0 });
  }

  // 2. Find all parents waiting — child has payment + attestation, no active reservation, vol not done
  const { data: eleves } = await supabase
    .from("eleves")
    .select(`
      id, prenom, nom, parent_email, parent_prenom, etablissement_id,
      paiement_effectue, attestation_signee, vol1_effectue,
      reservations(id, statut)
    `)
    .eq("archive", false)
    .eq("paiement_effectue", true)
    .eq("attestation_signee", true)
    .eq("vol1_effectue", false);

  const waitingParents: { email: string; prenom: string; eleve_prenom: string; eleve_nom: string; eleve_id: string }[] = [];

  for (const e of eleves ?? []) {
    if (!e.parent_email) continue;
    const hasActiveRes = (e.reservations ?? []).some(
      (r: any) => r.statut !== "annule",
    );
    if (hasActiveRes) continue;
    waitingParents.push({
      email: e.parent_email,
      prenom: e.parent_prenom || "",
      eleve_prenom: e.prenom,
      eleve_nom: e.nom,
      eleve_id: e.id,
    });
  }

  if (waitingParents.length === 0) {
    return NextResponse.json({ hasSlots: false, emailsSent: 0 });
  }

  // 3. Send no_slots_available email (fire-and-forget to /api/email)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bia-manager-acba.vercel.app";
  const res = await fetch(`${appUrl}/api/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "no_slots_available", parents: waitingParents }),
  }).catch(() => null);

  return NextResponse.json({ hasSlots: false, emailsSent: waitingParents.length, ok: res?.ok });
}
