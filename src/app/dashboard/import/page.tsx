"use client";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Upload, Loader2, Check, AlertCircle, FileSpreadsheet, X, Download } from "lucide-react";

interface ParsedRow {
  id_csv: string;
  etablissement: string;
  responsable: string;
  classe: string;
  nom: string;
  prenom: string;
  date_naissance: string;
  adresse: string;
  cp_ville: string;
  tel_contact: string;
  email_contact: string;
  vol1_date: string;
  vol1_pilote: string;
  vol1_effectue: boolean;
  vol2_date: string;
  vol2_pilote: string;
  vol2_effectue: boolean;
  paye: boolean;
  accord_parental: string; // Oui, Non, Majeur, N/A
}

function parseDate(raw: string): string {
  if (!raw) return "";
  // Format "2026-02-28"
  if (raw.match(/^\d{4}-\d{2}-\d{2}$/)) return raw;
  // Format "14/10/2011"
  const m1 = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  return "";
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  // Skip header
  return lines.slice(1).map(line => {
    const cols = line.split(";");
    return {
      id_csv: cols[0]?.trim() || "",
      etablissement: cols[1]?.trim() || "",
      responsable: cols[2]?.trim() || "",
      classe: cols[3]?.trim() || "",
      nom: cols[4]?.trim() || "",
      prenom: cols[5]?.trim() || "",
      date_naissance: cols[6]?.trim() || "",
      adresse: cols[7]?.trim() || "",
      cp_ville: cols[8]?.trim() || "",
      tel_contact: cols[9]?.trim() || "",
      email_contact: cols[10]?.trim() || "",
      vol1_date: cols[11]?.trim() || "",
      vol1_pilote: cols[12]?.trim() || "",
      vol1_effectue: (cols[13]?.trim() || "").toLowerCase() === "oui",
      vol2_date: cols[14]?.trim() || "",
      vol2_pilote: cols[15]?.trim() || "",
      vol2_effectue: (cols[16]?.trim() || "").toLowerCase() === "oui",
      paye: (cols[17]?.trim() || "").toLowerCase() === "oui",
      accord_parental: cols[18]?.trim() || "Non",
    };
  }).filter(r => r.nom && r.prenom);
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

    // 1. Get or create annee active
    const { data: annee } = await supabase.from("annees").select("id").eq("active", true).single();
    if (!annee) { errors.push("Aucune annee active trouvee."); setResult({ created, errors }); setImporting(false); return; }

    // 2. Get or create etablissements
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

    // 3. Import each student
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      setProgress(Math.round(((i + 1) / rows.length) * 100));

      const dateParsed = parseDate(r.date_naissance);
      if (!dateParsed) {
        errors.push(`#${r.id_csv} ${r.nom} ${r.prenom}: date naissance invalide "${r.date_naissance}"`);
        continue;
      }

      // Check if already exists (same nom + prenom + date_naissance)
      const { data: existing } = await supabase.from("eleves")
        .select("id")
        .eq("nom", r.nom)
        .eq("prenom", r.prenom)
        .eq("date_naissance", dateParsed)
        .single();

      if (existing) {
        // Update existing record
        const { error } = await supabase.from("eleves").update({
          etablissement_id: etabMap[r.etablissement] || null,
          classe: r.classe || "—",
          parent_telephone: r.tel_contact,
          parent_email: r.email_contact,
          paiement_effectue: r.paye,
          paiement_montant: r.paye ? 80 : null,
          attestation_signee: r.accord_parental === "Oui" || r.accord_parental === "Majeur",
          vol1_effectue: r.vol1_effectue,
          vol2_effectue: r.vol2_effectue,
          commentaires: [
            r.adresse ? `Adresse: ${r.adresse}, ${r.cp_ville}` : "",
            r.responsable ? `Responsable BIA: ${r.responsable}` : "",
            r.vol1_date ? `Vol 1: ${r.vol1_date} (${r.vol1_pilote})` : "",
            r.vol2_date ? `Vol 2: ${r.vol2_date} (${r.vol2_pilote})` : "",
            r.accord_parental === "Majeur" ? "Eleve majeur" : "",
          ].filter(Boolean).join(" | ") || null,
        }).eq("id", existing.id);

        if (error) errors.push(`#${r.id_csv} ${r.nom} ${r.prenom}: ${error.message}`);
        else created++;
        continue;
      }

      // Extract parent name from responsable or email
      const parentNom = r.nom;
      const parentPrenom = "Parent";

      const { error } = await supabase.from("eleves").insert({
        nom: r.nom,
        prenom: r.prenom,
        date_naissance: dateParsed,
        lieu_naissance: "—",
        etablissement_id: etabMap[r.etablissement] || null,
        classe: r.classe || "—",
        annee_id: annee.id,
        parent_nom: parentNom,
        parent_prenom: parentPrenom,
        parent_email: r.email_contact || "inconnu@email.com",
        parent_telephone: r.tel_contact || "",
        paiement_effectue: r.paye,
        paiement_montant: r.paye ? 80 : null,
        paiement_mode: r.paye ? "Import CSV" : null,
        attestation_signee: r.accord_parental === "Oui" || r.accord_parental === "Majeur",
        attestation_date: (r.accord_parental === "Oui" || r.accord_parental === "Majeur") ? new Date().toISOString() : null,
        attestation_parent_signataire: (r.accord_parental === "Oui" || r.accord_parental === "Majeur") ? "Import CSV" : null,
        vol1_effectue: r.vol1_effectue,
        vol2_effectue: r.vol2_effectue,
        commentaires: [
          r.adresse ? `Adresse: ${r.adresse}, ${r.cp_ville}` : "",
          r.responsable ? `Responsable BIA: ${r.responsable}` : "",
          r.vol1_date ? `Vol 1: ${r.vol1_date} (${r.vol1_pilote})` : "",
          r.vol2_date ? `Vol 2: ${r.vol2_date} (${r.vol2_pilote})` : "",
          r.accord_parental === "Majeur" ? "Eleve majeur" : "",
          r.accord_parental === "N/A" ? "Accord parental: N/A" : "",
        ].filter(Boolean).join(" | ") || null,
      });

      if (error) errors.push(`#${r.id_csv} ${r.nom} ${r.prenom}: ${error.message}`);
      else created++;
    }

    setResult({ created, errors });
    setImporting(false);
  }

  // Stats
  const etabs = [...new Set(rows.map(r => r.etablissement))];
  const totalPaye = rows.filter(r => r.paye).length;
  const totalVol1 = rows.filter(r => r.vol1_effectue).length;
  const totalAccord = rows.filter(r => r.accord_parental === "Oui" || r.accord_parental === "Majeur").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Import CSV</h1>
        <p className="text-sm text-gray-500 mt-0.5">Importer les eleves depuis un fichier CSV (format BIA)</p>
      </div>

      {/* Upload */}
      {!preview && (
        <div className="card">
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <FileSpreadsheet className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 mb-1">Selectionnez votre fichier CSV</p>
            <p className="text-xs text-gray-400 mb-4">Format : separateur point-virgule (;), encodage UTF-8</p>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="btn-primary">
              <Upload className="w-4 h-4" /> Choisir un fichier
            </button>
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <p className="font-semibold mb-1">Colonnes attendues :</p>
            <p>id ; etablissement ; responsable ; classe ; nom ; prenom ; date_naissance ; adresse ; cp_ville ; tel_contact ; email_contact ; vol1_date ; vol1_pilote ; vol1_effectue ; vol2_date ; vol2_pilote ; vol2_effectue ; paye ; accord_parental</p>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && !result && (
        <div>
          <div className="flex gap-3 flex-wrap mb-4">
            <div className="card flex-1 min-w-[140px]"><p className="text-xs text-gray-500">Eleves</p><p className="text-2xl font-bold text-gray-900">{rows.length}</p></div>
            <div className="card flex-1 min-w-[140px]"><p className="text-xs text-gray-500">Etablissements</p><p className="text-2xl font-bold text-gray-900">{etabs.length}</p></div>
            <div className="card flex-1 min-w-[140px]"><p className="text-xs text-gray-500">Payes</p><p className="text-2xl font-bold text-emerald-600">{totalPaye}</p></div>
            <div className="card flex-1 min-w-[140px]"><p className="text-xs text-gray-500">Vol 1 effectue</p><p className="text-2xl font-bold text-brand-500">{totalVol1}</p></div>
            <div className="card flex-1 min-w-[140px]"><p className="text-xs text-gray-500">Accord parental</p><p className="text-2xl font-bold text-emerald-600">{totalAccord}</p></div>
          </div>

          <div className="card p-0 overflow-auto mb-4">
            <table className="w-full text-xs min-w-[1000px]">
              <thead><tr className="bg-gray-50">
                {["#", "Etablissement", "Nom", "Prenom", "Naissance", "Classe", "Email", "Tel", "Vol1", "Vol2", "Paye", "Accord"].map(h => (
                  <th key={h} className="px-2 py-2 text-left text-[10px] font-semibold uppercase text-gray-400">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-2 py-1.5 text-gray-400">{r.id_csv}</td>
                    <td className="px-2 py-1.5 text-gray-700 truncate max-w-[200px]">{r.etablissement}</td>
                    <td className="px-2 py-1.5 font-semibold">{r.nom}</td>
                    <td className="px-2 py-1.5">{r.prenom}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.date_naissance}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.classe}</td>
                    <td className="px-2 py-1.5 text-gray-500 truncate max-w-[160px]">{r.email_contact}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.tel_contact}</td>
                    <td className="px-2 py-1.5">{r.vol1_effectue ? <span className="dot-success" /> : <span className="dot-danger" />}</td>
                    <td className="px-2 py-1.5">{r.vol2_effectue ? <span className="dot-success" /> : <span className="dot-danger" />}</td>
                    <td className="px-2 py-1.5">{r.paye ? <span className="dot-success" /> : <span className="dot-danger" />}</td>
                    <td className="px-2 py-1.5">{r.accord_parental === "Oui" || r.accord_parental === "Majeur" ? <span className="dot-success" /> : <span className="dot-danger" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 20 && <p className="text-xs text-gray-400 p-2 text-center">... et {rows.length - 20} autres</p>}
          </div>

          <div className="flex gap-2">
            <button onClick={handleImport} disabled={importing} className="btn-primary">
              {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Import en cours ({progress}%)</> : <><Upload className="w-4 h-4" /> Importer {rows.length} eleves</>}
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
              <p className="text-sm font-semibold text-gray-900">Import termine</p>
            </div>
            <p className="text-sm text-gray-700">{result.created} eleve{result.created > 1 ? "s" : ""} importe{result.created > 1 ? "s" : ""} / mis a jour</p>
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
            <a href="/dashboard/eleves" className="btn-secondary">Voir les eleves →</a>
          </div>
        </div>
      )}
    </div>
  );
}
