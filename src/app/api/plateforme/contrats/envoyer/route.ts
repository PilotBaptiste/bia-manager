import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { JOURS_VALIDITE_LIEN, nouveauToken } from "@/lib/signatureContrat";
import { TYPES_CONTRAT } from "@/lib/contrats";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * POST /api/plateforme/contrats/envoyer { id, email }
 * Ouvre un lien de signature et l'envoie au représentant du club.
 * Renvoyer la demande régénère un lien neuf : l'ancien cesse de fonctionner.
 */
export async function POST(req: Request) {
  const auth = await requireRole(["proprietaire"], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!id) return NextResponse.json({ error: "Contrat manquant" }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });

  const db = createServiceClient();
  const { data: contrat } = await db
    .from("contrats")
    .select("*, organisation:organisations(nom)")
    .eq("id", id)
    .maybeSingle();
  if (!contrat) return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  if (contrat.statut === "signe") {
    return NextResponse.json({ error: "Ce contrat est déjà signé" }, { status: 409 });
  }

  const token = nouveauToken();
  const expire = new Date(Date.now() + JOURS_VALIDITE_LIEN * 24 * 3600 * 1000).toISOString();

  const { error: majErr } = await db
    .from("contrats")
    .update({
      signature_token: token,
      token_expire_le: expire,
      signataire_email: email,
      statut: "envoye",
      envoye_le: new Date().toISOString(),
      // Un nouvel envoi remet le compteur de tentatives à zéro.
      code_empreinte: null,
      code_expire_le: null,
      code_tentatives: 0,
    })
    .eq("id", id);
  if (majErr) return NextResponse.json({ error: majErr.message }, { status: 400 });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const lien = `${base}/contrat/${token}`;
  const typeLabel = TYPES_CONTRAT.find((t) => t.valeur === contrat.type)?.label ?? "Contrat";
  const nomClub = contrat.club_raison_sociale || contrat.organisation?.nom || "votre aéroclub";

  if (!process.env.RESEND_API_KEY) {
    // Sans service d'envoi configuré, on rend le lien pour un envoi manuel
    // plutôt que de laisser croire que l'email est parti.
    return NextResponse.json({ ok: true, lien, email_envoye: false });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "BIA Manager <noreply@bia-manager-acba.vercel.app>",
      to: email,
      subject: `${typeLabel} — signature demandée`,
      html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff">
        <div style="margin-bottom:24px">
          <span style="background:#1b3a5c;color:#fff;padding:6px 14px;border-radius:8px;font-weight:700;font-size:14px">BIA Manager</span>
        </div>
        <h2 style="margin:0 0 8px;font-size:22px;color:#111">${esc(typeLabel)}</h2>
        <p style="color:#555;margin:0 0 20px">
          Bonjour,<br /><br />
          Le contrat concernant <strong>${esc(nomClub)}</strong> est prêt à être signé. Vous pourrez le lire
          entièrement avant de vous engager.
        </p>
        <p style="color:#555;margin:0 0 20px">
          Pour signer, un code à 6 chiffres vous sera envoyé à cette même adresse : c'est lui qui atteste que
          la signature vient bien de vous.
        </p>
        <a href="${lien}" style="display:inline-block;background:#1b3a5c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
          Lire et signer le contrat →
        </a>
        <p style="color:#aaa;font-size:12px;margin-top:24px">
          Ce lien est personnel et valable ${JOURS_VALIDITE_LIEN} jours. Si vous n'êtes pas concerné par cette
          demande, ignorez ce message.
        </p>
      </div>`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Envoi impossible : ${e?.message ?? "erreur"}`, lien }, { status: 502 });
  }

  return NextResponse.json({ ok: true, lien, email_envoye: true });
}
