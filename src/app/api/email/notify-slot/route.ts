import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

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
export const maxDuration = 120;

export async function POST(req: Request) {
  const auth = await requireRole(["superadmin", "pilote", "coordinateur", "gerant"]);
  if (auth instanceof NextResponse) return auth;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ skipped: true });
  }

  const orgId = auth.orgId!;
  const supabase = createServiceClient();

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
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  let antiSpamBlocksVol1 = false;
  if (!force && !isTargeted) {
    let countQuery = supabase
      .from("creneaux")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", orgId)
      .eq("statut", "ouvert")
      .gte("date_vol", today);
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

  const [{ data: activeAnnee }, { data: activeEtabs }] = await Promise.all([
    supabase.from("annees").select("id, date_examen_bia").eq("organisation_id", orgId).eq("active", true).maybeSingle(),
    supabase.from("etablissements").select("id").eq("organisation_id", orgId).eq("actif", true),
  ]);
  const activeEtabIds = new Set((activeEtabs ?? []).map((e: any) => e.id));
  const inScope = (e: any) => activeEtabIds.has(e.etablissement_id);
  function applyYear(query: any) {
    return activeAnnee?.id ? query.eq("annee_id", activeAnnee.id) : query;
  }

  // ── Vol 1 eligible ──────────────────────────────────

  const biaExamDate: string = activeAnnee?.date_examen_bia || "";

  const { data: elevesVol1 } = await applyYear(applyScope(
    supabase
      .from("eleves")
      .select("id, prenom, nom, parent_email, parent_prenom, etablissement_id, bia_resultat, reservations(id, statut, type_vol)")
      .eq("organisation_id", orgId)
      .eq("archive", false)
      .eq("abandonne", false)
      .eq("paiement_effectue", true)
      .eq("attestation_signee", true)
      .eq("vol1_effectue", false)
      .eq("vol1_skippe", false)
      .not("parent_email", "is", null)
  ));

  const vol1Eligible = (elevesVol1 ?? []).filter((e: any) => {
    if (!inScope(e)) return false;
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
  const { data: elevesVol2 } = await applyYear(applyScope(
    supabase
      .from("eleves")
      .select("id, prenom, nom, parent_email, parent_prenom, etablissement_id, reservations(id, statut, type_vol)")
      .eq("organisation_id", orgId)
      .eq("archive", false)
      .eq("abandonne", false)
      .eq("vol2_autorise", true)
      .or("vol1_effectue.eq.true,vol1_skippe.eq.true")
      .eq("vol2_effectue", false)
      .not("parent_email", "is", null)
  ));

  const vol2Eligible = (elevesVol2 ?? []).filter((e: any) => {
    if (!inScope(e)) return false;
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
    const key = `${e.parent_email.toLowerCase()}|${e.id}`; // per parent+élève (a parent can have 2 kids)
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

  const res = await fetch(new URL("/api/email", req.url), {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") ?? "" },
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

  if (!res?.ok) {
    return NextResponse.json({ error: "Échec de l'envoi des notifications", sent: 0 }, { status: 502 });
  }
  const result = await res.json().catch(() => ({}));
  return NextResponse.json({ sent: result.sent ?? parents.length, ok: true });
}
