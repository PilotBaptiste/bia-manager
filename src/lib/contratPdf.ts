import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Editeur } from "@/lib/legal";
import type { Contrat } from "@/lib/contrats";
import { corpsContrat, parties, sousTitre, titreContrat, type Bloc } from "@/lib/contratContenu";

// Mise en page du contrat en PDF. pdf-lib ne sait que poser du texte à des
// coordonnées : la césure des lignes, les sauts de page et les tableaux sont
// faits ici.

const A4: [number, number] = [595.28, 841.89];
const MARGE = 56;
const BAS = 64;
const LARGEUR = A4[0] - MARGE * 2;

const NAVY = rgb(0.106, 0.227, 0.361);
const NOIR = rgb(0.1, 0.1, 0.1);
const GRIS = rgb(0.42, 0.45, 0.5);
const TRAIT = rgb(0.85, 0.87, 0.9);

/**
 * Les polices standard de PDF n'encodent que le jeu WinAnsi. Les accents
 * français y sont, mais pas tout : on remplace ce qui n'y passerait pas plutôt
 * que de laisser la génération échouer sur un caractère.
 */
function sain(texte: string): string {
  return (texte ?? "")
    .replace(/’/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[•●]/g, "-")
    .replace(/✓/g, "x")
    // Tout ce qui sort du Latin-1 imprimable devient un point d'interrogation
    // visible plutôt qu'une erreur silencieuse.
    .replace(/[^ -~ -ÿŒœ€]/g, "?");
}

/** Découpe un texte en lignes qui tiennent dans la largeur donnée. */
function couper(texte: string, font: PDFFont, taille: number, largeur: number): string[] {
  const mots = sain(texte).split(/\s+/).filter(Boolean);
  const lignes: string[] = [];
  let courante = "";
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (font.widthOfTextAtSize(essai, taille) <= largeur) {
      courante = essai;
    } else {
      if (courante) lignes.push(courante);
      // Un mot plus long que la ligne (une empreinte, par exemple) se coupe.
      if (font.widthOfTextAtSize(mot, taille) > largeur) {
        let reste = mot;
        while (font.widthOfTextAtSize(reste, taille) > largeur) {
          let n = 1;
          while (n < reste.length && font.widthOfTextAtSize(reste.slice(0, n + 1), taille) <= largeur) n++;
          lignes.push(reste.slice(0, n));
          reste = reste.slice(n);
        }
        courante = reste;
      } else {
        courante = mot;
      }
    }
  }
  if (courante) lignes.push(courante);
  return lignes.length > 0 ? lignes : [""];
}

/** Curseur de mise en page : tient la page courante et la position verticale. */
class Plume {
  pages: PDFPage[] = [];
  page!: PDFPage;
  y = 0;

  constructor(
    private doc: PDFDocument,
    public normal: PDFFont,
    public gras: PDFFont,
    public italique: PDFFont,
  ) {
    this.nouvellePage();
  }

  nouvellePage() {
    this.page = this.doc.addPage(A4);
    this.pages.push(this.page);
    this.y = A4[1] - MARGE;
  }

  /** Réserve la hauteur demandée, en changeant de page si elle ne tient pas. */
  place(hauteur: number) {
    if (this.y - hauteur < BAS) this.nouvellePage();
  }

  texte(t: string, opts: { font?: PDFFont; taille?: number; couleur?: any; x?: number; largeur?: number; interligne?: number } = {}) {
    const font = opts.font ?? this.normal;
    const taille = opts.taille ?? 9.5;
    const x = opts.x ?? MARGE;
    const largeur = opts.largeur ?? LARGEUR;
    const interligne = opts.interligne ?? taille * 1.45;
    for (const ligne of couper(t, font, taille, largeur)) {
      this.place(interligne);
      this.page.drawText(ligne, { x, y: this.y - taille, size: taille, font, color: opts.couleur ?? NOIR });
      this.y -= interligne;
    }
  }

  espace(h: number) {
    this.y -= h;
  }

  trait() {
    this.place(6);
    this.page.drawLine({
      start: { x: MARGE, y: this.y },
      end: { x: MARGE + LARGEUR, y: this.y },
      thickness: 0.6,
      color: TRAIT,
    });
    this.y -= 6;
  }
}

function ecrireBlocs(p: Plume, blocs: Bloc[]) {
  for (const b of blocs) {
    if (b.t === "titre") {
      p.espace(8);
      p.place(26);
      p.texte(b.texte, { font: p.gras, taille: 10.5, couleur: NAVY });
      p.trait();
      p.espace(2);
    } else if (b.t === "para") {
      p.texte(b.texte, { taille: 9.5 });
      p.espace(5);
    } else if (b.t === "liste") {
      for (const item of b.items) {
        const puce = "-";
        p.place(14);
        p.page.drawText(puce, { x: MARGE + 4, y: p.y - 9.5, size: 9.5, font: p.normal, color: GRIS });
        p.texte(item, { x: MARGE + 16, largeur: LARGEUR - 16, taille: 9.5 });
        p.espace(2);
      }
      p.espace(4);
    } else {
      const colA = LARGEUR * 0.33;
      const colB = LARGEUR - colA - 12;
      for (const [gauche, droite] of b.lignes) {
        const lg = couper(gauche, p.gras, 8.5, colA - 8);
        const ld = couper(droite, p.normal, 8.5, colB - 8);
        const hauteur = Math.max(lg.length, ld.length) * 12 + 8;
        p.place(hauteur);
        const haut = p.y;
        p.page.drawRectangle({
          x: MARGE,
          y: haut - hauteur,
          width: LARGEUR,
          height: hauteur,
          borderColor: TRAIT,
          borderWidth: 0.6,
        });
        lg.forEach((l, i) =>
          p.page.drawText(l, { x: MARGE + 6, y: haut - 14 - i * 12, size: 8.5, font: p.gras, color: NOIR }),
        );
        ld.forEach((l, i) =>
          p.page.drawText(l, { x: MARGE + colA + 6, y: haut - 14 - i * 12, size: 8.5, font: p.normal, color: NOIR }),
        );
        p.y = haut - hauteur;
      }
      p.espace(8);
    }
  }
}

export type SignatureRendue = {
  role: string;
  nom: string;
  image?: string | null;
  le?: string | null;
  lieu?: string | null;
};

/** Un cadre de signature par partie, avec le tracé s'il existe. */
async function ecrireSignatures(doc: PDFDocument, p: Plume, signatures: SignatureRendue[]) {
  const hauteur = 112;
  p.espace(12);
  p.place(hauteur + 16);
  const haut = p.y;
  const largeurCadre = (LARGEUR - 16) / 2;

  for (let i = 0; i < signatures.length; i++) {
    const s = signatures[i];
    const x = MARGE + i * (largeurCadre + 16);
    p.page.drawRectangle({
      x,
      y: haut - hauteur,
      width: largeurCadre,
      height: hauteur,
      borderColor: TRAIT,
      borderWidth: 0.8,
    });
    p.page.drawText(sain(s.role), { x: x + 8, y: haut - 15, size: 7.5, font: p.gras, color: NAVY });
    p.page.drawText(sain(s.nom || "[non signé]"), { x: x + 8, y: haut - 28, size: 9, font: p.normal, color: NOIR });

    if (s.image) {
      try {
        const base64 = s.image.split(",")[1] ?? "";
        const png = await doc.embedPng(Buffer.from(base64, "base64"));
        // Le tracé garde ses proportions dans le cadre qui lui est réservé.
        const maxL = largeurCadre - 24;
        const maxH = 46;
        const ratio = Math.min(maxL / png.width, maxH / png.height);
        p.page.drawImage(png, {
          x: x + 12,
          y: haut - 86,
          width: png.width * ratio,
          height: png.height * ratio,
        });
      } catch {
        /* Un tracé illisible ne doit pas empêcher le contrat de sortir. */
      }
    }

    if (s.le) {
      const quand = new Date(s.le).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
      p.page.drawText(sain(`Signé le ${quand}${s.lieu ? ` — ${s.lieu}` : ""}`), {
        x: x + 8,
        y: haut - hauteur + 10,
        size: 7.5,
        font: p.italique,
        color: GRIS,
      });
    }
  }
  p.y = haut - hauteur - 10;
}

export type Preuve = {
  signatureId: string;
  empreinte: string;
  club: { nom: string; email: string; ip: string; horodatage: string };
  editeur: { nom: string; horodatage: string };
};

function ecrirePreuve(p: Plume, preuve: Preuve) {
  p.espace(10);
  p.place(130);
  p.texte("Certificat de signature électronique", { font: p.gras, taille: 8.5, couleur: NAVY });
  p.espace(3);
  const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
  const lignes: [string, string][] = [
    ["Référence", preuve.signatureId],
    ["Signataire aéroclub", `${preuve.club.nom} — ${preuve.club.email}`],
    ["Adresse vérifiée", "code à usage unique envoyé par email et saisi correctement"],
    ["Signé le", `${quand(preuve.club.horodatage)} (heure de Paris)`],
    ["Adresse IP", preuve.club.ip],
    ["Signataire éditeur", `${preuve.editeur.nom} — compte authentifié`],
    ["Signé le", `${quand(preuve.editeur.horodatage)} (heure de Paris)`],
    ["Empreinte SHA-256", preuve.empreinte],
  ];
  for (const [g, d] of lignes) {
    p.place(12);
    p.page.drawText(sain(g), { x: MARGE, y: p.y - 8, size: 7.5, font: p.normal, color: GRIS });
    p.texte(d, { x: MARGE + 130, largeur: LARGEUR - 130, taille: 7.5 });
    p.espace(-2);
  }
  p.espace(6);
  p.texte(
    "Signature électronique au sens des articles 1366 et 1367 du Code civil. L'empreinte SHA-256 ci-dessus porte sur le contenu du contrat : toute modification ultérieure, même d'un seul caractère, produirait une empreinte différente.",
    { taille: 7.5, couleur: GRIS, font: p.italique },
  );
}

function pieds(p: Plume, reference: string) {
  p.pages.forEach((page, i) => {
    page.drawText(sain(reference), { x: MARGE, y: 34, size: 7, font: p.normal, color: GRIS });
    const n = `${i + 1} / ${p.pages.length}`;
    page.drawText(n, {
      x: A4[0] - MARGE - p.normal.widthOfTextAtSize(n, 7),
      y: 34,
      size: 7,
      font: p.normal,
      color: GRIS,
    });
  });
}

/** Produit le PDF complet du contrat, signatures et certificat compris. */
export async function pdfContrat(
  contrat: Contrat,
  nomClub: string,
  e: Editeur,
  options: { signatures?: SignatureRendue[]; preuve?: Preuve } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const gras = await doc.embedFont(StandardFonts.HelveticaBold);
  const italique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const p = new Plume(doc, normal, gras, italique);

  // En-tête
  p.texte(titreContrat(contrat), { font: gras, taille: 15, couleur: NAVY });
  p.espace(2);
  p.texte(sousTitre(contrat), { taille: 8.5, couleur: GRIS });
  p.espace(12);

  // Les deux parties, côte à côte
  p.texte("Entre les soussignés", { font: gras, taille: 10.5, couleur: NAVY });
  p.trait();
  p.espace(4);
  const [pa, pb] = parties(contrat, nomClub, e);
  const largeurCadre = (LARGEUR - 16) / 2;
  const hautCadres = p.y;
  let hauteurMax = 0;
  [pa, pb].forEach((partie, i) => {
    const x = MARGE + i * (largeurCadre + 16);
    let y = hautCadres - 16;
    p.page.drawText(sain(partie.role), { x: x + 8, y, size: 7.5, font: gras, color: NAVY });
    y -= 14;
    for (const ligne of partie.lignes) {
      for (const l of couper(ligne, normal, 8.5, largeurCadre - 16)) {
        p.page.drawText(l, { x: x + 8, y, size: 8.5, font: normal, color: NOIR });
        y -= 11;
      }
    }
    y -= 4;
    p.page.drawText(sain(partie.qualite), { x: x + 8, y, size: 7.5, font: italique, color: GRIS });
    y -= 12;
    hauteurMax = Math.max(hauteurMax, hautCadres - y);
  });
  [0, 1].forEach((i) => {
    p.page.drawRectangle({
      x: MARGE + i * (largeurCadre + 16),
      y: hautCadres - hauteurMax,
      width: largeurCadre,
      height: hauteurMax,
      borderColor: TRAIT,
      borderWidth: 0.6,
    });
  });
  p.y = hautCadres - hauteurMax - 10;

  ecrireBlocs(p, corpsContrat(contrat));

  if (options.signatures?.length) {
    await ecrireSignatures(doc, p, options.signatures);
    p.texte("Fait en deux exemplaires originaux. Chaque partie reconnaît en avoir reçu un.", {
      taille: 7.5,
      couleur: GRIS,
      font: italique,
    });
  }
  if (options.preuve) ecrirePreuve(p, options.preuve);

  pieds(p, `${titreContrat(contrat)} — ${contrat.club_raison_sociale || nomClub}`);
  return doc.save();
}
