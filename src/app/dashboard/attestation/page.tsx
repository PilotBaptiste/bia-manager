"use client";
import { useState, useEffect } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  FileSignature,
  Loader2,
  Check,
  Download,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const DEFAULT_TEMPLATE = `Je soussigne(e) {PARENT_NOM}, parent/responsable legal de {ELEVE_PRENOM} {ELEVE_NOM}, ne(e) le {ELEVE_DATE_NAISSANCE} a {ELEVE_LIEU_NAISSANCE}, autorise mon enfant a effectuer un vol decouverte au sein de l'Aero-Club du Bassin d'Arcachon dans le cadre du Brevet d'Initiation Aeronautique (BIA).

Je declare avoir pris connaissance des conditions de vol et des mesures de securite en vigueur.

Fait a {LIEU_SIGNATURE}, le {DATE_SIGNATURE}`;

export default function AttestationPage() {

  const supabase = createClient();
  const [enfants, setEnfants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [lieu, setLieu] = useState("");
  const [nomSaisi, setNomSaisi] = useState("");
  const [certifie, setCertifie] = useState(false);

  async function loadData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const [eR, tR] = await Promise.all([
      supabase
        .from("eleves")
        .select("*, etablissement:etablissements(nom)")
        .eq("parent_id", user.id)
        .eq("archive", false),
      supabase
        .from("parametres")
        .select("valeur")
        .eq("cle", "template_attestation")
        .single(),
    ]);
    setEnfants(eR.data || []);
    if (tR.data) setTemplate(tR.data.valeur);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function fillTemplate(t: string, enfant: any, lieuVal?: string) {
    const now = new Date().toLocaleDateString("fr-FR");
    return t
      .replace(/{PARENT_NOM}/g, `${enfant.parent_prenom} ${enfant.parent_nom}`)
      .replace(/{PARENT_PRENOM}/g, enfant.parent_prenom)
      .replace(/{PARENT_NOM_FAMILLE}/g, enfant.parent_nom)
      .replace(/{ELEVE_PRENOM}/g, enfant.prenom)
      .replace(/{ELEVE_NOM}/g, enfant.nom)
      .replace(
        /{ELEVE_DATE_NAISSANCE}/g,
        new Date(enfant.date_naissance).toLocaleDateString("fr-FR"),
      )
      .replace(/{ELEVE_LIEU_NAISSANCE}/g, enfant.lieu_naissance)
      .replace(/{ETABLISSEMENT}/g, enfant.etablissement?.nom || "")
      .replace(/{LIEU_SIGNATURE}/g, lieuVal || lieu || "________________")
      .replace(/{DATE_SIGNATURE}/g, now)
      .replace(/{ANNEE}/g, new Date().getFullYear().toString());
  }

  function generateSignatureId() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let id = "SIG-";
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) id += "-";
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  async function generatePDF(enfant: any) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const { width, height } = page.getSize();
    const signatureId = generateSignatureId();
    const signDate = new Date();
    const dateStr = signDate.toLocaleDateString("fr-FR");
    const timeStr = signDate.toLocaleTimeString("fr-FR");

    // --- Header ---
    page.drawRectangle({
      x: 0,
      y: height - 100,
      width,
      height: 100,
      color: rgb(0.106, 0.227, 0.361),
    });
    page.drawText("ATTESTATION PARENTALE", {
      x: 50,
      y: height - 45,
      size: 20,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText(
      "Aero-Club du Bassin d'Arcachon - BIA " + signDate.getFullYear(),
      { x: 50, y: height - 65, size: 10, font, color: rgb(0.7, 0.8, 0.9) },
    );
    page.drawText("Document officiel", {
      x: 50,
      y: height - 82,
      size: 8,
      font: fontItalic,
      color: rgb(0.6, 0.7, 0.8),
    });

    // --- Eleve info box ---
    const boxY = height - 160;
    page.drawRectangle({
      x: 50,
      y: boxY,
      width: 495,
      height: 45,
      color: rgb(0.95, 0.96, 0.98),
      borderColor: rgb(0.85, 0.87, 0.9),
      borderWidth: 1,
    });
    page.drawText("Eleve :", {
      x: 60,
      y: boxY + 28,
      size: 8,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    page.drawText(`${enfant.prenom} ${enfant.nom}`, {
      x: 100,
      y: boxY + 28,
      size: 10,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(
      `Ne(e) le ${new Date(enfant.date_naissance).toLocaleDateString("fr-FR")} a ${enfant.lieu_naissance} | ${enfant.etablissement?.nom || ""} | ${enfant.classe}`,
      {
        x: 60,
        y: boxY + 10,
        size: 8,
        font,
        color: rgb(0.4, 0.4, 0.4),
      },
    );

    // --- Body text ---
    const text = fillTemplate(template, enfant, lieu);
    const lines: string[] = [];
    const maxWidth = 495;
    for (const paragraph of text.split("\n")) {
      if (paragraph.trim() === "") {
        lines.push("");
        continue;
      }
      const words = paragraph.split(" ");
      let currentLine = "";
      for (const word of words) {
        const testLine = currentLine ? currentLine + " " + word : word;
        if (font.widthOfTextAtSize(testLine, 11) > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else currentLine = testLine;
      }
      if (currentLine) lines.push(currentLine);
    }

    let y = boxY - 30;
    for (const line of lines) {
      if (line === "") {
        y -= 12;
        continue;
      }
      page.drawText(line, {
        x: 50,
        y,
        size: 11,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });
      y -= 18;
    }

    // --- Signature block ---
    y -= 25;
    page.drawLine({
      start: { x: 50, y: y + 5 },
      end: { x: 545, y: y + 5 },
      thickness: 1,
      color: rgb(0.85, 0.87, 0.9),
    });
    y -= 15;

    page.drawText("SIGNATURE ELECTRONIQUE", {
      x: 50,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.106, 0.227, 0.361),
    });
    y -= 20;

    // Signature box
    const sigBoxH = 80;
    page.drawRectangle({
      x: 50,
      y: y - sigBoxH,
      width: 300,
      height: sigBoxH,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.8, 0.83, 0.87),
      borderWidth: 1,
    });

    // Typed signature (elegant)
    const signataire = `${enfant.parent_prenom} ${enfant.parent_nom}`;
    page.drawText(signataire, {
      x: 65,
      y: y - 35,
      size: 22,
      font: fontItalic,
      color: rgb(0.106, 0.227, 0.361),
    });
    page.drawText("Signature electronique certifiee", {
      x: 65,
      y: y - 55,
      size: 7,
      font: fontItalic,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Verification box (right side)
    const vBoxX = 370;
    page.drawRectangle({
      x: vBoxX,
      y: y - sigBoxH,
      width: 175,
      height: sigBoxH,
      color: rgb(0.95, 0.98, 0.95),
      borderColor: rgb(0.7, 0.85, 0.7),
      borderWidth: 1,
    });
    page.drawText("Certifie conforme", {
      x: vBoxX + 10,
      y: y - 18,
      size: 8,
      font: fontBold,
      color: rgb(0.1, 0.5, 0.2),
    });
    page.drawText(`Date : ${dateStr}`, {
      x: vBoxX + 10,
      y: y - 32,
      size: 7,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(`Heure : ${timeStr}`, {
      x: vBoxX + 10,
      y: y - 44,
      size: 7,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(`ID : ${signatureId}`, {
      x: vBoxX + 10,
      y: y - 56,
      size: 7,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(`Signataire : ${signataire}`, {
      x: vBoxX + 10,
      y: y - 68,
      size: 6,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });

    y -= sigBoxH + 20;

    // Legal text
    page.drawText(
      "Ce document a ete signe electroniquement conformement au reglement eIDAS (UE 910/2014).",
      {
        x: 50,
        y,
        size: 7,
        font: fontItalic,
        color: rgb(0.5, 0.5, 0.5),
      },
    );
    y -= 12;
    page.drawText(
      "La signature electronique a la meme valeur juridique qu'une signature manuscrite (Art. 1367 du Code civil).",
      {
        x: 50,
        y,
        size: 7,
        font: fontItalic,
        color: rgb(0.5, 0.5, 0.5),
      },
    );

    // --- Footer ---
    page.drawLine({
      start: { x: 50, y: 50 },
      end: { x: 545, y: 50 },
      thickness: 0.5,
      color: rgb(0.85, 0.87, 0.9),
    });
    page.drawText(
      "BIA Manager - Aero-Club du Bassin d'Arcachon | Document genere electroniquement | Ne pas modifier",
      {
        x: 50,
        y: 37,
        size: 6,
        font,
        color: rgb(0.6, 0.6, 0.6),
      },
    );
    page.drawText(`Ref: ${signatureId}`, {
      x: 460,
      y: 37,
      size: 6,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });

    const pdfBytes = await pdfDoc.save();
    return {
      blob: new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" }),
      signatureId,
    };
  }

  async function handleSign(eleveId: string) {
    const enfant = enfants.find((e) => e.id === eleveId);
    if (!enfant) return;

    const expectedName = `${enfant.parent_prenom} ${enfant.parent_nom}`
      .toLowerCase()
      .trim();
    if (nomSaisi.toLowerCase().trim() !== expectedName) {
      setError(
        `Le nom saisi ne correspond pas. Tapez exactement : ${enfant.parent_prenom} ${enfant.parent_nom}`,
      );
      return;
    }
    if (!lieu.trim()) {
      setError("Veuillez indiquer le lieu (ville).");
      return;
    }
    if (!certifie) {
      setError("Veuillez cocher la case de certification.");
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const { blob: pdfBlob, signatureId } = await generatePDF(enfant);
      const fileName = `attestation_${enfant.nom}_${enfant.prenom}_${Date.now()}.pdf`;

      const { error: uploadErr } = await supabase.storage
        .from("attestations")
        .upload(fileName, pdfBlob, { contentType: "application/pdf" });
      if (uploadErr) console.warn("Upload:", uploadErr.message);

      await supabase
        .from("eleves")
        .update({
          attestation_signee: true,
          attestation_date: new Date().toISOString(),
          attestation_parent_signataire: `${enfant.parent_prenom} ${enfant.parent_nom}`,
          attestation_url: fileName,
        })
        .eq("id", eleveId);

      setSaving(false);
      setSigning(null);
      setLieu("");
      setNomSaisi("");
      setCertifie(false);
      // If paiement is also validated → auto-send attestation_ready email (parent action, not admin)
      if (enfant.paiement_effectue) {
        const { data: { user } } = await supabase.auth.getUser();
        fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "attestation_ready",
            eleve_id: enfant.id,
            parent_email: user?.email,
            parent_prenom: enfant.parent_prenom || "",
            eleve_prenom: enfant.prenom,
            eleve_nom: enfant.nom,
            etablissement: enfant.etablissement?.nom || "",
          }),
        }).catch(() => {});
      }
      // Recharger les données pour que le statut signé soit visible côté parent
      await loadData();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la signature");
      setSaving(false);
    }
  }

  async function downloadPDF(enfant: any) {
    if (!enfant.attestation_url) return;
    const { data } = await supabase.storage
      .from("attestations")
      .download(enfant.attestation_url);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attestation_${enfant.nom}_${enfant.prenom}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
      </div>
    );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          Attestation parentale
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Autorisation de vol pour votre enfant
        </p>
      </div>

      {enfants.length === 0 ? (
        <div className="card text-center py-12">
          <FileSignature className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucun enfant inscrit.</p>
        </div>
      ) : (
        enfants.map((e) => (
          <div key={e.id} className="card mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-lg font-bold text-gray-900">
                  {e.prenom} {e.nom}
                </p>
                <p className="text-sm text-gray-500">{e.etablissement?.nom}</p>
              </div>
              <span
                className={`badge ${e.attestation_signee ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}
              >
                {e.attestation_signee ? "Signee" : "Non signee"}
              </span>
            </div>

            {e.attestation_signee ? (
              <div>
                <div className="p-4 bg-emerald-50 rounded-lg mb-3 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">
                      Attestation signee le{" "}
                      {new Date(e.attestation_date).toLocaleDateString("fr-FR")}{" "}
                      a{" "}
                      {new Date(e.attestation_date).toLocaleTimeString("fr-FR")}
                    </p>
                    <p className="text-xs text-emerald-600">
                      par {e.attestation_parent_signataire}
                    </p>
                  </div>
                </div>
                <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 mb-3">
                  <p className="text-sm font-bold text-brand-500 mb-3">
                    ATTESTATION PARENTALE
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {fillTemplate(template, e)}
                  </p>
                </div>
                <button
                  onClick={() => downloadPDF(e)}
                  className="btn-secondary btn-sm"
                >
                  <Download className="w-3.5 h-3.5" /> Telecharger le PDF signe
                </button>
              </div>
            ) : signing === e.id ? (
              <div>
                {error && (
                  <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 mb-4">
                  <p className="text-sm font-bold text-brand-500 mb-3">
                    ATTESTATION PARENTALE
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {fillTemplate(template, e)}
                  </p>
                </div>

                <div className="mb-4">
                  <label className="label">Fait à — ville de signature *</label>
                  <input
                    value={lieu}
                    onChange={(ev) => setLieu(ev.target.value)}
                    className="input"
                    placeholder="Saisissez votre ville (ex : Paris, Lyon, Bordeaux…)"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Indiquez n'importe quelle ville, celle où vous signez ce document.</p>
                </div>

                <div className="mb-4">
                  <label className="label">
                    Tapez votre nom complet pour signer *
                  </label>
                  <input
                    value={nomSaisi}
                    onChange={(ev) => setNomSaisi(ev.target.value)}
                    className="input text-lg"
                    placeholder={`${e.parent_prenom} ${e.parent_nom}`}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Tapez exactement :{" "}
                    <strong>
                      {e.parent_prenom} {e.parent_nom}
                    </strong>
                  </p>
                </div>

                {nomSaisi.toLowerCase().trim() ===
                  `${e.parent_prenom} ${e.parent_nom}`.toLowerCase().trim() &&
                  nomSaisi.trim() !== "" && (
                    <div className="mb-4 p-4 rounded-lg border-2 border-brand-200 bg-brand-50/30">
                      <p className="text-[10px] text-gray-400 mb-1">
                        Apercu de votre signature
                      </p>
                      <p
                        className="text-2xl text-brand-500"
                        style={{
                          fontFamily: "Georgia, 'Times New Roman', serif",
                          fontStyle: "italic",
                        }}
                      >
                        {nomSaisi}
                      </p>
                    </div>
                  )}

                <div className="mb-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={certifie}
                      onChange={(ev) => setCertifie(ev.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-xs text-gray-700 leading-relaxed">
                      Je certifie etre{" "}
                      <strong>
                        {e.parent_prenom} {e.parent_nom}
                      </strong>
                      , parent ou responsable legal de{" "}
                      <strong>
                        {e.prenom} {e.nom}
                      </strong>
                      . J&apos;autorise mon enfant a effectuer un vol decouverte
                      au sein de l&apos;Aero-Club du Bassin d&apos;Arcachon.
                      <br />
                      <br />
                      <span className="text-gray-400">
                        Conformement au RGPD, vos donnees sont traitees
                        uniquement dans le cadre du BIA. Cette signature
                        electronique a valeur juridique (Art. 1367 du Code
                        civil, reglement eIDAS).
                      </span>
                    </span>
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSign(e.id)}
                    disabled={
                      saving ||
                      !certifie ||
                      nomSaisi.toLowerCase().trim() !==
                        `${e.parent_prenom} ${e.parent_nom}`
                          .toLowerCase()
                          .trim()
                    }
                    className="btn-primary"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    Signer et valider l&apos;attestation
                  </button>
                  <button
                    onClick={() => {
                      setSigning(null);
                      setError(null);
                      setLieu("");
                      setNomSaisi("");
                      setCertifie(false);
                    }}
                    className="btn-secondary"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 mb-4">
                  <p className="text-sm font-bold text-brand-500 mb-3">
                    ATTESTATION PARENTALE
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {fillTemplate(template, e)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSigning(e.id);
                    setError(null);
                    setLieu("");
                    setNomSaisi("");
                    setCertifie(false);
                  }}
                  className="btn-primary"
                >
                  <FileSignature className="w-4 h-4" /> Signer
                  l&apos;attestation
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
