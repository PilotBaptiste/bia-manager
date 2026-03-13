import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { email, nom, prenom } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "email obligatoire" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://bia-manager-acba.vercel.app";

  const redirectTo = `${appUrl}/auth/callback?next=/auth/set-password`;

  // Try recovery first (existing auth user), fall back to invite (creates the account)
  let linkData: any = null;
  let linkError: any = null;

  const recovery = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (recovery.error) {
    // User doesn't have an auth account yet — create it via invite
    const invite = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });
    linkData = invite.data;
    linkError = invite.error;
  } else {
    linkData = recovery.data;
  }

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 400 });
  }

  const resetLink = linkData.properties.action_link;
  const displayName = nom && prenom ? `${prenom} ${nom}` : email;

  // Send via Resend — no rate limit issues
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from:
        process.env.RESEND_FROM ??
        "BIA Manager <noreply@bia-manager-acba.vercel.app>",
      to: email,
      subject: "Accès BIA Manager — Définissez votre mot de passe",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff">
          <div style="margin-bottom:24px">
            <span style="background:#1b3a5c;color:#fff;padding:6px 14px;border-radius:8px;font-weight:700;font-size:14px">BIA Manager</span>
          </div>
          <h2 style="margin:0 0 8px;font-size:22px;color:#111">Bonjour ${displayName},</h2>
          <p style="color:#555;margin:0 0 24px">
            Vous avez été invité(e) sur la plateforme BIA Manager de l'Aéro-Club du Bassin d'Arcachon.
            Cliquez sur le bouton ci-dessous pour définir votre mot de passe et accéder à votre espace.
          </p>
          <a href="${resetLink}" style="display:inline-block;background:#1b3a5c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
            Définir mon mot de passe →
          </a>
          <p style="color:#aaa;font-size:12px;margin-top:24px">Ce lien est valable 24 heures. Si vous n'avez pas demandé cet accès, ignorez cet email.</p>
        </div>
      `,
    });
  } else {
    // Fallback: let Supabase send it (dev without Resend configured)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/callback?next=/auth/set-password`,
    });
  }

  return NextResponse.json({ success: true });
}
