import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";

// Outils de la signature électronique des contrats.
//
// Rien d'exotique : un jeton secret dans l'URL, un code à usage unique envoyé
// à l'adresse du signataire, et des empreintes SHA-256. Ce qui fait la valeur
// de la signature, c'est que ces éléments soient conservés ensemble.

/** Durée de validité du lien de signature. */
export const JOURS_VALIDITE_LIEN = 30;
/** Durée de validité du code à usage unique. */
export const MINUTES_VALIDITE_CODE = 15;
/** Au-delà, on arrête de répondre : un code à 6 chiffres se devine en force brute. */
export const TENTATIVES_MAX = 5;

export const empreinte = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");

/** Jeton d'URL : 32 octets au hasard, illisibles et impossibles à deviner. */
export const nouveauToken = () => randomBytes(32).toString("base64url");

/** Code à 6 chiffres, tiré par un générateur cryptographique. */
export const nouveauCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** Comparaison à durée constante : un code faux ne doit pas se trahir par le temps de réponse. */
export function codeValide(saisi: string, empreinteAttendue: string | null): boolean {
  if (!empreinteAttendue) return false;
  const a = Buffer.from(empreinte(saisi.trim()));
  const b = Buffer.from(empreinteAttendue);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Référence lisible, imprimée sur le document signé. */
export function nouvelIdSignature() {
  const d = new Date();
  const partie = randomBytes(3).toString("hex").toUpperCase();
  return `BIA-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${partie}`;
}

/** Adresse IP de l'appelant, telle que la voit l'hébergeur. */
export function ipDe(req: Request): string {
  const entetes = req.headers;
  const forward = entetes.get("x-forwarded-for") ?? "";
  return (forward.split(",")[0] || entetes.get("x-real-ip") || "").trim() || "inconnue";
}

export const estExpire = (iso: string | null | undefined) => !iso || new Date(iso).getTime() < Date.now();

/**
 * Bloc de preuve ajouté au document signé. Il énonce ce qui a été vérifié,
 * pour que la valeur de la signature se lise sur la pièce elle-même.
 */
export function blocPreuve(p: {
  signatureId: string;
  nom: string;
  email: string;
  horodatage: string;
  ip: string;
  empreinteDocument: string;
}) {
  const quand = new Date(p.horodatage).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `
  <div class="preuve">
    <p class="preuve-titre">Certificat de signature électronique</p>
    <table class="preuve-table"><tbody>
      <tr><td>Référence</td><td>${esc(p.signatureId)}</td></tr>
      <tr><td>Signataire</td><td>${esc(p.nom)}</td></tr>
      <tr><td>Adresse vérifiée</td><td>${esc(p.email)} — code à usage unique saisi correctement</td></tr>
      <tr><td>Date et heure</td><td>${esc(quand)} (heure de Paris)</td></tr>
      <tr><td>Adresse IP</td><td>${esc(p.ip)}</td></tr>
      <tr><td>Empreinte du document</td><td class="mono">${esc(p.empreinteDocument)}</td></tr>
    </tbody></table>
    <p class="preuve-note">
      Signature électronique au sens des articles 1366 et 1367 du Code civil. L'empreinte SHA-256 ci-dessus porte sur
      le document tel qu'il a été affiché au signataire : toute modification ultérieure, même d'un seul caractère,
      produirait une empreinte différente.
    </p>
  </div>
  <style>
    .preuve { margin-top: 26px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 14px; page-break-inside: avoid; }
    .preuve-titre { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: #1b3a5c; font-weight: bold; margin: 0 0 8px; }
    .preuve-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    .preuve-table td { border: none; padding: 2px 0; vertical-align: top; }
    .preuve-table td:first-child { width: 32%; color: #666; }
    .preuve .mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 9px; word-break: break-all; }
    .preuve-note { font-size: 9.5px; color: #777; margin: 8px 0 0; text-align: justify; }
  </style>`;
}
