import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import { editeur } from "@/lib/legalServeur";
import { titreContrat, sousTitre, parties, corpsContrat } from "@/lib/contratContenu";
import { pdfContrat, type Preuve, type SignatureRendue } from "@/lib/contratPdf";
import { empreinte, nouvelIdSignature } from "@/lib/signatureContrat";
import { TYPES_CONTRAT } from "@/lib/contrats";

// Un contrat n'est signé que lorsque les deux parties l'ont signé. C'est à ce
// moment-là, et à ce moment-là seulement, que le PDF définitif est produit,
// archivé et envoyé.

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Empreinte de ce qui est convenu : le texte du contrat et l'identité des
 * parties, sans les métadonnées de signature. Deux signatures du même contrat
 * donnent donc la même empreinte.
 */
export async function empreinteContrat(contrat: any, nomClub: string) {
  const e = await editeur();
  return empreinte(
    JSON.stringify({
      titre: titreContrat(contrat),
      sous: sousTitre(contrat),
      parties: parties(contrat, nomClub, e),
      corps: corpsContrat(contrat),
    }),
  );
}

/**
 * Si les deux signatures sont là, produit le PDF, l'archive et l'envoie.
 * Renvoie `null` tant qu'il manque une partie.
 */
export async function finaliserSiComplet(contratId: string): Promise<{ reference: string } | null> {
  const db = createServiceClient();
  const { data: contrat } = await db
    .from("contrats")
    .select("*, organisation:organisations(nom)")
    .eq("id", contratId)
    .maybeSingle();
  if (!contrat) return null;
  if (!contrat.signature_club_le || !contrat.signature_editeur_le) return null;
  if (contrat.document_path && contrat.statut === "signe") {
    return { reference: contrat.signature_id };
  }

  const e = await editeur();
  const nomClub = contrat.organisation?.nom ?? "";
  const reference = contrat.signature_id || nouvelIdSignature();
  const emp = await empreinteContrat(contrat, nomClub);

  const signatures: SignatureRendue[] = [
    {
      role: "Pour l'Éditeur",
      nom: contrat.signature_editeur_nom || e.directeur || e.nom,
      image: contrat.signature_editeur_image,
      le: contrat.signature_editeur_le,
    },
    {
      role: "Pour l'Aéroclub",
      nom: contrat.signature_nom || contrat.club_representant || "",
      image: contrat.signature_club_image,
      le: contrat.signature_club_le,
    },
  ];

  const preuve: Preuve = {
    signatureId: reference,
    empreinte: emp,
    club: {
      nom: contrat.signature_nom || contrat.club_representant || "",
      email: contrat.signature_email || contrat.signataire_email || "",
      ip: contrat.signature_ip || "inconnue",
      horodatage: contrat.signature_club_le,
    },
    editeur: {
      nom: contrat.signature_editeur_nom || e.directeur || e.nom,
      horodatage: contrat.signature_editeur_le,
    },
  };

  const pdf = await pdfContrat(contrat, nomClub, e, { signatures, preuve });
  const chemin = `${contrat.organisation_id}/${contrat.type}-${reference}.pdf`;
  const { error: upErr } = await db.storage
    .from("contrats")
    .upload(chemin, pdf, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(`Archivage impossible : ${upErr.message}`);

  await db
    .from("contrats")
    .update({
      statut: "signe",
      signature_id: reference,
      signe_le: String(contrat.signature_club_le).slice(0, 10),
      document_empreinte: emp,
      document_path: chemin,
      // Le lien et le code ont servi : ils ne doivent plus rien ouvrir.
      signature_token: null,
      token_expire_le: null,
      code_empreinte: null,
      code_expire_le: null,
    })
    .eq("id", contratId);

  // Les deux parties reçoivent le même exemplaire, en PDF.
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const typeLabel = TYPES_CONTRAT.find((t) => t.valeur === contrat.type)?.label ?? "Contrat";
    const destinataires = [contrat.signature_email || contrat.signataire_email, e.email].filter(Boolean) as string[];
    const corps = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
      <div style="margin-bottom:24px">
        <span style="background:#1b3a5c;color:#fff;padding:6px 14px;border-radius:8px;font-weight:700;font-size:14px">BIA Manager</span>
      </div>
      <h2 style="margin:0 0 8px;font-size:20px;color:#111">${esc(typeLabel)} — signé</h2>
      <p style="color:#555">
        Le contrat concernant <strong>${esc(contrat.club_raison_sociale || nomClub)}</strong> est signé par les deux
        parties.
      </p>
      <p style="color:#555;margin:0 0 4px">
        Pour l'Aéroclub : <strong>${esc(preuve.club.nom)}</strong><br />
        Pour l'Éditeur : <strong>${esc(preuve.editeur.nom)}</strong>
      </p>
      <p style="color:#555">Référence : <strong>${esc(reference)}</strong></p>
      <p style="color:#777;font-size:12px">L'exemplaire signé est joint à ce message, au format PDF. Conservez-le.</p>
    </div>`;
    const piece = {
      filename: `contrat-${reference}.pdf`,
      content: Buffer.from(pdf).toString("base64"),
    };
    for (const to of destinataires) {
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM ?? "BIA Manager <noreply@bia-manager-acba.vercel.app>",
          to,
          subject: `Contrat signé — ${reference}`,
          html: corps,
          attachments: [piece],
        });
      } catch {
        /* Un envoi raté ne doit pas annuler une signature valide. */
      }
    }
  }

  return { reference };
}
