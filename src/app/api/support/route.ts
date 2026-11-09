import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireRole } from "@/lib/auth";
import { getOrgById } from "@/lib/org";
import { getClubInfo } from "@/lib/club";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

const RESPONSABLES = ["superadmin", "coordinateur", "gerant"];
const URGENCES: Record<string, { label: string; prefixe: string }> = {
  normale: { label: "Question ou demande d'évolution", prefixe: "" },
  haute: { label: "Problème gênant mais contournable", prefixe: "[Important] " },
  bloquante: { label: "Blocage : le club ne peut plus travailler", prefixe: "[BLOQUANT] " },
};

/**
 * POST /api/support
 * Un responsable de club écrit à l'équipe BIA Manager.
 * L'identité et le club viennent de la session, jamais du navigateur.
 */
export async function POST(req: Request) {
  const auth = await requireRole(RESPONSABLES);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const sujet = clip(body.sujet, 160);
  const message = clip(body.message, 5000);
  const urgence = URGENCES[clip(body.urgence, 20)] ?? URGENCES.normale;

  if (!sujet || message.length < 10) {
    return NextResponse.json({ error: "Merci d'indiquer un sujet et un message d'au moins 10 caractères." }, { status: 400 });
  }
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_EMAIL) {
    return NextResponse.json({ error: "L'envoi est momentanément indisponible. Écrivez-nous directement par email." }, { status: 503 });
  }

  const [org, club] = await Promise.all([
    auth.orgId ? getOrgById(auth.orgId) : Promise.resolve(null),
    auth.orgId ? getClubInfo(auth.orgId) : Promise.resolve(null),
  ]);
  const clubNom = club?.nom ?? org?.nom ?? "Club inconnu";
  const demandeur = `${auth.profile?.prenom ?? ""} ${auth.profile?.nom ?? ""}`.trim() || (auth.email ?? "—");

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? "BIA Manager <noreply@biamanager.com>",
    to: process.env.CONTACT_EMAIL.split(",").map((a) => a.trim()).filter(Boolean),
    replyTo: auth.email ?? undefined,
    subject: `${urgence.prefixe}${clubNom} — ${sujet}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 16px;color:#1b3a5c">Demande de support d'un club</h2>
        <p style="margin:0 0 6px"><strong>Club :</strong> ${esc(clubNom)}${org?.slug ? ` (${esc(org.slug)})` : ""}</p>
        <p style="margin:0 0 6px"><strong>Demandeur :</strong> ${esc(demandeur)}</p>
        <p style="margin:0 0 6px"><strong>Email :</strong> ${esc(auth.email ?? "—")}</p>
        <p style="margin:0 0 6px"><strong>Rôles :</strong> ${esc(auth.roles.join(", "))}</p>
        <p style="margin:0 0 6px"><strong>Niveau :</strong> ${esc(urgence.label)}</p>
        <p style="margin:16px 0 6px"><strong>Sujet :</strong> ${esc(sujet)}</p>
        <p style="margin:0;white-space:pre-wrap;color:#374151">${esc(message)}</p>
      </div>`,
  });
  if (error) {
    return NextResponse.json({ error: "L'envoi a échoué. Réessayez dans quelques minutes." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
