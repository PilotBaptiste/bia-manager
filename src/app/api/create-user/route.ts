import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

function generatePassword(len = 12) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length: len }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

export async function POST(req: Request) {
  const { email, nom, prenom, telephone, roles, etablissement_id } =
    await req.json();

  if (!email || !nom || !prenom) {
    return NextResponse.json(
      { error: "email, nom et prenom obligatoires" },
      { status: 400 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

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

  await supabase
    .from("profiles")
    .update({
      nom,
      prenom,
      telephone: telephone || null,
      roles: roles ?? [],
      etablissement_id: etablissement_id || null,
    })
    .eq("id", data.user.id);

  // Send credentials email
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bia-manager-acba.vercel.app";

    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "BIA Manager <noreply@bia-manager-acba.vercel.app>",
      to: email,
      subject: "Votre accès BIA Manager — ACBA",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff">
          <div style="margin-bottom:24px">
            <span style="background:#1b3a5c;color:#fff;padding:6px 14px;border-radius:8px;font-weight:700;font-size:14px">BIA Manager</span>
          </div>
          <h2 style="margin:0 0 8px;font-size:22px;color:#111">Bonjour ${prenom} ${nom},</h2>
          <p style="color:#555;margin:0 0 24px">Votre compte a été créé sur la plateforme BIA Manager de l'Aéro-Club du Bassin d'Arcachon.</p>
          <div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:24px">
            <p style="margin:0 0 10px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Vos identifiants</p>
            <p style="margin:0 0 6px;font-size:15px;color:#111"><strong>Email :</strong> ${email}</p>
            <p style="margin:0;font-size:15px;color:#111"><strong>Mot de passe :</strong> <span style="font-family:monospace;background:#e8ecf0;padding:2px 8px;border-radius:4px">${password}</span></p>
          </div>
          <a href="${appUrl}/auth/connexion" style="display:inline-block;background:#1b3a5c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
            Se connecter →
          </a>
          <p style="color:#aaa;font-size:12px;margin-top:24px">Nous vous recommandons de changer votre mot de passe après votre première connexion.</p>
        </div>
      `,
    });
  }

  return NextResponse.json({ userId: data.user.id });
}
