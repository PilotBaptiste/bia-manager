import { Resend } from "resend";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getClubInfo, DEFAULT_CLUB_NOM } from "@/lib/club";
import { clubUrl } from "@/lib/tenant";

const MAX_ENFANTS = 6;
const escHtml = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The code identifies the établissement, and through it the club; an inactive club accepts no signups.
async function findEtab(supabase: ReturnType<typeof createServiceClient>, code: string) {
  const { data } = await supabase
    .from("etablissements")
    .select("id, nom, ville, nb_eleves_attendus, actif, organisation_id, organisation:organisations(id, slug, nom, actif)")
    .eq("code_inscription", code)
    .eq("actif", true)
    .single();
  const etab: any = data;
  const org = Array.isArray(etab?.organisation) ? etab.organisation[0] : etab?.organisation;
  if (!etab || !org?.actif) return null;
  return { etab, org: org as { id: string; slug: string; nom: string; actif: boolean } };
}

// GET — validate a code and return the établissement info (public)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.toUpperCase().trim();
  if (!code) return NextResponse.json({ error: "Code manquant" }, { status: 400 });

  const supabase = createServiceClient();

  const found = await findEtab(supabase, code);
  if (!found) {
    return NextResponse.json({ error: "Code invalide ou établissement inactif" }, { status: 404 });
  }
  const { etab, org } = found;
  const orgId = org.id;

  // Compte uniquement les élèves inscrits via le code (parent_id non null)
  // pour l'année active — exclut les élèves saisis manuellement par l'admin
  const { data: annee } = await supabase
    .from("annees").select("id").eq("organisation_id", orgId).eq("active", true).single();

  let inscritCount = 0;
  if (annee) {
    const { count } = await supabase
      .from("eleves")
      .select("*", { count: "exact", head: true })
      .eq("organisation_id", orgId)
      .eq("etablissement_id", etab.id)
      .eq("annee_id", annee.id)
      .not("parent_id", "is", null); // uniquement les inscriptions via code
    inscritCount = count ?? 0;
  }

  const limit = etab.nb_eleves_attendus ?? 0;
  const isFull = limit > 0 && inscritCount >= limit;
  const club = await getClubInfo(orgId);

  return NextResponse.json({
    etab: { id: etab.id, nom: etab.nom, ville: etab.ville },
    club: { nom: club.nom !== DEFAULT_CLUB_NOM ? club.nom : org.nom, slug: org.slug },
    inscritCount,
    limit,
    isFull,
  });
}

// POST — create user + profile + eleves
export async function POST(req: Request) {
  const { code, parent, enfants } = await req.json();

  if (!code || !parent?.email || !parent?.password || !parent?.nom || !parent?.prenom) {
    return NextResponse.json({ error: "Données parent incomplètes" }, { status: 400 });
  }
  if (!Array.isArray(enfants) || !enfants.length) {
    return NextResponse.json({ error: "Au moins un enfant requis" }, { status: 400 });
  }
  if (enfants.length > MAX_ENFANTS) {
    return NextResponse.json({ error: `${MAX_ENFANTS} enfants maximum par inscription` }, { status: 400 });
  }
  if (enfants.some((e: any) => typeof e?.nom !== "string" || typeof e?.prenom !== "string" || !e.nom.trim() || !e.prenom.trim())) {
    return NextResponse.json({ error: "Nom et prénom obligatoires pour chaque enfant" }, { status: 400 });
  }
  if (parent.password.length < 8) {
    return NextResponse.json({ error: "Mot de passe trop court (8 caractères minimum)" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 1. Validate code
  const found = await findEtab(supabase, String(code).toUpperCase().trim());
  if (!found) {
    return NextResponse.json({ error: "Code invalide ou établissement inactif" }, { status: 404 });
  }
  const { etab, org } = found;
  const orgId = org.id;

  // 2. Get active year
  const { data: annee } = await supabase
    .from("annees").select("id, label").eq("organisation_id", orgId).eq("active", true).single();

  // 3. Check student limit — uniquement les inscrits via code (parent_id non null)
  // Les élèves saisis manuellement par l'admin ne comptent pas dans le quota
  if (etab.nb_eleves_attendus && etab.nb_eleves_attendus > 0 && annee) {
    const { count } = await supabase
      .from("eleves")
      .select("*", { count: "exact", head: true })
      .eq("organisation_id", orgId)
      .eq("etablissement_id", etab.id)
      .eq("annee_id", annee.id)
      .not("parent_id", "is", null); // uniquement inscriptions via code

    if ((count ?? 0) + enfants.length > etab.nb_eleves_attendus) {
      return NextResponse.json({
        error: `Limite d'inscriptions atteinte pour ${etab.nom} (${etab.nb_eleves_attendus} places)`,
      }, { status: 409 });
    }
  }

  // An address already known on existing student files must prove ownership through an emailed link,
  // otherwise anyone could sign up with a parent's address and get access to their children.
  const parentEmail = parent.email.trim().toLowerCase();
  const { data: existingDossier } = await supabase
    .from("eleves")
    .select("id")
    .eq("organisation_id", orgId)
    .ilike("parent_email", parentEmail)
    .limit(1);
  if (existingDossier?.length) {
    return NextResponse.json({
      error: "Cette adresse email est déjà enregistrée. Utilisez « Mot de passe oublié » sur la page de connexion pour recevoir votre lien d'accès.",
    }, { status: 409 });
  }

  // 4. Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: parent.email.trim().toLowerCase(),
    password: parent.password,
    email_confirm: true,
    user_metadata: { nom: parent.nom, prenom: parent.prenom },
  });

  if (authError) {
    const msg = authError.message.includes("already registered")
      ? "Cette adresse email est déjà utilisée"
      : authError.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const userId = authData.user.id;

  // 5. Update profile (DB trigger creates it; wait briefly)
  await new Promise((r) => setTimeout(r, 600));
  const { error: profileError } = await supabase.from("profiles").update({
    organisation_id: orgId,
    nom: parent.nom.trim(),
    prenom: parent.prenom.trim(),
    telephone: parent.telephone?.trim() || null,
    roles: ["parent"],
  }).eq("id", userId);
  if (profileError) {
    await supabase.from("profiles").delete().eq("id", userId);
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: `Erreur création du compte: ${profileError.message}` }, { status: 500 });
  }

  // 6. Create eleves
  const elevesPayload = enfants.map((e: any) => ({
    organisation_id: orgId,
    nom: e.nom.trim(),
    prenom: e.prenom.trim(),
    date_naissance: e.date_naissance || null,
    lieu_naissance: e.lieu_naissance?.trim() || "—",
    classe: e.classe?.trim() || "—",
    etablissement_id: etab.id,
    annee_id: annee?.id || null,
    parent_email: parent.email.trim().toLowerCase(),
    parent_nom: parent.nom.trim(),
    parent_prenom: parent.prenom.trim(),
    parent_telephone: parent.telephone?.trim() || null,
    parent_id: userId,
    archive: false,
  }));

  const { error: elevesError } = await supabase.from("eleves").insert(elevesPayload);
  if (elevesError) {
    // Cleanup: delete auth user if eleves creation failed
    await supabase.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: `Erreur création élèves: ${elevesError.message}` }, { status: 500 });
  }

  // 7. Send welcome email
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const club = await getClubInfo(orgId);
    const clubNom = club.nom !== DEFAULT_CLUB_NOM ? club.nom : org.nom;
    const loginUrl = clubUrl(org.slug, "/auth/connexion", new URL(req.url).origin);
    const enfantsHtml = enfants
      .map((e: any) => `<li>${escHtml(e.prenom)} ${escHtml(e.nom)}</li>`)
      .join("");

    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "BIA Manager <noreply@bia-manager-acba.vercel.app>",
      to: parent.email.trim().toLowerCase(),
      subject: `Inscription BIA confirmée — ${etab.nom}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff">
          <div style="margin-bottom:24px">
            <span style="background:#1b3a5c;color:#fff;padding:6px 14px;border-radius:8px;font-weight:700;font-size:14px">BIA Manager</span>
            ${clubNom ? `<span style="color:#64748b;font-size:13px;margin-left:8px">${escHtml(clubNom)}</span>` : ""}
          </div>
          <h2 style="margin:0 0 8px;font-size:22px;color:#111">Inscription confirmée !</h2>
          <p style="color:#555;margin:0 0 16px">
            Bonjour ${escHtml(parent.prenom)} ${escHtml(parent.nom)},<br>
            votre inscription au BIA ${annee?.label ?? ""} pour <strong>${escHtml(etab.nom)}</strong> a bien été enregistrée.
          </p>
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px;margin-bottom:20px">
            <p style="margin:0 0 8px;font-size:13px;color:#0369a1;font-weight:600">Enfant(s) inscrit(s)</p>
            <ul style="margin:0;padding-left:18px;color:#1e40af">${enfantsHtml}</ul>
          </div>
          <p style="color:#555;margin:0 0 16px">
            Connectez-vous à votre espace parent pour suivre l'avancement du BIA, signer l'attestation parentale et réserver les vols.
          </p>
          <a href="${loginUrl}" style="display:inline-block;background:#1b3a5c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
            Accéder à mon espace →
          </a>
          <p style="color:#aaa;font-size:12px;margin-top:24px">
            Identifiant : ${escHtml(parentEmail)}<br>
            Établissement : ${escHtml(etab.nom)}
          </p>
        </div>
      `,
    });
  }

  return NextResponse.json({ success: true });
}
