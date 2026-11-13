import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

// Création des comptes parents sans aucun email.
// Volontairement muette : le mot de passe tiré ici n'est communiqué à personne et n'est jamais
// renvoyé au navigateur. Les familles reçoivent leur lien d'accès uniquement via le bouton
// « Inviter les parents » de Utilisateurs et rôles (/api/invite).
export const runtime = "nodejs";
export const maxDuration = 60;

const LOT_MAX = 50;
// Adresse volontairement stricte : les valeurs servent aussi à bâtir un filtre .or() Postgrest.
const EMAIL_OK = /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

function motDePasse(len = 24) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  const octets = new Uint8Array(len);
  crypto.getRandomValues(octets);
  return Array.from(octets, (o) => chars[o % chars.length]).join("");
}

type Entree = { email: string; nom: string; prenom: string; telephone: string };

export async function POST(req: Request) {
  const auth = await requireRole(["superadmin"]);
  if (auth instanceof NextResponse) return auth;
  const orgId = auth.orgId!;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquant dans les variables d'environnement" }, { status: 500 });
  }

  let brut: unknown;
  try {
    brut = (await req.json())?.parents;
  } catch {
    return NextResponse.json({ error: "Requête illisible" }, { status: 400 });
  }
  if (!Array.isArray(brut)) return NextResponse.json({ error: "parents doit être une liste" }, { status: 400 });
  if (brut.length > LOT_MAX) return NextResponse.json({ error: `${LOT_MAX} parents maximum par appel` }, { status: 400 });

  const vus = new Set<string>();
  const erreurs0: { email: string; message: string }[] = [];
  const parents: Entree[] = [];
  for (const p of brut as Record<string, unknown>[]) {
    const email = String(p?.email ?? "").trim().toLowerCase();
    if (!email || vus.has(email)) continue;
    if (!EMAIL_OK.test(email)) { erreurs0.push({ email, message: "adresse invalide" }); continue; }
    vus.add(email);
    parents.push({
      email,
      nom: String(p?.nom ?? "").trim(),
      prenom: String(p?.prenom ?? "").trim(),
      telephone: String(p?.telephone ?? "").trim(),
    });
  }
  if (parents.length === 0) return NextResponse.json({ crees: 0, existants: 0, lies: 0, erreurs: erreurs0 });

  const supabase = createServiceClient();
  const erreurs = erreurs0;

  // Comptes déjà présents, tous clubs confondus : une adresse appartenant à un autre club est refusée.
  const { data: profils, error: errProfils } = await supabase
    .from("profiles")
    .select("id, email, organisation_id, roles")
    .or(parents.map((p) => `email.ilike.${p.email}`).join(","));
  if (errProfils) return NextResponse.json({ error: errProfils.message }, { status: 400 });

  const connus = new Map<string, { id: string; organisation_id: string | null; roles: string[] | null }>();
  for (const pr of profils || []) {
    const key = String(pr.email ?? "").trim().toLowerCase();
    if (key) connus.set(key, { id: pr.id, organisation_id: pr.organisation_id, roles: pr.roles });
  }

  let crees = 0;
  let existants = 0;
  const aCompleter: { id: string; p: Entree }[] = [];

  for (const p of parents) {
    const connu = connus.get(p.email);
    if (connu) {
      if (connu.organisation_id && connu.organisation_id !== orgId) {
        erreurs.push({ email: p.email, message: "adresse déjà utilisée par un autre aéroclub" });
        continue;
      }
      existants++;
      const roles = connu.roles || [];
      const maj: Record<string, unknown> = {};
      if (!connu.organisation_id) maj.organisation_id = orgId;
      if (!roles.includes("parent")) maj.roles = [...roles, "parent"];
      if (Object.keys(maj).length > 0) {
        const { error } = await supabase.from("profiles").update(maj).eq("id", connu.id);
        if (error) erreurs.push({ email: p.email, message: error.message });
      }
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: p.email,
      password: motDePasse(),
      email_confirm: true,
      user_metadata: { nom: p.nom, prenom: p.prenom },
    });
    if (error || !data?.user) {
      erreurs.push({ email: p.email, message: error?.message || "création impossible" });
      continue;
    }
    crees++;
    aCompleter.push({ id: data.user.id, p });
  }

  // Le profil est créé par un trigger : on laisse passer un instant avant de le compléter.
  if (aCompleter.length > 0) {
    await new Promise((r) => setTimeout(r, 1200));
    for (const { id, p } of aCompleter) {
      const { error } = await supabase
        .from("profiles")
        .update({
          organisation_id: orgId,
          nom: p.nom || "",
          prenom: p.prenom || "",
          telephone: p.telephone || null,
          roles: ["parent"],
        })
        .eq("id", id);
      if (error) erreurs.push({ email: p.email, message: `compte créé mais profil incomplet : ${error.message}` });
    }
  }

  // Rattachement aux élèves du club dont l'adresse correspond, sans jamais réassigner un lien existant.
  let lies = 0;
  for (const p of parents) {
    const [r1, r2] = await Promise.all([
      supabase.from("eleves").select("id").eq("organisation_id", orgId).ilike("parent_email", p.email).is("parent_id", null),
      supabase.from("eleves").select("id").eq("organisation_id", orgId).ilike("parent2_email", p.email).is("parent2_id", null),
    ]);
    const idsParent = (r1.data || []).map((e) => e.id);
    const idsParent2 = (r2.data || []).map((e) => e.id);
    if (idsParent.length === 0 && idsParent2.length === 0) continue;

    const { data: prof } = await supabase.from("profiles").select("id").ilike("email", p.email).limit(1).maybeSingle();
    if (!prof) continue;
    if (idsParent.length > 0) {
      const { error } = await supabase.from("eleves").update({ parent_id: prof.id }).in("id", idsParent);
      if (error) erreurs.push({ email: p.email, message: `rattachement impossible : ${error.message}` });
      else lies += idsParent.length;
    }
    if (idsParent2.length > 0) {
      const { error } = await supabase.from("eleves").update({ parent2_id: prof.id }).in("id", idsParent2);
      if (error) erreurs.push({ email: p.email, message: `rattachement impossible : ${error.message}` });
      else lies += idsParent2.length;
    }
  }

  return NextResponse.json({ crees, existants, lies, erreurs });
}
