// Test d'isolation entre aéroclubs, sur la vraie base.
// Crée un club temporaire et son admin, tente d'accéder aux données d'un autre club
// (lecture, écriture, fonctions, routes API), puis supprime tout ce qu'il a créé.
// Les tentatives d'écriture réécrivent une valeur identique : même en cas de faille, aucune donnée ne change.
//
// Usage : npm run test:isolation            (club cible par défaut : acba)
//         CLUB_CIBLE=autre-club npm run test:isolation
//         SITE_URL=https://acba.biamanager.com npm run test:isolation   (active les tests des routes API)
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(".env.local");

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CIBLE = process.env.CLUB_CIBLE || "acba";
const SITE = (process.env.SITE_URL || "").replace(/\/$/, "");
if (!URL_ || !ANON || !SERVICE) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont requis");
  process.exit(1);
}

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [];
const check = (nom, ok, detail = "") => {
  results.push({ nom, ok });
  console.log(`${ok ? "✅" : "❌"} ${nom}${detail ? ` — ${detail}` : ""}`);
};

const stamp = `${Date.now()}`;
const testSlug = `test-isolation-${stamp}`;
const testEmail = `test-isolation-${stamp}@biamanager.com`;
const testPassword = randomBytes(18).toString("base64url");
let testOrg = null;
let testUserId = null;

async function cleanup() {
  if (testUserId) await admin.auth.admin.deleteUser(testUserId).catch(() => {});
  if (testUserId) await admin.from("profiles").delete().eq("id", testUserId);
  if (testOrg) await admin.from("organisations").delete().eq("id", testOrg.id);
}

try {
  // ── Préparation ────────────────────────────────────────────────
  const { data: cible, error: cErr } = await admin.from("organisations").select("id, slug, nom").eq("slug", CIBLE).single();
  if (cErr || !cible) throw new Error(`Club cible « ${CIBLE} » introuvable`);

  const pick = async (table, cols = "id") =>
    (await admin.from(table).select(cols).eq("organisation_id", cible.id).limit(1).maybeSingle()).data;
  const [etab, eleve, aeronef, profilCible, eleveAttestation] = await Promise.all([
    pick("etablissements", "id, nom"),
    pick("eleves", "id, nom, parent_email"),
    pick("aeronefs", "id"),
    pick("profiles", "id, email"),
    admin.from("eleves").select("attestation_url").eq("organisation_id", cible.id).not("attestation_url", "is", null).limit(1).maybeSingle().then((r) => r.data),
  ]);

  const { data: org, error: oErr } = await admin.from("organisations").insert({ slug: testSlug, nom: "Club de test isolation" }).select().single();
  if (oErr) throw oErr;
  testOrg = org;

  const { data: created, error: uErr } = await admin.auth.admin.createUser({ email: testEmail, password: testPassword, email_confirm: true });
  if (uErr) throw uErr;
  testUserId = created.user.id;
  for (let i = 0; i < 5; i++) {
    const { data } = await admin.from("profiles").update({ organisation_id: org.id, roles: ["superadmin"], nom: "Test", prenom: "Isolation" }).eq("id", testUserId).select("id");
    if (data?.length) break;
    await new Promise((r) => setTimeout(r, 800));
  }

  const user = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: session, error: sErr } = await user.auth.signInWithPassword({ email: testEmail, password: testPassword });
  if (sErr) throw sErr;
  console.log(`\nAdmin d'un club de test connecté · tentative d'accès aux données de « ${cible.nom} »\n`);

  // ── Lecture ────────────────────────────────────────────────────
  for (const table of ["eleves", "etablissements", "creneaux", "reservations", "vols_effectues", "aeronefs", "parametres", "annees", "email_logs", "subventions", "aeronef_tarifs"]) {
    const { data, error } = await user.from(table).select("organisation_id").eq("organisation_id", cible.id).limit(1);
    check(`Lecture ${table} de l'autre club bloquée`, !error ? (data?.length ?? 0) === 0 : true, error?.message);
  }
  {
    const { data } = await user.from("profiles").select("id").eq("organisation_id", cible.id).limit(1);
    check("Lecture des comptes de l'autre club bloquée", (data?.length ?? 0) === 0);
  }
  {
    const { data } = await user.from("organisations").select("id").eq("id", cible.id);
    check("Lecture de la fiche de l'autre club bloquée", (data?.length ?? 0) === 0);
  }

  // ── Écriture (valeurs identiques : aucun changement possible) ──
  if (etab) {
    const { data, error } = await user.from("etablissements").update({ nom: etab.nom }).eq("id", etab.id).select("id");
    check("Modification d'un établissement de l'autre club bloquée", !!error || (data?.length ?? 0) === 0, error?.message);
  }
  if (etab) {
    const { data, error } = await user.from("eleves").insert({
      nom: "Test", prenom: "Isolation", date_naissance: "2010-01-01", lieu_naissance: "—", etablissement_id: etab.id,
      annee_id: (await pick("annees")).id, parent_nom: "T", parent_prenom: "I", parent_email: testEmail, parent_telephone: "0",
      organisation_id: cible.id,
    }).select("id");
    if (data?.length) await admin.from("eleves").delete().eq("id", data[0].id);
    check("Création d'un élève dans l'autre club bloquée", !!error || (data?.length ?? 0) === 0, error?.message);
  }
  {
    const { data, error } = await user.from("profiles").update({ organisation_id: cible.id }).eq("id", testUserId).select("organisation_id");
    check("Changer son propre club bloqué", !!error || data?.[0]?.organisation_id !== cible.id, error?.message);
  }
  {
    const { data, error } = await user.from("profiles").update({ roles: ["superadmin", "proprietaire"] }).eq("id", testUserId).select("roles");
    check("S'attribuer le rôle propriétaire bloqué", !!error || !data?.[0]?.roles?.includes("proprietaire"), error?.message);
  }
  if (profilCible) {
    const { data, error } = await user.from("profiles").update({ email: profilCible.email }).eq("id", profilCible.id).select("id");
    check("Modification d'un compte de l'autre club bloquée", !!error || (data?.length ?? 0) === 0, error?.message);
  }

  // ── Fonctions SECURITY DEFINER (ignorent la RLS) ─────────────────
  // Only the tariff simulation is exercised: it always rolls back, so a flaw could not persist anything,
  // whereas a real closure or booking on another club's slot would.
  if (aeronef) {
    const { data, error } = await user.rpc("changer_tarif_aeronef", { p_aeronef_id: aeronef.id, p_prix_heure: 1, p_date_effet: "2000-01-01", p_simulation: true });
    check("Tarif d'un avion de l'autre club inaccessible (même en simulation)", !!error || (data?.nb_vols ?? 0) === 0, error?.message);
  }

  // ── Routes API du site ─────────────────────────────────────────
  if (SITE) {
    const ref = new URL(URL_).hostname.split(".")[0];
    const cookieValue = `base64-${Buffer.from(JSON.stringify(session.session)).toString("base64url")}`;
    const headers = { cookie: `sb-${ref}-auth-token=${cookieValue}` };
    const get = (path) => fetch(`${SITE}${path}`, { headers, redirect: "manual" });

    const status = await get("/api/admin/users-status");
    const statusBody = status.ok ? await status.json() : {};
    check("API statuts des comptes : uniquement ceux de son club", status.ok && Object.keys(statusBody).every((id) => id === testUserId), `HTTP ${status.status}`);

    if (eleve?.parent_email) {
      const logs = await get(`/api/email/logs?email=${encodeURIComponent(eleve.parent_email)}`);
      const body = logs.ok ? await logs.json() : { logs: [] };
      check("API historique des emails de l'autre club vide", (body.logs ?? []).length === 0, `HTTP ${logs.status}`);
    }
    if (eleveAttestation?.attestation_url) {
      const dl = await get(`/api/attestation/download?path=${encodeURIComponent(eleveAttestation.attestation_url)}`);
      check("API téléchargement d'une attestation de l'autre club refusé", dl.status === 404 || dl.status === 403, `HTTP ${dl.status}`);
    }
    const plat = await get("/api/plateforme/clubs");
    check("API console propriétaire refusée à un admin de club", plat.status === 403, `HTTP ${plat.status}`);
  } else {
    console.log("\nℹ️  Routes API non testées : relancer avec SITE_URL=https://acba.biamanager.com");
  }
} catch (e) {
  console.error(`\nErreur pendant le test : ${e.message}`);
  results.push({ nom: "exécution", ok: false });
} finally {
  await cleanup();
  const { count } = await admin.from("organisations").select("id", { count: "exact", head: true }).like("slug", "test-isolation-%");
  console.log(`\nNettoyage : club et compte de test supprimés${count ? ` (⚠️ ${count} club(s) de test restant(s))` : ""}.`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n❌ ${failed} test(s) en échec sur ${results.length}` : `\n✅ ${results.length} tests réussis : les clubs sont isolés`);
  process.exit(failed ? 1 : 0);
}
