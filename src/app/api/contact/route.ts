import { NextResponse } from "next/server";
import { Resend } from "resend";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

// Public contact form of the showcase site: forwards the request to CONTACT_EMAIL.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  // Honeypot field invisible to humans: bots filling it get a silent success.
  if (clip(body.website, 200)) return NextResponse.json({ ok: true });

  const nom = clip(body.nom, 120);
  const aeroclub = clip(body.aeroclub, 160);
  const email = clip(body.email, 200).toLowerCase();
  const telephone = clip(body.telephone, 40);
  const message = clip(body.message, 3000);

  if (!nom || !aeroclub || !EMAIL_RE.test(email) || message.length < 10) {
    return NextResponse.json({ error: "Merci de renseigner votre nom, votre aéroclub, un email valide et un message." }, { status: 400 });
  }
  // CONTACT_EMAIL may list several recipients separated by commas.
  const recipients = (process.env.CONTACT_EMAIL || "").split(",").map((r) => r.trim()).filter((r) => EMAIL_RE.test(r));
  if (!process.env.RESEND_API_KEY || recipients.length === 0) {
    return NextResponse.json({ error: "Le formulaire est momentanément indisponible. Réessayez plus tard." }, { status: 503 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? "BIA Manager <noreply@biamanager.com>",
    to: recipients,
    replyTo: email,
    subject: `Demande de contact — ${aeroclub}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 16px;color:#1b3a5c">Nouvelle demande depuis biamanager.com</h2>
        <p style="margin:0 0 6px"><strong>Nom :</strong> ${esc(nom)}</p>
        <p style="margin:0 0 6px"><strong>Aéroclub :</strong> ${esc(aeroclub)}</p>
        <p style="margin:0 0 6px"><strong>Email :</strong> ${esc(email)}</p>
        ${telephone ? `<p style="margin:0 0 6px"><strong>Téléphone :</strong> ${esc(telephone)}</p>` : ""}
        <p style="margin:16px 0 6px"><strong>Message :</strong></p>
        <p style="margin:0;white-space:pre-wrap;color:#374151">${esc(message)}</p>
      </div>`,
  });
  if (error) {
    return NextResponse.json({ error: "L'envoi a échoué. Réessayez dans quelques minutes." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
