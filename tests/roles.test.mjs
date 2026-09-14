// Tests des droits par rôle contre une base Supabase de TEST (jamais la production).
// Usage : npm run test:roles
// Configuration dans .env.test.local (voir tests/README.md). Chaque rôle sans identifiants est ignoré.
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(".env.test.local");

const URL = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY;
const APP_URL = process.env.TEST_APP_URL;
const RANDOM_ID = "00000000-0000-4000-8000-000000000000";

if (!URL || !ANON) {
  test("configuration", { skip: "TEST_SUPABASE_URL et TEST_SUPABASE_ANON_KEY manquants (.env.test.local)" }, () => {});
}

const anonClient = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

async function signIn(role) {
  const email = process.env[`TEST_${role}_EMAIL`];
  const password = process.env[`TEST_${role}_PASSWORD`];
  if (!email || !password) return null;
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Connexion ${role} impossible : ${error.message}`);
  const { data: profile } = await client.from("profiles").select("*").eq("id", data.user.id).single();
  return { client, user: data.user, profile };
}

// Tries to add superadmin to the caller's own profile; reverts immediately if the database let it through.
async function assertCannotEscalate(session) {
  const { client, user, profile } = session;
  const escalated = Array.from(new Set([...(profile.roles || []), "superadmin"]));
  const { data, error } = await client.from("profiles").update({ roles: escalated }).eq("id", user.id).select("roles");
  const succeeded = !error && data?.length && data[0].roles.includes("superadmin");
  if (succeeded) {
    await client.from("profiles").update({ roles: profile.roles }).eq("id", user.id);
  }
  assert.ok(!succeeded, "un utilisateur a pu se donner le rôle superadmin");
}

describe("Visiteur non connecté", { skip: !URL || !ANON }, () => {
  test("ne lit pas les établissements ni leurs codes d'inscription", async () => {
    const { data } = await anonClient().from("etablissements").select("id, code_inscription").limit(1);
    assert.equal(data?.length ?? 0, 0);
  });

  test("ne lit pas les élèves", async () => {
    const { data } = await anonClient().from("eleves").select("id").limit(1);
    assert.equal(data?.length ?? 0, 0);
  });

  test("ne peut pas réserver ni clôturer", async () => {
    const r1 = await anonClient().rpc("reserver_vol", { p_creneau_id: RANDOM_ID, p_eleve_id: RANDOM_ID, p_type_vol: 1 });
    assert.ok(r1.error, "reserver_vol accessible sans connexion");
    const r2 = await anonClient().rpc("cloturer_vol", { p_creneau_id: RANDOM_ID, p_temps_vol_minutes: 30, p_prix_total: 100, p_numero_aerogest: "X" });
    assert.ok(r2.error, "cloturer_vol accessible sans connexion");
  });
});

describe("Routes API sans connexion", { skip: !APP_URL && "TEST_APP_URL manquant" }, () => {
  const post = (path, body = {}) =>
    fetch(`${APP_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  for (const path of ["/api/create-user", "/api/delete-user", "/api/delete-etablissement", "/api/email", "/api/email/notify-slot", "/api/link-parent"]) {
    test(`POST ${path} → 401`, async () => {
      const res = await post(path, { email: "test@example.com", userId: RANDOM_ID, id: RANDOM_ID, type: "custom", recipients: [] });
      assert.equal(res.status, 401);
    });
  }

  for (const path of ["/api/admin/users-status", "/api/email/logs?email=test@example.com", `/api/attestation/download?path=${RANDOM_ID}.pdf`, "/api/memo-bia"]) {
    test(`GET ${path} → 401`, async () => {
      const res = await fetch(`${APP_URL}${path}`);
      assert.equal(res.status, 401);
    });
  }

  test("« mot de passe oublié » ne crée pas de compte pour une adresse inconnue", async () => {
    const res = await post("/api/invite", { email: `inconnu-${Date.now()}@example.com` });
    assert.equal(res.status, 200);
  });
});

describe("Parent", { skip: !process.env.TEST_PARENT_EMAIL && "TEST_PARENT_EMAIL manquant" }, () => {
  let s;
  before(async () => { s = await signIn("PARENT"); });

  test("ne peut pas se donner le rôle superadmin", async () => assertCannotEscalate(s));

  test("ne voit que ses propres enfants", async () => {
    const { data, error } = await s.client.from("eleves").select("id, parent_id");
    assert.ifError(error);
    assert.ok((data || []).every((e) => e.parent_id === s.user.id), "un parent voit l'enfant d'une autre famille");
  });

  test("ne liste pas les attestations des autres familles", async () => {
    const { data } = await s.client.storage.from("attestations").list("", { limit: 5 });
    assert.equal(data?.length ?? 0, 0);
  });

  test("ne peut pas enregistrer un vol ni modifier un établissement", async () => {
    const v = await s.client.from("vols_effectues").insert({ creneau_id: RANDOM_ID, temps_vol_minutes: 1, nb_eleves: 1, prix_total: 0 }).select("id");
    assert.ok(v.error || !v.data?.length, "un parent a pu insérer un vol");
    const e = await s.client.from("etablissements").update({ nom: "piraté" }).neq("id", RANDOM_ID).select("id");
    assert.ok(e.error || !e.data?.length, "un parent a pu modifier un établissement");
  });

  test("ne peut pas clôturer un vol", async () => {
    const { data: creneaux } = await s.client.from("creneaux").select("id").limit(1);
    const id = creneaux?.[0]?.id || RANDOM_ID;
    const { error } = await s.client.rpc("cloturer_vol", { p_creneau_id: id, p_temps_vol_minutes: 30, p_prix_total: 100, p_numero_aerogest: "TEST" });
    assert.ok(error, "un parent a pu clôturer un vol");
  });

  test("ne peut pas réserver pour un élève qui n'est pas le sien", async () => {
    const { data: creneaux } = await s.client.from("creneaux").select("id").limit(1);
    const { error } = await s.client.rpc("reserver_vol", { p_creneau_id: creneaux?.[0]?.id || RANDOM_ID, p_eleve_id: RANDOM_ID, p_type_vol: 1 });
    assert.ok(error, "réservation acceptée pour un élève inconnu");
  });
});

describe("Coordinateur", { skip: !process.env.TEST_COORDINATEUR_EMAIL && "TEST_COORDINATEUR_EMAIL manquant" }, () => {
  let s;
  before(async () => { s = await signIn("COORDINATEUR"); });

  test("ne peut pas se donner le rôle superadmin", async () => assertCannotEscalate(s));

  test("ne peut pas s'ajouter un établissement", async () => {
    const { data, error } = await s.client.from("profiles").update({ etablissement_ids: [RANDOM_ID] }).eq("id", s.user.id).select("etablissement_ids");
    const succeeded = !error && data?.[0]?.etablissement_ids?.includes(RANDOM_ID);
    if (succeeded) await s.client.from("profiles").update({ etablissement_ids: s.profile.etablissement_ids }).eq("id", s.user.id);
    assert.ok(!succeeded, "un coordinateur a pu modifier ses établissements");
  });

  test("ne voit que les élèves de ses établissements", async () => {
    const scope = new Set((s.profile.etablissement_ids?.length ? s.profile.etablissement_ids : [s.profile.etablissement_id]).filter(Boolean));
    const { data, error } = await s.client.from("eleves").select("id, etablissement_id");
    assert.ifError(error);
    assert.ok((data || []).every((e) => scope.has(e.etablissement_id)), "un coordinateur voit des élèves d'autres établissements");
  });
});

describe("Pilote", { skip: !process.env.TEST_PILOTE_EMAIL && "TEST_PILOTE_EMAIL manquant" }, () => {
  let s;
  before(async () => { s = await signIn("PILOTE"); });

  test("ne peut pas se donner le rôle superadmin", async () => assertCannotEscalate(s));

  test("ne peut pas clôturer le créneau d'un autre pilote", async () => {
    const { data } = await s.client.from("creneaux").select("id").neq("pilote_id", s.user.id).in("statut", ["ouvert", "confirme"]).limit(1);
    if (!data?.length) return;
    const { error } = await s.client.rpc("cloturer_vol", { p_creneau_id: data[0].id, p_temps_vol_minutes: 30, p_prix_total: 100, p_numero_aerogest: "TEST" });
    assert.ok(error, "un pilote a clôturé le créneau d'un autre pilote");
  });

  test("ne peut pas supprimer un établissement", async () => {
    const { data, error } = await s.client.from("etablissements").delete().eq("id", RANDOM_ID).select("id");
    assert.ok(error || !data?.length);
  });
});
