"use client";
import { useState, useRef, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CSV_HEADERS, CSV_SAMPLE, decodeFile, normalizeText, parseCSV, parseDate,
  type ParsedRow,
} from "@/lib/importEleves";
import { Upload, Loader2, Check, AlertCircle, FileSpreadsheet, X, Download, Users, Wand2 } from "lucide-react";

type Source = "ffa" | "csv";

interface ImportResult {
  created: number;
  updated: number;
  failed: { line: number | null; message: string }[];
  comptes: { crees: number; existants: number; lies: number } | null;
}

const PAR_PAGE = 50;
const LOT_COMPTES = 25;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function age(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const d = new Date(`${dateIso}T00:00:00Z`);
  const diff = Date.now() - d.getTime();
  if (isNaN(diff)) return null;
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

function downloadTemplate() {
  const header = CSV_HEADERS.join(";");
  const sample = CSV_SAMPLE.map(v => `"${v}"`).join(";");
  const csv = [header, sample].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
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
  const [tab, setTab] = useState<Source>("ffa");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [cochees, setCochees] = useState<Set<number>>(new Set());
  const [source, setSource] = useState<Source | null>(null);
  const [lecture, setLecture] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [etape, setEtape] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [creerComptes, setCreerComptes] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(0);
  const [etabsConnus, setEtabsConnus] = useState<string[]>([]);
  const [groupEtab, setGroupEtab] = useState("");
  const [groupClasse, setGroupClasse] = useState("");

  useEffect(() => {
    supabase.from("etablissements").select("nom").eq("actif", true).order("nom")
      .then(({ data }) => setEtabsConnus((data || []).map((e: { nom: string }) => e.nom).filter(Boolean)));
  }, [supabase]);

  function reinit() {
    setRows([]);
    setCochees(new Set());
    setSource(null);
    setPreview(false);
    setResult(null);
    setParseError(null);
    setRecherche("");
    setPage(0);
    setGroupEtab("");
    setGroupClasse("");
  }

  function charger(parsed: ParsedRow[], src: Source) {
    setRows(parsed);
    setCochees(new Set(parsed.map(r => r.line)));
    setSource(src);
    setParseError(null);
    setPreview(true);
    setPage(0);
    setRecherche("");
  }

  async function handleFileCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setResult(null);
    try {
      const { rows: parsed, error } = parseCSV(decodeFile(await file.arrayBuffer()));
      if (error) { setParseError(error); setRows([]); setPreview(false); return; }
      charger(parsed, "csv");
    } catch (err) {
      setParseError(`Lecture du fichier impossible : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleFileFfa(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setResult(null);
    setLecture(true);
    try {
      const body = new FormData();
      body.append("fichier", file);
      const res = await fetch("/api/import/ffa", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) { setParseError(json.error || "Lecture du fichier impossible"); setRows([]); setPreview(false); return; }
      charger(json.rows as ParsedRow[], "ffa");
      if (json.ignorees > 0) {
        setParseError(`${json.ignorees} ligne${json.ignorees > 1 ? "s" : ""} du fichier sans nom ou prénom ${json.ignorees > 1 ? "ont" : "a"} été ignorée${json.ignorees > 1 ? "s" : ""}.`);
      }
    } catch (err) {
      setParseError(`Lecture du fichier impossible : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLecture(false);
    }
  }

  function majCellule(line: number, champ: keyof ParsedRow, valeur: string) {
    setRows(prev => prev.map(r => (r.line === line ? { ...r, [champ]: valeur } : r)));
  }

  function basculer(line: number) {
    setCochees(prev => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line); else next.add(line);
      return next;
    });
  }

  const visibles = useMemo(() => {
    const q = normalizeText(recherche);
    if (!q) return rows;
    return rows.filter(r => normalizeText(`${r.nom} ${r.prenom} ${r.etablissement} ${r.parent_email}`).includes(q));
  }, [rows, recherche]);

  const pages = Math.max(1, Math.ceil(visibles.length / PAR_PAGE));
  const pageSure = Math.min(page, pages - 1);
  const affichees = visibles.slice(pageSure * PAR_PAGE, pageSure * PAR_PAGE + PAR_PAGE);

  function cocherVisibles(valeur: boolean) {
    setCochees(prev => {
      const next = new Set(prev);
      for (const r of visibles) { if (valeur) next.add(r.line); else next.delete(r.line); }
      return next;
    });
  }

  function cocherAgeBia() {
    setCochees(prev => {
      const next = new Set(prev);
      for (const r of rows) {
        const a = age(parseDate(r.date_naissance));
        if (a !== null && a >= 13 && a <= 20) next.add(r.line); else next.delete(r.line);
      }
      return next;
    });
  }

  function appliquerGroupe() {
    if (!groupEtab && !groupClasse) return;
    setRows(prev => prev.map(r => {
      if (!cochees.has(r.line)) return r;
      return {
        ...r,
        etablissement: groupEtab || r.etablissement,
        classe: groupClasse || r.classe,
      };
    }));
  }

  const aImporter = useMemo(() => rows.filter(r => cochees.has(r.line)), [rows, cochees]);

  function problemes(r: ParsedRow) {
    return {
      nom: !r.nom.trim(),
      prenom: !r.prenom.trim(),
      date_naissance: !parseDate(r.date_naissance),
      etablissement: !r.etablissement.trim(),
      parent_email: !!r.parent_email.trim() && !EMAIL_OK.test(r.parent_email.trim()),
    };
  }
  const bloquantes = useMemo(
    () => aImporter.filter(r => Object.values(problemes(r)).some(Boolean)).length,
    [aImporter],
  );
  const sansEmail = useMemo(() => aImporter.filter(r => !r.parent_email.trim()).length, [aImporter]);

  async function creerLesComptes(lignes: ParsedRow[]) {
    const vus = new Set<string>();
    const parents: { email: string; nom: string; prenom: string; telephone: string }[] = [];
    const ajouter = (email: string, nom: string, prenom: string, telephone: string) => {
      const e = email.trim().toLowerCase();
      if (!e || vus.has(e)) return;
      vus.add(e);
      parents.push({ email: e, nom, prenom, telephone });
    };
    for (const r of lignes) {
      ajouter(r.parent_email, r.parent_nom, r.parent_prenom, r.parent_telephone);
      ajouter(r.parent2_email, r.parent2_nom, r.parent2_prenom, r.parent2_telephone);
    }
    const bilan = { crees: 0, existants: 0, lies: 0 };
    const erreurs: { line: number | null; message: string }[] = [];
    for (let i = 0; i < parents.length; i += LOT_COMPTES) {
      const lot = parents.slice(i, i + LOT_COMPTES);
      setEtape(`Création des comptes parents (${Math.min(i + lot.length, parents.length)}/${parents.length})…`);
      try {
        const res = await fetch("/api/comptes-parents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parents: lot }),
        });
        const json = await res.json();
        if (!res.ok) { erreurs.push({ line: null, message: `Comptes parents : ${json.error || res.statusText}` }); continue; }
        bilan.crees += json.crees || 0;
        bilan.existants += json.existants || 0;
        bilan.lies += json.lies || 0;
        for (const e of json.erreurs || []) erreurs.push({ line: null, message: `Compte ${e.email} : ${e.message}` });
      } catch (err) {
        erreurs.push({ line: null, message: `Comptes parents : ${err instanceof Error ? err.message : String(err)}` });
      }
    }
    return { bilan, erreurs };
  }

  async function handleImport() {
    setImporting(true);
    setProgress(0);
    setEtape("");
    const res: ImportResult = { created: 0, updated: 0, failed: [], comptes: null };
    const fail = (line: number | null, message: string) => res.failed.push({ line, message });
    const importees: ParsedRow[] = [];

    try {
      const { data: annee } = await supabase.from("annees").select("id").eq("active", true).single();
      if (!annee) { fail(null, "Aucune année active trouvée."); return; }

      const etabList = await fetchAll<{ id: string; nom: string }>((from, to) => supabase.from("etablissements").select("id, nom").range(from, to));
      const etabMap: Record<string, string> = {};
      for (const e of etabList) {
        const key = normalizeText(e.nom || "");
        if (key && !etabMap[key]) etabMap[key] = e.id;
      }
      for (const name of aImporter.map(r => r.etablissement).filter(Boolean)) {
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

      for (let i = 0; i < aImporter.length; i++) {
        const r = aImporter[i];
        setProgress(Math.round(((i + 1) / aImporter.length) * 100));
        setEtape(`Élèves (${i + 1}/${aImporter.length})…`);
        const label = `${r.nom} ${r.prenom}`;

        const dateParsed = parseDate(r.date_naissance);
        if (!dateParsed) { fail(r.line, `${label} : date de naissance invalide « ${r.date_naissance} »`); continue; }

        const k = eleveKey(r.nom, r.prenom, dateParsed);
        const matches = existingMap.get(k) || [];
        if (matches.length > 1) { fail(r.line, `${label} : plusieurs élèves correspondent dans l'année active, ligne ignorée`); continue; }

        const etabId = r.etablissement ? etabMap[normalizeText(r.etablissement)] || null : null;
        if (!etabId && matches.length === 0) {
          fail(r.line, `${label} : établissement manquant, l'élève n'a pas été créé`);
          continue;
        }
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
          if (r.parent_email) upd.parent_email = r.parent_email.trim().toLowerCase();
          if (r.parent_telephone) upd.parent_telephone = r.parent_telephone;
          // Second responsable légal : rempli seulement si la colonne est renseignée
          if (r.parent2_nom) upd.parent2_nom = r.parent2_nom;
          if (r.parent2_prenom) upd.parent2_prenom = r.parent2_prenom;
          if (r.parent2_email) upd.parent2_email = r.parent2_email.trim().toLowerCase();
          if (r.parent2_telephone) upd.parent2_telephone = r.parent2_telephone;
          if (r.paiement_effectue !== null) upd.paiement_effectue = r.paiement_effectue;
          if (r.paiement_montant !== null) upd.paiement_montant = r.paiement_montant;
          if (r.paiement_mode) upd.paiement_mode = r.paiement_mode;
          if (r.attestation_signee && !existing.attestation_signee) {
            upd.attestation_signee = true;
            upd.attestation_date = new Date().toISOString();
            upd.attestation_parent_signataire = `${r.parent_prenom} ${r.parent_nom}`.trim() || "Import";
          }
          if (r.vol1_effectue !== null) upd.vol1_effectue = r.vol1_effectue;
          if (r.vol2_autorise !== null) upd.vol2_autorise = r.vol2_autorise || biaAdmis;
          else if (biaAdmis) upd.vol2_autorise = true;
          if (r.vol2_effectue !== null) upd.vol2_effectue = r.vol2_effectue;
          if (r.bia_passe !== null) upd.bia_passe = r.bia_passe;
          if (r.bia_resultat) upd.bia_resultat = r.bia_resultat;
          if (r.bia_resultat === "Mention" && r.bia_mention) upd.bia_mention = r.bia_mention;
          if (biaDate) upd.bia_date = biaDate;
          if (r.commentaires) upd.commentaires = r.commentaires;

          if (Object.keys(upd).length === 0) { res.updated++; importees.push(r); continue; }
          const { error } = await supabase.from("eleves").update(upd).eq("id", existing.id);
          if (error) fail(r.line, `${label} : ${error.message}`);
          else {
            res.updated++;
            importees.push(r);
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
            parent_email: r.parent_email ? r.parent_email.trim().toLowerCase() : null,
            parent_telephone: r.parent_telephone || "",
            parent2_nom: r.parent2_nom || null,
            parent2_prenom: r.parent2_prenom || null,
            parent2_email: r.parent2_email ? r.parent2_email.trim().toLowerCase() : null,
            parent2_telephone: r.parent2_telephone || null,
            paiement_effectue: paye,
            paiement_montant: paye ? r.paiement_montant ?? 80 : null,
            paiement_mode: paye ? r.paiement_mode || "Import" : null,
            attestation_signee: signee,
            attestation_date: signee ? new Date().toISOString() : null,
            attestation_parent_signataire: signee ? (`${r.parent_prenom} ${r.parent_nom}`.trim() || "Import") : null,
            vol1_effectue: r.vol1_effectue === true,
            vol2_autorise: r.vol2_autorise === true || biaAdmis,
            vol2_effectue: r.vol2_effectue === true,
            bia_passe: r.bia_passe === true,
            bia_resultat: r.bia_passe && r.bia_resultat ? r.bia_resultat : null,
            bia_mention: r.bia_passe && r.bia_resultat === "Mention" && r.bia_mention ? r.bia_mention : null,
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
            importees.push(r);
            existingMap.set(k, [{ id: inserted.id, attestation_signee: signee }]);
          }
        }
      }

      // Comptes parents : créés en silence, aucun email n'est envoyé ici.
      if (creerComptes && importees.length > 0) {
        const { bilan, erreurs } = await creerLesComptes(importees);
        res.comptes = bilan;
        res.failed.push(...erreurs);
      }
    } catch (err) {
      fail(null, `Import interrompu : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setResult(res);
      setImporting(false);
      setEtape("");
    }
  }

  const etabs = [...new Set(aImporter.map(r => normalizeText(r.etablissement)).filter(Boolean))];
  const totalPaye = aImporter.filter(r => r.paiement_effectue).length;
  const totalBia = aImporter.filter(r => r.bia_passe).length;

  const failedCount = result?.failed.length ?? 0;
  const succeeded = result ? result.created + result.updated : 0;
  const resultTone = failedCount === 0 ? "success" : succeeded === 0 ? "error" : "warning";

  const cellClass = (ko: boolean) =>
    `w-full rounded border px-1.5 py-1 text-xs outline-none focus:border-brand-400 ${ko ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"}`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Import des élèves</h1>
        <p className="text-sm text-gray-500 mt-0.5">Depuis l&apos;export FFA (SMILE) ou un fichier CSV</p>
      </div>

      {/* Upload */}
      {!preview && !result && (
        <div>
          <div className="flex gap-1 mb-4 p-1 bg-gray-100 rounded-lg w-fit">
            {([["ffa", "Export FFA (SMILE)"], ["csv", "Fichier CSV"]] as [Source, string][]).map(([k, label]) => (
              <button key={k} onClick={() => { setTab(k); setParseError(null); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${tab === k ? "bg-white text-brand-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="card">
            {parseError && (
              <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{parseError}</p>
              </div>
            )}

            {tab === "ffa" ? (
              <>
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <FileSpreadsheet className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 mb-1">Sélectionnez l&apos;export des adhérents téléchargé depuis SMILE</p>
                  <p className="text-xs text-gray-400 mb-4">Fichier .xls ou .xlsx · en-tête FFA d&apos;origine, sans modification</p>
                  <input ref={fileRef} type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileFfa} className="hidden" />
                  <button onClick={() => fileRef.current?.click()} disabled={lecture} className="btn-primary">
                    {lecture ? <><Loader2 className="w-4 h-4 animate-spin" /> Lecture…</> : <><Upload className="w-4 h-4" /> Choisir le fichier FFA</>}
                  </button>
                </div>
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-2">
                  <p><strong className="text-gray-700">Comment récupérer le fichier :</strong> sur SMILE FFA, ouvrez la liste des adhérents de votre club, puis exportez-la au format Excel. N&apos;en modifiez pas l&apos;en-tête.</p>
                  <p><strong className="text-gray-700">Colonnes reprises :</strong> Nom, Prénom, DDN, Adresse, Adresse 2, Code postal, Ville, Téléphone, Portable, Email, BIA Obtenu, Mention, Etablissement.</p>
                  <p><strong className="text-gray-700">Colonnes ignorées :</strong> Civilité, Nb. min AV, Nb. min AR, Responsable CAEA.</p>
                  <p>L&apos;export contient tous les adhérents du club : l&apos;écran suivant vous laisse <strong>cocher les seuls élèves BIA</strong>, corriger chaque cellule et compléter l&apos;établissement avant d&apos;importer.</p>
                  <p>L&apos;adresse e-mail est enregistrée comme <strong>adresse du responsable légal</strong>. Aucun email n&apos;est envoyé pendant l&apos;import : les accès familles partent plus tard, depuis <strong>Utilisateurs et rôles → Inviter les parents</strong>.</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <FileSpreadsheet className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 mb-1">Sélectionnez votre fichier CSV</p>
                  <p className="text-xs text-gray-400 mb-4">Séparateur point-virgule (;) ou virgule (,) · UTF-8 ou Windows-1252 (Excel)</p>
                  <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileCsv} className="hidden" />
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Aperçu modifiable */}
      {preview && !result && (
        <div>
          {parseError && (
            <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">{parseError}</p>
            </div>
          )}

          <div className="flex gap-3 flex-wrap mb-4">
            <div className="card flex-1 min-w-[130px]"><p className="text-xs text-gray-500">Lignes du fichier</p><p className="text-2xl font-bold text-gray-900">{rows.length}</p></div>
            <div className="card flex-1 min-w-[130px]"><p className="text-xs text-gray-500">Cochées pour l&apos;import</p><p className="text-2xl font-bold text-brand-500">{aImporter.length}</p></div>
            <div className="card flex-1 min-w-[130px]"><p className="text-xs text-gray-500">À compléter</p><p className={`text-2xl font-bold ${bloquantes > 0 ? "text-red-600" : "text-gray-900"}`}>{bloquantes}</p></div>
            <div className="card flex-1 min-w-[130px]"><p className="text-xs text-gray-500">Établissements</p><p className="text-2xl font-bold text-gray-900">{etabs.length}</p></div>
            <div className="card flex-1 min-w-[130px]"><p className="text-xs text-gray-500">Sans email parent</p><p className={`text-2xl font-bold ${sansEmail > 0 ? "text-amber-600" : "text-gray-900"}`}>{sansEmail}</p></div>
            {source === "csv" && <div className="card flex-1 min-w-[130px]"><p className="text-xs text-gray-500">Payés</p><p className="text-2xl font-bold text-emerald-600">{totalPaye}</p></div>}
            {source === "ffa" && <div className="card flex-1 min-w-[130px]"><p className="text-xs text-gray-500">BIA déjà obtenu</p><p className="text-2xl font-bold text-emerald-600">{totalBia}</p></div>}
          </div>

          <div className="card mb-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input value={recherche} onChange={e => { setRecherche(e.target.value); setPage(0); }}
                placeholder="Rechercher un nom, un établissement, un email…" className="input flex-1 min-w-[220px]" />
              <button onClick={() => cocherVisibles(true)} className="btn-secondary text-xs">Tout cocher</button>
              <button onClick={() => cocherVisibles(false)} className="btn-secondary text-xs">Tout décocher</button>
              <button onClick={cocherAgeBia} className="btn-secondary text-xs" title="Ne garder que les lignes dont l'âge calculé est compris entre 13 et 20 ans">
                <Wand2 className="w-3.5 h-3.5" /> Cocher les 13–20 ans
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-gray-100">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Établissement à appliquer</label>
                <input list="etabs-connus" value={groupEtab} onChange={e => setGroupEtab(e.target.value)} placeholder="Lycée…" className="input" />
                <datalist id="etabs-connus">{etabsConnus.map(n => <option key={n} value={n} />)}</datalist>
              </div>
              <div className="w-32">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Classe</label>
                <input value={groupClasse} onChange={e => setGroupClasse(e.target.value)} placeholder="2nde" className="input" />
              </div>
              <button onClick={appliquerGroupe} disabled={!groupEtab && !groupClasse} className="btn-secondary">
                Appliquer aux {aImporter.length} ligne{aImporter.length > 1 ? "s" : ""} cochée{aImporter.length > 1 ? "s" : ""}
              </button>
            </div>
            <label className="flex items-start gap-2 pt-1 border-t border-gray-100 cursor-pointer">
              <input type="checkbox" checked={creerComptes} onChange={e => setCreerComptes(e.target.checked)} className="mt-0.5 w-4 h-4 accent-brand-500" />
              <span className="text-xs text-gray-600">
                <span className="font-semibold text-gray-800 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Créer les comptes des responsables légaux</span>
                Les comptes sont créés en silence et rattachés à leurs enfants. <strong>Aucun email n&apos;est envoyé</strong> : l&apos;invitation part uniquement depuis Utilisateurs et rôles → Inviter les parents.
              </span>
            </label>
          </div>

          <div className="card p-0 overflow-auto mb-4">
            <table className="w-full text-xs min-w-[1240px]">
              <thead><tr className="bg-gray-50">
                <th className="px-2 py-2 w-8"></th>
                {["Nom", "Prénom", "Naissance", "Âge", "Lieu naissance", "Établissement", "Classe", "Nom parent", "Prénom parent", "Email parent", "Tél. parent", source === "ffa" ? "BIA" : "Payé"].map(h => (
                  <th key={h} className="px-1.5 py-2 text-left text-[10px] font-semibold uppercase text-gray-400">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {affichees.map(r => {
                  const pb = problemes(r);
                  const coche = cochees.has(r.line);
                  const a = age(parseDate(r.date_naissance));
                  return (
                    <tr key={r.line} className={`border-t border-gray-100 ${coche ? "" : "opacity-40"}`}>
                      <td className="px-2 py-1 align-middle">
                        <input type="checkbox" checked={coche} onChange={() => basculer(r.line)} className="w-4 h-4 accent-brand-500" />
                      </td>
                      <td className="px-1.5 py-1 w-[120px]"><input value={r.nom} onChange={e => majCellule(r.line, "nom", e.target.value)} className={cellClass(coche && pb.nom)} /></td>
                      <td className="px-1.5 py-1 w-[110px]"><input value={r.prenom} onChange={e => majCellule(r.line, "prenom", e.target.value)} className={cellClass(coche && pb.prenom)} /></td>
                      <td className="px-1.5 py-1 w-[100px]"><input value={r.date_naissance} onChange={e => majCellule(r.line, "date_naissance", e.target.value)} placeholder="jj/mm/aaaa" className={cellClass(coche && pb.date_naissance)} /></td>
                      <td className="px-1.5 py-1 text-gray-500 text-center">{a ?? "—"}</td>
                      <td className="px-1.5 py-1 w-[110px]"><input value={r.lieu_naissance} onChange={e => majCellule(r.line, "lieu_naissance", e.target.value)} className={cellClass(false)} /></td>
                      <td className="px-1.5 py-1 w-[150px]"><input list="etabs-connus" value={r.etablissement} onChange={e => majCellule(r.line, "etablissement", e.target.value)} className={cellClass(coche && pb.etablissement)} /></td>
                      <td className="px-1.5 py-1 w-[80px]"><input value={r.classe} onChange={e => majCellule(r.line, "classe", e.target.value)} className={cellClass(false)} /></td>
                      <td className="px-1.5 py-1 w-[110px]"><input value={r.parent_nom} onChange={e => majCellule(r.line, "parent_nom", e.target.value)} className={cellClass(false)} /></td>
                      <td className="px-1.5 py-1 w-[100px]"><input value={r.parent_prenom} onChange={e => majCellule(r.line, "parent_prenom", e.target.value)} className={cellClass(false)} /></td>
                      <td className="px-1.5 py-1 w-[190px]"><input value={r.parent_email} onChange={e => majCellule(r.line, "parent_email", e.target.value)} className={cellClass(coche && pb.parent_email)} /></td>
                      <td className="px-1.5 py-1 w-[110px]"><input value={r.parent_telephone} onChange={e => majCellule(r.line, "parent_telephone", e.target.value)} className={cellClass(false)} /></td>
                      <td className="px-1.5 py-1 text-center">{(source === "ffa" ? r.bia_passe : r.paiement_effectue) ? <span className="dot-success" /> : <span className="dot-danger" />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visibles.length === 0 && <p className="text-xs text-gray-400 p-4 text-center">Aucune ligne ne correspond à la recherche.</p>}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 mb-4">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={pageSure === 0} className="btn-secondary text-xs">← Précédent</button>
              <span className="text-xs text-gray-500">Page {pageSure + 1} / {pages} · {visibles.length} ligne{visibles.length > 1 ? "s" : ""}</span>
              <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={pageSure >= pages - 1} className="btn-secondary text-xs">Suivant →</button>
            </div>
          )}

          {bloquantes > 0 && (
            <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">
                {bloquantes} ligne{bloquantes > 1 ? "s" : ""} cochée{bloquantes > 1 ? "s" : ""} {bloquantes > 1 ? "sont" : "est"} incomplète{bloquantes > 1 ? "s" : ""} (cellules en rouge : nom, prénom, date de naissance au format jj/mm/aaaa, établissement, email valide).
                Corrigez-les ou décochez-les : elles seraient refusées à l&apos;import.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleImport} disabled={importing || aImporter.length === 0 || bloquantes > 0} className="btn-primary">
              {importing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {etape || `Import en cours (${progress}%)`}</>
                : <><Upload className="w-4 h-4" /> Importer {aImporter.length} élève{aImporter.length > 1 ? "s" : ""}</>}
            </button>
            <button onClick={reinit} disabled={importing} className="btn-secondary">
              <X className="w-4 h-4" /> Annuler
            </button>
          </div>
        </div>
      )}

      {/* Résultat */}
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
            {result.comptes && (
              <p className="text-sm text-gray-700 mt-1">
                Comptes responsables légaux : {result.comptes.crees} créé{result.comptes.crees > 1 ? "s" : ""} · {result.comptes.existants} déjà existant{result.comptes.existants > 1 ? "s" : ""} · {result.comptes.lies} rattachement{result.comptes.lies > 1 ? "s" : ""} aux élèves.
                <span className="text-gray-500"> Aucun email n&apos;a été envoyé — utilisez <strong>Utilisateurs et rôles → Inviter les parents</strong> pour leur transmettre leur accès.</span>
              </p>
            )}
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
            <button onClick={reinit} className="btn-primary">
              <Upload className="w-4 h-4" /> Nouvel import
            </button>
            <a href="/dashboard/eleves" className="btn-secondary">Voir les élèves →</a>
            <a href="/dashboard/utilisateurs" className="btn-secondary">Inviter les parents →</a>
          </div>
        </div>
      )}
    </div>
  );
}
