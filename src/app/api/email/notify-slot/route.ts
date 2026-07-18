import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * POST /api/email/notify-slot
 * Called when a new créneau is created OR manually via "Notifier" button.
 *
 * Sends to TWO groups (same slot can be used for Vol 1 or Vol 2):
 *   - Vol 1 eligible: paiement + attestation + vol1 non effectué + pas de résa vol1 active + non abandonné
 *   - Vol 2 eligible: vol2_autorise (= a le BIA) + vol1 effectué + pas de résa vol2 active + non abandonné
 *
 * Anti-spam: Only sends if there were NO other open slots for the same scope before this one.
 * Pass `force: true` to bypass anti-spam (manual "Notifier" button).
 *
 * Scoping (priority order):
 *   1. eleves_autorises (array of eleve IDs) → only those specific students' parents
 *   2. etablissement_ids (array) → parents from all those établissements
 *   3. etablissement_id (single) → parents from that établissement
 *   4. none → all eligible parents
 *
 * Body: { creneau_id, etablissement_id?, etablissement_ids?, eleves_autorises?, force?,
 *         date_vol, heure_debut, heure_fin, pilote_nom, aeronef }
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
  const {
    creneau_id,
    etablissement_id,
    etablissement_ids,
    eleves_autorises,
    date_vol,
    heure_debut,
    heure_fin,
    pilote_nom,
    aeronef,
    force = false,
    reminder = false,
  } = body;

  const isTargeted = eleves_autorises && eleves_autorises.length > 0;
  const hasMultiEtabs = etablissement_ids && etablissement_ids.length > 0;
  const hasSingleEtab = !hasMultiEtabs && !!etablissement_id;

  // Anti-spam: skip Vol 1 notifications if open slots already exist for this scope
  // Vol 2 notifications are NEVER blocked by anti-spam (different eligible group)
  let antiSpamBlocksVol1 = false;
  if (!force && !isTargeted) {
    let countQuery = supabase
      .from("creneaux")
      .select("id", { count: "exact", head: true })
      .eq("statut", "ouvert");
    if (creneau_id) countQuery = countQuery.neq("id", creneau_id);
    if (hasMultiEtabs) {
      countQuery = countQuery.overlaps("etablissement_ids", etablissement_ids);
    } else if (hasSingleEtab) {
      countQuery = countQuery.eq("etablissement_id", etablissement_id);
    } else {
      countQuery = countQuery.is("etablissement_id", null);
    }
    const { count: existingCount } = await countQuery;
    if (existingCount && existingCount > 0) {
      antiSpamBlocksVol1 = true;
    }
  }

  // Helper: apply scope filter to a query
  function applyScope(query: any) {
    if (isTargeted) return query.in("id", eleves_autorises);
    if (hasMultiEtabs) return query.in("etablissement_id", etablissement_ids);
    if (hasSingleEtab) return query.eq("etablissement_id", etablissement_id);
    return query; // all
  }

  // ── Vol 1 eligible ──────────────────────────────────
  const today = new Date().toISOString().split("T")[0];

  // Récupérer la date d'examen BIA de l'année en cours
  const { data: biaParam } = await supabase
    .from("parametres")
    .select("valeur")
    .eq("cle", "date_examen_bia")
    .maybeSingle();
  const biaExamDate: string = biaParam?.valeur || "";

  const { data: elevesVol1 } = await applyScope(
    supabase
      .from("eleves")
      .select("id, prenom, nom, parent_email, parent_prenom, etablissement_id, bia_resultat, reservations(id, statut, type_vol)")
      .eq("archive", false)
      .eq("abandonne", false)
      .eq("paiement_effectue", true)
      .eq("attestation_signee", true)
      .eq("vol1_effectue", false)
      .not("parent_email", "is", null)
  );

  const vol1Eligible = (elevesVol1 ?? []).filter((e: any) => {
    // Non admis : BIA échoué, plus éligibles
    if (e.bia_resultat === "Non admis") return false;
    // Date BIA de l'année passée : plus éligibles pour Vol 1
    if (biaExamDate && biaExamDate < today) return false;
    const activeVol1 = (e.reservations ?? []).some(
      (r: any) => r.type_vol === 1 && r.statut !== "annule",
    );
    return !activeVol1;
  });

  // ── Vol 2 eligible ──────────────────────────────────
  // vol2_autorise = true means they have BIA (Admis or Mention)
  const { data: elevesVol2 } = await applyScope(
    supabase
      .from("eleves")
      .select("id, prenom, nom, parent_email, parent_prenom, etablissement_id, reservations(id, statut, type_vol)")
      .eq("archive", false)
      .eq("abandonne", false)
      .eq("vol2_autorise", true)
      .or("vol1_effectue.eq.true,vol1_skippe.eq.true")
      .eq("vol2_effectue", false)
      .not("parent_email", "is", null)
  );

  const vol2Eligible = (elevesVol2 ?? []).filter((e: any) => {
    const activeVol2 = (e.reservations ?? []).some(
      (r: any) => r.type_vol === 2 && r.statut !== "annule",
    );
    return !activeVol2;
  });

  // ── Merge, deduplicate per email+élève ──────────────
  // Si anti-spam bloque Vol 1, on n'envoie qu'aux éligibles Vol 2
  const elevesCibles = antiSpamBlocksVol1
    ? vol2Eligible
    : [...vol1Eligible, ...vol2Eligible];

  const seen = new Set<string>();
  const parents: { email: string; prenom: string; eleve_prenom: string; eleve_nom: string; eleve_id: string }[] = [];

  for (const e of elevesCibles) {
    if (!e.parent_email) continue;
    const key = `${e.parent_email}|${e.id}`; // per parent+élève (a parent can have 2 kids)
    if (seen.has(key)) continue;
    seen.add(key);
    parents.push({
      email: e.parent_email,
      prenom: e.parent_prenom || "",
      eleve_prenom: e.prenom,
      eleve_nom: e.nom,
      eleve_id: e.id,
    });
  }

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
      type: reminder ? "slot_reminder" : "slot_available",
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
