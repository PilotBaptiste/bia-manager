"use client";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Upload, Loader2, Check, AlertCircle, FileSpreadsheet, X, Download } from "lucide-react";

// Updated columns matching the current eleves table structure
const CSV_HEADERS = [
  "nom", "prenom", "date_naissance", "lieu_naissance",
  "adresse_rue", "adresse_cp", "adresse_ville",
  "etablissement", "classe",
  "parent_nom", "parent_prenom", "parent_email", "parent_telephone",
  "paiement_effectue", "paiement_montant", "paiement_mode",
  "attestation_signee",
  "vol1_effectue", "vol2_autorise", "vol2_effectue",
  "bia_passe", "bia_resultat", "bia_date",
  "commentaires",
] as const;

type CsvKey = typeof CSV_HEADERS[number];

const HEADER_ALIASES: Record<string, CsvKey> = {
  datedenaissance: "date_naissance",
  lieudenaissance: "lieu_naissance",
  emailparent: "parent_email",
  telephoneparent: "parent_telephone",
};

const REQUIRED_HEADERS: CsvKey[] = ["nom", "prenom"];

const CSV_SAMPLE = [
  "DUPONT", "Alice", "15/03/2010", "Bordeaux",
  "5 rue des Lilas", "33000", "Bordeaux",
  "Lycée Victor Hugo", "2nde",
  "DUPONT", "Pierre", "pierre.dupont@email.com", "0612345678",
  "Oui", "80", "CB",
  "Oui",
  "Non", "Non", "Non",
  "Oui", "Admis", "15/06/2025",
  "",
];

interface ParsedRow {
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
  paiement_effectue: boolean | null;
  paiement_montant: number | null;
  paiement_mode: string;
  attestation_signee: boolean | null;
  vol1_effectue: boolean | null;
  vol2_autorise: boolean | null;
  vol2_effectue: boolean | null;
  bia_passe: boolean | null;
  bia_resultat: string;
  bia_date: string;
  commentaires: string;
}

interface ImportResult {
  created: number;
  updated: number;
  failed: { line: number | null; message: string }[];
}

function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeHeader(s: string): string {
  return normalizeText(s).replace(/[^a-z0-9]/g, "");
}

function parseDate(raw: string): string | null {
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

function parseBool(val: string): boolean | null {
  const v = normalizeText(val);
  if (!v) return null;
  return ["oui", "true", "1", "vrai", "x"].includes(v);
}

function parseMontant(val: string): number | null {
  const v = val.replace(/[\s €]/g, "").replace(",", ".");
  if (!v) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function decodeFile(buffer: ArrayBuffer): string {
  let bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bytes = bytes.subarray(3);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function detectSeparator(text: string): string {
  let semi = 0, comma = 0, inQuote = false;
  for (const ch of text) {
    if (ch === '"') inQuote = !inQuote;
    else if (!inQuote && (ch === "\n" || ch === "\r")) break;
    else if (!inQuote && ch === ";") semi++;
    else if (!inQuote && ch === ",") comma++;
  }
  return comma > semi ? "," : ";";
}

function splitRecords(text: string, sep: string): { line: number; cols: string[] }[] {
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

function parseCSV(text: string): { rows: ParsedRow[]; error?: string } {
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
      line,
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
      paiement_effectue: parseBool(get("paiement_effectue")),
      paiement_montant: parseMontant(get("paiement_montant")),
      paiement_mode: get("paiement_mode"),
      attestation_signee: parseBool(get("attestation_signee")),
      vol1_effectue: parseBool(get("vol1_effectue")),
      vol2_autorise: parseBool(get("vol2_autorise")),
      vol2_effectue: parseBool(get("vol2_effectue")),
      bia_passe: parseBool(get("bia_passe")),
      bia_resultat: get("bia_resultat"),
      bia_date: get("bia_date"),
      commentaires: get("commentaires"),
    };
  }).filter(r => r.nom && r.prenom);

  if (rows.length === 0) return { rows: [], error: "Aucune ligne valide (nom et prénom renseignés) trouvée dans le fichier." };
  return { rows };
}

function downloadTemplate() {
  const header = CSV_HEADERS.join(";");
  const sample = CSV_SAMPLE.map(v => `"${v}"`).join(";");
  const csv = [header, sample].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "template_import_eleves.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const size = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    all.push(...(data || []));
    if (!data || data.length < size) return all;
  }
}

export default function ImportPage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setResult(null);
    try {
      const { rows: parsed, error } = parseCSV(decodeFile(await file.arrayBuffer()));
      if (error) { setParseError(error); setRows([]); setPreview(false); return; }
      setParseError(null);
      setRows(parsed);
      setPreview(true);
    } catch (err) {
      setParseError(`Lecture du fichier impossible : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleImport() {
    setImporting(true);
    setProgress(0);
    const res: ImportResult = { created: 0, updated: 0, failed: [] };
    const fail = (line: number | null, message: string) => res.failed.push({ line, message });

    try {
      const { data: annee } = await supabase.from("annees").select("id").eq("active", true).single();
      if (!annee) { fail(null, "Aucune année active trouvée."); return; }

      const etabList = await fetchAll<{ id: string; nom: string }>((from, to) => supabase.from("etablissements").select("id, nom").range(from, to));
      const etabMap: Record<string, string> = {};
      for (const e of etabList) {
        const key = normalizeText(e.nom || "");
        if (key && !etabMap[key]) etabMap[key] = e.id;
      }
      for (const name of rows.map(r => r.etablissement).filter(Boolean)) {
        const key = normalizeText(name);
        if (key in etabMap) continue;
        const { data: newEtab, error } = await supabase.from("etablissements").insert({ nom: name, actif: true }).select("id").single();
        if (newEtab) etabMap[key] = newEtab.id;
        else { etabMap[key] = ""; fail(null, `Création de l'établissement « ${name} » impossible : ${error?.message}`); }
      }

      const existingList = await fetchAll<{ id: string; nom: string; prenom: string; date_naissance: string; attestation_signee: boolean | null }>((from, to) =>
        supabase.from("eleves").select("id, nom, prenom, date_naissance, attestation_signee").eq("annee_id", annee.id).range(from, to));
      const eleveKey = (nom: string, prenom: string, date: string) => `${normalizeText(nom)}|${normalizeText(prenom)}|${date}`;
      const existingMap = new Map<string, { id: string; attestation_signee: boolean | null }[]>();
      for (const e of existingList) {
        const k = eleveKey(e.nom, e.prenom, e.date_naissance);
        existingMap.set(k, [...(existingMap.get(k) || []), e]);
      }

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        setProgress(Math.round(((i + 1) / rows.length) * 100));
        const label = `${r.nom} ${r.prenom}`;

        const dateParsed = parseDate(r.date_naissance);
        if (!dateParsed) { fail(r.line, `${label} : date de naissance invalide « ${r.date_naissance} »`); continue; }

        const k = eleveKey(r.nom, r.prenom, dateParsed);
        const matches = existingMap.get(k) || [];
        if (matches.length > 1) { fail(r.line, `${label} : plusieurs élèves correspondent dans l'année active, ligne ignorée`); continue; }

        const etabId = r.etablissement ? etabMap[normalizeText(r.etablissement)] || null : null;
        const adresse = [r.adresse_rue, [r.adresse_cp, r.adresse_ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;
        const biaAdmis = r.bia_resultat === "Admis" || r.bia_resultat === "Mention";
        const biaDate = parseDate(r.bia_date);

        if (matches.length === 1) {
          const existing = matches[0];
          const upd: Record<string, unknown> = {};
          if (etabId) upd.etablissement_id = etabId;
          if (r.classe) upd.classe = r.classe;
          if (r.lieu_naissance) upd.lieu_naissance = r.lieu_naissance;
          if (adresse) upd.adresse = adresse;
          if (r.adresse_rue) upd.adresse_rue = r.adresse_rue;
          if (r.adresse_cp) upd.adresse_cp = r.adresse_cp;
          if (r.adresse_ville) upd.adresse_ville = r.adresse_ville;
          if (r.parent_nom) upd.parent_nom = r.parent_nom;
          if (r.parent_prenom) upd.parent_prenom = r.parent_prenom;
          if (r.parent_email) upd.parent_email = r.parent_email;
          if (r.parent_telephone) upd.parent_telephone = r.parent_telephone;
          if (r.paiement_effectue !== null) upd.paiement_effectue = r.paiement_effectue;
          if (r.paiement_montant !== null) upd.paiement_montant = r.paiement_montant;
          if (r.paiement_mode) upd.paiement_mode = r.paiement_mode;
          if (r.attestation_signee && !existing.attestation_signee) {
            upd.attestation_signee = true;
            upd.attestation_date = new Date().toISOString();
            upd.attestation_parent_signataire = `${r.parent_prenom} ${r.parent_nom}`.trim() || "Import CSV";
          }
          if (r.vol1_effectue !== null) upd.vol1_effectue = r.vol1_effectue;
          if (r.vol2_autorise !== null) upd.vol2_autorise = r.vol2_autorise || biaAdmis;
          else if (biaAdmis) upd.vol2_autorise = true;
          if (r.vol2_effectue !== null) upd.vol2_effectue = r.vol2_effectue;
          if (r.bia_passe !== null) upd.bia_passe = r.bia_passe;
          if (r.bia_resultat) upd.bia_resultat = r.bia_resultat;
          if (biaDate) upd.bia_date = biaDate;
          if (r.commentaires) upd.commentaires = r.commentaires;

          if (Object.keys(upd).length === 0) { res.updated++; continue; }
          const { error } = await supabase.from("eleves").update(upd).eq("id", existing.id);
          if (error) fail(r.line, `${label} : ${error.message}`);
          else {
            res.updated++;
            if (upd.attestation_signee) existing.attestation_signee = true;
          }
        } else {
          const paye = r.paiement_effectue === true;
          const signee = r.attestation_signee === true;
          const insert: Record<string, unknown> = {
            nom: r.nom,
            prenom: r.prenom,
            date_naissance: dateParsed,
            annee_id: annee.id,
            etablissement_id: etabId,
            classe: r.classe || "—",
            lieu_naissance: r.lieu_naissance || "—",
            adresse: adresse,
            adresse_rue: r.adresse_rue || null,
            adresse_cp: r.adresse_cp || null,
            adresse_ville: r.adresse_ville || null,
            parent_nom: r.parent_nom || r.nom,
            parent_prenom: r.parent_prenom || "Parent",
            parent_email: r.parent_email || null,
            parent_telephone: r.parent_telephone || "",
            paiement_effectue: paye,
            paiement_montant: paye ? r.paiement_montant ?? 80 : null,
            paiement_mode: paye ? r.paiement_mode || "Import CSV" : null,
            attestation_signee: signee,
            attestation_date: signee ? new Date().toISOString() : null,
            attestation_parent_signataire: signee ? (`${r.parent_prenom} ${r.parent_nom}`.trim() || "Import CSV") : null,
            vol1_effectue: r.vol1_effectue === true,
            vol2_autorise: r.vol2_autorise === true || biaAdmis,
            vol2_effectue: r.vol2_effectue === true,
            bia_passe: r.bia_passe === true,
            bia_resultat: r.bia_passe && r.bia_resultat ? r.bia_resultat : null,
            bia_date: r.bia_passe ? biaDate : null,
            commentaires: r.commentaires || null,
          };

          let { data: inserted, error } = await supabase.from("eleves").insert(insert).select("id").single();
          if (error && error.code === "23502" && error.message.includes("parent_email")) {
            ({ data: inserted, error } = await supabase.from("eleves").insert({ ...insert, parent_email: "" }).select("id").single());
          }
          if (error || !inserted) fail(r.line, `${label} : ${error?.message || "insertion impossible"}`);
          else {
            res.created++;
            existingMap.set(k, [{ id: inserted.id, attestation_signee: signee }]);
          }
        }
      }
    } catch (err) {
      fail(null, `Import interrompu : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setResult(res);
      setImporting(false);
    }
  }

  const etabs = [...new Set(rows.map(r => normalizeText(r.etablissement)))];
  const totalPaye = rows.filter(r => r.paiement_effectue).length;
  const totalVol1 = rows.filter(r => r.vol1_effectue).length;
  const totalAccord = rows.filter(r => r.attestation_signee).length;

  const failedCount = result?.failed.length ?? 0;
  const succeeded = result ? result.created + result.updated : 0;
  const resultTone = failedCount === 0 ? "success" : succeeded === 0 ? "error" : "warning";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Import CSV</h1>
        <p className="text-sm text-gray-500 mt-0.5">Importer les élèves depuis un fichier CSV</p>
      </div>

      {/* Upload */}
      {!preview && !result && (
        <div className="card">
          {parseError && (
            <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{parseError}</p>
            </div>
          )}
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <FileSpreadsheet className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 mb-1">Sélectionnez votre fichier CSV</p>
            <p className="text-xs text-gray-400 mb-4">Séparateur point-virgule (;) ou virgule (,) · UTF-8 ou Windows-1252 (Excel)</p>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()} className="btn-primary">
                <Upload className="w-4 h-4" /> Choisir un fichier
              </button>
              <button onClick={downloadTemplate} className="btn-secondary">
                <Download className="w-4 h-4" /> Télécharger le template
              </button>
            </div>
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <p className="font-semibold mb-1">Colonnes attendues (en-tête obligatoire, ordre libre, nom et prenom requis) :</p>
            <p className="font-mono text-[10px] leading-5 break-all">{CSV_HEADERS.join(" ; ")}</p>
            <p className="mt-2 text-gray-400">Les valeurs booléennes (paiement_effectue, attestation_signee, vol1_effectue…) acceptent : <strong>Oui</strong> / <strong>Non</strong>. Lors d&apos;une mise à jour, les cellules vides ne modifient pas les données existantes.</p>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && !result && (
        <div>
          <div className="flex gap-3 flex-wrap mb-4">
            <div className="card flex-1 min-w-[140px]"><p className="text-xs text-gray-500">Élèves</p><p className="text-2xl font-bold text-gray-900">{rows.length}</p></div>
            <div className="card flex-1 min-w-[140px]"><p className="text-xs text-gray-500">Établissements</p><p className="text-2xl font-bold text-gray-900">{etabs.length}</p></div>
            <div className="card flex-1 min-w-[140px]"><p className="text-xs text-gray-500">Payés</p><p className="text-2xl font-bold text-emerald-600">{totalPaye}</p></div>
            <div className="card flex-1 min-w-[140px]"><p className="text-xs text-gray-500">Vol 1 effectué</p><p className="text-2xl font-bold text-brand-500">{totalVol1}</p></div>
            <div className="card flex-1 min-w-[140px]"><p className="text-xs text-gray-500">Attestation signée</p><p className="text-2xl font-bold text-emerald-600">{totalAccord}</p></div>
          </div>

          <div className="card p-0 overflow-auto mb-4">
            <table className="w-full text-xs min-w-[1000px]">
              <thead><tr className="bg-gray-50">
                {["Nom", "Prénom", "Naissance", "Établissement", "Classe", "Email parent", "Tél", "Payé", "Attest.", "Vol1", "Vol2", "BIA", "Résultat BIA", "Date BIA"].map(h => (
                  <th key={h} className="px-2 py-2 text-left text-[10px] font-semibold uppercase text-gray-400">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-2 py-1.5 font-semibold">{r.nom}</td>
                    <td className="px-2 py-1.5">{r.prenom}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.date_naissance}</td>
                    <td className="px-2 py-1.5 text-gray-700 truncate max-w-[160px]">{r.etablissement}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.classe}</td>
                    <td className="px-2 py-1.5 text-gray-500 truncate max-w-[160px]">{r.parent_email || "—"}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.parent_telephone}</td>
                    <td className="px-2 py-1.5">{r.paiement_effectue ? <span className="dot-success" /> : <span className="dot-danger" />}</td>
                    <td className="px-2 py-1.5">{r.attestation_signee ? <span className="dot-success" /> : <span className="dot-danger" />}</td>
                    <td className="px-2 py-1.5">{r.vol1_effectue ? <span className="dot-success" /> : <span className="dot-danger" />}</td>
                    <td className="px-2 py-1.5">{r.vol2_effectue ? <span className="dot-success" /> : <span className="dot-danger" />}</td>
                    <td className="px-2 py-1.5">{r.bia_passe ? <span className="dot-success" /> : <span className="dot-danger" />}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.bia_resultat || "—"}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.bia_date || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 20 && <p className="text-xs text-gray-400 p-2 text-center">... et {rows.length - 20} autres</p>}
          </div>

          <div className="flex gap-2">
            <button onClick={handleImport} disabled={importing} className="btn-primary">
              {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Import en cours ({progress}%)</> : <><Upload className="w-4 h-4" /> Importer {rows.length} élèves</>}
            </button>
            <button onClick={() => { setPreview(false); setRows([]); }} disabled={importing} className="btn-secondary">
              <X className="w-4 h-4" /> Annuler
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div>
          <div className={`card mb-4 ${resultTone === "success" ? "border-emerald-200 bg-emerald-50" : resultTone === "error" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex items-center gap-2 mb-2">
              {resultTone === "success"
                ? <Check className="w-5 h-5 text-emerald-600" />
                : <AlertCircle className={`w-5 h-5 ${resultTone === "error" ? "text-red-600" : "text-amber-600"}`} />}
              <p className="text-sm font-semibold text-gray-900">
                {resultTone === "success" ? "Import terminé" : resultTone === "error" ? "Import échoué" : "Import terminé avec des erreurs"}
              </p>
            </div>
            <p className="text-sm text-gray-700">
              {result.created} élève{result.created > 1 ? "s" : ""} créé{result.created > 1 ? "s" : ""} · {result.updated} mis à jour · <span className={failedCount > 0 ? "font-semibold text-red-700" : ""}>{failedCount} en échec</span>
            </p>
            {failedCount > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-red-600 mb-1">{failedCount} erreur{failedCount > 1 ? "s" : ""} :</p>
                <div className="max-h-[200px] overflow-auto text-xs text-red-700 space-y-0.5">
                  {result.failed.map((f, i) => <p key={i}>{f.line !== null ? `Ligne ${f.line} — ` : ""}{f.message}</p>)}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setPreview(false); setRows([]); setResult(null); setParseError(null); }} className="btn-primary">
              <Upload className="w-4 h-4" /> Nouvel import
            </button>
            <a href="/dashboard/eleves" className="btn-secondary">Voir les élèves →</a>
          </div>
        </div>
      )}
    </div>
  );
}
