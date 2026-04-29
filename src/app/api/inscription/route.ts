import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

// GET — validate a code and return the établissement info (public)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.toUpperCase().trim();
  if (!code) return NextResponse.json({ error: "Code manquant" }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: etab } = await supabase
    .from("etablissements")
    .select("id, nom, ville, code_inscription, nb_eleves_attendus, actif")
    .eq("code_inscription", code)
    .eq("actif", true)
    .single();

  if (!etab) {
    return NextResponse.json({ error: "Code invalide ou établissement inactif" }, { status: 404 });
  }

  // Compte uniquement les élèves inscrits via le code (parent_id non null)
  // pour l'année active — exclut les élèves saisis manuellement par l'admin
  const { data: annee } = await supabase
    .from("annees").select("id").eq("active", true).single();

  let inscritCount = 0;
  if (annee) {
    const { count } = await supabase
      .from("eleves")
      .select("*", { count: "exact", head: true })
      .eq("etablissement_id", etab.id)
      .eq("annee_id", annee.id)
      .not("parent_id", "is", null); // uniquement les inscriptions via code
    inscritCount = count ?? 0;
  }

  const limit = etab.nb_eleves_attendus ?? 0;
  const isFull = limit > 0 && inscritCount >= limit;

  return NextResponse.json({
    etab: { id: etab.id, nom: etab.nom, ville: etab.ville },
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
  if (!enfants?.length) {
    return NextResponse.json({ error: "Au moins un enfant requis" }, { status: 400 });
  }
  if (parent.password.length < 8) {
    return NextResponse.json({ error: "Mot de passe trop court (8 caractères minimum)" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1. Validate code
  const { data: etab } = await supabase
    .from("etablissements")
    .select("id, nom, nb_eleves_attendus, actif")
    .eq("code_inscription", code.toUpperCase().trim())
    .eq("actif", true)
    .single();

  if (!etab) {
    return NextResponse.json({ error: "Code invalide ou établissement inactif" }, { status: 404 });
  }

  // 2. Get active year
  const { data: annee } = await supabase
    .from("annees").select("id, label").eq("active", true).single();

  // 3. Check student limit — uniquement les inscrits via code (parent_id non null)
  // Les élèves saisis manuellement par l'admin ne comptent pas dans le quota
  if (etab.nb_eleves_attendus && etab.nb_eleves_attendus > 0 && annee) {
    const { count } = await supabase
      .from("eleves")
      .select("*", { count: "exact", head: true })
      .eq("etablissement_id", etab.id)
      .eq("annee_id", annee.id)
      .not("parent_id", "is", null); // uniquement inscriptions via code

    if ((count ?? 0) + enfants.length > etab.nb_eleves_attendus) {
      return NextResponse.json({
        error: `Limite d'inscriptions atteinte pour ${etab.nom} (${etab.nb_eleves_attendus} places)`,
      }, { status: 409 });
    }
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
  await supabase.from("profiles").update({
    nom: parent.nom.trim(),
    prenom: parent.prenom.trim(),
    telephone: parent.telephone?.trim() || null,
    roles: ["parent"],
  }).eq("id", userId);

  // 6. Create eleves
  const elevesPayload = enfants.map((e: any) => ({
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bia-manager-acba.vercel.app";
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const enfantsHtml = enfants
      .map((e: any) => `<li>${e.prenom} ${e.nom}</li>`)
      .join("");

    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "BIA Manager <noreply@bia-manager-acba.vercel.app>",
      to: parent.email.trim().toLowerCase(),
      subject: `Inscription BIA confirmée — ${etab.nom}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff">
          <div style="margin-bottom:24px">
            <span style="background:#1b3a5c;color:#fff;padding:6px 14px;border-radius:8px;font-weight:700;font-size:14px">BIA Manager</span>
          </div>
          <h2 style="margin:0 0 8px;font-size:22px;color:#111">Inscription confirmée !</h2>
          <p style="color:#555;margin:0 0 16px">
            Bonjour ${parent.prenom} ${parent.nom},<br>
            votre inscription au BIA ${annee?.label ?? ""} pour <strong>${etab.nom}</strong> a bien été enregistrée.
          </p>
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px;margin-bottom:20px">
            <p style="margin:0 0 8px;font-size:13px;color:#0369a1;font-weight:600">Enfant(s) inscrit(s)</p>
            <ul style="margin:0;padding-left:18px;color:#1e40af">${enfantsHtml}</ul>
          </div>
          <p style="color:#555;margin:0 0 16px">
            Connectez-vous à votre espace parent pour suivre l'avancement du BIA, signer l'attestation parentale et réserver les vols.
          </p>
          <a href="${appUrl}/auth/connexion" style="display:inline-block;background:#1b3a5c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
            Accéder à mon espace →
          </a>
          <p style="color:#aaa;font-size:12px;margin-top:24px">
            Identifiant : ${parent.email.trim().toLowerCase()}<br>
            Établissement : ${etab.nom}
          </p>
        </div>
      `,
    });
  }

  return NextResponse.json({ success: true });
}
