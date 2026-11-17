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
