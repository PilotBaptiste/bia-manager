import { Resend } from "resend";
import { isDemoAddress } from "@/lib/demo";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getClubInfo, DEFAULT_CLUB_NOM } from "@/lib/club";
import { getOrgById } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/server";
import { clubUrl } from "@/lib/tenant";

const ALLOWED_ROLES = ["superadmin", "coordinateur", "pilote", "gerant", "parent"];
const escHtml = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function generatePassword(len = 12) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length: len }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

export async function POST(req: Request) {
  const auth = await requireRole(["superadmin"]);
  if (auth instanceof NextResponse) return auth;

  const orgId = auth.orgId!;

  const { email, nom, prenom, telephone, roles, etablissement_id, etablissement_ids } =
    await req.json();

  if (!email || !nom || !prenom) {
    return NextResponse.json(
      { error: "email, nom et prenom obligatoires" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, organisation_id")
    .ilike("email", String(email).trim())
    .limit(1);
  if (existing?.[0]?.organisation_id && existing[0].organisation_id !== orgId) {
    return NextResponse.json(
      { error: "Cette adresse est déjà utilisée par un autre aéroclub" },
      { status: 409 },
    );
  }

  const etabIds: string[] = Array.isArray(etablissement_ids) ? etablissement_ids.filter(Boolean) : [];
  const toCheck = [...new Set([...(etablissement_id ? [etablissement_id] : []), ...etabIds])];
  if (toCheck.length > 0) {
    const { data: etabs } = await supabase
      .from("etablissements")
      .select("id")
      .eq("organisation_id", orgId)
      .in("id", toCheck);
    if ((etabs?.length ?? 0) !== toCheck.length) {
      return NextResponse.json({ error: "Établissement introuvable" }, { status: 400 });
    }
  }

  const password = generatePassword();

  // Create user with a real password — no magic link needed
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nom, prenom },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Give the DB trigger time to create the profile row
  await new Promise((r) => setTimeout(r, 800));

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      organisation_id: orgId,
      nom,
      prenom,
      telephone: telephone || null,
      roles: (Array.isArray(roles) ? roles : []).filter((r: string) => ALLOWED_ROLES.includes(r)),
      etablissement_id: etablissement_id || null,
      etablissement_ids: etabIds.length > 0 ? etabIds : null,
    })
    .eq("id", data.user.id);

  if (profileError) {
    await supabase.from("profiles").delete().eq("id", data.user.id);
    await supabase.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  // Send credentials email
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const [club, org] = await Promise.all([getClubInfo(orgId), getOrgById(orgId)]);
    const loginUrl = org
      ? clubUrl(org.slug, "/auth/connexion", new URL(req.url).origin)
      : `${process.env.NEXT_PUBLIC_APP_URL ?? "https://bia-manager-acba.vercel.app"}/auth/connexion`;
    const clubNom = club.nom !== DEFAULT_CLUB_NOM ? club.nom : "";
    const clubLabel = club.sigle || clubNom;

    if (!isDemoAddress(email)) await resend.emails.send({
      from: process.env.RESEND_FROM ?? "BIA Manager <noreply@bia-manager-acba.vercel.app>",
      to: email,
      subject: clubLabel ? `Votre accès BIA Manager — ${clubLabel}` : "Votre accès BIA Manager",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff">
          <div style="margin-bottom:24px">
            <span style="background:#1b3a5c;color:#fff;padding:6px 14px;border-radius:8px;font-weight:700;font-size:14px">BIA Manager</span>
          </div>
          <h2 style="margin:0 0 8px;font-size:22px;color:#111">Bonjour ${escHtml(prenom)} ${escHtml(nom)},</h2>
          <p style="color:#555;margin:0 0 24px">Votre compte a été créé sur la plateforme BIA Manager${clubNom ? ` — ${escHtml(clubNom)}` : ""}.</p>
          <div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:24px">
            <p style="margin:0 0 10px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Vos identifiants</p>
            <p style="margin:0 0 6px;font-size:15px;color:#111"><strong>Email :</strong> ${escHtml(email)}</p>
            <p style="margin:0;font-size:15px;color:#111"><strong>Mot de passe :</strong> <span style="font-family:monospace;background:#e8ecf0;padding:2px 8px;border-radius:4px">${password}</span></p>
          </div>
          <a href="${loginUrl}" style="display:inline-block;background:#1b3a5c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
            Se connecter →
          </a>
          <p style="color:#aaa;font-size:12px;margin-top:24px">Nous vous recommandons de changer votre mot de passe après votre première connexion.</p>
        </div>
      `,
    });
  }

  return NextResponse.json({ userId: data.user.id });
}
