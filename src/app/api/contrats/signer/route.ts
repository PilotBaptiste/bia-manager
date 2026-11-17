import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import { documentContrat } from "@/lib/contrats";
import { editeur } from "@/lib/legalServeur";
import {
  MINUTES_VALIDITE_CODE,
  TENTATIVES_MAX,
  blocPreuve,
  codeValide,
  empreinte,
  estExpire,
  ipDe,
  nouveauCode,
  nouvelIdSignature,
} from "@/lib/signatureContrat";

// Signature d'un contrat par le représentant d'un aéroclub, qui n'a pas de
// compte : tout passe par le jeton de l'URL, vérifié ici avec le client de
// service. Aucune politique RLS n'est relâchée pour autant.

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Masque une adresse pour l'afficher sans la divulguer : j••••e@exemple.fr */
function masquer(email: string) {
  const [avant, apres] = email.split("@");
  if (!apres) return "votre adresse";
  const visible = avant.length <= 2 ? avant[0] ?? "" : `${avant[0]}${"•".repeat(Math.min(avant.length - 2, 5))}${avant.at(-1)}`;
  return `${visible}@${apres}`;
}

async function parToken(token: string) {
  if (!token) return null;
  const { data } = await createServiceClient()
    .from("contrats")
    .select("*, organisation:organisations(nom)")
    .eq("signature_token", token)
    .maybeSingle();
  return data ?? null;
}

/** GET /api/contrats/signer?token= — le document à lire, et l'état de la demande. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const contrat = await parToken(token);
  if (!contrat) return NextResponse.json({ error: "Lien inconnu ou révoqué" }, { status: 404 });
  if (estExpire(contrat.token_expire_le)) {
    return NextResponse.json({ error: "Ce lien a expiré. Demandez-en un nouveau." }, { status: 410 });
  }

  const e = await editeur();
  const nomClub = contrat.organisation?.nom ?? "";
  const document = documentContrat(contrat as any, nomClub, e);

  return NextResponse.json({
    titre: contrat.type === "sous_traitance" ? "Contrat de sous-traitance" : "Contrat d'abonnement",
    club: contrat.club_raison_sociale || nomClub,
    representant: contrat.club_representant ?? "",
    fonction: contrat.club_fonction ?? "",
    email_masque: masquer(contrat.signataire_email ?? ""),
    deja_signe: contrat.statut === "signe",
    signature: contrat.statut === "signe"
      ? { nom: contrat.signature_nom, le: contrat.signature_horodatage, reference: contrat.signature_id }
      : null,
    code_envoye: !!contrat.code_empreinte && !estExpire(contrat.code_expire_le),
    bloque: (contrat.code_tentatives ?? 0) >= TENTATIVES_MAX,
    document,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body?.token ?? "");
  const action = String(body?.action ?? "");
  const contrat = await parToken(token);
  if (!contrat) return NextResponse.json({ error: "Lien inconnu ou révoqué" }, { status: 404 });
  if (estExpire(contrat.token_expire_le)) {
    return NextResponse.json({ error: "Ce lien a expiré. Demandez-en un nouveau." }, { status: 410 });
  }
  if (contrat.statut === "signe") {
    return NextResponse.json({ error: "Ce contrat est déjà signé" }, { status: 409 });
  }

  const db = createServiceClient();

  // ── Envoi du code à usage unique ──
  if (action === "code") {
    const destinataire = String(contrat.signataire_email ?? "");
    if (!destinataire) return NextResponse.json({ error: "Aucune adresse de signature" }, { status: 400 });

    const code = nouveauCode();
    await db
      .from("contrats")
      .update({
        code_empreinte: empreinte(code),
        code_expire_le: new Date(Date.now() + MINUTES_VALIDITE_CODE * 60_000).toISOString(),
        code_tentatives: 0,
        code_envoye_le: new Date().toISOString(),
      })
      .eq("id", contrat.id);

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "Service d'envoi non configuré" }, { status: 500 });
    }
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.RESEND_FROM ?? "BIA Manager <noreply@bia-manager-acba.vercel.app>",
        to: destinataire,
        subject: `Votre code de signature : ${code}`,
        html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <p style="color:#555;margin:0 0 16px">Votre code de signature :</p>
          <p style="font-size:34px;font-weight:700;letter-spacing:8px;color:#1b3a5c;margin:0 0 16px">${code}</p>
          <p style="color:#777;font-size:13px;margin:0">
            Valable ${MINUTES_VALIDITE_CODE} minutes. Ne le communiquez à personne : il vaut signature.
          </p>
        </div>`,
      });
    } catch (e: any) {
      return NextResponse.json({ error: `Envoi impossible : ${e?.message ?? "erreur"}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true, minutes: MINUTES_VALIDITE_CODE });
  }

  // ── Signature ──
  if (action === "signer") {
    const tentatives = contrat.code_tentatives ?? 0;
    if (tentatives >= TENTATIVES_MAX) {
      return NextResponse.json(
        { error: "Trop d'essais. Demandez un nouveau code." },
        { status: 429 },
      );
    }
    if (estExpire(contrat.code_expire_le)) {
      return NextResponse.json({ error: "Le code a expiré. Demandez-en un nouveau." }, { status: 410 });
    }

    const code = String(body?.code ?? "").trim();
    if (!codeValide(code, contrat.code_empreinte)) {
      await db.from("contrats").update({ code_tentatives: tentatives + 1 }).eq("id", contrat.id);
      const reste = TENTATIVES_MAX - tentatives - 1;
      return NextResponse.json(
        { error: reste > 0 ? `Code incorrect. ${reste} essai${reste > 1 ? "s" : ""} restant${reste > 1 ? "s" : ""}.` : "Code incorrect. Demandez un nouveau code." },
        { status: 400 },
      );
    }

    const nom = String(body?.nom ?? "").trim();
    const attendu = String(contrat.club_representant ?? "").trim();
    if (!nom) return NextResponse.json({ error: "Tapez votre nom pour signer" }, { status: 400 });
    // Le nom tapé doit correspondre à celui du représentant inscrit au contrat.
    if (attendu && nom.toLowerCase() !== attendu.toLowerCase()) {
      return NextResponse.json({ error: `Tapez exactement : ${attendu}` }, { status: 400 });
    }

    const e = await editeur();
    const nomClub = contrat.organisation?.nom ?? "";
    const horodatage = new Date().toISOString();
    const signatureId = nouvelIdSignature();
    const ip = ipDe(req);
    const emailSignataire = String(contrat.signataire_email ?? "");

    // Le document est figé tel qu'il a été montré, avec la signature portée.
    const signe = { ...contrat, statut: "signe", signe_le: horodatage.slice(0, 10), signe_par: nom };
    const document = documentContrat(signe as any, nomClub, e);
    const empreinteDocument = empreinte(document);
    const archive = document.replace(
      "</body>",
      `${blocPreuve({ signatureId, nom, email: emailSignataire, horodatage, ip, empreinteDocument })}</body>`,
    );

    const chemin = `${contrat.organisation_id}/${contrat.type}-${signatureId}.html`;
    const { error: upErr } = await createServiceClient()
      .storage.from("contrats")
      .upload(chemin, new Blob([archive], { type: "text/html; charset=utf-8" }), { upsert: true });
    if (upErr) return NextResponse.json({ error: `Archivage impossible : ${upErr.message}` }, { status: 500 });

    const { error: majErr } = await db
      .from("contrats")
      .update({
        statut: "signe",
        signe_le: horodatage.slice(0, 10),
        signe_par: nom,
        signature_id: signatureId,
        signature_nom: nom,
        signature_email: emailSignataire,
        signature_ip: ip,
        signature_agent: (req.headers.get("user-agent") ?? "").slice(0, 400),
        signature_horodatage: horodatage,
        document_empreinte: empreinteDocument,
        document_path: chemin,
        // Le lien et le code ont servi : ils ne doivent plus rien ouvrir.
        signature_token: null,
        token_expire_le: null,
        code_empreinte: null,
        code_expire_le: null,
      })
      .eq("id", contrat.id);
    if (majErr) return NextResponse.json({ error: majErr.message }, { status: 400 });

    // Copie aux deux parties : le signataire doit garder son exemplaire.
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const destinataires = [emailSignataire, e.email].filter(Boolean) as string[];
      const corps = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;font-size:20px;color:#111">Contrat signé</h2>
        <p style="color:#555">
          Le contrat concernant <strong>${esc(contrat.club_raison_sociale || nomClub)}</strong> a été signé par
          <strong>${esc(nom)}</strong> le ${esc(new Date(horodatage).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }))}.
        </p>
        <p style="color:#555">Référence : <strong>${esc(signatureId)}</strong></p>
        <p style="color:#777;font-size:12px">L'exemplaire signé est joint à ce message.</p>
      </div>`;
      for (const to of destinataires) {
        try {
          await resend.emails.send({
            from: process.env.RESEND_FROM ?? "BIA Manager <noreply@bia-manager-acba.vercel.app>",
            to,
            subject: `Contrat signé — ${signatureId}`,
            html: corps,
            attachments: [
              { filename: `contrat-${signatureId}.html`, content: Buffer.from(archive).toString("base64") },
            ],
          });
        } catch {
          /* L'envoi raté ne doit pas annuler une signature valide. */
        }
      }
    }

    return NextResponse.json({ ok: true, reference: signatureId, horodatage });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
