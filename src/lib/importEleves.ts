// Lecture et normalisation des fichiers d'import d'élèves (CSV maison et export FFA SMILE).
// Fonctions pures, sans accès réseau : réutilisées par la page d'import (navigateur)
// et par la route serveur qui lit les .xls de la FFA.

export const CSV_HEADERS = [
  "nom", "prenom", "date_naissance", "lieu_naissance",
  "adresse_rue", "adresse_cp", "adresse_ville",
  "etablissement", "classe",
  "parent_nom", "parent_prenom", "parent_email", "parent_telephone",
  "parent2_nom", "parent2_prenom", "parent2_email", "parent2_telephone",
  "paiement_effectue", "paiement_montant", "paiement_mode",
  "attestation_signee",
  "vol1_effectue", "vol2_autorise", "vol2_effectue",
  "bia_passe", "bia_resultat", "bia_mention", "bia_date",
  "commentaires",
] as const;

export type CsvKey = typeof CSV_HEADERS[number];

export const HEADER_ALIASES: Record<string, CsvKey> = {
  datedenaissance: "date_naissance",
  lieudenaissance: "lieu_naissance",
  emailparent: "parent_email",
  telephoneparent: "parent_telephone",
  emailparent2: "parent2_email",
  telephoneparent2: "parent2_telephone",
};

export const REQUIRED_HEADERS: CsvKey[] = ["nom", "prenom"];

export const CSV_SAMPLE = [
  "DUPONT", "Alice", "15/03/2010", "Bordeaux",
  "5 rue des Lilas", "33000", "Bordeaux",
  "Lycée Victor Hugo", "2nde",
  "DUPONT", "Pierre", "pierre.dupont@email.com", "0612345678",
  "MARTIN", "Sophie", "sophie.martin@email.com", "0698765432",
  "Oui", "80", "CB",
  "Oui",
  "Non", "Non", "Non",
  "Oui", "Admis", "", "15/06/2025",
  "",
];

export interface ParsedRow {
  line: number;
  nom: string;
  prenom: string;
  date_naissance: string;
  lieu_naissance: string;
  adresse_rue: string;
  adresse_cp: string;
  adresse_ville: string;
  etablissement: string;
  classe: string;
  parent_nom: string;
  parent_prenom: string;
  parent_email: string;
  parent_telephone: string;
  parent2_nom: string;
  parent2_prenom: string;
  parent2_email: string;
  parent2_telephone: string;
  paiement_effectue: boolean | null;
  paiement_montant: number | null;
  paiement_mode: string;
  attestation_signee: boolean | null;
  vol1_effectue: boolean | null;
  vol2_autorise: boolean | null;
  vol2_effectue: boolean | null;
  bia_passe: boolean | null;
  bia_resultat: string;
  bia_mention: string;
  bia_date: string;
  commentaires: string;
}

export function ligneVide(line: number): ParsedRow {
  return {
    line,
    nom: "", prenom: "", date_naissance: "", lieu_naissance: "",
    adresse_rue: "", adresse_cp: "", adresse_ville: "",
    etablissement: "", classe: "",
    parent_nom: "", parent_prenom: "", parent_email: "", parent_telephone: "",
    parent2_nom: "", parent2_prenom: "", parent2_email: "", parent2_telephone: "",
    paiement_effectue: null, paiement_montant: null, paiement_mode: "",
    attestation_signee: null,
    vol1_effectue: null, vol2_autorise: null, vol2_effectue: null,
    bia_passe: null, bia_resultat: "", bia_mention: "", bia_date: "",
    commentaires: "",
  };
}

export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function normalizeHeader(s: string): string {
  return normalizeText(s).replace(/[^a-z0-9]/g, "");
}

export function parseDate(raw: string): string | null {
  const v = raw.trim().split(/[ T]/)[0];
  if (!v) return null;
  let y: number, m: number, d: number;
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const fr = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else if (fr) { d = +fr[1]; m = +fr[2]; y = +fr[3]; }
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseBool(val: string): boolean | null {
  const v = normalizeText(val);
  if (!v) return null;
  return ["oui", "true", "1", "vrai", "x", "o", "y", "yes"].includes(v);
}

export function parseMontant(val: string): number | null {
  const v = val.replace(/[\s €]/g, "").replace(",", ".");
  if (!v) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

export function decodeFile(buffer: ArrayBuffer): string {
  let bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bytes = bytes.subarray(3);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function detectSeparator(text: string): string {
  let semi = 0, comma = 0, inQuote = false;
  for (const ch of text) {
    if (ch === '"') inQuote = !inQuote;
    else if (!inQuote && (ch === "\n" || ch === "\r")) break;
    else if (!inQuote && ch === ";") semi++;
    else if (!inQuote && ch === ",") comma++;
  }
  return comma > semi ? "," : ";";
}

export function splitRecords(text: string, sep: string): { line: number; cols: string[] }[] {
  const records: { line: number; cols: string[] }[] = [];
  let cols: string[] = [];
  let cur = "";
  let inQuote = false;
  let line = 1;
  let startLine = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else {
        if (ch === "\n") line++;
        cur += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === sep) {
      cols.push(cur.trim()); cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cols.push(cur.trim()); cur = "";
      if (cols.some(c => c)) records.push({ line: startLine, cols });
      cols = [];
      line++;
      startLine = line;
    } else {
      cur += ch;
    }
  }
  cols.push(cur.trim());
  if (cols.some(c => c)) records.push({ line: startLine, cols });
  return records;
}

export function parseCSV(text: string): { rows: ParsedRow[]; error?: string } {
  const records = splitRecords(text, detectSeparator(text));
  if (records.length < 2) return { rows: [], error: "Le fichier doit contenir une ligne d'en-tête et au moins une ligne de données." };

  const index: Partial<Record<CsvKey, number>> = {};
  records[0].cols.forEach((h, i) => {
    const n = normalizeHeader(h);
    const key = CSV_HEADERS.find(k => normalizeHeader(k) === n) || HEADER_ALIASES[n];
    if (key && index[key] === undefined) index[key] = i;
  });
  const missing = REQUIRED_HEADERS.filter(k => index[k] === undefined);
  if (missing.length > 0) {
    return { rows: [], error: `Colonne${missing.length > 1 ? "s" : ""} obligatoire${missing.length > 1 ? "s" : ""} introuvable${missing.length > 1 ? "s" : ""} dans l'en-tête : ${missing.join(", ")}. Aucune donnée n'a été importée.` };
  }

  const rows = records.slice(1).map(({ line, cols }) => {
    const get = (k: CsvKey) => (index[k] !== undefined ? cols[index[k]!] || "" : "").trim();
    return {
      ...ligneVide(line),
      nom: get("nom"),
      prenom: get("prenom"),
      date_naissance: get("date_naissance"),
      lieu_naissance: get("lieu_naissance"),
      adresse_rue: get("adresse_rue"),
      adresse_cp: get("adresse_cp"),
      adresse_ville: get("adresse_ville"),
      etablissement: get("etablissement").replace(/\s+/g, " "),
      classe: get("classe"),
      parent_nom: get("parent_nom"),
      parent_prenom: get("parent_prenom"),
      parent_email: get("parent_email"),
      parent_telephone: get("parent_telephone"),
      parent2_nom: get("parent2_nom"),
      parent2_prenom: get("parent2_prenom"),
      parent2_email: get("parent2_email"),
      parent2_telephone: get("parent2_telephone"),
      paiement_effectue: parseBool(get("paiement_effectue")),
      paiement_montant: parseMontant(get("paiement_montant")),
      paiement_mode: get("paiement_mode"),
      attestation_signee: parseBool(get("attestation_signee")),
      vol1_effectue: parseBool(get("vol1_effectue")),
      vol2_autorise: parseBool(get("vol2_autorise")),
      vol2_effectue: parseBool(get("vol2_effectue")),
      bia_passe: parseBool(get("bia_passe")),
      bia_resultat: get("bia_resultat"),
      bia_mention: get("bia_mention"),
      bia_date: get("bia_date"),
      commentaires: get("commentaires"),
    };
  }).filter(r => r.nom && r.prenom);

  if (rows.length === 0) return { rows: [], error: "Aucune ligne valide (nom et prénom renseignés) trouvée dans le fichier." };
  return { rows };
}

// ---------------------------------------------------------------------------
// Export FFA SMILE (« Liste des adhérents », .xls ou .xlsx)
// En-tête attendu : Nom · Prénom · Civilité · DDN · Adresse · Adresse 2 ·
// Code postal · Ville · Téléphone · Portable · Email · BIA Obtenu · Mention ·
// Nb. min AV · Nb. min AR · Etablissement · Responsable CAEA
// Civilité, Nb. min AV / AR et Responsable CAEA ne sont pas importés.
// ---------------------------------------------------------------------------

export const FFA_COLONNES = [
  "nom", "prenom", "civilite", "ddn", "adresse", "adresse2", "cp", "ville",
  "telephone", "portable", "email", "bia_obtenu", "mention",
  "min_av", "min_ar", "etablissement", "responsable_caea",
] as const;

export type FfaKey = typeof FFA_COLONNES[number];

const FFA_ENTETES: Record<string, FfaKey> = {
  nom: "nom",
  prenom: "prenom",
  civilite: "civilite",
  ddn: "ddn",
  datedenaissance: "ddn",
  datenaissance: "ddn",
  adresse: "adresse",
  adresse2: "adresse2",
  codepostal: "cp",
  cp: "cp",
  ville: "ville",
  telephone: "telephone",
  tel: "telephone",
  portable: "portable",
  mobile: "portable",
  email: "email",
  mail: "email",
  biaobtenu: "bia_obtenu",
  bia: "bia_obtenu",
  mention: "mention",
  nbminav: "min_av",
  nbminar: "min_ar",
  etablissement: "etablissement",
  responsablecaea: "responsable_caea",
};

/** Index des colonnes FFA dans une ligne d'en-tête, ou null si l'en-tête n'est pas reconnu. */
export function indexEnteteFfa(entete: string[]): Partial<Record<FfaKey, number>> | null {
  const index: Partial<Record<FfaKey, number>> = {};
  entete.forEach((h, i) => {
    const key = FFA_ENTETES[normalizeHeader(h ?? "")];
    if (key && index[key] === undefined) index[key] = i;
  });
  if (index.nom === undefined || index.prenom === undefined) return null;
  return index;
}

/** Transforme une ligne de l'export FFA en ligne d'import. */
export function ligneFfa(
  cols: string[],
  index: Partial<Record<FfaKey, number>>,
  line: number,
): ParsedRow {
  const get = (k: FfaKey) => (index[k] !== undefined ? String(cols[index[k]!] ?? "") : "").trim();
  const nom = get("nom");
  const rue = [get("adresse"), get("adresse2")].filter(Boolean).join(" ");
  const cpBrut = get("cp");
  const cp = /^\d{1,5}$/.test(cpBrut) ? cpBrut.padStart(5, "0") : cpBrut;
  const bia = parseBool(get("bia_obtenu"));
  const mention = get("mention");
  return {
    ...ligneVide(line),
    nom,
    prenom: get("prenom"),
    date_naissance: get("ddn"),
    adresse_rue: rue,
    adresse_cp: cp,
    adresse_ville: get("ville"),
    etablissement: get("etablissement").replace(/\s+/g, " "),
    // L'export FFA ne contient pas l'identité du responsable légal : valeurs de départ, corrigeables dans l'aperçu.
    parent_nom: nom,
    parent_prenom: "Parent",
    parent_email: get("email").toLowerCase(),
    parent_telephone: get("portable") || get("telephone"),
    bia_passe: bia,
    bia_resultat: bia ? (mention ? "Mention" : "Admis") : "",
    bia_mention: bia && mention ? mention : "",
  };
}
