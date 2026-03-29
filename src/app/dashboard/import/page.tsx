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
];

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
  paiement_effectue: boolean;
  paiement_montant: number;
  paiement_mode: string;
  attestation_signee: boolean;
  vol1_effectue: boolean;
  vol2_autorise: boolean;
  vol2_effectue: boolean;
  bia_passe: boolean;
  bia_resultat: string;
  bia_date: string;
  commentaires: string;
}

function parseDate(raw: string): string {
  if (!raw) return "";
  if (raw.match(/^\d{4}-\d{2}-\d{2}$/)) return raw;
  const m1 = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  return "";
}

function parseBool(val: string): boolean {
  return val.trim().toLowerCase() === "oui" || val.trim().toLowerCase() === "true" || val.trim() === "1";
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  return lines.slice(1).map(line => {
    // Handle quoted fields
    const cols: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if ((ch === ";" || ch === ",") && !inQuote) { cols.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return {
      nom: cols[0]?.trim() || "",
      prenom: cols[1]?.trim() || "",
      date_naissance: cols[2]?.trim() || "",
      lieu_naissance: cols[3]?.trim() || "",
      adresse_rue: cols[4]?.trim() || "",
      adresse_cp: cols[5]?.trim() || "",
      adresse_ville: cols[6]?.trim() || "",
      etablissement: cols[7]?.trim() || "",
      classe: cols[8]?.trim() || "",
      parent_nom: cols[9]?.trim() || "",
      parent_prenom: cols[10]?.trim() || "",
      parent_email: cols[11]?.trim() || "",
      parent_telephone: cols[12]?.trim() || "",
      paiement_effectue: parseBool(cols[13] || ""),
      paiement_montant: parseFloat(cols[14] || "80") || 80,
      paiement_mode: cols[15]?.trim() || "",
      attestation_signee: parseBool(cols[16] || ""),
      vol1_effectue: parseBool(cols[17] || ""),
      vol2_autorise: parseBool(cols[18] || ""),
      vol2_effectue: parseBool(cols[19] || ""),
      bia_passe: parseBool(cols[20] || ""),
      bia_resultat: cols[21]?.trim() || "",
      bia_date: cols[22]?.trim() || "",
      commentaires: cols[23]?.trim() || "",
    };
  }).filter(r => r.nom && r.prenom);
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

export default function ImportPage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [preview, setPreview] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      setPreview(true);
      setResult(null);
    };
    reader.readAsText(file, "utf-8");
  }

  async function handleImport() {
    setImporting(true);
    setProgress(0);
    const errors: string[] = [];
    let created = 0;

    const { data: annee } = await supabase.from("annees").select("id").eq("active", true).single();
    if (!annee) { errors.push("Aucune annee active trouvee."); setResult({ created, errors }); setImporting(false); return; }

    // Get or create établissements
    const etabNames = [...new Set(rows.map(r => r.etablissement).filter(Boolean))];
    const etabMap: Record<string, string> = {};
    for (const name of etabNames) {
      const { data: existing } = await supabase.from("etablissements").select("id").eq("nom", name).single();
      if (existing) {
        etabMap[name] = existing.id;
      } else {
        const { data: newEtab, error } = await supabase.from("etablissements").insert({ nom: name, actif: true }).select("id").single();
        if (newEtab) etabMap[name] = newEtab.id;
        else errors.push(`Erreur creation etablissement ${name}: ${error?.message}`);
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      setProgress(Math.round(((i + 1) / rows.length) * 100));

      const dateParsed = parseDate(r.date_naissance);
      if (!dateParsed) {
        errors.push(`${r.nom} ${r.prenom}: date naissance invalide "${r.date_naissance}"`);
        continue;
      }

      const adresse = [r.adresse_rue, [r.adresse_cp, r.adresse_ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;

      const payload: any = {
        etablissement_id: etabMap[r.etablissement] || null,
        classe: r.classe || "—",
        lieu_naissance: r.lieu_naissance || "—",
        adresse: adresse,
        adresse_rue: r.adresse_rue || null,
        adresse_cp: r.adresse_cp || null,
        adresse_ville: r.adresse_ville || null,
        parent_nom: r.parent_nom || r.nom,
        parent_prenom: r.parent_prenom || "Parent",
        parent_email: r.parent_email || "inconnu@email.com",
        parent_telephone: r.parent_telephone || "",
        paiement_effectue: r.paiement_effectue,
        paiement_montant: r.paiement_effectue ? r.paiement_montant : null,
        paiement_mode: r.paiement_effectue && r.paiement_mode ? r.paiement_mode : (r.paiement_effectue ? "Import CSV" : null),
        attestation_signee: r.attestation_signee,
        attestation_date: r.attestation_signee ? new Date().toISOString() : null,
        attestation_parent_signataire: r.attestation_signee ? (`${r.parent_prenom} ${r.parent_nom}`.trim() || "Import CSV") : null,
        vol1_effectue: r.vol1_effectue,
        vol2_autorise: r.vol2_autorise || r.bia_resultat === "Admis" || r.bia_resultat === "Mention",
        vol2_effectue: r.vol2_effectue,
        bia_passe: r.bia_passe,
        bia_resultat: r.bia_passe && r.bia_resultat ? r.bia_resultat : null,
        bia_date: r.bia_passe && r.bia_date ? parseDate(r.bia_date) : null,
        commentaires: r.commentaires || null,
      };

      const { data: existing } = await supabase.from("eleves")
        .select("id")
        .eq("nom", r.nom)
        .eq("prenom", r.prenom)
        .eq("date_naissance", dateParsed)
        .single();

      if (existing) {
        const { error } = await supabase.from("eleves").update(payload).eq("id", existing.id);
        if (error) errors.push(`${r.nom} ${r.prenom}: ${error.message}`);
        else created++;
      } else {
        const { error } = await supabase.from("eleves").insert({
          nom: r.nom,
          prenom: r.prenom,
          date_naissance: dateParsed,
          annee_id: annee.id,
          ...payload,
        });
        if (error) errors.push(`${r.nom} ${r.prenom}: ${error.message}`);
        else created++;
      }
    }

    setResult({ created, errors });
    setImporting(false);
  }

  const etabs = [...new Set(rows.map(r => r.etablissement))];
  const totalPaye = rows.filter(r => r.paiement_effectue).length;
  const totalVol1 = rows.filter(r => r.vol1_effectue).length;
  const totalAccord = rows.filter(r => r.attestation_signee).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Import CSV</h1>
        <p className="text-sm text-gray-500 mt-0.5">Importer les élèves depuis un fichier CSV</p>
      </div>

      {/* Upload */}
      {!preview && (
        <div className="card">
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <FileSpreadsheet className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 mb-1">Sélectionnez votre fichier CSV</p>
            <p className="text-xs text-gray-400 mb-4">Séparateur point-virgule (;) ou virgule (,) · UTF-8</p>
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
            <p className="font-semibold mb-1">Colonnes attendues (en-tête obligatoire) :</p>
            <p className="font-mono text-[10px] leading-5 break-all">{CSV_HEADERS.join(" ; ")}</p>
            <p className="mt-2 text-gray-400">Les valeurs booléennes (paiement_effectue, attestation_signee, vol1_effectue…) acceptent : <strong>Oui</strong> / <strong>Non</strong></p>
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
                    <td className="px-2 py-1.5 text-gray-500 truncate max-w-[160px]">{r.parent_email}</td>
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
            <button onClick={() => { setPreview(false); setRows([]); }} className="btn-secondary">
              <X className="w-4 h-4" /> Annuler
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div>
          <div className={`card mb-4 ${result.errors.length === 0 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-5 h-5 text-emerald-600" />
              <p className="text-sm font-semibold text-gray-900">Import terminé</p>
            </div>
            <p className="text-sm text-gray-700">{result.created} élève{result.created > 1 ? "s" : ""} importé{result.created > 1 ? "s" : ""} / mis à jour</p>
            {result.errors.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-red-600 mb-1">{result.errors.length} erreur{result.errors.length > 1 ? "s" : ""} :</p>
                <div className="max-h-[200px] overflow-auto text-xs text-red-700 space-y-0.5">
                  {result.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setPreview(false); setRows([]); setResult(null); }} className="btn-primary">
              <Upload className="w-4 h-4" /> Nouvel import
            </button>
            <a href="/dashboard/eleves" className="btn-secondary">Voir les élèves →</a>
          </div>
        </div>
      )}
    </div>
  );
}
