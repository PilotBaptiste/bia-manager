import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { RESERVED_SLUGS, clubUrl } from "@/lib/tenant";

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,40}[a-z0-9])?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// The template is copied from the owner's current club: its hardcoded club name becomes the {NOM_AEROCLUB} placeholder.
function neutraliserNomClub(template: string) {
  return template.replace(/(de )?l['’]A[eé]ro-?Club du Bassin d['’]Arcachon/gi, (_m, de) => `${de ?? ""}{NOM_AEROCLUB}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── GET : liste des clubs avec leurs chiffres ──────────────────────
export async function GET() {
  const auth = await requireRole(["proprietaire"], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;

  try {
    const db = createServiceClient();
    const [orgsRes, anneesRes, adminsRes, secretsRes] = await Promise.all([
      db.from("organisations").select("*").order("nom"),
      db.from("annees").select("id, label, organisation_id").eq("active", true),
      db.from("profiles").select("id, prenom, nom, email, organisation_id").contains("roles", ["superadmin"]),
      db.from("organisation_secrets").select("organisation_id, sumup_merchant_code"),
    ]);
    const sumupParClub = new Map((secretsRes.data ?? []).filter((s: any) => s.sumup_merchant_code).map((s: any) => [s.organisation_id, s.sumup_merchant_code]));
    if (orgsRes.error) throw orgsRes.error;

    const activeYear = new Map<string, { id: string; label: string }>();
    for (const a of anneesRes.data ?? []) activeYear.set(a.organisation_id, { id: a.id, label: a.label });

    const clubs = await Promise.all(
      (orgsRes.data ?? []).map(async (org) => {
        const annee = activeYear.get(org.id) ?? null;
        // Students of the active year, in active établissements, not archived (same scope as the club dashboard).
        const eleveCount = (extra?: (q: any) => any) => {
          if (!annee) return Promise.resolve({ count: 0 });
          let q: any = db
            .from("eleves")
            .select("id, etablissement:etablissements!inner(actif)", { count: "exact", head: true })
            .eq("organisation_id", org.id)
            .eq("annee_id", annee.id)
            .eq("archive", false)
            .eq("etablissement.actif", true);
          if (extra) q = extra(q);
          return q;
        };
        const [etabs, users, parents, eleves, vol1, vol2, creneauxClotures] = await Promise.all([
          db.from("etablissements").select("id", { count: "exact", head: true }).eq("organisation_id", org.id).eq("actif", true),
          db.from("profiles").select("id", { count: "exact", head: true }).eq("organisation_id", org.id),
          db.from("profiles").select("id", { count: "exact", head: true }).eq("organisation_id", org.id).contains("roles", ["parent"]),
          eleveCount(),
          eleveCount((q) => q.eq("vol1_effectue", true)),
          eleveCount((q) => q.eq("vol2_effectue", true)),
          annee
            ? db
                .from("vols_effectues")
                .select("id, creneaux!inner(annee_id)", { count: "exact", head: true })
                .eq("organisation_id", org.id)
                .eq("creneaux.annee_id", annee.id)
            : Promise.resolve({ count: 0 }),
        ]);
        return {
          ...org,
          modules: Array.isArray((org as any).modules) ? (org as any).modules : [],
          sumupMerchantCode: sumupParClub.get(org.id) ?? null,
          annee: annee?.label ?? null,
          counts: {
            etablissements: etabs.count ?? 0,
            eleves: eleves.count ?? 0,
            users: users.count ?? 0,
            parents: parents.count ?? 0,
            vol1: vol1.count ?? 0,
            vol2: vol2.count ?? 0,
            vols: (vol1.count ?? 0) + (vol2.count ?? 0),
            creneauxClotures: creneauxClotures.count ?? 0,
          },
          admins: (adminsRes.data ?? [])
            .filter((p) => p.organisation_id === org.id)
            .map((p) => ({ prenom: p.prenom, nom: p.nom, email: p.email })),
        };
      }),
    );

    return NextResponse.json({ clubs, currentOrgId: auth.orgId });
  } catch (e: any) {
    return NextResponse.json({ error: `Chargement des clubs impossible : ${e?.message ?? "erreur inconnue"}` }, { status: 500 });
  }
}

// ─── POST : création d'un club ──────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireRole(["proprietaire"], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const nom = String(body.nom ?? "").trim();
  const slug = String(body.slug ?? "").trim().toLowerCase();
  const sigle = String(body.sigle ?? "").trim();
  const adminEmail = String(body.adminEmail ?? "").trim().toLowerCase();
  const adminPrenom = String(body.adminPrenom ?? "").trim();
  const adminNom = String(body.adminNom ?? "").trim();
  const anneeLabel = String(body.anneeLabel ?? "").trim();
  const anneeDebut = String(body.anneeDebut ?? "").trim();
  const anneeFin = String(body.anneeFin ?? "").trim();
  const dateExamenBia = String(body.dateExamenBia ?? "").trim();

  if (!nom) return NextResponse.json({ error: "Le nom de l'aéroclub est obligatoire" }, { status: 400 });
  if (slug.length < 2 || !SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: "Adresse du site invalide : 2 à 42 caractères, lettres minuscules, chiffres et tirets (sans tiret au début ni à la fin)" },
      { status: 400 },
    );
  }
  if (RESERVED_SLUGS.includes(slug)) {
    return NextResponse.json({ error: `L'adresse « ${slug} » est réservée, choisissez-en une autre` }, { status: 400 });
  }
  if (!EMAIL_RE.test(adminEmail)) return NextResponse.json({ error: "Adresse email de l'administrateur invalide" }, { status: 400 });
  if (!anneeLabel) return NextResponse.json({ error: "Le libellé de l'année scolaire est obligatoire" }, { status: 400 });
  if (!DATE_RE.test(anneeDebut) || !DATE_RE.test(anneeFin)) {
    return NextResponse.json({ error: "Dates de début et de fin de l'année scolaire obligatoires" }, { status: 400 });
  }
  if (anneeFin <= anneeDebut) {
    return NextResponse.json({ error: "La fin de l'année scolaire doit être après son début" }, { status: 400 });
  }
  if (dateExamenBia && !DATE_RE.test(dateExamenBia)) {
    return NextResponse.json({ error: "Date d'examen BIA invalide" }, { status: 400 });
  }

  const db = createServiceClient();
  const origin = req.nextUrl.origin;

  const { data: existingSlug } = await db.from("organisations").select("id").eq("slug", slug).maybeSingle();
  if (existingSlug) return NextResponse.json({ error: `L'adresse « ${slug} » est déjà utilisée par un autre aéroclub` }, { status: 409 });

  // Compte admin existant ? Vérifié avant toute écriture pour ne rien créer inutilement.
  const { data: existingProfile } = await db
    .from("profiles")
    .select("id, roles, organisation_id")
    .ilike("email", adminEmail.replace(/[\\%_]/g, "\\$&"))
    .maybeSingle();
  if (existingProfile?.organisation_id) {
    return NextResponse.json({ error: "Cette adresse appartient déjà à un autre aéroclub" }, { status: 409 });
  }

  // 1. Organisation
  const { data: organisation, error: orgError } = await db
    .from("organisations")
    .insert({ nom, slug, actif: true })
    .select("id, slug, nom, actif, created_at")
    .single();
  if (orgError || !organisation) {
    const dup = orgError?.code === "23505";
    return NextResponse.json(
      { error: dup ? `L'adresse « ${slug} » est déjà utilisée par un autre aéroclub` : `Création de l'aéroclub impossible : ${orgError?.message ?? "erreur inconnue"}` },
      { status: dup ? 409 : 500 },
    );
  }
  const orgId = organisation.id;

  let createdUserId: string | null = null;
  const fail = async (message: string, status = 500) => {
    // Nettoyage : on ne laisse pas un club à moitié créé.
    try {
      if (createdUserId) await db.auth.admin.deleteUser(createdUserId);
      await db.from("annees").delete().eq("organisation_id", orgId);
      await db.from("parametres").delete().eq("organisation_id", orgId);
      await db.from("organisations").delete().eq("id", orgId);
    } catch (e) {
      console.error("plateforme/clubs cleanup:", e);
    }
    return NextResponse.json({ error: message }, { status });
  };

  try {
    // 2. Paramètres
    const copied: Record<string, { valeur: string; description: string | null }> = {};
    if (auth.orgId) {
      const { data: source } = await db
        .from("parametres")
        .select("cle, valeur, description")
        .eq("organisation_id", auth.orgId)
        .in("cle", ["prix_inscription", "subvention_federation", "duree_cible_vols", "template_attestation"]);
      for (const p of source ?? []) copied[p.cle] = { valeur: p.valeur, description: p.description };
    }
    const reglages: { cle: string; valeur: string; description: string }[] = [
      { cle: "prix_inscription", valeur: copied.prix_inscription?.valeur ?? "80", description: copied.prix_inscription?.description || "Prix inscription élève (€) pour le premier vol" },
      { cle: "subvention_federation", valeur: copied.subvention_federation?.valeur ?? "50", description: copied.subvention_federation?.description || "Subvention fédération par BIA réussi (€)" },
      { cle: "duree_cible_vols", valeur: copied.duree_cible_vols?.valeur ?? "60", description: copied.duree_cible_vols?.description || "Durée cible totale des 2 vols (minutes)" },
    ];
    if (copied.template_attestation) {
      reglages.push({ cle: "template_attestation", valeur: neutraliserNomClub(copied.template_attestation.valeur), description: copied.template_attestation.description || "Template de l'attestation parentale" });
    }
    reglages.push(
      { cle: "nom_aeroclub", valeur: nom, description: "Nom complet de l'aéroclub" },
      { cle: "sigle_aeroclub", valeur: sigle, description: "Sigle affiché dans le menu et les emails" },
      { cle: "email_aeroclub", valeur: "", description: "Email de contact de l'aéroclub" },
      { cle: "telephone_aeroclub", valeur: "", description: "Téléphone de l'aéroclub" },
      { cle: "lieu_vol", valeur: "", description: "Lieu des vols (une information par ligne)" },
      { cle: "whatsapp_support", valeur: "", description: "Numéro WhatsApp du support, format international sans +" },
      { cle: "telephone_support", valeur: "", description: "Numéro du support affiché" },
    );
    const { error: paramError } = await db
      .from("parametres")
      .insert(reglages.map((r) => ({ ...r, organisation_id: orgId })));
    if (paramError) return fail(`Création des paramètres impossible : ${paramError.message}`);

    // 3. Année scolaire active
    const { error: anneeError } = await db.from("annees").insert({
      label: anneeLabel,
      date_debut: anneeDebut,
      date_fin: anneeFin,
      active: true,
      date_examen_bia: dateExamenBia || null,
      organisation_id: orgId,
    });
    if (anneeError) return fail(`Création de l'année scolaire impossible : ${anneeError.message}`);

    // 4. Compte administrateur
    let userId: string | null = existingProfile?.id ?? null;
    let actionLink: string;
    let isNewAccount = false;

    const magicLink = async () => {
      const { data, error } = await db.auth.admin.generateLink({
        type: "magiclink",
        email: adminEmail,
        options: { redirectTo: clubUrl(slug, "/auth/callback?next=/dashboard", origin) },
      });
      return { link: data?.properties?.action_link ?? null, user: data?.user ?? null, error };
    };

    if (userId) {
      const m = await magicLink();
      actionLink = m.link ?? clubUrl(slug, "/auth/connexion", origin);
    } else {
      const { data, error } = await db.auth.admin.generateLink({
        type: "invite",
        email: adminEmail,
        options: {
          redirectTo: clubUrl(slug, "/auth/callback?next=/auth/set-password", origin),
          data: { prenom: adminPrenom, nom: adminNom },
        },
      });
      if (!error && data?.user) {
        userId = data.user.id;
        createdUserId = data.user.id;
        isNewAccount = true;
        actionLink = data.properties.action_link;
      } else {
        // Compte d'authentification déjà présent sans profil visible : on le rattache.
        const m = await magicLink();
        if (!m.user) return fail(`Création du compte administrateur impossible : ${error?.message ?? m.error?.message ?? "erreur inconnue"}`);
        userId = m.user.id;
        actionLink = m.link ?? clubUrl(slug, "/auth/connexion", origin);
      }
    }

    let profile: { id: string; roles: string[] | null; organisation_id: string | null } | null = null;
    for (let attempt = 0; attempt < 4 && !profile; attempt++) {
      if (attempt > 0 || isNewAccount) await sleep(800);
      const { data } = await db.from("profiles").select("id, roles, organisation_id").eq("id", userId).maybeSingle();
      profile = data;
    }
    if (!profile) return fail("Le profil de l'administrateur n'a pas été créé, réessayez dans quelques instants");
    if (profile.organisation_id && profile.organisation_id !== orgId) {
      createdUserId = null; // compte préexistant : ne jamais le supprimer
      return fail("Cette adresse appartient déjà à un autre aéroclub", 409);
    }

    const roles = Array.from(new Set([...(profile.roles ?? []).filter((r) => r !== "parent" || !isNewAccount), "superadmin"]));
    const update: Record<string, unknown> = { organisation_id: orgId, roles };
    if (adminPrenom) update.prenom = adminPrenom;
    if (adminNom) update.nom = adminNom;
    const { error: profileError } = await db.from("profiles").update(update).eq("id", userId);
    if (profileError) return fail(`Rattachement de l'administrateur impossible : ${profileError.message}`);

    // 5. Email d'invitation
    const siteUrl = clubUrl(slug, "/", origin);
    const displayName = [adminPrenom, adminNom].filter(Boolean).join(" ") || adminEmail;
    const subject = `BIA Manager — Votre espace ${nom} est prêt`;
    const html = `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff">
          <div style="margin-bottom:24px">
            <span style="background:#1b3a5c;color:#fff;padding:6px 14px;border-radius:8px;font-weight:700;font-size:14px">BIA Manager</span>
          </div>
          <h2 style="margin:0 0 8px;font-size:22px;color:#111">Bonjour ${escHtml(displayName)},</h2>
          <p style="color:#555;margin:0 0 16px">
            L'espace BIA Manager de <strong>${escHtml(nom)}</strong> vient d'être créé et vous en êtes l'administrateur.
            Vous pourrez y gérer les établissements, les élèves, les vols découverte et les finances de votre club.
          </p>
          <p style="color:#555;margin:0 0 24px">
            ${isNewAccount ? "Cliquez sur le bouton ci-dessous pour définir votre mot de passe et accéder à votre espace." : "Cliquez sur le bouton ci-dessous pour accéder à votre espace."}
          </p>
          <a href="${escHtml(actionLink)}" style="display:inline-block;background:#1b3a5c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
            Activer mon accès →
          </a>
          <p style="color:#555;font-size:14px;margin:24px 0 0">
            Adresse de votre site : <a href="${escHtml(siteUrl)}" style="color:#1b3a5c">${escHtml(siteUrl)}</a>
          </p>
          <p style="color:#aaa;font-size:12px;margin-top:24px">Ce lien est valable 24 heures. Passé ce délai, utilisez « Mot de passe oublié » sur la page de connexion.</p>
        </div>
      `;

    let inviteLink: string | undefined;
    let warning: string | undefined;
    if (process.env.RESEND_API_KEY) {
      let statut = "envoye";
      let resendId: string | null = null;
      try {
        const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
          from: process.env.RESEND_FROM ?? "BIA Manager <noreply@bia-manager-acba.vercel.app>",
          to: adminEmail,
          subject,
          html,
        });
        if (result.error) throw new Error(result.error.message);
        resendId = (result.data as any)?.id ?? null;
      } catch (e: any) {
        statut = "erreur";
        inviteLink = actionLink;
        warning = `Le club est créé mais l'email n'a pas pu être envoyé (${e?.message ?? "erreur inconnue"}). Transmettez le lien ci-dessous à l'administrateur.`;
      }
      try {
        await db.from("email_logs").insert({
          type: "invite",
          to_email: adminEmail,
          subject,
          eleve_id: null,
          resend_id: resendId,
          statut,
          organisation_id: orgId,
        });
      } catch { /* journalisation facultative */ }
    } else {
      inviteLink = actionLink;
    }

    return NextResponse.json({ organisation, siteUrl, ...(inviteLink ? { inviteLink } : {}), ...(warning ? { warning } : {}) });
  } catch (e: any) {
    return fail(`Création de l'aéroclub interrompue : ${e?.message ?? "erreur inconnue"}`);
  }
}
